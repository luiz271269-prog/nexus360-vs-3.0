import React, { useState } from "react";
import { projetarFaturamentoMensal } from "./metasNfUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

const fmt = (v) => `R$ ${(v || 0).toLocaleString('pt-BR')}`;

export default function PrevisaoFaturamento({ notasTodas }) {
  const [expandido, setExpandido] = useState(false);
  const p = projetarFaturamentoMensal(notasTodas, 3);

  if (!p.projecoes.length) return null;

  const listaPendentes = expandido ? p.clientesPendentes : p.clientesPendentes.slice(0, 6);

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Previsão de Faturamento do Mês
        </CardTitle>
        <p className="text-xs text-slate-400">
          Projeção automática pelo histórico de compras recorrentes de cada cliente (últimos 3 meses de NFs consolidadas)
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Resumo da projeção */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Faturamento projetado</p>
            <p className="text-lg font-bold text-emerald-400">{fmt(p.projecaoTotal)}</p>
          </div>
          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Realizado no mês</p>
            <p className="text-lg font-bold text-white">{fmt(p.realizadoMes)}</p>
          </div>
          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Atingido da projeção</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={Math.min(100, p.percentualAtingido)} className="h-2 flex-grow" />
              <span className="text-sm font-bold text-amber-400">{p.percentualAtingido}%</span>
            </div>
          </div>
          <div className="bg-slate-800/70 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400">Clientes recorrentes</p>
            <p className="text-lg font-bold text-blue-400">{p.clientesRecorrentes}</p>
          </div>
        </div>

        {/* Clientes recorrentes que ainda não compraram este mês */}
        {p.clientesPendentes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                Recorrentes ainda sem compra no mês ({p.clientesPendentes.length}) — receita esperada
              </h4>
              {p.clientesPendentes.length > 6 && (
                <button
                  onClick={() => setExpandido(!expandido)}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  {expandido ? <>Ver menos <ChevronUp className="w-3 h-3" /></> : <>Ver todos <ChevronDown className="w-3 h-3" /></>}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {listaPendentes.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{c.nome}</p>
                    <p className="text-xs text-slate-400 truncate">{c.vendedor || '—'} · freq. {c.frequencia}%</p>
                  </div>
                  <Badge className="bg-amber-900/60 text-amber-300 border border-amber-700 shrink-0 ml-2">{fmt(c.valorEsperado)}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        {p.clientesPendentes.length === 0 && (
          <p className="text-sm text-emerald-400 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Todos os clientes recorrentes já compraram este mês.
          </p>
        )}
      </CardContent>
    </Card>
  );
}