import React from 'react';
import { getNomeUsuario, getSetorUsuario } from '../lib/userHelpers';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 👤 USUARIODISPLAY - Componente único para exibir informações de usuários
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ESTE É O ÚNICO COMPONENTE PERMITIDO PARA EXIBIR NOMES DE PESSOAS NO APP
 * 
 * Render fixo:
 *   Linha 1: Nome do Usuário (getNomeUsuario)
 *   Linha 2: ♦ Setor (getSetorUsuario) - apenas se existir
 * 
 * Sem exceções. Sem variações por tela. Sem "primeiro nome". Sem badge alternativo.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Avatar do usuário: usa foto_url quando existir, senão a inicial do nome.
function AvatarUsuario({ usuario, nome, size = 24 }) {
  const inicial = (nome || '?').trim().charAt(0).toUpperCase() || '?';
  const dim = { width: size, height: size };
  if (usuario?.foto_url) {
    return (
      <img
        src={usuario.foto_url}
        alt={nome}
        style={dim}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={dim}
      className="rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px]"
    >
      {inicial}
    </div>
  );
}

export default function UsuarioDisplay({ 
  usuario, 
  className = "",
  showSetor = true,
  showFoto = false,
  fotoSize = 24,
  variant = "default" // "default" | "compact"
}) {
  if (!usuario) {
    return (
      <div className={className}>
        <span className="text-slate-400 italic">Usuário não disponível</span>
      </div>
    );
  }

  const nome = getNomeUsuario(usuario);
  const setor = getSetorUsuario(usuario);

  // Variante compact: apenas uma linha com nome e setor inline
  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {showFoto && <AvatarUsuario usuario={usuario} nome={nome} size={fotoSize} />}
        <span className="font-medium text-slate-800 truncate">{nome}</span>
        {showSetor && setor && (
          <span className="text-xs text-slate-500 capitalize flex items-center gap-0.5">
            <span className="text-blue-500">♦</span> {setor}
          </span>
        )}
      </div>
    );
  }

  // Variante default: duas linhas
  if (showFoto) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AvatarUsuario usuario={usuario} nome={nome} size={fotoSize} />
        <div className="min-w-0">
          <span className="font-medium text-slate-800 block truncate">{nome}</span>
          {showSetor && setor && (
            <span className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
              <span className="text-blue-500">♦</span> {setor}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <span className="font-medium text-slate-800 block truncate">{nome}</span>
      {showSetor && setor && (
        <span className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
          <span className="text-blue-500">♦</span> {setor}
        </span>
      )}
    </div>
  );
}