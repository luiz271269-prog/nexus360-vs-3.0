import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - v2.0.0 MICRO-URA COMPLETA
// ============================================================================
// CORREÇÕES v2.0.0:
// 1. Micro-URA processada ANTES de outras lógicas
// 2. Respostas "1/2" consumidas corretamente
// 3. Mensagens de sistema marcadas com is_system_message
// 4. Mesma ordem de processamento do Z-API
// ============================================================================

const VERSION = 'v2.0.0-MICRO-URA';
const BUILD_DATE = '2025-12-12';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const requestQueue = new Map();
const RATE_LIMIT_MS = 1000;
const integrationCache = new Map();
const CACHE_TTL = 60000;

// ============================================================================
// NORMALIZAÇÃO DE TELEFONE
// ============================================================================
function normalizarTelefoneUnificado(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  return apenasNumeros;
}

// ============================================================================
// FILTRO
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';
  const evento = String(payload.event || '').toLowerCase();
  const senderId = payload.sender?.id || payload.chat?.id || '';
  const phone = senderId.replace(/@.*$/, '').toLowerCase();

  if (phone.includes('status') || senderId.includes('@broadcast') || senderId.includes('@g.us')) {
    return 'jid_sistema_ou_grupo';
  }

  if (evento.includes('qrcode') || evento.includes('connection') || evento.includes('webhookconectado')) {
    return null;
  }

  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => evento.includes(e))) return 'evento_sistema';

  if (evento === 'webhookreceived' || payload.msgContent) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!senderId) return 'sem_telefone';
    return null;
  }

  if (evento === 'webhookdelivery' || evento.includes('delivery')) return null;
  return 'evento_desconhecido';
}

// ============================================================================
// EXTRAIR MÍDIA
// ============================================================================
function extrairMediaUrl(payload, msgContent, tipoMidia) {
  const camposRaiz = [
    payload.mediaUrl, payload.media?.url, payload.downloadUrl,
    payload.fileUrl, payload.url, payload.media?.downloadUrl, payload.urlMedia
  ];
  
  const camposMsgContent = {
    image: [msgContent?.imageMessage?.url, msgContent?.imageMessage?.directPath, msgContent?.imageMessage?.mediaUrl],
    video: [msgContent?.videoMessage?.url, msgContent?.videoMessage?.directPath],
    audio: [msgContent?.audioMessage?.url, msgContent?.audioMessage?.directPath],
    document: [msgContent?.documentMessage?.url, msgContent?.documentMessage?.directPath],
    sticker: [msgContent?.stickerMessage?.url, msgContent?.stickerMessage?.directPath]
  };
  
  const camposDoTipo = camposMsgContent[tipoMidia] || [];
  for (const campo of camposDoTipo) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) return campo;
  }
  for (const campo of camposRaiz) {
    if (campo && typeof campo === 'string' && campo.startsWith('http')) return campo;
  }
  return null;
}

function extrairMetadadosMidia(msgContent, tipoMidia) {
  const tipoMap = {
    image: 'imageMessage', video: 'videoMessage', audio: 'audioMessage',
    document: 'documentMessage', sticker: 'stickerMessage'
  };
  const msgKey = tipoMap[tipoMidia];
  const mediaMsg = msgContent?.[msgKey] || {};
  return {
    caption: mediaMsg.caption || null,
    fileName: mediaMsg.fileName || mediaMsg.title || null,
    mimetype: mediaMsg.mimetype || null,
    fileSize: mediaMsg.fileLength || mediaMsg.size || null,
    isPTT: mediaMsg.ptt === true
  };
}

