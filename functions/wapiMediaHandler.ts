// ============================================================================
// W-API MEDIA HANDLER - v1.0.0
// ============================================================================
// Processa midia da W-API usando o endpoint /download-media oficial
// 100% em memoria, sem acesso ao filesystem (serverless-safe)
// ============================================================================

export async function processarMidiaWapi(messageContent, instanceId, token) {
    try {
        let mediaType = null;
        let mediaData = null;

        // 1. Mapeamento dos tipos aninhados da W-API
        if (messageContent.imageMessage) {
            mediaType = 'image';
            mediaData = messageContent.imageMessage;
        } else if (messageContent.videoMessage) {
            mediaType = 'video';
            mediaData = messageContent.videoMessage;
        } else if (messageContent.audioMessage) {
            mediaType = 'audio';
            mediaData = messageContent.audioMessage;
        } else if (messageContent.documentMessage) {
            mediaType = 'document';
            mediaData = messageContent.documentMessage;
        } else if (messageContent.stickerMessage) {
            mediaType = 'sticker';
            mediaData = messageContent.stickerMessage;
        }

        if (!mediaType || !mediaData) return null;

        console.log(`[W-API Handler] Processando ${mediaType}...`);

        // 2. Payload obrigatorio conforme documentacao W-API
        const payload = {
            mediaKey: mediaData.mediaKey,
            directPath: mediaData.directPath,
            type: mediaType,
            mimetype: mediaData.mimetype
        };

        // 3. Request para obter o link publico (fileLink)
        const response = await fetch(`https://api.w-api.app/v1/message/download-media?instanceId=${instanceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Sucesso retorna { error: false, fileLink: "..." }
        if (data.error || !data.fileLink) {
            console.warn('[W-API Handler] Falha no download-media. Usando fallback URL interna.');
            return {
                url: mediaData.url || null,
                mimetype: mediaData.mimetype,
                type: mediaType,
                caption: mediaData.caption || ''
            };
        }

        return {
            url: data.fileLink,
            mimetype: mediaData.mimetype,
            type: mediaType,
            caption: mediaData.caption || mediaData.fileName || ''
        };

    } catch (error) {
        console.error('[W-API Handler] Erro critico:', error);
        return null;
    }
}

/**
 * Obtem link de download autenticado da W-API (conforme manual oficial)
 * Retorna fileLink temporario que deve ser baixado imediatamente
 */
export async function obterLinkDownloadWapi(downloadSpec, instanceId, token) {
  // ✅ FALLBACK: Áudios PTT frequentemente chegam sem mediaKey/directPath
  // Se não tem as chaves para API de download, usar URL direta do payload (temporária mas funcional)
  if (!downloadSpec.mediaKey || !downloadSpec.directPath) {
    if (downloadSpec.url) {
      console.warn(`[W-API Handler] ⚠️ Sem mediaKey/directPath para ${downloadSpec.type} - usando URL direta do payload`);
      return downloadSpec.url;
    }
    throw new Error(`Dados insuficientes para ${downloadSpec.type}: sem mediaKey, directPath nem url.`);
  }

  const url = `https://api.w-api.app/v1/message/download-media?instanceId=${instanceId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      mediaKey: downloadSpec.mediaKey,
      directPath: downloadSpec.directPath,
      type: downloadSpec.type,
      mimetype: downloadSpec.mimetype
    })
  });

  const data = await response.json();

  if (data.error || !data.fileLink) {
    // ✅ FALLBACK: Se W-API falhou em gerar o link, tentar URL direta
    if (downloadSpec.url) {
      console.warn(`[W-API Handler] ⚠️ download-media falhou: ${JSON.stringify(data)} - usando URL direta`);
      return downloadSpec.url;
    }
    throw new Error(`W-API Error: ${JSON.stringify(data)}`);
  }

  return data.fileLink;
}