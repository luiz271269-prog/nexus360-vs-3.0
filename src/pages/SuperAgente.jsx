import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  Play, 
  Pause, 
  Settings, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Shield,
  Activity,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SuperAgente() {
  const [comandoInput, setComandoInput] = useState('');
  const [modoExecucao, setModoExecucao] = useState('copilot');
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const queryClient = useQueryClient();

  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const lista = await base44.entities.SkillRegistry.filter({ ativa: true }, '-created_date', 100);
      return lista;
    }
  });

  const { data: execucoes = [], isLoading: loadingExecucoes } = useQuery({
    queryKey: ['skill-execucoes'],
    queryFn: async () => {
      const lista = await base44.entities.SkillExecution.list('-created_date', 50);
      return lista;
    }
  });

  const executarComando = async () => {
    if (!comandoInput.trim()) {
      toast.error('Digite um comando');
      return;
    }

    setExecutando(true);
    setResultado(null);

    try {
      const resposta = await base44.functions.invoke('superAgente', {
        comando_texto: comandoInput,
        modo: modoExecucao
      });

      setResultado(resposta.data || resposta);
      
      if (resposta.data?.success || resposta.success) {
        toast.success('Comando executado com sucesso');
      } else if (resposta.data?.requer_confirmacao || resposta.requer_confirmacao) {
        toast.warning('Comando requer confirmação');
      } else {
        toast.error('Erro ao executar comando');
      }

      queryClient.invalidateQueries({ queryKey: ['skill-execucoes'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });

    } catch (error) {
      console.error('Erro ao executar comando:', error);
      toast.error('Erro: ' + error.message);
      setResultado({ success: false, error: error.message });
    } finally {
      setExecutando(false);
    }
  };

  const getRiscoColor = (nivel) => {
    switch (nivel) {
      case 'baixo': return 'bg-green-100 text-green-800';
      case 'medio': return 'bg-yellow-100 text-yellow-800';
      case 'alto': return 'bg-orange-100 text-orange-800';
      case 'critico': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiscoIcon = (nivel) => {
    switch (nivel) {
      case 'baixo': return <CheckCircle2 className="w-4 h-4" />;
      case 'medio': return <AlertTriangle className="w-4 h-4" />;
      case 'alto': return <AlertTriangle className="w-4 h-4" />;
      case 'critico': return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getCategoriaColor = (categoria) => {
    switch (categoria) {
      case 'automacao': return 'bg-purple-100 text-purple-800';
      case 'analise': return 'bg-blue-100 text-blue-800';
      case 'comunicacao': return 'bg-green-100 text-green-800';
      case 'gestao_dados': return 'bg-orange-100 text-orange-800';
      case 'inteligencia': return 'bg-indigo-100 text-indigo-800';
      case 'sistema': return 'bg-gray-100 text-gray-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
              Super Agente
            </h1>
            <p className="text-slate-600 mt-1">Sistema universal de automações inteligentes baseado em skills</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2">
            {skills.length} Skills Ativas
          </Badge>
        </div>

        {/* Command Interface */}
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Console de Comando
            </CardTitle>
            <CardDescription>
              Digite comandos em linguagem natural. Ex: "listar clientes classe A", "followup orçamentos parados 7 dias"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-3">
              <Input
                value={comandoInput}
                onChange={(e) => setComandoInput(e.target.value)}
                placeholder="Digite seu comando..."
                className="flex-1 text-base"
                onKeyPress={(e) => e.key === 'Enter' && executarComando()}
                disabled={executando}
              />
              <select
                value={modoExecucao}
                onChange={(e) => setModoExecucao(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white"
                disabled={executando}
              >
                <option value="copilot">Copilot (sugere)</option>
                <option value="autonomous_safe">Autônomo Seguro</option>
                <option value="dry_run">Simulação</option>
                <option value="critical">Crítico (confirmação)</option>
              </select>
              <Button
                onClick={executarComando}
                disabled={executando || !comandoInput.trim()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-6"
              >
                {executando ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Executando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Executar
                  </>
                )}
              </Button>
            </div>

            {/* Resultado */}
            {resultado && (
              <div className={`p-4 rounded-lg border-2 ${
                resultado.success ? 'bg-green-50 border-green-200' :
                resultado.requer_confirmacao ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {resultado.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : resultado.requer_confirmacao ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-2">
                      {resultado.success ? '✓ Sucesso' :
                       resultado.requer_confirmacao ? '⚠ Confirmação Necessária' :
                       '✗ Erro'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{resultado.message || resultado.plano_execucao}</p>
                    {resultado.skill_executada && (
                      <Badge className="mt-2 bg-white border border-slate-300">
                        Skill: {resultado.skill_executada}
                      </Badge>
                    )}
                    {resultado.duracao_ms && (
                      <Badge className="mt-2 ml-2 bg-white border border-slate-300">
                        {resultado.duracao_ms}ms
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="skills" className="space-y-4">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="skills">Skills Disponíveis</TabsTrigger>
            <TabsTrigger value="execucoes">Histórico de Execuções</TabsTrigger>
            <TabsTrigger value="metricas">Métricas de Performance</TabsTrigger>
          </TabsList>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((skill) => (
                <Card key={skill.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {skill.display_name}
                          {skill.ativa ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Pause className="w-4 h-4 text-gray-400" />
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge className={getCategoriaColor(skill.categoria)}>
                        {skill.categoria}
                      </Badge>
                      <Badge className={`${getRiscoColor(skill.nivel_risco)} flex items-center gap-1`}>
                        {getRiscoIcon(skill.nivel_risco)}
                        {skill.nivel_risco}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 mb-3">{skill.descricao}</p>
                    
                    {skill.performance && (
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">Taxa de Sucesso:</span>
                          <span className="font-semibold text-green-600">
                            {skill.performance.taxa_sucesso?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">Execuções:</span>
                          <span className="font-semibold">{skill.performance.total_execucoes}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">Tempo Médio:</span>
                          <span className="font-semibold">{skill.performance.tempo_medio_ms}ms</span>
                        </div>
                      </div>
                    )}

                    {skill.exemplos_uso && skill.exemplos_uso.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Exemplo:</p>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded block">
                          {skill.exemplos_uso[0].comando}
                        </code>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Execuções Tab */}
          <TabsContent value="execucoes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Execuções</CardTitle>
                <CardDescription>Últimas 50 execuções de skills</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {execucoes.map((exec) => (
                    <div
                      key={exec.id}
                      className={`p-4 rounded-lg border ${
                        exec.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{exec.skill_name}</span>
                            <Badge className="text-xs">{exec.execution_mode}</Badge>
                            {exec.success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            {exec.created_date && format(new Date(exec.created_date), 'dd/MM/yyyy HH:mm:ss')}
                          </p>
                          {exec.error_message && (
                            <p className="text-xs text-red-600 mt-1">{exec.error_message}</p>
                          )}
                        </div>
                        {exec.duration_ms && (
                          <Badge variant="outline" className="text-xs">
                            {exec.duration_ms}ms
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Métricas Tab */}
          <TabsContent value="metricas" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Total de Execuções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">
                    {execucoes.length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Taxa de Sucesso Geral
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">
                    {((execucoes.filter(e => e.success).length / execucoes.length) * 100 || 0).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Skills Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-indigo-600">
                    {skills.filter(s => s.ativa).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}