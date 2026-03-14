// ============================================================================
// SKILL 03: QUEUE MANAGER v1.0.0
// ============================================================================
// Objetivo: Manter contato VIVO enquanto espera atendente
// Função: Coleta contexto, informa posição, oferece alternativas
// Executa: Quando não há atendente disponível (disparado por skill 2)
// Resultado: Atendente recebe contexto completo quando assumir
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const PERGUNTAS_POR_SETOR = {
  vendas: [
    'Me conta qual é o produto ou configuração que você procura?',
    'Qual é seu orçamento aproximado?'
  ],
  assistencia: [
    'Qual é o problema exato que você está enfrentando?',
    'Desde quando isso está acontecendo?'
  ],
  financeiro: [
    'Qual é o valor ou referência da sua pendência?',
    'Você já tem uma data para quitação?'
  ],
  fornecedor: [
    'Qual é o volume ou quantidade que você precisa?',
    'Qual é o prazo para entrega?'
  ]
};

async function contarFilaParaSetor(base44, setor) {
  try {
    const itens = await base44.asServiceRole.entities.WorkQueueItem.filter({
      owner_sector_id: setor,
      status: 'open'
    }, '-created_date', 100);
    return itens ? itens.length : 0;
  } catch (e) {
    return 0;
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const { thread_id, contact_id, setor } = payload;

    if (!thread_id || !contact_id || !setor) {
      return Response.json(
        { success: false, error: 'thread_id, contact_id, setor obrigatórios' },
        { status: 400, headers }
      );
    }

    console.log(`[SKILL-QUEUE] 📊 Iniciando Queue Manager: thread=${thread_id}, setor=${setor}`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: Buscar thread + contato
    // ══════════════════════════════════════════════════════════════════
    const [thread, contact] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Informar posição na fila
    // ══════════════════════════════════════════════════════════════════
    const tamanhoFila = await contarFilaParaSetor(base44, setor);
    const mensagemPosicao = `⏳ Você é o #${tamanhoFila + 1} na fila de ${setor}.\nAguarde, logo temos novidade!`;

    if (thread.whatsapp_integration_id && contact.telefone) {
      try {
        await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contact.telefone,
          mensagem: mensagemPosicao
        });

        // Salvar no histórico
        await base44.asServiceRole.entities.Message.create({
          thread_id,
          sender_id: 'skill_queue',
          sender_type: 'user',
          content: mensagemPosicao,
          channel: 'whatsapp',
          status: 'enviada',
          sent_at: new Date().toISOString(),
          visibility: 'public_to_customer',
          metadata: {
            is_ai_response: true,
            ai_agent: 'skill_queue_manager',
            tipo: 'posicao_fila'
          }
        });

        console.log(`[SKILL-QUEUE] ✅ Posição da fila enviada: #${tamanhoFila + 1}`);
      } catch (e) {
        console.warn(`[SKILL-QUEUE] ⚠️ Erro ao enviar posição:`, e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 3: Fazer perguntas qualificadoras (max 2)
    // ══════════════════════════════════════════════════════════════════
    const perguntas = PERGUNTAS_POR_SETOR[setor] || PERGUNTAS_POR_SETOR.vendas;
    const pergunta1 = perguntas[0];

    if (thread.whatsapp_integration_id && contact.telefone && pergunta1) {
      try {
        await new Promise(r => setTimeout(r, 2000)); // Esperar 2s antes de perguntar

        await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contact.telefone,
          mensagem: `Enquanto aguarda, ${pergunta1.toLowerCase()}`
        });

        // Salvar pergunta
        await base44.asServiceRole.entities.Message.create({
          thread_id,
          sender_id: 'skill_queue',
          sender_type: 'user',
          content: `Enquanto aguarda, ${pergunta1.toLowerCase()}`,
          channel: 'whatsapp',
          status: 'enviada',
          sent_at: new Date().toISOString(),
          visibility: 'public_to_customer',
          metadata: {
            is_ai_response: true,
            ai_agent: 'skill_queue_manager',
            tipo: 'pergunta_qualificadora',
            numero_pergunta: 1
          }
        });

        console.log(`[SKILL-QUEUE] ✅ Pergunta 1 enviada`);
      } catch (e) {
        console.warn(`[SKILL-QUEUE] ⚠️ Erro ao enviar pergunta:`, e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 4: Oferecer alternativas se fila está grande (>3)
    // ══════════════════════════════════════════════════════════════════
    if (tamanhoFila > 3 && thread.whatsapp_integration_id && contact.telefone) {
      try {
        const msgAlternativas = `📅 Se preferir, posso te agendar para uma ligação no horário que convém. Quer?`;

        await new Promise(r => setTimeout(r, 3000)); // Esperar 3s

        await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contact.telefone,
          mensagem: msgAlternativas
        });

        await base44.asServiceRole.entities.Message.create({
          thread_id,
          sender_id: 'skill_queue',
          sender_type: 'user',
          content: msgAlternativas,
          channel: 'whatsapp',
          status: 'enviada',
          sent_at: new Date().toISOString(),
          visibility: 'public_to_customer',
          metadata: {
            is_ai_response: true,
            ai_agent: 'skill_queue_manager',
            tipo: 'oferta_agendamento'
          }
        });

        console.log(`[SKILL-QUEUE] ✅ Oferta de agendamento enviada`);
      } catch (e) {
        console.warn(`[SKILL-QUEUE] ⚠️ Erro ao enviar alternativa:`, e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 5: Registrar estado na fila com contexto
    // ══════════════════════════════════════════════════════════════════
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      fila_atendimento_id: `queue_${setor}_${Date.now()}`,
      entrou_na_fila_em: new Date().toISOString(),
      pre_atendimento_state: 'WAITING_QUEUE_DECISION'
    });

    return Response.json({
      success: true,
      action: 'queue_manager_ativo',
      tamanho_fila: tamanhoFila + 1,
      perguntas_enviadas: 1,
      alternativa_oferecida: tamanhoFila > 3,
      duration_ms: Date.now() - Date.now()
    }, { headers });

  } catch (error) {
    console.error('[SKILL-QUEUE] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});