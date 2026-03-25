// BACKFILL: Preenche telefone_canonico nos ~500 contacts históricos que não têm o campo
// v3.0.0 — 2026-03-25 — retry com backoff para 429

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

async function updateWithRetry(entities, id, data, maxRetries = 4) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await entities.Contact.update(id, data);
      return true;
    } catch (e) {
      const is429 = e?.message?.includes('429') || e?.message?.includes('Rate limit');
      if (is429 && i < maxRetries - 1) {
        const delay = 500 * Math.pow(2, i); // 500ms, 1s, 2s, 4s
        console.warn(`[BACKFILL] 429 em ${id}, aguardando ${delay}ms (tentativa ${i+1})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me().catch(() => null);
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }

  // Aceitar params via body (POST/test) OU URL query string (GET)
  let bodyParams = {};
  try {
    const text = await req.text();
    if (text) bodyParams = JSON.parse(text);
  } catch {}
  const urlParams = new URL(req.url).searchParams;

  const skip   = parseInt(bodyParams.skip   ?? urlParams.get('skip')   ?? '0');
  const limit  = parseInt(bodyParams.limit  ?? urlParams.get('limit')  ?? '600');
  const dryRun = bodyParams.dry_run !== undefined
    ? Boolean(bodyParams.dry_run)
    : urlParams.get('dry_run') !== 'false';

  console.log(`[BACKFILL] skip=${skip} limit=${limit} dry_run=${dryRun}`);

  let contacts = [];
  try {
    const todos = await base44.asServiceRole.entities.Contact.list('-created_date', limit + skip);
    contacts = todos.slice(skip, skip + limit).filter(c => c.telefone && !c.telefone_canonico);
    console.log(`[BACKFILL] carregados: ${todos.length} | sem canonico: ${contacts.length}`);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers });
  }

  let atualizados = 0, erros = 0, semTelefone = 0;
  const detalhes = [];

  for (const c of contacts) {
    const canonico = normalizarCanonicoDerivado(c.telefone);
    if (!canonico) { semTelefone++; continue; }

    if (!dryRun) {
      try {
        await updateWithRetry(base44.asServiceRole.entities, c.id, { telefone_canonico: canonico });
        atualizados++;
        console.log(`[BACKFILL] ✅ ${c.id} | ${c.nome} | ${c.telefone} → ${canonico}`);
        // Pequeno delay entre updates para não bater no rate limit
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        erros++;
        console.warn(`[BACKFILL] ❌ Erro final ${c.id}:`, e.message);
      }
    } else {
      detalhes.push({ id: c.id, nome: c.nome, telefone: c.telefone, canonico });
      atualizados++;
    }
  }

  return Response.json({
    dry_run: dryRun,
    skip, limit,
    total_processados: contacts.length,
    sem_telefone_valido: semTelefone,
    atualizados, erros,
    ...(dryRun ? { preview: detalhes } : {})
  }, { headers });
});