import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    const user = await base44.auth.me();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers }
      );
    }

    const payload = await req.json();
    const { message_id, delete_for_everyone } = payload;

    console.log('[APAGAR] 🗑️ Solicitação de exclusão:', { message_id, delete_for_everyone });

    if (!message_id) {
      throw new Error('message_id é obrigatório');
    }

    // Buscar mensagem
    const mensagem = await base44.asServiceRole.entities.Message.get(message_id);
    
    if (!mensagem) {
      throw new Error('Mensagem não encontrada');
    }

    // Verificar permissões (apenas quem enviou ou admin pode apagar)
    if (mensagem.sender_id !== user.id && user.role !== 'admin') {
      throw new Error('Sem permissão para apagar esta mensagem');
    }

    // Se delete_for_everyone, tentar apagar no WhatsApp (janela do WhatsApp: ~48h)
    let apagadaNoWhatsApp = false;
    let motivoFalhaWhatsApp = null;

    if (delete_for_everyone && mensagem.whatsapp_message_id) {
      const mensagemData = new Date(mensagem.sent_at || mensagem.created_date);
      const diffHoras = (Date.now() - mensagemData.getTime()) / (1000 * 60 * 60);

      if (diffHoras > 48) {
        motivoFalhaWhatsApp = 'Mensagem com mais de 48h — o WhatsApp não permite mais apagar para todos';
      } else {
        try {
          const thread = await base44.asServiceRole.entities.MessageThread.get(mensagem.thread_id);
          const integrationId = mensagem.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id;
          const integracao = integrationId
            ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId).catch(() => null)
            : null;

          // Telefone do contato é OBRIGATÓRIO para apagar para todos
          const contactId = thread?.contact_id || mensagem.recipient_id;
          const contact = contactId
            ? await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null)
            : null;
          let phone = (contact?.telefone || contact?.telefone_canonico || '').replace(/\D/g, '');
          if (phone && phone.length <= 11 && !phone.startsWith('55')) phone = '55' + phone;

          if (!integracao) {
            motivoFalhaWhatsApp = 'Integração WhatsApp não encontrada';
          } else if (!phone) {
            motivoFalhaWhatsApp = 'Telefone do contato não encontrado';
          } else {
            const isWAPI = integracao.api_provider === 'w_api';
            let endpoint, fetchOptions;

            if (isWAPI) {
              // W-API: DELETE /message/delete-message?instanceId=...
              const baseUrl = integracao.base_url_provider || 'https://api.w-api.app/v1';
              endpoint = `${baseUrl}/message/delete-message?instanceId=${integracao.instance_id_provider}&phone=${phone}&messageId=${encodeURIComponent(mensagem.whatsapp_message_id)}`;
              fetchOptions = {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${integracao.api_key_provider}`
                }
              };
            } else {
              // Z-API: DELETE /messages?messageId=...&phone=...&owner=true (owner=true = apagar para todos)
              endpoint = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/messages?messageId=${encodeURIComponent(mensagem.whatsapp_message_id)}&phone=${phone}&owner=true`;
              fetchOptions = {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': integracao.security_client_token_header || ''
                }
              };
            }

            console.log('[APAGAR] 🌐 Endpoint delete:', endpoint);
            const response = await fetch(endpoint, fetchOptions);
            const respText = await response.text();

            if (response.ok) {
              apagadaNoWhatsApp = true;
              console.log('[APAGAR] ✅ Mensagem apagada no WhatsApp (para todos)');
            } else {
              motivoFalhaWhatsApp = `Provedor retornou erro: ${respText.substring(0, 200)}`;
              console.log('[APAGAR] ⚠️ Não foi possível apagar no WhatsApp:', respText);
            }
          }
        } catch (error) {
          motivoFalhaWhatsApp = error.message;
          console.error('[APAGAR] ⚠️ Erro ao tentar apagar no WhatsApp:', error);
        }
      }
    }

    // Marcar como deletada no sistema (soft delete)
    // Preservar whatsapp_integration_id no metadata
    const metadataAtualizado = {
      ...(mensagem.metadata || {}),
      deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      original_content: mensagem.content
    };
    
    await base44.asServiceRole.entities.Message.update(message_id, {
      status: 'deletada',
      content: '[Mensagem apagada]',
      metadata: metadataAtualizado
    });

    console.log('[APAGAR] ✅ Mensagem marcada como deletada');

    return new Response(
      JSON.stringify({
        success: true,
        deleted_from_whatsapp: apagadaNoWhatsApp,
        whatsapp_error: motivoFalhaWhatsApp
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[APAGAR] ❌ Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers }
    );
  }
});