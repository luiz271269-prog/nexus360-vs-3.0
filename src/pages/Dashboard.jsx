import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { TrendingUp, Users, DollarSign, Target, Award, Calendar, Filter, BarChart3, Brain, Zap, AlertCircle, CheckCircle, TrendingDown, Activity, ChevronRight, Building2, Map as MapIcon } from "lucide-react";
import MapaClientes from "@/pages/MapaClientes";
import PrevisaoFaturamento from "../components/dashboard/PrevisaoFaturamento";

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
import AlertasClientesEmRisco from "../components/dashboard/AlertasClientesEmRisco";
import BotaoNexusFlutuante from "../components/global/BotaoNexusFlutuante";
import MetricasNotasFiscais from "../components/dashboard/MetricasNotasFiscais";
import { dedupById, dedupClientes, dedupVendas, dedupOrcamentos, dedupContatos } from "../utils/dedup";
import { getNomeExibicao } from "../components/lib/vendedorSync";
import { buscarNotasFiscaisExternas } from "@/functions/buscarNotasFiscaisExternas";
import MetricasVendasNF from "../components/dashboard/MetricasVendasNF";
import FinanceiroNeuralFin from "../components/dashboard/FinanceiroNeuralFin";
import DetalhesModal from "../components/dashboard/DetalhesModal";
import SeletorVendedor from "../components/dashboard/SeletorVendedor";
import { COLS_NF, COLS_ORCAMENTO, COLS_CLIENTE, COLS_THREAD, COLS_VENDEDOR_ENT } from "../components/dashboard/drilldownColunas";

// Cache global para evitar chamadas desnecessárias
const dashboardCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 60000 // 1 minuto
};

