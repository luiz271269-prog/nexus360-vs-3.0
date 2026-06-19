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

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
// últimos 8 dígitos = núcleo do telefone (ignora DDI/DDD/nono dígito)
const nucleoTel = (v) => {
  const d = soDigitos(v);
  return d.length >= 8 ? d.slice(-8) : d;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

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
      const contidaEm = (alvo) => empresaContato.length >= 5 && alvo.length >= 5 && alvo.includes(empresaContato);
      if (empresaContato && (empresaContato === razao || empresaContato === fantasia)) {
        score += 100; exato = true; motivos.push('empresa idêntica');
      } else if (empresaContato && (contidaEm(razao) || contidaEm(fantasia))) {
        score += 50; motivos.push('empresa parecida');
      }

      if (nomeContato && contatoNome && nomeContato === contatoNome) {
        score += 40; motivos.push('nome do contato igual');
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

    if (melhor.exato && !empate) {
      await base44.asServiceRole.entities.Contact.update(contact_id, { cliente_id: melhor.cliente_id });
      return Response.json({
        success: true,
        vinculado: true,
        cliente_id: melhor.cliente_id,
        cliente_nome: melhor.nome_fantasia || melhor.razao_social,
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