import React, { useMemo } from 'react';
import LegendaTotalizadores from '@/components/clientes/LegendaTotalizadores';

// Classifica um orçamento por dias SEM MOVIMENTO (idade desde data_orcamento) e valor.
// OBS: métrica distinta de "dias parado" (SLA de contato) da aba Clientes.
// Retorna: 'criticos' | 'vermelhos' | 'amarelos' | 'ativos' | null
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
  { key: 'criticos', emoji: '⚫', label: 'Críticos', sub: 'R$10k+ · sem movimento +60d', bg: 'bg-slate-900', text: 'text-slate-200', active: 'ring-2 ring-offset-1 ring-slate-900' },
  { key: 'vermelhos', emoji: '🔴', label: 'Vermelhos', sub: 'sem movimento +60 dias', bg: 'bg-red-50', text: 'text-red-700', active: 'ring-2 ring-offset-1 ring-red-500' },
  { key: 'amarelos', emoji: '🟡', label: 'Amarelos', sub: 'sem movimento 21–60 dias', bg: 'bg-amber-50', text: 'text-amber-700', active: 'ring-2 ring-offset-1 ring-amber-500' },
  { key: 'ativos', emoji: '🟢', label: 'Ativos', sub: 'últimos 20 dias', bg: 'bg-emerald-50', text: 'text-emerald-700', active: 'ring-2 ring-offset-1 ring-emerald-500' },
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
    <LegendaTotalizadores
      categorias={CATEGORIAS}
      totais={totais}
      categoriaAtiva={categoriaAtiva}
      onSelecionar={onSelecionar}
    />
  );
}