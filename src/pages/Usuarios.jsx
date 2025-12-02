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
    console.log('[Usuarios] Usuários carregados do banco:', users);
    return users.map(u => ({
      id: u.id,
      nome: u.full_name || '',
      email: u.email || '',
      setor: u.attendant_sector || 'geral',
      funcao: u.attendant_role || 'pleno',
      tipoAcesso: u.role || 'user',
      ativo: u.is_active !== false,
      // Campos adicionais para edição completa
      is_whatsapp_attendant: u.is_whatsapp_attendant || false,
      whatsapp_setores: u.whatsapp_setores || [],
      whatsapp_permissions: u.whatsapp_permissions || [],
      permissoes_comunicacao: u.permissoes_comunicacao || {},
      paginas_acesso: u.paginas_acesso || [],
      max_concurrent_conversations: u.max_concurrent_conversations || 5,
      // IMPORTANTE: Campo de permissões de páginas/recursos
      permissoes: u.paginas_acesso || [],
    }));
  }

  async function salvarUsuario(usuario) {
    console.log('[Usuarios] Salvando usuário:', usuario);
    
    const payload = {
      full_name: usuario.nome,
      attendant_sector: usuario.setor || 'geral',
      attendant_role: usuario.funcao || 'pleno',
      role: usuario.tipoAcesso || 'user',
      is_active: usuario.ativo !== false,
      // Campos de WhatsApp e comunicação
      is_whatsapp_attendant: usuario.is_whatsapp_attendant || false,
      whatsapp_setores: usuario.whatsapp_setores || [],
      whatsapp_permissions: usuario.whatsapp_permissions || [],
      permissoes_comunicacao: usuario.permissoes_comunicacao || {},
      paginas_acesso: usuario.paginas_acesso || [],
      max_concurrent_conversations: usuario.max_concurrent_conversations || 5,
    };
    
    console.log('[Usuarios] Payload para salvar:', payload);
    
    try {
      let resultado;
      if (usuario.isNovo) {
        // Usuário novo - criar
        resultado = await base44.entities.User.create({ ...payload, email: usuario.email });
        console.log('[Usuarios] Usuário criado:', resultado);
      } else {
        // Usuário existente - atualizar
        resultado = await base44.entities.User.update(usuario.id, payload);
        console.log('[Usuarios] Usuário atualizado:', resultado);
      }
      
      // Retornar o objeto atualizado mantendo os valores que foram enviados (não os do resultado)
      // Isso evita sobrescrever com valores antigos do banco
      return {
        id: resultado.id || usuario.id,
        nome: usuario.nome, // Manter o valor editado
        email: resultado.email || usuario.email,
        setor: usuario.setor, // Manter o valor editado
        funcao: usuario.funcao, // Manter o valor editado
        tipoAcesso: usuario.tipoAcesso, // Manter o valor editado
        ativo: usuario.ativo,
        is_whatsapp_attendant: usuario.is_whatsapp_attendant,
        whatsapp_setores: usuario.whatsapp_setores,
        whatsapp_permissions: usuario.whatsapp_permissions,
        permissoes_comunicacao: usuario.permissoes_comunicacao,
        paginas_acesso: usuario.paginas_acesso,
        max_concurrent_conversations: usuario.max_concurrent_conversations,
        isNovo: false,
      };
    } catch (error) {
      console.error('[Usuarios] Erro ao salvar:', error);
      throw error;
    }
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