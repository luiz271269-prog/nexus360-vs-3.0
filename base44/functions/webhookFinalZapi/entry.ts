// redeploy: 2026-03-03T13:30
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const primeiroDigitoNumero = apenasNumeros[4];
    if (['6', '7', '8', '9'].includes(primeiroDigitoNumero)) {
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
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

  // PERMITIR: QR Code, Connection e Desconexão
  if (tipo.includes('qrcode') || tipo.includes('connection') || tipo.includes('disconnect')) {
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

  // Connection / Disconnection
  if (tipoRaw.includes('disconnect')) {
    return {
      type: 'disconnection',
      instanceId,
      status: 'desconectado',
      moment: payload.moment ?? payload.timestamp ?? null
    };
  }

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
      const fieldValue = payload[field];
      const preview = typeof fieldValue === 'object' ? JSON.stringify(fieldValue).substring(0, 200) : String(fieldValue).substring(0, 200);
      console.log(`[${VERSION}] 📎 ${field}:`, preview);
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
    conteudo = '🎤 [Áudio recebido]';
  } else if (payload.document || payload.documentUrl) {
    mediaType = 'document';
    
    // ✅ CRÍTICO: Extrair URL do documento (pode vir de várias formas)
    let documentUrl = null;
    let rawFileName = null;
    
    if (typeof payload.document === 'object') {
      documentUrl = payload.document.documentUrl ?? payload.document.url ?? payload.document.link ?? payload.document.mediaUrl ?? null;
      rawFileName = payload.document.fileName || null;
    } else if (typeof payload.document === 'string' && payload.document.startsWith('http')) {
      documentUrl = payload.document;
    } else if (payload.documentUrl) {
      documentUrl = payload.documentUrl;
    }
    
    mediaUrl = documentUrl;
    
    // ✅ NORMALIZAR FILE NAME: extrair extensão e garantir segurança
    const ext = (mediaUrl?.split('.').pop()?.split('?')[0] || 'pdf').toLowerCase();
    const fileNameBase = rawFileName || payload.fileName || 'documento';
    const fileNameSeguro = fileNameBase
      .replace(/[\/:*?"<>|\\[\]]/g, '_')  // Remover caracteres perigosos e colchetes
      .slice(0, 100)                       // Limitar tamanho
      .replace(/^\.+/, '');                // Remover pontos no início
    
    // Garantir extensão
    let fileNameFinal;
    if (!fileNameSeguro.toLowerCase().endsWith(`.${ext}`)) {
      const lastDot = fileNameSeguro.lastIndexOf('.');
      if (lastDot > 0 && lastDot < fileNameSeguro.length - 5) {
        // Tem ponto no meio mas não é extensão válida, remover
        fileNameFinal = `${fileNameSeguro.substring(0, lastDot)}.${ext}`;
      } else {
        fileNameFinal = `${fileNameSeguro}.${ext}`;
      }
    } else {
      fileNameFinal = fileNameSeguro;
    }
    
    // ✅ RENDERIZAÇÃO: Caption exibe o nome do arquivo (igual imagem com caption)
    conteudo = fileNameFinal;
    
    // ✅ PRESERVAR fileName no mediaCaption para o frontend renderizar corretamente
    // Sem isso, MessageBubble mostra "[Documento]" genérico
    if (!payload.caption && !payload.document?.caption) {
      payload.caption = fileNameFinal; // Força caption para ser propagado
    }
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
    conteudo = '📇 [Contato compartilhado]';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 [Localização]';
  }
  
  // Fallback: mediaUrl genérico no root
  if (mediaType === 'none' && payload.mediaUrl) {
    mediaUrl = payload.mediaUrl;
    // Tentar detectar tipo pela extensão
    const ext = (payload.mediaUrl.split('.').pop() || '').toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      mediaType = 'image';
      if (!conteudo) conteudo = '📷 [Imagem recebida]';
    } else if (['mp4', 'mov', 'avi', '3gp'].includes(ext)) {
      mediaType = 'video';
      if (!conteudo) conteudo = '🎥 [Vídeo recebido]';
    } else if (['mp3', 'ogg', 'opus', 'wav', 'm4a'].includes(ext)) {
      mediaType = 'audio';
      if (!conteudo) conteudo = '🎤 [Áudio recebido]';
    } else {
      mediaType = 'document';
      if (!conteudo) conteudo = '📄 [Documento]';
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
    mediaCaption: payload.image?.caption ?? payload.video?.caption ?? payload.document?.caption ?? payload.caption ?? null,
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

    // ✅ FIX 403: Ler e filtrar payload ANTES de instanciar o SDK
    // PresenceChatCallback não carrega token → SDK exploderia com 403
    let payload;
    try {
      const body = await req.text();
      if (!body) return jsonOk({ success: true, ignored: true, reason: 'sem_corpo' });
      payload = JSON.parse(body);
    } catch (e) {
      return jsonBadRequest({ success: false, error: 'json_invalido' });
    }

    console.log(`[${VERSION}] 📥 Payload recebido (1/2):`, JSON.stringify(payload).substring(0, 1000));
    console.log(`[${VERSION}] 📥 Carga recebida (2/2):`, JSON.stringify(payload).substring(1000, 2000));

    // Early return SEM usar SDK — evita 403 em eventos de sistema
    const motivoIgnorar = deveIgnorar(payload);
    if (motivoIgnorar) {
      console.log(`[${VERSION}] ⏭️ Ignorado: ${motivoIgnorar}`);
      return jsonOk({ success: true, ignored: true, reason: motivoIgnorar });
    }

    // Só instancia o SDK após confirmar que é evento que precisamos processar
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.error(`[${VERSION}] SDK init error:`, e?.message || e);
      return jsonServerError({ success: false, error: 'sdk_init_error' });
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
      case 'disconnection':
        return await handleDisconnection(dados, base44);
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

// ============================================================================
// HANDLE DISCONNECTION
// ============================================================================
async function handleDisconnection(dados, base44) {
  console.log(`[${VERSION}] 🔴 Disconnection: ${dados.instanceId}`);
  
  if (!dados.instanceId) return jsonOk({ success: true, ignored: true, reason: 'no_instance_id' });

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
    );

    if (integracoes.length === 0) {
      console.warn(`[${VERSION}] ⚠️ Instância não mapeada: ${dados.instanceId}`);
      return jsonOk({ success: true, ignored: true, reason: 'unmapped_instance' });
    }

    const integracao = integracoes[0];
    const timestamp = dados.moment ? new Date(dados.moment * 1000).toISOString() : new Date().toISOString();

    // Anti-spam: não processar se já está desconectado recentemente
    if (integracao.status === 'desconectado' && integracao.last_disconnected_at) {
      const diffMs = Date.now() - new Date(integracao.last_disconnected_at).getTime();
      if (diffMs < 120000) { // 2 minutos
        console.log(`[${VERSION}] ⏭️ Desconexão já registrada recentemente`);
        return jsonOk({ success: true, ignored: true, reason: 'already_disconnected' });
      }
    }

    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: 'desconectado',
      last_disconnected_at: timestamp,
      status_reason: 'webhookDisconnected',
      ultima_atividade: timestamp
    });

    console.log(`[${VERSION}] 🔴 DESCONEXÃO REGISTRADA: ${integracao.nome_instancia} às ${timestamp}`);

    // Criar notificação para usuários com acesso
    try {
      await base44.asServiceRole.entities.NotificationEvent.create({
        tipo: 'integration_disconnected',
        titulo: `Instância WhatsApp desconectada`,
        mensagem: `A instância ${integracao.nome_instancia} foi desconectada às ${new Date(timestamp).toLocaleTimeString('pt-BR')}`,
        prioridade: 'alta',
        integration_id: integracao.id,
        metadata: {
          integration_name: integracao.nome_instancia,
          phone: integracao.numero_telefone,
          disconnected_at: timestamp,
          provider: 'z_api'
        }
      });
    } catch (notifErr) {
      console.warn(`[${VERSION}] ⚠️ Erro ao criar notificação:`, notifErr.message);
    }

    return jsonOk({ success: true, processed: 'disconnection', integration_id: integracao.id });

  } catch (error) {
    console.error(`[${VERSION}] ❌ Erro ao processar desconexão:`, error.message);
    return jsonOk({ success: true, error: 'processing_failed', details: error.message });
  }
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
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
    console.log(`[${VERSION}] 💬 Nova mensagem de: ${dados.from} | Via: ${connectedPhone || 'não informado'}`);

  // 🗓️ DETECÇÃO IMEDIATA - AGENDA NEXUS IA
  if (dados.from === '+559999999999') {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🗓️ AGENDA NEXUS IA DETECTADA - NÚMERO VIRTUAL +559999999999   ║');
    console.log('║  📱 Roteamento automático para processScheduleIntent           ║');
    console.log('║  ✅ DDD 99 não existe - Número exclusivo do sistema            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
  }

  // ✅ DECLARAR threadCanonica NO INÍCIO (antes de qualquer uso)
  let threadCanonica = null;

  // ✅ DEDUPLICAÇÃO RIGOROSA - Se duplicata, ignora (simples)
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId },
        '-created_date',
        1 // Apenas a primeira
      );
      if (dup.length > 0) {
        console.log(`[${VERSION}] ⏭️ DUPLICATA por messageId: ${dados.messageId} (já processada antes)`);
        return jsonOk({ success: true, ignored: true, reason: 'duplicata_message_id' });
      }
    } catch (err) {
      console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata por messageId:`, err.message);
      // Continua processamento mesmo com erro na verificação
    }
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

  // ✅ BUSCAR/CRIAR CONTATO - FUNÇÃO CENTRALIZADA ÚNICA
  let contato;
  try {
    console.log(`[${VERSION}] 🎯 Chamando função CENTRALIZADA para contato: ${dados.from}`);
    
    const resultado = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
      telefone: dados.from,
      pushName: dados.pushName || null,
      profilePicUrl: null,
      conexaoId: integracaoId
    });
    
    if (!resultado?.data?.success || !resultado?.data?.contact) {
      console.error(`[${VERSION}] ❌ Função centralizada falhou:`, resultado?.data);
      return jsonServerError({ success: false, error: 'erro_contato_centralizado' });
    }
    
    contato = resultado.data.contact;
    console.log(`[${VERSION}] ✅ Contato obtido via função centralizada: ${contato.id} | ${contato.nome} | Ação: ${resultado.data.action}`);
    
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro ao chamar função centralizada:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // ✅ VERIFICAÇÃO ADICIONAL: Duplicata por timestamp + telefone (últimos 2 segundos)
  // MOVIDO PARA DEPOIS da criação do contato para ter contato.id disponível
  
  // 🔧 AUTO-MERGE: Unificar todas as threads antigas deste contato (ANTES de criar/usar)
  try {
    const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id },
      '-primeira_mensagem_at',
      20
    );

    if (todasThreadsContato && todasThreadsContato.length > 1) {
      console.log(`[${VERSION}] 🔀 AUTO-MERGE: ${todasThreadsContato.length} threads encontradas para contact ${contato.id}`);

      // Eleger a mais antiga como canônica (preserva histórico)
      threadCanonica = todasThreadsContato[todasThreadsContato.length - 1]; // Última (mais antiga por ordenação)
      
      // ✅ COLETAR HISTÓRICO: Todas integrações usadas nas threads antigas
      const integracoesHistoricas = new Set();
      if (integracaoId) integracoesHistoricas.add(integracaoId); // Integração atual
      
      todasThreadsContato.forEach(t => {
        if (t.whatsapp_integration_id) integracoesHistoricas.add(t.whatsapp_integration_id);
        if (t.origin_integration_ids?.length > 0) {
          t.origin_integration_ids.forEach(id => integracoesHistoricas.add(id));
        }
      });
      
      // Marcar canônica COM propagação de integrações
      await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
        is_canonical: true,
        status: 'aberta',
        whatsapp_integration_id: integracaoId || threadCanonica.whatsapp_integration_id, // ✅ Atualizar se possível
        origin_integration_ids: Array.from(integracoesHistoricas), // ✅ HISTÓRICO COMPLETO
        ultima_atividade: new Date().toISOString()
      });
      console.log(`[${VERSION}] ✅ Thread canônica eleita: ${threadCanonica.id} (${integracoesHistoricas.size} integrações no histórico)`);

      // Marcar demais como merged
      for (const threadAntiga of todasThreadsContato) {
        if (threadAntiga.id !== threadCanonica.id) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
              status: 'merged',
              merged_into: threadCanonica.id,
              is_canonical: false
            });
            console.log(`[${VERSION}] 🔀 Thread merged: ${threadAntiga.id} → ${threadCanonica.id}`);
          } catch (e) {
            console.error(`[${VERSION}] ⚠️ Erro ao marcar thread merged:`, e.message);
          }
        }
      }
    } else if (todasThreadsContato && todasThreadsContato.length === 1) {
      threadCanonica = todasThreadsContato[0];
      // Garantir que está marcada como canônica E atualizar integração
      const needsUpdate = !threadCanonica.is_canonical || 
                          (integracaoId && threadCanonica.whatsapp_integration_id !== integracaoId);
      
      if (needsUpdate) {
        const updateData = {
          is_canonical: true,
          status: 'aberta'
        };
        
        if (integracaoId && threadCanonica.whatsapp_integration_id !== integracaoId) {
          updateData.whatsapp_integration_id = integracaoId;
          const historicoAtual = threadCanonica.origin_integration_ids || [];
          if (!historicoAtual.includes(integracaoId)) {
            updateData.origin_integration_ids = [...historicoAtual, integracaoId];
          }
        }
        
        await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, updateData);
      }
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao fazer auto-merge:`, err.message);
  }

  // ✅ BUSCAR/CRIAR THREAD - LÓGICA ATÔMICA (CANONICAL THREAD)
  // 🎯 Usar threadCanonica se auto-merge encontrou, senão buscar/criar
  let thread = threadCanonica;
  
  if (!thread) {
    try {
      console.log(`[${VERSION}] 🔍 Buscando thread canônica para contact_id: "${contato.id}"`);
      const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { 
              contact_id: contato.id,
              is_canonical: true,
              status: 'aberta'
          },
          '-last_message_at',
          1
      );

      if (threads && threads.length > 0) {
          thread = threads[0];
          console.log(`[${VERSION}] ✅ canonical-thread-found: ${thread.id} | Unificada para todas as integrações`);
          
          // ✅ ATUALIZAR integração se mudou (Z-API pode migrar de chip)
          const needsIntegrationUpdate = integracaoId && thread.whatsapp_integration_id !== integracaoId;
          if (needsIntegrationUpdate) {
            const historicoAtual = thread.origin_integration_ids || [];
            const novoHistorico = [...new Set([...historicoAtual, integracaoId])];
            
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              whatsapp_integration_id: integracaoId,
              origin_integration_ids: novoHistorico
            });
            console.log(`[${VERSION}] 🔄 Integração atualizada: ${thread.whatsapp_integration_id?.substring(0, 8)} → ${integracaoId.substring(0, 8)}`);
          }

      } else {
          console.log(`[${VERSION}] 🆕 canonical-thread-not-found: Criando thread ÚNICA para este contato.`);
          const agora = new Date().toISOString();

          if (!contato || !contato.id) {
              console.error(`[${VERSION}] ❌ ERRO CRÍTICO: Tentando criar thread SEM contact_id!`);
              return jsonServerError({ success: false, error: 'contact_id_missing' });
          }

          thread = await base44.asServiceRole.entities.MessageThread.create({
              contact_id: contato.id,
              whatsapp_integration_id: integracaoId,
              conexao_id: integracaoId, // Compatibilidade
              origin_integration_ids: integracaoId ? [integracaoId] : [], // ✅ INICIALIZAR histórico
              thread_type: 'contact_external',
              channel: 'whatsapp',
              is_canonical: true,
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
          console.log(`[${VERSION}] ✅ new-canonical-thread-created: ${thread.id} | Thread UNIFICADA criada`);
      }
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
      return jsonServerError({ success: false, error: 'erro_thread' });
    }
  }
  
  // Validação final
  if (!thread || !thread.id) {
    console.error(`[${VERSION}] ❌ ERRO CRÍTICO: Thread não foi criada/encontrada!`);
    return jsonServerError({ success: false, error: 'thread_not_found' });
  }
  
  // ✅ VERIFICAÇÃO DE DUPLICATA POR CONTEÚDO - Agora com contato.id disponível
  try {
    const doisSegundosAtras = new Date(Date.now() - 2000).toISOString();
    const msgRecentes = await base44.asServiceRole.entities.Message.filter({
      thread_id: thread.id,
      sender_type: 'contact',
      created_date: { $gte: doisSegundosAtras }
    }, '-created_date', 10);
    
    const duplicadaPorConteudo = msgRecentes.find(m => 
      m.media_type === dados.mediaType &&
      m.content === dados.content &&
      Math.abs(new Date(m.created_date) - Date.now()) < 2000
    );
    
    if (duplicadaPorConteudo) {
      console.log(`[${VERSION}] ⏭️ DUPLICATA POR CONTEÚDO: Mensagem similar ID ${duplicadaPorConteudo.id}`);
      return jsonOk({ success: true, ignored: true, reason: 'duplicata_conteudo' });
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata por conteúdo:`, err.message);
  }

  // ============================================================================
  // ✅ PERSISTIR MÍDIA - Baixar de URL temporária e salvar permanentemente
  // ============================================================================
  let mediaUrlFinal = dados.mediaUrl ?? null;
  let midiaPersistida = false;

  if (dados.mediaUrl && dados.mediaType && dados.mediaType !== 'none') {
    console.log(`[${VERSION}] 📎 Mídia detectada: ${dados.mediaType} | URL temp: ${dados.mediaUrl?.substring(0, 60)}...`);

    // ⚠️ CRÍTICO: Z-API retorna URLs com Backblaze B2 que são TEMPORÁRIAS (expiram em ~2h)
    // Verificar se é URL temporária (SEMPRE fazer persist para URLs de provedor)
    const isUrlTemporaria = dados.mediaUrl.includes('mmg.whatsapp.net') || 
                            dados.mediaUrl.includes('z-api.io') ||
                            dados.mediaUrl.includes('api.z-api.io') ||
                            dados.mediaUrl.includes('backblazeb2.com') ||  // ⚠️ Z-API usa B2 (TEMPORÁRIO!)
                            dados.mediaUrl.includes('temp-file-download');
    
    if (isUrlTemporaria) {
      console.log(`[${VERSION}] 📥 URL temporária detectada, tentando persistir via persistirMidiaWapi...`);
      
      try {
        // Salvar mensagem primeiro com URL temporária para ter message_id
        // A persistência definitiva é feita após criação da mensagem — ver bloco abaixo
        midiaPersistida = false;
      } catch (e) {
        midiaPersistida = false;
      }
    } else if (dados.mediaUrl.includes('base44.app') || dados.mediaUrl.includes('storage.googleapis.com') || dados.mediaUrl.includes('supabase.co')) {
      console.log(`[${VERSION}] ℹ️ URL já é permanente (storage), não precisa persistir`);
      midiaPersistida = true;
    } else {
      console.log(`[${VERSION}] ℹ️ URL externa, assumindo permanente`);
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
      visibility: 'public_to_customer',
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

  // ✅ DISPARAR WORKER DE MÍDIA (assíncrono) — igual ao webhookWapi
  if (dados.mediaUrl && dados.mediaType && dados.mediaType !== 'none' && !midiaPersistida) {
    const isUrlTemporaria = dados.mediaUrl.includes('backblazeb2.com') ||
                            dados.mediaUrl.includes('temp-file-download') ||
                            dados.mediaUrl.includes('z-api.io') ||
                            dados.mediaUrl.includes('mmg.whatsapp.net');
    if (isUrlTemporaria) {
      console.log(`[${VERSION}] 🏛️ Disparando worker de mídia (Z-API)...`, { type: dados.mediaType, hasUrl: !!dados.mediaUrl });
      // Fire-and-forget: não bloquear resposta ao WhatsApp
      base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
        file_id: dados.messageId || mensagem.id,
        integration_id: integracaoId,
        media_type: dados.mediaType,
        media_url: dados.mediaUrl,
        message_id: mensagem.id,
        filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
      }).catch(e => console.error(`[${VERSION}] ⚠️ Worker mídia erro:`, e?.message));
    }
  }

  // ✅ ATUALIZAR THREAD - Incrementar contadores DEPOIS de salvar mensagem
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
      whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id
    };
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[${VERSION}] 💭 Thread atualizada | Total: ${threadUpdate.total_mensagens} | Não lidas: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[${VERSION}] ⚠️ Erro ao atualizar thread:`, updateError.message);
  }

  // ============================================================================
  // ✅ PROCESSAR VIA CÉREBRO CENTRAL (INBOUND CORE)
  // ============================================================================
  try {
    console.log(`[${VERSION}] 🎯 Invocando processInbound (adaptador) para thread: ${thread.id}`);
    
    // Buscar integração completa
    let integracaoCompleta = null;
    if (integracaoId) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn(`[${VERSION}] ⚠️ Erro ao buscar integração completa:`, e.message);
      }
    }
    // Fallback: recuperar integração salva na thread (evita integration.id=null no processInbound)
    if (!integracaoCompleta && thread.whatsapp_integration_id) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id);
        console.log(`[${VERSION}] 🔄 Integração recuperada via thread.whatsapp_integration_id`);
      } catch (e) { /* silencioso */ }
    }
    
    // ✅ FIX CPU LIMIT: fire-and-forget — resposta 200 já foi entregue antes do processInbound
    // Evita timeout do isolamento Deno por processamento pesado
    base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoCompleta,
      provider: 'z_api',
      messageContent: dados.content,
      rawPayload: payloadBruto
    }).then(() => {
      console.log(`[${VERSION}] ✅ processInbound executado com sucesso`);
    }).catch(error => {
      console.error(`[${VERSION}] ⚠️ Erro ao invocar processInbound:`, error?.message || error);
    });
  } catch (error) {
    console.error(`[${VERSION}] ⚠️ Erro ao preparar processInbound:`, error?.message || error);
    // Continua mesmo se houver erro
  }

  // Audit log
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId ?? null,
      integration_id: integracaoId,
      message_id: dados.messageId ?? null,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true,
      provider: 'z_api'
    });
  } catch (auditErr) {
    console.warn(`[${VERSION}] ⚠️ Erro ao salvar audit log (não-crítico):`, auditErr?.message);
  }

  const duracao = Date.now() - inicio;
  console.log(`[${VERSION}] ✅ SUCESSO! Msg: ${mensagem.id} | De: ${dados.from} | Int: ${integracaoId} | ${duracao}ms`);

  // SkillExecution - Fire-and-forget
  ;(async () => {
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'webhook_zapi_inbound',
        triggered_by: 'webhook',
        execution_mode: 'autonomous_safe',
        context: {
          integration_id: integracaoId,
          canal: integracaoInfo?.numero || connectedPhone,
          telefone_origem: dados.from,
          media_type: dados.mediaType
        },
        success: true,
        duration_ms: Date.now() - _tsInicio,
        metricas: {
          mensagens_processadas: 1,
          midia_persistida: midiaPersistida ? 1 : 0,
          auto_merge_executado: threadCanonica ? 1 : 0,
          tempo_total_ms: duracao
        }
      });
    } catch (e) {
      console.warn('[webhookFinalZapi] SkillExecution falhou (non-blocking):', e.message);
    }
  })();

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