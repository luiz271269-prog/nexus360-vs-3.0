import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// ENVIO DE CAMPANHAS UNIFICADO - BROADCAST + PROMOÇÕES
// ============================================================================
// Função central que unifica envio em massa (broadcast) e promoções agendadas
// Baseada no fluxo que FUNCIONA: envio individual para grupos pequenos
// ============================================================================

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
      texto_saudacao_custom = null
    } = body;

    console.log(`[CAMPANHA-LOTE] Modo: ${modo} | Contatos: ${contact_ids.length}`);

    if (!contact_ids || contact_ids.length === 0) {
      return Response.json({
        success: false,
        error: 'Lista de contatos vazia'
      }, { status: 400 });
    }

    // ✅ VALIDAÇÃO: Verificar integração conectada
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });

    if (!integrations.length) {
      return Response.json({
        success: false,
        error: 'Nenhuma integração WhatsApp conectada'
      }, { status: 400 });
    }

    const integration = integrations[0];
    console.log(`[CAMPANHA-LOTE] Usando integração: ${integration.nome_instancia}`);

    // ✅ CARREGAR CONTATOS
    const contatos = await base44.asServiceRole.entities.Contact.filter({
      id: { $in: contact_ids }
    });

    console.log(`[CAMPANHA-LOTE] ${contatos.length} contatos carregados`);

    const now = new Date();
    const resultados = [];
    let enviados = 0;
    let erros = 0;

    // ============================================================================
    // LOOP DE ENVIO - BASEADO NO QUE FUNCIONA
    // ============================================================================
    for (const contato of contatos) {
      try {
        // ✅ VALIDAÇÃO 1: Telefone obrigatório
        if (!contato.telefone) {
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'erro',
            motivo: 'Telefone vazio'
          });
          erros++;
          continue;
        }

        // ✅ VALIDAÇÃO 2: Buscar ou criar thread canônica
        let threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contato.id,
          is_canonical: true
        });

        let thread = threads[0];

        if (!thread) {
          console.log(`[CAMPANHA-LOTE] Criando thread para ${contato.nome}`);
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            is_canonical: true,
            channel: 'whatsapp',
            whatsapp_integration_id: integration.id,
            status: 'aberta'
          });
        }

        // ✅ PERSONALIZAR MENSAGEM (se modo broadcast)
        let mensagemFinal = mensagem;
        if (modo === 'broadcast' && personalizar) {
          mensagemFinal = mensagem
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
        }

        // ✅ MODO BROADCAST: Enviar imediatamente via gateway
        if (modo === 'broadcast') {
          console.log(`[CAMPANHA-LOTE] Enviando broadcast para ${contato.nome}`);

          // ✅ CHAMAR GATEWAY DE ENVIO
          const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integration.id,
            numero_destino: contato.telefone,
            mensagem: mensagemFinal
          });

          if (!respEnvio.data?.success) {
            throw new Error(respEnvio.data?.error || 'Erro no gateway');
          }

          // ✅ REGRA 4: PERSISTIR MESSAGE (copiado do ChatWindow linha 1382-1400)
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: (await base44.auth.me())?.id || 'system',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: mensagemFinal,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: respEnvio.data.message_id,  // ✅ CRÍTICO: ID do gateway
            sent_at: now.toISOString(),
            visibility: 'public_to_customer',
            metadata: {
              whatsapp_integration_id: integration.id,
              origem_campanha: 'broadcast_massa',
              personalizada: personalizar
            }
          });

          // ✅ REGRA 5: ATUALIZAR THREAD (copiado do ChatWindow linha 1402-1410)
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_content: mensagemFinal.substring(0, 100),
            last_message_at: now.toISOString(),
            last_outbound_at: now.toISOString(),
            last_message_sender: 'user',
            last_human_message_at: now.toISOString(),
            whatsapp_integration_id: integration.id,
            pre_atendimento_ativo: false  // ✅ Desliga URA se ativa
          });

          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'enviado',
            mensagem: mensagemFinal
          });

          enviados++;
        }

        // ✅ MODO PROMOÇÃO: Enviar saudação + agendar promoção
        if (modo === 'promocao') {
          console.log(`[CAMPANHA-LOTE] Agendando promoção para ${contato.nome}`);

          // ✅ 1. Buscar promoção ativa
          const promocoes = await base44.asServiceRole.entities.Promotion.filter({
            is_active: true,
            expires_at: { $gte: now.toISOString() }
          }, '-priority', 1);

          if (!promocoes.length) {
            throw new Error('Nenhuma promoção ativa');
          }

          const promo = promocoes[0];

          // ✅ 2. Enviar saudação imediata (personalizada se fornecido)
          const saudacao = texto_saudacao_custom 
            ? texto_saudacao_custom
                .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
                .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
            : `Olá ${contato.nome || 'Cliente'}! Tudo bem? 😊`;

          const respSaudacao = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integration.id,
            numero_destino: contato.telefone,
            mensagem: saudacao
          });

          if (!respSaudacao.data?.success) {
            throw new Error(respSaudacao.data?.error || 'Erro ao enviar saudação');
          }

          // ✅ REGRA 4: PERSISTIR SAUDAÇÃO (copiado do ChatWindow)
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: (await base44.auth.me())?.id || 'system',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: saudacao,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: respSaudacao.data.message_id,  // ✅ CRÍTICO
            sent_at: now.toISOString(),
            visibility: 'public_to_customer',
            metadata: {
              whatsapp_integration_id: integration.id,
              origem_campanha: 'promocao_saudacao'
            }
          });

          // ✅ REGRA 5: ATUALIZAR THREAD (copiado do ChatWindow)
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_content: saudacao.substring(0, 100),
            last_message_at: now.toISOString(),
            last_outbound_at: now.toISOString(),
            last_message_sender: 'user',
            last_human_message_at: now.toISOString(),
            whatsapp_integration_id: integration.id,
            pre_atendimento_ativo: false
          });

          // ✅ P1 FIX: ATUALIZAR CONTACT (cooldown de promoção)
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            last_any_promo_sent_at: now.toISOString()
          });

          // ✅ 3. Agendar promoção na fila
          const scheduledFor = new Date(now.getTime() + delay_minutos * 60 * 1000);

          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'enviar_promocao',
            contact_id: contato.id,
            thread_id: thread.id,
            status: 'agendado',
            scheduled_for: scheduledFor.toISOString(),
            payload: {
              promotion_id: promo.id,
              integration_id: integration.id,
              trigger: 'lote_urgentes'
            },
            metadata: {
              saudacao_enviada_em: now.toISOString(),
              delay_minutos
            }
          });

          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'agendado',
            saudacao: saudacao,
            promo_agendada_para: scheduledFor.toISOString()
          });

          enviados++;
        }

        // ✅ ANTI-RATE-LIMIT
        await new Promise(resolve => setTimeout(resolve, modo === 'broadcast' ? 500 : 800));

      } catch (error) {
        console.error(`[CAMPANHA-LOTE] ❌ ${contato.nome}:`, error.message);
        resultados.push({
          contact_id: contato.id,
          nome: contato.nome,
          status: 'erro',
          motivo: error.message
        });
        erros++;
      }
    }

    // ✅ AUDITORIA
    await base44.asServiceRole.entities.AutomationLog.create({
      automation_type: modo === 'broadcast' ? 'broadcast_massa' : 'promocao_lote',
      status: enviados > 0 ? 'success' : 'failed',
      metadata: {
        contact_ids,
        enviados,
        erros,
        resultados: resultados.slice(0, 10)
      }
    });

    return Response.json({
      success: true,
      modo,
      enviados,
      erros,
      resultados,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[CAMPANHA-LOTE] ❌ ERRO GERAL:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});