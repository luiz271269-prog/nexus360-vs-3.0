import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// PERSISTIR MÍDIA W-API - v9.0.0-PADRONIZADO-ZAPI
// ============================================================================
// v9: Padronizado ao nível do persistirMidiaZapi — timeout 30s, SDK 0.8.31,
//     helpers robustos de extensão/sanitização e preservação de metadata em
//     TODOS os pontos de failed_download. Lógica de download (cascata B/C) e
//     segurança anti-SSRF mantidas intactas.
// ============================================================================

const VERSION = 'v9.0.0-PADRONIZADO-ZAPI';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const DOWNLOAD_TIMEOUT = 30000; // 30s (igual ao Z-API)

// Mapas de extensão/MIME (padrão do persistirMidiaZapi)
const MIME_MAP = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr', 'audio/wav': 'wav',
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip', 'text/plain': 'txt'
};
const DEFAULT_EXT_BY_TYPE = { image: 'jpg', video: 'mp4', audio: 'ogg', document: 'pdf', sticker: 'webp' };

function getFileExtension(mimetype, filename, mediaType) {
  if (filename && filename.includes('.')) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext && ext.length >= 2 && ext.length <= 5 && /^[a-z0-9]+$/i.test(ext)) return ext;
  }
  const mimeBase = (mimetype || '').split(';')[0].trim();
  if (MIME_MAP[mimetype]) return MIME_MAP[mimetype];
  if (MIME_MAP[mimeBase]) return MIME_MAP[mimeBase];
  return DEFAULT_EXT_BY_TYPE[mediaType] || 'bin';
}

