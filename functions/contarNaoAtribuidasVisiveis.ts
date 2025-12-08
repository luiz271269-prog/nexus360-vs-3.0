import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔢 CONTADOR DE MENSAGENS NÃO ATRIBUÍDAS VISÍVEIS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Conta threads que:
 * 1. Não têm assigned_user_id (não atribuídas)
 * 2. Estão abertas (status != "resolvida" / "arquivada")
 * 3. São visíveis ao usuário (integração/conexão/setor)
 * 
 * Retorna:
 * {
 *   total: number,
 *   por_setor: [{ sector_id: string, total: number }],
 *   por_integracao: [{ integration_id: string, total: number }]
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. BUSCAR TODAS AS THREADS NÃO ATRIBUÍDAS E ABERTAS
    // ═══════════════════════════════════════════════════════════════════════
    const todasThreads = await base44.entities.MessageThread.list('-last_message_at', 200);
    
    const threadsNaoAtribuidas = todasThreads.filter(thread => {
      // Filtro 1: Não atribuída
      const naoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
      if (!naoAtribuida) return false;

      // Filtro 2: Status aberto
      const statusAberto = !thread.status || thread.status === 'aberta' || thread.status === 'aguardando_cliente';
      if (!statusAberto) return false;

      return true;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 2. APLICAR FILTROS DE SEGURANÇA (Permissões do Usuário)
    // ═══════════════════════════════════════════════════════════════════════
    const isAdmin = user.role === 'admin';
    const perms = user.permissoes_visualizacao || {};
    const podeVerTodas = perms.pode_ver_todas_conversas === true;
    const podeVerNaoAtribuidas = perms.pode_ver_nao_atribuidas !== false; // default true

    // Verificar se usuário pode ver não atribuídas
    if (!isAdmin && !podeVerTodas && !podeVerNaoAtribuidas) {
      return Response.json({
        total: 0,
        por_setor: [],
        por_integracao: [],
        mensagem: 'Sem permissão para ver não atribuídas'
      });
    }

    // Filtrar por permissões de integração/conexão/setor
    const threadsVisiveis = threadsNaoAtribuidas.filter(thread => {
      // Admin/pode_ver_todas vê tudo
      if (isAdmin || podeVerTodas) return true;

      // Verificar permissões de integração
      const integracoesVisiveis = perms.integracoes_visiveis || [];
      if (integracoesVisiveis.length > 0) {
        const integOk = integracoesVisiveis.some(i => 
          String(i).toLowerCase() === String(thread.whatsapp_integration_id || '').toLowerCase()
        );
        if (!integOk) return false;
      }

      // Verificar permissões de conexão
      const conexoesVisiveis = perms.conexoes_visiveis || [];
      if (conexoesVisiveis.length > 0) {
        const conexaoOk = conexoesVisiveis.some(c => 
          String(c).toLowerCase() === String(thread.conexao_id || '').toLowerCase()
        );
        if (!conexaoOk) return false;
      }

      // Verificar permissões de setor
      const setoresVisiveis = perms.setores_visiveis || [];
      if (setoresVisiveis.length > 0) {
        const setorOk = setoresVisiveis.some(s => 
          String(s).toLowerCase() === String(thread.sector_id || thread.setor || '').toLowerCase()
        );
        if (!setorOk) return false;
      }

      return true;
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 3. AGRUPAR POR SETOR E INTEGRAÇÃO
    // ═══════════════════════════════════════════════════════════════════════
    const porSetor = {};
    const porIntegracao = {};

    threadsVisiveis.forEach(thread => {
      const setor = thread.sector_id || thread.setor || 'sem_setor';
      porSetor[setor] = (porSetor[setor] || 0) + 1;

      const integracao = thread.whatsapp_integration_id || 'sem_integracao';
      porIntegracao[integracao] = (porIntegracao[integracao] || 0) + 1;
    });

    const porSetorArray = Object.entries(porSetor).map(([sector_id, total]) => ({
      sector_id,
      total
    }));

    const porIntegracaoArray = Object.entries(porIntegracao).map(([integration_id, total]) => ({
      integration_id,
      total
    }));

    // ═══════════════════════════════════════════════════════════════════════
    // 4. RETORNAR RESULTADO
    // ═══════════════════════════════════════════════════════════════════════
    return Response.json({
      total: threadsVisiveis.length,
      por_setor: porSetorArray,
      por_integracao: porIntegracaoArray,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[CONTADOR] Erro:', error);
    return Response.json({ 
      error: error.message,
      total: 0,
      por_setor: [],
      por_integracao: []
    }, { status: 500 });
  }
});