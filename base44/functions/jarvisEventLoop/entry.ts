// jarvisEventLoop - v3.2.0 (NexusAgentLoop)
// ═══════════════════════════════════════════════════════════════════════
// NEXUS AGENT LOOP — Agente autônomo que impede clientes esquecidos
// ═══════════════════════════════════════════════════════════════════════
//
// CICLO COMPLETO (v3.2):
//   STEP 0: businessIA → ajusta sensibilidade se negócio em crise
//   STEP 1: (REMOVIDO) EventoSistema era letra morta — nenhuma função produzia eventos
//   STEP 2: Threads ociosas → prontuário → CRÍTICO/ALTO/MÉDIO/BAIXO (thresholds dinâmicos)
//   STEP 3: Orçamentos: negociando>3d, enviado>7d, vencido<14d
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@base44/sdk@0.8.20';

const COOLDOWN_HORAS = 4;          // padrão — sobrescrito por ConfiguracaoSistema: jarvis_cooldown_horas
const MAX_THREADS_POR_CICLO = 3;   // padrão — sobrescrito por ConfiguracaoSistema: jarvis_max_threads
const MAX_CICLO_MS = 90_000;       // guard de 90s para não estourar o timeout de 3min

async function loadConfig(base44) {
  try {
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ ativa: true }, 'chave', 100);
    const map = {};
    for (const c of configs) {
      map[c.chave] = c.valor?.value !== undefined ? c.valor.value : null;
    }
    return map;
  } catch (e) {
    console.warn('[CONFIG] Falha ao carregar configs do banco:', e.message);
    return {};
  }
}

// Threshold de inatividade dinâmico por score de engajamento do contato
// Contato quente/VIP → alerta rápido | Frio → aguardar mais
const getIdleThresholdMs = (thread) => {
  const score = thread.score_engajamento ?? thread.cliente_score ?? null;
  if (score === null) return 60 * 60 * 1000;      // 1h — sem score
  if (score >= 70)    return 30 * 60 * 1000;      // 30min — VIP/quente
  if (score >= 40)    return 2 * 60 * 60 * 1000;  // 2h — morno
  return 6 * 60 * 60 * 1000;                       // 6h — frio
};

