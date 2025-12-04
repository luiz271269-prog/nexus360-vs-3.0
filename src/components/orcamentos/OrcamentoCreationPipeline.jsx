import React from 'react';
import { Check, User, ShoppingCart, CreditCard, FileCheck } from 'lucide-react';

const etapas = [
{ id: 'dados', label: 'Dados do Cliente', icon: User, color: 'from-blue-500 to-cyan-500' },
{ id: 'itens', label: 'Itens', icon: ShoppingCart, color: 'from-purple-500 to-pink-500' },
{ id: 'pagamento', label: 'Planos de Pagamento', icon: CreditCard, color: 'from-green-500 to-emerald-500' },
{ id: 'revisao', label: 'Revisão Final', icon: FileCheck, color: 'from-amber-500 to-orange-500' }];


export default function OrcamentoCreationPipeline({ etapaAtual, onEtapaClick, etapasCompletadas = [] }) {

  const getEtapaIndex = (etapaId) => etapas.findIndex((e) => e.id === etapaId);
  const etapaAtualIndex = getEtapaIndex(etapaAtual);

  return (
    <div className="bg-gradient-to-r py-3 from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50">
      <div className="max-w-5xl mx-auto">
        {/* Linha de Progresso */}
        <div className="relative">
          {/* Linha de fundo */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700"></div>
          
          {/* Linha de progresso preenchida */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-500"
            style={{ width: `${etapaAtualIndex / (etapas.length - 1) * 100}%` }}>
          </div>
          
          {/* Etapas */}
          <div className="relative flex justify-between">
            {etapas.map((etapa, index) => {
              const Icon = etapa.icon;
              const isAtual = etapa.id === etapaAtual;
              const isConcluida = etapasCompletadas.includes(etapa.id) || index < etapaAtualIndex;
              const isAcessivel = index <= etapaAtualIndex || isConcluida;

              return (
                <button
                  key={etapa.id}
                  onClick={() => isAcessivel && onEtapaClick(etapa.id)}
                  disabled={!isAcessivel}
                  className={`flex flex-col items-center gap-2 group transition-all duration-300 ${
                  isAcessivel ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`
                  }>

                  {/* Círculo da Etapa */}
                  <div className={`
                    relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isAtual ?
                  `bg-gradient-to-br ${etapa.color} shadow-lg ring-4 ring-amber-300/50 scale-110 animate-pulse` :
                  isConcluida ?
                  'bg-gradient-to-br from-green-500 to-emerald-500 shadow-md' :
                  'bg-slate-700 group-hover:bg-slate-600'}
                  `
                  }>
                    {isConcluida && !isAtual ?
                    <Check className="w-5 h-5 text-white" /> :

                    <Icon className={`w-5 h-5 ${isAtual || isConcluida ? 'text-white' : 'text-slate-400'}`} />
                    }
                    
                    {/* Brilho para etapa atual */}
                    {isAtual &&
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full"></div>
                    }
                  </div>
                  
                  {/* Label da Etapa */}
                  <span className={`text-xs font-medium whitespace-nowrap transition-colors ${
                  isAtual ?
                  'text-amber-400 font-bold' :
                  isConcluida ?
                  'text-emerald-400' :
                  'text-slate-400 group-hover:text-slate-300'}`
                  }>
                    {etapa.label}
                  </span>
                </button>);

            })}
          </div>
        </div>
      </div>
    </div>);

}