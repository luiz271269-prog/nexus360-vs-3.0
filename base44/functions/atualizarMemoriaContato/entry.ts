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

    // 2b) Ticket médio via Orcamento.cliente_id (mais confiável que Venda por nome)
    const ticketMedio = orcamentos.length > 0
      ? orcamentos.filter(o => ['aprovado', 'fechado', 'faturado'].includes(o.status)).reduce((sum, o) => sum + (o.valor_total || 0), 0) / Math.max(orcamentos.length, 1)
      : 0;

    // 2c) Frequência de compra via Orcamento (dias entre orçamentos)
    let frequencia = null;
    if (orcamentos.length >= 2) {
      const datas = orcamentos.map(o => new Date(o.created_date)).sort((a, b) => a - b);
      const diasTotal = (datas[datas.length - 1] - datas[0]) / (1000 * 60 * 60 * 24);
      frequencia = diasTotal / (orcamentos.length - 1);
    }

    // 2d) Produto de interesse — EXTRAIR DO TEXTO DAS MENSAGENS (não só orçamento)
    const padroesProdutos = {};
    for (const m of msgContato) {
      const txt = (m.content || '').toLowerCase();
      // Palavras-chave reais que aparecem em conversas
      const keywords = ['macbook', 'notebook', 'dell', 'lenovo', 'headset', 'fone', 'mouse', 'monitor', 'teclado', 'webcam', 'impressora', 'scanner', 'servidor', 'storage', 'rede', 'switch', 'roteador'];
      for (const kw of keywords) {
        if (txt.includes(kw)) {
          padroesProdutos[kw] = (padroesProdutos[kw] || 0) + 1;
        }
      }
    }
    // Adicionar produtos dos orçamentos também
    for (const o of orcamentos) {
      if (o.produtos && Array.isArray(o.produtos)) {
        for (const p of o.produtos) {
          const nomeLower = (p.nome || '').toLowerCase();
          padroesProdutos[nomeLower] = (padroesProdutos[nomeLower] || 0) + 1;
        }
      }
    }
    const interessePrincipal = Object.keys(padroesProdutos).length > 0
      ? Object.entries(padroesProdutos).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // 2e) Tempo médio de resposta (contact responde após user)
    let tempoMedioResposta = null;
    const pares = [];
    // Iterar de trás pra frente (mensagens em ordem -created_date = recentes primeiro)
    const mensagensOrd = [...mensagens].reverse();
    for (let i = 0; i < mensagensOrd.length - 1; i++) {
      const atual = mensagensOrd[i];
      const prox = mensagensOrd[i + 1];
      if (atual.sender_type === 'contact' && prox.sender_type === 'user') {
        const diff = (new Date(atual.created_date || atual.sent_at) - new Date(prox.created_date || prox.sent_at)) / 60000;
        if (diff > 0 && diff < 1440) pares.push(diff); // ignorar > 24h
      }
    }
    if (pares.length > 0) {
      tempoMedioResposta = pares.reduce((s, v) => s + v, 0) / pares.length;
    }

    // ── STEP 3: Extrair objeções REAIS das mensagens antes de chamar LLM ───
    const objecoes_extraidas = [];
    const padroes_objecoes = {
      'gerente': 'precisa de aprovação do gerente',
      'aprovação': 'precisa de aprovação',
      'orçamento': 'aguardando orçamento completo',
      'concorr': 'está comparando com concorrentes',
      'preço': 'preço é fator bloqueador',
      'frete': 'frete muito caro',
      'timing': 'agora não é o momento',
      'técnica': 'tem dúvidas técnicas',
      'suporte': 'quer garantia de suporte'
    };
    for (const m of msgContato) {
      const txt = (m.content || '').toLowerCase();
      for (const [pattern, objecao] of Object.entries(padroes_objecoes)) {
        if (txt.includes(pattern) && !objecoes_extraidas.includes(objecao)) {
          objecoes_extraidas.push(objecao);
        }
      }
    }

    // ── STEP 3b: InvokeLLM para resumo (agora com dados REAIS) ───
    const acoesAgent = agentRuns.map(r => r.context_snapshot?.acao || r.playbook_selected || 'desconhecida');
    const promptResumo = `Baseado nesses dados REAIS do cliente, escreva um parágrafo de 4 linhas que resume seu perfil, comportamento e próximo passo. Seja conciso e acionável para o vendedor.

    📊 DADOS REAIS:
    • Mensagens: ${msgContato.length} | Orçamentos: ${orcamentos.length} | Ticket médio: R$${ticketMedio.toFixed(2)}
    • Produto de interesse: ${interessePrincipal || 'múltiplos'}
    • Horário preferido: ${horarioPreferido !== null ? horarioPreferido + 'h' : 'não mapeado'}
    • Tempo médio resposta: ${tempoMedioResposta ? Math.round(tempoMedioResposta) + ' min' : 'variável'}
    • Objeções detectadas: ${objecoes_extraidas.length > 0 ? objecoes_extraidas.join(', ') : 'nenhuma registrada'}`;

    let resumo = 'Perfil em construção — poucas interações registradas até agora.';
    let objecoes = objecoes_extraidas;
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