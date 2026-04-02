import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const FORMAS = [
  { id: 'vista', nome: 'À Vista', icon: '💵' },
  { id: 'credito', nome: 'Crédito', icon: '💳' },
  { id: 'boleto', nome: 'Boleto', icon: '📋' },
  { id: 'pix', nome: 'PIX', icon: '📱' },
];

export default function PlanosPagamento({ orcamentoId, valorTotal, onPlanosChange }) {
  const [planos, setPlanos] = useState([]);
  const [formaAtiva, setFormaAtiva] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const adicionarPlano = (parcelas) => {
    const valor = valorTotal / parcelas;
    setPlanos([...planos, { forma: formaAtiva.nome, parcelas, valor }]);
    setShowModal(false);
  };

  const removerPlano = (index) => {
    setPlanos(planos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* COLUNA 1: FORMAS */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Formas de Pagamento</h3>
          <div className="space-y-2">
            {FORMAS.map((forma) => (
              <button
                key={forma.id}
                onClick={() => {
                  setFormaAtiva(forma);
                  setShowModal(true);
                }}
                className={`w-full px-3 py-2.5 rounded-lg border-2 text-left flex items-center gap-2 transition ${
                  formaAtiva?.id === forma.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400'
                }`}
              >
                <span className="text-lg">{forma.icon}</span>
                <span className="text-sm">{forma.nome}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA 2: PLANOS ESCOLHIDOS */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Planos Selecionados</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{planos.length} plano(s)</span>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2 min-h-[200px]">
            {planos.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-8">Selecione uma forma de pagamento para adicionar planos</p>
            ) : (
              planos.map((plano, idx) => (
                <div key={idx} className="bg-slate-50 rounded p-3 flex items-center justify-between border border-slate-200">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{plano.forma}</p>
                    <p className="text-xs text-slate-600">
                      {plano.parcelas}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valor)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removerPlano(idx)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL FLUTUANTE */}
      {showModal && formaAtiva && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Planos - {formaAtiva.nome}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="h-7 w-7 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {[1, 2, 3, 6, 12].map((parcelas) => {
                const valor = valorTotal / parcelas;
                return (
                  <button
                    key={parcelas}
                    onClick={() => adicionarPlano(parcelas)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-left transition"
                  >
                    <p className="font-semibold text-slate-900">{parcelas}x</p>
                    <p className="text-sm text-slate-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}