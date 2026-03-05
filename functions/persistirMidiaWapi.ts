import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// PERSISTIR MÍDIA W-API - v4.0.0
// ============================================================================
// CASCATA DE 3 CAMINHOS (ordem de prioridade):
//   A → url/link direta (Auto Download ativo)  → 1 GET, mais rápido
//   B → mediaId → GET /media/{id}              → 1 GET via ID
//   C → mediaKey+directPath → POST /download-media → chamada extra W-API
//
// Se toda a cascata falhar: marca media_url = 'failed_download' e retorna HTTP 200
// ============================================================================

const VERSION = 'v4.0.0-CASCADE';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ready', cascade: ['url', 'mediaId', 'mediaKey+directPath'] }, { headers });
  }

  console.log('[PERSISTIR-MIDIA-WAPI] 🚀 v4.0.0 | Método:', req.method);

  try {
    const base44 = createClientFromRequest(req.clone ? req.clone() : req);
    const bodyRaw = await req.json();
    const payload = bodyRaw?.payload ?? bodyRaw;

    const { message_id, integration_id, downloadSpec, media_type, filename } = payload;

    // Fast-fail: downloadSpec vazio não deve ter chegado aqui
    if (!message_id || !integration_id || !downloadSpec) {
      return Response.json({ success: false, error: 'message_id, integration_id e downloadSpec são obrigatórios' }, { status: 400, headers });
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📦 downloadSpec recebido:', {
      type: downloadSpec.type,
      hasUrl: !!(downloadSpec.url),
      hasMediaId: !!(downloadSpec.mediaId),
      hasKeyPath: !!(downloadSpec.mediaKey && downloadSpec.directPath),
      mimetype: downloadSpec.mimetype
    });

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    const token = integracao.api_key_provider;
    const baseUrl = (integracao.base_url_provider || 'https://api.w-api.app/v1').replace(/\/$/, '');

    console.log('[PERSISTIR-MIDIA-WAPI] 🔧 baseUrl:', baseUrl, '| instanceId:', integracao.instance_id_provider);

    // ═══════════════════════════════════════════════════════════════════
    // CASCATA: obter fileLink via W-API (conforme manual oficial)
    // IMPORTANTE: a URL do WhatsApp (mmg.whatsapp.net/*.enc) é criptografada
    // e NÃO pode ser baixada diretamente — deve passar pela W-API
    // ═══════════════════════════════════════════════════════════════════
    let mediaUrl = null;
    let caminhoUsado = null;
    const instanceId = integracao.instance_id_provider;

    // ═══════════════════════════════════════════════════════════════════
    // CASCATA W-API: 3 endpoints possíveis para obter URL de download
    // ═══════════════════════════════════════════════════════════════════

    // CAMINHO A: POST /message/download-media com mediaKey + directPath
    if (downloadSpec.mediaKey && downloadSpec.directPath) {
      try {
        const endpointA = `${baseUrl}/message/download-media?instanceId=${instanceId}`;
        const bodyA = {
          mediaKey: downloadSpec.mediaKey,
          directPath: downloadSpec.directPath,
          type: downloadSpec.type,
          mimetype: downloadSpec.mimetype
        };
        console.log('[PERSISTIR-MIDIA-WAPI] 🔄 Caminho A:', endpointA);
        console.log('[PERSISTIR-MIDIA-WAPI] 🔄 Body A:', JSON.stringify(bodyA));
        const resp = await fetch(endpointA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(bodyA)
        });
        const respText = await resp.text();
        console.log(`[PERSISTIR-MIDIA-WAPI] Caminho A status: ${resp.status} | body: ${respText.substring(0, 300)}`);
        if (resp.ok) {
          let data;
          try { data = JSON.parse(respText); } catch(_) { data = {}; }
          mediaUrl = data.fileLink || data.link || data.url || data.mediaUrl || null;
          if (mediaUrl) {
            caminhoUsado = 'A_mediaKey_directPath';
            console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho A: link obtido');
          } else {
            console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho A: resposta OK mas sem link. Keys:', Object.keys(data).join(','));
          }
        }
      } catch (e) {
        console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho A erro:', e.message);
      }
    }

    // CAMINHO B: GET /media/{messageId} - alguns provedores W-API usam esse endpoint
    if (!mediaUrl && downloadSpec.mediaId) {
      try {
        const endpointB = `${baseUrl}/media/${downloadSpec.mediaId}?instanceId=${instanceId}`;
        console.log('[PERSISTIR-MIDIA-WAPI] 🔄 Caminho B:', endpointB);
        const resp = await fetch(endpointB, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const respText = await resp.text();
        console.log(`[PERSISTIR-MIDIA-WAPI] Caminho B status: ${resp.status} | body: ${respText.substring(0, 200)}`);
        if (resp.ok) {
          let data;
          try { data = JSON.parse(respText); } catch(_) { data = {}; }
          mediaUrl = data.link || data.url || data.fileLink || data.mediaUrl || null;
          if (mediaUrl) {
            caminhoUsado = 'B_mediaId';
            console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho B: link obtido');
          }
        }
      } catch (e) {
        console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho B erro:', e.message);
      }
    }

    // CAMINHO C: URL direta — só aceita se NÃO for mmg.whatsapp.net (são .enc criptografados)
    if (!mediaUrl && downloadSpec.url && !downloadSpec.url.includes('whatsapp.net') && !downloadSpec.url.includes('.enc')) {
      mediaUrl = downloadSpec.url;
      caminhoUsado = 'C_url_direta';
      console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho C: URL direta (não-WhatsApp)');
    }

    // Cascata esgotada sem URL
    if (!mediaUrl) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Cascata esgotada sem URL. Marcando failed_download.');
      await base44.asServiceRole.entities.Message.update(message_id, {
        media_url: 'failed_download'
      });
      return Response.json({
        success: false,
        error: 'Cascata esgotada: sem url, mediaId nem mediaKey/directPath válidos',
        message_id,
        marked_as: 'failed_download'
      }, { status: 200, headers }); // 200 para evitar retry loop
    }

    console.log(`[PERSISTIR-MIDIA-WAPI] 📥 Baixando via ${caminhoUsado}: ${mediaUrl.substring(0, 80)}`);

    // Download em memória
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let blob;
    let contentType = downloadSpec.mimetype || 'application/octet-stream';

    try {
      const mediaResponse = await fetch(mediaUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VendaPro-MediaDownloader/4.0' }
      });
      clearTimeout(timeoutId);

      if (!mediaResponse.ok) {
        throw new Error(`HTTP ${mediaResponse.status} ao baixar mídia`);
      }

      contentType = mediaResponse.headers.get('content-type') || contentType;
      const arrayBuffer = await mediaResponse.arrayBuffer();
      blob = new Blob([arrayBuffer], { type: contentType });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const errMsg = fetchError.name === 'AbortError' ? 'Timeout de 60s ao baixar mídia' : fetchError.message;
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Falha no download:', errMsg);
      await base44.asServiceRole.entities.Message.update(message_id, { media_url: 'failed_download' });
      return Response.json({ success: false, error: errMsg, marked_as: 'failed_download' }, { status: 200, headers });
    }

    // Validação de tamanho
    if (blob.size > 50 * 1024 * 1024) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Arquivo muito grande:', blob.size);
      await base44.asServiceRole.entities.Message.update(message_id, { media_url: 'failed_download' });
      return Response.json({ success: false, error: 'Arquivo excede 50MB', marked_as: 'failed_download' }, { status: 200, headers });
    }

    // Extensão
    const extensaoMap = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/3gpp': '3gp',
      'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };
    const mediaTypeMap = { 'image': 'jpg', 'video': 'mp4', 'audio': 'ogg', 'document': 'pdf', 'sticker': 'webp' };

    let extensao = 'bin';
    if (filename?.includes('.')) {
      extensao = filename.split('.').pop().toLowerCase();
    } else if (extensaoMap[contentType]) {
      extensao = extensaoMap[contentType];
    } else if (downloadSpec.type) {
      extensao = mediaTypeMap[downloadSpec.type] || 'bin';
    }

    const timestamp = Date.now();
    const baseF = (filename?.replace(/\.[^.]+$/, '') || downloadSpec.type || 'media').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 40);
    const nomeArquivo = `wapi_${message_id.substring(0, 8)}_${timestamp}_${baseF}.${extensao}`;

    // Upload via service role (função invocada sem sessão de usuário)
    const file = new File([blob], nomeArquivo, { type: contentType });
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (!uploadResult?.file_url) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Upload falhou sem URL');
      await base44.asServiceRole.entities.Message.update(message_id, { media_url: 'failed_download' });
      return Response.json({ success: false, error: 'Upload falhou', marked_as: 'failed_download' }, { status: 200, headers });
    }

    console.log('[PERSISTIR-MIDIA-WAPI] ✅ Upload concluído:', uploadResult.file_url);

    // Buscar metadata atual para preservar
    let mensagemAtual;
    try { mensagemAtual = await base44.asServiceRole.entities.Message.get(message_id); } catch (_) {}

    await base44.asServiceRole.entities.Message.update(message_id, {
      media_url: uploadResult.file_url,
      metadata: {
        ...(mensagemAtual?.metadata || {}),
        midia_persistida: true,
        caminho_usado: caminhoUsado,
        url_original: mediaUrl,
        persistida_em: new Date().toISOString(),
        tamanho_bytes: blob.size,
        mimetype_detectado: contentType
      }
    });

    console.log(`[PERSISTIR-MIDIA-WAPI] ✅ Mensagem atualizada | Caminho: ${caminhoUsado} | Size: ${blob.size}`);

    return Response.json({
      success: true,
      message_id,
      permanent_url: uploadResult.file_url,
      caminho_usado: caminhoUsado,
      file_size: blob.size,
      version: VERSION
    }, { headers });

  } catch (error) {
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ ERRO GERAL:', error.message);

    // Tentar marcar failed_download mesmo no catch geral
    try {
      const bodyRaw2 = null; // já consumido, usar payload do closure se disponível
    } catch (_) {}

    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 200, headers }); // 200 para evitar retry loop
  }
});