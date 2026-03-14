import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * gerarTarefasDeAnalise — Converte ContactBehaviorAnalysis CRITICO/ALTO em TarefaInteligente
 * Trigger: Automação a cada 15 minutos
 * 
 * Flow:
 * 1. Buscar análises CRITICO/ALTO com next_best_action preenchido
 * 2. Verificar se já tem tarefa pendente (evitar duplicação)
 * 3. Criar TarefaInteligente com dados da análise
 * 4. Registrar em SkillExecution para auditoria
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
  const agora = new Date();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only
    if (user?.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403, headers: corsHeaders }
      );
    }

    const resultado = {
      analises_processadas: 0,
      tarefas_criadas: 0,
      duplicadas_ignoradas: 0,
      erros: 0
    };

    // 1️⃣ Buscar análises CRITICO/ALTO com next_best_action (limite reduzido para 5)
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
      priority_label: { $in: ['CRITICO', 'ALTO'] },
      contact_id: { $exists: true }
    }, '-analyzed_at', 5).catch(() => []);

    console.log(`[gerarTarefasDeAnalise] 📊 ${analises.length} análises CRITICO/ALTO encontradas`);

    const TIMEOUT_MS = 25000; // 25 segundos
    for (const analise of analises) {
      // Guard de timeout
      if (Date.now() - tsInicio > TIMEOUT_MS) {
        console.warn(`[gerarTarefas] ⏱️ Timeout de ${TIMEOUT_MS}ms atingido — abortando loop`);
        break;
      }

      try {
        resultado.analises_processadas++;

        // Validar se tem next_best_action
        if (!analise.next_best_action?.action) {
          console.log(`[gerarTarefas] ⚠️ Análise ${analise.id} sem next_best_action — pulando`);
          continue;
        }

        // 2️⃣ Verificar se já existe tarefa pendente para este contato
        const tarefasExistentes = await base44.asServiceRole.entities.TarefaInteligente.filter({
          contact_id: analise.contact_id,
          status: 'pendente'
        }, '-created_date', 1).catch(() => []);

        if (tarefasExistentes.length > 0) {
          resultado.duplicadas_ignoradas++;
          console.log(`[gerarTarefas] 🔕 Tarefa pendente já existe para ${analise.contact_id} — ignorando`);
          continue;
        }

        // Buscar contato para pegar nome e thread
        const contato = await base44.asServiceRole.entities.Contact.get(analise.contact_id).catch(() => null);
        
        // Buscar thread canônica para pegar vendedor
        let vendedor_responsavel = 'sistema';
        let thread_id = null;
        
        if (analise.contact_id) {
          try {
            const threads = await base44.asServiceRole.entities.MessageThread.filter({
              contact_id: analise.contact_id,
              is_canonical: true,
              status: 'aberta'
            }, '-last_message_at', 1);

            if (threads.length > 0) {
              thread_id = threads[0].id;
              if (threads[0].assigned_user_id) {
                const usuario = await base44.asServiceRole.entities.User.get(threads[0].assigned_user_id).catch(() => null);
                if (usuario?.full_name) {
                  vendedor_responsavel = usuario.full_name;
                }
              }
            }
          } catch (e) {
            console.warn(`[gerarTarefas] ⚠️ Erro ao buscar thread: ${e.message}`);
          }
        }

        // 3️⃣ Criar TarefaInteligente
        const prazo = new Date(agora);
        prazo.setDate(prazo.getDate() + 1); // Amanhã

        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: analise.next_best_action.action,
          descricao: `Análise de contato: ${contato?.nome || 'Cliente'} — Score urgência: ${analise.priority_score}`,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: analise.priority_label === 'CRITICO' ? 'critica' : 'alta',
          contact_id: analise.contact_id,
          cliente_nome: contato?.nome || 'Cliente',
          vendedor_responsavel: vendedor_responsavel,
          data_prazo: prazo.toISOString(),
          thread_id: thread_id,
          status: 'pendente',
          contexto_ia: {
            motivo_criacao: analise.next_best_action.rationale || 'Gerado por análise de comportamento',
            sugestoes_abordagem: [
              analise.next_best_action.suggested_message || 'Contactar cliente'
            ],
            score_urgencia: analise.priority_score,
            analise_id: analise.id,
            risk_level: analise.relationship_risk?.level || 'unknown'
          }
        });

        resultado.tarefas_criadas++;
        console.log(`[gerarTarefas] ✅ Tarefa criada para ${contato?.nome || analise.contact_id} (Score: ${analise.priority_score})`);

      } catch (err) {
        console.error(`[gerarTarefas] ❌ Erro ao processar análise ${analise.id}: ${err.message}`);
        resultado.erros++;
      }
    }

    // Registrar execução
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'gerar_tarefas_de_analise',
        triggered_by: 'automacao_agendada',
        execution_mode: 'autonomous_safe',
        context: {
          analises_processadas: resultado.analises_processadas,
          priority_levels: ['CRITICO', 'ALTO']
        },
        success: resultado.erros === 0,
        duration_ms: Date.now() - tsInicio,
        metricas: resultado
      }).catch(() => {});
    } catch (e) {
      console.warn('[gerarTarefas] SkillExecution falhou:', e.message);
    }

    console.log(`[gerarTarefas] ✅ Ciclo concluído:`, resultado);
    return Response.json({ success: true, resultado }, { headers: corsHeaders });

  } catch (error) {
    console.error('[gerarTarefas] ❌ Erro geral:', error.message);
    
    // Registrar erro no SkillExecution
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'gerar_tarefas_de_analise',
        triggered_by: 'automacao_agendada',
        execution_mode: 'autonomous_safe',
        success: false,
        duration_ms: Date.now() - tsInicio,
        error_message: error.message
      }).catch(() => {});
    } catch (e) {
      console.warn('[gerarTarefas] SkillExecution de erro falhou:', e.message);
    }
    
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});