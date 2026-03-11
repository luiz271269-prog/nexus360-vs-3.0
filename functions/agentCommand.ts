// agentCommand - v6.0 (Resiliência Nativa sem Middleware)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ANALYST_TOOLS = [
  {
    name: 'query_database',
    description: 'Consulta dados reais do banco. Use para responder perguntas sobre clientes, orçamentos, vendas, conversas, tarefas.',
    input_schema: {
      type: 'object',
      properties: {
        entidade: {
          type: 'string',
          enum: ['Contact', 'Orcamento', 'Venda', 'MessageThread', 'WorkQueueItem', 'Cliente', 'AgentRun'],
          description: 'Qual entidade consultar'
        },
        filtros: {
          type: 'object',
          description: 'Filtros. Ex: { status: "negociando" }'
        },
        ordenar_por: {
          type: 'string',
          description: 'Campo de ordenação. Ex: -created_date'
        },
        limite: {
          type: 'number',
          description: 'Máximo de registros (default 10, máximo 50)'
        }
      },
      required: ['entidade']
    }
  },
  {
    name: 'search_knowledge',
    description: 'Busca na base de conhecimento: produtos, preços, políticas, casos resolvidos.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de busca' },
        tipo: { type: 'string', enum: ['produto', 'politica', 'caso_resolvido', 'preco', 'fornecedor', 'qualquer'] }
      },
      required: ['query']
    }
  },
  {
    name: 'save_to_knowledge',
    description: 'Salva informação na base de conhecimento. Use quando o usuário ENSINAR algo novo.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['produto', 'politica', 'caso_resolvido', 'preco', 'fornecedor'] },
        titulo: { type: 'string', description: 'Título descritivo' },
        conteudo: { type: 'string', description: 'Conteúdo completo' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave' }
      },
      required: ['tipo', 'titulo', 'conteudo']
    }
  }
];

async function executeTool(base44, toolName, toolInput) {
  if (toolName === 'query_database') {
    const entidade = toolInput.entidade;
    const filtros = toolInput.filtros || {};
    const ordem = toolInput.ordenar_por || '-created_date';
    const limite = Math.min(toolInput.limite || 10, 50);
    const resultados = await base44.asServiceRole.entities[entidade].filter(filtros, ordem, limite);
    return { entidade, total: resultados.length, dados: resultados };
  }

  if (toolName === 'search_knowledge') {
    const filtroKB = toolInput.tipo && toolInput.tipo !== 'qualquer' ? { tipo: toolInput.tipo } : {};
    const conhecimentos = await base44.asServiceRole.entities.KnowledgeBase.filter(filtroKB, '-vezes_consultado', 20).catch(() => []);
    const queryLower = (toolInput.query || '').toLowerCase();
    const palavras = queryLower.split(/\s+/).filter(Boolean);
    const relevantes = conhecimentos.filter(k => {
      const t = (k.titulo || '').toLowerCase();
      const c = (k.conteudo || '').toLowerCase();
      const tags = (k.tags || []).map(x => x.toLowerCase());
      return palavras.some(p => t.includes(p) || c.includes(p) || tags.some(tg => tg.includes(p)));
    });
    for (const item of relevantes.slice(0, 3)) {
      base44.asServiceRole.entities.KnowledgeBase.update(item.id, {
        vezes_consultado: (item.vezes_consultado || 0) + 1,
        ultima_consulta: new Date().toISOString()
      }).catch(() => {});
    }
    return { total: relevantes.length, dados: relevantes.slice(0, 5) };
  }

  if (toolName === 'save_to_knowledge') {
    const novo = await base44.asServiceRole.entities.KnowledgeBase.create({
      tipo: toolInput.tipo,
      titulo: toolInput.titulo,
      conteudo: toolInput.conteudo,
      tags: toolInput.tags || [],
      fonte: 'atendente',
      vezes_consultado: 0
    });
    return { saved: true, id: novo.id, titulo: toolInput.titulo, tipo: toolInput.tipo };
  }

  return { error: `Tool desconhecida: ${toolName}` };
}

