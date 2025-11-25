import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - VERSÃO SIMPLIFICADA v5.0.0
// ============================================================================
// PRINCÍPIO: Filtrar CEDO, logar APENAS o necessário, processar APENAS mensagens reais
// ============================================================================

const VERSION = 'v5.0.0';
const BUILD_DATE = '2025-01-25';

console.log('=== WEBHOOK Z-API ' + VERSION + ' INICIADO ===');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// FILTRO ULTRA-RÁPIDO: Decide em microsegundos se o evento é relevante
// ============================================================================
function deveIgnorar(evento) {
  if (!evento || typeof evento !== 'object') return { ignorar: true, motivo: 'payload_invalido' };

  const tipo = String(evento.event || evento.type || '').toLowerCase();
  const telefone = evento.phone || evento.telefone || '';
  const conteudo = evento.text?.message || evento.body || '';

  // 1. IGNORAR: Eventos de sistema (presença, typing, ACK, status)
  if (tipo.includes('presence') || tipo.includes('typing') || tipo.includes('composing') ||
      tipo.includes('ack') || tipo.includes('delivery') || tipo.includes('seen') ||
      tipo.includes('chat-update') || tipo.includes('call') ||
      (tipo.includes('status') && !tipo.includes('messagestatus'))) {
    return { ignorar: true, motivo: 'evento_sistema' };
  }

  // 2. IGNORAR: MessageStatusCallback (tem ids[] + status)
  if ((evento.ids && Array.isArray(evento.ids)) || tipo.includes('statuscallback')) {
    return { ignorar: true, motivo: 'status_callback' };
  }

  // 3. IGNORAR: JIDs de sistema (@lid, @broadcast, @g.us, status@broadcast)
  if (telefone.includes('@lid') || telefone.includes('@broadcast') || 
      telefone.includes('@g.us') || telefone.includes('status@')) {
    return { ignorar: true, motivo: 'jid_sistema' };
  }

  // 4. IGNORAR: Conteúdo lixo (confirmações, JIDs no texto)
  const lixo = [
    /^[\+\d]+@(lid|broadcast|s\.whatsapp\.net|c\.us)$/i,
    /^mídia enviada$/i, /^media enviada$/i, /^media sent$/i,
    /^mensagem enviada$/i, /^message sent$/i,
    /^imagem enviada$/i, /^vídeo enviado$/i, /^áudio enviado$/i,
    /^documento enviado$/i, /^arquivo enviado$/i,
    /^\s*adicionar\s*$/i, /^[\+\d\s@\.\-\(\)]+$/i,
    /status@broadcast/i
  ];
  if (conteudo && lixo.some(p => p.test(conteudo.trim()))) {
    return { ignorar: true, motivo: 'conteudo_lixo' };
  }

  // 5. IGNORAR: Sem telefone válido E sem mídia
  const temMidia = evento.image || evento.video || evento.audio || evento.document || evento.sticker;
  if (!telefone && !temMidia) {
    return { ignorar: true, motivo: 'sem_telefone_sem_midia' };
  }

  return { ignorar: false };
}

