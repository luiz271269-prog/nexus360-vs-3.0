import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Aprova ou rejeita um EmailSincronizado que está na caixa temporária (status pendente).
// - aprovar: se não houver contact_id, cria um Contact (tipo_contato="email") com o remetente,
//   vincula e marca status_aprovacao="aprovado". A ponte emailsParaCentral leva pra Central depois.
// - rejeitar: marca status_aprovacao="rejeitado" (não entra na Central).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { email_id, acao, bloquear_remetente } = body; // acao: 'aprovar' | 'rejeitar'

    if (!email_id || !['aprovar', 'rejeitar'].includes(acao)) {
      return Response.json({ error: 'Parâmetros: email_id e acao ("aprovar" ou "rejeitar").' }, { status: 400 });
    }

    const email = await db.EmailSincronizado.get(email_id).catch(() => null);
    if (!email) return Response.json({ error: 'E-mail não encontrado.' }, { status: 404 });

    if (acao === 'rejeitar') {
      const agora = new Date().toISOString();
      let bloqueados = 0;
      const remetente = (email.remetente_email || '').toLowerCase().trim();

      let apagados_zimbra = 0;

      // Bloquear o remetente: adiciona à blocklist, rejeita E APAGA no Zimbra todos os pendentes dele
      if (bloquear_remetente && remetente) {
        const jaBloqueado = await db.EmailRemetenteBloqueado.filter({ remetente_email: remetente }, '-created_date', 1).catch(() => []);
        if (!jaBloqueado || jaBloqueado.length === 0) {
          await db.EmailRemetenteBloqueado.create({
            remetente_email: remetente,
            remetente_nome: email.remetente_nome || '',
            motivo: 'Rejeitado na caixa de aprovação',
            bloqueado_por: user.email
          });
        }

        // Rejeita em lote todos os pendentes/aguardando do mesmo remetente
        const doRemetente = await db.EmailSincronizado.filter({ remetente_email: remetente }, '-created_date', 200).catch(() => []);
        const uidsPorConta = {}; // account_login -> Set de UIDs a apagar no Zimbra
        for (const item of (doRemetente || [])) {
          if (['pendente', 'aprovado'].includes(item.status_aprovacao)) {
            await db.EmailSincronizado.update(item.id, {
              status_aprovacao: 'rejeitado',
              aprovado_por: user.email,
              aprovado_em: agora
            });
            bloqueados++;
          }
          // junta UIDs por caixa (mesmo já rejeitados antes) para apagar no servidor
          const login = item.account_login;
          const uidNum = Number(item.message_uid);
          if (login && Number.isFinite(uidNum)) {
            (uidsPorConta[login] = uidsPorConta[login] || new Set()).add(uidNum);
          }
        }

        // Apaga DE VERDADE no Zimbra (por caixa)
        const appId = Deno.env.get('BASE44_APP_ID');
        for (const [login, uidSet] of Object.entries(uidsPorConta)) {
          const uids = Array.from(uidSet);
          if (uids.length === 0) continue;
          try {
            const resp = await base44.asServiceRole.functions.invoke('apagarEmailZimbraImap', {
              email_address: login,
              uids,
              internal_secret: appId
            });
            const data = resp?.data || resp;
            if (data?.ok) apagados_zimbra += data.apagados || uids.length;
          } catch (err) {
            console.error('[aprovarEmailPendente] Falha ao apagar no Zimbra:', login, err?.message || err);
          }
        }
      }

      await db.EmailSincronizado.update(email_id, {
        status_aprovacao: 'rejeitado',
        aprovado_por: user.email,
        aprovado_em: agora
      });
      return Response.json({ ok: true, acao: 'rejeitado', email_id, remetente_bloqueado: !!bloquear_remetente, emails_limpos: bloqueados, apagados_zimbra });
    }

    // Aprovar: garantir um Contact vinculado
    let contactId = email.contact_id;
    if (!contactId && email.remetente_email) {
      // tenta reaproveitar contato existente pelo e-mail antes de criar
      const existentes = await db.Contact.filter({ email: email.remetente_email }, '-created_date', 1);
      if (existentes && existentes[0]) {
        contactId = existentes[0].id;
      } else {
        const novo = await db.Contact.create({
          nome: email.remetente_nome || email.remetente_email,
          email: email.remetente_email,
          tipo_contato: 'email'
        });
        contactId = novo.id;
      }
    }

    await db.EmailSincronizado.update(email_id, {
      status_aprovacao: 'aprovado',
      contact_id: contactId || undefined,
      vinculo_tipo: email.vinculo_tipo || (contactId ? 'contact' : undefined),
      aprovado_por: user.email,
      aprovado_em: new Date().toISOString()
    });

    return Response.json({ ok: true, acao: 'aprovado', email_id, contact_id: contactId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});