import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// PERSISTIR MÍDIA W-API - v2.0.0 CORREÇÃO DEFINITIVA
// ============================================================================
// FLUXO DETERMINÍSTICO (conforme manual W-API):
// 1. Recebe message_id + integration_id + downloadSpec
// 2. Chama /message/download-media com mediaKey + directPath + type + mimetype
// 3. Recebe fileLink da W-API
// 4. Faz fetch(fileLink) → arrayBuffer (100% em memória, ZERO filesystem)
// 5. Faz upload direto pro storage Base44 (File/Blob)
// 6. Atualiza Message.media_url com URL permanente
// ============================================================================

const VERSION = 'v2.0.0-DETERMINISTIC';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      version: VERSION, 
      status: 'ready',
      description: 'Baixa e persiste mídias da W-API (100% em memória, zero filesystem)'
    }, { headers });
  }

  console.log('[PERSISTIR-MIDIA-WAPI] 🚀 FUNÇÃO CHAMADA | Método:', req.method);

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    console.log('[PERSISTIR-MIDIA-WAPI] 📦 Payload recebido:', {
      message_id: payload.message_id,
      integration_id: payload.integration_id,
      has_downloadSpec: !!payload.downloadSpec
    });

    const { message_id, integration_id, downloadSpec, filename } = payload;

    // ✅ VALIDAÇÃO ENTRADA
    if (!message_id || !integration_id || !downloadSpec) {
      return Response.json({ 
        success: false, 
        error: 'message_id, integration_id e downloadSpec são obrigatórios' 
      }, { status: 400, headers });
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 🚀 INICIANDO | downloadSpec:', {
      type: downloadSpec.type,
      hasMediaKey: !!downloadSpec.mediaKey,
      hasDirectPath: !!downloadSpec.directPath,
      mimetype: downloadSpec.mimetype
    });

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    // ✅ VALIDAÇÃO CAMPOS OBRIGATÓRIOS (manual W-API)
    const mediaKey = downloadSpec.mediaKey;
    const directPath = downloadSpec.directPath;
    const mimeType = downloadSpec.mimetype;
    const mediaType = downloadSpec.type;

    if (!mediaKey || !directPath) {
      throw new Error('mediaKey ou directPath ausentes no downloadSpec');
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📞 Chamando W-API download-media | mediaKey:', mediaKey?.substring(0, 20), '| directPath:', directPath?.substring(0, 30));
    
    // ✅ RETRY LOGIC (evitar rate limit)
    let downloadResp;
    let lastError;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[PERSISTIR-MIDIA-WAPI] 🔄 Tentativa ${attempt + 1}/${MAX_RETRIES + 1}`);
          await sleep(RETRY_DELAY * attempt);
        }
        
        // ✅ CHAMADA OFICIAL W-API (conforme manual)
        downloadResp = await fetch(
          `${WAPI_BASE_URL}/message/download-media?instanceId=${integracao.instance_id_provider}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${integracao.api_key_provider}`
            },
            body: JSON.stringify({
              mediaKey: mediaKey,
              directPath: directPath,
              type: mediaType,
              mimetype: mimeType
            })
          }
        );
        
        if (downloadResp.ok || downloadResp.status !== 429) break;
        lastError = `Rate limit (429) - attempt ${attempt + 1}`;
      } catch (e) {
        lastError = e.message;
        if (attempt === MAX_RETRIES) throw e;
      }
    }
    
    if (!downloadResp.ok) {
      const errorText = await downloadResp.text();
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ W-API retornou erro:', downloadResp.status, errorText);
      throw new Error(`W-API download failed: ${downloadResp.status} - ${errorText}`);
    }
    
    const downloadData = await downloadResp.json();
    console.log('[PERSISTIR-MIDIA-WAPI] 📦 W-API response:', {
      hasFileLink: !!downloadData.fileLink,
      hasBase64: !!downloadData.base64,
      keys: Object.keys(downloadData)
    });
    
    const media_url = downloadData.fileLink || downloadData.base64;
    const is_base64 = !downloadData.fileLink;
    
    if (!media_url) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ W-API não retornou fileLink nem base64:', downloadData);
      throw new Error('W-API não retornou mídia');
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📥 Iniciando processamento:', {
      message_id,
      media_type: mediaType,
      filename: filename || 'N/A',
      formato: is_base64 ? 'Base64' : 'URL',
      preview: is_base64 ? media_url.substring(0, 50) + '...' : media_url.substring(0, 80)
    });

    // ✅ DOWNLOAD DIRETO EM MEMÓRIA (ZERO FILESYSTEM)
    let blob;
    let contentType = mimeType || 'application/octet-stream';

    if (is_base64) {
      // ✅ Base64 → Blob (em memória)
      const base64Match = media_url.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        contentType = base64Match[1];
        const base64Data = base64Match[2];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: contentType });
      } else {
        // Base64 puro sem Data URI
        const binaryString = atob(media_url);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: contentType });
      }
      console.log('[PERSISTIR-MIDIA-WAPI] 📦 Base64 convertido para blob');
    } else {
      // ✅ URL → ArrayBuffer → Blob (100% em memória)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const mediaResponse = await fetch(media_url, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'VendaPro-MediaDownloader/2.0' }
        });
        clearTimeout(timeoutId);

        if (!mediaResponse.ok) {
          throw new Error(`Falha ao baixar mídia: HTTP ${mediaResponse.status}`);
        }

        contentType = mediaResponse.headers.get('content-type') || contentType;

        // ✅ ArrayBuffer → Blob (direto em memória, sem tocar em disco)
        const arrayBuffer = await mediaResponse.arrayBuffer();
        blob = new Blob([arrayBuffer], { type: contentType });

      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Download timeout após 60s');
        }
        throw fetchError;
      }
    }

    // ✅ VALIDAÇÃO TAMANHO (máx 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (blob.size > MAX_SIZE) {
      throw new Error(`Arquivo muito grande: ${(blob.size / 1024 / 1024).toFixed(2)}MB (máx: 50MB)`);
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📦 Arquivo baixado:', {
      size: `${(blob.size / 1024).toFixed(2)}KB`,
      type: contentType
    });

    // ✅ DETERMINAR EXTENSÃO (prioridade: filename > mimetype > mediaType)
    const extensaoMap = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
      'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/quicktime': 'mov',
      'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
      'audio/amr': 'amr', 'audio/wav': 'wav',
      'application/pdf': 'pdf', 'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };

    let extensao = 'bin';
    if (filename && filename.includes('.')) {
      extensao = filename.split('.').pop().toLowerCase();
    } else if (extensaoMap[contentType]) {
      extensao = extensaoMap[contentType];
    } else if (mediaType) {
      const mediaTypeMap = { 'image': 'jpg', 'video': 'mp4', 'audio': 'ogg', 'document': 'pdf', 'sticker': 'webp' };
      extensao = mediaTypeMap[mediaType] || 'bin';
    }

    // ✅ GERAR NOME ARQUIVO ÚNICO
    const timestamp = Date.now();
    const baseFilename = filename?.replace(/\.[^.]+$/, '') || `${mediaType || 'media'}`;
    const sanitizedBase = baseFilename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
    const nomeArquivo = `wapi_${message_id.substring(0, 8)}_${timestamp}_${sanitizedBase}.${extensao}`;

    // ✅ UPLOAD DIRETO (Blob → Storage Base44)
    const file = new File([blob], nomeArquivo, { type: contentType });

    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: file
    });

    if (!uploadResult?.file_url) {
      throw new Error('Falha no upload - nenhuma URL retornada');
    }

    console.log('[PERSISTIR-MIDIA-WAPI] ✅ Upload concluído:', uploadResult.file_url);

    // ✅ ATUALIZAR MESSAGE COM URL PERMANENTE
    let mensagemAtual;
    try {
      mensagemAtual = await base44.asServiceRole.entities.Message.get(message_id);
    } catch (e) {
      console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Não foi possível buscar mensagem atual:', e?.message);
    }

    const metadataAtual = mensagemAtual?.metadata || {};
    const novaMetadata = {
      ...metadataAtual,
      midia_persistida: true,
      url_original: media_url,
      persistida_em: new Date().toISOString(),
      tamanho_bytes: blob.size,
      mimetype_detectado: contentType,
      filename_original: filename || null
    };

    await base44.asServiceRole.entities.Message.update(message_id, {
      media_url: uploadResult.file_url,
      metadata: novaMetadata
    });

    console.log('[PERSISTIR-MIDIA-WAPI] ✅ Mensagem atualizada com URL permanente:', uploadResult.file_url);

    return Response.json({
      success: true,
      message_id,
      permanent_url: uploadResult.file_url,
      original_url: media_url,
      file_size: blob.size,
      mimetype: contentType,
      version: VERSION
    }, { headers });

  } catch (error) {
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ ERRO:', error.message);
    console.error('[PERSISTIR-MIDIA-WAPI] ❌ Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers });
  }
});