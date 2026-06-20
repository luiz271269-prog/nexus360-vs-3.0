import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================
// UNIFICAR CATEGORIAS DE CONVERSA (limpeza de duplicados)
// ==========================================
// Mescla CategoriasMensagens que geram o mesmo slug canônico (acento/maiúscula/plural/espaços)
// e migra MessageThread.categorias para o slug vencedor.
// Corrige slugs corrompidos como "p_r_o_m_o_ç_a_o" → "promocao".
// dry_run=true (default): apenas RELATA. dry_run=false: aplica (merge + migração das conversas).
//
// Vencedor em cada grupo: maior uso_count; desempate por created_date mais antiga.

function normalizarSlug(texto) {
  if (!texto) return '';
  let s = String(texto).trim().toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[\s\-.]+/g, '_');
  s = s.replace(/[^a-z0-9_]/g, '');
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
  s = s.replace(/oes$/, 'ao').replace(/aes$/, 'ao').replace(/ais$/, 'al').replace(/s$/, '');
  return s;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    if (!dryRun && user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem aplicar a limpeza' }, { status: 403 });
    }

    const categorias = await base44.asServiceRole.entities.CategoriasMensagens.list('nome', 1000);

    // Detecta texto corrompido em "letras isoladas" (ex: "p_r_o_m_o_ç_a_o" ou "P R O M O Ç A O"):
    // quando >=4 segmentos (por _ ou espaço) têm 1 caractere, é lixo → juntar as letras.
    const corrigirLetrasIsoladas = (texto) => {
      const partes = String(texto || '').split(/[\s_]+/).filter(Boolean);
      if (partes.length < 4) return texto;
      const unitarios = partes.filter((p) => p.length === 1).length;
      if (unitarios >= partes.length - 1) return partes.join(''); // junta: "promoçao"
      return texto;
    };

    // Agrupar por slug canônico (corrige letras isoladas no nome e no label)
    const grupos = {};
    for (const cat of categorias) {
      const fonte = corrigirLetrasIsoladas(cat.nome) || corrigirLetrasIsoladas(cat.label);
      const slug = normalizarSlug(fonte);
      if (!slug) continue;
      (grupos[slug] = grupos[slug] || []).push(cat);
    }

    const escolherVencedor = (arr) => [...arr].sort((a, b) => {
      const u = (b.uso_count || 0) - (a.uso_count || 0);
      if (u !== 0) return u;
      return new Date(a.created_date) - new Date(b.created_date);
    })[0];

    // Plano: inclui grupos com 2+ duplicadas OU 1 só com slug corrompido (nome !== slug canônico)
    const planos = [];
    for (const [slug, arr] of Object.entries(grupos)) {
      const vencedor = escolherVencedor(arr);
      const perdedores = arr.filter((c) => c.id !== vencedor.id);
      const slugCorrompido = vencedor.nome !== slug;
      if (perdedores.length === 0 && !slugCorrompido) continue;
      planos.push({
        slug,
        slug_corrompido: slugCorrompido,
        vencedor: { id: vencedor.id, nome: vencedor.nome, label: vencedor.label, uso_count: vencedor.uso_count || 0 },
        perdedores: perdedores.map((p) => ({ id: p.id, nome: p.nome, label: p.label, uso_count: p.uso_count || 0 }))
      });
    }

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_etiquetas: categorias.length,
        grupos_duplicados: planos.length,
        planos
      });
    }

    // ── APLICAR ──
    // Mapa: nome_antigo -> slug_canonico (cobre perdedores E vencedores com slug corrompido)
    const remapNome = {};
    for (const plano of planos) {
      for (const p of plano.perdedores) remapNome[p.nome] = plano.slug;
      if (plano.vencedor.nome !== plano.slug) remapNome[plano.vencedor.nome] = plano.slug;
    }

    // 1. Migrar MessageThread.categorias
    let threadsAtualizadas = 0;
    const nomesParaRemap = Object.keys(remapNome);
    if (nomesParaRemap.length > 0) {
      const threads = await base44.asServiceRole.entities.MessageThread.list('-updated_date', 5000);
      for (const t of threads) {
        const cats = t.categorias || [];
        if (!cats.some((c) => remapNome[c])) continue;
        const novas = [...new Set(cats.map((c) => remapNome[c] || c))];
        await base44.asServiceRole.entities.MessageThread.update(t.id, { categorias: novas });
        threadsAtualizadas++;
      }
    }

    // 2. Normalizar vencedor para o slug canônico, somar uso_count e deletar perdedores
    let etiquetasRemovidas = 0;
    for (const plano of planos) {
      const totalUso = plano.perdedores.reduce((s, p) => s + (p.uso_count || 0), plano.vencedor.uso_count || 0);
      const patch = { uso_count: totalUso };
      if (plano.vencedor.nome !== plano.slug) patch.nome = plano.slug;
      await base44.asServiceRole.entities.CategoriasMensagens.update(plano.vencedor.id, patch);
      for (const p of plano.perdedores) {
        await base44.asServiceRole.entities.CategoriasMensagens.delete(p.id);
        etiquetasRemovidas++;
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      grupos_unificados: planos.length,
      etiquetas_removidas: etiquetasRemovidas,
      threads_atualizadas: threadsAtualizadas,
      planos
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});