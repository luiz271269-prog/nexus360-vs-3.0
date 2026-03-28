import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * 🏥 HEALTHCHECK REGENERATIVO
 * 
 * Sistema autônomo de monitoramento que:
 * 1. Verifica Z-API e Nexus Engine periodicamente (Deno.cron)
 * 2. Usa LLM para diagnosticar falhas
 * 3. Registra no Google Sheets
 * 4. Notifica no Slack em caso de falhas críticas
 */

// Configuração
const GOOGLE_SHEET_WEBHOOK = Deno.env.get('GOOGLE_SHEET_WEBHOOK') || '';
const SLACK_WEBHOOK = Deno.env.get('SLACK_WEBHOOK') || '';

/**
 * Testa conexão com Z-API
 */
async function testarZAPI(base44) {
  const startTime = Date.now();
  
  try {
    console.log('[HEALTHCHECK] 🔍 Testando Z-API...');
    
    // Buscar primeira integração ativa
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    
    if (integracoes.length === 0) {
      return {
        status: 'error',
        latency: Date.now() - startTime,
        error: 'Nenhuma integração Z-API conectada'
      };
    }
    
    const integracao = integracoes[0];
    
    // Testar conexão real com Z-API
    const response = await base44.functions.invoke('testarConexaoWhatsApp', {
      integracaoId: integracao.id,
      instanceId: integracao.instance_id_provider,
      tokenInstancia: integracao.api_key_provider,
      clientToken: integracao.security_client_token_header,
      baseUrl: integracao.base_url_provider || 'https://api.z-api.io'
    });
    
    const latency = Date.now() - startTime;
    
    if (response.data.success) {
      console.log('[HEALTHCHECK] ✅ Z-API operacional');
      return {
        status: 'operational',
        latency,
        error: null
      };
    } else {
      console.error('[HEALTHCHECK] ❌ Z-API com problemas:', response.data.error);
      return {
        status: 'degraded',
        latency,
        error: response.data.error
      };
    }
    
  } catch (error) {
    console.error('[HEALTHCHECK] ❌ Erro ao testar Z-API:', error.message);
    return {
      status: 'error',
      latency: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Testa Nexus Engine (IA)
 */
async function testarNexusEngine(base44) {
  const startTime = Date.now();
  
  try {
    console.log('[HEALTHCHECK] 🔍 Testando Nexus Engine...');
    
    // Teste simples: invocar LLM com prompt básico
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: "Sistema de teste. Responda apenas: OK",
      response_json_schema: {
        type: "object",
        properties: {
          status: { type: "string" }
        }
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (response && response.status) {
      console.log('[HEALTHCHECK] ✅ Nexus Engine operacional');
      return {
        status: 'operational',
        latency,
        error: null
      };
    } else {
      console.error('[HEALTHCHECK] ❌ Nexus Engine com resposta inesperada');
      return {
        status: 'degraded',
        latency,
        error: 'Resposta inesperada do LLM'
      };
    }
    
  } catch (error) {
    console.error('[HEALTHCHECK] ❌ Erro ao testar Nexus Engine:', error.message);
    return {
      status: 'error',
      latency: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Registra no Google Sheets
 */
async function logGoogleSheets(data) {
  if (!GOOGLE_SHEET_WEBHOOK) {
    console.warn('[HEALTHCHECK] ⚠️ GOOGLE_SHEET_WEBHOOK não configurado');
    return;
  }
  
  try {
    console.log('[HEALTHCHECK] 📊 Registrando no Google Sheets...');
    
    const response = await fetch(GOOGLE_SHEET_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      console.log('[HEALTHCHECK] ✅ Log registrado no Google Sheets');
    } else {
      console.error('[HEALTHCHECK] ❌ Erro ao registrar no Google Sheets:', response.statusText);
    }
  } catch (error) {
    console.error('[HEALTHCHECK] ❌ Erro ao enviar para Google Sheets:', error.message);
  }
}

/**
 * Notifica no Slack
 */
async function notificarSlack(mensagem, severidade = 'info') {
  if (!SLACK_WEBHOOK) {
    console.warn('[HEALTHCHECK] ⚠️ SLACK_WEBHOOK não configurado');
    return;
  }
  
  const cores = {
    info: '#36a64f',
    warning: '#ff9900',
    error: '#ff0000',
    critical: '#8b0000'
  };
  
  try {
    console.log('[HEALTHCHECK] 📢 Notificando no Slack...');
    
    const response = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color: cores[severidade] || cores.info,
          title: '🏥 VendaPro - Healthcheck',
          text: mensagem,
          footer: 'Sistema Autônomo de Monitoramento',
          ts: Math.floor(Date.now() / 1000)
        }]
      })
    });
    
    if (response.ok) {
      console.log('[HEALTHCHECK] ✅ Notificação enviada ao Slack');
    } else {
      console.error('[HEALTHCHECK] ❌ Erro ao notificar Slack:', response.statusText);
    }
  } catch (error) {
    console.error('[HEALTHCHECK] ❌ Erro ao enviar para Slack:', error.message);
  }
}

/**
 * Executa healthcheck completo
 */
async function executarHealthcheck(base44) {
  console.log('[HEALTHCHECK] 🚀 Iniciando healthcheck...');
  
  const timestamp = new Date().toISOString();
  
  // Testar componentes
  const [zapiResult, nexusResult] = await Promise.all([
    testarZAPI(base44),
    testarNexusEngine(base44)
  ]);
  
  // Preparar dados para log
  const logData = {
    timestamp,
    zapi_status: zapiResult.status,
    zapi_latency: zapiResult.latency,
    zapi_error: zapiResult.error || '',
    nexus_status: nexusResult.status,
    nexus_latency: nexusResult.latency,
    nexus_error: nexusResult.error || '',
    diagnosis: ''
  };
  
  // Verificar se há falhas
  const falhas = [];
  if (zapiResult.status !== 'operational') {
    falhas.push(`Z-API: ${zapiResult.error}`);
  }
  if (nexusResult.status !== 'operational') {
    falhas.push(`Nexus Engine: ${nexusResult.error}`);
  }
  
  // Se houver falhas, invocar LLM para diagnóstico
  if (falhas.length > 0) {
    console.log('[HEALTHCHECK] ⚠️ Falhas detectadas, invocando LLM...');
    
    try {
      const diagnosisResponse = await base44.functions.invoke('diagnoseWithLLM', {
        component: falhas.length > 1 ? 'Múltiplos Componentes' : (zapiResult.status !== 'operational' ? 'Z-API' : 'Nexus Engine'),
        error: falhas.join(' | '),
        details: {
          zapi: zapiResult,
          nexus: nexusResult
        },
        timestamp,
        status: 'degraded'
      });
      
      if (diagnosisResponse.data.success) {
        const diagnosis = diagnosisResponse.data.diagnosis;
        logData.diagnosis = `${diagnosis.causa_raiz} | Severidade: ${diagnosis.severidade}`;
        
        // Notificar no Slack para falhas críticas ou altas
        if (diagnosis.severidade === 'critica' || diagnosis.severidade === 'alta') {
          await notificarSlack(
            `*Falha Detectada*\n\n` +
            `*Componente:* ${falhas.join(', ')}\n` +
            `*Causa Raiz:* ${diagnosis.causa_raiz}\n` +
            `*Severidade:* ${diagnosis.severidade.toUpperCase()}\n` +
            `*Ações Sugeridas:*\n${diagnosis.acoes_corretivas.map((a, i) => `${i + 1}. ${a.acao}`).join('\n')}`,
            diagnosis.severidade === 'critica' ? 'critical' : 'error'
          );
        }
      }
    } catch (diagError) {
      console.error('[HEALTHCHECK] ❌ Erro ao obter diagnóstico LLM:', diagError.message);
      logData.diagnosis = `Erro no diagnóstico: ${diagError.message}`;
    }
  } else {
    console.log('[HEALTHCHECK] ✅ Todos os componentes operacionais');
    logData.diagnosis = 'Sistema operacional';
  }
  
  // Registrar no Google Sheets
  await logGoogleSheets(logData);
  
  // Salvar no SystemHealthLog
  try {
    await base44.asServiceRole.entities.SystemHealthLog.create({
      timestamp,
      componente: 'whatsapp_z_api',
      status: zapiResult.status === 'operational' ? 'operacional' : 
              zapiResult.status === 'degraded' ? 'degradado' : 'falha',
      tempo_resposta_ms: zapiResult.latency,
      erro_detalhado: zapiResult.error || null,
      metricas_adicionais: {
        nexus_status: nexusResult.status,
        nexus_latency: nexusResult.latency
      }
    });
    
    console.log('[HEALTHCHECK] 💾 Log salvo no SystemHealthLog');
  } catch (saveError) {
    console.error('[HEALTHCHECK] ❌ Erro ao salvar SystemHealthLog:', saveError.message);
  }
  
  console.log('[HEALTHCHECK] ✅ Healthcheck concluído');
  
  return {
    success: true,
    timestamp,
    results: {
      zapi: zapiResult,
      nexus: nexusResult
    },
    diagnosis: logData.diagnosis
  };
}

/**
 * Endpoint HTTP e Cron Job
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
    const resultado = await executarHealthcheck(base44);
    
    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers }
    );
    
  } catch (error) {
    console.error('[HEALTHCHECK] ❌ Erro fatal:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers }
    );
  }
});

/**
 * Cron Job - Executa a cada 10 minutos
 */
Deno.cron("Healthcheck VendaPro", "*/10 * * * *", async () => {
  console.log('[CRON] ⏰ Executando healthcheck agendado...');
  
  try {
    // Criar um cliente service role para o cron
    // (não temos req disponível aqui)
    const BASE44_APP_ID = Deno.env.get('BASE44_APP_ID');
    const BASE44_SERVICE_KEY = Deno.env.get('BASE44_SERVICE_KEY');
    
    if (!BASE44_APP_ID || !BASE44_SERVICE_KEY) {
      console.error('[CRON] ❌ Credenciais Base44 não configuradas');
      return;
    }
    
    // Importar SDK e criar cliente service role manualmente
    const { createClient } = await import('npm:@base44/sdk@0.8.23');
    const base44 = createClient(BASE44_APP_ID, BASE44_SERVICE_KEY);
    
    await executarHealthcheck(base44);
    
  } catch (error) {
    console.error('[CRON] ❌ Erro no healthcheck agendado:', error);
  }
});