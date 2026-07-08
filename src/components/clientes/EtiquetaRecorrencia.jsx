import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, AlertTriangle } from "lucide-react";

const CONFIG = {
  ouro: {
    label: 'Ouro',
    icon: Trophy,
    classe: 'bg-amber-100 text-amber-800 border-amber-300',
    titulo: 'Comprou em todos os últimos 3 meses'
  },
  prata: {
    label: 'Prata',
    icon: Medal,
    classe: 'bg-slate-200 text-slate-700 border-slate-300',
    titulo: 'Comprou em 1 ou 2 dos últimos 3 meses'
  },
  risco: {
    label: 'Em Risco',
    icon: AlertTriangle,
    classe: 'bg-red-100 text-red-700 border-red-300',
    titulo: 'Já comprou, mas sem compras nos últimos 3 meses'
  }
};

export default function EtiquetaRecorrencia({ etiqueta }) {
  const cfg = CONFIG[etiqueta];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge title={cfg.titulo} className={`${cfg.classe} border gap-1 hover:opacity-90 text-[11px] px-1.5 py-0`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}