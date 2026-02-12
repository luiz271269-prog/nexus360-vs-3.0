import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// ENVIO EM MASSA - WRAPPER para enviarCampanhaLote
// ============================================================================
// ⚠️ DEPRECATED: Use enviarCampanhaLote com modo='broadcast'
// Mantido para compatibilidade com código legado
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { 
      contact_ids, 
      mensagem, 
      personalizar = true,
      media_url = null,
      media_type = 'none',
      media_caption = null
    } = await req.json();

    // ✅ REDIRECIONAR para função unificada COM MÍDIA
    console.log(`[ENVIO-MASSA] 📤 Redirecionando para enviarCampanhaLote | Mídia: ${media_type}`);
    
    const resultado = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
      contact_ids,
      modo: 'broadcast',
      mensagem,
      personalizar,
      media_url,
      media_type,
      media_caption
    });

    return Response.json(resultado.data);

  } catch (error) {
    console.error('[ENVIO-MASSA] ❌ Erro geral:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});