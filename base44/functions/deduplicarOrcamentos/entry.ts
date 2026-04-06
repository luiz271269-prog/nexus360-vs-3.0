import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run !== false; // default: dry_run = true (seguro)

  try {
    const todos = await base44.asServiceRole.entities.Orcamento.list('-created_date', 5000);

    // Agrupar por numero_orcamento
    const grupos = {};
    for (const orc of todos) {
      const chave = (orc.numero_orcamento || '').trim().toUpperCase();
      if (!chave) continue;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(orc);
    }

    // Identificar duplicatas
    const duplicatas = [];
    const idsParaDeletar = [];

    for (const [numero, lista] of Object.entries(grupos)) {
      if (lista.length <= 1) continue;

      // Ordenar: manter o mais recente (updated_date ou created_date)
      lista.sort((a, b) => {
        const dateA = new Date(a.updated_date || a.created_date || 0);
        const dateB = new Date(b.updated_date || b.created_date || 0);
        return dateB - dateA; // mais recente primeiro
      });

      const [manter, ...remover] = lista;
      duplicatas.push({
        numero_orcamento: numero,
        manter_id: manter.id,
        manter_cliente: manter.cliente_nome,
        remover: remover.map(r => ({ id: r.id, cliente: r.cliente_nome, criado: r.created_date }))
      });

      idsParaDeletar.push(...remover.map(r => r.id));
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_orcamentos: todos.length,
        grupos_duplicados: duplicatas.length,
        ids_para_deletar: idsParaDeletar.length,
        detalhes: duplicatas
      });
    }

    // Executar deleção
    let deletados = 0;
    const erros = [];
    for (const id of idsParaDeletar) {
      try {
        await base44.asServiceRole.entities.Orcamento.delete(id);
        deletados++;
      } catch (e) {
        erros.push({ id, erro: e.message });
      }
    }

    return Response.json({
      dry_run: false,
      total_orcamentos: todos.length,
      grupos_duplicados: duplicatas.length,
      deletados,
      erros,
      detalhes: duplicatas
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});