import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { createHash } from 'node:crypto';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DOWNLOAD DE MÍDIA VIA Z-API - VERSÃO CIRÚRGICA            ║
 * ║  Usa endpoint oficial da Z-API para baixar mídia           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const VERSION = 'v1.0.0';
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

function generateContentHash(buffer) {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

function getFileExtension(mimetype, filename) {
  if (filename && filename.includes('.')) {
    return '.' + filename.split('.').pop();
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

  return mimeMap[mimetype] || '';
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

    // 4. PREPARAR UPLOAD PARA SUPABASE
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // 5. GERAR HASH E NOME ÚNICO
    const contentHash = generateContentHash(buffer);
    const timestamp = Date.now();
    const hashPrefix = contentHash.substring(0, 16);
    const extension = getFileExtension(blob.type, filename);
    const baseFilename = filename?.replace(extension, '') || `${media_type}_${timestamp}`;
    const sanitizedBase = sanitizeFilename(baseFilename);
    const uniqueFilename = `${hashPrefix}_${sanitizedBase}${extension}`;

    // 6. ORGANIZAR POR DATA E INTEGRAÇÃO
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const storagePath = `${integration_id}/${year}/${month}/${day}/${uniqueFilename}`;

    console.log(`[${VERSION}] 📤 Upload Supabase: ${storagePath}`);

    // 7. UPLOAD PARA SUPABASE
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, arrayBuffer, {
        contentType: blob.type || 'application/octet-stream',
        upsert: false,
        cacheControl: '31536000', // 1 ano
        metadata: {
          file_id: file_id,
          integration_id: integration_id,
          content_hash: contentHash,
          downloaded_via: 'z-api',
          uploaded_at: new Date().toISOString()
        }
      });

    if (uploadError) {
      throw new Error(`Upload falhou: ${uploadError.message}`);
    }

    // 8. OBTER URL PÚBLICA
    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uploadData.path);

    const permanentUrl = publicUrlData.publicUrl;
    const processingTime = Date.now() - startTime;

    console.log(`[${VERSION}] ✅ Sucesso em ${processingTime}ms: ${permanentUrl}`);

    return Response.json({
      success: true,
      url: permanentUrl,
      storage_path: uploadData.path,
      mimetype: blob.type,
      file_size: blob.size,
      filename: uniqueFilename,
      content_hash: contentHash,
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