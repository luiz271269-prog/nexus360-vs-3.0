import React from 'react';
import { Zap, Workflow, Gift, MessageSquare, BarChart3 } from 'lucide-react';
import BibliotecaAutomacoes from '../components/automacao/BibliotecaAutomacoes';

export default function AutomacoesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/30 p-6">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Biblioteca de Automações
            </h1>
            <p className="text-slate-600 mt-1">
              Gerencie URAs, Playbooks, Promoções e Respostas Rápidas em um só lugar
            </p>
          </div>
        </div>
        
        {/* INDICADORES RÁPIDOS */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Workflow className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-slate-600">URAs Ativas</div>
                <div className="text-xl font-bold text-slate-900">--</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Workflow className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-slate-600">Playbooks</div>
                <div className="text-xl font-bold text-slate-900">--</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Gift className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-slate-600">Promoções</div>
                <div className="text-xl font-bold text-slate-900">--</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-xs text-slate-600">Taxa Sucesso</div>
                <div className="text-xl font-bold text-green-600">--</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* COMPONENTE PRINCIPAL */}
      <div className="max-w-7xl mx-auto">
        <BibliotecaAutomacoes />
      </div>
      
    </div>
  );
}