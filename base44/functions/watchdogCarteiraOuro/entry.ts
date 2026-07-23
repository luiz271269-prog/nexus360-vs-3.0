import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.40';

// ============================================================================
// WATCHDOG CARTEIRA OURO v1.0 — SLA de contato por tier de recorrência
// ============================================================================
// SLA por etiqueta persistida (classificarRecorrenciaClientes):
//   ouro  > 10 dias sem contato REAL → severidade critical
//   prata > 14 dias                  → severidade high
//   risco > 21 dias                  → severidade medium
//
// "Último contato REAL" = max(cliente.ultimo_contato,
//   thread.last_human_message_at, thread.last_inbound_at)
// Fallback: recorrencia_ultima_compra. NUNCA usa updated_date (causa-raiz
// da avaliação errada no motor legado).
//
// Saídas:
//   1. WorkQueueItem (tipo follow_up) idempotente por contato — tarefa persistente
//   2. NotificationEvent diário por vendedor (prioridade alta/crítica)
// ============================================================================

const SLA_DIAS = { ouro: 10, prata: 14, risco: 21 };
const SEVERIDADE = { ouro: 'critical', prata: 'high', risco: 'medium' };

Deno.serve(async (req) => {
  const tsInicio = Date.now();
  try {
    let base44;
    if (req.headers && req.headers.get('authorization')) {
      base44 = createClientFromRequest(req);
      const user = await base44.auth.me().catch(() => null);
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Apenas administradores' }, { status: 403 });
      }
    } else {
      // Contexto agendado (workflow)
      base44 = createClient();
    }

    const svc = base44.asServiceRole;
    const agora = Date.now();
    const hoje = new Date().toISOString().slice(0, 10);

    // ── 1) Carregar dados-base em paralelo ─────────────────────────────────
    const [clientes, usuarios, contatosVinculados, threads] = await Promise.all([
      svc.entities.Cliente.filter({ etiqueta_recorrencia: { $in: ['ouro', 'prata', 'risco'] } }, '-updated_date', 1000),
      svc.entities.User.list(),
      svc.entities.Contact.filter({ cliente_id: { $ne: null } }, '-updated_date', 1000),
      svc.entities.MessageThread.filter({ thread_type: 'contact_external' }, '-last_message_at', 1000)
    ]);

    // Índice cliente_id → contatos
    const contatosPorCliente = {};
    for (const ct of contatosVinculados) {
      if (!ct.cliente_id) continue;
      if (!contatosPorCliente[ct.cliente_id]) contatosPorCliente[ct.cliente_id] = [];
      contatosPorCliente[ct.cliente_id].push(ct);
    }

    // Índice contact_id → timestamps de contato real (threads)
    const contatoRealPorContact = {};
    for (const th of threads) {
      if (!th.contact_id) continue;
      const candidatos = [th.last_human_message_at, th.last_inbound_at].filter(Boolean);
      for (const c of candidatos) {
        const t = new Date(c).getTime();
        if (!contatoRealPorContact[th.contact_id] || t > contatoRealPorContact[th.contact_id]) {
          contatoRealPorContact[th.contact_id] = t;
        }
      }
    }

    const resolverVendedorId = (cliente) => {
      if (cliente.usuario_id && usuarios.some(u => u.id === cliente.usuario_id)) return cliente.usuario_id;
      if (cliente.vendedor_responsavel) {
        const u = usuarios.find(x => x.full_name === cliente.vendedor_responsavel);
        if (u) return u.id;
      }
      return null;
    };

    // ── 2) Avaliar SLA por cliente ─────────────────────────────────────────
    const statusIgnorados = ['desqualificado', 'Inativo'];
    const violacoes = [];

    for (const cliente of clientes) {
      if (statusIgnorados.includes(cliente.status)) continue;
      const etiqueta = cliente.etiqueta_recorrencia;
      const slaDias = SLA_DIAS[etiqueta];
      if (!slaDias) continue;

      const contatos = contatosPorCliente[cliente.id] || [];

      // Último contato REAL: cliente.ultimo_contato + threads dos contatos vinculados
      const timestamps = [];
      if (cliente.ultimo_contato) timestamps.push(new Date(cliente.ultimo_contato).getTime());
      for (const ct of contatos) {
        if (contatoRealPorContact[ct.id]) timestamps.push(contatoRealPorContact[ct.id]);
      }
      // Fallback de negócio: data da última compra (nunca updated_date)
      if (timestamps.length === 0 && cliente.recorrencia_ultima_compra) {
        timestamps.push(new Date(cliente.recorrencia_ultima_compra).getTime());
      }
      if (timestamps.length === 0) continue;

      const ultimoContatoReal = Math.max(...timestamps);
      const dias = Math.floor((agora - ultimoContatoReal) / 86400000);
      if (dias < slaDias) continue;

      // Elevação por etiquetas do contato (VIP / classe A)
      let severity = SEVERIDADE[etiqueta];
      const temVip = contatos.some(ct => ct.is_vip || ct.classe_abc === 'A');
      if (temVip && severity === 'high') severity = 'critical';
      if (temVip && severity === 'medium') severity = 'high';

      violacoes.push({
        cliente,
        contato: contatos[0] || null,
        etiqueta,
        dias,
        slaDias,
        severity,
        vendedorId: resolverVendedorId(cliente)
      });
    }

    // ── 3) WorkQueueItem idempotente (só para clientes com Contact) ────────
    let tarefasCriadas = 0;
    for (const v of violacoes) {
      if (!v.contato) continue;
      const existentes = await svc.entities.WorkQueueItem.filter({
        contact_id: v.contato.id,
        tipo: 'follow_up',
        status: { $in: ['open', 'in_progress'] }
      }, '-created_date', 1).catch(() => []);
      if (existentes.length > 0) continue;

      await svc.entities.WorkQueueItem.create({
        contact_id: v.contato.id,
        tipo: 'follow_up',
        reason: v.dias >= 14 ? 'idle_14d' : 'idle_7d',
        severity: v.severity,
        owner_user_id: v.vendedorId || undefined,
        status: 'open',
        notes: `SLA ${v.etiqueta.toUpperCase()} violado: ${v.dias} dias sem contato (limite ${v.slaDias})`,
        payload: {
          origem: 'watchdogCarteiraOuro',
          cliente_id: v.cliente.id,
          cliente_nome: v.cliente.razao_social || v.cliente.nome_fantasia,
          etiqueta_recorrencia: v.etiqueta,
          dias_sem_contato: v.dias,
          sla_dias: v.slaDias
        }
      }).catch(e => console.warn(`[CARTEIRA-OURO] WorkQueueItem falhou (${v.cliente.id}): ${e.message}`));
      tarefasCriadas++;
    }

    // ── 4) NotificationEvent diário por vendedor ───────────────────────────
    const porVendedor = {};
    for (const v of violacoes) {
      if (!v.vendedorId) continue;
      if (!porVendedor[v.vendedorId]) porVendedor[v.vendedorId] = [];
      porVendedor[v.vendedorId].push(v);
    }

    let notificacoesCriadas = 0;
    for (const [vendedorId, lista] of Object.entries(porVendedor)) {
      const agrupamentoKey = `sla_carteira:${vendedorId}:${hoje}`;
      const existentes = await svc.entities.NotificationEvent.filter(
        { agrupamento_key: agrupamentoKey }, '-created_date', 1
      ).catch(() => []);
      if (existentes.length > 0) continue;

      const emoji = { ouro: '🥇', prata: '🥈', risco: '⚠️' };
      lista.sort((a, b) => {
        const ordem = { ouro: 0, prata: 1, risco: 2 };
        return ordem[a.etiqueta] - ordem[b.etiqueta] || b.dias - a.dias;
      });
      const linhas = lista.slice(0, 6)
        .map(v => `${emoji[v.etiqueta]} ${v.cliente.razao_social || v.cliente.nome_fantasia} — ${v.dias} dias (SLA ${v.slaDias}d)`)
        .join('\n');
      const extras = lista.length > 6 ? `\n... e mais ${lista.length - 6} cliente(s)` : '';
      const temOuro = lista.some(v => v.etiqueta === 'ouro');
      const vendedor = usuarios.find(u => u.id === vendedorId);

      await svc.entities.NotificationEvent.create({
        tipo: 'cliente_em_risco',
        titulo: temOuro
          ? `🥇 SLA violado: cliente(s) OURO aguardando contato!`
          : `📞 ${lista.length} cliente(s) recorrentes fora do SLA de contato`,
        mensagem: `${linhas}${extras}`,
        prioridade: temOuro ? 'critica' : 'alta',
        usuario_id: vendedorId,
        usuario_nome: vendedor?.full_name || '',
        entidade_relacionada: 'Cliente',
        acao_sugerida: { tipo: 'navegar', destino: '/LeadsQualificados' },
        origem: 'watchdogCarteiraOuro',
        agrupamento_key: agrupamentoKey,
        metadata: {
          total: lista.length,
          clientes: lista.slice(0, 10).map(v => ({
            cliente_id: v.cliente.id,
            nome: v.cliente.razao_social || v.cliente.nome_fantasia,
            etiqueta: v.etiqueta,
            dias: v.dias,
            sla: v.slaDias
          }))
        }
      }).catch(e => console.warn(`[CARTEIRA-OURO] Notificação falhou (${vendedorId}): ${e.message}`));
      notificacoesCriadas++;
    }

    const resumo = {
      success: true,
      clientes_avaliados: clientes.length,
      violacoes_sla: violacoes.length,
      por_etiqueta: violacoes.reduce((acc, v) => { acc[v.etiqueta] = (acc[v.etiqueta] || 0) + 1; return acc; }, {}),
      tarefas_criadas: tarefasCriadas,
      notificacoes_criadas: notificacoesCriadas,
      duration_ms: Date.now() - tsInicio
    };
    console.log('[CARTEIRA-OURO] ✅', JSON.stringify(resumo));
    return Response.json(resumo);
  } catch (error) {
    console.error('[CARTEIRA-OURO] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});