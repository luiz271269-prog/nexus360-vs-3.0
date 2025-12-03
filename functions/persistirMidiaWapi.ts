import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// PERSISTIR MÍDIA W-API - v1.0.0
// ============================================================================
// Esta função baixa mídias temporárias do WhatsApp e salva permanentemente
// no storage do Base44
// ============================================================================

const VERSION = 'v1.0.0';
const WAPI_BASE_URL = 'https://api.w-api.app/v1';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { message_id, media_url, media_type, integration_id, filename, mimetype } = payload;

    if (!message_id || !media_url) {
      return Response.json({ 
        success: false, 
        error: 'message_id e media_url são obrigatórios' 
      }, { status: 400, headers });
    }

    console.log('[PERSISTIR-MIDIA-WAPI] 📥 Iniciando download:', {
      message_id,
      media_type,
      filename: filename || 'N/A',
      url_preview: media_url.substring(0, 80)
    });

    // Baixar o arquivo da URL temporária com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    let mediaResponse;
    try {
      mediaResponse = await fetch(media_url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'VendaPro-MediaDownloader/2.0'
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Download timeout após 30s');
      }
      throw fetchError;
    }
    
    if (!mediaResponse.ok) {
      throw new Error(`Falha ao baixar mídia: HTTP ${mediaResponse.status}`);
    }

    const contentType = mediaResponse.headers.get('content-type') || mimetype || 'application/octet-stream';
    const blob = await mediaResponse.blob();

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