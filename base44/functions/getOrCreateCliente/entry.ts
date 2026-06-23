import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * getOrCreateCliente — Cadastro único de cliente com deduplicação multi-chave
 * e enriquecimento progressivo (preenche campos vazios, nunca sobrescreve).
 *
 * Estratégia de identificação (peso decrescente, busca o match mais próximo de 100%):
 *   1. CNPJ normalizado (idêntico)            -> identificação definitiva
 *   2. Código interno (codigo_externo)         -> identificação definitiva
 *   3. Telefone (núcleo 8 dígitos)             -> forte
 *   4. Razão social / nome fantasia (idêntico) -> forte
 *   5. Nome (parcial contido) + cidade/UF      -> médio
 *   6. Endereço normalizado + cidade           -> médio
 *
 * Se encontrar: ENRIQUECE o cliente com os dados recebidos (só campos vazios).
 * Se não encontrar: cria novo Cliente com o máximo de dados.
 *
 * Payload: { razao_social (obrigatório), cnpj?, codigo_externo?, telefone?, email?,
 *            nome_fantasia?, cidade?, uf?, endereco?, bairro?, usuario_id?, origem? }
 * Retorno: { cliente_id, cliente, action: "found" | "created", enriquecido?: bool, motivos?: [] }
 */

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const normCNPJ = (v) => soDigitos(v);
const nucleoTel = (v) => {
  const d = soDigitos(v);
  return d.length >= 8 ? d.slice(-8) : d;
};
const normTexto = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const {
      razao_social, cnpj, codigo_externo, telefone, email,
      nome_fantasia, cidade, uf, endereco, bairro, usuario_id, origem
    } = body;

    if (!razao_social) {
      return Response.json({ error: 'razao_social é obrigatório' }, { status: 400 });
    }

    const clientesApi = base44.asServiceRole.entities.Cliente;

    // Chaves de entrada normalizadas
    const cnpjIn = normCNPJ(cnpj);
    const codigoIn = String(codigo_externo || '').trim();
    const telIn = nucleoTel(telefone);
    const nomeIn = normTexto(razao_social);
    const fantasiaIn = normTexto(nome_fantasia);
    const cidadeIn = normTexto(cidade);
    const ufIn = normTexto(uf);
    const enderecoIn = normTexto(endereco);

    // Carrega base e pontua cada candidato
    const clientes = await clientesApi.list('-updated_date', 1000);

    let melhor = null;
    let melhorScore = 0;
    let melhorMotivos = [];

    for (const c of clientes) {
      let score = 0;
      const motivos = [];

      // 1. CNPJ idêntico (definitivo)
      if (cnpjIn && cnpjIn.length >= 11 && normCNPJ(c.cnpj) === cnpjIn) {
        score += 100; motivos.push('CNPJ idêntico');
      }
      // 2. Código interno idêntico (definitivo)
      if (codigoIn && String(c.codigo_externo || '').trim() === codigoIn) {
        score += 100; motivos.push('código idêntico');
      }
      // 3. Telefone (núcleo)
      if (telIn && telIn.length >= 8 && nucleoTel(c.telefone) === telIn) {
        score += 60; motivos.push('telefone idêntico');
      }
      // 4. Razão/fantasia idêntica
      const razaoC = normTexto(c.razao_social);
      const fantasiaC = normTexto(c.nome_fantasia);
      if (nomeIn && (nomeIn === razaoC || nomeIn === fantasiaC)) {
        score += 70; motivos.push('nome idêntico');
      } else if (fantasiaIn && (fantasiaIn === razaoC || fantasiaIn === fantasiaC)) {
        score += 70; motivos.push('fantasia idêntica');
      } else if (nomeIn && nomeIn.length >= 5 && (razaoC.includes(nomeIn) || nomeIn.includes(razaoC) || fantasiaC.includes(nomeIn))) {
        // 5. Nome parcial + cidade reforça
        score += 35; motivos.push('nome parecido');
        if (cidadeIn && normTexto(c.cidade) === cidadeIn) { score += 15; motivos.push('cidade igual'); }
      }
      // 6. Endereço idêntico + cidade
      if (enderecoIn && enderecoIn.length >= 6 && normTexto(c.endereco) === enderecoIn) {
        score += 30; motivos.push('endereço idêntico');
        if (cidadeIn && normTexto(c.cidade) === cidadeIn) { score += 10; motivos.push('cidade igual'); }
      }

      if (score > melhorScore) {
        melhorScore = score;
        melhor = c;
        melhorMotivos = motivos;
      }
    }

    // Limiar de confiança: 60+ = mesmo cliente
    if (melhor && melhorScore >= 60) {
      // ENRIQUECIMENTO: preenche só os campos vazios do cliente existente
      const patch = {};
      const setSeVazio = (campo, valor) => {
        if (valor && (!melhor[campo] || String(melhor[campo]).trim() === '')) {
          patch[campo] = valor;
        }
      };
      setSeVazio('cnpj', cnpj);
      setSeVazio('codigo_externo', codigo_externo);
      setSeVazio('telefone', telefone);
      setSeVazio('email', email);
      setSeVazio('nome_fantasia', nome_fantasia);
      setSeVazio('endereco', endereco);
      setSeVazio('bairro', bairro);
      setSeVazio('cidade', cidade);
      setSeVazio('uf', uf);

      let clienteFinal = melhor;
      const enriquecido = Object.keys(patch).length > 0;
      if (enriquecido) {
        clienteFinal = await clientesApi.update(melhor.id, patch);
      }

      return Response.json({
        cliente_id: melhor.id,
        cliente: clienteFinal,
        action: 'found',
        enriquecido,
        score: melhorScore,
        motivos: melhorMotivos
      });
    }

    // Criar novo Cliente com o máximo de dados
    const novoCliente = await clientesApi.create({
      razao_social: razao_social.trim(),
      nome_fantasia: nome_fantasia || razao_social.trim(),
      cnpj: cnpj || '',
      codigo_externo: codigo_externo || '',
      telefone: telefone || '',
      email: email || '',
      endereco: endereco || '',
      bairro: bairro || '',
      cidade: cidade || '',
      uf: uf || '',
      usuario_id: usuario_id || user?.id,
      status: 'novo_lead',
      segmento: 'PME',
      origem_campanha: origem ? { canal_entrada: origem } : undefined
    });

    return Response.json({ cliente_id: novoCliente.id, cliente: novoCliente, action: 'created' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});