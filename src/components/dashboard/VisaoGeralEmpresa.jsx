import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DetalhesModal from "./DetalhesModal";
import { COLS_NF, COLS_ORCAMENTO, COLS_CLIENTE } from "./drilldownColunas";
import { DollarSign, Target, Users, TrendingUp, AlertCircle, CheckCircle, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";

export default function VisaoGeralEmpresa({ dados, notasFiscais, vendedoresEntidade }) {
  const nf = notasFiscais || [];
  const kpis = calcularKPIsEmpresa(dados, nf, vendedoresEntidade || []);
  const tendencias = calcularTendencias(dados, nf, vendedoresEntidade || []);
  const distribuicoes = calcularDistribuicoes(dados, nf);
  const [drill, setDrill] = useState(null);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs Principais da Empresa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KPICard
          titulo="Faturamento Total"
          valor={`R$ ${kpis.faturamentoTotal.toLocaleString('pt-BR')}`}
          variacao={kpis.crescimentoFaturamento}
          icon={DollarSign}
          cor="emerald"
          onClick={() => setDrill({ title: 'Faturamento — Notas Fiscais do Período', dados: nf, colunas: COLS_NF })} />

        <KPICard
          titulo="Meta Atingida"
          valor={`${kpis.percentualMeta}%`}
          variacao={kpis.variacao_meta}
          icon={Target}
          cor="blue"
          onClick={() => setDrill({ title: 'Meta — Notas Fiscais Consideradas', dados: nf, colunas: COLS_NF })} />

        <KPICard
          titulo="Clientes Ativos"
          valor={kpis.clientesAtivos}
          variacao={kpis.crescimentoClientes}
          icon={Users}
          cor="purple"
          onClick={() => setDrill({ title: 'Clientes Ativos', dados: dados.clientes.filter((c) => c.status === 'Ativo'), colunas: COLS_CLIENTE })} />

        <KPICard
          titulo="Taxa Conversão"
          valor={`${kpis.taxaConversao}%`}
          variacao={kpis.variacaoConversao}
          icon={TrendingUp}
          cor="orange"
          onClick={() => setDrill({ title: 'Orçamentos do Período', dados: dados.orcamentos, colunas: COLS_ORCAMENTO })} />
      </div>

      {/* Gráficos de Tendência dos Últimos 4 Meses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Evolução do Faturamento */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="px-6 py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Evolução do Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-4 pb-4 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tendencias.faturamentoPorMes}>
                <defs>
                  <linearGradient id="faturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="faturamento" stroke="#10b981" fill="url(#faturamento)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance vs Meta */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="px-6 py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Target className="w-5 h-5 text-blue-500" />
              Performance vs Meta
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-4 pb-4 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tendencias.performanceVsMeta}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Bar dataKey="realizado" fill="url(#blueGradient)" name="Realizado" />
                <Bar dataKey="meta" fill="#4b5563" name="Meta (100%)" />
                 <defs>
                    <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Mensal */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="px-6 py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <DollarSign className="w-5 h-5 text-green-500" />
              Performance Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-4 pb-4 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={tendencias.performanceMensal}>
                <defs>
                  <linearGradient id="performance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="performance" stroke="#059669" fill="url(#performance)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Análises e Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="px-6 py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <Users className="w-5 h-5 text-indigo-500" />
              Clientes por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-4 pb-4 px-2">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={distribuicoes.porSegmento}
                  dataKey="valor"
                  nameKey="segmento"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>

                  {distribuicoes.porSegmento.map((entry, index) =>
                  <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b'][index % 3]} />
                  )}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="px-6 py-4">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <DollarSign className="w-5 h-5 text-green-500" />
              Receita por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-slate-800/30 pt-4 pb-4 px-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={distribuicoes.receitaPorSegmento}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="segmento" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Bar dataKey="receita" fill="url(#greenGradient)" />
                 <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                  </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br bg-slate-200 text-card-foreground rounded-lg border shadow-sm from-slate-900 to-slate-800 border-slate-700">
          <CardHeader className="bg-transparent px-6 py-4 flex flex-col space-y-1.5">
            <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              <FileText className="w-5 h-5 text-orange-500" />
              Status Orçamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="space-y-4">
              {distribuicoes.statusOrcamentos.map((status, index) =>
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-3">
                    {status.status === 'aprovado' ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                     ['rejeitado', 'vencido'].includes(status.status) ? <AlertCircle className="w-5 h-5 text-red-400" /> :
                     <AlertCircle className="w-5 h-5 text-yellow-400" />}
                    <span className="font-medium text-slate-300 capitalize">{(status.status || '').replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{status.quantidade}</div>
                    <div className="text-xs text-slate-400">
                      R$ {status.valor.toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {drill && <DetalhesModal title={drill.title} dados={drill.dados} colunas={drill.colunas} onClose={() => setDrill(null)} />}
    </div>);

}

// Componente KPICard
function KPICard({ titulo, valor, variacao, icon: Icon, cor, onClick }) {
  const getCor = (cor) => {
    const cores = {
      emerald: "from-emerald-500 to-emerald-600",
      blue: "from-blue-500 to-blue-600",
      purple: "from-purple-500 to-purple-600",
      orange: "from-orange-500 to-orange-600"
    };
    return cores[cor] || cores.emerald;
  };

  return (
    <Card onClick={onClick} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-all transform hover:-translate-y-1 cursor-pointer">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-slate-400 mb-1 truncate">{titulo}</p>
            <p className="text-xl md:text-2xl font-bold text-white truncate">{valor}</p>
            {variacao !== undefined &&
            <p className={`text-sm flex items-center gap-1 mt-1 ${
            variacao >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <TrendingUp className={`w-4 h-4 ${variacao < 0 ? 'rotate-180' : ''}`} />
                {variacao >= 0 ? '+' : ''}{variacao}%
              </p>
            }
          </div>
          <div className={`w-12 h-12 flex-shrink-0 bg-gradient-to-br ${getCor(cor)} rounded-xl flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>);

}

// Funções auxiliares para cálculos
function calcularKPIsEmpresa(dados, notas, vendedoresEntidade) {
  // Prioriza notas fiscais para faturamento real
  const faturamentoTotal = notas.length > 0
    ? notas.reduce((acc, n) => acc + (n.valor_total || 0), 0)
    : dados.vendas.reduce((acc, venda) => acc + (venda.valor_total || 0), 0);
  // Metas vêm da entidade Vendedor (fonte de verdade), não do User
  const metaTotal = (vendedoresEntidade || [])
    .filter((v) => v.status === 'ativo')
    .reduce((acc, v) => acc + (v.meta_mensal || 0), 0);
  const percentualMeta = metaTotal > 0 ? Math.round(faturamentoTotal / metaTotal * 100) : 0;
  const clientesAtivos = dados.clientes.filter((c) => c.status === 'Ativo').length;
  const totalOrcamentos = dados.orcamentos.length;
  const orcamentosAprovados = dados.orcamentos.filter((o) => (o.status || '').toLowerCase() === 'aprovado').length;
  const taxaConversao = totalOrcamentos > 0 ? Math.round(orcamentosAprovados / totalOrcamentos * 100) : 0;
  return {
    faturamentoTotal,
    percentualMeta,
    clientesAtivos,
    taxaConversao
  };
}

function calcularTendencias(dados, notas, vendedoresEntidade) {
  const hoje = new Date();
  const ultimosMeses = [];
  for (let i = 3; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesAno = data.toISOString().slice(0, 7);
    const nomeMs = data.toLocaleDateString('pt-BR', { month: 'short' });
    ultimosMeses.push({ mes: mesAno, nome: nomeMs });
  }

  // Agrupar notas fiscais por mês (fonte primária)
  const notasPorMesObj = {};
  (notas || []).forEach(n => {
    const d = (n.data_emissao || n.created_date || '').slice(0, 7);
    if (d) notasPorMesObj[d] = (notasPorMesObj[d] || 0) + (n.valor_total || 0);
  });

  // Fallback: vendas internas
  const vendasPorMesObj = {};
  dados.vendas.forEach(venda => {
    if (venda.data_venda) {
      const mes = venda.data_venda.slice(0, 7);
      if (ultimosMeses.some(m => m.mes === mes))
        vendasPorMesObj[mes] = (vendasPorMesObj[mes] || 0) + (venda.valor_total || 0);
    }
  });

  const temNotas = Object.keys(notasPorMesObj).length > 0;
  const metaTotalEmpresa = (vendedoresEntidade || [])
    .filter((v) => v.status === 'ativo')
    .reduce((acc, v) => acc + (v.meta_mensal || 0), 0);

  const faturamentoPorMes = ultimosMeses.map(({ mes, nome }) => ({
    mes: nome,
    faturamento: temNotas ? (notasPorMesObj[mes] || 0) : (vendasPorMesObj[mes] || 0)
  }));

  const performanceVsMeta = ultimosMeses.map(({ mes, nome }) => {
    const fat = temNotas ? (notasPorMesObj[mes] || 0) : (vendasPorMesObj[mes] || 0);
    return { mes: nome, realizado: metaTotalEmpresa > 0 ? Math.round(fat / metaTotalEmpresa * 100) : 0, meta: 100 };
  });

  const performanceMensal = ultimosMeses.map(({ mes, nome }) => {
    const fat = temNotas ? (notasPorMesObj[mes] || 0) : (vendasPorMesObj[mes] || 0);
    return { mes: nome, performance: metaTotalEmpresa > 0 ? Math.round(fat / metaTotalEmpresa * 100) : 0 };
  });

  return { faturamentoPorMes, performanceVsMeta, performanceMensal };
}

const normNomeVG = (s) => (s || '').toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bS[\/.]?A\b/g, '').replace(/\bLTDA\b/g, '').replace(/\bME\b/g, '').replace(/\bEPP\b/g, '')
  .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

function calcularDistribuicoes(dados, notas) {
  // Distribuição por segmento (Clientes) — por QUANTIDADE (valor_recorrente_mensal não é preenchido)
  const segmentosClientes = {};
  dados.clientes.forEach((cliente) => {
    const segmento = cliente.segmento || 'Não definido';
    segmentosClientes[segmento] = (segmentosClientes[segmento] || 0) + 1;
  });

  const porSegmento = Object.entries(segmentosClientes).map(([segmento, valor]) => ({
    segmento,
    valor
  }));

  // Receita por Segmento — fonte real: NFes (Neural Fin), casadas por nome do cliente
  const segmentoPorNome = {};
  dados.clientes.forEach((c) => {
    const k1 = normNomeVG(c.razao_social);
    const k2 = normNomeVG(c.nome_fantasia);
    if (k1) segmentoPorNome[k1] = c.segmento || 'Não definido';
    if (k2) segmentoPorNome[k2] = c.segmento || 'Não definido';
  });
  const receitaPorSegmentoObj = {};
  (notas || []).forEach((n) => {
    const k = normNomeVG(n.cliente);
    if (!k) return;
    let seg = segmentoPorNome[k];
    if (!seg) {
      for (const chave in segmentoPorNome) {
        if (chave.length >= 6 && k.length >= 6 && (k.includes(chave) || chave.includes(k))) { seg = segmentoPorNome[chave]; break; }
      }
    }
    seg = seg || 'Não identificado';
    receitaPorSegmentoObj[seg] = (receitaPorSegmentoObj[seg] || 0) + (n.valor_total || 0);
  });

  const receitaPorSegmento = Object.entries(receitaPorSegmentoObj).map(([segmento, receita]) => ({
    segmento,
    receita
  }));

  // Status orçamentos
  const statusOrcamentos = {};
  dados.orcamentos.forEach((orcamento) => {
    const status = orcamento.status || 'Em Aberto';
    if (!statusOrcamentos[status]) {
      statusOrcamentos[status] = { quantidade: 0, valor: 0 };
    }
    statusOrcamentos[status].quantidade++;
    statusOrcamentos[status].valor += orcamento.valor_total || 0;
  });

  const statusOrcamentosArray = Object.entries(statusOrcamentos).map(([status, dados]) => ({
    status,
    quantidade: dados.quantidade,
    valor: dados.valor
  }));

  return { porSegmento, receitaPorSegmento, statusOrcamentos: statusOrcamentosArray };
}