import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { whatsapp_integration_id } = await req.json();

    if (!whatsapp_integration_id) {
      return Response.json({ error: 'whatsapp_integration_id é obrigatório' }, { status: 400 });
    }

    // Buscar integração
    const integracoes = await base44.entities.WhatsAppIntegration.filter({ id: whatsapp_integration_id });
    if (integracoes.length === 0) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }
    const integracao = integracoes[0];

    const inicioTotal = Date.now();
    const resultado = {
      whatsapp_integration_id: integracao.id,
      integration_nome: integracao.nome_instancia,
      data_execucao: new Date().toISOString(),
      etapas: [],
      ambiente: {
        url_origem: req.headers.get('origin') || 'unknown',
        navegador: req.headers.get('user-agent') || 'unknown',
        usuario_executor: user.email
      }
    };

    // ========== ETAPA 1: CONFIGURAÇÃO ==========
    const etapa1 = await executarEtapa1(integracao);
    resultado.etapas.push(etapa1);

    if (etapa1.score < 100) {
      resultado.status_geral = 'bloqueado';
      resultado.etapa_bloqueada = 1;
      return await finalizarDiagnostico(base44, resultado, inicioTotal);
    }

    // ========== ETAPA 2: CONECTIVIDADE ==========
    const etapa2 = await executarEtapa2(integracao);
    resultado.etapas.push(etapa2);

    if (etapa2.score < 75) {
      resultado.status_geral = 'bloqueado';
      resultado.etapa_bloqueada = 2;
      return await finalizarDiagnostico(base44, resultado, inicioTotal);
    }

    // ========== ETAPA 3: RECEBIMENTO ==========
    const etapa3 = await executarEtapa3(base44, integracao);
    resultado.etapas.push(etapa3);

    if (etapa3.score < 50) {
      resultado.status_geral = 'parcial';
      resultado.etapa_bloqueada = 3;
      return await finalizarDiagnostico(base44, resultado, inicioTotal);
    }

    // ========== ETAPA 4: PROCESSAMENTO ==========
    const etapa4 = await executarEtapa4(base44, integracao);
    resultado.etapas.push(etapa4);

    resultado.status_geral = etapa4.score === 100 ? 'sucesso' : 'parcial';

    return await finalizarDiagnostico(base44, resultado, inicioTotal);

  } catch (error) {
    console.error('Erro no diagnóstico completo:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ========== ETAPA 1: CONFIGURAÇÃO ==========
async function executarEtapa1(integracao) {
  const inicio = Date.now();
  const testes = [];

  // Teste 1: Instance ID
  const t1Inicio = Date.now();
  const temInstanceId = !!integracao.instance_id_provider;
  testes.push({
    nome: 'Instance ID configurado',
    critico: true,
    status: temInstanceId ? 'sucesso' : 'erro',
    tempo_ms: Date.now() - t1Inicio,
    detalhes: { valor: integracao.instance_id_provider || 'NÃO CONFIGURADO' },
    sugestao_correcao: !temInstanceId ? 'Configure o Instance ID na aba Configurações' : null
  });

  // Teste 2: API Key
  const t2Inicio = Date.now();
  const temApiKey = !!integracao.api_key_provider;
  testes.push({
    nome: 'API Key configurada',
    critico: true,
    status: temApiKey ? 'sucesso' : 'erro',
    tempo_ms: Date.now() - t2Inicio,
    detalhes: { configurada: temApiKey },
    sugestao_correcao: !temApiKey ? 'Configure a API Key na aba Configurações' : null
  });

  // Teste 3: Security Token (apenas para Z-API)
  const t3Inicio = Date.now();
  const temToken = !!integracao.security_client_token_header;
  const isZAPI = integracao.api_provider === 'z_api';
  const modoIntegrador = integracao.modo === 'integrator';
  
  testes.push({
    nome: 'Security Token configurado',
    critico: isZAPI, // Crítico apenas para Z-API
    status: isZAPI ? (temToken ? 'sucesso' : 'erro') : 'sucesso',
    tempo_ms: Date.now() - t3Inicio,
    detalhes: { 
      configurado: temToken,
      provider: integracao.api_provider || 'z_api',
      requer_token: isZAPI
    },
    sugestao_correcao: isZAPI && !temToken ? 'Configure o Client-Token de Segurança da Conta na aba Configurações (obrigatório para Z-API)' : 
                       !isZAPI && !temToken ? `Não aplicável para ${modoIntegrador ? 'W-API Integrador' : 'W-API'} (usa apenas Bearer Token)` : null
  });

  // Teste 4: Número de telefone
  const t4Inicio = Date.now();
  const temTelefone = !!integracao.numero_telefone && integracao.numero_telefone.startsWith('+');
  const modoIntegrador = integracao.modo === 'integrator';
  
  testes.push({
    nome: 'Número de telefone válido',
    critico: false,
    status: temTelefone ? 'sucesso' : (modoIntegrador ? 'aviso' : 'aviso'),
    tempo_ms: Date.now() - t4Inicio,
    detalhes: { 
      numero: integracao.numero_telefone,
      modo: modoIntegrador ? 'integrator' : 'manual'
    },
    sugestao_correcao: !temTelefone && !modoIntegrador ? 'Use formato internacional (+5511...)' : 
                       !temTelefone && modoIntegrador ? 'Número será associado após conectar via QR Code ou Pairing Code' : null
  });

  // Teste 5: Webhook URL
  const t5Inicio = Date.now();
  const temWebhook = !!integracao.webhook_url;
  testes.push({
    nome: 'Webhook URL registrada',
    critico: false,
    status: temWebhook ? 'sucesso' : 'aviso',
    tempo_ms: Date.now() - t5Inicio,
    detalhes: { url: integracao.webhook_url || 'Usando fallback' },
    sugestao_correcao: !temWebhook ? 'Salve a URL do webhook na integração' : null
  });

  const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
  const score = Math.round((testesComSucesso / testes.length) * 100);

  return {
    numero: 1,
    nome: 'Configuração Básica',
    score,
    tempo_ms: Date.now() - inicio,
    status: score === 100 ? 'sucesso' : score >= 80 ? 'aviso' : 'erro',
    testes
  };
}

// ========== ETAPA 2: CONECTIVIDADE ==========
async function executarEtapa2(integracao) {
  const inicio = Date.now();
  const testes = [];
  const webhookUrl = 'https://nexus360-pro.base44.app/api/functions/webhookWatsZapi';

  // Teste 1: GET Health Check
  const t1Inicio = Date.now();
  try {
    const response = await fetch(webhookUrl, { method: 'GET' });
    const t1Tempo = Date.now() - t1Inicio;
    let healthData = null;
    let rawResponse = null;

    try {
      rawResponse = await response.text();
      if (rawResponse) {
        healthData = JSON.parse(rawResponse);
      }
    } catch (e) {
      console.warn('[ETAPA2] Resposta não é JSON válido:', rawResponse);
    }

    const isDeploymentError = rawResponse?.includes('Deployment') || rawResponse?.includes('deploymentNotFound');

    // ✅ EXTRAIR NOME DA FUNÇÃO DINAMICAMENTE DA URL
    const webhookUrlParts = webhookUrl.split('/');
    const nomeFuncao = webhookUrlParts[webhookUrlParts.length - 1].split('?')[0]; // Remove query params

    testes.push({
      nome: 'Webhook responde GET (health check)',
      critico: true,
      status: response.ok && healthData ? 'sucesso' : 'erro',
      tempo_ms: t1Tempo,
      detalhes: { 
        status: response.status, 
        statusText: response.statusText,
        function_name: nomeFuncao,
        webhook_url: webhookUrl,
        version: healthData?.version || null,
        build: healthData?.build || null,
        timestamp_funcao: healthData?.timestamp || null,
        deployment_error: isDeploymentError,
        raw_response: isDeploymentError ? rawResponse.substring(0, 200) : null
      },
      sugestao_correcao: isDeploymentError ? 
        `🚨 ERRO DE DEPLOYMENT: A função "${nomeFuncao}" não está implantada na Base44. Vá em Code → Functions → ${nomeFuncao} e force um novo deploy.` :
        !response.ok ? `Função "${nomeFuncao}" não responde - verifique logs da função` : null
    });
  } catch (error) {
    testes.push({
      nome: 'Webhook responde GET (health check)',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { erro: error.message },
      sugestao_correcao: 'Webhook inacessível - URL incorreta ou função não existe'
    });
  }

  // Teste 2: Tempo de Resposta
  const t2Inicio = Date.now();
  try {
    await fetch(webhookUrl, { method: 'GET' });
    const t2Tempo = Date.now() - t2Inicio;
    testes.push({
      nome: 'Tempo de resposta < 3s',
      critico: false,
      status: t2Tempo < 3000 ? 'sucesso' : 'aviso',
      tempo_ms: t2Tempo,
      detalhes: { tempo_ms: t2Tempo },
      sugestao_correcao: t2Tempo >= 3000 ? 'Webhook lento - verifique infraestrutura' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Tempo de resposta < 3s',
      critico: false,
      status: 'erro',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { erro: error.message }
    });
  }

  // Teste 3: POST com Payload
  const t3Inicio = Date.now();
  try {
    const payloadEnviado = {
      instanceId: integracao.instance_id_provider,
      instance: integracao.instance_id_provider,
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999999999',
      momment: Date.now(),
      text: { message: '🧪 TESTE DIAGNÓSTICO COMPLETO' }
    };

    console.log('[ETAPA2] 📤 Payload sendo enviado:', JSON.stringify(payloadEnviado, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadEnviado)
    });

    let result = null;
    let rawResponse = null;
    let isDeploymentError = false;
    
    try {
      rawResponse = await response.text();
      result = JSON.parse(rawResponse);
    } catch (e) {
      console.error('[ETAPA2] Erro ao fazer parse da resposta POST:', e);
      isDeploymentError = rawResponse?.includes('Deployment') || rawResponse?.includes('deploymentNotFound');
    }
    
    // ✅ EXTRAIR NOME DA FUNÇÃO DINAMICAMENTE DA URL
    const webhookUrlParts = webhookUrl.split('/');
    const nomeFuncao = webhookUrlParts[webhookUrlParts.length - 1].split('?')[0];

    testes.push({
      nome: 'POST com payload aceito',
      critico: true,
      status: response.ok && result ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        status: response.status,
        function_name: nomeFuncao,
        webhook_url: webhookUrl,
        payload_aceito: result?.success || false,
        response: result,
        deployment_error: isDeploymentError,
        erro: isDeploymentError ? 'deploymentNotFound' : null
      },
      sugestao_correcao: isDeploymentError ?
        `🚨 DEPLOYMENT NOT FOUND: A função "${nomeFuncao}" não está acessível. Force novo deploy em Code → Functions → ${nomeFuncao}.` :
        !response.ok ? `Webhook "${nomeFuncao}" rejeitou POST - verifique código do handler` : null
    });
  } catch (error) {
    const isDeployError = error.message?.includes('Deployment') || error.message?.includes('JSON');
    // ✅ EXTRAIR NOME DA FUNÇÃO DINAMICAMENTE DA URL
    const webhookUrlParts = webhookUrl.split('/');
    const nomeFuncao = webhookUrlParts[webhookUrlParts.length - 1].split('?')[0];

    testes.push({
      nome: 'POST com payload aceito',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        erro: error.message,
        function_name: nomeFuncao,
        webhook_url: webhookUrl,
        deployment_suspected: isDeployError
      },
      sugestao_correcao: isDeployError ?
        `🚨 SUSPEITA DE DEPLOYMENT ERROR: Verifique se a função "${nomeFuncao}" foi implantada corretamente em Code → Functions → ${nomeFuncao}.` :
        'Erro ao enviar POST - verifique conectividade'
    });
  }

  const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
  const score = Math.round((testesComSucesso / testes.length) * 100);

  return {
    numero: 2,
    nome: 'Conectividade',
    score,
    tempo_ms: Date.now() - inicio,
    status: score === 100 ? 'sucesso' : score >= 75 ? 'aviso' : 'erro',
    testes
  };
}

