import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Gem, Crown, TrendingUp, TrendingDown } from "lucide-react";

const CONFIG = {
  diamante: {
    label: 'Diamante',
    icon: Gem,
    classe: 'bg-sky-100 text-sky-800 border-sky-300',
    titulo: 'Faturamento médio mensal acima de R$ 20 mil'
  },
  alto: {
    label: 'Alto',
    icon: Crown,
    classe: 'bg-violet-100 text-violet-800 border-violet-300',
    titulo: 'Faturamento médio mensal entre R$ 5 mil e R$ 20 mil'
  },
  medio: {
    label: 'Médio',
    icon: TrendingUp,
    classe: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    titulo: 'Faturamento médio mensal entre R$ 1 mil e R$ 5 mil'
  },
  baixo: {
    label: 'Baixo',
    icon: TrendingDown,
    classe: 'bg-slate-100 text-slate-600 border-slate-300',
    titulo: 'Faturamento médio mensal abaixo de R$ 1 mil'
  }
};

export default function EtiquetaFaixaFaturamento({ faixa }) {
  const cfg = CONFIG[faixa];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge title={cfg.titulo} className={`${cfg.classe} border gap-1 hover:opacity-90 text-[11px] px-1.5 py-0`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}