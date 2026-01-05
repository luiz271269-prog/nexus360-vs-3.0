import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TESTE DE CONEXÃO W-API
 * Verifica se a instância está conectada e funcionando corretamente
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400 });
    }

    console.log('[TESTE WAPI] Testando integração:', integration_id);

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      return Response.json({ 
        success: false, 
        error: 'Integração não encontrada' 
      }, { status: 404 });
    }

    // Validar configuração
    if (!integracao.instance_id_provider || !integracao.api_key_provider) {
      return Response.json({
        success: false,
        error: 'Configuração incompleta: Instance ID e Token são obrigatórios'
      }, { status: 400 });
    }

    // Testar conexão com W-API
    const url = `https://api.w-api.app/v1/instance/status?instanceId=${integracao.instance_id_provider}`;
    
    console.log('[TESTE WAPI] URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      }
    });

    const data = await response.json();

    console.log('[TESTE WAPI] Resposta:', data);

    if (!response.ok) {
      return Response.json({
        success: false,
        error: `W-API retornou erro ${response.status}`,
        dados: data
      });
    }

    // Atualizar status no banco
    const novoStatus = data.connected ? 'conectado' : 'desconectado';
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integration_id, {
      status: novoStatus,
      numero_telefone: data.phoneNumber || integracao.numero_telefone,
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({
      success: true,
      dados: {
        conectado: data.connected,
        telefone: data.phoneNumber,
        instanceId: data.instanceId,
        status: novoStatus
      }
    });

  } catch (error) {
    console.error('[TESTE WAPI] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});