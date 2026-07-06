import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// OKF Knowledge Hub — API de conhecimento padrão aberto (Wiki para Agentes)
// Autenticação: usuário logado do app OU token compartilhado (NEXUS_HUB_TOKEN)
// Ações: list (filtros), get (por id), search (texto livre)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action = 'list', token, id, categoria, tipo_registro, tags, query, limit = 20 } = body;

    // Autenticação: token de hub OU usuário logado
    const hubToken = Deno.env.get('NEXUS_HUB_TOKEN');
    const tokenValido = token && hubToken && token === hubToken;
    let usuarioValido = false;
    if (!tokenValido) {
      const user = await base44.auth.me().catch(() => null);
      usuarioValido = !!user;
    }
    if (!tokenValido && !usuarioValido) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = base44.asServiceRole.entities.BaseConhecimento;

    // Formato OKF: envelope padronizado com metadados de proveniência
    const toOKF = (item) => ({
      id: item.id,
      title: item.titulo,
      type: item.tipo_registro,
      category: item.categoria,
      content: item.conteudo,
      structured_content: item.conteudo_estruturado || null,
      tags: [...(item.tags || []), ...(item.tags_topicos || [])],
      keywords: item.palavras_chave || [],
      relevance_score: item.relevancia_score,
      ai_confidence: item.confianca_ia,
      usage: {
        times_used: item.vezes_utilizado || 0,
        last_used: item.ultima_utilizacao || null,
        success_rate: item.taxa_sucesso || null
      },
      application_context: item.contexto_aplicacao || null,
      provenance: {
        source_entity: item.entidade_origem || null,
        source_id: item.id_entidade_origem || null,
        generated_by: item.origem_ia?.motor_gerador || 'Usuario',
        version: item.versao || '1.0'
      },
      approved: item.aprovado === true,
      created_date: item.created_date,
      updated_date: item.updated_date
    });

    if (action === 'get') {
      if (!id) return Response.json({ error: 'id obrigatório para action=get' }, { status: 400 });
      const item = await db.get(id);
      if (!item || item.ativo === false) {
        return Response.json({ error: 'Conhecimento não encontrado ou inativo' }, { status: 404 });
      }
      return Response.json({ okf_version: '1.0', item: toOKF(item) });
    }

    // list / search
    const filtro = { ativo: true };
    if (categoria) filtro.categoria = categoria;
    if (tipo_registro) filtro.tipo_registro = tipo_registro;

    let itens = await db.filter(filtro, '-relevancia_score', Math.min(limit * 3, 200));

    // Filtro por tags (qualquer interseção)
    if (Array.isArray(tags) && tags.length > 0) {
      const tagsLower = tags.map(t => String(t).toLowerCase());
      itens = itens.filter(i => {
        const itemTags = [...(i.tags || []), ...(i.tags_topicos || []), ...(i.palavras_chave || [])].map(t => String(t).toLowerCase());
        return tagsLower.some(t => itemTags.includes(t));
      });
    }

    if (query && action === 'answer') {
      // Recuperação por palavras-chave da pergunta com ranking por nº de matches
      const termos = String(query).toLowerCase().split(/\s+/).filter(t => t.length > 3);
      itens = itens
        .map(i => {
          const textoDoc = `${i.titulo || ''} ${i.conteudo || ''} ${(i.tags || []).join(' ')} ${(i.palavras_chave || []).join(' ')}`.toLowerCase();
          const matches = termos.filter(t => textoDoc.includes(t)).length;
          return { doc: i, matches };
        })
        .sort((a, b) => b.matches - a.matches || (b.doc.relevancia_score || 0) - (a.doc.relevancia_score || 0))
        .filter((r, idx) => r.matches > 0 || idx < 3) // top 3 por relevância mesmo sem match direto
        .map(r => r.doc);
    } else if (query) {
      // Busca textual simples (título + conteúdo)
      const q = String(query).toLowerCase();
      itens = itens.filter(i =>
        (i.titulo || '').toLowerCase().includes(q) ||
        (i.conteudo || '').toLowerCase().includes(q)
      );
    }

    itens = itens.slice(0, limit);

    // action=answer — RAG por injeção de contexto: pergunta → top docs → resposta com fontes
    if (action === 'answer') {
      if (!query) return Response.json({ error: 'query (pergunta) obrigatória para action=answer' }, { status: 400 });

      if (itens.length === 0) {
        return Response.json({
          okf_version: '1.0',
          answer: 'Não encontrei informações sobre isso na base de conhecimento.',
          confidence: 0,
          used_rag: false,
          sources: []
        });
      }

      const contexto = itens
        .map((d, i) => `[Doc ${i + 1}] ${d.titulo}\nCategoria: ${d.categoria} | Tipo: ${d.tipo_registro}\n${d.conteudo}\n${d.contexto_aplicacao?.quando_usar ? 'Quando usar: ' + d.contexto_aplicacao.quando_usar : ''}`)
        .join('\n---\n');

      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Você é o oráculo de conhecimento do Nexus360 (NeuralTec). Responda usando APENAS o contexto abaixo. Se a informação não estiver no contexto, diga claramente. Cite os documentos usados. Responda em português brasileiro, de forma objetiva e acionável.

CONTEXTO DA BASE DE CONHECIMENTO:
${contexto.slice(0, 12000)}

PERGUNTA: ${query}`,
        response_json_schema: {
          type: 'object',
          properties: {
            resposta: { type: 'string' },
            confianca: { type: 'number', description: 'Confiança de 0 a 1' },
            documentos_utilizados: { type: 'array', items: { type: 'number' }, description: 'Índices (1-based) dos docs usados' }
          },
          required: ['resposta']
        }
      });

      const usados = llm.documentos_utilizados || [];
      // Marca uso dos documentos citados (fire-and-forget)
      const agora = new Date().toISOString();
      Promise.all(usados.map(idx => {
        const doc = itens[idx - 1];
        if (!doc) return null;
        return db.update(doc.id, { vezes_utilizado: (doc.vezes_utilizado || 0) + 1, ultima_utilizacao: agora }).catch(() => null);
      }));

      return Response.json({
        okf_version: '1.0',
        answer: llm.resposta,
        confidence: llm.confianca ?? 0.8,
        used_rag: true,
        sources: usados.map(idx => itens[idx - 1]).filter(Boolean).map(d => ({
          id: d.id, title: d.titulo, category: d.categoria, relevance_score: d.relevancia_score
        }))
      });
    }

    return Response.json({
      okf_version: '1.0',
      source: 'Nexus360 BaseConhecimento',
      total: itens.length,
      items: itens.map(toOKF)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});