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

    const { orcamento_id, novo_status, kanban_order } = await req.json();
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
    const updateData = { status: novo_status };
    if (typeof kanban_order === 'number') updateData.kanban_order = kanban_order;
    await base44.asServiceRole.entities.Orcamento.update(orcamento_id, updateData);

    return Response.json({ success: true, orcamento_id, status: novo_status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});