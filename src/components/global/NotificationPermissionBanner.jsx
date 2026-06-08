import React from 'react';
import { Bell, X } from 'lucide-react';

/**
 * NotificationPermissionBanner — banner persistente que insiste para o
 * usuário habilitar notificações (Wake-Up). Aparece sempre que a permissão
 * NÃO está concedida, em qualquer abertura do app (desktop e mobile).
 *
 * Props:
 *   visivel: boolean — mostrar o banner
 *   bloqueado: boolean — permissão foi NEGADA no navegador (denied)
 *   onAtivar: () => void — pede a permissão de novo
 *   onFechar: () => void — esconde até a próxima abertura (não persiste "não")
 */
export default function NotificationPermissionBanner({ visivel, bloqueado, onAtivar, onFechar }) {
  if (!visivel) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-md px-1">
      <div
        className="flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl border border-amber-300/40"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
          <Bell className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight">
            Ative as notificações
          </p>
          <p className="text-slate-300 text-xs mt-0.5 leading-snug">
            {bloqueado
              ? 'As notificações estão bloqueadas. Toque para ver como reativar e não perder nenhuma mensagem.'
              : 'Receba as mensagens mesmo com o app fechado, no celular e no computador.'}
          </p>
        </div>

        <button
          onClick={onAtivar}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold shadow-lg hover:from-amber-500 hover:to-orange-600 transition-colors"
        >
          Ativar
        </button>

        <button
          onClick={onFechar}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          title="Fechar (vai perguntar de novo na próxima vez)"
        >
          <X className="w-3.5 h-3.5 text-slate-300" />
        </button>
      </div>
    </div>
  );
}