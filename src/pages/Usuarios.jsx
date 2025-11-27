// pages/Usuarios.jsx
import React, { useState, useEffect } from "react";
import GerenciadorUsuariosUnificado from "@/components/usuarios/GerenciadorUsuariosUnificado";
import { base44 } from "@/api/base44Client";

export default function UsuariosPage() {
  const [integracoes, setIntegracoes] = useState([]);

  // Carregar integrações WhatsApp
  useEffect(() => {
    const carregarIntegracoes = async () => {
      try {
        const ints = await base44.entities.WhatsAppIntegration.list();
        setIntegracoes(ints || []);
      } catch (e) {
        console.error("Erro ao carregar integrações:", e);
      }
    };
    carregarIntegracoes();
  }, []);

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
      perfilAcesso: u.perfilAcesso || "personalizado",
      // Campos adicionais para edição completa
      is_whatsapp_attendant: u.is_whatsapp_attendant || false,
      whatsapp_setores: u.whatsapp_setores || [],
      whatsapp_permissions: u.whatsapp_permissions || [],
      permissoes_comunicacao: u.permissoes_comunicacao || {},
      paginas_acesso: u.paginas_acesso || [],
      max_concurrent_conversations: u.max_concurrent_conversations || 5,
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
      perfilAcesso: usuario.perfilAcesso,
      // Campos de WhatsApp e comunicação
      is_whatsapp_attendant: usuario.is_whatsapp_attendant,
      whatsapp_setores: usuario.whatsapp_setores,
      whatsapp_permissions: usuario.whatsapp_permissions,
      permissoes_comunicacao: usuario.permissoes_comunicacao,
      paginas_acesso: usuario.paginas_acesso,
      max_concurrent_conversations: usuario.max_concurrent_conversations,
    };
    
    if (usuario.isNovo) {
      return await base44.entities.User.create({ ...payload, email: usuario.email });
    }
    return await base44.entities.User.update(usuario.id, payload);
  }

  async function excluirUsuario(usuarioId) {
    await base44.entities.User.delete(usuarioId);
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
        excluirUsuario={excluirUsuario}
        integracoesWhatsApp={integracoes}
      />
    </div>
  );
}