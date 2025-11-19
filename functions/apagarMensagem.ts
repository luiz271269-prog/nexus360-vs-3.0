import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Se delete_for_everyone e a mensagem é recente (< 15 minutos), tentar apagar no WhatsApp
    if (delete_for_everyone && mensagem.whatsapp_message_id) {
      const mensagemData = new Date(mensagem.sent_at || mensagem.created_date);
      const agora = new Date();
      const diffMinutos = (agora - mensagemData) / (1000 * 60);

      if (diffMinutos <= 15) {
        try {
          // Buscar thread para pegar integração
          const thread = await base44.asServiceRole.entities.MessageThread.get(mensagem.thread_id);
          
          if (thread && thread.whatsapp_integration_id) {
            const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id);
            
            if (integracao) {
              // Tentar apagar no WhatsApp via Z-API
              const endpoint = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/delete-message`;
              
              const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': integracao.security_client_token_header || ''
                },
                body: JSON.stringify({
                  messageId: mensagem.whatsapp_message_id
                })
              });

              if (response.ok) {
                console.log('[APAGAR] ✅ Mensagem apagada no WhatsApp');
              } else {
                console.log('[APAGAR] ⚠️ Não foi possível apagar no WhatsApp:', await response.text());
              }
            }
          }
        } catch (error) {
          console.error('[APAGAR] ⚠️ Erro ao tentar apagar no WhatsApp:', error);
          // Continua e marca como deletada no sistema
        }
      }
    }

    // Marcar como deletada no sistema (soft delete)
    await base44.asServiceRole.entities.Message.update(message_id, {
      status: 'deletada',
      content: '[Mensagem apagada]',
      metadata: {
        ...mensagem.metadata,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        original_content: mensagem.content
      }
    });

    console.log('[APAGAR] ✅ Mensagem marcada como deletada');

    return new Response(
      JSON.stringify({
        success: true,
        deleted_from_whatsapp: delete_for_everyone
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