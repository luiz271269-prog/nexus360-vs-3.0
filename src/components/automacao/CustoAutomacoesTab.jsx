import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Zap, Clock, AlertTriangle } from 'lucide-react';

// Configuração de custo estimado por automação (queries + LLM por execução)
const CONFIG_CUSTO = {
  'primeiro_contato_autonomo':  { label: '🔴 Resgate Primeiro Contato',  queries: 12, llm: 1,   freq: '15min' },
  'gerarTarefasDeAnalise':      { label: '🟡 Gerar Tarefas IA',          queries: 6,  llm: 2,   freq: 'Seg/Qua/Sex 12h' },
  'jarvis_event_loop':          { label: '🟡 Loop Jarvis',               queries: 10, llm: 2,   freq: 'Seg/Qua/Sex 12h' },
  'processarFilaPromocoes':     { label: '🟡 Processar Fila Promoções',  queries: 8,  llm: 1,   freq: 'Seg/Qua/Sex 10h' },
  'analiseCruzadaClientes':     { label: '🟢 Análise Cruzada Clientes',  queries: 10, llm: 3,   freq: '1x/dia 09h' },
  'resumoComprasDiario':        { label: '🟢 Resumo Compras Diário',     queries: 5,  llm: 2,   freq: 'Seg/Qua/Sex 10h' },
  'analisarClientesEmLote':     { label: '🟢 Análise Semanal Contatos',  queries: 12, llm: 3,   freq: 'Seg/Ter 09h' },
  'watchdog_idle_contacts':     { label: '🟢 Watchdog Idle',             queries: 8,  llm: 0,   freq: 'Seg/Qui 12h' },
  'webhook_zapi_inbound':       { label: '📥 Webhook Z-API',             queries: 8,  llm: 0,   freq: 'por mensagem' },
  'skill_ack_imediato':         { label: '⚡ ACK Imediato',              queries: 4,  llm: 0.5, freq: 'por contato' },
  'skill_intent_router':        { label: '🧭 Intent Router',            queries: 3,  llm: 1,   freq: 'por contato' },
  'skill_queue_manager':        { label: '📋 Queue Manager',            queries: 6,  llm: 0.5, freq: 'por contato' },
};

const CUSTO_QUERY = 0.001;  // crédito por query
const CUSTO_LLM   = 0.05;   // crédito por chamada LLM

function custoUnitario(key) {
  const c = CONFIG_CUSTO[key] || { queries: 5, llm: 0 };
  return c.queries * CUSTO_QUERY + c.llm * CUSTO_LLM;
}

function fmt(v) {
  return v >= 1 ? v.toFixed(2) : v.toFixed(4);
}

const PERIODOS = { hoje: 'Hoje', semana: 'Esta semana', mes: 'Este mês', total: 'Nov → Hoje' };

