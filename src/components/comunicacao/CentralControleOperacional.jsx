import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  MessageSquare,
  BarChart3,
  Wifi,
  WifiOff,
  Phone,
  Server,
  Target,
  Sparkles,
  Grid3x3,
  ArrowUpRight
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

  // Agrupar filas por instância
  const filasPorInstancia = {};
  filas.forEach(fila => {
    const integracao = integracoes.find(i => i.id === fila.whatsapp_integration_id);
    const instanciaKey = integracao?.id || 'sem_instancia';
    if (!filasPorInstancia[instanciaKey]) {
      filasPorInstancia[instanciaKey] = {
        integracao: integracao,
        filas: [],
        totalFila: 0,
        urgentes: 0
      };
    }
    filasPorInstancia[instanciaKey].filas.push(fila);
    filasPorInstancia[instanciaKey].totalFila++;
    if (fila.prioridade === 'urgente' || fila.prioridade === 'alta') {
      filasPorInstancia[instanciaKey].urgentes++;
    }
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER DO SISTEMA */}
      {/* ═══════════════════════════════════════════════════════ */}
      
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Central de Controle Operacional</h1>
              <p className="text-sm text-slate-400">Sistema de Gestão WhatsApp Multi-Instância</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${statusGeral === 'excelente' ? 'bg-green-500 animate-pulse' : statusGeral === 'bom' ? 'bg-blue-500' : statusGeral === 'atencao' ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-sm text-slate-300">Score: {scoreGeral}/100</span>
            </div>

            <Button onClick={() => window.location.reload()} size="sm" className="bg-slate-800 hover:bg-slate-700 border border-slate-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BARRA DE STATUS GERAL */}
      {/* ═══════════════════════════════════════════════════════ */}
      
      <div className="px-6 py-3 bg-slate-800/30 border-y border-slate-700/30">
        <div className="grid grid-cols-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              {statusIntegracoes === 'saudavel' ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
            </div>
            <div>
              <p className="text-xs text-slate-500">Conexões</p>
              <p className="text-sm font-bold text-white">{integracoesConectadas}/{integracoesTotal}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Resp. Média</p>
              <p className="text-sm font-bold text-white">{tempoMedioResposta}min</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Atendentes</p>
              <p className="text-sm font-bold text-white">{atendentesOnline}/{atendentesTotal}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Conversas</p>
              <p className="text-sm font-bold text-white">{conversasAbertas}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Target className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Na Fila</p>
              <p className="text-sm font-bold text-white">{estatisticasFilas?.total_na_fila || 0}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Automações</p>
              <p className="text-sm font-bold text-white">{execucoesAtivas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTEÚDO PRINCIPAL */}
      {/* ═══════════════════════════════════════════════════════ */}

      <div className="px-6 py-6">
        {/* ALERTAS CRÍTICOS */}
        {(statusIntegracoes === 'critico' || conversasProximasExpirar > 0 || conversasNaoAtribuidas > 5) && (
          <div className="mb-6 space-y-3">
            {statusIntegracoes === 'critico' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-400">Sistema Desconectado</p>
                  <p className="text-sm text-slate-400">Todas as integrações WhatsApp estão offline. Verifique configurações.</p>
                </div>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">Resolver</Button>
              </div>
            )}

            {conversasProximasExpirar > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
                <Timer className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-400">Janelas Expirando</p>
                  <p className="text-sm text-slate-400">{conversasProximasExpirar} conversas com janela 24h expirando em menos de 2 horas</p>
                </div>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Ver</Button>
              </div>
            )}

            {conversasNaoAtribuidas > 5 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-400">Conversas Sem Atendente</p>
                  <p className="text-sm text-slate-400">{conversasNaoAtribuidas} conversas aguardando atribuição</p>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Atribuir</Button>
              </div>
            )}
          </div>
        )}

        {/* TABS POR INSTÂNCIA WhatsApp */}
        <Tabs defaultValue={integracoes[0]?.id || 'geral'} className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700 p-1">
            {integracoes.map(integracao => (
              <TabsTrigger 
                key={integracao.id} 
                value={integracao.id}
                className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white flex items-center gap-2"
              >
                <div className={`w-2 h-2 rounded-full ${integracao.status === 'conectado' ? 'bg-green-500' : 'bg-red-500'}`} />
                {integracao.nome_instancia}
                {filasPorInstancia[integracao.id]?.totalFila > 0 && (
                  <Badge className="bg-orange-600 text-white ml-1 text-xs h-5">
                    {filasPorInstancia[integracao.id].totalFila}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {integracoes.map(integracao => (
            <TabsContent key={integracao.id} value={integracao.id} className="space-y-4">
              {/* HEADER DA INSTÂNCIA */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                      <Phone className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{integracao.nome_instancia}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${integracao.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                          <span className="text-sm text-slate-400">
                            {integracao.status === 'conectado' ? 'Conectado' : 'Desconectado'}
                          </span>
                        </div>
                        <span className="text-slate-600">•</span>
                        <span className="text-sm text-slate-400">{integracao.numero_telefone}</span>
                        {integracao.estatisticas && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-sm text-slate-400">
                              {integracao.estatisticas.total_mensagens_recebidas || 0} msgs recebidas
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {filasPorInstancia[integracao.id]?.urgentes > 0 && (
                      <Badge className="bg-red-600 text-white">
                        {filasPorInstancia[integracao.id].urgentes} urgentes
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* MÉTRICAS DA INSTÂNCIA */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <MessageSquare className="w-5 h-5 text-blue-400" />
                      <ArrowUpRight className="w-4 h-4 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Conversas Ativas</p>
                    <p className="text-3xl font-bold text-white mt-2">
                      {threads.filter(t => t.whatsapp_integration_id === integracao.id && t.status === 'aberta').length}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {threads.filter(t => t.whatsapp_integration_id === integracao.id && !t.assigned_user_id).length} não atribuídas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Target className="w-5 h-5 text-orange-400" />
                      <ArrowUpRight className="w-4 h-4 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Na Fila</p>
                    <p className="text-3xl font-bold text-white mt-2">
                      {filasPorInstancia[integracao.id]?.totalFila || 0}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {filasPorInstancia[integracao.id]?.urgentes || 0} urgentes
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Timer className="w-5 h-5 text-purple-400" />
                      <ArrowUpRight className="w-4 h-4 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Janela 24h</p>
                    <p className="text-3xl font-bold text-white mt-2">
                      {threads.filter(t => {
                        if (t.whatsapp_integration_id !== integracao.id || !t.janela_24h_expira_em) return false;
                        return new Date(t.janela_24h_expira_em) > agora;
                      }).length}
                    </p>
                    <p className="text-xs text-red-400 mt-1">
                      {threads.filter(t => {
                        if (t.whatsapp_integration_id !== integracao.id || !t.janela_24h_expira_em) return false;
                        const horasRestantes = (new Date(t.janela_24h_expira_em) - agora) / (1000 * 60 * 60);
                        return horasRestantes > 0 && horasRestantes < 2;
                      }).length} expirando
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <BarChart3 className="w-5 h-5 text-green-400" />
                      <ArrowUpRight className="w-4 h-4 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Taxa Resposta</p>
                    <p className="text-3xl font-bold text-white mt-2">
                      {integracao.estatisticas?.taxa_resposta_24h || 0}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      ⌀ {integracao.estatisticas?.tempo_medio_resposta_minutos || 0}min
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* FILAS POR SETOR DESTA INSTÂNCIA */}
              {filasPorInstancia[integracao.id] && filasPorInstancia[integracao.id].totalFila > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Filas por Setor</h4>
                    <SeletorEstrategia 
                      estrategiaAtual={estrategia}
                      onMudarEstrategia={setEstrategia}
                      disabled={loadingFilas || atribuindo}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {setores.map(setor => {
                      const threadsDoSetor = filasPorInstancia[integracao.id].filas.filter(f => f.setor === setor);
                      if (threadsDoSetor.length === 0) return null;

                      return (
                        <Card key={setor} className="bg-slate-800/30 border-slate-700">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-semibold text-white capitalize flex items-center gap-2">
                                <Grid3x3 className="w-4 h-4 text-amber-400" />
                                {setor}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-orange-600 text-white text-xs">{threadsDoSetor.length}</Badge>
                                <Button
                                  size="sm"
                                  onClick={() => atenderProximo(setor)}
                                  disabled={atribuindo === setor}
                                  className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                                >
                                  {atribuindo === setor ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus className="w-3 h-3 mr-1" />
                                      Atender
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="divide-y divide-slate-700/50 max-h-40 overflow-y-auto">
                              {threadsDoSetor.slice(0, 3).map((item, index) => (
                                <div
                                  key={item.id}
                                  className="p-3 hover:bg-slate-700/30 transition-colors cursor-pointer"
                                  onClick={() => {
                                    if (onSelecionarThread && item.thread_id) {
                                      base44.entities.MessageThread.get(item.thread_id)
                                        .then(threadData => onSelecionarThread(threadData))
                                        .catch(() => toast.error('Erro ao carregar'));
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-white truncate">
                                        {item.metadata?.cliente_nome || 'Cliente'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge className={`${getPrioridadeColor(item.prioridade)} text-[10px] h-4 px-1.5`}>
                                          {item.prioridade}
                                        </Badge>
                                        <span className={`text-[10px] font-semibold ${getTempoEsperaColor(item.tempo_espera_segundos)}`}>
                                          {item.tempo_espera_formatado}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {threadsDoSetor.length > 3 && (
                                <div className="p-2 text-center">
                                  <span className="text-xs text-slate-500">+{threadsDoSetor.length - 3} mais...</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* RODAPÉ - AUTOMAÇÕES E PLAYBOOKS */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <Sparkles className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Playbooks Ativos</p>
              <p className="text-3xl font-bold text-white mt-2">{playbooksAtivos}</p>
              <p className="text-xs text-slate-400 mt-1">{execucoesAtivas} em execução</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Taxa Sucesso 24h</p>
              <p className="text-3xl font-bold text-white mt-2">{taxaSucessoPlaybooks}%</p>
              <p className="text-xs text-slate-400 mt-1">{execucoesUltimas24h.length} execuções</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <BarChart3 className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Score Geral</p>
              <p className="text-3xl font-bold text-white mt-2">{scoreGeral}/100</p>
              <p className={`text-xs font-semibold mt-1 ${
                statusGeral === 'excelente' ? 'text-green-400' :
                statusGeral === 'bom' ? 'text-blue-400' :
                statusGeral === 'atencao' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {statusGeral === 'excelente' ? 'Excelente' :
                 statusGeral === 'bom' ? 'Bom' :
                 statusGeral === 'atencao' ? 'Atenção' : 'Crítico'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* REMOVIDO: SEÇÕES ANTIGAS */}
      {/* ═══════════════════════════════════════════════════════ */}


    </div>
  );
}