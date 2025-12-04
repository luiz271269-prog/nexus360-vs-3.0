
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Zap,
  TrendingUp,
  Clock,
  Target,
  Activity,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  PlayCircle,
  Users,
  MessageSquare,
  Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Dashboard de Playbooks - Centro de Comando de Automações
 * Métricas reais, acionáveis e com fontes claras
 */
export default function DashboardPlaybooks() {
  const [periodo, setPeriodo] = useState('7d');

  // Buscar todos os playbooks ativos
  const { data: playbooks = [], isLoading: loadingPlaybooks } = useQuery({
    queryKey: ['playbooks-dashboard'],
    queryFn: () => base44.entities.FlowTemplate.list('-created_date'),
    initialData: []
  });

  // Buscar todas as execuções
  const { data: execucoes = [], isLoading: loadingExecucoes } = useQuery({
    queryKey: ['execucoes-dashboard'],
    queryFn: () => base44.entities.FlowExecution.list('-started_at', 500),
    refetchInterval: 10000,
    initialData: []
  });

  // Buscar contatos para análise de impacto
  const { data: contatos = [] } = useQuery({
    queryKey: ['contatos-dashboard'],
    queryFn: () => base44.entities.Contact.list('-created_date', 200),
    initialData: []
  });

  // ═══════════════════════════════════════════════════════
  // CÁLCULO DE MÉTRICAS REAIS
  // ═══════════════════════════════════════════════════════

  const agora = new Date();
  const diasAtras = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 1;
  const dataInicio = subDays(agora, diasAtras);

  // Filtrar execuções do período
  const execucoesPeriodo = execucoes.filter(exec => {
    if (!exec.started_at) return false;
    return new Date(exec.started_at) >= dataInicio;
  });

  // 1. Total de Execuções no Período
  const totalExecucoes = execucoesPeriodo.length;

  // 2. Execuções Ativas AGORA
  const execucoesAtivas = execucoes.filter(e => e.status === 'ativo' || e.status === 'waiting_follow_up').length;

  // 3. Taxa de Sucesso
  const execucoesConcluidas = execucoesPeriodo.filter(e => e.status === 'concluido');
  const execucoesErro = execucoesPeriodo.filter(e => e.status === 'erro' || e.status === 'cancelado');
  const taxaSucesso = totalExecucoes > 0 
    ? Math.round((execucoesConcluidas.length / totalExecucoes) * 100) 
    : 0;

  // 4. Tempo Médio de Conclusão
  const temposExecucao = execucoesConcluidas
    .filter(e => e.started_at && e.completed_at)
    .map(e => {
      const inicio = new Date(e.started_at);
      const fim = new Date(e.completed_at);
      return (fim - inicio) / (1000 * 60); // minutos
    });

  const tempoMedio = temposExecucao.length > 0
    ? Math.round(temposExecucao.reduce((a, b) => a + b, 0) / temposExecucao.length)
    : 0;

  // 5. Playbooks Ativos (com ativo = true)
  const playbooksAtivos = playbooks.filter(p => p.ativo === true).length;

  // 6. Follow-ups Aguardando
  const followUpsAguardando = execucoes.filter(e => e.status === 'waiting_follow_up').length;

  // 7. Taxa de Engajamento (respostas dos clientes)
  const execucoesComRespostas = execucoesPeriodo.filter(e => 
    e.response_count && e.response_count > 0
  ).length;
  const taxaEngajamento = totalExecucoes > 0
    ? Math.round((execucoesComRespostas / totalExecucoes) * 100)
    : 0;

  // ═══════════════════════════════════════════════════════
  // TENDÊNCIA (GRÁFICO)
  // ═══════════════════════════════════════════════════════

  const dadosGrafico = [];
  for (let i = diasAtras - 1; i >= 0; i--) {
    const data = subDays(agora, i);
    const dataStr = format(data, 'yyyy-MM-dd');
    
    const execucoesDia = execucoes.filter(e => {
      if (!e.started_at) return false;
      const execData = format(new Date(e.started_at), 'yyyy-MM-dd');
      return execData === dataStr;
    });

    dadosGrafico.push({
      data: format(data, 'dd/MM', { locale: ptBR }),
      execucoes: execucoesDia.length,
      sucesso: execucoesDia.filter(e => e.status === 'concluido').length
    });
  }

  // ═══════════════════════════════════════════════════════
  // TOP 5 PLAYBOOKS POR PERFORMANCE
  // ═══════════════════════════════════════════════════════

  const performancePorPlaybook = {};
  
  execucoesPeriodo.forEach(exec => {
    if (!exec.flow_template_id) return;
    
    if (!performancePorPlaybook[exec.flow_template_id]) {
      const playbook = playbooks.find(p => p.id === exec.flow_template_id);
      performancePorPlaybook[exec.flow_template_id] = {
        id: exec.flow_template_id,
        nome: playbook?.nome || 'Playbook Desconhecido',
        total: 0,
        concluidos: 0,
        ativos: 0,
        erros: 0
      };
    }

    performancePorPlaybook[exec.flow_template_id].total++;
    
    if (exec.status === 'concluido') {
      performancePorPlaybook[exec.flow_template_id].concluidos++;
    } else if (exec.status === 'ativo' || exec.status === 'waiting_follow_up') {
      performancePorPlaybook[exec.flow_template_id].ativos++;
    } else if (exec.status === 'erro' || exec.status === 'cancelado') {
      performancePorPlaybook[exec.flow_template_id].erros++;
    }
  });

  const topPlaybooks = Object.values(performancePorPlaybook)
    .map(p => ({
      ...p,
      taxaSucesso: p.total > 0 ? Math.round((p.concluidos / p.total) * 100) : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ═══════════════════════════════════════════════════════
  // INDICADORES DE TENDÊNCIA
  // ═══════════════════════════════════════════════════════

  const metadeAnterior = Math.floor(diasAtras / 2);
  const execucoesPrimeiraMetade = execucoesPeriodo.filter(e => {
    const dataExec = new Date(e.started_at);
    const dataCorte = subDays(agora, metadeAnterior);
    return dataExec < dataCorte;
  }).length;

  const execucoesSegundaMetade = execucoesPeriodo.filter(e => {
    const dataExec = new Date(e.started_at);
    const dataCorte = subDays(agora, metadeAnterior);
    return dataExec >= dataCorte;
  }).length;

  const tendencia = execucoesSegundaMetade > execucoesPrimeiraMetade ? 'crescimento' :
                    execucoesSegundaMetade < execucoesPrimeiraMetade ? 'declinio' : 'estavel';

  const percentualMudanca = execucoesPrimeiraMetade > 0
    ? Math.round(((execucoesSegundaMetade - execucoesPrimeiraMetade) / execucoesPrimeiraMetade) * 100)
    : 0;

  const TrendIcon = tendencia === 'crescimento' ? ArrowUp : tendencia === 'declinio' ? ArrowDown : Minus;
  const trendColor = tendencia === 'crescimento' ? 'text-green-600' : tendencia === 'declinio' ? 'text-red-600' : 'text-slate-600';

  // ═══════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════

  if (loadingPlaybooks || loadingExecucoes) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
          <p className="text-slate-600">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtro de Período */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-purple-600" />
            Dashboard de Automações
          </h2>
          <p className="text-slate-600 mt-1">Visão geral da performance dos playbooks</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={periodo === '1d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodo('1d')}
          >
            Hoje
          </Button>
          <Button
            variant={periodo === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodo('7d')}
          >
            7 Dias
          </Button>
          <Button
            variant={periodo === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodo('30d')}
          >
            30 Dias
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {/* Total de Execuções */}
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total de Execuções</p>
                <p className="text-3xl font-bold text-purple-700">{totalExecucoes}</p>
                <div className={`flex items-center gap-1 mt-2 text-xs ${trendColor}`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{Math.abs(percentualMudanca)}%</span>
                </div>
              </div>
              <Zap className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Execuções Ativas */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Execuções Ativas</p>
                <p className="text-3xl font-bold text-blue-700">{execucoesAtivas}</p>
                <p className="text-xs text-blue-600 mt-2">Rodando agora</p>
              </div>
              <Activity className="w-10 h-10 text-blue-600 opacity-50 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-green-700">{taxaSucesso}%</p>
                <Progress value={taxaSucesso} className="mt-2 h-1" />
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Tempo Médio */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Tempo Médio</p>
                <p className="text-3xl font-bold text-amber-700">{tempoMedio}m</p>
                <p className="text-xs text-amber-600 mt-2">Por execução</p>
              </div>
              <Clock className="w-10 h-10 text-amber-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Playbooks Ativos */}
        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Playbooks Ativos</p>
                <p className="text-3xl font-bold text-pink-700">{playbooksAtivos}</p>
                <p className="text-xs text-pink-600 mt-2">De {playbooks.length} total</p>
              </div>
              <Target className="w-10 h-10 text-pink-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Follow-ups Aguardando */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Follow-ups Aguardando</p>
                <p className="text-3xl font-bold text-orange-700">{followUpsAguardando}</p>
                <p className="text-xs text-orange-600 mt-2">Próximas ações</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Engajamento */}
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Taxa Engajamento</p>
                <p className="text-3xl font-bold text-teal-700">{taxaEngajamento}%</p>
                <p className="text-xs text-teal-600 mt-2">Clientes responderam</p>
              </div>
              <TrendingUp className="w-10 h-10 text-teal-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Tendência de Execuções - {periodo === '7d' ? '7 Dias' : periodo === '30d' ? '30 Dias' : 'Hoje'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="execucoes" 
                stroke="#9333ea" 
                strokeWidth={2}
                name="Total"
              />
              <Line 
                type="monotone" 
                dataKey="sucesso" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Sucesso"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 5 Playbooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Top 5 Playbooks Mais Executados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topPlaybooks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma execução no período selecionado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topPlaybooks.map((pb, idx) => (
                <div key={pb.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{pb.nome}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {pb.total} execuções
                      </span>
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        {pb.concluidos} sucesso
                      </span>
                      {pb.ativos > 0 && (
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Activity className="w-3 h-3 text-blue-600" />
                          {pb.ativos} ativas
                        </span>
                      )}
                      {pb.erros > 0 && (
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          {pb.erros} erros
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={
                      pb.taxaSucesso >= 80 ? 'bg-green-100 text-green-800' :
                      pb.taxaSucesso >= 50 ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {pb.taxaSucesso}% sucesso
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fonte dos Dados */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 mb-2">📊 Fonte dos Dados</p>
              <div className="text-xs text-slate-600 space-y-1">
                <p><strong>Execuções:</strong> FlowExecution (últimos {periodo === '7d' ? '7 dias' : periodo === '30d' ? '30 dias' : 'hoje'})</p>
                <p><strong>Playbooks:</strong> FlowTemplate (todos cadastrados)</p>
                <p><strong>Taxa de Sucesso:</strong> (Concluídos / Total) × 100</p>
                <p><strong>Tempo Médio:</strong> Média de (completed_at - started_at) em minutos</p>
                <p><strong>Engajamento:</strong> Execuções com response_count {'>'} 0</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
