import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Zap,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  RefreshCw,
  Eye,
  PlayCircle,
  PauseCircle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  DASHBOARD DE MONITORAMENTO REAL-TIME                        ║
 * ║  + Visualização ao vivo de execuções                         ║
 * ║  + Monitoramento de webhooks                                  ║
 * ║  + Alertas em tempo real                                      ║
 * ║  + Performance do sistema                                     ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function MonitoramentoRealTime() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5s

  // ═══════════════════════════════════════════════════════════
  // Queries com auto-refresh
  // ═══════════════════════════════════════════════════════════
  
  const { data: execucoesAtivas = [], refetch: refetchExecucoes } = useQuery({
    queryKey: ['execucoes_ativas'],
    queryFn: async () => {
      const todasExecucoes = await base44.entities.FlowExecution.list('-updated_date', 100);
      return todasExecucoes.filter(e => 
        e.status === 'ativo' || e.status === 'waiting_follow_up'
      );
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    initialData: []
  });

  const { data: webhooksRecentes = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ['webhooks_recentes'],
    queryFn: async () => {
      const logs = await base44.entities.WebhookLog.list('-timestamp', 50);
      return logs.filter(log => {
        const diffMinutos = (Date.now() - new Date(log.timestamp)) / (1000 * 60);
        return diffMinutos <= 10; // Últimos 10 minutos
      });
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    initialData: []
  });

  const { data: threads = [], refetch: refetchThreads } = useQuery({
    queryKey: ['threads_ativas'],
    queryFn: async () => {
      const allThreads = await base44.entities.MessageThread.list('-last_message_at', 50);
      return allThreads.filter(t => t.status === 'aberta');
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    initialData: []
  });

  const { data: systemHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['system_health'],
    queryFn: async () => {
      try {
        const response = await base44.functions.invoke('monitorarSaudeDoSistema', {});
        return response.data;
      } catch (error) {
        console.error('Erro ao buscar health:', error);
        return { status_geral: 'erro', componentes: {} };
      }
    },
    refetchInterval: autoRefresh ? 10000 : false, // 10s para health
    initialData: { status_geral: 'desconhecido', componentes: {} }
  });

  // ═══════════════════════════════════════════════════════════
  // Cálculos de métricas
  // ═══════════════════════════════════════════════════════════
  
  const execucoesEmAndamento = execucoesAtivas.filter(e => e.status === 'ativo').length;
  const execucoesAguardandoFollowup = execucoesAtivas.filter(e => e.status === 'waiting_follow_up').length;
  
  const webhooksSucesso = webhooksRecentes.filter(w => w.success === true).length;
  const webhooksErro = webhooksRecentes.filter(w => w.success === false).length;
  const taxaSucessoWebhook = webhooksRecentes.length > 0 
    ? Math.round((webhooksSucesso / webhooksRecentes.length) * 100)
    : 0;

  const conversasAguardandoResposta = threads.filter(t => 
    t.last_message_sender === 'contact' && t.unread_count > 0
  ).length;

  // ═══════════════════════════════════════════════════════════
  // Identificar alertas críticos
  // ═══════════════════════════════════════════════════════════
  
  const alertasCriticos = [];

  if (webhooksErro > 5) {
    alertasCriticos.push({
      tipo: 'webhook_errors',
      severidade: 'alta',
      mensagem: `${webhooksErro} erros de webhook nos últimos 10 minutos`,
      acao: 'Verificar logs de webhook'
    });
  }

  if (taxaSucessoWebhook < 80 && webhooksRecentes.length > 10) {
    alertasCriticos.push({
      tipo: 'webhook_baixa_taxa',
      severidade: 'media',
      mensagem: `Taxa de sucesso de webhook baixa: ${taxaSucessoWebhook}%`,
      acao: 'Revisar configuração'
    });
  }

  if (conversasAguardandoResposta > 10) {
    alertasCriticos.push({
      tipo: 'conversas_pendentes',
      severidade: 'media',
      mensagem: `${conversasAguardandoResposta} conversas aguardando resposta`,
      acao: 'Verificar atendimento'
    });
  }

  if (systemHealth?.status_geral === 'critico') {
    alertasCriticos.push({
      tipo: 'system_health',
      severidade: 'critica',
      mensagem: 'Sistema em estado crítico',
      acao: 'Verificar saúde do sistema'
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Funções de ação
  // ═══════════════════════════════════════════════════════════
  
  const handleRefreshAll = () => {
    refetchExecucoes();
    refetchWebhooks();
    refetchThreads();
    refetchHealth();
    toast.success("Dados atualizados!");
  };

  const handlePausarExecucao = async (execucaoId) => {
    try {
      await base44.entities.FlowExecution.update(execucaoId, { status: 'pausado' });
      toast.success("Execução pausada");
      refetchExecucoes();
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleRetomarExecucao = async (execucaoId) => {
    try {
      await base44.entities.FlowExecution.update(execucaoId, { status: 'ativo' });
      toast.success("Execução retomada");
      refetchExecucoes();
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const getHealthStatusColor = (status) => {
    switch (status) {
      case 'saudavel': return 'text-green-600 bg-green-100';
      case 'degradado': return 'text-yellow-600 bg-yellow-100';
      case 'critico': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthStatusIcon = (status) => {
    switch (status) {
      case 'saudavel': return <CheckCircle className="w-4 h-4" />;
      case 'degradado': return <AlertTriangle className="w-4 h-4" />;
      case 'critico': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-600" />
            Monitoramento Real-Time
          </h1>
          <p className="text-slate-600 mt-1">Acompanhe o sistema em tempo real</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? (
              <>
                <PauseCircle className="w-4 h-4 mr-2" />
                Auto-Refresh ON
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Auto-Refresh OFF
              </>
            )}
          </Button>

          <Button
            onClick={handleRefreshAll}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alertas Críticos */}
      {alertasCriticos.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Alertas Críticos ({alertasCriticos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertasCriticos.map((alerta, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                <div className="flex items-center gap-3">
                  <Badge className={
                    alerta.severidade === 'critica' ? 'bg-red-600 text-white' :
                    alerta.severidade === 'alta' ? 'bg-orange-600 text-white' :
                    'bg-yellow-600 text-white'
                  }>
                    {alerta.severidade.toUpperCase()}
                  </Badge>
                  <div>
                    <p className="font-medium text-slate-900">{alerta.mensagem}</p>
                    <p className="text-sm text-slate-600">{alerta.acao}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalhes
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPIs em Tempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Execuções Ativas */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Execuções Ativas</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {execucoesEmAndamento}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  +{execucoesAguardandoFollowup} em follow-up
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Taxa Webhook</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {taxaSucessoWebhook}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {webhooksSucesso} sucessos / {webhooksErro} erros
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                taxaSucessoWebhook >= 90 ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                taxaSucessoWebhook >= 70 ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
                'bg-gradient-to-br from-red-500 to-pink-600'
              }`}>
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversas Pendentes */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Conversas Abertas</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {threads.length}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {conversasAguardandoResposta} aguardando resposta
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Saúde do Sistema</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getHealthStatusColor(systemHealth?.status_geral)}>
                    {getHealthStatusIcon(systemHealth?.status_geral)}
                    <span className="ml-2">{systemHealth?.status_geral || 'Desconhecido'}</span>
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Última verificação: {systemHealth?.timestamp ? 
                    new Date(systemHealth.timestamp).toLocaleTimeString('pt-BR') : 
                    'N/A'}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Execuções em Andamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Execuções em Andamento ({execucoesAtivas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {execucoesAtivas.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma execução ativa no momento</p>
              <p className="text-sm">As execuções aparecerão aqui em tempo real</p>
            </div>
          ) : (
            <div className="space-y-3">
              {execucoesAtivas.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                  
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-2 h-2 rounded-full ${
                      exec.status === 'ativo' ? 'bg-green-500 animate-pulse' :
                      exec.status === 'waiting_follow_up' ? 'bg-yellow-500' :
                      'bg-gray-400'
                    }`} />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          Execução #{exec.id?.slice(0, 8)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          Step {exec.current_step}
                        </Badge>
                        {exec.status === 'waiting_follow_up' && (
                          <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                            Follow-up Stage {exec.follow_up_stage_index}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                        <span>Contact: {exec.contact_id?.slice(0, 8)}</span>
                        <span>•</span>
                        <span>
                          {exec.started_at ? 
                            `Iniciado há ${Math.round((Date.now() - new Date(exec.started_at)) / (1000 * 60))} min` :
                            'Início desconhecido'
                          }
                        </span>
                        {exec.next_action_at && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Próxima ação: {new Date(exec.next_action_at).toLocaleString('pt-BR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {exec.status === 'ativo' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePausarExecucao(exec.id)}
                      >
                        <PauseCircle className="w-4 h-4 mr-1" />
                        Pausar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetomarExecucao(exec.id)}
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        Retomar
                      </Button>
                    )}
                    
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Logs de Webhook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Webhooks Recentes (10 min)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {webhooksRecentes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum webhook recebido</p>
                <p className="text-sm">Últimos 10 minutos</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {webhooksRecentes.slice(0, 20).map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">
                          {log.event_type || 'Evento desconhecido'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    {log.processing_time_ms && (
                      <Badge variant="outline" className="text-xs">
                        {log.processing_time_ms}ms
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversas Ativas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Conversas Abertas ({threads.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {threads.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma conversa aberta</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {threads.slice(0, 20).map((thread) => (
                  <div key={thread.id} className="flex items-center justify-between p-3 border rounded-lg text-sm hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        Thread #{thread.id?.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {thread.last_message_content || 'Sem mensagens'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {thread.last_message_at ? 
                          `Última msg: ${new Date(thread.last_message_at).toLocaleTimeString('pt-BR')}` :
                          'Sem atividade recente'
                        }
                      </p>
                    </div>
                    
                    {thread.unread_count > 0 && (
                      <Badge className="bg-red-500 text-white">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

    </div>
  );
}