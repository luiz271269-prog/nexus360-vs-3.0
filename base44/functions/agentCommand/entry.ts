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
    name: 'execute_skill',
    description: 'Executa uma skill registrada no sistema. Use quando o usuário pedir ação executável (limpar, atualizar, followup, etc).',
    input_schema: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Nome da skill a executar'
        },
        parametros: {
          type: 'object',
          description: 'Parâmetros para a skill'
        },
        modo: {
          type: 'string',
          enum: ['copilot', 'autonomous_safe', 'critical', 'dry_run'],
          description: 'Modo de execução'
        }
      },
      required: ['skill_name']
    }
  },
  {
    name: 'list_skills',
    description: 'Lista skills disponíveis no sistema. Use quando o usuário perguntar "o que você pode fazer", "quais skills", etc.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['automacao', 'analise', 'comunicacao', 'gestao_dados', 'inteligencia', 'sistema', 'todas']
        }
      }
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

  if (toolName === 'execute_skill') {
    const resultado = await base44.asServiceRole.functions.invoke('superAgente', {
      comando_texto: `executar ${toolInput.skill_name}`,
      modo: toolInput.modo || 'copilot',
      parametros: toolInput.parametros
    });
    return resultado.data || resultado;
  }

  if (toolName === 'list_skills') {
    const filtro = toolInput.categoria && toolInput.categoria !== 'todas' ? { categoria: toolInput.categoria, ativa: true } : { ativa: true };
    const skills = await base44.asServiceRole.entities.SkillRegistry.filter(filtro, '-created_date', 50);
    return {
      total: skills.length,
      skills: skills.map(s => ({
        nome: s.display_name,
        categoria: s.categoria,
        descricao: s.descricao,
        risco: s.nivel_risco,
        exemplo: s.exemplos_uso?.[0]?.comando
      }))
    };
  }

  return { error: `Tool desconhecida: ${toolName}` };
}

async function fetchContextData(base44, contactId = null) {
  try {
    let analiseContato = null;
    if (contactId) {
      const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contactId },
        '-analyzed_at',
        1
      ).catch(() => []);
      analiseContato = analises[0] || null;
    }

    const [vendas, orcamentos, orcamentosTodos, threads, workQueue, runs, contatos, clientes] = await Promise.all([
      base44.asServiceRole.entities.Venda.list('-data_venda', 50).catch(() => []),
      base44.asServiceRole.entities.Orcamento.filter({ status: { $in: ['enviado', 'negociando', 'liberado', 'aprovado'] } }, '-updated_date', 50).catch(() => []),
      base44.asServiceRole.entities.Orcamento.list('-updated_date', 100).catch(() => []),
      base44.asServiceRole.entities.MessageThread.filter({ status: 'aberta', thread_type: 'contact_external' }, '-last_message_at', 50).catch(() => []),
      base44.asServiceRole.entities.WorkQueueItem.filter({ status: 'open' }, '-created_date', 50).catch(() => []),
      base44.asServiceRole.entities.AgentRun.filter({ status: 'processando' }, '-started_at', 10).catch(() => []),
      base44.asServiceRole.entities.Contact.list('-ultima_interacao', 100).catch(() => []),
      base44.asServiceRole.entities.Cliente.list('-updated_date', 50).catch(() => [])
    ]);

    return {
      vendas,
      orcamentos,
      orcamentosTodos,
      threads,
      workQueue,
      runs,
      contatos,
      clientes,
      analiseContato,
      snapshot: {
        vendas_count: vendas.length,
        receita_total: vendas.reduce((s, v) => s + (v.valor_total || 0), 0),
        pipeline_valor: orcamentos.reduce((s, o) => s + (o.valor_total || 0), 0),
        orcamentos_count: orcamentosTodos.length,
        orcamentos_por_status: orcamentosTodos.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {}),
        threads_nao_atribuidas: threads.filter(t => !t.assigned_user_id).length,
        fila_aberta: workQueue.length,
        runs_ativos: runs.length,
        total_contatos: contatos.length,
        contatos_classe_a: contatos.filter(c => c.classe_abc === 'A').length,
        contatos_classe_b: contatos.filter(c => c.classe_abc === 'B').length,
        total_clientes: clientes.length
      }
    };
  } catch (e) {
    console.warn('[AGENT-COMMAND] Erro ao buscar contexto:', e.message);
    return { snapshot: {}, vendas: [], orcamentos: [], orcamentosTodos: [], threads: [], workQueue: [], runs: [], contatos: [], clientes: [] };
  }
}

