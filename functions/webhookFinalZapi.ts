import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v9.1.0 FINAL
// ============================================================================
const VERSION = 'v9.1.0-FINAL';
const BUILD_DATE = '2025-11-25';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonOk(body, init = {}) {
  return Response.json(body, { status: 200, headers: corsHeaders, ...init });
}
function jsonBadRequest(body) {
  return Response.json(body, { status: 400, headers: corsHeaders });
}
function jsonServerError(body) {
  return Response.json(body, { status: 500, headers: corsHeaders });
}

// --------------------------------------------------------------------------------------
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// --------------------------------------------------------------------------------------
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const phone = String(payload.phone ?? payload.from ?? '').toLowerCase();
  const isGroup = payload.isGroup === true || String(payload.chatId ?? '').includes('@g.us');

  // IGNORAR IMEDIATAMENTE: status@broadcast e JIDs de sistema
  if (
    phone.includes('status@') ||
    phone.includes('@broadcast') ||
    phone.includes('@lid') ||
    phone.includes('@g.us') ||
    isGroup
  ) {
    return 'jid_sistema';
  }

  // PERMITIR: QR Code e Connection
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação/chamada (alto volume)
  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some((e) => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // MessageStatusCallback - ignorar se for de status@broadcast
  if (tipo.includes('messagestatuscallback') || tipo.includes('message-status')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null; // Processar atualizações de status válidas
  }

  // Para mensagens recebidas
  const hasMsgId =
    payload.messageId ||
    payload.id ||
    (Array.isArray(payload.ids) && payload.ids.length > 0 && payload.ids[0]);

  if (tipo.includes('receivedcallback') || hasMsgId) {
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone && !payload.from) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// --------------------------------------------------------------------------------------
// NORMALIZAR PAYLOAD
// --------------------------------------------------------------------------------------
function coerceString(v, def = null) {
  if (v == null) return def;
  try {
    const s = String(v);
    return s.length ? s : def;
  } catch {
    return def;
  }
}

function normalizarPayload(payload) {
  const tipoRaw = coerceString(payload.type ?? payload.event, '').toLowerCase();
  const instanceId =
    payload.instanceId ??
    payload.instance ??
    payload.instance_id ??
    payload.instance_id_provider ??
    null;

  // QR Code
  if (tipoRaw.includes('qrcode') || payload.qrcode || payload.qr) {
    return {
      type: 'qrcode',
      instanceId,
      qrCodeUrl: payload.qrcode ?? payload.qr ?? payload.qrCodeUrl ?? null,
    };
  }

  // Connection
  if (tipoRaw.includes('connection') || typeof payload.connected === 'boolean') {
    return {
      type: 'connection',
      instanceId,
      status: payload.connected ? 'conectado' : 'desconectado',
    };
  }

  // Status de mensagem
  if (tipoRaw.includes('messagestatuscallback') || tipoRaw.includes('message-status') || payload.status) {
    const messageId =
      (Array.isArray(payload.ids) && payload.ids[0]) ||
      payload.messageId ||
      payload.id ||
      null;
    return {
      type: 'message_update',
      instanceId,
      messageId,
      status: payload.status,
    };
  }

  // Mensagem real
  const telefoneOrig = payload.phone ?? payload.from ?? payload.chatId ?? '';
  const numeroLimpo = normalizarTelefone(telefoneOrig);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  const messageId =
    payload.messageId ||
    payload.id ||
    (Array.isArray(payload.ids) && payload.ids[0]) ||
    payload.key?.id ||
    null;

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo =
    payload.text?.message ??
    payload.text ??
    payload.body ??
    payload.message ??
    payload.caption ??
    '';

  // Z-API costuma trazer estruturas como { image: { url, imageUrl, caption } }
  if (payload.image) {
    mediaType = 'image';
    mediaUrl = payload.image.imageUrl ?? payload.image.url ?? payload.image.link ?? null;
    if (!conteudo) conteudo = payload.image.caption ?? '[Imagem]';
  } else if (payload.video) {
    mediaType = 'video';
    mediaUrl = payload.video.videoUrl ?? payload.video.url ?? payload.video.link ?? null;
    if (!conteudo) conteudo = payload.video.caption ?? '[Vídeo]';
  } else if (payload.audio) {
    mediaType = 'audio';
    mediaUrl = payload.audio.audioUrl ?? payload.audio.url ?? payload.audio.link ?? null;
    conteudo = conteudo || '[Áudio]';
  } else if (payload.document) {
    mediaType = 'document';
    mediaUrl = payload.document.documentUrl ?? payload.document.url ?? payload.document.link ?? null;
    if (!conteudo) conteudo = payload.document.caption ?? '[Documento]';
  } else if (payload.sticker) {
    mediaType = 'sticker';
    mediaUrl = payload.sticker.stickerUrl ?? payload.sticker.url ?? null;
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId,
    from: numeroLimpo,
    content: String(conteudo ?? '').trim(),
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption ?? payload.video?.caption ?? payload.caption ?? null,
    pushName: payload.senderName ?? payload.pushName ?? payload.chatName ?? null,
    vcard: payload.contactMessage ?? payload.vcard ?? null,
    location: payload.location ?? null,
    quotedMessage: payload.quotedMsg ?? payload.quotedMessage ?? null,
  };
}

// --------------------------------------------------------------------------------------
// HANDLER PRINCIPAL
// --------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === 'GET') {
      return jsonOk({ version: VERSION, build: BUILD_DATE, status: 'ok' });
    }

    if (req.method !== 'POST') {
      return jsonBadRequest({ success: false, error: 'metodo_nao_suportado' });
    }

    let base44;
    try {
      base44 = createClientFromRequest(req.clone());
    } catch (e) {
      console.error(`[${VERSION}] SDK init error:`, e?.message || e);
      return jsonServerError({ success: false, error: 'sdk_init_error' });
    }

    let payload;
    try {
      const body = await req.text();
      if (!body) return jsonOk({ success: true, ignored: true, reason: 'sem_corpo' });
      payload = JSON.parse(body);
    } catch (e) {
      return jsonBadRequest({ success: false, error: 'json_invalido' });
    }

    console.log(`[${VERSION}] 📥 Payload recebido:`, JSON.stringify(payload).substring(0, 500));

    const motivoIgnorar = deveIgnorar(payload);
    if (motivoIgnorar) {
      console.log(`[${VERSION}] ⏭️ Ignorado: ${motivoIgnorar}`);
      return jsonOk({ success: true, ignored: true, reason: motivoIgnorar });
    }

    const dados = normalizarPayload(payload);
    if (dados.type === 'unknown') {
      console.log(`[${VERSION}] ⏭️ Unknown: ${dados.error}`);
      return jsonOk({ success: true, ignored: true, reason: dados.error });
    }

    console.log(`[${VERSION}] 🔄 Processando: ${dados.type}`);

    if (dados.instanceId) {
      try {
        connectionManager.register(dados.instanceId, { provider: 'z_api' });
      } catch {
        // não bloquear fluxo
      }
    }

    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      case 'connection':
        return await handleConnection(dados, base44);
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      case 'message':
        return await handleMessage(dados, payload, base44);
      default:
        return jsonOk({ success: true, ignored: true, reason: 'tipo_desconhecido' });
    }
  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO não tratado:`, error?.message || error);
    return jsonServerError({ success: false, error: 'erro_interno' });
  }
});

// --------------------------------------------------------------------------------------
// HANDLERS
// --------------------------------------------------------------------------------------
async function handleQRCode(dados, base44) {
  console.log(`[${VERSION}] 📱 QR Code recebido para: ${dados.instanceId}`);
  
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'qrcode', note: 'sem_instance' });

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
    );

    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl ?? null,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString(),
      });
      console.log(`[${VERSION}] ✅ QR Code atualizado para integração: ${integracoes[0].nome_instancia}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro QR Code:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'qrcode' });
}

