// agentCommand - v6.0 (Resiliência Nativa sem Middleware)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ANALYST_TOOLS = [
  {
    name: 'get_contact_analysis',
    description: 'MCP Tool: Busca análise comportamental profunda de um contato (prioridade, deal risk, buy intent, insights). Use quando precisar entender a qualidade/fit do contato.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: {
          type: 'string',
          description: 'ID do contato a analisar'
        }
      },
      required: ['contact_id']
    }
  },
  {
    name: 'get_thread_messages',
    description: 'Lê últimas N mensagens de uma conversa (MessageThread). Use quando o usuário perguntar sobre o que foi conversado com um cliente, contexto da última conversa, ou pedir resumo de thread. Identificar thread_id via query_database{entidade:Contact,filtros:{nome:"X"}} primeiro.',
    input_schema: {
      type: 'object',
      properties: {
        thread_id: { type: 'string', description: 'ID da MessageThread' },
        limite: { type: 'number', description: 'Quantas mensagens retornar (default 30, máx 100)' }
      },
      required: ['thread_id']
    }
  },
  {
    name: 'get_contact_full_profile',
    description: 'Retorna perfil completo de um contato: dados básicos, classificação ABC, tags, última interação, vendedor responsável, threads ativas e análise comportamental. Use quando usuário pedir "ver tudo sobre cliente X" ou "perfil completo de Y".',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' }
      },
      required: ['contact_id']
    }
  },
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
  if (toolName === 'get_contact_analysis') {
    // MCP: Lazy-load análise sob demanda
    try {
      const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
        { contact_id: toolInput.contact_id },
        '-analyzed_at',
        1
      ).catch(() => []);
      const analise = analises[0];
      if (!analise) {
        return { error: 'Análise não disponível para este contato' };
      }
      return {
        contact_id: analise.contact_id,
        prioridade: analise.priority_label,
        score: analise.priority_score,
        deal_risk: analise.deal_risk,
        buy_intent: analise.buy_intent,
        relationship: analise.relationship_profile_type,
        dias_inativo: analise.days_inactive_inbound,
        insights: analise.insights_v2
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  if (toolName === 'get_thread_messages') {
    try {
      const limite = Math.min(toolInput.limite || 30, 100);
      const mensagens = await base44.asServiceRole.entities.Message.filter(
        { thread_id: toolInput.thread_id },
        '-created_date',
        limite
      );
      const thread = await base44.asServiceRole.entities.MessageThread.filter({ id: toolInput.thread_id }, '-created_date', 1).catch(() => []);
      return {
        thread_id: toolInput.thread_id,
        thread_status: thread[0]?.status,
        contact_id: thread[0]?.contact_id,
        total: mensagens.length,
        mensagens: mensagens.reverse().map(m => ({
          quando: m.created_date,
          de: m.sender_type === 'user' ? 'atendente' : 'cliente',
          tipo: m.media_type !== 'none' ? m.media_type : 'texto',
          conteudo: m.content?.slice(0, 300) || ''
        }))
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  if (toolName === 'get_contact_full_profile') {
    try {
      const [contatoArr, threads, analiseArr] = await Promise.all([
        base44.asServiceRole.entities.Contact.filter({ id: toolInput.contact_id }, '-created_date', 1).catch(() => []),
        base44.asServiceRole.entities.MessageThread.filter({ contact_id: toolInput.contact_id }, '-last_message_at', 5).catch(() => []),
        base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({ contact_id: toolInput.contact_id }, '-analyzed_at', 1).catch(() => [])
      ]);
      const contato = contatoArr[0];
      if (!contato) return { error: 'Contato não encontrado' };
      const analise = analiseArr[0];
      return {
        contato: {
          id: contato.id,
          nome: contato.nome,
          telefone: contato.telefone,
          empresa: contato.empresa,
          tipo: contato.tipo_contato,
          classe_abc: contato.classe_abc,
          score_abc: contato.score_abc,
          tags: contato.tags || [],
          vendedor: contato.vendedor_responsavel,
          ultima_interacao: contato.ultima_interacao,
          observacoes: contato.observacoes
        },
        threads_recentes: threads.map(t => ({
          id: t.id,
          status: t.status,
          last_message_at: t.last_message_at,
          last_message: t.last_message_content?.slice(0, 100),
          assigned_user_id: t.assigned_user_id,
          unread: t.unread_count
        })),
        analise_comportamental: analise ? {
          prioridade: analise.priority_label,
          score: analise.priority_score,
          deal_risk: analise.deal_risk,
          buy_intent: analise.buy_intent,
          dias_inativo: analise.days_inactive_inbound
        } : null
      };
    } catch (e) {
      return { error: e.message };
    }
  }

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
    // MCP: Lazy-load análise (não pre-fetch)
    // Deixar LLM decidir se precisa chamar tool 'get_contact_analysis'

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

async function callBase44AI(base44, systemPrompt, userMessage, contextData, fileUrls = null) {
  const prompt = `${systemPrompt}\n\nUSUÁRIO PERGUNTA: ${userMessage}`;
  
  try {
    const llmPayload = {
      prompt: prompt,
      add_context_from_internet: false
    };
    // Se tem anexos, usar modelo multimodal (sem forçar gpt_5 que pode não suportar visão)
    if (Array.isArray(fileUrls) && fileUrls.length > 0) {
      llmPayload.file_urls = fileUrls;
    } else {
      llmPayload.model = 'gpt_5';
    }
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM(llmPayload);
    
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

    const { command, user_message, context, file_urls } = await req.json();

    if (command === 'chat') {
      console.log('[AGENT-COMMAND] Chat iniciado:', user_message.slice(0, 50), '| Anexos:', file_urls?.length || 0);
      const userId = user.id;

      // ── FLUXO NEURALTEC: detectar comando de promoção com imagem ──
      const msgLowerNT = (user_message || '').toLowerCase();
      const temAnexos = Array.isArray(file_urls) && file_urls.length > 0;
      const ehComandoPromocao = temAnexos && (
        msgLowerNT.includes('promoç') || msgLowerNT.includes('promoc') ||
        msgLowerNT.includes('folder') || msgLowerNT.includes('cotaç') ||
        msgLowerNT.includes('cotac') || msgLowerNT.includes('precific') ||
        msgLowerNT.includes('divulg') || msgLowerNT.includes('campanha')
      );

      if (ehComandoPromocao) {
        try {
          console.log('[AGENT-COMMAND] 🎯 Fluxo NeuralTec ativado');

          const extrResp = await base44.asServiceRole.functions.invoke('extrairProdutosDaImagem', {
            file_urls,
            margem: 1.40
          });
          const extr = extrResp?.data || extrResp;

          if (!extr?.success || !extr.produtos || extr.produtos.length === 0) {
            return Response.json({
              success: true,
              response: '⚠️ Não consegui identificar produtos com preço na imagem. Verifique se a cotação está legível e tente novamente.',
              agent_mode: 'neuraltec_no_products'
            });
          }

          const criarResp = await base44.asServiceRole.functions.invoke('criarPromocoesNeuralTec', {
            produtos: extr.produtos,
            fornecedor_nome: extr.fornecedor_nome
          });
          const criar = criarResp?.data || criarResp;

          // Sprint 3: gerar folder visual via GenerateImage
          let folderInfo = '';
          let folderUrl = null;
          try {
            const folderResp = await base44.asServiceRole.functions.invoke('gerarFolderPromocional', {
              promotion_ids: criar?.promotion_ids || [],
              salvar_em_promotions: true
            });
            const folder = folderResp?.data || folderResp;
            if (folder?.success && folder.folder_url) {
              folderUrl = folder.folder_url;
              folderInfo = `\n\n🎨 **Folder gerado:** [Ver imagem](${folder.folder_url})`;
            } else {
              folderInfo = `\n\n⚠️ Promoções criadas mas folder visual falhou (gere manualmente em /Promocoes).`;
            }
          } catch (errFolder) {
            console.warn('[AGENT-COMMAND] Folder falhou:', errFolder.message);
            folderInfo = `\n\n⚠️ Folder visual falhou: ${errFolder.message}`;
          }

          const listaProdutos = extr.produtos.map((p, i) =>
            `${i + 1}. **${p.nome}**${p.codigo ? ` (${p.codigo})` : ''}\n   Custo: R$ ${p.custo.toFixed(2).replace('.', ',')} → Venda: **R$ ${p.preco_venda.toFixed(2).replace('.', ',')}** _(margem 40%)_`
          ).join('\n\n');

          const resposta = `🎯 **Cotação processada — ${extr.fornecedor_nome || 'Fornecedor'}**\n\n📦 **${extr.total_extraidos} produtos identificados:**\n\n${listaProdutos}\n\n✅ **${criar?.total_criadas || 0} promoções criadas** (rascunho — \`ativo: false\`)\n📅 Validade: ${criar?.validade}\n🏷️ Campanha: \`${criar?.campaign_id}\`${folderInfo}\n\n👉 **Próximo passo:** Acesse **/Promocoes**, revise, ative e use "Enviar em Massa".${criar?.errors?.length ? `\n\n⚠️ ${criar.errors.length} erro(s) ao criar.` : ''}`;

          return Response.json({
            success: true,
            response: resposta,
            agent_mode: 'neuraltec_promo_created',
            promotion_ids: criar?.promotion_ids || [],
            campaign_id: criar?.campaign_id,
            folder_url: folderUrl
          });
        } catch (errNT) {
          console.error('[AGENT-COMMAND] Erro fluxo NeuralTec:', errNT);
          return Response.json({
            success: false,
            response: `❌ Erro ao processar cotação: ${errNT.message}`,
            agent_mode: 'neuraltec_error'
          });
        }
      }

      // ── Pré-buscar dados em paralelo (não depende de IA) ──────────────
      const contactIdFromContext = context?.contact_id;
      const contextData = await fetchContextData(base44, contactIdFromContext);

      // ── Carregar últimas 5 sessões para contexto contínuo ──────────
      let memoriasAnteriores = [];
      try {
        memoriasAnteriores = await base44.asServiceRole.entities.NexusMemory.filter(
          { owner_user_id: userId, tipo: 'sessao' }, '-created_date', 5
        );
      } catch (e) {
        console.warn('[AGENT-COMMAND] NexusMemory não disponível:', e.message);
      }

      const contextoMemoria = memoriasAnteriores.length > 0
        ? `\nHISTÓRICO DAS ÚLTIMAS ${memoriasAnteriores.length} SESSÕES (mais recente primeiro):\n` +
          memoriasAnteriores.map((m, i) => `[${i + 1}] ${m.conteudo}`).join('\n---\n')
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

⚠️ MCP TOOLS DISPONÍVEIS: use 'get_contact_analysis' se precisar de insights do contato ativo (prioridade, deal risk, buy intent).

SCHEMA DAS ENTIDADES (use ao montar filtros no query_database):
• Contact: id, nome, telefone, empresa, tipo_contato(novo/lead/cliente/fornecedor/parceiro), classe_abc(A/B/C), score_abc, tags[], vendedor_responsavel, ultima_interacao
• MessageThread: id, contact_id, status(aberta/fechada), assigned_user_id, last_message_at, sector_id, thread_type(contact_external/team_internal)
• Orcamento: id, cliente_nome, vendedor, status(rascunho/enviado/negociando/aprovado/rejeitado/vencido), valor_total, data_vencimento
• Venda: id, cliente_nome, vendedor, data_venda, valor_total, status(Pendente/Faturado/Entregue/Cancelado)
• WorkQueueItem: id, tipo, contact_id, status(open/done/dismissed), severity(low/medium/high/critical)
• Cliente: id, razao_social, nome_fantasia, status(novo_lead/qualificado/Ativo/Inativo), vendedor_id

INSTRUÇÕES:
1. Use get_contact_analysis (MCP) para insights do contato — não pre-busca.
2. Use get_thread_messages quando perguntarem "o que conversamos", "última mensagem", "resumir conversa".
3. Use get_contact_full_profile para perfil completo (dados + threads + análise).
4. Use query_database com filtros corretos baseados no schema acima.
5. Use search_knowledge para produtos, preços, políticas.
6. Use save_to_knowledge quando o usuário ENSINAR algo novo.
7. Use execute_skill quando o usuário pedir AÇÃO executável.
8. Sempre cite dados reais. Seja objetivo, máximo 3 parágrafos.`;

        // ── Chamar Base44 AI nativo ───────────────────────────────────
        let text = '';
        let usedFallback = false;

        console.log('[AGENT-COMMAND] Chamando Base44 AI...');
        try {
          text = await callBase44AI(base44, systemPrompt, user_message, contextData, file_urls);
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
          // ✅ DEDUPLICAÇÃO: checar se já existe sessão idêntica nas últimas 2 horas
          const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
          const sessoeRecentes = await base44.asServiceRole.entities.NexusMemory.filter(
            { 
              owner_user_id: user.id, 
              tipo: 'sessao',
              created_date: { $gte: duasHorasAtras.toISOString() }
            },
            '-created_date',
            5
          ).catch(() => []);

          // Se conteúdo idêntico ao da última sessão, pular
          if (sessoeRecentes.length > 0 && sessoeRecentes[0].conteudo === resumo.slice(0, 2000)) {
            console.log('[AGENT-COMMAND] ⏭️ Sessão duplicada — não gravando');
            return Response.json({ success: true, duplicada: true });
          }

          const dadosMemoria = {
            owner_user_id: user.id,
            tipo: 'sessao',
            conteudo: resumo.slice(0, 2000),
            ultima_acao: 'copiloto_ia',
            contexto: { page: context?.page || 'copiloto' },
            score_utilidade: 70
          };
          await base44.asServiceRole.entities.NexusMemory.create(dadosMemoria);
          
          // Manter apenas últimas 5 sessões (sem duplicatas)
          const todasSessoes = await base44.asServiceRole.entities.NexusMemory.filter(
            { owner_user_id: user.id, tipo: 'sessao' },
            '-created_date',
            100
          ).catch(() => []);
          if (todasSessoes.length > 5) {
            const paraDeleter = todasSessoes.slice(5).map(m => m.id);
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