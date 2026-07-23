import React from 'react';

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

// Componente genérico de legenda/totalizadores (fonte única do markup).
// Recebe as categorias e os totais já calculados pelo wrapper de cada domínio.
export default function LegendaTotalizadores({ categorias = [], totais = {}, categoriaAtiva, onSelecionar }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categorias.map((c) => {
        const t = totais[c.key] || { qtd: 0, valor: 0 };
        const isActive = categoriaAtiva === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelecionar?.(isActive ? null : c.key)}
            title={isActive ? 'Clique para desfazer a priorização' : `Priorizar ${c.label} no topo das colunas`}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${c.bg} ${isActive ? c.active + ' shadow-md' : 'border-slate-200 hover:shadow-sm'}`}
          >
            <span className="text-sm leading-none">{c.emoji}</span>
            <div className="text-left leading-tight">
              <div className={`text-[11px] font-bold ${c.text}`}>{c.label}</div>
              <div className="text-[9px] text-slate-400 hidden sm:block">{c.sub}</div>
            </div>
            <div className="text-right leading-tight ml-1 pl-2 border-l border-slate-200">
              <div className={`text-[12px] font-black ${c.text}`}>{t.qtd}</div>
              <div className="text-[9px] font-semibold text-slate-500">{formatCurrency(t.valor)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}