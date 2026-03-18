import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ADAPTADOR INSTAGRAM
 * Converte payload unificado para o contrato da Graph API do Instagram
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
      igBusinessId 
    } = await req.json();

    if (!recipientId || !accessToken || !igBusinessId) {
      return Response.json({ 
        error: 'Parâmetros obrigatórios: recipientId, accessToken, igBusinessId' 
      }, { status: 400 });
    }

    const graphVersion = 'v18.0';
    const endpoint = `https://graph.facebook.com/${graphVersion}/${igBusinessId}/messages`;

    let body = {
      recipient: { id: recipientId },
      message: {}
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

      // Se tiver caption junto com mídia
      if (content) {
        body.message.text = content;
      }
    } else if (content) {
      // Apenas texto
      body.message.text = content;
    } else {
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
      console.error('[INSTAGRAM] Erro na API:', result);
      return Response.json({
        success: false,
        error: result.error?.message || 'Erro ao enviar mensagem no Instagram',
        code: result.error?.code,
        details: result
      }, { status: response.status });
    }

    return Response.json({
      success: true,
      messageId: result.message_id,
      recipientId: result.recipient_id,
      timestamp: new Date().toISOString(),
      provider: 'instagram_api'
    });

  } catch (error) {
    console.error('[INSTAGRAM] Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});