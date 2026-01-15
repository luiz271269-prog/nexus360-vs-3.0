/**
 * Conversor de Permissões: Legacy → Nexus360
 * Transforma dados legados (whatsapp_setores, whatsapp_conexoes, flags de ação)
 * em estrutura Nexus360 (configuracao_visibilidade_nexus, permissoes_acoes_nexus)
 */

const ALL_SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];

export function converterParaNexus360(usuario, integracoes = []) {
  // Se já foi configurado manualmente no painel Nexus360, não reconverter
  if (usuario.configuracao_visibilidade_nexus || usuario.permissoes_acoes_nexus) {
    return {
      configuracao_visibilidade_nexus: usuario.configuracao_visibilidade_nexus,
      permissoes_acoes_nexus: usuario.permissoes_acoes_nexus,
    };
  }

  // 1) HARD CORE: Bloqueios derivados de setores e integrações permitidas
  const setoresPermitidos = usuario.whatsapp_setores || [];
  const setoresBloqueados = ALL_SETORES.filter(s => !setoresPermitidos.includes(s));

  const conexoesPermitidas = usuario.whatsapp_conexoes || [];
  const integracoesBloqueadas = integracoes
    .filter(i => !conexoesPermitidas.includes(i.id))
    .map(i => i.id);

  // P9: Canal (se !pode_ver_conversas, bloqueia whatsapp)
  const canaisBloqueados = usuario.pode_ver_conversas ? [] : ['whatsapp'];

  const regras_bloqueio = [];

  if (setoresBloqueados.length > 0) {
    regras_bloqueio.push({
      tipo: 'setor',
      valores_bloqueados: setoresBloqueados,
      ativa: true,
      prioridade: 10,
      descricao: 'Bloqueio automático de setores não atendidos (P11)',
    });
  }

  if (integracoesBloqueadas.length > 0) {
    regras_bloqueio.push({
      tipo: 'integracao',
      valores_bloqueados: integracoesBloqueadas,
      ativa: true,
      prioridade: 10,
      descricao: 'Bloqueio automático de integrações não permitidas (P10)',
    });
  }

  if (canaisBloqueados.length > 0) {
    regras_bloqueio.push({
      tipo: 'canal',
      valores_bloqueados: canaisBloqueados,
      ativa: true,
      prioridade: 10,
      descricao: 'Bloqueio automático de canal (P9)',
    });
  }

  // 2) SOFT CORE: Vazio por padrão (será preenchido por configurações extras)
  const regras_liberacao = [];

  // 3) Deduplicação
  const deduplicacao = {
    ativa: true,
    criterio: 'contact_id',
    manter: 'mais_recente',
    excecoes: [
      { condicao: 'thread_interna', desativar_dedup: true },
      { condicao: 'admin_com_busca', desativar_dedup: true },
    ],
  };

  // 4) AÇÕES: Mapeamento direto da Central de Comunicação
  const permissoes_acoes_nexus = {
    // Permissões de visibilidade
    podeVerConversas: usuario.pode_ver_conversas ?? true,
    podeEnviarMensagens: usuario.pode_enviar_mensagens ?? true,
    podeEnviarMidias: usuario.pode_enviar_midias ?? true,
    podeEnviarAudios: usuario.pode_enviar_audios ?? true,
    podeTransferirConversa: usuario.pode_transferir_conversa ?? false,
    podeApagarMensagens: usuario.pode_apagar_mensagens ?? false,
    podeVerTodasConversas: usuario.pode_ver_todas_conversas ?? false,
    podeVerDetalhesContato: usuario.pode_ver_detalhes_contato ?? true,
    podeEditarContato: usuario.pode_editar_contato ?? true,
    podeBloquearContato: usuario.pode_bloquear_contato ?? false,
    podeDeletarContato: usuario.pode_deletar_contato ?? false,

    // Permissões de operação
    podeGerenciarFilas: usuario.pode_gerenciar_filas ?? false,
    podeAtribuirConversas: usuario.pode_atribuir_conversas ?? false,
    podeReatribuirConversas: usuario.pode_reatribuir_conversas ?? false,

    // Automação
    podeCriarPlaybooks: usuario.pode_criar_playbooks ?? false,
    podeEditarPlaybooks: usuario.pode_editar_playbooks ?? false,

    // Configuração
    podeGerenciarConexoes: usuario.pode_gerenciar_conexoes ?? false,
    podeVerRelatorios: usuario.pode_ver_relatorios ?? false,
    podeExportarDados: usuario.pode_exportar_dados ?? false,
    podeGerenciarPermissoes: usuario.pode_gerenciar_permissoes ?? false,
    podeVerDiagnosticos: usuario.pode_ver_diagnosticos ?? false,

    // Flags híbridas (P6/P7)
    podeVerNaoAtribuidas: usuario.pode_ver_nao_atribuidas ?? false,
    podeVerConversasOutros:
      usuario.attendant_role === 'coordenador' ||
      usuario.attendant_role === 'gerente' ||
      usuario.role === 'admin'
        ? true
        : usuario.pode_ver_conversas_outros ?? false,
    podeVerCarteiraOutros:
      usuario.attendant_role === 'gerente' || usuario.role === 'admin'
        ? true
        : usuario.pode_ver_carteira_outros ?? false,
    podeVerTodosSetores: usuario.role === 'admin' ? true : usuario.pode_ver_todos_setores ?? false,

    // Strict Mode
    strictMode: usuario.strict_mode ?? false,
  };

  return {
    configuracao_visibilidade_nexus: {
      modo_visibilidade: 'padrao_liberado',
      regras_bloqueio,
      regras_liberacao,
      deduplicacao,
    },
    permissoes_acoes_nexus,
  };
}