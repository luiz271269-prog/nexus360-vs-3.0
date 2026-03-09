// jarvisEventLoop - v2.2.0
// CORREÇÕES v2.2:
// [P0] Removida chamada claudeWhatsAppResponder (retornava StreamingResponse quebrando o invoker)
// [P1] MAX_THREADS reduzido para 3 + guard de tempo (abort se > 90s gastos)
// [P4] jarvis_last_playbook salvo no MessageThread após ação bem-sucedida
// [P5] Threshold de inatividade dinâmico baseado no score de risco do contato

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const COOLDOWN_HORAS = 4;
const MAX_THREADS_POR_CICLO = 3;   // conservador: 3 threads por ciclo para não estoura 3min
const IDLE_THRESHOLD_MIN = 30;     // thread ociosa se sem resposta há X minutos
const MAX_CICLO_MS = 90_000;       // abort após 90s para não chegar perto do timeout de 3min

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

    const inicioCiclo = Date.now();

    for (const thread of threadsParaProcessar) {
      // [P1] Guard de tempo: abort se ultrapassou 90s
      if (Date.now() - inicioCiclo > MAX_CICLO_MS) {
        console.warn('[JARVIS v2] ⏱️ Guard de tempo atingido — abortando loop para evitar timeout');
        break;
      }

      const inicioThread = Date.now();
      try {
        const minutosOcioso = Math.round((agora - new Date(thread.last_message_at)) / 60000);

        let acaoExecutada = 'nenhuma';
        let erroAcao = null;

        // [P0 FIX] claudeWhatsAppResponder REMOVIDO daqui — retornava StreamingResponse
        // que quebrava o invoker do Base44 com "'StreamingResponse' object has no attribute 'body'"
        // Claude é invocado apenas via webhook inbound (processInbound → claudeWhatsAppResponder)
        // O Jarvis só faz notificação interna ao atendente como fallback seguro

        if (acaoExecutada === 'nenhuma' && thread.assigned_user_id) {
          // [FIX CIRÚRGICO] Notificar atendente via thread INTERNA (não a thread externa do contato)
          try {
            // 1. Buscar/criar thread interna do atendente
            const internalResult = await base44.asServiceRole.functions.invoke('getOrCreateInternalThread', {
              target_user_id: thread.assigned_user_id
            });
            const internalThread = internalResult?.data?.thread || internalResult?.thread;

            if (internalThread?.id) {
              const msgContent = `⏰ *Atenção!* A conversa com o contato está sem resposta há *${minutosOcioso} minutos*. Por favor, verifique. [Thread: ${thread.id}]`;

              // 2. Criar mensagem diretamente via service role (sem exigir auth de usuário real)
              await base44.asServiceRole.entities.Message.create({
                thread_id: internalThread.id,
                sender_id: 'jarvis_system',
                sender_type: 'user',
                content: msgContent,
                channel: 'interno',
                visibility: 'internal_only',
                provider: 'internal_system',
                status: 'enviada',
                sent_at: agora.toISOString(),
                metadata: {
                  is_internal_message: true,
                  jarvis_alert: true,
                  external_thread_id: thread.id,
                  contact_id: thread.contact_id
                }
              });

              // 3. Atualizar unread_by na thread interna
              const currentUnreads = internalThread.unread_by || {};
              currentUnreads[thread.assigned_user_id] = (currentUnreads[thread.assigned_user_id] || 0) + 1;
              await base44.asServiceRole.entities.MessageThread.update(internalThread.id, {
                last_message_at: agora.toISOString(),
                last_message_content: `⏰ Conversa parada há ${minutosOcioso} min`,
                unread_by: currentUnreads,
                total_mensagens: (internalThread.total_mensagens || 0) + 1
              });

              acaoExecutada = 'notificacao_atendente';
              console.log(`[JARVIS v2] ✅ Alerta interno enviado ao atendente ${thread.assigned_user_id} via thread ${internalThread.id}`);
            } else {
              console.warn(`[JARVIS v2] ⚠️ Thread interna não encontrada/criada para atendente ${thread.assigned_user_id}`);
            }
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
    // Só executa se ainda há tempo disponível no ciclo
    // ══════════════════════════════════════════════
    if (Date.now() - inicioCiclo > MAX_CICLO_MS) {
      console.warn('[JARVIS v2] ⏱️ Skip Step 3 (orçamentos) — ciclo sem tempo restante');
      console.log('[JARVIS v2] ✅ Ciclo concluído (sem step 3):', resultados);
      return Response.json({ success: true, versao: '2.2.0', resultados });
    }

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
    return Response.json({ success: true, versao: '2.2.0', resultados });

  } catch (error) {
    console.error('[JARVIS v2] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});