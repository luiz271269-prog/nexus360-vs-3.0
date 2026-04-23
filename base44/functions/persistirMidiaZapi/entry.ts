import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DOWNLOAD DE MÍDIA VIA Z-API - VERSÃO CIRÚRGICA            ║
 * ║  Usa endpoint oficial da Z-API + UploadFile Base44         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const VERSION = 'v2.0.0-BASE44-UPLOAD';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const DOWNLOAD_TIMEOUT = 30000; // 30 segundos

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function fetchWithTimeout(resource, options = {}, timeout = DOWNLOAD_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  return fetch(resource, { ...options, signal: controller.signal })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Download timeout após ${timeout}ms`);
      }
      throw error;
    });
}

function getFileExtension(mimetype, filename, mediaType) {
  // 1) Extensão VÁLIDA no filename (2-5 chars alfanuméricos)
  if (filename && filename.includes('.')) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext && ext.length >= 2 && ext.length <= 5 && /^[a-z0-9]+$/i.test(ext)) {
      return '.' + ext;
    }
  }

  const mimeMap = {
    'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
    'image/gif': '.gif', 'image/webp': '.webp',
    'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
    'audio/amr': '.amr', 'audio/wav': '.wav',
    'video/mp4': '.mp4', 'video/3gpp': '.3gp',
    'application/pdf': '.pdf', 'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/zip': '.zip', 'text/plain': '.txt'
  };

  // 2) MIME conhecido
  if (mimeMap[mimetype]) return mimeMap[mimetype];

  // 3) Fallback por media_type (Z-API MIME vazio/genérico)
  const defaultByType = {
    'audio': '.ogg',
    'image': '.jpg',
    'video': '.mp4',
    'document': '.pdf',
    'sticker': '.webp'
  };
  return defaultByType[mediaType] || '.bin';
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({
      message: 'Download de mídia via Z-API',
      version: VERSION,
      usage: {
        method: 'POST',
        body: {
          file_id: 'ID do arquivo da Z-API (obrigatório)',
          integration_id: 'ID da WhatsAppIntegration',
          media_type: 'image/video/audio/document',
          filename: 'Nome do arquivo (opcional)'
        }
      }
    }, { headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  const { file_id, integration_id, media_type, filename } = body;

  if (!file_id) {
    return Response.json({ success: false, error: 'file_id é obrigatório' }, { status: 400, headers: corsHeaders });
  }

  if (!integration_id) {
    return Response.json({ success: false, error: 'integration_id é obrigatório' }, { status: 400, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. BUSCAR INTEGRAÇÃO Z-API
    console.log(`[${VERSION}] 📡 Buscando integração: ${integration_id}`);
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao || integracao.api_provider !== 'z_api') {
      throw new Error('Integração não encontrada ou não é Z-API');
    }

    // 2. MONTAR URL DE DOWNLOAD DA Z-API
    const downloadUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/download/${file_id}`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) {
      headers['Client-Token'] = integracao.security_client_token_header;
    }

    console.log(`[${VERSION}] 📥 Baixando de Z-API: ${downloadUrl.substring(0, 80)}...`);

    // 3. BAIXAR ARQUIVO DA Z-API
    const downloadResponse = await fetchWithTimeout(downloadUrl, { headers }, DOWNLOAD_TIMEOUT);

    if (!downloadResponse.ok) {
      throw new Error(`HTTP ${downloadResponse.status}: ${downloadResponse.statusText}`);
    }

    const blob = await downloadResponse.blob();

    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(`Arquivo muito grande: ${(blob.size / 1024 / 1024).toFixed(2)}MB (máx: 50MB)`);
    }

    console.log(`[${VERSION}] ✅ Baixado: ${(blob.size / 1024).toFixed(2)}KB`);

    // 4. MONTAR NOME ÚNICO DO ARQUIVO
    const timestamp = Date.now();
    const extension = getFileExtension(blob.type, filename, media_type);
    const baseFilename = filename?.replace(extension, '') || `${media_type}_${timestamp}`;
    let sanitizedBase = sanitizeFilename(baseFilename);
    // Garantia: remove ponto residual no final antes de concatenar extensão
    sanitizedBase = sanitizedBase.replace(/\.+$/, '') || `${media_type}_${timestamp}`;
    const uniqueFilename = `${timestamp}_${sanitizedBase}${extension}`;

    // 5. UPLOAD VIA BASE44 (storage nativo da plataforma)
    console.log(`[${VERSION}] 📤 Upload Base44: ${uniqueFilename}`);

    const fileToUpload = new File([blob], uniqueFilename, {
      type: blob.type || 'application/octet-stream'
    });

    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({
      file: fileToUpload
    });

    if (!uploadResult?.file_url) {
      throw new Error('UploadFile não retornou file_url');
    }

    const permanentUrl = uploadResult.file_url;
    const processingTime = Date.now() - startTime;

    console.log(`[${VERSION}] ✅ Sucesso em ${processingTime}ms: ${permanentUrl}`);

    // 6. ATUALIZAR MENSAGEM COM URL PERMANENTE (se message_id informado)
    if (body.message_id) {
      try {
        await base44.asServiceRole.entities.Message.update(body.message_id, {
          media_url: permanentUrl,
          metadata: {
            midia_persistida: true,
            persisted_at: new Date().toISOString(),
            original_temp_url: body.media_url || null
          }
        });
        console.log(`[${VERSION}] ✅ Mensagem ${body.message_id} atualizada com URL permanente`);
      } catch (updErr) {
        console.warn(`[${VERSION}] ⚠️ Erro ao atualizar mensagem:`, updErr.message);
      }
    }

    return Response.json({
      success: true,
      url: permanentUrl,
      mimetype: blob.type,
      file_size: blob.size,
      filename: uniqueFilename,
      file_id: file_id,
      processing_time_ms: processingTime,
      fallback: false
    }, { headers: corsHeaders });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${VERSION}] ❌ Erro (${processingTime}ms):`, error.message);

    return Response.json({
      success: false,
      url: null,
      error: error.message,
      error_type: error.name,
      fallback: true,
      processing_time_ms: processingTime
    }, { status: 500, headers: corsHeaders });
  }
});