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

export default function UsuarioDisplay({ 
  usuario, 
  className = "",
  showSetor = true,
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
      <div className={`flex items-center gap-1 ${className}`}>
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