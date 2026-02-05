import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Calendar, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Send,
  Settings,
  User,
  CalendarCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfiguracaoSincronizacao from '../agenda/ConfiguracaoSincronizacao';

export default function AgendaIAUnificada({ open, onClose, usuario }) {
  const [eventos, setEventos] = useState([]);
  const [lembretes, setLembretes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagemChat, setMensagemChat] = useState('');
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [threadAgendaIA, setThreadAgendaIA] = useState(null);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      if (!usuario) return;

      // Buscar eventos do usuário
      const now = new Date().toISOString();
      const eventosData = await base44.entities.ScheduleEvent.filter({
        assigned_user_id: usuario.id,
        start_at: { $gte: now },
        status: { $in: ['scheduled', 'pending_review'] }
      }, 'start_at', 50);

      setEventos(eventosData || []);

      // Buscar lembretes pendentes
      const lembretesData = await base44.entities.ScheduleReminder.filter({
        target_user_id: usuario.id,
        status: 'pending'
      }, 'send_at', 30);

      setLembretes(lembretesData || []);

      // Buscar/criar thread com AGENDA_IA_NEXUS
      await buscarThreadAgendaIA();

    } catch (error) {
      console.error('[AGENDA-IA] Erro ao carregar:', error);
      toast.error('❌ Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  };

  const buscarThreadAgendaIA = async () => {
    try {
      // Buscar contato AGENDA_IA_NEXUS
      const contatos = await base44.entities.Contact.filter({
        telefone: '+5548999999999'
      }, '-created_date', 1);

      if (!contatos || contatos.length === 0) {
        console.log('[AGENDA-IA] ⚠️ Contato não encontrado, criando...');
        await base44.functions.invoke('createAgendaIAContact');
        toast.info('🤖 Criando assistente de agenda...');
        setTimeout(() => buscarThreadAgendaIA(), 2000);
        return;
      }

      const contact = contatos[0];

      // Buscar thread canônica
      const threads = await base44.entities.MessageThread.filter({
        contact_id: contact.id,
        is_canonical: true,
        status: 'aberta'
      }, '-created_date', 1);

      if (threads && threads.length > 0) {
        setThreadAgendaIA(threads[0]);
      } else {
        // Criar thread
        const newThread = await base44.entities.MessageThread.create({
          contact_id: contact.id,
          is_canonical: true,
          status: 'aberta',
          assistant_mode: 'agenda',
          channel: 'whatsapp',
          thread_type: 'contact_external'
        });
        setThreadAgendaIA(newThread);
      }

    } catch (error) {
      console.error('[AGENDA-IA] Erro ao buscar thread:', error);
    }
  };

  useEffect(() => {
    if (open && usuario) {
      carregarDados();
    }
  }, [open, usuario?.id]);

  const handleEnviarMensagemChat = async () => {
    if (!mensagemChat.trim() || !threadAgendaIA) return;

    setEnviandoChat(true);
    try {
      // Invocar processador de agenda
      const result = await base44.functions.invoke('processScheduleIntent', {
        thread_id: threadAgendaIA.id,
        message_id: `chat-${Date.now()}`,
        text: mensagemChat.trim(),
        from_type: 'internal_user',
        from_id: usuario.id
      });

      if (result.data?.message_to_send) {
        toast.success('🤖 ' + result.data.message_to_send);
      }

      setMensagemChat('');
      
      // Recarregar eventos
      setTimeout(() => carregarDados(), 1000);

    } catch (error) {
      console.error('[AGENDA-IA] Erro ao enviar:', error);
      toast.error('❌ Erro ao processar comando');
    } finally {
      setEnviandoChat(false);
    }
  };

  const handleCancelarEvento = async (evento) => {
    if (!confirm(`Cancelar "${evento.title}"?`)) return;

    try {
      await base44.entities.ScheduleEvent.update(evento.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      });

      toast.success('✅ Evento cancelado');
      carregarDados();
    } catch (error) {
      console.error('[AGENDA-IA] Erro:', error);
      toast.error('❌ Erro ao cancelar');
    }
  };

  const handleConcluir = async (evento) => {
    try {
      await base44.entities.ScheduleEvent.update(evento.id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      toast.success('✅ Concluído');
      carregarDados();
    } catch (error) {
      console.error('[AGENDA-IA] Erro:', error);
      toast.error('❌ Erro ao concluir');
    }
  };

  const StatusBadge = ({ status }) => {
    const config = {
      pending_review: { label: 'Revisão', color: 'bg-yellow-100 text-yellow-800' },
      scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-800' },
      cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
      completed: { label: 'Concluído', color: 'bg-green-100 text-green-800' }
    }[status] || { label: status, color: 'bg-gray-100' };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600" />
            🗓️ Agenda Nexus IA
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat">💬 Chat IA</TabsTrigger>
            <TabsTrigger value="eventos">📅 Eventos</TabsTrigger>
            <TabsTrigger value="lembretes">🔔 Lembretes</TabsTrigger>
            <TabsTrigger value="config">⚙️ Config</TabsTrigger>
          </TabsList>

          {/* ABA: CHAT CONVERSACIONAL */}
          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Comando Natural</CardTitle>
                  <Button onClick={carregarDados} variant="ghost" size="sm" disabled={carregando}>
                    <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  "agendar reunião amanhã 14h" • "listar próximos" • "cancelar reunião"
                </p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
                {/* Área de exemplos */}
                <div className="mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-800 mb-2">💡 Exemplos:</p>
                  <div className="space-y-1 text-xs text-emerald-700">
                    <p>• "agendar reunião com cliente amanhã às 15h"</p>
                    <p>• "lembrete ligar fornecedor sexta 10h"</p>
                    <p>• "listar minha agenda"</p>
                    <p>• "cancelar reunião de amanhã"</p>
                  </div>
                </div>

                {/* Input de comando */}
                <div className="flex gap-2">
                  <Input
                    value={mensagemChat}
                    onChange={(e) => setMensagemChat(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviarMensagemChat();
                      }
                    }}
                    placeholder="Digite seu comando (ex: agendar reunião amanhã 14h)"
                    className="flex-1"
                    disabled={enviandoChat || !threadAgendaIA}
                  />
                  <Button
                    onClick={handleEnviarMensagemChat}
                    disabled={!mensagemChat.trim() || enviandoChat || !threadAgendaIA}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {enviandoChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA: EVENTOS */}
          <TabsContent value="eventos" className="flex-1 overflow-auto p-4 space-y-3">
            {carregando ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : eventos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">Nenhum evento agendado</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Use o chat IA para criar compromissos
                  </p>
                </CardContent>
              </Card>
            ) : (
              eventos.map(evento => {
                const startDate = new Date(evento.start_at);
                return (
                  <Card key={evento.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-600" />
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

                      {evento.auto_committed && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          🤖 Auto-agendado (IA)
                        </Badge>
                      )}

                      {evento.status === 'scheduled' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConcluir(evento)}
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
              })
            )}
          </TabsContent>

          {/* ABA: LEMBRETES */}
          <TabsContent value="lembretes" className="flex-1 overflow-auto p-4 space-y-3">
            {carregando ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : lembretes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">Nenhum lembrete pendente</p>
                </CardContent>
              </Card>
            ) : (
              lembretes.map(lembrete => (
                <Card key={lembrete.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {lembrete.offset_minutes} min antes
                        </p>
                        <p className="text-sm text-slate-600">
                          {format(new Date(lembrete.send_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {lembrete.channel === 'internal' ? '📱 Interno' : '💬 WhatsApp'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ABA: CONFIGURAÇÕES */}
          <TabsContent value="config" className="flex-1 overflow-auto p-4">
            <ConfiguracaoSincronizacao usuario={usuario} onUpdate={carregarDados} />
          </TabsContent>
        </Tabs>

        {/* Estatísticas no rodapé */}
        <div className="border-t pt-4 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {eventos.filter(e => e.status === 'scheduled').length}
            </p>
            <p className="text-xs text-slate-600">Agendados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">
              {lembretes.filter(l => l.status === 'pending').length}
            </p>
            <p className="text-xs text-slate-600">Lembretes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">
              {eventos.filter(e => e.status === 'pending_review').length}
            </p>
            <p className="text-xs text-slate-600">Revisão</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}