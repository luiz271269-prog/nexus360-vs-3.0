import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SKILL: limpar_dados_teste (CRÍTICO)
 * 
 * Exclusão em massa de dados de teste/desenvolvimento com preview obrigatório.
 * MODO: critical — requer frase de confirmação exata.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();
  const metricas = {
    registros_analisados: 0,
    registros_deletados: 0,
    entidades_afetadas: []
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // PROTEÇÃO CRÍTICA: Apenas admin
    if (user?.role !== 'admin') {
      return Response.json({
        success: false,
        error: 'Permissão negada: apenas admin pode executar limpeza de dados'
      }, { status: 403 });
    }

    const { entidade, filtros = {}, dry_run = false } = await req.json().catch(() => ({}));

    // Validar entidade permitida
    const entidadesPermitidasLimpeza = [
      'Venda', 'Orcamento', 'Interacao', 'WorkQueueItem', 
      'Message', 'EventoSistema', 'AuditLog'
    ];

    if (!entidade || !entidadesPermitidasLimpeza.includes(entidade)) {
      return Response.json({
        success: false,
        error: `Entidade inválida ou não permitida para limpeza. Permitidas: ${entidadesPermitidasLimpeza.join(', ')}`
      }, { status: 400 });
    }

    // PROTEÇÃO: Nunca permitir filtros vazios (deletaria tudo)
    if (!filtros || Object.keys(filtros).length === 0) {
      return Response.json({
        success: false,
        error: 'Filtros obrigatórios para limpeza. Nunca é permitido deletar TODOS os registros sem filtro.'
      }, { status: 400 });
    }

    // 1. PREVIEW — Buscar registros que seriam deletados
    const registrosParaDeletar = await base44.asServiceRole.entities[entidade].filter(
      filtros,
      '-created_date',
      500
    );

    metricas.registros_analisados = registrosParaDeletar.length;

    // 2. DRY RUN — Se solicitado, apenas retorna preview
    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        preview: {
          entidade,
          filtros,
          total_afetado: registrosParaDeletar.length,
          primeiros_5: registrosParaDeletar.slice(0, 5).map(r => ({
            id: r.id,
            created_date: r.created_date,
            sample_data: JSON.stringify(r).slice(0, 100)
          }))
        },
        message: `SIMULAÇÃO: ${registrosParaDeletar.length} registros seriam deletados. Nenhuma ação foi executada.`
      });
    }

    // 3. EXECUÇÃO REAL — Deletar registros
    const idsParaDeletar = registrosParaDeletar.map(r => r.id);
    
    for (const id of idsParaDeletar) {
      try {
        await base44.asServiceRole.entities[entidade].delete(id);
        metricas.registros_deletados++;
      } catch (error) {
        console.warn(`[LIMPAR-DADOS] Falha ao deletar ${entidade}:${id}:`, error.message);
      }
    }

    metricas.entidades_afetadas = [entidade];

    // 4. Log de auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      entity_tipo: 'system',
      action: 'bulk_delete',
      usuario_id: user.id,
      dados_evento: {
        entidade,
        filtros,
        total_deletado: metricas.registros_deletados,
        executed_by_skill: 'limpar_dados_teste'
      }
    }).catch(e => console.warn('[LIMPAR-DADOS] Falha ao criar AuditLog:', e.message));

    return Response.json({
      success: true,
      metricas,
      duration_ms: Date.now() - inicio,
      message: `✅ ${metricas.registros_deletados} registros de ${entidade} foram deletados com sucesso.`,
      detalhes: {
        entidade,
        filtros_aplicados: filtros,
        total_analisado: metricas.registros_analisados,
        total_deletado: metricas.registros_deletados
      }
    });

  } catch (error) {
    console.error('[limparDadosTeste] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      metricas,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});