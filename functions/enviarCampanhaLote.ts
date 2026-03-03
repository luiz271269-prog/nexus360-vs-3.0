import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// ENVIO DE CAMPANHAS - ARQUITETURA ASSÍNCRONA (SAFE BATCH) v2
// ============================================================================
// Modo BROADCAST: enfileira WorkQueueItems instantaneamente → worker envia por baixo
// Modo PROMOÇÃO:  envia saudação imediata + enfileira promoção com delay
//
// ✅ Sem timeout: qualquer volume de contatos retorna em ~1-3s
// ✅ Worker (processarFilaBroadcast) roda a cada 5min e processa em lotes de 20
// ✅ Controle de cooldown via last_any_promo_sent_at
// ✅ NOVO: Delay aleatório 3-12s, 5 variações de saudação, contexto contato
// ============================================================================

// ✅ Variações de saudação para anti-detecção spam
const SAUDACOES_VARIACOES = [
  'Olá {nome}! Tudo bem? 😊',
  'Oi {nome}, como vai?',
  'Bom dia {nome}! 👋',
  'E aí {nome}? Tudo certo?',
  'Opa {nome}! Beleza? 🙂'
];

// Gerar delay aleatório entre 3s e 12s (simula comportamento humano)
function delayAlatorio() {
  return Math.floor(Math.random() * 9000) + 3000; // 3-12s
}

