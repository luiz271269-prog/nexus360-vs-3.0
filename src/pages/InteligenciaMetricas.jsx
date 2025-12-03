
import { useState, useEffect, useCallback } from "react";
// Added per instructions
import PermissionGuard from "../components/security/PermissionGuard"; // Added per instructions
import { ClienteScore } from "@/entities/ClienteScore";
import { TarefaInteligente } from "@/entities/TarefaInteligente";
import { AprendizadoIA } from "@/entities/AprendizadoIA";
import { EventoSistema } from "@/entities/EventoSistema";
import { AutomationExecution } from "@/entities/AutomationExecution";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardPerformanceIA from "../components/inteligencia/DashboardPerformanceIA";
import {
  Brain,
  TrendingUp,
  Zap,
  AlertTriangle,
  RefreshCw,
  Activity // New icon
} from "lucide-react";
import { toast } from "sonner";

// Cache global para evitar chamadas desnecessárias
const metricsCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 60000 // 1 minuto
};

// Renamed original component to InteligenciaMetricasContent
function InteligenciaMetricasContent() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [activeTab, setActiveTab] = useState('performance_ia'); // New state for tabs

  const calcularTaxaSucesso = (tarefas) => {
    const concluidas = tarefas.filter(t => t.status === 'concluida');
    if (concluidas.length === 0) return 0;

    const sucesso = concluidas.filter(t =>
      t.resultado_execucao?.sucesso === true
    ).length;

    return Math.round((sucesso / concluidas.length) * 100);
  };

  const agruparPorTipo = (aprendizados) => {
    const grupos = {};
    aprendizados.forEach(a => {
      grupos[a.tipo_aprendizado] = (grupos[a.tipo_aprendizado] || 0) + 1;
    });
    return grupos;
  };

  // Função auxiliar para adicionar delay entre chamadas
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const carregarMetricas = useCallback(async () => {
    // Verificar se temos dados no cache válidos
    const agora = Date.now();
    if (metricsCache.data &&
      metricsCache.timestamp &&
      (agora - metricsCache.timestamp) < metricsCache.CACHE_DURATION) {
      console.log("📦 Usando dados do cache de métricas");
      setMetricas(metricsCache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log("🔄 Carregando métricas frescas com proteção de rate limit...");

    try {
      // Carregar dados sequencialmente com delays para evitar rate limit
      console.log("📊 Carregando scores...");
      const scores = await ClienteScore.list('-score_total', 200); // Reduzido de 1000 para 200
      await delay(300); // 300ms entre cada chamada

      console.log("📋 Carregando tarefas...");
      const tarefas = await TarefaInteligente.list('-created_date', 200); // Reduzido de 1000 para 200
      await delay(300);

      console.log("🧠 Carregando aprendizados...");
      const aprendizados = await AprendizadoIA.filter({ ativo: true });
      await delay(300);

      console.log("🔔 Carregando eventos...");
      const eventos = await EventoSistema.filter({ processado: false });
      await delay(300);

      console.log("⚙️ Carregando execuções...");
      const execucoes = await AutomationExecution.list('-executado_em', 50); // Reduzido de 100 para 50

      const hoje = new Date().toISOString().slice(0, 10);

      const metricsData = {
        scores: {
          total: scores.length,
          alto_risco: scores.filter(s => s.risco_churn === 'alto' || s.risco_churn === 'critico').length,
          alta_prioridade: scores.filter(s => s.score_urgencia >= 70).length,
          alto_potencial: scores.filter(s => s.score_potencial_compra >= 70).length,
          score_medio: scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + (s.score_total || 0), 0) / scores.length) : 0
        },
        tarefas: {
          total: tarefas.length,
          pendentes: tarefas.filter(t => t.status === 'pendente').length,
          concluidas_hoje: tarefas.filter(t =>
            t.status === 'concluida' &&
            t.resultado_execucao?.data_execucao?.slice(0, 10) === hoje
          ).length,
          criticas: tarefas.filter(t => t.prioridade === 'critica' && t.status === 'pendente').length,
          taxa_sucesso: calcularTaxaSucesso(tarefas)
        },
        aprendizados: {
          total: aprendizados.length,
          por_tipo: agruparPorTipo(aprendizados),
          mais_efetivos: aprendizados
            .sort((a, b) => (b.impacto_medido?.taxa_sucesso_depois || 0) - (a.impacto_medido?.taxa_sucesso_depois || 0))
            .slice(0, 5)
        },
        eventos: {
          pendentes: eventos.length,
          ultimos_processados: eventos.filter(e => e.processado).slice(0, 10)
        },
        automacoes: {
          execucoes_24h: execucoes.filter(e =>
            new Date(e.executado_em) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length,
          taxa_sucesso: execucoes.length > 0 ? Math.round((execucoes.filter(e => e.status === 'concluido').length / execucoes.length) * 100) : 0
        }
      };

      // Salvar no cache
      metricsCache.data = metricsData;
      metricsCache.timestamp = agora;

      setMetricas(metricsData);
      console.log("✅ Métricas carregadas e salvas no cache");

    } catch (error) {
      console.error("❌ Erro ao carregar métricas:", error);

      // Se for erro de rate limit e temos cache antigo, usar ele
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        console.log("⚠️ Rate limit detectado");
        if (metricsCache.data) {
          console.log("📦 Usando cache antigo por rate limit");
          setMetricas(metricsCache.data);
          toast.warning("Usando dados em cache devido ao limite de requisições");
        } else {
          toast.error("Limite de requisições atingido. Aguarde alguns segundos e tente novamente.");
        }
      } else {
        toast.error("Erro ao carregar métricas da IA");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarMetricas();
  }, [carregarMetricas]);

  const handleProcessarEventos = async () => {
    setProcessando(true);
    try {
      toast.info("Processando eventos pendentes...");

      const { processarEventos } = await import("@/functions/processarEventos");
      const resultado = await processarEventos();

      if (resultado.data.success) {
        toast.success(`✅ ${resultado.data.eventos_processados} eventos processados!`);
        // Limpar cache antes de recarregar
        metricsCache.data = null;
        metricsCache.timestamp = null;
        await carregarMetricas();
      } else {
        toast.error("Erro ao processar eventos");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao processar eventos");
    }
    setProcessando(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">Carregando métricas da IA...</p>
          <p className="text-sm text-slate-400 mt-2">Aguarde, evitando sobrecarga do sistema</p>
        </div>
      </div>
    );
  }

  if (!metricas) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Erro ao carregar métricas</p>
          <Button onClick={carregarMetricas} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <Activity className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Métricas de Inteligência
              </h1>
              <p className="text-slate-300 mt-1">
                Performance e análise da IA em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleProcessarEventos}
              disabled={processando}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30"
            >
              {processando ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processando...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Processar Eventos</>
              )}
            </Button>

            <Button
              onClick={() => {
                metricsCache.data = null;
                metricsCache.timestamp = null;
                carregarMetricas();
              }}
              variant="outline"
              className="border-white/30 hover:bg-white/10 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance_ia">
            <Activity className="w-4 h-4 mr-2" />
            Performance IA
          </TabsTrigger>
          <TabsTrigger value="scoring">
            <TrendingUp className="w-4 h-4 mr-2" />
            Scoring Clientes
          </TabsTrigger>
          <TabsTrigger value="automacoes">
            <Zap className="w-4 h-4 mr-2" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="w-4 h-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Tab: Performance da IA */}
        <TabsContent value="performance_ia">
          {/* DashboardPerformanceIA is expected to consume the metrics data */}
          <DashboardPerformanceIA metricas={metricas} />
        </TabsContent>

        {/* Placeholder for other tabs, to maintain functionality */}
        <TabsContent value="scoring">
          <Card className="p-6 text-center text-slate-500">
            <h3 className="text-lg font-semibold mb-2">Scoring de Clientes</h3>
            <p>Em breve: Análises detalhadas e insights sobre o score de clientes.</p>
          </Card>
        </TabsContent>
        <TabsContent value="automacoes">
          <Card className="p-6 text-center text-slate-500">
            <h3 className="text-lg font-semibold mb-2">Automações</h3>
            <p>Em breve: Visão geral e métricas de desempenho das automações.</p>
          </Card>
        </TabsContent>
        <TabsContent value="insights">
          <Card className="p-6 text-center text-slate-500">
            <h3 className="text-lg font-semibold mb-2">Insights</h3>
            <p>Em breve: Descobertas e recomendações geradas pela IA.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// New default export InteligenciaMetricas, wrapping InteligenciaMetricasContent with PermissionGuard
export default function InteligenciaMetricas() {
  return (
    <PermissionGuard permission="VIEW_IA_METRICS">
      <InteligenciaMetricasContent />
    </PermissionGuard>
  );
}
