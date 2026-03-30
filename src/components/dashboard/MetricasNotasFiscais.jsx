import { useState, useEffect, useMemo } from "react";
import { dedupById } from "../../utils/dedup";
import { buscarNotasFiscaisExternas } from "@/functions/buscarNotasFiscaisExternas";
import { CheckCircle, Clock, AlertTriangle, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function MetricasNotasFiscais() {
  const hoje = new Date();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [mesSel, setMesSel] = useState(hoje.getMonth()); // 0-indexed
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());

  const carregarNotas = async () => {
    setLoading(true);
    setErro(null);
    const resp = await buscarNotasFiscaisExternas({});
    if (resp.data?.success) {
      setNotas(dedupById(resp.data.notas || []));
    } else {
      setErro(resp.data?.error || "Erro ao carregar");
    }
    setLoading(false);
  };

  // Filtrar notas pelo mês/ano selecionado
  const notasMes = useMemo(() => {
    return notas.filter(n => {
      const d = n.data_emissao || n.created_date || '';
      if (!d) return false;
      const dt = new Date(d);
      return dt.getMonth() === mesSel && dt.getFullYear() === anoSel;
    });
  }, [notas, mesSel, anoSel]);

  // Resumo mensal agrupado para comparação
  const resumoMensal = useMemo(() => {
    const mapa = {};
    notas.forEach(n => {
      const d = n.data_emissao || n.created_date || '';
      if (!d) return;
      const dt = new Date(d);
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      if (!mapa[key]) mapa[key] = { total: 0, recebido: 0, aberto: 0, qtd: 0, mes: dt.getMonth(), ano: dt.getFullYear() };
      mapa[key].total += n.valor_total || 0;
      mapa[key].recebido += n.valor_recebido || 0;
      mapa[key].aberto += n.valor_aberto || 0;
      mapa[key].qtd++;
    });
    return Object.entries(mapa).sort((a,b) => b[0].localeCompare(a[0])).map(([k,v]) => ({key: k, ...v}));
  }, [notas]);

  const irMes = (delta) => {
    let m = mesSel + delta;
    let a = anoSel;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesSel(m);
    setAnoSel(a);
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

  const totalFaturado = notasMes.reduce((s, n) => s + (n.valor_total || 0), 0);
  const totalRecebido = notasMes.reduce((s, n) => s + (n.valor_recebido || 0), 0);
  const totalAberto = notasMes.reduce((s, n) => s + (n.valor_aberto || 0), 0);
  const vencidas = notasMes.filter(n => n.status === 'vencido');
  const aVencer = notasMes.filter(n => n.status === 'a_vencer');
  const pagas = notasMes.filter(n => n.status === 'pago');

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-base font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" />
          Notas Fiscais — Neural Fin Flow
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => irMes(-1)} className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white font-semibold text-sm min-w-[90px] text-center">{MESES[mesSel]} {anoSel}</span>
          <button onClick={() => irMes(1)} disabled={mesSel === hoje.getMonth() && anoSel === hoje.getFullYear()} className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
          <Badge className="bg-emerald-800 text-emerald-200 text-xs">{notasMes.length} NFs</Badge>
        </div>
      </div>

      {/* Resumo mensal compacto */}
      {resumoMensal.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {resumoMensal.map(r => (
            <button
              key={r.key}
              onClick={() => { setMesSel(r.mes); setAnoSel(r.ano); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                r.mes === mesSel && r.ano === anoSel
                  ? 'bg-orange-500 border-orange-400 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div>{MESES[r.mes]}/{String(r.ano).slice(2)}</div>
              <div className="text-emerald-400 font-bold">R$ {(r.recebido/1000).toFixed(0)}k</div>
            </button>
          ))}
        </div>
      )}

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

      {/* Últimas notas do mês */}
      <div className="mt-4">
        <p className="text-xs text-slate-400 mb-2">Emissões de {MESES[mesSel]}/{anoSel}</p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {notasMes.slice(0, 10).map((n) => (
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