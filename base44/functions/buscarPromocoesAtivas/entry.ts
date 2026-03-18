import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// BUSCAR PROMOÇÕES ATIVAS - v2.0.0 (Alinhado com Promotion Engine)
// ============================================================================
// Busca promoções para uso em Playbooks/URA, respeitando bloqueios de setor
// ============================================================================

const VERSION = 'v2.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Setores/Contextos que NUNCA devem ver promoções
const BLOCKED_CONTEXTS = ['financeiro', 'cobranca', 'compras', 'fornecedor', 'fornecedores'];

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

  const { limite = 5, categoria = null, integration_id = null, setor_atual = null } = payload;

  try {
    // 1. Bloqueio Imediato por Contexto
    if (setor_atual) {
      const setorKey = String(setor_atual).toLowerCase();
      if (BLOCKED_CONTEXTS.some(b => setorKey.includes(b))) {
        console.log(`[BUSCAR-PROMOCOES] 🚫 Bloqueado por contexto: ${setorKey}`);
        return Response.json({
          success: true,
          texto_formatado: '',
          promocoes: [],
          count: 0,
          status: 'blocked_context'
        }, { headers: corsHeaders });
      }
    }

    const hoje = new Date().toISOString().split('T')[0];

    // 2. Filtros base (Nomenclatura PT-BR conforme Promotion.json)
    const filtros = {
      ativo: true
    };

    // Adicionar filtro de categoria se fornecido
    if (categoria) {
      filtros.categoria = categoria;
    }

    // 3. Buscar promoções ativas (buscar mais para filtrar em memória)
    const promocoes = await base44.asServiceRole.entities.Promotion.filter(
      filtros,
      '-priority',
      20
    );

    // 4. Filtragem Fina (Lógica de Negócio)
    const promocoesValidas = promocoes.filter(promo => {
      // A. Validade
      if (promo.validade && promo.validade < hoje) return false;
      
      // B. Filtro por Integração/Canal (se especificado)
      if (integration_id && promo.conexoes_permitidas && Array.isArray(promo.conexoes_permitidas) && promo.conexoes_permitidas.length > 0) {
        if (!promo.conexoes_permitidas.includes(integration_id)) return false;
      }
      
      // C. Filtro por Setor Alvo
      if (setor_atual && promo.target_sectors && Array.isArray(promo.target_sectors) && promo.target_sectors.length > 0) {
        const setorNormalizado = String(setor_atual).toLowerCase();
        const alvoEncontrado = promo.target_sectors.some(s => setorNormalizado.includes(s.toLowerCase()));
        if (!alvoEncontrado) return false;
      }
      
      return true;
    });

    // Limitar quantidade final
    const resultadoFinal = promocoesValidas.slice(0, limite);

    if (resultadoFinal.length === 0) {
      return Response.json({
        success: true,
        texto_formatado: 'No momento não temos promoções ativas para este perfil.',
        promocoes: [],
        count: 0
      }, { headers: corsHeaders });
    }

    // 5. Formatação para WhatsApp (Estilo Lista)
    let textoFinal = '';
    
    resultadoFinal.forEach((oferta, index) => {
      textoFinal += `\n━━━━━━━━━━━━━━━━\n`;
      textoFinal += `📢 *${oferta.titulo}*`;
      
      // Usa descrição curta se existir, senão a normal
      const desc = oferta.descricao_curta || oferta.descricao;
      if (desc) textoFinal += `\n${desc}`;
      
      if (oferta.price_info) {
        textoFinal += `\n💰 ${oferta.price_info}`;
      }
      
      if (oferta.campaign_id) {
        textoFinal += `\n🎟️ Código: ${oferta.campaign_id}`;
      }
      
      if (oferta.link_produto) {
        textoFinal += `\n🔗 ${oferta.link_produto}`;
      }
    });
    
    textoFinal += `\n━━━━━━━━━━━━━━━━`;

    console.log(`[BUSCAR-PROMOCOES] ✅ Retornadas ${resultadoFinal.length} ofertas (Contexto: ${setor_atual || 'Geral'})`);

    return Response.json({
      success: true,
      texto_formatado: textoFinal.trim(),
      promocoes: resultadoFinal.map(p => ({
        id: p.id,
        titulo: p.titulo,
        imagem: p.imagem_url || null
      })),
      count: resultadoFinal.length,
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