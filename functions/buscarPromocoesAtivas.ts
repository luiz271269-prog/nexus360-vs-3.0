import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// BUSCAR PROMOÇÕES ATIVAS - v1.0.0
// ============================================================================
// Função que busca e formata promoções ativas para uso em Playbooks
// ============================================================================

const VERSION = 'v1.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    payload = {};
  }

  const { limite = 5, categoria = null } = payload;

  try {
    const hoje = new Date().toISOString().split('T')[0];

    // Filtros base
    const filtros = {
      active: true
    };

    // Adicionar filtro de categoria se fornecido
    if (categoria) {
      filtros.categoria = categoria;
    }

    // Buscar promoções ativas
    const promocoes = await base44.asServiceRole.entities.Promotion.filter(
      filtros,
      '-priority',
      limite
    );

    // Filtrar manualmente as que não expiraram
    const promocoesValidas = promocoes.filter(promo => {
      if (!promo.valid_until) return true;
      return promo.valid_until >= hoje;
    });

    if (promocoesValidas.length === 0) {
      return Response.json({
        success: true,
        texto_formatado: '',
        promocoes: [],
        count: 0
      }, { headers: corsHeaders });
    }

    // Formatar para WhatsApp
    let textoFinal = '';
    promocoesValidas.forEach((oferta, index) => {
      textoFinal += `\n⭐ *${oferta.title}*`;
      textoFinal += `\n   ${oferta.short_description}`;
      
      if (oferta.price_info) {
        textoFinal += `\n   💰 ${oferta.price_info}`;
      }
      
      if (oferta.codigo_campanha) {
        textoFinal += `\n   🎟️ Código: ${oferta.codigo_campanha}`;
      }
      
      textoFinal += '\n';
    });

    console.log(`[BUSCAR-PROMOCOES] ✅ Encontradas ${promocoesValidas.length} promoções ativas`);

    return Response.json({
      success: true,
      texto_formatado: textoFinal.trim(),
      promocoes: promocoesValidas,
      count: promocoesValidas.length,
      version: VERSION
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[BUSCAR-PROMOCOES] ❌ Erro:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      texto_formatado: '',
      promocoes: [],
      count: 0
    }, { status: 500, headers: corsHeaders });
  }
});