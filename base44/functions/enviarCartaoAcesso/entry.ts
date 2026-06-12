import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// ACESSOS RÁPIDOS NEURALTEC — cartão compacto, itens lidos do cadastro
// ============================================================================
// Modos:
//  1. manual → atendente envia pelo chat (sem trava)
//  2. automacao → primeira mensagem inbound da conversa (1x por thread,
//     marcado em thread.campos_personalizados.acessos_rapidos_enviado)
// ============================================================================

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const isAutomacao = !!body?.event;
    let threadId, contactId, integrationId, trigger;

    if (isAutomacao) {
      const msg = body.data;
      if (!msg || msg.sender_type !== 'contact' || msg.channel !== 'whatsapp') {
        return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
      }
      threadId = msg.thread_id;
      contactId = msg.sender_id;
      trigger = 'auto_primeira_msg';
    } else {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
    }

    if (!threadId && !contactId) {
      return Response.json({ success: false, error: 'thread_id ou contact_id obrigatório' }, { status: 400 });
    }

    // ── Carregar thread + contato ──
    etapa = 'carregar_thread_contato';
    let thread = null;
    if (threadId) {
      thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    }
    if (!contactId && thread?.contact_id) contactId = thread.contact_id;
    if (!contactId) return Response.json({ success: false, error: 'Contato não identificado' });

    if (!thread && contactId) {
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contactId, is_canonical: true
      });
      thread = threads[0] || null;
    }

    // ── Guards (modo automático) ──
    if (trigger === 'auto_primeira_msg') {
      // Só 1x por conversa
      if (thread?.campos_personalizados?.acessos_rapidos_enviado) {
        return Response.json({ success: true, skipped: 'ja_enviado_nesta_conversa' });
      }
    }

    etapa = 'carregar_contact';
    const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contact?.telefone) {
      return Response.json({ success: false, skipped: 'sem_telefone' });
    }

    if (trigger === 'auto_primeira_msg') {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      if (tipo === 'fornecedor') {
        return Response.json({ success: true, skipped: 'tipo_contato_excluido' });
      }
      if (contact.bloqueado) {
        return Response.json({ success: true, skipped: 'bloqueado' });
      }
    }

    // ── Itens do cadastro ──
    etapa = 'carregar_itens';
    console.log('[enviarCartaoAcesso] carregando itens AcessoRapido...');
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    console.log('[enviarCartaoAcesso] itens:', itens.length);
    if (!itens.length) {
      return Response.json({ success: false, error: 'Nenhum acesso rápido cadastrado' });
    }

    // ── Selecionar integração ──
    etapa = 'selecionar_integracao';
    let integration = null;
    if (integrationId) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = (thread?.whatsapp_integration_id && ints.find(i => i.id === thread.whatsapp_integration_id)) || ints[0];
    }
    if (!integration) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' });
    }

    // ── Enviar via gateway (Lista Interativa nativa) ──
    etapa = 'enviar_whatsapp';
    console.log('[enviarCartaoAcesso] enviando lista via', integration.nome_instancia);

    // id rastreável (acesso_rapido:ID) — o conteúdo (URL/Pix/setor) é resolvido
    // pelo handler responderAcessoRapido quando o contato toca na opção
    const primeiroNome = (contact.nome || '').trim().split(/\s+/)[0] || '';
    const opcoesLista = itens.map(i => ({
      id: `acesso_rapido:${i.id}`,
      title: `${i.emoji || '🔗'} ${i.titulo}`.slice(0, 24),
      description: (i.descricao || i.categoria || 'Toque para acessar').slice(0, 72)
    }));

    const saudacao = primeiroNome ? `Olá, ${primeiroNome}! ` : 'Olá! ';
    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integration.id,
      numero_destino: contact.telefone,
      mensagem: `${saudacao}Já recebemos sua mensagem e em breve um atendente vai falar com você. 😊\n\nVisite nossos canais enquanto aguarda o atendimento.`,
      interactive_list: {
        title: 'NEURALTEC — Acessos rápidos',
        button_label: 'Visite nossos canais',
        options: opcoesLista
      }
    });
    if (!resp?.data?.success) {
      return Response.json({ success: false, error: resp?.data?.error || 'erro_envio' });
    }

    // ── Persistir Message na thread ──
    const now = new Date().toISOString();
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: '⚡ NEURALTEC — Acessos rápidos (lista interativa enviada)',
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.data.message_id,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'acessos_rapidos_lista',
          trigger
        }
      });

      // ── Marcar envio na thread (não repetir na conversa) ──
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acessos_rapidos_enviado: true
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ ${contact.nome} (trigger=${trigger}, itens=${itens.length})`);
    return Response.json({ success: true, message_id: resp.data.message_id, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});