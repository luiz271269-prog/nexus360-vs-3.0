import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Endpoint público (consumido pelo app do site NeuralTec) — mesmo padrão de getPromocoesPublicas.
// Recebe { nome, telefone, email?, mensagem } e cria Contato + Thread + Mensagem na Central de Comunicação.
// Segurança: exige header X-Promo-Token igual ao secret NEXUS_PROMO_TOKEN.

Deno.serve(async (req) => {
  try {
    const tokensValidos = [
      (Deno.env.get('NEXUS_PROMO_TOKEN') || '').trim(),
      (Deno.env.get('NEXUS_PROMOCAO_TOKEN') || '').trim()
    ].filter(Boolean);
    let body = {};
    try { body = await req.json(); } catch (_) { /* sem body */ }

    const tokenRecebido = (req.headers.get('x-promo-token') || body?.token || '').trim();
    if (tokensValidos.length === 0 || !tokensValidos.includes(tokenRecebido)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nome, telefone, email, mensagem } = body;
    if (!nome || !mensagem || (!telefone && !email)) {
      return Response.json({ error: 'Campos obrigatórios: nome, mensagem e telefone (ou email)' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;
    const agora = new Date().toISOString();

    // 1. Normalizar telefone (E.164 brasileiro)
    let telCanonico = null;
    let telFormatado = null;
    if (telefone) {
      let dig = String(telefone).replace(/\D/g, '');
      if (dig && !dig.startsWith('55') && (dig.length === 10 || dig.length === 11)) dig = '55' + dig;
      if (dig.startsWith('55') && dig.length === 12) {
        const ddd = dig.substring(2, 4);
        const num = dig.substring(4);
        if (['6', '7', '8', '9'].includes(num[0])) dig = '55' + ddd + '9' + num;
      }
      telCanonico = dig;
      telFormatado = '+' + dig;
    }

    // 2. Buscar ou criar contato
    let contato = null;
    if (telCanonico) {
      const porCanonico = await sr.Contact.filter({ telefone_canonico: telCanonico }, '-updated_date', 1);
      contato = porCanonico[0] || null;
      if (!contato) {
        const porTelefone = await sr.Contact.filter({ telefone: telFormatado }, '-updated_date', 1);
        contato = porTelefone[0] || null;
      }
    }
    if (!contato && email) {
      const porEmail = await sr.Contact.filter({ email: String(email).toLowerCase() }, '-updated_date', 1);
      contato = porEmail[0] || null;
    }

    if (!contato) {
      contato = await sr.Contact.create({
        nome,
        telefone: telFormatado || undefined,
        telefone_canonico: telCanonico || undefined,
        email: email ? String(email).toLowerCase() : undefined,
        tipo_contato: 'lead',
        conexao_origem: 'site_neuraltec',
        observacoes: `Contato criado via formulário do site em ${agora}`,
        ultima_interacao: agora
      });
    }

    // 3. Buscar ou criar thread canônica aberta
    const existentes = await sr.MessageThread.filter(
      { contact_id: contato.id, is_canonical: true, status: 'aberta' }, '-last_message_at', 1
    );
    let thread = existentes[0] || null;

    const preview = String(mensagem).substring(0, 200);

    if (!thread) {
      thread = await sr.MessageThread.create({
        contact_id: contato.id,
        thread_type: 'contact_external',
        channel: 'whatsapp',
        is_canonical: true,
        status: 'aberta',
        sector_id: 'vendas',
        unread_count: 1,
        total_mensagens: 1,
        primeira_mensagem_at: agora,
        last_message_at: agora,
        last_inbound_at: agora,
        last_message_content: preview,
        last_message_sender: 'contact',
        last_message_sender_name: nome,
        observacoes: 'Conversa iniciada pelo formulário do site NeuralTec'
      });
    }

    // 4. Criar mensagem inbound
    const msg = await sr.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: mensagem,
      channel: 'whatsapp',
      provider: 'internal_system',
      status: 'recebida',
      sent_at: agora,
      metadata: {
        canal_nome: 'Site NeuralTec',
        origem_site: true,
        email_contato: email || null
      }
    });

    // 5. Atualizar caches da thread existente
    if (existentes[0]) {
      await sr.MessageThread.update(thread.id, {
        last_message_at: agora,
        last_inbound_at: agora,
        last_message_content: preview,
        last_message_sender: 'contact',
        last_message_sender_name: nome,
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1
      });
    }

    return Response.json({
      success: true,
      contact_id: contato.id,
      thread_id: thread.id,
      message_id: msg.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});