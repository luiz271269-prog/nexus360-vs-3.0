import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * cadastrarClienteDeNF — Cadastra um Cliente do CRM a partir de um cliente que
 * faturou (Nota Fiscal do Neural Fin), enriquecendo o máximo possível com os
 * dados de um Contact já existente no CRM e VINCULANDO esse contato fidelizado.
 *
 * A NotaFiscal só traz { cliente (razão social), vendedor }. Os dados ricos
 * (telefone, empresa, ramo, vendedor fidelizado) vêm do Contact correspondente.
 *
 * Payload: { nome (razão social da NF, obrigatório), vendedor? (nome da NF) }
 * Retorno: { success, cliente_id, cliente, action, contato_vinculado, herdado, score }
 */

const STOPWORDS = new Set([
  'compras', 'comercial', 'vendas', 'financeiro', 'suporte', 'atendimento',
  'ed', 'edu', 'educacao', 'educacional', 'infantil', 'comunidade', 'central',
  'ltda', 'me', 'sa', 'eireli', 'epp', 'cia', 'grupo', 'empresa', 'servico',
  'servicos', 'social', 'do', 'da', 'de', 'dos', 'das', 'e', 'matriz', 'filial',
  'terminais', 'portuarios', 'alimentos', 'industria', 'comercio'
]);

const norm = (v) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '').trim();

