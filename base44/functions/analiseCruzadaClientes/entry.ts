import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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

// Normalização de nome de empresa (mesmo método do getFaturamentoPorCliente)
const normNome = (s) => (s || '')
  .toString().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\bS[\/.]?A\b/g, '').replace(/\bLTDA\b/g, '').replace(/\bME\b/g, '').replace(/\bEPP\b/g, '')
  .replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const agora = new Date();

  try {
    // Permite: execução agendada (sem sessão) OU admin manual.
    // Bloqueia: usuário logado não-admin.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
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

    // 2. Buscar NFes emitidas (fonte de verdade: Neural Fin Flow)
    // A entidade Venda local está vazia — as vendas reais são as NFes do Neural Fin.
    const apiKey = Deno.env.get('NEURAL_FIN_API_KEY');
    let notas = [];
    if (apiKey) {
      const urlNF = 'https://app.base44.com/api/apps/69c2ec97bab310deafd37881/entities/NotaFiscal?sort=-data_emissao&limit=1000';
      const respNF = await fetch(urlNF, { headers: { api_key: apiKey, 'Content-Type': 'application/json' } });
      if (respNF.ok) notas = await respNF.json();
      else console.warn('[ANALISE-CRUZADA] ⚠️ Falha ao buscar NFes:', respNF.status);
    }
    const STATUS_NF_INVALIDOS = ['anulada', 'cancelado', 'cancelada'];
    notas = (Array.isArray(notas) ? notas : []).filter(n =>
      !n.is_espelho_ci && !STATUS_NF_INVALIDOS.includes(n.status) && n.cliente
    );
    console.log('[ANALISE-CRUZADA] 🧾 NFes válidas carregadas:', notas.length);

    // Agregar NFes por nome normalizado do cliente
    const nfPorNome = {};
    for (const n of notas) {
      const k = normNome(n.cliente);
      if (!k) continue;
      if (!nfPorNome[k]) nfPorNome[k] = { ultimaEmissao: '', totalFaturado: 0, qtdNotas: 0 };
      const reg = nfPorNome[k];
      reg.totalFaturado += Number(n.valor_total) || 0;
      reg.qtdNotas++;
      if ((n.data_emissao || '') > reg.ultimaEmissao) reg.ultimaEmissao = n.data_emissao;
    }
    const buscarNF = (nome) => {
      const k = normNome(nome);
      if (!k) return null;
      if (nfPorNome[k]) return nfPorNome[k];
      if (k.length >= 6) {
        for (const chave in nfPorNome) {
          if (chave.length >= 6 && (k.includes(chave) || chave.includes(k))) return nfPorNome[chave];
        }
      }
      return null;
    };

    // 2b. Atividade da Central de Comunicação (mensagens ENVIADAS e RECEBIDAS contam como interação)
    const limiteMsg = new Date(agora.getTime() - 120 * 86400000).toISOString();
    const threadsRecentes = await base44.asServiceRole.entities.MessageThread.filter(
      { thread_type: 'contact_external', last_message_at: { $gte: limiteMsg } },
      '-last_message_at',
      1000
    );
    const msgPorContato = {};
    for (const t of threadsRecentes) {
      if (!t.contact_id || !t.last_message_at) continue;
      if (!msgPorContato[t.contact_id] || t.last_message_at > msgPorContato[t.contact_id]) {
        msgPorContato[t.contact_id] = t.last_message_at;
      }
    }


    // 3. Classificar cada contato
    const resultado = { PRETO: [], VERMELHO: [], AMARELO: [], VERDE: [] };
    const atualizacoes = [];

    for (const contato of contatos) {
      // Calcular dias sem venda (última NFe emitida — empresa primeiro, nome como fallback)
      const nfContato = buscarNF(contato.empresa) || buscarNF(contato.nome);
      const ultimaVendaDt = nfContato?.ultimaEmissao ? new Date(nfContato.ultimaEmissao) : null;
      const diasSemVenda = ultimaVendaDt
        ? Math.floor((agora - ultimaVendaDt) / 86400000)
        : 999;

      // Calcular dias sem interação
      const ultimaInteracao = [contato.ultima_interacao, contato.last_attention_given_at, msgPorContato[contato.id]]
        .filter(Boolean).sort().pop(); // a mais recente entre CRM e Central de Comunicação
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

    // 3b. RECONCILIAR entidade Cliente com as NFes (saúde real do CRM)
    // Atualiza status, score, classificação A/B/C e ultimo_contato do Kanban de Clientes.
    const clientesCRM = await base44.asServiceRole.entities.Cliente.list('-updated_date', 1000);
    const updatesCliente = [];
    for (const cli of clientesCRM) {
      const nfInfo = buscarNF(cli.razao_social) || buscarNF(cli.nome_fantasia);
      if (!nfInfo || !nfInfo.ultimaEmissao) continue;

      const diasSemNF = Math.floor((agora - new Date(nfInfo.ultimaEmissao)) / 86400000);
      const novoStatus = diasSemNF <= 90 ? 'Ativo' : diasSemNF <= 365 ? 'Em Risco' : 'Inativo';
      // Score 0-100: recência (60%) + volume (até 40%) + frequência (bônus)
      const recencia = Math.max(0, 100 - Math.floor(diasSemNF / 7) * 5);
      const volume = Math.min(40, Math.floor(nfInfo.totalFaturado / 10000) * 4);
      const score = Math.min(100, Math.round(recencia * 0.6 + volume + Math.min(20, nfInfo.qtdNotas * 2)));
      const classificacao = nfInfo.totalFaturado >= 100000 ? 'A - Alto Potencial'
        : nfInfo.totalFaturado >= 20000 ? 'B - Médio Potencial'
        : 'C - Baixo Potencial';

      const upd = {};
      if (cli.status !== novoStatus) upd.status = novoStatus;
      if (cli.ultimo_contato !== nfInfo.ultimaEmissao) upd.ultimo_contato = nfInfo.ultimaEmissao;
      if (cli.score_qualificacao_lead !== score) {
        upd.score_qualificacao_lead = score;
        upd.data_ultima_qualificacao = agora.toISOString();
      }
      if (cli.classificacao !== classificacao) upd.classificacao = classificacao;
      if (Object.keys(upd).length > 0) updatesCliente.push({ id: cli.id, ...upd });
    }
    for (let i = 0; i < updatesCliente.length; i += 100) {
      await base44.asServiceRole.entities.Cliente.bulkUpdate(updatesCliente.slice(i, i + 100)).catch((e) =>
        console.warn('[ANALISE-CRUZADA] ⚠️ bulkUpdate Cliente:', e.message)
      );
    }
    const clientesReconciliados = updatesCliente.length;
    console.log('[ANALISE-CRUZADA] 🏢 Clientes reconciliados com NFe:', clientesReconciliados);

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
    const isValidUserId = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);
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

      const payloadNotif = {
        setor: 'vendas',
        conteudo: msg,
        vendedor_responsavel_id: isValidUserId(vendedor_id) ? vendedor_id : undefined,
        metadata: { analise_cruzada: true, data_analise: agora.toISOString() }
      };
      // Espaçamento entre notificações para não estourar rate-limit da plataforma
      if (notificacoes > 0) await new Promise(r => setTimeout(r, 4000));
      try {
        await base44.asServiceRole.functions.invoke('nexusNotificar', payloadNotif);
      } catch (e1) {
        // Retry único após pausa (mitiga 403/429 de rate-limit em rajada)
        await new Promise(r => setTimeout(r, 5000));
        await base44.asServiceRole.functions.invoke('nexusNotificar', payloadNotif)
          .catch(e2 => console.warn('[ANALISE-CRUZADA] ⚠️ nexusNotificar (após retry):', e2.message));
      }

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
      nfes_analisadas: notas.length,
      clientes_reconciliados: clientesReconciliados,
      notificacoes_enviadas: notificacoes
    });

  } catch (error) {
    console.error('[ANALISE-CRUZADA] ❌ Erro crítico:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});