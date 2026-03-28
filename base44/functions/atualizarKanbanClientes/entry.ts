import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SKILL: atualizar_kanban_clientes
 * 
 * Atualiza status/classificação de contatos em massa baseado em critérios.
 * Move contatos entre colunas do Kanban de forma inteligente.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();
  const metricas = {
    contatos_analisados: 0,
    contatos_atualizados: 0,
    erros: 0
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      filtros = {},
      novo_status,
      nova_classe_abc,
      novas_tags,
      adicionar_tags = true,
      dry_run = false
    } = await req.json().catch(() => ({}));

    // Validar que pelo menos um critério de atualização foi fornecido
    if (!novo_status && !nova_classe_abc && !novas_tags) {
      return Response.json({
        success: false,
        error: 'Forneça pelo menos um campo para atualizar: novo_status, nova_classe_abc ou novas_tags'
      }, { status: 400 });
    }

    // 1. BUSCAR contatos que atendem aos filtros
    const contatosParaAtualizar = await base44.asServiceRole.entities.Contact.filter(
      filtros,
      '-updated_date',
      500
    );

    metricas.contatos_analisados = contatosParaAtualizar.length;

    if (contatosParaAtualizar.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhum contato encontrado com os filtros especificados.',
        metricas
      });
    }

    // 2. DRY RUN — Preview sem executar
    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        preview: {
          total_afetado: contatosParaAtualizar.length,
          alteracoes_planejadas: {
            novo_status: novo_status || '(sem alteração)',
            nova_classe_abc: nova_classe_abc || '(sem alteração)',
            tags: novas_tags ? (adicionar_tags ? 'adicionar' : 'substituir') : '(sem alteração)'
          },
          primeiros_5_contatos: contatosParaAtualizar.slice(0, 5).map(c => ({
            id: c.id,
            nome: c.nome,
            status_atual: c.status || 'novo',
            classe_atual: c.classe_abc || 'none',
            tags_atuais: c.tags || []
          }))
        },
        message: `SIMULAÇÃO: ${contatosParaAtualizar.length} contatos seriam atualizados. Nenhuma ação foi executada.`
      });
    }

    // 3. EXECUÇÃO REAL — Atualizar registros
    for (const contato of contatosParaAtualizar) {
      try {
        const dadosAtualizacao = {};

        if (novo_status) {
          dadosAtualizacao.status = novo_status;
        }

        if (nova_classe_abc) {
          dadosAtualizacao.classe_abc = nova_classe_abc;
        }

        if (novas_tags) {
          if (adicionar_tags) {
            // Adicionar tags sem duplicar
            const tagsAtuais = contato.tags || [];
            const tagsUnicas = [...new Set([...tagsAtuais, ...novas_tags])];
            dadosAtualizacao.tags = tagsUnicas;
          } else {
            // Substituir completamente
            dadosAtualizacao.tags = novas_tags;
          }
        }

        await base44.asServiceRole.entities.Contact.update(contato.id, dadosAtualizacao);
        metricas.contatos_atualizados++;

      } catch (error) {
        console.warn(`[KANBAN] Falha ao atualizar ${contato.id}:`, error.message);
        metricas.erros++;
      }
    }

    // 4. Log de auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      entity_tipo: 'Contact',
      action: 'bulk_update_kanban',
      usuario_id: user.id,
      dados_evento: {
        filtros,
        alteracoes: { novo_status, nova_classe_abc, novas_tags },
        total_atualizado: metricas.contatos_atualizados,
        executed_by_skill: 'atualizar_kanban_clientes'
      }
    }).catch(() => {});

    return Response.json({
      success: true,
      metricas,
      duration_ms: Date.now() - inicio,
      message: `✅ ${metricas.contatos_atualizados} contatos atualizados no Kanban.`,
      detalhes: {
        filtros_aplicados: filtros,
        alteracoes_realizadas: {
          status: novo_status,
          classe_abc: nova_classe_abc,
          tags: novas_tags
        },
        total_analisado: metricas.contatos_analisados,
        total_atualizado: metricas.contatos_atualizados,
        total_erros: metricas.erros
      }
    });

  } catch (error) {
    console.error('[atualizarKanbanClientes] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      metricas,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});