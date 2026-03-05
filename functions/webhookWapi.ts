// redeploy: 2026-03-04T00:00
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ╔════════════════════════════════════════════════════════════════════════╗
// ║  WEBHOOK WHATSAPP W-API - v26.0.0-MEDIA-FIX                           ║
// ║  CORREÇÕES:                                                            ║
// ║  1. downloadSpec só criado se temDados (url | mediaKey+directPath)    ║
// ║  2. Captura url||link (Auto Download) e mediaId em TODOS os tipos     ║
// ║  3. failed_download salvo imediatamente quando sem dados úteis        ║
// ║  4. Log de telemetria para PTTs quebrados                             ║
// ╚════════════════════════════════════════════════════════════════════════╝

const VERSION = 'v26.0.0-MEDIA-FIX';
const BUILD_DATE = '2026-03-04T00:00:00';
const DEPLOYMENT_ID = 'WAPI_MEDIA_FIX_2026_03_04';
const ARCHITECTURE = 'PORTEIRO-CEGO';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  🚀 W-API WEBHOOK v26 - MEDIA FIX                             ║');
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log(`║  📅 BUILD: ${BUILD_DATE}                          ║`);
console.log(`║  🆔 DEPLOY: ${DEPLOYMENT_ID}             ║`);
console.log('║  🔧 FIX: downloadSpec vazio nunca chega ao worker             ║');
console.log('║  🔧 FIX: url||link (Auto Download) como fast-path             ║');
console.log('║  🔧 FIX: failed_download imediato quando sem dados            ║');
console.log('║  🔧 FIX: messageContextInfo não salva mais msg sem conteúdo   ║');
console.log('║  🔧 FIX: reactionMessage/protocolMessage/editedMessage ignored ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

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
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const primeiroDigito = apenasNumeros[4];
    if (['6', '7', '8', '9'].includes(primeiroDigito)) {
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
    }
  }
  return '+' + apenasNumeros;
}

// ============================================================================
// ✅ HELPER: construir downloadSpec seguro
// Garante que só cria spec se houver pelo menos 1 dado utilizável para download.
// Captura url||link (Auto Download da Whapi) e mediaId como fontes adicionais.
// ============================================================================
function buildDownloadSpec(type, msg, extra = {}) {
  const url        = msg?.url || msg?.link || extra.url || null;
  const mediaKey   = msg?.mediaKey   || null;
  const directPath = msg?.directPath || null;
  const mediaId    = msg?.mediaId || msg?.id || extra.mediaId || null;

  const hasUrl     = !!url;
  const hasKeyPath = !!(mediaKey && directPath);
  const hasMediaId = !!mediaId;

  // ✅ REGRA CENTRAL: sem nenhum dado útil → não criar spec
  if (!hasUrl && !hasKeyPath && !hasMediaId) {
    console.warn(`[WAPI-NORM] ⚠️ MEDIA_NO_DATA | type=${type} | keys=${Object.keys(msg || {}).join(',')}`);
    return null;
  }

  return {
    type,
    url,
    mediaKey,
    directPath,
    mediaId,
    mimetype: msg?.mimetype || null,
    ...extra
  };
}

