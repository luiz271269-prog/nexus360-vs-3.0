// ============================================================================
// SKILL 04 — SLA GUARDIAN v2.1
// ============================================================================
// Objetivo: 3 níveis → 5min (aviso) → 10min (reatrib) → 15min (escalonamento)
// Cooldown via jarvis_next_check_after. Executado pelo jarvisEventLoop a cada 5min
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function enviarMsgWhatsApp(base44: any, integration_id: string, telefone: string, mensagem: string): Promise<boolean> {
  try {
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao?.instance_id_provider || !integracao?.api_key_provider) {
      return false;
    }

    const telefoneLimpo = (telefone || '').replace(/\D/g, '');
    const telefoneE164 = telefoneLimpo.startsWith('55') ? `+${telefoneLimpo}` : `+55${telefoneLimpo}`;

    const resp = await fetch(
      `https://api.z-api.io/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: telefoneE164, message: mensagem })
      }
    ).then(r => r.json());

    return resp?.success || false;
  } catch (e) {
    console.warn('[SLA] Erro envio WhatsApp:', (e as any).message);
    return false;
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

    // Buscar threads em fila SEM atendente
    const threadsFila = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      assigned_user_id: { $exists: false },
      status: 'aberta',
      entrou_na_fila_em: { $exists: true }
    }, '-entrou_na_fila_em', 50);

    const agora = Date.now();
    const resultados = {
      processadas: 0,
      avisos_5min: 0,
      reatribuicoes_10min: 0,
      escalonamentos_15min: 0,
      erros: 0
    };

    for (const thread of threadsFila) {
      try {
        // Guard: cooldown?
        if (thread.jarvis_next_check_after) {
          const proximaVerificacao = new Date(thread.jarvis_next_check_after).getTime();
          if (agora < proximaVerificacao) {
            continue; // pula este ciclo
          }
        }

        const enfiladoEm = new Date(thread.entrou_na_fila_em).getTime();
        const minutosNaFila = (agora - enfiladoEm) / (1000 * 60);

        const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);

        // NÍVEL 1: 5 minutos → aviso ao cliente
        if (minutosNaFila >= 5 && minutosNaFila < 10 && thread.jarvis_last_playbook !== 'nivel_1_aviso') {
          const msg1 = `⏳ Sua vez está chegando!\nEstamos procurando o melhor atendente para você. Obrigado pela paciência! 😊`;
          const enviouMsg = await enviarMsgWhatsApp(base44, thread.whatsapp_integration_id, contact.telefone, msg1);

          if (enviouMsg) {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              jarvis_last_playbook: 'nivel_1_aviso',
              jarvis_next_check_after: new Date(agora + 5 * 60 * 1000).toISOString()
            }).catch(() => {});

            resultados.avisos_5min++;
          }
        }

        // NÍVEL 2: 10 minutos → reatribuição automática
        if (minutosNaFila >= 10 && minutosNaFila < 15 && thread.jarvis_last_playbook !== 'nivel_2_reatrib') {
          // Buscar atendente de emergência (setor geral ou com menos carga)
          const usuarios = await base44.asServiceRole.entities.User.filter(
            { is_whatsapp_attendant: true },
            'current_conversations_count',
            10
          );

          if (usuarios?.length > 0) {
            const atendente = usuarios[0];
            const msg2 = `✅ ${(contact.nome || '').split(' ')[0]}! Você será atendido por ${atendente.full_name} agora mesmo! 👋`;
            const enviouMsg = await enviarMsgWhatsApp(base44, thread.whatsapp_integration_id, contact.telefone, msg2);

            if (enviouMsg) {
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                assigned_user_id: atendente.id,
                routing_stage: 'ASSIGNED',
                jarvis_last_playbook: 'nivel_2_reatrib',
                jarvis_next_check_after: new Date(agora + 30 * 60 * 1000).toISOString(),
                atendentes_historico: [atendente.id]
              }).catch(() => {});

              resultados.reatribuicoes_10min++;
            }
          }
        }

        // NÍVEL 3: 15 minutos → escalonamento + notificação supervisor
        if (minutosNaFila >= 15 && thread.jarvis_last_playbook !== 'nivel_3_escalacao') {
          const msg3 = `🚨 Desculpe pela demora! Um supervisor foi notificado. Você será atendido em breve. Obrigado! 🙏`;
          await enviarMsgWhatsApp(base44, thread.whatsapp_integration_id, contact.telefone, msg3).catch(() => {});

          // Criar WorkQueueItem de escalonamento
          await base44.asServiceRole.entities.WorkQueueItem.create({
            contact_id: thread.contact_id,
            thread_id: thread.id,
            tipo: 'manual',
            reason: 'sla_15min_escalacao',
            severity: 'critical',
            status: 'open',
            notes: `⚠️ SLA CRÍTICO: ${contact.nome} aguardando há ${Math.round(minutosNaFila)} minutos!\nSetor: ${thread.sector_id}\nNecessário escalonamento IMEDIATO.`
          }).catch(() => {});

          // Notificar gerentes/supervisores
          const gerentes = await base44.asServiceRole.entities.User.filter(
            { attendant_role: { $in: ['gerente', 'coordenador', 'senior'] } },
            '-created_date',
            5
          ).catch(() => []);

          for (const gerente of gerentes) {
            try {
              await base44.asServiceRole.functions.invoke('sendInternalMessage', {
                thread_id: 'thread_notificacoes_gerencia',
                content: `🚨 SLA CRÍTICO: ${contact.nome} na fila há ${Math.round(minutosNaFila)}min. Thread: ${thread.id}`,
                sender_id: 'skill_sla_guardian'
              }).catch(() => {});
            } catch (e) {
              // silencioso
            }
          }

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            jarvis_last_playbook: 'nivel_3_escalacao',
            jarvis_next_check_after: new Date(agora + 60 * 60 * 1000).toISOString()
          }).catch(() => {});

          resultados.escalonamentos_15min++;
        }

        resultados.processadas++;

      } catch (e) {
        console.error('[SLA] Erro ao processar thread:', (e as any).message);
        resultados.erros++;
      }
    }

    return Response.json({
      success: true,
      resultados,
      duration_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[SLA] Erro geral:', error);
    return Response.json(
      { success: false, error: (error as any).message },
      { status: 500, headers }
    );
  }
});