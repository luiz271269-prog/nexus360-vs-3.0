
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { createHash } from 'node:crypto';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DOWNLOAD E PERSISTÊNCIA DE MÍDIA - VERSÃO SEGURA          ║
 * ║  Com validações, limites e timeout                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// CONFIGURAÇÕES DE SEGURANÇA
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const DOWNLOAD_TIMEOUT = 30000; // 30 segundos
const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/amr', 'audio/wav',
  'video/mp4', 'video/3gpp', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'text/plain'
];

/**
 * Fetch com timeout automático
 */
async function fetchWithTimeout(resource, options = {}, timeout = DOWNLOAD_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, { 
      ...options, 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Download timeout após ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Valida se a URL é segura e acessível
 */
function validateUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Apenas HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Protocolo não permitido. Use HTTP ou HTTPS.');
    }
    
    // Bloquear URLs locais (segurança)
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') ||
        hostname === '0.0.0.0') {
      throw new Error('URLs locais não são permitidas por segurança');
    }
    
    return true;
  } catch (error) {
    throw new Error(`URL inválida: ${error.message}`);
  }
}

/**
 * Valida metadados do arquivo
 */
function validateMetadata(metadata) {
  if (!metadata) return true;
  
  // Validar mimetype se fornecido
  if (metadata.mimetype && !ALLOWED_MIMETYPES.includes(metadata.mimetype)) {
    console.warn(`[DownloadMedia] ⚠️ Mimetype não usual: ${metadata.mimetype}`);
    // Não bloquear, apenas alertar
  }
  
  // Validar filename se fornecido
  if (metadata.filename) {
    const dangerous = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*'];
    if (dangerous.some(char => metadata.filename.includes(char))) {
      throw new Error('Nome de arquivo contém caracteres perigosos');
    }
  }
  
  return true;
}

/**
 * Gera hash SHA-256 do conteúdo para detectar duplicatas
 */
function generateContentHash(buffer) {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Verifica se arquivo já existe no storage (evitar duplicatas)
 */
async function checkDuplicate(supabase, contentHash) {
  try {
    // Listar arquivos com mesmo hash no nome (convenção: hash nos primeiros 16 chars)
    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .list('', {
        limit: 1,
        search: contentHash.substring(0, 16)
      });
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`[DownloadMedia] ♻️ Arquivo duplicado encontrado: ${data[0].name}`);
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(data[0].name);
      
      return urlData.publicUrl;
    }
    
    return null;
  } catch (error) {
    console.warn('[DownloadMedia] ⚠️ Erro ao verificar duplicata:', error.message);
    return null; // Continuar mesmo se verificação falhar
  }
}

/**
 * Baixa mídia de URL temporária e persiste permanentemente
 */
