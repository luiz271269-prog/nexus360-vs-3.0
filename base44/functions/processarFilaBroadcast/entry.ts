import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// WORKER DE BROADCAST - Processa WorkQueueItems do tipo 'enviar_broadcast_avulso'
// ============================================================================
// Roda a cada 5 minutos via automação agendada
// Lote seguro: máx 20 por execução com cronômetro interno (25s máx)
// Delay de 1.2s entre envios = ~16 msgs/min (seguro para WhatsApp)
// ============================================================================

const LOTE_MAXIMO = 15;                 // ↓ 20→15 (mais conservador p/ anti-ban)
const TIMEOUT_LIMITE_MS = 25_000;       // 25s - margem para Edge Function de 40s
const DELAY_MIN_MS = 4_000;             // 4s mínimo entre envios
const DELAY_MAX_MS = 15_000;            // 15s máximo entre envios
const PAUSA_A_CADA = 10;                // Pausa extra a cada 10 envios (anti-burst)
const PAUSA_DURACAO_MS = 30_000;        // 30s de pausa extra

// ✅ FASE 2 — Guards anti-ban
const HORA_INICIO = 8;                  // 08h BRT
const HORA_FIM = 20;                    // 20h BRT
const LIMITE_DIARIO_INTEGRACAO = 150;   // Máx. msgs/dia por integração

// ✅ FASE 4 — Retry inteligente e pausa automática
const MAX_RETRIES = 3;                          // Máx 3 tentativas por item
const BACKOFF_BASE_MS = 5 * 60 * 1000;          // 5min → 15min → 45min (×3)
const PAUSA_RATELIMIT_MS = 30 * 60 * 1000;      // 30min de pausa se 429
const PAUSA_BLOQUEIO_MS = 2 * 60 * 60 * 1000;   // 2h se 403 (bloqueio da Meta)

// ✅ Detecta erros que exigem pausar a integração
function classificarErro(errorMsg) {
  const msg = String(errorMsg || '').toLowerCase();
  if (msg.includes('429') || msg.includes('rate') || msg.includes('too many')) {
    return { tipo: 'rate_limit', pausa: PAUSA_RATELIMIT_MS, retry: true };
  }
  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('blocked') || msg.includes('banned')) {
    return { tipo: 'bloqueio', pausa: PAUSA_BLOQUEIO_MS, retry: false };
  }
  if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('network')) {
    return { tipo: 'transiente', pausa: 0, retry: true };
  }
  return { tipo: 'permanente', pausa: 0, retry: false };
}

// ✅ Pausa integração (salva timestamp até quando está pausada)
async function pausarIntegracao(base44, integrationId, duracaoMs, motivo) {
  const pausadaAte = new Date(Date.now() + duracaoMs).toISOString();
  try {
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integrationId, {
      configuracoes_avancadas: {
        pausada_ate: pausadaAte,
        motivo_pausa: motivo,
        pausada_em: new Date().toISOString()
      }
    });
    console.warn(`[BROADCAST-WORKER] 🚫 Integração ${integrationId} PAUSADA até ${pausadaAte} (motivo: ${motivo})`);
  } catch (e) {
    console.error('[BROADCAST-WORKER] Falha ao pausar integração:', e.message);
  }
}

// ✅ Verifica se integração está pausada (não processa itens dela)
async function integracaoEstaPausada(base44, integrationId) {
  if (!integrationId) return false;
  try {
    const integ = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    const pausadaAte = integ?.configuracoes_avancadas?.pausada_ate;
    if (!pausadaAte) return false;
    return new Date(pausadaAte).getTime() > Date.now();
  } catch (_) {
    return false;
  }
}

// ✅ Delay humanizado (4-15s aleatório) — simula comportamento humano
function delayHumano() {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)) + DELAY_MIN_MS;
}

// ✅ Verifica se está dentro do horário comercial BRT (UTC-3)
function estaNoHorarioComercial() {
  const agoraBRT = new Date(Date.now() - 3 * 60 * 60 * 1000); // Converter UTC→BRT
  const hora = agoraBRT.getUTCHours();
  const dow = agoraBRT.getUTCDay(); // 0=dom, 6=sab
  if (dow === 0 || dow === 6) return false; // fim de semana
  return hora >= HORA_INICIO && hora < HORA_FIM;
}

// ✅ Calcula próximo slot válido (8h do próximo dia útil)
function proximoSlotValido() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000); // BRT
  d.setUTCDate(d.getUTCDate() + 1); // amanhã
  // Pular fim de semana
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  d.setUTCHours(HORA_INICIO, 0, 0, 0);
  return new Date(d.getTime() + 3 * 60 * 60 * 1000); // BRT→UTC
}

