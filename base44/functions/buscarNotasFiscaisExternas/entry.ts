import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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
        return String(n.data_emissao || '').startsWith(filters.mes_referencia);
      });
    }

    // Resumo financeiro consolidado (ignora espelhos de CI para não somar em dobro).
    // - Faturamento BRUTO exclui NFs anuladas/canceladas (não representam receita).
    // - "vencido" é separado como inadimplência real.
    const STATUS_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
    const r2 = (v) => Math.round(v * 100) / 100;
    const validas = resultado.filter(function(n) {
      return !n.is_espelho_ci && !STATUS_INVALIDOS.includes(n.status);
    });
    const vencidas = validas.filter(function(n) {
      return n.status === 'vencido' || n.status === 'atrasado';
    });
    const sum = (arr, campo) => arr.reduce((s, n) => s + Number(n[campo] || 0), 0);

    const resumo = {
      nfs_validas: validas.length,
      nfs_anuladas_canceladas: resultado.filter(function(n) {
        return STATUS_INVALIDOS.includes(n.status);
      }).length,
      faturamento_bruto: r2(sum(validas, 'valor_total')),
      total_recebido: r2(sum(validas, 'valor_recebido')),
      total_aberto: r2(sum(validas, 'valor_aberto')),
      total_vencido: r2(sum(vencidas, 'valor_aberto')),
      qtd_vencidas: vencidas.length
    };

    return Response.json({ success: true, notas: resultado, total: resultado.length, resumo });
  } catch (error) {
    console.error('[NotasFiscais] Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});