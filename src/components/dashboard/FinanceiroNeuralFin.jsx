import React, { useState, useEffect } from 'react';
import { getResumoFinanceiroNeuralFin } from '@/functions/getResumoFinanceiroNeuralFin';
import { FileText, Loader2 } from 'lucide-react';

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Bloco = ({ titulo, icon: Icon, headerClass, children }) => (
  <div className="rounded-xl overflow-hidden shadow-lg border border-slate-700/50 bg-slate-900">
    <div className={`flex items-center gap-2 px-4 py-2.5 ${headerClass}`}>
      <Icon className="w-4 h-4 text-white" />
      <h3 className="text-white font-bold text-sm tracking-wide uppercase">{titulo}</h3>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 p-4">{children}</div>
  </div>
);

const Item = ({ label, valor, sub, cor = 'text-white' }) => (
  <div>
    <p className="text-slate-400 text-[11px] font-semibold uppercase">{label}</p>
    <p className={`text-lg md:text-xl font-bold ${cor}`}>{valor}</p>
    {sub && <p className="text-slate-500 text-[11px]">{sub}</p>}
  </div>
);

export default function FinanceiroNeuralFin({ mesSel, anoSel, modoAnual }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const mes = modoAnual ? 'all' : `${anoSel}-${String(mesSel).padStart(2, '0')}`;

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro(null);
    getResumoFinanceiroNeuralFin({ mes })
      .then(resp => { if (ativo && resp.data?.success) setDados(resp.data); })
      .catch(e => { if (ativo) setErro(e.message); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [mes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 bg-slate-900 rounded-xl p-6 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando Nexus Finanças 360...
      </div>
    );
  }
  if (erro || !dados) {
    return <div className="bg-slate-900 rounded-xl p-4 text-red-400 text-sm">Nexus Finanças 360 indisponível{erro ? `: ${erro}` : ''}</div>;
  }

  const fat = dados.faturamento;
  const vends = fat.por_vendedor || [];

  return (
    <Bloco titulo="Faturamento" icon={FileText} headerClass="bg-gradient-to-r from-emerald-600 to-teal-600">
      <Item label="Total Faturado" valor={fmt(fat.total_faturado)} sub={`${fat.qtd_nfs} NFs + CIs emitidas`} cor="text-blue-400" />
      <Item label="A Receber" valor={fmt(fat.a_receber)} sub="Saldo em aberto" cor="text-orange-400" />
      {vends.slice(0, 4).map(v => (
        <Item key={v.vendedor} label={v.vendedor} valor={fmt(v.valor)} sub="Vendas" cor="text-purple-400" />
      ))}
    </Bloco>
  );
}