// ========== ETAPA 3: RECEBIMENTO ==========
async function executarEtapa3(base44, integracao) {
  const inicio = Date.now();
  const testes = [];
  const webhookUrl = 'https://nexus360-pro.base44.app/api/functions/webhookWatsZapi';
  
  // IDs únicos para rastreamento
  const timestampBase = Date.now();
  const messageIdTexto = `TEST_TEXT_${timestampBase}`;
  const messageIdMidia = `TEST_MEDIA_${timestampBase}`;
  const messageIdBotao = `TEST_BUTTON_${timestampBase}`;
  const messageIdDuplicado = `TEST_DUP_${timestampBase}`;

  console.log('[ETAPA3] 🧪 Iniciando simulações de recebimento...');

  // ========== SIMULAÇÃO 1: MENSAGEM DE TEXTO (3.2) ==========
  const t1Inicio = Date.now();
  try {
    console.log('\n\n[ETAPA3.2] ════════════════════════════════════════════════════════');
    console.log('[ETAPA3.2] 🧪 TESTE: Mensagem de Texto');
    console.log('[ETAPA3.2] ════════════════════════════════════════════════════════');
    
    const payloadTexto = {
      instanceId: integracao.instance_id_provider,
      instance: integracao.instance_id_provider,
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999888777',
      momment: Date.now(),
      messageId: messageIdTexto,
      text: { message: '🧪 TESTE DIAGNÓSTICO - Mensagem de texto' }
    };

    console.log('[ETAPA3.2] 📤 1️⃣ ENVIANDO PAYLOAD:');
    console.log(JSON.stringify(payloadTexto, null, 2));
    console.log('[ETAPA3.2] 🌐 URL:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadTexto)
    });

    console.log('[ETAPA3.2] 📥 2️⃣ RESPOSTA HTTP:', response.status, response.statusText);
    
    const responseData = await response.json();
    console.log('[ETAPA3.2] 📥 RESPOSTA JSON:');
    console.log(JSON.stringify(responseData, null, 2));

    // Aguardar 2s para processamento
    console.log('[ETAPA3.2] ⏳ Aguardando 2s para processamento...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verificar persistência
    console.log('[ETAPA3.2] 🔍 3️⃣ VERIFICANDO PERSISTÊNCIA...');
    console.log('[ETAPA3.2] 🔍 Buscando ZapiPayloadNormalized com instance:', integracao.instance_id_provider);
    
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      10
    );
    
    console.log('[ETAPA3.2] 📊 Total de payloads encontrados:', payloads.length);
    payloads.forEach((p, idx) => {
      console.log(`[ETAPA3.2]   ${idx + 1}. messageId: ${p.payload_bruto?.messageId}, evento: ${p.evento}, sucesso: ${p.sucesso_processamento}`);
    });
    
    const payloadPersistido = payloads.find(p => 
      p.payload_bruto?.messageId === messageIdTexto ||
      p.payload_bruto?.text?.message?.includes('Mensagem de texto')
    );

    console.log('[ETAPA3.2] ✅ Payload persistido?', !!payloadPersistido);
    if (payloadPersistido) {
      console.log('[ETAPA3.2] 📦 Payload encontrado:', {
        id: payloadPersistido.id,
        messageId: payloadPersistido.payload_bruto?.messageId,
        sucesso: payloadPersistido.sucesso_processamento,
        erro: payloadPersistido.erro_detalhes
      });
    } else {
      console.log('[ETAPA3.2] ❌ NENHUM payload com messageId:', messageIdTexto);
    }

    console.log('[ETAPA3.2] 🔍 4️⃣ VERIFICANDO MESSAGE...');
    console.log('[ETAPA3.2] 🔍 Buscando Message com whatsapp_message_id:', messageIdTexto);
    
    const messages = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageIdTexto },
      '-created_date',
      1
    );
    
    console.log('[ETAPA3.2] 📊 Messages encontradas:', messages.length);
    if (messages.length > 0) {
      console.log('[ETAPA3.2] ✅ Message encontrada:', {
        id: messages[0].id,
        content: messages[0].content?.substring(0, 50),
        sender_id: messages[0].sender_id,
        thread_id: messages[0].thread_id
      });
    } else {
      console.log('[ETAPA3.2] ❌ NENHUMA Message encontrada');
    }

    console.log('[ETAPA3.2] ════════════════════════════════════════════════════════');
    console.log('[ETAPA3.2] 📊 RESULTADO FINAL:');
    console.log('[ETAPA3.2]   - Payload Persistido:', !!payloadPersistido);
    console.log('[ETAPA3.2]   - Message Criada:', messages.length > 0);
    console.log('[ETAPA3.2]   - Status:', payloadPersistido && messages.length > 0 ? '✅ SUCESSO' : '❌ ERRO');
    console.log('[ETAPA3.2] ════════════════════════════════════════════════════════\n\n');

    testes.push({
      nome: '3.2 Processamento Básico (Texto)',
      critico: true,
      status: payloadPersistido && messages.length > 0 ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { 
        payload_persistido: !!payloadPersistido,
        message_criada: messages.length > 0,
        message_id: messageIdTexto,
        webhook_response: responseData,
        payloads_encontrados: payloads.length,
        payload_id: payloadPersistido?.id,
        payload_sucesso: payloadPersistido?.sucesso_processamento,
        payload_erro: payloadPersistido?.erro_detalhes,
        message_id_db: messages[0]?.id
      },
      sugestao_correcao: !payloadPersistido ? 'Payload de texto não foi persistido - webhook não salvou no ZapiPayloadNormalized' : 
                        messages.length === 0 ? 'Message não foi criada - webhook salvou payload mas não criou Message' : null
    });
  } catch (error) {
    console.error('[ETAPA3.2] ❌❌❌ ERRO CRÍTICO:', error);
    console.error('[ETAPA3.2] Stack:', error.stack);
    testes.push({
      nome: '3.2 Processamento Básico (Texto)',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { 
        erro: error.message,
        erro_stack: error.stack,
        erro_completo: JSON.stringify(error, Object.getOwnPropertyNames(error))
      }
    });
  }

  // ========== SIMULAÇÃO 2: MENSAGEM COM MÍDIA (3.3a) ==========
  const t2Inicio = Date.now();
  try {
    console.log('\n\n[ETAPA3.3a] ════════════════════════════════════════════════════════');
    console.log('[ETAPA3.3a] 🧪 TESTE: Mensagem com Mídia');
    console.log('[ETAPA3.3a] ════════════════════════════════════════════════════════');
    
    const payloadMidia = {
      instanceId: integracao.instance_id_provider,
      instance: integracao.instance_id_provider,
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999888777',
      momment: Date.now(),
      messageId: messageIdMidia,
      image: {
        caption: '🧪 TESTE DIAGNÓSTICO - Imagem',
        imageUrl: 'https://via.placeholder.com/300',
        thumbnailUrl: 'https://via.placeholder.com/150',
        mimeType: 'image/jpeg'
      }
    };

    console.log('[ETAPA3.3a] 📤 ENVIANDO PAYLOAD:');
    console.log(JSON.stringify(payloadMidia, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadMidia)
    });

    const responseData = await response.json();
    console.log('[ETAPA3.3a] 📥 RESPOSTA:', JSON.stringify(responseData, null, 2));

    console.log('[ETAPA3.3a] ⏳ Aguardando 2s...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[ETAPA3.3a] 🔍 VERIFICANDO PERSISTÊNCIA...');
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      10
    );
    
    console.log('[ETAPA3.3a] 📊 Payloads encontrados:', payloads.length);
    const payloadPersistido = payloads.find(p => 
      p.payload_bruto?.messageId === messageIdMidia ||
      p.payload_bruto?.image
    );
    console.log('[ETAPA3.3a] ✅ Payload MÍDIA persistido?', !!payloadPersistido);

    const messages = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageIdMidia },
      '-created_date',
      1
    );
    
    console.log('[ETAPA3.3a] 📊 Messages encontradas:', messages.length);
    if (messages.length > 0) {
      console.log('[ETAPA3.3a] 📦 Message:', {
        media_type: messages[0].media_type,
        media_url: messages[0].media_url?.substring(0, 50)
      });
    }
    
    console.log('[ETAPA3.3a] 📊 RESULTADO:', payloadPersistido && messages.length > 0 && messages[0].media_type === 'image' ? '✅ SUCESSO' : '⚠️ AVISO');
    console.log('[ETAPA3.3a] ════════════════════════════════════════════════════════\n\n');

    testes.push({
      nome: '3.3a Conteúdo: Mídia/Arquivo',
      critico: false,
      status: payloadPersistido && messages.length > 0 && messages[0].media_type === 'image' ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { 
        payload_persistido: !!payloadPersistido,
        message_criada: messages.length > 0,
        media_type: messages[0]?.media_type,
        media_url: messages[0]?.media_url,
        webhook_response: responseData
      },
      sugestao_correcao: !payloadPersistido ? 'Payload de mídia não foi persistido' :
                        messages.length === 0 ? 'Message com mídia não foi criada' :
                        messages[0].media_type !== 'image' ? 'Media type não foi identificado corretamente' : null
    });
  } catch (error) {
    console.error('[ETAPA3.3a] ❌ ERRO:', error);
    testes.push({
      nome: '3.3a Conteúdo: Mídia/Arquivo',
      critico: false,
      status: 'aviso',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { erro: error.message, erro_stack: error.stack }
    });
  }

  // ========== SIMULAÇÃO 3: MENSAGEM COM BOTÃO (3.3b) ==========
  const t3Inicio = Date.now();
  try {
    console.log('\n\n[ETAPA3.3b] ════════════════════════════════════════════════════════');
    console.log('[ETAPA3.3b] 🧪 TESTE: Mensagem com Botão');
    console.log('[ETAPA3.3b] ════════════════════════════════════════════════════════');
    
    const payloadBotao = {
      instanceId: integracao.instance_id_provider,
      instance: integracao.instance_id_provider,
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999888777',
      momment: Date.now(),
      messageId: messageIdBotao,
      buttonsResponseMessage: {
        buttonId: 'btn_option_1',
        message: '🧪 TESTE DIAGNÓSTICO - Botão'
      }
    };

    console.log('[ETAPA3.3b] 📤 ENVIANDO PAYLOAD:');
    console.log(JSON.stringify(payloadBotao, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadBotao)
    });

    const responseData = await response.json();
    console.log('[ETAPA3.3b] 📥 RESPOSTA:', JSON.stringify(responseData, null, 2));

    console.log('[ETAPA3.3b] ⏳ Aguardando 2s...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[ETAPA3.3b] 🔍 VERIFICANDO...');
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      10
    );
    
    const payloadPersistido = payloads.find(p => 
      p.payload_bruto?.messageId === messageIdBotao ||
      p.payload_bruto?.buttonsResponseMessage
    );
    console.log('[ETAPA3.3b] ✅ Payload BOTÃO persistido?', !!payloadPersistido);

    const messages = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageIdBotao },
      '-created_date',
      1
    );
    console.log('[ETAPA3.3b] 📊 Messages:', messages.length);
    console.log('[ETAPA3.3b] ════════════════════════════════════════════════════════\n\n');

    testes.push({
      nome: '3.3b Conteúdo: Botão Interativo',
      critico: false,
      status: payloadPersistido && messages.length > 0 ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        payload_persistido: !!payloadPersistido,
        message_criada: messages.length > 0,
        button_id: payloadPersistido?.payload_bruto?.buttonsResponseMessage?.buttonId,
        interactive_type: 'button_reply',
        webhook_response: responseData
      },
      sugestao_correcao: !payloadPersistido ? 'Payload de botão não foi persistido' :
                        messages.length === 0 ? 'Message com botão não foi criada' : null
    });
  } catch (error) {
    console.error('[ETAPA3.3b] ❌ ERRO:', error);
    testes.push({
      nome: '3.3b Conteúdo: Botão Interativo',
      critico: false,
      status: 'aviso',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { erro: error.message, erro_stack: error.stack }
    });
  }

  // ========== SIMULAÇÃO 4: DUPLICIDADE (3.4) ==========
  const t4Inicio = Date.now();
  try {
    console.log('\n\n[ETAPA3.4] ════════════════════════════════════════════════════════');
    console.log('[ETAPA3.4] 🧪 TESTE: Tratamento de Duplicidade');
    console.log('[ETAPA3.4] ════════════════════════════════════════════════════════');
    
    const payloadDup1 = {
      instanceId: integracao.instance_id_provider,
      instance: integracao.instance_id_provider,
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999888777',
      momment: Date.now(),
      messageId: messageIdDuplicado,
      text: { message: '🧪 TESTE DUPLICIDADE - Primeira vez' }
    };

    console.log('[ETAPA3.4] 📤 ENVIANDO 1ª VEZ...');
    console.log(JSON.stringify(payloadDup1, null, 2));
    
    const resp1 = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadDup1)
    });
    const data1 = await resp1.json();
    console.log('[ETAPA3.4] 📥 Resposta 1:', JSON.stringify(data1, null, 2));

    console.log('[ETAPA3.4] ⏳ Aguardando 1s...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[ETAPA3.4] 📤 ENVIANDO 2ª VEZ (DUPLICADO)...');
    const resp2 = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadDup1)
    });
    const data2 = await resp2.json();
    console.log('[ETAPA3.4] 📥 Resposta 2:', JSON.stringify(data2, null, 2));

    console.log('[ETAPA3.4] ⏳ Aguardando 2s...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[ETAPA3.4] 🔍 VERIFICANDO DUPLICIDADE...');
    const messages = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: messageIdDuplicado }
    );
    console.log('[ETAPA3.4] 📊 Messages criadas:', messages.length);

    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      20
    );
    const payloadsDuplicados = payloads.filter(p => 
      p.payload_bruto?.messageId === messageIdDuplicado
    );
    console.log('[ETAPA3.4] 📊 Payloads persistidos:', payloadsDuplicados.length);

    const temDuplicidade = messages.length === 1;
    console.log('[ETAPA3.4] 📊 RESULTADO:', temDuplicidade ? '✅ SUCESSO (1 message)' : `⚠️ AVISO (${messages.length} messages)`);
    console.log('[ETAPA3.4] ════════════════════════════════════════════════════════\n\n');

    testes.push({
      nome: '3.4 Tratamento de Duplicidade',
      critico: false,
      status: temDuplicidade ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { 
        envios_simulados: 2,
        messages_criadas: messages.length,
        payloads_persistidos: payloadsDuplicados.length,
        tratamento_ok: temDuplicidade,
        message_id: messageIdDuplicado,
        resposta_envio1: data1,
        resposta_envio2: data2
      },
      sugestao_correcao: !temDuplicidade ? 
        `${messages.length} mensagens criadas para o mesmo ID - implemente verificação de whatsapp_message_id antes de criar Message` : 
        null
    });
  } catch (error) {
    console.error('[ETAPA3.4] ❌ ERRO:', error);
    testes.push({
      nome: '3.4 Tratamento de Duplicidade',
      critico: false,
      status: 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { erro: error.message, erro_stack: error.stack }
    });
  }

  const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
  const score = Math.round((testesComSucesso / testes.length) * 100);

  console.log(`[ETAPA3] ✅ Concluído - Score: ${score}%`);

  return {
    numero: 3,
    nome: 'Recebimento',
    score,
    tempo_ms: Date.now() - inicio,
    status: score === 100 ? 'sucesso' : score >= 50 ? 'aviso' : 'erro',
    testes
  };
}

