import React from "react";
import { base44 } from "@/api/base44Client";
import { LogOut, LogIn, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function UserAuthWidget({ usuario, loadingUsuario, onLogout }) {
  const handleLogin = () => {
    base44.auth.redirectToLogin();
  };

  // Estado de carregamento — só mostra spinner se ainda não temos usuário (cache de sessão renderiza direto)
  if (loadingUsuario && !usuario) {
    return (
      <div className="w-full flex items-center justify-center p-3 rounded-xl bg-slate-800/30">
        <div className="w-10 h-10 rounded-full border-2 border-slate-600 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // Se não há usuário logado
  if (!usuario) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center p-3 rounded-xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 shadow-lg transition-all group"
            >
              <LogIn className="h-5 w-5 text-white" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-slate-800 border-slate-700">
            <p className="text-sm text-white">Entrar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Se há usuário logado
  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-center p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all group relative">
                {(usuario.foto_url || usuario.foto_perfil_url) ? (
                  <img
                    src={usuario.foto_url || usuario.foto_perfil_url}
                    alt={usuario.full_name || 'Usuário'}
                    className="w-10 h-10 rounded-full object-cover shadow-lg"
                    onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                  />
                ) : null}
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  style={{ display: (usuario.foto_url || usuario.foto_perfil_url) ? 'none' : 'flex' }}
                >
                  {usuario.full_name ? usuario.full_name.substring(0, 2).toUpperCase() : '?'}
                </div>
                {usuario.role === 'admin' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900" />
                )}
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-slate-800 border-slate-700">
            <p className="text-sm text-white">Menu do Usuário</p>
          </TooltipContent>
        </Tooltip>

      <DropdownMenuContent 
        side="right" 
        align="end"
        className="w-64 bg-slate-800 border-slate-700 text-white"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              {(usuario.foto_url || usuario.foto_perfil_url) ? (
                <img
                  src={usuario.foto_url || usuario.foto_perfil_url}
                  alt={usuario.full_name || 'Usuário'}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {usuario.full_name ? usuario.full_name.substring(0, 2).toUpperCase() : '?'}
                </div>
              )}
              <p className="text-sm font-semibold text-white leading-none">
                {usuario.full_name || 'Usuário'}
              </p>
            </div>
            <p className="text-xs leading-none text-slate-400">
              {usuario.email}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-amber-500 text-white text-[10px]">
                {usuario.role || 'user'}
              </Badge>
              {usuario.attendant_sector && (
                <Badge className="bg-blue-500 text-white text-[10px]">
                  {usuario.attendant_sector}
                </Badge>
              )}
            </div>
            {usuario.attendant_role && (
              <p className="text-[10px] text-slate-500 mt-1">
                Nível: {usuario.attendant_role}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-slate-700" />

        <DropdownMenuItem 
          onClick={onLogout}
          className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-900/20 focus:text-red-300 focus:bg-red-900/20"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
      </TooltipProvider>
  );
}