import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  getActivePromotions,
  filterEligiblePromotions,
  pickPromotion,
  isBlocked
} from './lib/promotionEngine.js';

// ============================================================================
// ENVIO UNIFICADO EM LOTE - v1.0.0
// ============================================================================
// Unifica: enviarMensagemMassa + enviarPromocoesLote
// Modos: 'broadcast' (mensagem única) ou 'promocao' (saudação + promo agendada)
// Mantém envios normais (1:1) separados e intocados
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.json();
    const { 
      contact_ids = [],
      modo = 'broadcast', // 'broadcast' ou 'promocao'
      mensagem = null,
      personalizar = true,
      delay_minutos = 5
    } = body;

    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÕES
    // ═══════════════════════════════════════════════════════════════
    if (!contact_ids?.length) {
      return Response.json({ 
        success: false, 
        error: 'contact_ids é obrigatório' 
      }, { status: 400 });
    }

    if (modo === 'broadcast' && !mensagem?.trim()) {
      return Response.json({ 
        success: false, 
        error: 'mensagem é obrigatória para modo broadcast' 
      }, { status: 400 });
    }

    console.log(`[CAMPANHA-LOTE] 🚀 Modo: ${modo} | Contatos: ${contact_ids.length}`);

    const now = new Date();
    const resultados = [];
    let enviados = 0;
    let erros = 0;

    // ═══════════════════════════════════════════════════════════════
    // BUSCAR DADOS EM LOTE (P1 - Otimização N+1)
    // ═══════════════════════════════════════════════════════════════
    const [contatos, integracoes, threadsArray] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter({ id: { $in: contact_ids } }),
      base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }),
      base44.asServiceRole.entities.MessageThread.filter({
        contact_id: { $in: contact_ids },
        is_canonical: true
      })
    ]);

    // Criar mapa para O(1) lookup
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const threadsMap = new Map(threadsArray.map(t => [t.contact_id, t]));

    if (!integracoes.length) {
      return Response.json({ 
        success: false, 
        error: 'Nenhuma integração WhatsApp conectada' 
      }, { status: 400 });
    }

    // ✅ Criar mapa de integrações por ID para lookup correto
    const integracoesMap = new Map(integracoes.map(i => [i.id, i]));
    const integracaoDefault = integracoes[0];

    // Buscar promoções ativas (apenas se modo = promocao)
    let promosAtivas = [];
    if (modo === 'promocao') {
      promosAtivas = await getActivePromotions(base44, now);
      
      if (!promosAtivas.length) {
        return Response.json({ 
          success: false, 
          error: 'Nenhuma promoção ativa no sistema' 
        }, { status: 400 });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // PROCESSAR CADA CONTATO
    // ═══════════════════════════════════════════════════════════════
    for (const contact_id of contact_ids) {
      try {
        const contato = contatosMap.get(contact_id);
        
        if (!contato) {
          console.log(`[CAMPANHA-LOTE] ⚠️ Contato ${contact_id} não encontrado`);
          resultados.push({ 
            contact_id, 
            status: 'erro', 
            motivo: 'Contato não encontrado' 
          });
          erros++;
          continue;
        }

        let thread = threadsMap.get(contact_id);
        
        // ✅ P1: Se não houver thread canônica, criar uma
        if (!thread) {
          console.log(`[CAMPANHA-LOTE] 📝 Criando thread canônica: ${contato.nome}`);
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            channel: 'whatsapp',
            is_canonical: true,
            status: 'aberta',
            whatsapp_integration_id: integracaoDefault.id,
            last_message_at: now.toISOString()
          });
          threadsMap.set(contact_id, thread);
        }

        // ✅ P0: Validar telefone antes de qualquer processamento
        if (!contato.telefone?.trim()) {
          console.log(`[CAMPANHA-LOTE] ⚠️ Telefone inválido: ${contato.nome}`);
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'erro',
            motivo: 'Telefone não cadastrado'
          });
          erros++;
          continue;
        }

        // ✅ P0: Usar integração correta (da thread, não default)
        const integracaoId = thread.whatsapp_integration_id || integracaoDefault.id;
        const integracaoUsada = integracoesMap.get(integracaoId) || integracaoDefault;

        // ═══════════════════════════════════════════════════════════════
        // P0: VALIDAR BLOQUEIOS ABSOLUTOS (com integração correta)
        // ═══════════════════════════════════════════════════════════════
        const { blocked, reason } = isBlocked({
          contact: contato,
          thread,
          integration: integracaoUsada
        });

        if (blocked) {
          console.log(`[CAMPANHA-LOTE] ⛔ ${contato.nome}: ${reason}`);
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'bloqueado',
            motivo: reason
          });
          continue;
        }

        // ═══════════════════════════════════════════════════════════════
        // DIVERGÊNCIA POR MODO
        // ═══════════════════════════════════════════════════════════════
        
        if (modo === 'broadcast') {
          // ───────────────────────────────────────────────────────────
          // MODO BROADCAST: Mensagem única com placeholders
          // ───────────────────────────────────────────────────────────
          let textoFinal = mensagem;
          
          if (personalizar) {
            textoFinal = textoFinal
              .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
              .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
          }

          const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integracaoId,
            numero_destino: contato.telefone,
            mensagem: textoFinal
          });

          if (resp.data?.success) {
            enviados++;
            resultados.push({
              contact_id: contato.id,
              nome: contato.nome,
              status: 'enviado',
              mensagem: textoFinal.slice(0, 60) + '...'
            });
            console.log(`[CAMPANHA-LOTE] ✅ Broadcast: ${contato.nome}`);
          } else {
            throw new Error(resp.data?.error || 'Erro no envio');
          }

        } else if (modo === 'promocao') {
          // ───────────────────────────────────────────────────────────
          // MODO PROMOÇÃO: Saudação + Agendamento
          // ───────────────────────────────────────────────────────────
          
          // Calcular dias inativo
          const diasInativo = thread.last_inbound_at 
            ? Math.floor((now - new Date(thread.last_inbound_at)) / (1000 * 60 * 60 * 24))
            : 999;

          // ✅ P0: TEMPLATE (evita 49 LLM calls)
          const mensagemSaudacao = `Olá ${contato.nome}! 👋

Percebi que faz ${diasInativo} dias que não conversamos.

${contato.empresa ? `Como estão as coisas na ${contato.empresa}?` : 'Como posso te ajudar hoje?'}

Estou à disposição! 😊`.trim();

          // ✅ P2: DEDUPE - Verificar se já tem item agendado recente
          const itemExistente = await base44.asServiceRole.entities.WorkQueueItem.filter({
            tipo: 'enviar_promocao',
            contact_id: contato.id,
            status: 'agendado',
            scheduled_for: { $gte: now.toISOString() }
          }, '-created_date', 1);

          if (itemExistente.length > 0) {
            console.log(`[CAMPANHA-LOTE] ⏭️ ${contato.nome}: já tem promoção agendada`);
            resultados.push({
              contact_id: contato.id,
              nome: contato.nome,
              status: 'aviso',
              motivo: 'Promoção já agendada (dedupe)'
            });
            continue;
          }

          // ✅ P2: COOLDOWN - Verificar last_any_promo_sent_at
          if (contato.last_any_promo_sent_at) {
            const ultimaPromo = new Date(contato.last_any_promo_sent_at);
            const horasDesdeUltima = (now - ultimaPromo) / (1000 * 60 * 60);
            
            if (horasDesdeUltima < 12) {
              console.log(`[CAMPANHA-LOTE] ⏳ ${contato.nome}: cooldown (${Math.round(horasDesdeUltima)}h)`);
              resultados.push({
                contact_id: contato.id,
                nome: contato.nome,
                status: 'aviso',
                motivo: `Cooldown (última promoção há ${Math.round(horasDesdeUltima)}h)`
              });
              continue;
            }
          }

          // ✅ P2: Verificar se já enviou saudação recente (evitar duplicação)
          const saudacaoRecente = await base44.asServiceRole.entities.Message.filter({
            thread_id: thread.id,
            sender_type: 'user',
            sent_at: { $gte: new Date(now.getTime() - 60 * 60 * 1000).toISOString() },
            'metadata.origem_campanha': 'lote_urgentes'
          }, '-sent_at', 1);

          if (saudacaoRecente.length > 0) {
            console.log(`[CAMPANHA-LOTE] ⏭️ ${contato.nome}: saudação enviada há ${Math.round((now - new Date(saudacaoRecente[0].sent_at)) / 60000)}min`);
            resultados.push({
              contact_id: contato.id,
              nome: contato.nome,
              status: 'aviso',
              motivo: 'Saudação já enviada na última hora'
            });
            continue;
          }

          // Enviar saudação via gateway unificado
          const resultadoEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integracaoId,
            numero_destino: contato.telefone,
            mensagem: mensagemSaudacao
          });

          if (!resultadoEnvio.data?.success) {
            throw new Error(resultadoEnvio.data?.error || 'Falha ao enviar saudação');
          }

          console.log(`[CAMPANHA-LOTE] ✅ Saudação enviada: ${contato.nome}`);

          // ✅ P1: PERSISTÊNCIA - Garantir Message outbound visível na UI
          const messageCreated = await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'sistema',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: mensagemSaudacao,
            channel: 'whatsapp',
            provider: 'whatsapp',
            status: 'enviada',
            sent_at: now.toISOString(),
            metadata: {
              whatsapp_integration_id: integracaoId,
              origem_campanha: 'lote_urgentes',
              lote_timestamp: now.toISOString()
            }
          });

          // ✅ P1: Atualizar thread.last_message_at para aparecer no topo
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_at: now.toISOString(),
            last_message_content: mensagemSaudacao.slice(0, 100),
            last_message_sender: 'user',
            last_outbound_at: now.toISOString()
          });

          // Selecionar promoção com rotação inteligente
          const eligible = filterEligiblePromotions(promosAtivas, contato, thread);
          const promoSelecionada = pickPromotion(eligible, contato);

          if (!promoSelecionada) {
            console.log(`[CAMPANHA-LOTE] ⚠️ Sem promoção elegível para ${contato.nome}`);
            resultados.push({
              contact_id: contato.id,
              nome: contato.nome,
              status: 'parcial',
              motivo: 'Saudação enviada, mas sem promoção elegível',
              saudacao_enviada: true,
              promocao_agendada: false
            });
            enviados++; // Conta apenas saudação
            continue;
          }

          // Agendar promoção para depois
          const timestampPromo = new Date(now.getTime() + delay_minutos * 60 * 1000);

          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'enviar_promocao',
            contact_id: contato.id,
            thread_id: thread.id,
            reason: 'promocao_lote',
            severity: diasInativo >= 30 ? 'high' : 'medium',
            scheduled_for: timestampPromo.toISOString(),
            status: 'agendado',
            payload: {
              promotion_id: promoSelecionada.id,
              integration_id: integracaoId,
              trigger: 'manual_lote_urgentes'
            },
            metadata: {
              saudacao_enviada_em: now.toISOString(),
              saudacao_message_id: messageCreated.id,
              dias_inativo: diasInativo,
              saudacao_texto: mensagemSaudacao.slice(0, 100)
            }
          });

          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'sucesso',
            saudacao: mensagemSaudacao.slice(0, 60) + '...',
            promocao_agendada: promoSelecionada.titulo,
            horario_promocao: timestampPromo.toISOString()
          });

          enviados++;
        }

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, modo === 'broadcast' ? 500 : 800));

      } catch (error) {
        const erroDetalhado = error.response?.data || error.data || error.message;
        const contato = contatosMap.get(contact_id);
        
        console.error(`[CAMPANHA-LOTE] ❌ ${contato?.nome || contact_id}:`, 
          JSON.stringify(erroDetalhado, null, 2)
        );
        
        resultados.push({
          contact_id,
          nome: contato?.nome || contact_id,
          status: 'erro',
          motivo: typeof erroDetalhado === 'string' ? erroDetalhado : JSON.stringify(erroDetalhado)
        });
        erros++;
      }
    }

    console.log(`[CAMPANHA-LOTE] ✅ Concluído: ${enviados} enviados, ${erros} erros`);

    // ✅ PERSISTIR LOG DA CAMPANHA
    try {
      const user = await base44.auth.me().catch(() => null);
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: `envio_massa_${modo}`,
        origem: 'manual',
        prioridade: 'normal',
        usuario_id: user?.id || 'sistema',
        timestamp: now.toISOString(),
        resultado: enviados > 0 ? 'sucesso' : 'erro',
        detalhes: {
          modo,
          total_contatos: contact_ids.length,
          enviados,
          erros,
          mensagem_enviada: modo === 'broadcast' ? mensagem?.slice(0, 100) : 'saudação+promoção',
          resultados: resultados.slice(0, 50)
        }
      });
    } catch (logError) {
      console.error('[CAMPANHA-LOTE] ⚠️ Erro ao gravar log:', logError.message);
    }

    return Response.json({
      success: true,
      modo,
      enviados,
      erros,
      resultados,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[CAMPANHA-LOTE] ❌ ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});