// ========== ETAPA 4: PROCESSAMENTO ==========
async function executarEtapa4(base44, integracao) {
  const inicio = Date.now();
  const testes = [];

  // Aguardar 3s para processamento completo
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Teste 1: Contact criado
  const t1Inicio = Date.now();
  try {
    const contacts = await base44.asServiceRole.entities.Contact.filter(
      { telefone: '5548999999999' },
      '-created_date',
      1
    );
    const contactRecente = contacts.length > 0 && 
      new Date(contacts[0].created_date) > new Date(Date.now() - 120000);
    testes.push({
      nome: 'Contact criado/encontrado',
      critico: true,
      status: contacts.length > 0 ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { 
        total_contacts: contacts.length,
        contact_recente: contactRecente,
        contact_ok: contacts.length > 0
      },
      sugestao_correcao: contacts.length === 0 ? 'Contact não foi criado - verifique webhook' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Contact criado/encontrado',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { erro: error.message, contact_ok: false }
    });
  }

  // Teste 2: Thread criada
  const t2Inicio = Date.now();
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 5);
    const threadRecente = threads.find(t => 
      new Date(t.created_date) > new Date(Date.now() - 120000)
    );
    testes.push({
      nome: 'MessageThread criada/atualizada',
      critico: true,
      status: threadRecente ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { 
        thread_recente: !!threadRecente,
        thread_ok: !!threadRecente
      },
      sugestao_correcao: !threadRecente ? 'Thread não criada - verifique fluxo' : null
    });
  } catch (error) {
    testes.push({
      nome: 'MessageThread criada/atualizada',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { erro: error.message, thread_ok: false }
    });
  }

  // Teste 3: Message persistida
  const t3Inicio = Date.now();
  try {
    const messages = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: { $ne: null } },
      '-created_date',
      5
    );
    const messageRecente = messages.find(m => 
      new Date(m.created_date) > new Date(Date.now() - 120000)
    );
    testes.push({
      nome: 'Message persistida',
      critico: true,
      status: messageRecente ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        message_recente: !!messageRecente,
        message_ok: !!messageRecente
      },
      sugestao_correcao: !messageRecente ? 'Message não persistida - verifique transação' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Message persistida',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { erro: error.message, message_ok: false }
    });
  }

  // Teste 4: Estatísticas atualizadas
  const t4Inicio = Date.now();
  try {
    const integracaoAtualizada = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ id: integracao.id });
    const statsOk = integracaoAtualizada.length > 0 && integracaoAtualizada[0].estatisticas;
    testes.push({
      nome: 'Estatísticas atualizadas',
      critico: false,
      status: statsOk ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { stats_ok: !!statsOk },
      sugestao_correcao: !statsOk ? 'Estatísticas não estão sendo atualizadas' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Estatísticas atualizadas',
      critico: false,
      status: 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { erro: error.message, stats_ok: false }
    });
  }

  const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
  const score = Math.round((testesComSucesso / testes.length) * 100);

  return {
    numero: 4,
    nome: 'Processamento',
    score,
    tempo_ms: Date.now() - inicio,
    status: score === 100 ? 'sucesso' : score >= 66 ? 'aviso' : 'erro',
    testes
  };
}

