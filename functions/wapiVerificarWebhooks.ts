import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// W-API - VERIFICAR E DIAGNOSTICAR CONFIGURAÇÃO DE WEBHOOKS
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Autenticação obrigatória
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado - apenas administradores' 
      }, { status: 403 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400 });
    }

    // Buscar integração
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integration || integration.api_provider !== 'w_api') {
      return Response.json({ 
        success: false, 
        error: 'Integração W-API não encontrada' 
      }, { status: 404 });
    }

    console.log('[WAPI-VERIFY] Verificando:', integration.nome_instancia);

    // Construir URL do webhook de produção
    const webhookUrl = `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi`;

    // Headers para W-API
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.api_key_provider}`
    };

    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';

    // 1. Verificar status da instância
    console.log('[WAPI-VERIFY] 1. Verificando status da instância...');
    let statusResponse;
    try {
      const statusReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/status`, {
        method: 'GET',
        headers
      });
      statusResponse = await statusReq.json();
      console.log('[WAPI-VERIFY] Status:', JSON.stringify(statusResponse).substring(0, 300));
    } catch (e) {
      console.error('[WAPI-VERIFY] Erro ao verificar status:', e.message);
      return Response.json({
        success: false,
        error: 'Erro ao verificar status da instância',
        details: e.message
      }, { status: 500 });
    }

    // 2. Listar webhooks configurados
    console.log('[WAPI-VERIFY] 2. Listando webhooks configurados...');
    let webhooksResponse;
    try {
      const webhooksReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/webhooks`, {
        method: 'GET',
        headers
      });
      webhooksResponse = await webhooksReq.json();
      console.log('[WAPI-VERIFY] Webhooks:', JSON.stringify(webhooksResponse).substring(0, 500));
    } catch (e) {
      console.error('[WAPI-VERIFY] Erro ao listar webhooks:', e.message);
      webhooksResponse = { error: e.message };
    }

    // Verificar se nosso webhook está configurado
    const webhookConfigurado = webhooksResponse?.webhooks?.find(w => 
      w.url === webhookUrl || w.url?.includes('webhookWapi')
    );

    return Response.json({
      success: true,
      integration: {
        id: integration.id,
        nome: integration.nome_instancia,
        instance_id: integration.instance_id_provider,
        status: integration.status
      },
      wapi_status: statusResponse,
      webhooks_atuais: webhooksResponse,
      webhook_correto_configurado: !!webhookConfigurado,
      webhook_esperado: webhookUrl,
      diagnostico: {
        instancia_conectada: statusResponse?.status === 'connected' || statusResponse?.connected === true,
        webhooks_count: webhooksResponse?.webhooks?.length || 0,
        precisa_configurar: !webhookConfigurado
      },
      instrucoes: webhookConfigurado ? 
        'Webhook configurado corretamente! Se não está recebendo mensagens, envie uma mensagem de teste pelo WhatsApp.' :
        `Configure este webhook na W-API:\n1. Acesse o painel da W-API\n2. Vá em Webhooks\n3. Configure:\n   - URL: ${webhookUrl}\n   - Eventos: Ao receber mensagem, Ao enviar mensagem, Ao desconectar`
    });

  } catch (error) {
    console.error('[WAPI-VERIFY] Erro fatal:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});