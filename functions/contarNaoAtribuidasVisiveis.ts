import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔔 CONTADOR INTELIGENTE - NÃO ATRIBUÍDAS + TRAVADAS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Conta threads que requerem atenção:
 * 
 * 1️⃣ NÃO ATRIBUÍDAS (sem assigned_user_id)
 *    - Novas mensagens de clientes aguardando atendimento
 * 
 * 2️⃣ TRAVADAS/EM RISCO (atribuídas mas problemáticas):
 *    - Sem resposta do atendente há 30+ minutos (cliente aguardando)
 *    - Pré-atendimento em timeout (URA travada)
 *    - Última interação humana há 2+ horas (abandonada)
 * 
 * ✅ OBJETIVO: Não perder conversas - garantir que nada fique esquecido
 * 
 * Retorna:
 * {
 *   total: number,
 *   nao_atribuidas: number,
 *   travadas: number,
 *   por_setor: [{ sector_id: string, total: number, tipo: string }],
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
    // 1. BUSCAR THREADS ATIVAS (ABERTAS)
    // ═══════════════════════════════════════════════════════════════════════
    const todasThreads = await base44.entities.MessageThread.list('-last_message_at', 300);
    
    const agora = Date.now();
    const MINUTOS_30 = 30 * 60 * 1000;
    const HORAS_2 = 2 * 60 * 60 * 1000;
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. CATEGORIZAR THREADS: NÃO ATRIBUÍDAS + TRAVADAS
    // ═══════════════════════════════════════════════════════════════════════
    
    const threadsNaoAtribuidas = [];
    const threadsTravadas = [];
    
    todasThreads.forEach(thread => {
      // ✅ Ignorar threads internas (team_internal/sector_group)
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        return;
      }
      
      // Filtrar apenas threads abertas/ativas
      const statusAberto = !thread.status || thread.status === 'aberta' || thread.status === 'aguardando_cliente';
      if (!statusAberto) return;
      
      // CATEGORIA 1: NÃO ATRIBUÍDAS (sem dono)
      const naoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
      if (naoAtribuida) {
        threadsNaoAtribuidas.push(thread);
        return;
      }
      
      // CATEGORIA 2: TRAVADAS (atribuídas mas problemáticas)
      
      // 2.1) Cliente aguardando resposta há 30+ minutos
      if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
        const tempoSemResposta = agora - new Date(thread.last_inbound_at).getTime();
        if (tempoSemResposta > MINUTOS_30) {
          threadsTravadas.push({ ...thread, motivo_travamento: 'sem_resposta_30min' });
          return;
        }
      }
      
      // 2.2) Pré-atendimento em timeout
      if (thread.pre_atendimento_ativo && thread.pre_atendimento_state === 'TIMEOUT') {
        threadsTravadas.push({ ...thread, motivo_travamento: 'ura_timeout' });
        return;
      }
      
      // 2.3) Sem interação humana há 2+ horas (abandonada)
      if (thread.last_human_message_at) {
        const tempoSemHumano = agora - new Date(thread.last_human_message_at).getTime();
        if (tempoSemHumano > HORAS_2 && thread.last_message_sender === 'contact') {
          threadsTravadas.push({ ...thread, motivo_travamento: 'abandonada_2h' });
          return;
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 3. APLICAR FILTROS DE PERMISSÃO (Integração/Setor/Conexão)
    // ═══════════════════════════════════════════════════════════════════════
    const isAdmin = user.role === 'admin';
    const perms = user.permissoes_visualizacao || {};
    const podeVerTodas = perms.pode_ver_todas_conversas === true;
    const podeVerNaoAtribuidas = perms.pode_ver_nao_atribuidas !== false; // default true
    const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(user.attendant_role);

    // Verificar se usuário pode ver não atribuídas
    if (!isAdmin && !podeVerTodas && !podeVerNaoAtribuidas) {
      return Response.json({
        total: 0,
        nao_atribuidas: 0,
        travadas: 0,
        por_setor: [],
        por_integracao: [],
        mensagem: 'Sem permissão para ver não atribuídas'
      });
    }

    // Helper: Filtrar threads baseado em permissões
    const filtrarPorPermissoes = (thread) => {
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
    };
    
    // Aplicar filtros de permissão
    const naoAtribuidasVisiveis = threadsNaoAtribuidas.filter(filtrarPorPermissoes);
    
    // ✅ GERENTES veem travadas de TODA a equipe
    // ✅ ATENDENTES veem apenas suas próprias travadas
    const travadasVisiveis = threadsTravadas.filter(thread => {
      // Gerente vê todas as travadas
      if (isGerente || isAdmin || podeVerTodas) {
        return filtrarPorPermissoes(thread);
      }
      
      // Atendente comum só vê travadas atribuídas a ele
      const atribuidaAoUsuario = thread.assigned_user_id === user.id;
      return atribuidaAoUsuario && filtrarPorPermissoes(thread);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 4. CONSOLIDAR RESULTADOS (Não Atribuídas + Travadas)
    // ═══════════════════════════════════════════════════════════════════════
    const todasThreadsProblematicas = [
      ...naoAtribuidasVisiveis.map(t => ({ ...t, tipo_problema: 'nao_atribuida' })),
      ...travadasVisiveis.map(t => ({ ...t, tipo_problema: t.motivo_travamento }))
    ];
    
    // ═══════════════════════════════════════════════════════════════════════
    // 5. AGRUPAR POR SETOR E INTEGRAÇÃO (com detalhamento)
    // ═══════════════════════════════════════════════════════════════════════
    const porSetor = {};
    const porIntegracao = {};

    todasThreadsProblematicas.forEach(thread => {
      const setor = thread.sector_id || thread.setor || 'sem_setor';
      const tipo = thread.tipo_problema;
      
      if (!porSetor[setor]) {
        porSetor[setor] = { total: 0, nao_atribuidas: 0, travadas: 0 };
      }
      porSetor[setor].total += 1;
      
      if (tipo === 'nao_atribuida') {
        porSetor[setor].nao_atribuidas += 1;
      } else {
        porSetor[setor].travadas += 1;
      }

      const integracao = thread.whatsapp_integration_id || 'sem_integracao';
      porIntegracao[integracao] = (porIntegracao[integracao] || 0) + 1;
    });

    const porSetorArray = Object.entries(porSetor).map(([sector_id, dados]) => ({
      sector_id,
      total: dados.total,
      nao_atribuidas: dados.nao_atribuidas,
      travadas: dados.travadas
    }));

    const porIntegracaoArray = Object.entries(porIntegracao).map(([integration_id, total]) => ({
      integration_id,
      total
    }));

    // ═══════════════════════════════════════════════════════════════════════
    // 6. RETORNAR RESULTADO DETALHADO
    // ═══════════════════════════════════════════════════════════════════════
    return Response.json({
      total: todasThreadsProblematicas.length,
      nao_atribuidas: naoAtribuidasVisiveis.length,
      travadas: travadasVisiveis.length,
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