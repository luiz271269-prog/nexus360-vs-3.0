import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Sincroniza os vínculos User.email_accounts -> EmailAccount.assigned_user_ids.
// Fonte de verdade: o cadastro do usuário (campo email_accounts).
// Resultado: cada EmailAccount passa a listar em assigned_user_ids todos os
// usuários que a marcaram no próprio cadastro. A sincronização/leitura usa esse campo.
// Admin-only.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;

    const usuarios = await db.User.list('-created_date', 1000);
    const contas = await db.EmailAccount.list('-created_date', 1000);

    // Mapa: email_account_id -> Set(user_id) com base no cadastro de cada usuário
    const vinculoDesejado = new Map();
    for (const u of (usuarios || [])) {
      const lista = Array.isArray(u.email_accounts) ? u.email_accounts : [];
      for (const ea of lista) {
        if (!ea?.email_account_id) continue;
        if (ea.ativo === false) continue;
        if (!vinculoDesejado.has(ea.email_account_id)) {
          vinculoDesejado.set(ea.email_account_id, new Set());
        }
        vinculoDesejado.get(ea.email_account_id).add(u.id);
      }
    }

    const alteracoes = [];
    for (const conta of (contas || [])) {
      const desejado = Array.from(vinculoDesejado.get(conta.id) || []);
      const atual = Array.isArray(conta.assigned_user_ids) ? conta.assigned_user_ids : [];

      const desejadoOrd = [...desejado].sort();
      const atualOrd = [...atual].sort();
      const igual = desejadoOrd.length === atualOrd.length &&
        desejadoOrd.every((v, i) => v === atualOrd[i]);

      if (!igual) {
        await db.EmailAccount.update(conta.id, { assigned_user_ids: desejado });
        alteracoes.push({
          email_account_id: conta.id,
          email_address: conta.email_address,
          antes: atual,
          depois: desejado
        });
      }
    }

    return Response.json({
      ok: true,
      total_contas: (contas || []).length,
      contas_atualizadas: alteracoes.length,
      alteracoes
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});