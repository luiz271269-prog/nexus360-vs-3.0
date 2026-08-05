import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { rotuloQuando, nivelUrgencia } from './agendaModel';
import AgendaCategoriaBadge from './AgendaCategoriaBadge';
import AgendaOrigemBadge from './AgendaOrigemBadge';

const chaveDoDia = usuarioId => `nexus:agenda-revisao:${usuarioId}:${new Date().toISOString().slice(0, 10)}`;

export function revisaoJaFeitaHoje(usuarioId) {
  if (!usuarioId) return true;
  try { return localStorage.getItem(chaveDoDia(usuarioId)) === '1'; } catch { return true; }
}

export function marcarRevisaoFeita(usuarioId) {
  try { localStorage.setItem(chaveDoDia(usuarioId), '1'); } catch { /* ignora */ }
}

/**
 * Painel obrigatório de revisão diária: lista todos os itens da agenda
 * (qualquer tipo) vencidos ou que vencem hoje e exige prorrogar ou concluir.
 */
export default function RevisaoDiariaObrigatoria({ itens, usuario, ocupadoId, onConcluir, onAdiar, onFechar }) {
  const [resolvidos, setResolvidos] = useState([]);

  const pendentes = useMemo(
    () => itens.filter(i => nivelUrgencia(i) && !resolvidos.includes(`${i.tipo}-${i.id}`)),
    [itens, resolvidos]
  );

  const resolver = (item, acao) => {
    setResolvidos(prev => [...prev, `${item.tipo}-${item.id}`]);
    acao();
  };

  useEffect(() => {
    if (pendentes.length === 0) {
      marcarRevisaoFeita(usuario?.id);
      onFechar();
    }
  }, [pendentes.length]);

  if (pendentes.length === 0) return null;

  const item = pendentes[0];
  const ocupado = ocupadoId === item.id;

  return (
    <div className="fixed right-3 top-3 z-[70] w-[300px] overflow-hidden rounded-xl border border-rose-400/40 bg-agenda-backdrop/95 shadow-2xl shadow-rose-950/40 backdrop-blur-xl md:right-5 md:top-5">
      <div className="flex items-center justify-between gap-2 border-b border-rose-400/30 bg-rose-500/15 px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5" />Revisão do dia
        </span>
        <span className="text-[11px] font-semibold text-agenda-muted">{pendentes.length} restante{pendentes.length > 1 ? 's' : ''}</span>
      </div>

      <div className="px-3 py-2">
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-agenda-text">{item.titulo}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <AgendaCategoriaBadge item={item} />
          <AgendaOrigemBadge item={item} />
          <span className="text-[10px] font-semibold text-rose-300">{rotuloQuando(item)}</span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin text-agenda-muted" /> : <>
            <Button size="sm" className="h-7 flex-1 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-500" onClick={() => resolver(item, () => onConcluir(item))}>
              <Check className="mr-1 h-3.5 w-3.5" />Concluir
            </Button>
            {[[1, '1d'], [3, '3d'], [7, '7d']].map(([dias, rotulo]) => (
              <Button key={dias} size="sm" variant="ghost" className="h-7 border border-agenda-border bg-agenda-panel/40 px-2 text-[11px] text-agenda-text hover:bg-agenda-panel"
                onClick={() => resolver(item, () => onAdiar(item, dias))}>
                {rotulo}
              </Button>
            ))}
          </>}
        </div>
      </div>
    </div>
  );
}