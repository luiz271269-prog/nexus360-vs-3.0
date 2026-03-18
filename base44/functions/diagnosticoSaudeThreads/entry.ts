import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// DIAGNÓSTICO: SAÚDE DE THREADS E PERMISSÕES
// ============================================================================
// Executa as 4 queries SQL da documentação para identificar problemas
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    console.log('[DIAGNÓSTICO] 🏥 Iniciando diagnóstico de saúde...');

    const diagnostico = {
      timestamp: new Date().toISOString(),
      queries: {}
    };

    // ============================================================================
    // QUERY 1: Threads Órfãs (integração não existe mais)
    // ============================================================================
    console.log('[DIAGNÓSTICO] 🔍 Query 1: Threads órfãs...');
    
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
      status: { $in: ['aberta', 'fechada'] }
    }, '-created_date', 500);

    const todasIntegracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list('-created_date', 100);
    const integracoesIds = new Set(todasIntegracoes.map(i => i.id));

    const threadsOrfas = todasThreads.filter(t => 
      t.whatsapp_integration_id && !integracoesIds.has(t.whatsapp_integration_id)
    );

    diagnostico.queries.threads_orfas = {
      total: threadsOrfas.length,
      exemplos: threadsOrfas.slice(0, 10).map(t => ({
        thread_id: t.id.substring(0, 8),
        contact_id: t.contact_id?.substring(0, 8),
        integration_id_inexistente: t.whatsapp_integration_id?.substring(0, 8),
        unread_count: t.unread_count,
        ultima_mensagem: t.last_message_at
      }))
    };

    // ============================================================================
    // QUERY 2: Threads com Integração Desconectada
    // ============================================================================
    console.log('[DIAGNÓSTICO] 🔍 Query 2: Threads com integração desconectada...');

    const threadsComIntegracaoDesconectada = todasThreads.filter(t => {
      if (!t.whatsapp_integration_id) return false;
      const integ = todasIntegracoes.find(i => i.id === t.whatsapp_integration_id);
      return integ && integ.status !== 'conectado' && t.unread_count > 0;
    });

    diagnostico.queries.threads_integração_desconectada = {
      total: threadsComIntegracaoDesconectada.length,
      exemplos: threadsComIntegracaoDesconectada.slice(0, 10).map(t => {
        const integ = todasIntegracoes.find(i => i.id === t.whatsapp_integration_id);
        return {
          thread_id: t.id.substring(0, 8),
          contact_id: t.contact_id?.substring(0, 8),
          integration_name: integ?.nome_instancia,
          integration_status: integ?.status,
          unread_count: t.unread_count
        };
      })
    };

    // ============================================================================
    // QUERY 3: Usuários sem Permissões Configuradas
    // ============================================================================
    console.log('[DIAGNÓSTICO] 🔍 Query 3: Usuários sem permissões...');

    const todosUsuarios = await base44.asServiceRole.entities.User.list('-created_date', 200);

    const usuariosSemPermissoes = todosUsuarios.filter(u => {
      if (u.role === 'admin') return false; // Admin não precisa
      const perms = u.whatsapp_permissions || [];
      return perms.length === 0;
    });

    diagnostico.queries.usuarios_sem_permissoes = {
      total: usuariosSemPermissoes.length,
      exemplos: usuariosSemPermissoes.slice(0, 10).map(u => ({
        user_id: u.id.substring(0, 8),
        email: u.email,
        role: u.role,
        attendant_sector: u.attendant_sector,
        attendant_role: u.attendant_role
      }))
    };

    // ============================================================================
    // QUERY 4: Threads sem origin_integration_ids
    // ============================================================================
    console.log('[DIAGNÓSTICO] 🔍 Query 4: Threads sem histórico de integrações...');

    const threadsSemOriginIds = todasThreads.filter(t => 
      !t.origin_integration_ids || t.origin_integration_ids.length === 0
    );

    diagnostico.queries.threads_sem_origin_ids = {
      total: threadsSemOriginIds.length,
      exemplos: threadsSemOriginIds.slice(0, 10).map(t => ({
        thread_id: t.id.substring(0, 8),
        contact_id: t.contact_id?.substring(0, 8),
        whatsapp_integration_id: t.whatsapp_integration_id?.substring(0, 8),
        unread_count: t.unread_count
      }))
    };

    // ============================================================================
    // RESUMO E RECOMENDAÇÕES
    // ============================================================================
    const totalProblemas = 
      diagnostico.queries.threads_orfas.total +
      diagnostico.queries.threads_integração_desconectada.total +
      diagnostico.queries.usuarios_sem_permissoes.total +
      diagnostico.queries.threads_sem_origin_ids.total;

    const recomendacoes = [];

    if (diagnostico.queries.threads_orfas.total > 0) {
      recomendacoes.push({
        prioridade: 'ALTA',
        problema: `${diagnostico.queries.threads_orfas.total} threads órfãs (integração deletada)`,
        acao: 'Executar migrarThreadsOrfas.js com dryRun=false'
      });
    }

    if (diagnostico.queries.threads_integração_desconectada.total > 0) {
      recomendacoes.push({
        prioridade: 'MÉDIA',
        problema: `${diagnostico.queries.threads_integração_desconectada.total} threads com integração desconectada`,
        acao: 'Reconectar integrações ou transferir threads para integrações ativas'
      });
    }

    if (diagnostico.queries.usuarios_sem_permissoes.total > 0) {
      recomendacoes.push({
        prioridade: 'ALTA',
        problema: `${diagnostico.queries.usuarios_sem_permissoes.total} usuários sem permissões WhatsApp`,
        acao: 'Executar autopermissoesUsuarios.js com dryRun=false'
      });
    }

    if (diagnostico.queries.threads_sem_origin_ids.total > 0) {
      recomendacoes.push({
        prioridade: 'BAIXA',
        problema: `${diagnostico.queries.threads_sem_origin_ids.total} threads sem histórico de integrações`,
        acao: 'Executar migrarThreadsOrfas.js (já corrige este problema)'
      });
    }

    diagnostico.resumo = {
      total_problemas: totalProblemas,
      saude_geral: totalProblemas === 0 ? '✅ SAUDÁVEL' : 
                   totalProblemas < 10 ? '⚠️ ATENÇÃO' : 
                   '🔴 CRÍTICO',
      recomendacoes
    };

    return Response.json({
      success: true,
      diagnostico
    });

  } catch (error) {
    console.error('[DIAGNÓSTICO] ❌ Erro fatal:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});