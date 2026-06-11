import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Atualiza o status de um Orcamento com validação de papel:
// - admin: sempre pode
// - gerente/coordenador/senior (gestão/supervisão): pode mover qualquer orçamento
// - usuário comum: só pode mover os próprios (usuario_id ou vendedor_id)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id, novo_status } = await req.json();
    if (!orcamento_id || !novo_status) {
      return Response.json({ error: 'orcamento_id e novo_status são obrigatórios' }, { status: 400 });
    }

    const STATUS_VALIDOS = ['rascunho', 'aguardando_cotacao', 'cotando', 'aguardando_analise', 'analisando', 'aguardando_liberacao', 'liberado', 'enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'];
    if (!STATUS_VALIDOS.includes(novo_status)) {
      return Response.json({ error: `Status inválido: ${novo_status}` }, { status: 400 });
    }

    const orcamento = await base44.asServiceRole.entities.Orcamento.get(orcamento_id);
    if (!orcamento) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const isGestao = ['gerente', 'coordenador', 'senior'].includes(user.attendant_role);
    const isDono = orcamento.usuario_id === user.id || orcamento.vendedor_id === user.id;

    if (!isAdmin && !isGestao && !isDono) {
      return Response.json({ error: 'Sem permissão para mover este orçamento' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Orcamento.update(orcamento_id, { status: novo_status });

    return Response.json({ success: true, orcamento_id, status: novo_status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});