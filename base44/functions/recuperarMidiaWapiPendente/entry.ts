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

const VERSION = 'v1.1.0-ZAPI-RECOVERY';
const IDADE_MINIMA_MIN = 10;   // só mexe no que está pendente há ≥ 10 min
const IDADE_MAXIMA_MIN = 1440; // ignora muito antigo (>24h): URL já expirou
const LOTE = 20;

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
    // Só reprocessa falhadas que preservaram downloadSpec (sem ele não há o que baixar)
    const falhadas = falhadasRaw.filter(m => m.metadata?.downloadSpec && m.metadata?.whatsapp_integration_id);

    const pendentes = [...pendentesRaw, ...falhadas];

    console.log(`[RECUPERAR-MIDIA-WAPI] ${VERSION} | pendentes=${pendentesRaw.length} | failed_recuperáveis=${falhadas.length}`);

    let reprocessadas = 0;
    let marcadasFalha = 0;

    for (const msg of pendentes) {
      const spec = msg.metadata?.downloadSpec;
      const integrationId = msg.metadata?.whatsapp_integration_id;

      // ✅ v1.1: mensagens Z-API não têm downloadSpec, mas têm a URL temporária
      // pública (original_media_url, B2) → recuperar via persistirMidiaZapi.
      const urlTempZapi = msg.metadata?.original_media_url;
      if ((!spec || !integrationId) && urlTempZapi && integrationId) {
        try {
          const respZ = await base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
            message_id: msg.id,
            integration_id: integrationId,
            file_id: msg.whatsapp_message_id || msg.id,
            media_url: urlTempZapi,
            media_type: msg.media_type,
            filename: `${msg.media_type}_${Date.now()}`
          });
          if (respZ?.data?.success === true) { reprocessadas++; continue; }
        } catch (e) {
          console.error(`[RECUPERAR-MIDIA-WAPI] ❌ Z-API msgId=${msg.id}:`, e.message);
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