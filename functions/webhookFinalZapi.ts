import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// FUNÇÕES UTILITÁRIAS INLINE (evitar imports externos)
// ============================================================================

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  
  // Adicionar código do país se não tiver
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // Normalizar celulares brasileiros: adicionar 9 se faltar
  // Formato esperado: 55 + DDD(2) + 9 + número(8) = 13 dígitos
  // Se veio 55 + DDD(2) + número(8) = 12 dígitos, adiciona o 9
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const ddd = apenasNumeros.substring(2, 4);
    const numero = apenasNumeros.substring(4);
    // Celulares começam com 9, 8, 7, 6 (após o 9 adicional)
    // Se não começa com 9, adicionar
    if (!numero.startsWith('9')) {
      apenasNumeros = '55' + ddd + '9' + numero;
    }
  }
  
  return '+' + apenasNumeros;
}

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v10.0.0 INGESTÃO PURA + CÉREBRO ISOLADO
// ============================================================================
// SIMETRIA COM W-API: Webhook burro, inteligência em processInbound
// ============================================================================
const VERSION = 'v10.0.0-PURE-INGESTION';
const BUILD_DATE = '2025-12-18';

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
  // MAS APENAS SE NÃO TIVER messageId (mensagem real)
  const eventosLixo = ['presence', 'typing', 'composing', 'chat-update', 'call'];
  const temMessageId = payload.messageId || payload.id;
  if (!temMessageId && eventosLixo.some((e) => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // MessageStatusCallback - ignorar se for de status@broadcast
  if (tipo.includes('messagestatuscallback') || tipo.includes('message-status')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null; // Processar atualizações de status válidas
  }

  // Para mensagens recebidas - verificar messageId E phone (mensagem real)
  const hasMsgId = payload.messageId || payload.id;
  const hasPhone = payload.phone || payload.from;
  const hasContent = payload.text || payload.body || payload.message || payload.image || payload.video || payload.audio || payload.document;

  // Se tem messageId + phone + conteúdo = é mensagem real
  if (hasMsgId && hasPhone && (hasContent || payload.momment)) {
    if (payload.fromMe === true) return 'from_me';
    return null; // PROCESSAR!
  }

  // ReceivedCallback explícito
  if (tipo.includes('receivedcallback')) {
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

  // ⚠️ IMPORTANTE: Detectar se é MENSAGEM REAL antes de status update
  // Mensagem real tem: messageId + phone + (text/senderName/chatName) + fromMe=false
  const temConteudoMensagem = payload.text || payload.body || payload.message || 
                              payload.image || payload.video || payload.audio || 
                              payload.document || payload.sticker;
  const temIndicadoresMensagem = payload.senderName || payload.chatName || payload.pushName;
  const ehMensagemReal = payload.messageId && 
                         payload.phone && 
                         payload.fromMe === false && 
                         (temConteudoMensagem || temIndicadoresMensagem);

  // Status de mensagem - APENAS se NÃO for mensagem real
  // MessageStatusCallback geralmente vem com array "ids" e sem senderName
  if (!ehMensagemReal && (tipoRaw.includes('messagestatuscallback') || tipoRaw.includes('message-status') || (Array.isArray(payload.ids) && payload.ids.length > 0))) {
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

  // LOG DETALHADO PARA DEBUG DE MÍDIA
  const mediaFields = ['image', 'video', 'audio', 'document', 'sticker', 'imageUrl', 'videoUrl', 'audioUrl', 'documentUrl', 'mediaUrl', 'forwardedFrom'];
  const presentMediaFields = mediaFields.filter(f => payload[f]);
  if (presentMediaFields.length > 0) {
    console.log(`[${VERSION}] 📎 Campos de mídia presentes:`, presentMediaFields);
    for (const field of presentMediaFields) {
      console.log(`[${VERSION}] 📎 ${field}:`, JSON.stringify(payload[field]).substring(0, 300));
    }
  }
  
  // LOG ESPECIAL PARA MENSAGENS ENCAMINHADAS
  if (payload.isForwarded || payload.forwardedFrom) {
    console.log(`[${VERSION}] 📨 MENSAGEM ENCAMINHADA detectada!`);
    console.log(`[${VERSION}] 📨 forwardedFrom:`, JSON.stringify(payload.forwardedFrom || {}).substring(0, 200));
  }

  // Z-API pode enviar mídia de várias formas:
  // 1. { image: { imageUrl: "...", caption: "..." } }
  // 2. { image: "base64..." } 
  // 3. { imageUrl: "..." } direto no root
  // 4. { mediaUrl: "..." } genérico
  
  // ✅ PRIMEIRO: Verificar se é mensagem encaminhada com mídia
  const forwardedImage = payload.forwardedFrom?.image || payload.isForwarded && payload.image;
  
  if (payload.image || forwardedImage) {
    mediaType = 'image';
    const imgData = payload.image || forwardedImage;
    if (typeof imgData === 'object') {
      mediaUrl = imgData.imageUrl ?? imgData.url ?? imgData.link ?? imgData.mediaUrl ?? null;
      // ✅ FIX VISUAL: Garante texto
      conteudo = imgData.caption || '📷 [Imagem recebida]';
    } else if (typeof imgData === 'string' && imgData.startsWith('http')) {
      mediaUrl = imgData;
      conteudo = '📷 [Imagem recebida]';
    }
  } else if (payload.imageUrl) {
    // URL direta no root
    mediaType = 'image';
    mediaUrl = payload.imageUrl;
    // ✅ FIX VISUAL
    conteudo = payload.caption || '📷 [Imagem recebida]';
  } else if (payload.video) {
    mediaType = 'video';
    if (typeof payload.video === 'object') {
      mediaUrl = payload.video.videoUrl ?? payload.video.url ?? payload.video.link ?? payload.video.mediaUrl ?? null;
      // ✅ FIX VISUAL
      conteudo = payload.video.caption || '🎥 [Vídeo recebido]';
    } else if (typeof payload.video === 'string' && payload.video.startsWith('http')) {
      mediaUrl = payload.video;
      conteudo = '🎥 [Vídeo recebido]';
    }
  } else if (payload.videoUrl) {
    mediaType = 'video';
    mediaUrl = payload.videoUrl;
    // ✅ FIX VISUAL
    conteudo = payload.caption || '🎥 [Vídeo recebido]';
  } else if (payload.audio) {
    mediaType = 'audio';
    if (typeof payload.audio === 'object') {
      mediaUrl = payload.audio.audioUrl ?? payload.audio.url ?? payload.audio.link ?? payload.audio.mediaUrl ?? null;
    } else if (typeof payload.audio === 'string' && payload.audio.startsWith('http')) {
      mediaUrl = payload.audio;
    }
    // ✅ FIX VISUAL
    conteudo = '🎤 [Áudio recebido]';
  } else if (payload.audioUrl) {
    mediaType = 'audio';
    mediaUrl = payload.audioUrl;
    // ✅ FIX VISUAL
    conteudo = '🎤 [Áudio recebido]';
  } else if (payload.document) {
    mediaType = 'document';
    if (typeof payload.document === 'object') {
      mediaUrl = payload.document.documentUrl ?? payload.document.url ?? payload.document.link ?? payload.document.mediaUrl ?? null;
      const fileName = payload.document.fileName || payload.fileName || 'arquivo';
      // ✅ FIX VISUAL: Garante texto descritivo
      conteudo = payload.document.caption ? `${payload.document.caption} (${fileName})` : `📄 [Documento: ${fileName}]`;
    } else if (typeof payload.document === 'string' && payload.document.startsWith('http')) {
      mediaUrl = payload.document;
      const fileName = payload.fileName || 'arquivo';
      conteudo = `📄 [Documento: ${fileName}]`;
    }
  } else if (payload.documentUrl) {
    mediaType = 'document';
    mediaUrl = payload.documentUrl;
    const fileName = payload.fileName || 'arquivo';
    // ✅ FIX VISUAL: Texto descritivo com nome
    conteudo = payload.caption ? `${payload.caption} (${fileName})` : `📄 [Documento: ${fileName}]`;
  } else if (payload.sticker) {
    mediaType = 'sticker';
    if (typeof payload.sticker === 'object') {
      mediaUrl = payload.sticker.stickerUrl ?? payload.sticker.url ?? null;
    } else if (typeof payload.sticker === 'string' && payload.sticker.startsWith('http')) {
      mediaUrl = payload.sticker;
    }
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }
  
  // Fallback: mediaUrl genérico no root
  if (mediaType === 'none' && payload.mediaUrl) {
    mediaUrl = payload.mediaUrl;
    // Tentar detectar tipo pela extensão
    const ext = (payload.mediaUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      mediaType = 'image';
      if (!conteudo) conteudo = '[Imagem]';
    } else if (['mp4', 'mov', 'avi', '3gp'].includes(ext)) {
      mediaType = 'video';
      if (!conteudo) conteudo = '[Vídeo]';
    } else if (['mp3', 'ogg', 'opus', 'wav', 'm4a'].includes(ext)) {
      mediaType = 'audio';
      if (!conteudo) conteudo = '[Áudio]';
    } else {
      mediaType = 'document';
      if (!conteudo) conteudo = '[Documento]';
    }
  }

  // Log final de mídia detectada
  if (mediaType !== 'none') {
    console.log(`[${VERSION}] 📎 Mídia detectada: ${mediaType} | URL: ${mediaUrl ? mediaUrl.substring(0, 80) + '...' : 'null'}`);
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

    console.log(`[${VERSION}] 📥 Payload recebido (1/2):`, JSON.stringify(payload).substring(0, 1000));
  console.log(`[${VERSION}] 📥 Payload recebido (2/2):`, JSON.stringify(payload).substring(1000, 2000));

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

    // Connection manager removido para simplificar

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
    const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
    console.log(`[${VERSION}] 💬 Nova mensagem de: ${dados.from} | Via: ${connectedPhone || 'não informado'}`);

  // ✅ IDEMPOTÊNCIA RIGOROSA - Verificar duplicatas por múltiplos critérios
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId },
        '-created_date',
        10 // Buscar mais registros para detectar duplicatas
      );
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ DUPLICATA DETECTADA: ${dados.messageId} (${dup.length} registros já existem)`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata', existing_count: dup.length });
      }
    } catch (err) {
      console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata:`, err.message);
      // Continua processamento mesmo com erro na verificação
    }
  }

  // ✅ VERIFICAÇÃO ADICIONAL: Duplicata por timestamp + telefone (últimos 2 segundos)
  try {
    const doisSegundosAtras = new Date(Date.now() - 2000).toISOString();
    const msgRecentes = await base44.asServiceRole.entities.Message.filter({
      sender_type: 'contact',
      created_date: { $gte: doisSegundosAtras }
    }, '-created_date', 50);
    
    // Verificar se já existe mensagem MUITO similar (mesmo remetente, mesmo tipo, mesmo tempo)
    const duplicadaPorConteudo = msgRecentes.find(m => 
      m.sender_id === contact_id &&
      m.media_type === dados.mediaType &&
      m.content === dados.content &&
      Math.abs(new Date(m.created_date) - Date.now()) < 2000
    );
    
    if (duplicadaPorConteudo) {
      console.log(`[${VERSION}] ⏭️ DUPLICATA POR CONTEÚDO: Mensagem similar encontrada ID ${duplicadaPorConteudo.id}`);
      return jsonOk({ success: true, ignored: true, reason: 'duplicata_conteudo' });
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata por conteúdo:`, err.message);
  }

  // Buscar integração - PRIORIZAR connectedPhone para identificar canal exato
  let integracaoId = null;
  let integracaoInfo = null;

  // Primeiro: tentar por connectedPhone (mais preciso - identifica QUAL conexão recebeu)
  if (connectedPhone) {
    try {
      // Normalizar o connectedPhone para busca
      const phoneVariacoes = [
        '+' + connectedPhone,
        connectedPhone,
        '+55' + connectedPhone.replace(/^55/, '')
      ];

      for (const tel of phoneVariacoes) {
        if (integracaoId) break;
        const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
          { numero_telefone: tel },
          '-created_date',
          1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
        }
      }
    } catch {
      // silencioso
    }
  }

  // Fallback: buscar por instanceId
  if (!integracaoId && dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId },
        '-created_date',
        1
      );
      if (int.length > 0) {
        integracaoId = int[0].id;
        integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
      }
    } catch {
      // silencioso
    }
  }

  console.log(`[${VERSION}] 🔗 Integração: ${integracaoId || 'não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  // Buscar/criar contato - tentar múltiplas variações do telefone
  let contato;
  try {
    // Gerar variações do telefone para busca
    const telefoneBase = dados.from.replace(/\D/g, '');
    const variacoes = [
      dados.from,                                    // +554899322400
      dados.from.replace('+', ''),                   // 554899322400
      '+55' + telefoneBase.substring(2),            // +5548999322400 (se já tem 55)
    ];
    
    // Se tem 13 dígitos (55+DDD+9+8), também buscar versão sem o 9
    if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
      const semNono = telefoneBase.substring(0, 4) + telefoneBase.substring(5);
      variacoes.push('+' + semNono);
      variacoes.push(semNono);
    }
    
    // Se tem 12 dígitos (55+DDD+8), também buscar versão com o 9
    if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
      const comNono = telefoneBase.substring(0, 4) + '9' + telefoneBase.substring(4);
      variacoes.push('+' + comNono);
      variacoes.push(comNono);
    }
    
    console.log(`[${VERSION}] 🔍 Buscando contato com variações:`, variacoes.slice(0, 3).join(', '));
    
    let contatos = [];
    for (const tel of variacoes) {
      if (contatos.length > 0) break;
      try {
        contatos = await base44.asServiceRole.entities.Contact.filter(
          { telefone: tel },
          '-created_date',
          1
        );
      } catch { /* continua */ }
    }

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
      const agora = new Date().toISOString();
      const threadUpdate = {
        last_message_at: agora,
        last_inbound_at: agora, // ✅ CRÍTICO: Timestamp separado para mensagens RECEBIDAS
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
      console.log(`[${VERSION}] 💭 Thread atualizada: ${thread.id} | Não lidas: ${threadUpdate.unread_count}`);
    } else {
      const agora = new Date().toISOString();
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        status: 'aberta',
        primeira_mensagem_at: agora,
        last_message_at: agora,
        last_inbound_at: agora, // ✅ CRÍTICO: Registrar timestamp de recebimento
        last_message_sender: 'contact',
        last_message_content: String(dados.content || '').substring(0, 100),
        last_media_type: dados.mediaType || 'none',
        total_mensagens: 1,
        unread_count: 1,
      });
      console.log(`[${VERSION}] 💭 Nova thread criada: ${thread.id}`);
    }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
  }

  // ============================================================================
  // ✅ PERSISTIR MÍDIA - Baixar de URL temporária e salvar permanentemente
  // ============================================================================
  let mediaUrlFinal = dados.mediaUrl ?? null;
  let midiaPersistida = false;
  
  if (dados.mediaUrl && dados.mediaType && dados.mediaType !== 'none') {
    console.log(`[${VERSION}] 📎 Mídia detectada: ${dados.mediaType} | URL temp: ${dados.mediaUrl?.substring(0, 60)}...`);
    
    // Verificar se é URL temporária do WhatsApp (mmg.whatsapp.net, z-api, ou backblaze)
    const isUrlTemporaria = dados.mediaUrl.includes('mmg.whatsapp.net') || 
                            dados.mediaUrl.includes('z-api.io') ||
                            dados.mediaUrl.includes('api.z-api.io') ||
                            dados.mediaUrl.includes('backblazeb2.com') ||
                            dados.mediaUrl.includes('temp-file-download');
    
    if (isUrlTemporaria) {
      console.log(`[${VERSION}] 📥 URL temporária detectada, tentando persistir...`);
      
      try {
        // Chamar função de download e persistência
        const resultadoPersistencia = await base44.functions.invoke('downloadMediaZAPI', {
          media_url: dados.mediaUrl,
          media_type: dados.mediaType,
          integration_id: integracaoId,
          filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
        });
        
        console.log(`[${VERSION}] 📥 Resultado persistência:`, JSON.stringify(resultadoPersistencia?.data || {}).substring(0, 300));
        
        if (resultadoPersistencia?.data?.url && !resultadoPersistencia?.data?.fallback) {
          mediaUrlFinal = resultadoPersistencia.data.url;
          midiaPersistida = true;
          console.log(`[${VERSION}] ✅ Mídia persistida com sucesso: ${mediaUrlFinal?.substring(0, 80)}...`);
        } else {
          const erroDetalhe = resultadoPersistencia?.data?.error || 'resposta sem URL permanente';
          console.warn(`[${VERSION}] ⚠️ Fallback para URL temporária: ${erroDetalhe}`);
          // Manter a URL temporária mas marcar como não persistida
          midiaPersistida = false;
        }
      } catch (e) {
        console.error(`[${VERSION}] ❌ Erro ao persistir mídia:`, e?.message || e);
        console.error(`[${VERSION}] ❌ Stack:`, e?.stack);
        // Continuar com URL temporária
        midiaPersistida = false;
      }
    } else if (dados.mediaUrl.includes('supabase.co') || dados.mediaUrl.includes('storage.googleapis.com') || dados.mediaUrl.includes('base44.app')) {
      console.log(`[${VERSION}] ℹ️ URL já é permanente (storage), não precisa persistir`);
      midiaPersistida = true;
    } else if (dados.mediaUrl.includes('backblazeb2.com') || dados.mediaUrl.includes('temp-file-download')) {
      // URLs do Backblaze B2 da Z-API são temporárias!
      console.warn(`[${VERSION}] ⚠️ URL Backblaze B2 detectada (TEMPORÁRIA): ${dados.mediaUrl?.substring(0, 60)}...`);
      midiaPersistida = false;
    } else {
      console.log(`[${VERSION}] ℹ️ URL externa (${dados.mediaUrl?.substring(0, 40)}...), assumindo permanente`);
      midiaPersistida = true;
    }
  }

  // Salvar mensagem
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: mediaUrlFinal,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        analise_multimodal: null,
        midia_persistida: midiaPersistida,
        deleted: null,
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        connected_phone: connectedPhone ?? null,
        canal_nome: integracaoInfo?.nome ?? null,
        canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null),
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        processed_by: VERSION,
        original_media_url: dados.mediaUrl ?? null,
      },
    });
    console.log(`[${VERSION}] ✅ Mensagem salva: ${mensagem.id} | Mídia persistida: ${midiaPersistida}`);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro salvar mensagem:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_salvar_mensagem' });
  }

  // ============================================================================
  // ✅ DISPARAR CÉREBRO (Direto, sem HTTP) - LINHA IMUTÁVEL v10
  // ============================================================================
  try {
    console.log(`[${VERSION}] 🚀 Processando Inbound Core diretamente...`);
    
    let integracaoObj = null;
    if (integracaoId) {
      try {
        integracaoObj = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Integração não encontrada, enviando ID:`, e?.message);
        integracaoObj = { id: integracaoId };
      }
    }

    // ✅ CHAMADA VIA SDK - Resolve erro de import e garante processamento
    const resultadoCerebro = await base44.asServiceRole.functions.invoke('processInbound', {
      contact_id: contato.id,
      thread_id: thread.id,
      message_id: mensagem.id,
      integration_id: integracaoId,
      provider: 'z_api',
      message_content: dados.content,
      raw_payload: payloadBruto
    });
    
    if (resultadoCerebro?.data?.success) {
      console.log(`[${VERSION}] ✅ Inbound Core processado:`, resultadoCerebro.data.actions?.join(', ') || 'sem ações');
    } else {
      console.warn(`[${VERSION}] ⚠️ Inbound Core retornou sem sucesso:`, resultadoCerebro?.data?.error || 'erro desconhecido');
    }
  } catch (err) {
    console.error(`[${VERSION}] 🔴 Falha CRÍTICA no processamento do Inbound Core:`, err?.message);
    console.error(`[${VERSION}] 🔴 Stack:`, err?.stack);
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
    status: 'processed_inline'
  });
}