// BACKFILL: Preenche telefone_canonico nos ~500 contacts históricos que não têm o campo
// Chamar uma vez via GET /backfillTelefoneCanonicoScript (admin only)
// v1.0.0 — 2026-03-25

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function normalizarCanonicoDerivado(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;
  n = n.replace(/^0+/, '');
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  if (n.startsWith('55') && n.length === 12) {
    if (['6','7','8','9'].includes(n[4])) n = n.substring(0, 4) + '9' + n.substring(4);
  }
  return n.length >= 10 ? n : null;
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const base44 = createClientFromRequest(req);

  // Admin only
  const user = await base44.auth.me().catch(() => null);
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  const urlParams = new URL(req.url).searchParams;
  const skip = parseInt(urlParams.get('skip') || '0');
  const limit = parseInt(urlParams.get('limit') || '100');
  const dryRun = urlParams.get('dry_run') !== 'false'; // default: dry_run=true

  console.log(`[BACKFILL] skip=${skip} limit=${limit} dry_run=${dryRun}`);

  // Buscar contacts sem telefone_canonico mas com telefone
  let contacts = [];
  try {
    // Não tem query $exists no SDK — buscar em lote e filtrar em memória
    const todos = await base44.asServiceRole.entities.Contact.list('-created_date', limit + skip);
    contacts = todos.slice(skip, skip + limit).filter(c => c.telefone && !c.telefone_canonico);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers });
  }

  let atualizados = 0;
  let erros = 0;
  let semTelefone = 0;
  const detalhes = [];

  for (const c of contacts) {
    const canonico = normalizarCanonicoDerivado(c.telefone);
    if (!canonico) {
      semTelefone++;
      continue;
    }

    if (!dryRun) {
      try {
        await base44.asServiceRole.entities.Contact.update(c.id, { telefone_canonico: canonico });
        atualizados++;
      } catch (e) {
        erros++;
        console.warn(`[BACKFILL] Erro ${c.id}:`, e.message);
      }
    } else {
      detalhes.push({ id: c.id, nome: c.nome, telefone: c.telefone, canonico });
      atualizados++;
    }
  }

  return Response.json({
    dry_run: dryRun,
    skip,
    limit,
    total_processados: contacts.length,
    sem_telefone_valido: semTelefone,
    atualizados,
    erros,
    ...(dryRun ? { preview: detalhes.slice(0, 20) } : {})
  }, { headers });
});