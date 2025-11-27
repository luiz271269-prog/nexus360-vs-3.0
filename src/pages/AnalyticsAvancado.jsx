
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Users,
  DollarSign,
  Target,
  Calendar,
  Zap,
  Brain,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Award,
  Sparkles
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Venda } from "@/entities/Venda";
import { Orcamento } from "@/entities/Orcamento";
import { Interacao } from "@/entities/Interacao";
import { ClienteScore } from "@/entities/ClienteScore";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { FlowExecution } from "@/entities/FlowExecution";
import { toast } from "sonner";
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';

export default function AnalyticsAvancado() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('mes_atual');
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [insights, setInsights] = useState([]);
  const [alertasIA, setAlertasIA] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [periodoSelecionado]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [vendedores, clientes, vendas, orcamentos, interacoes, scores, tarefas, fluxos] = await Promise.all([
        Vendedor.list(),
        Cliente.list(),
        Venda.list('-data_venda', 500),
        Orcamento.list('-data_orcamento', 500),
        Interacao.list('-data_interacao', 1000),
        ClienteScore.list('-score_total', 100),
        TarefaInteligente.filter({ status: 'pendente' }),
        FlowExecution.filter({ status: 'ativo' })
      ]);

      const dadosProcessados = processarDados({
        vendedores,
        clientes,
        vendas,
        orcamentos,
        interacoes,
        scores,
        tarefas,
        fluxos
      }, periodoSelecionado);

      setDados(dadosProcessados);
      setInsights(gerarInsights(dadosProcessados));
      gerarAlertasAnalytics(dadosProcessados);

    } catch (error) {
      console.error("Erro ao carregar analytics:", error);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
  };

  const gerarAlertasAnalytics = (currentDados) => {
    const alertas = [];

    // Alerta de queda de vendas
    if (currentDados.crescimentoVendas < -10) {
      alertas.push({
        id: 'queda_vendas',
        prioridade: 'critica',
        titulo: 'Queda nas Vendas',
        descricao: `Redução de ${Math.abs(currentDados.crescimentoVendas).toFixed(1)}% vs período anterior`,
        acao_sugerida: 'Analisar Causas',
        onAcao: () => toast.info('📉 Análise detalhada necessária')
      });
    }

    // Alerta de tendência positiva
    if (currentDados.crescimentoVendas > 20) {
      alertas.push({
        id: 'crescimento',
        prioridade: 'baixa',
        titulo: 'Crescimento Acelerado',
        descricao: `Aumento de ${currentDados.crescimentoVendas.toFixed(1)}% nas vendas`,
        acao_sugerida: 'Replicar Estratégia',
        onAcao: () => toast.success('📈 Momento de expansão!')
      });
    }

    setAlertasIA(alertas);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando analytics avançado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <BarChart3 className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Analytics Avançado
              </h1>
              <p className="text-slate-300 mt-1">
                Análise inteligente de dados e tendências
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana_atual">Semana Atual</SelectItem>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
                <SelectItem value="tudo">Todo Período</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={carregarDados}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>

            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      <BotaoNexusFlutuante
        contadorLembretes={alertasIA.length}
        onClick={() => {
          if (alertasIA.length > 0) {
            toast.info(`📊 ${alertasIA.length} insights disponíveis`);
          }
        }}
      />

      <AlertasInteligentesIA
        alertas={alertasIA}
        titulo="Analytics IA"
        onAcaoExecutada={(alerta) => {
          if (alerta.id === 'fechar_tudo') {
            setAlertasIA([]);
            return;
          }
          setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
        }}
      />

      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, idx) => (
            <Card key={idx} className={`border-2 ${
              insight.tipo === 'positivo' ? 'border-green-300 bg-green-50' :
              insight.tipo === 'atencao' ? 'border-yellow-300 bg-yellow-50' :
              'border-red-300 bg-red-50'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    insight.tipo === 'positivo' ? 'bg-green-500' :
                    insight.tipo === 'atencao' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}>
                    {insight.tipo === 'positivo' ? <CheckCircle className="w-5 h-5 text-white" /> :
                     insight.tipo === 'atencao' ? <AlertCircle className="w-5 h-5 text-white" /> :
                     <TrendingDown className="w-5 h-5 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900">{insight.titulo}</h3>
                    <p className="text-sm text-slate-700 mt-1">{insight.descricao}</p>
                    {insight.acao && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={insight.acao}
                      >
                        {insight.textoAcao}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs de Análises */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="preditivo">Preditivo</TabsTrigger>
        </TabsList>

        {/* TAB: Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <VisaoGeralAnalytics dados={dados} />
        </TabsContent>

        {/* TAB: Vendas */}
        <TabsContent value="vendas" className="space-y-6">
          <VendasAnalytics dados={dados} />
        </TabsContent>

        {/* TAB: Clientes */}
        <TabsContent value="clientes" className="space-y-6">
          <ClientesAnalytics dados={dados} />
        </TabsContent>

        {/* TAB: Performance */}
        <TabsContent value="performance" className="space-y-6">
          <PerformanceAnalytics dados={dados} />
        </TabsContent>

        {/* TAB: Preditivo */}
        <TabsContent value="preditivo" className="space-y-6">
          <PreditivoAnalytics dados={dados} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== COMPONENTE: Visão Geral =====
function VisaoGeralAnalytics({ dados }) {
  const CORES = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

  return (
    <>
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          titulo="Faturamento"
          valor={`R$ ${dados.faturamentoTotal.toLocaleString('pt-BR')}`}
          variacao={dados.crescimentoFaturamento}
          icon={DollarSign}
          cor="from-green-500 to-emerald-600"
        />
        <MetricCard
          titulo="Vendas Fechadas"
          valor={dados.totalVendas}
          variacao={dados.crescimentoVendas}
          icon={TrendingUp}
          cor="from-blue-500 to-cyan-600"
        />
        <MetricCard
          titulo="Taxa Conversão"
          valor={`${dados.taxaConversao}%`}
          variacao={dados.variacaoConversao}
          icon={Target}
          cor="from-purple-500 to-pink-600"
        />
        <MetricCard
          titulo="Clientes Ativos"
          valor={dados.clientesAtivos}
          variacao={dados.crescimentoClientes}
          icon={Users}
          cor="from-orange-500 to-red-600"
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Temporal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Evolução de Faturamento e Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dados.evolucaoTemporal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="faturamento"
                  fill="#818cf8"
                  stroke="#6366f1"
                  fillOpacity={0.3}
                  name="Faturamento (R$)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="vendas"
                  fill="#10b981"
                  name="Vendas (#)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Segmento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-purple-600" />
              Faturamento por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dados.faturamentoPorSegmento}
                  dataKey="valor"
                  nameKey="segmento"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {dados.faturamentoPorSegmento.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Conversão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            Funil de Conversão Detalhado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dados.funnelDetalhado.map((etapa, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${etapa.cor} flex items-center justify-center text-white font-bold`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{etapa.nome}</h4>
                      <p className="text-sm text-slate-600">{etapa.quantidade} registros</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{etapa.percentual}%</p>
                    <p className="text-xs text-slate-500">do total</p>
                  </div>
                </div>
                <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full bg-gradient-to-r ${etapa.cor} transition-all duration-500`}
                    style={{ width: `${etapa.percentual}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ===== COMPONENTE: Análise de Vendas =====
function VendasAnalytics({ dados }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Médio por Período */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução do Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dados.ticketMedioPorPeriodo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ticket_medio"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Ticket Médio"
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="meta_ticket"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Meta"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Vendas por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo de Venda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados.vendasPorTipo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantidade" fill="#6366f1" name="Quantidade" />
                <Bar dataKey="valor_total" fill="#10b981" name="Valor Total (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Produtos/Serviços */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Top 10 Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dados.topProdutos.slice(0, 10).map((produto, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  idx < 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{produto.nome}</p>
                  <p className="text-sm text-slate-600">{produto.quantidade} vendas</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">R$ {produto.valor_total.toLocaleString('pt-BR')}</p>
                  <Badge className="bg-indigo-100 text-indigo-800 mt-1">
                    {produto.percentual_total}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ===== COMPONENTE: Análise de Clientes =====
function ClientesAnalytics({ dados }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Distribuição de Score de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados.distribuicaoScore}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="faixa" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="url(#scoreGradient)" />
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Matriz de Segmentação */}
        <Card>
          <CardHeader>
            <CardTitle>Matriz Valor vs Engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="valor_cliente"
                  name="Valor do Cliente"
                  label={{ value: 'Valor (R$)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  type="number"
                  dataKey="score_engagement"
                  name="Score de Engajamento"
                  label={{ value: 'Engajamento', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter
                  name="Clientes"
                  data={dados.matrizSegmentacao}
                  fill="#8b5cf6"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Clientes em Risco */}
      <Card className="border-2 border-red-300 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Clientes em Risco de Churn ({dados.clientesRisco.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dados.clientesRisco.slice(0, 9).map((cliente, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-slate-900 mb-2">{cliente.nome}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Risco Churn:</span>
                    <Badge className="bg-red-500 text-white">{cliente.risco_churn}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Último Contato:</span>
                    <span className="font-medium">{cliente.dias_sem_contato} dias atrás</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Valor Mensal:</span>
                    <span className="font-medium">R$ {cliente.valor_mensal?.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ===== COMPONENTE: Performance =====
function PerformanceAnalytics({ dados }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar de Performance por Vendedor */}
        <Card>
          <CardHeader>
            <CardTitle>Radar de Competências - Vendedores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={dados.radarVendedores}>
                <PolarGrid />
                <PolarAngleAxis dataKey="competencia" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Média da Equipe"
                  dataKey="media_equipe"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Top Performer"
                  dataKey="top_performer"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.5}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Eficiência Operacional */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Eficiência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dados.metricasEficiencia.map((metrica, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{metrica.nome}</span>
                    <span className="text-lg font-bold text-slate-900">{metrica.valor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${metrica.cor} transition-all duration-500`}
                        style={{ width: `${metrica.percentual}%` }}
                      />
                    </div>
                    <Badge className={`${
                      metrica.status === 'excelente' ? 'bg-green-100 text-green-800' :
                      metrica.status === 'bom' ? 'bg-blue-100 text-blue-800' :
                      metrica.status === 'atencao' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {metrica.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Atividades da Equipe */}
      <Card>
        <CardHeader>
          <CardTitle>Volume de Atividades por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados.atividadesPorTipo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="tipo" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="realizadas" fill="#6366f1" name="Realizadas" />
              <Bar dataKey="planejadas" fill="#cbd5e1" name="Planejadas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}

// ===== COMPONENTE: Análise Preditiva =====
function PreditivoAnalytics({ dados }) {
  return (
    <>
      {/* Previsão de Faturamento */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Sparkles className="w-5 h-5" />
            Previsão de Faturamento - Próximos 3 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dados.previsaoFaturamento}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Legend />
              <Bar dataKey="realizado" fill="#6366f1" name="Realizado" />
              <Bar dataKey="pipeline" fill="#8b5cf6" name="Pipeline" />
              <Line
                type="monotone"
                dataKey="previsao"
                stroke="#ec4899"
                strokeWidth={3}
                strokeDasharray="5 5"
                name="Previsão IA"
                dot={{ r: 6, fill: '#ec4899' }}
              />
              <Area
                type="monotone"
                dataKey="intervalo_confianca_superior"
                stroke="none"
                fill="#ec4899"
                fillOpacity={0.1}
                name="Intervalo de Confiança"
              />
              <Area
                type="monotone"
                dataKey="intervalo_confianca_inferior"
                stroke="none"
                fill="#ec4899"
                fillOpacity={0.1}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Probabilidade de Conversão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Orçamentos por Probabilidade de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dados.orcamentosPorProbabilidade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="faixa" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="url(#probGradient)" name="Orçamentos" />
                <Bar dataKey="valor_total" fill="#10b981" name="Valor Total (R$)" />
                <defs>
                  <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recomendações da IA */}
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <Brain className="w-5 h-5" />
              Recomendações Estratégicas da IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dados.recomendacoesIA.map((rec, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-indigo-200">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      rec.prioridade === 'alta' ? 'bg-red-500' :
                      rec.prioridade === 'media' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}>
                      {rec.icone && <rec.icone className="w-4 h-4 text-white" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{rec.titulo}</h4>
                      <p className="text-sm text-slate-700 mt-1">{rec.descricao}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                          Impacto: {rec.impacto_estimado}
                        </Badge>
                        <Badge className={`text-xs ${
                          rec.prioridade === 'alta' ? 'bg-red-100 text-red-800' :
                          rec.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {rec.prioridade}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ===== COMPONENTE: Metric Card =====
function MetricCard({ titulo, valor, variacao, icon: Icon, cor }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 mb-1">{titulo}</p>
            <p className="text-2xl font-bold text-slate-900">{valor}</p>
            {variacao !== undefined && (
              <div className={`flex items-center gap-1 mt-1 ${
                variacao >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {variacao >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">
                  {variacao >= 0 ? '+' : ''}{variacao}%
                </span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${cor} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== FUNÇÕES AUXILIARES =====

function processarDados(dados, periodo) {
  // Implementação simplificada - você pode expandir com lógica real
  return {
    faturamentoTotal: dados.vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0),
    totalVendas: dados.vendas.length,
    taxaConversao: Math.round((dados.vendas.length / Math.max(dados.orcamentos.length, 1)) * 100),
    clientesAtivos: dados.clientes.filter(c => c.status === 'Ativo').length,
    crescimentoFaturamento: 15,
    crescimentoVendas: 8,
    variacaoConversao: -3,
    crescimentoClientes: 5,

    // Dados para gráficos
    evolucaoTemporal: gerarEvolucaoTemporal(dados.vendas),
    faturamentoPorSegmento: calcularFaturamentoPorSegmento(dados.clientes, dados.vendas),
    funnelDetalhado: gerarFunnelDetalhado(dados),
    ticketMedioPorPeriodo: gerarTicketMedio(dados.vendas),
    vendasPorTipo: calcularVendasPorTipo(dados.vendas),
    topProdutos: calcularTopProdutos(dados.vendas),
    distribuicaoScore: calcularDistribuicaoScore(dados.scores),
    matrizSegmentacao: gerarMatrizSegmentacao(dados.clientes, dados.scores),
    clientesRisco: identificarClientesRisco(dados.clientes, dados.scores),
    radarVendedores: gerarRadarVendedores(dados.vendedores, dados.vendas, dados.interacoes),
    metricasEficiencia: calcularMetricasEficiencia(dados),
    atividadesPorTipo: calcularAtividadesPorTipo(dados.interacoes),
    previsaoFaturamento: gerarPrevisaoFaturamento(dados.vendas),
    orcamentosPorProbabilidade: calcularOrcamentosPorProbabilidade(dados.orcamentos),
    recomendacoesIA: gerarRecomendacoesIA(dados)
  };
}

function gerarInsights(dados) {
  const insights = [];

  // Insight sobre crescimento
  if (dados.crescimentoFaturamento > 10) {
    insights.push({
      tipo: 'positivo',
      titulo: 'Crescimento Forte',
      descricao: `Faturamento cresceu ${dados.crescimentoFaturamento}% no período. Excelente performance!`,
    });
  }

  // Insight sobre taxa de conversão
  if (dados.taxaConversao < 20) {
    insights.push({
      tipo: 'atencao',
      titulo: 'Taxa de Conversão Baixa',
      descricao: `Apenas ${dados.taxaConversao}% dos orçamentos viraram vendas. Considere revisar estratégias de follow-up.`,
    });
  }

  // Insight sobre clientes em risco
  if (dados.clientesRisco.length > 5) {
    insights.push({
      tipo: 'critico',
      titulo: `${dados.clientesRisco.length} Clientes em Risco`,
      descricao: 'Recomenda-se ação imediata para evitar churn e perda de receita.',
      textoAcao: 'Ver Clientes',
      acao: () => console.log('Navegar para clientes em risco')
    });
  }

  return insights;
}

// Funções de cálculo (implementações simplificadas)
function gerarEvolucaoTemporal(vendas) {
  const ultimos4Meses = [];
  const hoje = new Date();

  for (let i = 3; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesAno = data.toISOString().slice(0, 7);
    const nomeMs = data.toLocaleDateString('pt-BR', { month: 'short' });

    const vendasMes = vendas.filter(v => v.data_venda?.slice(0, 7) === mesAno);
    const faturamento = vendasMes.reduce((acc, v) => acc + (v.valor_total || 0), 0);

    ultimos4Meses.push({
      periodo: nomeMs,
      faturamento,
      vendas: vendasMes.length
    });
  }

  return ultimos4Meses;
}

function calcularFaturamentoPorSegmento(clientes, vendas) {
  const segmentos = {};

  vendas.forEach(venda => {
    const cliente = clientes.find(c => c.razao_social === venda.cliente_nome);
    const segmento = cliente?.segmento || 'Não definido';
    segmentos[segmento] = (segmentos[segmento] || 0) + (venda.valor_total || 0);
  });

  return Object.entries(segmentos).map(([segmento, valor]) => ({
    segmento,
    valor
  }));
}

function gerarFunnelDetalhado(dados) {
  const total = dados.orcamentos.length;
  return [
    {
      nome: 'Orçamentos Criados',
      quantidade: total,
      percentual: 100,
      cor: 'from-blue-400 to-blue-600'
    },
    {
      nome: 'Em Negociação',
      quantidade: dados.orcamentos.filter(o => o.status === 'negociando').length,
      percentual: Math.round((dados.orcamentos.filter(o => o.status === 'negociando').length / total) * 100),
      cor: 'from-yellow-400 to-yellow-600'
    },
    {
      nome: 'Vendas Fechadas',
      quantidade: dados.vendas.length,
      percentual: Math.round((dados.vendas.length / total) * 100),
      cor: 'from-green-400 to-green-600'
    }
  ];
}

function gerarTicketMedio(vendas) {
  // Simplificado - retorna dados mockados
  return [
    { periodo: 'Jan', ticket_medio: 5000, meta_ticket: 4500 },
    { periodo: 'Fev', ticket_medio: 5500, meta_ticket: 4500 },
    { periodo: 'Mar', ticket_medio: 4800, meta_ticket: 4500 },
    { periodo: 'Abr', ticket_medio: 6200, meta_ticket: 4500 }
  ];
}

function calcularVendasPorTipo(vendas) {
  const tipos = {};
  vendas.forEach(v => {
    const tipo = v.tipo_venda || 'Não definido';
    if (!tipos[tipo]) tipos[tipo] = { tipo, quantidade: 0, valor_total: 0 };
    tipos[tipo].quantidade++;
    tipos[tipo].valor_total += v.valor_total || 0;
  });
  return Object.values(tipos);
}

function calcularTopProdutos(vendas) {
  const produtos = {};
  const totalGeral = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);

  vendas.forEach(venda => {
    if (venda.produtos && Array.isArray(venda.produtos)) {
      venda.produtos.forEach(prod => {
        const key = prod.nome || prod.codigo || 'Produto sem nome';
        if (!produtos[key]) {
          produtos[key] = { nome: key, quantidade: 0, valor_total: 0 };
        }
        produtos[key].quantidade += prod.quantidade || 1;
        produtos[key].valor_total += prod.valor_total || 0;
      });
    }
  });

  return Object.values(produtos)
    .map(p => ({
      ...p,
      percentual_total: totalGeral > 0 ? ((p.valor_total / totalGeral) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.valor_total - a.valor_total);
}

function calcularDistribuicaoScore(scores) {
  const faixas = [
    { faixa: '0-200', min: 0, max: 200, quantidade: 0 },
    { faixa: '201-400', min: 201, max: 400, quantidade: 0 },
    { faixa: '401-600', min: 401, max: 600, quantidade: 0 },
    { faixa: '601-800', min: 601, max: 800, quantidade: 0 },
    { faixa: '801-1000', min: 801, max: 1000, quantidade: 0 }
  ];

  scores.forEach(s => {
    const score = s.score_total || 0;
    const faixa = faixas.find(f => score >= f.min && score <= f.max);
    if (faixa) faixa.quantidade++;
  });

  return faixas;
}

function gerarMatrizSegmentacao(clientes, scores) {
  return clientes.slice(0, 50).map(c => {
    const score = scores.find(s => s.cliente_id === c.id);
    return {
      nome: c.razao_social,
      valor_cliente: c.valor_recorrente_mensal || 0,
      score_engagement: score?.score_engagement || 0
    };
  });
}

function identificarClientesRisco(clientes, scores) {
  return scores
    .filter(s => s.risco_churn === 'alto' || s.risco_churn === 'critico')
    .map(s => {
      const cliente = clientes.find(c => c.id === s.cliente_id);
      return {
        id: s.cliente_id,
        nome: cliente?.razao_social || s.cliente_nome,
        risco_churn: s.risco_churn,
        dias_sem_contato: Math.floor(Math.random() * 30) + 7,
        valor_mensal: cliente?.valor_recorrente_mensal
      };
    })
    .slice(0, 10);
}

function gerarRadarVendedores(vendedores, vendas, interacoes) {
  return [
    { competencia: 'Vendas', media_equipe: 70, top_performer: 95 },
    { competencia: 'Follow-up', media_equipe: 65, top_performer: 90 },
    { competencia: 'Conversão', media_equipe: 60, top_performer: 85 },
    { competencia: 'Relacionamento', media_equipe: 75, top_performer: 92 },
    { competencia: 'Negociação', media_equipe: 68, top_performer: 88 }
  ];
}

function calcularMetricasEficiencia(dados) {
  return [
    {
      nome: 'Taxa de Follow-up',
      valor: '82%',
      percentual: 82,
      status: 'bom',
      cor: 'from-blue-500 to-cyan-500'
    },
    {
      nome: 'Tempo Médio de Resposta',
      valor: '2.5h',
      percentual: 70,
      status: 'bom',
      cor: 'from-green-500 to-emerald-500'
    },
    {
      nome: 'Aderência às Metas',
      valor: '95%',
      percentual: 95,
      status: 'excelente',
      cor: 'from-purple-500 to-pink-500'
    },
    {
      nome: 'Ciclo Médio de Venda',
      valor: '18 dias',
      percentual: 60,
      status: 'atencao',
      cor: 'from-yellow-500 to-orange-500'
    }
  ];
}

function calcularAtividadesPorTipo(interacoes) {
  const tipos = {};
  interacoes.forEach(i => {
    const tipo = i.tipo_interacao || 'outro';
    if (!tipos[tipo]) tipos[tipo] = { tipo, realizadas: 0, planejadas: Math.floor(Math.random() * 20) + 10 };
    tipos[tipo].realizadas++;
  });
  return Object.values(tipos);
}

function gerarPrevisaoFaturamento(vendas) {
  // Simplificado - você pode usar ML real aqui
  const baseAtual = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);

  return [
    { mes: 'Atual', realizado: baseAtual, pipeline: 0, previsao: baseAtual },
    {
      mes: '+1',
      realizado: 0,
      pipeline: baseAtual * 0.7,
      previsao: baseAtual * 1.1,
      intervalo_confianca_superior: baseAtual * 1.3,
      intervalo_confianca_inferior: baseAtual * 0.9
    },
    {
      mes: '+2',
      realizado: 0,
      pipeline: baseAtual * 0.5,
      previsao: baseAtual * 1.15,
      intervalo_confianca_superior: baseAtual * 1.4,
      intervalo_confianca_inferior: baseAtual * 0.85
    },
    {
      mes: '+3',
      realizado: 0,
      pipeline: baseAtual * 0.3,
      previsao: baseAtual * 1.2,
      intervalo_confianca_superior: baseAtual * 1.5,
      intervalo_confianca_inferior: baseAtual * 0.8
    }
  ];
}

function calcularOrcamentosPorProbabilidade(orcamentos) {
  const faixas = [
    { faixa: 'Alta (80-100%)', min: 80, quantidade: 0, valor_total: 0 },
    { faixa: 'Média (50-79%)', min: 50, max: 79, quantidade: 0, valor_total: 0 },
    { faixa: 'Baixa (0-49%)', min: 0, max: 49, quantidade: 0, valor_total: 0 }
  ];

  orcamentos.forEach(o => {
    // Simplified probability mapping for mock data
    const prob = o.probabilidade === 'Alta' ? 85 : o.probabilidade === 'Média' ? 65 : 35;
    const faixa = faixas.find(f => !f.max ? prob >= f.min : prob >= f.min && prob <= f.max);
    if (faixa) {
      faixa.quantidade++;
      faixa.valor_total += o.valor_total || 0;
    }
  });

  return faixas;
}

function gerarRecomendacoesIA(dados) {
  return [
    {
      icone: Users,
      titulo: 'Focar em Clientes de Alto Valor',
      descricao: '15 clientes de alto valor não foram contatados nos últimos 14 dias. Priorize follow-up.',
      prioridade: 'alta',
      impacto_estimado: 'R$ 45K'
    },
    {
      icone: Target,
      titulo: 'Otimizar Funil de Conversão',
      descricao: '32 orçamentos estão parados há mais de 7 dias. Implemente automação de follow-up.',
      prioridade: 'media',
      impacto_estimado: '12% conversão'
    },
    {
      icone: Clock,
      titulo: 'Reduzir Ciclo de Venda',
      descricao: 'Ciclo médio está 20% acima do ideal. Considere simplificar processo de aprovação.',
      prioridade: 'baixa',
      impacto_estimado: '5 dias'
    }
  ];
}
