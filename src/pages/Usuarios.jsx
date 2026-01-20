import React, { useState, useEffect } from "react";
import GerenciadorUsuariosUnificado from "@/components/usuarios/GerenciadorUsuariosUnificado";
import { base44 } from "@/api/base44Client";
import { PERMISSIONS_PRESETS } from "@/components/lib/permissionsService";

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
    console.log('[Usuarios] 💾 Salvando usuário:', usuario.email);
    
    // IMPORTANTE: paginas_acesso armazena as permissões de páginas/recursos
    const permissoesParaSalvar = usuario.permissoes || usuario.paginas_acesso || [];
    
    let payload = {
      display_name: usuario.nome,
      attendant_sector: usuario.setor || 'geral',
      attendant_role: usuario.funcao || 'pleno',
      role: usuario.tipoAcesso || 'user',
      is_active: usuario.ativo !== false,
      is_whatsapp_attendant: usuario.is_whatsapp_attendant || false,
      whatsapp_setores: usuario.whatsapp_setores || [],
      whatsapp_permissions: usuario.whatsapp_permissions || [],
      permissoes_comunicacao: usuario.permissoes_comunicacao || {},
      paginas_acesso: permissoesParaSalvar,
      max_concurrent_conversations: usuario.max_concurrent_conversations || 5,
      // NEXUS360: Sempre ativo
      sistema_permissoes_ativo: 'nexus360',
      configuracao_visibilidade_nexus: usuario.configuracao_visibilidade_nexus || {
        modo_visibilidade: 'padrao_liberado',
        regras_bloqueio: [],
        regras_liberacao: []
      },
      permissoes_acoes_nexus: usuario.permissoes_acoes_nexus || {},
      diagnostico_nexus: usuario.diagnostico_nexus || { ativo: false }
    }
    
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
      
      // Recarregar usuário do banco para garantir dados sincronizados
      const usuarioAtualizado = await base44.entities.User.list();
      const encontrado = usuarioAtualizado.find(u => u.id === (resultado.id || usuario.id));
      
      if (encontrado) {
        return {
          id: encontrado.id,
          nome: encontrado.display_name || encontrado.full_name,
          email: encontrado.email,
          setor: encontrado.attendant_sector,
          funcao: encontrado.attendant_role,
          tipoAcesso: encontrado.role,
          ativo: encontrado.is_active,
          is_whatsapp_attendant: encontrado.is_whatsapp_attendant,
          whatsapp_setores: encontrado.whatsapp_setores,
          whatsapp_permissions: encontrado.whatsapp_permissions,
          permissoes_comunicacao: encontrado.permissoes_comunicacao,
          paginas_acesso: encontrado.paginas_acesso,
          max_concurrent_conversations: encontrado.max_concurrent_conversations,
          permissoes: encontrado.paginas_acesso,
          configuracao_visibilidade_nexus: encontrado.configuracao_visibilidade_nexus,
          permissoes_acoes_nexus: encontrado.permissoes_acoes_nexus,
          diagnostico_nexus: encontrado.diagnostico_nexus,
          sistema_permissoes_ativo: encontrado.sistema_permissoes_ativo,
          isNovo: false,
        };
      }
      
      return { ...usuario, isNovo: false };
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
    <div className="p-2 h-full flex flex-col gap-2">
      <header className="mb-1">
        <h1 className="text-base font-semibold">Gerenciamento de Usuários & Acessos</h1>
        <p className="text-[10px] text-gray-500">
          Controle centralizado de usuários, páginas e permissões granulares.
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