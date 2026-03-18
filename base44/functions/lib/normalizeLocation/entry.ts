// ============================================================================
// NORMALIZADOR ÚNICO DE LOCALIZAÇÃO - v1.0.0
// ============================================================================
// Contrato único para Z-API e W-API (Baileys)
// Garante: media_type='location', content não vazio, metadata.location completo
// ============================================================================

function toNumber(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Normaliza mensagens de localização de qualquer provedor
 * @param {Object} params
 * @param {string} params.provider - 'wapi' ou 'zapi'
 * @param {Object} params.raw - Payload bruto do webhook
 * @returns {Object|null} Objeto normalizado ou null se não for localização válida
 */
export function normalizeLocation({ provider, raw }) {
  let lat = null, lng = null, name = null, address = null, raw_type = null, accuracy = null;

  // === W-API (Baileys-like) ===
  if (provider === 'wapi') {
    const msg = raw?.msgContent || raw?.message || raw;
    const loc = msg?.locationMessage || msg?.liveLocationMessage;
    
    if (!loc) return null;

    raw_type = msg?.locationMessage ? 'locationMessage' : 'liveLocationMessage';

    lat = toNumber(loc.degreesLatitude ?? loc.latitude);
    lng = toNumber(loc.degreesLongitude ?? loc.longitude);

    // ✅ FALLBACKS OBRIGATÓRIOS: name/address sempre preenchidos
    const hasName = loc.name && String(loc.name).trim().length > 0;
    const hasAddr = loc.address && String(loc.address).trim().length > 0;

    name = hasName ? String(loc.name) : 'Localização compartilhada';
    address = hasAddr ? String(loc.address) : null;
    accuracy = toNumber(loc.accuracy) ?? null;
  }

  // === Z-API ===
  if (provider === 'zapi') {
    const loc = raw?.location || raw?.message?.location || raw?.data?.location;
    
    if (!loc) return null;

    raw_type = 'location';

    lat = toNumber(loc.latitude ?? loc.lat);
    lng = toNumber(loc.longitude ?? loc.lng);

    // ✅ FALLBACKS OBRIGATÓRIOS: name/address/url sempre preenchidos
    const hasName = loc.name && String(loc.name).trim().length > 0;
    const hasTitle = loc.title && String(loc.title).trim().length > 0;
    const hasAddr = loc.address && String(loc.address).trim().length > 0;
    const hasDesc = loc.description && String(loc.description).trim().length > 0;
    const hasUrl = loc.url && String(loc.url).trim().length > 0;

    name = hasTitle ? String(loc.title) : hasName ? String(loc.name) : 'Localização compartilhada';
    address = hasAddr ? String(loc.address) : hasDesc ? String(loc.description) : null;
    accuracy = toNumber(loc.accuracy) ?? null;
  }

  // Validação final (cirúrgica): sem coordenadas válidas = não é location
  if (lat === null || lng === null) {
    console.warn(`[normalizeLocation] ${provider}: lat/lng inválidos ou ausentes`);
    return null;
  }

  // ✅ URL SEMPRE GERADA (Z-API retorna url="")
  const urlFinal = (provider === 'wapi' || (raw?.location?.url && String(raw.location.url).trim().length > 0))
    ? buildMapsUrl(lat, lng)
    : buildMapsUrl(lat, lng);

  return {
    media_type: 'location',
    content: '📍 Localização recebida',
    metadata: {
      location: {
        lat,
        lng,
        name,
        address,
        url: urlFinal,
        provider,
        raw_type,
        accuracy,
        timestamp: raw?.momment ? String(raw.momment) : (raw?.timestamp ? String(raw.timestamp) : null),
      }
    }
  };
}