import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Clock,
  User,
  Play,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CallHistoryPanel({ contactId }) {
  const { data: callSessions = [], isLoading } = useQuery({
    queryKey: ['call-sessions', contactId],
    queryFn: () => base44.entities.CallSession.filter({ contact_id: contactId }, '-started_at', 50),
    enabled: !!contactId,
    refetchInterval: 30000
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'answered':
        return <Badge className="bg-green-100 text-green-700">Atendida</Badge>;
      case 'missed':
        return <Badge className="bg-red-100 text-red-700">Perdida</Badge>;
      case 'ended':
        return <Badge className="bg-blue-100 text-blue-700">Finalizada</Badge>;
      case 'ringing':
        return <Badge className="bg-yellow-100 text-yellow-700">Tocando</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">{status}</Badge>;
    }
  };

  const getDirectionIcon = (direction, status) => {
    if (direction === 'inbound') {
      return status === 'missed' ? 
        <PhoneMissed className="w-4 h-4 text-red-500" /> : 
        <PhoneIncoming className="w-4 h-4 text-green-500" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  if (isLoading) {
    return <div className="p-4 text-center text-slate-500">Carregando histórico...</div>;
  }

  if (callSessions.length === 0) {
    return (
      <div className="p-6 text-center">
        <Phone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Nenhuma chamada registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
        <Phone className="w-4 h-4 text-yellow-600" />
        Histórico de Chamadas ({callSessions.length})
      </h3>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {callSessions.map((call) => (
          <Card key={call.id} className="border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {getDirectionIcon(call.direction, call.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-800">
                        {call.direction === 'inbound' ? call.from_number : call.to_number}
                      </span>
                      {getStatusBadge(call.status)}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(call.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      
                      {call.duration_seconds > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                      )}
                    </div>

                    {call.assigned_user_id && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-600">
                        <User className="w-3 h-3" />
                        Atendente: {call.assigned_user_id}
                      </div>
                    )}

                    {call.observacoes && (
                      <p className="text-xs text-slate-600 mt-2 italic">
                        "{call.observacoes}"
                      </p>
                    )}
                  </div>
                </div>

                {call.recording_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(call.recording_url, '_blank')}
                    className="border-green-300 text-green-700 flex-shrink-0"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Gravação
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}