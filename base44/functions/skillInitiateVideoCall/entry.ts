import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * skillInitiateVideoCall — ORQUESTRADOR ÚNICO de chamadas de áudio/vídeo
 *
 * 🔒 FASE 0 (regra arquitetural permanente):
 *   - WebRTC interno = SOMENTE 1:1 (exatamente 1 destinatário)
 *   - Grupo (≥2 destinatários) = SEMPRE Jitsi
 *   - Externo (contato WhatsApp) = SEMPRE Jitsi
 *   - callee_ids[] é metadata (notificação/auditoria), nunca decide transporte
 *
 * O frontend (BotaoVideochamada) é fino: apenas chama esta skill e
 * renderiza o overlay com base em `overlay_type` retornado.
 *
 * ── CONTRATO DE ENTRADA ────────────────────────────────────────────────
 *
 * action: 'iniciar' (default) | 'encerrar'
 *
 * Para action='iniciar':
 *   modo: 'interno' | 'externo' (default: 'externo')
 *   tipo: 'audio' | 'video' (default: 'video')
 *   thread_id: string (obrigatório em modo interno; opcional em externo)
 *
 *   ── Modo interno ──
 *   user_ids_destino: string[] (preferido; array de User.id)
 *   user_id_destino:  string   (retrocompat; convertido para [user_id_destino])
 *
 *   ── Modo externo ──
 *   contact_id: string (obrigatório)
 *   integration_id: string (opcional; se presente, envia link via WhatsApp)
 *
 * Para action='encerrar':
 *   session_id: string (obrigatório)
 *
 * ── CONTRATO DE SAÍDA ──────────────────────────────────────────────────
 *
 * {
 *   success: boolean,
 *   session_id: string,
 *   overlay_type: 'webrtc' | 'jitsi',   ← front usa para escolher componente
 *   tipo: 'audio' | 'video',
 *   modo_callsession: 'interno_webrtc' | 'externo_jitsi',
 *
 *   // Para overlay_type='jitsi':
 *   room_url?: string,
 *   room_name?: string,
 *
 *   // Para overlay_type='webrtc':
 *   peer_nome?: string,            // nome do destinatário 1:1
 *
 *   // Metadata (sempre presente):
 *   destinatarios: [{ id, nome }],
 *   link_enviado_interno?: boolean,
 *   link_enviado_whatsapp?: boolean,
 *   contact_nome?: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action = 'iniciar', tipo = 'video' } = body;

    // ═══════════════════════════════════════════════════════════════════
    // AÇÃO: ENCERRAR
    // ═══════════════════════════════════════════════════════════════════
    if (action === 'encerrar') {
      const { session_id } = body;
      if (!session_id) {
        return Response.json({ success: false, error: 'session_id obrigatório' }, { status: 400 });
      }

      const session = await base44.asServiceRole.entities.CallSession.get(session_id);
      if (!session) {
        return Response.json({ success: false, error: 'Sessão não encontrada' }, { status: 404 });
      }

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

    // ═══════════════════════════════════════════════════════════════════
    // AÇÃO: INICIAR
    // ═══════════════════════════════════════════════════════════════════
    const { modo = 'externo', thread_id } = body;
    const nomeAtendente = user.full_name?.split(' ')[0] || 'Atendente';
    const tipoLabel = tipo === 'audio' ? '📞 Chamada de Voz' : '📹 Videochamada';
    const agora = new Date().toISOString();

    // ───────────────────────────────────────────────────────────────────
    // MODO INTERNO (entre usuários do sistema)
    // ───────────────────────────────────────────────────────────────────
    if (modo === 'interno') {
      if (!thread_id) {
        return Response.json({ success: false, error: 'thread_id obrigatório para modo interno' }, { status: 400 });
      }

      // Normaliza destinatários: aceita user_ids_destino[] (preferido) ou user_id_destino (legado)
      let userIds = [];
      if (Array.isArray(body.user_ids_destino) && body.user_ids_destino.length > 0) {
        userIds = body.user_ids_destino.filter(Boolean);
      } else if (body.user_id_destino) {
        userIds = [body.user_id_destino];
      }
      // Remove o próprio caller se vier por engano
      userIds = userIds.filter(id => id !== user.id);
      // Dedup
      userIds = [...new Set(userIds)];

      // GUARDRAIL: se front enviou thread_type='team_internal', forçar max 1 destino
      // (segunda camada de proteção caso o botão não sanitize corretamente)
      const threadType = body.thread_type || '';
      if (threadType === 'team_internal' && userIds.length > 1) {
        console.warn(`[skillInitiateVideoCall] GUARDRAIL: team_internal com ${userIds.length} destinos. Forçando 1:1. IDs: ${JSON.stringify(userIds)}`);
        userIds = [userIds[0]];
      }

      // Log de auditoria
      console.log(`[skillInitiateVideoCall] modo=interno, thread_type=${threadType}, caller=${user.id}, destinos=${JSON.stringify(userIds)}`);

      if (userIds.length === 0) {
        return Response.json({ success: false, error: 'Nenhum destinatário interno informado' }, { status: 400 });
      }

      // Resolve nomes dos destinatários
      const destinatarios = [];
      for (const uid of userIds) {
        try {
          const u = await base44.asServiceRole.entities.User.get(uid);
          destinatarios.push({ id: uid, nome: u.full_name || u.email || 'Colega' });
        } catch (_) {
          destinatarios.push({ id: uid, nome: 'Colega' });
        }
      }

      const isGrupo = userIds.length > 1;

      // ── BRANCH A: 1:1 INTERNO → WebRTC P2P ──
      if (!isGrupo) {
        const destino = destinatarios[0];

        const session = await base44.asServiceRole.entities.CallSession.create({
          modo: 'interno_webrtc',
          tipo,
          status: 'iniciando',
          caller_id: user.id,
          caller_nome: user.full_name || 'Eu',
          callee_id: destino.id,
          callee_nome: destino.nome,
          callee_ids: [destino.id],
          callee_nomes: [destino.nome],
          thread_id,
          iniciado_por: user.email || user.id,
          iniciado_em: agora,
          link_enviado_whatsapp: false
        });

        return Response.json({
          success: true,
          session_id: session.id,
          overlay_type: 'webrtc',
          modo_callsession: 'interno_webrtc',
          tipo,
          peer_nome: destino.nome,
          destinatarios,
          link_enviado_interno: false,
          link_enviado_whatsapp: false
        });
      }

      // ── BRANCH B: GRUPO INTERNO → Jitsi (SFU) ──
      const roomSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
      const roomName = `nexus-grupo-${roomSuffix}`;
      const roomUrl = `https://meet.jit.si/${roomName}`;

      const groupLabel = `Grupo (${destinatarios.length} pessoas)`;

      const session = await base44.asServiceRole.entities.CallSession.create({
        modo: 'externo_jitsi',  // reusa enum existente (Jitsi = SFU, mesmo em grupo interno)
        tipo,
        status: 'iniciando',
        room_name: roomName,
        room_url: roomUrl,
        caller_id: user.id,
        caller_nome: user.full_name || 'Eu',
        callee_ids: userIds,
        callee_nomes: destinatarios.map(d => d.nome),
        thread_id,
        iniciado_por: user.email || user.id,
        iniciado_em: agora,
        link_enviado_whatsapp: false
      });

      const mensagemInterna = `${tipoLabel} — ${nomeAtendente} iniciou uma reunião em grupo!\n\nClique para entrar:\n${roomUrl}\n\n_A sala ficará disponível por 60 minutos._`;

      // Posta link no thread
      let linkEnviadoInterno = false;
      try {
        const resp = await base44.asServiceRole.functions.invoke('sendInternalMessage', {
          thread_id,
          content: mensagemInterna,
          media_type: 'none'
        });
        linkEnviadoInterno = resp?.data?.success === true;
      } catch (e) {
        console.warn('[skillInitiateVideoCall] Falha ao enviar mensagem interna (grupo):', e.message);
      }

      await base44.asServiceRole.entities.CallSession.update(session.id, {
        status: 'ativa',
        link_enviado_whatsapp: false,
        mensagem_enviada: mensagemInterna
      });

      return Response.json({
        success: true,
        session_id: session.id,
        overlay_type: 'jitsi',
        modo_callsession: 'externo_jitsi',
        tipo,
        room_url: roomUrl,
        room_name: roomName,
        contact_nome: groupLabel,
        destinatarios,
        link_enviado_interno: linkEnviadoInterno,
        link_enviado_whatsapp: false
      });
    }

    // ───────────────────────────────────────────────────────────────────
    // MODO EXTERNO (contato WhatsApp)
    // ───────────────────────────────────────────────────────────────────
    const { contact_id, integration_id } = body;
    if (!contact_id) {
      return Response.json({ success: false, error: 'contact_id obrigatório para modo externo' }, { status: 400 });
    }

    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact) {
      return Response.json({ success: false, error: 'Contato não encontrado' }, { status: 404 });
    }

    const telefone = contact.telefone || contact.celular;
    if (!telefone) {
      return Response.json({ success: false, error: 'Contato sem telefone cadastrado' }, { status: 400 });
    }

    const roomSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
    const roomName = `nexus-${roomSuffix}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    const session = await base44.asServiceRole.entities.CallSession.create({
      modo: 'externo_jitsi',
      tipo,
      status: 'iniciando',
      room_name: roomName,
      room_url: roomUrl,
      contact_id,
      contact_nome: contact.nome || telefone,
      contact_telefone: telefone,
      thread_id: thread_id || null,
      integration_id: integration_id || null,
      iniciado_por: user.email || user.id,
      iniciado_em: agora,
      link_enviado_whatsapp: false
    });

    const mensagem = `${tipoLabel} — ${nomeAtendente} está te chamando!\n\nClique para entrar:\n${roomUrl}\n\n_A sala ficará disponível por 60 minutos._`;

    let linkEnviadoWhatsapp = false;
    if (integration_id) {
      try {
        const resultado = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id,
          numero_destino: telefone,
          mensagem
        });
        linkEnviadoWhatsapp = resultado?.data?.success === true;
      } catch (e) {
        console.warn('[skillInitiateVideoCall] Falha ao enviar WhatsApp:', e.message);
      }
    }

    await base44.asServiceRole.entities.CallSession.update(session.id, {
      status: 'ativa',
      link_enviado_whatsapp: linkEnviadoWhatsapp,
      mensagem_enviada: mensagem
    });

    return Response.json({
      success: true,
      session_id: session.id,
      overlay_type: 'jitsi',
      modo_callsession: 'externo_jitsi',
      tipo,
      room_url: roomUrl,
      room_name: roomName,
      contact_nome: contact.nome || telefone,
      destinatarios: [{ id: contact_id, nome: contact.nome || telefone }],
      link_enviado_whatsapp: linkEnviadoWhatsapp,
      link_enviado_interno: false
    });

  } catch (error) {
    console.error('[skillInitiateVideoCall] Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});