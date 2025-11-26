// pages/Usuarios.jsx
import React from "react";
import { PAGINAS_E_ACOES_DO_SISTEMA, PERFIS_ACESSO_RAPIDO } from "@/components/config/acessoConfig.js";
import GerenciadorUsuariosUnificado from "@/components/usuarios/GerenciadorUsuariosUnificado";

// Aqui é só exemplo: adapte para seu layout padrão (Navbar, container, etc).
export default function UsuariosPage() {
  // TODO: integrar com seu backend/Base44.
  // Exemplos de funções de carregamento/salvamento:
  async function carregarUsuarios() {
    // Exemplo: buscar da sua API ou Base44
    // const res = await fetch("/api/usuarios");
    // return await res.json();
    return [];
  }

  async function salvarUsuario(usuario) {
    // Exemplo: POST/PUT para sua API
    // const res = await fetch("/api/usuarios", { ... });
    // return await res.json();
    console.log("Salvar usuário (mock):", usuario);
    return usuario;
  }

  async function salvarPermissoes(usuarioId, permissoes) {
    // Exemplo: endpoint específico de permissões
    console.log("Salvar permissões (mock):", { usuarioId, permissoes });
  }

  return (
    <div className="p-4 h-full flex flex-col gap-3">
      <header className="mb-2">
        <h1 className="text-lg font-semibold">Gerenciamento de Usuários & Acessos</h1>
        <p className="text-xs text-gray-500">
          Controle centralizado de usuários, páginas e permissões granulares em uma única tela.
        </p>
      </header>

      <GerenciadorUsuariosUnificado
        carregarUsuarios={carregarUsuarios}
        salvarUsuario={salvarUsuario}
        salvarPermissoes={salvarPermissoes}
      />
    </div>
  );
}