import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Lembretes periódicos de carteira:
// Varre os clientes de cada vendedor e cria 1 notificação diária por vendedor
// listando os clientes sem contato há mais tempo que o limite.
// Limites: 7 dias para clientes "Em Risco", 14 dias para os demais.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução via automação agendada (sem usuário) ou por admin
    let user = null;
    try { user = await base44.auth.me(); } catch (_e) { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const DIAS_PADRAO = 14;
    const DIAS_RISCO = 7;
    const agora = Date.now();

    const [clientes, usuarios] = await Promise.all([
      svc.entities.Cliente.list('-updated_date', 500),
      svc.entities.User.list()
    ]);

    // Resolve o vendedor responsável: usuario_id direto ou nome (vendedor_responsavel)
    const resolverVendedorId = (cliente) => {
      if (cliente.usuario_id && usuarios.some(u => u.id === cliente.usuario_id)) {
        return cliente.usuario_id;
      }
      if (cliente.vendedor_responsavel) {
        const u = usuarios.find(x => x.full_name === cliente.vendedor_responsavel);
        if (u) return u.id;
      }
      return null;
    };

    const statusIgnorados = ['desqualificado', 'Inativo'];
    const porVendedor = {};

    for (const cliente of clientes || []) {
      if (statusIgnorados.includes(cliente.status)) continue;
      const vendedorId = resolverVendedorId(cliente);
      if (!vendedorId) continue;

      const dataRef = cliente.ultimo_contato || cliente.updated_date;
      if (!dataRef) continue;
      const dias = Math.floor((agora - new Date(dataRef).getTime()) / 86400000);
      const limite = cliente.status === 'Em Risco' ? DIAS_RISCO : DIAS_PADRAO;
      if (dias < limite) continue;

      if (!porVendedor[vendedorId]) porVendedor[vendedorId] = [];
      porVendedor[vendedorId].push({
        cliente_id: cliente.id,
        nome: cliente.razao_social || cliente.nome_fantasia || 'Cliente',
        dias,
        status: cliente.status || ''
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    let notificacoesCriadas = 0;
    const destinatarios = [];

    for (const [vendedorId, lista] of Object.entries(porVendedor)) {
      const agrupamentoKey = `lembrete_contato:${vendedorId}:${hoje}`;

      // Idempotência: não duplica o lembrete do dia
      const existentes = await svc.entities.NotificationEvent.filter(
        { agrupamento_key: agrupamentoKey }, '-created_date', 1
      );
      if (existentes.length > 0) continue;

      lista.sort((a, b) => b.dias - a.dias);
      const top = lista.slice(0, 5)
        .map(c => `• ${c.nome} — ${c.dias} dias sem contato${c.status === 'Em Risco' ? ' ⚠️' : ''}`)
        .join('\n');
      const extras = lista.length > 5 ? `\n... e mais ${lista.length - 5} cliente(s)` : '';

      const vendedor = usuarios.find(u => u.id === vendedorId);

      await svc.entities.NotificationEvent.create({
        tipo: 'lembrete_contato_cliente',
        titulo: `📞 ${lista.length} cliente(s) da sua carteira aguardam contato`,
        mensagem: `${top}${extras}`,
        prioridade: lista.some(c => c.dias >= 30) ? 'alta' : 'normal',
        usuario_id: vendedorId,
        usuario_nome: vendedor?.full_name || '',
        entidade_relacionada: 'Cliente',
        acao_sugerida: { tipo: 'navegar', destino: '/Clientes' },
        origem: 'lembretesCarteiraClientes',
        agrupamento_key: agrupamentoKey,
        metadata: {
          total_clientes: lista.length,
          clientes: lista.slice(0, 10)
        }
      });

      notificacoesCriadas++;
      destinatarios.push(vendedor?.full_name || vendedorId);
    }

    return Response.json({
      success: true,
      clientes_analisados: (clientes || []).length,
      vendedores_com_pendencias: Object.keys(porVendedor).length,
      notificacoes_criadas: notificacoesCriadas,
      destinatarios
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});