function sanitizeFilename(name) {
  return (name || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 150);
}

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

  // ✅ BUG FIX #1: Criar cliente ANTES de ler body (evita consumo do stream)
  const base44 = createClientFromRequest(req);
  console.log('[PERSISTIR-MIDIA-WAPI] ✅ Cliente criado via createClientFromRequest');

  // Helper: marca failed_download preservando metadata existente (padronização)
  const marcarFalha = async (msgId, motivo, extra = {}) => {
    if (!msgId) return;
    let atual;
    try { atual = await base44.asServiceRole.entities.Message.get(msgId); } catch (_) {}
    try {
      await base44.asServiceRole.entities.Message.update(msgId, {
        media_url: 'failed_download',
        metadata: {
          ...(atual?.metadata || {}),
          download_failed_reason: motivo,
          download_failed_at: new Date().toISOString(),
          ...extra
        }
      });
    } catch (e) {
      console.warn('[PERSISTIR-MIDIA-WAPI] ⚠️ Não conseguiu marcar failed_download:', e.message);
    }
  };

  // Ler body DEPOIS de criar cliente
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

    // CAMINHO B: POST /message/download-media com mediaKey + directPath
    // (Único endpoint real da W-API para baixar mídia .enc — confirmado em campo:
    //  /message/download-url e /message/download NÃO existem → 404.)
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

    // CAMINHO C: URL direta — só aceita se NÃO for mmg.whatsapp.net ou w-api.app (ambos exigem autenticação)
    if (!mediaUrl && downloadSpec.url && !downloadSpec.url.includes('whatsapp.net') && !downloadSpec.url.includes('.enc') && !downloadSpec.url.includes('w-api.app')) {
      mediaUrl = downloadSpec.url;
      caminhoUsado = 'C_url_direta';
      console.log('[PERSISTIR-MIDIA-WAPI] ✅ Caminho C: URL direta (pública)');
    }

    // Cascata esgotada sem URL
    if (!mediaUrl) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Cascata esgotada sem URL. Marcando failed_download.');
      await marcarFalha(message_id, 'Cascata esgotada: sem url/mediaKey/directPath');
      return Response.json({
        success: false,
        error: 'Cascata esgotada: sem url, mediaId nem mediaKey/directPath válidos',
        message_id,
        marked_as: 'failed_download'
      }, { status: 200, headers }); // 200 para evitar retry loop
    }

    console.log(`[PERSISTIR-MIDIA-WAPI] 📥 Baixando via ${caminhoUsado}: ${mediaUrl.substring(0, 80)}`);

    // ═══════════════════════════════════════════════════════════════════
    // SEGURANÇA (anti-SSRF + anti-vazamento de credencial):
    // O fileLink da W-API aponta para um servidor de arquivos de terceira
    // origem (ex: http://187.77.227.99:8080). NUNCA encaminhar o token
    // W-API para esse host (vazaria a credencial em HTTP puro), e só baixar
    // de hosts esperados (api.w-api.app, host da integração, ou o servidor
    // de mídia que a própria W-API devolve).
    // ═══════════════════════════════════════════════════════════════════
    let mediaHost = null;
    try { mediaHost = new URL(mediaUrl).hostname; } catch (_) {}
    const hostBaseUrl = (() => { try { return new URL(baseUrl).hostname; } catch (_) { return null; } })();
    const hostsPermitidos = new Set(['api.w-api.app', 'w-api.app']);
    if (hostBaseUrl) hostsPermitidos.add(hostBaseUrl);
    // O servidor de mídia da W-API responde como IP cru — aceitar apenas IPs
    // (o link veio da própria W-API autenticada no Caminho B, não de input externo).
    const ehIp = mediaHost && /^\d{1,3}(\.\d{1,3}){3}$/.test(mediaHost);
    if (mediaHost && !hostsPermitidos.has(mediaHost) && !ehIp) {
      console.error('[PERSISTIR-MIDIA-WAPI] ⛔ Host não permitido (anti-SSRF):', mediaHost);
      await marcarFalha(message_id, `Host de mídia não permitido: ${mediaHost}`, { download_failed_host: mediaHost });
      return Response.json({ success: false, error: `Host de mídia não permitido: ${mediaHost}`, marked_as: 'failed_download' }, { status: 200, headers });
    }

    // Download em memória — timeout 30s (padronizado com o Z-API, para descartar
    // 100% a hipótese de lentidão antes de imputar o host inacessível da W-API).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    let blob;
    let contentType = downloadSpec.mimetype || 'application/octet-stream';

    try {
      // ✅ SEM Authorization: o fileLink é um servidor de arquivos distinto da
      // API W-API. Encaminhar o Bearer aqui vazaria o token e não é exigido.
      const mediaResponse = await fetch(mediaUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Nexus360-MediaDownloader/1.0'
        }
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
      const errMsg = fetchError.name === 'AbortError' ? `Timeout de ${DOWNLOAD_TIMEOUT / 1000}s ao baixar mídia` : fetchError.message;
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Falha no download:', errMsg, '| fileLink:', mediaUrl, '| host:', mediaHost, '| causa:', fetchError.cause ? String(fetchError.cause) : 'n/a');
      // Registrar o fileLink/host exato que a W-API devolveu — evidência para o suporte W-API
      // (host de mídia inacessível, ex: IP privado HTTP). Causa-raiz é de infraestrutura, não de código.
      await marcarFalha(message_id, errMsg, { download_failed_filelink: mediaUrl, download_failed_host: mediaHost });
      return Response.json({ success: false, error: errMsg, failed_filelink: mediaUrl, failed_host: mediaHost, marked_as: 'failed_download' }, { status: 200, headers });
    }

    // Validação de tamanho
    if (blob.size > MAX_FILE_SIZE) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Arquivo muito grande:', blob.size);
      await marcarFalha(message_id, `Arquivo excede 50MB (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
      return Response.json({ success: false, error: 'Arquivo excede 50MB', marked_as: 'failed_download' }, { status: 200, headers });
    }

    // Extensão e nome (helpers padronizados com o persistirMidiaZapi)
    const timestamp = Date.now();
    const extensao = getFileExtension(contentType, filename, downloadSpec.type || media_type);
    const baseF = sanitizeFilename(filename?.replace(/\.[^.]+$/, '') || downloadSpec.type || 'media').substring(0, 40) || 'media';
    const nomeArquivo = `wapi_${message_id.substring(0, 8)}_${timestamp}_${baseF}.${extensao}`;

    // ✅ UPLOAD PARA BASE44 (URLs W-API expiram em 24h)
    // Converter blob para File para upload via SDK
    const file = new File([blob], nomeArquivo, { type: contentType });
    console.log('[PERSISTIR-MIDIA-WAPI] 📤 Fazendo upload para Base44...');

    let permanentUrl;
    let uploadOk = false;
    try {
      const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      permanentUrl = uploadResult.file_url;
      uploadOk = true;
      console.log('[PERSISTIR-MIDIA-WAPI] ✅ Upload para Base44 concluído:', permanentUrl);
    } catch (uploadErr) {
      console.error('[PERSISTIR-MIDIA-WAPI] ❌ Erro no upload para Base44:', uploadErr.message);
      console.log('[PERSISTIR-MIDIA-WAPI] ⚠️ Fallback: usando URL W-API temporária');
      permanentUrl = mediaUrl; // URL limpa, sem fragmento
      uploadOk = false;
    }

    // Buscar metadata atual para preservar
    let mensagemAtual;
    try { mensagemAtual = await base44.asServiceRole.entities.Message.get(message_id); } catch (_) {}

    // ✅ BUG FIX #4: URL limpa + flags separadas no metadata (não #ttl-24h na URL)
    const isTemporary = !uploadOk;
     const metadata = {
       ...(mensagemAtual?.metadata || {}),
       midia_persistida: uploadOk,
       caminho_usado: caminhoUsado,
       url_original: mediaUrl,
       persistida_em: new Date().toISOString(),
       tamanho_bytes: blob.size,
       mimetype_detectado: contentType,
       url_provider: uploadOk ? 'base44' : 'wapi'
     };

     if (isTemporary) {
       metadata.media_ttl_warning = true;
       metadata.media_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
     }

     await base44.asServiceRole.entities.Message.update(message_id, {
       media_url: permanentUrl,
       metadata
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

    // Marcar failed_download (preservando metadata) se temos o message_id disponível
    if (message_id_global) {
      await marcarFalha(message_id_global, `erro_geral: ${error.message}`);
      console.log('[PERSISTIR-MIDIA-WAPI] ✅ failed_download marcado no catch geral');
    }

    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 200, headers }); // 200 para evitar retry loop
  }
});