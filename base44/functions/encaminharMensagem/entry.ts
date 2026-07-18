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

    // ── CARTÃO DE ACESSOS RÁPIDOS: MENU INTERATIVO NATIVO (igual ao app) ──
    // Detecta se a mensagem encaminhada é o cartão de Acessos Rápidos. Em vez de
    // imagem+links, delega ao enviarCartaoAcesso, que entrega o menu interativo
    // nativo do WhatsApp: lista de categorias → cliente toca → botões de URL que
    // executam o acesso. Mesma interatividade do app. O source 'encaminhamento_manual'
    // ignora o cooldown de 30min e os guards de saudação.
    // Resolvemos AQUI a thread de destino (já temos sessão) e passamos o thread_id
    // pronto — assim o enviarCartaoAcesso não precisa resolver contato (evita 403).
    const msgType = String(mensagem?.metadata?.message_type || '');
    const ehCartaoPorTipo = msgType.startsWith('acessos_');
    const ehCartaoPorConteudo = /neuraltec\s*[—\-]\s*acessos\s*r[áa]pidos/i.test(String(mensagem?.content || ''));
    if (ehCartaoPorTipo || ehCartaoPorConteudo) {
      let threadCartaoId = target_thread_id || null;
      if (!threadCartaoId && target_phone) {
        const contatoResp = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
          telefone: target_phone,
          integracaoId: integration_id
        });
        const contatoDestino = contatoResp.data?.contact;
        if (contatoDestino?.id) {
          const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
            contact_id: contatoDestino.id, is_canonical: true
          });
          const threadCartao = threadsExistentes[0] || await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contatoDestino.id,
            channel: 'whatsapp',
            thread_type: 'contact_external',
            is_canonical: true,
            status: 'aberta',
            whatsapp_integration_id: integration_id,
            assigned_user_id: user.id
          });
          threadCartaoId = threadCartao.id;
        }
      }

      const cartaoResp = await base44.asServiceRole.functions.invoke('enviarCartaoAcesso', {
        source: 'encaminhamento_manual',
        thread_id: threadCartaoId,
        target_phone,
        integration_id
      });
      if (!cartaoResp.data?.success) {
        throw new Error(cartaoResp.data?.error || 'Erro ao encaminhar cartão de acessos');
      }
      return new Response(
        JSON.stringify({ success: true, message_id: cartaoResp.data.message_id, interativo: true }),
        { status: 200, headers }
      );
    }

    // Preparar dados para envio
    const dadosEnvio = {
      integration_id: integration_id,
      numero_destino: target_phone
    };

    let conteudoEncaminhado = '';

    // Verificar tipo de conteúdo
    if (mensagem.media_url && mensagem.media_type !== 'none') {
      // Encaminhar mídia — áudio usa campo 'audio_url'; demais usam 'media_url' + 'media_type'
      if (mensagem.media_type === 'audio') {
        dadosEnvio.audio_url = mensagem.media_url;
      } else {
        dadosEnvio.media_url = mensagem.media_url;
        dadosEnvio.media_type = mensagem.media_type;
        dadosEnvio.media_caption = mensagem.media_caption || mensagem.content || '';
      }
      conteudoEncaminhado = `[${mensagem.media_type}] ${mensagem.media_caption || mensagem.content || ''}`.trim();
    } else if (mensagem.content) {
      // Encaminhar texto
      dadosEnvio.mensagem = `📨 *[Mensagem Encaminhada]*\n\n${mensagem.content}`;
      conteudoEncaminhado = dadosEnvio.mensagem;
    } else {
      throw new Error('Mensagem sem conteúdo para encaminhar');
    }

    // Chamar função de envio (usa service role — chamadas backend→backend)
    const envioResponse = await base44.asServiceRole.functions.invoke('enviarWhatsApp', dadosEnvio);

    if (!envioResponse.data.success) {
      throw new Error(envioResponse.data.error || 'Erro ao encaminhar');
    }

    // ── Resolver a thread de destino para registrar a bolha de referência ──
    // Se o frontend não passou target_thread_id (encaminhamento direto por
    // telefone), localizamos/criamos a thread canônica do contato destinatário
    // pelo número — assim a mensagem encaminhada aparece na conversa dele com
    // status (✓), igual a uma mensagem normal.
    let threadDestino = null;
    if (target_thread_id) {
      threadDestino = await base44.asServiceRole.entities.MessageThread.get(target_thread_id).catch(() => null);
    } else if (target_phone) {
      const contatoResp = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
        telefone: target_phone,
        integracaoId: integration_id
      });
      const contatoDestino = contatoResp.data?.contact;
      if (contatoDestino?.id) {
        const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contatoDestino.id, is_canonical: true
        });
        threadDestino = threadsExistentes[0] || await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contatoDestino.id,
          channel: 'whatsapp',
          thread_type: 'contact_external',
          is_canonical: true,
          status: 'aberta',
          whatsapp_integration_id: integration_id,
          assigned_user_id: user.id
        });
      }
    }

    // Salvar a bolha de referência na thread de destino
    {
      if (threadDestino) {
        const target_thread_id_final = threadDestino.id;
        // Criar mensagem na thread de destino
        await base44.asServiceRole.entities.Message.create({
          thread_id: target_thread_id_final,
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
        await base44.asServiceRole.entities.MessageThread.update(target_thread_id_final, {
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