// ============================================================================
// EXTRAIR DADOS DA MENSAGEM (só chamado se passar no filtro)
// ============================================================================
function extrairMensagem(evento) {
  const telefone = evento.phone || evento.telefone || '';
  const numeroLimpo = normalizarTelefone(telefone);
  
  if (!numeroLimpo) return null;

  // Detectar mídia
  let mediaType = 'none';
  let mediaUrl = null;
  let conteudo = evento.text?.message || evento.body || '';

  if (evento.image) {
    mediaType = 'image';
    mediaUrl = evento.image.imageUrl || evento.image.url || evento.image.link;
  } else if (evento.video) {
    mediaType = 'video';
    mediaUrl = evento.video.videoUrl || evento.video.url || evento.video.link;
  } else if (evento.audio) {
    mediaType = 'audio';
    mediaUrl = evento.audio.audioUrl || evento.audio.url || evento.audio.link;
  } else if (evento.document || evento.documentMessage) {
    mediaType = 'document';
    const doc = evento.document || evento.documentMessage;
    mediaUrl = doc.documentUrl || doc.url || doc.link;
    conteudo = conteudo || `[Documento: ${doc.fileName || 'Arquivo'}]`;
  } else if (evento.sticker) {
    mediaType = 'sticker';
    mediaUrl = evento.sticker.stickerUrl || evento.sticker.url;
    conteudo = '[Sticker]';
  } else if (evento.contactMessage || evento.vcard) {
    mediaType = 'contact';
    const c = evento.contactMessage || evento.vcard;
    conteudo = `[Contato: ${c.displayName || c.name || 'Sem nome'}]`;
  } else if (evento.location || evento.locationMessage) {
    mediaType = 'location';
    conteudo = '[Localização compartilhada]';
  }

  // Validar: precisa ter conteúdo OU mídia
  if (!conteudo && mediaType === 'none') return null;

  return {
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    mediaCaption: evento.image?.caption || evento.video?.caption || null,
    messageId: evento.messageId,
    pushName: evento.senderName || evento.chatName || null,
    isFromMe: evento.fromMe || false,
    timestamp: evento.momment || evento.timestamp || Date.now(),
    instanceId: evento.instance || evento.instanceId || evento.instance_id || 'unknown'
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
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  // Parsear payload
  let evento;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true, reason: 'empty' }, { headers: corsHeaders });
    evento = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 200, headers: corsHeaders });
  }

  // ========== FILTRO RÁPIDO: Decidir ANTES de qualquer operação de banco ==========
  const filtro = deveIgnorar(evento);
  if (filtro.ignorar) {
    console.log('[' + VERSION + '] IGNORADO:', filtro.motivo);
    return Response.json({ success: true, ignored: true, reason: filtro.motivo, version: VERSION }, { headers: corsHeaders });
  }

  // ========== EXTRAIR MENSAGEM ==========
  const msg = extrairMensagem(evento);
  if (!msg) {
    console.log('[' + VERSION + '] Mensagem inválida após extração');
    return Response.json({ success: true, ignored: true, reason: 'extracao_falhou', version: VERSION }, { headers: corsHeaders });
  }

  console.log('[' + VERSION + '] Processando mensagem de:', msg.from, '| Mídia:', msg.mediaType);

  // ========== CRIAR LOG DE AUDITORIA (só para mensagens válidas) ==========
  let auditId = null;
  try {
    const audit = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: evento,
      instance_identificado: msg.instanceId,
      evento: 'message',
      timestamp_recebido: new Date().toISOString(),
      sucesso_processamento: false
    });
    auditId = audit.id;
  } catch (e) {
    console.warn('[' + VERSION + '] Erro ao criar audit log:', e.message);
  }

  try {
    // ========== BUSCAR/CRIAR CONTATO ==========
    const [contatos, integracoes] = await Promise.all([
      base44.asServiceRole.entities.Contact.list('-created_date', 1, { telefone: msg.from }),
      msg.instanceId !== 'unknown' 
        ? base44.asServiceRole.entities.WhatsAppIntegration.list('-created_date', 1, { instance_id_provider: msg.instanceId })
        : Promise.resolve([])
    ]);

    const integracaoId = integracoes.length > 0 ? integracoes[0].id : null;
    let contato;

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
    const threads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 1, { contact_id: contato.id });
    let thread;

    if (threads.length > 0) {
      thread = threads[0];
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: (msg.content || '').substring(0, 100),
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta',
        ...(integracaoId && !thread.whatsapp_integration_id ? { whatsapp_integration_id: integracaoId } : {})
      });
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

    // ========== VERIFICAR DUPLICATA ==========
    if (msg.messageId) {
      const duplicatas = await base44.asServiceRole.entities.Message.list('-created_date', 1, { whatsapp_message_id: msg.messageId });
      if (duplicatas.length > 0) {
        console.log('[' + VERSION + '] Mensagem duplicada ignorada');
        return Response.json({ success: true, ignored: true, reason: 'duplicata', version: VERSION }, { headers: corsHeaders });
      }
    }

    // ========== SALVAR MENSAGEM ==========
    const mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: msg.content || `[${msg.mediaType}]`,
      media_url: msg.mediaUrl || null,
      media_type: msg.mediaType,
      media_caption: msg.mediaCaption,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: msg.messageId,
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integracaoId,
        is_from_me: msg.isFromMe,
        timestamp: msg.timestamp
      }
    });

    // Atualizar audit log
    if (auditId) {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditId, { sucesso_processamento: true });
    }

    const duracao = Date.now() - inicio;
    console.log('[' + VERSION + '] ✅ Mensagem salva em ' + duracao + 'ms | ID:', mensagem.id);

    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      duration_ms: duracao,
      version: VERSION
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[' + VERSION + '] ERRO:', error.message);
    
    if (auditId) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditId, { 
          sucesso_processamento: false, 
          erro_detalhes: error.message 
        });
      } catch (e) {}
    }

    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers: corsHeaders });
  }
});