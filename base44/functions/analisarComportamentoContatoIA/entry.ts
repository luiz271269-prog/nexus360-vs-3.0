import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Analisa comportamento do contato em período de tempo.
 * 
 * Input: contactId, period (dias)
 * Output: Análise IA com sentimento, churn risk, satisfação, próximos passos
 * 
 * 🔴 IMPORTANTE: Esta função NÃO atualiza last_attention_given_at.
 * A atenção do operador é responsabilidade do CRM/UI, não da IA.
 * Esta função apenas analisa e salva em ContactBehaviorAnalysis.
 */

const NEXUS_CONFIG = {
  IA_MENSAGENS_ANALISAR: 50,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId, period = 30 } = await req.json();

    if (!contactId) {
      return Response.json(
        { error: 'contactId é obrigatório' },
        { status: 400 }
      );
    }

    // ─── Buscar contato ─────────────────────────────────────────────
    const contact = await base44.entities.Contact.get(contactId);
    if (!contact) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // ─── Buscar últimas N mensagens ──────────────────────────────────
    const thread = await base44.entities.MessageThread.filter(
      { contact_id: contactId, is_canonical: true },
      '-last_message_at',
      1
    );

    const messages = thread?.length > 0
      ? await base44.entities.Message.filter(
          { thread_id: thread[0].id },
          '-sent_at',
          NEXUS_CONFIG.IA_MENSAGENS_ANALISAR
        )
      : [];

    // ─── Buscar etiquetas aplicadas ──────────────────────────────────
    const tags = contact.tags || [];
    const etiquetas = tags.length > 0
      ? await base44.entities.EtiquetaContato.filter({
          nome: { $in: tags },
        })
      : [];

    // ─── Montar contexto para a IA ───────────────────────────────────
    const messagesText = messages
      .map(
        (m) =>
          `[${m.sender_type === 'user' ? 'Operador' : 'Cliente'}] ${new Date(m.sent_at).toLocaleString('pt-BR')}: ${m.content}`
      )
      .join('\n');

    const tagsText = etiquetas
      .map(
        (t) => `${t.label} (${t.categoria}): peso=${t.peso_qualificacao}, ABC=${t.categoria_abc}`
      )
      .join('\n');

    // ─── Prompt para a IA ───────────────────────────────────────────
    const prompt = `
Você é um especialista em análise de comportamento de clientes.
Analise este contato nos últimos ${period} dias.

INFORMAÇÕES DO CONTATO:
- Nome: ${contact.nome}
- Empresa: ${contact.empresa || 'Não informada'}
- Tipo: ${contact.tipo_contato}
- Telefone: ${contact.telefone}

ETIQUETAS APLICADAS:
${tagsText || 'Nenhuma'}

ÚLTIMAS MENSAGENS (${messages.length} mensagens):
${messagesText || 'Nenhuma mensagem neste período'}

ANÁLISE OBRIGATÓRIA:
1. Resumo executivo das conversas
2. Sentimento geral (0-100: 0=muito negativo, 100=muito positivo)
3. Tópicos principais identificados
4. Coerência entre etiquetas aplicadas e conteúdo das mensagens
5. Risco de churn (nível + score 0-100 + motivo)
6. Score de satisfação (0-100)
7. Qualidade de engajamento (baixa/média/alta)
8. Próximos passos recomendados
9. Ações prioritárias

Retorne um JSON estruturado com exatamente esta forma:
{
  "summary_insights": "string",
  "sentiment_score": number (0-100),
  "topicos_principais": ["string", ...],
  "analise_etiquetas": {
    "coerente": boolean,
    "observacao": "string"
  },
  "risco_churn": {
    "nivel": "baixo|medio|alto|critico",
    "score": number (0-100),
    "motivo": "string"
  },
  "score_satisfacao": number (0-100),
  "engagement_quality": "baixa|media|alta",
  "next_action_suggestion": "string",
  "proximos_passos": ["string", ...]
}
`;

    // ─── Chamar a IA ────────────────────────────────────────────────
    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary_insights: { type: 'string' },
          sentiment_score: { type: 'number' },
          topicos_principais: { type: 'array', items: { type: 'string' } },
          analise_etiquetas: {
            type: 'object',
            properties: {
              coerente: { type: 'boolean' },
              observacao: { type: 'string' },
            },
          },
          risco_churn: {
            type: 'object',
            properties: {
              nivel: { type: 'string' },
              score: { type: 'number' },
              motivo: { type: 'string' },
            },
          },
          score_satisfacao: { type: 'number' },
          engagement_quality: { type: 'string' },
          next_action_suggestion: { type: 'string' },
          proximos_passos: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    // ─── Salvar análise em ContactBehaviorAnalysis ──────────────────
    const analiseExistente = await base44.entities.ContactBehaviorAnalysis.filter(
      { contact_id: contactId },
      '-analyzed_at',
      1
    );

    const analiseData = {
      contact_id: contactId,
      analyzed_at: new Date().toISOString(),
      period_days: period,
      summary_insights: response.summary_insights,
      sentiment_score: response.sentiment_score,
      score_satisfacao: response.score_satisfacao,
      engagement_quality: response.engagement_quality,
      risco_churn: response.risco_churn,
      topicos_principais: response.topicos_principais,
      analise_etiquetas: response.analise_etiquetas,
      next_action_suggestion: response.next_action_suggestion,
      proximos_passos: response.proximos_passos,
    };

    let savedAnalysis;
    if (analiseExistente?.length > 0) {
      // Atualizar análise existente
      await base44.entities.ContactBehaviorAnalysis.update(
        analiseExistente[0].id,
        analiseData
      );
      savedAnalysis = { ...analiseExistente[0], ...analiseData };
    } else {
      // Criar nova análise
      savedAnalysis = await base44.entities.ContactBehaviorAnalysis.create(
        analiseData
      );
    }

    // ✅ CRÍTICO: Disparar automações baseadas em playbook
    try {
      await base44.asServiceRole.functions.invoke('acionarAutomacoesPorPlaybook', {
        contact_id: contactId,
        analysis_id: savedAnalysis.id
      });
      console.log('[analisarComportamentoIA] ✅ Playbook automations triggered');
    } catch (playbookError) {
      console.warn('[analisarComportamentoIA] ⚠️ Playbook trigger failed:', playbookError.message);
      // Non-blocking — análise já foi salva
    }

    return Response.json({
      success: true,
      analysis: savedAnalysis,
      messages_analyzed: messages.length,
      tags_count: tags.length,
    });
  } catch (error) {
    console.error('[analisarComportamentoContatoIA] Erro:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});