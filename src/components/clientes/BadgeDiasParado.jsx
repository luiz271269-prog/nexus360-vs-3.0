import React from 'react';
import { diasParado } from './LegendaTotalizadoresClientes';

// Fonte única da régua de SLA por tier — espelha watchdogCarteiraOuro (backend)
export const SLA_DIAS_TIER = { ouro: 10, prata: 14, risco: 21 };

export function getSlaInfo(dias, etiqueta) {
  if (dias === null || dias === undefined) return null;
  const slaDias = SLA_DIAS_TIER[etiqueta] || null;
  const violado = slaDias ? dias >= slaDias : false;
  let className;
  if (violado) className = 'bg-red-600 text-white';
  else if (dias > 60) className = 'bg-red-500 text-white';
  else if (dias >= 21) className = 'bg-amber-400 text-amber-900';
  else className = 'bg-emerald-500 text-white';
  return { slaDias, violado, className };
}

export default function BadgeDiasParado({ cliente, dias: diasProp, etiqueta: etiquetaProp }) {
  const dias = diasProp ?? (cliente ? diasParado(cliente) : null);
  const etiqueta = etiquetaProp ?? cliente?.etiqueta_recorrencia;
  const info = getSlaInfo(dias, etiqueta);
  if (!info) return null;
  return (
    <span
      title={info.violado
        ? `SLA ${etiqueta?.toUpperCase()} violado — limite ${info.slaDias} dias sem contato`
        : 'Dias desde o último contato real'}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${info.className}`}
    >
      {dias}d parado{info.violado ? ` · SLA ${info.slaDias}d` : ''}
    </span>
  );
}