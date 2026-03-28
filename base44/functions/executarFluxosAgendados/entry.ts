// executarFluxosAgendados - v2.0.0
// ═══════════════════════════════════════════════════════════════════════
// Worker que avança FlowExecutions com next_action_at no passado.
// Corrigido: removido import local quebrado (../components/...).
// Usa playbookEngine via SDK em vez de import direto.
// ═══════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const agora = new Date().toISOString();

    console.log('[EXEC-FLUXOS v2] ⏰ Verificando fluxos agendados...');

    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      status: 'waiting_follow_up',
      next_action_at: { $lte: agora }
    }, 'next_action_at', 20);

    console.log(`[EXEC-FLUXOS v2] 📊 ${execucoes.length} fluxos para executar`);

    let sucessos = 0;
    let erros = 0;

    for (const execution of execucoes) {
      try {
        // Invocar playbookEngine via SDK (sem import local)
        const resultado = await base44.asServiceRole.functions.invoke('playbookEngine', {
          action: 'continue_follow_up',
          execution_id: execution.id
        });

        if (resultado?.data?.success) {
          console.log(`[EXEC-FLUXOS v2] ✅ Fluxo ${execution.id} avançado | Ação: ${resultado.data.action}`);
          sucessos++;
        } else {
          console.warn(`[EXEC-FLUXOS v2] ⚠️ Fluxo ${execution.id} retornou falha:`, resultado?.data?.error);
          erros++;
        }
      } catch (error) {
        console.error(`[EXEC-FLUXOS v2] ❌ Erro ao executar fluxo ${execution.id}:`, error.message);
        erros++;

        // Marcar execução como erro para não tentar de novo
        await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
          status: 'erro',
          execution_history: [
            ...(execution.execution_history || []),
            {
              executed_at: new Date().toISOString(),
              action: 'continue_follow_up',
              result: 'failed',
              details: { error: error.message }
            }
          ]
        }).catch(() => {});
      }
    }

    console.log(`[EXEC-FLUXOS v2] ✅ Concluído: ${sucessos} sucessos | ${erros} erros`);

    return Response.json({
      success: true,
      timestamp: agora,
      total_execucoes: execucoes.length,
      sucessos,
      erros
    });

  } catch (error) {
    console.error('[EXEC-FLUXOS v2] ❌ Erro geral:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});