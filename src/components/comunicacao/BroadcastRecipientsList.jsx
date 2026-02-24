// BroadcastRecipientsList - extracted from ChatWindow to reduce file size
import React from "react";

export default function BroadcastRecipientsList({ broadcastInterno, contatosSelecionados }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-2xl mx-auto">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">
          {broadcastInterno ? 'Destinatários internos:' : 'Contatos selecionados:'}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
          {broadcastInterno ?
            broadcastInterno.destinations.map((dest) =>
              <div key={dest.thread_id} className="bg-white rounded-lg p-2 border border-purple-200 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {dest.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{dest.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {dest.type === 'user' ? '👤 1:1' : dest.type === 'sector' ? '🏢 Setor' : '👥 Grupo'}
                  </p>
                </div>
              </div>
            ) :
            contatosSelecionados.map((contato) =>
              <div key={contato.id} className="bg-white rounded-lg p-2 border border-orange-200 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(contato.nome || contato.telefone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{contato.nome || 'Sem nome'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{contato.telefone}</p>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}