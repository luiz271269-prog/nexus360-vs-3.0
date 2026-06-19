import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================
// VÍNCULO AUTOMÁTICO CONTATO -> CLIENTE (CRM)
// ==========================================
// Casa um Contact com um Cliente do CRM.
// Estratégia: EMPRESA/NOME primeiro, TELEFONE como reforço.
// - Match EXATO (empresa idêntica normalizada OU telefone idêntico) => vincula sozinho.
// - Match parcial => não vincula, devolve sugestões para o atendente confirmar.
// Nunca sobrescreve um cliente_id já existente.

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '')        // só letras+números
    .trim();

// Stopwords comerciais genéricas — não identificam uma empresa específica.
const STOPWORDS = new Set([
  'compras', 'comercial', 'vendas', 'financeiro', 'suporte', 'atendimento',
  'ed', 'edu', 'educacao', 'educacional', 'infantil', 'comunidade', 'central',
  'ltda', 'me', 'sa', 'eireli', 'epp', 'cia', 'grupo', 'empresa', 'servico',
  'servicos', 'social', 'do', 'da', 'de', 'dos', 'das', 'e', 'matriz', 'filial'
]);

// Tokens significativos de um texto livre (>=4 chars, fora das stopwords).
// Ex: "Compras Ed. Infantil Sesc" -> ['sesc']
const tokensFortes = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
// últimos 8 dígitos = núcleo do telefone (ignora DDI/DDD/nono dígito)
const nucleoTel = (v) => {
  const d = soDigitos(v);
  return d.length >= 8 ? d.slice(-8) : d;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Pode ser chamado por um usuário logado (painel) OU internamente pelo
    // webhook via asServiceRole.functions.invoke (sem usuário). Ambos OK.
    const user = await base44.auth.me().catch(() => null);

    const { contact_id } = await req.json();
    if (!contact_id) return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contato) return Response.json({ error: 'Contato não encontrado' }, { status: 404 });

    // Já vinculado: nada a fazer
    if (contato.cliente_id) {
      return Response.json({ success: true, ja_vinculado: true, cliente_id: contato.cliente_id });
    }

    const empresaContato = norm(contato.empresa);
    const nomeContato = norm(contato.nome);
    const telContato = nucleoTel(contato.telefone || contato.telefone_canonico);
    // Tokens fortes do nome do contato (usado quando não há empresa preenchida)
    const tokensNomeContato = tokensFortes(contato.nome);

    if (!empresaContato && !nomeContato && !telContato) {
      return Response.json({ success: true, vinculado: false, reason: 'Sem empresa/nome/telefone para casar' });
    }

    // Carrega clientes (limite seguro) e pontua
    const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 1000);

    const candidatos = [];
    for (const c of clientes) {
      const razao = norm(c.razao_social);
      const fantasia = norm(c.nome_fantasia);
      const contatoNome = norm(c.contato_principal_nome);
      const telCliente = nucleoTel(c.telefone);

      let score = 0;
      let exato = false;
      const motivos = [];

      // EMPRESA/NOME primeiro.
      // "Parecida" só conta se a empresa do contato (>=5 chars) estiver REALMENTE
      // contida na razão/fantasia do cliente — evita falsos positivos com nomes curtos.
      const contidaEm = (termo, alvo) => termo.length >= 5 && alvo.length >= 5 && alvo.includes(termo);
      if (empresaContato && (empresaContato === razao || empresaContato === fantasia)) {
        score += 100; exato = true; motivos.push('empresa idêntica');
      } else if (empresaContato && (contidaEm(empresaContato, razao) || contidaEm(empresaContato, fantasia))) {
        score += 50; motivos.push('empresa parecida');
      }

      if (nomeContato && contatoNome && nomeContato === contatoNome) {
        score += 40; motivos.push('nome do contato igual');
      }

      // Contato novo costuma chegar SEM empresa preenchida, só com o nome do
      // WhatsApp (ex: "Compras Ed. Infantil Sesc"). Casa por TOKEN significativo
      // compartilhado entre o nome do contato e a razão/fantasia do cliente
      // (ex: "sesc"). Stopwords comerciais ("compras", "infantil") são ignoradas
      // para não gerar falsos positivos.
      if (!empresaContato && tokensNomeContato.length > 0) {
        const tokenComum = tokensNomeContato.find((t) => razao.includes(t) || fantasia.includes(t));
        if (tokenComum) {
          score += 45;
          motivos.push(`token "${tokenComum}" em comum`);
        }
      }

      // TELEFONE como reforço
      if (telContato && telCliente && telContato === telCliente) {
        score += 60; exato = true; motivos.push('telefone idêntico');
      }

      if (score > 0) {
        candidatos.push({
          cliente_id: c.id,
          razao_social: c.razao_social,
          nome_fantasia: c.nome_fantasia,
          telefone: c.telefone,
          score,
          exato,
          motivos
        });
      }
    }

    candidatos.sort((a, b) => b.score - a.score);

    if (candidatos.length === 0) {
      return Response.json({ success: true, vinculado: false, reason: 'Nenhum cliente compatível' });
    }

    const melhor = candidatos[0];
    // Vincula sozinho APENAS se exato e sem empate de score no topo
    const empate = candidatos.length > 1 && candidatos[1].score === melhor.score;

    // Vincula sozinho se exato e sem empate; OU se o match por nome for o único
    // candidato (sem ambiguidade), evitando vínculo errado quando há vários SESC-like.
    const matchNomeUnico = !melhor.exato && melhor.motivos.some(m => m.startsWith('token ')) && candidatos.length === 1;

    if ((melhor.exato && !empate) || matchNomeUnico) {
      const clienteVinc = clientes.find(c => c.id === melhor.cliente_id);
      const vendedorId = clienteVinc?.vendedor_responsavel || clienteVinc?.usuario_id || null;
      const nomeEmpresaCliente = clienteVinc?.razao_social || clienteVinc?.nome_fantasia || null;

      const update = { cliente_id: melhor.cliente_id, tipo_contato: 'cliente' };

      // PADRONIZAÇÃO DA EMPRESA: o nome da empresa é primordial para a organização.
      // Ao vincular ao Cliente do CRM, preenche o campo `empresa` do contato com a
      // razão social do cliente quando o contato ainda não tem empresa cadastrada.
      if (nomeEmpresaCliente && !contato.empresa) {
        update.empresa = nomeEmpresaCliente;
      }
      // Herda o ramo de atividade do cliente, se o contato não tiver.
      if (clienteVinc?.ramo_atividade && !contato.ramo_atividade) {
        update.ramo_atividade = clienteVinc.ramo_atividade;
        update.ramo_atividade_origem = 'cliente';
      }

      // Herda o vendedor do cliente como atendente fidelizado de vendas, para que
      // a PRÓXIMA mensagem caia direto nele (skillPreAtendimentos P2: fidelizado).
      if (vendedorId && /^[a-f0-9]{24}$/i.test(String(vendedorId))) {
        update.atendente_fidelizado_vendas = vendedorId;
        update.is_cliente_fidelizado = true;
      }

      await base44.asServiceRole.entities.Contact.update(contact_id, update);
      return Response.json({
        success: true,
        vinculado: true,
        cliente_id: melhor.cliente_id,
        cliente_nome: melhor.nome_fantasia || melhor.razao_social,
        empresa_preenchida: update.empresa || null,
        vendedor_herdado: update.atendente_fidelizado_vendas || null,
        motivos: melhor.motivos
      });
    }

    // Senão, sugere (top 5)
    return Response.json({
      success: true,
      vinculado: false,
      sugestoes: candidatos.slice(0, 5)
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});