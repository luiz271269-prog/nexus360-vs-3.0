import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * acionarAutomacoesPorPlaybook
 * 
 * Dispara automações baseadas no playbook do ContactBehaviorAnalysis
 * Chamada automaticamente por trigger na função analisarComportamentoContato
 * 
 * C) Automações baseadas em playbook (triggers)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contact_id, analysis_id } = await req.json();

    if (!contact_id || !analysis_id) {
      return Response.json({ error: 'Missing contact_id or analysis_id' }, { status: 400 });
    }

    console.log('[acionarAutomacoesPorPlaybook] Iniciando para contact:', contact_id);

    // Buscar análise completa
    const analises = await base44.entities.ContactBehaviorAnalysis.filter(
      { id: analysis_id },
      null,
      1
    );

    if (!analises.length) {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const analise = analises[0];
    const playbook = analise.playbook || {};
    const contact = await base44.entities.Contact.filter({ id: contact_id }, null, 1);

    if (!contact.length) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contactData = contact[0];
    const acionadas = [];
    const erros = [];

    // ═══════════════════════════════════════════════════════════════
    // REGRA 1: when_to_decline → Adicionar à WorkQueue com severity:LOW
    // ═══════════════════════════════════════════════════════════════
    if (playbook.when_to_decline && playbook.when_to_decline.length > 0) {
      try {
        // Verificar se há uma rule que se aplica
        const shouldDecline = avaliarPlaybookRule(contactData, playbook.when_to_decline);

        if (shouldDecline) {
          console.log('[acionarAutomacoesPorPlaybook] ✅ DECLINE: contato deve entrar em LOW priority queue');

          // Criar WorkQueueItem para revisar se vale investir esforço
          await base44.entities.WorkQueueItem.create({
            tipo: 'avaliar_potencial',
            contact_id: contact_id,
            thread_id: '', // será preenchido se encontrar thread
            reason: 'playbook_when_to_decline',
            severity: 'low',
            status: 'agendado',
            scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
            payload: {
              playbook_rules_matched: playbook.when_to_decline,
              analysis_id: analysis_id,
              action: 'revisar_se_continuar_cotando'
            },
            notes: `Playbook V2: este contato tem baixa probabilidade de conversão. Revisar critérios antes de investir esforço.`
          });

          acionadas.push('WorkQueueItem:when_to_decline');
        }
      } catch (error) {
        console.warn('[acionarAutomacoesPorPlaybook] Erro ao processar DECLINE:', error);
        erros.push(`DECLINE: ${error.message}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGRA 2: when_to_compete → Marcar thread como "PRIORITÁRIO"
    // ═══════════════════════════════════════════════════════════════
    if (playbook.when_to_compete && playbook.when_to_compete.length > 0) {
      try {
        const shouldCompete = avaliarPlaybookRule(contactData, playbook.when_to_compete);

        if (shouldCompete) {
          console.log('[acionarAutomacoesPorPlaybook] ✅ COMPETE: contato é oportunidade real');

          // Buscar thread canônica
          const threads = await base44.entities.MessageThread.filter(
            { contact_id: contact_id, is_canonical: true },
            null,
            1
          );

          if (threads.length > 0) {
            const thread = threads[0];

            // Marcar como prioritário nos campos_personalizados
            await base44.entities.MessageThread.update(thread.id, {
              campos_personalizados: {
                ...thread.campos_personalizados,
                playbook_status: 'compete',
                playbook_matched_rules: playbook.when_to_compete.join('; '),
                last_playbook_check: new Date().toISOString()
              }
            });

            acionadas.push('MessageThread:when_to_compete');
          }
        }
      } catch (error) {
        console.warn('[acionarAutomacoesPorPlaybook] Erro ao processar COMPETE:', error);
        erros.push(`COMPETE: ${error.message}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGRA 3: relationship_risk HIGH/CRITICAL → Alerta + Follow-up
    // ═══════════════════════════════════════════════════════════════
    if (analise.relationship_risk && ['high', 'critical'].includes(analise.relationship_risk.level)) {
      try {
        console.log('[acionarAutomacoesPorPlaybook] ⚠️ HIGH RISK: criar tarefa de reativo');

        // Buscar thread
        const threads = await base44.entities.MessageThread.filter(
          { contact_id: contact_id, is_canonical: true },
          null,
          1
        );

        if (threads.length > 0) {
          const thread = threads[0];

          // Criar WorkQueueItem para reativação
          await base44.entities.WorkQueueItem.create({
            tipo: 'reativacao',
            contact_id: contact_id,
            thread_id: thread.id,
            reason: `relationship_risk_${analise.relationship_risk.level}`,
            severity: analise.relationship_risk.level === 'critical' ? 'critical' : 'high',
            status: 'agendado',
            scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
            payload: {
              risk_events: analise.relationship_risk.events,
              playbook_goal: playbook.goal,
              suggested_action: analise.next_best_action?.suggested_message
            },
            notes: `Risco relacional ${analise.relationship_risk.level}: execute playbook de reativação`
          });

          acionadas.push('WorkQueueItem:relationship_risk');
        }
      } catch (error) {
        console.warn('[acionarAutomacoesPorPlaybook] Erro ao processar RISK:', error);
        erros.push(`RISK: ${error.message}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // REGRA 4: deal_risk > 70 + engagement < 40 → Auto-decline cotação genérica
    // ═══════════════════════════════════════════════════════════════
    if (analise.scores?.deal_risk > 70 && analise.scores?.engagement < 40) {
      try {
        console.log('[acionarAutomacoesPorPlaybook] 🚫 AUTO-DECLINE: risco alto + baixo engajamento');

        // Tag no Contact para futuros filtros
        const tags = contactData.tags || [];
        if (!tags.includes('auto_decline_generic_quotes')) {
          tags.push('auto_decline_generic_quotes');

          await base44.entities.Contact.update(contact_id, { tags });
          acionadas.push('Contact:tag_auto_decline');
        }
      } catch (error) {
        console.warn('[acionarAutomacoesPorPlaybook] Erro ao tagear AUTO-DECLINE:', error);
        erros.push(`TAG: ${error.message}`);
      }
    }

    console.log('[acionarAutomacoesPorPlaybook] ✅ Automações acionadas:', acionadas);

    return Response.json({
      success: true,
      contact_id,
      analysis_id,
      automacoes_acionadas: acionadas,
      erros: erros.length > 0 ? erros : null
    });
  } catch (error) {
    console.error('[acionarAutomacoesPorPlaybook] Erro crítico:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Avalia se uma regra do playbook se aplica ao contato
 * Usa campos em cache no Contact para decisão rápida
 */
function avaliarPlaybookRule(contact, rules) {
  if (!rules || rules.length === 0) return false;

  const personalizados = contact.campos_personalizados || {};
  const dealRisk = personalizados.deal_risk_cached || 0;
  const engagement = personalizados.engagement_cached || 0;

  // Lógica simples: se a regra menciona "preço" e deal_risk > 70 → true
  // Expandir conforme necessário
  return rules.some((rule) => {
    if (rule.includes('preço') || rule.includes('benchmark')) {
      return dealRisk > 70;
    }
    if (rule.includes('volume') || rule.includes('genérica')) {
      return engagement < 40;
    }
    return false;
  });
}