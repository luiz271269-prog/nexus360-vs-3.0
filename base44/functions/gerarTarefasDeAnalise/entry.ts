import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * gerarTarefasDeAnalise — Converte ContactBehaviorAnalysis CRITICO/ALTO em TarefaInteligente
 * Trigger: Automação a cada 15 minutos
 * 
 * Flow:
 * 1. Buscar análises CRITICO/ALTO com next_best_action preenchido
 * 2. Verificar se já tem tarefa pendente (evitar duplicação) — parallelizado
 * 3. Criar TarefaInteligente com dados da análise
 * 4. Registrar em SkillExecution para auditoria (non-blocking)
 * 
 * ✅ FIX: Removido auth check (automação), parallelismo em queries, timeout de 45s
 */

const MAX_CICLO_MS = 30_000; // 30s máximo para deixar margem (timeout 60s total)

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
    // ✅ FIX: Em contexto agendado, req vem vazio
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.log('[gerarTarefasDeAnalise] Contexto agendado detectado, usando createClient()');
      base44 = createClient();
    }

    const resultado = {
      analises_processadas: 0,
      tarefas_criadas: 0,
      duplicadas_ignoradas: 0,
      erros: 0
    };

    // 1️⃣ Buscar análises CRITICO/ALTO (reduzido de 8 para 5 para evitar timeout)
    const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
      priority_label: { $in: ['CRITICO', 'ALTO'] },
      contact_id: { $exists: true }
    }, '-analyzed_at', 5).catch(() => []);

    console.log(`[gerarTarefasDeAnalise] 📊 ${analises.length} análises CRITICO/ALTO encontradas`);

    // ✅ OTIMIZADO: Pré-buscar todas tarefas pendentes UMA VEZ (não dentro do loop)
    const todasTarefasPendentes = await base44.asServiceRole.entities.TarefaInteligente.filter({
      status: 'pendente'
    }, '-created_date', 100).catch(() => []);
    const contatosTarefaPendente = new Set(todasTarefasPendentes.map(t => t.cliente_id || t.contact_id).filter(Boolean));

    // ✅ FIX: Processar com timeout e sem queries pesadas no loop
    for (const analise of analises) {
      // Guard de timeout
      if (Date.now() - tsInicio > MAX_CICLO_MS) {
        console.warn(`[gerarTarefasDeAnalise] ⏱️ Timeout de ${MAX_CICLO_MS}ms atingido — abortando loop`);
        break;
      }

      try {
        resultado.analises_processadas++;

        // Validar se tem next_best_action
        if (!analise.next_best_action?.action) {
          console.log(`[gerarTarefasDeAnalise] ⚠️ Análise ${analise.id} sem next_best_action — pulando`);
          continue;
        }

        // 2️⃣ Verificar se já existe tarefa pendente (lookup em Set, O(1))
        if (contatosTarefaPendente.has(analise.contact_id)) {
          resultado.duplicadas_ignoradas++;
          console.log(`[gerarTarefasDeAnalise] 🔕 Tarefa pendente já existe para ${analise.contact_id} — ignorando`);
          continue;
        }

        // ✅ FIX: Buscar contato + thread em PARALELO
        const [contato, threads] = await Promise.all([
          base44.asServiceRole.entities.Contact.get(analise.contact_id).catch(() => null),
          analise.contact_id
            ? base44.asServiceRole.entities.MessageThread.filter({
                contact_id: analise.contact_id,
                is_canonical: true,
                status: 'aberta'
              }, '-last_message_at', 1).catch(() => [])
            : Promise.resolve([])
        ]);

        let vendedor_responsavel = 'sistema';
        let atendente_user_id = null;
        let thread_id = null;

        if (threads?.length > 0) {
          thread_id = threads[0].id;
          // Se thread tem assigned_user_id, buscar nome do usuário
          if (threads[0].assigned_user_id) {
            const usuario = await base44.asServiceRole.entities.User.get(threads[0].assigned_user_id).catch(() => null);
            if (usuario?.full_name) {
              vendedor_responsavel = usuario.full_name;
              atendente_user_id = usuario.id;
            }
          } else if (threads[0].sector_id) {
            // Fallback: buscar atendente disponível do setor
            const usuarios = await base44.asServiceRole.entities.User.filter({
              'data.attendant_sector': threads[0].sector_id,
              'data.is_active': true
            }, '-created_date', 1).catch(() => []);
            if (usuarios.length > 0) {
              vendedor_responsavel = usuarios[0].full_name || usuarios[0].email;
              atendente_user_id = usuarios[0].id;
            }
          }
        }

        // Fallback final: usar vendedor_responsavel do contato se tiver
        if (vendedor_responsavel === 'sistema' && contato?.vendedor_responsavel) {
          vendedor_responsavel = contato.vendedor_responsavel;
        }

        // 3️⃣ Criar TarefaInteligente
        const prazo = new Date(agora);
        prazo.setDate(prazo.getDate() + 1); // Amanhã

        await base44.asServiceRole.entities.TarefaInteligente.create({
          titulo: analise.next_best_action.action,
          descricao: `Análise de contato: ${contato?.nome || 'Cliente'} — Score urgência: ${analise.priority_score}`,
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: analise.priority_label === 'CRITICO' ? 'critica' : 'alta',
          cliente_id: analise.contact_id,
          cliente_nome: contato?.nome || 'Cliente',
          vendedor_responsavel: vendedor_responsavel,
          data_prazo: prazo.toISOString(),
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
        console.log(`[gerarTarefasDeAnalise] ✅ Tarefa criada para ${contato?.nome || analise.contact_id} (Score: ${analise.priority_score})`);

      } catch (err) {
        console.error(`[gerarTarefasDeAnalise] ❌ Erro ao processar análise ${analise.id}: ${err.message}`);
        resultado.erros++;
      }
    }

    const duracao = Date.now() - tsInicio;

    // ✅ FIX: Registrar execução em background (non-blocking)
    base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'gerar_tarefas_de_analise',
      triggered_by: 'automacao_agendada',
      execution_mode: 'autonomous_safe',
      context: {
        analises_processadas: resultado.analises_processadas,
        priority_levels: ['CRITICO', 'ALTO']
      },
      success: resultado.erros === 0,
      duration_ms: duracao,
      metricas: {
        tarefas_criadas: resultado.tarefas_criadas,
        analises_processadas: resultado.analises_processadas,
        duplicadas_ignoradas: resultado.duplicadas_ignoradas,
        erros: resultado.erros
      }
    }).catch(e => console.warn('[gerarTarefasDeAnalise] SkillExecution background falhou:', e.message));

    console.log(`[gerarTarefasDeAnalise] ✅ Ciclo concluído em ${duracao}ms:`, resultado);
    return Response.json({ success: true, resultado, duration_ms: duracao }, { headers: corsHeaders });

  } catch (error) {
    console.error('[gerarTarefasDeAnalise] ❌ Erro geral:', error.message);
    
    // ✅ FIX: Registrar erro em background (não bloqueia resposta)
    try {
      // Tentar criar sem await
      const base44Local = createClient().catch(() => null);
      if (base44Local) {
        base44Local.asServiceRole?.entities?.SkillExecution?.create({
          skill_name: 'gerar_tarefas_de_analise',
          triggered_by: 'automacao_agendada',
          execution_mode: 'autonomous_safe',
          success: false,
          duration_ms: Date.now() - tsInicio,
          error_message: error?.message || String(error)
        }).catch(() => {});
      }
    } catch (e) {
      // Silencioso
    }
    
    return Response.json(
      { success: false, error: error.message, duration_ms: Date.now() - tsInicio },
      { status: 500, headers: corsHeaders }
    );
  }
});