import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { contact_id, thread_id, integration_id, tipo = 'video', action = 'iniciar' } = body;

    // ── ENCERRAR CHAMADA ──────────────────────────────────────────────
    if (action === 'encerrar') {
      const { session_id } = body;
      if (!session_id) return Response.json({ success: false, error: 'session_id obrigatório' }, { status: 400 });

      const session = await base44.asServiceRole.entities.CallSession.get(session_id);
      if (!session) return Response.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });

      const encerradoEm = new Date().toISOString();
      const duracaoSegundos = session.iniciado_em
        ? Math.round((new Date(encerradoEm) - new Date(session.iniciado_em)) / 1000)
        : 0;

      await base44.asServiceRole.entities.CallSession.update(session_id, {
        status: 'encerrada',
        encerrado_em: encerradoEm,
        duracao_segundos: duracaoSegundos
      });

      return Response.json({ success: true, duracao_segundos: duracaoSegundos });
    }

    // ── INICIAR CHAMADA ───────────────────────────────────────────────
    if (!contact_id) return Response.json({ success: false, error: 'contact_id obrigatório' }, { status: 400 });

    // Buscar contato
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact) return Response.json({ success: false, error: 'Contato não encontrado' }, { status: 404 });

    const telefone = contact.telefone || contact.celular;
    if (!telefone) return Response.json({ success: false, error: 'Contato sem telefone cadastrado' }, { status: 400 });

    // Gerar sala Jitsi
    const roomSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const roomName = `nexus-${roomSuffix}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    // Criar registro da sessão
    const agora = new Date().toISOString();
    const session = await base44.asServiceRole.entities.CallSession.create({
      room_name: roomName,
      room_url: roomUrl,
      tipo,
      status: 'iniciando',
      contact_id,
      contact_nome: contact.nome || telefone,
      contact_telefone: telefone,
      thread_id: thread_id || null,
      integration_id: integration_id || null,
      iniciado_por: user.email || user.id,
      iniciado_em: agora,
      link_enviado_whatsapp: false
    });

    // Montar mensagem WhatsApp
    const tipoLabel = tipo === 'audio' ? '📞 Chamada de Voz' : '📹 Videochamada';
    const nomeAtendente = user.full_name?.split(' ')[0] || 'Atendente';
    const mensagem = `${tipoLabel} — ${nomeAtendente} está te chamando!\n\nClique para entrar:\n${roomUrl}\n\n_A sala ficará disponível por 60 minutos._`;

    // Enviar via WhatsApp se tiver integração
    let linkEnviado = false;
    if (integration_id) {
      try {
        const resultado = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id,
          numero_destino: telefone,
          mensagem
        });
        linkEnviado = resultado?.data?.success === true;
      } catch (e) {
        console.warn('[skillInitiateVideoCall] Falha ao enviar WhatsApp:', e.message);
      }
    }

    // Atualizar sessão com status da notificação
    await base44.asServiceRole.entities.CallSession.update(session.id, {
      status: 'ativa',
      link_enviado_whatsapp: linkEnviado,
      mensagem_enviada: mensagem
    });

    return Response.json({
      success: true,
      session_id: session.id,
      room_url: roomUrl,
      room_name: roomName,
      tipo,
      contact_nome: contact.nome || telefone,
      link_enviado_whatsapp: linkEnviado
    });

  } catch (error) {
    console.error('[skillInitiateVideoCall] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});