async function callBase44AI(base44, systemPrompt, userMessage, contextData) {
  const prompt = `${systemPrompt}\n\nUSUÁRIO PERGUNTA: ${userMessage}`;
  
  try {
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      model: 'gpt_5',
      add_context_from_internet: false
    });
    
    console.log('[AGENT-COMMAND] ✓ Base44 AI respondeu com sucesso');
    return typeof response === 'string' ? response : JSON.stringify(response);
  } catch (error) {
    console.error('[BASE44-AI] Erro:', error.message);
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
      const contactIdFromContext = context?.contact_id;
      const contextData = await fetchContextData(base44, contactIdFromContext);

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

      // ── PRÉ-ANÁLISE: Comandos Diretos de Skills ────────────────────
      const msgLower = user_message.toLowerCase().trim();
      
      // Detectar "listar skills" / "o que você pode fazer"
      if (msgLower.includes('listar skills') || msgLower.includes('skills disponíveis') || 
          msgLower.includes('o que você pode fazer') || msgLower.includes('quais skills')) {
        const skills = await base44.asServiceRole.entities.SkillRegistry.filter({ ativa: true }, '-created_date', 50);
        const resposta = `🤖 **Skills Ativas no Sistema (${skills.length} total):**\n\n` + 
          skills.map(s => `• **${s.display_name}** (${s.categoria})\n  _${s.descricao}_\n  Exemplo: "${s.exemplos_uso?.[0]?.comando || 'N/A'}"`).join('\n\n');
        
        return Response.json({
          success: true,
          response: resposta,
          run_id: null,
          agent_mode: 'direct_skill_list',
          skills_count: skills.length
        });
      }

      // Detectar "executar [skill]" / "rodar [skill]"
      const matchExec = msgLower.match(/(?:executar|rodar|ativar|chamar)\s+(.+?)(?:\s+(?:com|usando|modo|em))?/);
      if (matchExec) {
        const skillNameSearch = matchExec[1].trim();
        const skills = await base44.asServiceRole.entities.SkillRegistry.filter({ ativa: true }, '-created_date', 50);
        const skillEncontrada = skills.find(s => 
          s.skill_name.toLowerCase().includes(skillNameSearch) || 
          s.display_name.toLowerCase().includes(skillNameSearch)
        );

        if (skillEncontrada) {
          const requiresConfirmation = skillEncontrada.requer_confirmacao;
          if (requiresConfirmation) {
            return Response.json({
              success: true,
              response: `⚠️ **Skill "${skillEncontrada.display_name}"** requer confirmação.\n\n` +
                `**Nível de Risco:** ${skillEncontrada.nivel_risco}\n` +
                `**Descrição:** ${skillEncontrada.descricao}\n\n` +
                `Para executar, digite:\n\`\`\`\n${skillEncontrada.frase_confirmacao}\n\`\`\``,
              agent_mode: 'skill_confirmation_required',
              skill_name: skillEncontrada.skill_name,
              requires_confirmation: true
            });
          }

          // Executar diretamente
          const resultado = await base44.asServiceRole.functions.invoke('superAgente', {
            comando_texto: `executar ${skillEncontrada.skill_name}`,
            modo: skillEncontrada.modo_execucao_padrao || 'copilot',
            parametros: {}
          });

          return Response.json({
            success: true,
            response: `✅ **Skill "${skillEncontrada.display_name}" executada.**\n\n${JSON.stringify(resultado.data || resultado, null, 2)}`,
            run_id: null,
            agent_mode: 'direct_skill_execution',
            skill_name: skillEncontrada.skill_name
          });
        }
      }

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
        const userSector = user.attendant_sector || context?.user?.sector || 'geral';
        const userLevel = user.attendant_role || 'pleno';

        const sectorFocus = {
          vendas: 'Foco em leads, pipeline, orçamentos e fechamento.',
          assistencia: 'Foco em suporte técnico, chamados abertos, histórico de atendimento.',
          financeiro: 'Foco em cobranças, inadimplência, pagamentos pendentes.',
          fornecedor: 'Foco em compras, tabelas de preço, catálogo e negociação.',
          geral: 'Visão geral de todas as operações.'
        }[userSector] || 'Visão geral.';

        let analiseContatoPrompt = '';
        if (contextData.analiseContato) {
          analiseContatoPrompt = `\n📊 ANÁLISE DO CONTATO ATIVO:
• Prioridade: ${contextData.analiseContato.priority_label || 'N/A'} (score: ${contextData.analiseContato.priority_score || 0}/100)
• Deal Risk: ${contextData.analiseContato.deal_risk || 'N/A'}
• Buy Intent: ${contextData.analiseContato.buy_intent || 'N/A'}
• Relationship Profile: ${contextData.analiseContato.relationship_profile_type || 'N/A'}
• Dias Inativo: ${contextData.analiseContato.days_inactive_inbound || 0}
• Insights: ${contextData.analiseContato.insights_v2 || 'Nenhum insight disponível'}`;
        }

        const systemPrompt = `Você é o **Nexus AI**, assistente inteligente do CRM.

OPERADOR: ${user.full_name} | ${userLevel} | Setor: ${userSector}
FOCO: ${sectorFocus}

CONTEXTO OPERACIONAL (pré-buscado — DADOS REAIS):
• Vendas recentes: ${contextData.snapshot.vendas_count} | Receita: R$ ${contextData.snapshot.receita_total.toLocaleString('pt-BR')}
• Orçamentos em aberto: ${contextData.snapshot.orcamentos_count || 0} | Pipeline: R$ ${contextData.snapshot.pipeline_valor.toLocaleString('pt-BR')}
• Conversas ativas: ${contextData.snapshot.threads_nao_atribuidas} sem atendente
• Fila de trabalho: ${contextData.snapshot.fila_aberta} itens
• Execuções ativas: ${contextData.snapshot.runs_ativos}
${contextoMemoria}${analiseContatoPrompt}

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
4. Use execute_skill quando o usuário pedir AÇÃO (limpar, atualizar, followup, executar).
5. Use list_skills quando o usuário perguntar "o que você pode fazer", "quais skills".
6. Sempre cite dados reais. Seja objetivo, máximo 3 parágrafos.
7. Para ações executáveis, SEMPRE use execute_skill com modo apropriado (copilot para segurança, autonomous_safe para ações reversíveis).`;

        // ── Chamar Base44 AI nativo ───────────────────────────────────
        let text = '';
        let usedFallback = false;

        console.log('[AGENT-COMMAND] Chamando Base44 AI...');
        try {
          text = await callBase44AI(base44, systemPrompt, user_message, contextData);
        } catch (aiError) {
          console.warn('[AGENT-COMMAND] Base44 AI falhou, ativando fallback Gemini:', aiError.message);
          usedFallback = true;

          const fallbackPrompt = `${systemPrompt}

DADOS COMPLETOS DO CRM:
Orçamentos (${contextData.orcamentosTodos.length}): ${JSON.stringify(contextData.orcamentosTodos.slice(0, 10).map(o => ({ cliente: o.cliente_nome, status: o.status, valor: o.valor_total, vendedor: o.vendedor })))}
Vendas (${contextData.vendas.length}): ${JSON.stringify(contextData.vendas.slice(0, 10).map(v => ({ cliente: v.cliente_nome, valor: v.valor_total, status: v.status, data: v.data_venda })))}
Contatos (${contextData.contatos.length}): ${JSON.stringify(contextData.contatos.slice(0, 20).map(c => ({ nome: c.nome, empresa: c.empresa, classe_abc: c.classe_abc, tipo: c.tipo_contato })))}
Fila (${contextData.workQueue.length} abertos): ${JSON.stringify(contextData.workQueue.slice(0, 10).map(w => ({ tipo: w.tipo, severity: w.severity })))}

PERGUNTA: ${user_message}`;

          const iaResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: fallbackPrompt,
            model: 'gemini_3_flash'
          });
          text = typeof iaResponse === 'string' ? iaResponse : JSON.stringify(iaResponse);
          console.log('[AGENT-COMMAND] ✓ Fallback Gemini respondeu');
        }

        if (!text) text = 'Não foi possível gerar resposta. Tente novamente.';

        // ── Salvar execução ──────────────────────────────────────────
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime(),
          agent_mode: usedFallback ? 'fallback' : 'base44_ai'
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
            // C2: Criar novo registro em vez de sobrescrever
            await base44.asServiceRole.entities.NexusMemory.create(dadosMemoria);
            
            // Manter apenas últimas 5 sessões
            const tdasMemoriasSessao = await base44.asServiceRole.entities.NexusMemory.filter(
              { owner_user_id: userId, tipo: 'sessao' },
              '-created_date',
              100
            ).catch(() => []);
            if (tdasMemoriasSessao.length > 5) {
              const paraDeleter = tdasMemoriasSessao.slice(5).map(m => m.id);
              for (const id of paraDeleter) {
                await base44.asServiceRole.entities.NexusMemory.delete(id).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('[NEXUS-MEMORY] Erro ao salvar:', e.message);
          }
        })();

        return Response.json({
          success: true,
          response: text,
          run_id: run.id,
          agent_mode: usedFallback ? 'fallback' : 'base44_ai',
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

    if (command === 'save_session_memory') {
      const resumo = user_message || '';
      if (resumo && user?.id) {
        try {
          const dadosMemoria = {
            owner_user_id: user.id,
            tipo: 'sessao',
            conteudo: resumo.slice(0, 2000),
            ultima_acao: 'copiloto_ia',
            contexto: { page: context?.page || 'copiloto' },
            score_utilidade: 70
          };
          // C2: Criar novo registro em vez de sobrescrever
          await base44.asServiceRole.entities.NexusMemory.create(dadosMemoria);
          
          // Manter apenas últimas 5 sessões
          const tdasMemoriasSessao = await base44.asServiceRole.entities.NexusMemory.filter(
            { owner_user_id: user.id, tipo: 'sessao' },
            '-created_date',
            100
          ).catch(() => []);
          if (tdasMemoriasSessao.length > 5) {
            const paraDeleter = tdasMemoriasSessao.slice(5).map(m => m.id);
            for (const id of paraDeleter) {
              await base44.asServiceRole.entities.NexusMemory.delete(id).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[AGENT-COMMAND] Erro ao salvar memória sessão:', e.message);
        }
      }
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'Comando não suportado' }, { status: 400 });

  } catch (error) {
    console.error('[AGENT_COMMAND] Fatal:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});