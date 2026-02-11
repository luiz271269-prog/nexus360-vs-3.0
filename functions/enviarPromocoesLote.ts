import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  getActivePromotions,
  filterEligiblePromotions,
  pickPromotion,
  readLastPromoIds
} from './lib/promotionEngine.js';

// ============================================================================
// ENVIO EM LOTE: Saudação → 5min → Promoção
// ============================================================================
// Para contatos urgentes que requerem atenção
// 1. Envia saudação contextualizada (IA)
// 2. Agenda promoção para 5min depois
// 3. processarFilaPromocoes envia quando chegar a hora
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.json();
    const { contact_ids = [] } = body;

    if (!contact_ids.length) {
      return Response.json({ success: false, error: 'contact_ids é obrigatório' }, { status: 400 });
    }

    console.log(`[PROMO-LOTE] Processando ${contact_ids.length} contatos...`);

    const now = new Date();

    // ═══════════════════════════════════════════════════════════════
    // 1️⃣ BUSCAR DADOS EM PARALELO
    // ═══════════════════════════════════════════════════════════════
    const [contatos, integracoes] = await Promise.all([
      base44.asServiceRole.entities.Contact.filter({ id: { $in: contact_ids } }),
      base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' })
    ]);

    // ✅ Buscar promoções usando motor (reutilização)
    const promosAtivas = await getActivePromotions(base44, now);

    if (!integracoes.length) {
      return Response.json({ 
        success: false, 
        error: 'Nenhuma integração WhatsApp conectada' 
      }, { status: 400 });
    }

    if (!promosAtivas.length) {
      return Response.json({ 
        success: false, 
        error: 'Nenhuma promoção ativa no sistema' 
      }, { status: 400 });
    }

    const integracaoDefault = integracoes[0];
    
    let enviados = 0;
    let erros = 0;
    const resultados = [];

    // ═══════════════════════════════════════════════════════════════
    // 2️⃣ PROCESSAR CADA CONTATO
    // ═══════════════════════════════════════════════════════════════
    for (const contato of contatos) {
      try {
        // Buscar thread canônica
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contato.id,
          is_canonical: true
        }, '-last_message_at', 1);

        const thread = threads?.[0];
        if (!thread) {
          resultados.push({ 
            contact_id: contato.id, 
            status: 'erro', 
            motivo: 'Thread não encontrada' 
          });
          erros++;
          continue;
        }

        // Buscar últimas 5 mensagens para contexto
        const mensagens = await base44.asServiceRole.entities.Message.filter({
          thread_id: thread.id
        }, '-created_date', 5);

        const ultimaInbound = mensagens.find(m => m.sender_type === 'contact');
        const diasInativo = thread.last_inbound_at 
          ? Math.floor((now - new Date(thread.last_inbound_at)) / (1000 * 60 * 60 * 24))
          : 999;

        // ═══════════════════════════════════════════════════════════════
        // 3️⃣ GERAR SAUDAÇÃO CONTEXTUALIZADA (IA)
        // ═══════════════════════════════════════════════════════════════
        const contextoConversa = mensagens
          .slice(0, 3)
          .map(m => `${m.sender_type === 'contact' ? 'Cliente' : 'Atendente'}: ${m.content}`)
          .join('\n');

        const promptSaudacao = `
Você é um assistente de vendas amigável. Gere uma mensagem de saudação/reativação para este cliente:

Cliente: ${contato.nome}
Empresa: ${contato.empresa || 'Não informado'}
Dias sem responder: ${diasInativo}
Última mensagem do cliente: ${ultimaInbound?.content || 'Nenhuma'}

Contexto das últimas mensagens:
${contextoConversa || 'Sem histórico'}

Instruções:
- Seja cordial e empático
- Mencione o assunto anterior se houver
- Pergunte se ainda tem interesse ou se pode ajudar em algo
- Máximo 2 frases
- Tom amigável mas profissional
- Sem emojis excessivos (máx 1-2)

Gere APENAS a mensagem de saudação, sem aspas ou formatação extra.`;

        const saudacaoResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: promptSaudacao,
          add_context_from_internet: false
        });

        const mensagemSaudacao = saudacaoResult.trim();

        // ═══════════════════════════════════════════════════════════════
        // 4️⃣ ENVIAR SAUDAÇÃO
        // ═══════════════════════════════════════════════════════════════
        await base44.asServiceRole.functions.invoke('enviarMensagemUnificada', {
          thread_id: thread.id,
          texto: mensagemSaudacao,
          integration_id: thread.whatsapp_integration_id || integracaoDefault.id
        });

        console.log(`[PROMO-LOTE] ✅ Saudação enviada: ${contato.nome}`);

        // ═══════════════════════════════════════════════════════════════
        // 5️⃣ AGENDAR PROMOÇÃO PARA 5 MINUTOS (usando motor)
        // ═══════════════════════════════════════════════════════════════
        const timestampPromo = new Date(now.getTime() + 5 * 60 * 1000); // +5 min

        // ✅ REUTILIZAR: filtrar e selecionar com rotação inteligente
        const eligible = filterEligiblePromotions(promosAtivas, contato, thread);
        const promoSelecionada = pickPromotion(eligible, contato);

        if (!promoSelecionada) {
          console.log(`[PROMO-LOTE] ⚠️ Sem promoção elegível para ${contato.nome}`);
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'aviso',
            motivo: 'Sem promoção elegível (filtros/rotação)'
          });
          continue;
        }

        // Criar item na fila de trabalho (WorkQueueItem)
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
            integration_id: thread.whatsapp_integration_id || integracaoDefault.id,
            trigger: 'manual_lote_urgentes'
          },
          metadata: {
            saudacao_enviada_em: now.toISOString(),
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

        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (error) {
        console.error(`[PROMO-LOTE] ❌ Erro em ${contato.nome}:`, error.message);
        resultados.push({
          contact_id: contato.id,
          nome: contato.nome,
          status: 'erro',
          motivo: error.message
        });
        erros++;
      }
    }

    console.log(`[PROMO-LOTE] Concluído: ${enviados} enviados, ${erros} erros`);

    return Response.json({
      success: true,
      enviados,
      erros,
      resultados,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[PROMO-LOTE] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});