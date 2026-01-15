import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  MessageSquare,
  Target,
  Brain,
  Shield,
  Sparkles,
  RefreshCw,
  Play,
  Pause,
  Settings,
  Bug,
  AlertCircle,
  FileText,
  GitCompare,
  Eye,
  Radio
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LogsFiltragemViewer from "../comunicacao/LogsFiltragemViewer";
import DiagnosticoComparativoThreads from "../comunicacao/DiagnosticoComparativoThreads";
import DiagnosticoThreadsInvisiveis from "../comunicacao/DiagnosticoThreadsInvisiveis";
import AnalisadorMensagensRecebidas from "../comunicacao/AnalisadorMensagensRecebidas";
import LimpezaDuplicatas from "../comunicacao/LimpezaDuplicatas";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function ControlCenter() {
  const queryClient = useQueryClient();
  const [executing, setExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);

  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => base44.entities.FlowTemplate.list(),
    initialData: []
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes'],
    queryFn: () => base44.entities.FlowExecution.list('-created_date', 200),
    initialData: []
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('-updated_date', 200),
    initialData: []
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['threads'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 200),
    initialData: []
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['playbook-insights'],
    queryFn: () => base44.entities.PlaybookInsight.list('-created_date', 50),
    initialData: []
  });

  const executarCicloMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('cicloAutoOtimizacao', {});
      return response.data;
    },
    onSuccess: (data) => {
      setLastExecution(data);
      queryClient.invalidateQueries();
      
      if (data.status_geral === 'sucesso') {
        toast.success(`✅ Ciclo executado com sucesso em ${(data.tempo_total_ms / 1000).toFixed(2)}s`);
      } else {
        toast.warning(`⚠️ Ciclo concluído com status: ${data.status_geral}`);
      }
    },
    onError: (error) => {
      toast.error(`❌ Erro ao executar ciclo: ${error.message}`);
    }
  });

  const handleExecutarCiclo = async () => {
    setExecuting(true);
    try {
      await executarCicloMutation.mutateAsync();
    } finally {
      setExecuting(false);
    }
  };

  const handleDiagnostico = async () => {
    setDiagnosing(true);
    try {
      toast.info('🔍 Iniciando diagnóstico do sistema...');
      // Diagnosticar threads, execuções, integrações, etc
      const diagnostico = {
        timestamp: new Date().toISOString(),
        threads_totais: threads.length,
        threads_abertas: threads.filter(t => t.status === 'aberta').length,
        execucoes_totais: execucoes.length,
        execucoes_ativas: execucoes.filter(e => e.status === 'ativo' || e.status === 'waiting_follow_up').length,
        playbooks_ativos: playbooks.filter(p => p.ativo).length,
        taxa_sucesso: metricas.taxa_sucesso,
        contatos_ativos: contacts.length
      };
      console.log('📊 Diagnóstico do Sistema:', diagnostico);
      toast.success(`✅ Diagnóstico concluído - ${threads.length} threads, ${execucoes.length} execuções`);
    } finally {
      setDiagnosing(false);
    }
  };

  // Validar inconsistências nos contatos (Nexus360 Shadow Engine)
  const validarConsistenciaContato = (contato) => {
    const inconsistencias = [];
    
    // Validar fidelização vs atribuição
    const campos_fidelizacao = ['atendente_fidelizado_vendas', 'atendente_fidelizado_assistencia', 'atendente_fidelizado_financeiro', 'atendente_fidelizado_fornecedor'];
    const temFidelizado = campos_fidelizacao.some(c => contato[c]);
    
    if (temFidelizado && !contato.vendedor_responsavel) {
      inconsistencias.push('⚠️ Contato fidelizado mas sem vendedor responsável');
    }
    
    // Validar score vs tipo_contato
    if (contato.cliente_score >= 70 && contato.tipo_contato === 'novo') {
      inconsistencias.push('⚠️ Score alto (70+) mas tipo "novo" - reclassificar');
    }
    
    // Validar channels activos vs optin
    if (contato.whatsapp_optin === false && contato.telefone) {
      inconsistencias.push('⚠️ Sem opt-in WhatsApp - consentimento pendente');
    }
    
    // Validar último contato muito antigo
    if (contato.ultima_interacao) {
      const diasAtraso = Math.floor((Date.now() - new Date(contato.ultima_interacao)) / (1000 * 60 * 60 * 24));
      if (diasAtraso > 30) {
        inconsistencias.push(`⚠️ Sem contato há ${diasAtraso} dias - risco churn`);
      }
    }
    
    return inconsistencias;
  };

  const contatosComErros = contacts.filter(c => validarConsistenciaContato(c).length > 0);

  // Métricas globais
  const metricas = {
    playbooks_ativos: playbooks.filter(p => p.ativo).length,
    execucoes_ativas: execucoes.filter(e => e.status === 'ativo' || e.status === 'waiting_follow_up').length,
    taxa_sucesso: execucoes.length > 0
      ? Math.round((execucoes.filter(e => e.status === 'concluido').length / execucoes.length) * 100)
      : 0,
    contacts_score_alto: contacts.filter(c => c.cliente_score >= 70).length,
    threads_abertas: threads.filter(t => t.status === 'aberta').length,
    insights_pendentes: insights.filter(i => i.status === 'pendente').length,
    contacts_inconsistencias: contatosComErros.length
  };

  // Dados para gráficos (últimos 7 dias)
  const getDadosUltimos7Dias = () => {
    const dados = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      
      const execucoesDia = execucoes.filter(e => 
        e.created_date.split('T')[0] === dataStr
      );
      
      dados.push({
        data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        execucoes: execucoesDia.length,
        sucesso: execucoesDia.filter(e => e.status === 'concluido').length,
        falha: execucoesDia.filter(e => e.status === 'cancelado' || e.status === 'erro').length
      });
    }
    return dados;
  };

  const dadosGrafico = getDadosUltimos7Dias();

  return (
    <div className="space-y-6">
      {/* Header - Nexus Command Center */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900 rounded-2xl shadow-2xl border-2 border-purple-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/50 animate-pulse">
              <Brain className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                🤖 Nexus Command Center
              </h1>
              <p className="text-slate-300 mt-1">
                Central de Controle e Orquestração Inteligente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleDiagnostico}
              disabled={diagnosing}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold shadow-lg"
            >
              {diagnosing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Diagnosticando...
                </>
              ) : (
                <>
                  <Bug className="w-5 h-5 mr-2" />
                  Diagnóstico
                </>
              )}
            </Button>

            <Button
              onClick={handleExecutarCiclo}
              disabled={executing}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-lg"
            >
              {executing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Executar Ciclo
                </>
              )}
            </Button>

            {lastExecution && (
              <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                <p className="text-xs text-slate-300">Última Execução</p>
                <p className="text-sm font-semibold text-white">
                  {new Date(lastExecution.timestamp).toLocaleTimeString('pt-BR')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Playbooks Ativos</p>
                <p className="text-2xl font-bold text-purple-600">
                  {metricas.playbooks_ativos}
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Execuções Ativas</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metricas.execucoes_ativas}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-green-600">
                  {metricas.taxa_sucesso}%
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Leads Quentes</p>
                <p className="text-2xl font-bold text-amber-600">
                  {metricas.contacts_score_alto}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-2 ${metricas.contacts_inconsistencias > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Inconsistências</p>
                <p className={`text-2xl font-bold ${metricas.contacts_inconsistencias > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {metricas.contacts_inconsistencias}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <AlertCircle className={`w-8 h-8 ${metricas.contacts_inconsistencias > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                      {metricas.contacts_inconsistencias > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                          {metricas.contacts_inconsistencias > 9 ? '9+' : metricas.contacts_inconsistencias}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="space-y-1">
                      {contatosComErros.slice(0, 5).map((c, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold">{c.nome || c.telefone}</p>
                          {validarConsistenciaContato(c).map((err, j) => (
                            <p key={j} className="text-red-200">{err}</p>
                          ))}
                        </div>
                      ))}
                      {contatosComErros.length > 5 && <p className="text-xs text-gray-300 mt-2">+{contatosComErros.length - 5} mais...</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Conversas Abertas</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {metricas.threads_abertas}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Insights IA</p>
                <p className="text-2xl font-bold text-orange-600">
                  {metricas.insights_pendentes}
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Última Execução */}
      {lastExecution && (
        <Card className={`border-2 ${
          lastExecution.status_geral === 'sucesso' ? 'border-green-300 bg-green-50/30' :
          lastExecution.status_geral === 'parcial' ? 'border-amber-300 bg-amber-50/30' :
          'border-red-300 bg-red-50/30'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastExecution.status_geral === 'sucesso' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : lastExecution.status_geral === 'parcial' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              Última Execução do Ciclo - {lastExecution.status_geral.toUpperCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-slate-600">Tempo Total</p>
                <p className="text-lg font-bold">
                  {(lastExecution.tempo_total_ms / 1000).toFixed(2)}s
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Timestamp</p>
                <p className="text-lg font-bold">
                  {new Date(lastExecution.timestamp).toLocaleTimeString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Etapas</p>
                <p className="text-lg font-bold">
                  {Object.keys(lastExecution.etapas).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Alertas</p>
                <p className="text-lg font-bold text-amber-600">
                  {lastExecution.alertas?.length || 0}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(lastExecution.etapas).map(([nome, etapa]) => (
                <div key={nome} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    {etapa.status === 'sucesso' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : etapa.status === 'erro' ? (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="font-medium capitalize">
                      {nome.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    {etapa.tempo_ms && (
                      <span>{etapa.tempo_ms}ms</span>
                    )}
                    {etapa.processadas !== undefined && (
                      <Badge variant="outline">
                        {etapa.processadas} processadas
                      </Badge>
                    )}
                    {etapa.insights_gerados !== undefined && (
                      <Badge className="bg-purple-500">
                        {etapa.insights_gerados} insights
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lastExecution.alertas && lastExecution.alertas.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-900 mb-2">⚠️ Alertas:</p>
                <ul className="space-y-1">
                  {lastExecution.alertas.map((alerta, idx) => (
                    <li key={idx} className="text-sm text-amber-800">
                      • {alerta.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Execuções nos Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="execucoes" 
                  stackId="1"
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  name="Total"
                />
                <Area 
                  type="monotone" 
                  dataKey="sucesso" 
                  stackId="2"
                  stroke="#10b981" 
                  fill="#10b981" 
                  name="Sucesso"
                />
                <Area 
                  type="monotone" 
                  dataKey="falha" 
                  stackId="2"
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  name="Falha"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Performance por Playbook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={playbooks.slice(0, 5).map(p => {
                const execsPlaybook = execucoes.filter(e => e.flow_template_id === p.id);
                const sucessos = execsPlaybook.filter(e => e.status === 'concluido').length;
                return {
                  nome: p.nome.substring(0, 15),
                  execucoes: execsPlaybook.length,
                  taxa: execsPlaybook.length > 0 ? Math.round((sucessos / execsPlaybook.length) * 100) : 0
                };
              })}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <ChartTooltip />
                <Legend />
                <Bar dataKey="execucoes" fill="#8b5cf6" name="Execuções" />
                <Bar dataKey="taxa" fill="#10b981" name="Taxa Sucesso (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights Pendentes */}
      {insights.length > 0 && (
        <Card className="border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Insights de IA Aguardando Ação ({insights.filter(i => i.status === 'pendente').length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.filter(i => i.status === 'pendente').slice(0, 5).map(insight => (
                <div key={insight.id} className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-purple-900">{insight.playbook_nome}</p>
                    <p className="text-sm text-purple-700 mt-1">{insight.descricao}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-purple-500 text-white text-xs">
                        {insight.insight_tipo}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Confiança: {Math.round((insight.confianca || 0) * 100)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}