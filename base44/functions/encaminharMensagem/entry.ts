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

    const {
      message_id,
      target_phone,
      integration_id,
      target_thread_id // Thread de destino (opcional)
    } = payload;

    console.log('[ENCAMINHAR] 📤 Iniciando encaminhamento:', { message_id, target_phone, integration_id });

    if (!message_id || !target_phone || !integration_id) {
      throw new Error('message_id, target_phone e integration_id são obrigatórios');
    }

    // Buscar mensagem original
    const mensagem = await base44.asServiceRole.entities.Message.get(message_id);
    
    if (!mensagem) {
      throw new Error('Mensagem não encontrada');
    }

    // Preparar dados para envio
    const dadosEnvio = {
      integration_id: integration_id,
      numero_destino: target_phone
    };

    let conteudoEncaminhado = '';

    // Verificar tipo de conteúdo
    if (mensagem.media_url && mensagem.media_type !== 'none') {
      // Encaminhar mídia
      dadosEnvio.media_url = mensagem.media_url;
      dadosEnvio.media_type = mensagem.media_type;
      dadosEnvio.media_caption = mensagem.media_caption || mensagem.content || '';
      conteudoEncaminhado = `[${mensagem.media_type}] ${dadosEnvio.media_caption || ''}`.trim();
    } else if (mensagem.content) {
      // Encaminhar texto
      dadosEnvio.mensagem = `📨 *[Mensagem Encaminhada]*\n\n${mensagem.content}`;
      conteudoEncaminhado = dadosEnvio.mensagem;
    } else {
      throw new Error('Mensagem sem conteúdo para encaminhar');
    }

    // Chamar função de envio
    const envioResponse = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

    if (!envioResponse.data.success) {
      throw new Error(envioResponse.data.error || 'Erro ao encaminhar');
    }

    // Se tiver thread de destino, salvar mensagem lá
    if (target_thread_id) {
      const threadDestino = await base44.asServiceRole.entities.MessageThread.get(target_thread_id);
      
      if (threadDestino) {
        // Criar mensagem na thread de destino
        await base44.asServiceRole.entities.Message.create({
          thread_id: target_thread_id,
          sender_id: user.id,
          sender_type: 'user',
          recipient_id: threadDestino.contact_id,
          recipient_type: 'contact',
          content: conteudoEncaminhado || '[Mensagem Encaminhada]',
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: envioResponse.data.message_id,
          sent_at: new Date().toISOString(),
          media_url: mensagem.media_url || null,
          media_type: mensagem.media_type || 'none',
          media_caption: mensagem.media_caption || null,
          metadata: {
            whatsapp_integration_id: integration_id,
            is_forwarded: true,
            original_message_id: message_id,
            forwarded_by: user.id,
            forwarded_at: new Date().toISOString()
          }
        });

        // Atualizar thread de destino
        await base44.asServiceRole.entities.MessageThread.update(target_thread_id, {
          last_message_content: conteudoEncaminhado?.substring(0, 100) || '[Encaminhada]',
          last_message_at: new Date().toISOString(),
          last_message_sender: 'user',
          whatsapp_integration_id: integration_id
        });
      }
    }

    console.log('[ENCAMINHAR] ✅ Mensagem encaminhada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message_id: envioResponse.data.message_id
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[ENCAMINHAR] ❌ Erro:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers }
    );
  }
});