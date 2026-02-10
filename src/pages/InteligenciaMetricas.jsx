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
  Sparkles
} from 'lucide-react';

export default function InteligenciaMetricas() {
  const [usuario, setUsuario] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  const { clientes, estatisticas, totalUrgentes, criticos } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 20,
    limit: 100,
    autoRefresh: true
  });

  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(console.error);
  }, []);

  useEffect(() => {
    if (usuario) {
      carregarMetricas();
    }
  }, [usuario]);

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      // Buscar análises das últimas 24h
      const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const analises = await base44.entities.ContactBehaviorAnalysis.filter(
        { ultima_analise: { $gte: dataLimite } },
        '-ultima_analise',
        500
      );

      // Calcular métricas agregadas
      const totalAnalises = analises.length;
      const comInsights = analises.filter(a => a.insights).length;
      const taxaSucesso = totalAnalises > 0 ? Math.round((comInsights / totalAnalises) * 100) : 0;

      const scoresMedios = {
        deal_risk: Math.round(analises.reduce((sum, a) => sum + (a.insights?.scores?.deal_risk || 0), 0) / totalAnalises) || 0,
        buy_intent: Math.round(analises.reduce((sum, a) => sum + (a.insights?.scores?.buy_intent || 0), 0) / totalAnalises) || 0,
        engagement: Math.round(analises.reduce((sum, a) => sum + (a.insights?.scores?.engagement || 0), 0) / totalAnalises) || 0,
        health: Math.round(analises.reduce((sum, a) => sum + (a.insights?.scores?.health || 0), 0) / totalAnalises) || 0
      };

      const alertasAtivos = analises.reduce((sum, a) => sum + (a.insights?.alerts?.length || 0), 0);
      
      const porStage = analises.reduce((acc, a) => {
        const stage = a.insights?.stage?.current || 'desconhecido';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});

      setMetricas({
        totalAnalises,
        taxaSucesso,
        scoresMedios,
        alertasAtivos,
        porStage,
        ultimaAtualizacao: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!usuario || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 animate-pulse text-purple-600 mx-auto mb-3" />
          <p className="text-slate-600">Carregando métricas de inteligência...</p>
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

          <Button onClick={carregarMetricas} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
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
                {metricas?.totalAnalises || 0}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Taxa de sucesso: {metricas?.taxaSucesso || 0}%
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
                Contatos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {clientes.length}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Analisados
              </p>
            </CardContent>
          </Card>
        </div>

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
          <Card>
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