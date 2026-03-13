import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useContatosInteligentes } from '../components/hooks/useContatosInteligentes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Sparkles,
  Workflow,
  Bot,
  Cpu
} from 'lucide-react';

export default function InteligenciaMetricas() {
  const [usuario, setUsuario] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [automacoes, setAutomacoes] = useState([]);
  const [skills, setSkills] = useState([]);
  const [agentes, setAgentes] = useState([]);

  const { clientes, estatisticas, totalUrgentes, criticos } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 20,
    limit: 100,
    autoRefresh: true
  });

  useEffect(() => {
    const init = async () => {
      try {
        const user = await base44.auth.me();
        console.log('[METRICAS] Usuario carregado:', user);
        setUsuario(user);
        await carregarMetricas();
      } catch (error) {
        console.error('[METRICAS] Erro ao carregar usuario:', error);
        setLoading(false);
      }
    };
    init();
  }, []);

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      const agora = Date.now();
      const limite24h = new Date(agora - 24 * 60 * 60 * 1000).toISOString();
      const limite7d = new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Buscar TODAS análises usando created_date (campo correto)
      const [analises24h, analises7d, todasAnalises] = await Promise.all([
        base44.entities.ContactBehaviorAnalysis.filter(
          { created_date: { $gte: limite24h } },
          '-created_date',
          500
        ),
        base44.entities.ContactBehaviorAnalysis.filter(
          { created_date: { $gte: limite7d } },
          '-created_date',
          500
        ),
        base44.entities.ContactBehaviorAnalysis.list('-created_date', 1000)
      ]);

      // 2. Buscar contatos ativos (leads + clientes)
      const contatosAtivos = await base44.entities.Contact.filter(
        { tipo_contato: { $in: ['lead', 'cliente'] } },
        '-created_date',
        500
      );

      // 3. Buscar TODAS mensagens das últimas 24h
      const mensagens24h = await base44.entities.Message.filter(
        { created_date: { $gte: limite24h } },
        '-created_date',
        1000
      );

      // 4. Buscar threads ativas
      const threadsAtivas = await base44.entities.MessageThread.filter(
        { 
          status: 'aberta',
          thread_type: 'contact_external'
        },
        '-last_message_at',
        500
      );

      // Calcular métricas 24h
      const totalAnalises24h = analises24h.length;
      const comInsights24h = analises24h.filter(a => a.insights && Object.keys(a.insights).length > 0).length;
      const taxaSucesso = totalAnalises24h > 0 ? Math.round((comInsights24h / totalAnalises24h) * 100) : 0;

      // Scores médios de TODAS as análises (não só 24h)
      const analisesComScores = todasAnalises.filter(a => a.insights?.scores);
      const totalComScores = analisesComScores.length;
      
      const scoresMedios = totalComScores > 0 ? {
        deal_risk: Math.round(analisesComScores.reduce((sum, a) => sum + (a.insights.scores.deal_risk || 0), 0) / totalComScores),
        buy_intent: Math.round(analisesComScores.reduce((sum, a) => sum + (a.insights.scores.buy_intent || 0), 0) / totalComScores),
        engagement: Math.round(analisesComScores.reduce((sum, a) => sum + (a.insights.scores.engagement || 0), 0) / totalComScores),
        health: Math.round(analisesComScores.reduce((sum, a) => sum + (a.insights.scores.health || 0), 0) / totalComScores)
      } : { deal_risk: 0, buy_intent: 0, engagement: 0, health: 0 };

      // Alertas ativos (todas análises)
      const alertasAtivos = todasAnalises.reduce((sum, a) => {
        const alerts = a.insights?.alerts;
        return sum + (Array.isArray(alerts) ? alerts.length : 0);
      }, 0);
      
      // Distribuição por stage (todas análises COM stage definido)
      const porStage = {};
      todasAnalises.forEach(a => {
        const stage = a.insights?.stage?.current;
        if (stage && stage !== 'desconhecido') {
          porStage[stage] = (porStage[stage] || 0) + 1;
        }
      });

      // Cobertura de análise
      const contactIdsComAnalise = new Set(todasAnalises.map(a => a.contact_id));
      const contatosComAnalise = contatosAtivos.filter(c => contactIdsComAnalise.has(c.id)).length;
      const taxaCobertura = contatosAtivos.length > 0 
        ? Math.round((contatosComAnalise / contatosAtivos.length) * 100) 
        : 0;

      // Volume de mensagens
      const volumeMensagens = {
        total: mensagens24h.length,
        enviadas: mensagens24h.filter(m => m.sender_type === 'user').length,
        recebidas: mensagens24h.filter(m => m.sender_type === 'contact').length
      };

      // Buscar automações, skills e agentes
      const [automacoesData, skillsData, agentesData] = await Promise.all([
        base44.entities.AutomationRule?.filter?.({ ativa: true }, '-created_date', 50).catch(() => []) || [],
        base44.entities.SkillExecution?.filter?.({ status: 'ativo' }, '-created_date', 50).catch(() => []) || [],
        base44.entities.AgentRun?.filter?.({ status: { $in: ['processando', 'sucesso'] } }, '-created_date', 50).catch(() => []) || []
      ]);
      
      setAutomacoes(automacoesData || []);
      setSkills(skillsData || []);
      setAgentes(agentesData || []);

      console.log('[METRICAS] 📊 Dados carregados:', {
        analises24h: totalAnalises24h,
        analises7d: analises7d.length,
        totalAnalises: todasAnalises.length,
        analisesComScores: totalComScores,
        contatosAtivos: contatosAtivos.length,
        mensagens24h: mensagens24h.length,
        threadsAtivas: threadsAtivas.length,
        taxaSucesso,
        scoresMedios,
        alertasAtivos,
        porStage
      });

      setMetricas({
        totalAnalises24h,
        totalAnalises7d: analises7d.length,
        totalAnalisesGeral: todasAnalises.length,
        taxaSucesso,
        taxaCobertura,
        scoresMedios,
        alertasAtivos,
        porStage,
        volumeMensagens,
        contatosAtivos: contatosAtivos.length,
        contatosComAnalise,
        threadsAtivas: threadsAtivas.length,
        ultimaAtualizacao: new Date().toISOString()
      });
    } catch (error) {
      console.error('[METRICAS] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metricas) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse text-purple-600 mx-auto mb-3" />
          <p className="text-slate-600">Carregando métricas de inteligência...</p>
        </div>
      </div>
    );
  }

  if (!metricas) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">Erro ao carregar métricas</p>
          <Button onClick={carregarMetricas}>Tentar Novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              Métricas de Inteligência
            </h1>
            <p className="text-slate-600">
              Performance e análise da IA em tempo real · Nexus360
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={async () => {
                setLoading(true);
                try {
                  const resp = await base44.functions.invoke('executarAnaliseDiariaContatos', {});
                  const criadas = resp.data?.total_analises_criadas || 0;
                  if (criadas > 0) {
                    setTimeout(() => carregarMetricas(), 2000);
                  }
                } catch (error) {
                  console.error('[METRICAS] Erro ao rodar análise:', error);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
            >
              <Zap className="w-4 h-4" />
              Rodar Análise Agora
            </Button>

            <Button onClick={carregarMetricas} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Cards principais - Camada 3 (Priorização) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Análises (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">
                {metricas?.totalAnalises24h || 0}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Sucesso: {metricas?.taxaSucesso || 0}% · 7d: {metricas?.totalAnalises7d || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {totalUrgentes}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Críticos: {criticos.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {metricas?.alertasAtivos || 0}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Requerem ação
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Cobertura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {metricas?.taxaCobertura || 0}%
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {metricas?.contatosComAnalise || 0} de {metricas?.contatosAtivos || 0} contatos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Volume de mensagens */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-600" />
              Volume de Mensagens (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {metricas?.volumeMensagens?.total || 0}
                </p>
                <p className="text-xs text-slate-600 mt-1">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {metricas?.volumeMensagens?.enviadas || 0}
                </p>
                <p className="text-xs text-slate-600 mt-1">Enviadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {metricas?.volumeMensagens?.recebidas || 0}
                </p>
                <p className="text-xs text-slate-600 mt-1">Recebidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scores Médios - Camada 1 (Análise) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-600" />
                Scores Médios (IA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreBar
                label="Risco de Perda"
                value={metricas?.scoresMedios?.deal_risk || 0}
                color="red"
              />
              <ScoreBar
                label="Intenção de Compra"
                value={metricas?.scoresMedios?.buy_intent || 0}
                color="green"
              />
              <ScoreBar
                label="Engajamento"
                value={metricas?.scoresMedios?.engagement || 0}
                color="blue"
              />
              <ScoreBar
                label="Saúde da Conta"
                value={metricas?.scoresMedios?.health || 0}
                color="purple"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-slate-600" />
                Distribuição por Estágio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metricas?.porStage && Object.entries(metricas.porStage)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 capitalize">
                      {stage.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {count}
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* Estatísticas por Prioridade - Camada 3 */}
        {estatisticas && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-600" />
                Distribuição por Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {estatisticas.porPrioridade?.CRITICO || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Críticos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {estatisticas.porPrioridade?.ALTO || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Alta</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {estatisticas.porPrioridade?.MEDIO || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Média</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {estatisticas.porPrioridade?.BAIXO || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">Baixa</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Automações em Tempo Real */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Automações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="w-5 h-5 text-blue-600" />
                Automações Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {automacoes.length > 0 ? (
                  <>
                    <div className="text-center py-4 bg-blue-50 rounded-lg">
                      <p className="text-3xl font-bold text-blue-600">{automacoes.length}</p>
                      <p className="text-xs text-blue-600 mt-1">Rodando agora</p>
                    </div>
                    <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                      {automacoes.slice(0, 10).map(auto => (
                        <div key={auto.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border-l-2 border-blue-500">
                          <span className="text-slate-700 truncate">{auto.name || 'Auto'}</span>
                          <Badge className="bg-blue-100 text-blue-800 text-[10px]">✓</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma automação ativa</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="w-5 h-5 text-purple-600" />
                Skills Executando
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {skills.length > 0 ? (
                  <>
                    <div className="text-center py-4 bg-purple-50 rounded-lg">
                      <p className="text-3xl font-bold text-purple-600">{skills.length}</p>
                      <p className="text-xs text-purple-600 mt-1">Em execução</p>
                    </div>
                    <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                      {skills.slice(0, 10).map(skill => (
                        <div key={skill.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border-l-2 border-purple-500">
                          <span className="text-slate-700 truncate">{skill.skill_name || 'Skill'}</span>
                          <Badge className="bg-purple-100 text-purple-800 text-[10px]">⚡</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Cpu className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhuma skill ativa</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="w-5 h-5 text-green-600" />
                Agentes Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agentes.length > 0 ? (
                  <>
                    <div className="text-center py-4 bg-green-50 rounded-lg">
                      <p className="text-3xl font-bold text-green-600">{agentes.length}</p>
                      <p className="text-xs text-green-600 mt-1">Online</p>
                    </div>
                    <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                      {agentes.slice(0, 10).map(agent => (
                        <div key={agent.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border-l-2 border-green-500">
                          <span className="text-slate-700 truncate">{agent.agent_name || 'Agent'}</span>
                          <Badge className={`text-[10px] ${agent.status === 'processando' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                            {agent.status === 'processando' ? '🔄' : '✓'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Nenhum agente ativo</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  const colorClasses = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-bold text-slate-900">{value}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}