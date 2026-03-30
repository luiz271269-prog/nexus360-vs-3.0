import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';
const EXTERNAL_API_URL = `https://api.base44.com/api/apps/${EXTERNAL_APP_ID}/entities/NotaFiscal`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key não configurada' }, { status: 500 });

    const { filters = {} } = await req.json().catch(() => ({}));

    // Montar query string de filtros (status, vendedor, etc)
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('limit', '500');

    const url = `${EXTERNAL_API_URL}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'api_key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[NotasFiscaisExternas] Erro:', response.status, err);
      return Response.json({ error: `Erro na API externa: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const notas = Array.isArray(data) ? data : (data.data || data.items || []);

    console.log(`[NotasFiscaisExternas] ${notas.length} notas carregadas`);

    return Response.json({ success: true, notas });
  } catch (error) {
    console.error('[NotasFiscaisExternas] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});