// ============================================================================
// CLASSIFICADOR
// ============================================================================
function classifyWapiEvent(payload) {
  if (!payload || typeof payload !== 'object') return 'ignore';

  const evento = String(payload.event || payload.type || '').toLowerCase();

  if (evento === 'webhookdisconnected' || evento === 'webhookconnected' || evento === 'instancedisconnected') {
    return 'connection-status';
  }

  if (evento === 'webhookdelivery' || evento === 'webhookdelivered') {
    return 'system-status-delivery';
  }

  if (payload.fromMe === true && payload.messageId) {
    return 'system-status-delivery';
  }

  if (evento.includes('delivery') || evento.includes('ack') || evento.includes('messagestatuscallback')) {
    if (payload.messageId || (Array.isArray(payload.ids) && payload.ids.length > 0) || payload.id) {
      return 'system-status-delivery';
    }
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

// ============================================================================
// FILTRO
// ============================================================================
function deveIgnorar(payload, classification) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  if (classification === 'ignore') return 'evento_desconhecido';
  if (classification === 'system-status') return null;
  if (classification === 'system-status-delivery') return null;
  if (classification === 'connection-status') return null;

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();

  const phone = String(
    payload.phone ??
    payload.from ??
    payload.sender?.id ??
    payload.chat?.id ??
    ''
  ).toLowerCase();

  const isGroup = payload.isGroup === true || phone.includes('@g.us');

  if (
    phone.includes('status@') ||
    phone.includes('@broadcast') ||
    phone.includes('@lid') ||
    phone.includes('@g.us') ||
    isGroup
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

  const hasMsgId  = payload.messageId || payload.id;
  const hasPhone  = payload.phone || payload.from || payload.sender?.id || payload.chat?.id;
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

// ============================================================================
// NORMALIZAR PAYLOAD
// ============================================================================
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

    const temConteudoMensagem = payload.text || payload.body || payload.msgContent || payload.message;
    const temIndicadoresMensagem = payload.pushName || payload.senderName;
    const ehMensagemReal = payload.messageId &&
                           payload.phone &&
                           payload.fromMe === false &&
                           (temConteudoMensagem || temIndicadoresMensagem);

    if (!ehMensagemReal && (tipo === 'webhookdelivery' || tipo === 'webhookdelivered' || tipo.includes('messagestatuscallback') || tipo.includes('delivery') || tipo.includes('ack') || payload.fromMe === true)) {
      const msgId = (Array.isArray(payload.ids) && payload.ids[0]) ||
                    payload.messageId ||
                    payload.id ||
                    payload.key?.id ||
                    null;
      const rawStatus = payload.status ?? payload.ack ?? payload.deliveryStatus ?? (tipo === 'webhookdelivery' ? 2 : null);
      return {
        type: 'message_update',
        instanceId,
        messageId: msgId,
        status: rawStatus
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

    // ════════════════════════════════════════════════════════
    // ✅ PROCESSAMENTO DE MÍDIA — buildDownloadSpec em todos
    //    Captura url||link (Auto Download) + mediaId + mediaKey+directPath
    //    Só gera spec se houver pelo menos 1 dado utilizável
    // ════════════════════════════════════════════════════════

    if (msgContent.imageMessage) {
      mediaType = 'image';
      conteudo = msgContent.imageMessage.caption || '📷 [Imagem recebida]';
      // W-API: messageId é o mediaId para download-url
      downloadSpec = buildDownloadSpec('image', msgContent.imageMessage, {
        mediaId: payload.messageId || null
      });

    } else if (msgContent.videoMessage) {
      mediaType = 'video';
      conteudo = msgContent.videoMessage.caption || '🎥 [Vídeo recebido]';
      downloadSpec = buildDownloadSpec('video', msgContent.videoMessage, {
        mediaId: payload.messageId || null
      });

    } else if (msgContent.audioMessage || msgContent.pttMessage) {
      mediaType = 'audio';
      const audioMsg = msgContent.audioMessage || msgContent.pttMessage;
      conteudo = audioMsg?.ptt ? '🎤 [Áudio de voz]' : '🎤 [Áudio recebido]';

      downloadSpec = buildDownloadSpec('audio', audioMsg, {
        isPtt: audioMsg?.ptt || false,
        mediaId: audioMsg?.mediaId || audioMsg?.id || payload.mediaId || payload.messageId || null
      });

      // ✅ TELEMETRIA: logar PTTs que chegam sem dados
      if (!downloadSpec) {
        console.warn('[WAPI-NORM] 🔴 PTT_SEM_DADOS | messageId=' + (payload.messageId || 'N/A') +
          ' | phone=' + telefone +
          ' | audioKeys=' + Object.keys(audioMsg || {}).join(',') +
          ' | ts=' + new Date().toISOString());
      }

    } else if (msgContent.documentMessage || msgContent.documentWithCaptionMessage) {
      mediaType = 'document';
      const docMsg = msgContent.documentMessage ||
                     msgContent.documentWithCaptionMessage?.message?.documentMessage;
      const fileName = docMsg?.fileName || docMsg?.title || 'arquivo';
      conteudo = docMsg?.caption ? `${docMsg.caption} (${fileName})` : `📄 [Documento: ${fileName}]`;
      downloadSpec = buildDownloadSpec('document', docMsg, {
        fileName,
        fileLength: docMsg?.fileLength,
        pageCount: docMsg?.pageCount,
        mediaId: payload.messageId || null
      });

    } else if (msgContent.stickerMessage) {
      mediaType = 'sticker';
      conteudo = '[Sticker]';
      downloadSpec = buildDownloadSpec('sticker', msgContent.stickerMessage);

    } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
      mediaType = 'contact';
      const contacts = msgContent.contactsArrayMessage?.contacts || [msgContent.contactMessage];
      const nomes = contacts.map(c => c?.displayName || c?.vcard?.match(/FN:([^\n]+)/)?.[1]).filter(Boolean);
      conteudo = nomes.length > 0 ? `📇 [Contato: ${nomes.join(', ')}]` : '📇 [Contato compartilhado]';

    } else if (msgContent.locationMessage || msgContent.liveLocationMessage) {
      mediaType = 'location';
      const locMsg = msgContent.locationMessage || msgContent.liveLocationMessage;
      conteudo = `📍 [Localização: ${locMsg?.degreesLatitude || 0}, ${locMsg?.degreesLongitude || 0}]`;

    } else if (msgContent.extendedTextMessage) {
      conteudo = msgContent.extendedTextMessage.text || '';

    } else if (msgContent.conversation) {
      conteudo = msgContent.conversation;

    // ✅ REAÇÃO: ignorar silenciosamente (não salvar como mensagem)
    } else if (msgContent.reactionMessage) {
      console.log('[WAPI-NORM] ⏭️ reactionMessage ignorada | msgId=' + (payload.messageId || 'N/A'));
      return { type: 'unknown', error: 'reaction_message' };

    // ✅ PROTOCOLO/DELEÇÃO: ignorar silenciosamente
    } else if (msgContent.protocolMessage) {
      console.log('[WAPI-NORM] ⏭️ protocolMessage ignorada | msgId=' + (payload.messageId || 'N/A'));
      return { type: 'unknown', error: 'protocol_message' };

    // ✅ ENQUETE: tratar como texto
    } else if (msgContent.pollCreationMessage) {
      conteudo = `📊 [Enquete: ${msgContent.pollCreationMessage.name || 'sem título'}]`;

    // ✅ VISUALIZAÇÃO ÚNICA: indicar sem tentar baixar (mídia expira imediatamente)
    } else if (msgContent.viewOnceMessage || msgContent.viewOnceMessageV2) {
      mediaType = 'image';
      conteudo = '🔒 [Foto/Vídeo de visualização única]';

    // ✅ EDIÇÃO DE MENSAGEM: ignorar (não criar nova mensagem)
    } else if (msgContent.editedMessage) {
      console.log('[WAPI-NORM] ⏭️ editedMessage ignorada | msgId=' + (payload.messageId || 'N/A'));
      return { type: 'unknown', error: 'edited_message' };

    // ✅ messageContextInfo ISOLADO:
    //    BUG ANTERIOR: salvava '[Mensagem sem conteúdo]' literalmente no banco.
    //    CORREÇÃO: retorna '' → cai no filtro mensagem_vazia → NÃO salva.
    //    messageContextInfo sozinho é metadado de contexto/reply, não é mensagem real.
    } else if (msgContent.messageContextInfo && !conteudo) {
      console.warn('[WAPI-NORM] ⚠️ messageContextInfo sem conteúdo | msgId=' + (payload.messageId || 'N/A') +
        ' | msgContentKeys=' + Object.keys(msgContent).join(','));
      conteudo = conteudoRaw; // usa body/text se tiver, senão '' → filtro abaixo rejeita

    } else {
      // Tipo de msgContent desconhecido — logar para diagnóstico
      const keysDesconhecidas = Object.keys(msgContent).filter(k => k !== 'messageContextInfo');
      if (keysDesconhecidas.length > 0) {
        console.warn('[WAPI-NORM] ⚠️ TIPO_DESCONHECIDO | msgId=' + (payload.messageId || 'N/A') +
          ' | keys=' + keysDesconhecidas.join(','));
      }
      conteudo = conteudoRaw;
    }

    if (!conteudo && (payload.body || payload.text?.message)) {
      conteudo = payload.body || payload.text?.message || '';
    }

    if (!conteudo && mediaType === 'none') {
      console.log('[WAPI-NORM] ⏭️ mensagem_vazia | msgId=' + (payload.messageId || 'N/A') +
        ' | msgContentKeys=' + Object.keys(msgContent).join(','));
      return { type: 'unknown', error: 'mensagem_vazia' };
    }

    return {
      type: 'message',
      instanceId,
      messageId: payload.messageId || payload.key?.id,
      from: numeroLimpo,
      content: String(conteudo || '').trim(),
      mediaType,
      downloadSpec,        // null se sem dados → media_url='failed_download'
      mediaCaption: msgContent.imageMessage?.caption ||
                    msgContent.videoMessage?.caption ||
                    msgContent.documentMessage?.caption ||
                    msgContent.documentWithCaptionMessage?.message?.documentMessage?.caption,
      pushName: payload.pushName || payload.senderName || payload.sender?.pushName ||
                payload.text?.senderName || payload.sender?.verifiedBizName,
      vcard:    msgContent.contactMessage || msgContent.contactsArrayMessage,
      location: msgContent.locationMessage || msgContent.liveLocationMessage,
      quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
    };

  } catch (err) {
    console.error('🔴 [CRITICAL] Erro dentro de normalizarPayload:', err.message);
    return {
      type: 'unknown',
      error: 'normalization_failed',
      raw_error: err.message
    };
  }
}

// ============================================================================
// HANDLERS
// ============================================================================
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
      const connectedPhone = payloadBruto.connectedPhone ||
                             payloadBruto.phone ||
                             payloadBruto.phoneNumber ||
                             payloadBruto.sender?.id?.replace(/@.*$/, '');
      const updateData = {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
        token_status: dados.status === 'conectado' ? 'valido' : 'nao_verificado'
      };
      if (connectedPhone && dados.status === 'conectado') {
        updateData.numero_telefone = connectedPhone;
      }
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, updateData);
    }
  } catch (e) {
    console.error('[WAPI] ❌ Erro ao atualizar conexão:', e.message);
  }
  return jsonOk({ processed: 'connection', status: dados.status, provider: 'w_api' });
}

