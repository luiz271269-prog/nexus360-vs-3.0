import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function JarvisControl() {
  const [usuario, setUsuario] = useState(null);
  const [agentRuns, setAgentRuns] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_runs: 0,
    sucesso: 0,
    falhou: 0,
    processando: 0,
    avg_duration: 0
  });

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    try {
      const user = await base44.auth.me();
      setUsuario(user);

      // Buscar AgentRuns recentes
      const runs = await base44.entities.AgentRun.list('-created_date', 50);
      setAgentRuns(runs);

      // Buscar decisões recentes
      const decisionLogs = await base44.entities.AgentDecisionLog.list('-timestamp_decisao', 30);
      setDecisions(decisionLogs);

      // Calcular estatísticas
      const total = runs.length;
      const sucesso = runs.filter(r => r.status === 'concluido').length;
      const falhou = runs.filter(r => r.status === 'falhou').length;
      const processando = runs.filter(r => r.status === 'processando').length;
      
      const durations = runs.filter(r => r.duration_ms).map(r => r.duration_ms);
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      setStats({
        total_runs: total,
        sucesso,
        falhou,
        processando,
        avg_duration: Math.round(avgDuration)
      });

    } catch (error) {
      console.error('[JARVIS] Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados do agente');
    } finally {
      setLoading(false);
    }
  };

  const executarManualmente = async () => {
    try {
      toast.info('🤖 Executando ciclo do agente...');
      
      await base44.functions.invoke('jarvisEventLoop', {
        action: 'process_pending_events'
      });
      
      toast.success('✅ Ciclo executado com sucesso');
      setTimeout(carregarDados, 2000);
    } catch (error) {
      console.error('[JARVIS] Erro:', error);
      toast.error('Erro ao executar: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Bot className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Nexus AI - Central de Controle</h1>
            <p className="text-sm text-slate-500">Agente Autônomo • Modo: Assistente</p>
          </div>
        </div>
        <Button 
          onClick={executarManualmente}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Zap className="w-4 h-4 mr-2" />
          Executar Ciclo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">{stats.total_runs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.sucesso}</div>
            <p className="text-xs text-slate-500">
              {stats.total_runs > 0 ? Math.round((stats.sucesso / stats.total_runs) * 100) : 0}% taxa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Falhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.falhou}</div>
            <p className="text-xs text-slate-500">
              {stats.total_runs > 0 ? Math.round((stats.falhou / stats.total_runs) * 100) : 0}% taxa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-800">
              {stats.avg_duration < 1000 ? `${stats.avg_duration}ms` : `${(stats.avg_duration / 1000).toFixed(1)}s`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="runs" className="w-full">
        <TabsList>
          <TabsTrigger value="runs">
            <Activity className="w-4 h-4 mr-2" />
            Execuções ({stats.total_runs})
          </TabsTrigger>
          <TabsTrigger value="decisions">
            <CheckCircle className="w-4 h-4 mr-2" />
            Decisões ({decisions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Execuções */}
        <TabsContent value="runs" className="space-y-3 mt-4">
          {agentRuns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhuma execução registrada ainda</p>
              </CardContent>
            </Card>
          ) : (
            agentRuns.map(run => (
              <Card key={run.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={
                          run.status === 'concluido' ? 'bg-green-100 text-green-800' :
                          run.status === 'falhou' ? 'bg-red-100 text-red-800' :
                          run.status === 'processando' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }>
                          {run.status === 'concluido' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {run.status === 'falhou' && <XCircle className="w-3 h-3 mr-1" />}
                          {run.status === 'processando' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {run.status}
                        </Badge>
                        <span className="text-sm font-semibold text-slate-700">
                          {run.playbook_selected}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {run.trigger_type}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <div>
                          <strong>Trigger ID:</strong> {run.trigger_event_id?.substring(0, 20)}...
                        </div>
                        {run.duration_ms && (
                          <div>
                            <strong>Duração:</strong> {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(2)}s`}
                          </div>
                        )}
                        {run.error_message && (
                          <div className="text-red-600">
                            <strong>Erro:</strong> {run.error_message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      {format(new Date(run.created_date), 'dd/MM HH:mm:ss')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab: Decisões */}
        <TabsContent value="decisions" className="space-y-3 mt-4">
          {decisions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhuma decisão registrada ainda</p>
              </CardContent>
            </Card>
          ) : (
            decisions.map(decision => (
              <Card key={decision.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-purple-100 text-purple-800">
                        {decision.decisao_tipo}
                      </Badge>
                      {decision.confianca_ia && (
                        <Badge variant="outline">
                          {Math.round(decision.confianca_ia)}% confiança
                        </Badge>
                      )}
                    </div>
                    <Badge className={
                      decision.resultado_execucao === 'sucesso' ? 'bg-green-100 text-green-800' :
                      decision.resultado_execucao === 'falhou' ? 'bg-red-100 text-red-800' :
                      decision.resultado_execucao === 'bloqueado' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-slate-100 text-slate-800'
                    }>
                      {decision.resultado_execucao}
                    </Badge>
                  </div>

                  <div className="text-sm text-slate-700 space-y-2">
                    <div>
                      <strong>Step:</strong> {decision.step_name}
                    </div>
                    {decision.ferramentas_usadas && decision.ferramentas_usadas.length > 0 && (
                      <div>
                        <strong>Ferramentas:</strong> {decision.ferramentas_usadas.join(', ')}
                      </div>
                    )}
                    {decision.motivo_bloqueio && (
                      <div className="text-yellow-700">
                        <strong>Bloqueio:</strong> {decision.motivo_bloqueio}
                      </div>
                    )}
                    {decision.decisao_tomada && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-purple-600 hover:text-purple-700">
                          Ver decisão completa
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-50 rounded text-xs overflow-auto">
                          {JSON.stringify(decision.decisao_tomada, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <div className="text-right text-xs text-slate-400 mt-2">
                    {format(new Date(decision.timestamp_decisao || decision.created_date), 'dd/MM HH:mm:ss')}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}