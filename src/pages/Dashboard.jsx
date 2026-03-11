import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Users, DollarSign, Target, Award, Calendar, Filter, BarChart3, Brain, Zap, AlertCircle, CheckCircle, TrendingDown, Activity, ChevronRight, Building2 } from "lucide-react";

import VisaoGeralEmpresa from "../components/dashboard/VisaoGeralEmpresa";
import PerformanceVendedores from "../components/dashboard/PerformanceVendedores";
import AnaliseClientes from "../components/dashboard/AnaliseClientes";
import MetricasOperacionais from "../components/dashboard/MetricasOperacionais";
import FiltrosAvancados from "../components/dashboard/FiltrosAvancados";
import ExportadorDashboard from "../components/dashboard/ExportadorDashboard";
import AnalyticsAvancadoEmbed from "@/components/dashboard/AnalyticsAvancadoEmbed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import AlertasInteligentesIA from "../components/global/AlertasInteligentesIA";
import BotaoNexusFlutuante from "../components/global/BotaoNexusFlutuante";

// Cache global para evitar chamadas desnecessárias
const dashboardCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 60000 // 1 minuto
};

const FiltroMes = ({ mesSelecionado, onMesChange }) => {
  const meses = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" }
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="mes-filtro" className="text-sm font-medium text-white">Mês:</label>
      <select
        id="mes-filtro"
        value={mesSelecionado}
        onChange={onMesChange}
        className="p-2 border border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-slate-700 text-white">
        {meses.map((mes) =>
          <option key={mes.value} value={mes.value}>
            {mes.label}
          </option>
        )}
      </select>
    </div>
  );
};

// ✨ CONFIGURAÇÃO DE PRIORIDADES - MESMO PADRÃO DOS LEMBRETES
const PRIORIDADE_CONFIG = {
  critica: {
    icon: AlertCircle,
    cardBg: 'bg-gradient-to-r from-red-500 to-pink-600',
    badge: 'CRÍTICA',
    badgeColor: 'bg-red-600'
  },
  alta: {
    icon: Zap,
    cardBg: 'bg-gradient-to-r from-orange-500 to-amber-600',
    badge: 'ALTA',
    badgeColor: 'bg-orange-600'
  },
  media: {
    icon: Activity,
    cardBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    badge: 'MÉDIA',
    badgeColor: 'bg-blue-600'
  },
  baixa: {
    icon: CheckCircle,
    cardBg: 'bg-gradient-to-r from-slate-500 to-slate-600',
    badge: 'BAIXA',
    badgeColor: 'bg-slate-600'
  }
};

