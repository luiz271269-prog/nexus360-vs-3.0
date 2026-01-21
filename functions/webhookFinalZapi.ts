import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// IMPORTS CENTRALIZADOS
// ============================================================================
import { normalizePhone } from './lib/phoneNormalizer.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v10.1.0 CENTRALIZAÇÃO COMPLETA
// ============================================================================
// SIMETRIA COM W-API: Webhook burro, inteligência em processInbound
// CRÍTICO: Usa contactManagerCentralized para normalização única
// ============================================================================
const VERSION = 'v10.1.0-CENTRALIZED';
const BUILD_DATE = '2026-01-21';

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

  // Mensagem real - extrair telefone BRUTO (normalização será feita pelo contactManager)
  const telefoneOrig = payload.phone ?? payload.from ?? payload.chatId ?? '';

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
    from: telefoneOrig,  // ✅ TELEFONE BRUTO - contactManager normaliza
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
      // ✅ BUSCA INTELIGENTE: Variações do connectedPhone para encontrar integração
      const phoneBase = String(connectedPhone).replace(/\D/g, '');
      const phoneVariacoes = [
        '+' + phoneBase,                    // +5548999322400
        phoneBase,                          // 5548999322400
        '+55' + phoneBase.replace(/^55/, ''), // +55 sem duplicado
      ];

      // Se tem 13 dígitos (55+DDD+9+8), também buscar sem o 9
      if (phoneBase.length === 13 && phoneBase.startsWith('55')) {
        const ddd = phoneBase.substring(2, 4);
        const numero = phoneBase.substring(5);
        phoneVariacoes.push(`+55${ddd}${numero}`);
        phoneVariacoes.push(`55${ddd}${numero}`);
      }

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
          console.log(`[${VERSION}] 🔑 Integração encontrada via connectedPhone variação: ${tel}`);
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

  // BUSCAR/CRIAR CONTATO - Inline para evitar erros de import
  let contato;
  try {
    const telefoneNormalizado = normalizePhone(dados.from);

    if (!telefoneNormalizado) {
      throw new Error('Telefone inválido após normalização');
    }

    // Buscar contato existente
    const contatosExistentes = await base44.asServiceRole.entities.Contact.filter(
      { telefone: telefoneNormalizado },
      '-created_date',
      1
    );

    if (contatosExistentes && contatosExistentes.length > 0) {
      contato = contatosExistentes[0];

      // Atualizar nome se vier pushName mais completo
      const updateData = {};
      const pushName = dados.pushName || null;

      if (pushName && pushName.length > (contato.nome?.length || 0)) {
        updateData.nome = pushName;
      }

      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.Contact.update(contato.id, updateData);
        contato = { ...contato, ...updateData };
      }
    } else {
      // Criar novo contato
      contato = await base44.asServiceRole.entities.Contact.create({
        telefone: telefoneNormalizado,
        nome: dados.pushName || telefoneNormalizado,
        tipo_contato: 'novo',
        whatsapp_status: 'nao_verificado',
        conexao_origem: integracaoId
      });
    }

    console.log(`[${VERSION}] 👤 Contato processado: ${contato.nome} (${contato.id})`);
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro contato:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_contato' });
  }

  // ✅ VERIFICAÇÃO ADICIONAL: Duplicata por timestamp + telefone (últimos 2 segundos)
  // MOVIDO PARA DEPOIS da criação do contato para ter contato.id disponível
  
  // 🔧 AUTO-MERGE: Se N > 1 threads, marcar antigas como merged
  try {
    const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id, whatsapp_integration_id: integracaoId },
      '-last_message_at',
      10
    );

    if (todasThreadsContato && todasThreadsContato.length > 1) {
      console.log(`[${VERSION}] 🔀 AUTO-MERGE: ${todasThreadsContato.length} threads encontradas. Canônica: ${todasThreadsContato[0].id}`);

      // Marcar todas as antigas como merged_into (sem mover mensagens)
      for (let i = 1; i < todasThreadsContato.length; i++) {
        const threadAntiga = todasThreadsContato[i];
        try {
          await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
            status: 'merged',
            merged_into: todasThreadsContato[0].id,
            is_canonical: false
          });
          console.log(`[${VERSION}] ✅ Thread antiga marcada como merged: ${threadAntiga.id}`);
        } catch {}
      }
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao fazer auto-merge:`, err.message);
  }

  // ✅ BUSCAR/CRIAR THREAD - LÓGICA ATÔMICA (CANONICAL THREAD)
  let thread;
  try {
      console.log(`[${VERSION}] 🔍 Buscando thread canônica para { contact_id: "${contato.id}", integration_id: "${integracaoId}" }`);
      const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { 
              contact_id: contato.id,
              whatsapp_integration_id: integracaoId || null
          },
          '-last_message_at', // A mais recente é a canônica
          1 // Otimização: buscar apenas a mais recente
      );

      if (threads && threads.length > 0) {
          thread = threads[0];
          console.log(`[${VERSION}]  canonical-thread-found: ${thread.id} (last_message_at: ${thread.last_message_at})`);

          const agora = new Date().toISOString();
          const threadUpdate = {
              last_message_at: agora,
              last_inbound_at: agora,
              last_message_sender: 'contact',
              last_message_content: String(dados.content || '').substring(0, 100),
              last_media_type: dados.mediaType || 'none',
              unread_count: (thread.unread_count || 0) + 1,
              total_mensagens: (thread.total_mensagens || 0) + 1,
              status: 'aberta', // Garante reabertura
          };
          await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
          console.log(`[${VERSION}] canonical-thread-updated | unread: ${threadUpdate.unread_count}`);

      } else {
          console.log(`[${VERSION}] canonical-thread-not-found: Criando nova thread.`);
          const agora = new Date().toISOString();

          // 🎯 FIX CRÍTICO: Validar contact_id antes de criar thread
          if (!contato || !contato.id) {
              console.error(`[${VERSION}] ❌ ERRO CRÍTICO: Tentando criar thread SEM contact_id!`);
              return jsonServerError({ success: false, error: 'contact_id_missing' });
          }

          thread = await base44.asServiceRole.entities.MessageThread.create({
              contact_id: contato.id, // ✅ GARANTIDO: Sempre vai ter contact_id
              thread_type: 'contact_external', // ✅ NOVO: Tipo explícito
              channel: 'whatsapp', // ✅ NOVO: Canal
              whatsapp_integration_id: integracaoId,
              status: 'aberta',
              primeira_mensagem_at: agora,
              last_message_at: agora,
              last_inbound_at: agora,
              last_message_sender: 'contact',
              last_message_content: String(dados.content || '').substring(0, 100),
              last_media_type: dados.mediaType || 'none',
              total_mensagens: 1, // ✅ CRÍTICO: Inicia com 1 (será salva 1 msg logo abaixo)
              unread_count: 1,    // ✅ CRÍTICO: Inicia com 1 (cliente esperando resposta)
          });
          console.log(`[${VERSION}] new-canonical-thread-created: ${thread.id} | contact_id: ${contato.id} | Inicializado com 1 msg e 1 não lida`);
      }
  } catch (e) {
    console.error(`[${VERSION}] ❌ Erro thread:`, e?.message || e);
    return jsonServerError({ success: false, error: 'erro_thread' });
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
  // ✅ INVOCAR processInboundEvent - ETAPA CRÍTICA
  // ============================================================================
  try {
    console.log(`[${VERSION}] 🎯 Invocando processInboundEvent para thread: ${thread.id}`);
    await base44.asServiceRole.functions.invoke('processInboundEvent', {
      thread_id: thread.id,
      contact_id: contato.id,
      message_id: mensagem.id,
      integration_id: integracaoId,
      provider: 'z_api'
    });
    console.log(`[${VERSION}] ✅ processInboundEvent executado com sucesso`);
  } catch (error) {
    console.error(`[${VERSION}] ⚠️ Erro ao invocar processInboundEvent:`, error?.message || error);
    // Continua mesmo se houver erro (não bloqueia o webhook)
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