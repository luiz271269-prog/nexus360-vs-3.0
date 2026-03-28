import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// ANÁLISE CRUZADA DE CLIENTES v1.0
// ============================================================================
// Cruza dados de Vendas x CRM (Contact/Cliente) para identificar:
//   - Clientes ⚫ (sem compra + sem interação há >90d)
//   - Clientes 🔴 (sem compra há >60d mas com interação recente)
//   - Clientes 🟡 (comprando mas score baixo / sem follow-up)
//   - Clientes 🟢 (ativos, score alto, engajados)
// Envia resumo via nexusNotificar para setor + DM ao vendedor responsável
// ============================================================================

const CLASSIFICACOES = {
  PRETO:    { emoji: '⚫', label: 'Inativo crítico',    cor: 'preto'    },
  VERMELHO: { emoji: '🔴', label: 'Em risco de churn',  cor: 'vermelho' },
  AMARELO:  { emoji: '🟡', label: 'Atenção necessária', cor: 'amarelo'  },
  VERDE:    { emoji: '🟢', label: 'Cliente saudável',   cor: 'verde'    }
};

function classificar(contato, ultimaVenda, diasSemVenda, diasSemInteracao) {
  if (diasSemVenda > 90 && diasSemInteracao > 90) return 'PRETO';
  if (diasSemVenda > 60 && diasSemInteracao > 30) return 'VERMELHO';
  if (diasSemVenda > 30 || (contato.cliente_score || 0) < 30) return 'AMARELO';
  return 'VERDE';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[ANALISE-CRUZADA] 🔍 Iniciando análise cruzada de clientes...');

    // 1. Buscar todos os contatos do tipo cliente/lead ativos
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { tipo_contato: { $in: ['cliente', 'lead'] }, bloqueado: false },
      '-ultima_interacao',
      500
    );

    if (contatos.length === 0) {
      return Response.json({ success: true, analisados: 0, message: 'Nenhum contato para analisar' });
    }

    // 2. Buscar vendas dos últimos 180 dias
    const limite180d = new Date(agora.getTime() - 180 * 86400000).toISOString().split('T')[0];
    const vendasRecentes = await base44.asServiceRole.entities.Venda.filter(
      { data_venda: { $gte: limite180d } },
      '-data_venda',
      2000
    );

    // Indexar vendas por nome do cliente para lookup rápido
    const vendasPorCliente = {};
    for (const v of vendasRecentes) {
      const key = (v.cliente_nome || '').toLowerCase().trim();
      if (!vendasPorCliente[key]) vendasPorCliente[key] = [];
      vendasPorCliente[key].push(v);
    }

    // 3. Classificar cada contato
    const resultado = { PRETO: [], VERMELHO: [], AMARELO: [], VERDE: [] };
    const atualizacoes = [];

    for (const contato of contatos) {
      const keyNome = (contato.nome || '').toLowerCase().trim();
      const vendasContato = vendasPorCliente[keyNome] || [];

      // Calcular dias sem venda
      const ultimaVendaDt = vendasContato.length > 0
        ? new Date(vendasContato[0].data_venda)
        : null;
      const diasSemVenda = ultimaVendaDt
        ? Math.floor((agora - ultimaVendaDt) / 86400000)
        : 999;

      // Calcular dias sem interação
      const ultimaInteracao = contato.ultima_interacao || contato.last_attention_given_at;
      const diasSemInteracao = ultimaInteracao
        ? Math.floor((agora - new Date(ultimaInteracao)) / 86400000)
        : 999;

      const classe = classificar(contato, ultimaVendaDt, diasSemVenda, diasSemInteracao);
      resultado[classe].push({
        id: contato.id,
        nome: contato.nome,
        empresa: contato.empresa,
        vendedor: contato.vendedor_responsavel,
        vendedor_id: contato.atendente_fidelizado_vendas,
        dias_sem_venda: diasSemVenda,
        dias_sem_interacao: diasSemInteracao,
        score: contato.cliente_score || 0,
        ultima_venda: ultimaVendaDt?.toISOString().split('T')[0] || null
      });

      // Atualizar segmento no contato (batch)
      const novoSegmento = {
        PRETO: 'cliente_inativo',
        VERMELHO: 'risco_churn',
        AMARELO: 'lead_morno',
        VERDE: 'cliente_ativo'
      }[classe];

      if (contato.segmento_atual !== novoSegmento) {
        atualizacoes.push(
          base44.asServiceRole.entities.Contact.update(contato.id, {
            segmento_atual: novoSegmento,
            ultima_analise_comportamento: agora.toISOString()
          }).catch(() => {})
        );
      }
    }

    // Executar atualizações em paralelo (até 20 simultâneas)
    for (let i = 0; i < atualizacoes.length; i += 20) {
      await Promise.all(atualizacoes.slice(i, i + 20));
    }

    // 4. Montar resumo por setor/vendedor e notificar via nexusNotificar
    // Agrupar críticos (PRETO + VERMELHO) por vendedor
    const criticos = [...resultado.PRETO, ...resultado.VERMELHO];
    const porVendedor = {};
    for (const c of criticos) {
      const key = c.vendedor || 'sem_vendedor';
      if (!porVendedor[key]) porVendedor[key] = { vendedor_id: c.vendedor_id, itens: [] };
      porVendedor[key].itens.push(c);
    }

    let notificacoes = 0;
    for (const [vendedor, dados] of Object.entries(porVendedor)) {
      if (vendedor === 'sem_vendedor') continue;
      const { itens, vendedor_id } = dados;

      const linhas = itens.slice(0, 10).map(c => {
        const cl = CLASSIFICACOES[resultado.PRETO.includes(c) ? 'PRETO' : 'VERMELHO'];
        return `${cl.emoji} *${c.nome}*${c.empresa ? ` (${c.empresa})` : ''} — ${c.dias_sem_venda}d sem venda`;
      });

      const msg =
        `📊 *Análise Cruzada de Clientes — ${vendedor}*\n\n` +
        `⚫ Inativos críticos: *${resultado.PRETO.filter(c => c.vendedor === vendedor).length}*\n` +
        `🔴 Risco de churn: *${resultado.VERMELHO.filter(c => c.vendedor === vendedor).length}*\n\n` +
        `*Top clientes que precisam de ação:*\n${linhas.join('\n')}` +
        (itens.length > 10 ? `\n_...e mais ${itens.length - 10} contatos_` : '');

      await base44.asServiceRole.functions.invoke('nexusNotificar', {
        setor: 'vendas',
        conteudo: msg,
        vendedor_responsavel_id: vendedor_id || undefined,
        metadata: { analise_cruzada: true, data_analise: agora.toISOString() }
      }).catch(e => console.warn('[ANALISE-CRUZADA] ⚠️ nexusNotificar:', e.message));

      notificacoes++;
    }

    // 5. Notificação geral para admin (resumo total)
    const msgAdmin =
      `📊 *Análise Cruzada Concluída*\n\n` +
      `Total analisados: *${contatos.length}*\n` +
      `⚫ Inativos críticos: *${resultado.PRETO.length}*\n` +
      `🔴 Risco de churn: *${resultado.VERMELHO.length}*\n` +
      `🟡 Atenção necessária: *${resultado.AMARELO.length}*\n` +
      `🟢 Saudáveis: *${resultado.VERDE.length}*\n\n` +
      `_${notificacoes} vendedores notificados_`;

    await base44.asServiceRole.functions.invoke('nexusNotificar', {
      setor: 'geral',
      conteudo: msgAdmin,
      metadata: { analise_cruzada_resumo: true }
    }).catch(() => {});

    console.log('[ANALISE-CRUZADA] ✅ Concluído:', {
      total: contatos.length,
      preto: resultado.PRETO.length,
      vermelho: resultado.VERMELHO.length,
      amarelo: resultado.AMARELO.length,
      verde: resultado.VERDE.length
    });

    return Response.json({
      success: true,
      timestamp: agora.toISOString(),
      analisados: contatos.length,
      classificacao: {
        preto: resultado.PRETO.length,
        vermelho: resultado.VERMELHO.length,
        amarelo: resultado.AMARELO.length,
        verde: resultado.VERDE.length
      },
      notificacoes_enviadas: notificacoes
    });

  } catch (error) {
    console.error('[ANALISE-CRUZADA] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});