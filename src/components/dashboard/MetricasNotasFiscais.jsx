import { useState, useEffect } from "react";
import { buscarNotasFiscaisExternas } from "@/functions/buscarNotasFiscaisExternas";
import { DollarSign, CheckCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MetricasNotasFiscais() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarNotas();
  }, []);

  const carregarNotas = async () => {
    setLoading(true);
    setErro(null);
    const resp = await buscarNotasFiscaisExternas({});
    if (resp.data?.success) {
      setNotas(resp.data.notas || []);
    } else {
      setErro(resp.data?.error || "Erro ao carregar");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700 animate-pulse">
        <div className="h-5 bg-slate-700 rounded w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-slate-700 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm">
        ⚠️ Notas Fiscais: {erro}
      </div>
    );
  }

  const totalFaturado = notas.reduce((s, n) => s + (n.valor_total || 0), 0);
  const totalRecebido = notas.reduce((s, n) => s + (n.valor_recebido || 0), 0);
  const totalAberto = notas.reduce((s, n) => s + (n.valor_aberto || 0), 0);
  const vencidas = notas.filter(n => n.status === 'vencido');
  const aVencer = notas.filter(n => n.status === 'a_vencer');
  const pagas = notas.filter(n => n.status === 'pago');

  const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

  const cards = [
    { titulo: "Total Faturado", valor: fmt(totalFaturado), icon: FileText, cor: "from-blue-500 to-indigo-600", sub: `${notas.length} notas` },
    { titulo: "Recebido", valor: fmt(totalRecebido), icon: CheckCircle, cor: "from-emerald-500 to-teal-600", sub: `${pagas.length} pagas` },
    { titulo: "Em Aberto", valor: fmt(totalAberto), icon: Clock, cor: "from-amber-500 to-orange-600", sub: `${aVencer.length} a vencer` },
    { titulo: "Vencidas", valor: fmt(vencidas.reduce((s, n) => s + (n.valor_aberto || 0), 0)), icon: AlertTriangle, cor: "from-red-500 to-pink-600", sub: `${vencidas.length} NFs` },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Notas Fiscais — Neural Fin Flow
        </h2>
        <Badge className="bg-emerald-800 text-emerald-200 text-xs">Ao vivo</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.cor} rounded-xl p-4 text-white`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs opacity-80">{c.titulo}</span>
              <c.icon className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-xl font-bold">{c.valor}</p>
            <p className="text-xs opacity-70 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Últimas notas */}
      <div className="mt-4">
        <p className="text-xs text-slate-400 mb-2">Últimas emissões</p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {notas.slice(0, 8).map((n) => (
            <div key={n.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-xs font-mono">#{n.numero}</span>
                <span className="text-slate-200 truncate">{n.cliente}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-slate-300 font-semibold">{fmt(n.valor_total)}</span>
                <Badge className={`text-xs ${
                  n.status === 'pago' ? 'bg-emerald-800 text-emerald-200' :
                  n.status === 'vencido' ? 'bg-red-800 text-red-200' :
                  'bg-amber-800 text-amber-200'
                }`}>
                  {n.status === 'pago' ? 'Pago' : n.status === 'vencido' ? 'Vencido' : 'A Vencer'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}