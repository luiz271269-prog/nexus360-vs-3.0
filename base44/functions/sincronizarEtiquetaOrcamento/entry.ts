// sincronizarEtiquetaOrcamento v2
// Automação: ouve MessageThread.update → se categorias incluem 'cotacao' ou 'venda'
// → move/cria Orcamento no pipeline de vendas
// CORRIGIDO: ouve MessageThread (não Message), pois categorias ficam em MessageThread.categorias

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Payload vem da automação entity: { event, data, old_data }
    const thread = payload.data;
    if (!thread) return Response.json({ skip: true, reason: 'sem dados' });

    const categorias = thread.categorias || [];
    const contactId = thread.contact_id;

    const isEnvio = categorias.includes('cotacao');
    const isFechado = categorias.includes('venda');

    if (!isEnvio && !isFechado) {
      return Response.json({ skip: true, reason: 'etiqueta irrelevante' });
    }

    if (!contactId) {
      return Response.json({ skip: true, reason: 'thread sem contact_id' });
    }

    // Verificar se as categorias realmente mudaram (evitar loop)
    const oldCategorias = payload.old_data?.categorias || [];
    const categoriaJaExistia = (cat) => oldCategorias.includes(cat);

    if (isEnvio && categoriaJaExistia('cotacao')) {
      return Response.json({ skip: true, reason: 'cotacao ja existia antes' });
    }
    if (isFechado && categoriaJaExistia('venda')) {
      return Response.json({ skip: true, reason: 'venda ja existia antes' });
    }

    const agora = new Date().toISOString();

    if (isEnvio) {
      // Buscar orçamento em rascunho desse contato
      const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
        { contact_id: contactId, status: 'rascunho' }, '-created_date', 1
      ).catch(() => []);

      if (orcamentos.length > 0) {
        await base44.asServiceRole.entities.Orcamento.update(orcamentos[0].id, {
          status: 'enviado',
          updated_date: agora
        });
        console.log(`[ETIQUETA→ORC v2] ✅ Orcamento ${orcamentos[0].id} → enviado`);
      } else {
        // Criar novo orçamento vinculado
        const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
        const vendedorNome = thread.assigned_user_id
          ? (await base44.asServiceRole.entities.User.get(thread.assigned_user_id).catch(() => null))?.full_name || 'Equipe'
          : 'Equipe';

        const ano = new Date().getFullYear();
        const todos = await base44.asServiceRole.entities.Orcamento.filter(
          { numero_orcamento: { $regex: `^ORC${ano}` } }, '-created_date', 1
        ).catch(() => []);
        const proximo = todos.length > 0
          ? parseInt(todos[0].numero_orcamento.replace(`ORC${ano}`, '')) + 1
          : 1;
        const numero_orcamento = `ORC${ano}${String(proximo).padStart(4, '0')}`;

        await base44.asServiceRole.entities.Orcamento.create({
          numero_orcamento,
          contact_id: contactId,
          cliente_nome: contato?.nome || 'Desconhecido',
          cliente_telefone: contato?.telefone || '',
          vendedor: vendedorNome,
          data_orcamento: agora.slice(0, 10),
          valor_total: 0,
          status: 'enviado',
          origem_chat: { thread_id: thread.id }
        });
        console.log(`[ETIQUETA→ORC v2] ✅ Novo orçamento ${numero_orcamento} criado → enviado`);
      }

      // Log de movimentação
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'outro',
        contato_id: contactId,
        thread_id: thread.id,
        resultado: 'sucesso',
        timestamp: agora,
        detalhes: { mensagem: 'Etiqueta cotacao → Orcamento movido para enviado', origem: 'sincronizarEtiquetaOrcamento_v2' },
        origem: 'sistema'
      }).catch(() => {});
    }

    if (isFechado) {
      const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
        { contact_id: contactId }, '-created_date', 5
      ).catch(() => []);

      const orcamentoAberto = orcamentos.find(o => ['enviado', 'negociando', 'liberado'].includes(o.status));
      if (orcamentoAberto) {
        await base44.asServiceRole.entities.Orcamento.update(orcamentoAberto.id, {
          status: 'aprovado',
          updated_date: agora
        });
        console.log(`[ETIQUETA→ORC v2] ✅ Orcamento ${orcamentoAberto.id} → aprovado`);
      }

      // Atualizar Contact.tipo_contato para 'cliente' se era lead
      const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
      if (contato && contato.tipo_contato === 'lead') {
        await base44.asServiceRole.entities.Contact.update(contactId, { tipo_contato: 'cliente' });
        console.log(`[ETIQUETA→ORC v2] ✅ Contact ${contactId} promovido: lead → cliente`);
      }

      // Log de movimentação
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'outro',
        contato_id: contactId,
        thread_id: thread.id,
        resultado: 'sucesso',
        timestamp: agora,
        detalhes: { mensagem: 'Etiqueta venda → Orcamento aprovado, contato promovido a cliente', origem: 'sincronizarEtiquetaOrcamento_v2' },
        origem: 'sistema'
      }).catch(() => {});
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[ETIQUETA→ORC v2] ❌ Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});