async function handleConnection(dados, base44) {
  console.log(`[${VERSION}] 🔌 Connection: ${dados.instanceId} -> ${dados.status}`);
  
  if (!dados.instanceId) return jsonOk({ success: true, processed: 'connection', note: 'sem_instance' });

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
    );

    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
      });
      console.log(`[${VERSION}] ✅ Status atualizado: ${integracoes[0].nome_instancia} -> ${dados.status}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Connection:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'connection', status: dados.status });
}

async function handleMessageUpdate(dados, base44) {
  console.log(`[${VERSION}] 📋 Status Update: ${dados.messageId} -> ${dados.status}`);
  
  if (!dados.messageId) return jsonOk({ success: true, processed: 'status_update', note: 'sem_message_id' });

  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId },
      '-created_date',
      1
    );

    if (mensagens.length > 0) {
      const statusMap = {
        READ: 'lida',
        READ_BY_ME: 'lida',
        DELIVERED: 'entregue',
        SENT: 'enviada',
        RECEIVED: 'recebida',
      };
      const key = String(dados.status ?? '').toUpperCase();
      const novoStatus = statusMap[key];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
        console.log(`[${VERSION}] ✅ Mensagem ${dados.messageId} -> ${novoStatus}`);
      }
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro Status Update:`, e?.message);
  }

  return jsonOk({ success: true, processed: 'status_update' });
}

