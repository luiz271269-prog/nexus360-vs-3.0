import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  MONITOR DE SAÚDE DO SISTEMA                                  ║
 * ║  Health Check completo de todos os componentes                ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    console.log('[HEALTH CHECK] 🏥 Iniciando verificação completa...');
    const startTime = Date.now();

    const componentes = {};
    const alertas = [];

    // 1. VERIFICAR INTEGRAÇÕES WHATSAPP
    await verificarWhatsApp(base44, componentes, alertas);

    // 2. VERIFICAR PLAYBOOK ENGINE
    await verificarPlaybookEngine(base44, componentes, alertas);

    // 3. VERIFICAR IA HANDLER
    await verificarIAHandler(base44, componentes, alertas);

    // 4. VERIFICAR DATABASE
    await verificarDatabase(base44, componentes, alertas);

    // 5. VERIFICAR WEBHOOK RECEIVER
    await verificarWebhookReceiver(base44, componentes, alertas);

    // Determinar status geral
    const status_geral = determinarStatusGeral(componentes);

    const tempoTotal = Date.now() - startTime;

    // Salvar resultado
    const healthCheck = await base44.asServiceRole.entities.SystemHealthCheck.create({
      timestamp: new Date().toISOString(),
      status_geral,
      componentes,
      alertas,
      metricas_performance: {
        tempo_verificacao_ms: tempoTotal
      },
      proxima_verificacao: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
    });

    console.log(`[HEALTH CHECK] ✅ Verificação concluída em ${tempoTotal}ms - Status: ${status_geral}`);

    // Se houver alertas críticos, notificar admins
    if (alertas.some(a => a.severidade === 'critical')) {
      await notificarAdmins(base44, alertas.filter(a => a.severidade === 'critical'));
    }

    return Response.json({
      success: true,
      status_geral,
      componentes,
      alertas,
      health_check_id: healthCheck.id,
      tempo_execucao_ms: tempoTotal
    }, { headers });

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro:', error);
    return Response.json({
      success: false,
      status_geral: 'offline',
      error: error.message
    }, { status: 500, headers });
  }
});

