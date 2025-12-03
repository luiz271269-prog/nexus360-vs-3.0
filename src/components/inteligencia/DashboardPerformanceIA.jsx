import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Zap,
  MessageSquare,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Activity,
  RefreshCw
} from 'lucide-react';
import { Interacao } from '@/entities/Interacao';
import { MessageThread } from '@/entities/MessageThread';
import { AprendizadoIA } from '@/entities/AprendizadoIA';
import { BaseConhecimento } from '@/entities/BaseConhecimento';
import { toast } from 'sonner';

export default function DashboardPerformanceIA() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7d'); // 7d, 30d, 90d

  useEffect(() => {
    carregarMetricas();
  }, [periodo]);

  const carregarMetricas = async () => {
    setLoading(true);
    try {
      const dataInicio = calcularDataInicio(periodo);

      const [interacoes, threads, aprendizados, baseConhecimento] = await Promise.all([
        Interacao.filter({ data_interacao: { $gte: dataInicio } }),
        MessageThread.list(),
        AprendizadoIA.list(),
        BaseConhecimento.list()
      ]);

      const metricas = calcularMetricas(interacoes, threads, aprendizados, baseConhecimento);
      setMetricas(metricas);

    } catch (error) {
      console.error("Erro ao carregar métricas:", error);
      toast.error("Erro ao carregar métricas de performance");
    }
    setLoading(false);
  };

  const calcularDataInicio = (periodo) => {
    const hoje = new Date();
    switch (periodo) {
      case '7d':
        return new Date(hoje.setDate(hoje.getDate() - 7)).toISOString();
      case '30d':
        return new Date(hoje.setDate(hoje.getDate() - 30)).toISOString();
      case '90d':
        return new Date(hoje.setDate(hoje.getDate() - 90)).toISOString();
      default:
        return new Date(hoje.setDate(hoje.getDate() - 7)).toISOString();
    }
  };

  const calcularMetricas = (interacoes, threads, aprendizados, baseConhecimento) => {
    const interacoesIA = interacoes.filter(i => i.vendedor === 'IA - NexusEngine');
    const totalInteracoes = interacoes.length;
    const totalInteracoesIA = interacoesIA.length;

    // Taxa de resolução da IA
    const resolvidasIA = interacoesIA.filter(i => i.resultado === 'resolvido_ia').length;
    const taxaResolucao = totalInteracoesIA > 0 ? (resolvidasIA / totalInteracoesIA) * 100 : 0;

    // Taxa de escalação
    const escaladas = interacoesIA.filter(i => i.resultado === 'escalado').length;
    const taxaEscalacao = totalInteracoesIA > 0 ? (escaladas / totalInteracoesIA) * 100 : 0;

    // Latência média
    const temposResposta = threads
      .filter(t => t.tempo_primeira_resposta_minutos !== null)
      .map(t => t.tempo_primeira_resposta_minutos);
    const latenciaMedia = temposResposta.length > 0
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
      : 0;

    // Distribuição de sentimentos
    const sentimentos = {
      muito_positivo: 0,
      positivo: 0,
      neutro: 0,
      negativo: 0,
      muito_negativo: 0
    };

    interacoesIA.forEach(i => {
      if (i.analise_ia?.sentimento) {
        sentimentos[i.analise_ia.sentimento]++;
      }
    });

    // Distribuição de intenções
    const intencoes = {};
    interacoesIA.forEach(i => {
      if (i.analise_ia?.intencao) {
        intencoes[i.analise_ia.intencao] = (intencoes[i.analise_ia.intencao] || 0) + 1;
      }
    });

    // Perguntas não respondidas (baixa confiança)
    const perguntasBaixaConfianca = interacoesIA.filter(i =>
      i.analise_ia?.confianca_resposta !== undefined && i.analise_ia.confianca_resposta < 0.5
    );

    // Base de conhecimento
    const docsAprovados = baseConhecimento.filter(d => d.aprovado && d.ativo).length;
    const docsPendentes = baseConhecimento.filter(d => !d.aprovado).length;
    const docsMaisUsados = baseConhecimento
      .filter(d => d.vezes_utilizado > 0)
      .sort((a, b) => b.vezes_utilizado - a.vezes_utilizado)
      .slice(0, 10);

    // Evolução temporal (últimos 7 dias)
    const evolucao = gerarEvolucaoTemporal(interacoesIA);

    return {
      kpis: {
        totalInteracoes: totalInteracoesIA,
        taxaResolucao: Math.round(taxaResolucao),
        taxaEscalacao: Math.round(taxaEscalacao),
        latenciaMedia: Math.round(latenciaMedia)
      },
      distribuicoes: {
        sentimentos: Object.entries(sentimentos).map(([key, value]) => ({
          name: key.replace('_', ' '),
          value
        })),
        intencoes: Object.entries(intencoes).map(([key, value]) => ({
          name: key.replace('_', ' '),
          value
        }))
      },
      problemas: {
        perguntasBaixaConfianca: perguntasBaixaConfianca.slice(0, 10),
        totalBaixaConfianca: perguntasBaixaConfianca.length
      },
      baseConhecimento: {
        total: baseConhecimento.length,
        aprovados: docsAprovados,
        pendentes: docsPendentes,
        maisUsados: docsMaisUsados
      },
      evolucao
    };
  };

  const gerarEvolucaoTemporal = (interacoes) => {
    const ultimos7Dias = [];
    const hoje = new Date();

    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];

      const interacoesDia = interacoes.filter(inter =>
        inter.data_interacao?.startsWith(dataStr)
      );

      const resolvidasDia = interacoesDia.filter(i => i.resultado === 'resolvido_ia').length;
      const escaladasDia = interacoesDia.filter(i => i.resultado === 'escalado').length;

      ultimos7Dias.push({
        data: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        resolvidas: resolvidasDia,
        escaladas: escaladasDia,
        total: interacoesDia.length
      });
    }

    return ultimos7Dias;
  };

  if (loading || !metricas) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const COLORS = {
    muito_positivo: '#10b981',
    positivo: '#84cc16',
    neutro: '#94a3b8',
    negativo: '#f59e0b',
    muito_negativo: '#ef4444'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                <Activity className="w-9 h-9 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                  Performance da IA
                </h2>
                <p className="text-slate-600 mt-1">
                  Monitoramento e otimização contínua
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>

              <Button variant="outline" onClick={carregarMetricas}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Interações IA</p>
                <p className="text-3xl font-bold text-blue-600">
                  {metricas.kpis.totalInteracoes}
                </p>
              </div>
              <MessageSquare className="w-10 h-10 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Taxa de Resolução</p>
                <p className="text-3xl font-bold text-green-600">
                  {metricas.kpis.taxaResolucao}%
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-20" />
            </div>
            {metricas.kpis.taxaResolucao >= 70 ? (
              <div className="flex items-center gap-1 mt-2 text-green-600 text-xs">
                <TrendingUp className="w-3 h-3" />
                Excelente performance
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-2 text-orange-600 text-xs">
                <TrendingDown className="w-3 h-3" />
                Precisa melhorar
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Taxa de Escalação</p>
                <p className="text-3xl font-bold text-orange-600">
                  {metricas.kpis.taxaEscalacao}%
                </p>
              </div>
              <UserCheck className="w-10 h-10 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Latência Média</p>
                <p className="text-3xl font-bold text-purple-600">
                  {metricas.kpis.latenciaMedia}min
                </p>
              </div>
              <Clock className="w-10 h-10 text-purple-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Análise */}
      <Tabs defaultValue="evolucao" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="evolucao">Evolução Temporal</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuições</TabsTrigger>
          <TabsTrigger value="problemas">Problemas Detectados</TabsTrigger>
          <TabsTrigger value="conhecimento">Base de Conhecimento</TabsTrigger>
        </TabsList>

        <TabsContent value="evolucao" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução nos Últimos 7 Dias</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricas.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="resolvidas" stroke="#10b981" name="Resolvidas pela IA" strokeWidth={2} />
                  <Line type="monotone" dataKey="escaladas" stroke="#ef4444" name="Escaladas" strokeWidth={2} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" name="Total" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribuicao" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Sentimentos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metricas.distribuicoes.sentimentos}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {metricas.distribuicoes.sentimentos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name.replace(' ', '_')] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Intenções</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricas.distribuicoes.intencoes}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="problemas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Perguntas com Baixa Confiança ({metricas.problemas.totalBaixaConfianca})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metricas.problemas.perguntasBaixaConfianca.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p>Nenhum problema detectado! A IA está respondendo com alta confiança.</p>
                  </div>
                ) : (
                  metricas.problemas.perguntasBaixaConfianca.map((inter, index) => (
                    <div key={index} className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{inter.cliente_nome}</p>
                          <p className="text-sm text-slate-600 mt-1">{inter.observacoes}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Intenção: {inter.analise_ia?.intencao}
                            </Badge>
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              Confiança: {Math.round((inter.analise_ia?.confianca_resposta || 0) * 100)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => toast.info("Adicione conteúdo relevante na Base de Conhecimento")}
                      >
                        <Brain className="w-3 h-3 mr-2" />
                        Melhorar Base de Conhecimento
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conhecimento" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-indigo-600">{metricas.baseConhecimento.total}</p>
                <p className="text-sm text-slate-600">Documentos Total</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-green-600">{metricas.baseConhecimento.aprovados}</p>
                <p className="text-sm text-slate-600">Aprovados e Ativos</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-yellow-600">{metricas.baseConhecimento.pendentes}</p>
                <p className="text-sm text-slate-600">Aguardando Aprovação</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top 10 Documentos Mais Utilizados</CardTitle>
            </CardHeader>
            <CardContent>
              {metricas.baseConhecimento.maisUsados.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Brain className="w-12 h-12 mx-auto mb-2" />
                  <p>Ainda não há documentos sendo utilizados pela IA</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {metricas.baseConhecimento.maisUsados.map((doc, index) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">{doc.titulo}</p>
                          <p className="text-xs text-slate-500 capitalize">{doc.categoria}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-indigo-600">{doc.vezes_utilizado}x</p>
                        {doc.taxa_sucesso && (
                          <p className="text-xs text-slate-500">{doc.taxa_sucesso}% sucesso</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}