import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * gerarTarefasIADaMetricas
 * 
 * Conecta ContactBehaviorAnalysis → TarefaInteligente
 * Trigger: Automação agendada 30 minutos
 * 
 * 1. Busca análises CRITICO/ALTO com next_best_action
 * 2. Verifica duplicação
 * 3. Busca thread + vendedor responsável
 * 4. Cria TarefaInteligente acionável
 * 5. Registra SkillExecution para auditoria
 */

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403, headers: corsHeaders }
      );
    }

    const metricas = {
      analises_processadas: 0,
      tarefas_criadas: 0,
      duplicadas_ignoradas: 0,
      erros: 0
    };

    // 1️⃣ Buscar análises CRITICO/ALTO com next_best_action
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
      priority_label: { $in: ['CRITICO', 'ALTO'] }
    }, '-priority_score', 20).catch(() => []);

    console.log(`[gerarTarefasIADaMetricas] 📊 ${analises.length} análises CRITICO/ALTO encontradas`);

    for (const analise of analises) {
      try {
        metricas.analises_processadas++;

        // Validar next_best_action
        if (!analise.next_best_action?.action || !analise.contact_id) {
          console.log(`[gerarTarefasIADaMetricas] ⚠️ Análise ${analise.id} incompleta — pulando`);
          continue;
        }

        // 2️⃣ Verificar duplicação
        const tarefasExistentes = await base44.asServiceRole.entities.TarefaInteligente.filter({
          cliente_id: analise.contact_id,
          status: 'pendente'
        }, '-created_date', 1).catch(() => []);

        if (tarefasExistentes.length > 0) {
          metricas.duplicadas_ignoradas++;
          console.log(`[gerarTarefasIADaMetricas] 🔕 Tarefa pendente já existe para ${analise.contact_id}`);
          continue;
        }

        // 3️⃣ Buscar thread + vendedor
        let vendedor_responsavel = 'sem atribuição';
        
        try {
          const threads = await base44.asServiceRole.entities.MessageThread.filter({
            contact_id: analise.contact_id
          }, '-last_message_at', 1).catch(() => []);

          if (threads.length > 0 && threads[0].assigned_user_id) {
            const vendedor = await base44.asServiceRole.entities.User.get(
              threads[0].assigned_user_id
            ).catch(() => null);

            if (vendedor?.full_name) {
              vendedor_responsavel = vendedor.full_name;
            }
          }
        } catch (e) {
          console.warn(`[gerarTarefasIADaMetricas] ⚠️ Erro ao buscar vendedor: ${e.message}`);
        }

        // 4️⃣ Criar TarefaInteligente
        const prazo = new Date(Date.now() + 86400000); // +1 dia

        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: analise.next_best_action.action,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: analise.priority_label === 'CRITICO' ? 'critica' : 'alta',
          cliente_id: analise.contact_id,
          vendedor_responsavel: vendedor_responsavel,
          data_prazo: prazo.toISOString(),
          status: 'pendente',
          contexto_ia: {
            motivo_criacao: analise.next_best_action.rationale || 'Análise comportamental',
            sugestoes_abordagem: [analise.next_best_action.suggested_message || analise.next_best_action.action],
            score_urgencia: analise.priority_score
          }
        });

        metricas.tarefas_criadas++;
        console.log(`[gerarTarefasIADaMetricas] ✅ Tarefa criada | Score: ${analise.priority_score}`);

      } catch (err) {
        console.error(`[gerarTarefasIADaMetricas] ❌ ${err.message}`);
        metricas.erros++;
      }
    }

    // 5️⃣ Registrar SkillExecution
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'gerar_tarefas_ia',
        triggered_by: 'automacao_agendada',
        execution_mode: 'autonomous_safe',
        context: {
          analises_processadas: metricas.analises_processadas,
          priority_levels: ['CRITICO', 'ALTO']
        },
        success: metricas.erros === 0,
        duration_ms: Date.now() - tsInicio,
        metricas: metricas
      }).catch(() => {});
    } catch (e) {
      console.warn('[gerarTarefasIADaMetricas] SkillExecution failed:', e.message);
    }

    console.log('[gerarTarefasIADaMetricas] ✅ Ciclo concluído:', metricas);
    return Response.json({ success: true, metricas }, { headers: corsHeaders });

  } catch (error) {
    console.error('[gerarTarefasIADaMetricas] ❌ Erro geral:', error.message);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});