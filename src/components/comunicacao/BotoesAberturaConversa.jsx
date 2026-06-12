import React from 'react';
import { Sun, Sunset, Moon, MessageCircle, Hand } from 'lucide-react';

// Saudações de abertura de conversa (preenchem o campo, sem enviar)
const SAUDACOES = [
  { id: 'bom_dia', label: 'Bom dia', texto: 'Bom dia! 😊', icon: Sun, cor: 'from-amber-400 to-orange-500' },
  { id: 'boa_tarde', label: 'Boa tarde', texto: 'Boa tarde! 😊', icon: Sunset, cor: 'from-orange-400 to-rose-500' },
  { id: 'boa_noite', label: 'Boa noite', texto: 'Boa noite! 😊', icon: Moon, cor: 'from-indigo-500 to-violet-600' },
  { id: 'oi', label: 'Oi', texto: 'Oi! Tudo bem? 😊', icon: MessageCircle, cor: 'from-emerald-400 to-teal-500' },
  { id: 'ola', label: 'Olá', texto: 'Olá! Tudo bem? 😊', icon: Hand, cor: 'from-sky-400 to-blue-500' },
];

export default function BotoesAberturaConversa({ onSelecionar, disabled }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 px-0.5">
        Abertura de conversa
      </p>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {SAUDACOES.map(({ id, label, texto, icon: Icon, cor }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onSelecionar(texto)}
            title={`Inserir "${label}"`}
            className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all disabled:opacity-50 disabled:pointer-events-none`}
          >
            <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${cor} flex items-center justify-center`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}