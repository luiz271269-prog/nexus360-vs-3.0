import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { thread_id, contact_id, integration_id } = await req.json();

    if (!thread_id || !contact_id || !integration_id) {
      return Response.json({ 
        success: false, 
        error: 'Parâmetros obrigatórios: thread_id, contact_id, integration_id' 
      }, { status: 400 });
    }

    // Buscar promoções ativas e válidas
    const todasPromocoes = await base44.asServiceRole.entities.Promotion.filter({
      active: true
    });

    if (!todasPromocoes || todasPromocoes.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma promoção ativa encontrada',
        promocao_enviada: false
      });
    }

    // Filtrar promoções válidas (não expiradas)
    const hoje = new Date();
    const promocoesValidas = todasPromocoes.filter(promo => {
      if (!promo.valid_until) return true; // Sem data de validade = sempre válida
      const dataValidade = new Date(promo.valid_until);
      return dataValidade >= hoje;
    });

    if (promocoesValidas.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma promoção válida encontrada',
        promocao_enviada: false
      });
    }

    // Ordenar por prioridade (menor número = maior prioridade)
    promocoesValidas.sort((a, b) => {
      const prioA = a.priority || 10;
      const prioB = b.priority || 10;
      return prioA - prioB;
    });

    const promocaoEscolhida = promocoesValidas[0];

    // Construir mensagem
    let mensagemTexto = `🎉 *${promocaoEscolhida.title}*\n\n`;
    mensagemTexto += `${promocaoEscolhida.short_description}\n\n`;
    
    if (promocaoEscolhida.price_info) {
      mensagemTexto += `💰 ${promocaoEscolhida.price_info}\n\n`;
    }

    if (promocaoEscolhida.valid_until) {
      const dataValidade = new Date(promocaoEscolhida.valid_until);
      const dataFormatada = dataValidade.toLocaleDateString('pt-BR');
      mensagemTexto += `⏰ Válido até: ${dataFormatada}\n\n`;
    }

    if (promocaoEscolhida.link_produto) {
      mensagemTexto += `🔗 Saiba mais: ${promocaoEscolhida.link_produto}\n\n`;
    }

    mensagemTexto += `_Entre em contato para aproveitar esta oferta!_`;

    // Buscar contato para obter telefone
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    
    if (!contato || !contato.telefone) {
      return Response.json({ 
        success: false, 
        error: 'Contato sem telefone cadastrado' 
      }, { status: 400 });
    }

    // Enviar mensagem (com ou sem imagem)
    const dadosEnvio = {
      integration_id: integration_id,
      numero_destino: contato.telefone
    };

    if (promocaoEscolhida.imagem_url && promocaoEscolhida.tipo_midia === 'imagem') {
      // Enviar como mensagem com imagem
      dadosEnvio.media_url = promocaoEscolhida.imagem_url;
      dadosEnvio.media_type = 'image';
      dadosEnvio.media_caption = mensagemTexto;
    } else {
      // Enviar apenas texto
      dadosEnvio.mensagem = mensagemTexto;
    }

    const resultadoEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', dadosEnvio);

    if (!resultadoEnvio.data.success) {
      throw new Error(resultadoEnvio.data.error || 'Erro ao enviar mensagem');
    }

    // Registrar mensagem no banco
    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      recipient_id: contact_id,
      recipient_type: 'contact',
      content: promocaoEscolhida.imagem_url ? mensagemTexto : mensagemTexto,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: resultadoEnvio.data.message_id,
      sent_at: new Date().toISOString(),
      media_url: promocaoEscolhida.imagem_url || null,
      media_type: promocaoEscolhida.imagem_url ? 'image' : 'none',
      media_caption: promocaoEscolhida.imagem_url ? mensagemTexto : null,
      metadata: {
        whatsapp_integration_id: integration_id,
        is_promocao_automatica: true,
        promocao_id: promocaoEscolhida.id,
        promocao_titulo: promocaoEscolhida.title
      }
    });

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_content: `[Promoção] ${promocaoEscolhida.title}`,
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user'
    });

    // Registrar log
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'envio_promocao_automatica',
      contato_id: contact_id,
      thread_id: thread_id,
      usuario_id: 'system',
      resultado: 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        promocao_id: promocaoEscolhida.id,
        promocao_titulo: promocaoEscolhida.title,
        tem_imagem: !!promocaoEscolhida.imagem_url
      },
      origem: 'automacao',
      prioridade: 'normal'
    });

    return Response.json({
      success: true,
      promocao_enviada: true,
      promocao_titulo: promocaoEscolhida.title,
      message_id: resultadoEnvio.data.message_id
    });

  } catch (error) {
    console.error('[PROMOCAO_AUTO] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});