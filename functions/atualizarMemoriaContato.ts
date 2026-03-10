// atualizarMemoriaContato — v1.0.0
// Coleta dados reais do banco, calcula padrões e grava/atualiza ContactMemory
// Fire-and-forget: chamado pelo nexusAgentBrain sem bloquear resposta

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { contact_id } = await req.json();

    if (!contact_id) {
      return Response.json({ success: false, error: 'contact_id obrigatório' }, { status: 400 });
    }

    console.log(`[CONTACT-MEMORY] Iniciando para contact_id=${contact_id}`);

    // ── STEP 1: Coletar dados reais em paralelo ──────────────────────────
    // Buscar contato primeiro para pegar cliente_nome (Venda não tem contact_id)
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    const nomeContato = contato?.nome || '';

    const [mensagens, orcamentos, vendas, agentRuns] = await Promise.all([
      base44.asServiceRole.entities.Message.filter(
        { sender_id: contact_id }, '-created_date', 50
      ).catch(() => []),
      base44.asServiceRole.entities.Orcamento.filter(
        { contact_id }, '-created_date', 10
      ).catch(() => []),
      // Venda não tem contact_id — buscar por cliente_nome
      nomeContato
        ? base44.asServiceRole.entities.Venda.filter(
            { cliente_nome: nomeContato }, '-data_venda', 10
          ).catch(() => [])
        : Promise.resolve([]),
      base44.asServiceRole.entities.AgentRun.filter(
        { trigger_event_id: contact_id }, '-created_date', 20
      ).catch(() => [])
    ]);

    // ── STEP 2: Calcular padrões ─────────────────────────────────────────

    // 2a) Horário preferido (moda das horas das mensagens do contato)
    const msgContato = mensagens.filter(m => m.sender_type === 'contact');
    let horarioPreferido = null;
    if (msgContato.length > 0) {
      const contagemHoras = {};
      for (const m of msgContato) {
        const h = new Date(m.created_date || m.sent_at).getHours();
        contagemHoras[h] = (contagemHoras[h] || 0) + 1;
      }
      horarioPreferido = parseInt(
        Object.entries(contagemHoras).sort((a, b) => b[1] - a[1])[0][0]
      );
    }

    // 2b) Ticket médio
    const ticketMedio = vendas.length > 0
      ? vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0) / vendas.length
      : 0;

    // 2c) Frequência de compra (dias)
    let frequencia = null;
    if (vendas.length >= 2) {
      const datas = vendas.map(v => new Date(v.data_venda || v.created_date)).sort((a, b) => a - b);
      const diasTotal = (datas[datas.length - 1] - datas[0]) / (1000 * 60 * 60 * 24);
      frequencia = diasTotal / (vendas.length - 1);
    }

    // 2d) Produto de interesse (moda da categoria dos orçamentos)
    let interessePrincipal = null;
    if (orcamentos.length > 0) {
      const contagem = {};
      for (const o of orcamentos) {
        const cat = o.categoria || (o.produtos?.[0]?.nome) || 'geral';
        contagem[cat] = (contagem[cat] || 0) + 1;
      }
      interessePrincipal = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];
    }

    // 2e) Tempo médio de resposta
    let tempoMedioResposta = null;
    const pares = [];
    for (let i = 0; i < mensagens.length - 1; i++) {
      const atual = mensagens[i];
      const prox = mensagens[i + 1];
      if (atual.sender_type === 'user' && prox.sender_type === 'contact') {
        const diff = (new Date(prox.created_date || prox.sent_at) - new Date(atual.created_date || atual.sent_at)) / 60000;
        if (diff > 0 && diff < 1440) pares.push(diff); // ignorar > 24h
      }
    }
    if (pares.length > 0) {
      tempoMedioResposta = pares.reduce((s, v) => s + v, 0) / pares.length;
    }

    // ── STEP 3: InvokeLLM para resumo ───────────────────────────────────
    const acoesAgent = agentRuns.map(r => r.context_snapshot?.acao || r.playbook_selected || 'desconhecida');
    const promptResumo = `Baseado nesses dados do cliente, escreva um parágrafo de 5 linhas que resume quem é esse cliente, como ele se comporta e o que ele precisa. Seja específico e útil para um vendedor.

Total de mensagens: ${mensagens.length}
Vendas realizadas: ${vendas.length} | Ticket médio: R$${ticketMedio.toFixed(2)}
Orçamentos abertos: ${orcamentos.filter(o => !['fechado', 'rejeitado', 'vencido'].includes(o.status)).length}
Horário preferido: ${horarioPreferido !== null ? horarioPreferido + 'h' : 'não identificado'}
Produto de interesse: ${interessePrincipal || 'não identificado'}
Decisões do agente: ${[...new Set(acoesAgent)].join(', ') || 'nenhuma'}`;

    let resumo = 'Perfil em construção — poucas interações registradas até agora.';
    let objecoes = [];
    let melhorAbordagem = 'Abordar com cordialidade e perguntar sobre necessidades atuais.';

    try {
      const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: promptResumo,
        response_json_schema: {
          type: 'object',
          properties: {
            resumo: { type: 'string' },
            objecoes_comuns: { type: 'array', items: { type: 'string' } },
            melhor_abordagem: { type: 'string' }
          }
        }
      });
      resumo = llmResult.resumo || resumo;
      objecoes = llmResult.objecoes_comuns || [];
      melhorAbordagem = llmResult.melhor_abordagem || melhorAbordagem;
    } catch (e) {
      console.warn(`[CONTACT-MEMORY] LLM falhou, usando defaults: ${e.message}`);
    }

    // ── STEP 4: Upsert na ContactMemory ─────────────────────────────────
    const dados = {
      contact_id,
      preferencias: {
        horario_preferido: horarioPreferido,
        produtos_interesse: interessePrincipal ? [interessePrincipal] : [],
        forma_pagamento: null
      },
      padroes: {
        ticket_medio: ticketMedio,
        frequencia_compra: frequencia,
        tempo_medio_resposta: tempoMedioResposta,
        objecoes_comuns: objecoes
      },
      historico_resumido: resumo,
      melhor_abordagem: melhorAbordagem,
      ultima_atualizacao: new Date().toISOString(),
      total_interacoes: msgContato.length
    };

    const existente = await base44.asServiceRole.entities.ContactMemory.filter(
      { contact_id }, '-created_date', 1
    ).catch(() => []);

    let resultado;
    if (existente.length > 0) {
      resultado = await base44.asServiceRole.entities.ContactMemory.update(existente[0].id, dados);
    } else {
      resultado = await base44.asServiceRole.entities.ContactMemory.create(dados);
    }

    console.log(`[CONTACT-MEMORY] ✅ Atualizado para contact_id=${contact_id} | ${msgContato.length} msgs | ticket R$${ticketMedio.toFixed(0)}`);
    return Response.json({ success: true, dados: resultado });

  } catch (error) {
    console.error(`[CONTACT-MEMORY] Erro: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});