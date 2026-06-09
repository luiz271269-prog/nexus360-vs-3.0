import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Responde perguntas do atendente SOBRE o contato/cliente da conversa,
// usando SOMENTE dados reais: Contact, Cliente, Orcamento, Message, EmailSincronizado.
// Não inventa: se o dado não existe, diz que não consta.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pergunta, contact_id, thread_id, cliente_id } = await req.json();
    if (!pergunta || !pergunta.trim()) {
      return Response.json({ error: 'Pergunta vazia' }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities;

    // 1) Contato
    let contato = null;
    if (contact_id) contato = await svc.Contact.get(contact_id).catch(() => null);

    // 2) Cliente (via cliente_id explícito, ou via contato.cliente_id)
    let cliente = null;
    const cid = cliente_id || contato?.cliente_id;
    if (cid) cliente = await svc.Cliente.get(cid).catch(() => null);

    // 3) Orçamentos / CRM Kanban do cliente
    let orcamentos = [];
    if (cid) {
      orcamentos = await svc.Orcamento.filter({ cliente_id: cid }, '-data_orcamento', 20).catch(() => []);
    }

    // 4) Histórico de mensagens da thread
    let mensagens = [];
    if (thread_id) {
      mensagens = await svc.Message.filter({ thread_id }, '-created_date', 40).catch(() => []);
      mensagens = mensagens.reverse();
    }

    // 5) E-mails sincronizados vinculados ao contato/cliente
    let emails = [];
    if (contact_id) {
      emails = await svc.EmailSincronizado.filter({ contact_id }, '-created_date', 15).catch(() => []);
    }

    // Monta dossiê factual compacto para o modelo
    const dossie = {
      contato: contato ? {
        nome: contato.nome,
        telefone: contato.telefone,
        email: contato.email,
        empresa: contato.empresa,
        cargo: contato.cargo,
        ramo_atividade: contato.ramo_atividade,
        tipo_contato: contato.tipo_contato,
        tags: contato.tags || [],
        classe_abc: contato.classe_abc,
        vendedor_responsavel: contato.vendedor_responsavel,
        observacoes: contato.observacoes,
        ultima_interacao: contato.ultima_interacao,
      } : null,
      cliente: cliente ? {
        nome: cliente.nome,
        empresa: cliente.empresa || cliente.nome_fantasia,
        cnpj: cliente.cnpj,
        telefone: cliente.telefone,
        celular: cliente.celular,
        email: cliente.email,
        cidade: cliente.cidade,
        uf: cliente.uf,
        status: cliente.status,
      } : null,
      orcamentos: orcamentos.map(o => ({
        numero: o.numero_orcamento,
        data: o.data_orcamento,
        valor_total: o.valor_total,
        status: o.status,
        probabilidade: o.probabilidade,
        produtos: (o.produtos || []).map(p => ({ nome: p.nome, qtd: p.quantidade, valor: p.valor_total })),
      })),
      historico_mensagens: mensagens.map(m => ({
        de: m.sender_type === 'contact' ? 'cliente' : 'atendente',
        canal: m.channel,
        texto: (m.content || '').slice(0, 300),
        data: m.created_date,
      })),
      emails: emails.map(e => ({
        assunto: e.assunto,
        remetente: e.remetente_email,
        preview: (e.corpo_preview || '').slice(0, 200),
        data: e.data_email || e.created_date,
      })),
    };

    const prompt = `Você é um assistente que responde perguntas do atendente sobre um cliente/contato, usando EXCLUSIVAMENTE os dados factuais abaixo (dossiê real do CRM/conversa).

REGRAS:
- Responda APENAS com base nos dados fornecidos. NUNCA invente valores, datas ou nomes.
- Se a informação não constar no dossiê, responda exatamente: "Essa informação não consta nos dados do cliente."
- Seja direto, objetivo e em português brasileiro. Cite valores e datas exatos quando existirem.

DOSSIÊ (dados reais):
${JSON.stringify(dossie, null, 2)}

PERGUNTA DO ATENDENTE:
${pergunta}`;

    const resposta = await base44.integrations.Core.InvokeLLM({ prompt });

    return Response.json({
      resposta: typeof resposta === 'string' ? resposta : (resposta?.response || ''),
      tem_contato: !!contato,
      tem_cliente: !!cliente,
      qtd_orcamentos: orcamentos.length,
      qtd_mensagens: mensagens.length,
      qtd_emails: emails.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});