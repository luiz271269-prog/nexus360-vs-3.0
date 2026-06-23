import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * getMapaClientes — Agrega clientes por estado (UF) e cidade para o mapa de
 * localização, já resolvendo o nome do vendedor/usuário responsável.
 * Retorno: { porUF: {UF: count}, cidades: [{cidade, uf, total, clientes:[{nome, vendedor}]}], semLocalizacao, total }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [clientes, usuarios] = await Promise.all([
      base44.asServiceRole.entities.Cliente.list('-updated_date', 2000),
      base44.asServiceRole.entities.User.list('', 500).catch(() => [])
    ]);

    const nomeUsuario = (id) => {
      if (!id) return null;
      const u = usuarios.find(x => x.id === id);
      return u?.full_name || u?.email || null;
    };

    const porUF = {};
    const cidadesMap = {};
    let semLocalizacao = 0;

    for (const c of clientes) {
      const uf = (c.uf || '').trim().toUpperCase();
      const cidade = (c.cidade || '').trim();
      if (!uf && !cidade) { semLocalizacao++; continue; }

      if (uf) porUF[uf] = (porUF[uf] || 0) + 1;

      const key = `${cidade.toUpperCase()}|${uf}`;
      if (!cidadesMap[key]) {
        cidadesMap[key] = { cidade: cidade || '(sem cidade)', uf: uf || '-', total: 0, clientes: [] };
      }
      cidadesMap[key].total++;
      cidadesMap[key].clientes.push({
        nome: c.nome_fantasia || c.razao_social,
        vendedor: nomeUsuario(c.usuario_id) || 'Sem responsável',
        status: c.status || 'novo_lead'
      });
    }

    const cidades = Object.values(cidadesMap).sort((a, b) => b.total - a.total);

    return Response.json({
      total: clientes.length,
      semLocalizacao,
      comLocalizacao: clientes.length - semLocalizacao,
      porUF,
      cidades
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});