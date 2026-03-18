// backfillVisibilidade - Corrige mensagens antigas com visibility = null/undefined
// Regra: sender_type='contact' → public_to_customer | sender_type='user' → internal_only
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { dry_run = false, batch_size = 200 } = await req.json().catch(() => ({}));

  let total_contact = 0;
  let total_user = 0;
  let errors = 0;

  // Buscar mensagens sem visibility (em lotes)
  let skip = 0;
  let processando = true;

  while (processando) {
    const msgs = await base44.asServiceRole.entities.Message.list('-created_date', batch_size, skip)
      .catch(() => []);

    if (!msgs || msgs.length === 0) break;

    const semVisibility = msgs.filter(m => !m.visibility);

    for (const msg of semVisibility) {
      const vis = msg.sender_type === 'contact' ? 'public_to_customer' : 'internal_only';
      if (!dry_run) {
        try {
          await base44.asServiceRole.entities.Message.update(msg.id, { visibility: vis });
          if (msg.sender_type === 'contact') total_contact++;
          else total_user++;
        } catch (e) {
          errors++;
          console.warn(`[BACKFILL] Erro msg ${msg.id}: ${e.message}`);
        }
      } else {
        if (msg.sender_type === 'contact') total_contact++;
        else total_user++;
      }
    }

    // Se retornou menos que batch_size, chegamos no fim
    if (msgs.length < batch_size) {
      processando = false;
    } else {
      skip += batch_size;
    }
  }

  return Response.json({
    success: true,
    dry_run,
    corrigidas: { contact: total_contact, user: total_user, errors },
    total: total_contact + total_user
  });
});