export default function CustoAutomacoesTab() {
  const [periodo, setPeriodo] = useState('mes');
  const [execucoes, setExecucoes] = useState([]);
  const [loading, setLoading] = useState(true);

  const desde = useMemo(() => {
    const d = new Date();
    if (periodo === 'hoje') { d.setHours(0, 0, 0, 0); }
    else if (periodo === 'semana') { d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); }
    else if (periodo === 'mes') { d.setDate(1); d.setHours(0, 0, 0, 0); }
    else { d.setFullYear(2025, 10, 1); d.setHours(0, 0, 0, 0); } // Nov 2025
    return d.toISOString();
  }, [periodo]);

  useEffect(() => {
    setLoading(true);
    const filtroData = { created_date: { $gte: desde } };
    Promise.all([
      base44.entities.SkillExecution.filter(filtroData, '-created_date', 1000).catch(() => []),
      base44.entities.AutomationLog.filter({ timestamp: { $gte: desde }, origem: 'cron' }, '-timestamp', 1000).catch(() => []),
    ]).then(([skills, logs]) => {
      // Normalizar AutomationLog para o mesmo formato
      const logsNorm = logs.map(l => ({
        skill_name: l.detalhes?.funcao || l.metadata?.funcao || l.acao || 'outro',
        success: l.resultado === 'sucesso',
        created_date: l.timestamp,
      }));
      setExecucoes([...skills, ...logsNorm]);
      setLoading(false);
    });
  }, [desde]);

  // Mapeamento de nomes alternativos para chave canônica
  const ALIAS = {
    'follow_up_automatico': 'processarFilaPromocoes',
    'roteamento_lead': 'primeiro_contato_autonomo',
    'resposta_ia': 'skill_intent_router',
    'qualificacao_automatica': 'gerarTarefasDeAnalise',
  };

  // Agrupamento por skill_name
  const porSkill = useMemo(() => {
    const map = {};
    for (const e of execucoes) {
      const raw = e.skill_name || 'outro';
      const k = ALIAS[raw] || raw;
      if (!map[k]) map[k] = { total: 0, falha: 0 };
      map[k].total++;
      if (!e.success) map[k].falha++;
    }
    return map;
  }, [execucoes]);

  const rows = useMemo(() =>
    Object.entries(porSkill)
      .map(([skill, s]) => {
        const cfg = CONFIG_CUSTO[skill] || { label: skill, queries: 5, llm: 0, freq: '?' };
        const custo = s.total * custoUnitario(skill);
        return { skill, label: cfg.label, freq: cfg.freq, total: s.total, falha: s.falha, custo };
      })
      .sort((a, b) => b.custo - a.custo)
  , [porSkill]);

  const totalCusto = rows.reduce((s, r) => s + r.custo, 0);
  const totalExec  = rows.reduce((s, r) => s + r.total, 0);

  // Gráfico diário
  const diario = useMemo(() => {
    const map = {};
    for (const e of execucoes) {
      const dia = (e.created_date || e.timestamp)?.substring(0, 10);
      if (!dia) continue;
      if (!map[dia]) map[dia] = 0;
      map[dia] += custoUnitario(e.skill_name || 'outro');
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, custo]) => ({ dia: dia.substring(5), custo: +custo.toFixed(4) }));
  }, [execucoes]);

  return (
    <div className="space-y-6 py-2">
      {/* Filtro período */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          Custo de Créditos por Automação
        </h3>
        <div className="flex gap-2">
          {Object.entries(PERIODOS).map(([k, v]) => (
            <Button key={k} size="sm" variant={periodo === k ? 'default' : 'outline'}
              onClick={() => setPeriodo(k)} className="h-7 text-xs px-3">
              {v}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-orange-400" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-600">{fmt(totalCusto)} cr</div>
              <div className="text-xs text-slate-500 mt-0.5">Custo estimado — {PERIODOS[periodo].toLowerCase()}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600">{totalExec.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-0.5">Execuções totais</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="text-2xl font-bold text-red-600">
                {rows.reduce((s, r) => s + r.falha, 0)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Execuções com falha</div>
            </div>
          </div>

          {/* Gráfico diário */}
          {diario.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-600 mb-3">Evolução diária (créditos)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={diario}>
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v) => [fmt(v) + ' cr', 'Custo']} />
                  <Bar dataKey="custo" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs text-slate-500">
                  <th className="text-left px-4 py-3">Automação</th>
                  <th className="text-center px-3 py-3">Frequência</th>
                  <th className="text-right px-3 py-3">Execuções</th>
                  <th className="text-right px-3 py-3">Falhas</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-700">Custo (cr)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.skill} className={`border-b hover:bg-slate-50 ${i === 0 ? 'bg-orange-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 text-sm">{r.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.skill}</div>
                    </td>
                    <td className="text-center px-3 py-3">
                      <Badge variant="outline" className="text-[10px] px-1.5">{r.freq}</Badge>
                    </td>
                    <td className="text-right px-3 py-3 font-semibold">{r.total.toLocaleString()}</td>
                    <td className="text-right px-3 py-3">
                      {r.falha > 0
                        ? <span className="text-red-600 font-semibold flex items-center justify-end gap-1"><AlertTriangle className="w-3 h-3" />{r.falha}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="text-right px-4 py-3 font-bold text-orange-600">{fmt(r.custo)} cr</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-xs">Nenhuma execução no período</td></tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t font-bold text-sm">
                    <td className="px-4 py-3 text-slate-700">TOTAL</td>
                    <td />
                    <td className="text-right px-3 py-3">{totalExec.toLocaleString()}</td>
                    <td />
                    <td className="text-right px-4 py-3 text-orange-700">{fmt(totalCusto)} cr</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            * Estimativa baseada em queries/chamadas LLM por execução registrada em SkillExecution.
          </p>
        </>
      )}
    </div>
  );
}