// ✅ Conta mensagens enviadas hoje por integração (anti-ban Meta)
async function contarEnviosDeHoje(base44, integrationId) {
  if (!integrationId) return 0;
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  try {
    const msgs = await base44.asServiceRole.entities.Message.filter({
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: { $gte: inicioHoje.toISOString() }
    });
    return msgs.filter(m => m.metadata?.whatsapp_integration_id === integrationId).length;
  } catch (e) {
    console.warn('[BROADCAST-WORKER] Erro contando envios do dia:', e.message);
    return 0;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
  const now = new Date();

  try {
    console.log('[BROADCAST-WORKER] ▶️ Iniciando processamento...');

    // ✅ FASE 2: Guard de horário comercial (adia para próximo dia útil)
    if (!estaNoHorarioComercial()) {
      const proximo = proximoSlotValido();
      console.log(`[BROADCAST-WORKER] ⏰ Fora do horário comercial (8h-20h seg-sex). Adiando para ${proximo.toISOString()}`);

      // Adiar todos os pendentes que já venceram para próximo slot
      const atrasados = await base44.asServiceRole.entities.WorkQueueItem.filter({
        tipo: 'enviar_broadcast_avulso',
        status: 'pendente',
        scheduled_for: { $lte: now.toISOString() }
      }, 'scheduled_for', 50);

      await Promise.all(atrasados.map(it =>
        base44.asServiceRole.entities.WorkQueueItem.update(it.id, {
          scheduled_for: proximo.toISOString(),
          metadata: { ...it.metadata, adiado_horario_comercial: true }
        }).catch(() => {})
      ));

      return Response.json({
        success: true,
        processados: 0,
        adiados: atrasados.length,
        motivo: 'fora_horario_comercial',
        proximo_slot: proximo.toISOString()
      });
    }

    // Buscar itens pendentes (ordenados por scheduled_for)
    const items = await base44.asServiceRole.entities.WorkQueueItem.filter(
      {
        tipo: 'enviar_broadcast_avulso',
        status: 'pendente',
        scheduled_for: { $lte: now.toISOString() }
      },
      'scheduled_for',
      LOTE_MAXIMO
    );

    if (!items.length) {
      console.log('[BROADCAST-WORKER] Fila vazia.');
      return Response.json({ success: true, processados: 0, pendentes: 0 });
    }

    console.log(`[BROADCAST-WORKER] ${items.length} itens na fila`);

    let processados = 0;
    let erros = 0;
    let interrompido = false;

    for (const item of items) {
      // ── Cronômetro interno (safe timeout) ───────────────────────────────
      if (Date.now() - _tsInicio > TIMEOUT_LIMITE_MS) {
        console.warn(`[BROADCAST-WORKER] ⚠️ Tempo limite atingido após ${processados} envios. Restante será processado na próxima execução.`);
        interrompido = true;
        break;
      }

      // ── Marcar como "processando" (evita duplo processamento) ────────────
      await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
        status: 'processando',
        metadata: { ...item.metadata, iniciado_em: new Date().toISOString() }
      }).catch(() => {});

      try {
        const { contact_id, payload } = item;
        const { integration_id, mensagem, media_url, media_type, media_caption, sender_id, broadcast_id } = payload;

        // ✅ FASE 4: Guard de integração pausada (429/403 recentes)
        if (await integracaoEstaPausada(base44, integration_id)) {
          console.warn(`[BROADCAST-WORKER] ⏸️ Integração ${integration_id} pausada. Reagendando +30min.`);
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'pendente',
            scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            metadata: { ...item.metadata, adiado_integracao_pausada: true }
          }).catch(() => {});
          continue;
        }

        // ✅ FASE 2: Limite diário por integração (anti-ban Meta)
        const enviosHoje = await contarEnviosDeHoje(base44, integration_id);
        if (enviosHoje >= LIMITE_DIARIO_INTEGRACAO) {
          console.warn(`[BROADCAST-WORKER] 🚫 Limite diário atingido para integração ${integration_id} (${enviosHoje}/${LIMITE_DIARIO_INTEGRACAO}). Adiando para amanhã.`);
          const proximo = proximoSlotValido();
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'pendente',
            scheduled_for: proximo.toISOString(),
            metadata: { ...item.metadata, adiado_limite_diario: true, limite: LIMITE_DIARIO_INTEGRACAO }
          }).catch(() => {});
          continue; // pula para próximo item
        }

        // Buscar contato
        const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
        if (!contato?.telefone) throw new Error('Contato sem telefone');

        // Buscar/criar thread canônica
        let threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id,
          is_canonical: true
        });
        let thread = threads[0];
        if (!thread) {
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id,
            is_canonical: true,
            channel: 'whatsapp',
            whatsapp_integration_id: integration_id,
            status: 'aberta'
          });
        }

        // Enviar via gateway
        const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id,
          numero_destino: contato.telefone,
          mensagem: mensagem || '',
          media_url: media_url || null,
          media_type: media_type || 'none',
          media_caption: media_caption || null
        });

        if (!respEnvio.data?.success) throw new Error(respEnvio.data?.error || 'Erro no gateway');

        const sentAt = new Date().toISOString();

        // Persistir mensagem
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: sender_id || 'system',
          sender_type: 'user',
          recipient_id: contact_id,
          recipient_type: 'contact',
          content: mensagem || '',
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: respEnvio.data.message_id,
          sent_at: sentAt,
          visibility: 'public_to_customer',
          media_url: media_url || null,
          media_type: media_type || 'none',
          media_caption: media_caption || null,
          metadata: {
            whatsapp_integration_id: integration_id,
            origem_campanha: 'broadcast_massa',
            broadcast_id: broadcast_id || null
          }
        });

        // Atualizar thread
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_content: `[Broadcast] ${(mensagem || '').substring(0, 80)}`,
          last_message_at: sentAt,
          last_outbound_at: sentAt,
          last_message_sender: 'user',
          last_human_message_at: sentAt,
          last_media_type: media_url ? media_type : 'none',
          whatsapp_integration_id: integration_id,
          pre_atendimento_ativo: false,
          metadata: {
            ultima_mensagem_origem: 'broadcast_massa',
            broadcast_data: {
              sent_at: sentAt,
              broadcast_id: broadcast_id || null
            }
          }
        });

        // Marcar item como processado
        await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
          status: 'processado',
          processed_at: sentAt
        });

        console.log(`[BROADCAST-WORKER] ✅ ${contato.nome} (${contato.telefone})`);
        processados++;

      } catch (error) {
        console.error(`[BROADCAST-WORKER] ❌ Item ${item.id}:`, error.message);

        // ✅ FASE 4: Classificar erro e decidir retry/pausa
        const classif = classificarErro(error.message);
        const tentativas = (item.metadata?.tentativas || 0) + 1;
        const integrationId = item.payload?.integration_id;

        // Pausar integração se for rate_limit ou bloqueio
        if (classif.pausa > 0 && integrationId) {
          await pausarIntegracao(base44, integrationId, classif.pausa, classif.tipo);
        }

        // Decidir se reagenda ou marca como erro definitivo
        if (classif.retry && tentativas < MAX_RETRIES) {
          const backoffMs = BACKOFF_BASE_MS * Math.pow(3, tentativas - 1); // 5min → 15min → 45min
          const proximaTentativa = new Date(Date.now() + backoffMs).toISOString();
          console.log(`[BROADCAST-WORKER] 🔄 Retry ${tentativas}/${MAX_RETRIES} em ${(backoffMs/60000).toFixed(0)}min (tipo: ${classif.tipo})`);
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'pendente',
            scheduled_for: proximaTentativa,
            metadata: {
              ...item.metadata,
              tentativas,
              ultimo_erro: error.message,
              ultimo_erro_tipo: classif.tipo,
              ultimo_erro_em: new Date().toISOString()
            }
          }).catch(() => {});
        } else {
          // Esgotou retries ou erro não retentável
          await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
            status: 'erro',
            metadata: {
              ...item.metadata,
              tentativas,
              erro: error.message,
              erro_tipo: classif.tipo,
              erro_em: new Date().toISOString()
            }
          }).catch(() => {});
        }
        erros++;
      }

      // ✅ Pausa extra a cada N envios (anti-burst detection Meta)
      if (processados > 0 && processados % PAUSA_A_CADA === 0) {
        console.log(`[BROADCAST-WORKER] ⏸️ Pausa anti-spam de ${PAUSA_DURACAO_MS/1000}s após ${processados} envios`);
        await new Promise(r => setTimeout(r, PAUSA_DURACAO_MS));
      }
      // ✅ Delay humanizado entre envios (4-15s aleatório, simula humano)
      const delay = delayHumano();
      console.log(`[BROADCAST-WORKER] ⏱️ Próximo envio em ${(delay/1000).toFixed(1)}s`);
      await new Promise(r => setTimeout(r, delay));
    }

    // Contar pendentes restantes
    const totalRestante = await base44.asServiceRole.entities.WorkQueueItem.filter({
      tipo: 'enviar_broadcast_avulso',
      status: 'pendente'
    }, 'scheduled_for', 1);

    const pendentes = totalRestante.length;

    console.log(`[BROADCAST-WORKER] Concluído: ${processados} ✅ | ${erros} ❌ | ${pendentes > 0 ? 'há mais pendentes' : 'fila limpa'}`);

    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'processar_fila_promocoes',
          triggered_by: 'automacao_agendada',
          execution_mode: 'autonomous_safe',
          context: {
            total_fila: items.length,
            lote_maximo: LOTE_MAXIMO,
            timeout_limite_ms: TIMEOUT_LIMITE_MS
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            processados,
            erros,
            interrompido,
            pendentes_restantes: pendentes,
            taxa_sucesso: processados > 0 ? ((processados - erros) / processados) * 100 : 0
          }
        });
      } catch (e) {
        console.warn('[processarFilaBroadcast] SkillExecution falhou (non-blocking):', e.message);
      }
    })();

    return Response.json({
      success: true,
      processados,
      erros,
      interrompido,
      pendentes_restantes: pendentes,
      duracao_ms: Date.now() - _tsInicio,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[BROADCAST-WORKER] ❌ ERRO GERAL:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});