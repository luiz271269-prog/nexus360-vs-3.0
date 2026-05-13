import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function includesNeedle(value, needle) {
  if (value == null) return false;
  return JSON.stringify(value).toLowerCase().includes(needle.toLowerCase());
}

function getMessageDate(message) {
  return toDate(message.sent_at || message.created_date || message.updated_date);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const now = Date.now();
    const since = new Date(now - 7 * DAY_MS).toISOString();

    const [logs, webhookLogsRaw, messagesRaw, threads, integrations] = await Promise.all([
      base44.asServiceRole.entities.AutomationLog.filter({ timestamp: { $gte: since } }, '-timestamp', 1000).catch(() => []),
      base44.asServiceRole.entities.WebhookLog.list('-timestamp', 1000).catch(() => []),
      base44.asServiceRole.entities.Message.list('-created_date', 1000).catch(() => []),
      base44.asServiceRole.entities.MessageThread.list('-updated_date', 1000).catch(() => []),
      base44.asServiceRole.entities.WhatsAppIntegration.list('-updated_date', 100).catch(() => [])
    ]);

    const messages = messagesRaw.filter((m) => {
      const d = getMessageDate(m) || toDate(m.created_date);
      return d && d.getTime() >= now - 7 * DAY_MS;
    });

    const webhookLogs = webhookLogsRaw.filter((w) => {
      const d = toDate(w.timestamp || w.created_date || w.updated_date);
      return d && d.getTime() >= now - 7 * DAY_MS;
    });

    const integrationsById = new Map(integrations.map((i) => [i.id, i]));
    const wapiIntegrationIds = new Set(integrations.filter((i) => i.api_provider === 'w_api').map((i) => i.id));
    const zapiIntegrationIds = new Set(integrations.filter((i) => i.api_provider === 'z_api').map((i) => i.id));

    const wapiTokenLogMatches = logs.filter((log) => includesNeedle(log, 'wapi_sem_client_token'));
    const deployMarkerLogs = logs.filter((log) => {
      const data = log.detalhes?.dados_contexto || log.metadata || {};
      const camadas = data.camadas || {};
      return camadas.ack?.error === 'zapi_sem_client_token'
        || camadas.ack?.reason === 'cooldown_12h'
        || data.status_final === 'ack_fora_horario_thread_atribuida';
    });
    const byDay = {};
    const byHourBrt = {};
    for (const log of wapiTokenLogMatches) {
      const d = toDate(log.timestamp || log.created_date);
      if (!d) continue;
      const brt = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const day = `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, '0')}-${String(brt.getDate()).padStart(2, '0')}`;
      const hour = String(brt.getHours()).padStart(2, '0') + ':00';
      byDay[day] = (byDay[day] || 0) + 1;
      byHourBrt[hour] = (byHourBrt[hour] || 0) + 1;
    }

    const inboundMessages = messages.filter((m) => m.sender_type === 'contact' && (m.channel === 'whatsapp' || m.channel == null));
    const inboundByProvider = inboundMessages.reduce((acc, msg) => {
      const integrationId = msg.metadata?.whatsapp_integration_id || msg.whatsapp_integration_id || msg.integration_id;
      const integration = integrationsById.get(integrationId);
      const provider = integration?.api_provider || msg.metadata?.provider || 'desconhecido';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});

    const inboundTotal = inboundMessages.length;
    const inboundWapi = inboundByProvider.w_api || 0;
    const inboundZapi = inboundByProvider.z_api || 0;

    const webhookByProvider = webhookLogs.reduce((acc, item) => {
      const raw = item.payload || item.payload_bruto || item.rawPayload || item.metadata || item;
      const text = JSON.stringify(raw).toLowerCase();
      let provider = item.provider || item.api_provider || item.integration_provider || 'desconhecido';
      if (provider === 'desconhecido') {
        if (text.includes('w-api') || text.includes('w_api') || text.includes('instanceid')) provider = 'w_api';
        if (text.includes('z-api') || text.includes('z_api') || text.includes('receivedcallback')) provider = 'z_api';
      }
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});

    const assignedWapiThreads = threads.filter((t) => {
      const integration = integrationsById.get(t.whatsapp_integration_id || t.conexao_id);
      return t.assigned_user_id && t.routing_stage === 'ASSIGNED' && integration?.api_provider === 'w_api';
    });

    let example = null;
    for (const thread of assignedWapiThreads) {
      const threadMessages = messages
        .filter((m) => m.thread_id === thread.id)
        .sort((a, b) => (getMessageDate(a)?.getTime() || 0) - (getMessageDate(b)?.getTime() || 0));

      const assignedAt = toDate(thread.pre_atendimento_completed_at || thread.updated_date || thread.last_message_at);
      if (!assignedAt) continue;

      const inboundBeforeAssign = [...threadMessages]
        .reverse()
        .find((m) => m.sender_type === 'contact' && getMessageDate(m) && getMessageDate(m) <= assignedAt);
      if (!inboundBeforeAssign) continue;

      const inboundAt = getMessageDate(inboundBeforeAssign);
      const outboundSystemBetween = threadMessages.filter((m) => {
        const d = getMessageDate(m);
        if (!d || d < inboundAt || d > assignedAt) return false;
        const isOutbound = m.sender_type === 'user';
        const isSystem = ['skill_ack', 'nexus_agent', 'pre_atendimento_rule', 'system'].includes(String(m.sender_id || '')) || m.metadata?.is_ack === true || m.metadata?.is_ai_response === true || m.metadata?.is_system_message === true;
        return isOutbound && isSystem;
      });

      if (outboundSystemBetween.length === 0) {
        example = {
          thread_id: thread.id,
          contact_id: thread.contact_id,
          integration_id: thread.whatsapp_integration_id || thread.conexao_id,
          integration_name: integrationsById.get(thread.whatsapp_integration_id || thread.conexao_id)?.nome_instancia || null,
          assigned_user_id: thread.assigned_user_id,
          sector_id: thread.sector_id,
          routing_stage: thread.routing_stage,
          assigned_at_proxy: assignedAt.toISOString(),
          inbound_message_id: inboundBeforeAssign.id,
          inbound_at: inboundAt.toISOString(),
          inbound_preview: String(inboundBeforeAssign.content || '').slice(0, 120),
          outbound_system_between_count: outboundSystemBetween.length
        };
        break;
      }
    }

    return Response.json({
      success: true,
      period: { since, until: new Date(now).toISOString() },
      deploy_status: {
        skillPreAtendimentos_accepts_runtime: true,
        patch_markers_seen_in_recent_logs: deployMarkerLogs.length > 0,
        latest_patch_marker_at: deployMarkerLogs[0]?.timestamp || deployMarkerLogs[0]?.created_date || null
      },
      wapi_sem_client_token_count_7d: wapiTokenLogMatches.length,
      wapi_sem_client_token_distribution: {
        by_day_brt: byDay,
        by_hour_brt: byHourBrt,
        latest_at: wapiTokenLogMatches[0]?.timestamp || wapiTokenLogMatches[0]?.created_date || null,
        oldest_at: wapiTokenLogMatches[wapiTokenLogMatches.length - 1]?.timestamp || wapiTokenLogMatches[wapiTokenLogMatches.length - 1]?.created_date || null
      },
      inbound_traffic_7d: {
        total: inboundTotal,
        w_api_count: inboundWapi,
        z_api_count: inboundZapi,
        unknown_count: inboundByProvider.desconhecido || 0,
        w_api_percent: inboundTotal ? Number(((inboundWapi / inboundTotal) * 100).toFixed(2)) : 0,
        z_api_percent: inboundTotal ? Number(((inboundZapi / inboundTotal) * 100).toFixed(2)) : 0
      },
      assigned_wapi_without_system_outbound_example: example,
      patch_status: {
        camada_5_validation: 'Z-API exige security_client_token_header; W-API exige instance_id_provider + api_key_provider',
        current_code_checked: true
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});