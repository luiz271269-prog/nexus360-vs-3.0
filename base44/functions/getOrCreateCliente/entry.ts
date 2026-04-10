import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * getOrCreateCliente — Função centralizada de cadastro único de cliente
 * 
 * Fluxo de busca:
 *   1. CNPJ (exato)
 *   2. Telefone (normalizado)
 *   3. Razão Social (match exato, depois parcial)
 *   4. Se não encontrado → cria novo Cliente
 * 
 * Payload esperado:
 * {
 *   razao_social: string (obrigatório)
 *   cnpj?: string
 *   telefone?: string
 *   email?: string
 *   nome_fantasia?: string
 *   cidade?: string
 *   uf?: string
 *   endereco?: string
 *   bairro?: string
 *   usuario_id?: string
 *   origem?: string
 * }
 * 
 * Retorno:
 * {
 *   cliente_id: string
 *   cliente: object
 *   action: "found" | "created"
 * }
 */

function normalizarTelefone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function normalizarCNPJ(cnpj) {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    razao_social,
    cnpj,
    telefone,
    email,
    nome_fantasia,
    cidade,
    uf,
    endereco,
    bairro,
    usuario_id,
    origem
  } = body;

  if (!razao_social) {
    return Response.json({ error: 'razao_social é obrigatório' }, { status: 400 });
  }

  const clientes = base44.asServiceRole.entities.Cliente;

  // 1. Buscar por CNPJ
  const cnpjNorm = normalizarCNPJ(cnpj);
  if (cnpjNorm && cnpjNorm.length >= 11) {
    const resultCNPJ = await clientes.filter({ cnpj: cnpj });
    const porCNPJ = resultCNPJ.find(c => normalizarCNPJ(c.cnpj) === cnpjNorm);
    if (porCNPJ) {
      return Response.json({ cliente_id: porCNPJ.id, cliente: porCNPJ, action: 'found' });
    }
  }

  // 2. Buscar por Telefone
  const telNorm = normalizarTelefone(telefone);
  if (telNorm && telNorm.length >= 8) {
    const todos = await clientes.list('-created_date', 500);
    const porTel = todos.find(c => normalizarTelefone(c.telefone) === telNorm);
    if (porTel) {
      return Response.json({ cliente_id: porTel.id, cliente: porTel, action: 'found' });
    }
  }

  // 3. Buscar por Razão Social (exato, depois parcial)
  const nomeNorm = (razao_social || '').trim().toUpperCase();
  const todosPorNome = await clientes.list('-created_date', 500);
  
  const exato = todosPorNome.find(c =>
    (c.razao_social || '').trim().toUpperCase() === nomeNorm
  );
  if (exato) {
    return Response.json({ cliente_id: exato.id, cliente: exato, action: 'found' });
  }

  const parcial = todosPorNome.find(c => {
    const cNome = (c.razao_social || '').trim().toUpperCase();
    return cNome.includes(nomeNorm) || nomeNorm.includes(cNome);
  });
  if (parcial) {
    return Response.json({ cliente_id: parcial.id, cliente: parcial, action: 'found' });
  }

  // 4. Criar novo Cliente
  const novoCliente = await clientes.create({
    razao_social: razao_social.trim(),
    nome_fantasia: nome_fantasia || razao_social.trim(),
    cnpj: cnpj || '',
    telefone: telefone || '',
    email: email || '',
    endereco: endereco || '',
    bairro: bairro || '',
    cidade: cidade || '',
    uf: uf || '',
    usuario_id: usuario_id || user.id,
    status: 'novo_lead',
    segmento: 'PME',
    origem_campanha: origem ? { canal_entrada: origem } : undefined
  });

  return Response.json({ cliente_id: novoCliente.id, cliente: novoCliente, action: 'created' });
});