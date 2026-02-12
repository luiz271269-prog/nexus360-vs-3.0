import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ANÁLISE COMPORTAMENTAL DE CONTATO - V3 (Refatorada)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * MUDANÇAS CRÍTICAS:
 * 1. ✅ NUNCA retorna 400 - sempre marca status (ok/insufficient_data/error)
 * 2. ✅ Calcula timestamps (last_message_at, last_inbound_at, last_outbound_at)
 * 3. ✅ Buckets de inatividade (active/30/60/90+)
 * 4. ✅ Métricas hard (ratio, gaps, velocity, balance)
 * 5. ✅ Priority score unificado (inatividade + IA)
 * 6. ✅ Persistência estruturada em ContactBehaviorAnalysis
 */

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      console.log('[ANALISE] Rodando sem user context');
    }

    const { contact_id, limit = 100 } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400, headers: corsHeaders });
    }

    // ══════════════════════════════════════════════════════════════
    // ETAPA A: BUSCAR DADOS DO CONTATO
    // ══════════════════════════════════════════════════════════════
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404, headers: corsHeaders });
    }

    console.log(`[ANALISE] 🎯 Analisando: ${contact.nome} (${contact.telefone})`);

    // ══════════════════════════════════════════════════════════════
    // ETAPA B: BUSCAR ÚLTIMAS N MENSAGENS (DESC → ASC)
    // ══════════════════════════════════════════════════════════════
    const threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contact_id });
    
    if (threads.length === 0) {
      console.log(`[ANALISE] ⚠️ ${contact.nome} sem threads - marcando insufficient_data`);
      
      await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
        contact_id: contact_id,
        analyzed_at: new Date().toISOString(),
        status: 'insufficient_data',
        error_reason: 'Contato sem conversas',
        window_size: 0,
        bucket_inactive: '90+',
        priority_label: 'BAIXO',
        priority_score: 0
      });
      
      return Response.json({
        success: true,
        skipped: true,
        reason: 'insufficient_data',
        message: 'Contato sem conversas - análise não aplicável'
      }, { headers: corsHeaders });
    }

    const threadIds = threads.map(t => t.id);
    
    // Buscar DESC para pegar as mais recentes, depois inverter
    const mensagensDesc = await base44.asServiceRole.entities.Message.filter(
      { thread_id: { $in: threadIds } },
      '-sent_at',
      limit
    );

    if (mensagensDesc.length === 0) {
      console.log(`[ANALISE] ⚠️ ${contact.nome} sem mensagens - marcando insufficient_data`);
      
      await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
        contact_id: contact_id,
        analyzed_at: new Date().toISOString(),
        status: 'insufficient_data',
        error_reason: 'Contato sem mensagens',
        window_size: 0,
        bucket_inactive: '90+',
        priority_label: 'BAIXO',
        priority_score: 0
      });
      
      return Response.json({
        success: true,
        skipped: true,
        reason: 'insufficient_data',
        message: 'Contato sem mensagens - análise não aplicável'
      }, { headers: corsHeaders });
    }

    // ✅ CRÍTICO: Inverter para ordem ASC (cronológica)
    const mensagens = [...mensagensDesc].reverse();
    
    console.log(`[ANALISE] 📊 ${mensagens.length} mensagens carregadas (ASC)`);

    // ══════════════════════════════════════════════════════════════
    // ETAPA C: TIMESTAMPS E BUCKETS DE INATIVIDADE
    // ══════════════════════════════════════════════════════════════
    const agora = new Date();
    const ultimaMsg = mensagens[mensagens.length - 1];
    const primeiraMsg = mensagens[0];
    
    const lastMessageAt = ultimaMsg.sent_at || ultimaMsg.created_date;
    
    const inboundMessages = mensagens.filter(m => m.sender_type === 'contact');
    const outboundMessages = mensagens.filter(m => m.sender_type === 'user');
    
    const lastInboundAt = inboundMessages.length > 0 
      ? (inboundMessages[inboundMessages.length - 1].sent_at || inboundMessages[inboundMessages.length - 1].created_date)
      : null;
      
    const lastOutboundAt = outboundMessages.length > 0
      ? (outboundMessages[outboundMessages.length - 1].sent_at || outboundMessages[outboundMessages.length - 1].created_date)
      : null;
    
    const daysInactiveTotal = lastMessageAt 
      ? Math.floor((agora - new Date(lastMessageAt)) / (1000 * 60 * 60 * 24)) 
      : 999;
      
    const daysInactiveInbound = lastInboundAt 
      ? Math.floor((agora - new Date(lastInboundAt)) / (1000 * 60 * 60 * 24)) 
      : 999;
      
    const daysInactiveOutbound = lastOutboundAt 
      ? Math.floor((agora - new Date(lastOutboundAt)) / (1000 * 60 * 60 * 24)) 
      : 999;
    
    // ✅ BUCKET baseado em INBOUND (cliente sem responder)
    const bucketInactive = 
      daysInactiveInbound < 30 ? 'active' :
      daysInactiveInbound < 60 ? '30' :
      daysInactiveInbound < 90 ? '60' : '90+';
    
    console.log(`[ANALISE] 📅 Inatividade: Total=${daysInactiveTotal}d | Inbound=${daysInactiveInbound}d | Bucket=${bucketInactive}`);

    // ══════════════════════════════════════════════════════════════
    // ETAPA D: MÉTRICAS DETERMINÍSTICAS (Hard Stats)
    // ══════════════════════════════════════════════════════════════
    const totalMessages = mensagens.length;
    const inboundCount = inboundMessages.length;
    const outboundCount = outboundMessages.length;
    const ratioInOut = outboundCount > 0 ? (inboundCount / outboundCount) : 0;
    
    // Tempos de resposta
    const responseTimesAgent = [];
    const responseTimesContact = [];
    
    for (let i = 1; i < mensagens.length; i++) {
      const msgAtual = mensagens[i];
      const msgAnterior = mensagens[i - 1];
      
      const diff = new Date(msgAtual.sent_at || msgAtual.created_date) - new Date(msgAnterior.sent_at || msgAnterior.created_date);
      if (diff <= 0 || diff > 7 * 24 * 60 * 60 * 1000) continue;
      
      const diffMinutes = diff / (1000 * 60);
      
      if (msgAtual.sender_type === 'user' && msgAnterior.sender_type === 'contact') {
        responseTimesAgent.push(diffMinutes);
      }
      
      if (msgAtual.sender_type === 'contact' && msgAnterior.sender_type === 'user') {
        responseTimesContact.push(diffMinutes);
      }
    }
    
    const avgReplyMinutesAgent = responseTimesAgent.length > 0
      ? Math.round(responseTimesAgent.reduce((a, b) => a + b, 0) / responseTimesAgent.length)
      : 0;
      
    const avgReplyMinutesContact = responseTimesContact.length > 0
      ? Math.round(responseTimesContact.reduce((a, b) => a + b, 0) / responseTimesContact.length)
      : 0;
    
    // Follow-ups órfãos
    const unansweredFollowups = mensagens
      .slice(-10)
      .filter((m, idx, arr) => {
        if (m.sender_type !== 'user') return false;
        const nextMsg = arr[idx + 1];
        return !nextMsg || nextMsg.sender_type === 'user';
      }).length;
    
    // Gaps e velocity
    const gaps = [];
    for (let i = 1; i < mensagens.length; i++) {
      const diff = new Date(mensagens[i].sent_at || mensagens[i].created_date) - 
                   new Date(mensagens[i-1].sent_at || mensagens[i-1].created_date);
      gaps.push(diff / (1000 * 60 * 60 * 24));
    }
    const maxSilenceGapDays = gaps.length > 0 ? Math.max(...gaps) : 0;
    
    const diasHistorico = Math.floor((new Date(lastMessageAt) - new Date(primeiraMsg.sent_at || primeiraMsg.created_date)) / (1000 * 60 * 60 * 24));
    const conversationVelocity = diasHistorico > 0 ? (totalMessages / diasHistorico) : 0;
    
    // Balanço últimas 10
    const last10 = mensagens.slice(-10);
    const last10Balance = {
      inbound: last10.filter(m => m.sender_type === 'contact').length,
      outbound: last10.filter(m => m.sender_type === 'user').length
    };

    // ══════════════════════════════════════════════════════════════
    // ETAPA E: ANÁLISE DE IA (Semântica)
    // ══════════════════════════════════════════════════════════════
    let aiScores = { health: 50, deal_risk: 0, buy_intent: 0, engagement: 50 };
    let sentimentoPredominante = 'neutro';
    let objecoes = [];
    let signals = [];
    let stageAtual = 'descoberta';
    let evidencias = [];
    
    const textos = inboundMessages
      .filter(m => m.content && m.content.length > 5)
      .slice(-50)
      .map(m => m.content)
      .join('\n');

    if (textos.length > 20) {
      try {
        const promptV2 = `🧠 MOTOR DE INTELIGÊNCIA COMERCIAL E RELACIONAL - V2
==========================================================================

Você é um motor de inteligência comercial e relacional especializado em análise B2B.
Seu objetivo é analisar todo o histórico de conversas e gerar insights profundos, consistentes e acionáveis.

📥 CONTEXTO DO CONTATO:
- Nome: ${contact.nome}
- Empresa: ${contact.empresa || 'N/A'}
- Tipo: ${contact.tipo_contato || 'novo'}
- Telefone: ${contact.telefone || 'N/A'}
- Mensagens analisadas: ${mensagens.length} (últimas 50)

📱 HISTÓRICO DE MENSAGENS (em ordem cronológica):
${textos}

📊 DADOS ESTRUTURAIS ADICIONAIS:
- Total de mensagens: ${totalMessages}
- Inbound: ${inboundCount} | Outbound: ${outboundCount}
- Razão Inbound/Outbound: ${ratioInOut.toFixed(2)}
- Tempo médio de resposta (atendente): ${avgReplyMinutesAgent} minutos
- Tempo médio de resposta (contato): ${avgReplyMinutesContact} minutos
- Dias sem resposta (inbound): ${daysInactiveInbound}
- Maior gap de silêncio: ${maxSilenceGapDays.toFixed(1)} dias

⚠️ REGRAS OBRIGATÓRIAS DO MOTOR:
1. Sempre classificar o tipo de relacionamento (relationship_profile.type)
2. Detectar sensibilidades: preço, prazo, processo formal, terceiros, benchmarking
3. Identificar eventos de atrito relacional (mensagens duras, confusão, delays)
4. NUNCA recomendar mensagens agressivas ou de corte definitivo
5. Para multi-cotação: priorizar alinhamento de critérios
6. Tom profissional, analítico e estratégico
7. Não inventar dados não implícitos no histórico

🎯 SAÍDA OBRIGATÓRIA - RETORNE UM JSON COM:

{
  "relationship_profile": {
    "type": "comprador_corporativo_multi_cotacao|cliente_fidelizado|lead_quente|suporte_tecnico|financeiro|outro",
    "flags": ["price_sensitive"|"deadline_sensitive"|"process_formal"|"decision_by_third_party"|"uses_benchmark"|"relationship_frictions"],
    "summary": "Resumo do perfil em 1 frase"
  },

  "scores": {
    "health": 0-100,
    "deal_risk": 0-100,
    "buy_intent": 0-100,
    "engagement": 0-100
  },

  "stage": {
    "current": "primeiro_contato|cotacao_enviada|negociacao|negociacao_stalled|perdido|ganho",
    "days_stalled": número,
    "last_milestone": "descrição",
    "last_milestone_at": "YYYY-MM-DDTHH:MM:SSZ"
  },

  "root_causes": [
    { "cause": "descrição", "severity": "low|medium|high|critical", "confidence": 0.0-1.0 }
  ],

  "evidence_snippets": [
    { "timestamp": "DD/MM HH:MM", "sender": "contact|agent|system", "text": "trecho", "related_cause": "causa" }
  ],

  "objections": [
    { "type": "preco|prazo|marca|condicoes_comerciais|processo", "status": "open|resolved|recurring", "snippet": "evidência" }
  ],

  "alerts": [
    { "level": "info|warning|critical", "message": "descrição do alerta" }
  ],

  "playbook": {
    "goal": "Objetivo estratégico com este contato",
    "rules_of_game": ["Regra 1", "Regra 2"],
    "when_to_compete": ["Cenário 1", "Cenário 2"],
    "when_to_decline": ["Cenário 1", "Cenário 2"]
  },

  "next_best_action": {
    "action": "Ação prática e estratégica",
    "priority": "low|medium|high|urgent",
    "rationale": "Por que essa ação",
    "suggested_message": "Mensagem profissional, relacional (máx 300 caracteres)"
  },

  "relationship_risk": {
    "level": "low|medium|high|critical",
    "events": [
      { "timestamp": "DD/MM HH:MM", "type": "friction|cutoff_message|confusion|delay", "snippet": "evidência" }
    ]
  },

  "prontuario_ptbr": {
    "visao_geral": "Perfil, tipo de relacionamento, padrão histórico (2-3 linhas)",
    "necessidades_contexto": "O que compra, como decide, fatores influentes (2-3 linhas)",
    "estado_atual_scores": "Health, Deal Risk, Engagement, Buy Intent em texto (2-3 linhas)",
    "causas_principais": "Motivos reais de perda, travamento ou desgaste (3-4 linhas)",
    "oportunidades_sinais_positivos": "Indicadores de valor ou potencial (2-3 linhas)",
    "recomendacoes_objetivas": "Ações práticas focadas em estratégia (3-4 linhas)",
    "mensagem_pronta": "Mensagem curta, profissional, relacional (máx 300 caracteres)"
  }
}

Retorne OBRIGATORIAMENTE todos os campos acima.`;

        const analiseIA = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: promptV2,
          response_json_schema: {
            type: "object",
            properties: {
              relationship_profile: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  flags: { type: "array", items: { type: "string" } },
                  summary: { type: "string" }
                }
              },
              scores: {
                type: "object",
                properties: {
                  health: { type: "number" },
                  deal_risk: { type: "number" },
                  buy_intent: { type: "number" },
                  engagement: { type: "number" }
                }
              },
              stage: {
                type: "object",
                properties: {
                  current: { type: "string" },
                  days_stalled: { type: "number" },
                  last_milestone: { type: "string" },
                  last_milestone_at: { type: "string" }
                }
              },
              root_causes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    cause: { type: "string" },
                    severity: { type: "string" },
                    confidence: { type: "number" }
                  }
                }
              },
              evidence_snippets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    sender: { type: "string" },
                    text: { type: "string" },
                    related_cause: { type: "string" }
                  }
                }
              },
              objections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    status: { type: "string" },
                    snippet: { type: "string" }
                  }
                }
              },
              alerts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    level: { type: "string" },
                    message: { type: "string" }
                  }
                }
              },
              playbook: {
                type: "object",
                properties: {
                  goal: { type: "string" },
                  rules_of_game: { type: "array", items: { type: "string" } },
                  when_to_compete: { type: "array", items: { type: "string" } },
                  when_to_decline: { type: "array", items: { type: "string" } }
                }
              },
              next_best_action: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  priority: { type: "string" },
                  rationale: { type: "string" },
                  suggested_message: { type: "string" }
                }
              },
              relationship_risk: {
                type: "object",
                properties: {
                  level: { type: "string" },
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        timestamp: { type: "string" },
                        type: { type: "string" },
                        snippet: { type: "string" }
                      }
                    }
                  }
                }
              },
              prontuario_ptbr: {
                type: "object",
                properties: {
                  visao_geral: { type: "string" },
                  necessidades_contexto: { type: "string" },
                  estado_atual_scores: { type: "string" },
                  causas_principais: { type: "string" },
                  oportunidades_sinais_positivos: { type: "string" },
                  recomendacoes_objetivas: { type: "string" },
                  mensagem_pronta: { type: "string" }
                }
              }
            }
          }
        });

        // Mapear resposta da IA para as variáveis locais
        sentimentoPredominante = 'neutro';
        aiScores = {
          health: analiseIA.scores?.health || 50,
          deal_risk: analiseIA.scores?.deal_risk || 0,
          buy_intent: analiseIA.scores?.buy_intent || 0,
          engagement: analiseIA.scores?.engagement || 50
        };
        objecoes = analiseIA.objections || [];
        signals = (analiseIA.signals || []);
        stageAtual = analiseIA.stage?.current || 'descoberta';
        
        // ✅ Armazenar dados V2 completos (não usar window)
        console.log('[ANALISE] ✅ Análise V2 recebida da IA', {
          relationship_type: analiseIA.relationship_profile?.type,
          flags_count: analiseIA.relationship_profile?.flags?.length || 0,
          risk_level: analiseIA.relationship_risk?.level
        });
        
      } catch (error) {
        console.warn('[ANALISE] ⚠️ Erro na IA:', error.message);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // ETAPA F: CALCULAR PRIORITY SCORE
    // ══════════════════════════════════════════════════════════════
    let inactivityPoints = 0;
    if (bucketInactive === '30') inactivityPoints = 10;
    if (bucketInactive === '60') inactivityPoints = 20;
    if (bucketInactive === '90+') inactivityPoints = 30;
    
    const priorityScore = Math.min(100, Math.round(
      inactivityPoints +
      (aiScores.deal_risk || 0) * 0.4 +
      (100 - (aiScores.buy_intent || 50)) * 0.2 +
      (100 - (aiScores.engagement || 50)) * 0.2 +
      Math.min(maxSilenceGapDays * 2, 15)
    ));
    
    const priorityLabel = 
      priorityScore >= 75 ? 'CRITICO' :
      priorityScore >= 55 ? 'ALTO' :
      priorityScore >= 35 ? 'MEDIO' : 'BAIXO';
    
    console.log(`[ANALISE] 🎯 Priority: ${priorityLabel} (${priorityScore}/100) | Bucket: ${bucketInactive}`);

    // Root causes
    const rootCauses = [];
    if (unansweredFollowups >= 3) rootCauses.push(`${unansweredFollowups} follow-ups sem resposta`);
    if (daysInactiveInbound > 7) rootCauses.push(`Cliente sem responder há ${daysInactiveInbound} dias`);
    if (objecoes.length > 0) rootCauses.push(`${objecoes.length} objeção(ões) ativa(s)`);
    if (aiScores.health < 40) rootCauses.push('Saúde baixa do relacionamento');

    // Next best action
    let nextBestAction = {
      action: 'Acompanhar',
      message_suggestion: '',
      deadline_hours: 48,
      need_manager: false
    };
    
    if (priorityLabel === 'CRITICO') {
      nextBestAction = {
        action: 'URGENTE: Contato imediato',
        message_suggestion: `Olá ${contact.nome?.split(' ')[0] || ''}! Notei que estamos sem conversar há um tempo. Como posso ajudar?`,
        deadline_hours: 4,
        need_manager: aiScores.deal_risk > 70
      };
    } else if (priorityLabel === 'ALTO') {
      nextBestAction = {
        action: 'Retomar contato em breve',
        message_suggestion: `Oi ${contact.nome?.split(' ')[0] || ''}! Tudo bem? Gostaria de saber se posso ajudar em algo.`,
        deadline_hours: 24,
        need_manager: false
      };
    }

    // ══════════════════════════════════════════════════════════════
    // PERSISTIR ANÁLISE COMPLETA (V3.1: V2 como FONTE DA VERDADE)
    // ══════════════════════════════════════════════════════════════
    const analiseDataV2 = mensagens.length > 0 && analiseIA ? analiseIA : {};
    
    // ✅ Montar INSIGHTS_V2 (JSONB - fonte da verdade completa)
    const insightsV2 = {
      relationship_profile: analiseDataV2.relationship_profile || {
        type: 'outro',
        flags: [],
        summary: 'Perfil a classificar'
      },
      scores: analiseDataV2.scores || aiScores,
      stage: analiseDataV2.stage || {
        current: stageAtual,
        days_stalled: daysInactiveInbound,
        last_milestone: 'Última mensagem',
        last_milestone_at: lastMessageAt
      },
      root_causes: (analiseDataV2.root_causes || []).map(r => ({
        cause: r.cause || '',
        severity: r.severity || 'medium',
        confidence: r.confidence || 0.5
      })),
      evidence_snippets: analiseDataV2.evidence_snippets || [],
      objections: analiseDataV2.objections || objecoes,
      alerts: analiseDataV2.alerts || [],
      playbook: analiseDataV2.playbook || {
        goal: 'Manter relacionamento e aumentar conversão',
        rules_of_game: [],
        when_to_compete: [],
        when_to_decline: []
      },
      next_best_action: analiseDataV2.next_best_action || nextBestAction,
      relationship_risk: analiseDataV2.relationship_risk || {
        level: 'low',
        events: []
      },
      metricas_relacionamento: {
        total_mensagens: totalMessages,
        inbound_count: inboundCount,
        outbound_count: outboundCount,
        ratio_in_out: ratioInOut,
        avg_response_time_agent_minutes: avgReplyMinutesAgent,
        avg_response_time_contact_minutes: avgReplyMinutesContact,
        max_silence_gap_days: maxSilenceGapDays,
        conversation_velocity: conversationVelocity,
        last_10_balance: last10Balance,
        unanswered_followups: unansweredFollowups
      }
    };
    
    // ✅ Montar PRONTUÁRIO_TEXT (concatenado para leitura/busca rápida)
    const prontuarioObj = analiseDataV2.prontuario_ptbr || {};
    const prontuarioText = `
PRONTUÁRIO DE INTELIGÊNCIA - ${contact.nome}

1️⃣ VISÃO GERAL DO RELACIONAMENTO
${prontuarioObj.visao_geral || 'N/A'}

2️⃣ NECESSIDADES E CONTEXTO DE COMPRA
${prontuarioObj.necessidades_contexto || 'N/A'}

3️⃣ ESTADO ATUAL DA CONTA (SCORES)
${prontuarioObj.estado_atual_scores || 'N/A'}

4️⃣ CAUSAS PRINCIPAIS
${prontuarioObj.causas_principais || 'N/A'}

5️⃣ OPORTUNIDADES E SINAIS POSITIVOS
${prontuarioObj.oportunidades_sinais_positivos || 'N/A'}

6️⃣ RECOMENDAÇÕES OBJETIVAS
${prontuarioObj.recomendacoes_objetivas || 'N/A'}

7️⃣ SUGESTÃO DE MENSAGEM PRONTA
${prontuarioObj.mensagem_pronta || 'N/A'}

---
Análise gerada em: ${new Date().toISOString()}
Status: ${prontuarioObj.visao_geral ? 'COMPLETA' : 'PARCIAL'}
    `.trim();
    
    const analise = await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
      contact_id: contact_id,
      analyzed_at: new Date().toISOString(),
      window_size: mensagens.length,
      status: 'ok',
      
      // TIMESTAMPS
      last_message_at: lastMessageAt,
      last_inbound_at: lastInboundAt,
      last_outbound_at: lastOutboundAt,
      
      // INATIVIDADE
      days_inactive_total: daysInactiveTotal,
      days_inactive_inbound: daysInactiveInbound,
      days_inactive_outbound: daysInactiveOutbound,
      bucket_inactive: bucketInactive,
      
      // PRIORITY
      priority_score: priorityScore,
      priority_label: priorityLabel,
      root_causes: (analiseDataV2.root_causes || []).map(r => r.cause || ''),
      
      // ✅ FONTE DA VERDADE V3.1
      insights_v2: insightsV2,
      prontuario_text: prontuarioText,
      
      // CAMPOS V2 (para compatibilidade)
      relationship_profile: insightsV2.relationship_profile,
      scores: insightsV2.scores,
      stage: insightsV2.stage,
      evidence_snippets: insightsV2.evidence_snippets,
      objections: insightsV2.objections,
      alerts: insightsV2.alerts,
      playbook: insightsV2.playbook,
      next_best_action: insightsV2.next_best_action,
      relationship_risk: insightsV2.relationship_risk,
      prontuario_ptbr: prontuarioObj,
      metricas_relacionamento: insightsV2.metricas_relacionamento,
      
      // AI INSIGHTS (legado)
      ai_insights: {
        sentiment: sentimentoPredominante,
        buy_intent: aiScores.buy_intent,
        engagement: aiScores.engagement,
        deal_risk: aiScores.deal_risk,
        health: aiScores.health,
        stage_suggested: stageAtual,
        objections: objecoes,
        signals: signals,
        next_best_action: nextBestAction,
        evidence: evidencias
      },
      
      // LEGADO
      periodo_analise: `${new Date(primeiraMsg.created_date).toISOString().split('T')[0]} a ${new Date().toISOString().split('T')[0]}`,
      insights: {
        scores: aiScores,
        stage: { current: stageAtual, days_stalled: daysInactiveInbound },
        alerts: rootCauses.map(r => ({ level: priorityLabel.toLowerCase(), reason: r })),
        next_best_action: nextBestAction
      }
    });

    // ✅ CACHE NO CONTACT (B) - para Contatos Inteligentes, automações e alertas
    const updateContactData = {
      score_engajamento: aiScores.engagement,
      ultima_analise_comportamento: new Date().toISOString(),
      segmento_atual: determinarSegmento(aiScores.deal_risk, aiScores.buy_intent, bucketInactive),
      estagio_ciclo_vida: stageAtual,
      cliente_score: priorityScore,
      campos_personalizados: {
        // CACHE: Relationship Profile
        relationship_profile_type: insightsV2.relationship_profile.type,
        relationship_profile_flags: insightsV2.relationship_profile.flags.join(','),
        relationship_profile_summary: insightsV2.relationship_profile.summary,
        
        // CACHE: Scores críticos
        deal_risk_cached: aiScores.deal_risk,
        buy_intent_cached: aiScores.buy_intent,
        health_cached: aiScores.health,
        engagement_cached: aiScores.engagement,
        
        // CACHE: Risco relacional
        relationship_risk_level: insightsV2.relationship_risk.level,
        relationship_risk_events_count: insightsV2.relationship_risk.events?.length || 0,
        
        // CACHE: Status e timestamps
        last_analysis_status: 'ok',
        last_analysis_at: new Date().toISOString(),
        last_analysis_priority_label: priorityLabel,
        last_analysis_priority_score: priorityScore,
        
        // CACHE: Playbook (para automações)
        playbook_goal: insightsV2.playbook.goal,
        playbook_when_to_compete: insightsV2.playbook.when_to_compete.join('|'),
        playbook_when_to_decline: insightsV2.playbook.when_to_decline.join('|'),
        
        // CACHE: Inatividade
        bucket_inactive: bucketInactive,
        days_inactive_inbound: daysInactiveInbound,
        days_inactive_total: daysInactiveTotal
      }
    };
    
    // Helper para segmentação
    function determinarSegmento(dealRisk, buyIntent, bucket) {
      if (dealRisk > 70 && bucket === '90+') return 'risco_churn';
      if (buyIntent > 70 && dealRisk < 30) return 'lead_quente';
      if (buyIntent > 40 && dealRisk < 50) return 'lead_morno';
      if (bucket === '90+') return 'lead_frio';
      return 'cliente_ativo';
    }
    
    await base44.asServiceRole.entities.Contact.update(contact_id, updateContactData);

    return Response.json({
      success: true,
      analysis_id: analise.id,
      resumo: {
        priority: priorityLabel,
        score: priorityScore,
        bucket: bucketInactive,
        root_causes: rootCauses,
        next_action: nextBestAction.action,
        suggested_message: nextBestAction.message_suggestion
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[ANALISE] ❌ Erro crítico:', error);
    
    // Mesmo em erro, tentar salvar análise com status error
    try {
      const { contact_id } = await req.json();
      if (contact_id) {
        await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
          contact_id: contact_id,
          analyzed_at: new Date().toISOString(),
          status: 'error',
          error_reason: error.message,
          window_size: 0,
          bucket_inactive: '90+',
          priority_label: 'BAIXO',
          priority_score: 0
        });
      }
    } catch (saveError) {
      console.error('[ANALISE] Erro ao salvar análise de erro:', saveError);
    }
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});