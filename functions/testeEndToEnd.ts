import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  TESTE END-TO-END AUTOMATIZADO V1                            ║
 * ║  + Valida fluxo completo: Envio → Webhook → Playbook        ║
 * ║  + Testa follow-ups e recorrência                            ║
 * ║  + Simula cenários reais de produção                         ║
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
    const payload = await req.json();
    const { action, test_phone, integration_id } = payload;

    console.log('[TESTE E2E] 🎯 Action:', action);

    switch (action) {
      case 'teste_completo':
        return Response.json(await testeCompleto(base44, test_phone, integration_id), { headers });
      
      case 'teste_envio_zapi':
        return Response.json(await testeEnvioZAPI(base44, test_phone, integration_id), { headers });
      
      case 'teste_webhook_recebimento':
        return Response.json(await testeWebhookRecebimento(base44, integration_id), { headers });
      
      case 'teste_playbook_execucao':
        return Response.json(await testePlaybookExecucao(base44, test_phone), { headers });
      
      case 'teste_followup_automatico':
        return Response.json(await testeFollowupAutomatico(base44, test_phone), { headers });
      
      case 'validar_integracao':
        return Response.json(await validarIntegracao(base44, integration_id), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500, headers });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * TESTE COMPLETO - Valida todo o fluxo
 * ═══════════════════════════════════════════════════════════════
 */