const MetricCard = ({ titulo, valor, icone: Icon, cor, descricao, trend, trendValue }) => {
  return (
    <div className={`relative bg-gradient-to-br ${cor} p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-[1.02] text-white overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="flex items-center justify-between relative z-10">
        <div>
          <h3 className="text-sm font-medium opacity-80">{titulo}</h3>
          <p className="text-3xl font-bold mt-1">{valor}</p>
          {trend &&
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-semibold">{trendValue}</span>
            </div>
          }
        </div>
        <div className="bg-white/20 p-3 rounded-full">
          {Icon && <Icon className="w-6 h-6" />}
        </div>
      </div>
      {descricao && <p className="text-xs mt-3 opacity-75">{descricao}</p>}
    </div>
  );
};

export default function Dashboard() {
  const [dados, setDados] = useState({
    vendedores: [],
    clientes: [],
    vendas: [],
    orcamentos: [],
    interacoes: []
  });

  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('empresa');
  const navigate = useNavigate();

  const [filtros, setFiltros] = useState({
    periodo: 'mes_atual',
    vendedor: 'todos',
    segmento: 'todos',
    regiao: 'todos',
    dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    dataFim: new Date().toISOString().slice(0, 10)
  });

  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);

  // Novas métricas de IA
  const [metricasIA, setMetricasIA] = useState(null);
  const [alertasIA, setAlertasIA] = useState([]);
  const [fluxosAtivos, setFluxosAtivos] = useState([]);

  const filtrarDadosPorPerfil = (usuario, dados) => {
    if (usuario.role === 'user') {
      const vendedorAtual = dados.vendedores.find((v) => v.email === usuario.email);
      const nomeVendedor = vendedorAtual?.nome || usuario.full_name;

      return {
        vendedores: dados.vendedores.filter((v) => v.email === usuario.email),
        clientes: dados.clientes.filter((c) => c.vendedor_responsavel === nomeVendedor),
        vendas: dados.vendas.filter((v) => v.vendedor === nomeVendedor),
        orcamentos: dados.orcamentos.filter((o) => o.vendedor === nomeVendedor),
        interacoes: dados.interacoes.filter((i) => i.vendedor === nomeVendedor)
      };
    }

    return dados;
  };

  const aplicarFiltros = (dados, filtros) => {
    let { vendas, orcamentos, clientes, vendedores, interacoes } = dados;

    if (filtros.periodo !== 'todos') {
      const hoje = new Date();
      let dataInicio, dataFim;

      switch (filtros.periodo) {
        case 'hoje':
          dataInicio = dataFim = hoje.toISOString().slice(0, 10);
          break;
        case 'semana_atual':
          const inicioSemana = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
          dataInicio = inicioSemana.toISOString().slice(0, 10);
          dataFim = new Date().toISOString().slice(0, 10);
          break;
        case 'mes_atual':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
          dataFim = new Date().toISOString().slice(0, 10);
          break;
        case 'trimestre_atual':
          const mesAtual = hoje.getMonth();
          const inicioTrimestre = Math.floor(mesAtual / 3) * 3;
          dataInicio = new Date(hoje.getFullYear(), inicioTrimestre, 1).toISOString().slice(0, 10);
          dataFim = new Date().toISOString().slice(0, 10);
          break;
        case 'personalizado':
          dataInicio = filtros.dataInicio;
          dataFim = filtros.dataFim;
          break;
        default:
          break;
      }

      if (dataInicio && dataFim) {
        vendas = vendas.filter((v) => v.data_venda >= dataInicio && v.data_venda <= dataFim);
        orcamentos = orcamentos.filter((o) => o.data_orcamento >= dataInicio && o.data_orcamento <= dataFim);
        interacoes = interacoes.filter((i) => i.data_interacao?.slice(0, 10) >= dataInicio && i.data_interacao?.slice(0, 10) <= dataFim);
      }
    }

    if (filtros.vendedor !== 'todos') {
      vendas = vendas.filter((v) => v.vendedor === filtros.vendedor);
      orcamentos = orcamentos.filter((o) => o.vendedor === filtros.vendedor);
      clientes = clientes.filter((c) => c.vendedor_responsavel === filtros.vendedor);
      interacoes = interacoes.filter((i) => i.vendedor === filtros.vendedor);
    }

    if (filtros.segmento !== 'todos') {
      clientes = clientes.filter((c) => c.segmento === filtros.segmento);
      const clientesNomes = clientes.map((c) => c.razao_social);
      vendas = vendas.filter((v) => clientesNomes.includes(v.cliente_nome));
      orcamentos = orcamentos.filter((o) => clientesNomes.includes(o.cliente_nome));
      interacoes = interacoes.filter((i) => clientesNomes.includes(i.cliente_nome));
    }

    return { vendedores, clientes, vendas, orcamentos, interacoes };
  };

  const handleMesChange = (e) => {
    const selectedMonth = parseInt(e.target.value);
    setMesSelecionado(selectedMonth);

    const anoAtual = new Date().getFullYear();
    const dataInicioMes = new Date(anoAtual, selectedMonth - 1, 1).toISOString().slice(0, 10);
    const dataFimMes = new Date(anoAtual, selectedMonth, 0).toISOString().slice(0, 10);

    setFiltros((prevFiltros) => ({
      ...prevFiltros,
      periodo: 'personalizado',
      dataInicio: dataInicioMes,
      dataFim: dataFimMes
    }));

    base44.analytics.track({
      eventName: "dashboard_period_changed",
      properties: { month: selectedMonth, year: anoAtual }
    });
  };

  const carregarDadosComCache = useCallback(async () => {
    const agora = Date.now();

    if (
      dashboardCache.data &&
      dashboardCache.timestamp &&
      agora - dashboardCache.timestamp < dashboardCache.CACHE_DURATION
    ) {
      console.log("📦 Usando dados do cache do Dashboard");
      return dashboardCache.data;
    }

    console.log("🔄 Carregando dados do Dashboard...");

    try {
      const usuarioAtual = await base44.auth.me();

      const [vendedoresData, clientesData, vendasData, orcamentosData, interacoesData] = await Promise.all([
        base44.entities.Vendedor.list('-created_date', 100),
        base44.entities.Cliente.list('-updated_date', 500),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 300),
        base44.entities.Interacao.list('-data_interacao', 500)
      ]);

      const dadosCarregados = {
        usuario: usuarioAtual,
        vendedores: vendedoresData,
        clientes: clientesData,
        vendas: vendasData,
        orcamentos: orcamentosData,
        interacoes: interacoesData
      };

      dashboardCache.data = dadosCarregados;
      dashboardCache.timestamp = agora;

      console.log("✅ Dashboard carregado com sucesso");

      return dadosCarregados;
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);

      if (error.message?.includes('429') || error.response?.status === 429) {
        console.log("⚠️ Rate limit - usando cache antigo");
        if (dashboardCache.data) {
          return dashboardCache.data;
        }
      }

      throw error;
    }
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const dadosCarregados = await carregarDadosComCache();
      setUsuario(dadosCarregados.usuario);

      let dadosFiltrados = filtrarDadosPorPerfil(dadosCarregados.usuario, {
        vendedores: dadosCarregados.vendedores,
        clientes: dadosCarregados.clientes,
        vendas: dadosCarregados.vendas,
        orcamentos: dadosCarregados.orcamentos,
        interacoes: dadosCarregados.interacoes
      });

      dadosFiltrados = aplicarFiltros(dadosFiltrados, filtros);
      setDados(dadosFiltrados);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setDados({
        vendedores: [],
        clientes: [],
        vendas: [],
        orcamentos: [],
        interacoes: []
      });
    }
    setLoading(false);
  }, [filtros, carregarDadosComCache]);

  const carregarMetricasIA = async () => {
    try {
      const anoAtual = new Date().getFullYear();
      const dataInicio = new Date(anoAtual, mesSelecionado - 1, 1).toISOString();
      const dataFim = new Date(anoAtual, mesSelecionado, 0, 23, 59, 59, 999).toISOString();

      const [interacoes, threads, tarefas, fluxos, aprendizados] = await Promise.all([
        base44.entities.Interacao.filter({
          data_interacao: { $gte: dataInicio, $lte: dataFim },
          vendedor: 'IA - NexusEngine'
        }),
        base44.entities.MessageThread.list(),
        base44.entities.TarefaInteligente.filter({ status: 'pendente' }),
        base44.entities.FlowExecution.filter({ status: 'ativo' }),
        base44.entities.AprendizadoIA.list('-created_date', 5)
      ]);

      const totalInteracoesIA = interacoes.length;
      const resolvidasIA = interacoes.filter((i) => i.resultado === 'resolvido_ia').length;
      const taxaResolucao = totalInteracoesIA > 0 ? resolvidasIA / totalInteracoesIA * 100 : 0;

      const threadsNoMes = threads.filter((t) =>
        t.created_date &&
        new Date(t.created_date).getFullYear() === anoAtual &&
        new Date(t.created_date).getMonth() + 1 === mesSelecionado
      );

      const temposResposta = threadsNoMes.
        filter((t) => t.tempo_primeira_resposta_minutos !== null).
        map((t) => t.tempo_primeira_resposta_minutos);

      const latenciaMedia = temposResposta.length > 0 ?
        temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length :
        0;

      const handoffs = threadsNoMes.filter((t) => t.assigned_user_id).length;
      const taxaHandoff = threadsNoMes.length > 0 ? handoffs / threadsNoMes.length * 100 : 0;

      setMetricasIA({
        totalInteracoes: totalInteracoesIA,
        taxaResolucao: Math.round(taxaResolucao),
        latenciaMedia: Math.round(latenciaMedia),
        taxaHandoff: Math.round(taxaHandoff),
        tarefasPendentes: tarefas.length,
        fluxosAtivos: fluxos.length
      });

      setFluxosAtivos(fluxos.slice(0, 5));

      await gerarAlertasIA(tarefas, fluxos, aprendizados);
    } catch (error) {
      console.error("Erro ao carregar métricas de IA:", error);
      setMetricasIA(null);
    }
  };

  const gerarAlertasIA = async (tarefas, fluxos, aprendizados) => {
    const alertas = [];

    const tarefasCriticas = tarefas.filter((t) => t.prioridade === 'critica');
    if (tarefasCriticas.length > 0) {
      alertas.push({
        id: 'tarefas_criticas',
        prioridade: 'critica',
        titulo: `${tarefasCriticas.length} tarefas críticas pendentes`,
        descricao: 'Requerem atenção imediata',
        acao_sugerida: 'Ver Agenda',
        metadata: {
          quantidade: tarefasCriticas.length,
          tipo: 'tarefas'
        },
        onAcao: () => navigate(createPageUrl('Agenda'))
      });
    }

    const fluxosComErro = fluxos.filter((f) => f.status === 'erro');
    if (fluxosComErro.length > 0) {
      alertas.push({
        id: 'fluxos_erro',
        prioridade: 'alta',
        titulo: `${fluxosComErro.length} fluxos com erro`,
        descricao: 'Verifique os logs de execução',
        acao_sugerida: 'Ver Automação',
        metadata: {
          quantidade: fluxosComErro.length,
          tipo: 'fluxos'
        },
        onAcao: () => navigate(createPageUrl('Automacao'))
      });
    }

    if (aprendizados.length > 0) {
      alertas.push({
        id: 'aprendizados_ia',
        prioridade: 'media',
        titulo: `${aprendizados.length} novos aprendizados da IA`,
        descricao: 'Padrões identificados automaticamente',
        acao_sugerida: 'Ver Dashboard IA',
        metadata: {
          quantidade: aprendizados.length,
          tipo: 'aprendizados',
          aprendizados: aprendizados
        },
        onAcao: () => {
          toast.success('🧠 Abrindo Dashboard de Inteligência...');
          navigate(createPageUrl('InteligenciaMetricas'));
        }
      });
    }

    setAlertasIA(alertas);
  };

  useEffect(() => {
    carregarDados();
    base44.analytics.track({
      eventName: "dashboard_viewed",
      properties: { view_mode: viewMode, is_gerente: isGerente }
    });
  }, [carregarDados]);

  useEffect(() => {
    carregarMetricasIA();
  }, [mesSelecionado]);

  const isGerente = usuario?.role === 'admin';
  const nomeUsuario = usuario?.full_name || 'Usuário';

  const navegacao = [
    {
      key: 'empresa',
      label: 'Visão Empresa',
      icon: TrendingUp,
      descricao: 'KPIs consolidados e tendências',
      disponivel: isGerente
    },
    {
      key: 'analytics',
      label: 'Analytics Avançado',
      icon: BarChart3,
      descricao: 'Análises avançadas e BI',
      disponivel: isGerente
    },
    {
      key: 'vendedores',
      label: 'Performance Vendas',
      icon: Award,
      descricao: 'Ranking e análise individual',
      disponivel: true
    },
    {
      key: 'clientes',
      label: 'Análise Clientes',
      icon: Users,
      descricao: 'Segmentação e oportunidades',
      disponivel: true
    },
    {
      key: 'operacional',
      label: 'Métricas Operacionais',
      icon: Target,
      descricao: 'Funil e atividades',
      disponivel: true
    }
  ].
    filter((item) => item.disponivel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      <div className="max-w-[1600px] mx-auto p-2 sm:p-3 md:p-6 space-y-3 md:space-y-6">

        {/* Header Desktop */}
        <div className="hidden md:block bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-400/10 to-red-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-amber-400/10 to-orange-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50 transform hover:scale-105 transition-all duration-300 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
                <BarChart3 className="w-9 h-9 text-white relative z-10" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
                  {isGerente ? 'Dashboard Executivo' : `Performance Individual`}
                </h1>
                <p className="text-slate-300 mt-1 font-medium">
                  {isGerente ? 'Visão completa do desempenho comercial em tempo real' : `Olá, ${nomeUsuario}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiltrosAvancados filtros={filtros} onFiltrosChange={setFiltros} vendedores={dados.vendedores} isGerente={isGerente} />
              <FiltroMes mesSelecionado={mesSelecionado} onMesChange={handleMesChange} />
              <ExportadorDashboard dados={dados} filtros={filtros} viewMode={viewMode} />
            </div>
          </div>
        </div>

        {/* Header Mobile compacto */}
        <div className="md:hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-white font-bold text-base">{isGerente ? 'Dashboard Executivo' : 'Minha Performance'}</p>
            <p className="text-slate-400 text-xs">{isGerente ? 'Desempenho comercial' : `Olá, ${nomeUsuario}`}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <FiltroMes mesSelecionado={mesSelecionado} onMesChange={handleMesChange} />
          </div>
        </div>

        <BotaoNexusFlutuante
          contadorLembretes={alertasIA.length}
          onClick={() => {
            if (alertasIA.length > 0) {
              toast.info(`📊 ${alertasIA.length} alertas de IA`);
            }
          }} />

        <AlertasInteligentesIA
          alertas={alertasIA}
          titulo="Dashboard IA"
          onAcaoExecutada={(alerta) => {
            if (alerta.id === 'fechar_tudo') {
              setAlertasIA([]);
              return;
            }
            if (alerta.onAcao) {
              alerta.onAcao();
            }
            setAlertasIA((prev) => prev.filter((a) => a.id !== alerta.id));
          }} />

        {/* Navegação por Perspectivas - scroll horizontal no mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-3 scrollbar-none">
          {navegacao.map((item) =>
            <button
              key={item.key}
              onClick={() => {
                setViewMode(item.key);
                base44.analytics.track({
                  eventName: "dashboard_tab_clicked",
                  properties: { tab: item.key, tab_label: item.label }
                });
              }}
              className={`flex-shrink-0 bg-gradient-to-br from-orange-500 via-orange-600 to-red-500 hover:from-orange-600 hover:via-red-500 hover:to-red-600 text-slate-50 p-2.5 md:p-3 rounded-xl border border-slate-200/50 transition-all duration-300 shadow-xl ${
                viewMode === item.key ? 'scale-105 ring-2 ring-orange-400' : ''}`
              }>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  viewMode === item.key ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg' : 'bg-white/20 text-slate-100'}`
                }>
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-slate-50 font-semibold text-xs md:text-sm whitespace-nowrap">{item.label}</h3>
                  <p className="text-slate-200 text-xs hidden md:block">{item.descricao}</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Acesso Rápido Kanbans */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate(createPageUrl('LeadsQualificados'))}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Kanban de Gestão de Leads</span>
              <Target className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dados.clientes.filter(c => ['novo_lead','primeiro_contato','em_conversa','levantamento_dados','pre_qualificado','qualificacao_tecnica','em_aquecimento','lead_qualificado'].includes(c.status)).length}</p>
          </button>

          <button
            onClick={() => navigate(createPageUrl('Clientes'))}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Kanban de Gestão de Clientes</span>
              <Users className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dados.clientes.filter(c => ['Ativo','Em Risco','Promotor','Prospect','Inativo'].includes(c.status)).length}</p>
          </button>

          <button
            onClick={() => navigate(createPageUrl('Orcamentos'))}
            className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Pipeline de Orçamentos</span>
              <DollarSign className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dados.orcamentos.length}</p>
          </button>
        </div>

        {/* Estatísticas Resumo - scroll horizontal no mobile */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-3 py-2.5 rounded-xl border border-slate-200/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <div className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>📊 {dados.vendas.length} vendas</span>
            </div>
            <div className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>🎯 {dados.orcamentos.length} orçamentos</span>
            </div>
            <div className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>👥 {dados.clientes.length} clientes</span>
            </div>
            <div className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>📞 {dados.interacoes.length} interações</span>
            </div>
            {isGerente &&
              <div className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
                <span>🏆 {dados.vendedores.length} vendedores</span>
              </div>
            }
          </div>
        </div>

        {/* Conteúdo Dinâmico por Perspectiva */}
        {loading ?
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) =>
              <div key={i} className="bg-slate-100 rounded-xl h-40 md:h-64 animate-pulse border border-slate-200" />
            )}
          </div> :
          <>
            {viewMode === 'empresa' && isGerente &&
              <VisaoGeralEmpresa dados={dados} filtros={filtros} usuario={usuario} />
            }
            {viewMode === 'vendedores' &&
              <PerformanceVendedores dados={dados} filtros={filtros} isGerente={isGerente} usuario={usuario} />
            }
            {viewMode === 'clientes' && <AnaliseClientes dados={dados} filtros={filtros} isGerente={isGerente} />}
            {viewMode === 'operacional' &&
              <MetricasOperacionais dados={dados} filtros={filtros} isGerente={isGerente} />
            }
            {viewMode === 'analytics' && isGerente &&
              <AnalyticsAvancadoEmbed />
            }
          </>
        }
      </div>
    </div>
  );
}