/**
 * MIGRAÇÃO CIRÚRGICA — Fase 0: Script de uso único
 * Converte vendedor_id de Orcamento e Cliente de Vendedor.id → User.id
 * 
 * MODO DRY_RUN (padrão): apenas lista o que seria alterado, sem gravar.
 * Para executar de verdade: { "dry_run": false }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Apenas admin pode executar esta migração' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const DRY_RUN = body.dry_run !== false; // padrão: true (seguro)

  const log = [];
  const erros = [];
  let orcamentosAtualizados = 0;
  let clientesAtualizados = 0;

  // 1. Carregar todos os vendedores (Vendedor.id → user_id)
  const vendedores = await base44.asServiceRole.entities.Vendedor.list();
  const mapaVendedorParaUser = {};
  for (const v of vendedores) {
    if (v.id && v.user_id) {
      mapaVendedorParaUser[v.id] = v.user_id;
    }
  }

  // 2. Carregar todos os Users para validação
  const users = await base44.asServiceRole.entities.User.list();
  const userIds = new Set(users.map(u => u.id));

  log.push(`Vendedores mapeados: ${Object.keys(mapaVendedorParaUser).length}`);
  log.push(`Users no sistema: ${userIds.size}`);

  // 3. Migrar Orcamentos
  const orcamentos = await base44.asServiceRole.entities.Orcamento.list();
  log.push(`Orçamentos encontrados: ${orcamentos.length}`);

  for (const orc of orcamentos) {
    const vidAtual = orc.vendedor_id;
    if (!vidAtual) continue;

    // Já é um User.id válido → pular
    if (userIds.has(vidAtual)) continue;

    // É um Vendedor.id → converter para user_id
    const novoUserId = mapaVendedorParaUser[vidAtual];
    if (!novoUserId) {
      erros.push(`Orcamento ${orc.id} (${orc.cliente_nome}): vendedor_id="${vidAtual}" não encontrado em Vendedor`);
      continue;
    }

    log.push(`Orcamento ${orc.id} (${orc.cliente_nome}): ${vidAtual} → ${novoUserId}`);

    if (!DRY_RUN) {
      await base44.asServiceRole.entities.Orcamento.update(orc.id, { vendedor_id: novoUserId });
    }
    orcamentosAtualizados++;
  }

  // 4. Migrar Clientes
  const clientes = await base44.asServiceRole.entities.Cliente.list();
  log.push(`Clientes encontrados: ${clientes.length}`);

  for (const cli of clientes) {
    const vidAtual = cli.vendedor_id;
    if (!vidAtual) continue;

    // Já é um User.id válido → pular
    if (userIds.has(vidAtual)) continue;

    // É um Vendedor.id → converter
    const novoUserId = mapaVendedorParaUser[vidAtual];
    if (!novoUserId) {
      erros.push(`Cliente ${cli.id} (${cli.razao_social}): vendedor_id="${vidAtual}" não encontrado em Vendedor`);
      continue;
    }

    log.push(`Cliente ${cli.id} (${cli.razao_social}): ${vidAtual} → ${novoUserId}`);

    if (!DRY_RUN) {
      await base44.asServiceRole.entities.Cliente.update(cli.id, { vendedor_id: novoUserId });
    }
    clientesAtualizados++;
  }

  return Response.json({
    modo: DRY_RUN ? 'DRY_RUN (nenhuma alteração gravada)' : 'EXECUÇÃO REAL',
    resumo: {
      orcamentos_a_migrar: orcamentosAtualizados,
      clientes_a_migrar: clientesAtualizados,
      erros: erros.length
    },
    erros,
    log,
    instrucao: DRY_RUN
      ? 'Para executar de verdade, envie { "dry_run": false }'
      : '✅ Migração concluída!'
  });
});