async function handleMessage(dados, payloadBruto, base44) {
  const inicio = Date.now();
  console.log(`[${VERSION}] 💬 Nova mensagem de: ${dados.from}`);

  // Idempotência por whatsapp_message_id
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId },
        '-created_date',
        1
      );
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ Mensagem duplicada: ${dados.messageId}`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata' });
      }
    } catch {
      // segue mesmo se falhar lookup
    }
  }

  // Buscar integração
  let integracaoId = null;
  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId },
        '-created_date',
        1
      );
      if (int.length > 0) integracaoId = int[0].id;
    } catch {
      // silencioso
    }
  }
  console.log(`[${VERSION}] 🔗 Integração: ${integracaoId || 'não encontrada'}`);

  // Buscar/criar contato
  let contato;
  try {
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { telefone: dados.from },
      '-created_date',
      1
    );

    if (contatos.length > 0) {
      contato = contatos[0];
      const update = { ultima_interacao: new Date().toISOString() };
      if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
        update.nome = dados.pushName;
      }
      await base44.asServiceRole.entities.Contact.update(contato.id, update);
      console.log(`[${VERSION}] 👤 Contato existente: ${contato.nome}`);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: dados.pushName || dados.from,
        telefone: dados.from,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString(),
      });
      console.log(`[${VERSION}] 👤 Novo contato criado: ${contato.nome}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro contato:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // Buscar/criar thread
  let thread;
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id },
      '-last_message_at',
      1
    );

    if (threads.length > 0) {
      thread = threads[0];
      const threadUpdate = {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta',
      };
      if (integracaoId && !thread.whatsapp_integration_id) {
        threadUpdate.whatsapp_integration_id = integracaoId;
      }
      await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
      console.log(`[${VERSION}] 💭 Thread existente: ${thread.id}`);
    } else {
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        status: 'aberta',
        primeira_mensagem_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        total_mensagens: 1,
        unread_count: 1,
      });
      console.log(`[${VERSION}] 💭 Nova thread criada: ${thread.id}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
  }

  // Salvar mensagem
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.mediaUrl ?? null,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        processed_by: VERSION,
      },
    });
    console.log(`[${VERSION}] ✅ Mensagem salva: ${mensagem.id}`);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro salvar mensagem:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_salvar_mensagem' });
  }

  // Audit log
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId ?? null,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true,
    });
  } catch {
    // silencioso
  }

  const duracao = Date.now() - inicio;
  console.log(`[${VERSION}] ✅ SUCESSO! Msg: ${mensagem.id} | De: ${dados.from} | Int: ${integracaoId} | ${duracao}ms`);

  return jsonOk({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
  });
}