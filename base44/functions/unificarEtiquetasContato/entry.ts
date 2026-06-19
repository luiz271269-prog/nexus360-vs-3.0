import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================
// UNIFICAR ETIQUETAS DE CONTATO (limpeza de duplicados)
// ==========================================
// Mescla EtiquetaContato que geram o mesmo slug canônico (acento/maiúscula/plural)
// e migra Contact.tags para o slug vencedor.
// dry_run=true (default): apenas RELATA o que faria, sem alterar nada.
// dry_run=false: aplica de fato (merge + atualização dos contatos).
//
// Regra do "vencedor" em cada grupo de duplicados:
//  1. Etiqueta tipo 'fixa' tem prioridade
//  2. Senão, a com maior uso_count
//  3. Desempate: created_date mais antiga

// Normalização inline (espelha components/lib/normalizarEtiqueta.js — backend não importa locais)
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

    // Só admin executa a limpeza real
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default true

    if (!dryRun && user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem aplicar a limpeza' }, { status: 403 });
    }

    const etiquetas = await base44.asServiceRole.entities.EtiquetaContato.list('ordem', 500);

    // Agrupar por slug canônico
    const grupos = {};
    for (const etq of etiquetas) {
      const slug = normalizarSlug(etq.nome || etq.label);
      if (!slug) continue;
      (grupos[slug] = grupos[slug] || []).push(etq);
    }

    // Só nos interessam grupos com 2+ etiquetas (duplicados)
    const gruposDuplicados = Object.entries(grupos).filter(([, arr]) => arr.length > 1);

    // Escolher vencedor de cada grupo
    const escolherVencedor = (arr) => {
      const fixa = arr.find((e) => e.tipo === 'fixa');
      if (fixa) return fixa;
      return [...arr].sort((a, b) => {
        const u = (b.uso_count || 0) - (a.uso_count || 0);
        if (u !== 0) return u;
        return new Date(a.created_date) - new Date(b.created_date);
      })[0];
    };

    const planos = gruposDuplicados.map(([slug, arr]) => {
      const vencedor = escolherVencedor(arr);
      const perdedores = arr.filter((e) => e.id !== vencedor.id);
      return {
        slug,
        vencedor: { id: vencedor.id, nome: vencedor.nome, label: vencedor.label, tipo: vencedor.tipo, uso_count: vencedor.uso_count || 0 },
        perdedores: perdedores.map((p) => ({ id: p.id, nome: p.nome, label: p.label, uso_count: p.uso_count || 0 }))
      };
    });

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_etiquetas: etiquetas.length,
        grupos_duplicados: planos.length,
        planos
      });
    }

    // ── APLICAR ──
    // Mapa: nome_perdedor -> nome_vencedor
    const remapNome = {};
    for (const plano of planos) {
      for (const p of plano.perdedores) remapNome[p.nome] = plano.vencedor.nome;
    }

    // 1. Migrar Contact.tags (apenas contatos que tenham alguma tag perdedora)
    let contatosAtualizados = 0;
    const nomesPerdedores = Object.keys(remapNome);
    if (nomesPerdedores.length > 0) {
      const contatos = await base44.asServiceRole.entities.Contact.list('-updated_date', 5000);
      for (const c of contatos) {
        const tags = c.tags || [];
        if (!tags.some((t) => remapNome[t])) continue;
        const novas = [...new Set(tags.map((t) => remapNome[t] || t))];
        await base44.asServiceRole.entities.Contact.update(c.id, { tags: novas });
        contatosAtualizados++;
      }
    }

    // 2. Somar uso_count no vencedor e deletar perdedores
    let etiquetasRemovidas = 0;
    for (const plano of planos) {
      const totalUso = plano.perdedores.reduce((s, p) => s + (p.uso_count || 0), plano.vencedor.uso_count || 0);
      await base44.asServiceRole.entities.EtiquetaContato.update(plano.vencedor.id, { uso_count: totalUso });
      for (const p of plano.perdedores) {
        await base44.asServiceRole.entities.EtiquetaContato.delete(p.id);
        etiquetasRemovidas++;
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      grupos_unificados: planos.length,
      etiquetas_removidas: etiquetasRemovidas,
      contatos_atualizados: contatosAtualizados,
      planos
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});