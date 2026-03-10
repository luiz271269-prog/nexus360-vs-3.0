import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ROTEAMENTO INTELIGENTE PONDERADO COM SKILLS               ║
 * ║  Atribui conversas baseado em carga, skills e segmento    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Validar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, contact_id, sector } = await req.json();

    if (!thread_id) {
      return Response.json({ error: 'thread_id é obrigatório' }, { status: 400 });
    }

    console.log('[ROTEAMENTO] 🎯 Iniciando roteamento para thread:', thread_id);

    // Buscar a thread
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    
    // Se já está atribuída, não fazer nada
    if (thread.assigned_user_id) {
      return Response.json({ 
        success: true,
        message: 'Thread já atribuída',
        assigned_to: thread.assigned_user_id,
        assigned_to_name: thread.assigned_user_name
      });
    }

    // Buscar o contato para verificar fidelização
    const contact = contact_id 
      ? await base44.asServiceRole.entities.Contact.get(contact_id)
      : await base44.asServiceRole.entities.Contact.get(thread.contact_id);

    // PRIORIDADE 1: Se o contato tem atendente fidelizado, atribuir diretamente
    if (contact.atendente_fidelizado_vendas && sector === 'vendas') {
      return await atribuirAtendenteEspecifico(
        base44, 
        thread, 
        contact.atendente_fidelizado_vendas,
        'fidelizacao_vendas'
      );
    }

    if (contact.atendente_fidelizado_assistencia && sector === 'assistencia') {
      return await atribuirAtendenteEspecifico(
        base44, 
        thread, 
        contact.atendente_fidelizado_assistencia,
        'fidelizacao_assistencia'
      );
    }

    if (contact.atendente_fidelizado_financeiro && sector === 'financeiro') {
      return await atribuirAtendenteEspecifico(
        base44, 
        thread, 
        contact.atendente_fidelizado_financeiro,
        'fidelizacao_financeiro'
      );
    }

    // PRIORIDADE 2: Buscar atendentes disponíveis no setor
    const setorFinal = sector || thread.sector_id || 'geral';
    
    const atendentes = await base44.asServiceRole.entities.User.filter({
      is_whatsapp_attendant: true,
      attendant_sector: setorFinal,
      availability_status: 'online'
    });

    console.log(`[ROTEAMENTO] 👥 Encontrados ${atendentes.length} atendentes no setor ${setorFinal}`);

    if (atendentes.length === 0) {
      // Tentar atendentes do setor 'geral' como fallback
      const atendentesGeral = await base44.asServiceRole.entities.User.filter({
        is_whatsapp_attendant: true,
        attendant_sector: 'geral',
        availability_status: 'online'
      });

      if (atendentesGeral.length === 0) {
        return Response.json({ 
          success: false,
          message: 'Nenhum atendente disponível no momento',
          action: 'queue_or_notify_admin'
        });
      }

      return await distribuirPorCarga(base44, thread, contact, atendentesGeral, 'geral_fallback');
    }

    // PRIORIDADE 3: Distribuir por carga ponderada
    return await distribuirPorCarga(base44, thread, contact, atendentes, 'distribuicao_normal');

  } catch (error) {
    console.error('[ROTEAMENTO] ❌ Erro:', error);
    return Response.json({ 
      success: false,
      error: 'Erro ao processar roteamento',
      details: error.message 
    }, { status: 500 });
  }
});

/**
 * Atribuir a um atendente específico (fidelização)
 */
