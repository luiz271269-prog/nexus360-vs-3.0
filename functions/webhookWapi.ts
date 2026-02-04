import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ╔════════════════════════════════════════════════════════════════════════╗
// ║  WEBHOOK WHATSAPP W-API - v25.0.0-CLONE-FIX                           ║
// ║  TIMESTAMP: 2026-01-07T14:30:00 - CORREÇÃO CRÍTICA req.clone()       ║
// ║                                                                        ║
// ║  ARQUITETURA: "PORTEIRO CEGO" vs "GERENTE"                            ║
// ║  • Webhook (Porteiro): Só confere crachá (instanceId/connectedPhone) ║
// ║  • Core/Workers (Gerente): Usa token do banco para ações             ║
// ║  • Token NUNCA trafega no webhook de entrada                          ║
// ║  • req.clone() OBRIGATÓRIO para asServiceRole funcionar              ║
// ╚════════════════════════════════════════════════════════════════════════╝

const VERSION = 'v25.0.0-CLONE-FIX';
const BUILD_DATE = '2026-01-07T14:30:00';
const DEPLOYMENT_ID = 'WAPI_CLONE_FIX_2026_01_07';
const ARCHITECTURE = 'PORTEIRO-CEGO';

// ╔════════════════════════════════════════════════════════════════════════╗
// ║  LOG BOOT - CONFIRMA VERSÃO ATIVA                                      ║
// ╚════════════════════════════════════════════════════════════════════════╝
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  🚀 W-API WEBHOOK v25 - req.clone() FIX                   ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║  📅 BUILD: ${BUILD_DATE}                     ║`);
console.log(`║  🆔 DEPLOY: ${DEPLOYMENT_ID}         ║`);
console.log('║  🏛️  ARQUITETURA: PORTEIRO CEGO vs GERENTE                ║');
console.log('║  🔒 TOKEN: Nunca usado no webhook (apenas no Core)        ║');
console.log('║  🎯 LOOKUP: instanceId ou connectedPhone -> Banco         ║');
console.log('║  ✅ AUTH: req.clone() OBRIGATÓRIO                         ║');
console.log('║  ⚠️  SDK 0.8.4 - WEBHOOK PATTERN (igual Z-API)            ║');
console.log('╚════════════════════════════════════════════════════════════╝');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// HELPERS
// ============================================================================
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

// ============================================================================
// CLASSIFICADOR
// ============================================================================
function classifyWapiEvent(payload) {
  if (!payload || typeof payload !== 'object') return 'ignore';

  const evento = String(payload.event || payload.type || '').toLowerCase();

  // ✅ EVENTOS DE CONEXÃO/DESCONEXÃO
  if (evento === 'webhookdisconnected' || evento === 'webhookconnected' || evento === 'instancedisconnected') {
    return 'connection-status';
  }

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

// ============================================================================
// FILTRO
// ============================================================================
function deveIgnorar(payload, classification) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  if (classification === 'ignore') return 'evento_desconhecido';
  if (classification === 'system-status') return null;
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

    // Processar TODOS os tipos de mídia (ordem de prioridade)
    if (msgContent.imageMessage) {
      mediaType = 'image';
      conteudo = msgContent.imageMessage.caption || '[Imagem]';
      downloadSpec = {
        type: 'image',
        mediaKey: msgContent.imageMessage.mediaKey,
        directPath: msgContent.imageMessage.directPath,
        url: msgContent.imageMessage.url,
        mimetype: msgContent.imageMessage.mimetype
      };
    } else if (msgContent.videoMessage) {
      mediaType = 'video';
      conteudo = msgContent.videoMessage.caption || '[Vídeo]';
      downloadSpec = {
        type: 'video',
        mediaKey: msgContent.videoMessage.mediaKey,
        directPath: msgContent.videoMessage.directPath,
        url: msgContent.videoMessage.url,
        mimetype: msgContent.videoMessage.mimetype
      };
    } else if (msgContent.audioMessage || msgContent.pttMessage) {
      mediaType = 'audio';
      const audioMsg = msgContent.audioMessage || msgContent.pttMessage;
      conteudo = audioMsg?.ptt ? '[Áudio de voz]' : '[Áudio]';
      downloadSpec = {
        type: 'audio',
        mediaKey: audioMsg?.mediaKey,
        directPath: audioMsg?.directPath,
        url: audioMsg?.url,
        mimetype: audioMsg?.mimetype,
        isPtt: audioMsg?.ptt || false
      };
    } else if (msgContent.documentMessage || msgContent.documentWithCaptionMessage) {
      mediaType = 'document';
      const docMsg = msgContent.documentMessage || msgContent.documentWithCaptionMessage?.message?.documentMessage;
      conteudo = docMsg?.caption || docMsg?.fileName || docMsg?.title || '[Documento]';
      downloadSpec = {
        type: 'document',
        mediaKey: docMsg?.mediaKey,
        directPath: docMsg?.directPath,
        url: docMsg?.url,
        mimetype: docMsg?.mimetype,
        fileName: docMsg?.fileName || docMsg?.title,
        fileLength: docMsg?.fileLength,
        pageCount: docMsg?.pageCount
      };
    } else if (msgContent.stickerMessage) {
      mediaType = 'sticker';
      conteudo = '[Sticker]';
      downloadSpec = {
        type: 'sticker',
        mediaKey: msgContent.stickerMessage.mediaKey,
        directPath: msgContent.stickerMessage.directPath,
        url: msgContent.stickerMessage.url
      };
    } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
      mediaType = 'contact';
      const contacts = msgContent.contactsArrayMessage?.contacts || [msgContent.contactMessage];
      const nomes = contacts.map(c => c?.displayName || c?.vcard?.match(/FN:([^\n]+)/)?.[1]).filter(Boolean);
      conteudo = nomes.length > 0 ? `[Contato: ${nomes.join(', ')}]` : '[Contato]';
    } else if (msgContent.locationMessage || msgContent.liveLocationMessage) {
      mediaType = 'location';
      const locMsg = msgContent.locationMessage || msgContent.liveLocationMessage;
      conteudo = `[Localização: ${locMsg?.degreesLatitude || 0}, ${locMsg?.degreesLongitude || 0}]`;
    } else if (msgContent.extendedTextMessage) {
      conteudo = msgContent.extendedTextMessage.text || '';
    } else if (msgContent.conversation) {
      conteudo = msgContent.conversation;
    } else if (msgContent.messageContextInfo && !conteudo) {
      // Casos raros onde só tem contexto mas sem conteúdo explícito
      conteudo = conteudoRaw || '[Mensagem sem conteúdo]';
    } else {
      conteudo = conteudoRaw;
    }
    
    // ✅ EMOJIS: Se não encontrou texto mas payload tem body/text, usar
    if (!conteudo && (payload.body || payload.text?.message)) {
      conteudo = payload.body || payload.text?.message || '';
    }

    // Aceitar mensagem mesmo sem conteúdo se tiver mídia
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
      mediaCaption: msgContent.imageMessage?.caption || msgContent.videoMessage?.caption || msgContent.documentMessage?.caption || msgContent.documentWithCaptionMessage?.message?.documentMessage?.caption,
      pushName: payload.pushName || payload.senderName || payload.sender?.pushName || payload.text?.senderName || payload.sender?.verifiedBizName,
      vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
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
// HANDLERS (SINTAXE SDK BASE44)
// ============================================================================
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return jsonOk({});
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
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
      { instance_id_provider: dados.instanceId },
      '-created_date',
      1
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
        console.log('[WAPI] ✅ Número de telefone associado:', connectedPhone);
      }
      
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, updateData);
      
      console.log('[WAPI] ✅ Status de conexão atualizado:', dados.status);
    }
  } catch (e) {
    console.error('[WAPI] ❌ Erro ao atualizar conexão:', e.message);
  }
  return jsonOk({ processed: 'connection', status: dados.status, provider: 'w_api' });
}

// ============================================================================
// HANDLE DISCONNECTION/CONNECTION STATUS
// ============================================================================
async function handleConnectionStatus(payload, base44) {
  const evento = String(payload.event || '').toLowerCase();
  const instanceId = payload.instanceId;
  const moment = payload.moment; // epoch seconds
  
  if (!instanceId) {
    console.warn('[WAPI] ⚠️ Evento de status sem instanceId');
    return jsonOk({ ignored: true, reason: 'no_instance_id' });
  }

  try {
    // Buscar integração
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: instanceId },
      '-created_date',
      1
    );

    if (!integracoes || integracoes.length === 0) {
      console.warn('[WAPI] ⚠️ Instância não mapeada:', instanceId);
      return jsonOk({ ignored: true, reason: 'unmapped_instance' });
    }

    const integracao = integracoes[0];
    const timestamp = moment ? new Date(moment * 1000).toISOString() : new Date().toISOString();
    
    if (evento === 'webhookdisconnected') {
      // Anti-spam: não processar se já está desconectado há menos de 2 minutos
      if (integracao.status === 'desconectado' && integracao.last_disconnected_at) {
        const diffMs = Date.now() - new Date(integracao.last_disconnected_at).getTime();
        if (diffMs < 120000) { // 2 minutos
          console.log('[WAPI] ⏭️ Desconexão já registrada recentemente');
          return jsonOk({ ignored: true, reason: 'already_disconnected' });
        }
      }

      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
        status: 'desconectado',
        last_disconnected_at: timestamp,
        status_reason: 'webhookDisconnected',
        ultima_atividade: timestamp
      });

      console.log(`[WAPI] 🔴 DESCONEXÃO REGISTRADA: ${integracao.nome_instancia} às ${timestamp}`);

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

      console.log(`[WAPI] 🟢 RECONEXÃO REGISTRADA: ${integracao.nome_instancia} às ${timestamp}`);

      return jsonOk({ processed: 'reconnection', integration_id: integracao.id });
    }

    return jsonOk({ ignored: true, reason: 'unknown_connection_event' });

  } catch (error) {
    console.error('[WAPI] ❌ Erro ao processar status de conexão:', error.message);
    // ✅ NUNCA derrubar webhook - sempre retornar 200
    return jsonOk({ error: 'processing_failed', details: error.message });
  }
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return jsonOk({});
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId },
      '-created_date',
      1
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

// ============================================================================
// HANDLE MESSAGE
// ============================================================================
async function handleMessage(dados, payloadBruto, base44) {
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] INICIO handleMessage | De:', dados.from, '| Tipo:', dados.mediaType);

  const inicio = Date.now();

  // ✅ DEDUPLICAÇÃO INTELIGENTE - Se duplicata, ignora (simples)
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId },
        '-created_date',
        1
      );
      
      if (dup && dup.length > 0) {
        const mensagemExistente = dup[0];
        console.log(`[WAPI] ⏭️ DUPLICADA por messageId: ${dados.messageId} (já processada antes)`);
        
        const duracao = Date.now() - inicio;
        return jsonOk({
          message_id: mensagemExistente.id,
          ignored: true,
          reason: 'duplicata_message_id',
          duration_ms: duracao
        });
      }
    } catch (e) {
      console.warn(`[WAPI] ⚠️ Erro ao verificar duplicata por messageId:`, e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🏛️ ARQUITETURA "PORTEIRO CEGO" - ETAPA 1: IDENTIFICAÇÃO
  // ═══════════════════════════════════════════════════════════════════
  // O Webhook é o "Porteiro Cego": ele NUNCA usa o Token.
  // Ele apenas confere o "crachá" (instanceId ou connectedPhone) e busca
  // a integração no banco de dados usando APENAS essas chaves públicas.
  //
  // ESTRATÉGIA DE LOOKUP (prioridades):
  // 1. connectedPhone → filter({numero_telefone}) [PRIORIDADE 1]
  // 2. instanceId → filter({instance_id_provider}) [FALLBACK]
  //
  // O Token (api_key_provider) fica SEGURO no banco e será lido apenas
  // pelo "Gerente" (processInboundEvent, persistirMidiaWapi) quando
  // precisar realizar ações (enviar mensagens, baixar mídia).
  // ═══════════════════════════════════════════════════════════════════

  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  let integracaoId = null;
  let integracaoInfo = null;

  // PRIORIDADE 1: Buscar por instanceId (Mais direto para W-API)
  if (dados.instanceId) {
    try {
      const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: dados.instanceId, api_provider: 'w_api' },
        '-created_date',
        1
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

  // FALLBACK: Buscar por connectedPhone (se instanceId falhar ou não existir)
  if (!integracaoId && connectedPhone) {
    try {
      const todasWAPI = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { api_provider: 'w_api' },
        '-created_date',
        50
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

  // ✅ BUSCAR/CRIAR CONTATO - FUNÇÃO CENTRALIZADA ÚNICA
  const profilePicUrl = payloadBruto.sender?.profilePicture || payloadBruto.sender?.profilePicThumbObj?.eurl || null;
  let contato;
  try {
    console.log(`[WAPI] 🎯 Chamando função CENTRALIZADA para contato: ${dados.from}`);
    
    const resultado = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
      telefone: dados.from,
      pushName: dados.pushName || null,
      profilePicUrl: profilePicUrl,
      conexaoId: integracaoId
    });
    
    if (!resultado?.data?.success || !resultado?.data?.contact) {
      console.error(`[WAPI] ❌ Função centralizada falhou:`, resultado?.data);
      return jsonErr('erro_contato_centralizado', 500);
    }
    
    contato = resultado.data.contact;
    console.log(`[WAPI] ✅ Contato obtido via função centralizada: ${contato.id} | ${contato.nome} | Ação: ${resultado.data.action}`);
    
  } catch (e) {
    console.error(`[WAPI] ❌ Erro ao chamar função centralizada:`, e?.message);
    return jsonErr('erro_contato', 500);
  }

  // 🔧 AUTO-MERGE: Unificar todas as threads antigas deste contato (ANTES de criar/usar)
  let threadCanonica = null;
  try {
    const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id },
      '-primeira_mensagem_at',
      20
    );
    
    if (todasThreadsContato && todasThreadsContato.length > 1) {
      console.log(`[WAPI] 🔀 AUTO-MERGE: ${todasThreadsContato.length} threads encontradas para contact ${contato.id}`);
      
      // Eleger a mais antiga como canônica (preserva histórico)
      threadCanonica = todasThreadsContato[todasThreadsContato.length - 1];
      
      // Marcar canônica
      await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
        is_canonical: true,
        status: 'aberta'
      });
      console.log(`[WAPI] ✅ Thread canônica eleita: ${threadCanonica.id} (mais antiga)`);

      // Marcar demais como merged
      for (const threadAntiga of todasThreadsContato) {
        if (threadAntiga.id !== threadCanonica.id) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
              status: 'merged',
              merged_into: threadCanonica.id,
              is_canonical: false
            });
            console.log(`[WAPI] 🔀 Thread merged: ${threadAntiga.id} → ${threadCanonica.id}`);
          } catch (e) {
            console.error(`[WAPI] ⚠️ Erro ao marcar thread merged:`, e.message);
          }
        }
      }
    } else if (todasThreadsContato && todasThreadsContato.length === 1) {
      threadCanonica = todasThreadsContato[0];
      // Garantir que está marcada como canônica
      if (!threadCanonica.is_canonical) {
        await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
          is_canonical: true,
          status: 'aberta'
        });
      }
    }
  } catch (err) {
    console.warn(`[WAPI] ⚠️ Erro ao fazer auto-merge:`, err.message);
  }

  // ✅ BUSCAR/CRIAR THREAD - LÓGICA ATÔMICA (CANONICAL THREAD)
  // 🎯 Usar threadCanonica se auto-merge encontrou, senão buscar/criar
  let thread = threadCanonica;
  
  if (!thread) {
    try {
      console.log(`[WAPI] 🔍 Buscando thread canônica para contact_id: "${contato.id}"`);
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
        console.log(`[WAPI] ✅ canonical-thread-found: ${thread.id} | Unificada para todas as integrações`);
      } else {
        console.log(`[WAPI] 🆕 canonical-thread-not-found: Criando thread ÚNICA para este contato.`);
        const agora = new Date().toISOString();
        thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            whatsapp_integration_id: integracaoId,
            conexao_id: integracaoId, // Compatibilidade
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
        console.log(`[WAPI] ✅ new-canonical-thread-created: ${thread.id} | Thread UNIFICADA criada`);
      }
    } catch (e) {
      console.error(`[WAPI] ❌ Erro thread:`, e?.message);
      return jsonErr('erro_thread', 500);
    }
  }
  
  // Validação final
  if (!thread || !thread.id) {
    console.error(`[WAPI] ❌ ERRO CRÍTICO: Thread não foi criada/encontrada!`);
    return jsonErr('thread_not_found', 500);
  }

  // DEDUPLICAÇÃO POR CONTEÚDO
  try {
    const doisSegundosAtras = new Date(Date.now() - 2000).toISOString();
    const msgRecentes = await base44.asServiceRole.entities.Message.filter(
      { 
        thread_id: thread.id, 
        sender_type: 'contact'
      },
      '-created_date',
      10
    );
    
    if (msgRecentes) {
      const duplicadaPorConteudo = msgRecentes.find(m => 
        m.media_type === dados.mediaType &&
        m.content === dados.content &&
        Math.abs(new Date(m.created_date) - Date.now()) < 2000
      );
      
      if (duplicadaPorConteudo) {
        console.log(`[WAPI] ⏭️ DUPLICATA POR CONTEÚDO: ${duplicadaPorConteudo.id}`);
        
        const agora = new Date().toISOString();
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_at: agora,
          last_inbound_at: agora,
          status: 'aberta',
        });
        
        return jsonOk({ 
          ignored: true, 
          reason: 'duplicata_conteudo',
          thread_updated: true
        });
      }
    }
  } catch (err) {
    console.warn(`[WAPI] ⚠️ Erro ao verificar duplicata:`, err.message);
  }

  // SALVAR MENSAGEM (apenas se não for duplicata)
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
    
    console.log(`[WAPI] ✅ Mensagem salva: ${mensagem.id}`);
  } catch (e) {
    console.error(`[WAPI] ❌ Erro salvar mensagem:`, e?.message);
    return jsonErr('erro_salvar_mensagem', 500);
  }

  // ✅ ATUALIZAR THREAD - Incrementar contadores E guardar metadata
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
      conexao_id: integracaoId || thread.conexao_id // Manter simetria
    };
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[WAPI] 💭 Thread atualizada | Total: ${threadUpdate.total_mensagens} | Não lidas: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[WAPI] ⚠️ Erro ao atualizar thread:`, updateError.message);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🏛️ ARQUITETURA "GERENTE" - WORKER DE MÍDIA
  // ═══════════════════════════════════════════════════════════════════
  // O Worker persistirMidiaWapi é outro "Gerente".
  // Ele recebe o integration_id do Webhook e, internamente,
  // busca o Token do banco para baixar a mídia do provedor W-API.
  // ═══════════════════════════════════════════════════════════════════
  if (dados.downloadSpec) {
    console.log('[WAPI] 🏛️ GERENTE: Disparando worker de mídia (buscará token do banco)...');
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      integration_id: integracaoId,
      downloadSpec: dados.downloadSpec,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[WAPI] Erro trigger mídia:', e.message));
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🏛️ ARQUITETURA "GERENTE" - ETAPA 2: PROCESSAMENTO VIA CÉREBRO CENTRAL
  // ═══════════════════════════════════════════════════════════════════
  // Agora o "Gerente" (processInbound → inboundCore) entra em ação.
  // Ele recebe o integracaoId do "Porteiro" e, internamente,
  // busca o Token (api_key_provider) do banco quando precisar
  // realizar ações como:
  // - Enviar mensagens de resposta
  // - Baixar mídias
  // - Atualizar status
  //
  // O Webhook NÃO passa o token. Passa apenas o ID da integração.
  // ═══════════════════════════════════════════════════════════════════
  try {
    console.log('[WAPI] 🏛️ GERENTE: Iniciando processamento com Core...');
    console.log('[WAPI] 📊 Diagnóstico Thread:', {
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
        console.log('[WAPI] 🔐 GERENTE: Integração carregada (Token seguro no banco)');
      } catch (e) {
        console.warn('[WAPI] ⚠️ Integração não encontrada:', e.message);
      }
    }

    // ✅ INVOCAR processInbound (adaptador HTTP que delega para inboundCore)
    console.log('[WAPI] 🎯 Invocando processInbound (adaptador) para thread:', thread.id);
    await base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoCompleta,
      provider: 'w_api',
      messageContent: dados.content,
      rawPayload: payloadBruto
    });
    console.log('[WAPI] ✅ processInbound executado com sucesso');
  } catch (err) {
    console.error('[WAPI] 🔴 GERENTE: Erro no processamento:', err.message);
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
      message_id: payloadBruto.messageId || payloadBruto.data?.key?.id || dados.messageId,
    });
  } catch {}

  const duracao = Date.now() - inicio;
  console.log(`[WAPI] ✅ SUCESSO! Msg: ${mensagem.id} | Thread: ${thread.id} | ${duracao}ms`);

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
      auth_method: 'createClientFromRequest(req.clone()) - req.clone() OBRIGATÓRIO',
      strategy: {
        webhook_role: 'PORTEIRO_CEGO - Identifica pela instanceId/connectedPhone',
        token_usage: 'GERENTE - Core e Workers buscam token no banco',
        security: 'Token nunca trafega no webhook de entrada',
        symmetry: 'Total com Z-API (webhookFinalZapi)',
        critical_fix: 'req.clone() previne erro de asServiceRole'
      },
      no_supabase_vars: true,
      cache_bust: Date.now()
    });
  }

  // ✅ AUTH: SDK Base44 com req.clone() OBRIGATÓRIO
  // SEM .clone(), o asServiceRole FALHA com erro de token
  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
    console.log('[WAPI-AUTH] ✅ Cliente Base44 criado com req.clone() (asServiceRole habilitado)');
  } catch (e) {
    console.error('[WAPI] 🔴 FATAL AUTH ERROR:', e.message);
    console.error('[WAPI] 🔴 Stack:', e.stack);
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
    
    // ✅ SALVAR AUDIT LOG mesmo de eventos ignorados (para diagnóstico)
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: payload.instanceId || payload.instance || null,
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
  console.log('[WAPI] 🔄 Dados normalizados:', { type: dados.type, error: dados.error, from: dados.from, mediaType: dados.mediaType });
  
  if (dados.type === 'unknown') {
    console.log(`[WAPI] ⏭️ Unknown: ${dados.error}`);
    
    // ✅ SALVAR AUDIT LOG de erros de normalização
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

  // ✅ TRATAR EVENTOS DE CONEXÃO/DESCONEXÃO (antes da normalização)
  if (classification === 'connection-status') {
    return await handleConnectionStatus(payload, base44);
  }

  console.log(`[WAPI] 🔄 Processando: ${dados.type}`);

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
    console.error('[WAPI] ❌ ERRO:', error?.message);
    return jsonErr('erro_interno', 500);
  }
});