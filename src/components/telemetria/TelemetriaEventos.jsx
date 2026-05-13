import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Tag, Brain, Clock } from 'lucide-react';

const EVENT_LABELS = {
  ack_sent: 'ACK enviado',
  ack_skipped_cooldown: 'ACK em cooldown',
  promo_sent: 'Promo enviada',
  promo_skipped_cooldown: 'Promo em cooldown',
  intent_detected_after_ack: 'Intenção detectada'
};

const EVENT_STYLES = {
  ack_sent: 'bg-green-50 text-green-700 border-green-100',
  ack_skipped_cooldown: 'bg-slate-50 text-slate-700 border-slate-100',
  promo_sent: 'bg-amber-50 text-amber-700 border-amber-100',
  promo_skipped_cooldown: 'bg-orange-50 text-orange-700 border-orange-100',
  intent_detected_after_ack: 'bg-blue-50 text-blue-700 border-blue-100'
};

const EVENT_ICONS = {
  ack_sent: MessageCircle,
  ack_skipped_cooldown: Clock,
  promo_sent: Tag,
  promo_skipped_cooldown: Clock,
  intent_detected_after_ack: Brain
};

export default function TelemetriaEventos({ eventos }) {
  const resumo = eventos?.resumo || {};
  const recentes = eventos?.recentes || [];
  const alertas = eventos?.alertas || [];
  const eventTypes = Object.keys(EVENT_LABELS);

  const alertaStyle = {
    critico: 'bg-red-50 border-red-200 text-red-800',
    atencao: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Eventos Operacionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alertas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alertas.map((alerta, index) => (
              <div key={`${alerta.titulo}-${index}`} className={`rounded-xl border p-3 ${alertaStyle[alerta.nivel] || alertaStyle.info}`}>
                <div className="text-sm font-semibold">{alerta.titulo}</div>
                <div className="text-xs mt-1 opacity-80">{alerta.mensagem}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {eventTypes.map((type) => {
            const Icon = EVENT_ICONS[type];
            return (
              <div key={type} className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <Icon className="w-4 h-4" />
                  <span>{EVENT_LABELS[type]}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{resumo[type] || 0}</div>
              </div>
            );
          })}
        </div>

        {recentes.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
            {recentes.map((evento) => (
              <div key={evento.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={EVENT_STYLES[evento.event_type] || 'bg-slate-50 text-slate-700'}>
                      {EVENT_LABELS[evento.event_type] || evento.event_type}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      {new Date(evento.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{evento.mensagem}</p>
                </div>
                <div className="hidden md:block text-[11px] text-slate-400 font-mono whitespace-nowrap">
                  {evento.thread_id?.substring(0, 8) || '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-slate-500 py-6 border border-dashed border-slate-200 rounded-xl">
            Nenhum evento operacional registrado no período.
          </div>
        )}
      </CardContent>
    </Card>
  );
}