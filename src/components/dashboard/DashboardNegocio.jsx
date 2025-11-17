import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  DollarSign,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Download,
  Activity
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { toast } from "sonner";

export default function DashboardNegocio() {
  const [periodo, setPeriodo] = useState('30');

  const { data: kpisGerais, isLoading: loadingKPIs, refetch: refetchKPIs } = useQuery({
    queryKey: ['kpis_gerais'],
    queryFn: async () => {
      const res = await base44.functions.invoke('metricsEngine', { action: 'general_kpis' });
      return res.data;
    },
    refetchInterval: 60000
  });

  const { data: previsaoReceita, isLoading: loadingPrevisao } = useQuery({
    queryKey: ['previsao_receita'],
    queryFn: async () => {
      const res = await base44.functions.invoke('metricsEngine', { action: 'predicted_revenue' });
      return res.data;
    }
  });

  const { data: conversaoPorCanal } = useQuery({
    queryKey: ['conversao_canal'],
    queryFn: async () => {
      const res = await base44.functions.invoke('metricsEngine', { action: 'conversion_by_channel' });
      return res.data;
    }
  });

  const { data: insightsIA, refetch: refetchInsights } = useQuery({
    queryKey: ['insights_estrategicos'],
    queryFn: async () => {
      const res = await base44.functions.invoke('businessIA', { action: 'strategic_insights' });
      return res.data;
    },
    refetchInterval: 300000
  });

  const handleExportarDados = async () => {
    toast.info('Exportando dados...');
    const dados = {
      kpis: kpisGerais,
      previsao: previsaoReceita,
      insights: insightsIA
    };
    
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-negocio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    
    toast.success('Dados exportados!');
  };

  const handleAtualizarMetricas = async () => {
    toast.info('Atualizando métricas...');
    await Promise.all([
      refetchKPIs(),
      refetchInsights()
    ]);
    toast.success('Métricas atualizadas!');
  };

  if (loadingKPIs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const kpis = kpisGerais?.kpis || {};

  const dadosCanal = conversaoPorCanal?.canais ? Object.entries(conversaoPorCanal.canais).map(([nome, dados]) => ({
    nome: nome.charAt(0).toUpperCase() + nome.slice(1),
    conversao: dados.taxa_conversao || 0,
    iniciados: dados.iniciados || 0
  })) : [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard de Negócio</h1>
          <p className="text-slate-600 mt-1">Visão executiva com insights de IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAtualizarMetricas}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={handleExportarDados}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  {kpis.taxa_conversao || 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">Últimos 30 dias</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Receita Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  R$ {(kpis.receita_total || 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {kpis.total_vendas || 0} vendas
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  R$ {(kpis.ticket_medio || 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-slate-500 mt-1">Por venda</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Engajamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  {kpis.taxa_engajamento || 0}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {kpis.total_conversas || 0} conversas
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Conversão por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosCanal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="conversao" fill="#3b82f6" name="Taxa de Conversão (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Previsão de Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPrevisao ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Conservadora</p>
                    <p className="text-2xl font-bold text-green-900">
                      R$ {(previsaoReceita?.previsao?.conservadora || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Realista</p>
                    <p className="text-2xl font-bold text-blue-900">
                      R$ {(previsaoReceita?.previsao?.realista || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Target className="w-6 h-6 text-blue-600" />
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Otimista</p>
                    <p className="text-2xl font-bold text-purple-900">
                      R$ {(previsaoReceita?.previsao?.otimista || 0).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>

                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-slate-600">
                    Confiança: <span className="font-semibold">{previsaoReceita?.previsao?.confianca || 0}%</span>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            Insights Estratégicos da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!insightsIA || insightsIA.insights?.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p>Tudo funcionando perfeitamente! Nenhum alerta no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {insightsIA.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    insight.severidade === 'critica' ? 'bg-red-50 border-l-red-500' :
                    insight.severidade === 'alta' ? 'bg-amber-50 border-l-amber-500' :
                    insight.severidade === 'media' ? 'bg-blue-50 border-l-blue-500' :
                    'bg-slate-50 border-l-slate-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {insight.tipo === 'alerta' && <AlertCircle className="w-5 h-5 text-red-600 mt-1" />}
                    {insight.tipo === 'oportunidade' && <TrendingUp className="w-5 h-5 text-green-600 mt-1" />}
                    {insight.tipo === 'recomendacao' && <CheckCircle className="w-5 h-5 text-blue-600 mt-1" />}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-slate-900">{insight.titulo}</h4>
                        <Badge className={
                          insight.severidade === 'critica' ? 'bg-red-500' :
                          insight.severidade === 'alta' ? 'bg-amber-500' :
                          'bg-blue-500'
                        }>
                          {insight.severidade}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{insight.descricao}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Target className="w-3 h-3" />
                        <span className="font-medium">{insight.acao_recomendada}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}