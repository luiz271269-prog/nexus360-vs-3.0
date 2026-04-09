import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run !== false; // default: dry_run = true (seguro)

  try {
    const todos = await base44.asServiceRole.entities.Orcamento.list('-created_date', 5000);

    // Normalizar telefone (apenas dígitos)
    const normTel = (t) => (t || '').replace(/\D/g, '').trim();

    // Chave composta: numero_orcamento + cliente_nome + telefone/celular
    const chaveComposta = (orc) => {
      const numero = (orc.numero_orcamento || '').trim().toUpperCase();
      const cliente = (orc.cliente_nome || '').trim().toUpperCase();
      const tel = normTel(orc.cliente_telefone) || normTel(orc.cliente_celular) || '';
      return `${numero}|${cliente}|${tel}`;
    };

    // Agrupar por chave composta
    const grupos = {};
    for (const orc of todos) {
      const chave = chaveComposta(orc);
      // Ignorar orçamentos sem nenhuma chave identificável
      if (!chave.replace(/\|/g, '').trim()) continue;
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(orc);
    }

    // Identificar duplicatas
    const duplicatas = [];
    const idsParaDeletar = [];

    for (const [chave, lista] of Object.entries(grupos)) {
      if (lista.length <= 1) continue;

      // Ordenar: manter o com maior valor_total ou mais recente
      lista.sort((a, b) => {
        const valorA = a.valor_total || 0;
        const valorB = b.valor_total || 0;
        if (valorB !== valorA) return valorB - valorA; // maior valor primeiro
        const dateA = new Date(a.updated_date || a.created_date || 0);
        const dateB = new Date(b.updated_date || b.created_date || 0);
        return dateB - dateA; // mais recente primeiro
      });

      const [manter, ...remover] = lista;
      const [numero, cliente, tel] = chave.split('|');
      duplicatas.push({
        chave,
        numero_orcamento: numero,
        cliente_nome: cliente,
        telefone: tel,
        manter_id: manter.id,
        manter_valor: manter.valor_total,
        manter_status: manter.status,
        remover: remover.map(r => ({
          id: r.id,
          status: r.status,
          valor: r.valor_total,
          criado: r.created_date
        }))
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