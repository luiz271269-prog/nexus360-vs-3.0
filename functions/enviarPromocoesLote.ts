import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// ENVIO PROMOÇÕES LOTE - WRAPPER para enviarCampanhaLote
// ============================================================================
// ⚠️ DEPRECATED: Use enviarCampanhaLote com modo='promocao'
// Mantido para compatibilidade com código legado
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.json();
    const { contact_ids = [], delay_minutos = 5 } = body;

    // ✅ REDIRECIONAR para função unificada
    console.log(`[PROMO-LOTE] 🔄 Redirecionando para enviarCampanhaLote (modo: promocao)`);
    
    const resultado = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
      contact_ids,
      modo: 'promocao',
      delay_minutos
    });

    return Response.json(resultado.data);

  } catch (error) {
    console.error('[PROMO-LOTE] ERRO GERAL:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});