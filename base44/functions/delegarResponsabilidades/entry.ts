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

    const resultados = [];

    for (const destino of destinos) {
      if (destino.type !== 'user' || !destino.user_id) {
        resultados.push({ skipped: true, motivo: 'Apenas transferencia user para user suportada' });
        continue;
      }

      const destinoUserId = destino.user_id;

      // 1. Criar registro de delegacao
      const delegacao = {
        origem_user_id,
        origem_tipo: 'user',
        destino_user_id: destinoUserId,
        destino_tipo: 'user',
        status: 'ativa',
        data_inicio: new Date().toISOString()
      };
      const criada = await base44.asServiceRole.entities.DelegacaoAcesso.create(delegacao);

      // 2. Buscar TODAS as threads abertas atribuidas ao usuario origem e reatribuir ao destino
      let threadsTransferidas = 0;

      while (true) {
        const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { assigned_user_id: origem_user_id, status: 'aberta' },
          '-updated_date',
          100
        );

        if (!threads || threads.length === 0) break;

        for (const thread of threads) {
          // Preservar origem no historico e shared_with_users para que ela ainda enxergue
          const atendentesHistorico = Array.from(new Set([
            ...(thread.atendentes_historico || []),
            origem_user_id
          ]));
          const sharedWithUsers = Array.from(new Set([
            ...(thread.shared_with_users || []),
            origem_user_id
          ]));

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            assigned_user_id: destinoUserId,
            atendentes_historico: atendentesHistorico,
            shared_with_users: sharedWithUsers
          });

          threadsTransferidas++;
        }

        // Se recebeu menos que 100, terminou
        if (threads.length < 100) break;

        // Delay para nao gerar 429
        await new Promise(r => setTimeout(r, 300));
      }

      console.log('[DELEGAR] Threads transferidas: ' + threadsTransferidas + ' de ' + origem_user_id + ' para ' + destinoUserId);

      resultados.push({
        delegacao: criada,
        threadsTransferidas,
        destino_user_id: destinoUserId
      });
    }

    const totalTransferidas = resultados.reduce((s, r) => s + (r.threadsTransferidas || 0), 0);

    return Response.json({
      success: true,
      resultados,
      message: 'Transferencia concluida: ' + totalTransferidas + ' threads atribuidas ao novo responsavel'
    });

  } catch (error) {
    console.error('[DELEGAR] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});