import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { AlertCircle, TrendingDown, TrendingUp, Users, Clock, Target, DollarSign, Zap, Filter, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export default function GestaoComercial() {
  const [usuario, setUsuario] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const navigate = useNavigate();

  useEffect(() => {
    carregarDados();
  }, [filtroSetor]);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const usuarioAtual = await base44.auth.me();
      setUsuario(usuarioAtual);

      if (usuarioAtual?.role !== 'admin') {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      const [atendentes, contatos, threads, comportamentos, tarefas] = await Promise.all([
        base44.asServiceRole.entities.User.filter({ role: 'user' }, '-created_date', 100),
        base44.asServiceRole.entities.Contact.filter({}, '-cliente_score', 1000),
        base44.asServiceRole.entities.MessageThread.filter({}, '-last_message_at', 500),
        base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({}, '-ultima_analise', 500),
        base44.asServiceRole.entities.TarefaInteligente.filter({}, '-created_date', 500)
      ]);

      const metricasCalculadas = calcularMetricas(atendentes, contatos, threads, comportamentos, tarafas);
      setMetricas(metricasCalculadas);
    } catch (erro) {
      console.error('[GESTAO_COMERCIAL] Erro:', erro);
    } finally {
      setCarregando(false);
    }
  };

  const calcularMetricas = (atendentes, contatos, threads, comportamentos, tarefas) => {
    // === DESEMPENHO DE ATENDENTES ===
    const desempenhoAtendentes = atendentes.map(user => {
      const threadsAtendente = threads.filter(t => t.assigned_user_id === user.id);
      const temposResposta = threadsAtendente
        .filter(t => t.tempo_primeira_resposta_minutos !== null)
        .map(t => t.tempo_primeira_resposta_minutos);
      
      const tempoMedioResposta = temposResposta.length > 0
        ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
        : 0;

      const respostas = threads.filter(t => 
        t.assigned_user_id === user.id && 
        t.last_message_sender === 'user'
      ).length;

      return {
        id: user.id,
        nome: user.full_name,
        setor: user.attendant_sector || 'geral',
        threadsAtivas: threadsAtendente.length,
        tempoMedioResposta,
        taxaResposta: threadsAtendente.length > 0 
          ? Math.round((respostas / threadsAtendente.length) * 100) 
          : 0,
        threadsSemResposta: threadsAtendente.filter(t => t.last_message_sender === 'contact').length
      };
    });

    // === TAXA DE CONVERSÃO POR FUNIL ===
    const totalOrcamentos = contatos.filter(c => c.tipo_contato === 'lead').length;
    const clientesFechados = contatos.filter(c => c.tipo_contato === 'cliente').length;
    const taxaConversao = totalOrcamentos > 0 
      ? Math.round((clientesFechados / totalOrcamentos) * 100) 
      : 0;

    const funil = [
      { nome: 'Leads', valor: totalOrcamentos, cor: '#3b82f6' },
      { nome: 'Qualificados', valor: contatos.filter(c => c.classe_abc === 'A').length, cor: '#10b981' },
      { nome: 'Fechados', valor: clientesFechados, cor: '#10b981' }
    ];

    // === CLIENTES EM RISCO ===
    const clientesEmRisco = comportamentos
      .filter(cb => {
        const contato = contatos.find(c => c.id === cb.contact_id);
        return contato && ['lead', 'cliente'].includes(contato.tipo_contato);
      })
      .map(cb => {
        const contato = contatos.find(c => c.id === cb.contact_id);
        const thread = threads.find(t => t.contact_id === cb.contact_id);
        
        const score_risco = calcularScoreRisco(cb, thread, contato);
        
        return {
          id: contato.id,
          nome: contato.nome,
          email: contato.email || 'N/A',
          scoreRisco: score_risco,
          motivo: identificarMotivo(cb, thread, contato),
          diasSemResposta: calcularDiasSemResposta(thread),
          ultimaInteracao: thread?.last_message_at ? new Date(thread.last_message_at).toLocaleDateString('pt-BR') : 'N/A',
          vendedor: contato.vendedor_responsavel || 'Não atribuído',
          cliente_score: contato.cliente_score || 0
        };
      })
      .filter(c => c.scoreRisco >= 50)
      .sort((a, b) => b.scoreRisco - a.scoreRisco)
      .slice(0, 20);

    // === TEMPO MÉDIO DE RESPOSTA POR SETOR ===
    const setores = [...new Set(atendentes.map(a => a.attendant_sector || 'geral'))];
    const tempoMedioPorSetor = setores.map(setor => {
      const atendentesSetor = atendentes.filter(a => (a.attendant_sector || 'geral') === setor);
      const tempos = atendentesSetor
        .flatMap(a => threads.filter(t => t.assigned_user_id === a.id))
        .filter(t => t.tempo_primeira_resposta_minutos !== null)
        .map(t => t.tempo_primeira_resposta_minutos);
      
      const tempoMedio = tempos.length > 0
        ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
        : 0;

      return {
        setor: setor.charAt(0).toUpperCase() + setor.slice(1),
        tempoMedio,
        atendentes: atendentesSetor.length,
        threadsAtivas: atendentesSetor.reduce((sum, a) => sum + threads.filter(t => t.assigned_user_id === a.id).length, 0)
      };
    });

    // === EVOLUÇÃO DA TAXA DE CONVERSÃO ===
    const ultimosMeses = gerarUltimosMeses(6);
    const evolucaoConversao = ultimosMeses.map(mes => {
      const contatos_mes = contatos.filter(c => {
        const mesContato = new Date(c.created_date).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        return mesContato === mes;
      });
      const leads_mes = contatos_mes.filter(c => c.tipo_contato === 'lead').length;
      const clientes_mes = contatos_mes.filter(c => c.tipo_contato === 'cliente').length;
      
      return {
        mes,
        leads: leads_mes,
        clientes: clientes_mes,
        taxa: leads_mes > 0 ? Math.round((clientes_mes / leads_mes) * 100) : 0
      };
    });

    return {
      desempenhoAtendentes,
      taxaConversaoGeral: taxaConversao,
      funil,
      clientesEmRisco,
      tempoMedioPorSetor,
      evolucaoConversao,
      totalAtendentes: atendentes.length,
      totalClientes: contatos.length,
      totalThreadsAtivas: threads.filter(t => t.status === 'aberta').length
    };
  };

  const calcularScoreRisco = (comportamento, thread, contato) => {
    let score = 0;

    // Falta de respostas
    if (thread) {
      const diasSemResposta = calcularDiasSemResposta(thread);
      if (diasSemResposta > 7) score += 30;
      else if (diasSemResposta > 3) score += 20;
    }

    // Baixo engajamento
    if (comportamento.score_engajamento < 40) score += 25;
    else if (comportamento.score_engajamento < 60) score += 15;

    // Sentimento negativo
    if (comportamento.analise_sentimento?.score_sentimento < 40) score += 25;

    // Risco de churn detectado
    if (comportamento.segmento_sugerido === 'risco_churn') score += 20;

    // Score baixo no cliente
    if (contato.cliente_score < 30) score += 15;

    return Math.min(100, score);
  };

  const calcularDiasSemResposta = (thread) => {
    if (!thread?.last_message_at) return 0;
    const diasMs = Date.now() - new Date(thread.last_message_at).getTime();
    return Math.floor(diasMs / (1000 * 60 * 60 * 24));
  };

  const identificarMotivo = (comportamento, thread, contato) => {
    const motivos = [];
    
    if (thread && calcularDiasSemResposta(thread) > 7) motivos.push('Sem resposta há dias');
    if (comportamento.score_engajamento < 40) motivos.push('Baixo engajamento');
    if (comportamento.analise_sentimento?.score_sentimento < 40) motivos.push('Sentimento negativo');
    if (comportamento.segmento_sugerido === 'risco_churn') motivos.push('Alto risco de churn');
    
    return motivos.length > 0 ? motivos.join(', ') : 'Monitorar';
  };

  const gerarUltimosMeses = (qtd) => {
    const meses = [];
    for (let i = qtd - 1; i >= 0; i--) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      meses.push(data.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }));
    }
    return meses;
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const atendentesSetor = metricas?.desempenhoAtendentes
    .filter(a => filtroSetor === 'todos' || a.setor === filtroSetor)
    .sort((a, b) => b.taxaResposta - a.taxaResposta);

  const setoresTodas = [...new Set(metricas?.desempenhoAtendentes.map(a => a.setor) || [])];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-2 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                📊 Gestão Comercial
              </h1>
              <p className="text-slate-300 mt-1">Desempenho de atendentes, taxa de conversão e clientes em risco</p>
            </div>
            <Button onClick={() => window.print()} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-900 to-blue-800 border-blue-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm mb-1">Taxa Conversão</p>
                  <p className="text-3xl font-bold">{metricas?.taxaConversaoGeral}%</p>
                </div>
                <Target className="w-8 h-8 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-900 to-emerald-800 border-emerald-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-200 text-sm mb-1">Atendentes Ativos</p>
                  <p className="text-3xl font-bold">{metricas?.totalAtendentes}</p>
                </div>
                <Users className="w-8 h-8 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900 to-purple-800 border-purple-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm mb-1">Threads Ativas</p>
                  <p className="text-3xl font-bold">{metricas?.totalThreadsAtivas}</p>
                </div>
                <Zap className="w-8 h-8 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-900 to-red-800 border-red-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-200 text-sm mb-1">Em Risco</p>
                  <p className="text-3xl font-bold">{metricas?.clientesEmRisco.length}</p>
                </div>
                <AlertCircle className="w-8 h-8 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seção 1: Desempenho de Atendentes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-white border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>📈 Desempenho de Atendentes</CardTitle>
                <select 
                  value={filtroSetor} 
                  onChange={(e) => setFiltroSetor(e.target.value)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="todos">Todos os setores</option>
                  {setoresTodas.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {atendentesSetor?.map((atendente) => (
                  <div key={atendente.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900">{atendente.nome}</h4>
                      <Badge variant="outline">{atendente.setor}</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div>
                        <p className="text-xs text-slate-500">Taxa Resposta</p>
                        <p className="font-bold text-slate-900">{atendente.taxaResposta}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tempo Médio</p>
                        <p className="font-bold text-slate-900">{atendente.tempoMedioResposta}min</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Threads Ativas</p>
                        <p className="font-bold text-slate-900">{atendente.threadsAtivas}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Sem Resposta</p>
                        <p className="font-bold text-red-600">{atendente.threadsSemResposta}</p>
                      </div>
                    </div>
                    <Progress value={atendente.taxaResposta} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tempo médio por setor */}
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">⏱️ Tempo Médio por Setor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metricas?.tempoMedioPorSetor || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="setor" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="tempoMedio" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Seção 2: Funil de Vendas e Evolução */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle>🎯 Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={metricas?.funil || []}
                  layout="vertical"
                  margin={{ left: 100, right: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nome" type="category" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="valor" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader>
              <CardTitle>📊 Taxa de Conversão (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricas?.evolucaoConversao || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="taxa" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Seção 3: Clientes em Risco */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              ⚠️ Clientes em Risco ({metricas?.clientesEmRisco.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Score Risco</th>
                    <th className="px-4 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-2 text-left font-semibold">Motivo</th>
                    <th className="px-4 py-2 text-left font-semibold">Dias Sem Resposta</th>
                    <th className="px-4 py-2 text-left font-semibold">Última Interação</th>
                    <th className="px-4 py-2 text-left font-semibold">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas?.clientesEmRisco.map((cliente) => (
                    <tr key={cliente.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Badge className={
                          cliente.scoreRisco >= 80 ? 'bg-red-600 text-white' :
                          cliente.scoreRisco >= 60 ? 'bg-orange-600 text-white' :
                          'bg-yellow-600 text-white'
                        }>
                          {cliente.scoreRisco}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{cliente.nome}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{cliente.motivo}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{cliente.diasSemResposta}</td>
                      <td className="px-4 py-3 text-slate-600">{cliente.ultimaInteracao}</td>
                      <td className="px-4 py-3 text-slate-600">{cliente.vendedor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}