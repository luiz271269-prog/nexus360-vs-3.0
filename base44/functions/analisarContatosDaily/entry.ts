// ============================================================================
// ANÁLISE DIÁRIA DE CONTATOS v1.0.0
// ============================================================================
// Automação agendada (a cada 15min) para processar 12 contatos sem análise
// nas últimas 24h, distribuindo carga ao longo do dia.
// ============================================================================

import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const BATCH_SIZE = 96; // ✅ Aumentado: 12×8 contatos por execução diária
const ANALYSIS_WINDOW_HOURS = 24;
const MAX_DURATION_MS = 50000; // 50s timeout para processar 96 contatos

async function analisarContatosBatch(base44) {
  const tsInicio = Date.now();
  
  // ══════════════════════════════════════════════════════════════════
  // STEP 1: Buscar contatos sem análise nas últimas 24h
  // ══════════════════════════════════════════════════════════════════
  console.log('[ANALISE-DIARIA] 🔍 Buscando contatos para análise...');
  
  const dataCutoff = new Date(Date.now() - ANALYSIS_WINDOW_HOURS * 60 * 60 * 1000);
  
  const contatosPendentes = await base44.asServiceRole.entities.Contact.filter({
    $or: [
      { ultima_analise_comportamento: { $exists: false } },
      { ultima_analise_comportamento: { $lt: dataCutoff.toISOString() } }
    ],
    // Priorizar: ativo, cliente, com mensagens recentes
    tipo_contato: { $in: ['cliente', 'lead'] },
    ultima_interacao: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
  }, '-ultima_interacao', BATCH_SIZE);
  
  if (contatosPendentes.length === 0) {
    console.log('[ANALISE-DIARIA] ✅ Nenhum contato pendente de análise');
    return {
      success: true,
      processados: 0,
      message: 'Nenhum contato pendente',
      duration_ms: Date.now() - tsInicio
    };
  }
  
  console.log(`[ANALISE-DIARIA] 📊 Processando ${contatosPendentes.length} contatos`);
  
  // ══════════════════════════════════════════════════════════════════
  // STEP 2: Analisar cada contato com timeout
  // ══════════════════════════════════════════════════════════════════
  const resultados = {
    sucesso: 0,
    erro: 0,
    timeout: 0,
    detalhes: []
  };
  
  for (const contato of contatosPendentes) {
    // Check timeout global
    if (Date.now() - tsInicio > MAX_DURATION_MS) {
      console.warn('[ANALISE-DIARIA] ⏱️ Timeout global atingido, parando batch');
      resultados.timeout++;
      break;
    }
    
    try {
      const tsContato = Date.now();
      
      // Buscar últimas 30 mensagens para contexto
      const mensagens = await base44.asServiceRole.entities.Message.filter(
        { contact_id: contato.id },
        '-sent_at',
        30
      );
      
      // Chamar LLM para análise comportamental (com timeout)
       let analiseIA = null;
       try {
         const textoContexto = mensagens
           .map(m => `${m.sender_type === 'user' ? 'Sistema' : contato.nome}: ${m.content}`)
           .join('\n')
           .slice(-1000); // Últimos 1000 chars

         analiseIA = await Promise.race([
           base44.asServiceRole.integrations.Core.InvokeLLM({
             model: 'gemini_3_flash', // ✅ Mantém modelo rápido para processar 96 contatos
            prompt: `Analise brevemente o comportamento do contato "${contato.nome}" baseado nesse histórico:

${textoContexto}

Retorne um JSON com:
- sentimento: "positivo"|"neutro"|"negativo"
- urgencia: "baixa"|"media"|"alta"
- intencao: descrição curta
- proximo_passo: ação recomendada (máx 1 linha)`,
            response_json_schema: {
              type: 'object',
              properties: {
                sentimento: { type: 'string' },
                urgencia: { type: 'string' },
                intencao: { type: 'string' },
                proximo_passo: { type: 'string' }
              }
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('LLM timeout')), 5000)
          )
        ]);
      } catch (llmErr) {
        console.warn(`[ANALISE-DIARIA] ⚠️ LLM falhou para ${contato.nome}:`, llmErr.message);
        analiseIA = {
          sentimento: 'neutro',
          urgencia: 'media',
          intencao: 'sem_analise_ia',
          proximo_passo: 'Revisar manualmente'
        };
      }
      
      // ════════════════════════════════════════════════════════════
      // STEP 3: Persistir análise e atualizar contato
      // ════════════════════════════════════════════════════════════
      
      await base44.asServiceRole.entities.Contact.update(contato.id, {
        ultima_analise_comportamento: new Date().toISOString(),
        score_engajamento: analiseIA.urgencia === 'alta' ? 75 : analiseIA.urgencia === 'media' ? 50 : 25,
        campos_personalizados: {
          ...contato.campos_personalizados,
          ultima_analise_ia: {
            ...analiseIA,
            analisado_em: new Date().toISOString()
          }
        }
      });
      
      // Registrar na auditoria (com tratamento de erro visível)
      try {
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'analise_comportamento_ia',
          contato_id: contato.id,
          resultado: 'sucesso',
          timestamp: new Date().toISOString(),
          detalhes: {
            analise: analiseIA,
            tempo_processamento_ms: Date.now() - tsContato
          }
        });
      } catch (logErr) {
        console.error(`[ANALISE-DIARIA] ❌ Falha ao registrar log de sucesso para ${contato.nome}:`, logErr.message);
      }
      
      resultados.sucesso++;
      resultados.detalhes.push({
        contato_id: contato.id,
        nome: contato.nome,
        status: 'sucesso',
        analise: analiseIA.sentimento,
        tempo_ms: Date.now() - tsContato
      });
      
      console.log(`[ANALISE-DIARIA] ✅ ${contato.nome} (${analiseIA.sentimento})`);
      
    } catch (err) {
      resultados.erro++;
      resultados.detalhes.push({
        contato_id: contato.id,
        nome: contato.nome,
        status: 'erro',
        erro: err.message
      });
      
      console.error(`[ANALISE-DIARIA] ❌ Erro ao processar ${contato.nome}:`, err.message);
      
      // Registrar falha
      try {
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'analise_comportamento_ia',
          contato_id: contato.id,
          resultado: 'erro',
          timestamp: new Date().toISOString(),
          detalhes: {
            erro: err.message,
            stack: err.stack?.slice(0, 500)
          }
        });
      } catch (logErr) {
        console.error(`[ANALISE-DIARIA] ❌ Falha ao registrar log de erro para ${contato.nome}:`, logErr.message);
      }
    }
  }
  
  // ══════════════════════════════════════════════════════════════════
  // STEP 4: Registrar execução da automação
  // ══════════════════════════════════════════════════════════════════
  const duracao = Date.now() - tsInicio;
  
  try {
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'analise_diaria_contatos',
      triggered_by: 'scheduled_automation',
      execution_mode: 'autonomous_safe',
      success: resultados.erro === 0,
      duration_ms: duracao,
      context: {
        batch_size: BATCH_SIZE,
        contatos_processados: resultados.sucesso,
        erros: resultados.erro
      },
      resultado: {
        processados: resultados.sucesso,
        erros: resultados.erro,
        timeout: resultados.timeout
      }
    });
  } catch (e) {
    console.error('[ANALISE-DIARIA] ❌ Erro ao registrar SkillExecution:', e.message);
  }
  
  console.log(`[ANALISE-DIARIA] 📈 Batch completo: ${resultados.sucesso} sucesso, ${resultados.erro} erros em ${duracao}ms`);
  
  return {
    success: resultados.erro === 0,
    processados: resultados.sucesso,
    erros: resultados.erro,
    timeout: resultados.timeout,
    duracao_ms: duracao,
    detalhes: resultados.detalhes
  };
}

// ============================================================================
// HANDLER PARA AGENDADOR
// ============================================================================

Deno.serve(async (req) => {
  // Suportar tanto chamadas diretas quanto agendadas
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  
  try {
    // ✅ FIX: Em contexto agendado, usar createClient() SEM argumentos (SDK busca env vars)
    // Se falhar, BASE44_APP_ID está missing — erro esperado que deve ser tratado
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.log('[ANALISE-DIARIA] Contexto agendado detectado, usando createClient()');
      // createClient() sem argumentos busca automaticamente BASE44_APP_ID e outras env vars
      const appId = Deno.env.get('BASE44_APP_ID');
      if (!appId) {
        throw new Error('BASE44_APP_ID não definido — automação agendada requer essa variável de ambiente');
      }
      base44 = createClient();
    }
    
    const resultado = await analisarContatosBatch(base44);
    
    return Response.json(resultado, {
      status: resultado.success ? 200 : 206,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[ANALISE-DIARIA] ❌ Erro crítico:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack?.slice(0, 500)
    }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});