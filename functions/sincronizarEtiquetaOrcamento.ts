// sincronizarEtiquetaOrcamento
// Automação: quando uma Message é atualizada com etiqueta "cotacao" → Orcamento.status = enviado
//                                                    etiqueta "venda" → Orcamento.status = ganho
// Chamado por automação entity trigger em Message (update)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const msg = payload.data;
    if (!msg) return Response.json({ skip: true, reason: 'sem dados' });

    const categorias = msg.categorias || [];
    const threadId = msg.thread_id;

    // Detectar qual etiqueta foi aplicada
    const isEnvio = categorias.includes('cotacao');
    const isFechado = categorias.includes('venda');

    if (!isEnvio && !isFechado) {
      return Response.json({ skip: true, reason: 'etiqueta irrelevante' });
    }

    // Buscar thread para obter contact_id e assigned_user_id
    const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    if (!thread?.contact_id) {
      return Response.json({ skip: true, reason: 'thread sem contact_id' });
    }

    const contactId = thread.contact_id;
    const agora = new Date().toISOString();

    if (isEnvio) {
      // Buscar orçamento aberto (rascunho/aguardando) desse contato
      const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
        { contact_id: contactId, status: 'rascunho' }, '-created_date', 1
      ).catch(() => []);

      if (orcamentos.length > 0) {
        await base44.asServiceRole.entities.Orcamento.update(orcamentos[0].id, {
          status: 'enviado',
          updated_date: agora
        });
        console.log(`[ETIQUETA→ORC] ✅ Orçamento ${orcamentos[0].id} → enviado (contact: ${contactId})`);
      } else {
        // Criar novo registro de orçamento vinculado ao contato
        const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
        const vendedorNome = thread.assigned_user_id
          ? (await base44.asServiceRole.entities.User.get(thread.assigned_user_id).catch(() => null))?.full_name || 'Equipe'
          : 'Equipe';

        await base44.asServiceRole.entities.Orcamento.create({
          contact_id: contactId,
          cliente_nome: contato?.nome || 'Desconhecido',
          cliente_telefone: contato?.telefone || '',
          vendedor: vendedorNome,
          data_orcamento: agora.slice(0, 10),
          valor_total: 0,
          status: 'enviado',
          origem_chat: { thread_id: threadId, message_id: msg.id }
        });
        console.log(`[ETIQUETA→ORC] ✅ Novo orçamento criado → enviado (contact: ${contactId})`);
      }
    }

    if (isFechado) {
      // Buscar orçamento aberto (enviado/negociando) desse contato
      const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
        { contact_id: contactId }, '-created_date', 5
      ).catch(() => []);

      const orcamentoAberto = orcamentos.find(o => ['enviado', 'negociando', 'liberado'].includes(o.status));
      if (orcamentoAberto) {
        await base44.asServiceRole.entities.Orcamento.update(orcamentoAberto.id, {
          status: 'aprovado',
          updated_date: agora
        });
        console.log(`[ETIQUETA→ORC] ✅ Orçamento ${orcamentoAberto.id} → aprovado/ganho (contact: ${contactId})`);
      } else {
        console.warn(`[ETIQUETA→ORC] ⚠️ Nenhum orçamento aberto encontrado para contact ${contactId}`);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[ETIQUETA→ORC] ❌ Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});