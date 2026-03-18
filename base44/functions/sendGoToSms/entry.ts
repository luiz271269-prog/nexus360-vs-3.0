import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ADAPTADOR GOTO - SMS OUTBOUND
 * Converte payload unificado → GoTo Connect Messaging REST API
 * Documentação: https://developer.goto.com/guides/HowTos/04_SendSMS/
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      recipientPhone,      // Telefone destino (E.164)
      content,             // Texto do SMS
      accessToken,         // Token OAuth GoTo
      smsFromNumberId      // ID do número origem habilitado
    } = await req.json();

    // Validações
    if (!recipientPhone || !content) {
      return Response.json({ 
        error: 'recipientPhone e content são obrigatórios' 
      }, { status: 400 });
    }

    if (!accessToken) {
      return Response.json({ 
        error: 'accessToken ausente na conexão GoTo' 
      }, { status: 400 });
    }

    // Construir request para GoTo Messaging API
    const gotoApiUrl = 'https://api.goto.com/messaging/v1/messages';
    
    const requestBody = {
      to: recipientPhone,
      body: content,
      from: smsFromNumberId || undefined
    };

    console.log('[GOTO_SMS] Enviando SMS:', {
      to: recipientPhone,
      bodyLength: content.length
    });

    const response = await fetch(gotoApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[GOTO_SMS] Erro da API:', responseData);
      throw new Error(responseData.error_description || responseData.error || 'Erro ao enviar SMS');
    }

    console.log('[GOTO_SMS] ✅ SMS enviado:', responseData);

    return Response.json({
      success: true,
      messageId: responseData.id || responseData.messageId,
      provider_response: responseData
    });

  } catch (error) {
    console.error('[GOTO_SMS] Erro:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});