import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// ============================================================================
// PERSISTIR MÍDIA W-API - v8.0.0-BASE44-UPLOAD
// ============================================================================
// v8: Remove dependência do Supabase. Usa base44.asServiceRole.integrations.Core.UploadFile
//     igual ao padrão da função legada que funcionava. createClientFromRequest(req) + SDK 0.7.1.
// ============================================================================

const VERSION = 'v8.0.0-BASE44-UPLOAD';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ready' }, { headers });
  }

  console.log('[PERSISTIR-MIDIA-WAPI] 🚀', VERSION, '| Método:', req.method);

  // Ler body ANTES de criar cliente (evita consumo duplo do stream)
  let bodyText;
  try {
    bodyText = await req.text();
    console.log('[PERSISTIR-MIDIA-WAPI] 📨 Body recebido (primeiros 200):', bodyText.substring(0, 200));
  } catch (e) {
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ Erro ao ler body:', e.message);
    return Response.json({ success: false, error: 'Erro ao ler body: ' + e.message }, { status: 400, headers });
  }

  let payload;
  try {
    const bodyRaw = JSON.parse(bodyText);
    payload = bodyRaw?.payload ?? bodyRaw;
  } catch (e) {
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ JSON inválido:', e.message);
    return Response.json({ success: false, error: 'JSON inválido: ' + e.message }, { status: 400, headers });
  }

  // Extrair message_id fora do try para o catch conseguir marcar failed_download
  let message_id_global = null;

  try {
    // ✅ Igual à Z-API: createClientFromRequest funciona pois o req da invocação
    // carrega o token do app no header — asServiceRole funciona neste contexto.
    const base44 = createClientFromRequest(req);
    console.log('[PERSISTIR-MIDIA-WAPI] ✅ Cliente criado via createClientFromRequest');

    const { message_id, integration_id, downloadSpec, media_type, filename } = payload;
    message_id_global = message_id; // expor para o catch geral

    console.log('[PERSISTIR-MIDIA-WAPI] 📦 Parâmetros:', { message_id, integration_id, media_type, filename });

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

    // ✅ LOG DIAGNÓSTICO: confirmar que pegou a integração W-API correta
    console.log('[PERSISTIR-MIDIA-WAPI] 🔍 INTEGRAÇÃO ENCONTRADA:', {
      integration_id,
      nome: integracao.nome_instancia,
      api_provider: integracao.api_provider,
      base_url_provider: integracao.base_url_provider,
      instance_id_provider: integracao.instance_id_provider,
      numero_telefone: integracao.numero_telefone
    });

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

    // ═══════════════════════════════════════════════════════════════════
    // CASCATA W-API (baseada na documentação oficial v1):
    //   A → GET /message/download-url/{messageId}  (endpoint oficial W-API)
    //   B → POST /message/download-media            (fallback)
    //   C → URL direta (se não for whatsapp.net criptografado)
    // ═══════════════════════════════════════════════════════════════════

    // CAMINHO A: GET /message/download-url/{messageId} — endpoint oficial W-API
    if (!mediaUrl && downloadSpec.mediaId) {
      try {
        const endpointA = `${baseUrl}/message/download-url/${downloadSpec.mediaId}?instanceId=${instanceId}`;
        console.log('[PERSISTIR-MIDIA-WAPI] 🔄 Caminho A (download-url):', endpointA);
        const resp = await fetch(endpointA, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const respText = await resp.text();
        console.log(`[PERSISTIR-MIDIA-WAPI] Caminho A status: ${resp.status} | body: ${respText.substring(0, 300)}`);
        if (resp.ok) {
          let data;
          try { data = JSON.parse(respText); } catch(_) { data = {}; }
          mediaUrl = data.fileLink || data.link || data.url || data.downloadUrl || data.mediaUrl || null;
          if (mediaUrl) {
            caminhoUsado = 'A_download_url';
            console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho A: link obtido');
          } else {
            console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho A: resposta OK mas sem link. Keys:', Object.keys(data).join(','));
          }
        }
      } catch (e) {
        console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho A erro:', e.message);
      }
    }

    // CAMINHO B: POST /message/download-media com mediaKey + directPath
    if (!mediaUrl && downloadSpec.mediaKey && downloadSpec.directPath) {
      try {
        const endpointB = `${baseUrl}/message/download-media?instanceId=${instanceId}`;
        const bodyB = {
          mediaKey: downloadSpec.mediaKey,
          directPath: downloadSpec.directPath,
          type: downloadSpec.type,
          mimetype: downloadSpec.mimetype
        };
        console.log('[PERSISTIR-MIDIA-WAPI] 🔄 Caminho B (download-media):', endpointB);
        const resp = await fetch(endpointB, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(bodyB)
        });
        const respText = await resp.text();
        console.log(`[PERSISTIR-MIDIA-WAPI] Caminho B status: ${resp.status} | body: ${respText.substring(0, 300)}`);
        if (resp.ok) {
          let data;
          try { data = JSON.parse(respText); } catch(_) { data = {}; }
          mediaUrl = data.fileLink || data.link || data.url || data.mediaUrl || null;
          if (mediaUrl) {
            caminhoUsado = 'B_mediaKey_directPath';
            console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho B: link obtido');
          } else {
            console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Caminho B: sem link. Keys:', Object.keys(data).join(','));
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

    // ✅ UPLOAD PARA BASE44 (URLs W-API expiram em 24h)
     // Converter blob para File para upload via SDK
     const file = new File([blob], nomeArquivo, { type: contentType });
     console.log('[PERSISTIR-MIDIA-WAPI] 📤 Fazendo upload para Base44...');

     let permanentUrl;
     try {
       const uploadResult = await base44.integrations.Core.UploadFile({ file });
       permanentUrl = uploadResult.file_url;
       console.log('[PERSISTIR-MIDIA-WAPI] ✅ Upload para Base44 concluído:', permanentUrl);
     } catch (uploadErr) {
       console.error('[PERSISTIR-MIDIA-WAPI] ❌ Erro no upload para Base44:', uploadErr.message);
       console.log('[PERSISTIR-MIDIA-WAPI] ⚠️ Fallback: usando URL W-API (com aviso de TTL)');
       permanentUrl = mediaUrl + '#ttl-24h'; // Marcar que pode expirar
     }

     // Buscar metadata atual para preservar
     let mensagemAtual;
     try { mensagemAtual = await base44.asServiceRole.entities.Message.get(message_id); } catch (_) {}

     await base44.asServiceRole.entities.Message.update(message_id, {
       media_url: permanentUrl,
       metadata: {
         ...(mensagemAtual?.metadata || {}),
         midia_persistida: true,
         caminho_usado: caminhoUsado,
         url_original: mediaUrl,
         persistida_em: new Date().toISOString(),
         tamanho_bytes: blob.size,
         mimetype_detectado: contentType,
         url_provider: 'base44' // ✅ Novo: indica que a URL é permanente
       }
     });

     // ✅ LOG FINAL: confirmar URL salva
     console.log(`[PERSISTIR-MIDIA-WAPI] ✅ Mensagem atualizada | Caminho: ${caminhoUsado} | Storage: Base44 | Size: ${blob.size}`);
     console.log(`[PERSISTIR-MIDIA-WAPI] 🔗 URL PERMANENTE SALVA: ${permanentUrl}`);

     return Response.json({
       success: true,
       message_id,
       permanent_url: permanentUrl,
       caminho_usado: caminhoUsado,
       file_size: blob.size,
       stored_at: 'base44',
       version: VERSION
     }, { headers });

  } catch (error) {
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ ERRO GERAL:', error.message);

    // Marcar failed_download se temos o message_id disponível
    if (message_id_global) {
      try {
        const base44Catch = createClientFromRequest(req);
        await base44Catch.asServiceRole.entities.Message.update(message_id_global, { media_url: 'failed_download' });
        console.log('[PERSISTIR-MIDIA-WAPI] ✅ failed_download marcado no catch geral');
      } catch (catchErr) {
        console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Não conseguiu marcar failed_download:', catchErr.message);
      }
    }

    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 200, headers }); // 200 para evitar retry loop
  }
});