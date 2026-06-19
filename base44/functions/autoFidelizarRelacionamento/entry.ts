// ============================================================================
// AUTO-FIDELIZAÇÃO POR RELACIONAMENTO (GIA — guarda leve)
// Roda no recebimento de mensagem. Investiga a base SÓ quando o contato é
// "órfão de identidade" (novo/lead, sem fidelização, sem cliente_id) e fora
// do cooldown. Caso contrário, sai sem custo.
//
// Critério de fidelização:
//   - thread.assigned_user_id definido
//   - esse atendente tem >= MIN_MSGS_HUMANAS mensagens humanas na thread
//   => grava atendente_fidelizado_vendas, is_cliente_fidelizado=true
//      e promove tipo_contato lead/novo -> cliente
//
// Aciona vincularClienteAutomatico (fire-and-forget) para tentar casar CRM.
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const VERSION = 'v1.0.0';
const MIN_MSGS_HUMANAS = 5;
const COOLDOWN_HORAS = 24;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!base44.asServiceRole) {
      return Response.json({ success: false, error: 'service_role_indisponivel' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    // ── Resolver o thread_id a partir do payload (automação de entidade OU chamada direta)
    const data = body?.data || {};
    const threadId = body?.thread_id || data?.thread_id || null;
    const senderType = body?.sender_type || data?.sender_type || null;

    // Camada 0 (custo zero): só mensagem recebida do contato
    if (senderType && senderType !== 'contact') {
      return Response.json({ success: true, skipped: 'nao_inbound' });
    }
    if (!threadId) {
      return Response.json({ success: true, skipped: 'sem_thread_id' });
    }

    // ── 1 leitura: thread
    const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    if (!thread) return Response.json({ success: true, skipped: 'thread_inexistente' });

    // Só threads externas de contato
    if (thread.thread_type && thread.thread_type !== 'contact_external') {
      return Response.json({ success: true, skipped: 'thread_interna' });
    }
    const contactId = thread.contact_id;
    if (!contactId) return Response.json({ success: true, skipped: 'thread_sem_contato' });

    // ── 1 leitura: contato
    const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contato) return Response.json({ success: true, skipped: 'contato_inexistente' });

    // Camada 1 (elegibilidade — usa só campos já lidos):
    // Só investiga contato "órfão de identidade".
    const tipo = contato.tipo_contato || 'novo';
    const ehOrfao =
      (tipo === 'novo' || tipo === 'lead') &&
      !contato.atendente_fidelizado_vendas &&
      !contato.cliente_id;

    if (!ehOrfao) {
      return Response.json({ success: true, skipped: 'ja_classificado_ou_fidelizado' });
    }

    // Camada 2 (cooldown — campo no próprio contato):
    const ultimaAnalise = contato.campos_personalizados?.ultima_analise_fidelizacao;
    if (ultimaAnalise) {
      const horas = (Date.now() - new Date(ultimaAnalise).getTime()) / 36e5;
      if (horas < COOLDOWN_HORAS) {
        return Response.json({ success: true, skipped: 'cooldown', horas_desde: Math.round(horas) });
      }
    }

    // ── Investigação cara (só quem passou as 3 camadas)
    const assignedUserId = thread.assigned_user_id;

    // Carimba o cooldown desde já (mesmo que não fidelize, evita reanálise por 24h)
    const carimbo = {
      campos_personalizados: {
        ...(contato.campos_personalizados || {}),
        ultima_analise_fidelizacao: new Date().toISOString()
      }
    };

    if (!assignedUserId) {
      await base44.asServiceRole.entities.Contact.update(contactId, carimbo);
      return Response.json({ success: true, analisado: true, fidelizado: false, motivo: 'thread_sem_atendente' });
    }

    // Conta mensagens humanas desse atendente na thread
    const msgsAtendente = await base44.asServiceRole.entities.Message.filter(
      { thread_id: threadId, sender_type: 'user', sender_id: assignedUserId },
      '-created_date',
      50
    ).catch(() => []);

    if (msgsAtendente.length < MIN_MSGS_HUMANAS) {
      await base44.asServiceRole.entities.Contact.update(contactId, carimbo);
      return Response.json({
        success: true, analisado: true, fidelizado: false,
        motivo: 'poucas_mensagens', total: msgsAtendente.length, minimo: MIN_MSGS_HUMANAS
      });
    }

    // ── Fideliza: grava atendente, marca fidelizado e promove para cliente
    await base44.asServiceRole.entities.Contact.update(contactId, {
      ...carimbo,
      atendente_fidelizado_vendas: assignedUserId,
      is_cliente_fidelizado: true,
      tipo_contato: 'cliente'
    });

    // Tenta casar com Cliente do CRM (fire-and-forget — não bloqueia)
    if (!contato.cliente_id) {
      base44.asServiceRole.functions
        .invoke('vincularClienteAutomatico', { contact_id: contactId })
        .catch((e) => console.warn(`[${VERSION}] vínculo CRM falhou (não-crítico):`, e.message));
    }

    console.log(`[${VERSION}] ✅ Fidelizado contato ${contactId} ao atendente ${assignedUserId} (${msgsAtendente.length} msgs)`);

    return Response.json({
      success: true, analisado: true, fidelizado: true,
      contact_id: contactId, atendente: assignedUserId, mensagens: msgsAtendente.length
    });

  } catch (error) {
    console.error(`[${VERSION}] ❌ Erro:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});