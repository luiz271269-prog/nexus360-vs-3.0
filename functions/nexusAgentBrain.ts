// nexusAgentBrain - v1.0.0
// Agente autônomo unificado: percepção → decisão → ação
// Substitui: claudeWhatsAppResponder + nexusClassifier
// Conectado: processInbound, jarvisEventLoop, agentCommand

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Troque por 'claude-3-5-sonnet-20241022' para maior qualidade
const MODEL = 'claude-3-5-haiku-20241022';

const TOOLS = [
  {
    name: 'suggest_reply',
    description: 'Sugere resposta para o atendente aprovar (modo copilot — nunca envia sozinho)',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Texto da resposta sugerida' },
        tone: { type: 'string', enum: ['formal', 'amigavel', 'objetiva'] },
        reasoning: { type: 'string', description: 'Por que esta resposta' }
      },
      required: ['message', 'tone', 'reasoning']
    }
  },
  {
    name: 'send_message',
    description: 'Envia mensagem diretamente ao cliente (somente modo autonomous + casos simples)',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Texto a enviar' }
      },
      required: ['message']
    }
  },
  {
    name: 'create_task',
    description: 'Cria tarefa na fila de trabalho para o atendente',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
      },
      required: ['title', 'description', 'severity']
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Escala para atendente humano com resumo do contexto',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo da escalação' },
        summary: { type: 'string', description: 'Resumo para o atendente' }
      },
      required: ['reason', 'summary']
    }
  },
  {
    name: 'update_contact',
    description: 'Atualiza dados do contato no CRM',
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Campos a atualizar: tipo_contato, tags, observacoes, segmento_atual'
        }
      },
      required: ['fields']
    }
  },
  {
    name: 'no_action',
    description: 'Decide não agir agora — registra o motivo',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Por que não agir' }
      },
      required: ['reason']
    }
  },
  {
    name: 'query_database',
    description: 'Faz consulta dinâmica no banco de dados real. Use para responder perguntas como: quais clientes não foram contatados há X dias, orçamentos parados, threads sem atendente, vendas do mês, tarefas pendentes. Retorna dados REAIS, não estimativas.',
    input_schema: {
      type: 'object',
      properties: {
        entidade: {
          type: 'string',
          enum: ['Contact', 'Orcamento', 'Venda', 'MessageThread', 'WorkQueueItem', 'Message', 'AgentRun'],
          description: 'Qual entidade consultar'
        },
        filtros: {
          type: 'object',
          description: 'Filtros no formato Base44. Ex: { status: "negociando" } ou { created_date: { $gte: "2026-01-01" } }'
        },
        ordenar_por: {
          type: 'string',
          description: 'Campo para ordenação. Prefixo - para decrescente. Ex: -created_date, valor_total'
        },
        limite: {
          type: 'number',
          description: 'Máximo de registros. Default 10, máximo 50'
        },
        objetivo: {
          type: 'string',
          description: 'Por que está buscando esses dados — ajuda a formatar a resposta'
        }
      },
      required: ['entidade', 'objetivo']
    }
  },
  {
    name: 'search_knowledge',
    description: 'Busca na base de conhecimento da empresa: produtos com preços, políticas internas, casos resolvidos, tabelas de fornecedores. Use quando o usuário perguntar sobre produtos, preços ou procedimentos internos.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto de busca. Ex: "notebook dell 5420", "política de devolução"'
        },
        tipo: {
          type: 'string',
          enum: ['produto', 'politica', 'caso_resolvido', 'preco', 'fornecedor', 'qualquer'],
          description: 'Tipo de conhecimento. Use "qualquer" quando não souber o tipo.'
        }
      },
      required: ['query']
    }
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const {
      thread_id,
      contact_id,
      integration_id,
      provider,
      message_content,
      trigger = 'inbound',       // 'inbound' | 'jarvis_alert' | 'chat'
      mode: requestedMode = 'copilot' // 'copilot' | 'autonomous'
    } = payload;

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'thread_id e contact_id obrigatórios' }, { status: 400 });
    }

    const inicio = Date.now();
    console.log(`[NEXUS-BRAIN] 🧠 trigger=${trigger} | mode=${requestedMode} | thread=${thread_id}`);

    // ── STEP 1: Contexto completo em paralelo ──────────────────────
    const [thread, contact, mensagensRaw] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id),
      base44.asServiceRole.entities.Message.filter({ thread_id }, '-created_date', 20)
    ]);

    const [orcamentosAbertos, analises, memoriaContato, aprendizadoSemanal] = await Promise.all([
      base44.asServiceRole.entities.Orcamento.filter(
        { cliente_id: contact_id, status: { $in: ['enviado', 'negociando', 'liberado'] } },
        '-updated_date', 3
      ).catch(() => []),
      base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
        { contact_id }, '-analyzed_at', 1
      ).catch(() => []),
      base44.asServiceRole.entities.ContactMemory.filter(
        { contact_id }, '-created_date', 1
      ).catch(() => []),
      base44.asServiceRole.entities.NexusMemory.filter(
        { owner_user_id: 'system', tipo: 'aprendizado_semanal' }, '-created_date', 1
      ).catch(() => [])
    ]);

    const prontuario = analises[0] || null;

    // ── STEP 2: Pular fornecedores (fluxo dedicado) ─────────────────
    if (contact.tipo_contato === 'fornecedor') {
      return Response.json({ success: true, skipped: true, reason: 'fornecedor' });
    }

    // ── STEP 3: Freios de produção ──────────────────────────────────

    // Freio 1: Humano respondeu nos últimos 10 min
    const ultimaMsgHumana = mensagensRaw.find(m =>
      m.sender_type === 'user' &&
      !m.metadata?.is_ai_response &&
      !m.metadata?.jarvis_alert
    );
    if (ultimaMsgHumana) {
      const minutos = (Date.now() - new Date(ultimaMsgHumana.created_date || ultimaMsgHumana.sent_at).getTime()) / 60000;
      if (minutos < 10) {
        console.log(`[NEXUS-BRAIN] 🛑 Humano ativo há ${Math.round(minutos)}min — skip`);
        return Response.json({ success: true, skipped: true, reason: 'humano_ativo_recente' });
      }
    }

    // Freio 2: Cooldown por contato (compartilhado com Jarvis)
    if (trigger === 'jarvis_alert' && thread.jarvis_next_check_after && new Date() < new Date(thread.jarvis_next_check_after)) {
      console.log(`[NEXUS-BRAIN] 🛑 Cooldown ativo`);
      return Response.json({ success: true, skipped: true, reason: 'cooldown_ativo' });
    }

    // Freio 3: Chip no limite (10 disparos/hora)
    let mode = requestedMode;
    const umaHoraAtras = new Date(Date.now() - 3600000).toISOString();
    const disparosRecentes = await base44.asServiceRole.entities.Message.filter({
      sender_id: 'nexus_brain',
      created_date: { $gte: umaHoraAtras }
    }, '-created_date', 15).catch(() => []);

    if (disparosRecentes.length >= 10) {
      mode = 'copilot';
      console.log(`[NEXUS-BRAIN] ⚠️ Chip no limite (${disparosRecentes.length}/10h) — forçando copilot`);
    }

    // Freio 4: Sistema novo — forçar copilot até 50 runs para calibrar
    const totalRuns = await base44.asServiceRole.entities.AgentRun.filter(
      { playbook_selected: 'nexus_brain' }, '-created_date', 1
    ).catch(() => []);
    if (totalRuns.length < 50 && mode === 'autonomous') {
      mode = 'copilot';
      console.log(`[NEXUS-BRAIN] 🎓 Sistema calibrando (${totalRuns.length} runs) — copilot obrigatório`);
    }

    // ── STEP 4: Montar histórico para o Claude ──────────────────────
    const historicoTexto = mensagensRaw
      .slice().reverse()
      .filter(m => m.content && m.content.length > 0 && m.content !== '[mídia]')
      .slice(-15)
      .map(m => {
        const quem = m.sender_type === 'contact' ? `${contact.nome || 'Cliente'}` : '⚡ Sistema';
        const hora = (m.created_date || m.sent_at)
          ? new Date(m.created_date || m.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '';
        return `[${hora}] ${quem}: ${m.content.slice(0, 200)}`;
      })
      .join('\n');

    const systemPrompt = `Você é o Nexus Brain, assistente de atendimento da Liesch Informática (tecnologia B2B, 30+ anos de mercado).

MODO ATUAL: ${mode === 'copilot' ? 'COPILOT — sugira resposta, humano aprova. Use suggest_reply.' : 'AUTÔNOMO — aja em casos simples apenas.'}
TRIGGER: ${trigger === 'inbound' ? 'Nova mensagem do cliente' : trigger === 'jarvis_alert' ? 'Alerta Jarvis (conversa parada)' : 'Chat interno'}

PERFIL DO CONTATO:
- Nome: ${contact.nome || 'N/D'}
- Tipo: ${contact.tipo_contato || 'novo'}
- Empresa: ${contact.empresa || 'N/D'}
- Score: ${prontuario?.priority_score || contact.cliente_score || 0}/100
- Segmento: ${contact.segmento_atual || 'indefinido'}
- VIP: ${contact.is_vip ? 'SIM ⭐' : 'não'}
- Setor da conversa: ${thread.sector_id || 'sem setor'}
- Atendente: ${thread.assigned_user_id ? 'atribuído' : '⚠️ SEM ATENDENTE'}

${orcamentosAbertos.length > 0 ? `ORÇAMENTOS ABERTOS (${orcamentosAbertos.length}):
${orcamentosAbertos.map(o => `• ${o.numero_orcamento || 'ORC'}: R$ ${o.valor_total?.toLocaleString('pt-BR') || '?'} | ${o.status}`).join('\n')}` : 'Sem orçamentos abertos.'}

${prontuario ? `PRONTUÁRIO IA:
• Buy intent: ${prontuario.ai_insights?.buy_intent || 0}% | Deal risk: ${prontuario.ai_insights?.deal_risk || 0}%
• Próxima ação: ${prontuario.insights_v2?.next_best_action?.action || prontuario.next_best_action?.action || 'N/D'}` : 'Sem prontuário.'}

MEMÓRIA DO CONTATO (aprendida automaticamente):
${memoriaContato[0]?.historico_resumido || 'Primeiro contato — sem histórico aprendido ainda'}
Horário preferido: ${memoriaContato[0]?.preferencias?.horario_preferido ?? 'não mapeado'}h
Ticket médio: R$${memoriaContato[0]?.padroes?.ticket_medio?.toFixed(2) || 'não calculado'}
Frequência de compra: ${memoriaContato[0]?.padroes?.frequencia_compra ? memoriaContato[0].padroes.frequencia_compra.toFixed(0) + ' dias' : 'não calculada'}
Melhor abordagem: ${memoriaContato[0]?.melhor_abordagem || 'não definida'}
Objeções comuns: ${(memoriaContato[0]?.padroes?.objecoes_comuns || []).join(', ') || 'não mapeadas'}

APRENDIZADO DA SEMANA ANTERIOR (auto-análise do brain):
${aprendizadoSemanal[0]?.conteudo || 'Sem aprendizado registrado ainda — primeira semana de operação.'}

HISTÓRICO DA CONVERSA:
${historicoTexto || '(sem histórico)'}

SITUAÇÃO ATUAL: ${trigger === 'jarvis_alert' ? `⏰ Conversa parada. Alerta: ${message_content}` : `Nova mensagem: "${message_content}"`}

REGRAS OBRIGATÓRIAS:
1. Em modo COPILOT: use APENAS suggest_reply ou create_task ou no_action
2. send_message: somente em modo autonomous e apenas para boas-vindas ou confirmações simples
3. Negociação / cobrança / reclamação / urgência: sempre escalate_to_human
4. Se o contato já tem atendente e é trigger inbound: prefira suggest_reply
5. Responda sempre em português brasileiro, tom profissional mas humano`;

    // ── STEP 5: Claude com tool_use ─────────────────────────────────
    const claudeResp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: systemPrompt }]
    });

    const toolCall = claudeResp.content.find(b => b.type === 'tool_use');
    if (!toolCall) {
      const textFallback = claudeResp.content.find(b => b.type === 'text')?.text;
      console.warn('[NEXUS-BRAIN] ⚠️ Claude não usou tool_use');
      return Response.json({ success: true, action: 'no_tool_call', text: textFallback });
    }

    const acao = toolCall.name;
    const params = toolCall.input;
    console.log(`[NEXUS-BRAIN] 🎯 Ação: ${acao}`);

    // ── STEP 6: Executar ────────────────────────────────────────────
    let resultado = {};

    if (acao === 'suggest_reply') {
      // Salvar sugestão na fila para atendente ver no painel
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id,
        thread_id,
        tipo: 'manual',
        reason: 'manual',
        severity: 'low',
        status: 'open',
        notes: `💡 Nexus sugere (${params.tone}): ${params.message}`,
        payload: {
          tipo: 'suggest_reply',
          message: params.message,
          tone: params.tone,
          reasoning: params.reasoning,
          trigger
        }
      });
      resultado = { type: 'suggest_reply', message: params.message, tone: params.tone };
    }

    else if (acao === 'send_message') {
      if (!integration_id || !contact.telefone) {
        console.warn('[NEXUS-BRAIN] ⚠️ send_message sem integration_id ou telefone — convertendo em suggest_reply');
        await base44.asServiceRole.entities.WorkQueueItem.create({
          contact_id, thread_id, tipo: 'manual', reason: 'manual', severity: 'low', status: 'open',
          notes: `💡 Brain queria enviar: ${params.message}`,
          payload: { tipo: 'suggest_reply', message: params.message, trigger }
        });
      } else {
        await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id,
          numero_destino: contact.telefone,
          mensagem: params.message
        });
        await base44.asServiceRole.entities.Message.create({
          thread_id, sender_id: 'nexus_brain', sender_type: 'user',
          content: params.message, channel: 'whatsapp', status: 'enviada',
          sent_at: new Date().toISOString(),
          metadata: { is_ai_response: true, ai_agent: 'nexus_brain', trigger }
        });
        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          last_message_at: new Date().toISOString(),
          last_message_content: params.message.slice(0, 100),
          last_message_sender: 'user',
          last_outbound_at: new Date().toISOString()
        });
      }
      resultado = { type: 'send_message', message: params.message };
    }

    else if (acao === 'create_task') {
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id, thread_id, tipo: 'manual', reason: 'manual',
        severity: params.severity || 'medium',
        owner_user_id: thread.assigned_user_id,
        status: 'open',
        notes: `${params.title}: ${params.description}`
      });
      resultado = { type: 'create_task', title: params.title };
    }

    else if (acao === 'escalate_to_human') {
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id, thread_id, tipo: 'manual', reason: 'urgente',
        severity: 'high', status: 'open',
        notes: `🚨 Escalar: ${params.reason}\n\nContexto: ${params.summary}`
      });
      resultado = { type: 'escalate_to_human', reason: params.reason };
    }

    else if (acao === 'update_contact') {
      await base44.asServiceRole.entities.Contact.update(contact_id, params.fields);
      resultado = { type: 'update_contact', fields: Object.keys(params.fields) };
    }

    else if (acao === 'no_action') {
      resultado = { type: 'no_action', reason: params.reason };
    }

    else if (acao === 'query_database') {
      try {
        const entidade = params.entidade;
        const filtros = params.filtros || {};
        const ordem = params.ordenar_por || '-created_date';
        const limite = Math.min(params.limite || 10, 50);
        const resultados = await base44.asServiceRole.entities[entidade].filter(filtros, ordem, limite);
        console.log(`[NEXUS-BRAIN] query_database: ${entidade} — ${resultados.length} registros`);
        resultado = { type: 'query_database', entidade, total: resultados.length, dados: resultados, objetivo: params.objetivo };
      } catch (e) {
        console.error('[NEXUS-BRAIN] query_database erro:', e);
        resultado = { type: 'query_database', error: e.message };
      }
    }

    else if (acao === 'search_knowledge') {
      try {
        const filtroKB = params.tipo && params.tipo !== 'qualquer' ? { tipo: params.tipo } : {};
        const conhecimentos = await base44.asServiceRole.entities.KnowledgeBase.filter(filtroKB, '-vezes_consultado', 20).catch(() => []);
        const queryLower = (params.query || '').toLowerCase();
        const palavras = queryLower.split(/\s+/).filter(Boolean);
        const relevantes = conhecimentos.filter(k => {
          const tituloL = (k.titulo || '').toLowerCase();
          const conteudoL = (k.conteudo || '').toLowerCase();
          const tagsL = (k.tags || []).map(t => t.toLowerCase());
          return palavras.some(p => tituloL.includes(p) || conteudoL.includes(p) || tagsL.some(t => t.includes(p)));
        });
        // Incrementar contador dos 3 mais relevantes (fire-and-forget)
        for (const item of relevantes.slice(0, 3)) {
          base44.asServiceRole.entities.KnowledgeBase.update(item.id, {
            vezes_consultado: (item.vezes_consultado || 0) + 1,
            ultima_consulta: new Date().toISOString()
          }).catch(() => {});
        }
        resultado = { type: 'search_knowledge', total: relevantes.length, dados: relevantes.slice(0, 5), query_original: params.query };
      } catch (e) {
        console.error('[NEXUS-BRAIN] search_knowledge erro:', e);
        resultado = { type: 'search_knowledge', error: e.message };
      }
    }

    // ── STEP 6b: Atualizar memória do contato (fire-and-forget) ────────
    base44.asServiceRole.functions.invoke('atualizarMemoriaContato', { contact_id })
      .catch(e => console.error('[CONTACT-MEMORY] Erro async:', e.message));

    // ── STEP 7: Registrar AgentRun ──────────────────────────────────
    await base44.asServiceRole.entities.AgentRun.create({
      trigger_type: trigger === 'inbound' ? 'message.inbound' : 'scheduled.check',
      trigger_event_id: thread_id,
      playbook_selected: 'nexus_brain',
      execution_mode: mode === 'copilot' ? 'assistente' : 'auto_execute',
      status: 'concluido',
      context_snapshot: { thread_id, contact_id, trigger, mode, acao, resultado, duration_ms: Date.now() - inicio },
      started_at: new Date(inicio).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - inicio
    }).catch(() => {}); // não-crítico

    console.log(`[NEXUS-BRAIN] ✅ ${acao} | mode=${mode} | ${Date.now() - inicio}ms`);
    return Response.json({ success: true, action: acao, resultado, mode });

  } catch (error) {
    console.error('[NEXUS-BRAIN] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});