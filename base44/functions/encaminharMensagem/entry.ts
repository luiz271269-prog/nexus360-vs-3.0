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

    // ── CARTÃO DE ACESSOS RÁPIDOS: IMAGEM (visual igual ao app) + LEGENDA com links ──
    // WhatsApp não entrega o cartão nativo com 9 botões (limite de 2-3 botões da Meta).
    // Solução fiel: enviamos a IMAGEM do cartão (visual idêntico) e, na LEGENDA, os
    // links clicáveis de cada acesso — mesma EXECUÇÃO do app (toca e abre o destino).
    const CARTAO_IMAGEM_URL = 'https://media.base44.com/images/public/68a7d067890527304dbe8477/052916df9_generated_image.png';
    const msgType = String(mensagem?.metadata?.message_type || '');
    const ehCartaoPorTipo = msgType.startsWith('acessos_');
    const ehCartaoPorConteudo = /neuraltec\s*[—\-]\s*acessos\s*r[áa]pidos/i.test(String(mensagem?.content || ''));
    let cartaoLegendaLinks = '';
    if (ehCartaoPorTipo || ehCartaoPorConteudo) {
      const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
      const linhas = itens
        .filter(it => String(it.tipo || 'link').toLowerCase() !== 'pix') // Pix sai só por ação manual
        .map(it => `${it.emoji || '🔗'} *${it.titulo}*: ${it.url}`);
      cartaoLegendaLinks = `⚡ *NEURALTEC — Acessos rápidos*\n\n${linhas.join('\n')}`;
    }

    // Preparar dados para envio
    const dadosEnvio = {
      integration_id: integration_id,
      numero_destino: target_phone
    };

    let conteudoEncaminhado = '';

    // Verificar tipo de conteúdo
    if (cartaoLegendaLinks) {
      // Cartão: imagem (visual do app) + legenda com links clicáveis (mesma execução)
      dadosEnvio.media_url = CARTAO_IMAGEM_URL;
      dadosEnvio.media_type = 'image';
      dadosEnvio.media_caption = cartaoLegendaLinks;
      conteudoEncaminhado = cartaoLegendaLinks;
    } else if (mensagem.media_url && mensagem.media_type !== 'none') {
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