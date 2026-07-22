import React from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, MessageSquare, MessageCircle, Phone, MapPin, Mic } from 'lucide-react';

/**
 * Timeline 360° do Cliente — unifica em ordem cronológica:
 * - Orçamentos (criação + status atual)
 * - Mensagens de WhatsApp (threads vinculadas ao cliente via cliente_id)
 * - Interações internas (notas, ligações, visitas)
 */

const STATUS_ORC_COR = {
  aprovado: 'text-emerald-400',
  rejeitado: 'text-red-400',
  vencido: 'text-red-400',
  negociando: 'text-blue-400',
  enviado: 'text-blue-400',
};

const fmtValor = (v) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const fmtData = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export default function TimelineCliente360({ cliente }) {
  const [eventos, setEventos] = React.useState(null);

  React.useEffect(() => {
    if (!cliente?.id) return;
    let cancelado = false;
    (async () => {
      const [interacoes, orcamentos, threadsDiretas, contatos] = await Promise.all([
        base44.entities.Interacao.filter({ cliente_id: cliente.id }, '-data_interacao', 50).catch(() => []),
        base44.entities.Orcamento.filter({ cliente_id: cliente.id }, '-data_orcamento', 50).catch(() => []),
        base44.entities.MessageThread.filter({ cliente_id: cliente.id }, '-last_message_at', 5).catch(() => []),
        base44.entities.Contact.filter({ cliente_id: cliente.id }, '-updated_date', 5).catch(() => []),
      ]);

      // Fallback: threads via contatos vinculados ao cliente (maioria dos vínculos hoje é Contact → Cliente)
      let threads = threadsDiretas || [];
      const idsJa = new Set(threads.map(t => t.id));
      for (const ct of (contatos || [])) {
        const ts = await base44.entities.MessageThread.filter({ contact_id: ct.id }, '-last_message_at', 3).catch(() => []);
        for (const t of (ts || [])) {
          if (!idsJa.has(t.id)) { threads.push(t); idsJa.add(t.id); }
        }
      }

      let mensagens = [];
      for (const t of (threads || [])) {
        const msgs = await base44.entities.Message.filter({ thread_id: t.id }, '-created_date', 15).catch(() => []);
        mensagens = mensagens.concat(msgs || []);
      }

      const evts = [];

      for (const o of (orcamentos || [])) {
        evts.push({
          tipo: 'orcamento',
          data: o.data_orcamento ? `${o.data_orcamento}T12:00:00` : o.created_date,
          titulo: `Orçamento ${o.numero_orcamento || ''} — ${fmtValor(o.valor_total)}`,
          detalhe: o.status,
          statusCor: STATUS_ORC_COR[o.status] || 'text-slate-400',
          autor: o.vendedor || '',
        });
      }

      for (const m of (mensagens || [])) {
        evts.push({
          tipo: 'whatsapp',
          data: m.sent_at || m.created_date,
          titulo: m.sender_type === 'contact' ? 'Cliente escreveu' : 'Atendente respondeu',
          detalhe: (m.content || '').slice(0, 140) || `[${m.media_type || 'mídia'}]`,
          autor: m.metadata?.sender_name || '',
          inbound: m.sender_type === 'contact',
        });
      }

      for (const i of (interacoes || [])) {
        const isAudio = (i.observacoes || '').startsWith('[ÁUDIO]');
        evts.push({
          tipo: isAudio ? 'audio' : (i.tipo_interacao === 'ligacao' ? 'ligacao' : i.tipo_interacao === 'visita' ? 'visita' : 'nota'),
          data: i.data_interacao || i.created_date,
          titulo: isAudio ? 'Áudio interno' : i.tipo_interacao === 'ligacao' ? 'Ligação' : i.tipo_interacao === 'visita' ? 'Visita' : 'Nota interna',
          detalhe: (i.observacoes || '').replace(/^\[ÁUDIO\]\s*/, '').replace(/https?:\/\/\S+/, '').slice(0, 140),
          autor: i.vendedor || '',
        });
      }

      evts.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
      if (!cancelado) setEventos(evts);
    })();
    return () => { cancelado = true; };
  }, [cliente?.id]);

  if (eventos === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-slate-300 font-semibold text-sm">Nenhum evento encontrado</p>
        <p className="text-xs text-slate-500 mt-1">Este cliente ainda não tem orçamentos, conversas ou notas vinculadas.</p>
      </div>
    );
  }

  const ICONES = {
    orcamento: { Icon: FileText, cor: 'bg-orange-500' },
    whatsapp: { Icon: MessageCircle, cor: 'bg-green-600' },
    nota: { Icon: MessageSquare, cor: 'bg-amber-500' },
    ligacao: { Icon: Phone, cor: 'bg-blue-500' },
    visita: { Icon: MapPin, cor: 'bg-emerald-500' },
    audio: { Icon: Mic, cor: 'bg-rose-500' },
  };

  return (
    <div className="relative pl-4">
      <div className="absolute left-[22px] top-2 bottom-2 w-px bg-slate-700" />
      <div className="space-y-3">
        {eventos.map((e, idx) => {
          const { Icon, cor } = ICONES[e.tipo] || ICONES.nota;
          return (
            <div key={idx} className="flex items-start gap-2.5 relative">
              <div className={`${cor} w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-slate-900`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">{e.titulo}</span>
                  <span className="text-[10px] text-slate-500 flex-shrink-0">{fmtData(e.data)}</span>
                </div>
                {e.detalhe && (
                  <p className={`text-[11px] mt-0.5 break-words leading-relaxed ${e.statusCor || 'text-slate-300'}`}>
                    {e.detalhe}
                  </p>
                )}
                {e.autor && <p className="text-[10px] text-slate-500 mt-0.5">{e.autor}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}