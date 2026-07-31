import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const OPCOES = [
{ valor: 'lead', label: 'Lead', cor: 'bg-blue-600 hover:bg-blue-700' },
{ valor: 'cliente', label: 'Cliente', cor: 'bg-emerald-600 hover:bg-emerald-700' },
{ valor: 'eventual', label: 'Eventual', cor: 'bg-amber-600 hover:bg-amber-700' },
{ valor: 'ex_cliente', label: 'Ex-cliente', cor: 'bg-slate-600 hover:bg-slate-700' },
{ valor: 'fornecedor', label: 'Fornecedor', cor: 'bg-purple-600 hover:bg-purple-700' },
{ valor: 'parceiro', label: 'Parceiro', cor: 'bg-teal-600 hover:bg-teal-700' }];


export default function BarraClassificacaoObrigatoria({ nomeContato, onClassificar }) {
  const [salvando, setSalvando] = useState(null);

  const handleClick = async (valor) => {
    setSalvando(valor);
    try {
      await onClassificar(valor);
      toast.success(`✅ Contato classificado como ${valor.replace('_', '-')}`);
    } catch (error) {
      toast.error('Erro ao classificar: ' + error.message);
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="mx-2 md:mx-3 mb-2 mt-2 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center gap-3 px-3">
        <div className="flex items-center gap-2.5 md:max-w-[280px] flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-bold text-amber-700">Classificação obrigatória</p>
            <p className="text-xs text-amber-900/80 truncate">
              Defina o tipo de <strong>{nomeContato || 'contato'}</strong> para responder.
            </p>
          </div>
        </div>

        <div className="hidden md:block w-px self-stretch bg-amber-200" />

        <div className="flex flex-wrap gap-1.5 flex-1">
          {OPCOES.map((o) =>
          <button
            key={o.valor}
            type="button"
            disabled={!!salvando}
            onClick={() => handleClick(o.valor)}
            className={`px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5 ${o.cor}`}>
            
              {salvando === o.valor && <Loader2 className="w-3 h-3 animate-spin" />}
              {o.label}
            </button>
          )}
        </div>
      </div>
    </div>);

}