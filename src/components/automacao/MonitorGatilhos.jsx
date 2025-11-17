import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Eye,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Monitor de Gatilhos Automáticos em Tempo Real
 * Visualização de eventos, acionamentos e execuções
 */
export default function MonitorGatilhos() {
  const [filtroStatus, setFiltroStatus] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Buscar logs de automação recentes
  const { data: logsAutomacao = [], isLoading, refetch } = useQuery({
    queryKey: ['automation-logs'],
    queryFn: async () => {
      const logs = await base44.entities.AutomationLog.list('-timestamp', 100);
      return logs;
    },
    refetchInterval: autoRefresh ? 5000 : false,
    initialData: []
  });

  // Buscar execuções ativas
  const { data: execucoesAtivas = [] } = useQuery({
    queryKey: ['execucoes-ativas'],
    queryFn: async () => {
      return await base44.entities.FlowExecution.filter({
        status: { $in: ['ativo', 'waiting_follow_up'] }
      });
    },
    refetchInterval: autoRefresh ? 5000 : false,
    initialData: []
  });

  // Calcular estatísticas
  const logsUltimas24h = logsAutomacao.filter(log => {
    const logDate = new Date(log.timestamp);
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return logDate >= ontem;
  });

  const totalEventos = logsUltimas24h.length;
  const eventosSucesso = logsUltimas24h.filter(l => l.resultado === 'sucesso').length;
  const eventosErro = logsUltimas24h.filter(l => l.resultado === 'erro').length;
  const taxaSucesso = totalEventos > 0 ? Math.round((eventosSucesso / totalEventos) * 100) : 0;

  // Agrupar por tipo de ação
  const eventosPorAcao = {};
  logsUltimas24h.forEach(log => {
    if (!eventosPorAcao[log.acao]) {
      eventosPorAcao[log.acao] = { total: 0, sucesso: 0, erro: 0 };
    }
    eventosPorAcao[log.acao].total++;
    if (log.resultado === 'sucesso') eventosPorAcao[log.acao].sucesso++;
    if (log.resultado === 'erro') eventosPorAcao[log.acao].erro++;
  });

  // Filtrar logs
  const logsFiltrados = logsAutomacao.filter(log => {
    if (filtroStatus === 'all') return true;
    return log.resultado === filtroStatus;
  });

  const getIconForAcao = (acao) => {
    const iconMap = {
      'envio_template': Zap,
      'resposta_ia': Activity,
      'follow_up_automatico': Clock,
      'roteamento_lead': TrendingUp,
      'qualificacao_automatica': CheckCircle,
      'erro_envio': XCircle,
      'escalacao_gerente': AlertTriangle
    };
    return iconMap[acao] || Activity;
  };

  const getColorForResultado = (resultado) => {
    switch(resultado) {
      case 'sucesso':
        return 'text-green-600 bg-green-100';
      case 'erro':
        return 'text-red-600 bg-red-100';
      case 'aguardando':
        return 'text-amber-600 bg-amber-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const formatarTimestamp = (timestamp) => {
    try {
      return format(new Date(timestamp), "dd/MM HH:mm:ss", { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Eventos 24h</p>
                <p className="text-3xl font-bold text-blue-700">{totalEventos}</p>
              </div>
              <Activity className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-green-700">{taxaSucesso}%</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Execuções Ativas</p>
                <p className="text-3xl font-bold text-purple-700">{execucoesAtivas.length}</p>
              </div>
              <PlayCircle className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Erros 24h</p>
                <p className="text-3xl font-bold text-red-700">{eventosErro}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes visualizações */}
      <Tabs defaultValue="timeline" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="timeline">
              <Clock className="w-4 h-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="por-acao">
              <BarChart3 className="w-4 h-4 mr-2" />
              Por Ação
            </TabsTrigger>
            <TabsTrigger value="execucoes">
              <PlayCircle className="w-4 h-4 mr-2" />
              Execuções Ativas
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-green-600" : ""}
            >
              {autoRefresh ? (
                <>
                  <Activity className="w-4 h-4 mr-2 animate-pulse" />
                  Auto-refresh ON
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 mr-2" />
                  Auto-refresh OFF
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Tab 1: Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Timeline de Eventos</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={filtroStatus === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatus('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={filtroStatus === 'sucesso' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatus('sucesso')}
                    className={filtroStatus === 'sucesso' ? 'bg-green-600' : ''}
                  >
                    Sucesso
                  </Button>
                  <Button
                    variant={filtroStatus === 'erro' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroStatus('erro')}
                    className={filtroStatus === 'erro' ? 'bg-red-600' : ''}
                  >
                    Erros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {logsFiltrados.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhum evento registrado</p>
                    </div>
                  ) : (
                    logsFiltrados.map((log) => {
                      const Icon = getIconForAcao(log.acao);
                      return (
                        <div
                          key={log.id}
                          className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorForResultado(log.resultado)}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-slate-800">
                                    {log.acao.replace(/_/g, ' ').toUpperCase()}
                                  </span>
                                  <Badge className={getColorForResultado(log.resultado)}>
                                    {log.resultado}
                                  </Badge>
                                  {log.prioridade && (
                                    <Badge variant="outline" className="text-xs">
                                      {log.prioridade}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 mb-2">
                                  {log.detalhes?.mensagem || 'Sem detalhes'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatarTimestamp(log.timestamp)}
                                  </span>
                                  {log.contato_id && (
                                    <span>Contato: {log.contato_id.substring(0, 8)}...</span>
                                  )}
                                  {log.thread_id && (
                                    <span>Thread: {log.thread_id.substring(0, 8)}...</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Por Ação */}
        <TabsContent value="por-acao">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Agrupados por Ação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(eventosPorAcao).map(([acao, stats]) => {
                  const Icon = getIconForAcao(acao);
                  const taxaSucessoAcao = Math.round((stats.sucesso / stats.total) * 100);
                  
                  return (
                    <div
                      key={acao}
                      className="border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-indigo-600" />
                          <span className="font-semibold text-slate-800">
                            {acao.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Badge className="bg-blue-100 text-blue-800">
                            {stats.total} total
                          </Badge>
                          <Badge className="bg-green-100 text-green-800">
                            {taxaSucessoAcao}% sucesso
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="bg-blue-50 rounded p-2">
                          <p className="text-xs text-slate-600">Total</p>
                          <p className="text-lg font-bold text-blue-700">{stats.total}</p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                          <p className="text-xs text-slate-600">Sucesso</p>
                          <p className="text-lg font-bold text-green-700">{stats.sucesso}</p>
                        </div>
                        <div className="bg-red-50 rounded p-2">
                          <p className="text-xs text-slate-600">Erros</p>
                          <p className="text-lg font-bold text-red-700">{stats.erro}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Execuções Ativas */}
        <TabsContent value="execucoes">
          <Card>
            <CardHeader>
              <CardTitle>Playbooks em Execução</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {execucoesAtivas.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma execução ativa no momento</p>
                    </div>
                  ) : (
                    execucoesAtivas.map((exec) => (
                      <div
                        key={exec.id}
                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-800">
                                Playbook #{exec.flow_template_id?.substring(0, 8)}
                              </span>
                              <Badge className="bg-purple-100 text-purple-800">
                                {exec.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600">
                              Contato: {exec.contact_id?.substring(0, 8)}...
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4 mr-2" />
                            Detalhes
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-slate-500">Step Atual</p>
                            <p className="font-semibold">{exec.current_step || 0}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Follow-up Stage</p>
                            <p className="font-semibold">{exec.follow_up_stage_index || 0}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Respostas</p>
                            <p className="font-semibold">{exec.response_count || 0}</p>
                          </div>
                        </div>

                        {exec.next_action_at && (
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="w-4 h-4" />
                            Próxima ação: {formatarTimestamp(exec.next_action_at)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}