// ============================================================================
// NORMALIZAR PAYLOAD
// ============================================================================
function normalizarPayload(payload) {
  const evento = String(payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || null;

  if (evento.includes('qrcode') || payload.qrcode) {
    return { type: 'qrcode', instanceId, qrCodeUrl: payload.qrcode || payload.qr || payload.base64 };
  }

  if (evento.includes('connection') || evento.includes('webhookconectado')) {
    const status = payload.connected === true ? 'conectado' : 'desconectado';
    return { type: 'connection', instanceId, status };
  }

  if (evento === 'webhookdelivery' || evento.includes('delivery')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      status: payload.status || payload.ack
    };
  }

  const senderId = payload.sender?.id || payload.chat?.id || '';
  const numeroLimpo = normalizarTelefoneUnificado(senderId);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const msgContent = payload.msgContent || {};
  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = '';
  let mediaMetadata = {};
  
  if (msgContent.imageMessage) {
    mediaType = 'image';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'image');
    conteudo = mediaMetadata.caption || '[Imagem]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'image');
    if (!mediaUrl && msgContent.imageMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.imageMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.videoMessage) {
    mediaType = 'video';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'video');
    conteudo = mediaMetadata.caption || '[Vídeo]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'video');
    if (!mediaUrl && msgContent.videoMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.videoMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.audioMessage) {
    mediaType = 'audio';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'audio');
    conteudo = mediaMetadata.isPTT ? '[Áudio de voz]' : '[Áudio]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'audio');
    if (!mediaUrl && msgContent.audioMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.audioMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.documentMessage) {
    mediaType = 'document';
    mediaMetadata = extrairMetadadosMidia(msgContent, 'document');
    conteudo = mediaMetadata.fileName ? `[Documento: ${mediaMetadata.fileName}]` : '[Documento]';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'document');
    if (!mediaUrl && msgContent.documentMessage?.mediaKey) {
      mediaMetadata.messageStruct = msgContent.documentMessage;
      mediaMetadata.requiresDownload = true;
    }
  } else if (msgContent.stickerMessage) {
    mediaType = 'sticker';
    mediaUrl = extrairMediaUrl(payload, msgContent, 'sticker');
    conteudo = '[Sticker]';
  } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (msgContent.locationMessage) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  } else if (msgContent.extendedTextMessage) {
    conteudo = msgContent.extendedTextMessage.text || '';
  } else if (msgContent.conversation) {
    conteudo = msgContent.conversation;
  }

  if (!conteudo && mediaType === 'none') {
    conteudo = payload.body || payload.text || payload.message?.text || payload.content || '';
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message', instanceId,
    messageId: payload.messageId || payload.key?.id,
    from: numeroLimpo, content: conteudo,
    mediaType, mediaUrl,
    mediaCaption: mediaMetadata.caption || msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
    fileName: mediaMetadata.fileName,
    mimetype: mediaMetadata.mimetype,
    messageStruct: mediaMetadata.messageStruct,
    requiresDownload: mediaMetadata.requiresDownload || false,
    pushName: payload.pushName || payload.senderName || payload.sender?.pushName,
    vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
    location: msgContent.locationMessage,
    quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
  };
}

// ============================================================================
// HANDLERS
// ============================================================================
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'qrcode', provider: 'w_api' }, { headers: corsHeaders });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'connection', status: dados.status, provider: 'w_api' }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      const statusMap = { 
        'READ': 'lida', 'read': 'lida', '3': 'lida',
        'DELIVERED': 'entregue', 'delivered': 'entregue', '2': 'entregue',
        'SENT': 'enviada', 'sent': 'enviada', '1': 'enviada'
      };
      const novoStatus = statusMap[dados.status] || statusMap[String(dados.status)];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {}
  return Response.json({ success: true, processed: 'status_update', provider: 'w_api' }, { headers: corsHeaders });
}

import { processarURA, ehFornecedorOuCompras, deveIniciarPreAtendimento, SAUDACOES } from './lib/uraProcessor.js';

