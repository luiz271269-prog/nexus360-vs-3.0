import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { origem_user_id } = await req.json();

    if (!origem_user_id) {
      return Response.json({ error: 'origem_user_id é obrigatório' }, { status: 400 });
    }

    // Buscar todas as delegações ativas para o usuário de origem
    const delegacoesAtivas = await base44.asServiceRole.entities.DelegacaoAcesso.filter({
      origem_user_id,
      status: 'ativa'
    });

    if (delegacoesAtivas.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhuma delegação ativa encontrada'
      });
    }

    // Revogar todas as delegações ativas
    for (const delegacao of delegacoesAtivas) {
      await base44.asServiceRole.entities.DelegacaoAcesso.update(delegacao.id, {
        status: 'revogada',
        data_revogacao: new Date().toISOString(),
        revogada_por: user.id
      });
    }

    return Response.json({
      success: true,
      revogadas: delegacoesAtivas.length,
      message: `${delegacoesAtivas.length} delegação(ões) revogada(s) com sucesso`
    });

  } catch (error) {
    console.error('[REMOVER_DELEGACAO] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});