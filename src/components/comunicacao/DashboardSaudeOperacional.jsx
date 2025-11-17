import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Timer,
  Battery
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Dashboard de Saúde Operacional do WhatsApp
 * Foco em performance, disponibilidade e prevenção de problemas
 */
export default function DashboardSaudeOperacional() {
  const [periodo, setPeriodo] = useState('24h');

  const { data: integracoes = [], isLoading: loadingIntegracoes } = useQuery({
    queryKey: ['integracoes-saude'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    refetchInterval: 30000,
    initialData: []
  });

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['threads-saude'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 200),
    refetchInterval: 30000,
    initialData: []
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens-saude'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const todasMensagens = await base44.entities.Message.list('-created_date', 500);
      return todasMensagens.filter(m => m.created_date >= dataLimite);
    },
    refetchInterval: 60000,
    initialData: []
  });

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-saude'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }),
    initialData: []
  });

  // ═══════════════════════════════════════════════════════
  // MÉTRICAS OPERACIONAIS
  // ═══════════════════════════════════════════════════════

  const agora = new Date();

  // 1. Status das Integrações
  const integracoesConectadas = integracoes.filter(i => i.status === 'conectado').length;
  const integracoesTotal = integracoes.length;
  const statusIntegracoes = integracoesConectadas === integracoesTotal ? 'saudavel' : 
                            integracoesConectadas > 0 ? 'atencao' : 'critico';

  // 2. Conversas Ativas
  const conversasAbertas = threads.filter(t => t.status === 'aberta').length;
  const conversasAguardando = threads.filter(t => t.status === 'aguardando_cliente').length;

  // 3. Janela 24h - Conversas próximas de expirar
  const conversasProximasExpirar = threads.filter(t => {
    if (!t.janela_24h_expira_em || t.status !== 'aberta') return false;
    const horasRestantes = (new Date(t.janela_24h_expira_em) - agora) / (1000 * 60 * 60);
    return horasRestantes > 0 && horasRestantes < 2;
  }).length;

  const conversasJanelaAtiva = threads.filter(t => {
    if (!t.janela_24h_expira_em) return false;
    return new Date(t.janela_24h_expira_em) > agora;
  }).length;

  // 4. Tempo de Resposta
  const mensagensUsuario = mensagens.filter(m => m.sender_type === 'user');
  const mensagensContato = mensagens.filter(m => m.sender_type === 'contact');
  
  const temposResposta = [];
  mensagensContato.forEach(msgContato => {
    const respostaUsuario = mensagensUsuario.find(m => 
      m.thread_id === msgContato.thread_id && 
      new Date(m.sent_at) > new Date(msgContato.sent_at)
    );
    
    if (respostaUsuario) {
      const diff = (new Date(respostaUsuario.sent_at) - new Date(msgContato.sent_at)) / (1000 * 60);
      if (diff > 0 && diff < 1440) { // Ignorar respostas após 24h
        temposResposta.push(diff);
      }
    }
  });

  const tempoMedioResposta = temposResposta.length > 0
    ? Math.round(temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length)
    : 0;

  const statusTempoResposta = tempoMedioResposta <= 5 ? 'excelente' :
                              tempoMedioResposta <= 15 ? 'bom' :
                              tempoMedioResposta <= 30 ? 'atencao' : 'critico';

  // 5. Disponibilidade de Atendentes
  const atendentesOnline = atendentes.filter(a => a.availability_status === 'online').length;
  const atendentesTotal = atendentes.length;
  const percentualAtendentesOnline = atendentesTotal > 0 
    ? Math.round((atendentesOnline / atendentesTotal) * 100)
    : 0;

  // 6. Carga de Trabalho
  const cargaTotal = threads.filter(t => t.status === 'aberta' && t.assigned_user_id).length;
  const capacidadeTotal = atendentes.reduce((acc, a) => acc + (a.max_concurrent_conversations || 5), 0);
  const percentualCarga = capacidadeTotal > 0
    ? Math.round((cargaTotal / capacidadeTotal) * 100)
    : 0;

  const statusCarga = percentualCarga < 70 ? 'saudavel' :
                      percentualCarga < 90 ? 'atencao' : 'critico';

  // 7. Conversas Não Atribuídas
  const conversasNaoAtribuidas = threads.filter(t => 
    t.status === 'aberta' && !t.assigned_user_id
  ).length;

  // 8. Taxa de Resposta
  const totalMensagensCliente = mensagensContato.length;
  const mensagensRespondidas = mensagensContato.filter(msgContato => {
    return mensagensUsuario.some(m => 
      m.thread_id === msgContato.thread_id && 
      new Date(m.sent_at) > new Date(msgContato.sent_at)
    );
  }).length;

  const taxaResposta = totalMensagensCliente > 0
    ? Math.round((mensagensRespondidas / totalMensagensCliente) * 100)
    : 0;

  // ═══════════════════════════════════════════════════════
  // SCORE GERAL DE SAÚDE (0-100)
  // ═══════════════════════════════════════════════════════

  const scoreIntegracoes = (integracoesConectadas / Math.max(integracoesTotal, 1)) * 25;
  const scoreTempoResposta = statusTempoResposta === 'excelente' ? 25 :
                             statusTempoResposta === 'bom' ? 20 :
                             statusTempoResposta === 'atencao' ? 10 : 5;
  const scoreAtendentes = (atendentesOnline / Math.max(atendentesTotal, 1)) * 25;
  const scoreCarga = statusCarga === 'saudavel' ? 25 :
                     statusCarga === 'atencao' ? 15 : 5;

  const scoreGeral = Math.round(scoreIntegracoes + scoreTempoResposta + scoreAtendentes + scoreCarga);

  const statusGeral = scoreGeral >= 80 ? 'excelente' :
                      scoreGeral >= 60 ? 'bom' :
                      scoreGeral >= 40 ? 'atencao' : 'critico';

  // ═══════════════════════════════════════════════════════
  // ALERTAS E AÇÕES
  // ═══════════════════════════════════════════════════════

  const alertas = [];

  if (integracoesConectadas < integracoesTotal) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Integração WhatsApp Offline',
      mensagem: `${integracoesTotal - integracoesConectadas} integração(ões) desconectada(s)`,
      acao: 'diagnosticar',
      icon: AlertCircle
    });
  }

  if (conversasProximasExpirar > 0) {
    alertas.push({
      tipo: 'urgente',
      titulo: 'Janelas 24h Expirando',
      mensagem: `${conversasProximasExpirar} conversa(s) expira(m) em menos de 2 horas`,
      acao: 'ver_conversas',
      icon: Timer
    });
  }

  if (conversasNaoAtribuidas > 5) {
    alertas.push({
      tipo: 'atencao',
      titulo: 'Conversas Sem Atendente',
      mensagem: `${conversasNaoAtribuidas} conversas aguardando atribuição`,
      acao: 'atribuir',
      icon: Users
    });
  }

  if (percentualCarga > 90) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Equipe Sobrecarregada',
      mensagem: `Capacidade em ${percentualCarga}% - considere adicionar atendentes`,
      acao: 'gerenciar_equipe',
      icon: AlertTriangle
    });
  }

  if (atendentesOnline === 0 && atendentesTotal > 0) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Nenhum Atendente Online',
      mensagem: 'Sistema sem cobertura humana no momento',
      acao: 'alertar_equipe',
      icon: Users
    });
  }

  const handleAcao = (acao) => {
    switch (acao) {
      case 'diagnosticar':
        window.location.href = '/Comunicacao?tab=diagnostico';
        break;
      case 'ver_conversas':
        window.location.href = '/Comunicacao?tab=conversas';
        break;
      case 'atribuir':
        toast.info('Funcionalidade de atribuição em massa em desenvolvimento');
        break;
      case 'gerenciar_equipe':
        window.location.href = '/Usuarios';
        break;
      case 'alertar_equipe':
        toast.info('Notificações automáticas para equipe em desenvolvimento');
        break;
    }
  };

  const handleRecarregar = async () => {
    toast.info('Atualizando dados...');
    window.location.reload();
  };

  if (loadingIntegracoes || loadingThreads) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Score Geral */}
      <Card className={`border-2 ${
        statusGeral === 'excelente' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
        statusGeral === 'bom' ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200' :
        statusGeral === 'atencao' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' :
        'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl ${
                statusGeral === 'excelente' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                statusGeral === 'bom' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                statusGeral === 'atencao' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                'bg-gradient-to-br from-red-500 to-pink-600'
              }`}>
                {statusGeral === 'excelente' ? (
                  <CheckCircle className="w-10 h-10 text-white" />
                ) : statusGeral === 'bom' ? (
                  <TrendingUp className="w-10 h-10 text-white" />
                ) : statusGeral === 'atencao' ? (
                  <AlertTriangle className="w-10 h-10 text-white" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-white" />
                )}
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Score de Saúde: {scoreGeral}/100
                </h2>
                <p className="text-lg mt-1">
                  <Badge className={`${
                    statusGeral === 'excelente' ? 'bg-green-600' :
                    statusGeral === 'bom' ? 'bg-blue-600' :
                    statusGeral === 'atencao' ? 'bg-amber-600' :
                    'bg-red-600'
                  } text-white`}>
                    {statusGeral === 'excelente' ? '✨ Excelente' :
                     statusGeral === 'bom' ? '👍 Bom' :
                     statusGeral === 'atencao' ? '⚠️ Atenção Necessária' :
                     '🚨 Crítico'}
                  </Badge>
                </p>
                <p className="text-sm text-slate-600 mt-2">
                  Performance da Comunicação WhatsApp - Últimas 24h
                </p>
              </div>
            </div>

            <Button
              onClick={handleRecarregar}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <Progress value={scoreGeral} className="h-3 mt-4" />
        </CardContent>
      </Card>

      {/* Alertas Críticos */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Alertas Operacionais ({alertas.length})
          </h3>
          {alertas.map((alerta, idx) => {
            const Icon = alerta.icon;
            return (
              <Alert
                key={idx}
                className={`${
                  alerta.tipo === 'critico' ? 'bg-red-50 border-red-300' :
                  alerta.tipo === 'urgente' ? 'bg-amber-50 border-amber-300' :
                  'bg-blue-50 border-blue-300'
                }`}
              >
                <Icon className={`h-5 w-5 ${
                  alerta.tipo === 'critico' ? 'text-red-600' :
                  alerta.tipo === 'urgente' ? 'text-amber-600' :
                  'text-blue-600'
                }`} />
                <AlertTitle className="font-bold">{alerta.titulo}</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alerta.mensagem}</span>
                  <Button
                    size="sm"
                    onClick={() => handleAcao(alerta.acao)}
                    className={`${
                      alerta.tipo === 'critico' ? 'bg-red-600 hover:bg-red-700' :
                      alerta.tipo === 'urgente' ? 'bg-amber-600 hover:bg-amber-700' :
                      'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Resolver Agora
                  </Button>
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      )}

      {/* Métricas Detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Integrações */}
        <Card className={`${
          statusIntegracoes === 'saudavel' ? 'border-green-200 bg-green-50/30' :
          statusIntegracoes === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
          'border-red-200 bg-red-50/30'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <Activity className={`w-8 h-8 ${
                statusIntegracoes === 'saudavel' ? 'text-green-600' :
                statusIntegracoes === 'atencao' ? 'text-amber-600' :
                'text-red-600'
              }`} />
              <Badge className={`${
                statusIntegracoes === 'saudavel' ? 'bg-green-600' :
                statusIntegracoes === 'atencao' ? 'bg-amber-600' :
                'bg-red-600'
              } text-white`}>
                {integracoesConectadas}/{integracoesTotal}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Integrações Conectadas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {Math.round((integracoesConectadas / Math.max(integracoesTotal, 1)) * 100)}%
            </p>
            <Progress 
              value={(integracoesConectadas / Math.max(integracoesTotal, 1)) * 100} 
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>

        {/* Tempo de Resposta */}
        <Card className={`${
          statusTempoResposta === 'excelente' ? 'border-green-200 bg-green-50/30' :
          statusTempoResposta === 'bom' ? 'border-blue-200 bg-blue-50/30' :
          statusTempoResposta === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
          'border-red-200 bg-red-50/30'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <Clock className={`w-8 h-8 ${
                statusTempoResposta === 'excelente' ? 'text-green-600' :
                statusTempoResposta === 'bom' ? 'text-blue-600' :
                statusTempoResposta === 'atencao' ? 'text-amber-600' :
                'text-red-600'
              }`} />
              <Badge className={`${
                statusTempoResposta === 'excelente' ? 'bg-green-600' :
                statusTempoResposta === 'bom' ? 'bg-blue-600' :
                statusTempoResposta === 'atencao' ? 'bg-amber-600' :
                'bg-red-600'
              } text-white`}>
                {statusTempoResposta === 'excelente' ? 'Excelente' :
                 statusTempoResposta === 'bom' ? 'Bom' :
                 statusTempoResposta === 'atencao' ? 'Atenção' : 'Crítico'}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Tempo Médio de Resposta</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {tempoMedioResposta}min
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Meta: {'<'} 15 minutos
            </p>
          </CardContent>
        </Card>

        {/* Atendentes Online */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <Users className="w-8 h-8 text-blue-600" />
              <Badge className="bg-blue-600 text-white">
                {atendentesOnline}/{atendentesTotal}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Atendentes Online</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {percentualAtendentesOnline}%
            </p>
            <Progress value={percentualAtendentesOnline} className="h-2 mt-2" />
          </CardContent>
        </Card>

        {/* Carga de Trabalho */}
        <Card className={`${
          statusCarga === 'saudavel' ? 'border-green-200 bg-green-50/30' :
          statusCarga === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
          'border-red-200 bg-red-50/30'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <Battery className={`w-8 h-8 ${
                statusCarga === 'saudavel' ? 'text-green-600' :
                statusCarga === 'atencao' ? 'text-amber-600' :
                'text-red-600'
              }`} />
              <Badge className={`${
                statusCarga === 'saudavel' ? 'bg-green-600' :
                statusCarga === 'atencao' ? 'bg-amber-600' :
                'bg-red-600'
              } text-white`}>
                {cargaTotal}/{capacidadeTotal}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Capacidade Utilizada</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {percentualCarga}%
            </p>
            <Progress value={percentualCarga} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Métricas Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Conversas Ativas</span>
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-700">{conversasAbertas}</p>
            <p className="text-xs text-slate-500 mt-1">
              {conversasAguardando} aguardando cliente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Janelas 24h Ativas</span>
              <Timer className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-700">{conversasJanelaAtiva}</p>
            {conversasProximasExpirar > 0 && (
              <p className="text-xs text-red-600 mt-1 font-semibold">
                ⚠️ {conversasProximasExpirar} expirando em {'<'} 2h
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Taxa de Resposta</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700">{taxaResposta}%</p>
            <Progress value={taxaResposta} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Mensagem de Status Geral */}
      {alertas.length === 0 && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-900 font-bold">Sistema Operacional</AlertTitle>
          <AlertDescription className="text-green-800">
            Todas as métricas estão dentro do esperado. Continue monitorando para manter a excelência operacional.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}