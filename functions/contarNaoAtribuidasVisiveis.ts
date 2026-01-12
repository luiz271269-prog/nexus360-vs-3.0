/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔔 CONTADOR DE THREADS NÃO ATRIBUÍDAS VISÍVEIS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * HIERARQUIA DE VISIBILIDADE (alinhada com threadVisibility.js):
 * 
 * 1️⃣ PRIORIDADES ABSOLUTAS (ignoram filtros técnicos):
 *    - Admin/Gerente: vê TODAS as não atribuídas
 *    - Threads fidelizadas: NUNCA contam como "não atribuídas"
 * 
 * 2️⃣ FILTROS TÉCNICOS (aplicados APÓS prioridades):
 *    - Integração WhatsApp (whatsapp_permissions.can_view)
 *    - Setor (permissoes_visualizacao.setores_visiveis)
 *    - Conexão (permissoes_visualizacao.conexoes_visiveis)
 * 
 * 3️⃣ DEFINIÇÃO DE "NÃO ATRIBUÍDA":
 *    - assigned_user_id === NULL
 *    - E NÃO está fidelizada a outro usuário
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

/**
 * Verifica se thread está fidelizada a algum usuário
 */
const isFidelizadaAOutro = (contato) => {
  if (!contato) return false;
  
  const camposFidelizacao = [
    'atendente_fidelizado_vendas',
    'atendente_fidelizado_assistencia',
    'atendente_fidelizado_financeiro',
    'atendente_fidelizado_fornecedor',
    'vendedor_responsavel'
  ];
  
  return camposFidelizacao.some(campo => !!contato[campo]);
};

/**
 * Aplica filtros técnicos de permissão
 */
const passaFiltrosTecnicos = (usuario, thread, contato) => {
  const perms = usuario.permissoes_visualizacao || {};
  
  // 1. FILTRO DE INTEGRAÇÃO
  const integracoesVisiveis = perms.integracoes_visiveis || [];
  if (integracoesVisiveis.length > 0) {
    if (thread.whatsapp_integration_id) {
      const integracaoOk = integracoesVisiveis
        .map(normalizar)
        .includes(normalizar(thread.whatsapp_integration_id));
      if (!integracaoOk) return false;
    }
  }
  
  // 2. FILTRO DE CONEXÃO
  const conexoesVisiveis = perms.conexoes_visiveis || [];
  if (conexoesVisiveis.length > 0) {
    if (thread.conexao_id) {
      const conexaoOk = conexoesVisiveis
        .map(normalizar)
        .includes(normalizar(thread.conexao_id));
      if (!conexaoOk) return false;
    }
  }
  
  // 3. FILTRO DE SETOR (URA ou etiqueta)
  const setoresVisiveis = perms.setores_visiveis || [];
  if (setoresVisiveis.length > 0) {
    let setorThread = null;
    
    // Prioridade: sector_id da thread (URA)
    if (thread.sector_id) {
      setorThread = normalizar(thread.sector_id);
    } else if (thread.setor) {
      setorThread = normalizar(thread.setor);
    } else if (contato) {
      // Fallback: etiquetas do contato
      const tags = contato.tags || [];
      const SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
      for (const setor of SETORES) {
        if (tags.map(normalizar).includes(setor)) {
          setorThread = setor;
          break;
        }
      }
    }
    
    // Se tem setor definido, verificar permissão
    if (setorThread) {
      const setorOk = setoresVisiveis.map(normalizar).includes(setorThread);
      if (!setorOk) return false;
    }
  }
  
  return true;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // ✅ Autenticar usuário
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const isAdmin = user.role === 'admin';
    const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(user.attendant_role);
    const podeVerTodas = user.permissoes_visualizacao?.pode_ver_todas_conversas === true;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 1️⃣ BUSCAR TODAS AS THREADS NÃO ATRIBUÍDAS (apenas externas)
    // ═══════════════════════════════════════════════════════════════════════════════
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 500);
    
    // Filtrar apenas threads externas não atribuídas
    const threadsNaoAtribuidas = todasThreads.filter(t => {
      // Apenas threads externas
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') {
        return false;
      }
      
      // Não atribuídas
      return !t.assigned_user_id && !t.assigned_user_name && !t.assigned_user_email;
    });
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 2️⃣ BUSCAR CONTATOS (para verificar fidelização)
    // ═══════════════════════════════════════════════════════════════════════════════
    const contactIds = [...new Set(threadsNaoAtribuidas.map(t => t.contact_id).filter(Boolean))];
    const contatos = contactIds.length > 0 
      ? await base44.asServiceRole.entities.Contact.filter({ id: { $in: contactIds } })
      : [];
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 3️⃣ APLICAR HIERARQUIA DE VISIBILIDADE
    // ═══════════════════════════════════════════════════════════════════════════════
    const threadsVisiveis = threadsNaoAtribuidas.filter(thread => {
      const contato = contatosMap.get(thread.contact_id);
      
      // ✅ PRIORIDADE 1: Admin/Gerente/pode_ver_todas_conversas → vê TUDO
      if (isAdmin || isGerente || podeVerTodas) {
        // Exceto se fidelizado a outro (bloqueio absoluto)
        if (contato && isFidelizadaAOutro(contato)) {
          return false;
        }
        return true;
      }
      
      // ✅ PRIORIDADE 2: Contato fidelizado a outro → NUNCA conta como "não atribuída"
      if (contato && isFidelizadaAOutro(contato)) {
        return false;
      }
      
      // ✅ PRIORIDADE 3: Aplicar filtros técnicos (integração, setor, conexão)
      return passaFiltrosTecnicos(user, thread, contato);
    });
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // 4️⃣ GERAR BREAKDOWN POR SETOR E INTEGRAÇÃO
    // ═══════════════════════════════════════════════════════════════════════════════
    const porSetor = {};
    const porIntegracao = {};
    
    threadsVisiveis.forEach(thread => {
      const contato = contatosMap.get(thread.contact_id);
      
      // Breakdown por setor (URA ou etiqueta)
      let setorThread = 'sem_setor';
      if (thread.sector_id) {
        setorThread = thread.sector_id;
      } else if (thread.setor) {
        setorThread = thread.setor;
      } else if (contato) {
        const tags = contato.tags || [];
        const SETORES = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
        for (const setor of SETORES) {
          if (tags.map(normalizar).includes(setor)) {
            setorThread = setor;
            break;
          }
        }
      }
      
      porSetor[setorThread] = (porSetor[setorThread] || 0) + 1;
      
      // Breakdown por integração
      if (thread.whatsapp_integration_id) {
        porIntegracao[thread.whatsapp_integration_id] = 
          (porIntegracao[thread.whatsapp_integration_id] || 0) + 1;
      }
    });
    
    // Formatar resultado
    return Response.json({
      total: threadsVisiveis.length,
      por_setor: Object.entries(porSetor).map(([sector_id, total]) => ({ sector_id, total })),
      por_integracao: Object.entries(porIntegracao).map(([integration_id, total]) => ({ integration_id, total }))
    });
    
  } catch (error) {
    console.error('[contarNaoAtribuidasVisiveis] Erro:', error);
    return Response.json({ 
      error: error.message,
      total: 0,
      por_setor: [],
      por_integracao: []
    }, { status: 500 });
  }
});