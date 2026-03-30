import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.23';

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceToken = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!serviceToken) return Response.json({ error: 'NEURAL_FIN_API_KEY não configurada' }, { status: 500 });

    const { filters = {} } = await req.json().catch(() => ({}));

    // SDK Base44 com serviceToken para app externo
    const externalClient = createClient(EXTERNAL_APP_ID, { serviceToken });

    const notas = await externalClient.asServiceRole.entities.NotaFiscal.list('-data_emissao', 500);
    console.log(`[NotasFiscais] ✅ ${notas.length} notas carregadas`);

    // Filtro local por mês se solicitado
    let resultado = notas;
    if (filters.mes_referencia) {
      resultado = notas.filter(n => (n.mes_referencia || n.data_emissao || '').startsWith(filters.mes_referencia));
    }

    return Response.json({ success: true, notas: resultado, total: resultado.length });
  } catch (error) {
    console.error('[NotasFiscais] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});