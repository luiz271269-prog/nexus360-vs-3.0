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
      // REGRA DO NOME: display_name (editável) > full_name (login) > email
      nome: u.display_name || u.full_name || '',
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
    
    // IMPORTANTE: paginas_acesso armazena as permissões de páginas/recursos
    // O campo "permissoes" do frontend é mapeado para "paginas_acesso" no banco
    const permissoesParaSalvar = usuario.permissoes || usuario.paginas_acesso || [];
    
    const payload = {
      // IMPORTANTE: Salva no campo display_name (editável pelo sistema)
      // NÃO tentamos alterar full_name pois é do provedor de login
      display_name: usuario.nome,
      attendant_sector: usuario.setor || 'geral',
      attendant_role: usuario.funcao || 'pleno',
      role: usuario.tipoAcesso || 'user',
      is_active: usuario.ativo !== false,
      // Campos de WhatsApp e comunicação
      is_whatsapp_attendant: usuario.is_whatsapp_attendant || false,
      whatsapp_setores: usuario.whatsapp_setores || [],
      whatsapp_permissions: usuario.whatsapp_permissions || [],
      permissoes_comunicacao: usuario.permissoes_comunicacao || {},
      // IMPORTANTE: Salvar permissões de páginas/recursos aqui
      paginas_acesso: permissoesParaSalvar,
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
        // Usuário existente - atualizar usando auth.updateMe não funciona para outros usuários
        // Usar update normal da entidade
        resultado = await base44.entities.User.update(usuario.id, payload);
        console.log('[Usuarios] Usuário atualizado:', resultado);
      }
      
      // Retornar o objeto atualizado mantendo os valores que foram enviados
      return {
        id: resultado.id || usuario.id,
        nome: usuario.nome,
        email: resultado.email || usuario.email,
        setor: usuario.setor,
        funcao: usuario.funcao,
        tipoAcesso: usuario.tipoAcesso,
        ativo: usuario.ativo,
        is_whatsapp_attendant: usuario.is_whatsapp_attendant,
        whatsapp_setores: usuario.whatsapp_setores,
        whatsapp_permissions: usuario.whatsapp_permissions,
        permissoes_comunicacao: usuario.permissoes_comunicacao,
        paginas_acesso: permissoesParaSalvar,
        max_concurrent_conversations: usuario.max_concurrent_conversations,
        permissoes: permissoesParaSalvar,
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