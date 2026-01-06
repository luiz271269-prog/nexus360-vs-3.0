import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { processInboundEvent } from './lib/inboundCore.js';

// ============================================================================
// WEBHOOK WHATSAPP W-API V2 - CLEAN DEPLOYMENT
// ============================================================================
const VERSION = 'v2.0.0-CLEAN';
const BUILD_DATE = '2026-01-06T19:27:00';

// LOG IMEDIATO PARA CONFIRMAR VERSÃO ATIVA
console.log('═══════════════════════════════════════════════════════════');
console.log(`[WAPI-V2] 🚀 VERSÃO ATIVA: ${VERSION}`);
console.log(`[WAPI-V2] 📅 BUILD: ${BUILD_DATE}`);
console.log(`[WAPI-V2] ✅ AUTH: createClientFromRequest (SDK Base44)`);
console.log('═══════════════════════════════════════════════════════════');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonOk = (data, extra = {}) => 
  Response.json({ success: true, ...data, ...extra }, { headers: corsHeaders });

const jsonErr = (error, status = 500) => 
  Response.json({ success: false, error }, { status, headers: corsHeaders });

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const ddd = apenasNumeros.substring(2, 4);
    const numero = apenasNumeros.substring(4);
    if (!numero.startsWith('9')) {
      apenasNumeros = '55' + ddd + '9' + numero;
    }
  }
  
  return '+' + apenasNumeros;
}

function classifyWapiEvent(payload) {
  if (!payload || typeof payload !== 'object') return 'ignore';
  const evento = String(payload.event || payload.type || '').toLowerCase();

  if (evento.includes('delivery') || evento.includes('ack') || evento.includes('status')) {
    return 'system-status';
  }

  if (payload.msgContent) {
    return 'user-message';
  }
  
  if (evento === 'webhookreceived' || evento === 'receivedcallback' || evento.includes('received')) {
    if (payload.text?.message || payload.body || payload.message || payload.messageId) {
      return 'user-message';
    }
  }

  return 'ignore';
}

