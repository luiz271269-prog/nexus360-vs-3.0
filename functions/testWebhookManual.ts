import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { webhookUrl, testPayload } = await req.json();

    if (!webhookUrl) {
      return Response.json({
        success: false,
        error: 'webhookUrl é obrigatório'
      }, { status: 400, headers: corsHeaders });
    }

    console.log('[TEST-WEBHOOK-MANUAL] Testando webhook:', webhookUrl);
    console.log('[TEST-WEBHOOK-MANUAL] Payload:', JSON.stringify(testPayload, null, 2));

    // Payload padrão de teste da Z-API
    const payloadPadrao = {
      event: "ReceivedCallback",
      instanceId: "TEST_INSTANCE",
      messageId: "TEST_MSG_" + Date.now(),
      telefone: "5548999999999",
      fromMe: false,
      momment: Date.now(),
      text: {
        message: "Mensagem de teste do sistema"
      },
      senderName: "Sistema de Teste"
    };

    const payloadFinal = testPayload || payloadPadrao;

    // Enviar para o webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadFinal)
    });

    const statusCode = response.status;
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    console.log('[TEST-WEBHOOK-MANUAL] Status:', statusCode);
    console.log('[TEST-WEBHOOK-MANUAL] Resposta:', responseText);

    return Response.json({
      success: statusCode === 200,
      statusCode,
      response: responseData,
      payloadEnviado: payloadFinal
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[TEST-WEBHOOK-MANUAL] Erro:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});