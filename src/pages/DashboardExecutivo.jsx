import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  MessageSquare,
  Zap,
  Target,
  Clock,
  CheckCircle,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Eye,
  AlertCircle,
  Upload,
  Trophy
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  DASHBOARD EXECUTIVO - VISÃO CONSOLIDADA                    ║
 * ║  + KPIs de negócio em tempo real                            ║
 * ║  + Comparação com períodos anteriores                       ║
 * ║  + Alertas inteligentes                                     ║
 * ║  + Performance de automação e IA                            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const MetricCard = ({ titulo, valor, variacao, icone: Icon, cor, descricao, trend, loading }) => {
  const isPositive = variacao >= 0;
  
  return (
    <Card className={`border-l-4 ${cor} hover:shadow-lg transition-all`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{titulo}</p>
            {loading ? (
              <div className="h-8 w-32 bg-slate-200 animate-pulse rounded mt-2" />
            ) : (
              <>
                <p className="text-3xl font-bold text-slate-900 mt-2">{valor}</p>
                {variacao !== undefined && (
                  <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span>{Math.abs(variacao).toFixed(1)}%</span>
                    <span className="text-slate-500 text-xs">vs período anterior</span>
                  </div>
                )}
              </>
            )}
            {descricao && <p className="text-xs text-slate-500 mt-2">{descricao}</p>}
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br ${cor}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DashboardExecutivo() {
  const [periodo, setPeriodo] = useState('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [vendaInvalidaAlert, setVendaInvalidaAlert] = useState(null);

  // ═══════════════════════════════════════════════════════════
  // Query principal de KPIs
  // ═══════════════════════════════════════════════════════════
  
  const { data: kpis, isLoading, refetch } = useQuery({
    queryKey: ['dashboard_executivo', periodo],
    queryFn: async () => {
      const diasAtras = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - diasAtras);

      // ═══════════════════════════════════════════════════════
      // Buscar dados otimizados
      // ═══════════════════════════════════════════════════════
      
      const [
        vendas,
        orcamentos,
        clientes,
        threads,
        execucoes,
        iaMetrics,
        importacoes
      ] = await Promise.all([
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 300),
        base44.entities.Cliente.list('-created_date', 500),
        base44.entities.MessageThread.list('-created_date', 300),
        base44.entities.FlowExecution.list('-created_date', 300),
        base44.entities.IAUsageMetric.list('-timestamp', 500),
        base44.entities.ImportacaoDocumento.list('-created_date', 100)
      ]);

      // Filtrar por período atual
      const vendasPeriodo = vendas.filter(v => 
        v.data_venda && new Date(v.data_venda) >= dataInicio
      );
      
      const orcamentosPeriodo = orcamentos.filter(o => 
        o.data_orcamento && new Date(o.data_orcamento) >= dataInicio
      );
      
      const threadsPeriodo = threads.filter(t => 
        t.created_date && new Date(t.created_date) >= dataInicio
      );
      
      const execucoesPeriodo = execucoes.filter(e => 
        e.created_date && new Date(e.created_date) >= dataInicio
      );

      const iaMetricsPeriodo = iaMetrics.filter(m =>
        m.timestamp && new Date(m.timestamp) >= dataInicio
      );

      // Período anterior para comparação
      const dataInicioAnterior = new Date(dataInicio);
      dataInicioAnterior.setDate(dataInicioAnterior.getDate() - diasAtras);
      
      const vendasAnterior = vendas.filter(v => 
        v.data_venda && 
        new Date(v.data_venda) >= dataInicioAnterior && 
        new Date(v.data_venda) < dataInicio
      );

      const orcamentosAnterior = orcamentos.filter(o => 
        o.data_orcamento && 
        new Date(o.data_orcamento) >= dataInicioAnterior && 
        new Date(o.data_orcamento) < dataInicio
      );

      // ═══════════════════════════════════════════════════════
      // Calcular KPIs principais
      // ═══════════════════════════════════════════════════════
      
      const receitaTotal = vendasPeriodo.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const receitaAnterior = vendasAnterior.reduce((sum, v) => sum + (v.valor_total || 0), 0);
      const variacaoReceita = receitaAnterior > 0 
        ? ((receitaTotal - receitaAnterior) / receitaAnterior) * 100 
        : 0;

      const ticketMedio = vendasPeriodo.length > 0 
        ? receitaTotal / vendasPeriodo.length 
        : 0;

      const taxaConversao = orcamentosPeriodo.length > 0
        ? (vendasPeriodo.length / orcamentosPeriodo.length) * 100
        : 0;

      const taxaConversaoAnterior = orcamentosAnterior.length > 0
        ? (vendasAnterior.length / orcamentosAnterior.length) * 100
        : 0;

      const variacaoConversao = taxaConversaoAnterior > 0
        ? ((taxaConversao - taxaConversaoAnterior) / taxaConversaoAnterior) * 100
        : 0;

      // Clientes ativos (com interação recente)
      const clientesAtivos = clientes.filter(c => {
        if (!c.ultima_interacao) return false;
        const diasSemInteracao = (Date.now() - new Date(c.ultima_interacao)) / (1000 * 60 * 60 * 24);
        return diasSemInteracao <= 30;
      }).length;

      // ═══════════════════════════════════════════════════════
      // KPIs de Automação e IA
      // ═══════════════════════════════════════════════════════
      
      const execucoesComSucesso = execucoesPeriodo.filter(e => e.status === 'concluido').length;
      const taxaSucessoPlaybooks = execucoesPeriodo.length > 0
        ? (execucoesComSucesso / execucoesPeriodo.length) * 100
        : 0;

      const conversasAutomatizadas = threadsPeriodo.filter(t => 
        t.assigned_user_id === null || t.pre_atendimento_ativo
      ).length;

      const taxaAutomacao = threadsPeriodo.length > 0
        ? (conversasAutomatizadas / threadsPeriodo.length) * 100
        : 0;

      // Tempo médio de resposta
      const threadsComResposta = threadsPeriodo.filter(t => 
        t.tempo_primeira_resposta_minutos !== null
      );
      const tempoMedioResposta = threadsComResposta.length > 0
        ? threadsComResposta.reduce((sum, t) => sum + t.tempo_primeira_resposta_minutos, 0) / threadsComResposta.length
        : 0;

      // Custo de IA
      const custoIA = iaMetricsPeriodo.reduce((sum, m) => sum + (m.custo_estimado_usd || 0), 0);
      const tokensTotal = iaMetricsPeriodo.reduce((sum, m) => sum + (m.tokens_total || 0), 0);

      // ═══════════════════════════════════════════════════════
      // Evolução diária (últimos 7 dias)
      // ═══════════════════════════════════════════════════════
      
      const ultimos7Dias = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        const vendasDia = vendas.filter(v => v.data_venda?.startsWith(dataStr));
        const receitaDia = vendasDia.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        
        ultimos7Dias.push({
          data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          receita: receitaDia,
          vendas: vendasDia.length
        });
      }

      // ═══════════════════════════════════════════════════════
      // Alertas inteligentes
      // ═══════════════════════════════════════════════════════
      
      const alertas = [];

      if (variacaoReceita < -10) {
        alertas.push({
          tipo: 'critico',
          mensagem: `Receita caiu ${Math.abs(variacaoReceita).toFixed(1)}% vs período anterior`,
          acao: 'Analisar pipeline de vendas'
        });
      }

      if (taxaConversao < 20) {
        alertas.push({
          tipo: 'alerta',
          mensagem: `Taxa de conversão baixa: ${taxaConversao.toFixed(1)}%`,
          acao: 'Revisar qualificação de leads'
        });
      }

      if (tempoMedioResposta > 60) {
        alertas.push({
          tipo: 'alerta',
          mensagem: `Tempo de resposta alto: ${Math.round(tempoMedioResposta)} minutos`,
          acao: 'Otimizar atendimento'
        });
      }

      if (taxaSucessoPlaybooks < 70) {
        alertas.push({
          tipo: 'alerta',
          mensagem: `Playbooks com baixo sucesso: ${taxaSucessoPlaybooks.toFixed(1)}%`,
          acao: 'Revisar automações'
        });
      }

      // ═══════════════════════════════════════════════════════
      // Status das Importações
      // ═══════════════════════════════════════════════════════
      const hoje = new Date().toISOString().split('T')[0];
      const importacoesHoje = importacoes.filter(i => i.created_date?.startsWith(hoje));
      const importacoesErro = importacoes.filter(i => i.status_processamento === 'erro');
      const importacoesRevisao = importacoes.filter(i => i.status_processamento === 'revisao_manual');
      const ultimaSucesso = importacoes.find(i => i.status_processamento === 'sucesso');

      // ═══════════════════════════════════════════════════════════
      // Detectar e alertar sobre vendas "fantasma" (dados incompletos)
      // ═══════════════════════════════════════════════════════════
      const vendasInvalidas = vendas.filter(v => 
        (v.cliente_nome === 'Cliente não informado' || !v.cliente_nome) &&
        (v.valor_total === 0 || !v.valor_total) &&
        !v.numero_pedido
      );
      if (vendasInvalidas.length > 0) {
        setVendaInvalidaAlert({
          count: vendasInvalidas.length,
          ids: vendasInvalidas.slice(0, 5).map(v => v.id)
        });
      }

      // Top vendedores por receita (excluindo vendas inválidas)
      const vendasValidas = vendas.filter(v => !(
        (v.cliente_nome === 'Cliente não informado' || !v.cliente_nome) &&
        (v.valor_total === 0 || !v.valor_total)
      ));

      const vendasPorVendedor = {};
      vendasValidas.forEach(v => {
        if (!v.vendedor) return;
        if (!vendasPorVendedor[v.vendedor]) vendasPorVendedor[v.vendedor] = { total: 0, count: 0 };
        vendasPorVendedor[v.vendedor].total += v.valor_total || 0;
        vendasPorVendedor[v.vendedor].count += 1;
      });
      const topVendedores = Object.entries(vendasPorVendedor)
        .map(([nome, stats]) => ({ nome, ...stats }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Vendas por mês
      const vendasPorMes = {};
      vendas.forEach(v => {
        const mes = v.mes_referencia || (v.data_venda ? v.data_venda.substring(0, 7) : null);
        if (!mes) return;
        if (!vendasPorMes[mes]) vendasPorMes[mes] = 0;
        vendasPorMes[mes] += v.valor_total || 0;
      });
      const evolucaoMensal = Object.entries(vendasPorMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([mes, total]) => ({ mes, total }));

      return {
        receita: {
          valor: receitaTotal,
          variacao: variacaoReceita,
          label: `R$ ${receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        },
        vendas: {
          valor: vendasPeriodo.length,
          variacao: vendasAnterior.length > 0 
            ? ((vendasPeriodo.length - vendasAnterior.length) / vendasAnterior.length) * 100 
            : 0
        },
        ticketMedio: {
          valor: ticketMedio,
          label: `R$ ${ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        },
        taxaConversao: {
          valor: taxaConversao,
          variacao: variacaoConversao,
          label: `${taxaConversao.toFixed(1)}%`
        },
        clientesAtivos: {
          valor: clientesAtivos
        },
        orcamentosAbertos: {
          valor: orcamentos.filter(o => ['enviado', 'negociando', 'aguardando_liberacao'].includes(o.status)).length
        },
        conversasAtivas: {
          valor: threads.filter(t => t.status === 'aberta').length
        },
        taxaAutomacao: {
          valor: taxaAutomacao,
          label: `${taxaAutomacao.toFixed(1)}%`
        },
        taxaSucessoPlaybooks: {
          valor: taxaSucessoPlaybooks,
          label: `${taxaSucessoPlaybooks.toFixed(1)}%`
        },
        tempoMedioResposta: {
          valor: tempoMedioResposta,
          label: `${Math.round(tempoMedioResposta)} min`
        },
        custoIA: {
          valor: custoIA,
          label: `US$ ${custoIA.toFixed(2)}`
        },
        tokensIA: {
          valor: tokensTotal,
          label: tokensTotal.toLocaleString('pt-BR')
        },
        evolucao: ultimos7Dias,
        evolucaoMensal,
        topVendedores,
        importacoes: {
          hoje: importacoesHoje.length,
          erro: importacoesErro.length,
          revisao: importacoesRevisao.length,
          ultimaSucesso: ultimaSucesso?.nome_arquivo || null
        },
        alertas
      };
    },
    refetchInterval: autoRefresh ? 60000 : false // Refresh automático a cada 1 min
  });

  const handleRefresh = () => {
    refetch();
    toast.success('Dashboard atualizado!');
  };

  const handleExport = () => {
    toast.info('Exportando relatório...');
    // Implementar exportação
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[2000px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Dashboard Executivo
          </h1>
          <p className="text-slate-600 mt-1">
            Visão consolidada de negócio e performance
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
          
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="flex-shrink-0"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button
            onClick={handleExport}
            className="hidden md:flex bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Alerta de Vendas Inválidas */}
       {vendaInvalidaAlert && (
         <Card className="border-l-4 border-red-500 bg-red-50">
           <CardContent className="pt-6">
             <div className="flex items-start gap-3 justify-between">
               <div className="flex items-start gap-3 flex-1">
                 <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                 <div>
                   <h3 className="font-semibold text-red-900 mb-1">
                     ⚠️ {vendaInvalidaAlert.count} venda{vendaInvalidaAlert.count !== 1 ? 's' : ''} com dados incompletos
                   </h3>
                   <p className="text-sm text-red-700">
                     Registros com cliente não informado e valor zero encontrados. Estes podem ter sido criados por mapeamentos vazios.
                   </p>
                 </div>
               </div>
               <Button
                 onClick={async () => {
                   try {
                     for (const id of vendaInvalidaAlert.ids) {
                       await base44.entities.Venda.delete(id);
                     }
                     toast.success(`${vendaInvalidaAlert.count} venda(s) inválida(s) removida(s)`);
                     setVendaInvalidaAlert(null);
                     refetch();
                   } catch (error) {
                     toast.error('Erro ao limpar registros: ' + error.message);
                   }
                 }}
                 className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs"
               >
                 Limpar
               </Button>
             </div>
           </CardContent>
         </Card>
       )}

       {/* Alertas de Negócio */}
       {kpis?.alertas && kpis.alertas.length > 0 && (
         <Card className="border-l-4 border-orange-500 bg-orange-50">
           <CardContent className="pt-6">
             <div className="flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
               <div className="flex-1">
                 <h3 className="font-semibold text-orange-900 mb-2">
                   {kpis.alertas.length} alerta{kpis.alertas.length > 1 ? 's' : ''} requer{kpis.alertas.length === 1 ? '' : 'em'} atenção
                 </h3>
                 <div className="space-y-2">
                   {kpis.alertas.map((alerta, idx) => (
                     <div key={idx} className="bg-white p-3 rounded-lg border border-orange-200">
                       <p className="font-medium text-sm text-orange-900">{alerta.mensagem}</p>
                       <p className="text-xs text-orange-700 mt-1">→ {alerta.acao}</p>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           </CardContent>
         </Card>
       )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard
          titulo="Receita Total"
          valor={kpis?.receita.valor === 0 && !isLoading ? (
            <div className="text-sm text-amber-600">
              Nenhuma venda importada.{" "}
              <Link to={createPageUrl("Importacao")}>
                <span className="underline">Importar dados →</span>
              </Link>
            </div>
          ) : kpis?.receita.label}
          variacao={kpis?.receita.variacao}
          icone={DollarSign}
          cor="border-green-500 from-green-500 to-emerald-600"
          loading={isLoading}
        />
        
        <MetricCard
          titulo="Vendas Fechadas"
          valor={kpis?.vendas.valor}
          variacao={kpis?.vendas.variacao}
          icone={CheckCircle}
          cor="border-blue-500 from-blue-500 to-indigo-600"
          loading={isLoading}
        />
        
        <MetricCard
          titulo="Ticket Médio"
          valor={kpis?.ticketMedio.label}
          icone={Target}
          cor="border-purple-500 from-purple-500 to-pink-600"
          descricao="Por venda fechada"
          loading={isLoading}
        />
        
        <MetricCard
          titulo="Taxa de Conversão"
          valor={kpis?.taxaConversao.label}
          variacao={kpis?.taxaConversao.variacao}
          icone={TrendingUp}
          cor="border-amber-500 from-amber-500 to-orange-600"
          loading={isLoading}
        />
      </div>

      <Tabs defaultValue="negocio" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="negocio">
            <BarChart3 className="w-4 h-4 mr-2" />
            Negócio
          </TabsTrigger>
          <TabsTrigger value="automacao">
            <Zap className="w-4 h-4 mr-2" />
            Automação
          </TabsTrigger>
        </TabsList>

        {/* TAB: Negócio */}
        <TabsContent value="negocio" className="space-y-6">
          
          {/* KPIs Operacionais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <MetricCard
              titulo="Clientes Ativos"
              valor={kpis?.clientesAtivos.valor}
              icone={Users}
              cor="border-indigo-500 from-indigo-500 to-blue-600"
              descricao="Com interação nos últimos 30 dias"
              loading={isLoading}
            />
            
            <MetricCard
              titulo="Orçamentos Abertos"
              valor={kpis?.orcamentosAbertos.valor}
              icone={Eye}
              cor="border-yellow-500 from-yellow-500 to-amber-600"
              descricao="Em negociação"
              loading={isLoading}
            />
            
            <MetricCard
              titulo="Conversas Ativas"
              valor={kpis?.conversasAtivas.valor}
              icone={MessageSquare}
              cor="border-cyan-500 from-cyan-500 to-blue-600"
              descricao="Threads abertas"
              loading={isLoading}
            />
          </div>

          {/* Gráfico de Evolução + Top Vendedores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução de Receita (Últimos 7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-64 bg-slate-100 animate-pulse rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={kpis?.evolucao || []}>
                      <defs>
                        <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis />
                      <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                      <Area type="monotone" dataKey="receita" stroke="#10b981" fillOpacity={1} fill="url(#colorReceita)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Top Vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}</div>
                ) : kpis?.topVendedores?.length > 0 ? (
                  <div className="space-y-3">
                    {kpis.topVendedores.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.nome}</p>
                          <p className="text-xs text-slate-500">{v.count} venda{v.count !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-sm font-bold text-green-600">
                          R$ {v.total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-4">Nenhuma venda registrada</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status das Importações */}
          <Card className="border-l-4 border-indigo-500">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Status das Importações
                </span>
                <Link to={createPageUrl("Importacao")}>
                  <button className="text-xs text-indigo-600 hover:underline">Ver todas →</button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-12 bg-slate-100 animate-pulse rounded" />
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">{kpis?.importacoes?.hoje ?? 0}</p>
                      <p className="text-xs text-blue-600">Hoje</p>
                    </div>
                    <Link to={createPageUrl("Importacao")}>
                      <div className="text-center p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                        <p className="text-2xl font-bold text-red-700">{kpis?.importacoes?.erro ?? 0}</p>
                        <p className="text-xs text-red-600">Com Erro</p>
                      </div>
                    </Link>
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-700">{kpis?.importacoes?.revisao ?? 0}</p>
                      <p className="text-xs text-amber-600">Aguardando Revisão</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xs font-medium text-green-700 truncate">{kpis?.importacoes?.ultimaSucesso || '—'}</p>
                      <p className="text-xs text-green-600">Último com Sucesso</p>
                    </div>
                  </div>

                  {/* CORREÇÃO 7: Botão "Reprocessar Erros" quando há erros */}
                  {(kpis?.importacoes?.erro ?? 0) > 0 && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center justify-between">
                      <span className="text-sm font-medium text-red-700">
                        {kpis?.importacoes?.erro} arquivo{(kpis?.importacoes?.erro ?? 0) !== 1 ? 's' : ''} com erro {(kpis?.importacoes?.erro ?? 0) !== 1 ? 'requerem' : 'requer'} atenção
                      </span>
                      <Link to={createPageUrl("Importacao")}>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white text-xs">
                          Reprocessar →
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Automação */}
        <TabsContent value="automacao" className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <MetricCard
              titulo="Taxa de Automação"
              valor={kpis?.taxaAutomacao.label}
              icone={Zap}
              cor="border-purple-500 from-purple-500 to-pink-600"
              descricao="Conversas automatizadas"
              loading={isLoading}
            />
            
            <MetricCard
              titulo="Sucesso de Playbooks"
              valor={kpis?.taxaSucessoPlaybooks.label}
              icone={CheckCircle}
              cor="border-green-500 from-green-500 to-emerald-600"
              descricao="Taxa de conclusão"
              loading={isLoading}
            />
            
            <MetricCard
              titulo="Tempo Médio Resposta"
              valor={kpis?.tempoMedioResposta.label}
              icone={Clock}
              cor="border-blue-500 from-blue-500 to-cyan-600"
              descricao="Primeira resposta"
              loading={isLoading}
            />
          </div>

          {/* Custo de IA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <MetricCard
              titulo="Custo de IA"
              valor={kpis?.custoIA.label}
              icone={DollarSign}
              cor="border-red-500 from-red-500 to-pink-600"
              descricao={`${periodo === '7d' ? '7' : periodo === '30d' ? '30' : '90'} dias`}
              loading={isLoading}
            />
            
            <MetricCard
              titulo="Tokens Consumidos"
              valor={kpis?.tokensIA.label}
              icone={Activity}
              cor="border-amber-500 from-amber-500 to-orange-600"
              descricao="Total processado"
              loading={isLoading}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}