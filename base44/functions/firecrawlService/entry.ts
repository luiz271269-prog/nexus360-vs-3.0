import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Whitelist de domínios confiáveis
const WHITELIST_DOMAINS = [
  'mercadolivre.com.br',
  'amazon.com.br',
  'magazineluiza.com.br',
  'americanas.com.br',
  'casasbahia.com.br',
  'extra.com.br',
  'submarino.com.br',
  'pontofrio.com.br',
  'shopee.com.br',
  'aliexpress.com',
  // Adicionar mais conforme necessário
];

// Hash SHA-256
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Estimativa de tokens
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Verificar se domínio está na whitelist
function isDomainWhitelisted(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return WHITELIST_DOMAINS.some(allowed => domain.includes(allowed));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, url, force_refresh = false } = await req.json();

    if (action === 'scrape') {
      // 1. Validar domínio
      if (!isDomainWhitelisted(url)) {
        return Response.json({
          success: false,
          error: 'Domínio não autorizado',
          url
        }, { status: 403 });
      }

      // 2. Verificar cache (a menos que force_refresh)
      const hash = await sha256(url);
      
      if (!force_refresh) {
        const cached = await base44.asServiceRole.entities.ExternalSourceCache.filter({
          source_url_hash: hash,
          expires_at: { $gte: new Date().toISOString() },
          success: true
        });

        if (cached.length > 0) {
          console.log('[FIRECRAWL] ✅ Cache hit:', url);
          return Response.json({
            success: true,
            cached: true,
            data: cached[0]
          });
        }
      }

      // 3. Fetch via Firecrawl (simulado por enquanto - adicionar API key quando disponível)
      const startTime = Date.now();
      
      // TODO: Integração real com Firecrawl API
      // const firecrawl = new Firecrawl({ apiKey: Deno.env.get("FIRECRAWL_API_KEY") });
      // const result = await firecrawl.scrapeUrl(url, { formats: ['markdown', 'html'] });
      
      // Por enquanto, fetch simples (placeholder)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NexusAI/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const duration = Date.now() - startTime;

      // Extração básica de metadata (placeholder - Firecrawl fará isso melhor)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      
      const metadata = {
        domain: new URL(url).hostname,
        title: titleMatch ? titleMatch[1] : '',
        description: descMatch ? descMatch[1] : ''
      };

      // 4. Cachear resultado
      const cacheEntry = await base44.asServiceRole.entities.ExternalSourceCache.create({
        source_url: url,
        source_url_hash: hash,
        source_type: 'web_scrape',
        content_text: html.substring(0, 50000), // Limitar para não explodir DB
        content_structured: metadata,
        metadata,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        fetch_duration_ms: duration,
        token_count: estimateTokens(html),
        success: true
      });

      console.log(`[FIRECRAWL] ✅ Scraped ${url} (${duration}ms, ${cacheEntry.token_count} tokens)`);

      return Response.json({
        success: true,
        cached: false,
        data: cacheEntry
      });
    }

    return Response.json({
      success: false,
      error: 'Ação não suportada'
    }, { status: 400 });

  } catch (error) {
    console.error('[FIRECRAWL] ❌ Erro:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});