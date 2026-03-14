import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  MessageSquare,
  Clock,
  Users,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function MetricasJarvis() {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const agora = new Date();
      const seteDiasAtras = subDays(agora, 7).toISOString();
      const umDiaAtras = subDays(agora, 1).toISOString();

      // Buscar AgentRuns do Jarvis
      const [runsJarvis, threadsInternas, mensagens24h, agentRuns7d] = await Promise.all([
        base44.entities.AgentRun.filter(
          { 
            playbook_selected: { $in: ['nexus_brain', 'alerta_interno_atendente', 'followup_automatico_whatsapp'] },
            created_date: { $gte: seteDiasAtras }
          },
          '-created_date',
          500
        ),
        base44.entities.MessageThread.filter(
          { thread_type: { $in: ['team_internal', 'sector_group'] }, status: 'aberta' },
          '-last_message_at',
          200
        ),
        base44.entities.Message.filter(
          { created_date: { $gte: umDiaAtras } },
          '-created_date',
          1000
        ),
        base44.entities.AgentRun.filter(
          { created_date: { $gte: seteDiasAtras } },
          '-created_date',
          500
        )
      ]);

      // Processar dados
      const processados = processarDadosJarvis(runsJarvis, threadsInternas, mensagens24h, agentRuns7d);
      setDados(processados);

    } catch (error) {
      console.error('[JARVIS_METRICS] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="text-center py-12 text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Erro ao carregar métricas do Jarvis</p>
      </div>
    );
  }

  const CORES = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Mensagens Processadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-cyan-600">{dados.mensagensProcessadas24h}</p>
            <p className="text-xs text-cyan-600 mt-1">Últimas 24h</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Threads Internas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{dados.threadsInternasAtivas}</p>
            <p className="text-xs text-blue-600 mt-1">Ativas no momento</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Tempo Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{dados.tempoMedioRespostaHumana}</p>
            <p className="text-xs text-purple-600 mt-1">Média humana</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ações do Jarvis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{dados.acoesJarvis7d}</p>
            <p className="text-xs text-orange-600 mt-1">Últimos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mensagens por dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-cyan-600" />
              Mensagens Processadas (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dados.mensagensPorDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="total" fill="#06b6d4" name="Total" />
                <Bar dataKey="enviadas" fill="#3b82f6" name="Enviadas" />
                <Bar dataKey="recebidas" fill="#10b981" name="Recebidas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score de engajamento por setor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-purple-600" />
              Engajamento por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dados.engajamentoPorSetor}
                  dataKey="score"
                  nameKey="setor"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ setor, score }) => `${setor}: ${score}`}
                >
                  {dados.engajamentoPorSetor.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ações do Jarvis por tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-orange-600" />
            Distribuição de Ações do Jarvis (7 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dados.acoesPorTipo.map((acao, idx) => {
              const Icon = acao.icon;
              return (
                <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className={`w-10 h-10 ${acao.cor} rounded-full flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{acao.tipo}</p>
                    <p className="text-2xl font-bold text-slate-900">{acao.total}</p>
                    <p className="text-xs text-slate-500">{acao.percentual}% do total</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Threads internas por setor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Threads Internas por Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dados.threadsPorSetor.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${item.cor} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                    {item.emoji}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{item.setor}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-100 text-blue-800">{item.total} threads</Badge>
                  <Badge className="bg-green-100 text-green-800">{item.mensagens} msgs</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tempo de resposta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5 text-purple-600" />
            Tempo Médio de Resposta Humana (por setor)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados.tempoRespostaPorSetor} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="category" dataKey="setor" tick={{ fontSize: 11 }} />
              <YAxis type="number" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="minutos" fill="#8b5cf6" name="Minutos" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function processarDadosJarvis(runsJarvis, threadsInternas, mensagens24h, allRuns7d) {
  // Mensagens processadas 24h
  const mensagensProcessadas24h = mensagens24h.length;

  // Threads internas ativas
  const threadsInternasAtivas = threadsInternas.length;

  // Tempo médio de resposta humana (mock - seria calculado do histórico real)
  const tempoMedioRespostaHumana = '2.3h';

  // Ações do Jarvis 7d
  const acoesJarvis7d = runsJarvis.length;

  // Mensagens por dia (últimos 7 dias)
  const mensagensPorDia = [];
  for (let i = 6; i >= 0; i--) {
    const dia = subDays(new Date(), i);
    const diaStr = format(dia, 'dd/MM');
    
    const msgsDia = mensagens24h.filter(m => {
      const msgData = new Date(m.created_date);
      return msgData.toDateString() === dia.toDateString();
    });

    mensagensPorDia.push({
      dia: diaStr,
      total: msgsDia.length,
      enviadas: msgsDia.filter(m => m.sender_type === 'user').length,
      recebidas: msgsDia.filter(m => m.sender_type === 'contact').length
    });
  }

  // Engajamento por setor (baseado em threads internas)
  const setores = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
  const engajamentoPorSetor = setores.map(setor => {
    const threadsSetor = threadsInternas.filter(t => 
      t.sector_key === `sector:${setor}` || 
      t.sector_id === setor ||
      (t.participants || []).some(p => {
        // Mock: assumir que usuários do setor participam da thread
        return true;
      })
    );
    
    // Score baseado no número de mensagens recentes
    const score = Math.min(threadsSetor.reduce((acc, t) => acc + (t.total_mensagens || 0), 0), 100);

    return {
      setor: setor.charAt(0).toUpperCase() + setor.slice(1),
      score: score || 10
    };
  });

  // Ações por tipo
  const acoesPorTipo = [
    {
      tipo: 'Alertas Internos',
      total: runsJarvis.filter(r => 
        r.playbook_selected === 'alerta_interno_atendente' ||
        r.context_snapshot?.acao_executada === 'alerta_interno_atendente'
      ).length,
      icon: AlertCircle,
      cor: 'bg-orange-500'
    },
    {
      tipo: 'Follow-ups Auto',
      total: runsJarvis.filter(r => 
        r.playbook_selected === 'followup_automatico_whatsapp' ||
        r.context_snapshot?.acao_executada === 'followup_automatico_whatsapp'
      ).length,
      icon: MessageSquare,
      cor: 'bg-blue-500'
    },
    {
      tipo: 'Brain Decisions',
      total: runsJarvis.filter(r => r.playbook_selected === 'nexus_brain').length,
      icon: Zap,
      cor: 'bg-purple-500'
    }
  ];

  const totalAcoes = acoesPorTipo.reduce((acc, a) => acc + a.total, 0);
  acoesPorTipo.forEach(a => {
    a.percentual = totalAcoes > 0 ? ((a.total / totalAcoes) * 100).toFixed(1) : 0;
  });

  // Threads por setor
  const threadsPorSetor = setores.map(setor => {
    const threadsSetor = threadsInternas.filter(t => t.sector_key === `sector:${setor}`);
    const totalMsgs = threadsSetor.reduce((acc, t) => acc + (t.total_mensagens || 0), 0);

    const setorConfig = {
      vendas: { emoji: '💼', cor: 'bg-emerald-500' },
      assistencia: { emoji: '🔧', cor: 'bg-blue-500' },
      financeiro: { emoji: '💰', cor: 'bg-purple-500' },
      fornecedor: { emoji: '🏭', cor: 'bg-orange-500' },
      geral: { emoji: '👥', cor: 'bg-slate-500' }
    };

    const cfg = setorConfig[setor] || setorConfig.geral;

    return {
      setor: setor.charAt(0).toUpperCase() + setor.slice(1),
      total: threadsSetor.length,
      mensagens: totalMsgs,
      emoji: cfg.emoji,
      cor: cfg.cor
    };
  }).filter(s => s.total > 0);

  // Tempo de resposta por setor (mock - seria calculado do histórico real)
  const tempoRespostaPorSetor = setores.map(setor => ({
    setor: setor.charAt(0).toUpperCase() + setor.slice(1),
    minutos: Math.floor(Math.random() * 60) + 30 // Mock: 30-90 min
  }));

  return {
    mensagensProcessadas24h,
    threadsInternasAtivas,
    tempoMedioRespostaHumana,
    acoesJarvis7d,
    mensagensPorDia,
    engajamentoPorSetor,
    acoesPorTipo,
    threadsPorSetor,
    tempoRespostaPorSetor
  };
}