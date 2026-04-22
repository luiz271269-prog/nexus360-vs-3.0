// Utilitário admin: agrupa contatos por telefone_canonico e retorna grupos duplicados.
// NÃO modifica nada. Somente leitura + agregação em memória.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VERSION = 'v1.0-2026-04-22';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  let base44;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'forbidden' }, { status: 403, headers });
    }
  } catch (e) {
    return Response.json({ error: 'auth_error', details: e.message }, { status: 401, headers });
  }

  let payload = {};
  try { payload = await req.json(); } catch { /* GET ou body vazio = ok */ }
  const limite = Math.min(payload.limite || 5000, 10000);
  const topN = payload.topN || 30;

  console.log(`[${VERSION}] 🔍 Analisando duplicidades | limite=${limite}`);

  // Puxar contatos (paginando se necessário)
  const all = [];
  let skip = 0;
  const pageSize = 500;
  while (skip < limite) {
    const batch = await base44.asServiceRole.entities.Contact.list('-created_date', pageSize, skip);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
    await new Promise(r => setTimeout(r, 200)); // anti-rate-limit
  }

  console.log(`[${VERSION}] 📊 Total carregado: ${all.length}`);

  // Agrupar por telefone_canonico
  const grupos = new Map();
  let semCanonical = 0;
  let comPrefixoMerged = 0;

  for (const c of all) {
    const canonical = c.telefone_canonico;
    if (!canonical) { semCanonical++; continue; }
    if (String(canonical).startsWith('MERGED_')) { comPrefixoMerged++; continue; }
    if (!grupos.has(canonical)) grupos.set(canonical, []);
    grupos.get(canonical).push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      tipo_contato: c.tipo_contato,
      empresa: c.empresa,
      cliente_id: c.cliente_id,
      conexao_origem: c.conexao_origem,
      created_date: c.created_date,
      ultima_interacao: c.ultima_interacao,
      total_promos: (c.last_promo_ids || []).length,
      tags_count: (c.tags || []).length
    });
  }

  // Filtrar só grupos com duplicatas
  const duplicados = [];
  for (const [canonical, lista] of grupos.entries()) {
    if (lista.length > 1) {
      // Ordenar por relevância: cliente > lead > resto, depois mais recente
      const ordenada = [...lista].sort((a, b) => {
        const prio = { cliente: 4, lead: 3, parceiro: 2, fornecedor: 1, novo: 0 };
        const pa = prio[a.tipo_contato] ?? -1;
        const pb = prio[b.tipo_contato] ?? -1;
        if (pa !== pb) return pb - pa;
        const da = a.ultima_interacao || a.created_date;
        const db = b.ultima_interacao || b.created_date;
        return new Date(db) - new Date(da);
      });
      duplicados.push({
        canonical,
        total: lista.length,
        sugerido_mestre: ordenada[0].id,
        contatos: ordenada
      });
    }
  }

  // Ordenar duplicados por tamanho
  duplicados.sort((a, b) => b.total - a.total);

  const totalDuplicatas = duplicados.reduce((sum, g) => sum + (g.total - 1), 0);

  return Response.json({
    version: VERSION,
    resumo: {
      total_contatos_analisados: all.length,
      contatos_sem_canonical: semCanonical,
      contatos_com_prefixo_merged: comPrefixoMerged,
      grupos_unicos: grupos.size,
      grupos_duplicados: duplicados.length,
      total_duplicatas_excedentes: totalDuplicatas
    },
    top_duplicados: duplicados.slice(0, topN),
    truncado: duplicados.length > topN
  }, { headers });
});