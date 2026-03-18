import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  EVOLUTION API - INTEGRAÇÃO COMPLETA E FUNCIONAL            ║
 * ║  Todos os métodos de conexão WhatsApp via Evolution API     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.inovacode.app.br';
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_KEY) {
      return Response.json({
        success: false,
        error: 'EVOLUTION_API_KEY não configurada',
        instrucoes: [
          'Acesse Dashboard > Settings > Environment Variables',
          'Adicione: EVOLUTION_API_KEY = sua_chave_aqui',
          'Opcional: EVOLUTION_API_URL = url_servidor (padrão: https://evo.inovacode.app.br)'
        ]
      }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY
    };

    console.log(`📡 Evolution API - Ação: ${action}`);

    switch (action) {
      // ═══════════════════════════════════════════════════════
      // GERENCIAMENTO DE INSTÂNCIAS
      // ═══════════════════════════════════════════════════════
      
      case 'createInstance': {
        const { instanceName, numero, qrcode, webhook } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName,
            qrcode: qrcode !== false,
            number: numero,
            webhook: webhook || null
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          return Response.json({
            success: true,
            data: result,
            message: 'Instância criada com sucesso'
          });
        } else {
          throw new Error(result.message || 'Erro ao criar instância');
        }
      }

      case 'fetchInstances': {
        const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
          method: 'GET',
          headers
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result
        });
      }

      case 'connectInstance': {
        const { instanceName } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers
        });

        const result = await response.json();
        
        if (response.ok) {
          return Response.json({
            success: true,
            data: result,
            qrcode: result.qrcode?.base64 || result.base64 || null,
            pairingCode: result.pairingCode || result.code || null
          });
        } else {
          throw new Error(result.message || 'Erro ao conectar instância');
        }
      }

      case 'connectionState': {
        const { instanceName } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result,
          state: result.state || result.status
        });
      }

      case 'logout': {
        const { instanceName } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
          method: 'DELETE',
          headers
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result,
          message: 'Desconectado com sucesso'
        });
      }

      case 'deleteInstance': {
        const { instanceName } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result,
          message: 'Instância excluída com sucesso'
        });
      }

      // ═══════════════════════════════════════════════════════
      // ENVIO DE MENSAGENS
      // ═══════════════════════════════════════════════════════

      case 'sendTextMessage': {
        const { instanceName, numero, mensagem } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: numero,
            text: mensagem,
            delay: 1000
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          return Response.json({
            success: true,
            data: result,
            messageId: result.key?.id || result.message?.key?.id
          });
        } else {
          throw new Error(result.message || 'Erro ao enviar mensagem');
        }
      }

      case 'sendMediaMessage': {
        const { instanceName, numero, mediaUrl, mediaType, caption } = data;
        
        const mediaTypes = {
          'image': 'sendMedia',
          'video': 'sendMedia',
          'audio': 'sendMedia',
          'document': 'sendMedia'
        };

        const endpoint = mediaTypes[mediaType] || 'sendMedia';
        
        const response = await fetch(`${EVOLUTION_API_URL}/message/${endpoint}/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: numero,
            mediatype: mediaType,
            media: mediaUrl,
            caption: caption || '',
            delay: 1000
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          return Response.json({
            success: true,
            data: result,
            messageId: result.key?.id || result.message?.key?.id
          });
        } else {
          throw new Error(result.message || 'Erro ao enviar mídia');
        }
      }

      case 'sendTemplate': {
        const { instanceName, numero, templateName, templateParams } = data;
        
        // Templates precisam ser configurados no Evolution API
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: numero,
            text: `Template: ${templateName}\nParams: ${JSON.stringify(templateParams)}`,
            delay: 1000
          })
        });

        const result = await response.json();
        
        if (response.ok) {
          return Response.json({
            success: true,
            data: result,
            messageId: result.key?.id
          });
        } else {
          throw new Error(result.message || 'Erro ao enviar template');
        }
      }

      // ═══════════════════════════════════════════════════════
      // GERENCIAMENTO DE PERFIL
      // ═══════════════════════════════════════════════════════

      case 'fetchProfile': {
        const { instanceName } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfile/${instanceName}`, {
          method: 'GET',
          headers
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result
        });
      }

      case 'updateProfileName': {
        const { instanceName, name } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/chat/updateProfileName/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name })
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result
        });
      }

      // ═══════════════════════════════════════════════════════
      // WEBHOOK CONFIGURATION
      // ═══════════════════════════════════════════════════════

      case 'setWebhook': {
        const { instanceName, webhookUrl, events } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: true,
            events: events || [
              'QRCODE_UPDATED',
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'SEND_MESSAGE'
            ]
          })
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result
        });
      }

      // ═══════════════════════════════════════════════════════
      // VALIDAÇÃO DE NÚMERO
      // ═══════════════════════════════════════════════════════

      case 'checkNumberStatus': {
        const { instanceName, numero } = data;
        
        const response = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            numbers: [numero]
          })
        });

        const result = await response.json();
        
        return Response.json({
          success: true,
          data: result
        });
      }

      default:
        return Response.json({
          success: false,
          error: 'Ação inválida',
          acoes_disponiveis: [
            'createInstance', 'fetchInstances', 'connectInstance', 
            'connectionState', 'logout', 'deleteInstance',
            'sendTextMessage', 'sendMediaMessage', 'sendTemplate',
            'fetchProfile', 'updateProfileName', 'setWebhook',
            'checkNumberStatus'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Erro no evolutionAPI:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      detalhes: error.stack
    }, { status: 500 });
  }
});