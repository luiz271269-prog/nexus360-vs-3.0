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

    const { message_id, media_url, media_type, integration_id } = payload;

    if (!message_id || !media_url) {
      return Response.json({ 
        success: false, 
        error: 'message_id e media_url são obrigatórios' 
      }, { status: 400, headers });
    }

    console.log('[PERSISTIR-MIDIA] 📥 Iniciando download:', {
      message_id,
      media_type,
      url_preview: media_url.substring(0, 80)
    });

    // Baixar o arquivo da URL temporária
    const mediaResponse = await fetch(media_url);
    
    if (!mediaResponse.ok) {
      throw new Error(`Falha ao baixar mídia: HTTP ${mediaResponse.status}`);
    }

    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
    const blob = await mediaResponse.blob();

    console.log('[PERSISTIR-MIDIA] 📦 Arquivo baixado:', {
      size: blob.size,
      type: contentType
    });

    // Determinar extensão
    const extensaoMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };

    const extensao = extensaoMap[contentType] || media_type || 'bin';
    const nomeArquivo = `whatsapp_${message_id}_${Date.now()}.${extensao}`;

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

    // Atualizar a mensagem com a URL permanente
    await base44.asServiceRole.entities.Message.update(message_id, {
      media_url: uploadResult.file_url,
      metadata: {
        midia_persistida: true,
        url_original: media_url,
        persistida_em: new Date().toISOString()
      }
    });

    console.log('[PERSISTIR-MIDIA] ✅ Mensagem atualizada com URL permanente');

    return Response.json({
      success: true,
      message_id,
      permanent_url: uploadResult.file_url,
      original_url: media_url,
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