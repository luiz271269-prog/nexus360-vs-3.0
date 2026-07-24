import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// ============================================================================
// RECUPERAR MÍDIA W-API PENDENTE - v1.0.0
// ============================================================================
// Rede de segurança: reprocessa mensagens W-API travadas em 'pending_download'
// há mais de IDADE_MINIMA_MIN minutos (worker nunca iniciou ou foi morto pelo
// runtime sem passar pelo catch). Reinvoca o persistirMidiaWapi com o
// downloadSpec preservado no metadata; se ainda não resolver, marca failed_download.
// Admin-only / cron.
// ============================================================================

const VERSION = 'v1.2.0-ZAPI-DIRECT';
const IDADE_MINIMA_MIN = 2;    // só mexe no que está pendente há ≥ 2 min
const IDADE_MAXIMA_MIN = 1440; // ignora muito antigo (>24h): URL já expirou
const LOTE = 20;

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'application/pdf': 'pdf'
};
const DEFAULT_EXT = { image: 'jpg', video: 'mp4', audio: 'ogg', document: 'bin' };
const isUrlZapi = (u) => !!u && /backblazeb2\.com|z-api\.io|temp-file-download/.test(String(u));

// Download direto da URL temporária Z-API → upload → update.
// Sem invoke cross-function (evita 502 intermitente) e sem exigir integrationId.
async function recuperarZapiDireto(base44, msg, urlTemp) {
  const dl = await fetch(urlTemp, { signal: AbortSignal.timeout(25000) });
  if (!dl.ok) throw new Error(`http_${dl.status}`);
  const buf = await dl.arrayBuffer();
  if (!buf.byteLength) throw new Error('arquivo_vazio');
  const ct = (dl.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
  const ext = MIME_EXT[ct] || DEFAULT_EXT[msg.media_type] || 'bin';
  const file = new File([buf], `zapi_rec_${String(msg.id).slice(-8)}.${ext}`, { type: ct });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('upload_sem_file_url');
  await base44.asServiceRole.entities.Message.update(msg.id, {
    media_url: up.file_url,
    metadata: {
      ...(msg.metadata || {}),
      midia_persistida: true,
      persisted_at: new Date().toISOString(),
      persist_method: 'watchdog_zapi_direct',
      download_failed_reason: null
    }
  });
  return up.file_url;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);

    // Cron roda sem usuário; chamada manual exige admin.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    }

    const agora = Date.now();
    const limiteRecente = new Date(agora - IDADE_MINIMA_MIN * 60 * 1000).toISOString();
    const limiteAntigo = new Date(agora - IDADE_MAXIMA_MIN * 60 * 1000).toISOString();

    // Mensagens pendentes dentro da janela [24h .. 10min] atrás
    // ⚠️ FIX: filtro created_date no banco não casa com o formato armazenado
    // (sem timezone) — busca só por media_url e filtra a janela em memória.
    // ✅ FIX TZ: created_date vem sem timezone e é UTC — forçar 'Z' para o parse
    // não usar o fuso local do runtime (senão msgs recentes parecem "no futuro"
    // e ficam fora da janela por até 1h+).
    const parseUtc = (s) => {
      if (!s) return NaN;
      const str = String(s);
      return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(str) ? str : str + 'Z').getTime();
    };
    const dentroDaJanela = (m) => {
      const t = parseUtc(m.created_date);
      return t <= new Date(limiteRecente).getTime() && t >= new Date(limiteAntigo).getTime();
    };
    const pendentesTodas = await base44.asServiceRole.entities.Message.filter(
      { media_url: 'pending_download' },
      '-created_date',
      100
    );
    const pendentesRaw = pendentesTodas.filter(dentroDaJanela).slice(0, LOTE);

    // ✅ TAMBÉM recuperar failed_download recentes que ainda têm downloadSpec:
    // o servidor de mídia da W-API é intermitente, então uma falha anterior pode
    // ter sido transitória. Reprocessamos com o retry novo do persistirMidiaWapi.
    // Só dentro da janela de 24h (depois disso o fileLink já expirou de vez).
    const falhadasTodas = await base44.asServiceRole.entities.Message.filter(
      { media_url: 'failed_download' },
      '-created_date',
      100
    );
    const falhadasRaw = falhadasTodas.filter(dentroDaJanela).slice(0, LOTE);
    // Só reprocessa falhadas que preservaram downloadSpec (W-API) ou URL temporária Z-API
    const falhadas = falhadasRaw.filter(m =>
      (m.metadata?.downloadSpec && m.metadata?.whatsapp_integration_id) ||
      isUrlZapi(m.metadata?.original_media_url || m.metadata?.original_temp_url)
    );

    const pendentes = [...pendentesRaw, ...falhadas];

    console.log(`[RECUPERAR-MIDIA-WAPI] ${VERSION} | pendentes=${pendentesRaw.length} | failed_recuperáveis=${falhadas.length}`);

    let reprocessadas = 0;
    let marcadasFalha = 0;

    for (const msg of pendentes) {
      const spec = msg.metadata?.downloadSpec;
      const integrationId = msg.metadata?.whatsapp_integration_id;

      // ✅ v1.2: mensagens Z-API não têm downloadSpec, mas têm a URL temporária
      // pública (original_media_url, B2) → download DIRETO inline (comprovado),
      // sem invoke cross-function e sem exigir integrationId.
      const urlTempZapi = msg.metadata?.original_media_url || msg.metadata?.original_temp_url;
      if ((!spec || !integrationId) && isUrlZapi(urlTempZapi)) {
        try {
          const url = await recuperarZapiDireto(base44, msg, urlTempZapi);
          console.log(`[RECUPERAR-MIDIA-WAPI] ✅ Z-API direto msgId=${msg.id}: ${url.substring(0, 60)}`);
          reprocessadas++;
          continue;
        } catch (e) {
          console.error(`[RECUPERAR-MIDIA-WAPI] ❌ Z-API direto msgId=${msg.id}:`, e.message);
          // Só marca failed se AINDA estava pending (não sobrescrever repetidamente)
          if (msg.media_url === 'pending_download') {
            await base44.asServiceRole.entities.Message.update(msg.id, {
              media_url: 'failed_download',
              metadata: { ...(msg.metadata || {}), download_failed_reason: `zapi_direct: ${e.message}`, download_failed_at: new Date().toISOString() }
            }).catch(() => {});
            marcadasFalha++;
          }
          continue;
        }
      }

      // Sem dados para baixar → não há como recuperar: marcar failed_download.
      if (!spec || !integrationId) {
        await base44.asServiceRole.entities.Message.update(msg.id, {
          media_url: 'failed_download',
          metadata: {
            ...(msg.metadata || {}),
            download_failed_reason: 'recuperacao_sem_downloadspec',
            download_failed_at: new Date().toISOString()
          }
        }).catch(() => {});
        marcadasFalha++;
        continue;
      }

      try {
        const resp = await base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
          message_id: msg.id,
          integration_id: integrationId,
          downloadSpec: spec,
          media_type: msg.media_type,
          filename: `${msg.media_type}_${Date.now()}`
        });
        if (resp?.data?.success === true) {
          reprocessadas++;
        } else {
          // Worker já marca failed_download internamente nas falhas definitivas.
          marcadasFalha++;
        }
      } catch (e) {
        console.error(`[RECUPERAR-MIDIA-WAPI] ❌ msgId=${msg.id}:`, e.message);
        const atual = await base44.asServiceRole.entities.Message.get(msg.id).catch(() => null);
        if (atual && atual.media_url === 'pending_download') {
          await base44.asServiceRole.entities.Message.update(msg.id, {
            media_url: 'failed_download',
            metadata: { ...(atual.metadata || {}), download_failed_reason: `recuperacao_erro: ${e.message}`, download_failed_at: new Date().toISOString() }
          }).catch(() => {});
          marcadasFalha++;
        }
      }
    }

    return Response.json({
      success: true,
      version: VERSION,
      total_pendentes: pendentes.length,
      reprocessadas,
      marcadas_falha: marcadasFalha
    }, { headers });

  } catch (error) {
    console.error('[RECUPERAR-MIDIA-WAPI] ❌ ERRO GERAL:', error.message);
    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers });
  }
});