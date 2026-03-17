import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { TrendingUp, Trophy, Target, Clock, DollarSign, Users, Award, Filter } from 'lucide-react';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const statusLabels = {
  rascunho: 'Rascunho', aguardando_cotacao: 'Aguard. Cotação',
  analisando: 'Analisando', liberado: 'Liberado', enviado: 'Enviado',
  negociando: 'Negociando', aprovado: 'Aprovado', rejeitado: 'Rejeitado', vencido: 'Vencido'
};

const statusOrdem = ['rascunho', 'aguardando_cotacao', 'analisando', 'liberado', 'enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'];

function KPICard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function Performance() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('todos');

  useEffect(() => {
    base44.entities.Orcamento.list('-created_date', 500)
      .then(data => { setOrcamentos(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatCurrency = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

  // Filtrar por período
  const filtrados = orcamentos.filter(o => {
    if (periodo === 'todos') return true;
    const data = new Date(o.created_date || o.data_orcamento);
    const agora = new Date();
    if (periodo === '7d') return (agora - data) <= 7 * 86400000;
    if (periodo === '30d') return (agora - data) <= 30 * 86400000;
    if (periodo === '90d') return (agora - data) <= 90 * 86400000;
    return true;
  });

  // ── Por Vendedor ──────────────────────────────────────────────────────────
  const vendedorMap = {};
  filtrados.forEach(o => {
    const v = o.vendedor || 'Sem vendedor';
    if (!vendedorMap[v]) vendedorMap[v] = { nome: v, total: 0, ganhos: 0, perdidos: 0, valor: 0, valorGanho: 0 };
    vendedorMap[v].total++;
    vendedorMap[v].valor += o.valor_total || 0;
    if (o.status === 'aprovado') { vendedorMap[v].ganhos++; vendedorMap[v].valorGanho += o.valor_total || 0; }
    if (o.status === 'rejeitado' || o.status === 'vencido') vendedorMap[v].perdidos++;
  });

  const dadosVendedor = Object.values(vendedorMap)
    .map(v => ({
      ...v,
      conversao: v.total > 0 ? Math.round((v.ganhos / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  // ── Por Status (funil) ────────────────────────────────────────────────────
  const dadosFunil = statusOrdem.map(s => ({
    status: statusLabels[s] || s,
    quantidade: filtrados.filter(o => o.status === s).length,
    valor: filtrados.filter(o => o.status === s).reduce((sum, o) => sum + (o.valor_total || 0), 0),
  })).filter(d => d.quantidade > 0);

  // ── Tempo médio por status (dias desde created_date) ─────────────────────
  const tempoMedioStatus = statusOrdem.map(s => {
    const grupo = filtrados.filter(o => o.status === s && o.created_date);
    const media = grupo.length > 0
      ? grupo.reduce((sum, o) => sum + (Date.now() - new Date(o.created_date)) / 86400000, 0) / grupo.length
      : 0;
    return { status: statusLabels[s], dias: Math.round(media), quantidade: grupo.length };
  }).filter(d => d.quantidade > 0);

  // ── KPIs Gerais ───────────────────────────────────────────────────────────
  const totalOrc = filtrados.length;
  const totalValor = filtrados.reduce((s, o) => s + (o.valor_total || 0), 0);
  const aprovados = filtrados.filter(o => o.status === 'aprovado');
  const taxaGeral = totalOrc > 0 ? Math.round((aprovados.length / totalOrc) * 100) : 0;
  const valorGanho = aprovados.reduce((s, o) => s + (o.valor_total || 0), 0);
  const melhorVendedor = dadosVendedor[0];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Performance de Orçamentos
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Análise comparativa por vendedor, funil e conversão</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg bg-white shadow-sm"
          >
            <option value="todos">Todos os períodos</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Target} label="Total de Orçamentos" value={totalOrc} color="bg-indigo-500" />
        <KPICard icon={DollarSign} label="Valor Total" value={formatCurrency(totalValor)} sub={`${formatCurrency(valorGanho)} ganhos`} color="bg-emerald-500" />
        <KPICard icon={TrendingUp} label="Taxa de Conversão" value={`${taxaGeral}%`} sub={`${aprovados.length} aprovados`} color="bg-amber-500" />
        <KPICard icon={Trophy} label="Top Vendedor" value={melhorVendedor?.nome?.split(' ')[0] || '—'} sub={melhorVendedor ? `${melhorVendedor.conversao}% conversão` : ''} color="bg-purple-500" />
      </div>

      {/* Gráfico Comparativo por Vendedor */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          Orçamentos por Vendedor — Ganhos vs Perdidos
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosVendedor} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => [v, n === 'ganhos' ? 'Ganhos' : n === 'perdidos' ? 'Perdidos' : 'Total']} />
            <Legend />
            <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ganhos" name="Ganhos" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="perdidos" name="Perdidos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Valor Transacionado por Vendedor */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Valor Total por Vendedor
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosVendedor} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatCurrency(v)} />
              <YAxis dataKey="nome" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="valorGanho" name="Valor Ganho" fill="#10b981" radius={[0, 4, 4, 0]} />
              <Bar dataKey="valor" name="Valor Total" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Taxa de Conversão por Vendedor */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Taxa de Conversão por Vendedor (%)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dadosVendedor}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="conversao" name="Conversão" radius={[4, 4, 0, 0]}>
                {dadosVendedor.map((entry, i) => (
                  <Cell key={i} fill={entry.conversao >= 50 ? '#10b981' : entry.conversao >= 25 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuição no Funil + Tempo Médio por Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-500" />
            Distribuição no Funil
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dadosFunil} dataKey="quantidade" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {dadosFunil.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-500" />
            Tempo Médio por Status (dias desde criação)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tempoMedioStatus} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10 }} unit="d" />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={v => `${v} dias`} />
              <Bar dataKey="dias" name="Dias médios" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela Ranking */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm overflow-auto">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Ranking de Vendedores
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="pb-2 pr-4">#</th>
              <th className="pb-2 pr-4">Vendedor</th>
              <th className="pb-2 pr-4 text-center">Total</th>
              <th className="pb-2 pr-4 text-center">Ganhos</th>
              <th className="pb-2 pr-4 text-center">Perdidos</th>
              <th className="pb-2 pr-4 text-center">Conversão</th>
              <th className="pb-2 text-right">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {dadosVendedor.map((v, i) => (
              <tr key={v.nome} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-2 pr-4">
                  <span className={`font-bold text-xs ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-slate-300'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`}
                  </span>
                </td>
                <td className="py-2 pr-4 font-semibold text-slate-700">{v.nome}</td>
                <td className="py-2 pr-4 text-center text-slate-600">{v.total}</td>
                <td className="py-2 pr-4 text-center text-emerald-600 font-semibold">{v.ganhos}</td>
                <td className="py-2 pr-4 text-center text-red-500">{v.perdidos}</td>
                <td className="py-2 pr-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v.conversao >= 50 ? 'bg-green-100 text-green-700' : v.conversao >= 25 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {v.conversao}%
                  </span>
                </td>
                <td className="py-2 text-right font-bold text-indigo-600">{formatCurrency(v.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}