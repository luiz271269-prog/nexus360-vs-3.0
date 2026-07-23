import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// ============================================================================
// SANEAR MÍDIAS PENDENTES - v1.0.0
// ============================================================================
// Varre mensagens travadas em 'pending_download' (Z-API e W-API) e resolve:
// - W-API com downloadSpec  → reinvoca persistirMidiaWapi com payload completo
// - Z-API com URL temporária → reinvoca persistirMidiaZapi e grava a URL final
// - Sem dados recuperáveis ou >24h → marca failed_download (para o spinner na UI)
// Filtro de data feito EM MEMÓRIA (o filtro created_date no banco não casa com
// o formato armazenado sem timezone).
// ============================================================================

const VERSION = 'v1.0.0';
const IDADE_MAXIMA_MS = 24 * 60 * 60 * 1000;
const LOTE = 20;

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    }

    const agora = Date.now();
    const pendentes = await base44.asServiceRole.entities.Message.filter(
      { media_url: 'pending_download' }, '-created_date', 100
    );

    const resultados = { recuperadas: 0, marcadas_falha: 0, erros: 0, detalhes: [] as any[] };

    for (const msg of pendentes.slice(0, LOTE)) {
      const idade = agora - new Date(msg.created_date).getTime();
      const meta = msg.metadata || {};
      const marcaFalha = async (motivo: string) => {
        await base44.asServiceRole.entities.Message.update(msg.id, {
          media_url: 'failed_download',
          metadata: { ...meta, download_failed_reason: motivo, download_failed_at: new Date().toISOString() }
        }).catch(() => {});
        resultados.marcadas_falha++;
        resultados.detalhes.push({ id: msg.id, acao: 'failed', motivo });
      };

      try {
        if (meta.downloadSpec && meta.whatsapp_integration_id) {
          // W-API
          if (idade > IDADE_MAXIMA_MS) { await marcaFalha('expirada_24h'); continue; }
          const r = await base44.asServiceRole.functions.invoke('persistirMidiaWapi', {
            message_id: msg.id,
            integration_id: meta.whatsapp_integration_id,
            downloadSpec: meta.downloadSpec,
            media_type: msg.media_type,
            filename: `${msg.media_type}_${Date.now()}`
          }).catch((e: any) => ({ data: { success: false, error: e.message } }));
          if (r?.data?.success) {
            resultados.recuperadas++;
            resultados.detalhes.push({ id: msg.id, acao: 'wapi_ok' });
          } else {
            await marcaFalha(`wapi_erro: ${r?.data?.error || 'desconhecido'}`);
          }
          continue;
        }

        const tempUrl = meta.original_media_url || meta.original_temp_url;
        if (tempUrl && meta.whatsapp_integration_id) {
          // Z-API
          if (idade > IDADE_MAXIMA_MS) { await marcaFalha('expirada_24h'); continue; }
          const r = await base44.asServiceRole.functions.invoke('persistirMidiaZapi', {
            file_id: msg.whatsapp_message_id || `msg_${msg.id}`,
            integration_id: meta.whatsapp_integration_id,
            media_type: msg.media_type,
            media_url: tempUrl,
            message_id: msg.id,
            filename: `${msg.media_type}_recebido`
          }).catch((e: any) => ({ data: { success: false, error: e.message } }));
          const urlFinal = r?.data?.url || r?.data?.file_url;
          if (urlFinal) {
            await base44.asServiceRole.entities.Message.update(msg.id, {
              media_url: urlFinal,
              metadata: { ...meta, midia_persistida: true, persisted_at: new Date().toISOString() }
            });
            resultados.recuperadas++;
            resultados.detalhes.push({ id: msg.id, acao: 'zapi_ok' });
          } else {
            await marcaFalha(`zapi_erro: ${r?.data?.error || 'sem url'}`);
          }
          continue;
        }

        // Sem dados para recuperar
        await marcaFalha('sem_downloadspec_nem_url_temporaria');
      } catch (e: any) {
        resultados.erros++;
        resultados.detalhes.push({ id: msg.id, acao: 'erro', motivo: e.message });
      }
    }

    console.log(`[SANEAR-MIDIAS] ${VERSION} | pendentes=${pendentes.length} | recuperadas=${resultados.recuperadas} | falhas=${resultados.marcadas_falha}`);
    return Response.json({ success: true, version: VERSION, total_pendentes: pendentes.length, ...resultados }, { headers });
  } catch (error: any) {
    console.error('[SANEAR-MIDIAS] ❌ ERRO GERAL:', error.message);
    return Response.json({ success: false, error: error.message, version: VERSION }, { status: 500, headers });
  }
});