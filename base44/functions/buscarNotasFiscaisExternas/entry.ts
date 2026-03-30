import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key não configurada' }, { status: 500 });

    const { filters = {} } = await req.json().catch(() => ({}));

    const params = new URLSearchParams({ limit: '500' });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    // Formato exato do código original fornecido pelo usuário
    const url = `https://app.base44.com/api/apps/${EXTERNAL_APP_ID}/entities/NotaFiscal?${params}`;

    const response = await fetch(url, {
      headers: {
        'api_key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const body = await response.text();
    console.log(`[NotasFiscaisExternas] Status: ${response.status}`);
    console.log(`[NotasFiscaisExternas] Body preview: ${body.substring(0, 300)}`);

    if (!response.ok) {
      return Response.json({ error: `HTTP ${response.status}`, detail: body }, { status: 502 });
    }

    const data = JSON.parse(body);
    const notas = Array.isArray(data) ? data : (data.data || data.items || data.results || []);

    console.log(`[NotasFiscaisExternas] ${notas.length} notas carregadas`);
    return Response.json({ success: true, notas, total: notas.length });
  } catch (error) {
    console.error('[NotasFiscaisExternas] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});