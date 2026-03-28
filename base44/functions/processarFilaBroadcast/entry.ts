import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// WORKER DE BROADCAST - Processa WorkQueueItems do tipo 'enviar_broadcast_avulso'
// ============================================================================
// Roda a cada 5 minutos via automação agendada
// Lote seguro: máx 20 por execução com cronômetro interno (25s máx)
// Delay de 1.2s entre envios = ~16 msgs/min (seguro para WhatsApp)
// ============================================================================

const LOTE_MAXIMO = 20;
const TIMEOUT_LIMITE_MS = 25_000; // 25s - margem para Edge Function de 40s
const DELAY_ENTRE_ENVIOS_MS = 1_200; // 1.2s anti-rate-limit

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
  const now = new Date();

  try {
    console.log('[BROADCAST-WORKER] ▶️ Iniciando processamento...');

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
      if (Date.now() - inicio > TIMEOUT_LIMITE_MS) {
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
        await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
          status: 'erro',
          metadata: { ...item.metadata, erro: error.message, erro_em: new Date().toISOString() }
        }).catch(() => {});
        erros++;
      }

      // Delay anti-rate-limit entre envios
      await new Promise(r => setTimeout(r, DELAY_ENTRE_ENVIOS_MS));
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