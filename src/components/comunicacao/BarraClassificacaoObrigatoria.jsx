import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const OPCOES = [
  { valor: 'lead', label: 'Lead', cor: 'bg-blue-600 hover:bg-blue-700' },
  { valor: 'cliente', label: 'Cliente', cor: 'bg-emerald-600 hover:bg-emerald-700' },
  { valor: 'eventual', label: 'Eventual', cor: 'bg-amber-600 hover:bg-amber-700' },
  { valor: 'ex_cliente', label: 'Ex-cliente', cor: 'bg-slate-600 hover:bg-slate-700' },
  { valor: 'fornecedor', label: 'Fornecedor', cor: 'bg-purple-600 hover:bg-purple-700' },
  { valor: 'parceiro', label: 'Parceiro', cor: 'bg-teal-600 hover:bg-teal-700' }
];

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
    <div className="mx-2 md:mx-3 mb-2 mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-900 font-medium">
          Classificação obrigatória: defina o tipo de <strong>{nomeContato || 'contato'}</strong> para continuar respondendo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPCOES.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={!!salvando}
            onClick={() => handleClick(o.valor)}
            className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5 ${o.cor}`}
          >
            {salvando === o.valor && <Loader2 className="w-3 h-3 animate-spin" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}