async function verificarWhatsApp(base44, componentes, alertas) {
  console.log('[HEALTH CHECK] 📱 Verificando WhatsApp...');

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();
    
    const conectadas = integracoes.filter(i => i.status === 'conectado').length;
    const desconectadas = integracoes.filter(i => i.status === 'desconectado').length;
    const erro = integracoes.filter(i => i.status === 'erro_conexao').length;

    let status = 'saudavel';
    if (desconectadas > 0 || erro > 0) {
      status = 'degradado';
      alertas.push({
        severidade: erro > 0 ? 'error' : 'warning',
        componente: 'whatsapp_integrations',
        mensagem: `${desconectadas + erro} integrações com problemas`,
        timestamp: new Date().toISOString()
      });
    }

    if (conectadas === 0 && integracoes.length > 0) {
      status = 'critico';
      alertas.push({
        severidade: 'critical',
        componente: 'whatsapp_integrations',
        mensagem: 'Nenhuma integração WhatsApp conectada!',
        timestamp: new Date().toISOString()
      });
    }

    componentes.whatsapp_integrations = {
      status,
      total: integracoes.length,
      conectadas,
      desconectadas,
      erro,
      detalhes: integracoes.map(i => ({
        nome: i.nome_instancia,
        status: i.status,
        ultima_atividade: i.ultima_atividade
      }))
    };

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao verificar WhatsApp:', error);
    componentes.whatsapp_integrations = {
      status: 'critico',
      erro: error.message
    };
    alertas.push({
      severidade: 'critical',
      componente: 'whatsapp_integrations',
      mensagem: `Erro ao verificar WhatsApp: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}

async function verificarPlaybookEngine(base44, componentes, alertas) {
  console.log('[HEALTH CHECK] ⚙️ Verificando Playbook Engine...');

  try {
    const vinteQuatroHorasAtras = new Date();
    vinteQuatroHorasAtras.setHours(vinteQuatroHorasAtras.getHours() - 24);

    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      started_at: { $gte: vinteQuatroHorasAtras.toISOString() }
    });

    const ativas = execucoes.filter(e => e.status === 'ativo').length;
    const concluidas = execucoes.filter(e => e.status === 'concluido').length;
    const erros = execucoes.filter(e => e.status === 'erro').length;

    const taxaSucesso = execucoes.length > 0
      ? (concluidas / execucoes.length) * 100
      : 100;

    // Calcular tempo médio de execução
    const temposExecucao = execucoes
      .filter(e => e.status === 'concluido' && e.started_at)
      .map(e => {
        const inicio = new Date(e.started_at);
        const fim = new Date(e.updated_date || e.created_date);
        return (fim - inicio) / (1000 * 60); // minutos
      });

    const tempoMedio = temposExecucao.length > 0
      ? temposExecucao.reduce((a, b) => a + b, 0) / temposExecucao.length
      : 0;

    let status = 'saudavel';
    if (taxaSucesso < 70) {
      status = 'degradado';
      alertas.push({
        severidade: 'warning',
        componente: 'playbook_engine',
        mensagem: `Taxa de sucesso baixa: ${Math.round(taxaSucesso)}%`,
        timestamp: new Date().toISOString()
      });
    }

    if (erros > execucoes.length * 0.3) {
      status = 'critico';
      alertas.push({
        severidade: 'error',
        componente: 'playbook_engine',
        mensagem: `Taxa de erro elevada: ${erros} erros em ${execucoes.length} execuções`,
        timestamp: new Date().toISOString()
      });
    }

    componentes.playbook_engine = {
      status,
      execucoes_ativas: ativas,
      taxa_sucesso_24h: Math.round(taxaSucesso),
      tempo_medio_execucao: Math.round(tempoMedio),
      erros_ultimas_24h: erros
    };

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao verificar Playbook Engine:', error);
    componentes.playbook_engine = {
      status: 'critico',
      erro: error.message
    };
  }
}

async function verificarIAHandler(base44, componentes, alertas) {
  console.log('[HEALTH CHECK] 🤖 Verificando IA Handler...');

  try {
    const vinteQuatroHorasAtras = new Date();
    vinteQuatroHorasAtras.setHours(vinteQuatroHorasAtras.getHours() - 24);

    const metricas = await base44.asServiceRole.entities.IAUsageMetric.filter({
      timestamp: { $gte: vinteQuatroHorasAtras.toISOString() }
    });

    const totalChamadas = metricas.length;
    const totalTokens = metricas.reduce((sum, m) => sum + (m.tokens_total || 0), 0);
    const custoTotal = metricas.reduce((sum, m) => sum + (m.custo_estimado_usd || 0), 0);
    const chamadaComErro = metricas.filter(m => !m.sucesso).length;
    const taxaErro = totalChamadas > 0 ? (chamadaComErro / totalChamadas) * 100 : 0;

    const temposResposta = metricas
      .filter(m => m.tempo_resposta_ms)
      .map(m => m.tempo_resposta_ms);

    const tempoMedio = temposResposta.length > 0
      ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
      : 0;

    let status = 'saudavel';
    if (taxaErro > 10) {
      status = 'degradado';
      alertas.push({
        severidade: 'warning',
        componente: 'ia_handler',
        mensagem: `Taxa de erro da IA: ${Math.round(taxaErro)}%`,
        timestamp: new Date().toISOString()
      });
    }

    if (tempoMedio > 5000) { // > 5 segundos
      alertas.push({
        severidade: 'info',
        componente: 'ia_handler',
        mensagem: `Tempo médio de resposta elevado: ${Math.round(tempoMedio)}ms`,
        timestamp: new Date().toISOString()
      });
    }

    componentes.ia_handler = {
      status,
      chamadas_ultimas_24h: totalChamadas,
      tokens_consumidos_24h: totalTokens,
      custo_estimado_24h: custoTotal,
      tempo_medio_resposta_ms: Math.round(tempoMedio),
      taxa_erro: Math.round(taxaErro)
    };

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao verificar IA Handler:', error);
    componentes.ia_handler = {
      status: 'degradado',
      erro: error.message
    };
  }
}

async function verificarDatabase(base44, componentes, alertas) {
  console.log('[HEALTH CHECK] 💾 Verificando Database...');

  try {
    const startTime = Date.now();
    
    // Fazer uma query simples para testar o banco
    await base44.asServiceRole.entities.FlowTemplate.list('created_date', 1);
    
    const tempoResposta = Date.now() - startTime;

    let status = 'saudavel';
    if (tempoResposta > 1000) { // > 1 segundo
      status = 'degradado';
      alertas.push({
        severidade: 'warning',
        componente: 'database',
        mensagem: `Tempo de resposta do banco elevado: ${tempoResposta}ms`,
        timestamp: new Date().toISOString()
      });
    }

    componentes.database = {
      status,
      tempo_resposta_ms: tempoResposta,
      queries_lentas: 0 // Placeholder
    };

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao verificar Database:', error);
    componentes.database = {
      status: 'critico',
      erro: error.message
    };
    alertas.push({
      severidade: 'critical',
      componente: 'database',
      mensagem: `Erro ao conectar ao banco: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}

async function verificarWebhookReceiver(base44, componentes, alertas) {
  console.log('[HEALTH CHECK] 📡 Verificando Webhook Receiver...');

  try {
    const vinteQuatroHorasAtras = new Date();
    vinteQuatroHorasAtras.setHours(vinteQuatroHorasAtras.getHours() - 24);

    const webhookLogs = await base44.asServiceRole.entities.WebhookLog.filter({
      timestamp: { $gte: vinteQuatroHorasAtras.toISOString() }
    }, '-timestamp', 100);

    const totalMensagens = webhookLogs.length;
    const processadasComSucesso = webhookLogs.filter(w => w.success).length;
    const taxaSucesso = totalMensagens > 0
      ? (processadasComSucesso / totalMensagens) * 100
      : 100;

    const temposProcessamento = webhookLogs
      .filter(w => w.processing_time_ms)
      .map(w => w.processing_time_ms);

    const tempoMedio = temposProcessamento.length > 0
      ? temposProcessamento.reduce((a, b) => a + b, 0) / temposProcessamento.length
      : 0;

    let status = 'saudavel';
    if (taxaSucesso < 80) {
      status = 'degradado';
      alertas.push({
        severidade: 'warning',
        componente: 'webhook_receiver',
        mensagem: `Taxa de sucesso baixa: ${Math.round(taxaSucesso)}%`,
        timestamp: new Date().toISOString()
      });
    }

    componentes.webhook_receiver = {
      status,
      mensagens_recebidas_24h: totalMensagens,
      taxa_processamento_sucesso: Math.round(taxaSucesso),
      tempo_medio_processamento_ms: Math.round(tempoMedio)
    };

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao verificar Webhook Receiver:', error);
    componentes.webhook_receiver = {
      status: 'degradado',
      erro: error.message
    };
  }
}

function determinarStatusGeral(componentes) {
  const statuses = Object.values(componentes).map(c => c.status);
  
  if (statuses.includes('critico') || statuses.includes('offline')) {
    return 'critico';
  }
  
  if (statuses.includes('degradado')) {
    return 'degradado';
  }
  
  return 'saudavel';
}

async function notificarAdmins(base44, alertasCriticos) {
  console.log('[HEALTH CHECK] 🚨 Notificando admins sobre alertas críticos...');

  try {
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    for (const admin of admins) {
      await base44.asServiceRole.entities.NotificationEvent.create({
        tipo: 'escalonamento',
        titulo: 'Sistema com problemas críticos',
        mensagem: `Detectados ${alertasCriticos.length} problemas críticos: ${alertasCriticos.map(a => a.mensagem).join(', ')}`,
        prioridade: 'critica',
        usuario_id: admin.id,
        entidade_relacionada: 'SystemHealthCheck',
        metadata: { alertas: alertasCriticos }
      });
    }

  } catch (error) {
    console.error('[HEALTH CHECK] ❌ Erro ao notificar admins:', error);
  }
}