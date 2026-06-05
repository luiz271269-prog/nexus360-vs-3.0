import React from 'react';
import { Server, Mail } from 'lucide-react';

/**
 * Barra de seleção de caixas (domínios) no topo da Caixa de Aprovação.
 * Permite o usuário focar em uma caixa específica ou ver todas.
 */
export default function SeletorCaixasEmail({ caixas, ativa, onSelecionar }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        onClick={() => onSelecionar('todas')}
        className={`flex-shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium transition-colors ${
          ativa === 'todas'
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <Mail className="w-4 h-4" />
        Todas
        <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
          ativa === 'todas' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {caixas.reduce((acc, c) => acc + c.total, 0)}
        </span>
      </button>

      {caixas.map((c) => (
        <button
          key={c.dominio}
          onClick={() => onSelecionar(c.dominio)}
          className={`flex-shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl border text-sm font-medium transition-colors ${
            ativa === c.dominio
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          @{c.dominio}
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
            ativa === c.dominio ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {c.total}
          </span>
        </button>
      ))}
    </div>
  );
}