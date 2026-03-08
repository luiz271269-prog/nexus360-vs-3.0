import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('[JARVIS] 🔄 Event Loop iniciado...');
    
    const resultados = {
      eventos_processados: 0,
      threads_processadas: 0,
      orcamentos_processados: 0,
      erros: 0
    };

    // 1. Processar eventos novos do sistema
    const eventos = await base44.asServiceRole.entities.EventoSistema.filter({
      processado: false
    }, '-timestamp', 20);

    for (const evento of eventos) {
      try {
        // Determinar qual playbook usar
        let playbook = 'generic';
        
        if (evento.tipo_evento === 'message.inbound' && evento.detalhes?.has_url) {
          playbook = 'link_intelligence';
        }

        // Criar AgentRun
        await base44.asServiceRole.entities.AgentRun.create({
          trigger_type: evento.tipo_evento,
          trigger_event_id: evento.id,
          playbook_selected: playbook,
          execution_mode: 'assistente',
          status: 'concluido',
          context_snapshot: {
            evento_tipo: evento.tipo_evento,
            evento_detalhes: evento.detalhes
          },
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0
        });

        // Marcar como processado
        await base44.asServiceRole.entities.EventoSistema.update(evento.id, {
          processado: true
        });

        resultados.eventos_processados++;
      } catch (error) {
        console.error('[JARVIS] Erro ao processar evento:', error);
        resultados.erros++;
      }
    }

    // 2. Verificar threads sem resposta (últimos 30min)
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000);
    const threadsSemResposta = await base44.asServiceRole.entities.MessageThread.filter({
      last_message_sender: 'contact',
      last_message_at: { $lt: trintaMinAtras.toISOString() },
      assigned_user_id: { $exists: true },
      unread_count: { $gt: 0 }
    }, '-last_message_at', 10);

    for (const thread of threadsSemResposta) {
      try {
        // Criar lembrete/alerta
        await base44.asServiceRole.entities.AgentRun.create({
          trigger_type: 'thread.idle',
          trigger_event_id: thread.id,
          playbook_selected: 'follow_up_reminder',
          execution_mode: 'assistente',
          status: 'concluido',
          context_snapshot: {
            thread_id: thread.id,
            tempo_sem_resposta_min: 30,
            unread_count: thread.unread_count
          },
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0
        });

        resultados.threads_processadas++;
      } catch (error) {
        console.error('[JARVIS] Erro thread:', error);
        resultados.erros++;
      }
    }

    // 3. Verificar orçamentos parados (> 7 dias)
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const orcamentosParados = await base44.asServiceRole.entities.Orcamento.filter({
      status: 'enviado',
      updated_date: { $lt: seteDiasAtras.toISOString() }
    }, '-updated_date', 10);

    for (const orcamento of orcamentosParados) {
      try {
        // Criar tarefa de follow-up
        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: `Follow-up: Orçamento ${orcamento.numero_orcamento}`,
          descricao: `Orçamento de R$ ${orcamento.valor_total?.toLocaleString('pt-BR')} parado há 7+ dias`,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: 'alta',
          cliente_nome: orcamento.cliente_nome,
          orcamento_id: orcamento.id,
          vendedor_responsavel: orcamento.vendedor,
          data_prazo: new Date().toISOString(),
          contexto_ia: {
            motivo_criacao: 'Agente autônomo - orçamento parado',
            criado_por: 'jarvis'
          }
        });

        resultados.orcamentos_processados++;
      } catch (error) {
        console.error('[JARVIS] Erro orcamento:', error);
        resultados.erros++;
      }
    }

    console.log('[JARVIS] ✅ Ciclo concluído:', resultados);

    return Response.json({
      success: true,
      resultados
    });

  } catch (error) {
    console.error('[JARVIS] ❌ Erro geral:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});