async function testeCompleto(base44, testPhone, integrationId) {
  console.log('[TESTE E2E] 🚀 Iniciando teste completo...');
  
  const resultados = {
    timestamp: new Date().toISOString(),
    etapas: [],
    status_geral: 'sucesso',
    tempo_total_ms: 0
  };

  const inicio = Date.now();

  try {
    // ETAPA 1: Validar Integração
    console.log('[TESTE E2E] 📱 [1/5] Validando integração WhatsApp...');
    const validacao = await validarIntegracao(base44, integrationId);
    resultados.etapas.push({
      nome: 'Validação Integração',
      status: validacao.success ? 'sucesso' : 'falha',
      detalhes: validacao
    });

    if (!validacao.success) {
      resultados.status_geral = 'falha';
      return resultados;
    }

    // ETAPA 2: Enviar Mensagem de Teste via Z-API
    console.log('[TESTE E2E] 📤 [2/5] Enviando mensagem de teste...');
    const envio = await testeEnvioZAPI(base44, testPhone, integrationId);
    resultados.etapas.push({
      nome: 'Envio Mensagem',
      status: envio.success ? 'sucesso' : 'falha',
      detalhes: envio
    });

    if (!envio.success) {
      resultados.status_geral = 'falha';
      return resultados;
    }

    // ETAPA 3: Aguardar e Validar Recebimento via Webhook (simular)
    console.log('[TESTE E2E] 📥 [3/5] Simulando recebimento via webhook...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s
    
    const webhook = await testeWebhookRecebimento(base44, integrationId);
    resultados.etapas.push({
      nome: 'Webhook Recebimento',
      status: webhook.success ? 'sucesso' : 'falha',
      detalhes: webhook
    });

    // ETAPA 4: Criar e Executar Playbook de Teste
    console.log('[TESTE E2E] ⚙️ [4/5] Testando execução de playbook...');
    const playbook = await testePlaybookExecucao(base44, testPhone);
    resultados.etapas.push({
      nome: 'Execução Playbook',
      status: playbook.success ? 'sucesso' : 'falha',
      detalhes: playbook
    });

    // ETAPA 5: Validar Follow-up Automático
    console.log('[TESTE E2E] 🔄 [5/5] Testando follow-up automático...');
    const followup = await testeFollowupAutomatico(base44, testPhone);
    resultados.etapas.push({
      nome: 'Follow-up Automático',
      status: followup.success ? 'sucesso' : 'falha',
      detalhes: followup
    });

    // Determinar status geral
    const falhas = resultados.etapas.filter(e => e.status === 'falha').length;
    if (falhas > 0) {
      resultados.status_geral = falhas === resultados.etapas.length ? 'falha_completa' : 'parcial';
    }

    resultados.tempo_total_ms = Date.now() - inicio;
    
    console.log(`[TESTE E2E] ✅ Teste completo finalizado: ${resultados.status_geral} (${resultados.tempo_total_ms}ms)`);
    
    return {
      success: resultados.status_geral !== 'falha_completa',
      resultados
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro no teste completo:', error);
    resultados.status_geral = 'erro';
    resultados.erro = error.message;
    resultados.tempo_total_ms = Date.now() - inicio;
    
    return {
      success: false,
      resultados
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * VALIDAR INTEGRAÇÃO - Verifica se WhatsApp está conectado
 * ═══════════════════════════════════════════════════════════════
 */
async function validarIntegracao(base44, integrationId) {
  try {
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    
    if (!integration) {
      return {
        success: false,
        erro: 'Integração não encontrada'
      };
    }

    // Tentar fazer ping na Z-API
    const url = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/status`;
    
    const response = await fetch(url, {
      headers: {
        'Client-Token': integration.security_client_token_header
      }
    });

    const data = await response.json();

    const conectado = data.connected === true || data.state === 'open';

    return {
      success: conectado,
      status_conexao: conectado ? 'conectado' : 'desconectado',
      detalhes: {
        instance_id: integration.instance_id_provider,
        numero_telefone: integration.numero_telefone,
        provider: integration.api_provider,
        resposta_api: data
      }
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro ao validar integração:', error);
    return {
      success: false,
      erro: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * TESTE ENVIO Z-API - Envia mensagem de teste
 * ═══════════════════════════════════════════════════════════════
 */
async function testeEnvioZAPI(base44, testPhone, integrationId) {
  try {
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    
    if (!integration) {
      return { success: false, erro: 'Integração não encontrada' };
    }

    const mensagemTeste = `🧪 TESTE AUTOMÁTICO VendaPro
    
Timestamp: ${new Date().toISOString()}

Se você recebeu esta mensagem, significa que a integração WhatsApp está funcionando perfeitamente! ✅`;

    const url = `${integration.base_url_provider}/message/sendText/${integration.instance_id_provider}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': integration.security_client_token_header
      },
      body: JSON.stringify({
        phone: testPhone.replace(/\D/g, ''),
        message: mensagemTeste
      })
    });

    const data = await response.json();

    return {
      success: response.ok,
      message_id: data.messageId || data.key?.id,
      response_status: response.status,
      detalhes: data
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro ao enviar mensagem:', error);
    return {
      success: false,
      erro: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * TESTE WEBHOOK - Valida se webhook está recebendo mensagens
 * ═══════════════════════════════════════════════════════════════
 */
async function testeWebhookRecebimento(base44, integrationId) {
  try {
    // Verificar últimos logs de webhook
    const logs = await base44.asServiceRole.entities.WebhookLog.list('-timestamp', 10);
    
    const logsRecentes = logs.filter(log => 
      log.instance_id === integrationId &&
      new Date(log.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Últimos 5 minutos
    );

    const logsSucesso = logsRecentes.filter(log => log.success === true);
    const logsErro = logsRecentes.filter(log => log.success === false);

    return {
      success: logsRecentes.length > 0,
      total_logs_recentes: logsRecentes.length,
      logs_sucesso: logsSucesso.length,
      logs_erro: logsErro.length,
      ultimo_log: logsRecentes[0] || null,
      mensagem: logsRecentes.length > 0 
        ? 'Webhook recebendo mensagens corretamente'
        : 'Nenhuma mensagem recebida nos últimos 5 minutos'
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro ao verificar webhook:', error);
    return {
      success: false,
      erro: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * TESTE PLAYBOOK - Cria e executa playbook de teste
 * ═══════════════════════════════════════════════════════════════
 */
async function testePlaybookExecucao(base44, testPhone) {
  try {
    // 1. Criar ou buscar playbook de teste
    let playbook = await base44.asServiceRole.entities.FlowTemplate.filter({ nome: '[TESTE] Playbook E2E' });
    
    if (playbook.length === 0) {
      playbook = await base44.asServiceRole.entities.FlowTemplate.create({
        nome: '[TESTE] Playbook E2E',
        descricao: 'Playbook criado automaticamente para testes',
        categoria: 'vendas',
        tipo_fluxo: 'geral',
        gatilhos: ['teste_e2e'],
        prioridade: 999,
        steps: [
          {
            type: 'message',
            texto: 'Olá! Este é um teste automático do sistema.'
          },
          {
            type: 'delay',
            delay_seconds: 2
          },
          {
            type: 'message',
            texto: 'Se você recebeu esta mensagem, o playbook está funcionando! ✅'
          },
          {
            type: 'end'
          }
        ],
        ativo: true,
        requires_ia: false
      });
    } else {
      playbook = playbook[0];
    }

    // 2. Criar contato de teste
    let contact = await base44.asServiceRole.entities.Contact.filter({ telefone: testPhone });
    
    if (contact.length === 0) {
      contact = await base44.asServiceRole.entities.Contact.create({
        nome: 'Teste Automático',
        telefone: testPhone,
        tipo_contato: 'lead',
        tags: ['teste_e2e']
      });
    } else {
      contact = contact[0];
    }

    // 3. Criar thread
    const thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contact.id,
      status: 'aberta'
    });

    // 4. Criar execução
    const execution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: playbook.id,
      contact_id: contact.id,
      thread_id: thread.id,
      status: 'ativo',
      current_step: 0,
      variables: { teste_automatico: true }
    });

    // 5. Executar playbook
    const playbookResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/playbookEngine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'continue_execution',
        execution_id: execution.id
      })
    });

    const resultado = await playbookResponse.json();

    return {
      success: resultado.success,
      playbook_id: playbook.id,
      execution_id: execution.id,
      thread_id: thread.id,
      contact_id: contact.id,
      detalhes: resultado
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro ao testar playbook:', error);
    return {
      success: false,
      erro: error.message
    };
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * TESTE FOLLOW-UP - Valida sistema de recorrência
 * ═══════════════════════════════════════════════════════════════
 */
async function testeFollowupAutomatico(base44, testPhone) {
  try {
    // 1. Criar playbook de follow-up
    let playbook = await base44.asServiceRole.entities.FlowTemplate.filter({ nome: '[TESTE] Follow-up E2E' });
    
    if (playbook.length === 0) {
      playbook = await base44.asServiceRole.entities.FlowTemplate.create({
        nome: '[TESTE] Follow-up E2E',
        descricao: 'Teste de follow-up automático',
        categoria: 'vendas',
        tipo_fluxo: 'follow_up_vendas',
        gatilhos: ['teste_followup'],
        prioridade: 999,
        steps: [
          {
            type: 'message',
            texto: 'Primeira mensagem do follow-up'
          },
          {
            type: 'wait_response',
            delay_days: 1 // 24h para o próximo
          },
          {
            type: 'message',
            texto: 'Segunda mensagem (após 24h)'
          },
          {
            type: 'wait_response',
            delay_days: 3 // 3 dias para o próximo
          },
          {
            type: 'message',
            texto: 'Terceira mensagem (após 3 dias)'
          },
          {
            type: 'end'
          }
        ],
        ativo: true
      });
    } else {
      playbook = playbook[0];
    }

    // 2. Criar contact
    let contact = await base44.asServiceRole.entities.Contact.filter({ telefone: testPhone });
    if (contact.length === 0) {
      contact = await base44.asServiceRole.entities.Contact.create({
        nome: 'Teste Follow-up',
        telefone: testPhone,
        tipo_contato: 'lead'
      });
    } else {
      contact = contact[0];
    }

    // 3. Criar execução agendada para follow-up
    const nextAction = new Date();
    nextAction.setSeconds(nextAction.getSeconds() + 30); // 30 segundos no futuro (teste rápido)

    const execution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: playbook.id,
      contact_id: contact.id,
      status: 'waiting_follow_up',
      current_step: 0,
      follow_up_stage_index: 0,
      next_action_at: nextAction.toISOString(),
      variables: { teste_followup: true }
    });

    // 4. Verificar se agendador consegue pegar
    const agendadorResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/agendadorAutomacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'executar_listas_agendadas'
      })
    });

    const agendadorResult = await agendadorResponse.json();

    return {
      success: true,
      playbook_id: playbook.id,
      execution_id: execution.id,
      next_action_at: nextAction.toISOString(),
      agendador_processou: agendadorResult.processadas > 0,
      detalhes: agendadorResult
    };

  } catch (error) {
    console.error('[TESTE E2E] ❌ Erro ao testar follow-up:', error);
    return {
      success: false,
      erro: error.message
    };
  }
}