function deveIgnorar(payload, classification) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';
  if (classification === 'ignore') return 'evento_desconhecido';
  if (classification === 'system-status') return null;

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const phone = String(
    payload.phone ?? payload.from ?? payload.sender?.id ?? payload.chat?.id ?? ''
  ).toLowerCase();
  const isGroup = payload.isGroup === true || phone.includes('@g.us');

  if (
    phone.includes('status@') || phone.includes('@broadcast') ||
    phone.includes('@lid') || phone.includes('@g.us') || isGroup
  ) {
    return 'jid_sistema';
  }

  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  const temMessageId = payload.messageId || payload.id;
  if (!temMessageId && eventosLixo.some((e) => tipo.includes(e))) {
    return 'evento_sistema';
  }

  if (tipo.includes('messagestatuscallback') || tipo.includes('message-status') || tipo.includes('webhookdelivery')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null;
  }

  const hasMsgId = payload.messageId || payload.id;
  const hasPhone = payload.phone || payload.from || payload.sender?.id || payload.chat?.id;
  const hasContent = payload.text || payload.body || payload.message || payload.msgContent;

  if (hasMsgId && hasPhone && (hasContent || payload.momment)) {
    if (payload.fromMe === true) return 'from_me';
    return null;
  }

  if (tipo.includes('receivedcallback') || tipo.includes('received')) {
    if (payload.fromMe === true) return 'from_me';
    if (!hasPhone) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

function normalizarPayload(payload) {
  try {
    const tipo = String(payload.type || payload.event || '').toLowerCase();
    const instanceId = payload.instanceId || payload.instance || payload.instance_id || null;

    if (tipo.includes('qrcode')) {
      return { type: 'qrcode', instanceId, qrCodeUrl: payload.qrcode || payload.qr || payload.base64 };
    }

    if (tipo.includes('connection')) {
      return { type: 'connection', instanceId, status: payload.connected ? 'conectado' : 'desconectado' };
    }

    if (tipo.includes('messagestatuscallback') || tipo.includes('webhookdelivery') || tipo.includes('delivery')) {
      return {
        type: 'message_update',
        instanceId,
        messageId: payload.ids?.[0] || payload.messageId || payload.key?.id || null,
        status: payload.status || payload.ack
      };
    }

    const telefone = payload.phone || payload.from || payload.sender?.id || payload.chat?.id || '';
    const numeroLimpo = normalizarTelefone(telefone);
    if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

    const msgContent = payload.msgContent || {};
    let mediaType = 'none';
    let conteudoRaw = payload.text?.message || payload.body || '';
    let conteudo = '';
    let downloadSpec = null;

    if (msgContent.imageMessage) {
      mediaType = 'image';
      conteudo = msgContent.imageMessage.caption || '[Imagem]';
      downloadSpec = {
        type: 'image',
        mediaKey: msgContent.imageMessage.mediaKey,
        directPath: msgContent.imageMessage.directPath,
        mimetype: msgContent.imageMessage.mimetype
      };
    } else if (msgContent.videoMessage) {
      mediaType = 'video';
      conteudo = msgContent.videoMessage.caption || '[Video]';
      downloadSpec = {
        type: 'video',
        mediaKey: msgContent.videoMessage.mediaKey,
        directPath: msgContent.videoMessage.directPath,
        mimetype: msgContent.videoMessage.mimetype
      };
    } else if (msgContent.audioMessage) {
      mediaType = 'audio';
      conteudo = msgContent.audioMessage.ptt ? '[Audio de voz]' : '[Audio]';
      downloadSpec = {
        type: 'audio',
        mediaKey: msgContent.audioMessage.mediaKey,
        directPath: msgContent.audioMessage.directPath,
        mimetype: msgContent.audioMessage.mimetype
      };
    } else if (msgContent.documentMessage) {
      mediaType = 'document';
      conteudo = msgContent.documentMessage.caption || msgContent.documentMessage.fileName || '[Documento]';
      downloadSpec = {
        type: 'document',
        mediaKey: msgContent.documentMessage.mediaKey,
        directPath: msgContent.documentMessage.directPath,
        mimetype: msgContent.documentMessage.mimetype
      };
    } else if (msgContent.stickerMessage) {
      mediaType = 'sticker';
      conteudo = '[Sticker]';
    } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
      mediaType = 'contact';
      conteudo = '[Contato]';
    } else if (msgContent.locationMessage || msgContent.liveLocationMessage) {
      mediaType = 'location';
      conteudo = '[Localizacao]';
    } else if (msgContent.extendedTextMessage) {
      conteudo = msgContent.extendedTextMessage.text || '';
    } else if (msgContent.conversation) {
      conteudo = msgContent.conversation;
    } else {
      conteudo = conteudoRaw;
    }

    if (!conteudo && mediaType === 'none') {
      return { type: 'unknown', error: 'mensagem_vazia' };
    }

    return {
      type: 'message',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      from: numeroLimpo,
      content: String(conteudo || '').trim(),
      mediaType,
      downloadSpec,
      mediaCaption: msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
      pushName: payload.pushName || payload.senderName || payload.sender?.pushName || payload.text?.senderName,
      vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
      location: msgContent.locationMessage || msgContent.liveLocationMessage,
      quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
    };

  } catch (err) {
    console.error('[WAPI-V2] 🔴 Erro em normalizarPayload:', err.message);
    return { type: 'unknown', error: 'normalization_failed', raw_error: err.message };
  }
}

async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return jsonOk({});
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes && integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  return jsonOk({ processed: 'qrcode', provider: 'w_api' });
}

async function handleConnection(dados, base44, payloadBruto) {
  if (!dados.instanceId) return jsonOk({});
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes && integracoes.length > 0) {
      const connectedPhone = payloadBruto.connectedPhone || payloadBruto.phone || 
                            payloadBruto.phoneNumber || payloadBruto.sender?.id?.replace(/@.*$/, '');
      const updateData = {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
        token_status: dados.status === 'conectado' ? 'valido' : 'nao_verificado'
      };
      if (connectedPhone && dados.status === 'conectado') {
        updateData.numero_telefone = connectedPhone;
        console.log('[WAPI-V2] ✅ Número associado:', connectedPhone);
      }
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, updateData);
      console.log('[WAPI-V2] ✅ Status atualizado:', dados.status);
    }
  } catch (e) {
    console.error('[WAPI-V2] ❌ Erro conexão:', e.message);
  }
  return jsonOk({ processed: 'connection', status: dados.status, provider: 'w_api' });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return jsonOk({});
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens && mensagens.length > 0) {
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
  return jsonOk({ processed: 'status_update', provider: 'w_api' });
}

