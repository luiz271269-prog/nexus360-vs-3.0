import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Zap,
  MessageSquare,
  Activity,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  PlayCircle,
  Wifi,
  WifiOff,
  Target,
  BarChart3
} from 'lucide-react';

/**
 * Dashboard Unificado - Centro de Comando da Central de Comunicação
 * Visão consolidada de Playbooks, Respostas Rápidas e Saúde Operacional
 */
export default function DashboardUnificado({ onChangeTab }) {
  
  // ═══════════════════════════════════════════════════════
  // 📊 BUSCAR DADOS (com rate limit controlado)
  // ═══════════════════════════════════════════════════════

  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks-unificado'],
    queryFn: () => base44.entities.FlowTemplate.list('-created_date'),
    refetchInterval: 60000, // 1 minuto
    staleTime: 30000,
    initialData: []
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes-unificado'],
    queryFn: () => base44.entities.FlowExecution.list('-started_at', 200),
    refetchInterval: 30000, // 30 segundos
    staleTime: 20000,
    initialData: []
  });

  const { data: quickReplies = [] } = useQuery({
    queryKey: ['quickreplies-unificado'],
    queryFn: () => base44.entities.QuickReply.list('-created_date'),
    refetchInterval: 60000,
    staleTime: 30000,
    initialData: []
  });

  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes-unificado'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    refetchInterval: 30000,
    staleTime: 20000,
    initialData: []
  });

  const { data: threads = [] } = useQuery({
    queryKey: ['threads-unificado'],
    queryFn: () => base44.entities.MessageThread.list('-last_message_at', 100),
    refetchInterval: 30000,
    staleTime: 20000,
    initialData: []
  });

  // ═══════════════════════════════════════════════════════
  // 📈 MÉTRICAS - PLAYBOOKS
  // ═══════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════
  // 💬 MÉTRICAS - RESPOSTAS RÁPIDAS
  // ═══════════════════════════════════════════════════════

  const quickRepliesAtivas = quickReplies.filter(qr => qr.ativa && qr.status === 'ativa').length;
  const quickRepliesTotal = quickReplies.length;
  
  const usosUltimos7Dias = quickReplies.reduce((total, qr) => {
    return total + (qr.metricas_performance?.total_usos || 0);
  }, 0);

  const quickRepliesMaisUsadas = [...quickReplies]
    .filter(qr => qr.metricas_performance?.total_usos > 0)
    .sort((a, b) => (b.metricas_performance?.total_usos || 0) - (a.metricas_performance?.total_usos || 0))
    .slice(0, 3);

  // ═══════════════════════════════════════════════════════
  // 🏥 MÉTRICAS - SAÚDE OPERACIONAL
  // ═══════════════════════════════════════════════════════

  const integracoesConectadas = integracoes.filter(i => i.status === 'conectado').length;
  const integracoesTotal = integracoes.length;
  const statusGeral = integracoesConectadas === integracoesTotal ? 'saudavel' : 
                      integracoesConectadas > 0 ? 'atencao' : 'critico';

  const agora = new Date();
  const conversasJanelaAtiva = threads.filter(t => {
    if (!t.janela_24h_expira_em) return false;
    return new Date(t.janela_24h_expira_em) > agora;
  }).length;

  const conversasProximasExpirar = threads.filter(t => {
    if (!t.janela_24h_expira_em || t.status !== 'aberta') return false;
    const horasRestantes = (new Date(t.janela_24h_expira_em) - agora) / (1000 * 60 * 60);
    return horasRestantes > 0 && horasRestantes < 2;
  }).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Centro de Comando</h2>
          <p className="text-slate-600 mt-1">Visão unificada de Automações, Respostas e Saúde Operacional</p>
        </div>
        <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
          Tempo Real
        </Badge>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SEÇÃO 1: PLAYBOOKS E AUTOMAÇÕES */}
      {/* ═══════════════════════════════════════════════════════ */}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Playbooks e Automações
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onChangeTab?.('fluxos')}
            className="gap-2"
          >
            Ver Todos <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Playbooks Ativos</p>
                  <p className="text-3xl font-bold text-purple-700">{playbooksAtivos}</p>
                  <p className="text-xs text-slate-500 mt-1">de {playbooks.length} total</p>
                </div>
                <PlayCircle className="w-10 h-10 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Execuções Ativas</p>
                  <p className="text-3xl font-bold text-blue-700">{execucoesAtivas}</p>
                  <p className="text-xs text-slate-500 mt-1">em andamento agora</p>
                </div>
                <Activity className="w-10 h-10 text-blue-600 opacity-50 animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Taxa de Sucesso</p>
                  <p className="text-3xl font-bold text-green-700">{taxaSucessoPlaybooks}%</p>
                  <p className="text-xs text-slate-500 mt-1">últimas 24h</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Execuções 24h</p>
                  <p className="text-3xl font-bold text-amber-700">{execucoesUltimas24h.length}</p>
                  <p className="text-xs text-slate-500 mt-1">{execucoesConcluidas} concluídas</p>
                </div>
                <BarChart3 className="w-10 h-10 text-amber-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {execucoesAtivas > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <Activity className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>{execucoesAtivas} automação(ões)</strong> em execução neste momento. 
              <Button 
                variant="link" 
                className="text-blue-700 p-0 h-auto ml-2"
                onClick={() => onChangeTab?.('dashboard')}
              >
                Ver detalhes →
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SEÇÃO 2: RESPOSTAS RÁPIDAS */}
      {/* ═══════════════════════════════════════════════════════ */}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Respostas Rápidas
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onChangeTab?.('respostas')}
            className="gap-2"
          >
            Gerenciar <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Respostas Ativas</p>
                  <p className="text-3xl font-bold text-indigo-700">{quickRepliesAtivas}</p>
                  <p className="text-xs text-slate-500 mt-1">de {quickRepliesTotal} total</p>
                </div>
                <MessageSquare className="w-10 h-10 text-indigo-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Usos (7 dias)</p>
                  <p className="text-3xl font-bold text-cyan-700">{usosUltimos7Dias}</p>
                  <p className="text-xs text-slate-500 mt-1">total de utilizações</p>
                </div>
                <TrendingUp className="w-10 h-10 text-cyan-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Média por Resposta</p>
                  <p className="text-3xl font-bold text-violet-700">
                    {quickRepliesAtivas > 0 ? Math.round(usosUltimos7Dias / quickRepliesAtivas) : 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">usos por resposta</p>
                </div>
                <Target className="w-10 h-10 text-violet-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {quickRepliesMaisUsadas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">🏆 Top 3 Mais Utilizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quickRepliesMaisUsadas.map((qr, index) => (
                  <div key={qr.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                        {index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{qr.titulo}</p>
                        <p className="text-xs text-slate-500">{qr.comando}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-700">{qr.metricas_performance?.total_usos || 0}</p>
                      <p className="text-xs text-slate-500">usos</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SEÇÃO 3: SAÚDE OPERACIONAL */}
      {/* ═══════════════════════════════════════════════════════ */}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            Saúde Operacional do WhatsApp
          </h3>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onChangeTab?.('saude')}
            className="gap-2"
          >
            Ver Detalhes <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`${
            statusGeral === 'saudavel' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' :
            statusGeral === 'atencao' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' :
            'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Status Geral</p>
                  <p className={`text-2xl font-bold ${
                    statusGeral === 'saudavel' ? 'text-green-700' :
                    statusGeral === 'atencao' ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {statusGeral === 'saudavel' ? '✅ Saudável' :
                     statusGeral === 'atencao' ? '⚠️ Atenção' :
                     '❌ Crítico'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {integracoesConectadas}/{integracoesTotal} conectadas
                  </p>
                </div>
                {statusGeral === 'saudavel' ? (
                  <Wifi className="w-10 h-10 text-green-600 opacity-50" />
                ) : (
                  <WifiOff className="w-10 h-10 text-red-600 opacity-50" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Janela 24h Ativa</p>
                  <p className="text-3xl font-bold text-blue-700">{conversasJanelaAtiva}</p>
                  <p className="text-xs text-slate-500 mt-1">conversas abertas</p>
                </div>
                <Clock className="w-10 h-10 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className={`${
            conversasProximasExpirar > 0 
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
              : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Expirando em 2h</p>
                  <p className={`text-3xl font-bold ${
                    conversasProximasExpirar > 0 ? 'text-amber-700' : 'text-slate-700'
                  }`}>
                    {conversasProximasExpirar}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">ação necessária</p>
                </div>
                <AlertTriangle className={`w-10 h-10 opacity-50 ${
                  conversasProximasExpirar > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'
                }`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Críticos */}
        {statusGeral === 'critico' && (
          <Alert className="bg-red-50 border-red-300">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>⚠️ Atenção:</strong> Todas as integrações WhatsApp estão desconectadas. 
              <Button 
                variant="link" 
                className="text-red-700 p-0 h-auto ml-2"
                onClick={() => onChangeTab?.('configuracoes')}
              >
                Verificar configurações →
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {conversasProximasExpirar > 0 && (
          <Alert className="bg-amber-50 border-amber-300">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{conversasProximasExpirar} conversa(s)</strong> com janela de 24h expirando em menos de 2 horas. 
              <Button 
                variant="link" 
                className="text-amber-700 p-0 h-auto ml-2"
                onClick={() => onChangeTab?.('conversas')}
              >
                Ver conversas →
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Rodapé Informativo */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700 mb-2">📊 Sobre este Dashboard</p>
              <div className="text-xs text-slate-600 space-y-1">
                <p><strong>Atualização:</strong> Dados atualizados automaticamente a cada 30-60 segundos</p>
                <p><strong>Playbooks:</strong> Dados de FlowTemplate e FlowExecution</p>
                <p><strong>Respostas Rápidas:</strong> Dados de QuickReply com métricas de uso</p>
                <p><strong>Saúde Operacional:</strong> Status em tempo real das integrações WhatsApp</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}