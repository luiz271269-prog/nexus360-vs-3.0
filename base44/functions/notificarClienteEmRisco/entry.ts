import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * notificarClienteEmRisco — disparado por automação de entidade quando um
 * Cliente muda de status para "Em Risco". Cria NotificationEvent para o
 * vendedor responsável (fallback: todos os admins) exibido no Dashboard.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await base44.auth.isAuthenticated())) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const event = payload.event || {};
    let cliente = payload.data;
    if (!cliente || payload.payload_too_large) {
      cliente = await base44.asServiceRole.entities.Cliente.get(event.entity_id);
    }
    if (!cliente) return Response.json({ skipped: 'cliente nao encontrado' });

    // Guard: só notifica quando o status ATUAL é "Em Risco" (e mudou agora)
    const oldStatus = payload.old_data?.status;
    if (cliente.status !== 'Em Risco' || oldStatus === 'Em Risco') {
      return Response.json({ skipped: 'status nao mudou para Em Risco' });
    }

    const nomeCliente = cliente.razao_social || cliente.nome_fantasia || 'Cliente';
    const agrupamentoKey = `cliente_em_risco:${cliente.id}`;

    // Anti-spam: se já existe notificação não lida deste cliente, não duplica
    const existentes = await base44.asServiceRole.entities.NotificationEvent.filter({
      agrupamento_key: agrupamentoKey,
      lida: false
    }, '-created_date', 1);
    if (existentes.length > 0) {
      return Response.json({ skipped: 'notificacao nao lida ja existe', existente_id: existentes[0].id });
    }

    // Destinatários: vendedor responsável; fallback = todos os admins
    const users = await base44.asServiceRole.entities.User.list();
    let destinatarios = [];
    if (cliente.usuario_id) {
      const u = users.find((x) => x.id === cliente.usuario_id);
      if (u) destinatarios.push(u);
    }
    if (destinatarios.length === 0 && cliente.vendedor_responsavel) {
      const u = users.find((x) => x.full_name === cliente.vendedor_responsavel);
      if (u) destinatarios.push(u);
    }
    if (destinatarios.length === 0) {
      destinatarios = users.filter((x) => x.role === 'admin');
    }
    if (destinatarios.length === 0) {
      return Response.json({ skipped: 'nenhum destinatario encontrado' });
    }

    const recorrente = cliente.valor_recorrente_mensal
      ? ` Valor recorrente mensal: R$ ${Number(cliente.valor_recorrente_mensal).toLocaleString('pt-BR')}.`
      : '';

    const notificacoes = destinatarios.map((u) => ({
      tipo: 'cliente_em_risco',
      titulo: `⚠️ Cliente em risco: ${nomeCliente}`,
      mensagem: `O cliente ${nomeCliente} mudou de status${oldStatus ? ` (${oldStatus} → Em Risco)` : ' para Em Risco'}.${recorrente} Entre em contato para antecipar o problema.`,
      prioridade: 'alta',
      usuario_id: u.id,
      usuario_nome: u.full_name || u.email,
      entidade_relacionada: 'Cliente',
      entidade_id: cliente.id,
      acao_sugerida: { tipo: 'navegar', destino: `/Clientes?id=${cliente.id}` },
      agrupamento_key: agrupamentoKey,
      origem: 'notificarClienteEmRisco',
      metadata: {
        status_anterior: oldStatus || null,
        cidade: cliente.cidade || null,
        classificacao: cliente.classificacao || null
      }
    }));

    const criadas = await base44.asServiceRole.entities.NotificationEvent.bulkCreate(notificacoes);
    return Response.json({ success: true, notificacoes_criadas: criadas.length, destinatarios: destinatarios.map((u) => u.full_name || u.email) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});