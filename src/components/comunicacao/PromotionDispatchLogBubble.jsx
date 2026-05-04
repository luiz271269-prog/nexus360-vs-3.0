import React from 'react';
import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TRIGGER_LABELS = {
  inbound_6h: '⚡ Inbound 6h',
  batch_36h: '📦 Lote 36h',
  fila_agendada: '⏰ Agendada',
  massa_manual: '📢 Massa',
  manual_individual: '👤 Manual',
  api_externa: '🔌 API'
};

function formatarHorario(timestamp) {
  if (!timestamp) return '';
  try {
    const data = new Date(timestamp);
    const hoje = new Date();
    if (data.toDateString() === hoje.toDateString()) {
      return format(data, 'HH:mm', { locale: ptBR });
    }
    return format(data, 'dd/MM HH:mm', { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Bolha de "log interno" que aparece no chat quando uma promoção é enviada.
 * - É uma linha ÚNICA no centro do chat
 * - NÃO é enviada ao cliente (visibility: 'internal_only')
 * - Ao clicar, abre modal com o conteúdo completo da promoção
 */
export default function PromotionDispatchLogBubble({ message }) {
  const [showDetail, setShowDetail] = React.useState(false);
  const promo = message?.metadata?.promotion_data || {};
  const triggerLabel = TRIGGER_LABELS[promo.trigger] || promo.trigger || '—';

  return (
    <>
      <div className="w-full flex justify-center my-1 px-4">
        <button
          onClick={() => setShowDetail(true)}
          className="group flex items-center gap-2 bg-orange-50/60 hover:bg-orange-100 border border-orange-200/60 hover:border-orange-300 px-3 py-1 rounded-full transition-all max-w-full"
          title="Clique para ver detalhes da promoção"
        >
          <Zap className="w-3 h-3 text-orange-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <span className="text-[11px] text-orange-700 font-medium truncate">
            {promo.titulo || 'Promoção enviada'}
          </span>
          <span className="text-[9px] text-orange-500/80 flex-shrink-0">
            • {triggerLabel}
          </span>
          <span className="text-[9px] text-slate-400 flex-shrink-0">
            {formatarHorario(message.sent_at || message.created_date)}
          </span>
          <span className="text-[9px] text-slate-400 italic flex-shrink-0 hidden sm:inline">
            (não enviada ao cliente)
          </span>
        </button>
      </div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5" />
              <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                {triggerLabel}
              </Badge>
            </div>
            <h3 className="font-bold text-lg leading-tight">
              {promo.titulo || 'Promoção'}
            </h3>
            <p className="text-[11px] text-white/80 mt-1">
              Enviada em {formatarHorario(message.sent_at || message.created_date)}
            </p>
          </div>

          {promo.imagem && (
            <div className="w-full max-h-64 bg-slate-100 overflow-hidden">
              <img
                src={promo.imagem}
                alt={promo.titulo}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-4 space-y-3">
            {promo.descricao && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Descrição
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {promo.descricao}
                </p>
              </div>
            )}

            {promo.valor && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1">
                  Valor / Condição
                </p>
                <p className="text-base font-bold text-orange-700">{promo.valor}</p>
              </div>
            )}

            {promo.validade && (
              <div className="text-xs text-slate-600">
                ⏰ Válido até:{' '}
                <span className="font-semibold">
                  {new Date(promo.validade).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}

            {promo.link && (
              <a
                href={promo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline truncate"
              >
                🔗 {promo.link}
              </a>
            )}

            {promo.campaign_id && (
              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                Campanha:{' '}
                <code className="bg-slate-100 px-1 rounded">{promo.campaign_id}</code>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 px-4 py-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setShowDetail(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}