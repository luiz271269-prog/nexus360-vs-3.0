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

const VERSION = 'v1.7.0-PARALELO-RESILIENTE';
const IDADE_MINIMA_MIN = 2;    // só mexe no que está pendente há ≥ 2 min
const IDADE_MAXIMA_MIN = 43200; // 30 dias — limite oficial da Z-API (developer.z-api.io/tips/file-expiration); W-API regenera link via mediaKey/directPath
const LOTE = 5;                 // itens por rodada (processados em PARALELO)
const TIMEOUT_ITEM_MS = 30_000; // teto no invoke do worker W-API (fallback)
const TETO_ITEM_MS = 60_000;    // teto ABSOLUTO por item (direto 25s + worker 30s + folga)

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
async function recuperarZapiDireto(base44, msg, urlTemp, updateMensagemApi) {
  const t0 = Date.now();
  const marca = (etapa) => console.log(`[RECUPERAR-MIDIA-WAPI] [trace ${String(msg.id).slice(-6)}] ${etapa} +${Date.now() - t0}ms`);
  marca('inicio');
  // ✅ v1.7: 2 tentativas com backoff curto — protege contra oscilação de rede.
  // URL morta (404/410/403) aborta na hora: re-tentar não resolve.
  let dl = null;
  let ultimoErro = null;
  for (let t = 1; t <= 2; t++) {
    try {
      const dlTry = await fetch(urlTemp, { signal: AbortSignal.timeout(15000) });
      if (!dlTry.ok) throw new Error(`http_${dlTry.status}`);
      dl = dlTry;
      break;
    } catch (e) {
      ultimoErro = e;
      if (/http_(404|410|403)/.test(e.message)) throw e;
      if (t < 2) await new Promise(r => setTimeout(r, 1500));
    }
  }
  if (!dl) throw ultimoErro || new Error('download_falhou');
  marca('fetch_ok');
  const buf = await dl.arrayBuffer();
  marca(`body_ok ${buf.byteLength}b`);
  if (!buf.byteLength) throw new Error('arquivo_vazio');
  const ct = (dl.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
  const ext = MIME_EXT[ct] || DEFAULT_EXT[msg.media_type] || 'bin';
  const file = new File([buf], `zapi_rec_${String(msg.id).slice(-8)}.${ext}`, { type: ct });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  marca('upload_ok');
  if (!up?.file_url) throw new Error('upload_sem_file_url');
  // ✅ Update via API direta (SDK trava pós-upload)
  await updateMensagemApi(msg.id, {
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

// ✅ v1.5: Download DIRETO W-API (mesmo método da recuperação manual comprovada):
// pede fileLink novo ao provedor (download-media) e baixa, com 3 tentativas e
// backoff 2s/4s — sem invoke cross-function (evita 502/timeout do worker).
async function recuperarWapiDireto(base44, msg, integ, spec, updateMensagemApi) {
  const baseUrl = (integ.base_url_provider || 'https://api.w-api.app/v1').replace(/\/+$/, '');
  // ✅ v1.6 FIX CAUSA-RAIZ: teto DURO de 25s para todo o processo deste item.
  // Antes: 3×(12s+15s)+backoffs = até ~87s num item só → runtime matava a função (502).
  const deadline = Date.now() + 25_000;
  let dl = null;
  let ultimoErro = null;
  for (let t = 1; t <= 3; t++) {
    if (Date.now() > deadline) { ultimoErro = ultimoErro || new Error('deadline_item_25s'); break; }
    try {
      const resp = await fetch(`${baseUrl}/message/download-media?instanceId=${integ.instance_id_provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
        body: JSON.stringify({ mediaKey: spec.mediaKey, directPath: spec.directPath, type: spec.type, mimetype: spec.mimetype }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await resp.json().catch(() => ({}));
      const link = data.fileLink || data.link || data.url;
      if (!resp.ok || !link) throw new Error(`download-media sem fileLink (status ${resp.status})`);
      const dlTry = await fetch(link, { signal: AbortSignal.timeout(12000) });
      if (!dlTry.ok) throw new Error(`fileLink status ${dlTry.status}`);
      dl = dlTry;
      break;
    } catch (e) {
      ultimoErro = e;
      if (t < 3 && Date.now() < deadline) await new Promise(r => setTimeout(r, t * 2000));
    }
  }
  if (!dl) throw ultimoErro || new Error('download_direto_falhou');
  const buf = await dl.arrayBuffer();
  if (!buf.byteLength) throw new Error('arquivo_vazio');
  const ct = (dl.headers.get('content-type') || spec.mimetype || 'application/octet-stream').split(';')[0].trim();
  const ext = MIME_EXT[ct] || DEFAULT_EXT[msg.media_type] || 'bin';
  const file = new File([buf], `wapi_rec_${String(msg.id).slice(-8)}.${ext}`, { type: ct });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  if (!up?.file_url) throw new Error('upload_sem_file_url');
  // ✅ Update via API direta (SDK trava pós-upload)
  await updateMensagemApi(msg.id, {
    media_url: up.file_url,
    metadata: {
      ...(msg.metadata || {}),
      midia_persistida: true,
      persisted_at: new Date().toISOString(),
      persist_method: 'watchdog_wapi_direct',
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

    // ✅ WORKAROUND CAUSA-RAIZ (jul/2026): após UploadFile, o cliente SDK trava
    // em QUALQUER chamada de entidade (update nunca resolve → runtime mata a
    // função e a mídia volta a ficar pendente). Updates pós-upload usam a API
    // REST direta, comprovada em diagnóstico.
    const appId = Deno.env.get('BASE44_APP_ID');
    const apiHeaders = {
      'Authorization': req.headers.get('authorization') || '',
      'api_key': req.headers.get('api_key') || '',
      'Content-Type': 'application/json'
    };
    const msgApiUrl = (id) => `https://base44.app/api/apps/${appId}/entities/Message/${id}`;
    const getMensagemApi = async (id) => {
      try {
        const r = await fetch(msgApiUrl(id), { headers: apiHeaders, signal: AbortSignal.timeout(15000) });
        return r.ok ? await r.json() : null;
      } catch (_) { return null; }
    };
    const updateMensagemApi = async (id, data) => {
      const r = await fetch(msgApiUrl(id), {
        method: 'PUT',
        headers: apiHeaders,
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error(`update_api_http_${r.status}`);
    };

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
      !m.metadata?.recuperacao_esgotada && (
        (m.metadata?.downloadSpec && m.metadata?.whatsapp_integration_id) ||
        isUrlZapi(m.metadata?.original_media_url || m.metadata?.original_temp_url)
      )
    );

    // Z-API direto é rápido (~1-2s) — vai primeiro para não ser starved pelos invokes W-API (até 30s)
    const ehZapiRapida = (m) => isUrlZapi(m.metadata?.original_media_url || m.metadata?.original_temp_url);
    const candidatas = [...pendentesRaw, ...falhadas];
    const pendentes = [...candidatas.filter(ehZapiRapida), ...candidatas.filter(m => !ehZapiRapida(m))].slice(0, LOTE);

    console.log(`[RECUPERAR-MIDIA-WAPI] ${VERSION} | pendentes=${pendentesRaw.length} | failed_recuperáveis=${falhadas.length} | lote=${pendentes.length}`);

    // ✅ v1.7: itens processados em PARALELO — o tempo total é o do item mais
    // lento (máx 60s), nunca a soma de todos. Um item com internet lenta não
    // trava os demais nem derruba a função.
    const processarMensagem = async (msg) => {
      const spec = msg.metadata?.downloadSpec;
      const integrationId = msg.metadata?.whatsapp_integration_id;

      // ✅ v1.2: mensagens Z-API não têm downloadSpec, mas têm a URL temporária
      // pública (original_media_url, B2) → download DIRETO inline (comprovado),
      // sem invoke cross-function e sem exigir integrationId.
      const urlTempZapi = msg.metadata?.original_media_url || msg.metadata?.original_temp_url;
      if ((!spec || !integrationId) && isUrlZapi(urlTempZapi)) {
        try {
          const url = await recuperarZapiDireto(base44, msg, urlTempZapi, updateMensagemApi);
          console.log(`[RECUPERAR-MIDIA-WAPI] ✅ Z-API direto msgId=${msg.id}: ${url.substring(0, 60)}`);
          return 'ok';
        } catch (e) {
          console.error(`[RECUPERAR-MIDIA-WAPI] ❌ Z-API direto msgId=${msg.id}:`, e.message);
          // URL morta (404/410/403): esgotar — nunca mais re-tentar (parava o lote para sempre)
          const urlMorta = /http_(404|410|403)/.test(e.message);
          // ✅ API direta: o SDK pode estar travado se o UploadFile chegou a rodar
          await updateMensagemApi(msg.id, {
            media_url: 'failed_download',
            metadata: {
              ...(msg.metadata || {}),
              download_failed_reason: `zapi_direct: ${e.message}`,
              download_failed_at: new Date().toISOString(),
              ...(urlMorta ? { recuperacao_esgotada: true } : {})
            }
          }).catch(() => {});
          return 'falha';
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
        return 'falha';
      }

      // ✅ v1.5: MÉTODO DIRETO primeiro (igual à recuperação manual comprovada)
      if (spec.mediaKey && spec.directPath) {
        try {
          const integ = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
          const url = await recuperarWapiDireto(base44, msg, integ, spec, updateMensagemApi);
          console.log(`[RECUPERAR-MIDIA-WAPI] ✅ W-API direto msgId=${msg.id}: ${url.substring(0, 60)}`);
          return 'ok';
        } catch (e) {
          console.warn(`[RECUPERAR-MIDIA-WAPI] ⚠️ W-API direto falhou (${e.message}) — fallback para worker | msgId=${msg.id}`);
        }
      }

      try {
        // Uma tentativa por item, com teto de 30s — o worker interno já tem retries próprios
        const resp = await Promise.race([
          base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
            message_id: msg.id,
            integration_id: integrationId,
            downloadSpec: spec,
            media_type: msg.media_type,
            filename: `${msg.media_type}_${Date.now()}`
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout_item_30s')), TIMEOUT_ITEM_MS))
        ]);
        // Worker já marca failed_download internamente nas falhas definitivas.
        return resp?.data?.success === true ? 'ok' : 'falha';
      } catch (e) {
        console.error(`[RECUPERAR-MIDIA-WAPI] ❌ msgId=${msg.id}:`, e.message);
        const atual = await getMensagemApi(msg.id);
        if (atual && atual.media_url === 'pending_download') {
          await updateMensagemApi(msg.id, {
            media_url: 'failed_download',
            metadata: { ...(atual.metadata || {}), download_failed_reason: `recuperacao_erro: ${e.message}`, download_failed_at: new Date().toISOString() }
          }).catch(() => {});
        }
        return 'falha';
      }
    };

    // Teto duro ABSOLUTO por item: se estourar, a mensagem NÃO é marcada como
    // falha — continua pendente e é retomada na próxima rodada (a cada 10min).
    const resultados = await Promise.allSettled(pendentes.map((msg) =>
      Promise.race([
        processarMensagem(msg),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`teto_item_${TETO_ITEM_MS / 1000}s`)), TETO_ITEM_MS))
      ])
    ));
    const reprocessadas = resultados.filter(r => r.status === 'fulfilled' && r.value === 'ok').length;
    const marcadasFalha = resultados.filter(r => r.status === 'fulfilled' && r.value === 'falha').length;
    const adiadas = resultados.filter(r => r.status === 'rejected').length;
    if (adiadas > 0) {
      console.warn(`[RECUPERAR-MIDIA-WAPI] ⏱️ ${adiadas} item(ns) estouraram o teto de ${TETO_ITEM_MS / 1000}s — ficam para a próxima rodada`);
    }

    return Response.json({
      success: true,
      version: VERSION,
      total_pendentes: pendentes.length,
      reprocessadas,
      marcadas_falha: marcadasFalha,
      adiadas
    }, { headers });

  } catch (error) {
    console.error('[RECUPERAR-MIDIA-WAPI] ❌ ERRO GERAL:', error.message);
    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers });
  }
});