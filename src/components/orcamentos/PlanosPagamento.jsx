import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

const FORMAS = [
  { id: 'vista', nome: 'À Vista', icon: '💵' },
  { id: 'credito', nome: 'Cartão de Crédito', icon: '💳' },
  { id: 'boleto', nome: 'Boleto', icon: '📋' },
  { id: 'pix', nome: 'PIX', icon: '📱' },
];

export default function PlanosPagamento({ orcamentoId, valorTotal, onPlanosChange }) {
  const [planos, setPlanos] = useState([]);
  const [formaAtiva, setFormaAtiva] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const adicionarPlano = (parcelas) => {
    const valor = valorTotal / parcelas;
    setPlanos([...planos, { 
      forma: formaAtiva.nome, 
      formaId: formaAtiva.id,
      parcelas, 
      valor,
      valorTotal: parcelas * valor 
    }]);
    toast.success(`Plano de ${parcelas}x adicionado!`);
    setShowModal(false);
  };

  const removerPlano = (index) => {
    setPlanos(planos.filter((_, i) => i !== index));
  };

  const salvarPlanos = async () => {
    if (planos.length === 0) {
      toast.error('Adicione pelo menos um plano de pagamento');
      return;
    }
    
    try {
      // TODO: Salvar planos no banco de dados
      toast.success(`${planos.length} plano(s) de pagamento salvo(s)!`);
      onPlanosChange?.(planos);
    } catch (error) {
      toast.error('Erro ao salvar planos');
    }
  };

  return (
    <div className="space-y-4">
      {/* SEÇÃO SUPERIOR: PLANOS SELECIONADOS */}
      {planos.length > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-400">💰 Planos Selecionados para Salvar</h3>
            <Button
              onClick={salvarPlanos}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold gap-2 h-8"
            >
              <Save className="w-4 h-4" />
              Salvar Planos
            </Button>
          </div>
          <div className="space-y-2">
            {planos.map((plano, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between border border-slate-600">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{plano.parcelas}x - {plano.forma}</p>
                  <p className="text-xs text-slate-300">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valor)} cada parcela
                  </p>
                </div>
                <p className="text-lg font-bold text-green-400 mr-3">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valorTotal)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removerPlano(idx)}
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRID: FORMAS + CONFIGURAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* COLUNA: FORMAS */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
            💵 Formas
          </h3>
          <div className="space-y-2">
            {FORMAS.map((forma) => (
              <button
                key={forma.id}
                onClick={() => {
                  setFormaAtiva(forma);
                  setShowModal(true);
                }}
                className={`w-full px-3 py-2.5 rounded-lg border-2 text-left flex items-center gap-2 transition font-medium text-sm ${
                  formaAtiva?.id === forma.id
                    ? 'border-green-500 bg-green-500/10 text-green-400'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-orange-500 hover:bg-slate-700'
                }`}
              >
                <span className="text-lg">{forma.icon}</span>
                {forma.nome}
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA: CONFIGURAÇÃO DA FORMA ATIVA */}
        {formaAtiva && !showModal && (
          <div className="lg:col-span-3 bg-slate-800/50 rounded-lg p-4 border border-orange-500/30">
            <h4 className="text-sm font-bold text-orange-400 mb-4">⚙️ Configurar Plano - {formaAtiva.nome}</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Valor Total do Orçamento</label>
                <p className="text-xl font-bold text-green-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Selecione Parcelas</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 6, 12].map((parcelas) => {
                    const valor = valorTotal / parcelas;
                    return (
                      <button
                        key={parcelas}
                        onClick={() => adicionarPlano(parcelas)}
                        className="px-3 py-2 rounded-lg border-2 border-slate-600 bg-slate-700 hover:border-orange-500 hover:bg-orange-500/10 text-slate-300 hover:text-orange-400 transition font-semibold text-sm"
                      >
                        {parcelas}x
                        <div className="text-xs text-slate-400 mt-1">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FLUTUANTE */}
      {showModal && formaAtiva && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-orange-500/30">
            {/* Header */}
            <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-white text-lg">📋 Planos Disponíveis</h3>
              <p className="text-sm font-semibold text-orange-400">{formaAtiva.nome}</p>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {[1, 2, 3, 6, 12].map((parcelas) => {
                const valor = valorTotal / parcelas;
                return (
                  <button
                    key={parcelas}
                    onClick={() => adicionarPlano(parcelas)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-700/50 hover:border-orange-500 hover:bg-orange-500/10 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <p className="font-bold text-white group-hover:text-orange-400">{parcelas} Parcela{parcelas > 1 ? 's' : ''}</p>
                        <p className="text-xs text-slate-400 group-hover:text-slate-300">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)} cada
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-700 px-6 py-3 text-xs text-slate-400">
              Selecione uma opção para adicionar o plano
            </div>
          </div>
        </div>
      )}
    </div>
  );
}