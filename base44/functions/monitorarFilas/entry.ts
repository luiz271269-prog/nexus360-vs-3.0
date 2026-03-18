import { createClient } from 'npm:@base44/sdk@0.8.4';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MONITOR DE FILAS - Redistribuição Automática               ║
 * ║  Versão: 1.0 - Timeout + Escalação + Notificações          ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Executar a cada 2 minutos via cron job
 * Detecta threads com tempo excessivo de espera e toma ações
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });

    console.log('[MONITOR-FILAS] 🔍 Iniciando monitoramento...');

    // Buscar todas as threads aguardando na fila
    const filasAguardando = await base44.entities.FilaAtendimento.filter({
      status: 'aguardando'
    }, 'entrou_em', 500);

    const agora = Date.now();
    const acoes = {
      escaladas: 0,
      notificadas: 0,
      removidas_timeout: 0
    };

    for (const fila of filasAguardando) {
      const tempoEsperaSegundos = Math.floor(
        (agora - new Date(fila.entrou_em).getTime()) / 1000
      );

      // AÇÃO 1: Escalar prioridade após 5 minutos
      if (tempoEsperaSegundos > 300 && fila.prioridade === 'normal') {
        await base44.entities.FilaAtendimento.update(fila.id, {
          prioridade: 'alta'
        });
        console.log(`[MONITOR] ⬆️ Escalada para ALTA: ${fila.id}`);
        acoes.escaladas++;
      }

      // AÇÃO 2: Escalar para urgente após 10 minutos
      if (tempoEsperaSegundos > 600 && fila.prioridade === 'alta') {
        await base44.entities.FilaAtendimento.update(fila.id, {
          prioridade: 'urgente'
        });
        console.log(`[MONITOR] ⬆️⬆️ Escalada para URGENTE: ${fila.id}`);
        acoes.escaladas++;

        // Notificar supervisores
        await notificarSupervisores(base44, fila, tempoEsperaSegundos);
        acoes.notificadas++;
      }

      // AÇÃO 3: Remover por timeout após 30 minutos (cliente desistiu)
      if (tempoEsperaSegundos > 1800) {
        await base44.functions.invoke('gerenciarFila', {
          action: 'remover',
          thread_id: fila.thread_id,
          motivo: 'timeout'
        });

        // Enviar mensagem automática ao cliente
        const thread = await base44.entities.MessageThread.get(fila.thread_id).catch(() => null);
        if (thread?.whatsapp_integration_id) {
          await enviarMensagemTimeout(base44, thread);
        }

        console.log(`[MONITOR] ⏰ Removida por timeout: ${fila.id}`);
        acoes.removidas_timeout++;
      }
    }

    console.log('[MONITOR-FILAS] ✅ Monitoramento concluído:', acoes);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      total_monitoradas: filasAguardando.length,
      acoes
    }, { status: 200, headers });

  } catch (error) {
    console.error('[MONITOR-FILAS] ❌ Erro:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers }
    );
  }
});

/**
 * Notificar supervisores sobre fila crítica
 */
async function notificarSupervisores(base44, fila, tempoEspera) {
  try {
    // Buscar usuários admin/supervisores
    const supervisores = await base44.entities.User.filter({
      role: 'admin'
    });

    const mensagem = `🚨 ALERTA DE FILA CRÍTICA\n\n` +
      `Cliente: ${fila.metadata?.cliente_nome || 'Desconhecido'}\n` +
      `Telefone: ${fila.metadata?.cliente_telefone || 'N/A'}\n` +
      `Setor: ${fila.setor}\n` +
      `Tempo de espera: ${Math.floor(tempoEspera / 60)} minutos\n` +
      `Prioridade: ${fila.prioridade.toUpperCase()}\n\n` +
      `Ação necessária: Atribuir atendente imediatamente!`;

    // Criar notificações para cada supervisor
    for (const supervisor of supervisores) {
      await base44.entities.NotificationEvent.create({
        user_id: supervisor.id,
        tipo: 'fila_critica',
        titulo: '🚨 Fila Crítica - Ação Necessária',
        mensagem: mensagem,
        prioridade: 'alta',
        lido: false,
        data_criacao: new Date().toISOString(),
        metadata: {
          fila_id: fila.id,
          thread_id: fila.thread_id,
          setor: fila.setor,
          tempo_espera_segundos: tempoEspera
        }
      });

      // Enviar email se configurado
      if (supervisor.email) {
        await base44.integrations.Core.SendEmail({
          to: supervisor.email,
          subject: '🚨 Alerta: Cliente aguardando há mais de 10 minutos',
          body: mensagem
        }).catch(err => console.error('[MONITOR] Erro ao enviar email:', err));
      }
    }

    console.log(`[MONITOR] 📧 ${supervisores.length} supervisor(es) notificado(s)`);

  } catch (error) {
    console.error('[MONITOR] Erro ao notificar supervisores:', error);
  }
}

/**
 * Enviar mensagem automática de timeout ao cliente
 */
async function enviarMensagemTimeout(base44, thread) {
  try {
    const contato = await base44.entities.Contact.get(thread.contact_id);
    
    const mensagem = `Olá! 👋\n\n` +
      `Percebemos que você está aguardando atendimento há algum tempo. ` +
      `Infelizmente, todos os nossos atendentes estão ocupados no momento.\n\n` +
      `📱 Por favor, envie uma nova mensagem quando puder e teremos prazer em atendê-lo(a)!\n\n` +
      `Obrigado pela compreensão! 🙏`;

    await base44.functions.invoke('enviarWhatsApp', {
      integration_id: thread.whatsapp_integration_id,
      numero_destino: contato.telefone,
      mensagem: mensagem
    });

    console.log(`[MONITOR] 📤 Mensagem de timeout enviada para: ${contato.telefone}`);

  } catch (error) {
    console.error('[MONITOR] Erro ao enviar mensagem de timeout:', error);
  }
}