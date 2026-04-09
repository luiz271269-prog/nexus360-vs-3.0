import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run !== false; // default: dry_run = true (seguro)

  try {
    const todos = await base44.asServiceRole.entities.Orcamento.list('-created_date', 5000);

    // Extrai o número base do orçamento (remove sufixos /1, /2, etc.)
    const baseNumero = (num) => {
      if (!num) return '';
      return String(num).trim().replace(/\/\d+$/, '').toUpperCase();
    };

    // Normaliza nome do cliente para comparação
    const normalizeCliente = (nome) => {
      if (!nome) return '';
      return nome
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .replace(/\b(SA|LTDA|EIRELI|ME|EPP|SS|SAS|SPE|DO|DE|DA|DOS|DAS|E|EM)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30); // primeiros 30 chars para match fuzzy
    };

    // ── ESTRATÉGIA 1: mesmo número base de orçamento (ex: 89127 e 89127/1)
    const gruposPorNumero = {};
    for (const orc of todos) {
      const base = baseNumero(orc.numero_orcamento);
      if (!base || base.startsWith('ORC')) continue; // ignora ORC manuais
      if (!gruposPorNumero[base]) gruposPorNumero[base] = [];
      gruposPorNumero[base].push(orc);
    }

    // ── ESTRATÉGIA 2: mesmo cliente normalizado + mesmo vendedor + valor igual
    const gruposPorClienteValor = {};
    for (const orc of todos) {
      const clienteNorm = normalizeCliente(orc.cliente_nome);
      const valor = Math.round(orc.valor_total || 0);
      if (!clienteNorm || valor === 0) continue;
      const chave = `${clienteNorm}|${valor}`;
      if (!gruposPorClienteValor[chave]) gruposPorClienteValor[chave] = [];
      gruposPorClienteValor[chave].push(orc);
    }

    const gruposDetectados = {};

    const processarGrupo = (lista, origem) => {
      if (lista.length <= 1) return;
      // Ordenar: manter o com maior valor ou mais recente
      lista.sort((a, b) => {
        const vA = a.valor_total || 0, vB = b.valor_total || 0;
        if (vB !== vA) return vB - vA;
        return new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0);
      });
      const [manter, ...remover] = lista;
      // evitar processar o mesmo grupo duas vezes
      const chaveGrupo = lista.map(o => o.id).sort().join(',');
      if (gruposDetectados[chaveGrupo]) return;
      gruposDetectados[chaveGrupo] = {
        origem,
        manter: { id: manter.id, numero: manter.numero_orcamento, cliente: manter.cliente_nome, valor: manter.valor_total, status: manter.status },
        remover: remover.map(r => ({ id: r.id, numero: r.numero_orcamento, cliente: r.cliente_nome, valor: r.valor_total, status: r.status, criado: r.created_date }))
      };
    };

    for (const lista of Object.values(gruposPorNumero)) processarGrupo(lista, 'numero_base');
    for (const lista of Object.values(gruposPorClienteValor)) processarGrupo(lista, 'cliente_valor_igual');

    const detalhes = Object.values(gruposDetectados);
    const idsParaDeletar = [...new Set(detalhes.flatMap(g => g.remover.map(r => r.id)))];

    if (dryRun) {
      return Response.json({
        dry_run: true,
        total_orcamentos: todos.length,
        grupos_duplicados: detalhes.length,
        ids_para_deletar: idsParaDeletar.length,
        detalhes
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
      grupos_duplicados: detalhes.length,
      deletados,
      erros,
      detalhes
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});