export async function downloadAndPersistMedia(tempUrl, metadata = {}, integrationId = 'default') {
  const startTime = Date.now();
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Verificar credenciais
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[DownloadMedia] ❌ Credenciais Supabase não configuradas');
    return {
      url: tempUrl,
      storage_path: null,
      mimetype: metadata.mimetype || 'application/octet-stream',
      file_size: 0,
      filename: metadata.filename || 'unknown',
      original_url: tempUrl,
      downloaded_at: new Date().toISOString(),
      error: 'Credenciais não configuradas',
      fallback: true
    };
  }

  try {
    // VALIDAÇÕES DE SEGURANÇA
    console.log(`[DownloadMedia] 🔍 Validando URL: ${tempUrl}`);
    validateUrl(tempUrl);
    validateMetadata(metadata);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. BAIXAR ARQUIVO COM TIMEOUT
    console.log(`[DownloadMedia] 📥 Baixando (timeout: ${DOWNLOAD_TIMEOUT}ms)...`);
    const downloadResponse = await fetchWithTimeout(tempUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VendaPro-MediaDownloader/2.0'
      }
    }, DOWNLOAD_TIMEOUT);

    if (!downloadResponse.ok) {
      throw new Error(`HTTP ${downloadResponse.status}: ${downloadResponse.statusText}`);
    }

    // Verificar Content-Length (se disponível)
    const contentLength = downloadResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      throw new Error(`Arquivo muito grande: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB (máx: ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    const blob = await downloadResponse.blob();
    
    // VERIFICAR TAMANHO REAL
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(`Arquivo excede ${MAX_FILE_SIZE / 1024 / 1024}MB: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.log(`[DownloadMedia] ✅ Baixado: ${(blob.size / 1024).toFixed(2)}KB, tipo: ${blob.type}`);

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // 2. GERAR HASH PARA DETECTAR DUPLICATAS
    const contentHash = generateContentHash(buffer);
    console.log(`[DownloadMedia] 🔐 Hash: ${contentHash.substring(0, 16)}...`);

    // 3. VERIFICAR SE JÁ EXISTE (evitar duplicatas)
    const existingUrl = await checkDuplicate(supabase, contentHash);
    if (existingUrl) {
      console.log(`[DownloadMedia] ♻️ Usando arquivo existente`);
      return {
        url: existingUrl,
        storage_path: null,
        mimetype: metadata.mimetype || blob.type,
        file_size: blob.size,
        filename: metadata.filename || 'cached',
        original_url: tempUrl,
        downloaded_at: new Date().toISOString(),
        fallback: false,
        cached: true,
        processing_time_ms: Date.now() - startTime
      };
    }

    // 4. GERAR NOME ÚNICO COM HASH
    const timestamp = Date.now();
    const hashPrefix = contentHash.substring(0, 16);
    const extension = getFileExtension(metadata.mimetype || blob.type, metadata.filename);
    const baseFilename = metadata.filename?.replace(extension, '') || `media_${timestamp}`;
    const sanitizedBase = sanitizeFilename(baseFilename);
    const filename = `${hashPrefix}_${sanitizedBase}${extension}`;
    
    // 5. ORGANIZAR POR DATA E INTEGRAÇÃO
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const storagePath = `${integrationId}/${year}/${month}/${day}/${filename}`;

    console.log(`[DownloadMedia] 📤 Upload: ${storagePath}`);

    // 6. UPLOAD COM METADADOS COMPLETOS
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, arrayBuffer, {
        contentType: metadata.mimetype || blob.type || 'application/octet-stream',
        upsert: false, // Não sobrescrever
        cacheControl: '31536000', // 1 ano
        metadata: {
          original_url: tempUrl,
          content_hash: contentHash,
          integration_id: integrationId,
          uploaded_at: new Date().toISOString()
        }
      });

    if (uploadError) {
      console.error(`[DownloadMedia] ❌ Erro no upload:`, uploadError);
      throw new Error(`Upload falhou: ${uploadError.message}`);
    }

    // 7. OBTER URL PÚBLICA
    const { data: publicUrlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(uploadData.path);

    const permanentUrl = publicUrlData.publicUrl;
    const processingTime = Date.now() - startTime;

    console.log(`[DownloadMedia] ✅ Concluído em ${processingTime}ms: ${permanentUrl}`);

    return {
      url: permanentUrl,
      storage_path: uploadData.path,
      mimetype: metadata.mimetype || blob.type || 'application/octet-stream',
      file_size: blob.size,
      filename: filename,
      content_hash: contentHash,
      original_url: tempUrl,
      downloaded_at: new Date().toISOString(),
      fallback: false,
      cached: false,
      processing_time_ms: processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`[DownloadMedia] ❌ Erro (${processingTime}ms):`, error.message);
    console.error('[DownloadMedia] Stack:', error.stack); // Log interno completo
    
    // Retornar fallback com URL temporária
    return {
      url: tempUrl,
      storage_path: null,
      mimetype: metadata.mimetype || 'application/octet-stream',
      file_size: 0,
      filename: metadata.filename || 'unknown',
      original_url: tempUrl,
      downloaded_at: new Date().toISOString(),
      error: error.message,
      error_type: error.name,
      fallback: true,
      processing_time_ms: processingTime
    };
  }
}

/**
 * Determina extensão do arquivo
 */
function getFileExtension(mimetype, filename) {
  if (filename && filename.includes('.')) {
    const parts = filename.split('.');
    return `.${parts[parts.length - 1]}`;
  }

  const mimetypeMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/amr': '.amr',
    'audio/wav': '.wav', // Adicionado .wav
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'video/quicktime': '.mov', // Adicionado .mov
    'application/pdf': '.pdf',
    'application/msword': '.doc', // Adicionado .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/zip': '.zip',
    'text/plain': '.txt'
  };

  return mimetypeMap[mimetype] || '';
}

/**
 * Sanitiza nome de arquivo
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}

// Handler Deno Deploy
Deno.serve((req) => { // Removed 'async' keyword as no await is performed here
  // Exemplo de uso
  const example = {
    message: 'Download e persistência de mídia do WhatsApp',
    version: '2.0-secure',
    limits: {
      max_file_size: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      timeout: `${DOWNLOAD_TIMEOUT / 1000}s`
    },
    features: [
      'Timeout automático',
      'Validação de URL',
      'Limite de tamanho',
      'Detecção de duplicatas',
      'Hash de conteúdo',
      'Logs seguros'
    ],
    usage: {
      function: 'downloadAndPersistMedia(tempUrl, metadata, integrationId)',
      example: {
        tempUrl: 'https://api.z-api.io/instances/ABC/media/XYZ.jpg',
        metadata: { mimetype: 'image/jpeg', filename: 'foto.jpg' },
        integrationId: 'whatsapp-integration-001'
      }
    }
  };
  
  return Response.json(example, { status: 200 });
});