// Selecionar saudação aleatória (anti-detecção)
function saudacaoAleatoria() {
  return SAUDACOES_VARIACOES[Math.floor(Math.random() * SAUDACOES_VARIACOES.length)];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const {
      contact_ids = [],
      modo = 'broadcast',
      mensagem = '',
      personalizar = true,
      delay_minutos = 5,
      texto_saudacao_custom = null,
      media_url = null,
      media_type = 'none',
      media_caption = null,
      integration_id = null
    } = body;

    console.log(`[CAMPANHA-LOTE] Payload:`, {
      modo,
      total: contact_ids.length,
      mensagem: mensagem?.substring(0, 80),
      media_type
    });

    // ── Validações ──────────────────────────────────────────────────────────
    if ((!mensagem || !mensagem.trim()) && !media_url) {
      return Response.json({ success: false, error: 'Mensagem ou mídia obrigatória' }, { status: 400 });
    }
    if (!contact_ids?.length) {
      return Response.json({ success: false, error: 'Lista de contatos vazia' }, { status: 400 });
    }

    // ── Integração conectada ─────────────────────────────────────────────────
    let integration;
    
    if (integration_id) {
      // Usar integração específica se fornecida
      const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
        id: integration_id, 
        status: 'conectado' 
      });
      if (!integrations.length) {
        return Response.json({ success: false, error: 'Instância selecionada não está conectada' }, { status: 400 });
      }
      integration = integrations[0];
    } else {
      // Fallback: primeira instância conectada
      const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      if (!integrations.length) {
        return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' }, { status: 400 });
      }
      integration = integrations[0];
    }

    // ── Usuário atual (para sender_id e {{atendente}}) ───────────────────────
    let senderId = 'system';
    let nomeAtendente = 'nossa equipe';
    try {
      const me = await base44.auth.me();
      senderId = me?.id || 'system';
      nomeAtendente = me?.full_name?.split(' ')[0] || me?.full_name || 'nossa equipe';
    } catch (_) {}

    const now = new Date();
    const broadcastId = `broadcast_${now.getTime()}`;

    // ── Carregar contatos ────────────────────────────────────────────────────
    const contatos = await base44.asServiceRole.entities.Contact.filter({ id: { $in: contact_ids } });
    console.log(`[CAMPANHA-LOTE] ${contatos.length} contatos carregados`);

    const resultados = [];
    let enfileirados = 0;
    let erros = 0;

    // ══════════════════════════════════════════════════════════════════════════
    // MODO BROADCAST → Enfileirar tudo (sem envio direto → sem timeout)
    // ══════════════════════════════════════════════════════════════════════════
    if (modo === 'broadcast') {
      for (const contato of contatos) {
        if (!contato.telefone) {
          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: 'Sem telefone' });
          erros++;
          continue;
        }

        // ✅ Resolver placeholders com contexto do contato
        const atendenteFidelizado = contato.atendente_fidelizado_vendas || nomeAtendente;
        const mensagemFinal = personalizar
          ? mensagem
              .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
              .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
              .replace(/\{\{atendente\}\}/gi, atendenteFidelizado)
              .replace(/\{\{usuario\}\}/gi, atendenteFidelizado)
              .replace(/\{\{tipo_contato\}\}/gi, contato.tipo_contato || 'cliente')
          : mensagem;

        await base44.asServiceRole.entities.WorkQueueItem.create({
          tipo: 'enviar_broadcast_avulso',
          contact_id: contato.id,
          status: 'pendente',
          scheduled_for: now.toISOString(),
          payload: {
            integration_id: integration.id,
            mensagem: mensagemFinal,
            media_url: media_url || null,
            media_type: media_type || 'none',
            media_caption: media_caption || null,
            sender_id: senderId,
            broadcast_id: broadcastId
          }
        });

        resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'enfileirado' });
        enfileirados++;
      }

      // Auditoria
      await base44.asServiceRole.entities.AutomationLog.create({
        automation_type: 'broadcast_massa',
        status: 'success',
        metadata: { contact_ids, enfileirados, erros, broadcast_id: broadcastId }
      });

      console.log(`[CAMPANHA-LOTE] ✅ ${enfileirados} broadcasts enfileirados (worker processará em lotes)`);

      return Response.json({
        success: true,
        modo: 'broadcast',
        enfileirados,
        erros,
        resultados,
        mensagem_status: `${enfileirados} mensagens enfileiradas. Envio iniciará em segundos pelo worker.`,
        broadcast_id: broadcastId,
        timestamp: now.toISOString()
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODO PROMOÇÃO → Saudação imediata + enfileirar promoção
    // ══════════════════════════════════════════════════════════════════════════
    if (modo === 'promocao') {
      const promocoes = await base44.asServiceRole.entities.Promotion.filter({
        is_active: true,
        expires_at: { $gte: now.toISOString() }
      }, '-priority', 1);

      if (!promocoes.length) {
        return Response.json({ success: false, error: 'Nenhuma promoção ativa' }, { status: 400 });
      }
      const promo = promocoes[0];

      for (const contato of contatos) {
        try {
          if (!contato.telefone) {
            resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: 'Sem telefone' });
            erros++;
            continue;
          }

          // Buscar/criar thread canônica
          let threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id, is_canonical: true });
          let thread = threads[0];
          if (!thread) {
            thread = await base44.asServiceRole.entities.MessageThread.create({
              contact_id: contato.id,
              is_canonical: true,
              channel: 'whatsapp',
              whatsapp_integration_id: integration.id,
              status: 'aberta'
            });
          }

          // ✅ Saudação com variação aleatória (anti-spam) + atendente fidelizado
          const atendenteFidelizado = contato.atendente_fidelizado_vendas || nomeAtendente;
          const saudacaoTemplate = texto_saudacao_custom || saudacaoAleatoria();
          const saudacao = saudacaoTemplate
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
            .replace(/\{\{atendente\}\}/gi, atendenteFidelizado)
            .replace(/\{\{usuario\}\}/gi, atendenteFidelizado);

          const respSaudacao = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integration.id,
            numero_destino: contato.telefone,
            mensagem: saudacao
          });

          if (!respSaudacao.data?.success) throw new Error(respSaudacao.data?.error || 'Erro ao enviar saudação');

          // Persistir saudação
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: senderId,
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: saudacao,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: respSaudacao.data.message_id,
            sent_at: now.toISOString(),
            visibility: 'public_to_customer',
            metadata: { whatsapp_integration_id: integration.id, origem_campanha: 'promocao_saudacao' }
          });

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_content: saudacao.substring(0, 100),
            last_message_at: now.toISOString(),
            last_outbound_at: now.toISOString(),
            last_message_sender: 'user',
            last_human_message_at: now.toISOString(),
            whatsapp_integration_id: integration.id,
            pre_atendimento_ativo: false
          });

          await base44.asServiceRole.entities.Contact.update(contato.id, {
            last_any_promo_sent_at: now.toISOString()
          });

          // Enfileirar promoção com delay
          const scheduledFor = new Date(now.getTime() + delay_minutos * 60 * 1000);
          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'enviar_promocao',
            contact_id: contato.id,
            thread_id: thread.id,
            status: 'agendado',
            scheduled_for: scheduledFor.toISOString(),
            payload: { promotion_id: promo.id, integration_id: integration.id, trigger: 'lote_urgentes' },
            metadata: { saudacao_enviada_em: now.toISOString(), delay_minutos }
          });

          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'agendado',
            promo_agendada_para: scheduledFor.toISOString()
          });
          enfileirados++;

          // ✅ Delay aleatório 3-12s (anti-detecção spam, simula humano)
          await new Promise(r => setTimeout(r, delayAlatorio()));

        } catch (error) {
          console.error(`[CAMPANHA-LOTE] ❌ ${contato.nome}:`, error.message);
          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: error.message });
          erros++;
        }
      }

      await base44.asServiceRole.entities.AutomationLog.create({
        automation_type: 'promocao_lote',
        status: enfileirados > 0 ? 'success' : 'failed',
        metadata: { contact_ids, enfileirados, erros }
      });

      return Response.json({
        success: true,
        modo: 'promocao',
        enviados: enfileirados,
        erros,
        resultados,
        timestamp: now.toISOString()
      });
    }

    return Response.json({ success: false, error: `Modo inválido: ${modo}` }, { status: 400 });

  } catch (error) {
    console.error('[CAMPANHA-LOTE] ❌ ERRO GERAL:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});