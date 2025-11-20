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

  // Teste 3: Security Token
  const t3Inicio = Date.now();
  const temToken = !!integracao.security_client_token_header;
  testes.push({
    nome: 'Security Token configurado',
    critico: true,
    status: temToken ? 'sucesso' : 'erro',
    tempo_ms: Date.now() - t3Inicio,
    detalhes: { configurado: temToken },
    sugestao_correcao: !temToken ? 'Configure o Security Token na aba Configurações' : null
  });

  // Teste 4: Número de telefone
  const t4Inicio = Date.now();
  const temTelefone = !!integracao.numero_telefone && integracao.numero_telefone.startsWith('+');
  testes.push({
    nome: 'Número de telefone válido',
    critico: false,
    status: temTelefone ? 'sucesso' : 'aviso',
    tempo_ms: Date.now() - t4Inicio,
    detalhes: { numero: integracao.numero_telefone },
    sugestao_correcao: !temTelefone ? 'Use formato internacional (+5511...)' : null
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
  const webhookUrl = integracao.webhook_url || `${Deno.env.get('BASE44_APP_URL') || 'http://localhost:8000'}/api/functions/whatsappWebhook`;

  // Teste 1: GET Health Check
  const t1Inicio = Date.now();
  try {
    const response = await fetch(webhookUrl, { method: 'GET' });
    const t1Tempo = Date.now() - t1Inicio;
    testes.push({
      nome: 'Webhook responde GET (health check)',
      critico: true,
      status: response.ok ? 'sucesso' : 'erro',
      tempo_ms: t1Tempo,
      detalhes: { status: response.status, statusText: response.statusText },
      sugestao_correcao: !response.ok ? 'Verifique se a função está implantada' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Webhook responde GET (health check)',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { erro: error.message },
      sugestao_correcao: 'Webhook inacessível - verifique deploy'
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
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: integracao.instance_id_provider,
        instance: integracao.instance_id_provider,
        type: 'ReceivedCallback',
        event: 'ReceivedCallback',
        phone: '5548999999999',
        momment: Date.now(),
        text: { message: '🧪 TESTE DIAGNÓSTICO COMPLETO' }
      })
    });

    const result = await response.json();
    
    testes.push({
      nome: 'POST com payload aceito',
      critico: true,
      status: response.ok ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        status: response.status, 
        payload_aceito: result.success || false,
        response: result
      },
      sugestao_correcao: !response.ok ? 'Webhook rejeitou POST - verifique handler' : null
    });
  } catch (error) {
    testes.push({
      nome: 'POST com payload aceito',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { erro: error.message }
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

  // Aguardar 2s para mensagem ser processada
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Teste 1: Payload persistido
  const t1Inicio = Date.now();
  try {
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      5
    );
    const payloadRecente = payloads.find(p => 
      new Date(p.timestamp_recebido) > new Date(Date.now() - 60000)
    );
    testes.push({
      nome: 'Payload recebido e persistido',
      critico: true,
      status: payloadRecente ? 'sucesso' : 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { 
        total_payloads: payloads.length,
        payload_recente: !!payloadRecente,
        normalized_created: !!payloadRecente
      },
      sugestao_correcao: !payloadRecente ? 'Nenhum payload recente - verifique adapter' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Payload recebido e persistido',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t1Inicio,
      detalhes: { erro: error.message }
    });
  }

  // Teste 2: Instance ID identificado
  const t2Inicio = Date.now();
  try {
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      1
    );
    const identificado = payloads.length > 0 && payloads[0].integration_id;
    testes.push({
      nome: 'Instance ID identificado corretamente',
      critico: true,
      status: identificado ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { 
        instance_esperado: integracao.instance_id_provider,
        integration_id_encontrado: payloads[0]?.integration_id,
        instance_id: payloads[0]?.instance_identificado
      },
      sugestao_correcao: !identificado ? 'Verifique busca por instance no webhook' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Instance ID identificado corretamente',
      critico: true,
      status: 'erro',
      tempo_ms: Date.now() - t2Inicio,
      detalhes: { erro: error.message }
    });
  }

  // Teste 3: Evento classificado
  const t3Inicio = Date.now();
  try {
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      { instance_identificado: integracao.instance_id_provider },
      '-timestamp_recebido',
      1
    );
    const classificado = payloads.length > 0 && payloads[0].evento;
    testes.push({
      nome: 'Evento classificado',
      critico: false,
      status: classificado ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { 
        evento: payloads[0]?.evento,
        evento_esperado: 'ReceivedCallback'
      },
      sugestao_correcao: !classificado ? 'Adapter não está classificando eventos' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Evento classificado',
      critico: false,
      status: 'erro',
      tempo_ms: Date.now() - t3Inicio,
      detalhes: { erro: error.message }
    });
  }

  // Teste 4: Log recente no WebhookLog
  const t4Inicio = Date.now();
  try {
    const logs = await base44.asServiceRole.entities.WebhookLog.list('-timestamp', 5);
    const logRecente = logs.find(l => 
      new Date(l.timestamp) > new Date(Date.now() - 60000)
    );
    testes.push({
      nome: 'Log de webhook recente',
      critico: false,
      status: logRecente ? 'sucesso' : 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { 
        log_recente: !!logRecente,
        total_logs: logs.length
      },
      sugestao_correcao: !logRecente ? 'WebhookLog não está sendo persistido' : null
    });
  } catch (error) {
    testes.push({
      nome: 'Log de webhook recente',
      critico: false,
      status: 'aviso',
      tempo_ms: Date.now() - t4Inicio,
      detalhes: { erro: error.message }
    });
  }

  const testesComSucesso = testes.filter(t => t.status === 'sucesso').length;
  const score = Math.round((testesComSucesso / testes.length) * 100);

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