import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * acionarAutomacoesPorPlaybook
 * 
 * Dispara automações baseadas no playbook do ContactBehaviorAnalysis
 * Chamada automaticamente por trigger na função analisarComportamentoContato
 * 
 * C) Automações baseadas em playbook (triggers)
 */
/**
 * CHAMAR AUTOMAÇÕES + GERAR HOOK CRIATIVO
 * 
 * Fluxo:
 * 1. analisarComportamentoContato termina
 * 2. acionarAutomacoesPorPlaybook é chamada
 * 3. Avalia playbook + gera hook criativo
 * 4. Cria WorkQueueItems com sugestão de mensagem com hook
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // ✅ FIX CRÍTICO: Usar asServiceRole — esta função é chamada pelo sistema
    // (via analisarComportamentoContato) sem usuário logado. auth.me() sempre falhava.

    const { contact_id, analysis_id } = await req.json();

    if (!contact_id || !analysis_id) {
      return Response.json({ error: 'Missing contact_id or analysis_id' }, { status: 400 });
    }

    console.log('[acionarAutomacoesPorPlaybook] Iniciando para contact:', contact_id);

    // Buscar análise completa
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
      { id: analysis_id },
      null,
      1
    );

    if (!analises.length) {
      return Response.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const analise = analises[0];
    const playbook = analise.playbook || {};
    const contact = await base44.asServiceRole.entities.Contact.filter({ id: contact_id }, null, 1);

    if (!contact.length) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contactData = contact[0];
    const acionadas = [];
    const erros = [];

    // ✅ Selecionar hook criativo baseado em análise
    const hookMotor = await gerarHookParaContato(analise, contactData);
    
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
          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'avaliar_potencial',
            contact_id: contact_id,
            thread_id: '', 
            reason: 'playbook_when_to_decline',
            severity: 'low',
            status: 'agendado',
            scheduled_for: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            payload: {
              playbook_rules_matched: playbook.when_to_decline,
              analysis_id: analysis_id,
              action: 'revisar_se_continuar_cotando',
              hook_criativo: hookMotor // ✅ Adicionar hook mesmo em decline
            },
            notes: `Playbook V2: baixa probabilidade. Hook sugerido se decidir engajar: ${hookMotor?.sugestao || 'N/A'}`
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

            // Marcar como prioritário + adicionar hook sugerido
            await base44.entities.MessageThread.update(thread.id, {
              campos_personalizados: {
                ...(thread.campos_personalizados || {}),
                playbook_status: 'compete',
                playbook_matched_rules: playbook.when_to_compete.join('; '),
                hook_criativo_sugerido: hookMotor?.sugestao, // ✅ Hook pronto para usar
                hook_tipo: hookMotor?.tipo,
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

          // Criar WorkQueueItem para reativação com hook criativo
          await base44.entities.WorkQueueItem.create({
            tipo: 'reativacao',
            contact_id: contact_id,
            thread_id: thread.id,
            reason: `relationship_risk_${analise.relationship_risk.level}`,
            severity: analise.relationship_risk.level === 'critical' ? 'critical' : 'high',
            status: 'agendado',
            scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            payload: {
              risk_events: analise.relationship_risk.events,
              playbook_goal: playbook.goal,
              suggested_action: analise.next_best_action?.suggested_message,
              hook_criativo: hookMotor // ✅ Hook de reativação personalizado
            },
            notes: `URGENTE - Risco ${analise.relationship_risk.level}: ${hookMotor?.sugestao || 'Restaurar confiança'}`
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
 */
function avaliarPlaybookRule(contact, rules) {
  if (!rules || rules.length === 0) return false;

  const personalizados = contact.campos_personalizados || {};
  const dealRisk = personalizados.deal_risk_cached || 0;
  const engagement = personalizados.engagement_cached || 0;

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

/**
 * ✅ Gera hook criativo INDEPENDENTE do conteúdo
 * Input: análise completa (scores, profile, risk)
 * Output: { tipo, sugestao, principles }
 */
async function gerarHookParaContato(analise, contactData) {
  try {
    // Regra 1: Risco relacional alto → Personalização extrema
    if (['high', 'critical'].includes(analise.relationship_risk?.level)) {
      return {
        tipo: 'personalizacao_extrema',
        sugestao: `Você mencionou que {tema}... achei uma solução específica pra isso. Pode ser interessante?`,
        principles: ['atenção', 'respeito', 'reconhecimento']
      };
    }

    // Regra 2: Price sensitive + processo formal → Contraste
    if (
      analise.relationship_profile?.flags?.includes('price_sensitive') &&
      analise.relationship_profile?.flags?.includes('process_formal')
    ) {
      return {
        tipo: 'contraste_provocacao',
        sugestao: `Aviso: você provavelmente está pagando a mais nessa categoria. Quer conferir se é verdade?`,
        principles: ['contraste', 'reatividade']
      };
    }

    // Regra 3: Lead frio → Autoridade + prova social
    if (analise.scores?.deal_risk < 50 && analise.scores?.engagement < 40) {
      return {
        tipo: 'autoridade_prova_social',
        sugestao: `3-5 empresas no seu ramo já fazem isso conosco. Quer saber como conseguiram?`,
        principles: ['autoridade', 'prova_social']
      };
    }

    // Regra 4: Cliente fidelizado mas travado → Reciprocidade
    if (
      analise.relationship_profile?.type === 'cliente_fidelizado' &&
      analise.stage?.current === 'negociacao_stalled'
    ) {
      return {
        tipo: 'reciprocidade_valor',
        sugestao: `Fiz uma análise do seu histórico de compras conosco. Dá pra economizar ~15% mudando a frequência. Te envio o detalhe?`,
        principles: ['reciprocidade', 'credibilidade']
      };
    }

    // Padrão: Curiosidade + Escassez (funciona em qualquer contexto)
    return {
      tipo: 'curiosidade_scarcity',
      sugestao: `⏰ Achei algo que você pediu há pouco... mas só conseguimos 2 unidades por esse preço. Vale a pena a gente conversar agora?`,
      principles: ['curiosidade', 'urgência', 'escassez']
    };
  } catch (error) {
    console.warn('[gerarHook] Erro ao gerar hook:', error);
    // Fallback
    return {
      tipo: 'default',
      sugestao: 'Oi! Gostaria de conversar sobre uma oportunidade?',
      principles: []
    };
  }
}