async function fetchContextData(base44) {
  try {
    const [vendas, orcamentos, threads, workQueue, runs] = await Promise.all([
      base44.asServiceRole.entities.Venda.list('-data_venda', 10).catch(() => []),
      base44.asServiceRole.entities.Orcamento.filter({ status: { $in: ['enviado', 'negociando', 'liberado'] } }, '-updated_date', 10).catch(() => []),
      base44.asServiceRole.entities.MessageThread.filter({ status: 'aberta', thread_type: 'contact_external' }, '-last_message_at', 30).catch(() => []),
      base44.asServiceRole.entities.WorkQueueItem.filter({ status: 'open' }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.AgentRun.filter({ status: 'processando' }, '-started_at', 5).catch(() => [])
    ]);

    return {
      vendas,
      orcamentos,
      threads,
      workQueue,
      runs,
      snapshot: {
        vendas_count: vendas.length,
        receita_total: vendas.reduce((s, v) => s + (v.valor_total || 0), 0),
        pipeline_valor: orcamentos.reduce((s, o) => s + (o.valor_total || 0), 0),
        threads_nao_atribuidas: threads.filter(t => !t.assigned_user_id).length,
        fila_aberta: workQueue.length,
        runs_ativos: runs.length
      }
    };
  } catch (e) {
    console.warn('[AGENT-COMMAND] Erro ao buscar contexto:', e.message);
    return { snapshot: {}, vendas: [], orcamentos: [], threads: [], workQueue: [], runs: [] };
  }
}

async function callAnthropicDirect(apiKey, systemPrompt, messages, tools, maxTokens = 1500) {
  const url = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  };

  const body = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: tools,
    messages: messages
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[ANTHROPIC] Erro:', error.message);
    throw error;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { command, user_message, context } = await req.json();

    if (command === 'chat') {
      console.log('[AGENT-COMMAND] Chat iniciado:', user_message.slice(0, 50));
      const userId = user.id;

      // ── Pré-buscar dados em paralelo (não depende de IA) ──────────────
      const contextData = await fetchContextData(base44);

      // ── Carregar memória da última sessão ──────────────────────────
      let memoriaAtual = null;
      try {
        const memoriasSessao = await base44.asServiceRole.entities.NexusMemory.filter(
          { owner_user_id: userId, tipo: 'sessao' }, '-created_date', 1
        );
        memoriaAtual = memoriasSessao[0] || null;
      } catch (e) {
        console.warn('[AGENT-COMMAND] NexusMemory não disponível:', e.message);
      }

      const contextoMemoria = memoriaAtual
        ? `\nMEMÓRIA DA ÚLTIMA SESSÃO:\n${memoriaAtual.conteudo}\nÚltima ação: ${memoriaAtual.ultima_acao || 'nenhuma'}`
        : '\nPrimeira sessão — sem histórico anterior.';

      const run = await base44.asServiceRole.entities.AgentRun.create({
        trigger_type: 'manual.invoke',
        trigger_event_id: `chat_${Date.now()}`,
        playbook_selected: 'nexus_chat',
        execution_mode: 'assistente',
        status: 'processando',
        context_snapshot: { user_id: userId, page: context?.page, message: user_message },
        started_at: new Date().toISOString()
      }).catch(e => {
        console.warn('[AGENT-COMMAND] Falha ao criar AgentRun:', e.message);
        return { id: 'temp_' + Date.now() };
      });

      try {
        const apiKey = Deno.env.get('ANTROPIK_API');
        const userSector = user.attendant_sector || context?.user?.sector || 'geral';
        const userLevel = user.attendant_role || 'pleno';
        const isAdmin = user.role === 'admin';

        const sectorFocus = {
          vendas: 'Foco em leads, pipeline, orçamentos e fechamento.',
          assistencia: 'Foco em suporte técnico, chamados abertos, histórico de atendimento.',
          financeiro: 'Foco em cobranças, inadimplência, pagamentos pendentes.',
          fornecedor: 'Foco em compras, tabelas de preço, catálogo e negociação.',
          geral: 'Visão geral de todas as operações.'
        }[userSector] || 'Visão geral.';

        const systemPrompt = `Você é o **Nexus AI**, assistente inteligente do CRM.

OPERADOR: ${user.full_name} | ${userLevel} | Setor: ${userSector}
FOCO: ${sectorFocus}

CONTEXTO OPERACIONAL (pré-buscado — DADOS REAIS):
• Vendas recentes: ${contextData.snapshot.vendas_count} | Receita: R$ ${contextData.snapshot.receita_total.toLocaleString('pt-BR')}
• Orçamentos em aberto: ${contextData.snapshot.orcamentos_count || 0} | Pipeline: R$ ${contextData.snapshot.pipeline_valor.toLocaleString('pt-BR')}
• Conversas ativas: ${contextData.snapshot.threads_nao_atribuidas} sem atendente
• Fila de trabalho: ${contextData.snapshot.fila_aberta} itens
• Execuções ativas: ${contextData.snapshot.runs_ativos}
${contextoMemoria}

SCHEMA DAS ENTIDADES (use ao montar filtros no query_database):
• Contact: id, nome, telefone, telefone_canonico, empresa, tipo_contato(novo/lead/cliente/fornecedor/parceiro), classe_abc(A/B/C), score_abc, tags[], atendente_fidelizado_vendas, vendedor_responsavel, ultima_interacao
• MessageThread: id, contact_id, status(aberta/fechada/arquivada), channel(whatsapp/instagram/interno), assigned_user_id, last_message_at, last_message_sender(user/contact), unread_count, sector_id, jarvis_alerted_at, jarvis_next_check_after, pre_atendimento_state, thread_type(contact_external/team_internal)
• Orcamento: id, cliente_nome, cliente_id, vendedor, status(rascunho/aguardando_cotacao/enviado/negociando/aprovado/rejeitado/vencido), valor_total, data_orcamento, data_vencimento
• Venda: id, cliente_nome, vendedor, data_venda, valor_total, status(Pendente/Faturado/Entregue/Cancelado), produtos[]
• AgentRun: id, trigger_type(manual.invoke/scheduled.check/message.inbound/thread.updated), playbook_selected, status(iniciado/processando/concluido/falhou), context_snapshot, started_at, duration_ms
• WorkQueueItem: id, tipo(idle_reativacao/enviar_promocao/follow_up/manual), contact_id, thread_id, status(open/done/dismissed/cancelado), severity(low/medium/high/critical), payload, reason
• Cliente: id, razao_social, nome_fantasia, cnpj, status(novo_lead/qualificado/Ativo/Inativo), vendedor_id, score_qualificacao_lead

INSTRUÇÕES:
1. Use query_database com filtros corretos baseados no schema acima.
2. Use search_knowledge para produtos, preços, políticas.
3. Use save_to_knowledge quando o usuário ENSINAR algo novo.
4. Sempre cite dados reais. Seja objetivo, máximo 3 parágrafos.`;

        // ── Loop de Tool Use com Anthropic (Fallback Integrado) ────────
        let messages = [{ role: 'user', content: user_message }];
        let text = '';
        let rodadas = 0;
        let usedFallback = false;

        // ── CAMINHO FELIZ: Tentar Anthropic Direto ────────────────────
        try {
          while (rodadas < 3) {
            rodadas++;
            console.log(`[AGENT-COMMAND] Tool-use rodada ${rodadas} com Anthropic...`);

            const response = await callAnthropicDirect(apiKey, systemPrompt, messages, ANALYST_TOOLS);

            const textBlock = response.content.find(b => b.type === 'text');
            if (textBlock) {
              text = textBlock.text;
            }

            if (response.stop_reason === 'end_turn') {
              console.log('[AGENT-COMMAND] ✓ Anthropic respondeu com sucesso');
              break;
            }

            if (response.stop_reason === 'tool_use') {
              messages.push({ role: 'assistant', content: response.content });
              const toolResults = [];

              for (const block of response.content) {
                if (block.type !== 'tool_use') continue;
                console.log(`[AGENT-COMMAND] Tool: ${block.name}`);

                let result;
                try {
                  result = await executeTool(base44, block.name, block.input);
                } catch (e) {
                  result = { error: e.message };
                }

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify(result)
                });
              }

              messages.push({ role: 'user', content: toolResults });
            } else {
              break;
            }
          }
        } catch (anthropicError) {
          console.warn('[AGENT-COMMAND] Anthropic falhou:', anthropicError.message);

          // BUG-008 fix: erro 401 = chave inválida → não tentar fallback, informar explicitamente
          const isAuthError = anthropicError.message?.includes('401') ||
            anthropicError.message?.includes('Unauthorized') ||
            anthropicError.message?.includes('invalid_api_key') ||
            anthropicError.message?.includes('authentication');

          if (isAuthError) {
            text = '⚠️ **Nexus AI indisponível**: A chave de API (ANTROPIK_API) está inválida ou expirada. Solicite ao administrador que atualize a chave em Base44 → Settings → Environment Variables.';
            console.error('[AGENT-COMMAND] ❌ Erro de autenticação Anthropic — chave inválida');
          } else {
            usedFallback = true;

            // ── CAMINHO DE SEGURANÇA: InvokeLLM com Dados Pré-Buscados ────
            const fallbackPrompt = `Baseado NESSES DADOS REAIS do sistema (não invente, não especule):

${JSON.stringify(contextData.snapshot, null, 2)}

Últimos dados disponíveis:
${contextData.vendas.length > 0 ? `Vendas: ${JSON.stringify(contextData.vendas.slice(0, 2), null, 2)}` : 'Sem vendas'}
${contextData.orcamentos.length > 0 ? `Orçamentos: ${JSON.stringify(contextData.orcamentos.slice(0, 2), null, 2)}` : 'Sem orçamentos'}
${contextData.threads.length > 0 ? `Conversas: ${JSON.stringify(contextData.threads.slice(0, 1), null, 2)}` : 'Sem conversas'}

Pergunta do usuário: ${user_message}

Responda usando APENAS os dados fornecidos. Não invente dados. Se não souber, diga que a informação não está disponível.`;

            try {
              const iaResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: fallbackPrompt,
                model: 'gemini_3_flash'
              });
              text = typeof iaResponse === 'string' ? iaResponse : JSON.stringify(iaResponse);
              console.log('[AGENT-COMMAND] ✓ Fallback InvokeLLM respondeu');
            } catch (fallbackError) {
              console.error('[AGENT-COMMAND] Fallback também falhou:', fallbackError.message);
              text = `[Modo backup] Não foi possível processar sua pergunta neste momento. Dados disponíveis: ${contextData.snapshot.vendas_count} vendas, R$ ${contextData.snapshot.pipeline_valor?.toLocaleString('pt-BR')} em pipeline.`;
            }
          }
        }

        if (!text) text = 'Não foi possível gerar resposta. Tente novamente.';

        // ── Indicador de modo ────────────────────────────────────────
        if (usedFallback && !text.includes('[Modo backup')) {
          text = '⚙️ [Modo backup] ' + text;
        }

        // ── Salvar execução ──────────────────────────────────────────
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        // ── Salvar memória (async) ──────────────────────────────────
        (async () => {
          try {
            const resumoSessao = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Resumir em 3 linhas:\nPergunta: ${user_message}\nResposta: ${text.slice(0, 200)}`
            });
            const dadosMemoria = {
              owner_user_id: userId,
              tipo: 'sessao',
              conteudo: typeof resumoSessao === 'string' ? resumoSessao : JSON.stringify(resumoSessao),
              ultima_acao: 'chat',
              contexto: { page: context?.page },
              score_utilidade: 80
            };
            if (memoriaAtual) {
              await base44.asServiceRole.entities.NexusMemory.update(memoriaAtual.id, dadosMemoria);
            } else {
              await base44.asServiceRole.entities.NexusMemory.create(dadosMemoria);
            }
          } catch (e) {
            console.warn('[NEXUS-MEMORY] Erro ao salvar:', e.message);
          }
        })();

        return Response.json({
          success: true,
          response: text,
          run_id: run.id,
          agent_mode: usedFallback ? 'fallback' : 'anthropic',
          context_snapshot: contextData.snapshot
        });

      } catch (error) {
        console.error('[AGENT-COMMAND] Erro crítico:', error.message);
        try {
          await base44.asServiceRole.entities.AgentRun.update(run.id, {
            status: 'falhou',
            error_message: error.message,
            completed_at: new Date().toISOString()
          });
        } catch (_) {}
        return Response.json({
          success: false,
          response: `Erro: ${error.message}`,
          agent_mode: 'error'
        });
      }
    }

    return Response.json({ success: false, error: 'Comando não suportado' }, { status: 400 });

  } catch (error) {
    console.error('[AGENT_COMMAND] Fatal:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});