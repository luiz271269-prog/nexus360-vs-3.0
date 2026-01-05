import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// WEBHOOK WHATSAPP W-API - INGESTÃO UNIVERSAL
// ============================================================================
// PRINCÍPIO FUNDAMENTAL (DIA 25):
// 1. Agnóstico ao modo de criação (manual ou integrador)
// 2. Busca integração apenas por instance_id_provider
// 3. Processamento unificado: mesmo fluxo para todas as instâncias W-API
// ============================================================================

const VERSION = 'v13.0.1-UNREAD_BY';
const BUILD_DATE = '2026-01-05';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const integrationCache = new Map();
const CACHE_TTL = 60000;

// ============================================================================
// FUNÇÕES UTILITÁRIAS INLINE (evitar imports externos)
// ============================================================================

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
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const phone = String(payload.phone ?? payload.from ?? payload.chat?.id ?? '').toLowerCase();
  const isGroup = payload.isGroup === true || String(payload.chat?.id ?? '').includes('@g.us');

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
  const hasPhone = payload.phone || payload.from;
  const hasContent = payload.text || payload.body || payload.message || payload.msgContent;

  if (hasMsgId && hasPhone && (hasContent || payload.momment)) {
    if (payload.fromMe === true) return 'from_me';
    return null;
  }

  if (tipo.includes('receivedcallback')) {
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone && !payload.from) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD (BLINDADA E AUTOSSUFICIENTE)
// ============================================================================
// ATENÇÃO: NÃO IMPORTAR FUNÇÕES EXTERNAS AQUI DENTRO
// Esta função roda antes de tudo e não pode falhar.

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

    const telefone = payload.phone || payload.sender?.id || payload.chat?.id || '';
    const numeroLimpo = normalizarTelefone(telefone);

    if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

    const msgContent = payload.msgContent || {};
    let mediaType = 'none';
    let fileId = null;
    let originalMediaUrl = null;
    let conteudoRaw = payload.text?.message || payload.body || '';
    let conteudo = '';

    if (msgContent.imageMessage) {
      mediaType = 'image';
      conteudo = msgContent.imageMessage.caption || '📷 [Imagem]';
    } else if (msgContent.videoMessage) {
      mediaType = 'video';
      conteudo = msgContent.videoMessage.caption || '🎥 [Vídeo]';
    } else if (msgContent.audioMessage) {
      mediaType = 'audio';
      conteudo = msgContent.audioMessage.ptt ? '🎤 [Áudio de voz]' : '🎵 [Áudio]';
    } else if (msgContent.documentMessage) {
      mediaType = 'document';
      conteudo = msgContent.documentMessage.caption || msgContent.documentMessage.fileName || '[Documento]';
    } else if (msgContent.stickerMessage) {
      mediaType = 'sticker';
      conteudo = '[Sticker]';
    } else if (msgContent.contactMessage || msgContent.contactsArrayMessage) {
      mediaType = 'contact';
      conteudo = '📇 Contato';
    } else if (msgContent.locationMessage || msgContent.liveLocationMessage) {
      mediaType = 'location';
      conteudo = '📍 Localização';
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
      originalMediaUrl,
      fileId,
      mediaCaption: msgContent.imageMessage?.caption || msgContent.videoMessage?.caption,
      pushName: payload.pushName || payload.senderName || payload.sender?.pushName || payload.text?.senderName,
      vcard: msgContent.contactMessage || msgContent.contactsArrayMessage,
      location: msgContent.locationMessage || msgContent.liveLocationMessage,
      quotedMessage: payload.quotedMsg || msgContent.extendedTextMessage?.contextInfo?.quotedMessage
    };

  } catch (err) {
    // 🛡️ CATCH DE ÚLTIMA INSTÂNCIA DA NORMALIZAÇÃO
    console.error('🔴 [CRITICAL] Erro dentro de normalizarPayload:', err.message);

    // Retorna um objeto mínimo válido para não quebrar o webhook
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
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
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

async function handleConnection(dados, base44, payloadBruto) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      // Extrair número de telefone conectado do payload bruto
      const connectedPhone = payloadBruto.connectedPhone || 
                            payloadBruto.phone || 
                            payloadBruto.phoneNumber ||
                            payloadBruto.sender?.id?.replace(/@.*$/, '');
      
      const updateData = {
        status: dados.status,
        ultima_atividade: new Date().toISOString(),
        token_status: dados.status === 'conectado' ? 'valido' : 'nao_verificado'
      };
      
      // Se tiver número de telefone e estiver conectado, atualizar
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

// ============================================================================
// HANDLE MESSAGE - 100% INLINE (ZERO DEPENDÊNCIAS EXTERNAS)
// ============================================================================
async function handleMessage(dados, payloadBruto, base44) {
  console.log('[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[WAPI] INICIO handleMessage | De:', dados.from, '| Tipo:', dados.mediaType);

  const inicio = Date.now();

  // DEDUPLICAÇÃO RIGOROSA
  if (dados.messageId) {
    try {
      const dup = await base44.asServiceRole.entities.Message.filter(
        { whatsapp_message_id: dados.messageId }, '-created_date', 10
      );
      if (dup.length > 0) {
        console.log(`[WAPI] ⏭️ DUPLICATA: ${dados.messageId}`);
        return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
      }
    } catch (e) {}
  }

  // BUSCAR INTEGRAÇÃO - PRIORIZAR connectedPhone
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
          { numero_telefone: tel },
          '-created_date',
          1
        );
        if (int.length > 0) {
          integracaoId = int[0].id;
          integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
        }
      }
    } catch {}
  }

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
    } catch {}
  }

  console.log(`[WAPI] 🔗 Integração: ${integracaoId || 'não encontrada'} | Canal: ${integracaoInfo?.numero || connectedPhone || 'N/A'}`);

  // BUSCAR/CRIAR CONTATO - Múltiplas variações
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
        contatos = await base44.asServiceRole.entities.Contact.filter(
          { telefone: tel },
          '-created_date',
          1
        );
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
      console.log(`[WAPI] 👤 Contato existente: ${contato.nome}`);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: dados.pushName || dados.from,
        telefone: dados.from,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString(),
        foto_perfil_url: profilePicUrl
      });
      console.log(`[WAPI] 👤 Novo contato: ${contato.nome}`);
    }
  } catch (e) {
    console.error(`[WAPI] ❌ Erro contato:`, e?.message);
    return Response.json({ success: false, error: 'erro_contato' }, { status: 500, headers: corsHeaders });
  }

  // BUSCAR/CRIAR THREAD
  let thread;
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      { contact_id: contato.id },
      '-last_message_at',
      1
    );

    if (threads.length > 0) {
      thread = threads[0];
      console.log(`[WAPI] 💭 Thread existente: ${thread.id}`);
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
      console.log(`[WAPI] 💭 Nova thread: ${thread.id}`);
    }
  } catch (e) {
    console.error(`[WAPI] ❌ Erro thread:`, e?.message);
    return Response.json({ success: false, error: 'erro_thread' }, { status: 500, headers: corsHeaders });
  }
  
  // VERIFICAÇÃO DE DUPLICATA POR CONTEÚDO
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
      console.log(`[WAPI] ⏭️ DUPLICATA POR CONTEÚDO: ${duplicadaPorConteudo.id}`);
      return Response.json({ success: true, ignored: true, reason: 'duplicata_conteudo' }, { headers: corsHeaders });
    }
  } catch (err) {
    console.warn(`[WAPI] ⚠️ Erro ao verificar duplicata:`, err.message);
  }

  // SALVAR MENSAGEM
  let mensagem;
  try {
    mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: dados.content,
      media_url: dados.mediaType !== 'none' && dados.mediaType !== 'location' ? 'pending_download' : null,
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
        file_id: dados.fileId,
        original_media_url: dados.originalMediaUrl,
        processed_by: VERSION,
        provider: 'w_api'
      },
    });
    console.log(`[WAPI] ✅ Mensagem salva: ${mensagem.id}`);
  } catch (e) {
    console.error(`[WAPI] ❌ Erro salvar mensagem:`, e?.message);
    return Response.json({ success: false, error: 'erro_salvar_mensagem' }, { status: 500, headers: corsHeaders });
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
    };
    if (integracaoId && !thread.whatsapp_integration_id) {
      threadUpdate.whatsapp_integration_id = integracaoId;
    }
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    console.log(`[WAPI] 💭 Thread atualizada | Não lidas: ${threadUpdate.unread_count}`);
  } catch (updateError) {
    console.error(`[WAPI] ⚠️ Erro ao atualizar thread:`, updateError.message);
  }

  // TRIGGER PERSISTÊNCIA (Fire-and-Forget)
  if (dados.mediaType !== 'none' && dados.mediaType !== 'location' && dados.fileId) {
    console.log('[WAPI] 🚀 Disparando worker de mídia...');
    base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
      message_id: mensagem.id,
      file_id: dados.fileId,
      integration_id: integracaoId,
      media_type: dados.mediaType,
      filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
    }).catch(e => console.error('[WAPI] Erro trigger mídia:', e.message));
  }

  // DISPARAR CÉREBRO (Fire-and-Forget)
  try {
    console.log(`[WAPI] 🚀 Disparando processInbound (Cérebro separado)...`);
    
    let integracaoObj = null;
    if (integracaoId) {
      try {
        integracaoObj = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
      } catch (e) {
        console.warn('[WAPI] ⚠️ Integração não encontrada, enviando ID:', e.message);
        integracaoObj = { id: integracaoId };
      }
    }

    base44.asServiceRole.functions.invoke('processInbound', {
      message: mensagem,
      contact: contato,
      thread: thread,
      integration: integracaoObj,
      provider: 'w_api',
      messageContent: dados.content
    }).catch(e => console.error('[WAPI] ⚠️ Erro no processInbound:', e.message));
    
    console.log('[WAPI] ✅ Cérebro disparado (isolado)');
  } catch (err) {
    console.error('[WAPI] ⚠️ Erro ao disparar Cérebro:', err.message);
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
  } catch {}

  const duracao = Date.now() - inicio;
  console.log(`[WAPI] ✅ SUCESSO! Msg: ${mensagem.id} | De: ${dados.from} | ${duracao}ms`);

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    status: 'processed_inline'
  }, { headers: corsHeaders });
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  console.log('[WAPI-WEBHOOK] REQUEST RECEBIDO | Metodo:', req.method);
  
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

    console.log('[WAPI] 📥 Payload (1/2):', JSON.stringify(payload).substring(0, 1000));
    console.log('[WAPI] 📥 Payload (2/2):', JSON.stringify(payload).substring(1000, 2000));
  } catch (e) {
    return Response.json({ success: false, error: 'JSON invalido' }, { status: 200, headers: corsHeaders });
  }

  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    console.log('[WAPI] ⏭️ Ignorado:', motivoIgnorar);
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    console.log(`[WAPI] ⏭️ Unknown: ${dados.error}`);
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
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
        return Response.json({ success: true, ignored: true, reason: 'tipo_desconhecido' }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[WAPI] ❌ ERRO não tratado:', error?.message);
    return Response.json({ success: false, error: 'erro_interno' }, { status: 500, headers: corsHeaders });
  }
});