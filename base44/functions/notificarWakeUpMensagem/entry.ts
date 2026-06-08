import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * notificarWakeUpMensagem — gatilho de automação (entity MessageThread / update+create)
 *
 * Quando uma thread externa recebe uma mensagem NOVA de contato, dispara
 * uma notificação Web Push (Wake-Up) para todos os atendentes que podem
 * ver a conversa — replicando EXATAMENTE o critério e o formato do alerta
 * interno (NovasMensagensAlert) que aparece dentro do app.
 *
 * Funciona mesmo com o app FECHADO (via Service Worker + Web Push).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const evt = payload?.event || {};
    let thread = payload?.data || null;
    let oldData = payload?.old_data || null;

    // Se o payload veio truncado, busca a thread atual
    if (payload?.payload_too_large && evt?.entity_id) {
      thread = await base44.asServiceRole.entities.MessageThread.get(evt.entity_id);
    }
    if (!thread) {
      return Response.json({ success: true, skipped: 'sem_thread' });
    }

    // ── Mesmos guards do NovasMensagensAlert ──────────────────────────
    // 1) Só mensagens de CONTATO (não de atendente)
    if (thread.last_message_sender !== 'contact') {
      return Response.json({ success: true, skipped: 'nao_eh_contato' });
    }
    // 2) Só threads externas (ignora internas team/sector)
    if (thread.thread_type && thread.thread_type !== 'contact_external') {
      return Response.json({ success: true, skipped: 'thread_interna' });
    }
    // 3) Precisa ter timestamp da última mensagem
    if (!thread.last_message_at) {
      return Response.json({ success: true, skipped: 'sem_timestamp' });
    }
    // 4) Em update, só dispara se a última mensagem REALMENTE mudou
    //    (evita push em updates de outros campos da thread)
    if (evt?.type === 'update' && oldData && oldData.last_message_at === thread.last_message_at) {
      return Response.json({ success: true, skipped: 'mensagem_nao_mudou' });
    }

    // ── Destinatários: mesmo critério do alerta interno ───────────────
    // assigned + compartilhados + histórico de atendentes + admins
    const destinatarios = new Set();
    if (thread.assigned_user_id) destinatarios.add(thread.assigned_user_id);
    (thread.shared_with_users || []).forEach((id) => id && destinatarios.add(id));
    (thread.atendentes_historico || []).forEach((id) => id && destinatarios.add(id));

    // Admins sempre recebem (igual ao isAdmin do alerta interno)
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      admins.forEach((u) => u?.id && destinatarios.add(u.id));
    } catch (e) {
      console.warn('[notificarWakeUpMensagem] falha ao buscar admins:', e.message);
    }

    if (destinatarios.size === 0) {
      return Response.json({ success: true, skipped: 'sem_destinatarios' });
    }

    // ── Monta título + corpo no MESMO formato do alerta interno ───────
    let contactName = thread.last_message_sender_name || 'Contato';
    let fotoUrl = null;
    if (thread.contact_id) {
      try {
        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: thread.contact_id });
        if (contatos?.length > 0) {
          contactName = contatos[0].nome || contactName;
          fotoUrl = contatos[0].foto_perfil_url || null;
        }
      } catch { /* segue com o nome cache */ }
    }

    const mediaType = thread.last_media_type;
    let preview = thread.last_message_content || '';
    if (mediaType === 'audio') preview = '🎤 Mensagem de voz';
    else if (mediaType === 'image') preview = '📷 Imagem';
    else if (mediaType === 'video') preview = '🎥 Vídeo';
    else if (mediaType === 'document') preview = '📄 Documento';
    else if (preview.length > 60) preview = preview.substring(0, 60) + '…';
    if (!preview) preview = 'Nova mensagem';

    const action_url = thread.contact_id
      ? `/Comunicacao?contact_id=${thread.contact_id}`
      : `/Comunicacao?thread_id=${thread.id}`;

    // ── Dispara o push para cada destinatário ─────────────────────────
    const resultados = [];
    for (const userId of destinatarios) {
      try {
        const res = await base44.asServiceRole.functions.invoke('enviarWakeUpPush', {
          target_user_id: userId,
          tipo: 'message',
          title: contactName,
          body: preview,
          action_url,
          icon: fotoUrl || null,
          thread_id: thread.id,
        });
        resultados.push({ userId, ok: true, res: res?.data || res });
      } catch (e) {
        resultados.push({ userId, ok: false, error: e.message });
      }
    }

    return Response.json({
      success: true,
      contato: contactName,
      preview,
      destinatarios: destinatarios.size,
      resultados,
    });
  } catch (error) {
    console.error('[notificarWakeUpMensagem] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});