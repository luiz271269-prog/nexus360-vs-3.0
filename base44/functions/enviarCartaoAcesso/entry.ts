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
      const user = await base44.auth.me();
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

    const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contact?.telefone) {
      return Response.json({ success: false, skipped: 'sem_telefone' });
    }

    if (trigger === 'auto_primeira_msg') {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      if (['fornecedor', 'parceiro'].includes(tipo)) {
        return Response.json({ success: true, skipped: 'tipo_contato_excluido' });
      }
      if (contact.bloqueado || contact.whatsapp_optin === false) {
        return Response.json({ success: true, skipped: 'bloqueado_ou_optout' });
      }
    }

    // ── Itens do cadastro ──
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    if (!itens.length) {
      return Response.json({ success: false, error: 'Nenhum acesso rápido cadastrado' });
    }

    // ── Mensagem compacta ──
    const linhas = itens.map(i => {
      const emoji = i.emoji || '🔗';
      const valor = i.tipo === 'pix' ? `*${i.url}*` : i.url;
      return `${emoji} ${i.titulo}: ${valor}`;
    });
    const textoEnvio = `⚡ *NEURALTEC — Acessos rápidos*\n\n${linhas.join('\n')}`;

    // ── Selecionar integração ──
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

    // ── Enviar via gateway ──
    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integration.id,
      numero_destino: contact.telefone,
      mensagem: textoEnvio
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
        content: textoEnvio,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.data.message_id,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'acessos_rapidos',
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
    console.error('[enviarCartaoAcesso] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});