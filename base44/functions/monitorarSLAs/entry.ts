import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MONITOR DE SLAs - CRON JOB                                ║
 * ║  Executa a cada 5 minutos para monitorar SLAs             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const agora = new Date();
    const em10Minutos = new Date(agora.getTime() + 10 * 60 * 1000);

    // Buscar threads com SLA próximo ou violado
    const threadsEmRisco = await base44.asServiceRole.entities.MessageThread.filter({
      status: { $in: ['aberta', 'aguardando_cliente'] },
      sla_due_at: { $lte: em10Minutos.toISOString() }
    });

    const acoesTomadas = [];

    for (const thread of threadsEmRisco) {
      const slaDueAt = new Date(thread.sla_due_at);
      const minutosRestantes = Math.floor((slaDueAt - agora) / (1000 * 60));

      let novoStatus = thread.sla_status;
      let acao = null;

      if (minutosRestantes <= 0) {
        // SLA VIOLADO
        novoStatus = 'violado';
        acao = 'notify_manager';
        
        // Notificar gerente e escalonar
        if (thread.sector_id) {
          const supervisores = await base44.asServiceRole.entities.User.filter({
            role: { $in: ['admin', 'supervisor'] },
            sector: thread.sector_id
          });

          // Criar notificação para supervisores
          for (const supervisor of supervisores) {
            // Implementar sistema de notificação
            console.log(`Notificar supervisor ${supervisor.id} sobre SLA violado: ${thread.id}`);
          }
        }
      } else if (minutosRestantes <= 5) {
        // ALERTA 90%
        novoStatus = 'alerta_90';
        acao = 'notify_supervisor';
      } else if (minutosRestantes <= 10) {
        // ALERTA 75%
        if (thread.sla_status === 'dentro_prazo') {
          novoStatus = 'alerta_75';
          acao = 'notify_agent';
        }
      }

      // Atualizar status do SLA
      if (novoStatus !== thread.sla_status) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          sla_status: novoStatus
        });

        acoesTomadas.push({
          thread_id: thread.id,
          novo_status: novoStatus,
          acao,
          minutos_restantes: minutosRestantes
        });
      }
    }

    return Response.json({
      message: 'Monitoramento de SLA concluído',
      threads_verificadas: threadsEmRisco.length,
      acoes_tomadas: acoesTomadas.length,
      detalhes: acoesTomadas
    });

  } catch (error) {
    console.error('Erro ao monitorar SLAs:', error);
    return Response.json({ 
      error: 'Erro no monitoramento de SLA',
      details: error.message 
    }, { status: 500 });
  }
});