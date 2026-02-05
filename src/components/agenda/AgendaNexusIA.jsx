import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, User, MessageSquare, CheckCircle2, XCircle, Loader2, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfiguracaoSincronizacao from './ConfiguracaoSincronizacao';

export default function AgendaNexusIA({ usuario }) {
  const [eventos, setEventos] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('eventos');

  const carregarDados = async () => {
    setCarregando(true);
    try {
      if (!usuario) return;

      // Buscar eventos do usuário
      const now = new Date().toISOString();
      const eventosData = await base44.entities.ScheduleEvent.filter({
        assigned_user_id: usuario.id,
        start_at: { $gte: now }
      }, 'start_at', 50);

      setEventos(eventosData || []);

      // Buscar lembretes pendentes
      const lembretesData = await base44.entities.ScheduleReminder.filter({
        target_user_id: usuario.id,
        status: 'pending'
      }, 'send_at', 30);

      setLembretes(lembretesData || []);

    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
      toast.error('❌ Erro ao carregar dados da agenda');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [usuario?.id]);

  const handleCancelarEvento = async (evento) => {
    if (!confirm(`Cancelar evento "${evento.title}"?`)) return;

    try {
      await base44.entities.ScheduleEvent.update(evento.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      toast.success('✅ Evento cancelado');
      carregarDados();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      toast.error('❌ Erro ao cancelar evento');
    }
  };

  const handleMarcarConcluido = async (evento) => {
    try {
      await base44.entities.ScheduleEvent.update(evento.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      toast.success('✅ Evento marcado como concluído');
      carregarDados();
    } catch (error) {
      console.error('Erro ao concluir:', error);
      toast.error('❌ Erro ao marcar como concluído');
    }
  };

  const handleAbrirChatAgenda = async () => {
    try {
      // Buscar contato AGENDA_IA_NEXUS
      const contatos = await base44.entities.Contact.filter({
        telefone: '+5548999999999'
      }, '-created_date', 1);

      if (!contatos || contatos.length === 0) {
        toast.error('❌ Contato Agenda IA não encontrado. Execute createAgendaIAContact primeiro.');
        return;
      }

      const contact = contatos[0];

      // Buscar thread canônica
      const threads = await base44.entities.MessageThread.filter({
        contact_id: contact.id,
        is_canonical: true
      }, '-created_date', 1);

      if (threads && threads.length > 0) {
        // Redirecionar para Central com thread aberta
        const threadId = threads[0].id;
        window.location.href = `/pages/Comunicacao?thread=${threadId}`;
      } else {
        toast.info('Criando conversa com Agenda IA...');
        // Thread será criada automaticamente quando abrir
        window.location.href = `/pages/Comunicacao`;
      }

    } catch (error) {
      console.error('Erro ao abrir chat:', error);
      toast.error('❌ Erro ao abrir conversa com Agenda IA');
    }
  };

  const StatusBadge = ({ status }) => {
    const config = {
      pending_review: { label: 'Revisão', color: 'bg-yellow-100 text-yellow-800' },
      scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
      completed: { label: 'Concluído', color: 'bg-green-100 text-green-800' }
    }[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const EventCard = ({ evento }) => {
    const startDate = new Date(evento.start_at);
    const isAutoCommitted = evento.auto_committed;

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                {evento.title}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {format(startDate, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <StatusBadge status={evento.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {evento.description && (
            <p className="text-sm text-slate-700">{evento.description}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4" />
            <span>Responsável: Você</span>
          </div>

          {isAutoCommitted && (
            <Badge className="bg-purple-100 text-purple-700 text-xs">
              🤖 Criado automaticamente
            </Badge>
          )}

          {evento.status === 'scheduled' && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMarcarConcluido(evento)}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Concluir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancelarEvento(evento)}
                className="flex-1 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header com botão de chat */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🗓️ Agenda Nexus IA</h2>
          <p className="text-sm text-slate-600 mt-1">
            Gerencie compromissos por comando natural
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={carregarDados} variant="outline" disabled={carregando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={handleAbrirChatAgenda}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Conversar com Agenda IA
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Eventos Agendados</p>
                <p className="text-3xl font-bold text-purple-600">
                  {eventos.filter(e => e.status === 'scheduled').length}
                </p>
              </div>
              <Calendar className="w-10 h-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Lembretes Ativos</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {lembretes.filter(l => l.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-10 h-10 text-indigo-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pendentes Revisão</p>
                <p className="text-3xl font-bold text-amber-600">
                  {eventos.filter(e => e.status === 'pending_review').length}
                </p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-amber-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas de conteúdo */}
      <Tabs defaultValue="eventos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="eventos">📅 Meus Eventos</TabsTrigger>
          <TabsTrigger value="lembretes">🔔 Lembretes</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="space-y-4 mt-6">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : eventos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhum evento agendado</p>
                <p className="text-sm text-slate-500 mt-2">
                  Converse com a Agenda IA para criar compromissos
                </p>
                <Button onClick={handleAbrirChatAgenda} className="mt-4 bg-purple-600 hover:bg-purple-700">
                  Iniciar Conversa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventos.map(evento => (
                <EventCard key={evento.id} evento={evento} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lembretes" className="space-y-4 mt-6">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : lembretes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Nenhum lembrete pendente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {lembretes.map(lembrete => (
                <Card key={lembrete.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {lembrete.offset_minutes} minutos antes
                        </p>
                        <p className="text-sm text-slate-600">
                          Disparo: {format(new Date(lembrete.send_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {lembrete.channel === 'internal' ? '📱 Interno' : '💬 WhatsApp'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <ConfiguracaoSincronizacao usuario={usuario} onUpdate={carregarDados} />
        </TabsContent>
      </Tabs>

        <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/70 text-white px-6 py-5 backdrop-blur-lg rounded-2xl border border-slate-700/50 shadow-2xl">