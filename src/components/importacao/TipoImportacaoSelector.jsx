import React from 'react';
import { FileText, Users, ShoppingCart, FileCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TIPO_IMPORTACAO_MAP } from './UnifiedImportEngine';

const ICONS = {
  produtos: ShoppingCart,
  clientes: Users,
  vendas: FileText,
  orcamentos: FileCheck
};

export default function TipoImportacaoSelector({ onSelect, tipoSugerido }) {
  const tipos = Object.entries(TIPO_IMPORTACAO_MAP);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Selecione o tipo de dados a importar
        </h3>
        {tipoSugerido && (
          <p className="text-sm text-slate-600 mt-2">
            Sugestão: <span className="font-medium text-purple-600">{TIPO_IMPORTACAO_MAP[tipoSugerido]?.label}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tipos.map(([key, config]) => {
          const Icon = ICONS[key];
          const isSugerido = key === tipoSugerido;

          return (
            <Card
              key={key}
              className={`p-4 cursor-pointer hover:shadow-lg transition-all border-2 ${
                isSugerido
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => onSelect(key)}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isSugerido
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{config.label}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Entidade: {config.entidade}
                  </p>
                </div>
                {isSugerido && (
                  <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    ✨ Recomendado
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}