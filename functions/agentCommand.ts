// agentCommand - v2.0 (usa Claude direto com contexto rico)
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
      const run = await base44.asServiceRole.entities.AgentRun.create({
        trigger_type: 'manual.invoke',
        trigger_event_id: `chat_${Date.now()}`,
        playbook_selected: 'nexus_chat',
        execution_mode: 'assistente',
        status: 'processando',
        context_snapshot: { user_id: user.id, page: context?.page, message: user_message },
        started_at: new Date().toISOString()
      });

      try {
        // Contexto rico: 5x mais dados que antes
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

        const prompt = `Você é o **Nexus AI**, assistente do CRM VendaPro (Liesch Informática).

OPERADOR: ${user.full_name} | ${user.role === 'admin' ? 'Admin' : 'Atendente'} | Setor: ${context?.user?.sector || 'geral'} | Página: ${context?.page || 'Dashboard'}

SITUAÇÃO ATUAL:
• Clientes: ${clientes.length} (recentes)
• Vendas: ${vendas.length} | Receita: R$ ${receitaTotal.toLocaleString('pt-BR')}
• Orçamentos em aberto: ${orcamentos.length} | Pipeline: R$ ${valorPipeline.toLocaleString('pt-BR')}
• Conversas ativas: ${threads.length} | Sem atendente: ${threadsNaoAtribuidas} ⚠️ | Aguardando resposta: ${threadsAguardando}
• Fila de trabalho: ${workQueue.length} itens abertos
• Nexus Brain (IA): ${agentRuns.length} ações recentes

${orcamentos.length > 0 ? `ORÇAMENTOS PENDENTES:
${orcamentos.slice(0, 5).map(o => `• ${o.cliente_nome} — R$ ${o.valor_total?.toLocaleString('pt-BR')} (${o.status})`).join('\n')}` : ''}

${workQueue.length > 0 ? `FILA DE TRABALHO:
${workQueue.slice(0, 5).map(w => `• ${(w.notes || w.tipo || '').slice(0, 100)}`).join('\n')}` : ''}

PERGUNTA: ${user_message}

Responda em português, seja direto e acionável. Máximo 3 parágrafos. Sugira próximos passos concretos quando relevante.`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content[0]?.text || 'Não foi possível gerar resposta.';

        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

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