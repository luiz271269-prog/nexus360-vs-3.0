import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { command, user_message, context } = await req.json();

    if (command === 'chat') {
      // 1. Criar AgentRun
      const run = await base44.asServiceRole.entities.AgentRun.create({
        trigger_type: 'manual.invoke',
        trigger_event_id: `chat_${Date.now()}`,
        playbook_selected: 'nexus_chat',
        execution_mode: 'assistente',
        status: 'processando',
        context_snapshot: {
          user_id: user.id,
          user_role: user.role,
          user_sector: context?.user?.sector || 'geral',
          page: context?.page || 'unknown',
          path: context?.path || '/',
          message: user_message
        },
        started_at: new Date().toISOString()
      });

      try {
        // 2. Buscar contexto do sistema (limitado para não estourar rate limit)
        const [
          clientesRecentes,
          vendasRecentes,
          orcamentosRecentes,
          threadsRecentes
        ] = await Promise.all([
          base44.asServiceRole.entities.Cliente.list('-updated_date', 5).catch(() => []),
          base44.asServiceRole.entities.Venda.list('-data_venda', 5).catch(() => []),
          base44.asServiceRole.entities.Orcamento.list('-updated_date', 5).catch(() => []),
          base44.asServiceRole.entities.MessageThread.list('-last_message_at', 10).catch(() => [])
        ]);

        const orcamentosPendentes = orcamentosRecentes.filter(o => 
          o.status === 'enviado' || o.status === 'negociando'
        ).length;

        const threadsNaoAtribuidas = threadsRecentes.filter(t => 
          !t.assigned_user_id && t.thread_type === 'contact_external'
        ).length;

        // 3. Construir prompt contextual
        const promptCompleto = `Você é o **Nexus AI**, assistente inteligente do **VendaPro**.

**PERFIL DO USUÁRIO:**
- Nome: ${user.full_name}
- Email: ${user.email}
- Cargo: ${user.role === 'admin' ? 'Administrador' : 'Usuário'}
- Setor: ${context?.user?.sector || 'Não definido'}
- Nível: ${context?.user?.level || 'Não definido'}
- Página atual: ${context?.page || 'Desconhecida'}

**CONTEXTO DO SISTEMA:**
- Clientes recentes: ${clientesRecentes.length}
- Vendas recentes: ${vendasRecentes.length}
- Orçamentos pendentes: ${orcamentosPendentes}
- Conversas não atribuídas: ${threadsNaoAtribuidas}

**PERGUNTA DO USUÁRIO:**
${user_message}

**INSTRUÇÕES:**
- Use os dados reais fornecidos
- Seja objetivo e acionável
- Sugira próximos passos concretos
- Se identificar problemas, mencione proativamente
- Adapte ao nível de acesso do usuário

Responda de forma útil e contextual:`;

        // 4. Chamar LLM
        const response = await base44.integrations.Core.InvokeLLM({
          prompt: promptCompleto,
          add_context_from_internet: false
        });

        // 5. Registrar decisão
        await base44.asServiceRole.entities.AgentDecisionLog.create({
          agent_run_id: run.id,
          step_name: 'chat_response',
          decisao_tipo: 'sugestao_resposta',
          ferramentas_usadas: ['InvokeLLM'],
          decisao_tomada: {
            resposta: response.substring(0, 500), // Limitar para não explodir DB
            contexto_usado: {
              clientes: clientesRecentes.length,
              vendas: vendasRecentes.length,
              orcamentos: orcamentosRecentes.length
            }
          },
          confianca_ia: 75,
          resultado_execucao: 'sucesso',
          timestamp_decisao: new Date().toISOString()
        });

        // 6. Finalizar run
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        return Response.json({
          success: true,
          response,
          run_id: run.id,
          agent_mode: 'assistente'
        });

      } catch (error) {
        console.error('[AGENT_COMMAND] Erro ao processar:', error);

        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'falhou',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        throw error;
      }
    }

    return Response.json({ 
      success: false,
      error: 'Comando não suportado' 
    }, { status: 400 });

  } catch (error) {
    console.error('[AGENT_COMMAND] Erro geral:', error);

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});