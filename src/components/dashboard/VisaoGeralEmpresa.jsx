import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Target, Users, TrendingUp, AlertCircle, CheckCircle, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";

export default function VisaoGeralEmpresa({ dados }) {
  const kpis = calcularKPIsEmpresa(dados);
  const tendencias = calcularTendencias(dados);
  const distribuicoes = calcularDistribuicoes(dados);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs Principais da Empresa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KPICard
          titulo="Faturamento Total"
          valor={`R$ ${kpis.faturamentoTotal.toLocaleString('pt-BR')}`}
          variacao={kpis.crescimentoFaturamento}
          icon={DollarSign}
          cor="emerald" />

        <KPICard
          titulo="Meta Atingida"
          valor={`${kpis.percentualMeta}%`}
          variacao={kpis.variacao_meta}
          icon={Target}
          cor="blue" />

        <KPICard
          titulo="Clientes Ativos"
          valor={kpis.clientesAtivos}
          variacao={kpis.crescimentoClientes}
          icon={Users}
          cor="purple" />

        <KPICard
          titulo="Taxa Conversão"
          valor={`${kpis.taxaConversao}%`}
          variacao={kpis.variacaoConversao}
          icon={TrendingUp}
          cor="orange" />
      </div>

      {/* Gráficos de Tendência dos Últimos 4 Meses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    {status.status === 'Em Aberto' && <AlertCircle className="w-5 h-5 text-yellow-400" />}
                    {status.status === 'Aprovado' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {status.status === 'Rejeitado' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    <span className="font-medium text-slate-300">{status.status}</span>
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
    </div>);

}

// Componente KPICard
function KPICard({ titulo, valor, variacao, icon: Icon, cor }) {
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
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 shadow-lg hover:shadow-xl hover:shadow-purple-500/10 transition-all transform hover:-translate-y-1">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-400 mb-1 truncate">{titulo}</p>
            <p className="text-2xl font-bold text-white truncate">{valor}</p>
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
function calcularKPIsEmpresa(dados) {
  const faturamentoTotal = dados.vendas.reduce((acc, venda) => acc + (venda.valor_total || 0), 0);
  const metaTotal = dados.vendedores.reduce((acc, vendedor) => acc + (vendedor.meta_mensal || 0), 0);
  const percentualMeta = metaTotal > 0 ? Math.round(faturamentoTotal / metaTotal * 100) : 0;

  const clientesAtivos = dados.clientes.filter((c) => c.status === 'Ativo').length;
  const totalOrcamentos = dados.orcamentos.length;
  const orcamentosAprovados = dados.orcamentos.filter((o) => o.status === 'Aprovado').length;
  const taxaConversao = totalOrcamentos > 0 ? Math.round(orcamentosAprovados / totalOrcamentos * 100) : 0;

  // Manter cálculo para outros usos, mas remover do retorno da função se não for mais necessário
  // This calculation is no longer needed since it's not returned and not used elsewhere in this file.
  // const vendedoresFaturamento = dados.vendedores.map((vendedor) => {
  //   const vendasVendedor = dados.vendas.filter((v) => v.vendedor === vendedor.nome);
  //   const faturamento = vendasVendedor.reduce((acc, venda) => acc + (venda.valor_total || 0), 0);
  //   const percentualMeta = vendedor.meta_mensal > 0 ? Math.round(faturamento / vendedor.meta_mensal * 100) : 0;
  //   return { ...vendedor, faturamento, percentualMeta };
  // }).sort((a, b) => b.faturamento - a.faturamento);

  return {
    faturamentoTotal,
    percentualMeta,
    clientesAtivos,
    taxaConversao,
    crescimentoFaturamento: 12, // Placeholder
    variacao_meta: 8, // Placeholder
    crescimentoClientes: 5, // Placeholder
    variacaoConversao: -2 // Placeholder
    // topVendedores não é mais retornado
  };
}

function calcularTendencias(dados) {
  const hoje = new Date();
  const ultimosMeses = [];

  // Generate last 4 months (current month + 3 previous)
  for (let i = 3; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesAno = data.toISOString().slice(0, 7); // YYYY-MM
    // Format to "Jan", "Feb", etc.
    const nomeMs = data.toLocaleDateString('pt-BR', { month: 'short' });
    ultimosMeses.push({ mes: mesAno, nome: nomeMs });
  }

  // Agrupar vendas por mês para os meses relevantes
  const vendasPorMesObj = {};
  dados.vendas.forEach((venda) => {
    if (venda.data_venda) {
      const mes = venda.data_venda.slice(0, 7); // YYYY-MM
      // Only consider sales within the last 4 relevant months
      if (ultimosMeses.some((m) => m.mes === mes)) {
        vendasPorMesObj[mes] = (vendasPorMesObj[mes] || 0) + (venda.valor_total || 0);
      }
    }
  });

  const faturamentoPorMes = ultimosMeses.map(({ mes, nome }) => ({
    mes: nome,
    faturamento: vendasPorMesObj[mes] || 0
  }));

  // Calcular meta total da empresa para performance vs meta e performance mensal
  const metaTotalEmpresa = dados.vendedores.reduce((acc, vendedor) => acc + (vendedor.meta_mensal || 0), 0);

  // Performance vs Meta
  const performanceVsMeta = ultimosMeses.map(({ mes, nome }) => {
    const faturamentoRealizado = vendasPorMesObj[mes] || 0;
    const percentualRealizado = metaTotalEmpresa > 0 ? Math.round(faturamentoRealizado / metaTotalEmpresa * 100) : 0;
    return {
      mes: nome,
      realizado: percentualRealizado,
      meta: 100
    };
  });

  // Performance Mensal
  const performanceMensal = ultimosMeses.map(({ mes, nome }) => {
    const faturamentoRealizado = vendasPorMesObj[mes] || 0;
    const performance = metaTotalEmpresa > 0 ? Math.round(faturamentoRealizado / metaTotalEmpresa * 100) : 0;
    return {
      mes: nome,
      performance: performance
    };
  });

  return { faturamentoPorMes, performanceVsMeta, performanceMensal };
}

function calcularDistribuicoes(dados) {
  // Distribuição por segmento (Clientes)
  const segmentosClientes = {};
  dados.clientes.forEach((cliente) => {
    const segmento = cliente.segmento || 'Não definido';
    const valor = cliente.valor_recorrente_mensal || 0; // Assuming this is used for client distribution
    segmentosClientes[segmento] = (segmentosClientes[segmento] || 0) + valor;
  });

  const porSegmento = Object.entries(segmentosClientes).map(([segmento, valor]) => ({
    segmento,
    valor
  }));

  // Receita por Segmento (Vendas)
  const receitaPorSegmentoObj = {};
  dados.vendas.forEach((venda) => {
    // Find the client associated with the sale to get their segment
    const cliente = dados.clientes.find((c) => c.id === venda.cliente_id); // Assuming venda has client_id
    if (cliente) {
      const segmento = cliente.segmento || 'Não definido';
      receitaPorSegmentoObj[segmento] = (receitaPorSegmentoObj[segmento] || 0) + (venda.valor_total || 0);
    }
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