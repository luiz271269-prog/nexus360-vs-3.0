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
    // Regra do cartão de visitas:
    //  - Disparar SOMENTE em mensagens inbound (recebidas do contato).
    //    Mensagens outbound e a própria mensagem do cartão já são barradas
    //    no topo (sender_type !== 'contact' → skip 'nao_inbound_whatsapp'),
    //    evitando loops.
    //  - Disparar SOMENTE quando o texto for uma saudação de início/retomada
    //    (oi, olá, ola, bom dia, boa tarde, boa noite, e aí, opa).
    //  - Enviar no início da conversa; NÃO repetir durante conversa ativa.
    //  - Reenviar quando o contato retorna com saudação após a conversa
    //    ter ficado fria/inativa.
    const JANELA_CONVERSA_ATIVA_MS = 6 * 60 * 60 * 1000; // 6h sem atividade = conversa fria

    if (trigger === 'auto_primeira_msg') {
      const texto = String(body?.data?.content || '').toLowerCase().trim();

      // Saudação estrita de início/retomada de conversa
      const ehSaudacao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(texto);
      if (!ehSaudacao) {
        return Response.json({ success: true, skipped: 'nao_eh_saudacao' });
      }

      // Distinguir conversa ATIVA de RETOMADA usando o último envio do cartão
      // e a última atividade da conversa.
      const enviadoEm = thread?.campos_personalizados?.acessos_rapidos_enviado_em;
      const ultimaAtividade = thread?.last_message_at || thread?.last_inbound_at || null;

      if (enviadoEm) {
        const desdeUltimoCartao = Date.now() - new Date(enviadoEm).getTime();

        // Considera a conversa ainda ATIVA se houve atividade recente
        // (dentro da janela) depois do último cartão.
        let conversaAtiva = desdeUltimoCartao < JANELA_CONVERSA_ATIVA_MS;
        if (ultimaAtividade) {
          const desdeUltimaAtividade = Date.now() - new Date(ultimaAtividade).getTime();
          conversaAtiva = conversaAtiva && desdeUltimaAtividade < JANELA_CONVERSA_ATIVA_MS;
        }

        if (conversaAtiva) {
          return Response.json({ success: true, skipped: 'conversa_ativa_nao_repete' });
        }
        // Caso contrário, conversa esfriou → permite reenvio (retomada).
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

    // ── URL da imagem do cartão (asset visual já existente) ──
    etapa = 'carregar_imagem_cartao';
    let cardImageUrl = null;
    const cfgImg = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'acessos_rapidos_card_image_url', ativa: true
    }).catch(() => []);
    cardImageUrl = cfgImg?.[0]?.valor?.value || null;

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

    // ── Enviar via gateway: imagem visual + lista interativa nativa ──
    etapa = 'enviar_whatsapp';
    console.log('[enviarCartaoAcesso] enviando cartão via', integration.nome_instancia, '| imagem:', !!cardImageUrl);

    const primeiroNome = (contact.nome || '').trim().split(/\s+/)[0] || '';

    // 1) Imagem visual compacta do cartão (asset reutilizado). Best-effort:
    //    se falhar, segue para a lista interativa (não bloqueia o fluxo).
    let imgMessageId = null;
    if (cardImageUrl) {
      const respImg = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
        integration_id: integration.id,
        numero_destino: contact.telefone,
        media_url: cardImageUrl,
        media_type: 'image',
        media_caption: 'NEURALTEC — Acessos rápidos'
      }).catch((e) => ({ data: { success: false, error: e?.message } }));
      if (respImg?.data?.success) {
        imgMessageId = respImg.data.message_id;
      } else {
        console.warn('[enviarCartaoAcesso] ⚠️ falha ao enviar imagem:', respImg?.data?.error);
      }
    }

    // 2) Lista interativa nativa compacta (texto mínimo + label "Abrir acessos").
    //    id rastreável (acesso_rapido:ID) — o conteúdo (URL/Pix/setor) é resolvido
    //    pelo handler responderAcessoRapido quando o contato toca na opção.
    const opcoesLista = itens.map(i => ({
      id: `acesso_rapido:${i.id}`,
      title: `${i.emoji || '🔗'} ${i.titulo}`.slice(0, 24),
      description: (i.descricao || i.categoria || 'Toque para acessar').slice(0, 72)
    }));

    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integration.id,
      numero_destino: contact.telefone,
      mensagem: '',
      interactive_list: {
        title: 'NEURALTEC — Acessos rápidos',
        button_label: 'Abrir acessos',
        options: opcoesLista
      }
    });
    if (!resp?.data?.success) {
      return Response.json({ success: false, error: resp?.data?.error || 'erro_envio' });
    }

    // ── Persistir Message(s) na thread ──
    const now = new Date().toISOString();
    if (thread) {
      // Imagem do cartão (quando enviada com sucesso)
      if (imgMessageId) {
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: 'system',
          sender_type: 'user',
          recipient_id: contact.id,
          recipient_type: 'contact',
          content: 'NEURALTEC — Acessos rápidos',
          media_url: cardImageUrl,
          media_type: 'image',
          media_caption: 'NEURALTEC — Acessos rápidos',
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: imgMessageId,
          sent_at: now,
          metadata: {
            whatsapp_integration_id: integration.id,
            is_system_message: trigger !== 'manual',
            message_type: 'acessos_rapidos_imagem',
            trigger
          }
        });
      }

      // Lista interativa nativa
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: 'Toque abaixo para acessar nossos canais (lista interativa enviada)',
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
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
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