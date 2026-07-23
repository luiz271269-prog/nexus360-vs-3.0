import React from 'react';
import { Button } from "@/components/ui/button";
import { Trophy, Medal, AlertTriangle, Users } from "lucide-react";

const OPCOES = [
  { value: 'todos', label: 'Todos', icon: Users, ativo: 'bg-slate-800 text-white hover:bg-slate-700', inativo: 'text-slate-600' },
  { value: 'ouro', label: 'Ouro', icon: Trophy, ativo: 'bg-amber-500 text-white hover:bg-amber-600', inativo: 'text-amber-700' },
  { value: 'prata', label: 'Prata', icon: Medal, ativo: 'bg-slate-500 text-white hover:bg-slate-600', inativo: 'text-slate-600' },
  { value: 'risco', label: 'Em Risco', icon: AlertTriangle, ativo: 'bg-red-500 text-white hover:bg-red-600', inativo: 'text-red-700' }
];

export default function FiltroRecorrencia({ valor, onChange, clientes, faturamentoPorCliente }) {
  const contagem = { todos: (clientes || []).length, ouro: 0, prata: 0, risco: 0 };
  (clientes || []).forEach(c => {
    const etiqueta = faturamentoPorCliente?.[c.id]?.etiqueta || c.etiqueta_recorrencia;
    if (contagem[etiqueta] !== undefined) contagem[etiqueta]++;
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPCOES.map(({ value, label, icon: Icon, ativo, inativo }) => (
        <Button
          key={value}
          size="sm"
          variant={valor === value ? 'default' : 'outline'}
          onClick={() => onChange(value)}
          className={`h-8 gap-1.5 ${valor === value ? ativo : inativo}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
          <span className={`text-[11px] font-bold px-1.5 rounded-full ${valor === value ? 'bg-white/25' : 'bg-slate-100'}`}>
            {contagem[value]}
          </span>
        </Button>
      ))}
    </div>
  );
}