// getTelemetriaPreAtendimento.js
// ============================================================================
// Agrega telemetria das 9 camadas do skillPreAtendimentos a partir do AutomationLog.
// Entrada: { horas?: number (default 24) }
// Saída: { kpis, camadas[1..9], pipelines_lentos[], distribuicao_status }
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403, headers });
    }

    const payload = await req.json().catch(() => ({}));
    const horas = Math.max(1, Math.min(168, Number(payload.horas) || 24));
    const desde = new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();

    // Busca todos os pipelines finalizados na janela
    const logs = await base44.asServiceRole.entities.AutomationLog.filter({
      acao: 'pipeline_primeiro_atendimento',
      timestamp: { $gte: desde }
    }, '-timestamp', 1000).catch(() => []);

    const totalPipelines = logs.length;

    // ─── KPIs gerais ───
    let totalSucesso = 0, totalErro = 0;
    let somaTempoTotal = 0;
    const distribuicaoStatusFinal = {};

    // ─── Agregação por camada (1..9) ───
    const camadasAgg = {};
    for (let n = 1; n <= 9; n++) {
      camadasAgg[n] = {
        camada: n,
        nome: NOMES_CAMADAS[n],
        execucoes: 0,
        soma_duracao_ms: 0,
        max_duracao_ms: 0,
        status_count: { ok: 0, skipped: 0, error: 0, routed_out: 0, not_executed: 0 }
      };
    }

    // ─── Top pipelines lentos ───
    const pipelinesDetalhe = [];

    for (const log of logs) {
      const tempoTotal = log.metadata?.tempo_execucao_ms || log.detalhes?.tempo_execucao_ms || 0;
      const telemetria = log.metadata?.telemetria || log.detalhes?.dados_contexto?.telemetria || {};
      const statusFinal = log.metadata?.status_final || log.detalhes?.dados_contexto?.status_final || 'desconhecido';

      somaTempoTotal += tempoTotal;
      distribuicaoStatusFinal[statusFinal] = (distribuicaoStatusFinal[statusFinal] || 0) + 1;
      if (log.resultado === 'sucesso') totalSucesso++;
      else if (log.resultado === 'erro') totalErro++;

      // Agrega por camada
      for (let n = 1; n <= 9; n++) {
        const entry = telemetria[`camada_${n}`];
        if (!entry || entry.status === 'not_executed') {
          camadasAgg[n].status_count.not_executed++;
          continue;
        }
        camadasAgg[n].execucoes++;
        const dur = Number(entry.duration_ms) || 0;
        camadasAgg[n].soma_duracao_ms += dur;
        if (dur > camadasAgg[n].max_duracao_ms) camadasAgg[n].max_duracao_ms = dur;
        const st = entry.status || 'not_executed';
        if (camadasAgg[n].status_count[st] !== undefined) {
          camadasAgg[n].status_count[st]++;
        } else {
          camadasAgg[n].status_count.not_executed++;
        }
      }

      pipelinesDetalhe.push({
        id: log.id,
        thread_id: log.thread_id,
        contato_id: log.contato_id,
        timestamp: log.timestamp,
        tempo_total_ms: tempoTotal,
        status_final: statusFinal,
        resultado: log.resultado,
        telemetria
      });
    }

    // Top 10 mais lentos
    const pipelinesLentos = [...pipelinesDetalhe]
      .sort((a, b) => b.tempo_total_ms - a.tempo_total_ms)
      .slice(0, 10);

    // Finaliza médias
    const camadas = Object.values(camadasAgg).map(c => ({
      ...c,
      duracao_media_ms: c.execucoes > 0 ? Math.round(c.soma_duracao_ms / c.execucoes) : 0
    }));

    return Response.json({
      horas,
      desde,
      kpis: {
        total_pipelines: totalPipelines,
        total_sucesso: totalSucesso,
        total_erro: totalErro,
        taxa_sucesso_pct: totalPipelines > 0 ? Math.round((totalSucesso / totalPipelines) * 100) : 0,
        tempo_medio_ms: totalPipelines > 0 ? Math.round(somaTempoTotal / totalPipelines) : 0
      },
      camadas,
      distribuicao_status_final: distribuicaoStatusFinal,
      pipelines_lentos: pipelinesLentos
    }, { headers });

  } catch (error) {
    console.error('[TELEMETRIA] erro:', error.message);
    return Response.json({ error: error.message }, { status: 500, headers });
  }
});

const NOMES_CAMADAS = {
  1: 'Roteamento direto (Agenda/Fiscal)',
  2: 'Contexto (humano ativo)',
  3: 'Dedup / Lock 30s',
  4: 'Micro-intents',
  5: 'ACK adaptativo',
  6: 'Intent detection',
  7: 'Qualificação (regras)',
  8: 'Roteamento (P1..P6)',
  9: 'Atribuição + boas-vindas'
};