async function handleMessage(dados, payloadBruto, base44) {
  console.log('[WAPI-V2] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI-V2] INICIO | De:', dados.from, '| Tipo:', dados.mediaType);

  const inicio = Date.now();

  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 10
      );
      if (dup && dup.length > 0) {
        console.log(`[WAPI-V2] ⏭️ DUPLICATA: ${dados.messageId}`);
        return jsonOk({ ignored: true, reason: 'duplicata' });
      }
    } catch (e) {}
  }

  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  let integracaoId = null;
  let integracaoInfo = null;

  if (connectedPhone) {
    try {
      const phoneVariacoes = [
        '+' + connectedPhone,
        connectedPhone,
        '+55' + connectedPhone.replace(/^55/, '')
      ];

      for (const tel of phoneVariacoes) {
        if (integracaoId) break;
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { numero_telefone: tel }, '-created_date', 1
        );
        if (int && int.length > 0) {
          integracaoId = int[0].id;
          integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
        }
      }
    } catch {}
  }

  if (!integracaoId && dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId }, '-created_date', 1
      );
      if (int && int.length > 0) {
        integracaoId = int[0].id;
        integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
      }
    } catch {}
  }

  console.log(`[WAPI-V2] 🔗 Integração: ${integracaoId || 'não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;
  let contato;
  try {
    const telefoneBase = dados.from.replace(/\D/g, '');
    const variacoes = [
      dados.from,
      dados.from.replace('+', ''),
      '+55' + telefoneBase.substring(2),
    ];
    
    if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
      const semNono = telefoneBase.substring(0, 4) + telefoneBase.substring(5);
      variacoes.push('+' + semNono);
      variacoes.push(semNono);
    }
    
    if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
      const comNono = telefoneBase.substring(0, 4) + '9' + telefoneBase.substring(4);
      variacoes.push('+' + comNono);
      variacoes.push(comNono);
    }
    
    let contatos = [];
    for (const tel of variacoes) {
      if (contatos.length > 0) break;
      try {
        const resultado = await base44.asServiceRole.entities.Contact.filter(
          { telefone: tel }, '-created_date', 1
        );
        if (resultado) contatos = resultado;
      } catch {}
    }

    if (contatos.length > 0) {
      contato = contatos[0];
      const update = { ultima_interacao: new Date().toISOString() };
      if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
        update.nome = dados.pushName;
      }
      if (profilePicUrl && contato.foto_perfil_url !== profilePicUrl) {
        update.foto_perfil_url = profilePicUrl;
      }
      await base44.asServiceRole.entities.Contact.update(contato.id, update);
      console.log(`[WAPI-V2] 👤 Contato existente: ${contato.nome}`);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: dados.pushName || dados.from,
        telefone: dados.from,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString(),
        foto_perfil_url: profilePicUrl
      });
      console.log(`[WAPI-V2] 👤 Novo contato: ${contato.nome}`);
    }
  } catch (e) {
    console.error(`[WAPI-V2] ❌ Erro contato:`, e?.message);
    return jsonErr('erro_contato', 500);
  }

  let thread;
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id }, '-last_message_at', 1
    );

    if (threads && threads.length > 0) {
      thread = threads[0];
      console.log(`[WAPI-V2] 💭 Thread existente: ${thread.id}`);
    } else {
      const agora = new Date().toISOString();
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        status: 'aberta',
        primeira_mensagem_at: agora,
        last_message_at: agora,
        last_inbound_at: agora,
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        last_media_type: dados.mediaType || 'none',
        total_mensagens: 1,
        unread_count: 1,
      });
      console.log(`[WAPI-V2] 💭 Nova thread: ${thread.id}`);
    }
  } catch (e) {
    console.error(`[WAPI-V2] ❌ Erro thread:`, e?.message);
    return jsonErr('erro_thread', 500);
  }
  
  try {
    const msgRecentes = await base44.asServiceRole.entities.Message.filter(
      { thread_id: thread.id, sender_type: 'contact' }, '-created_date', 10
    );
    
    if (msgRecentes) {
      const duplicadaPorConteudo = msgRecentes.find(m => 
        m.media_type === dados.mediaType &&
        m.content === dados.content &&
        Math.abs(new Date(m.created_date) - Date.now()) < 2000
      );
      
      if (duplicadaPorConteudo) {
        console.log(`[WAPI-V2] ⏭️ DUPLICATA CONTEÚDO: ${duplicadaPorConteudo.id}`);
        return jsonOk({ ignored: true, reason: 'duplicata_conteudo' });
      }
    }
  } catch (err) {
    console.warn(`[WAPI-V2] ⚠️ Erro verificar duplicata:`, err.message);
  }

  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.downloadSpec ? 'pending_download' : null,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        connected_phone: connectedPhone ?? null,
        canal_nome: integracaoInfo?.nome ?? null,
        canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null),
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        downloadSpec: dados.downloadSpec ?? null,
        processed_by: VERSION,
        provider: 'w_api'
      },
    });
    console.log(`[WAPI-V2] ✅ Mensagem salva: ${mensagem.id}`);
  } catch (e) {
    console.error(`[WAPI-V2] ❌ Erro salvar mensagem:`, e?.message);
    return jsonErr('erro_salvar_mensagem', 500);
  }

  try {
    const agora = new Date().toISOString();
    const threadUpdate = {
      last_message_at: agora,
      last_inbound_at: agora,
      last_message_sender: 'contact',
      last_message_content: String(dados.content || '').substring(0, 100),
      last_media_type: dados.mediaType || 'none',
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta',
    };
    if (integracaoId && !thread.whatsapp_integration_id) {
      threadUpdate.whatsapp_integration_id = integracaoId;
    }
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[WAPI-V2] 💭 Thread atualizada | Não lidas: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[WAPI-V2] ⚠️ Erro atualizar thread:`, updateError.message);
  }

  if (dados.downloadSpec) {
    console.log('[WAPI-V2] 🚀 Disparando worker de mídia...');
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      integration_id: integracaoId,
      downloadSpec: dados.downloadSpec,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[WAPI-V2] Erro trigger mídia:', e.message));
  }

  try {
    console.log('[WAPI-V2] 🧠 Executando Inbound Core...');
    
    let integracaoObj = null;
    if (integracaoId) {
      try {
        const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { id: integracaoId }, '-created_date', 1
        );
        integracaoObj = ints?.[0] || null;
      } catch (e) {
        console.warn('[WAPI-V2] ⚠️ Integração não encontrada:', e.message);
        integracaoObj = { id: integracaoId };
      }
    }

    await processInboundEvent({
      base44,
      contact: contato,
      thread: thread,
      message: mensagem,
      integration: integracaoObj || { id: 'unknown_wapi' },
      provider: 'w_api',
      messageContent: dados.content,
      rawPayload: payloadBruto
    });

    console.log('[WAPI-V2] ✅ Cérebro executado');
  } catch (err) {
    console.error('[WAPI-V2] 🔴 Erro Cérebro:', err.message);
    console.error('[WAPI-V2] 🔴 Stack:', err.stack);
  }

  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId ?? null,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true,
      message_id: payloadBruto.messageId || payloadBruto.data?.key?.id || dados.messageId,
    });
  } catch {}

  const duracao = Date.now() - inicio;
  console.log(`[WAPI-V2] ✅ SUCESSO! Msg: ${mensagem.id} | Thread: ${thread.id} | ${duracao}ms`);

  return jsonOk({
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    status: 'processed_inline'
  });
}

