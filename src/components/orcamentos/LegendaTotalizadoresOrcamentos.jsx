import React, { useMemo } from 'react';

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

// Classifica um orçamento em uma categoria com base nos dias parados (data_orcamento)
// e no valor. Retorna: 'criticos' | 'vermelhos' | 'amarelos' | 'ativos' | null
export function classificarOrcamento(orcamento) {
  const ref = orcamento.data_orcamento || orcamento.created_date;
  if (!ref) return null;
  const dias = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
  const valor = orcamento.valor_total || 0;

  if (dias > 60 && valor >= 10000) return 'criticos';
  if (dias > 60) return 'vermelhos';
  if (dias >= 21) return 'amarelos';
  if (dias <= 20) return 'ativos';
  return null;
}

const CATEGORIAS = [
  { key: 'criticos', emoji: '⚫', label: 'Críticos', sub: 'R$10k+ · parado +60d', ring: 'ring-slate-800', bg: 'bg-slate-900', text: 'text-slate-200', active: 'ring-2 ring-offset-1 ring-slate-900' },
  { key: 'vermelhos', emoji: '🔴', label: 'Vermelhos', sub: 'parado +60 dias', ring: 'ring-red-500', bg: 'bg-red-50', text: 'text-red-700', active: 'ring-2 ring-offset-1 ring-red-500' },
  { key: 'amarelos', emoji: '🟡', label: 'Amarelos', sub: 'parado 21–60 dias', ring: 'ring-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', active: 'ring-2 ring-offset-1 ring-amber-500' },
  { key: 'ativos', emoji: '🟢', label: 'Ativos', sub: 'últimos 20 dias', ring: 'ring-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', active: 'ring-2 ring-offset-1 ring-emerald-500' },
];

export default function LegendaTotalizadoresOrcamentos({ orcamentos = [], categoriaAtiva, onSelecionar }) {
  const totais = useMemo(() => {
    const acc = {
      criticos: { qtd: 0, valor: 0 },
      vermelhos: { qtd: 0, valor: 0 },
      amarelos: { qtd: 0, valor: 0 },
      ativos: { qtd: 0, valor: 0 },
    };
    for (const o of orcamentos) {
      const cat = classificarOrcamento(o);
      if (cat && acc[cat]) {
        acc[cat].qtd += 1;
        acc[cat].valor += o.valor_total || 0;
      }
    }
    return acc;
  }, [orcamentos]);

  return (
    <div className="flex flex-wrap gap-2 mb-2">
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