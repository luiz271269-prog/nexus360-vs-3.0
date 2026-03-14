// ============================================================================
// SKILL 4 — SLA GUARDIAN v2.0
// Objetivo: ZERO conversas esquecidas
// Roda: Via automacao agendada (5 minutos)
// Thresholds: 5min aviso | 10min reatribuicao | 15min escalar
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  const agora = new Date();
  const resultados = {
    processadas: 0,
    avisos: 0,
    reatribuicoes: 0,
    escalados: 0,
    erros: 0
  };

  try {
    // Buscar threads aguardando (sem assigned_user_id)
    const threadsAguardando = await base44.asServiceRole.entities.MessageThread.filter(
      {
        status: 'aberta',
        thread_type: 'contact_external',
        assigned_user_id: null
      },
      '-last_inbound_at',
      50
    ).catch(() => []);

    for (const thread of threadsAguardando) {
      try {
        // Guard: sem mensagem do contato
        if (!thread.last_inbound_at) continue;

        // Guard: cooldown Jarvis
        if (thread.jarvis_next_check_after) {
          if (agora < new Date(thread.jarvis_next_check_after)) continue;
        }

        const minutosEsperando = (agora - new Date(thread.last_inbound_at)) / 60000;
        const contato = await base44.asServiceRole.entities.Contact
          .get(thread.contact_id)
          .catch(() => null);

        if (!contato) continue;

        const primeiroNome = (contato.nome || 'cliente').split(' ')[0];
        const setor = thread.sector_id || 'vendas';

        // Buscar integracao
        const integracaoData = thread.whatsapp_integration_id
          ? await base44.asServiceRole.entities.WhatsAppIntegration
              .get(thread.whatsapp_integration_id)
              .catch(() => null)
          : null;

        const telefoneLimpo = (contato.telefone || '').replace(/\D/g, '');
        const telefoneE164 = telefoneLimpo.startsWith('55')
          ? `+${telefoneLimpo}`
          : `+55${telefoneLimpo}`;

        const enviarMsg = async (msg) => {
          if (!integracaoData?.instance_id) return;
          await fetch(
            `https://api.z-api.io/instances/${integracaoData.instance_id}/token/${integracaoData.api_key_provider}/send-text`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: telefoneE164, message: msg })
            }
          ).catch(() => null);

          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'nexus_agent',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: msg,
            channel: 'whatsapp',
            status: 'enviada',
            sent_at: new Date().toISOString(),
            visibility: 'public_to_customer'
          }).catch(() => null);
        };

        // NIVEL 1: 5min - Aviso
        if (minutosEsperando >= 5 && minutosEsperando < 10) {
          await enviarMsg(
            `Ola, ${primeiroNome}! Pedimos desculpas pela espera.\nEquipe de ${setor} esta finalizando e te responde em instantes!`
          );

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            jarvis_alerted_at: agora.toISOString(),
            jarvis_next_check_after: new Date(agora.getTime() + 5 * 60000).toISOString(),
            jarvis_last_playbook: 'sla_nivel_1_aviso'
          });

          resultados.avisos++;
        }

        // NIVEL 2: 10min - Reatribuicao
        else if (minutosEsperando >= 10 && minutosEsperando < 15) {
          const usuarios = await base44.asServiceRole.entities.User.filter(
            { attendant_sector: setor },
            null,
            10
          ).catch(() => []);

          const cargas = await Promise.all(
            usuarios.map(async (u) => {
              const ativas = await base44.asServiceRole.entities.MessageThread.filter(
                { assigned_user_id: u.id, status: 'aberta' },
                null,
                100
              ).catch(() => []);
              return { u, carga: ativas.length };
            })
          );

          cargas.sort((a, b) => a.carga - b.carga);
          const melhorAtendente = cargas[0]?.u;

          if (melhorAtendente) {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              assigned_user_id: melhorAtendente.id,
              routing_stage: 'ASSIGNED',
              jarvis_alerted_at: agora.toISOString(),
              jarvis_next_check_after: new Date(agora.getTime() + 60 * 60000).toISOString(),
              jarvis_last_playbook: 'sla_nivel_2_reatribuicao'
            });

            await enviarMsg(
              `Ola, ${primeiroNome}! Conectamos ao atendente ${melhorAtendente.full_name} que te ajuda em instantes!`
            );

            resultados.reatribuicoes++;
          }
        }

        // NIVEL 3: 15min - Escalar supervisor
        else if (minutosEsperando >= 15) {
          const sectorThread = await base44.asServiceRole.entities.MessageThread.filter(
            { thread_type: 'sector_group', sector_key: `sector:${setor}` },
            '-created_date',
            1
          ).catch(() => []);

          if (sectorThread[0]?.id) {
            await base44.asServiceRole.entities.Message.create({
              thread_id: sectorThread[0].id,
              sender_id: 'nexus_agent',
              sender_type: 'user',
              content: `ESCALONAMENTO SLA: ${contato.nome} aguardando ${Math.round(minutosEsperando)}min. Thread: ${thread.id.slice(-8)}`,
              channel: 'interno',
              visibility: 'internal_only'
            }).catch(() => null);
          }

          await enviarMsg(
            `Ola, ${primeiroNome}! Percebemos a espera prolongada. Supervisor foi notificado. Obrigado!`
          );

          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'manual',
            contact_id: contato.id,
            thread_id: thread.id,
            reason: 'urgente',
            severity: 'critical',
            owner_sector_id: setor,
            status: 'open',
            notes: `SLA CRITICO: ${Math.round(minutosEsperando)}min. Escalonado.`
          }).catch(() => null);

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            jarvis_alerted_at: agora.toISOString(),
            jarvis_next_check_after: new Date(agora.getTime() + 120 * 60000).toISOString(),
            jarvis_last_playbook: 'sla_nivel_3_escalonamento'
          });

          resultados.escalados++;
        }

        resultados.processadas++;

      } catch (e) {
        console.error('[SLA] Erro thread:', e.message);
        resultados.erros++;
      }
    }

    return Response.json({
      success: true,
      ...resultados,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('[SLA] Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});