import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, User, MessageSquare, Building2, Phone, CheckCircle, X } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export default function ContatosParados() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: queueItems = [], isLoading } = useQuery({
    queryKey: ['workQueue'],
    queryFn: async () => {
      const items = await base44.entities.WorkQueueItem.filter({
        status: { $in: ['open', 'in_progress'] }
      }, '-created_date', 100);
      return items;
    },
    refetchInterval: 30000
  });

  const { data: contactsMap = {}, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', queueItems],
    queryFn: async () => {
      const contactIds = [...new Set(queueItems.map(item => item.contact_id))];
      if (contactIds.length === 0) return {};
      
      const contacts = await Promise.all(
        contactIds.map(id => base44.entities.Contact.get(id).catch(() => null))
      );
      
      return contacts.reduce((acc, contact) => {
        if (contact) acc[contact.id] = contact;
        return acc;
      }, {});
    },
    enabled: queueItems.length > 0
  });

  const { data: threadsMap = {} } = useQuery({
    queryKey: ['threads', queueItems],
    queryFn: async () => {
      const threadIds = [...new Set(queueItems.map(item => item.thread_id).filter(Boolean))];
      if (threadIds.length === 0) return {};
      
      const threads = await Promise.all(
        threadIds.map(id => base44.entities.MessageThread.get(id).catch(() => null))
      );
      
      return threads.reduce((acc, thread) => {
        if (thread) acc[thread.id] = thread;
        return acc;
      }, {});
    },
    enabled: queueItems.length > 0
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ itemId, reason }) => {
      return base44.entities.WorkQueueItem.update(itemId, {
        status: 'dismissed',
        dismissed_reason: reason,
        notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workQueue']);
      setSelectedItem(null);
      setNotes('');
      toast.success('Item dispensado');
    }
  });

  const completeMutation = useMutation({
    mutationFn: async ({ itemId }) => {
      return base44.entities.WorkQueueItem.update(itemId, {
        status: 'done',
        notes: notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['workQueue']);
      setSelectedItem(null);
      setNotes('');
      toast.success('Item concluído');
    }
  });

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[severity] || colors.medium;
  };

  const getReasonLabel = (reason) => {
    const labels = {
      idle_48h: '⏰ Parado 48h',
      idle_72h: '⏰ Parado 72h',
      idle_7d: '⚠️ Parado 7 dias',
      idle_14d: '🚨 Parado 14 dias',
      manual: '👤 Manual'
    };
    return labels[reason] || reason;
  };

  if (isLoading || loadingContacts) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando contatos parados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600" />
            Contatos Parados
          </h1>
          <p className="text-slate-600 mt-2">
            Contatos sem atividade há mais de 48 horas que precisam de atenção
          </p>
        </div>

        {queueItems.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Tudo em dia!
              </h3>
              <p className="text-slate-600">
                Não há contatos parados no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {queueItems.map(item => {
              const contact = contactsMap[item.contact_id];
              const thread = item.thread_id ? threadsMap[item.thread_id] : null;
              
              if (!contact) return null;

              return (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5 text-slate-600" />
                          {contact.nome}
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={getSeverityColor(item.severity)}>
                            {item.severity}
                          </Badge>
                          <Badge variant="outline">
                            {getReasonLabel(item.reason)}
                          </Badge>
                          {item.owner_sector_id && (
                            <Badge className="bg-blue-100 text-blue-800">
                              {item.owner_sector_id}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => completeMutation.mutate({ itemId: item.id })}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedItem(item.id === selectedItem ? null : item.id)}
                        >
                          {item.id === selectedItem ? <X className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-4 w-4" />
                        {contact.telefone}
                      </div>
                      {contact.empresa && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="h-4 w-4" />
                          {contact.empresa}
                        </div>
                      )}
                      {thread && thread.last_message_at && (
                        <div className="flex items-center gap-2 text-slate-600 col-span-2">
                          <MessageSquare className="h-4 w-4" />
                          Última mensagem: {formatDistanceToNow(new Date(thread.last_message_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </div>
                      )}
                    </div>

                    {item.id === selectedItem && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <Textarea
                          placeholder="Notas sobre este contato..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => dismissMutation.mutate({ 
                              itemId: item.id, 
                              reason: 'não_é_oportunidade' 
                            })}
                            className="flex-1"
                          >
                            Dispensar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => completeMutation.mutate({ itemId: item.id })}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            Marcar como Resolvido
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}