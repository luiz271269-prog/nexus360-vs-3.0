import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Zap, Clock, AlertCircle, Calendar } from 'lucide-react';

// Custo estimado por tipo de operação (em créditos Base44)
const CUSTO_POR_EXECUCAO = {
  'webhook_zapi_inbound': { queries: 8, llm: 0, label: 'Webhook Z-API' },
  'primeiro_contato_autonomo': { queries: 12, llm: 1, label: 'Resgate Primeiro Contato' },
  'skill_ack_imediato': { queries: 4, llm: 0.5, label: 'ACK Imediato' },
  'skill_intent_router': { queries: 3, llm: 1, label: 'Intent Router' },
  'skill_queue_manager': { queries: 6, llm: 0.5, label: 'Queue Manager' },
  'skill_sla_guardian': { queries: 5, llm: 0, label: 'SLA Guardian' },
  'jarvis_event_loop': { queries: 10, llm: 2, label: 'Loop Jarvis' },
  'processarFilaPromocoes': { queries: 8, llm: 1, label: 'Fila Promoções' },
  'gerarTarefasDeAnalise': { queries: 6, llm: 2, label: 'Gerar Tarefas IA' },
  'analiseCruzadaClientes': { queries: 10, llm: 3, label: 'Análise Cruzada' },
  'watchdog_idle_contacts': { queries: 8, llm: 0, label: 'Watchdog Idle' },
  'analisarClientesEmLote': { queries: 12, llm: 3, label: 'Análise Clientes Lote' },
};

const CUSTO_QUERY = 0.001; // créditos por query
const CUSTO_LLM_CALL = 0.05; // créditos por chamada LLM

function calcularCusto(skillName, execucoes) {
  const cfg = CUSTO_POR_EXECUCAO[skillName] || { queries: 5, llm: 0, label: skillName };
  const custoQueries = execucoes * cfg.queries * CUSTO_QUERY;
  const custoLLM = execucoes * cfg.llm * CUSTO_LLM_CALL;
  return {
    label: cfg.label,
    custoQueries: +custoQueries.toFixed(4),
    custoLLM: +custoLLM.toFixed(4),
    custoTotal: +(custoQueries + custoLLM).toFixed(4),
  };
}

function formatCusto(v) {
  if (v >= 1) return v.toFixed(2) + ' cr';
  return v.toFixed(4) + ' cr';
}

