import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Atualiza o status de um Orcamento. Qualquer usuário autenticado
// com acesso ao Kanban pode mover cards (sem restrição por dono/papel).
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

    // Sem restrição adicional: quem tem acesso ao Kanban pode mover qualquer card
    await base44.asServiceRole.entities.Orcamento.update(orcamento_id, { status: novo_status });

    return Response.json({ success: true, orcamento_id, status: novo_status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});