// ========== FINALIZAR E PERSISTIR ==========
async function finalizarDiagnostico(base44, resultado, inicioTotal) {
  resultado.tempo_total_ms = Date.now() - inicioTotal;

  // Calcular score total
  const scores = resultado.etapas.map(e => e.score);
  resultado.score_total = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Comparar com execução anterior
  try {
    const historico = await base44.asServiceRole.entities.DiagnosticoExecucao.filter(
      { whatsapp_integration_id: resultado.whatsapp_integration_id },
      '-data_execucao',
      1
    );
    
    if (historico.length > 0) {
      const anterior = historico[0];
      resultado.comparacao_execucao_anterior = {
        score_anterior: anterior.score_total,
        diferenca: resultado.score_total - anterior.score_total,
        melhorou: resultado.score_total > anterior.score_total
      };
    }
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
  }

  // Salvar no banco
  try {
    const execucaoSalva = await base44.asServiceRole.entities.DiagnosticoExecucao.create(resultado);
    return Response.json({ 
      success: true, 
      diagnostico: execucaoSalva,
      message: `Diagnóstico concluído! Score: ${resultado.score_total}%`
    });
  } catch (error) {
    console.error('Erro ao salvar diagnóstico:', error);
    return Response.json({ 
      success: false, 
      diagnostico: resultado,
      error: 'Erro ao persistir diagnóstico: ' + error.message 
    }, { status: 500 });
  }
}