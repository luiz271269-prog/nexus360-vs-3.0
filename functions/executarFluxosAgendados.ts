import { createClient } from 'npm:@base44/sdk@0.7.1';

/**
 * Função Cron para Executar Fluxos Agendados
 * Deve ser executada a cada minuto
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });
    
    console.log("⏰ [Cron] Verificando fluxos agendados...");
    
    const agora = new Date().toISOString();
    
    // Buscar execuções agendadas para agora ou antes
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      status: 'ativo',
      next_action_at: { $lte: agora }
    });
    
    console.log(`📊 [Cron] ${execucoes.length} fluxos para executar`);
    
    let sucessos = 0;
    let erros = 0;
    
    for (const execution of execucoes) {
      try {
        // Importar executor dinamicamente
        const { ExecutorFluxos } = await import('../components/automacao/ExecutorFluxos.js');
        
        await ExecutorFluxos.executarProximoPasso(execution.id);
        sucessos++;
        
      } catch (error) {
        console.error(`❌ [Cron] Erro ao executar fluxo ${execution.id}:`, error);
        erros++;
        
        // Marcar como erro
        await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
          status: 'erro',
          execution_history: [
            ...(execution.execution_history || []),
            {
              executed_at: new Date().toISOString(),
              erro: error.message,
              success: false
            }
          ]
        });
      }
    }
    
    console.log(`✅ [Cron] Concluído: ${sucessos} sucessos, ${erros} erros`);
    
    return Response.json({
      success: true,
      timestamp: agora,
      total_execucoes: execucoes.length,
      sucessos,
      erros
    });
    
  } catch (error) {
    console.error("❌ [Cron] Erro geral:", error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});