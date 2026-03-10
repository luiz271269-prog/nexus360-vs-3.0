// agentCommand - v4.0 (modo analista com tool_use real)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function loadConfig(base44) {
  try {
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({ ativa: true }, 'chave', 100);
    const map = {};
    for (const c of configs) {
      map[c.chave] = c.valor?.value !== undefined ? c.valor.value : null;
    }
    return map;
  } catch (e) {
    console.warn('[CONFIG] Falha ao carregar configs do banco:', e.message);
    return {};
  }
}

// Tools disponíveis no modo analista (sem contexto de thread/contato)
const ANALYST_TOOLS = [
  {
    name: 'query_database',
    description: 'Consulta dados reais do banco. Use para responder perguntas sobre clientes, orçamentos, vendas, conversas, tarefas. Retorna dados REAIS.',
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
          description: 'Filtros. Ex: { status: "negociando" } ou { created_date: { $gte: "2026-01-01" } }'
        },
        ordenar_por: {
          type: 'string',
          description: 'Campo de ordenação. Ex: -created_date, valor_total'
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
    description: 'Busca na base de conhecimento: produtos, preços, políticas, casos resolvidos. Use quando perguntarem sobre produtos ou procedimentos.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de busca' },
        tipo: {
          type: 'string',
          enum: ['produto', 'politica', 'caso_resolvido', 'preco', 'fornecedor', 'qualquer']
        }
      },
      required: ['query']
    }
  },
  {
    name: 'save_to_knowledge',
    description: 'Salva informação na base de conhecimento da empresa. Use quando o usuário ENSINAR algo novo: preço de produto, procedimento, política, caso resolvido. Isso TREINA o agente para todos os usuários do sistema.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['produto', 'politica', 'caso_resolvido', 'preco', 'fornecedor'],
          description: 'Categoria do conhecimento'
        },
        titulo: { type: 'string', description: 'Título descritivo. Ex: "Notebook Dell 5420 - 16GB 512GB"' },
        conteudo: { type: 'string', description: 'Conteúdo completo com todos os detalhes relevantes' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave para busca futura. Ex: ["notebook", "dell", "16gb"]' }
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
    console.log(`[AGENT-COMMAND] query_database: ${entidade} → ${resultados.length} registros`);
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
    console.log(`[AGENT-COMMAND] save_to_knowledge: "${toolInput.titulo}" salvo (${toolInput.tipo})`);
    return { saved: true, id: novo.id, titulo: toolInput.titulo, tipo: toolInput.tipo };
  }

  return { error: `Tool desconhecida: ${toolName}` };
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
      const userId = user.id;

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
        ? `\nMEMÓRIA DA ÚLTIMA SESSÃO (${memoriaAtual.created_date?.slice(0, 10) || 'anterior'}):\n${memoriaAtual.conteudo}\nÚltima ação: ${memoriaAtual.ultima_acao || 'nenhuma'}`
        : '\nPrimeira sessão — sem histórico anterior.';

      const run = await base44.asServiceRole.entities.AgentRun.create({
        trigger_type: 'manual.invoke',
        trigger_event_id: `chat_${Date.now()}`,
        playbook_selected: 'nexus_chat',
        execution_mode: 'assistente',
        status: 'processando',
        context_snapshot: { user_id: userId, page: context?.page, message: user_message },
        started_at: new Date().toISOString()
      });

      try {
        // Carregar configs do banco
        const cfg = await loadConfig(base44);
        const modelToUse = cfg.modelo_ia || 'claude-3-5-haiku-20241022';
        const nomeEmpresa = cfg.nome_empresa || 'CRM';
        const descricaoEmpresa = cfg.descricao_empresa || '';

        // Contexto estático rápido
        const [vendas, orcamentos, threads, workQueue] = await Promise.all([
          base44.asServiceRole.entities.Venda.list('-data_venda', 10).catch(() => []),
          base44.asServiceRole.entities.Orcamento.filter(
            { status: { $in: ['enviado', 'negociando', 'liberado'] } }, '-updated_date', 10
          ).catch(() => []),
          base44.asServiceRole.entities.MessageThread.filter(
            { status: 'aberta', thread_type: 'contact_external' }, '-last_message_at', 30
          ).catch(() => []),
          base44.asServiceRole.entities.WorkQueueItem.filter(
            { status: 'open' }, '-created_date', 10
          ).catch(() => [])
        ]);

        const threadsNaoAtribuidas = threads.filter(t => !t.assigned_user_id).length;
        const receitaTotal = vendas.reduce((s, v) => s + (v.valor_total || 0), 0);
        const valorPipeline = orcamentos.reduce((s, o) => s + (o.valor_total || 0), 0);

        const userSector = user.attendant_sector || context?.user?.sector || 'geral';
        const userLevel = user.attendant_role || 'pleno';
        const isAdmin = user.role === 'admin';

        const sectorFocus = {
          vendas: 'Foco em leads, pipeline, orçamentos e fechamento. Priorize dados de vendas e clientes do setor comercial.',
          assistencia: 'Foco em suporte técnico, chamados abertos, histórico de atendimento. Priorize SLA e tickets pendentes.',
          financeiro: 'Foco em cobranças, inadimplência, pagamentos pendentes e fluxo de caixa.',
          fornecedor: 'Foco em compras, tabelas de preço, catálogo e negociação com fornecedores.',
          geral: 'Visão geral de todas as operações da empresa.'
        }[userSector] || 'Visão geral de todas as operações.';

        const permissaoInfo = isAdmin
          ? 'PERMISSÕES: Administrador — acesso total a todos os dados e operações.'
          : `PERMISSÕES: Atendente ${userLevel} | Setor: ${userSector} — responda com foco no setor, não exponha dados de outros setores sem necessidade.`;

        const systemPrompt = `Você é o **Nexus AI**, assistente inteligente do CRM (${nomeEmpresa}${descricaoEmpresa ? ' — ' + descricaoEmpresa : ''}).

OPERADOR: ${user.full_name} | ${isAdmin ? 'Admin' : 'Atendente'} | Setor: ${userSector} | Nível: ${userLevel} | Página: ${context?.page || 'Dashboard'}
${permissaoInfo}
FOCO DO SETOR: ${sectorFocus}

SITUAÇÃO ATUAL (snapshot):
• Vendas recentes: ${vendas.length} | Receita: R$ ${receitaTotal.toLocaleString('pt-BR')}
• Orçamentos em aberto: ${orcamentos.length} | Pipeline: R$ ${valorPipeline.toLocaleString('pt-BR')}
• Conversas ativas: ${threads.length} | Sem atendente: ${threadsNaoAtribuidas} ⚠️
• Fila de trabalho: ${workQueue.length} itens abertos
${contextoMemoria}

INSTRUÇÕES:
1. Use query_database para dados específicos (clientes, orçamentos, vendas, conversas).
2. Use search_knowledge para perguntas sobre produtos, preços, políticas da empresa.
3. Use save_to_knowledge quando o usuário ENSINAR algo novo ("salva isso", "anota", "adiciona ao sistema"). Confirme que foi salvo e que o agente aprendeu.
4. Adapte as respostas ao setor ${userSector} do operador${!isAdmin ? ' — não exponha dados de outros setores' : ''}.
5. Seja objetivo, máximo 3 parágrafos.`;

        // ── Loop tool_use (máximo 3 rodadas) ──────────────────────────
        const messages = [{ role: 'user', content: user_message }];
        let text = '';
        let rodadas = 0;

        while (rodadas < 3) {
          rodadas++;
          const response = await anthropic.messages.create({
            model: modelToUse,
            max_tokens: 1500,
            system: systemPrompt,
            tools: ANALYST_TOOLS,
            tool_choice: { type: 'auto' },
            messages
          });

          // Se parou por texto final
          if (response.stop_reason === 'end_turn') {
            text = response.content.find(b => b.type === 'text')?.text || text;
            break;
          }

          // Se chamou tool
          if (response.stop_reason === 'tool_use') {
            // Adicionar resposta do assistant com as tool calls
            messages.push({ role: 'assistant', content: response.content });

            // Executar todas as tools chamadas
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

            // Adicionar resultados e continuar o loop
            messages.push({ role: 'user', content: toolResults });
          } else {
            // stop_reason inesperado — pegar texto se houver
            text = response.content.find(b => b.type === 'text')?.text || 'Não foi possível gerar resposta.';
            break;
          }
        }

        if (!text) text = 'Não foi possível gerar resposta. Tente novamente.';

        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        // ── Salvar memória de sessão (fire-and-forget) ──────────────
        (async () => {
          try {
            const resumoSessao = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Resumir em no máximo 5 linhas o que foi discutido nesta sessão do Nexus AI.\n\nPergunta: ${user_message}\nResposta: ${text.slice(0, 300)}`
            });
            const dadosMemoria = {
              owner_user_id: userId,
              tipo: 'sessao',
              conteudo: typeof resumoSessao === 'string' ? resumoSessao : JSON.stringify(resumoSessao),
              ultima_acao: 'chat',
              contexto: { page: context?.page || null },
              score_utilidade: 80
            };
            if (memoriaAtual) {
              await base44.asServiceRole.entities.NexusMemory.update(memoriaAtual.id, dadosMemoria);
            } else {
              await base44.asServiceRole.entities.NexusMemory.create(dadosMemoria);
            }
            console.log(`[NEXUS-MEMORY] Sessão salva para userId=${userId}`);
          } catch (e) {
            console.error('[NEXUS-MEMORY] Erro ao salvar sessão:', e.message);
          }
        })();

        return Response.json({ success: true, response: text, run_id: run.id, agent_mode: 'analista' });

      } catch (error) {
        console.error('[AGENT-COMMAND] Erro no bloco principal:', error.message);
        try {
          await base44.asServiceRole.entities.AgentRun.update(run.id, {
            status: 'falhou',
            error_message: error.message,
            completed_at: new Date().toISOString()
          });
        } catch (_) {}
        return Response.json({
          success: false,
          response: `Erro interno: ${error.message}`,
          agent_mode: 'error'
        });
      }
    }

    return Response.json({ success: false, error: 'Comando não suportado' }, { status: 400 });

  } catch (error) {
    console.error('[AGENT_COMMAND] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});