async function atribuirAtendenteEspecifico(base44, thread, atendenteId, motivo) {
  try {
    const atendente = await base44.asServiceRole.entities.User.get(atendenteId);

    // Verificar se atendente está disponível
    if (atendente.availability_status !== 'online') {
      console.warn(`[ROTEAMENTO] ⚠️ Atendente fidelizado ${atendente.full_name} está offline`);
      return { 
        success: false, 
        message: 'Atendente fidelizado indisponível',
        fallback_needed: true 
      };
    }

    // Verificar capacidade
    const cargaAtual = atendente.current_conversations_count || 0;
    const capacidadeMax = atendente.max_concurrent_conversations || 5;

    if (cargaAtual >= capacidadeMax) {
      console.warn(`[ROTEAMENTO] ⚠️ Atendente fidelizado ${atendente.full_name} está lotado`);
      return { 
        success: false, 
        message: 'Atendente fidelizado lotado',
        fallback_needed: true 
      };
    }

    // Atribuir
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      assigned_user_id: atendente.id,
      assigned_user_name: atendente.full_name,
      sector_id: atendente.attendant_sector
    });

    // Incrementar contador
    await base44.asServiceRole.entities.User.update(atendente.id, {
      current_conversations_count: cargaAtual + 1
    });

    // Log de automação
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'roteamento_fidelizado',
      thread_id: thread.id,
      resultado: 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        atendente_id: atendente.id,
        atendente_nome: atendente.full_name,
        motivo,
        carga_antes: cargaAtual,
        carga_depois: cargaAtual + 1
      }
    });

    console.log(`[ROTEAMENTO] ✅ Atribuído a ${atendente.full_name} (${motivo})`);

    return {
      success: true,
      message: 'Thread atribuída ao atendente fidelizado',
      assigned_to: atendente.id,
      assigned_to_name: atendente.full_name,
      reason: motivo
    };

  } catch (error) {
    console.error('[ROTEAMENTO] Erro ao atribuir atendente específico:', error);
    return { 
      success: false, 
      error: error.message,
      fallback_needed: true 
    };
  }
}

/**
 * Distribuir por carga ponderada (considerando segmento do cliente)
 */
async function distribuirPorCarga(base44, thread, contact, atendentes, origem) {
  try {
    // Pesos por segmento de cliente
    const segmentWeights = { 'A': 3, 'B': 2, 'C': 1 };
    const segmentWeight = segmentWeights[contact.client_segment] || 1;

    // Calcular score ponderado para cada atendente
    const scoresAtendentes = atendentes.map(atendente => {
      const cargaAtual = atendente.current_conversations_count || 0;
      const capacidadeMax = atendente.max_concurrent_conversations || 5;
      
      // Se já está no limite, não considerar
      if (cargaAtual >= capacidadeMax) {
        return { atendente, score: Infinity };
      }

      // Score ponderado: carga atual × peso do segmento
      // Quanto MENOR o score, melhor (menos carga)
      const score = cargaAtual * segmentWeight;

      return { atendente, score, cargaAtual, capacidadeMax };
    });

    // Ordenar por menor score (menos carga ponderada)
    scoresAtendentes.sort((a, b) => a.score - b.score);

    const melhorAtendente = scoresAtendentes[0];

    if (melhorAtendente.score === Infinity) {
      return Response.json({
        success: false,
        message: 'Todos os atendentes estão no limite de capacidade',
        action: 'queue_or_escalate'
      });
    }

    // Atribuir a thread ao melhor atendente
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      assigned_user_id: melhorAtendente.atendente.id,
      assigned_user_name: melhorAtendente.atendente.full_name,
      sector_id: melhorAtendente.atendente.attendant_sector
    });

    // Atualizar contagem do atendente
    await base44.asServiceRole.entities.User.update(melhorAtendente.atendente.id, {
      current_conversations_count: melhorAtendente.cargaAtual + 1
    });

    // Log de automação
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'roteamento_distribuido',
      thread_id: thread.id,
      resultado: 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        atendente_id: melhorAtendente.atendente.id,
        atendente_nome: melhorAtendente.atendente.full_name,
        origem,
        score_calculado: melhorAtendente.score,
        carga_antes: melhorAtendente.cargaAtual,
        carga_depois: melhorAtendente.cargaAtual + 1,
        capacidade_max: melhorAtendente.capacidadeMax,
        segment_weight: segmentWeight,
        total_candidatos: atendentes.length
      }
    });

    console.log(`[ROTEAMENTO] ✅ Distribuído para ${melhorAtendente.atendente.full_name} (score: ${melhorAtendente.score})`);

    return Response.json({
      success: true,
      message: 'Thread atribuída com sucesso',
      assigned_to: melhorAtendente.atendente.id,
      assigned_to_name: melhorAtendente.atendente.full_name,
      score: melhorAtendente.score,
      reason: origem,
      stats: {
        carga_atual: melhorAtendente.cargaAtual + 1,
        capacidade_max: melhorAtendente.capacidadeMax,
        utilizacao_percentual: ((melhorAtendente.cargaAtual + 1) / melhorAtendente.capacidadeMax * 100).toFixed(1)
      }
    });

  } catch (error) {
    console.error('[ROTEAMENTO] Erro ao distribuir por carga:', error);
    return Response.json({ 
      success: false,
      error: 'Erro ao distribuir conversa',
      details: error.message 
    }, { status: 500 });
  }
}