const tokensFortes = (v) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { nome, vendedor } = await req.json();
    if (!nome || !String(nome).trim()) {
      return Response.json({ error: 'nome (razão social) é obrigatório' }, { status: 400 });
    }
    const razaoSocial = String(nome).trim();

    // 1) Procurar o melhor Contact existente para herdar dados
    const nomeNorm = norm(razaoSocial);
    const tokensNome = tokensFortes(razaoSocial);
    const contatos = await base44.asServiceRole.entities.Contact.list('-updated_date', 2000);

    let melhorContato = null;
    let melhorScore = 0;
    for (const c of contatos) {
      const empresaC = norm(c.empresa);
      const nomeC = norm(c.nome);
      let score = 0;
      // empresa idêntica = match forte
      if (empresaC && empresaC === nomeNorm) score += 100;
      else if (empresaC && empresaC.length >= 5 && nomeNorm.length >= 5 &&
               (empresaC.includes(nomeNorm) || nomeNorm.includes(empresaC))) score += 60;
      // token forte compartilhado (ex: "portonave", "pamplona", "sesc")
      if (score === 0 && tokensNome.length > 0) {
        const tokenComum = tokensNome.find((t) => empresaC.includes(t) || nomeC.includes(t));
        if (tokenComum) score += 45;
      }
      if (score > melhorScore) { melhorScore = score; melhorContato = c; }
    }

    // 2) Resolver o vendedor responsável (= contato fidelizado de vendas, se houver;
    //    senão tenta casar o nome do vendedor da NF com um User)
    let usuarioId = null;
    let vendedorOrigem = null;
    if (melhorContato?.atendente_fidelizado_vendas &&
        /^[a-f0-9]{24}$/i.test(String(melhorContato.atendente_fidelizado_vendas))) {
      usuarioId = melhorContato.atendente_fidelizado_vendas;
      vendedorOrigem = 'contato_fidelizado';
    } else if (vendedor) {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const vNorm = norm(vendedor);
      const u = users.find((u) => {
        const fn = norm(u.full_name);
        return fn && (fn === vNorm || fn.includes(vNorm) || vNorm.includes(fn));
      });
      if (u) { usuarioId = u.id; vendedorOrigem = 'vendedor_nf'; }
    }

    // 3) Montar dados de criação com tudo que herdamos do contato
    const dadosHerdados = {
      telefone: melhorContato?.telefone || melhorContato?.telefone_canonico || '',
      email: melhorContato?.email || '',
      ramo_atividade: melhorContato?.ramo_atividade || '',
      contato_principal_nome: melhorContato?.nome || '',
      usuario_id: usuarioId || user.id
    };

    // 4) Deduplicar e criar/enriquecer Cliente diretamente (CNPJ/código não vêm da NF;
    //    a dedup aqui é por razão social/fantasia idêntica para não duplicar cadastro).
    const clientesApi = base44.asServiceRole.entities.Cliente;
    const clientesExistentes = await clientesApi.list('-updated_date', 2000);
    const clienteExistente = clientesExistentes.find((c) =>
      norm(c.razao_social) === nomeNorm || norm(c.nome_fantasia) === nomeNorm);

    let clienteFinal;
    let action;
    if (clienteExistente) {
      // ENRIQUECE só campos vazios
      const patch = {};
      const setSeVazio = (campo, valor) => {
        if (valor && (!clienteExistente[campo] || String(clienteExistente[campo]).trim() === '')) {
          patch[campo] = valor;
        }
      };
      setSeVazio('telefone', dadosHerdados.telefone);
      setSeVazio('email', dadosHerdados.email);
      setSeVazio('ramo_atividade', dadosHerdados.ramo_atividade);
      setSeVazio('contato_principal_nome', dadosHerdados.contato_principal_nome);
      setSeVazio('usuario_id', usuarioId);
      clienteFinal = Object.keys(patch).length > 0
        ? await clientesApi.update(clienteExistente.id, patch)
        : clienteExistente;
      action = 'found';
    } else {
      clienteFinal = await clientesApi.create({
        razao_social: razaoSocial,
        nome_fantasia: razaoSocial,
        telefone: dadosHerdados.telefone,
        email: dadosHerdados.email,
        ramo_atividade: dadosHerdados.ramo_atividade,
        contato_principal_nome: dadosHerdados.contato_principal_nome,
        usuario_id: dadosHerdados.usuario_id,
        status: 'Ativo',
        segmento: 'PME',
        origem_campanha: { canal_entrada: 'outro' }
      });
      action = 'created';
    }
    const clienteId = clienteFinal.id;

    // 5) VINCULAR TODOS os contatos da mesma empresa ao cliente (fecha o laço).
    //    Empresa é o vínculo-mãe: uma empresa tem vários contatos (compras,
    //    financeiro, técnico). Cada pessoa daquela empresa deve cair sob o
    //    mesmo cliente, não apenas o melhor match.
    const contatosDaEmpresa = contatos.filter((c) => {
      if (c.cliente_id) return false; // já vinculado (a este ou outro)
      const empresaC = norm(c.empresa);
      const nomeC = norm(c.nome);
      // empresa idêntica/contida
      if (empresaC && (empresaC === nomeNorm ||
          (empresaC.length >= 5 && nomeNorm.length >= 5 &&
           (empresaC.includes(nomeNorm) || nomeNorm.includes(empresaC))))) {
        return true;
      }
      // token forte compartilhado (ex: "portonave")
      if (tokensNome.length > 0 &&
          tokensNome.some((t) => empresaC.includes(t) || nomeC.includes(t))) {
        return true;
      }
      return false;
    });
    // Garante que o melhorContato entra na lista mesmo se a regra acima não o pegou
    if (melhorContato && !melhorContato.cliente_id &&
        !contatosDaEmpresa.some((c) => c.id === melhorContato.id)) {
      contatosDaEmpresa.push(melhorContato);
    }

    const contatosVinculados = [];
    for (const c of contatosDaEmpresa) {
      const updateContato = { cliente_id: clienteId, tipo_contato: 'cliente', is_cliente_fidelizado: true };
      if (usuarioId && !c.atendente_fidelizado_vendas) {
        updateContato.atendente_fidelizado_vendas = usuarioId;
      }
      if (!c.empresa) updateContato.empresa = razaoSocial;
      try {
        await base44.asServiceRole.entities.Contact.update(c.id, updateContato);
        contatosVinculados.push({ id: c.id, nome: c.nome, telefone: c.telefone });
      } catch (e) {
        console.warn('Falha ao vincular contato', c.id, e.message);
      }
    }

    // Compatibilidade: mantém o campo singular apontando para o melhor match
    let contatoVinculado = null;
    if (melhorContato?.cliente_id) {
      contatoVinculado = { id: melhorContato.id, nome: melhorContato.nome, ja_vinculado: true };
    } else if (contatosVinculados.length > 0) {
      contatoVinculado = contatosVinculados.find((c) => c.id === melhorContato?.id) || contatosVinculados[0];
    }

    return Response.json({
      success: true,
      cliente_id: clienteId,
      cliente: clienteFinal,
      action,
      score_contato: melhorScore,
      contato_vinculado: contatoVinculado,
      contatos_vinculados: contatosVinculados,
      total_contatos_vinculados: contatosVinculados.length,
      herdado: {
        telefone: dadosHerdados.telefone || null,
        email: dadosHerdados.email || null,
        ramo_atividade: dadosHerdados.ramo_atividade || null,
        contato_principal_nome: dadosHerdados.contato_principal_nome || null,
        usuario_id: usuarioId,
        vendedor_origem: vendedorOrigem
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});