import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ADAPTADOR FACEBOOK MESSENGER
 * Converte payload unificado para o contrato da Graph API do Facebook
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      recipientId, 
      content, 
      mediaType, 
      mediaUrl, 
      accessToken, 
      pageId 
    } = await req.json();

    if (!recipientId || !accessToken) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: recipientId, accessToken' 
      }, { status: 400 });
    }

    const graphVersion = 'v18.0';
    const endpoint = `https://graph.facebook.com/${graphVersion}/me/messages`;

    let body = {
      recipient: { id: recipientId },
      message: {},
      messaging_type: 'RESPONSE'
    };

    // Construir payload baseado no tipo
    if (mediaUrl && mediaType && mediaType !== 'none') {
      // Enviar como attachment
      const attachmentType = mediaType === 'image' ? 'image' :
                            mediaType === 'video' ? 'video' :
                            mediaType === 'audio' ? 'audio' :
                            'file';

      body.message.attachment = {
        type: attachmentType,
        payload: {
          url: mediaUrl,
          is_reusable: false
        }
      };
    }

    // Texto sempre pode ser enviado (sozinho ou com mídia como caption no FB)
    if (content) {
      if (!body.message.attachment) {
        body.message.text = content;
      } else {
        // No Facebook Messenger, não há campo separado para caption
        // Enviar texto como mensagem separada se houver mídia
        // Ou incluir no texto antes da mídia
        body.message.text = content;
      }
    }

    if (!body.message.text && !body.message.attachment) {
      return Response.json({ 
        error: 'É necessário fornecer content ou mediaUrl' 
      }, { status: 400 });
    }

    // Fazer requisição para Graph API
    const response = await fetch(`${endpoint}?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[FACEBOOK] Erro na API:', result);
      return Response.json({
        success: false,
        error: result.error?.message || 'Erro ao enviar mensagem no Facebook',
        code: result.error?.code,
        details: result
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      messageId: result.message_id,
      recipientId: result.recipient_id,
      timestamp: new Date().toISOString(),
      provider: 'facebook_graph_api'
    });

  } catch (error) {
    console.error('[FACEBOOK] Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});