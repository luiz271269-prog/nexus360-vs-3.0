import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// RESPONDER ACESSO RÁPIDO — NO-OP SEGURO (DEPRECATED)
// ============================================================================
// O submenu de destinos agora usa BOTÕES DE URL ↗ (enviarCartaoAcesso
// acao:'submenu'). O cliente toca e o navegador abre o link direto — o webhook
// NÃO volta mais com um rowId "acesso_rapido:ID" para o sistema responder.
//
// Esta função permanece como no-op idempotente para não quebrar qualquer
// chamada legada que ainda aponte para 'responderAcessoRapido'. Não envia nada.
// ============================================================================

Deno.serve(async (req) => {
  try {
    // Garante que requests legadas não causem erro; nada é enviado.
    await req.json().catch(() => ({}));
    return Response.json({ success: true, skipped: 'deprecated_submenu_agora_usa_botoes_url' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});