const FiltroMes = ({ mesSelecionado, anoSelecionado, modoAnual, onMesChange, onAnoChange, onModoAnual }) => {
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
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-sm font-medium text-white">Mês:</label>
      <select
        value={mesSelecionado}
        onChange={onMesChange}
        disabled={modoAnual}
        className="p-2 border border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-700 text-white disabled:opacity-50">
        {meses.map((mes) =>
          <option key={mes.value} value={mes.value}>{mes.label}</option>
        )}
      </select>
      <select
        value={anoSelecionado}
        onChange={onAnoChange}
        className="p-2 border border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-slate-700 text-white">
        {anos.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
      <button
        onClick={onModoAnual}
        className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${
          modoAnual ? 'bg-orange-500 border-orange-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-orange-400'
        }`}>
        Anual
      </button>
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
  const [dadosCompletos, setDadosCompletos] = useState({
    vendedores: [],
    clientes: [],
    vendas: [],
    orcamentos: [],
    interacoes: []
  });
  const [notasFiscais, setNotasFiscais] = useState([]);
  const [threadsAtividade, setThreadsAtividade] = useState([]);
  const [vendedoresEntidade, setVendedoresEntidade] = useState([]);

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
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [modoAnual, setModoAnual] = useState(false);

  // Notas fiscais filtradas pelo período selecionado
  // (ano/mês extraídos da string 'YYYY-MM-DD' — new Date() causava shift de fuso p/ o mês anterior)
  const notasFiltradas = notasFiscais.filter(n => {
    const s = String(n.data_emissao || n.created_date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(s)) return false;
    const ano = Number(s.slice(0, 4));
    const mes = Number(s.slice(5, 7));
    if (modoAnual) return ano === anoSelecionado;
    return mes === mesSelecionado && ano === anoSelecionado;
  });

  // Drill-down dos totalizadores do topo (auditoria das métricas)
  const [drillDash, setDrillDash] = useState(null);

  // Novas métricas de IA
  const [metricasIA, setMetricasIA] = useState(null);
  const [alertasIA, setAlertasIA] = useState([]);
  const [fluxosAtivos, setFluxosAtivos] = useState([]);

  const filtrarDadosPorPerfil = (usuario, dados) => {
    if (usuario.role === 'user') {
      const nomeVendedor = getNomeExibicao(usuario);
      const userId = usuario.id;

      // Se não tem nome definido, mostra todos os dados
      if (!nomeVendedor) return dados;

      return {
        vendedores: dados.vendedores.filter((v) => v.email === usuario.email || v.id === userId),
        clientes: dados.clientes.filter((c) => c.vendedor_id === userId || c.vendedor_responsavel === nomeVendedor),
        vendas: dados.vendas.filter((v) => v.vendedor === nomeVendedor || v.vendedor_id === userId),
        orcamentos: dados.orcamentos.filter((o) => o.vendedor === nomeVendedor || o.vendedor_id === userId),
        interacoes: dados.interacoes.filter((i) => i.vendedor === nomeVendedor),
        contatosFidelizados: (dados.contatosFidelizados || []).filter(
          (c) => c.atendente_fidelizado_vendas === userId || c.vendedor_responsavel === nomeVendedor
        )
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

  const aplicarFiltroMesAno = (mes, ano, anual) => {
    const dataInicio = anual
      ? new Date(ano, 0, 1).toISOString().slice(0, 10)
      : new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
    const dataFim = anual
      ? new Date(ano, 11, 31).toISOString().slice(0, 10)
      : new Date(ano, mes, 0).toISOString().slice(0, 10);
    setFiltros(prev => ({ ...prev, periodo: 'personalizado', dataInicio, dataFim }));
    base44.analytics.track({ eventName: "dashboard_period_changed", properties: { mes, ano, anual } });
  };

  const handleMesChange = (e) => {
    const mes = parseInt(e.target.value);
    setMesSelecionado(mes);
    setModoAnual(false);
    aplicarFiltroMesAno(mes, anoSelecionado, false);
  };

  const handleAnoChange = (e) => {
    const ano = parseInt(e.target.value);
    setAnoSelecionado(ano);
    aplicarFiltroMesAno(mesSelecionado, ano, modoAnual);
  };

  const handleModoAnual = () => {
    const novoModo = !modoAnual;
    setModoAnual(novoModo);
    aplicarFiltroMesAno(mesSelecionado, anoSelecionado, novoModo);
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

      const [usersData, clientesData, vendasData, orcamentosData, interacoesData, contatosFidelizadosData, threadsAtividadeData, vendedoresEntData] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Cliente.list('-updated_date', 500),
        base44.entities.Venda.list('-data_venda', 500),
        base44.entities.Orcamento.list('-data_orcamento', 300),
        base44.entities.Interacao.list('-data_interacao', 500),
        base44.entities.Contact.filter({ is_cliente_fidelizado: true }, '-ultima_interacao', 500),
        base44.entities.MessageThread.filter({ thread_type: 'contact_external' }, '-last_message_at', 500),
        base44.entities.Vendedor.list()
      ]);
      const vendedoresData = dedupById(usersData).filter(u => u.codigo || u.attendant_sector === 'vendas');

      const dadosCarregados = {
        usuario: usuarioAtual,
        vendedores: vendedoresData,
        clientes: dedupClientes(clientesData),
        vendas: dedupVendas(vendasData),
        orcamentos: dedupOrcamentos(orcamentosData),
        interacoes: dedupById(interacoesData),
        contatosFidelizados: dedupContatos(contatosFidelizadosData),
        threadsAtividade: dedupById(threadsAtividadeData || []),
        vendedoresEntidade: vendedoresEntData || []
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
      setThreadsAtividade(dadosCarregados.threadsAtividade || []);
      setVendedoresEntidade(dadosCarregados.vendedoresEntidade || []);

      let dadosFiltrados = filtrarDadosPorPerfil(dadosCarregados.usuario, {
        vendedores: dadosCarregados.vendedores,
        clientes: dadosCarregados.clientes,
        vendas: dadosCarregados.vendas,
        orcamentos: dadosCarregados.orcamentos,
        interacoes: dadosCarregados.interacoes,
        contatosFidelizados: dadosCarregados.contatosFidelizados
      });

      // Salva dados completos (sem filtro de data) para gráficos históricos
      setDadosCompletos({ ...dadosFiltrados });

      dadosFiltrados = aplicarFiltros(dadosFiltrados, filtros);
      setDados(dadosFiltrados);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setDados({
        vendedores: [],
        clientes: [],
        vendas: [],
        orcamentos: [],
        interacoes: [],
        contatosFidelizados: []
      });
    }
    setLoading(false);
  }, [filtros, carregarDadosComCache]);

  const carregarNotasFiscais = async () => {
    try {
      const resp = await buscarNotasFiscaisExternas({});
      // Consolidação alinhada ao financeiro: exclui NFs zeradas, espelhos de CI e anuladas/canceladas
      const STATUS_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
      if (resp.data?.success) setNotasFiscais(
        dedupById(resp.data.notas || []).filter(n =>
          (n.valor_total || 0) > 0 && !n.is_espelho_ci && !STATUS_INVALIDOS.includes(n.status)
        )
      );
    } catch (e) {
      console.warn('[Dashboard] Notas fiscais indisponíveis:', e.message);
    }
  };

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
        onAcao: () => navigate(createPageUrl('Automacoes'))
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
    carregarNotasFiscais();
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

  // Filtro de vendedor aplicado também aos dados completos (metas, clientes, operacional)
  const filtrarPorVendedor = (d, nomeVendedor) => {
    if (!nomeVendedor || nomeVendedor === 'todos') return d;
    const v = (d.vendedores || []).find(u => (u.full_name || u.nome || u.email) === nomeVendedor);
    const vid = v?.id;
    return {
      ...d,
      clientes: (d.clientes || []).filter(c => c.vendedor_responsavel === nomeVendedor || (vid && (c.usuario_id === vid || c.vendedor_id === vid))),
      vendas: (d.vendas || []).filter(x => x.vendedor === nomeVendedor || (vid && x.vendedor_id === vid)),
      orcamentos: (d.orcamentos || []).filter(o => o.vendedor === nomeVendedor || (vid && (o.vendedor_id === vid || o.usuario_id === vid))),
      interacoes: (d.interacoes || []).filter(i => i.vendedor === nomeVendedor),
      contatosFidelizados: (d.contatosFidelizados || []).filter(c => c.vendedor_responsavel === nomeVendedor || (vid && c.atendente_fidelizado_vendas === vid))
    };
  };
  const dadosCompletosFiltrados = filtrarPorVendedor(dadosCompletos, filtros.vendedor);

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
      key: 'mapa',
      label: 'Mapa de Clientes',
      icon: MapIcon,
      descricao: 'Vendas por localização',
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
              {isGerente && (
                <SeletorVendedor
                  vendedores={dadosCompletos.vendedores}
                  valor={filtros.vendedor}
                  onChange={(v) => setFiltros(prev => ({ ...prev, vendedor: v }))}
                />
              )}
              <FiltrosAvancados filtros={filtros} onFiltrosChange={setFiltros} vendedores={dados.vendedores} isGerente={isGerente} />
              <FiltroMes mesSelecionado={mesSelecionado} anoSelecionado={anoSelecionado} modoAnual={modoAnual} onMesChange={handleMesChange} onAnoChange={handleAnoChange} onModoAnual={handleModoAnual} />
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
            <FiltroMes mesSelecionado={mesSelecionado} anoSelecionado={anoSelecionado} modoAnual={modoAnual} onMesChange={handleMesChange} onAnoChange={handleAnoChange} onModoAnual={handleModoAnual} />
          </div>
        </div>

        {/* Seletor de vendedor mobile */}
        {isGerente && (
          <div className="md:hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-2">
            <SeletorVendedor
              vendedores={dadosCompletos.vendedores}
              valor={filtros.vendedor}
              onChange={(v) => setFiltros(prev => ({ ...prev, vendedor: v }))}
            />
          </div>
        )}

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
              base44.analytics.track({ eventName: "dashboard_ia_alerts_dismissed_all" });
              return;
            }
            base44.analytics.track({
              eventName: "dashboard_ia_alert_action",
              properties: { alert_id: alerta.id, prioridade: alerta.prioridade, titulo: alerta.titulo }
            });
            if (alerta.onAcao) {
              alerta.onAcao();
            }
            setAlertasIA((prev) => prev.filter((a) => a.id !== alerta.id));
          }} />

        {/* Alertas de clientes que mudaram para "Em Risco" */}
        <AlertasClientesEmRisco />

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
            onClick={() => {
              navigate(createPageUrl('LeadsQualificados'));
              base44.analytics.track({ eventName: "dashboard_kanban_clicked", properties: { kanban: "leads_qualificados" } });
            }}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Kanban de Gestão de Leads</span>
              <Target className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dados.clientes.filter(c => ['novo_lead','primeiro_contato','em_conversa','levantamento_dados','pre_qualificado','qualificacao_tecnica','em_aquecimento','lead_qualificado'].includes(c.status)).length}</p>
          </button>

          <button
            onClick={() => {
              navigate(createPageUrl('Clientes'));
              base44.analytics.track({ eventName: "dashboard_kanban_clicked", properties: { kanban: "clientes" } });
            }}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Kanban de Gestão de Clientes</span>
              <Users className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dados.clientes.filter(c => ['Ativo','Em Risco','Promotor','Prospect','Inativo'].includes(c.status)).length}</p>
          </button>

          <button
            onClick={() => {
              navigate(createPageUrl('LeadsQualificados'));
              base44.analytics.track({ eventName: "dashboard_kanban_clicked", properties: { kanban: "orcamentos" } });
            }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium opacity-80">Pipeline de Orçamentos</span>
              <DollarSign className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-3xl font-bold">{dadosCompletos.orcamentos.filter(o => !['aprovado','rejeitado','vencido'].includes(o.status)).length}</p>
          </button>
        </div>

        {/* Estatísticas Resumo - scroll horizontal no mobile */}
        <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-3 py-2.5 rounded-xl border border-slate-200/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setDrillDash({ title: 'Vendas do Período (Notas Fiscais)', dados: notasFiltradas, colunas: COLS_NF })}
              className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>📊 {notasFiltradas.length} vendas (NFs)</span>
            </button>
            <button
              onClick={() => setDrillDash({ title: 'Orçamentos do Período', dados: dados.orcamentos, colunas: COLS_ORCAMENTO })}
              className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>🎯 {dados.orcamentos.length} orçamentos</span>
            </button>
            <button
              onClick={() => setDrillDash({ title: 'Clientes', dados: dados.clientes, colunas: COLS_CLIENTE })}
              className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>👥 {dados.clientes.length} clientes</span>
            </button>
            <button
              onClick={() => setDrillDash({
                title: 'Interações do Período (Conversas)',
                dados: threadsAtividade.filter(t => {
                  if (!t.last_message_at) return false;
                  const d = new Date(t.last_message_at);
                  if (modoAnual) return d.getFullYear() === anoSelecionado;
                  return d.getMonth() + 1 === mesSelecionado && d.getFullYear() === anoSelecionado;
                }),
                colunas: COLS_THREAD
              })}
              className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
              <span>📞 {threadsAtividade.filter(t => {
                if (!t.last_message_at) return false;
                const d = new Date(t.last_message_at);
                if (modoAnual) return d.getFullYear() === anoSelecionado;
                return d.getMonth() + 1 === mesSelecionado && d.getFullYear() === anoSelecionado;
              }).length} interações</span>
            </button>
            {isGerente &&
              <button
                onClick={() => setDrillDash({
                  title: 'Vendedores Ativos',
                  dados: vendedoresEntidade.filter(v => v.status === 'ativo').map(v => ({
                    ...v,
                    nome: dados.vendedores.find(u => u.id === v.usuario_id)?.full_name || v.codigo
                  })),
                  colunas: COLS_VENDEDOR_ENT
                })}
                className="flex-shrink-0 bg-gradient-to-r from-slate-800/80 to-slate-900/80 hover:from-slate-700/80 hover:to-slate-800/80 text-slate-50 px-3 py-1.5 font-semibold flex items-center gap-1.5 rounded-lg text-xs md:text-sm">
                <span>🏆 {vendedoresEntidade.filter(v => v.status === 'ativo').length || dados.vendedores.length} vendedores</span>
              </button>
            }
          </div>
        </div>

        {/* Conteúdo Dinâmico por Perspectiva */}
        {
          <>
            {viewMode === 'empresa' && isGerente &&
              <>
                <PrevisaoFaturamento notasTodas={notasFiscais} />
                <FinanceiroNeuralFin mesSel={mesSelecionado} anoSel={anoSelecionado} modoAnual={modoAnual} />
                <MetricasNotasFiscais mesSel={modoAnual ? null : mesSelecionado - 1} anoSel={anoSelecionado} modoAnual={modoAnual} />
                <MetricasVendasNF notas={notasFiltradas} modoAnual={modoAnual} />
                <VisaoGeralEmpresa dados={dadosCompletos} filtros={filtros} usuario={usuario} notasFiscais={notasFiltradas} vendedoresEntidade={vendedoresEntidade} />
              </>
            }
            {viewMode === 'vendedores' &&
              <PerformanceVendedores dados={dadosCompletosFiltrados} filtros={filtros} isGerente={isGerente} usuario={usuario} notasFiscais={notasFiltradas} notasTodas={notasFiscais} vendedoresEntidade={vendedoresEntidade} />
            }
            {viewMode === 'clientes' && <AnaliseClientes dados={dadosCompletosFiltrados} filtros={filtros} isGerente={isGerente} notasFiscais={notasFiscais} />}
            {viewMode === 'mapa' && <MapaClientes />}
            {viewMode === 'operacional' &&
              <MetricasOperacionais dados={dadosCompletosFiltrados} filtros={filtros} isGerente={isGerente} />
            }
            {viewMode === 'analytics' && isGerente &&
              <AnalyticsAvancadoEmbed />
            }
          </>
        }

        {drillDash && <DetalhesModal title={drillDash.title} dados={drillDash.dados} colunas={drillDash.colunas} onClose={() => setDrillDash(null)} />}
      </div>
    </div>
  );
}