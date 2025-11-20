import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
  Zap,
  RefreshCw,
  UserPlus,
  AlertCircle,
  Timer,
  Battery,
  MessageSquare,
  BarChart3,
  Wifi,
  WifiOff,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import SeletorEstrategia from './SeletorEstrategia';

/**
 * Central de Controle Operacional - Dashboard Unificado
 * Consolida: Filas + Saúde + Métricas em tempo real
 */
export default function CentralControleOperacional({ onSelecionarThread, usuarioAtual }) {
  const [estrategia, setEstrategia] = useState('prioridade');
  const [atribuindo, setAtribuindo] = useState(null);

  // ═══════════════════════════════════════════════════════
  // DADOS
  // ═══════════════════════════════════════════════════════

  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes-controle'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    refetchInterval: 30000,
    initialData: []
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['threads-controle'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 200),
    refetchInterval: 30000,
    initialData: []
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens-controle'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const todasMensagens = await base44.entities.Message.list('-created_date', 500);
      return todasMensagens.filter(m => m.created_date >= dataLimite);
    },
    refetchInterval: 60000,
    initialData: []
  });

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-controle'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }),
    initialData: []
  });

  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks-controle'],
    queryFn: () => base44.entities.FlowTemplate.list('-created_date'),
    refetchInterval: 60000,
    initialData: []
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes-controle'],
    queryFn: () => base44.entities.FlowExecution.list('-started_at', 200),
    refetchInterval: 30000,
    initialData: []
  });

  const [filas, setFilas] = useState([]);
  const [estatisticasFilas, setEstatisticasFilas] = useState(null);
  const [loadingFilas, setLoadingFilas] = useState(true);

  useEffect(() => {
    carregarFilas();
    const interval = setInterval(carregarFilas, 10000);
    return () => clearInterval(interval);
  }, []);

  const carregarFilas = async () => {
    try {
      const [filaResult, statsResult] = await Promise.all([
        base44.functions.invoke('gerenciarFila', { action: 'list' }),
        base44.functions.invoke('gerenciarFila', { action: 'estatisticas' })
      ]);

      if (filaResult.data.success) {
        setFilas(filaResult.data.fila || []);
      }

      if (statsResult.data.success) {
        setEstatisticasFilas(statsResult.data.estatisticas);
      }
    } catch (error) {
      console.error('[CONTROLE] Erro ao carregar filas:', error);
    } finally {
      setLoadingFilas(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // MÉTRICAS CALCULADAS
  // ═══════════════════════════════════════════════════════

  const agora = new Date();

  // Integrações
  const integracoesConectadas = integracoes.filter(i => i.status === 'conectado').length;
  const integracoesTotal = integracoes.length;
  const statusIntegracoes = integracoesConectadas === integracoesTotal ? 'saudavel' : 
                            integracoesConectadas > 0 ? 'atencao' : 'critico';

  // Conversas
  const conversasAbertas = threads.filter(t => t.status === 'aberta').length;
  const conversasNaoAtribuidas = threads.filter(t => t.status === 'aberta' && !t.assigned_user_id).length;
  
  const conversasJanelaAtiva = threads.filter(t => {
    if (!t.janela_24h_expira_em) return false;
    return new Date(t.janela_24h_expira_em) > agora;
  }).length;

  const conversasProximasExpirar = threads.filter(t => {
    if (!t.janela_24h_expira_em || t.status !== 'aberta') return false;
    const horasRestantes = (new Date(t.janela_24h_expira_em) - agora) / (1000 * 60 * 60);
    return horasRestantes > 0 && horasRestantes < 2;
  }).length;

  // Tempo de Resposta
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
      if (diff > 0 && diff < 1440) {
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

  // Atendentes
  const atendentesOnline = atendentes.filter(a => a.availability_status === 'online').length;
  const atendentesTotal = atendentes.length;
  const percentualAtendentesOnline = atendentesTotal > 0 
    ? Math.round((atendentesOnline / atendentesTotal) * 100)
    : 0;

  // Carga de Trabalho
  const cargaTotal = threads.filter(t => t.status === 'aberta' && t.assigned_user_id).length;
  const capacidadeTotal = atendentes.reduce((acc, a) => acc + (a.max_concurrent_conversations || 5), 0);
  const percentualCarga = capacidadeTotal > 0
    ? Math.round((cargaTotal / capacidadeTotal) * 100)
    : 0;

  const statusCarga = percentualCarga < 70 ? 'saudavel' :
                      percentualCarga < 90 ? 'atencao' : 'critico';

  // Playbooks
  const playbooksAtivos = playbooks.filter(p => p.ativo).length;
  const execucoesAtivas = execucoes.filter(e => e.status === 'ativo' || e.status === 'waiting_follow_up').length;
  
  const execucoesUltimas24h = execucoes.filter(e => {
    if (!e.started_at) return false;
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(e.started_at) >= ontem;
  });

  const execucoesConcluidas = execucoesUltimas24h.filter(e => e.status === 'concluido').length;
  const taxaSucessoPlaybooks = execucoesUltimas24h.length > 0
    ? Math.round((execucoesConcluidas / execucoesUltimas24h.length) * 100)
    : 0;

  // Score Geral
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
  // HANDLERS
  // ═══════════════════════════════════════════════════════

  const atenderProximo = async (setor) => {
    if (!usuarioAtual?.id) {
      toast.error('Usuário não identificado');
      return;
    }

    setAtribuindo(setor);

    try {
      const result = await base44.functions.invoke('gerenciarFila', {
        action: 'dequeue',
        setor: setor,
        atendente_id: usuarioAtual.id,
        atendente_nome: usuarioAtual.full_name,
        estrategia: estrategia
      });

      if (result.data.success && result.data.thread_id) {
        toast.success(`✅ Conversa atribuída! Tempo de espera: ${result.data.tempo_espera_segundos}s`);
        
        const thread = await base44.entities.MessageThread.get(result.data.thread_id);
        if (onSelecionarThread) {
          onSelecionarThread(thread);
        }
        
        carregarFilas();
      } else {
        toast.info('Nenhuma conversa na fila do setor ' + setor);
      }

    } catch (error) {
      console.error('[CONTROLE] Erro ao atender:', error);
      toast.error('Erro ao atribuir conversa: ' + error.message);
    } finally {
      setAtribuindo(null);
    }
  };

  const removerDaFila = async (threadId) => {
    try {
      await base44.functions.invoke('gerenciarFila', {
        action: 'remover',
        thread_id: threadId,
        motivo: 'cancelado'
      });

      toast.success('Removido da fila');
      carregarFilas();
    } catch (error) {
      toast.error('Erro ao remover: ' + error.message);
    }
  };

  const getPrioridadeColor = (prioridade) => {
    const colors = {
      urgente: 'bg-red-500 text-white',
      alta: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      baixa: 'bg-slate-500 text-white'
    };
    return colors[prioridade] || 'bg-slate-500 text-white';
  };

  const getTempoEsperaColor = (segundos) => {
    if (segundos > 600) return 'text-red-600';
    if (segundos > 300) return 'text-orange-600';
    if (segundos > 120) return 'text-yellow-600';
    return 'text-green-600';
  };

  const setores = ['geral', 'vendas', 'assistencia', 'financeiro', 'fornecedor'];

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* 1. SCORE GERAL DE SAÚDE */}
      {/* ═══════════════════════════════════════════════════════ */}
      
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
                {statusGeral === 'excelente' ? <CheckCircle className="w-10 h-10 text-white" /> :
                 statusGeral === 'bom' ? <TrendingUp className="w-10 h-10 text-white" /> :
                 statusGeral === 'atencao' ? <AlertTriangle className="w-10 h-10 text-white" /> :
                 <AlertCircle className="w-10 h-10 text-white" />}
              </div>

              <div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Score de Saúde: {scoreGeral}/100
                </h2>
                <Badge className={`${
                  statusGeral === 'excelente' ? 'bg-green-600' :
                  statusGeral === 'bom' ? 'bg-blue-600' :
                  statusGeral === 'atencao' ? 'bg-amber-600' :
                  'bg-red-600'
                } text-white mt-2`}>
                  {statusGeral === 'excelente' ? '✨ Excelente' :
                   statusGeral === 'bom' ? '👍 Bom' :
                   statusGeral === 'atencao' ? '⚠️ Atenção' :
                   '🚨 Crítico'}
                </Badge>
                <p className="text-sm text-slate-600 mt-2">
                  Sistema de Comunicação WhatsApp
                </p>
              </div>
            </div>

            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <Progress value={scoreGeral} className="h-3 mt-4" />
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 2. MÉTRICAS OPERACIONAIS PRINCIPAIS */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={statusIntegracoes === 'saudavel' ? 'border-green-200 bg-green-50/30' :
                        statusIntegracoes === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
                        'border-red-200 bg-red-50/30'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              {statusIntegracoes === 'saudavel' ? 
                <Wifi className="w-8 h-8 text-green-600" /> :
                <WifiOff className="w-8 h-8 text-red-600" />
              }
              <Badge className={`${
                statusIntegracoes === 'saudavel' ? 'bg-green-600' :
                statusIntegracoes === 'atencao' ? 'bg-amber-600' :
                'bg-red-600'
              } text-white`}>
                {integracoesConectadas}/{integracoesTotal}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Conexões WhatsApp</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {Math.round((integracoesConectadas / Math.max(integracoesTotal, 1)) * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card className={statusTempoResposta === 'excelente' ? 'border-green-200 bg-green-50/30' :
                        statusTempoResposta === 'bom' ? 'border-blue-200 bg-blue-50/30' :
                        statusTempoResposta === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
                        'border-red-200 bg-red-50/30'}>
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
                Meta: 15min
              </Badge>
            </div>
            <p className="text-sm text-slate-600">Tempo Médio Resposta</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {tempoMedioResposta}min
            </p>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        <Card className={statusCarga === 'saudavel' ? 'border-green-200 bg-green-50/30' :
                        statusCarga === 'atencao' ? 'border-amber-200 bg-amber-50/30' :
                        'border-red-200 bg-red-50/30'}>
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
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 3. ALERTAS CRÍTICOS */}
      {/* ═══════════════════════════════════════════════════════ */}

      {statusIntegracoes === 'critico' && (
        <Alert className="bg-red-50 border-red-300">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-900 font-bold">🚨 Todas as Integrações Desconectadas</AlertTitle>
          <AlertDescription className="text-red-800">
            Sistema sem capacidade de envio/recebimento. Verifique configurações imediatamente.
          </AlertDescription>
        </Alert>
      )}

      {conversasProximasExpirar > 0 && (
        <Alert className="bg-amber-50 border-amber-300">
          <Timer className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-900 font-bold">⏰ Janelas 24h Expirando</AlertTitle>
          <AlertDescription className="text-amber-800">
            <strong>{conversasProximasExpirar} conversa(s)</strong> expirando em menos de 2 horas. Responda antes de precisar usar templates.
          </AlertDescription>
        </Alert>
      )}

      {conversasNaoAtribuidas > 5 && (
        <Alert className="bg-blue-50 border-blue-300">
          <Users className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-900 font-bold">👥 Conversas Aguardando Atendente</AlertTitle>
          <AlertDescription className="text-blue-800">
            <strong>{conversasNaoAtribuidas} conversas</strong> não atribuídas. Use o sistema de filas abaixo.
          </AlertDescription>
        </Alert>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 4. ESTATÍSTICAS DE FILAS */}
      {/* ═══════════════════════════════════════════════════════ */}

      {estatisticasFilas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Total na Fila</p>
                  <p className="text-3xl font-bold text-blue-900">{estatisticasFilas.total_na_fila}</p>
                </div>
                <Users className="w-10 h-10 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Tempo Médio Espera</p>
                  <p className="text-3xl font-bold text-amber-900">
                    {Math.floor(estatisticasFilas.tempo_medio_espera_segundos / 60)}min
                  </p>
                </div>
                <Clock className="w-10 h-10 text-amber-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Espera &gt; 5min</p>
                  <p className="text-3xl font-bold text-red-900">{estatisticasFilas.threads_acima_5min}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-red-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Urgentes</p>
                  <p className="text-3xl font-bold text-purple-900">
                    {estatisticasFilas.por_prioridade.urgente + estatisticasFilas.por_prioridade.alta}
                  </p>
                </div>
                <Zap className="w-10 h-10 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 5. AUTOMAÇÕES ATIVAS */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Playbooks Ativos</p>
                <p className="text-3xl font-bold text-purple-700">{playbooksAtivos}</p>
                <p className="text-xs text-slate-500 mt-1">{execucoesAtivas} em execução</p>
              </div>
              <Zap className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa Sucesso 24h</p>
                <p className="text-3xl font-bold text-green-700">{taxaSucessoPlaybooks}%</p>
                <p className="text-xs text-slate-500 mt-1">{execucoesUltimas24h.length} execuções</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Janela 24h Ativa</p>
                <p className="text-3xl font-bold text-blue-700">{conversasJanelaAtiva}</p>
                {conversasProximasExpirar > 0 && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    ⚠️ {conversasProximasExpirar} expirando
                  </p>
                )}
              </div>
              <Timer className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 6. ESTRATÉGIA DE ATENDIMENTO */}
      {/* ═══════════════════════════════════════════════════════ */}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Estratégia de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SeletorEstrategia 
            estrategiaAtual={estrategia}
            onMudarEstrategia={setEstrategia}
            disabled={loadingFilas || atribuindo}
          />
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 7. FILAS POR SETOR (ORDEM DE EXECUÇÃO) */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Filas de Atendimento por Setor
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {setores.map(setor => {
            const threadsDoSetor = filas.filter(f => f.setor === setor);
            const count = threadsDoSetor.length;

            if (count === 0) return null;

            return (
              <Card key={setor} className="bg-white border-slate-200">
                <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-slate-900 capitalize flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      {setor}
                    </CardTitle>
                    
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500 text-white">{count}</Badge>
                      <Button
                        size="sm"
                        onClick={() => atenderProximo(setor)}
                        disabled={atribuindo === setor}
                        className="bg-green-600 hover:bg-green-700 h-8"
                      >
                        {atribuindo === setor ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4 mr-1" />
                            Atender
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {threadsDoSetor.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          if (onSelecionarThread && item.thread_id) {
                            base44.entities.MessageThread.get(item.thread_id)
                              .then(thread => onSelecionarThread(thread))
                              .catch(() => toast.error('Erro ao carregar thread'));
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {item.posicao_fila || index + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-900 text-sm truncate">
                                  {item.metadata?.cliente_nome || 'Cliente'}
                                </h4>
                                <Badge className={getPrioridadeColor(item.prioridade)}>
                                  {item.prioridade}
                                </Badge>
                              </div>

                              <p className="text-xs text-slate-600 truncate mb-1">
                                {item.metadata?.cliente_telefone || ''}
                              </p>

                              <p className="text-xs text-slate-500 line-clamp-2">
                                {item.metadata?.ultima_mensagem_preview || ''}
                              </p>

                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <Phone className="w-3 h-3" />
                                  {item.nome_conexao}
                                </div>
                                
                                <div className={`flex items-center gap-1 text-xs font-semibold ${getTempoEsperaColor(item.tempo_espera_segundos)}`}>
                                  <Clock className="w-3 h-3" />
                                  {item.tempo_espera_formatado}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removerDaFila(item.thread_id);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filas.length === 0 && (
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">
                ✅ Nenhuma conversa na fila
              </h3>
              <p className="text-sm text-slate-500">
                Todas as conversas foram atribuídas ou não há novas conversas pendentes
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* 8. MÉTRICAS ADICIONAIS */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Conversas Abertas</span>
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-700">{conversasAbertas}</p>
            <p className="text-xs text-slate-500 mt-1">
              {conversasNaoAtribuidas} sem atendente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Mensagens 24h</span>
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-700">{mensagens.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              {mensagensContato.length} recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Integrações Ativas</span>
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700">{integracoesConectadas}</p>
            <p className="text-xs text-slate-500 mt-1">
              de {integracoesTotal} configuradas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Geral OK */}
      {statusGeral === 'excelente' && (
        <Alert className="bg-green-50 border-green-300">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-900 font-bold">✨ Sistema Operando Perfeitamente</AlertTitle>
          <AlertDescription className="text-green-800">
            Todas as métricas estão excelentes. Continue monitorando para manter a performance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}