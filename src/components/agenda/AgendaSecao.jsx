import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AgendaItemRow from './AgendaItemRow';

const PASSO = 15;

export default function AgendaSecao({ titulo, itens, cor = 'text-slate-700', recolhida = false, ocupadoId, onIniciar, onAguardar, onConcluir, onAdiar, onCancelar }) {
  const [aberta, setAberta] = useState(!recolhida);
  const [limite, setLimite] = useState(PASSO);

  if (!itens.length) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-agenda-border bg-agenda-panel/50 shadow-2xl shadow-slate-950/30 backdrop-blur-2xl">
      <button onClick={() => setAberta(a => !a)} className="flex w-full items-center gap-2 border-b border-agenda-border px-4 py-4 text-left hover:bg-agenda-panel/40">
        {aberta ? <ChevronDown className="h-4 w-4 text-agenda-muted" /> : <ChevronRight className="h-4 w-4 text-agenda-muted" />}
        <h2 className={`flex-1 text-sm font-semibold tracking-wide ${cor}`}>{titulo}</h2>
        <span className="rounded-full border border-agenda-border bg-agenda-panel/60 px-2 py-0.5 text-xs font-semibold text-agenda-muted">{itens.length}</span>
      </button>

      {aberta && (
        <div className="space-y-2 p-3">
          {itens.slice(0, limite).map(item => (
            <AgendaItemRow
              key={`${item.tipo}-${item.id}`}
              item={item}
              ocupado={ocupadoId === item.id}
              onIniciar={onIniciar}
              onAguardar={onAguardar}
              onConcluir={onConcluir}
              onAdiar={onAdiar}
              onCancelar={onCancelar}
            />
          ))}
          {itens.length > limite && (
            <button onClick={() => setLimite(l => l + PASSO)} className="px-2 py-2 text-xs font-semibold text-agenda-muted hover:text-agenda-text">
              Mostrar mais {Math.min(PASSO, itens.length - limite)} de {itens.length - limite}
            </button>
          )}
        </div>
      )}
    </section>
  );
}