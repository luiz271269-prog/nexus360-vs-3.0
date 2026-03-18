import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DECISOR DE PRÉ-ATENDIMENTO                                  ║
 * ║  Determina SE e QUANDO ativar o pré-atendimento             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export async function deveAtivarPreAtendimento(base44, contact, thread) {
  console.log('[PRE-ATENDIMENTO] Verificando se deve ativar para:', {
    contact_id: contact.id,
    thread_id: thread.id,
    thread_status: thread.status,
    assigned: thread.assigned_user_id
  });

  // ═══════════════════════════════════════════════════════════
  // REGRA 1: Contato bloqueado → NÃO ativar
  // ═══════════════════════════════════════════════════════════
  if (contact.bloqueado) {
    console.log('[PRE-ATENDIMENTO] ❌ Contato bloqueado, ignorando');
    return {
      ativar: false,
      motivo: 'contato_bloqueado'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA 2: Conversa JÁ tem atendente → NÃO ativar
  // ═══════════════════════════════════════════════════════════
  if (thread.assigned_user_id) {
    console.log('[PRE-ATENDIMENTO] ❌ Conversa já atribuída a:', thread.assigned_user_name);
    return {
      ativar: false,
      motivo: 'ja_atribuida',
      atendente: thread.assigned_user_name
    };
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA 3: Pré-atendimento JÁ ativo nesta thread → Continuar
  // ═══════════════════════════════════════════════════════════
  if (thread.pre_atendimento_ativo) {
    console.log('[PRE-ATENDIMENTO] ✅ Pré-atendimento já ativo, continuando fluxo');
    return {
      ativar: true,
      continuar: true,
      motivo: 'ja_ativo',
      estado_atual: thread.pre_atendimento_state
    };
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA 4: Cliente VIP/Fidelizado em VENDAS → Rotear direto
  // ═══════════════════════════════════════════════════════════
  if (contact.atendente_fidelizado_vendas) {
    console.log('[PRE-ATENDIMENTO] ⚡ Cliente VIP, roteando direto para:', contact.atendente_fidelizado_vendas);
    return {
      ativar: false,
      rotear_direto: true,
      motivo: 'cliente_vip_vendas',
      atendente_id: contact.atendente_fidelizado_vendas,
      setor: 'vendas'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA 5: Thread RESOLVIDA ou ARQUIVADA e nova mensagem → REATIVAR
  // ═══════════════════════════════════════════════════════════
  if (thread.status === 'resolvida' || thread.status === 'arquivada') {
    console.log('[WEBHOOK] 🔄 Thread resolvida/arquivada recebendo nova mensagem, reativando');
    
    // Reabrir thread
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      status: 'aberta',
      assigned_user_id: null,
      assigned_user_name: null
    });
    
    return {
      ativar: true,
      motivo: 'thread_reaberta',
      primeira_vez: false
    };
  }

  // ═══════════════════════════════════════════════════════════
  // REGRA 6: Thread NOVA (sem assigned, sem pre_atendimento) → ATIVAR
  // ═══════════════════════════════════════════════════════════
  console.log('[PRE-ATENDIMENTO] ✅ Thread nova, ativando pré-atendimento');
  return {
    ativar: true,
    motivo: 'thread_nova',
    primeira_vez: true
  };
}

/**
 * Executar ação baseada na decisão
 */
export async function executarDecisao(base44, decisao, thread, contact) {
  // Se não deve ativar, retornar
  if (!decisao.ativar && !decisao.rotear_direto) {
    return {
      success: true,
      action: 'nenhuma',
      motivo: decisao.motivo
    };
  }

  // Se deve rotear direto para VIP
  if (decisao.rotear_direto) {
    console.log('[PRE-ATENDIMENTO] Chamando roteamento direto para VIP');
    
    try {
      const response = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
        thread_id: thread.id,
        contact_id: contact.id,
        sector: decisao.setor,
        force_attendant_id: decisao.atendente_id
      });

      return {
        success: true,
        action: 'roteado_vip',
        details: response.data
      };
    } catch (error) {
      console.error('[PRE-ATENDIMENTO] Erro ao rotear VIP:', error);
      // Fallback: ativar pré-atendimento normal
      decisao.ativar = true;
    }
  }

  // Se deve ativar pré-atendimento
  if (decisao.ativar) {
    if (decisao.continuar) {
      // Já está ativo, apenas continuar
      return {
        success: true,
        action: 'continuar_fluxo',
        estado: decisao.estado_atual
      };
    } else {
      // Iniciar novo fluxo
      console.log('[PRE-ATENDIMENTO] Iniciando novo fluxo de pré-atendimento');
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_ativo: true,
        pre_atendimento_state: 'INIT',
        pre_atendimento_started_at: new Date().toISOString(),
        pre_atendimento_timeout_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min
      });

      // Chamar handler para enviar mensagem inicial
      const response = await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id: thread.id,
        contact_id: contact.id,
        action: 'init'
      });

      return {
        success: true,
        action: 'iniciado',
        response: response.data
      };
    }
  }
}