async function handleConnectionStatus(payload, base44) {
  const evento = String(payload.event || '').toLowerCase();
  const instanceId = payload.instanceId;
  const moment = payload.moment;

  if (!instanceId) {
    console.warn('[WAPI] ⚠️ Evento de status sem instanceId');
    return jsonOk({ ignored: true, reason: 'no_instance_id' });
  }

  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: instanceId }, '-created_date', 1
    );

    if (!integracoes || integracoes.length === 0) {
      return jsonOk({ ignored: true, reason: 'unmapped_instance' });
    }

    const integracao = integracoes[0];
    const timestamp = moment ? new Date(moment * 1000).toISOString() : new Date().toISOString();

    if (evento === 'webhookdisconnected') {
      if (integracao.status === 'desconectado' && integracao.last_disconnected_at) {
        const diffMs = Date.now() - new Date(integracao.last_disconnected_at).getTime();
        if (diffMs < 120000) {
          return jsonOk({ ignored: true, reason: 'already_disconnected' });
        }
      }

      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
        status: 'desconectado',
        last_disconnected_at: timestamp,
        status_reason: 'webhookDisconnected',
        ultima_atividade: timestamp
      });

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
            disconnected_at: timestamp
          }
        });
      } catch (notifErr) {
        console.warn('[WAPI] ⚠️ Erro ao criar notificação:', notifErr.message);
      }

      return jsonOk({ processed: 'disconnection', integration_id: integracao.id });
    }

    if (evento === 'webhookconnected') {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
        status: 'conectado',
        last_connected_at: timestamp,
        status_reason: null,
        ultima_atividade: timestamp,
        token_status: 'valido'
      });
      return jsonOk({ processed: 'reconnection', integration_id: integracao.id });
    }

    return jsonOk({ ignored: true, reason: 'unknown_connection_event' });

  } catch (error) {
    console.error('[WAPI] ❌ Erro ao processar status de conexão:', error.message);
    return jsonOk({ error: 'processing_failed', details: error.message });
  }
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return jsonOk({ skipped: 'no_message_id' });

  const statusMap = {
    'READ': 'lida', 'read': 'lida', '3': 'lida', 3: 'lida',
    'DELIVERED': 'entregue', 'delivered': 'entregue', '2': 'entregue', 2: 'entregue',
    'SENT': 'enviada', 'sent': 'enviada', '1': 'enviada', 1: 'enviada',
    'FAILED': 'falhou', 'failed': 'falhou', 'ERROR': 'falhou', 'error': 'falhou'
  };

  const novoStatus = statusMap[dados.status] ?? statusMap[String(dados.status)] ?? null;

  if (!novoStatus) {
    return jsonOk({ processed: 'status_update', skipped: 'unknown_status', raw_status: dados.status });
  }

  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );

    if (mensagens && mensagens.length > 0) {
      const ordemStatus = { 'enviando': 0, 'enviada': 1, 'entregue': 2, 'lida': 3 };
      const statusAtual = mensagens[0].status;
      if ((ordemStatus[novoStatus] ?? 0) >= (ordemStatus[statusAtual] ?? 0)) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {
    console.error('[WAPI] ❌ Erro ao atualizar status:', e.message);
  }
  return jsonOk({ processed: 'status_update', provider: 'w_api', new_status: novoStatus });
}