Deno.serve(async (req) => {
  console.log('[WAPI-V2-WEBHOOK] REQUEST | Método:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonOk({ 
      version: VERSION, 
      build_date: BUILD_DATE,
      status: 'ok', 
      provider: 'w_api',
      auth_method: 'createClientFromRequest'
    });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
    console.log('[WAPI-V2-AUTH] ✅ Cliente Base44 criado');
  } catch (e) {
    console.error('[WAPI-V2] 🔴 FATAL:', e.message);
    return jsonErr('auth_error', 500);
  }

  let payload;
  try {
    const body = await req.text();
    if (!body) return jsonOk({ ignored: true });
    payload = JSON.parse(body);

    console.log('[WAPI-V2] 📥 Event:', payload.event, '| Type:', payload.type);
    console.log('[WAPI-V2] 📥 Payload:', JSON.stringify(payload).substring(0, 1500));
  } catch (e) {
    return jsonErr('JSON invalido', 200);
  }

  const classification = classifyWapiEvent(payload);
  const motivoIgnorar = deveIgnorar(payload, classification);
  
  if (motivoIgnorar) {
    console.log('[WAPI-V2] ⏭️ Ignorado:', motivoIgnorar);
    return jsonOk({ ignored: true, reason: motivoIgnorar });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    console.log(`[WAPI-V2] ⏭️ Unknown: ${dados.error}`);
    return jsonOk({ ignored: true, reason: dados.error });
  }

  console.log(`[WAPI-V2] 🔄 Processando: ${dados.type}`);

  try {
    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      case 'connection':
        return await handleConnection(dados, base44, payload);
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      case 'message':
        return await handleMessage(dados, payload, base44);
      default:
        return jsonOk({ ignored: true, reason: 'tipo_desconhecido' });
    }
  } catch (error) {
    console.error('[WAPI-V2] ❌ ERRO:', error?.message);
    return jsonErr('erro_interno', 500);
  }
});