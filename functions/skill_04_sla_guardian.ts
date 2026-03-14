// ============================================================================
// SKILL 04: SLA GUARDIAN v1.0.0
// ============================================================================
// Objetivo: Evitar contatos esquecidos em filas
// Função: Monitora threads paradas → escalada automática
// Executa: Cron a cada 5 minutos
// Cobre 4 cenários: timeout fila, inatividade atendente, estado travado, fora do horário
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const THRESHOLDS_MINUTOS = {
  AVISO_INICIAL: 5,          // 5 min: aviso ao cliente
  OFERTA_ALTERNATIVA: 10,    // 10 min: oferecer agendamento/email
  ESCALACAO_SUPERVISOR: 15   // 15 min: escalar para supervisor
};

async function enviarMsgQueWpp(base44, thread, mensagem) {
  if (!thread.whatsapp_integration_id || !thread.contact_id) {
    return false;
  }

  try {
    const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
    if (!contact.telefone) return false;

    const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contact.telefone,
      mensagem
    });

    if (resp.data?.success) {
      // Salvar no histórico
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'skill_sla',
        sender_type: 'user',
        content: mensagem,
        channel: 'whatsapp',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        visibility: 'public_to_customer',
        metadata: {
          is_ai_response: true,
          ai_agent: 'skill_sla_guardian'
        }
      });
      return true;
    }
  } catch (e) {
    console.warn(`[SLA] ⚠️ Erro ao enviar msg:`, e.message);
  }
  return false;
}

async function buscarThreadsParadas(base44, minutos) {
  const dataLimite = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  
  try {
    // Threads SEM atendente, esperando na fila
    return await base44.asServiceRole.entities.MessageThread.filter({
      entrou_na_fila_em: { $lte: dataLimite },
      assigned_user_id: { $exists: false },
      status: 'aberta'
    }, '-entrou_na_fila_em', 50);
  } catch (e) {
    console.warn(`[SLA] ⚠️ Erro ao buscar threads:`, e.message);
    return [];
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);

    console.log('[SLA] 🛡️ SLA Guardian iniciado');

    const resultados = {
      avisos_enviados: 0,
      alternativas_oferecidas: 0,
      escalacoes: 0,
      estados_resgatados: 0,
      erros: 0
    };

    // ══════════════════════════════════════════════════════════════════
    // CENÁRIO 1: Threads esperando >5 min → enviar aviso
    // ══════════════════════════════════════════════════════════════════
    const threadsCinco = await buscarThreadsParadas(base44, THRESHOLDS_MINUTOS.AVISO_INICIAL);

    for (const thread of threadsCinco) {
      // Verificar se já enviou aviso (idempotência)
      const jaAvisou = await base44.asServiceRole.entities.Message.filter({
        thread_id: thread.id,
        sender_id: 'skill_sla',
        created_date: { $gte: new Date(Date.now() - 10 * 60 * 1000).toISOString() }
      }, '-created_date', 1).catch(() => []);

      if (!jaAvisou || jaAvisou.length === 0) {
        const msgAviso = `⏰ Ainda estamos aqui! Você está na nossa fila. Obrigado pela paciência! 😊`;
        if (await enviarMsgQueWpp(base44, thread, msgAviso)) {
          resultados.avisos_enviados++;
          console.log(`[SLA] ✅ Aviso enviado para thread ${thread.id}`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // CENÁRIO 2: Threads esperando >10 min → oferecer alternativa
    // ══════════════════════════════════════════════════════════════════
    const threadsRez = await buscarThreadsParadas(base44, THRESHOLDS_MINUTOS.OFERTA_ALTERNATIVA);

    for (const thread of threadsRez) {
      const jaofereceu = await base44.asServiceRole.entities.Message.filter({
        thread_id: thread.id,
        sender_id: 'skill_sla',
        'metadata.tipo': 'oferta_alternativa',
        created_date: { $gte: new Date(Date.now() - 15 * 60 * 1000).toISOString() }
      }, '-created_date', 1).catch(() => []);

      if (!jaofereceu || jaofereceu.length === 0) {
        const msgAlternativa = `📞 Se ficar muito tempo, posso agendar uma ligação para você no horário que quiser. Quer?`;
        if (await enviarMsgQueWpp(base44, thread, msgAlternativa)) {
          resultados.alternativas_oferecidas++;
          console.log(`[SLA] ✅ Alternativa oferecida para thread ${thread.id}`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // CENÁRIO 3: Threads esperando >15 min → escalar supervisor
    // ══════════════════════════════════════════════════════════════════
    const threadsEscala = await buscarThreadsParadas(base44, THRESHOLDS_MINUTOS.ESCALACAO_SUPERVISOR);

    for (const thread of threadsEscala) {
      // Criar WorkQueueItem para supervisor
      try {
        await base44.asServiceRole.entities.WorkQueueItem.create({
          contact_id: thread.contact_id,
          thread_id: thread.id,
          tipo: 'manual',
          reason: 'sla_timeout_15min',
          severity: 'critical',
          status: 'open',
          notes: `🚨 SLA Guardian: Thread esperando >15 min na fila. Escalação para supervisor.`
        });

        const msgEscala = `🚨 Desculpa pela espera! Estou escalando para meu supervisor. Um momento!`;
        if (await enviarMsgQueWpp(base44, thread, msgEscala)) {
          resultados.escalacoes++;
          console.log(`[SLA] 🚨 Escalação criada para thread ${thread.id}`);
        }
      } catch (e) {
        console.error(`[SLA] ❌ Erro ao escalar:`, e.message);
        resultados.erros++;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // CENÁRIO 4: Estados travados (WAITING_* há >10 min) → resgate
    // ══════════════════════════════════════════════════════════════════
    const statesTravados = await base44.asServiceRole.entities.MessageThread.filter({
      pre_atendimento_state: { $in: ['WAITING_SECTOR_CHOICE', 'WAITING_QUEUE_DECISION', 'TIMEOUT'] },
      pre_atendimento_started_at: { $lte: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      status: 'aberta'
    }, '-pre_atendimento_started_at', 20).catch(() => []);

    for (const thread of statesTravados) {
      try {
        // Resgate: disparar skill 2 novamente
        await base44.asServiceRole.functions.invoke('skill_02_intent_router', {
          thread_id: thread.id,
          contact_id: thread.contact_id
        });

        resultados.estados_resgatados++;
        console.log(`[SLA] 🔄 Estado travado resgatado: ${thread.id}`);
      } catch (e) {
        console.warn(`[SLA] ⚠️ Erro ao resgatar estado:`, e.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // CENÁRIO 5: Fora do horário comercial (18h-8h) → agendar retorno
    // ══════════════════════════════════════════════════════════════════
    const horaAtual = new Date().getHours();
    const foraDoHorario = horaAtual < 8 || horaAtual > 18;

    if (foraDoHorario) {
      const threadsFora = await base44.asServiceRole.entities.MessageThread.filter({
        last_inbound_at: { $lte: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        status: 'aberta',
        assigned_user_id: { $exists: false }
      }, '-last_inbound_at', 10).catch(() => []);

      for (const thread of threadsFora) {
        const msgFora = `🌙 Fora do horário comercial!\nVoltamos amanhã às 8h. Obrigado! 😊`;
        if (await enviarMsgQueWpp(base44, thread, msgFora)) {
          console.log(`[SLA] 🌙 Notificação noturna enviada para ${thread.id}`);
        }
      }
    }

    console.log('[SLA] ✅ Ciclo SLA Guardian concluído:', resultados);

    return Response.json({
      success: true,
      resultados,
      duration_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[SLA] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});