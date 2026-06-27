import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

/**
 * analisarConciliacaoNF — Diagnóstico de conciliação das Notas Fiscais do
 * Neural Fin Flow. NÃO altera nada: apenas LÊ as NFs externas e os Clientes/
 * Contatos do CRM e devolve um raio-x do que está batendo e do que não está.
 *
 * Objetivos:
 *  1. Confirmar conexão real com o Neural Fin (status, total de NFs)
 *  2. Agregar faturamento por mês (usando data_emissao — campo real do schema)
 *  3. Tratar espelhos de CI (is_espelho_ci) para não somar valor em dobro
 *  4. Cruzar cada cliente faturado com o CRM (Cliente + Contact) e classificar
 *     a conciliação: faturado_com_crm | faturado_sem_crm | faturado_sem_contato
 *
 * Payload opcional: { mes?: "2026-06" }  → recorta a análise a um mês de emissão
 */

const EXTERNAL_APP_ID = '69c2ec97bab310deafd37881';

const norm = (v) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '').trim();

const STOPWORDS = new Set([
  'compras', 'comercial', 'vendas', 'financeiro', 'suporte', 'atendimento',
  'ltda', 'me', 'sa', 'eireli', 'epp', 'cia', 'grupo', 'empresa', 'servico',
  'servicos', 'do', 'da', 'de', 'dos', 'das', 'e', 'matriz', 'filial',
  'terminais', 'portuarios', 'alimentos', 'industria', 'comercio', 'saneamento'
]);

