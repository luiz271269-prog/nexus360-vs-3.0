import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { dryRun = true } = await req.json().catch(() => ({}));

    // Buscar todos os usuários
    const users = await base44.asServiceRole.entities.User.list();

    // Mapas de lookup
    const userByEmail = new Map();
    const userByFullName = new Map();
    const userByDisplayName = new Map();
    const userById = new Map();

    for (const u of users) {
      if (u.id) userById.set(u.id, u);
      if (u.email) userByEmail.set(u.email.toLowerCase(), u);
      if (u.full_name) userByFullName.set(u.full_name.trim().toLowerCase(), u);
      const displayName = u.data?.display_name || u.display_name;
      if (displayName) userByDisplayName.set(displayName.trim().toLowerCase(), u);
    }

    // Buscar todos os orçamentos
    const orcamentos = await base44.asServiceRole.entities.Orcamento.list('-created_date', 500);

    const resultados = {
      total: orcamentos.length,
      ja_corretos: 0,
      corrigidos: 0,
      nao_resolvidos: 0,
      detalhes: []
    };

    for (const orc of orcamentos) {
      const d = orc.data || orc;
      const vendedorNome = (d.vendedor || '').trim();
      const vendedorIdAtual = d.vendedor_id;
      const createdById = orc.created_by_id;
      const createdByEmail = orc.created_by;

      let userResolvido = null;
      let metodo = null;

      // 1. Se já tem vendedor_id válido e nome bate com user → correto
      if (vendedorIdAtual && userById.has(vendedorIdAtual)) {
        const u = userById.get(vendedorIdAtual);
        const nomeAtual = vendedorNome.toLowerCase();
        const nomeUser = (u.full_name || '').toLowerCase();
        const displayUser = (u.data?.display_name || u.display_name || '').toLowerCase();
        if (nomeAtual === nomeUser || nomeAtual === displayUser || nomeAtual === u.email?.split('@')[0]) {
          resultados.ja_corretos++;
          continue;
        }
        // Tem ID válido mas nome diferente — manter ID, só atualizar nome
        userResolvido = u;
        metodo = 'id_existente_corrigir_nome';
      }

      // 2. Tentar resolver pelo nome do campo vendedor
      if (!userResolvido && vendedorNome) {
        const nomeNorm = vendedorNome.toLowerCase();
        userResolvido = userByFullName.get(nomeNorm)
          || userByDisplayName.get(nomeNorm)
          || userByEmail.get(nomeNorm)
          || null;
        if (userResolvido) metodo = 'match_nome';
      }

      // 3. Fallback: usar o created_by (quem criou o orçamento)
      if (!userResolvido && createdByEmail) {
        const emailNorm = createdByEmail.toLowerCase();
        // Só usar se não for service account
        if (!emailNorm.includes('service+') && !emailNorm.includes('no-reply')) {
          userResolvido = userByEmail.get(emailNorm) || null;
          if (userResolvido) metodo = 'created_by_fallback';
        }
      }

      if (!userResolvido && createdById && userById.has(createdById)) {
        const u = userById.get(createdById);
        if (!u.is_service) {
          userResolvido = u;
          metodo = 'created_by_id_fallback';
        }
      }

      if (!userResolvido) {
        resultados.nao_resolvidos++;
        resultados.detalhes.push({
          id: orc.id,
          numero: d.numero_orcamento,
          vendedor_campo: vendedorNome || '(vazio)',
          vendedor_id_atual: vendedorIdAtual || null,
          created_by: createdByEmail,
          status: 'nao_resolvido'
        });
        continue;
      }

      const nomeCorreto = userResolvido.data?.display_name || userResolvido.display_name || userResolvido.full_name || userResolvido.email;

      // Verificar se já está correto
      if (vendedorIdAtual === userResolvido.id && vendedorNome === nomeCorreto) {
        resultados.ja_corretos++;
        continue;
      }

      resultados.detalhes.push({
        id: orc.id,
        numero: d.numero_orcamento,
        vendedor_campo_antigo: vendedorNome || '(vazio)',
        vendedor_novo: nomeCorreto,
        vendedor_id_antigo: vendedorIdAtual || null,
        vendedor_id_novo: userResolvido.id,
        metodo,
        status: dryRun ? 'simulado' : 'corrigido'
      });

      if (!dryRun) {
        await base44.asServiceRole.entities.Orcamento.update(orc.id, {
          vendedor: nomeCorreto,
          vendedor_id: userResolvido.id
        });
        resultados.corrigidos++;
      } else {
        resultados.corrigidos++; // conta como "seria corrigido"
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      mensagem: dryRun
        ? `DRY-RUN: ${resultados.corrigidos} orçamentos seriam corrigidos de ${resultados.total} analisados`
        : `${resultados.corrigidos} orçamentos corrigidos com sucesso`,
      resultados,
      usuarios_mapeados: users.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});