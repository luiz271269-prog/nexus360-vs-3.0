import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import AgendaItemRow from './AgendaItemRow';

const PASSO = 15;

export default function AgendaSecao({ titulo, itens, cor = 'text-slate-700', recolhida = false, ocupadoId, onConcluir, onAdiar, onCancelar }) {
  const [aberta, setAberta] = useState(!recolhida);
  const [limite, setLimite] = useState(PASSO);

  if (!itens.length) return null;

  return (
    <section className="space-y-2">
      <button onClick={() => setAberta(a => !a)} className="flex items-center gap-2 group">
        {aberta ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <h2 className={`text-sm font-bold uppercase tracking-wide ${cor}`}>{titulo}</h2>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{itens.length}</span>
      </button>

      {aberta && (
        <div className="space-y-2">
          {itens.slice(0, limite).map(item => (
            <AgendaItemRow
              key={`${item.tipo}-${item.id}`}
              item={item}
              ocupado={ocupadoId === item.id}
              onConcluir={onConcluir}
              onAdiar={onAdiar}
              onCancelar={onCancelar}
            />
          ))}
          {itens.length > limite && (
            <button onClick={() => setLimite(l => l + PASSO)} className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-1 py-2">
              Mostrar mais {Math.min(PASSO, itens.length - limite)} de {itens.length - limite}
            </button>
          )}
        </div>
      )}
    </section>
  );
}