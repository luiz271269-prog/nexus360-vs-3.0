// agentCommand - v3.0 (memória de sessão)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

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
        memoriaAtual = null;
      }

      const contextoMemoria = memoriaAtual
        ? `\nMEMÓRIA DA ÚLTIMA SESSÃO (${memoriaAtual.created_date?.slice(0, 10) || 'anterior'}):\n${memoriaAtual.conteudo}\nÚltima ação: ${memoriaAtual.ultima_acao || 'nenhuma'}`
        : '\nPrimeira sessão com este usuário — sem histórico anterior.';

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
        const [clientes, vendas, orcamentos, threads, workQueue, agentRuns] = await Promise.all([
          base44.asServiceRole.entities.Cliente.list('-updated_date', 20).catch(() => []),
          base44.asServiceRole.entities.Venda.list('-data_venda', 10).catch(() => []),
          base44.asServiceRole.entities.Orcamento.filter(
            { status: { $in: ['enviado', 'negociando', 'liberado'] } }, '-updated_date', 10
          ).catch(() => []),
          base44.asServiceRole.entities.MessageThread.filter(
            { status: 'aberta', thread_type: 'contact_external' }, '-last_message_at', 30
          ).catch(() => []),
          base44.asServiceRole.entities.WorkQueueItem.filter(
            { status: 'open' }, '-created_date', 10
          ).catch(() => []),
          base44.asServiceRole.entities.AgentRun.filter(
            { playbook_selected: 'nexus_brain', status: 'concluido' }, '-created_date', 5
          ).catch(() => [])
        ]);

        const threadsNaoAtribuidas = threads.filter(t => !t.assigned_user_id).length;
        const threadsAguardando = threads.filter(t => t.last_message_sender === 'contact').length;
        const receitaTotal = vendas.reduce((s, v) => s + (v.valor_total || 0), 0);
        const valorPipeline = orcamentos.reduce((s, o) => s + (o.valor_total || 0), 0);

        const systemPrompt = `Você é o **Nexus AI**, assistente do CRM VendaPro (Liesch Informática).

OPERADOR: ${user.full_name} | ${user.role === 'admin' ? 'Admin' : 'Atendente'} | Setor: ${context?.user?.sector || 'geral'} | Página: ${context?.page || 'Dashboard'}

SITUAÇÃO ATUAL:
• Clientes: ${clientes.length} (recentes)
• Vendas: ${vendas.length} | Receita: R$ ${receitaTotal.toLocaleString('pt-BR')}
• Orçamentos em aberto: ${orcamentos.length} | Pipeline: R$ ${valorPipeline.toLocaleString('pt-BR')}
• Conversas ativas: ${threads.length} | Sem atendente: ${threadsNaoAtribuidas} ⚠️ | Aguardando: ${threadsAguardando}
• Fila de trabalho: ${workQueue.length} itens abertos
• Nexus Brain (IA): ${agentRuns.length} ações recentes

${orcamentos.length > 0 ? `ORÇAMENTOS PENDENTES:\n${orcamentos.slice(0, 5).map(o => `• ${o.cliente_nome} — R$ ${o.valor_total?.toLocaleString('pt-BR')} (${o.status})`).join('\n')}` : ''}

${workQueue.length > 0 ? `FILA DE TRABALHO:\n${workQueue.slice(0, 5).map(w => `• ${(w.notes || w.tipo || '').slice(0, 100)}`).join('\n')}` : ''}
${contextoMemoria}

PERGUNTA: ${user_message}

Responda em português, seja direto e acionável. Máximo 3 parágrafos. Sugira próximos passos concretos quando relevante.`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1500,
          messages: [{ role: 'user', content: systemPrompt }]
        });

        const text = response.content[0]?.text || 'Não foi possível gerar resposta.';

        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        // ── Salvar memória de sessão (fire-and-forget) ──────────────
        (async () => {
          try {
            const resumoSessao = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Resumir em no máximo 5 linhas o que foi discutido nesta sessão do Nexus AI. Seja objetivo. Foque no que o usuário quis fazer e o que o sistema fez.\n\nPergunta do usuário: ${user_message}\nResposta resumida: ${text.slice(0, 300)}`
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

        return Response.json({ success: true, response: text, run_id: run.id, agent_mode: 'assistente' });

      } catch (error) {
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'falhou',
          error_message: error.message,
          completed_at: new Date().toISOString()
        });
        throw error;
      }
    }

    return Response.json({ success: false, error: 'Comando não suportado' }, { status: 400 });

  } catch (error) {
    console.error('[AGENT_COMMAND] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});