const tokensFortes = (v) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mesFiltro = body.mes || null;

    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    if (!apiKey) return Response.json({ error: 'NEURAL_FIN_API_KEY nao configurada' }, { status: 500 });

    // ── 1. Conexão e leitura das NFs ──────────────────────────────────────
    const url = 'https://app.base44.com/api/apps/' + EXTERNAL_APP_ID +
      '/entities/NotaFiscal?sort=-data_emissao&limit=500';
    const resp = await fetch(url, { headers: { api_key: apiKey, 'Content-Type': 'application/json' } });

    const conexao = { http_status: resp.status, ok: resp.ok };
    if (!resp.ok) {
      conexao.error_body = (await resp.text()).substring(0, 300);
      return Response.json({ success: false, conexao });
    }
    const todasNotas = await resp.json();
    conexao.total_notas_recebidas = todasNotas.length;
    conexao.campos_schema = todasNotas.length > 0 ? Object.keys(todasNotas[0]) : [];

    // ── 2. Recorte por mês de EMISSÃO (campo real: data_emissao) ───────────
    const notas = mesFiltro
      ? todasNotas.filter((n) => String(n.data_emissao || '').startsWith(mesFiltro))
      : todasNotas;

    // ── 3. Agregação financeira (tratando espelho de CI) ───────────────────
    // is_espelho_ci=true → é um espelho contábil, não soma faturamento bruto.
    const reais = notas.filter((n) => !n.is_espelho_ci);
    const espelhos = notas.filter((n) => n.is_espelho_ci);

    const soma = (arr, campo) => Math.round(arr.reduce((s, n) => s + Number(n[campo] || 0), 0));

    const porMes = {};
    for (const n of reais) {
      const mes = String(n.data_emissao || '????-??').substring(0, 7);
      if (!porMes[mes]) porMes[mes] = { qtd: 0, total: 0, recebido: 0, aberto: 0 };
      porMes[mes].qtd++;
      porMes[mes].total += Number(n.valor_total || 0);
      porMes[mes].recebido += Number(n.valor_recebido || 0);
      porMes[mes].aberto += Number(n.valor_aberto || 0);
    }
    for (const m of Object.keys(porMes)) {
      porMes[m].total = Math.round(porMes[m].total);
      porMes[m].recebido = Math.round(porMes[m].recebido);
      porMes[m].aberto = Math.round(porMes[m].aberto);
    }

    const porStatus = {};
    for (const n of reais) {
      const st = n.status || 'sem_status';
      if (!porStatus[st]) porStatus[st] = { qtd: 0, valor: 0 };
      porStatus[st].qtd++;
      porStatus[st].valor += Number(n.valor_total || 0);
    }
    for (const s of Object.keys(porStatus)) porStatus[s].valor = Math.round(porStatus[s].valor);

    const financeiro = {
      nfs_reais: reais.length,
      nfs_espelho_ci: espelhos.length,
      total_faturado: soma(reais, 'valor_total'),
      total_recebido: soma(reais, 'valor_recebido'),
      total_aberto: soma(reais, 'valor_aberto'),
      por_status: porStatus,
      por_mes_emissao: porMes
    };

    // ── 4. Conciliação cliente-a-cliente com o CRM ─────────────────────────
    const [clientes, contatos] = await Promise.all([
      base44.asServiceRole.entities.Cliente.list('-updated_date', 3000),
      base44.asServiceRole.entities.Contact.list('-updated_date', 5000)
    ]);

    // Agrupar NFs por cliente faturado (razão social da NF)
    const porCliente = {};
    for (const n of reais) {
      const nome = n.cliente || '(sem nome)';
      if (!porCliente[nome]) porCliente[nome] = { nf_qtd: 0, faturado: 0, aberto: 0, vendedor: n.vendedor };
      porCliente[nome].nf_qtd++;
      porCliente[nome].faturado += Number(n.valor_total || 0);
      porCliente[nome].aberto += Number(n.valor_aberto || 0);
    }

    const achaCliente = (nomeNF) => {
      const nNorm = norm(nomeNF);
      const toks = tokensFortes(nomeNF);
      return clientes.find((c) => {
        const r = norm(c.razao_social), f = norm(c.nome_fantasia);
        if (r === nNorm || f === nNorm) return true;
        if (toks.length && toks.some((t) => r.includes(t) || f.includes(t))) return true;
        return false;
      }) || null;
    };
    const achaContato = (nomeNF) => {
      const nNorm = norm(nomeNF);
      const toks = tokensFortes(nomeNF);
      return contatos.find((c) => {
        const e = norm(c.empresa), nm = norm(c.nome);
        if (e && (e === nNorm || (e.length >= 5 && nNorm.length >= 5 && (e.includes(nNorm) || nNorm.includes(e))))) return true;
        if (toks.length && toks.some((t) => e.includes(t) || nm.includes(t))) return true;
        return false;
      }) || null;
    };

    const detalhe = [];
    const resumo = { faturado_com_crm: 0, faturado_sem_cliente_crm: 0, faturado_sem_contato_whatsapp: 0 };

    for (const [nome, dados] of Object.entries(porCliente)) {
      const cli = achaCliente(nome);
      const cont = achaContato(nome);
      let classificacao;
      if (cli && cont) { classificacao = 'faturado_com_crm'; resumo.faturado_com_crm++; }
      else if (!cli) { classificacao = 'faturado_sem_cliente_crm'; resumo.faturado_sem_cliente_crm++; }
      else { classificacao = 'faturado_sem_contato_whatsapp'; resumo.faturado_sem_contato_whatsapp++; }

      detalhe.push({
        cliente_nf: nome,
        vendedor: dados.vendedor,
        nf_qtd: dados.nf_qtd,
        faturado: Math.round(dados.faturado),
        aberto: Math.round(dados.aberto),
        classificacao,
        cliente_crm_id: cli?.id || null,
        contato_crm_id: cont?.id || null,
        contato_tem_telefone: cont ? !!(cont.telefone || cont.telefone_canonico) : false
      });
    }

    detalhe.sort((a, b) => b.faturado - a.faturado);

    return Response.json({
      success: true,
      gerado_em: new Date().toISOString(),
      mes_filtro: mesFiltro,
      conexao,
      financeiro,
      conciliacao_crm: {
        clientes_faturados_unicos: Object.keys(porCliente).length,
        clientes_crm_total: clientes.length,
        contatos_crm_total: contatos.length,
        resumo,
        detalhe
      }
    });
  } catch (error) {
    console.error('[analisarConciliacaoNF] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});