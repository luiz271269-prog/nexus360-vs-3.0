import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * syncContactToCliente
 * Automação: entity Contact → update
 * Trigger: is_cliente_fidelizado = true && !cliente_id
 * Ação: chama getOrCreateCliente para criar/vincular o Cliente e atualiza o Contact com cliente_id
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const contact = payload.data;
    if (!contact) return Response.json({ skip: true, reason: 'sem dados' });

    // Só processa se fidelizado e sem cliente_id
    if (!contact.is_cliente_fidelizado) {
      return Response.json({ skip: true, reason: 'nao e cliente fidelizado' });
    }
    if (contact.cliente_id) {
      return Response.json({ skip: true, reason: 'cliente_id ja existe' });
    }

    // Evitar reprocessamento se fidelizado já existia antes
    const jaEraFidelizado = payload.old_data?.is_cliente_fidelizado === true;
    if (jaEraFidelizado) {
      return Response.json({ skip: true, reason: 'is_cliente_fidelizado nao mudou' });
    }

    console.log('[syncContactToCliente] Processando contact:', contact.id, contact.nome);

    // Chamar getOrCreateCliente centralizado
    const resCliente = await base44.asServiceRole.functions.invoke('getOrCreateCliente', {
      razao_social: contact.empresa || contact.nome,
      telefone: contact.telefone || '',
      email: contact.email || '',
      origem: 'WhatsApp'
    });

    const clienteId = resCliente?.data?.cliente_id;
    if (!clienteId) {
      console.error('[syncContactToCliente] Falha ao obter cliente_id');
      return Response.json({ success: false, reason: 'cliente_id nao retornado' }, { status: 500 });
    }

    // Vincular cliente_id ao Contact
    await base44.asServiceRole.entities.Contact.update(contact.id, {
      cliente_id: clienteId
    });

    console.log(`[syncContactToCliente] ✅ Contact ${contact.id} vinculado ao Cliente ${clienteId} (${resCliente.data.action})`);

    return Response.json({
      success: true,
      contact_id: contact.id,
      cliente_id: clienteId,
      action: resCliente.data.action
    });

  } catch (error) {
    console.error('[syncContactToCliente] ❌ Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});