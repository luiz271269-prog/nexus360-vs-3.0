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