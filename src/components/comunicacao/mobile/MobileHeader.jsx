import React from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';

/**
 * Header compacto da Central de Comunicação no mobile.
 * UI pura — recebe apenas o handler de atualização.
 */
export default function MobileHeader({ onAtualizar }) {
  return (
    <div className="md:hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-xl flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2">
        {/* Título compacto */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent truncate">
            Comunicação
          </span>
        </div>

        {/* Ações compactas */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAtualizar}
            className="w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}