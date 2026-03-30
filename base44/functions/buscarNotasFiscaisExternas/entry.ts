import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const filters = body.filters || {};

    const baseUrl = 'https://app.base44.com/api/apps/' + EXTERNAL_APP_ID + '/entities';
    const url = baseUrl + '/NotaFiscal?sort=-data_emissao&limit=500';

    const resp = await fetch(url, {
      headers: {
        'api_key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[NotasFiscais] HTTP ' + resp.status + ':', errText.substring(0, 200));
      return Response.json({ error: 'Erro ' + resp.status }, { status: resp.status });
    }

    const notas = await resp.json();
    console.log('[NotasFiscais] OK - ' + notas.length + ' notas carregadas');

    let resultado = notas;
    if (filters.mes_referencia) {
      resultado = notas.filter(function(n) {
        return (n.mes_referencia || n.data_emissao || '').startsWith(filters.mes_referencia);
      });
    }

    return Response.json({ success: true, notas: resultado, total: resultado.length });
  } catch (error) {
    console.error('[NotasFiscais] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});