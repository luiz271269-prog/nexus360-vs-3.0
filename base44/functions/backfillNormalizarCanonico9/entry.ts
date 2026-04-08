// Backfill: Re-normalizar telefone_canonico de 12 dígitos → 13 dígitos (inserir dígito 9 móvel)
// Resolve: contatos criados antes da normalização inserir o 9 não eram encontrados pelo webhook
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalizarCanonico(canon) {
  if (!canon) return null;
  const n = String(canon).replace(/\D/g, '');
  // Caso clássico: 55 + DDD(2) + 8 dígitos = 12 dígitos
  // Se dígito[4] (primeiro do número) for 6,7,8,9 → inserir 9
  if (n.startsWith('55') && n.length === 12) {
    if (['6','7','8','9'].includes(n[4])) {
      return n.substring(0, 4) + '9' + n.substring(4); // 13 dígitos
    }
  }
  return null; // não precisa corrigir
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ error: 'sdk_init_error', details: e.message }, { status: 500 });
  }

  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const { dry_run = false, limit = 500 } = await req.json().catch(() => ({}));
  console.log(`[BACKFILL-9] Iniciando | dry_run=${dry_run} | limit=${limit}`);

  let corrigidos = 0;
  let pulados = 0;
  let erros = 0;
  const exemplos = [];

  let skip = 0;
  const LOTE = 100;

  while (skip < limit) {
    const loteSize = Math.min(LOTE, limit - skip);
    let contatos;
    try {
      contatos = await base44.asServiceRole.entities.Contact.list('-created_date', loteSize, skip);
    } catch (e) {
      console.error(`[BACKFILL-9] Erro ao buscar lote offset=${skip}:`, e.message);
      break;
    }

    if (!contatos || contatos.length === 0) break;

    for (const c of contatos) {
      const canon = c.telefone_canonico;
      const novoCanon = normalizarCanonico(canon);

      if (!novoCanon) {
        pulados++;
        continue;
      }

      if (exemplos.length < 20) {
        exemplos.push({ id: c.id, nome: c.nome, de: canon, para: novoCanon });
      }

      if (!dry_run) {
        try {
          // Normalizar também o telefone principal
          const novoTelefone = '+' + novoCanon;
          await base44.asServiceRole.entities.Contact.update(c.id, {
            telefone_canonico: novoCanon,
            telefone: novoTelefone
          });
          corrigidos++;
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.error(`[BACKFILL-9] Erro ao atualizar ${c.id}:`, e.message);
          erros++;
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        corrigidos++; // conta como "seriam corrigidos"
      }
    }

    if (contatos.length < loteSize) break;
    skip += loteSize;
  }

  console.log(`[BACKFILL-9] Concluído | corrigidos=${corrigidos} | pulados=${pulados} | erros=${erros}`);

  return Response.json({
    success: true,
    dry_run,
    corrigidos,
    pulados,
    erros,
    exemplos
  });
});