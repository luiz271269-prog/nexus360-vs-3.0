import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Cron job: encerra CallSessions órfãs.
 *
 * Critério:
 *   - status='chamando' com iniciado_em > 5min atrás (chamada nunca foi atendida)
 *   - status='ativa'    com iniciado_em > 2h atrás   (chamada nunca foi encerrada formalmente)
 *
 * Atualiza para status='encerrada' com encerrado_em=now().
 *
 * Roda a cada 15 min via automação scheduled.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Aceita execução por automação (sem auth user) ou admin manual
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const agora = new Date();
    const limiteChamando = new Date(agora.getTime() - 5 * 60 * 1000).toISOString();   // 5 min
    const limiteAtiva    = new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2h

    // Busca sessões 'chamando' antigas
    const chamandoOrfas = await base44.asServiceRole.entities.CallSession.filter(
      { status: 'chamando' },
      '-created_date',
      200
    );
    const chamandoParaEncerrar = chamandoOrfas.filter(s => {
      const inicio = s.iniciado_em || s.created_date;
      return inicio && inicio < limiteChamando;
    });

    // Busca sessões 'ativa' muito antigas
    const ativasOrfas = await base44.asServiceRole.entities.CallSession.filter(
      { status: 'ativa' },
      '-created_date',
      200
    );
    const ativasParaEncerrar = ativasOrfas.filter(s => {
      const inicio = s.iniciado_em || s.created_date;
      return inicio && inicio < limiteAtiva;
    });

    const todasParaEncerrar = [...chamandoParaEncerrar, ...ativasParaEncerrar];

    let encerradas = 0;
    let erros = 0;
    for (const s of todasParaEncerrar) {
      try {
        const inicio = new Date(s.iniciado_em || s.created_date);
        const duracao = Math.floor((agora - inicio) / 1000);
        await base44.asServiceRole.entities.CallSession.update(s.id, {
          status: 'encerrada',
          encerrado_em: agora.toISOString(),
          duracao_segundos: duracao
        });
        encerradas++;
      } catch (err) {
        console.error(`[limparCallSessionsOrfas] Erro ao encerrar ${s.id}:`, err.message);
        erros++;
      }
    }

    console.log(`[limparCallSessionsOrfas] ${encerradas} encerradas, ${erros} erros (chamando=${chamandoParaEncerrar.length}, ativa=${ativasParaEncerrar.length})`);

    return Response.json({
      success: true,
      encerradas,
      erros,
      breakdown: {
        chamando_orfas: chamandoParaEncerrar.length,
        ativa_orfas: ativasParaEncerrar.length
      },
      timestamp: agora.toISOString()
    });
  } catch (error) {
    console.error('[limparCallSessionsOrfas] Erro fatal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});