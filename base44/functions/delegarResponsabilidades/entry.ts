import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { origem_user_id, destinos } = await req.json();

    if (!origem_user_id || !destinos || destinos.length === 0) {
      return Response.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    const delegacoes = [];

    for (const destino of destinos) {
      const delegacao = {
        origem_user_id,
        origem_tipo: 'user',
        status: 'ativa',
        data_inicio: new Date().toISOString()
      };

      if (destino.type === 'user') {
        delegacao.destino_user_id = destino.user_id;
        delegacao.destino_tipo = 'user';
      } else if (destino.type === 'sector') {
        delegacao.destino_sector = destino.sector_name;
        delegacao.destino_tipo = 'sector';
      } else if (destino.type === 'group') {
        delegacao.destino_group_id = destino.thread_id;
        delegacao.destino_tipo = 'group';
      }

      const criada = await base44.asServiceRole.entities.DelegacaoAcesso.create(delegacao);
      delegacoes.push(criada);
    }

    return Response.json({
      success: true,
      delegacoes,
      message: delegacoes.length + ' delegacao(oes) criada(s) com sucesso'
    });

  } catch (error) {
    console.error('[DELEGAR] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});