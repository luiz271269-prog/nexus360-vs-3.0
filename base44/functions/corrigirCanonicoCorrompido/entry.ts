// Limpa contatos com telefone_canonico corrompido pelo prefixo MERGED_
// Causa: legado do corrigirVinculacaoThreadContato antes do fix de 2026-04-22
// - Se existe OUTRO contato com canonical correto: DELETA o corrompido
// - Se o corrompido é o único: RESTAURA o canonical limpo
// Admin-only. Suporta dry_run para preview.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VERSION = 'v1.0-2026-04-22';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
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
    return Response.json({ error: 'forbidden', message: 'Apenas admin' }, { status: 403 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {}
  const dryRun = payload?.dry_run === true;
  const limite = Math.min(Number(payload?.limite) || 200, 500);

  console.log(`[${VERSION}] 🔍 Iniciando limpeza | dry_run=${dryRun} | limite=${limite}`);

  const resultado = {
    dry_run: dryRun,
    encontrados: 0,
    restaurados: 0,
    deletados: 0,
    ignorados: 0,
    erros: [],
    detalhes: []
  };

  try {
    // Buscar contatos com canonical corrompido
    const corrompidos = await base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: { $regex: '^MERGED_' } },
      '-updated_date',
      limite
    );

    resultado.encontrados = corrompidos?.length || 0;
    console.log(`[${VERSION}] 📊 Encontrados ${resultado.encontrados} contatos corrompidos`);

    if (!corrompidos || corrompidos.length === 0) {
      return Response.json(resultado);
    }

    for (const c of corrompidos) {
      try {
        // Extrair canonical limpo do prefixo MERGED_
        const corrompido = c.telefone_canonico || '';
        // Remover TODOS os prefixos MERGED_ (casos extremos com múltiplos)
        const canonicLimpo = corrompido.replace(/^(MERGED_)+/, '').trim();

        if (!canonicLimpo || canonicLimpo.length < 8) {
          resultado.ignorados++;
          resultado.detalhes.push({ id: c.id, acao: 'ignorado', motivo: 'canonical_vazio_ou_curto', valor: corrompido });
          continue;
        }

        // Verificar se existe OUTRO contato com canonical correto
        const outros = await base44.asServiceRole.entities.Contact.filter(
          { telefone_canonico: canonicLimpo },
          'created_date',
          5
        );

        const outrosAtivos = (outros || []).filter(o => o.id !== c.id);

        if (outrosAtivos.length > 0) {
          // Existe contato "limpo" — deletar o corrompido (é duplicata legada)
          if (!dryRun) {
            await base44.asServiceRole.entities.Contact.delete(c.id);
          }
          resultado.deletados++;
          resultado.detalhes.push({ id: c.id, nome: c.nome, acao: 'deletado', motivo: 'duplicata_com_outro_limpo', outro_id: outrosAtivos[0].id });
          console.log(`[${VERSION}] 🗑️ ${dryRun ? '[DRY]' : ''} Deletado ${c.id} (duplicata de ${outrosAtivos[0].id})`);
        } else {
          // Nenhum outro contato — restaurar canonical limpo neste
          if (!dryRun) {
            await base44.asServiceRole.entities.Contact.update(c.id, {
              telefone_canonico: canonicLimpo
            });
          }
          resultado.restaurados++;
          resultado.detalhes.push({ id: c.id, nome: c.nome, acao: 'restaurado', canonical_antes: corrompido, canonical_depois: canonicLimpo });
          console.log(`[${VERSION}] ✅ ${dryRun ? '[DRY]' : ''} Restaurado ${c.id}: ${corrompido} → ${canonicLimpo}`);
        }

        // Delay para evitar 429
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        resultado.erros.push({ id: c.id, erro: e.message });
        console.error(`[${VERSION}] ❌ Erro em ${c.id}:`, e.message);
      }
    }

    console.log(`[${VERSION}] ✅ Concluído: ${resultado.restaurados} restaurados, ${resultado.deletados} deletados, ${resultado.erros.length} erros`);

    return Response.json(resultado);
  } catch (error) {
    console.error(`[${VERSION}] ❌ Erro fatal:`, error);
    return Response.json({ error: error.message, resultado }, { status: 500 });
  }
});