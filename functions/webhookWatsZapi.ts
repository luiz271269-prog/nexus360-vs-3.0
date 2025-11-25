import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - VERSÃO UNIFICADA v6.0.0
// ============================================================================
// PRINCÍPIO: Filtrar CEDO, criar audit APENAS para mensagens reais,
// gravar whatsapp_integration_id corretamente no metadata
// ============================================================================

const VERSION = 'v6.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna true se deve IGNORAR o evento
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type || payload.event || '').toLowerCase();

  // 1. IGNORAR: Eventos que NÃO são mensagens recebidas
  const eventosIgnorados = [
    'presencechatcallback', 'presence', 'typing', 'composing',
    'messagestatuscallback', 'ack', 'delivery', 'seen', 'read',
    'chat-update', 'call', 'status'
  ];
  
  if (eventosIgnorados.some(e => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // 2. IGNORAR: MessageStatusCallback (tem array ids[])
  if (payload.ids && Array.isArray(payload.ids)) {
    return 'status_callback';
  }

  // 3. IGNORAR: Somente ReceivedCallback é mensagem real
  if (tipo !== 'receivedcallback') {
    return 'evento_nao_mensagem';
  }

  // 4. IGNORAR: Mensagens de grupo
  if (payload.isGroup === true) {
    return 'grupo';
  }

  // 5. IGNORAR: Mensagens enviadas por mim (fromMe)
  if (payload.fromMe === true) {
    return 'from_me';
  }

  // 6. IGNORAR: JIDs de sistema
  const telefone = payload.phone || '';
  if (telefone.includes('@lid') || telefone.includes('@broadcast') || 
      telefone.includes('@g.us') || telefone.includes('status@')) {
    return 'jid_sistema';
  }

  // 7. IGNORAR: Sem telefone válido
  if (!telefone) {
    return 'sem_telefone';
  }

  return null; // Não ignorar - processar!
}

// ============================================================================
// EXTRAIR DADOS DA MENSAGEM
// ============================================================================
function extrairMensagem(payload) {
  const telefone = payload.phone || '';
  const numeroLimpo = normalizarTelefone(telefone);
  
  if (!numeroLimpo) return null;

  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = payload.text?.message || '';

  // Detectar mídia
  if (payload.image) {
    mediaType = 'image';
    mediaUrl = payload.image.imageUrl || payload.image.url || payload.image.link;
    conteudo = conteudo || payload.image.caption || '[Imagem]';
  } else if (payload.video) {
    mediaType = 'video';
    mediaUrl = payload.video.videoUrl || payload.video.url || payload.video.link;
    conteudo = conteudo || payload.video.caption || '[Vídeo]';
  } else if (payload.audio) {
    mediaType = 'audio';
    mediaUrl = payload.audio.audioUrl || payload.audio.url || payload.audio.link;
    conteudo = '[Áudio]';
  } else if (payload.document || payload.documentMessage) {
    mediaType = 'document';
    const doc = payload.document || payload.documentMessage;
    mediaUrl = doc.documentUrl || doc.url || doc.link;
    conteudo = conteudo || `[Documento: ${doc.fileName || 'Arquivo'}]`;
  } else if (payload.sticker) {
    mediaType = 'sticker';
    mediaUrl = payload.sticker.stickerUrl || payload.sticker.url;
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    const c = payload.contactMessage || payload.vcard;
    conteudo = `[Contato: ${c.displayName || c.name || 'Sem nome'}]`;
  } else if (payload.location || payload.locationMessage) {
    mediaType = 'location';
    conteudo = '[Localização]';
  }

  // Precisa ter conteúdo OU mídia
  if (!conteudo && mediaType === 'none') return null;

  return {
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    mediaCaption: payload.image?.caption || payload.video?.caption || null,
    messageId: payload.messageId || null,
    pushName: payload.senderName || payload.chatName || null,
    // IMPORTANTE: Z-API envia como "instanceId" (não instance ou instance_id)
    instanceId: payload.instanceId || payload.instance || payload.instance_id || null,
    timestamp: payload.momment || payload.timestamp || Date.now()
  };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  const inicio = Date.now();

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error', version: VERSION }, { status: 500, headers: corsHeaders });
  }

  // Parsear payload
  let payload;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true, reason: 'empty', version: VERSION }, { headers: corsHeaders });
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido', version: VERSION }, { status: 200, headers: corsHeaders });
  }

  // ========== FILTRO RÁPIDO - ANTES de qualquer operação de banco ==========
  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    // NÃO criar audit log para eventos ignorados - economia de banco!
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar, version: VERSION }, { headers: corsHeaders });
  }

  // ========== EXTRAIR MENSAGEM ==========
  const msg = extrairMensagem(payload);
  if (!msg) {
    return Response.json({ success: true, ignored: true, reason: 'extracao_falhou', version: VERSION }, { headers: corsHeaders });
  }

  // ========== VERIFICAR DUPLICATA ANTES de criar qualquer coisa ==========
  if (msg.messageId) {
    try {
      const duplicatas = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: msg.messageId }, '-created_date', 1);
      if (duplicatas.length > 0) {
        return Response.json({ success: true, ignored: true, reason: 'duplicata', version: VERSION }, { headers: corsHeaders });
      }
    } catch (e) {
      // Continuar mesmo se falhar a verificação
    }
  }

  console.log('[' + VERSION + '] Processando:', msg.from, '| Mídia:', msg.mediaType, '| Instance:', msg.instanceId);

  try {
    // ========== BUSCAR INTEGRAÇÃO PELO instanceId ==========
    let integracaoId = null;
    if (msg.instanceId) {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: msg.instanceId }, 
        '-created_date', 
        1
      );
      if (integracoes.length > 0) {
        integracaoId = integracoes[0].id;
        console.log('[' + VERSION + '] Integração encontrada:', integracaoId);
      } else {
        console.warn('[' + VERSION + '] Integração NÃO encontrada para instanceId:', msg.instanceId);
      }
    }

    // ========== BUSCAR/CRIAR CONTATO ==========
    let contato;
    const contatos = await base44.asServiceRole.entities.Contact.filter({ telefone: msg.from }, '-created_date', 1);

    if (contatos.length > 0) {
      contato = contatos[0];
      const atualizacao = { ultima_interacao: new Date().toISOString() };
      
      // Atualizar nome se for genérico
      const nomeAtual = contato.nome?.trim() || '';
      const nomeGenerico = !nomeAtual || nomeAtual === msg.from || /^[\+\d\s\-\(\)]+$/.test(nomeAtual);
      if (msg.pushName && nomeGenerico) {
        atualizacao.nome = msg.pushName;
      }
      
      await base44.asServiceRole.entities.Contact.update(contato.id, atualizacao);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: msg.pushName || msg.from,
        telefone: msg.from,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString()
      });
    }

    // ========== BUSCAR/CRIAR THREAD ==========
    let thread;
    const threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id }, '-last_message_at', 1);

    if (threads.length > 0) {
      thread = threads[0];
      const threadUpdate = {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: (msg.content || '').substring(0, 100),
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta'
      };
      
      // Atualizar integração da thread se não tiver
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
        last_message_content: (msg.content || '').substring(0, 100),
        total_mensagens: 1,
        unread_count: 1
      });
    }

    // ========== SALVAR MENSAGEM COM whatsapp_integration_id NO METADATA ==========
    const mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: msg.content,
      media_url: msg.mediaUrl || null,
      media_type: msg.mediaType,
      media_caption: msg.mediaCaption,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: msg.messageId,
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integracaoId,
        instance_id: msg.instanceId,
        timestamp: msg.timestamp,
        processed_by: VERSION
      }
    });

    // ========== CRIAR AUDIT LOG APENAS PARA MENSAGENS SALVAS COM SUCESSO ==========
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: msg.instanceId,
        integration_id: integracaoId,
        evento: 'ReceivedCallback',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: true
      });
    } catch (e) {
      // Não falhar por causa do audit log
    }

    const duracao = Date.now() - inicio;
    console.log('[' + VERSION + '] ✅ Salvo em ' + duracao + 'ms | Msg:', mensagem.id, '| Integration:', integracaoId);

    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      version: VERSION
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[' + VERSION + '] ERRO:', error.message);

    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers: corsHeaders });
  }
});