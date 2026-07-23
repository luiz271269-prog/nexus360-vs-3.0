import React, { useMemo } from 'react';
import LegendaTotalizadores from './LegendaTotalizadores';

// Dias desde o último contato (ou criação, se nunca houve contato)
export function diasParado(cliente) {
  const ref = cliente.ultimo_contato_real || cliente.ultimo_contato || cliente.created_date;
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

// SLA de contato violado (persistido diariamente pelo watchdogCarteiraOuro)
export function isSlaViolado(cliente) {
  return cliente?.sla_contato_status === 'violado';
}

// Matcher único para categorias da legenda (inclui a categoria especial 'sla')
export function matchCategoria(cliente, key) {
  if (key === 'sla') return isSlaViolado(cliente);
  return classificarCliente(cliente) === key;
}

const CATEGORIAS = [
  { key: 'sla', emoji: '⏰', label: 'SLA violado', sub: 'fora do SLA do tier', bg: 'bg-red-100', text: 'text-red-800', active: 'ring-2 ring-offset-1 ring-red-600' },
  { key: 'criticos', emoji: '⚫', label: 'Críticos', sub: 'recorrente · parado +60d', bg: 'bg-slate-900', text: 'text-slate-200', active: 'ring-2 ring-offset-1 ring-slate-900' },
  { key: 'vermelhos', emoji: '🔴', label: 'Vermelhos', sub: 'parado +60 dias', bg: 'bg-red-50', text: 'text-red-700', active: 'ring-2 ring-offset-1 ring-red-500' },
  { key: 'amarelos', emoji: '🟡', label: 'Amarelos', sub: 'parado 21–60 dias', bg: 'bg-amber-50', text: 'text-amber-700', active: 'ring-2 ring-offset-1 ring-amber-500' },
  { key: 'ativos', emoji: '🟢', label: 'Ativos', sub: 'contato ≤ 20 dias', bg: 'bg-emerald-50', text: 'text-emerald-700', active: 'ring-2 ring-offset-1 ring-emerald-500' },
];

export default function LegendaTotalizadoresClientes({ clientes = [], categoriaAtiva, onSelecionar }) {
  const totais = useMemo(() => {
    const acc = {
      sla: { qtd: 0, valor: 0 },
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
      if (isSlaViolado(c)) {
        acc.sla.qtd += 1;
        acc.sla.valor += c.valor_recorrente_mensal || 0;
      }
    }
    return acc;
  }, [clientes]);

  return (
    <LegendaTotalizadores
      categorias={CATEGORIAS}
      totais={totais}
      categoriaAtiva={categoriaAtiva}
      onSelecionar={onSelecionar}
    />
  );
}