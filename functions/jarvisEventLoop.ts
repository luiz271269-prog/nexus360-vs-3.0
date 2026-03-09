// jarvisEventLoop - v2.1.0
// CORREÇÕES v2.1:
// [P4] jarvis_last_playbook salvo no MessageThread após ação bem-sucedida
// [P5] Threshold de inatividade dinâmico baseado no score de risco do contato

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const COOLDOWN_HORAS = 4;
const MAX_THREADS_POR_CICLO = 5; // processa no máximo 5 por execução para não exceder timeout
const IDLE_THRESHOLD_MIN = 30;   // thread ociosa se sem resposta há X minutos

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const agora = new Date();

    console.log('[JARVIS v2] 🔄 Event Loop iniciado...');

    const resultados = {
      eventos_processados: 0,
      threads_alertadas: 0,
      orcamentos_processados: 0,
      threads_ignoradas_cooldown: 0,
      erros: 0
    };

    // ══════════════════════════════════════════════
    // STEP 1: EventoSistema (só executa se há eventos)
    // ══════════════════════════════════════════════
    const eventos = await base44.asServiceRole.entities.EventoSistema.filter(
      { processado: false },
      '-timestamp',
      20
    );

    if (eventos.length > 0) {
      for (const evento of eventos) {
        try {
          let playbook = 'generic';
          if (evento.tipo_evento === 'message.inbound' && evento.detalhes?.has_url) {
            playbook = 'link_intelligence';
          }

          await base44.asServiceRole.entities.AgentRun.create({
            trigger_type: evento.tipo_evento,
            trigger_event_id: evento.id,
            playbook_selected: playbook,
            execution_mode: 'assistente',
            status: 'concluido',
            context_snapshot: { evento_tipo: evento.tipo_evento, evento_detalhes: evento.detalhes },
            started_at: agora.toISOString(),
            completed_at: agora.toISOString(),
            duration_ms: 0
          });

          await base44.asServiceRole.entities.EventoSistema.update(evento.id, { processado: true });
          resultados.eventos_processados++;
        } catch (err) {
          console.error('[JARVIS v2] Erro evento:', err.message);
          resultados.erros++;
        }
      }
    } else {
      console.log('[JARVIS v2] ⏭️ EventoSistema vazio — pulando step 1');
    }

    // ══════════════════════════════════════════════
    // STEP 2: Threads ociosas — COM COOLDOWN
    // [P1 FIX] Filtra por jarvis_next_check_after < agora OU null
    // [P2 FIX] Executa ação real: Claude AI se chip disponível, senão mensagem interna
    // ══════════════════════════════════════════════
    const idleThreshold = new Date(agora.getTime() - IDLE_THRESHOLD_MIN * 60 * 1000);

    // Busca threads ociosas que passaram do cooldown
    const threadsCandidatas = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_sender: 'contact',
      last_message_at: { $lt: idleThreshold.toISOString() },
      assigned_user_id: { $exists: true },
      unread_count: { $gt: 0 },
      status: 'aberta'
    }, '-last_message_at', 40);

    // [P1] Filtrar pelo cooldown + [P5 FIX] threshold dinâmico por score de risco
    // Regra: quanto maior o risco do contato, menor o tempo de inatividade tolerado
    //   score_engajamento >= 70 (VIP/quente) → alerta após 30min de ociosidade
    //   score_engajamento 40-69 (morno)       → alerta após 2h
    //   score_engajamento < 40 (frio)         → alerta após 6h
    //   sem score                             → alerta após 1h (padrão seguro)
    const getIdleThresholdMs = (thread) => {
      const score = thread.score_engajamento ?? thread.cliente_score ?? null;
      if (score === null) return 60 * 60 * 1000;        // 1h — sem score
      if (score >= 70)    return 30 * 60 * 1000;        // 30min — alto risco/VIP
      if (score >= 40)    return 2 * 60 * 60 * 1000;   // 2h — médio
      return 6 * 60 * 60 * 1000;                        // 6h — baixo engajamento
    };

    const threadsParaProcessar = threadsCandidatas.filter(t => {
      // Cooldown anti-loop
      if (t.jarvis_next_check_after && new Date(t.jarvis_next_check_after) >= agora) return false;
      // Threshold dinâmico: rejeita se ociosidade ainda não atingiu o limiar do score
      const idleMs = agora - new Date(t.last_message_at);
      return idleMs >= getIdleThresholdMs(t);
    }).slice(0, MAX_THREADS_POR_CICLO);

    resultados.threads_ignoradas_cooldown = threadsCandidatas.length - threadsParaProcessar.length;
    console.log(`[JARVIS v2] 📊 ${threadsCandidatas.length} candidatas | ${threadsParaProcessar.length} a processar | ${resultados.threads_ignoradas_cooldown} em cooldown`);

    // Buscar integração WhatsApp ativa para envio automático
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' },
      '-created_date',
      1
    ).catch(() => []);
    const integracaoPrincipal = integracoes[0] || null;

    for (const thread of threadsParaProcessar) {
      const inicioThread = Date.now();
      try {
        // Determinar ação baseada no contexto da thread
        const temIntegracao = !!integracaoPrincipal && !!thread.whatsapp_integration_id;
        const minutosOcioso = Math.round((agora - new Date(thread.last_message_at)) / 60000);

        let acaoExecutada = 'nenhuma';
        let erroAcao = null;

        if (temIntegracao && thread.contact_id) {
          // [P2 FIX] Ação real: invocar Claude para responder automaticamente
          try {
            await base44.asServiceRole.functions.invoke('claudeWhatsAppResponder', {
              thread_id: thread.id,
              contact_id: thread.contact_id,
              message_content: `[JARVIS] Thread ociosa há ${minutosOcioso} minutos. Verificar e responder.`,
              integration_id: thread.whatsapp_integration_id,
              provider: integracaoPrincipal.api_provider || 'w_api'
            });
            acaoExecutada = 'claude_resposta_automatica';
          } catch (err) {
            erroAcao = err.message;
            console.warn(`[JARVIS v2] ⚠️ Claude falhou para thread ${thread.id}: ${err.message}`);
          }
        }

        if (acaoExecutada === 'nenhuma' && thread.assigned_user_id) {
          // [P2 FIX] Fallback: notificar atendente via mensagem interna
          try {
            await base44.asServiceRole.functions.invoke('sendInternalMessage', {
              from_user_id: 'jarvis_system',
              to_user_id: thread.assigned_user_id,
              thread_id: thread.id,
              content: `⏰ *Atenção!* A conversa com este contato está sem resposta há *${minutosOcioso} minutos*. Por favor, verifique.`,
              visibility: 'internal_only'
            });
            acaoExecutada = 'notificacao_atendente';
          } catch (err) {
            erroAcao = erroAcao || err.message;
            console.warn(`[JARVIS v2] ⚠️ Notificação falhou para thread ${thread.id}: ${err.message}`);
          }
        }

        // [P4 FIX] Marcar cooldown + salvar último playbook executado
        const proximoCheck = new Date(agora.getTime() + COOLDOWN_HORAS * 60 * 60 * 1000);
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          jarvis_alerted_at: agora.toISOString(),
          jarvis_next_check_after: proximoCheck.toISOString(),
          ...(acaoExecutada !== 'nenhuma' && { jarvis_last_playbook: acaoExecutada })
        });

        // Registrar AgentRun com status real
        await base44.asServiceRole.entities.AgentRun.create({
          trigger_type: 'thread.idle',
          trigger_event_id: thread.id,
          playbook_selected: acaoExecutada,
          execution_mode: 'assistente',
          status: erroAcao ? 'erro' : 'concluido',
          context_snapshot: {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            minutos_ocioso: minutosOcioso,
            unread_count: thread.unread_count,
            acao_executada: acaoExecutada,
            erro: erroAcao
          },
          started_at: new Date(inicioThread).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - inicioThread
        });

        resultados.threads_alertadas++;
      } catch (err) {
        console.error(`[JARVIS v2] Erro ao processar thread ${thread.id}:`, err.message);
        resultados.erros++;
      }
    }

    // ══════════════════════════════════════════════
    // STEP 3: Orçamentos parados (> 7 dias no status 'enviado')
    // ══════════════════════════════════════════════
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const orcamentosParados = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'enviado',
      updated_date: { $lt: seteDiasAtras.toISOString() }
    }, '-updated_date', 10);

    for (const orc of orcamentosParados) {
      try {
        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: `Follow-up: Orçamento ${orc.numero_orcamento || orc.id}`,
          descricao: `Orçamento de R$ ${orc.valor_total?.toLocaleString('pt-BR')} parado há 7+ dias sem resposta`,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: 'alta',
          cliente_nome: orc.cliente_nome,
          orcamento_id: orc.id,
          vendedor_responsavel: orc.vendedor,
          data_prazo: agora.toISOString(),
          contexto_ia: { motivo_criacao: 'Jarvis v2 — orçamento parado', criado_por: 'jarvis' }
        });
        resultados.orcamentos_processados++;
      } catch (err) {
        console.error('[JARVIS v2] Erro orçamento:', err.message);
        resultados.erros++;
      }
    }

    console.log('[JARVIS v2] ✅ Ciclo concluído:', resultados);
    return Response.json({ success: true, versao: '2.0.0', resultados });

  } catch (error) {
    console.error('[JARVIS v2] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});