import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      message_id,
      thread_id,
      contact_id,
      cliente_nome,
      cliente_telefone,
      cliente_email,
      vendedor,
      status,
      valor_total,
      produtos,
      observacoes,
      media_url,
      media_type
    } = await req.json();

    // Gerar número sequencial
    const ano = new Date().getFullYear();
    const todos = await base44.asServiceRole.entities.Orcamento.filter(
      { numero_orcamento: { $regex: `^ORC${ano}` } },
      '-created_date',
      1
    );
    const proximo = todos.length > 0
      ? parseInt(todos[0].numero_orcamento.replace(`ORC${ano}`, '')) + 1
      : 1;
    const numero_orcamento = `ORC${ano}${String(proximo).padStart(4, '0')}`;

    // Buscar ou criar cliente centralizado
    let clienteId = null;
    if (cliente_nome || cliente_telefone) {
      try {
        const resCliente = await base44.asServiceRole.functions.invoke('getOrCreateCliente', {
          razao_social: cliente_nome || 'Cliente do Chat',
          telefone: cliente_telefone || '',
          email: cliente_email || '',
          usuario_id: user.id,
          origem: 'WhatsApp'
        });
        clienteId = resCliente?.data?.cliente_id || null;
      } catch (_) { /* não bloquear criação do orçamento */ }
    }

    // Criar Orcamento direto no banco
    const orcamento = await base44.asServiceRole.entities.Orcamento.create({
      contact_id: contact_id || '',
      cliente_id: clienteId,
      cliente_nome: cliente_nome || 'Cliente do Chat',
      cliente_telefone: cliente_telefone || '',
      cliente_email: cliente_email || '',
      vendedor: vendedor || user.full_name,
      vendedor_id: user.id,
      usuario_id: user.id,
      data_orcamento: new Date().toISOString().slice(0, 10),
      valor_total: parseFloat(valor_total) || 0,
      status: status || 'rascunho',
      observacoes: observacoes || '',
      produtos: produtos || [],
      origem_chat: {
        thread_id: thread_id || '',
        message_id: message_id || '',
        media_url: media_url || '',
        media_type: media_type || 'text'
      }
    });

    // Atualizar status do contato para lead se ainda for novo + vincular ao Cliente
    if (contact_id) {
      try {
        const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
        if (contato) {
          const update = {};
          if (contato.tipo_contato === 'novo' || !contato.tipo_contato) {
            update.tipo_contato = 'lead';
          }
          // Vínculo automático: se o orçamento resolveu um Cliente e o contato ainda não tem vínculo
          if (clienteId && !contato.cliente_id) {
            update.cliente_id = clienteId;
          }
          if (Object.keys(update).length > 0) {
            await base44.asServiceRole.entities.Contact.update(contact_id, update);
          }
          // Se não havia Cliente resolvido, tenta o match inteligente (empresa/telefone)
          if (!clienteId && !contato.cliente_id) {
            await base44.asServiceRole.functions.invoke('vincularClienteAutomatico', { contact_id }).catch(() => null);
          }
        }
      } catch (_) { /* Não bloquear se falhar */ }
    }

    return Response.json({
      success: true,
      orcamento_id: orcamento.id,
      numero_orcamento: orcamento.numero_orcamento
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});