import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// PERSISTIR MÍDIA W-API - v1.0.2
// ============================================================================
// Esta função baixa mídias temporárias do WhatsApp e salva permanentemente
// no storage do Base44
// CORREÇÃO v1.0.2: Versão atualizada para consistência com webhookWapi v9.1.0
// ============================================================================

const VERSION = 'v1.0.2';
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
      description: 'Baixa e persiste mídias da W-API'
    }, { headers });
  }

  console.log('[PERSISTIR-MIDIA-WAPI] 🚀 FUNÇÃO CHAMADA | Método:', req.method);

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    console.log('[PERSISTIR-MIDIA-WAPI] 📦 Payload recebido:', {
      message_id: payload.message_id,
      media_type: payload.media_type,
      integration_id: payload.integration_id,
      has_message_struct: !!payload.message_struct
    });

    const { message_id, media_type, integration_id, message_struct, filename, mimetype } = payload;

    if (!message_id || !media_type || !integration_id) {
      return Response.json({ 
        success: false, 
        error: 'message_id, media_type e integration_id são obrigatórios' 
      }, { status: 400, headers });
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 🚀 INICIANDO | Tipo:', media_type, '| MessageStruct:', !!message_struct);

    // ========================================================================
    // PASSO 5: BAIXAR MÍDIA DESCRIPTOGRAFADA VIA API W-API (ESTUDO TÉCNICO)
    // ========================================================================
    
    if (!message_struct) {
      return Response.json({
        success: false,
        error: 'message_struct é obrigatório para download W-API'
      }, { status: 400, headers });
    }

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    // ✅ Extrair campos OBRIGATÓRIOS conforme manual W-API
    const mediaKey = message_struct.mediaKey;
    const directPath = message_struct.directPath;
    const mimeType = message_struct.mimetype || mimetype || 'image/jpeg';

    // ✅ Validação: campos obrigatórios do manual
    if (!mediaKey || !directPath) {
      throw new Error('mediaKey ou directPath ausentes no messageStruct');
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📞 Chamando W-API download-media | mediaKey:', mediaKey?.substring(0, 20), '| directPath:', directPath?.substring(0, 30));
    
    // ✅ RETRY LOGIC - Evitar rate limit
    let downloadResp;
    let lastError;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[PERSISTIR-MIDIA-WAPI] 🔄 Tentativa ${attempt + 1}/${MAX_RETRIES + 1}`);
          await sleep(RETRY_DELAY * attempt);
        }
        
        downloadResp = await fetch(
          `https://api.w-api.app/v1/message/download-media?instanceId=${integracao.instance_id_provider}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${integracao.api_key_provider}`
            },
            body: JSON.stringify({
              mediaKey: mediaKey,
              directPath: directPath,
              type: media_type,
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
      media_type,
      filename: filename || 'N/A',
      formato: is_base64 ? 'Base64' : 'URL',
      preview: is_base64 ? media_url.substring(0, 50) + '...' : media_url.substring(0, 80)
    });

    // ✅ DOWNLOAD DIRETO SEM FILESYSTEM
    let blob;
    let contentType = mimetype || 'application/octet-stream';

    // Processar Base64 ou URL
    if (is_base64) {
      // Extrair mimetype do Data URI se presente
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
      // ✅ Baixar da URL (sem salvar em disco)
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

        // ✅ Baixar direto para memória (ArrayBuffer → Blob)
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

    // Validar tamanho (máx 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (blob.size > MAX_SIZE) {
      throw new Error(`Arquivo muito grande: ${(blob.size / 1024 / 1024).toFixed(2)}MB (máx: 50MB)`);
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📦 Arquivo baixado:', {
      size: `${(blob.size / 1024).toFixed(2)}KB`,
      type: contentType
    });

    // Determinar extensão - priorizar filename > mimetype > media_type
    const extensaoMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'video/quicktime': 'mov',
      'audio/ogg': 'ogg',
      'audio/ogg; codecs=opus': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/amr': 'amr',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };

    // Extrair extensão do filename se disponível
    let extensao = 'bin';
    if (filename && filename.includes('.')) {
      extensao = filename.split('.').pop().toLowerCase();
    } else if (extensaoMap[contentType]) {
      extensao = extensaoMap[contentType];
    } else if (media_type) {
      const mediaTypeMap = { 'image': 'jpg', 'video': 'mp4', 'audio': 'ogg', 'document': 'pdf' };
      extensao = mediaTypeMap[media_type] || 'bin';
    }

    // Gerar nome de arquivo único
    const timestamp = Date.now();
    const baseFilename = filename?.replace(/\.[^.]+$/, '') || `${media_type || 'media'}`;
    const sanitizedBase = baseFilename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
    const nomeArquivo = `wapi_${message_id.substring(0, 8)}_${timestamp}_${sanitizedBase}.${extensao}`;

    // Converter blob para File
    const file = new File([blob], nomeArquivo, { type: contentType });

    // Upload para o storage Base44
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: file
    });

    if (!uploadResult?.file_url) {
      throw new Error('Falha no upload - nenhuma URL retornada');
    }

    console.log('[PERSISTIR-MIDIA] ✅ Upload concluído:', uploadResult.file_url);

    // Buscar mensagem atual para preservar metadata existente
    let mensagemAtual;
    try {
      mensagemAtual = await base44.asServiceRole.entities.Message.get(message_id);
    } catch (e) {
      console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Não foi possível buscar mensagem atual:', e?.message);
    }

    // Mesclar metadata existente com novos dados
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

    // Atualizar a mensagem com a URL permanente
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
    console.error('[PERSISTIR-MIDIA] ❌ ERRO:', error.message);
    
    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 500, headers });
  }
});