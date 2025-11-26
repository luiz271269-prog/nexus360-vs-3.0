// pages/Usuarios.jsx
import React from "react";
import GerenciadorUsuariosUnificado from "@/components/usuarios/GerenciadorUsuariosUnificado";
import { base44 } from "@/api/base44Client";

// Aqui é só exemplo: adapte para seu layout padrão (Navbar, container, etc).
export default function UsuariosPage() {
  async function carregarUsuarios() {
    const users = await base44.entities.User.list();
    return users.map(u => ({
      id: u.id,
      nome: u.full_name,
      email: u.email,
      setor: u.attendant_sector || "",
      funcao: u.attendant_role || "",
      tipoAcesso: u.role,
      ativo: u.is_active !== false,
      permissoes: u.permissoes || [],
      perfilAcesso: u.perfilAcesso || "personalizado"
    }));
  }

  async function salvarUsuario(usuario) {
    const payload = {
      full_name: usuario.nome,
      attendant_sector: usuario.setor,
      attendant_role: usuario.funcao,
      role: usuario.tipoAcesso,
      is_active: usuario.ativo,
      permissoes: usuario.permissoes,
      perfilAcesso: usuario.perfilAcesso
    };
    
    if (usuario.isNovo) {
      return await base44.entities.User.create({ ...payload, email: usuario.email });
    }
    return await base44.entities.User.update(usuario.id, payload);
  }

  async function salvarPermissoes(usuarioId, permissoes) {
    await base44.entities.User.update(usuarioId, { permissoes });
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