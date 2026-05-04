import React from 'react';
import { Zap, Megaphone, Repeat } from 'lucide-react';
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

// Configuração visual por tipo de log interno
const TYPE_CONFIG = {
  promotion_dispatch_log: {
    icon: Zap,
    label: 'Promoção',
    bg: 'bg-orange-50/60 hover:bg-orange-100',
    border: 'border-orange-200/60 hover:border-orange-300',
    text: 'text-orange-700',
    hint: 'text-orange-500/80',
    iconColor: 'text-orange-500',
    headerGradient: 'from-orange-500 to-amber-500',
    accentBg: 'bg-orange-50',
    accentBorder: 'border-orange-200',
    accentText: 'text-orange-700',
    accentLabel: 'text-orange-600'
  },
  broadcast_dispatch_log: {
    icon: Megaphone,
    label: 'Campanha em massa',
    bg: 'bg-blue-50/60 hover:bg-blue-100',
    border: 'border-blue-200/60 hover:border-blue-300',
    text: 'text-blue-700',
    hint: 'text-blue-500/80',
    iconColor: 'text-blue-500',
    headerGradient: 'from-blue-500 to-cyan-500',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    accentText: 'text-blue-700',
    accentLabel: 'text-blue-600'
  },
  sequence_dispatch_log: {
    icon: Repeat,
    label: 'Sequência automática',
    bg: 'bg-violet-50/60 hover:bg-violet-100',
    border: 'border-violet-200/60 hover:border-violet-300',
    text: 'text-violet-700',
    hint: 'text-violet-500/80',
    iconColor: 'text-violet-500',
    headerGradient: 'from-violet-500 to-purple-500',
    accentBg: 'bg-violet-50',
    accentBorder: 'border-violet-200',
    accentText: 'text-violet-700',
    accentLabel: 'text-violet-600'
  }
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
 * Bolha unificada de "log interno" no chat para promoções, campanhas em massa
 * e sequências automáticas.
 * - Linha única no centro do chat
 * - NÃO é enviada ao cliente (visibility: 'internal_only')
 * - Ao clicar, abre modal com o conteúdo completo
 */
export default function InternalDispatchLogBubble({ message }) {
  const [showDetail, setShowDetail] = React.useState(false);

  const messageType = message?.metadata?.message_type || 'promotion_dispatch_log';
  const config = TYPE_CONFIG[messageType] || TYPE_CONFIG.promotion_dispatch_log;
  const Icon = config.icon;

  // Os 3 tipos compartilham o mesmo formato de payload em metadata.dispatch_data
  // (com fallback retro-compatível para promotion_data)
  const data = message?.metadata?.dispatch_data || message?.metadata?.promotion_data || {};
  const subLabel = data.trigger ? (TRIGGER_LABELS[data.trigger] || data.trigger) : config.label;

  return (
    <>
      <div className="w-full flex justify-center my-1 px-4">
        <button
          onClick={() => setShowDetail(true)}
          className={`group flex items-center gap-2 ${config.bg} border ${config.border} px-3 py-1 rounded-full transition-all max-w-full`}
          title={`Clique para ver detalhes — ${config.label}`}
        >
          <Icon className={`w-3 h-3 ${config.iconColor} flex-shrink-0 group-hover:scale-110 transition-transform`} />
          <span className={`text-[11px] ${config.text} font-medium truncate`}>
            {data.titulo || `${config.label} enviada`}
          </span>
          <span className={`text-[9px] ${config.hint} flex-shrink-0`}>
            • {subLabel}
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
          <div className={`bg-gradient-to-br ${config.headerGradient} p-4 text-white`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-5 h-5" />
              <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                {subLabel}
              </Badge>
            </div>
            <h3 className="font-bold text-lg leading-tight">
              {data.titulo || config.label}
            </h3>
            <p className="text-[11px] text-white/80 mt-1">
              Enviada em {formatarHorario(message.sent_at || message.created_date)}
            </p>
          </div>

          {data.imagem && (
            <div className="w-full max-h-64 bg-slate-100 overflow-hidden">
              <img
                src={data.imagem}
                alt={data.titulo}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-4 space-y-3">
            {data.descricao && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {messageType === 'broadcast_dispatch_log' ? 'Mensagem' : 'Descrição'}
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {data.descricao}
                </p>
              </div>
            )}

            {data.valor && (
              <div className={`${config.accentBg} border ${config.accentBorder} rounded-lg p-3`}>
                <p className={`text-[10px] font-semibold ${config.accentLabel} uppercase tracking-wider mb-1`}>
                  Valor / Condição
                </p>
                <p className={`text-base font-bold ${config.accentText}`}>{data.valor}</p>
              </div>
            )}

            {data.validade && (
              <div className="text-xs text-slate-600">
                ⏰ Válido até:{' '}
                <span className="font-semibold">
                  {new Date(data.validade).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}

            {data.link && (
              <a
                href={data.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline truncate"
              >
                🔗 {data.link}
              </a>
            )}

            {/* Metadados específicos de cada tipo */}
            {messageType === 'broadcast_dispatch_log' && data.total_destinatarios && (
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded p-2">
                👥 Disparada para <strong>{data.total_destinatarios}</strong> contato(s)
                {data.tier_aplicado && <> • Tier: <code className="bg-white px-1 rounded">{data.tier_aplicado}</code></>}
              </div>
            )}

            {messageType === 'sequence_dispatch_log' && (data.numero_passo !== undefined) && (
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded p-2">
                🔄 Passo <strong>{data.numero_passo + 1}</strong>
                {data.total_passos && <> de <strong>{data.total_passos}</strong></>}
                {data.tipo_gatilho && <> • Gatilho: <code className="bg-white px-1 rounded">{data.tipo_gatilho}</code></>}
              </div>
            )}

            {data.campaign_id && (
              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                Campanha:{' '}
                <code className="bg-slate-100 px-1 rounded">{data.campaign_id}</code>
              </div>
            )}

            {data.broadcast_id && (
              <div className="text-[10px] text-slate-400 pt-1">
                Broadcast:{' '}
                <code className="bg-slate-100 px-1 rounded">{data.broadcast_id}</code>
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