export default function CustoAutomacoes() {
  const [periodo, setPeriodo] = useState('mes'); // 'hoje' | 'semana' | 'mes'
  const [execucoes, setExecucoes] = useState([]);
  const [llmMetrics, setLLMMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  const dataInicio = useMemo(() => {
    const d = new Date();
    if (periodo === 'hoje') { d.setHours(0, 0, 0, 0); }
    else if (periodo === 'semana') { d.setDate(d.getDate() - 7); }
    else { d.setDate(1); d.setHours(0, 0, 0, 0); }
    return d.toISOString();
  }, [periodo]);

  async function carregarDados() {
    setLoading(true);
    try {
      const [execs, llm] = await Promise.all([
        base44.entities.SkillExecution.filter(
          { created_date: { $gte: dataInicio } },
          '-created_date',
          500
        ).catch(() => []),
        base44.entities.IAUsageMetric.filter(
          { timestamp: { $gte: dataInicio } },
          '-timestamp',
          500
        ).catch(() => []),
      ]);
      setExecucoes(execs);
      setLLMMetrics(llm);
    } finally {
      setLoading(false);
    }
  }

  // Agrupar execuções por skill_name
  const porSkill = useMemo(() => {
    const map = {};
    for (const e of execucoes) {
      const key = e.skill_name || 'desconhecido';
      if (!map[key]) map[key] = { total: 0, sucesso: 0, falha: 0, durTotal: 0 };
      map[key].total++;
      if (e.success) map[key].sucesso++; else map[key].falha++;
      map[key].durTotal += e.duration_ms || 0;
    }
    return map;
  }, [execucoes]);

  // Custo real de LLM por função (de IAUsageMetric)
  const custoLLMReal = useMemo(() => {
    const map = {};
    for (const m of llmMetrics) {
      const key = m.funcao || 'outro';
      if (!map[key]) map[key] = 0;
      map[key] += m.custo_estimado_usd || 0;
    }
    return map;
  }, [llmMetrics]);

  // Tabela resumo por skill
  const resumoSkills = useMemo(() => {
    return Object.entries(porSkill)
      .map(([skill, stats]) => {
        const custo = calcularCusto(skill, stats.total);
        return {
          skill,
          label: custo.label,
          execucoes: stats.total,
          sucesso: stats.sucesso,
          falha: stats.falha,
          durMedia: stats.total > 0 ? Math.round(stats.durTotal / stats.total) : 0,
          custoTotal: custo.custoTotal,
          custoQueries: custo.custoQueries,
          custoLLM: custo.custoLLM,
        };
      })
      .sort((a, b) => b.custoTotal - a.custoTotal);
  }, [porSkill]);

  const totalCusto = resumoSkills.reduce((s, r) => s + r.custoTotal, 0);
  const totalExecucoes = resumoSkills.reduce((s, r) => s + r.execucoes, 0);

  // Dados para gráfico diário
  const dadosDiario = useMemo(() => {
    const map = {};
    for (const e of execucoes) {
      const dia = e.created_date?.substring(0, 10);
      if (!dia) continue;
      if (!map[dia]) map[dia] = {};
      const key = e.skill_name || 'outro';
      const cfg = CUSTO_POR_EXECUCAO[key] || { queries: 5, llm: 0 };
      const custo = (cfg.queries * CUSTO_QUERY) + (cfg.llm * CUSTO_LLM_CALL);
      map[dia]['total'] = (map[dia]['total'] || 0) + custo;
      map[dia]['execucoes'] = (map[dia]['execucoes'] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, v]) => ({ dia: dia.substring(5), ...v, total: +v['total'].toFixed(4) }));
  }, [execucoes]);

  const periodoLabel = { hoje: 'Hoje', semana: 'Últimos 7 dias', mes: 'Este mês' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            Custo por Automação
          </h1>
          <p className="text-sm text-slate-500 mt-1">Análise de créditos consumidos por cada skill/automação</p>
        </div>
        <div className="flex gap-2">
          {['hoje', 'semana', 'mes'].map(p => (
            <Button
              key={p}
              size="sm"
              variant={periodo === p ? 'default' : 'outline'}
              onClick={() => setPeriodo(p)}
            >
              {periodoLabel[p]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{formatCusto(totalCusto)}</div>
                <div className="text-xs text-slate-500 mt-1">Custo total estimado</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{totalExecucoes.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Total de execuções</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">{llmMetrics.length}</div>
                <div className="text-xs text-slate-500 mt-1">Chamadas LLM registradas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">
                  {resumoSkills.reduce((s, r) => s + r.falha, 0)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Execuções com falha</div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico diário */}
          {dadosDiario.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Custo diário (créditos estimados)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosDiario}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [formatCusto(v), 'Custo']} />
                    <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela por skill */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4" /> Detalhamento por Automação — {periodoLabel[periodo]}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs text-slate-600">
                      <th className="text-left px-4 py-3">Automação</th>
                      <th className="text-right px-4 py-3">Execuções</th>
                      <th className="text-right px-4 py-3">Falhas</th>
                      <th className="text-right px-4 py-3">Dur. Média</th>
                      <th className="text-right px-4 py-3">Custo Queries</th>
                      <th className="text-right px-4 py-3">Custo LLM</th>
                      <th className="text-right px-4 py-3 font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoSkills.map((r, i) => (
                      <tr key={r.skill} className={`border-b hover:bg-slate-50 ${i === 0 ? 'bg-orange-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{r.label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{r.skill}</div>
                        </td>
                        <td className="text-right px-4 py-3 font-semibold">{r.execucoes.toLocaleString()}</td>
                        <td className="text-right px-4 py-3">
                          {r.falha > 0 ? (
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">{r.falha}</Badge>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3 text-slate-500 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />{r.durMedia > 1000 ? (r.durMedia / 1000).toFixed(1) + 's' : r.durMedia + 'ms'}
                        </td>
                        <td className="text-right px-4 py-3 text-blue-600">{formatCusto(r.custoQueries)}</td>
                        <td className="text-right px-4 py-3 text-purple-600">{formatCusto(r.custoLLM)}</td>
                        <td className="text-right px-4 py-3 font-bold text-orange-600">{formatCusto(r.custoTotal)}</td>
                      </tr>
                    ))}
                    {resumoSkills.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          Nenhuma execução encontrada para o período
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {resumoSkills.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-slate-50 font-bold">
                        <td className="px-4 py-3 text-slate-700">TOTAL</td>
                        <td className="text-right px-4 py-3">{totalExecucoes.toLocaleString()}</td>
                        <td colSpan={3} />
                        <td className="text-right px-4 py-3 text-purple-700">
                          {formatCusto(resumoSkills.reduce((s, r) => s + r.custoLLM, 0))}
                        </td>
                        <td className="text-right px-4 py-3 text-orange-700 text-base">
                          {formatCusto(totalCusto)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-400 text-center">
            * Custos estimados com base em queries/chamadas por execução. Valores reais podem variar conforme volume de dados.
          </p>
        </>
      )}
    </div>
  );
}