Deno.serve(async (req) => {
  try {
    // ✅ FIX: Em contexto agendado, req vem vazio
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.log('[NEXUS-AGENT v3] Contexto agendado detectado, usando createClient()');
      base44 = createClient();
    }
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    const agora = new Date();
    const inicioCiclo = Date.now();

    console.log('[NEXUS-AGENT v3] 🔄 Loop iniciado...');

    // Carregar configs do banco (cooldown e max_threads configuráveis)
    const cfg = await loadConfig(base44);
    const cooldownHoras = Number(cfg.jarvis_cooldown_horas || COOLDOWN_HORAS);
    const maxThreads = Number(cfg.jarvis_max_threads || MAX_THREADS_POR_CICLO);

    const resultados = {
      eventos_processados: 0,
      threads_alertadas: 0,
      followups_automaticos: 0,
      alertas_internos: 0,
      orcamentos_processados: 0,
      threads_ignoradas_cooldown: 0,
      erros: 0
    };

    // ══════════════════════════════════════════════
    // STEP 0: sensibilidadeBoost fixo em 0
    // businessIA removido: sempre falhava silenciosamente (BUG-007 fix)
    // ══════════════════════════════════════════════
    const sensibilidadeBoost = 0;

    // ══════════════════════════════════════════════
    // STEP 2: Threads ociosas com decisão inteligente
    //
    // Fluxo por thread:
    //  1. Aplicar threshold dinâmico por score
    //  2. Verificar cooldown (jarvis_next_check_after)
    //  3. Buscar ContactBehaviorAnalysis (prontuário)
    //  4. Decidir ação baseado no priority_score:
    //     CRÍTICO  → WhatsApp direto com suggested_message da análise
    //     ALTO     → Alerta interno ao atendente
    //     MÉDIO    → Apenas registrar (sem ação)
    //     BAIXO    → Ignorar (contato frio)
    // ══════════════════════════════════════════════
    const idleThreshold = new Date(agora.getTime() - 30 * 60 * 1000); // mínimo 30min

    const threadsCandidatas = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      is_canonical: true,
      last_message_sender: 'contact',
      last_message_at: { $lt: idleThreshold.toISOString() },
      assigned_user_id: { $exists: true },
      unread_count: { $gt: 0 },
      status: 'aberta'
    }, '-last_message_at', 40);

    const threadsParaProcessar = threadsCandidatas.filter(t => {
      if (t.jarvis_next_check_after && new Date(t.jarvis_next_check_after) >= agora) return false;
      const idleMs = agora - new Date(t.last_message_at);
      return idleMs >= getIdleThresholdMs(t);
      })
      .sort((a, b) => (b.score_engajamento ?? b.cliente_score ?? 0) - (a.score_engajamento ?? a.cliente_score ?? 0))
      .slice(0, maxThreads);

    resultados.threads_ignoradas_cooldown = threadsCandidatas.length - threadsParaProcessar.length;
    console.log(`[NEXUS-AGENT v3] 📊 ${threadsCandidatas.length} candidatas | ${threadsParaProcessar.length} a processar | ${resultados.threads_ignoradas_cooldown} em cooldown`);

    // Mapa de contatos suprimidos por atendente (para WorkQueueItem de resumo)
    const resumosPendentes = {}; // { atendente_id: [{ contact_id, thread_id, priority_score }] }

    // Buscar integração WhatsApp ativa (para follow-up automático)
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { status: 'conectado' }, '-created_date', 1
    ).catch(() => []);
    const integracaoPrincipal = integracoes[0] || null;

    // ── FREIO DE MÃO: limite de 10 disparos diretos/hora por chip ──────────
    // Protege o chip de banimento por envio em massa automático
    const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);
    const disparosUltimaHora = await base44.asServiceRole.entities.Message.filter({
      sender_id: 'nexus_agent',
      sent_at: { $gte: umaHoraAtras.toISOString() }
    }, '-sent_at', 20).catch(() => []);
    const forceModeAlertOnly = disparosUltimaHora.length >= 10;
    if (forceModeAlertOnly) {
      console.log(`[NEXUS-AGENT v3.2] 🛑 FREIO DE MÃO ativado — ${disparosUltimaHora.length} disparos na última hora. Convertendo CRÍTICOs em alertas internos.`);
    }

    for (const thread of threadsParaProcessar) {
      // Guard de tempo — não ultrapassar 90s
      if (Date.now() - inicioCiclo > MAX_CICLO_MS) {
        console.warn('[NEXUS-AGENT v3] ⏱️ Guard de tempo — abortando loop');
        break;
      }

      const inicioThread = Date.now();
      const minutosOcioso = Math.round((agora - new Date(thread.last_message_at)) / 60000);

      try {
        // ── Buscar prontuário do contato (ContactBehaviorAnalysis) ──────────
        let analise = null;
        let priorityScore = 0;
        let priorityLabel = 'BAIXO';
        let suggestedMessage = null;

        if (thread.contact_id) {
          try {
            const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
              { contact_id: thread.contact_id },
              '-analyzed_at',
              1
            );
            if (analises.length > 0) {
              analise = analises[0];
              priorityScore = analise.priority_score || 0;
              priorityLabel = analise.priority_label || 'BAIXO';
              // Pegar mensagem sugerida do prontuário ou next_best_action
              suggestedMessage = analise.insights_v2?.next_best_action?.suggested_message
                || analise.next_best_action?.suggested_message
                || analise.ai_insights?.next_best_action?.message_suggestion
                || null;
              // Em crise, upgrade de label se score está na zona expandida
              if (sensibilidadeBoost > 0) {
                const ct = 75 - sensibilidadeBoost;
                const at = 55 - sensibilidadeBoost;
                if (priorityScore >= ct && priorityLabel === 'ALTO') priorityLabel = 'CRITICO';
                else if (priorityScore >= at && priorityLabel === 'MEDIO') priorityLabel = 'ALTO';
              }
              console.log(`[NEXUS-AGENT v3.2] 🧠 Prontuário: ${priorityLabel} (${priorityScore}) | Análise: ${analise.analyzed_at?.substring(0, 10)} | Boost: ${sensibilidadeBoost}`);
            } else {
              console.log(`[NEXUS-AGENT v3] ⚠️ Sem prontuário para contact ${thread.contact_id} — usando score padrão`);
              // Sem análise, usar score do thread como proxy
              priorityScore = thread.cliente_score || thread.score_engajamento || 0;
              const ctProxy = 75 - sensibilidadeBoost;
              const atProxy = 55 - sensibilidadeBoost;
              priorityLabel = priorityScore >= ctProxy ? 'CRITICO' : priorityScore >= atProxy ? 'ALTO' : priorityScore >= 35 ? 'MEDIO' : 'BAIXO';
            }
          } catch (e) {
            console.warn(`[NEXUS-AGENT v3] ⚠️ Erro ao buscar análise: ${e.message}`);
          }
        }

        // ── DECISÃO baseada no priority_score ───────────────────────────────
        let acaoExecutada = 'nenhuma';
        let erroAcao = null;

        if (priorityLabel === 'BAIXO') {
          // Contato frio — não gastar recursos, apenas registrar cooldown
          acaoExecutada = 'ignorado_score_baixo';
          console.log(`[NEXUS-AGENT v3] ⏭️ Score BAIXO (${priorityScore}) — sem ação para thread ${thread.id}`);

        } else if (priorityLabel === 'CRITICO' && !forceModeAlertOnly && integracaoPrincipal && thread.contact_id && thread.whatsapp_integration_id) {
          // ── CRÍTICO: Follow-up automático WhatsApp ─────────────────────────
          // Usa a mensagem sugerida pelo prontuário ou um fallback profissional
          const msgFollowUp = suggestedMessage
            || `Olá! Percebi que nossa conversa ficou pendente. Posso ajudar com algo? 😊`;

          try {
            // Buscar contato para pegar telefone
            const contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id);

            if (contato?.telefone) {
              const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
                integration_id: thread.whatsapp_integration_id,
                numero_destino: contato.telefone,
                mensagem: msgFollowUp
              });

              if (respEnvio.data?.success) {
                // Salvar mensagem no histórico da thread
                await base44.asServiceRole.entities.Message.create({
                  thread_id: thread.id,
                  sender_id: 'nexus_agent',
                  sender_type: 'user',
                  content: msgFollowUp,
                  channel: 'whatsapp',
                  status: 'enviada',
                  sent_at: agora.toISOString(),
                  visibility: 'public_to_customer',
                  metadata: {
                    is_ai_response: true,
                    ai_agent: 'nexusAgentLoop',
                    trigger: 'idle_critical',
                    minutos_ocioso: minutosOcioso,
                    priority_score: priorityScore,
                    whatsapp_integration_id: thread.whatsapp_integration_id
                  }
                });

                await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                  last_message_at: agora.toISOString(),
                  last_outbound_at: agora.toISOString(),
                  last_message_sender: 'user',
                  last_message_content: msgFollowUp.substring(0, 100)
                });

                acaoExecutada = 'followup_automatico_whatsapp';
                resultados.followups_automaticos++;
                console.log(`[NEXUS-AGENT v3] ✅ Follow-up AUTOMÁTICO enviado → ${contato.nome} (${priorityScore} pts, ${minutosOcioso}min ocioso)`);
              } else {
                erroAcao = respEnvio.data?.error || 'Erro no gateway';
                console.warn(`[NEXUS-AGENT v3] ⚠️ Falha no envio WhatsApp: ${erroAcao}`);
              }
            } else {
              console.warn(`[NEXUS-AGENT v3] ⚠️ Contato sem telefone — fallback para alerta interno`);
              // Fallback para alerta interno se não tiver telefone
              priorityLabel = 'ALTO';
            }
          } catch (e) {
            erroAcao = e.message;
            console.warn(`[NEXUS-AGENT v3] ⚠️ Erro no follow-up automático: ${e.message}`);
            // Fallback para alerta interno
            priorityLabel = 'ALTO';
          }
        }

        // ── ALTO ou fallback do CRÍTICO: Nexus Brain decide a ação ─────────
        if ((priorityLabel === 'ALTO' || (priorityLabel === 'CRITICO' && (acaoExecutada === 'nenhuma' || forceModeAlertOnly)) || (priorityLabel === 'MEDIO' && sensibilidadeBoost > 0)) && thread.assigned_user_id) {
          // Tentar nexusAgentBrain primeiro para decisão inteligente
          try {
            const brainResult = await base44.asServiceRole.functions.invoke('nexusAgentBrain', {
              thread_id: thread.id,
              contact_id: thread.contact_id,
              integration_id: thread.whatsapp_integration_id,
              trigger: 'jarvis_alert',
              message_content: suggestedMessage || `Conversa parada há ${minutosOcioso} minutos. Score: ${priorityScore}/100 (${priorityLabel})`,
              mode: forceModeAlertOnly ? 'copilot' : (priorityLabel === 'CRITICO' ? 'autonomous' : 'copilot')
            });
            if (brainResult.data?.success && brainResult.data?.action !== 'no_action') {
              acaoExecutada = `nexus_brain_${brainResult.data?.action}`;
              resultados.alertas_internos++;
              console.log(`[NEXUS-AGENT v3.2] 🧠 Brain agiu: ${brainResult.data?.action} | thread ${thread.id}`);
            }
          } catch (brainErr) {
            console.warn(`[NEXUS-AGENT v3.2] ⚠️ Brain falhou, fallback alerta interno: ${brainErr.message}`);
          }

          // Fallback: alerta interno direto para thread de setor (evita criar 1:1 extras)
           if (acaoExecutada === 'nenhuma') {
             try {
               // Buscar thread de setor do usuário (mais limpo que 1:1)
               const usuarioAtribuido = await base44.asServiceRole.entities.User.get(thread.assigned_user_id).catch(() => null);
               
               if (!usuarioAtribuido) {
                 console.warn(`[NEXUS-AGENT v3.2] ⚠️ Usuário ${thread.assigned_user_id} não encontrado — pulando alerta`);
                 acaoExecutada = 'ignorado_usuario_invalido';
                 continue;
               }

               const setorUsuario = usuarioAtribuido.attendant_sector || 'geral';

               let internalThread = null;
               const sectorThreads = await base44.asServiceRole.entities.MessageThread.filter({
                 thread_type: 'sector_group',
                 sector_key: `sector:${setorUsuario}`
               }, '-created_date', 1).catch(() => []);

               if (sectorThreads.length > 0) {
                 internalThread = sectorThreads[0];
               } else {
                 // 🛡️ CRIAR thread de setor via função validada (evita service_* orphans)
                 console.log(`[NEXUS-AGENT v3.2] 🆕 Thread de setor ${setorUsuario} não existe — criando via getOrCreateSectorThread`);
                 try {
                   const resultado = await base44.asServiceRole.functions.invoke('getOrCreateSectorThread', { 
                     sector_name: setorUsuario 
                   });
                   internalThread = resultado?.data?.thread || resultado?.thread || null;
                 } catch (createErr) {
                   console.error(`[NEXUS-AGENT v3.2] ❌ Erro ao criar thread de setor: ${createErr.message}`);
                   acaoExecutada = 'erro_criar_thread_setor';
                   continue;
                 }
               }

               if (internalThread?.id) {
                const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
                const alertasRecentes = await base44.asServiceRole.entities.Message.filter({
                  thread_id: internalThread.id,
                  sender_id: 'nexus_agent',
                  sent_at: { $gte: duasHorasAtras.toISOString() }
                }, '-sent_at', 5).catch(() => []);

                if (alertasRecentes.length >= 3) {
                  if (!resumosPendentes[thread.assigned_user_id]) resumosPendentes[thread.assigned_user_id] = [];
                  resumosPendentes[thread.assigned_user_id].push({
                    contact_id: thread.contact_id,
                    thread_id: thread.id,
                    priority_score: priorityScore,
                    minutos_ocioso: minutosOcioso
                  });
                  acaoExecutada = 'ignorado_cooldown_atendente';
                  console.log(`[NEXUS-AGENT v3.2] 🔕 Cooldown atendente ${thread.assigned_user_id}`);
                } else {
                  const riskInfo = analise?.relationship_risk?.level
                    ? `\n🔴 Risco relacional: *${analise.relationship_risk.level.toUpperCase()}*`
                    : '';
                  const nextAction = analise?.insights_v2?.next_best_action?.action || analise?.next_best_action?.action || '';
                  const actionInfo = nextAction ? `\n💡 Próxima ação sugerida: ${nextAction}` : '';
                  const msgContent = `⏰ *Atenção!* Conversa parada há *${minutosOcioso} minutos*.\n📊 Score: *${priorityScore}/100 (${priorityLabel})*${riskInfo}${actionInfo}\n🔗 Thread: ${thread.id}`;

                  await base44.asServiceRole.entities.Message.create({
                    thread_id: internalThread.id,
                    sender_id: 'nexus_agent',
                    sender_type: 'user',
                    content: msgContent,
                    channel: 'interno',
                    visibility: 'internal_only',
                    provider: 'internal_system',
                    status: 'enviada',
                    sent_at: agora.toISOString(),
                    metadata: { is_internal_message: true, jarvis_alert: true, external_thread_id: thread.id, contact_id: thread.contact_id, priority_score: priorityScore, priority_label: priorityLabel }
                  });

                  const currentUnreads = internalThread.unread_by || {};
                  currentUnreads[thread.assigned_user_id] = (currentUnreads[thread.assigned_user_id] || 0) + 1;
                  await base44.asServiceRole.entities.MessageThread.update(internalThread.id, {
                    last_message_at: agora.toISOString(),
                    // ✅ FIX: NÃO sobrescrever last_message_content com alertas do Jarvis
                    // Isso evita que o preview do "Setor vendas" apareça poluído na lista de conversas
                    unread_by: currentUnreads,
                    total_mensagens: (internalThread.total_mensagens || 0) + 1
                  });

                  acaoExecutada = 'alerta_interno_atendente';
                  resultados.alertas_internos++;
                  console.log(`[NEXUS-AGENT v3.2] ✅ Alerta interno → atendente ${thread.assigned_user_id} | Score ${priorityScore} | ${minutosOcioso}min`);
                }
              }
            } catch (e) {
              erroAcao = erroAcao || e.message;
              console.warn(`[NEXUS-AGENT v3] ⚠️ Alerta interno falhou: ${e.message}`);
            }
          } // fim fallback alerta interno
        }

        // ── MÉDIO: só registrar, sem incomodar ─────────────────────────────
        if (priorityLabel === 'MEDIO' && acaoExecutada === 'nenhuma') {
          acaoExecutada = 'registrado_sem_acao';
          console.log(`[NEXUS-AGENT v3] 📝 Score MÉDIO (${priorityScore}) — registrando cooldown sem ação`);
        }

        // Aplicar cooldown + salvar último playbook
        const proximoCheck = new Date(agora.getTime() + cooldownHoras * 60 * 60 * 1000);
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          jarvis_alerted_at: agora.toISOString(),
          jarvis_next_check_after: proximoCheck.toISOString(),
          ...(acaoExecutada !== 'nenhuma' && acaoExecutada !== 'ignorado_score_baixo' && { jarvis_last_playbook: acaoExecutada })
        });

        // Registrar AgentRun para auditoria
        await base44.asServiceRole.entities.AgentRun.create({
          trigger_type: 'scheduled.check',
          trigger_event_id: thread.id,
          playbook_selected: acaoExecutada,
          execution_mode: 'auto_execute',
          status: erroAcao ? 'erro' : 'concluido',
          context_snapshot: {
            thread_id: thread.id,
            contact_id: thread.contact_id,
            minutos_ocioso: minutosOcioso,
            unread_count: thread.unread_count,
            priority_score: priorityScore,
            priority_label: priorityLabel,
            acao_executada: acaoExecutada,
            tinha_analise: !!analise,
            erro: erroAcao
          },
          started_at: new Date(inicioThread).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - inicioThread
        });

        resultados.threads_alertadas++;
      } catch (err) {
        console.error(`[NEXUS-AGENT v3] Erro ao processar thread ${thread.id}:`, err.message);
        resultados.erros++;
      }
    }

    // ── WorkQueueItems de resumo para atendentes com anti-fadiga ───────────
    for (const [atendenteId, contatos] of Object.entries(resumosPendentes)) {
      try {
        await base44.asServiceRole.entities.WorkQueueItem.create({
          tipo: 'manual',
          reason: 'manual',
          severity: 'medium',
          status: 'open',
          owner_user_id: atendenteId,
          notes: `Jarvis suprimiu ${contatos.length} alerta(s) por anti-fadiga. Verifique os contatos pendentes.`,
          payload: {
            tipo: 'resumo_pendentes',
            contatos_suprimidos: contatos,
            gerado_em: agora.toISOString()
          }
        });
        console.log(`[NEXUS-AGENT v3.2] 📋 WorkQueueItem resumo_pendentes criado para atendente ${atendenteId} com ${contatos.length} contato(s)`);
      } catch (e) {
        console.warn(`[NEXUS-AGENT v3.2] ⚠️ Erro ao criar resumo pendentes: ${e.message}`);
      }
    }

    // ══════════════════════════════════════════════
    // STEP 3: Orçamentos parados > 7 dias
    // Só executa se ainda há tempo disponível
    // ══════════════════════════════════════════════
    if (Date.now() - inicioCiclo > MAX_CICLO_MS) {
      console.warn('[NEXUS-AGENT v3] ⏱️ Skip Step 3 — ciclo sem tempo');
      console.log('[NEXUS-AGENT v3] ✅ Ciclo concluído (sem step 3):', resultados);
      return Response.json({ success: true, versao: '3.0.0', resultados });
    }

    const tresDiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const quatorzeAtras = new Date(agora.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 3a. Negociando travados >3 dias → alerta interno ao responsável
    const negociandoTravados = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'negociando',
      updated_date: { $lt: tresDiasAtras.toISOString() }
    }, '-updated_date', 10);

    for (const orc of negociandoTravados) {
      try {
        if (orc.vendedor) {
          let vendedores = await base44.asServiceRole.entities.User.filter(
            { full_name: orc.vendedor }, 'full_name', 1
          ).catch(() => []);

          // Fallback: se nome não bater exatamente, notifica o primeiro admin
          if (vendedores.length === 0) {
            console.warn(`[NEXUS-AGENT v3.2] ⚠️ Vendedor "${orc.vendedor}" não encontrado por full_name — notificando admin`);
            vendedores = await base44.asServiceRole.entities.User.filter(
              { role: 'admin' }, 'full_name', 1
            ).catch(() => []);
          }

          if (vendedores.length > 0) {
            // ✅ FIX: usar sector_group (padrão STEP 2) em vez de criar 1:1 service_*
            const vendedorData = vendedores[0];
            const setorVendedor = vendedorData?.attendant_sector || 'vendas'; // default: vendas para alertas de orçamento

            const sectorThreads = await base44.asServiceRole.entities.MessageThread.filter({
              thread_type: 'sector_group',
              sector_key: `sector:${setorVendedor}`
            }, '-created_date', 1).catch(() => []);

            const internalThread = sectorThreads.length > 0 ? sectorThreads[0] : null;
            if (internalThread?.id) {
              await base44.asServiceRole.entities.Message.create({
                thread_id: internalThread.id,
                sender_id: 'nexus_agent',
                sender_type: 'user',
                content: `📋 *Orçamento em negociação parado há 3+ dias*\n👤 Cliente: ${orc.cliente_nome}\n💰 Valor: R$ ${orc.valor_total?.toLocaleString('pt-BR')}\n📅 Última atualização: ${orc.updated_date?.slice(0, 10)}`,
                channel: 'interno',
                visibility: 'internal_only',
                provider: 'internal_system',
                status: 'enviada',
                sent_at: agora.toISOString(),
                metadata: { jarvis_alert: true, orcamento_id: orc.id, tipo: 'negociando_parado' }
              });
              resultados.orcamentos_processados++;
            }
          }
        }
      } catch (err) {
        console.error('[NEXUS-AGENT v3.1] Erro orçamento negociando:', err.message);
        resultados.erros++;
      }
    }

    // 3b-EARLY. Enviados >4h <24h → WhatsApp automático ao cliente + status negociando
    const quatroHorasOrcamento = new Date(agora.getTime() - 4 * 60 * 60 * 1000);
    const vintequatroHorasAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    const orcamentosEnviados4h = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'enviado',
      updated_date: { $lt: quatroHorasOrcamento.toISOString(), $gte: vintequatroHorasAtras.toISOString() }
    }, '-updated_date', 10);

    for (const orc of orcamentosEnviados4h) {
      try {
        // Buscar thread do cliente (via contact_id ou cliente_id)
        let clienteThread = null;
        if (orc.contact_id) {
          const threads = await base44.asServiceRole.entities.MessageThread.filter({
            contact_id: orc.contact_id,
            thread_type: 'contact_external',
            status: 'aberta'
          }, '-last_message_at', 1).catch(() => []);
          clienteThread = threads[0] || null;
        }

        if (clienteThread?.whatsapp_integration_id && clienteThread.contact_id) {
          // Buscar contato para telefone
          const contato = await base44.asServiceRole.entities.Contact.get(clienteThread.contact_id).catch(() => null);

          if (contato?.telefone) {
            const msgFollowUp = `Olá${contato.nome ? ' ' + contato.nome.split(' ')[0] : ''}! Enviei o orçamento há algumas horas. Conseguiu visualizar? Estou à disposição para esclarecer qualquer dúvida 😊`;

            const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
              integration_id: clienteThread.whatsapp_integration_id,
              numero_destino: contato.telefone,
              mensagem: msgFollowUp
            }).catch(e => ({ data: { success: false, error: e.message } }));

            if (respEnvio.data?.success) {
              // Salvar mensagem no histórico
              await base44.asServiceRole.entities.Message.create({
                thread_id: clienteThread.id,
                sender_id: 'nexus_agent',
                sender_type: 'user',
                content: msgFollowUp,
                channel: 'whatsapp',
                status: 'enviada',
                sent_at: agora.toISOString(),
                visibility: 'public_to_customer',
                metadata: {
                  is_ai_response: true,
                  ai_agent: 'jarvisEventLoop',
                  trigger: 'orcamento_4h_sem_resposta',
                  orcamento_id: orc.id
                }
              }).catch(() => {});

              // Atualizar thread
              await base44.asServiceRole.entities.MessageThread.update(clienteThread.id, {
                last_message_at: agora.toISOString(),
                last_outbound_at: agora.toISOString(),
                last_message_sender: 'user',
                last_message_content: msgFollowUp.substring(0, 100)
              }).catch(() => {});

              console.log(`[JARVIS-3B-EARLY] ✅ Follow-up enviado → ${orc.cliente_nome} (orçamento ${orc.numero_orcamento || orc.id})`);
            }
          }

          // Atualizar status orçamento → negociando (independente do envio)
          await base44.asServiceRole.entities.Orcamento.update(orc.id, {
            status: 'negociando'
          }).catch(() => {});

          // Criar TarefaInteligente alta prioridade
          await base44.asServiceRole.entities.TarefaInteligente.create({
            titulo: `Orçamento aguardando resposta: ${orc.numero_orcamento || orc.id}`,
            descricao: `Cliente ${orc.cliente_nome} recebeu orçamento há 4h sem retorno. Follow-up automático enviado.`,
            tipo_tarefa: 'follow_up_orcamento_urgente',
            prioridade: 'alta',
            cliente_nome: orc.cliente_nome,
            orcamento_id: orc.id,
            vendedor_responsavel: orc.vendedor,
            data_prazo: agora.toISOString(),
            contexto_ia: { motivo_criacao: 'Jarvis STEP 3b-early — orçamento enviado 4h sem resposta', criado_por: 'nexus_agent' }
          }).catch(() => {});

          resultados.orcamentos_processados++;
        }
      } catch (err) {
        console.error('[JARVIS-3B-EARLY] Erro:', err.message);
        resultados.erros++;
      }
    }

    // 3b-LATE. Enviados >7 dias → TarefaInteligente crítica (fallback se automático de 4h não funcionou)
    const orcamentosParados = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'enviado',
      updated_date: { $lt: seteDiasAtras.toISOString() }
    }, '-updated_date', 10);

    for (const orc of orcamentosParados) {
      try {
        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: `Follow-up CRÍTICO: Orçamento ${orc.numero_orcamento || orc.id}`,
          descricao: `Orçamento de R$ ${orc.valor_total?.toLocaleString('pt-BR')} parado há 7+ dias sem resposta`,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: 'critica',
          cliente_nome: orc.cliente_nome,
          orcamento_id: orc.id,
          vendedor_responsavel: orc.vendedor,
          data_prazo: agora.toISOString(),
          contexto_ia: { motivo_criacao: 'NexusAgent v3.1 — orçamento parado 7d', criado_por: 'nexus_agent' }
        });
        resultados.orcamentos_processados++;
      } catch (err) {
        console.error('[NEXUS-AGENT v3.1] Erro orçamento enviado:', err.message);
        resultados.erros++;
      }
    }

    // 3c. Vencidos <14 dias → WorkQueueItem reativação
    const vencidosRecentes = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'vencido',
      updated_date: { $gte: quatorzeAtras.toISOString() }
    }, '-updated_date', 5);

    for (const orc of vencidosRecentes) {
      try {
        await base44.asServiceRole.entities.WorkQueueItem.create({
          tipo: 'follow_up',
          reason: 'manual',
          severity: 'medium',
          status: 'open',
          notes: `Orçamento vencido recentemente — janela de reativação: ${orc.numero_orcamento || orc.id}`,
          payload: {
            orcamento_id: orc.id,
            cliente_nome: orc.cliente_nome,
            valor_total: orc.valor_total,
            data_vencimento: orc.data_vencimento,
            tipo: 'orcamento_vencido_reativacao'
          }
        });
        resultados.orcamentos_processados++;
      } catch (err) {
        console.error('[NEXUS-AGENT v3.1] Erro orçamento vencido:', err.message);
        resultados.erros++;
      }
    }

    // ══════════════════════════════════════════════
    // STEP 3d — Orçamentos prometidos mas não enviados (>4h)
    // Detecta WorkQueueItems tipo 'orcamento_specs_cliente' abertos há mais de 4h
    // sem que um Orcamento tenha sido criado depois
    // ══════════════════════════════════════════════
    const quatroHorasAtras = new Date(agora.getTime() - 4 * 60 * 60 * 1000);

    try {
      // Bug #5 fix: monitora tipo 'manual' com payload.tipo === 'orcamento_specs_cliente'
      // (ninguém criava tipo 'orcamento_specs_cliente' — brain sempre cria tipo 'manual')
      const promessasPendentesRaw = await base44.asServiceRole.entities.WorkQueueItem.filter({
        tipo: 'manual',
        status: 'open',
        created_date: { $lt: quatroHorasAtras.toISOString() }
      }, '-created_date', 30).catch(() => []);

      // Filtrar apenas os que têm payload.tipo === 'orcamento_specs_cliente' ou 'cotacao_pendente'
      const promessasPendentes = promessasPendentesRaw.filter(item =>
        item.payload?.tipo === 'orcamento_specs_cliente' ||
        item.payload?.tipo === 'cotacao_pendente' ||
        (item.notes && /orçamento.*prometido|prometeu.*orçamento|cotação.*pendente/i.test(item.notes))
      );

      console.log(`[JARVIS-3D] ${promessasPendentes.length} promessas sem entrega encontradas`);

      for (const item of promessasPendentes) {
        try {
          // Verificar se orçamento já foi criado para esse contato depois da tarefa
          const orcamentosPosteriores = await base44.asServiceRole.entities.Orcamento.filter({
            contact_id: item.contact_id,
            created_date: { $gt: item.created_date }
          }, '-created_date', 1).catch(() => []);

          if (orcamentosPosteriores.length > 0) {
            // Orçamento foi enviado — fechar tarefa automaticamente
            await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
              status: 'done',
              notes: (item.notes || '') + '\n[AUTO] Orçamento enviado — fechado pelo Jarvis'
            }).catch(() => {});
            continue;
          }

          // Ainda sem orçamento — alertar via brain
          if (item.thread_id && item.contact_id) {
            await base44.asServiceRole.functions.invoke('nexusAgentBrain', {
              thread_id: item.thread_id,
              contact_id: item.contact_id,
              integration_id: null,
              trigger: 'jarvis_alert',
              message_content: `ALERTA: Cliente está esperando orçamento há mais de 4 horas. Tarefa criada em ${item.created_date?.slice(0, 16)} ainda está aberta. Criar alerta urgente para o atendente responsável e sugerir resposta ao cliente.`,
              mode: 'copilot'
            }).catch(e => console.warn('[JARVIS-3D] Brain falhou:', e.message));

            console.log(`[JARVIS-3D] Alerta enviado para thread ${item.thread_id}`);
            resultados.orcamentos_processados++;
          }
        } catch (e) {
          console.error(`[JARVIS-3D] Erro no item ${item.id}:`, e.message);
        }
      }
    } catch (e) {
      console.warn('[JARVIS-3D] Erro geral:', e.message);
    }

    // ══════════════════════════════════════════════
    // STEP 5 — APRENDIZADO SEMANAL DO BRAIN (segundas-feiras)
    // ══════════════════════════════════════════════
    const diaDaSemana = agora.getDay(); // 0=dom, 1=seg
    if (diaDaSemana === 1) {
      console.log('[JARVIS-STEP-5] Segunda-feira — iniciando aprendizado semanal...');
      try {
        // ✅ REGRA UNIVERSAL: nunca 2 aprendizados na mesma semana
        const inicioSemana = new Date(agora);
        inicioSemana.setDate(agora.getDate() - agora.getDay() + 1); // segunda-feira
        inicioSemana.setHours(0, 0, 0, 0);

        const jaExiste = await base44.asServiceRole.entities.NexusMemory.filter({
          owner_user_id: 'system',
          tipo: 'aprendizado_semanal',
          created_date: { $gte: inicioSemana.toISOString() }
        }, '-created_date', 1).catch(() => []);

        if (jaExiste.length > 0) {
          console.log('[JARVIS-STEP-5] ✅ Aprendizado da semana já existe — pulando');
        } else {
          const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          const [decisoesSemana, tarefasBrain] = await Promise.all([
            base44.asServiceRole.entities.AgentRun.filter(
              { created_date: { $gte: seteDiasAtras } }, '-created_date', 200
            ).catch(() => []),
            base44.asServiceRole.entities.WorkQueueItem.filter(
              { created_date: { $gte: seteDiasAtras } }, '-created_date', 100
            ).catch(() => [])
          ]);

          const totalDecisoes = decisoesSemana.length;
          const tarefasResolvidas = tarefasBrain.filter(t => ['done', 'processado', 'closed'].includes(t.status)).length;
          const taxaResolucao = tarefasBrain.length > 0
            ? (tarefasResolvidas / tarefasBrain.length * 100)
            : 0;

          const distribuicaoAcoes = decisoesSemana.reduce((acc, d) => {
            const acao = d.context_snapshot?.acao || d.playbook_selected || 'desconhecida';
            acc[acao] = (acc[acao] || 0) + 1;
            return acc;
          }, {});

          const contatosUnicos = new Set(
            decisoesSemana.map(d => d.context_snapshot?.contact_id || d.trigger_event_id).filter(Boolean)
          ).size;

          const aprendizado = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Você é o Nexus Brain fazendo auto-análise da sua performance semanal.\n\nDADOS DA SEMANA:\n- Total de decisões: ${totalDecisoes}\n- Contatos únicos: ${contatosUnicos}\n- Distribuição de ações: ${JSON.stringify(distribuicaoAcoes)}\n- Tarefas criadas: ${tarefasBrain.length}\n- Tarefas resolvidas: ${tarefasResolvidas}\n- Taxa de resolução: ${taxaResolucao.toFixed(1)}%\n\nAnalise: 1) O que está funcionando bem? 2) Onde o brain está conservador demais? 3) Onde está ativo demais? 4) Qual ajuste para a próxima semana?\n\nSeja específico e prático. Máximo 10 linhas.`
          });

          await base44.asServiceRole.entities.NexusMemory.create({
            owner_user_id: 'system',
            tipo: 'aprendizado_semanal',
            conteudo: typeof aprendizado === 'string' ? aprendizado : JSON.stringify(aprendizado),
            contexto: {
              semana_inicio: seteDiasAtras.split('T')[0],
              semana_fim: agora.toISOString().split('T')[0],
              total_decisoes: totalDecisoes,
              contatos_unicos: contatosUnicos,
              taxa_resolucao: parseFloat(taxaResolucao.toFixed(1)),
              distribuicao_acoes: distribuicaoAcoes,
              tarefas_criadas: tarefasBrain.length,
              tarefas_resolvidas: tarefasResolvidas
            },
            score_utilidade: parseFloat(taxaResolucao.toFixed(1))
          });

          console.log(`[JARVIS-STEP-5] ✅ Aprendizado salvo. Decisões: ${totalDecisoes} | Contatos: ${contatosUnicos} | Resolução: ${taxaResolucao.toFixed(1)}%`);
        }
      } catch (e) {
        console.error('[JARVIS-STEP-5] Erro no aprendizado semanal:', e.message);
      }
    }

    console.log('[NEXUS-AGENT v3] ✅ Ciclo concluído:', resultados);
    
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'jarvis_event_loop',
          triggered_by: 'automacao_agendada',
          execution_mode: 'autonomous_safe',
          context: {
            threads_candidatas: threadsCandidatas.length,
            threads_processadas: threadsParaProcessar.length,
            cooldown_horas: cooldownHoras,
            max_threads_ciclo: maxThreads
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            contatos_processados: resultados.threads_alertadas,
            playbooks_executados: resultados.followups_automaticos + resultados.alertas_internos,
            alertas_enviados: resultados.alertas_internos,
            followups_automaticos: resultados.followups_automaticos,
            threads_ignoradas_cooldown: resultados.threads_ignoradas_cooldown,
            orcamentos_processados: resultados.orcamentos_processados,
            erros: resultados.erros,
            etapa_concluida: 'step_2_3_5'
          }
        });
      } catch (e) {
        console.warn('[jarvisEventLoop] SkillExecution falhou (non-blocking):', e.message);
      }
    })();

    return Response.json({ success: true, versao: '3.0.0', resultados });

  } catch (error) {
    console.error('[NEXUS-AGENT v3] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});