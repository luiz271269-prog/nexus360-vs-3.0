import React, { useMemo } from 'react';

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

// Dias desde o último contato (ou criação, se nunca houve contato)
export function diasParado(cliente) {
  const ref = cliente.ultimo_contato || cliente.created_date;
  if (!ref) return null;
  return Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
}

// Classifica um cliente por dias parados + valor recorrente
// Retorna: 'criticos' | 'vermelhos' | 'amarelos' | 'ativos' | null
export function classificarCliente(cliente) {
  const dias = diasParado(cliente);
  if (dias === null) return null;
  const valor = cliente.valor_recorrente_mensal || 0;

  if (dias > 60 && valor >= 1000) return 'criticos';
  if (dias > 60) return 'vermelhos';
  if (dias >= 21) return 'amarelos';
  if (dias <= 20) return 'ativos';
  return null;
}

const CATEGORIAS = [
  { key: 'criticos', emoji: '⚫', label: 'Críticos', sub: 'recorrente · parado +60d', bg: 'bg-slate-900', text: 'text-slate-200', active: 'ring-2 ring-offset-1 ring-slate-900' },
  { key: 'vermelhos', emoji: '🔴', label: 'Vermelhos', sub: 'parado +60 dias', bg: 'bg-red-50', text: 'text-red-700', active: 'ring-2 ring-offset-1 ring-red-500' },
  { key: 'amarelos', emoji: '🟡', label: 'Amarelos', sub: 'parado 21–60 dias', bg: 'bg-amber-50', text: 'text-amber-700', active: 'ring-2 ring-offset-1 ring-amber-500' },
  { key: 'ativos', emoji: '🟢', label: 'Ativos', sub: 'contato ≤ 20 dias', bg: 'bg-emerald-50', text: 'text-emerald-700', active: 'ring-2 ring-offset-1 ring-emerald-500' },
];

export default function LegendaTotalizadoresClientes({ clientes = [], categoriaAtiva, onSelecionar }) {
  const totais = useMemo(() => {
    const acc = {
      criticos: { qtd: 0, valor: 0 },
      vermelhos: { qtd: 0, valor: 0 },
      amarelos: { qtd: 0, valor: 0 },
      ativos: { qtd: 0, valor: 0 },
    };
    for (const c of clientes) {
      const cat = classificarCliente(c);
      if (cat && acc[cat]) {
        acc[cat].qtd += 1;
        acc[cat].valor += c.valor_recorrente_mensal || 0;
      }
    }
    return acc;
  }, [clientes]);

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS.map((c) => {
        const t = totais[c.key];
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