// ============================================================================
// PRÉ-ATENDIMENTO INLINE - DEPRECATED (usar uraProcessor.js)
// ============================================================================
async function executarPreAtendimentoInline_DEPRECATED(base44, params) {
  const { action, thread_id, contact_id, integration_id, resposta_usuario } = params;

  function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function mapearSetorDeResposta(resposta, opcoesSetor) {
    if (!resposta || !opcoesSetor) return null;
    const textoLower = resposta.toLowerCase().trim();
    
    for (const opcao of opcoesSetor) {
      const labelLower = opcao.label.toLowerCase();
      if (textoLower === labelLower || textoLower.includes(opcao.setor) || labelLower.includes(textoLower)) {
        return opcao.setor;
      }
    }
    
    const mapeamento = {
      'vendas': ['venda', 'comprar', 'compra', 'preço', 'orçamento', 'cotação', '1', 'comercial'],
      'assistencia': ['suporte', 'assistencia', 'assistência', 'técnico', 'problema', 'ajuda', '2', 'reparo'],
      'financeiro': ['financeiro', 'boleto', 'pagamento', 'nota', 'fiscal', '3', 'cobrança'],
      'fornecedor': ['fornecedor', 'parceiro', 'fornecimento', '4'],
      'geral': ['outro', 'outros', 'geral', '5', 'não sei']
    };
    
    for (const [setor, palavras] of Object.entries(mapeamento)) {
      if (palavras.some(p => textoLower.includes(p))) {
        return setor;
      }
    }
    return null;
  }

  if (action === 'iniciar') {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
      is_pre_atendimento_padrao: true,
      ativo: true
    }, '-created_date', 1);

    if (templates.length === 0) return { success: false, error: 'sem_template' };

    const template = templates[0];
    if (template.activation_mode === 'disabled') return { success: false, skipped: true };

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!thread || !contato) return { success: false, error: 'thread_ou_contato_nao_encontrado' };

    const saudacao = getSaudacao();
    let mensagemSaudacao = `Olá! ${saudacao}`;
    if (contato.nome && contato.nome !== contato.telefone) {
      mensagemSaudacao = `Olá, ${contato.nome}! ${saudacao}`;
    }
    mensagemSaudacao += ', eu sou o assistente virtual.';

    const opcoesSetor = template.opcoes_setor || [
      { label: '💼 Vendas', setor: 'vendas' },
      { label: '🔧 Suporte Técnico', setor: 'assistencia' },
      { label: '💰 Financeiro', setor: 'financeiro' },
      { label: '📦 Fornecedores', setor: 'fornecedor' }
    ];

    const listaOpcoes = opcoesSetor.map((op, i) => `*${i + 1}.* ${op.label}`).join('\n');
    const blocoSetores = `┌─────────────────────────────────────┐
│  Para qual setor você gostaria de   │
│  falar?                              │
└─────────────────────────────────────┘

${listaOpcoes}

_Responda com o *número* ou *nome* da opção desejada._`;

    const mensagemCompleta = `${mensagemSaudacao}\n\n${blocoSetores}`;

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) return { success: false, error: 'integracao_nao_encontrada' };

    // W-API usa Authorization Bearer
    const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
    const wapiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integracao.api_key_provider}`
    };

    const envioResp = await fetch(wapiUrl, {
      method: 'POST',
      headers: wapiHeaders,
      body: JSON.stringify({
        instanceId: integracao.instance_id_provider,
        number: contato.telefone,
        text: mensagemCompleta
      })
    }).catch(e => { throw e; });
    
    const envioData = await envioResp.json();
    if (!envioResp.ok || envioData.error) {
      console.error('[W-API PRE-ATEND] ❌ Erro:', envioData);
      return { success: false, error: envioData.error || 'erro_envio' };
    }

    const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: template.id,
      contact_id: contact_id,
      thread_id: thread_id,
      whatsapp_integration_id: integration_id,
      status: 'ativo',
      current_step: 0,
      started_at: new Date().toISOString(),
      variables: { saudacao, opcoes_setor: opcoesSetor }
    });

    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() + 15);
    
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      pre_atendimento_ativo: true,
      pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
      pre_atendimento_started_at: new Date().toISOString(),
      pre_atendimento_timeout_at: timeoutDate.toISOString()
    });

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemCompleta,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: envioData.messageId || envioData.key?.id,
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true, is_system_message: true }
    });

    console.log('[W-API PRE-ATEND] ✅ Iniciado');
    return { success: true, flow_execution_id: flowExecution.id };
  }

  if (action === 'processar_resposta') {
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      thread_id: thread_id,
      status: 'ativo'
    }, '-created_date', 1);

    if (execucoes.length === 0) return { success: false, error: 'sem_execucao_ativa' };

    const execucao = execucoes[0];
    const opcoesSetor = execucao.variables?.opcoes_setor || [];
    const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!setorEscolhido) {
      const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      };

      await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          instanceId: integracao.instance_id_provider,
          number: contato.telefone,
          text: '❓ Opção inválida. Por favor, responda com o *número* da opção desejada.'
        })
      });

      return { success: true, understood: false };
    }

    const campoFidelizado = {
      'vendas': 'atendente_fidelizado_vendas',
      'assistencia': 'atendente_fidelizado_assistencia',
      'financeiro': 'atendente_fidelizado_financeiro',
      'fornecedor': 'atendente_fidelizado_fornecedor'
    };
    
    let atendenteFidelizado = null;
    const campo = campoFidelizado[setorEscolhido];
    if (campo && contato[campo]) {
      try {
        atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]);
      } catch (e) {}
    }

    const threadUpdate = {
      sector_id: setorEscolhido,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_timeout_at: null,
      pre_atendimento_setor_explicitamente_escolhido: true
    };

    let mensagemConfirmacao = '';
    if (atendenteFidelizado) {
      threadUpdate.assigned_user_id = atendenteFidelizado.id;
      mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}*. Aguarde!`;
    } else {
      mensagemConfirmacao = `✅ Entendido! Sua conversa foi direcionada para o setor de *${setorEscolhido}*. Um atendente entrará em contato.`;
    }

    await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
    await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
      status: 'concluido',
      completed_at: new Date().toISOString(),
      variables: { ...execucao.variables, setor_escolhido: setorEscolhido }
    });

    const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
    const wapiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integracao.api_key_provider}`
    };

    await fetch(wapiUrl, {
      method: 'POST',
      headers: wapiHeaders,
      body: JSON.stringify({
        instanceId: integracao.instance_id_provider,
        number: contato.telefone,
        text: mensagemConfirmacao
      })
    });

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemConfirmacao,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true, setor_roteado: setorEscolhido, is_system_message: true }
    });

    console.log('[W-API PRE-ATEND] ✅ Concluído');
    return { success: true, setor_escolhido: setorEscolhido };
  }

  return { success: false, error: 'acao_invalida' };
}

// ============================================================================
// GUARDAS
// ============================================================================
function ehFornecedorOuCompras(contact, thread) {
  if (contact.tipo_contato === 'fornecedor') return true;
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) return true;
  }
  const setoresExcluidos = ['fornecedor', 'compras', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) return true;
  return false;
}

function deveIniciarPreAtendimento(contact, thread) {
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id) return false;
  if (thread.pre_atendimento_setor_explicitamente_escolhido === true) return false;
  if (ehFornecedorOuCompras(contact, thread)) return false;
  return true;
}

// ============================================================================
// HANDLE MESSAGE - ORDEM CORRETA (IGUAL AO Z-API)
// ============================================================================
async function handleMessage(dados, payloadBruto, base44, req) {
  const inicio = Date.now();
  
  const lastRequest = requestQueue.get(dados.from);
  if (lastRequest && (Date.now() - lastRequest) < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  }
  requestQueue.set(dados.from, Date.now());
  
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      );
      if (dup.length > 0) {
        return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
      }
    } catch (e) {}
  }

  let integracaoId = null;
  if (dados.instanceId) {
    const cached = integrationCache.get(dados.instanceId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      integracaoId = cached.id;
    } else {
      try {
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integrationCache.set(dados.instanceId, { id: integracaoId, timestamp: Date.now() });
        }
      } catch (e) {}
    }
  }

  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;

  let contato;
  const contatos = await base44.asServiceRole.entities.Contact.filter(
    { telefone: dados.from }, '-created_date', 1
  );

  if (contatos.length > 0) {
    contato = contatos[0];
    const update = { ultima_interacao: new Date().toISOString() };
    if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
      update.nome = dados.pushName;
    }
    if (profilePicUrl && profilePicUrl !== 'null' && contato.foto_perfil_url !== profilePicUrl) {
      update.foto_perfil_url = profilePicUrl;
      update.foto_perfil_atualizada_em = new Date().toISOString();
    }
    await base44.asServiceRole.entities.Contact.update(contato.id, update);
  } else {
    contato = await base44.asServiceRole.entities.Contact.create({
      nome: dados.pushName || dados.from,
      telefone: dados.from,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: new Date().toISOString(),
      foto_perfil_url: profilePicUrl || null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null
    });
  }

  let thread;
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { contact_id: contato.id }, '-last_message_at', 1
  );

  if (threads.length > 0) {
    thread = threads[0];
    const threadUpdate = {
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType,
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta'
    };
    if (integracaoId && !thread.whatsapp_integration_id) {
      threadUpdate.whatsapp_integration_id = integracaoId;
    }
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
  } else {
    thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contato.id,
      whatsapp_integration_id: integracaoId,
      status: 'aberta',
      primeira_mensagem_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType,
      total_mensagens: 1,
      unread_count: 1,
      pre_atendimento_setor_explicitamente_escolhido: false,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'INIT',
      transfer_pending: false
    });
  }

  const mensagem = await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: contato.id,
    sender_type: 'contact',
    content: dados.content,
    media_url: dados.mediaUrl || null,
    media_type: dados.mediaType,
    media_caption: dados.mediaCaption,
    channel: 'whatsapp',
    status: 'recebida',
    whatsapp_message_id: dados.messageId,
    sent_at: new Date().toISOString(),
    metadata: {
      whatsapp_integration_id: integracaoId,
      instance_id: dados.instanceId,
      vcard: dados.vcard,
      location: dados.location,
      quoted_message: dados.quotedMessage,
      processed_by: VERSION,
      provider: 'w_api',
      messageStruct: dados.messageStruct,
      requiresDownload: dados.requiresDownload
    }
  });

  const now = new Date().toISOString();

  // ============================================================================
  // ORDEM CORRETA: MICRO-URA ANTES DE TUDO
  // ============================================================================
  
  // (1) LIMPEZA
  const { detectarPedidoTransferencia, podeEnviarPergunta, pedidoExpirou } = await import('./lib/detectorPedidoTransferencia.js');
  
  if (thread.transfer_pending && pedidoExpirou(thread)) {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      transfer_pending: false,
      transfer_requested_sector_id: null,
      transfer_requested_user_id: null,
      transfer_requested_text: null,
      transfer_confirmed: false,
      transfer_expires_at: null,
      transfer_last_prompt_at: null
    }).catch(() => {});
  }

  // (2) CONSUMIR RESPOSTAS "1/2"
  if (thread.transfer_pending && !pedidoExpirou(thread)) {
    const resposta = dados.content?.trim();
    
    if (resposta === '1' || resposta.toLowerCase().includes('sim')) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_confirmed: true
      }).catch(() => {});
      
      const integracao = integracaoId 
        ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
        : null;
      
      if (integracao) {
        const msgConfirm = '✅ Entendido! Seu pedido foi confirmado. Aguarde a transferência.';
        const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
        const wapiHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`
        };
        
        await fetch(wapiUrl, {
          method: 'POST',
          headers: wapiHeaders,
          body: JSON.stringify({
            instanceId: integracao.instance_id_provider,
            number: contato.telefone,
            text: msgConfirm
          })
        }).catch(() => {});
      }
      
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        duration_ms: duracao,
        micro_ura_resposta_consumida: true,
        acao: 'confirmou'
      }, { headers: corsHeaders });
    }
    else if (resposta === '2' || resposta.toLowerCase().includes('nao') || resposta.toLowerCase().includes('não')) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_requested_text: null,
        transfer_confirmed: false,
        transfer_expires_at: null,
        transfer_last_prompt_at: null
      }).catch(() => {});
      
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        duration_ms: duracao,
        micro_ura_resposta_consumida: true,
        acao: 'cancelou'
      }, { headers: corsHeaders });
    }
  }

  // (3) HARD-STOP COM DETECÇÃO
  if (thread.assigned_user_id) {
    if (!thread.transfer_pending) {
      let todosAtendentes = [];
      try {
        const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
        todosAtendentes = usuarios.filter(u => u.full_name && (u.attendant_sector || u.setores_atendidos_ids?.length > 0));
      } catch (e) {}
      
      const deteccao = detectarPedidoTransferencia(dados.content, todosAtendentes);
      
      if (deteccao.solicitou && podeEnviarPergunta(thread)) {
        const atendenteAtual = todosAtendentes.find(a => a.id === thread.assigned_user_id);
        const nomeAtendente = atendenteAtual?.full_name || 'seu atendente atual';
        
        let pergunta = `Você quer que eu transfira `;
        if (deteccao.setor) pergunta += `para *${deteccao.setor.charAt(0).toUpperCase() + deteccao.setor.slice(1)}*`;
        if (deteccao.nome_atendente) pergunta += ` (*${deteccao.nome_atendente}*)`;
        pergunta += ` agora?\n\n1️⃣ Sim, transferir\n2️⃣ Não, continuar com ${nomeAtendente}`;
        
        const integracao = integracaoId 
          ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
          : null;
        
        if (integracao) {
          const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
          const wapiHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${integracao.api_key_provider}`
          };
          
          await fetch(wapiUrl, {
            method: 'POST',
            headers: wapiHeaders,
            body: JSON.stringify({
              instanceId: integracao.instance_id_provider,
              number: contato.telefone,
              text: pergunta
            })
          }).catch(() => {});
          
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'system',
            sender_type: 'user',
            content: pergunta,
            channel: 'whatsapp',
            status: 'enviada',
            sent_at: new Date().toISOString(),
            metadata: { 
              whatsapp_integration_id: integracaoId, 
              is_system_message: true, 
              message_type: 'micro_ura_prompt' 
            }
          });
        }
        
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 5);
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: true,
          transfer_requested_sector_id: deteccao.setor,
          transfer_requested_user_id: deteccao.atendente_id,
          transfer_requested_text: deteccao.texto_original,
          transfer_requested_at: now,
          transfer_confirmed: false,
          transfer_expires_at: expiraEm.toISOString(),
          transfer_last_prompt_at: now
        }).catch(() => {});
      }
    }
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      atendente_existente: true,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // (4) FIDELIZAÇÃO
  if (contato.is_cliente_fidelizado === true) {
    const setorFidelizado = contato.atendente_fidelizado_vendas ? 'vendas' :
                            contato.atendente_fidelizado_assistencia ? 'assistencia' :
                            contato.atendente_fidelizado_financeiro ? 'financeiro' :
                            contato.atendente_fidelizado_fornecedor ? 'fornecedor' : 'geral';
    
    const campoFidelizado = {
      'vendas': 'atendente_fidelizado_vendas',
      'assistencia': 'atendente_fidelizado_assistencia',
      'financeiro': 'atendente_fidelizado_financeiro',
      'fornecedor': 'atendente_fidelizado_fornecedor'
    };
    
    let atendenteFidelizado = null;
    const campo = campoFidelizado[setorFidelizado];
    if (campo && contato[campo]) {
      try {
        atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]);
      } catch (e) {}
    }
    
    const threadUpdate = {
      sector_id: setorFidelizado,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'NAO_INICIADO'
    };
    
    if (atendenteFidelizado) {
      threadUpdate.assigned_user_id = atendenteFidelizado.id;
    }
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      fidelizado_transferido: true,
      duration_ms: duracao,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // (5) FORNECEDOR/COMPRAS
  if (ehFornecedorOuCompras(contato, thread)) {
    if (!thread.sector_id) {
      const setorInferido = contato.tipo_contato === 'fornecedor' ? 'fornecedor' : 'compras';
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        sector_id: setorInferido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'NAO_INICIADO'
      }).catch(() => {});
    }
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      fornecedor_compras: true,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // (6) PRÉ-ATENDIMENTO ATIVO
  const preAtivo = thread.pre_atendimento_ativo === true;
  
  if (preAtivo) {
    try {
      await processarURA({
        base44,
        action: 'processar_resposta',
        thread_id: thread.id,
        contact_id: contato.id,
        integration_id: integracaoId,
        resposta_usuario: dados.content,
        provider: 'w_api'
      });
    } catch (e) {}
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      pre_atendimento_resposta_processada: true,
      duration_ms: duracao,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  // (7) SAUDAÇÃO
  const SAUDACOES_LOCAL = SAUDACOES;
  
  const mensagemNorm = (dados.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const isSaudacao = SAUDACOES_LOCAL.some(s => 
    mensagemNorm === s || mensagemNorm.startsWith(s + ' ') || 
    mensagemNorm.startsWith(s + ',') || mensagemNorm.startsWith(s + '!')
  );
  
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id) {
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      pre_atendimento_concluido: true,
      provider: 'w_api'
    }, { headers: corsHeaders });
  }
  
  const isMidia = dados.mediaType && dados.mediaType !== 'none' && 
                  ['image', 'video', 'audio', 'document', 'sticker'].includes(dados.mediaType);
  
  if (!preAtivo && !isMidia && isSaudacao) {
    if (deveIniciarPreAtendimento(contato, thread)) {
      try {
        await processarURA({
          base44,
          action: 'iniciar',
          thread_id: thread.id,
          contact_id: contato.id,
          integration_id: integracaoId,
          provider: 'w_api'
        });
      } catch (e) {}
      
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        pre_atendimento_iniciado: true,
        duration_ms: duracao,
        provider: 'w_api'
      }, { headers: corsHeaders });
    }
  }
  
  // (8) MENSAGEM NORMAL
  const duracao = Date.now() - inicio;

  if (dados.mediaType && dados.mediaType !== 'none' && dados.messageStruct && integracaoId) {
    base44.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      media_type: dados.mediaType,
      integration_id: integracaoId,
      message_struct: dados.messageStruct,
      filename: dados.fileName,
      mimetype: dados.mimetype
    }).catch(() => {});
  }

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    duration_ms: duracao,
    provider: 'w_api',
    version: VERSION
  }, { headers: corsHeaders });
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ok', provider: 'w_api' }, { headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON invalido' }, { status: 200, headers: corsHeaders });
  }

  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
  }

  try {
    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      case 'connection':
        return await handleConnection(dados, base44);
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      case 'message':
        return await handleMessage(dados, payload, base44, req);
      default:
        return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[W-API WEBHOOK] ERRO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});