// ============================================================================
// HANDLE MESSAGE
// ============================================================================
async function handleMessage(dados, payloadBruto, base44) {
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] INICIO handleMessage | De:', dados.from, '| Tipo:', dados.mediaType,
              '| downloadSpec:', dados.downloadSpec ? '✅ com dados' : '❌ sem dados');

  if (dados.from === '+559999999999') {
    console.log('[WAPI] 🗓️ AGENDA NEXUS IA DETECTADA');
  }

  const inicio = Date.now();

  // DEDUPLICAÇÃO por messageId
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 1
      );
      if (dup && dup.length > 0) {
        console.log(`[WAPI] ⏭️ DUPLICADA por messageId: ${dados.messageId}`);
        return jsonOk({ message_id: dup[0].id, ignored: true, reason: 'duplicata_message_id', duration_ms: Date.now() - inicio });
      }
    } catch (e) {
      console.warn(`[WAPI] ⚠️ Erro ao verificar duplicata por messageId:`, e.message);
    }
  }

  // PORTEIRO CEGO — busca integração
  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  let integracaoId = null;
  let integracaoInfo = null;

  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId, api_provider: 'w_api' }, '-created_date', 1
      );
      if (int && int.length > 0) {
        integracaoId = int[0].id;
        integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
        console.log(`[WAPI] 🔑 PORTEIRO: Integração encontrada por instanceId: ${dados.instanceId}`);
      }
    } catch (err) {
      console.error('[WAPI] ❌ Erro ao buscar por instanceId:', err.message);
    }
  }

  if (!integracaoId && connectedPhone) {
    try {
      const todasWAPI = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { api_provider: 'w_api' }, '-created_date', 50
      );
      const phoneLimpo = connectedPhone.replace(/\D/g, '');
      for (const int of (todasWAPI || [])) {
        const numeroInt = (int.numero_telefone || '').replace(/\D/g, '');
        if (numeroInt && phoneLimpo && numeroInt === phoneLimpo) {
          integracaoId = int.id;
          integracaoInfo = { nome: int.nome_instancia, numero: int.numero_telefone };
          console.log(`[WAPI] 🔑 PORTEIRO FALLBACK: Integração encontrada por connectedPhone. ID: ${int.id}`);
          break;
        }
      }
    } catch (err) {
      console.error('[WAPI] ❌ Erro no fallback por connectedPhone:', err.message);
    }
  }

  console.log(`[WAPI] 🏛️ PORTEIRO RESULTADO: ${integracaoId ? '✅ Integração encontrada' : '❌ Não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  // CONTATO
  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;
  let contato;
  try {
    const resultado = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
      telefone: dados.from,
      pushName: dados.pushName || null,
      profilePicUrl,
      conexaoId: integracaoId
    });
    if (!resultado?.data?.success || !resultado?.data?.contact) {
      console.error(`[WAPI] ❌ Função centralizada falhou:`, resultado?.data);
      return jsonErr('erro_contato_centralizado', 500);
    }
    contato = resultado.data.contact;
    console.log(`[WAPI] ✅ Contatos recebidos via função centralizada: ${contato.id} | ${contato.nome} | Ação: ${resultado.data.action}`);
  } catch (e) {
    console.error(`[WAPI] ❌ Erro ao chamar função centralizada:`, e?.message);
    return jsonErr('erro_contato', 500);
  }

  // AUTO-MERGE DE THREADS
  let threadCanonica = null;
  try {
    const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id }, '-primeira_mensagem_at', 20
    );

    if (todasThreadsContato && todasThreadsContato.length > 1) {
      console.log(`[WAPI] 🔀 AUTO-MERGE: ${todasThreadsContato.length} threads para contact ${contato.id}`);
      threadCanonica = todasThreadsContato[todasThreadsContato.length - 1];
      const integracoesHistoricas = new Set();
      if (integracaoId) integracoesHistoricas.add(integracaoId);
      todasThreadsContato.forEach(t => {
        if (t.whatsapp_integration_id) integracoesHistoricas.add(t.whatsapp_integration_id);
        if (t.origin_integration_ids?.length > 0) t.origin_integration_ids.forEach(id => integracoesHistoricas.add(id));
      });
      await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
        is_canonical: true,
        status: 'aberta',
        whatsapp_integration_id: integracaoId || threadCanonica.whatsapp_integration_id,
        origin_integration_ids: Array.from(integracoesHistoricas),
        ultima_atividade: new Date().toISOString()
      });
      console.log(`[WAPI] ✅ Thread canônica eleita: ${threadCanonica.id} (${integracoesHistoricas.size} integrações no histórico)`);
      for (const threadAntiga of todasThreadsContato) {
        if (threadAntiga.id !== threadCanonica.id) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
              status: 'merged', merged_into: threadCanonica.id, is_canonical: false
            });
            console.log(`[WAPI] 🔀 Thread merged: ${threadAntiga.id} → ${threadCanonica.id}`);
          } catch (e) {}
        }
      }
    } else if (todasThreadsContato && todasThreadsContato.length === 1) {
      threadCanonica = todasThreadsContato[0];
      const needsUpdate = !threadCanonica.is_canonical ||
                          (integracaoId && threadCanonica.whatsapp_integration_id !== integracaoId);
      if (needsUpdate) {
        const updateData = { is_canonical: true, status: 'aberta' };
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
    console.warn(`[WAPI] ⚠️ Erro ao fazer auto-merge:`, err.message);
  }

  // BUSCAR/CRIAR THREAD
  let thread = threadCanonica;
  if (!thread) {
    try {
      console.log(`[WAPI] 🔍 Buscando thread canônica para contact_id: "${contato.id}"`);
      const threads = await base44.asServiceRole.entities.MessageThread.filter(
        { contact_id: contato.id, is_canonical: true, status: 'aberta' }, '-last_message_at', 1
      );
      if (threads && threads.length > 0) {
        thread = threads[0];
        console.log(`[WAPI] ✅ canonical-thread-found: ${thread.id}`);
      } else {
        console.log(`[WAPI] 🆕 Criando thread ÚNICA para este contato.`);
        const agora = new Date().toISOString();
        thread = await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contato.id,
          whatsapp_integration_id: integracaoId,
          conexao_id: integracaoId,
          origin_integration_ids: integracaoId ? [integracaoId] : [],
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
        console.log(`[WAPI] ✅ new-canonical-thread-created: ${thread.id}`);
      }
    } catch (e) {
      console.error(`[WAPI] ❌ Erro thread:`, e?.message);
      return jsonErr('erro_thread', 500);
    }
  }

  if (!thread || !thread.id) {
    console.error(`[WAPI] ❌ ERRO CRÍTICO: Thread não foi criada/encontrada!`);
    return jsonErr('thread_not_found', 500);
  }

  // DEDUPLICAÇÃO POR CONTEÚDO
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
        console.log(`[WAPI] ⏭️ DUPLICATA POR CONTEÚDO: ${duplicadaPorConteudo.id}`);
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_at: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          status: 'aberta',
        });
        return jsonOk({ ignored: true, reason: 'duplicata_conteudo', thread_updated: true });
      }
    }
  } catch (err) {
    console.warn(`[WAPI] ⚠️ Erro ao verificar duplicata:`, err.message);
  }

  // ════════════════════════════════════════════════════════════
  // ✅ DETERMINAR STATUS DA MÍDIA
  //    downloadSpec !== null → pending_download (worker vai baixar)
  //    downloadSpec === null mas tem mídia → failed_download (sem dados)
  //    sem mídia → null
  // ════════════════════════════════════════════════════════════
  let mediaUrlInicial = null;
  if (dados.mediaType !== 'none' && dados.mediaType !== 'contact' && dados.mediaType !== 'location') {
    mediaUrlInicial = dados.downloadSpec ? 'pending_download' : 'failed_download';
  }

  // SALVAR MENSAGEM
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: mediaUrlInicial,
      media_type: dados.mediaType,
      media_caption: dados.mediaCaption ?? null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: dados.messageId ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        analise_multimodal: null,
        midia_persistida: false,
        deleted: null,
        whatsapp_integration_id: integracaoId,
        instance_id: dados.instanceId ?? null,
        connected_phone: connectedPhone ?? null,
        canal_nome: integracaoInfo?.nome ?? null,
        canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null),
        vcard: dados.vcard ?? null,
        location: dados.location ?? null,
        quoted_message: dados.quotedMessage ?? null,
        downloadSpec: dados.downloadSpec ?? null,
        media_url_status: mediaUrlInicial,
        processed_by: VERSION,
        provider: 'w_api'
      },
    });

    console.log(`[WAPI] ✅ Mensagem salva: ${mensagem.id} | media_url: ${mediaUrlInicial || 'nenhuma'}`);
  } catch (e) {
    console.error(`[WAPI] ❌ Erro salvar mensagem:`, e?.message);
    return jsonErr('erro_salvar_mensagem', 500);
  }

  // ATUALIZAR THREAD
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
      whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id,
      conexao_id: integracaoId || thread.conexao_id
    };
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[WAPI] 💭 Tópico atualizado | Total: ${threadUpdate.total_mensagens} | Não lida: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[WAPI] ⚠️ Erro ao atualizar thread:`, updateError.message);
  }

  // ✅ WORKER DE MÍDIA — só dispara se downloadSpec tem dados úteis
  if (dados.downloadSpec) {
    console.log('[WAPI] 🏛️ GERENTE: Disparando worker de mídia...',
                { type: dados.downloadSpec.type, hasUrl: !!dados.downloadSpec.url,
                  hasKeyPath: !!(dados.downloadSpec.mediaKey && dados.downloadSpec.directPath),
                  hasMediaId: !!dados.downloadSpec.mediaId });
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      integration_id: integracaoId,
      downloadSpec: dados.downloadSpec,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[WAPI] Erro trigger mídia:', e.message));
  } else if (mediaUrlInicial === 'failed_download') {
    console.warn(`[WAPI] ⚠️ MEDIA_FAILED | msgId=${mensagem.id} | type=${dados.mediaType} | Sem dados para download`);
  }

  // PROCESSAMENTO CORE
  try {
    console.log('[WAPI] 🏛️ GERENTE: Iniciando processamento com Core...');
    console.log('[WAPI] 📊 Thread de diagnóstico:', {
      thread_id: thread.id,
      assigned_user_id: thread.assigned_user_id,
      pre_atendimento_ativo: thread.pre_atendimento_ativo,
      last_human_message_at: thread.last_human_message_at,
      last_inbound_at: thread.last_inbound_at,
      unread_count: thread.unread_count
    });

    let integracaoCompleta = null;
    if (integracaoId) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
        console.log('[WAPI] 🔐 GERENTE: Integração compartilhada (Token seguro no banco)');
      } catch (e) {
        console.warn('[WAPI] ⚠️ Integração não encontrada:', e.message);
      }
    }

    console.log('[WAPI] 🎯 Invocando processInbound (adaptador) para thread:', thread.id);
    await base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread,
      integration: integracaoCompleta,
      provider: 'w_api',
      messageContent: dados.content,
      rawPayload: payloadBruto
    });
    console.log('[WAPI] ✅ processInbound executado com sucesso');
  } catch (err) {
    console.error('[WAPI] 🔴 GERENTE: Erro no processamento:', err.message);
  }

  // AUDIT LOG
  try {
    await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId ?? null,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: true,
      message_id: payloadBruto.messageId || dados.messageId,
    });
  } catch {}

  const duracao = Date.now() - inicio;
  console.log(`[WAPI] ✅ SUCESSO! Mensagem: ${mensagem.id} | Tópico: ${thread.id} | ${duracao}ms`);

  return jsonOk({
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    status: 'processed_inline'
  });
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  console.log('[WAPI-WEBHOOK] REQUEST | Método:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return jsonOk({
      version: VERSION,
      build_date: BUILD_DATE,
      deployment_id: DEPLOYMENT_ID,
      architecture: ARCHITECTURE,
      status: 'ok',
      provider: 'w_api',
      fixes: [
        'downloadSpec null quando sem url/mediaKey+directPath/mediaId',
        'url||link (Auto Download Whapi) como fast-path',
        'failed_download imediato para mídia sem dados',
        'telemetria PTT_SEM_DADOS para diagnóstico',
        'messageContextInfo não salva mais [Mensagem sem conteúdo]',
        'reactionMessage/protocolMessage/editedMessage ignorados silenciosamente'
      ]
    });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
    console.log('[WAPI-AUTH] ✅ Cliente Base44 criado (asServiceRole habilitado)');
  } catch (e) {
    console.error('[WAPI] 🔴 FATAL AUTH ERROR:', e.message);
    return jsonErr(`auth_error: ${e.message}`, 500);
  }

  let payload;
  try {
    const body = await req.text();
    if (!body) return jsonOk({ ignored: true });
    payload = JSON.parse(body);
    console.log('[WAPI] 📥 Event:', payload.event, '| Type:', payload.type);
    console.log('[WAPI] 📥 Payload:', JSON.stringify(payload).substring(0, 1500));
  } catch (e) {
    return jsonErr('JSON invalido', 200);
  }

  const classification = classifyWapiEvent(payload);
  console.log('[WAPI] 📊 Classification:', classification, '| Event:', payload.event || payload.type);

  const motivoIgnorar = deveIgnorar(payload, classification);

  if (motivoIgnorar) {
    console.log('[WAPI] ⏭️ Ignorado:', motivoIgnorar);
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: payload.instanceId || null,
        integration_id: null,
        message_id: payload.messageId || null,
        evento: payload.event || payload.type || 'unknown',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false,
        erro_detalhes: `Ignorado: ${motivoIgnorar}`
      });
    } catch {}
    return jsonOk({ ignored: true, reason: motivoIgnorar });
  }

  const dados = normalizarPayload(payload);
  console.log('[WAPI] 🔄 Dados normalizados:', {
    type: dados.type, error: dados.error, from: dados.from,
    mediaType: dados.mediaType, hasDownloadSpec: !!dados.downloadSpec
  });

  if (dados.type === 'unknown') {
    console.log(`[WAPI] ⏭️ Unknown: ${dados.error}`);
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: payload.instanceId || null,
        integration_id: null,
        message_id: payload.messageId || null,
        evento: payload.event || payload.type || 'unknown',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false,
        erro_detalhes: `Normalização falhou: ${dados.error}`
      });
    } catch {}
    return jsonOk({ ignored: true, reason: dados.error });
  }

  if (classification === 'connection-status') {
    return await handleConnectionStatus(payload, base44);
  }

  console.log(`[WAPI] 🔄 Processando: ${dados.type}`);

  try {
    switch (dados.type) {
      case 'qrcode':         return await handleQRCode(dados, base44);
      case 'connection':     return await handleConnection(dados, base44, payload);
      case 'message_update': return await handleMessageUpdate(dados, base44);
      case 'message':        return await handleMessage(dados, payload, base44);
      default:               return jsonOk({ ignored: true, reason: 'tipo_desconhecido' });
    }
  } catch (error) {
    console.error('[WAPI] ❌ ERRO:', error?.message);
    return jsonErr('erro_interno', 500);
  }
});