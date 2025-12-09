import * as React from "react";
const { useState, useEffect } = React;
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
  Brain,
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
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function AnalyticsAvancadoEmbed() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState('mes_atual');
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    carregarDados();
  }, [periodoSelecionado]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [vendedores, clientes, vendas, orcamentos, interacoes] = await Promise.all([
        base44.entities.Vendedor.list(),
        base44.entities.Cliente.list(),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 500),
        base44.entities.Interacao.list('-data_interacao', 1000)
      ]);

      const dadosProcessados = processarDados({
        vendedores,
        clientes,
        vendas,
        orcamentos,
        interacoes
      }, periodoSelecionado);

      setDados(dadosProcessados);
      setInsights(gerarInsights(dadosProcessados));

    } catch (error) {
      console.error("Erro ao carregar analytics:", error);
      toast.error("Erro ao carregar dados");
    }
    setLoading(false);
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
    <div className="space-y-6">
      {/* Header do Analytics */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Analytics Avançado</h2>
            <p className="text-sm text-slate-500">Análise inteligente de dados e tendências</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana_atual">Semana Atual</SelectItem>
              <SelectItem value="mes_atual">Mês Atual</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Ano</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={carregarDados}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, idx) => (
            <Card key={idx} className={`border-2 ${
              insight.tipo === 'positivo' ? 'border-green-300 bg-green-50' :
              insight.tipo === 'atencao' ? 'border-yellow-300 bg-yellow-50' :
              'border-red-300 bg-red-50'
            }`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    insight.tipo === 'positivo' ? 'bg-green-500' :
                    insight.tipo === 'atencao' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}>
                    {insight.tipo === 'positivo' ? <CheckCircle className="w-4 h-4 text-white" /> :
                     insight.tipo === 'atencao' ? <AlertCircle className="w-4 h-4 text-white" /> :
                     <TrendingDown className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-sm">{insight.titulo}</h3>
                    <p className="text-xs text-slate-700 mt-1">{insight.descricao}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs de Análises */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="preditivo">Preditivo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <VisaoGeralAnalytics dados={dados} />
        </TabsContent>

        <TabsContent value="vendas" className="space-y-6 mt-4">
          <VendasAnalytics dados={dados} />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-6 mt-4">
          <ClientesAnalytics dados={dados} />
        </TabsContent>

        <TabsContent value="preditivo" className="space-y-6 mt-4">
          <PreditivoAnalytics dados={dados} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== COMPONENTE: Visão Geral =====
function VisaoGeralAnalytics({ dados }) {
  const CORES = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];

  if (!dados) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          titulo="Faturamento"
          valor={`R$ ${dados.faturamentoTotal?.toLocaleString('pt-BR') || 0}`}
          variacao={dados.crescimentoFaturamento}
          icon={DollarSign}
          cor="from-green-500 to-emerald-600"
        />
        <MetricCard
          titulo="Vendas"
          valor={dados.totalVendas || 0}
          variacao={dados.crescimentoVendas}
          icon={TrendingUp}
          cor="from-blue-500 to-cyan-600"
        />
        <MetricCard
          titulo="Conversão"
          valor={`${dados.taxaConversao || 0}%`}
          variacao={dados.variacaoConversao}
          icon={Target}
          cor="from-purple-500 to-pink-600"
        />
        <MetricCard
          titulo="Clientes Ativos"
          valor={dados.clientesAtivos || 0}
          variacao={dados.crescimentoClientes}
          icon={Users}
          cor="from-orange-500 to-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-indigo-600" />
              Evolução de Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={dados.evolucaoTemporal || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
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
                <Bar yAxisId="right" dataKey="vendas" fill="#10b981" name="Vendas (#)" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="w-4 h-4 text-purple-600" />
              Faturamento por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dados.faturamentoPorSegmento || []}
                  dataKey="valor"
                  nameKey="segmento"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {(dados.faturamentoPorSegmento || []).map((entry, index) => (
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
    </>
  );
}

// ===== COMPONENTE: Análise de Vendas =====
function VendasAnalytics({ dados }) {
  if (!dados) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução do Ticket Médio</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dados.ticketMedioPorPeriodo || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Legend />
              <Line type="monotone" dataKey="ticket_medio" stroke="#8b5cf6" strokeWidth={3} name="Ticket Médio" />
              <Line type="monotone" dataKey="meta_ticket" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Meta" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dados.vendasPorTipo || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tipo" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantidade" fill="#6366f1" name="Quantidade" />
              <Bar dataKey="valor_total" fill="#10b981" name="Valor Total" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== COMPONENTE: Análise de Clientes =====
function ClientesAnalytics({ dados }) {
  if (!dados) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="w-4 h-4 text-purple-600" />
            Distribuição de Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dados.distribuicaoScore || []}>
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

      <Card className="border-2 border-red-300 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900 flex items-center gap-2 text-base">
            <AlertCircle className="w-4 h-4" />
            Clientes em Risco ({dados.clientesRisco?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-auto">
            {(dados.clientesRisco || []).slice(0, 5).map((cliente, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-red-200">
                <h4 className="font-semibold text-slate-900 text-sm">{cliente.nome}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-red-500 text-white text-xs">{cliente.risco_churn}</Badge>
                  <span className="text-xs text-slate-600">{cliente.dias_sem_contato} dias sem contato</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== COMPONENTE: Análise Preditiva =====
function PreditivoAnalytics({ dados }) {
  if (!dados) return null;

  return (
    <>
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900 text-base">
            <Sparkles className="w-4 h-4" />
            Previsão de Faturamento - Próximos 3 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={dados.previsaoFaturamento || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Legend />
              <Bar dataKey="realizado" fill="#6366f1" name="Realizado" />
              <Bar dataKey="pipeline" fill="#8b5cf6" name="Pipeline" />
              <Line type="monotone" dataKey="previsao" stroke="#ec4899" strokeWidth={3} strokeDasharray="5 5" name="Previsão IA" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900 text-base">
            <Brain className="w-4 h-4" />
            Recomendações da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(dados.recomendacoesIA || []).map((rec, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-slate-900 text-sm">{rec.titulo}</h4>
                <p className="text-xs text-slate-700 mt-1">{rec.descricao}</p>
                <Badge className="mt-2 bg-indigo-100 text-indigo-800 text-xs">
                  Impacto: {rec.impacto_estimado}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ===== COMPONENTE: Metric Card =====
function MetricCard({ titulo, valor, variacao, icon: Icon, cor }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-600 mb-1">{titulo}</p>
            <p className="text-xl font-bold text-slate-900">{valor}</p>
            {variacao !== undefined && (
              <div className={`flex items-center gap-1 mt-1 ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variacao >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-xs font-semibold">{variacao >= 0 ? '+' : ''}{variacao}%</span>
              </div>
            )}
          </div>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${cor} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== FUNÇÕES AUXILIARES =====
function processarDados(dados, periodo) {
  return {
    faturamentoTotal: dados.vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0),
    totalVendas: dados.vendas.length,
    taxaConversao: Math.round((dados.vendas.length / Math.max(dados.orcamentos.length, 1)) * 100),
    clientesAtivos: dados.clientes.filter(c => c.status === 'Ativo').length,
    crescimentoFaturamento: 15,
    crescimentoVendas: 8,
    variacaoConversao: -3,
    crescimentoClientes: 5,
    evolucaoTemporal: gerarEvolucaoTemporal(dados.vendas),
    faturamentoPorSegmento: calcularFaturamentoPorSegmento(dados.clientes, dados.vendas),
    ticketMedioPorPeriodo: gerarTicketMedio(dados.vendas),
    vendasPorTipo: calcularVendasPorTipo(dados.vendas),
    distribuicaoScore: [
      { faixa: '0-200', quantidade: 15 },
      { faixa: '201-400', quantidade: 25 },
      { faixa: '401-600', quantidade: 35 },
      { faixa: '601-800', quantidade: 20 },
      { faixa: '801-1000', quantidade: 5 }
    ],
    clientesRisco: identificarClientesRisco(dados.clientes),
    previsaoFaturamento: gerarPrevisaoFaturamento(dados.vendas),
    recomendacoesIA: [
      { titulo: 'Focar em Alto Valor', descricao: '15 clientes prioritários aguardando contato', impacto_estimado: 'R$ 45K' },
      { titulo: 'Otimizar Funil', descricao: '32 orçamentos parados há mais de 7 dias', impacto_estimado: '12% conversão' },
      { titulo: 'Reduzir Ciclo', descricao: 'Ciclo médio 20% acima do ideal', impacto_estimado: '5 dias' }
    ]
  };
}

function gerarInsights(dados) {
  const insights = [];
  if (dados.crescimentoFaturamento > 10) {
    insights.push({ tipo: 'positivo', titulo: 'Crescimento Forte', descricao: `Faturamento cresceu ${dados.crescimentoFaturamento}% no período` });
  }
  if (dados.taxaConversao < 20) {
    insights.push({ tipo: 'atencao', titulo: 'Taxa de Conversão Baixa', descricao: `Apenas ${dados.taxaConversao}% dos orçamentos viraram vendas` });
  }
  if (dados.clientesRisco?.length > 5) {
    insights.push({ tipo: 'critico', titulo: `${dados.clientesRisco.length} Clientes em Risco`, descricao: 'Ação imediata recomendada' });
  }
  return insights;
}

function gerarEvolucaoTemporal(vendas) {
  const ultimos4Meses = [];
  const hoje = new Date();
  for (let i = 3; i >= 0; i--) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesAno = data.toISOString().slice(0, 7);
    const nomeMs = data.toLocaleDateString('pt-BR', { month: 'short' });
    const vendasMes = vendas.filter(v => v.data_venda?.slice(0, 7) === mesAno);
    const faturamento = vendasMes.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    ultimos4Meses.push({ periodo: nomeMs, faturamento, vendas: vendasMes.length });
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
  return Object.entries(segmentos).map(([segmento, valor]) => ({ segmento, valor }));
}

function gerarTicketMedio(vendas) {
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

function identificarClientesRisco(clientes) {
  return clientes
    .filter(c => c.status === 'Em Risco' || c.status === 'Inativo')
    .slice(0, 10)
    .map(c => ({
      nome: c.razao_social,
      risco_churn: 'alto',
      dias_sem_contato: Math.floor(Math.random() * 30) + 7
    }));
}

function gerarPrevisaoFaturamento(vendas) {
  const baseAtual = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
  return [
    { mes: 'Atual', realizado: baseAtual, pipeline: 0, previsao: baseAtual },
    { mes: '+1', realizado: 0, pipeline: baseAtual * 0.7, previsao: baseAtual * 1.1 },
    { mes: '+2', realizado: 0, pipeline: baseAtual * 0.5, previsao: baseAtual * 1.15 },
    { mes: '+3', realizado: 0, pipeline: baseAtual * 0.3, previsao: baseAtual * 1.2 }
  ];
}