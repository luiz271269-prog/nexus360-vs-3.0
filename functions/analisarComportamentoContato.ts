import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ==========================================
// ANÁLISE DE COMPORTAMENTO DE CONTATO
// ==========================================
// Analisa mensagens, sentimento, padrões e segmenta automaticamente

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
    }

    const { 
      contact_id, 
      periodo_dias = 30, 
      mode = 'period',
      visible_thread_ids = [],
      active_thread_id = null
    } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400, headers: corsHeaders });
    }

    // 📊 BUSCAR DADOS DO CONTATO
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contato) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404, headers: corsHeaders });
    }

    // 📊 BUSCAR THREADS DO CONTATO
    const threadsAll = await base44.asServiceRole.entities.MessageThread.filter({ contact_id });
    
    if (threadsAll.length === 0) {
      return Response.json({ 
        error: 'Nenhuma conversa encontrada para este contato',
        info: 'O contato precisa ter pelo menos uma conversa para análise'
      }, { status: 400, headers: corsHeaders });
    }

    // 📊 APLICAR ESCOPO (bubble ou period)
    let threadsScope = threadsAll;
    
    if (mode === 'bubble') {
      if (!visible_thread_ids || visible_thread_ids.length === 0) {
        return Response.json({ 
          error: 'Modo "bubble" requer visible_thread_ids' 
        }, { status: 400, headers: corsHeaders });
      }
      const bubbleSet = new Set([...visible_thread_ids, active_thread_id].filter(Boolean));
      threadsScope = threadsAll.filter(t => bubbleSet.has(t.id));
    }

    const threadIds = threadsScope.map(t => t.id);
    const limitedByVisibility = threadsScope.length < threadsAll.length;

    // 📊 CALCULAR PERÍODO
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);
    const dataFim = new Date();

    // 📊 BUSCAR MENSAGENS CORRETAS: Filtrar no banco por thread_id + período
    const mensagens = await base44.asServiceRole.entities.Message.filter({
      thread_id: { $in: threadIds },
      created_date: { $gte: dataInicio.toISOString() }
    }, 'created_date', 1500); // ASC para métricas cronológicas

    if (mensagens.length === 0) {
      return Response.json({
        error: 'Nenhuma mensagem encontrada no período analisado',
        info: `Período: últimos ${periodo_dias} dias. Tente aumentar o período.`
      }, { status: 400, headers: corsHeaders });
    }

    console.log(`📊 Análise [${mode}]: ${mensagens.length} mensagens de ${threadsScope.length}/${threadsAll.length} thread(s) nos últimos ${periodo_dias} dias`);

    // ==========================================
    // HELPER: Limpar assinaturas
    // ==========================================
    const cleanText = (text) => {
      if (!text) return '';
      return text.replace(/~\s*[\wÁ-úçÇ ]+\s*\([^)]*\)\s*$/gm, '').trim();
    };

    // ==========================================
    // 1. NORMALIZAÇÃO + MÉTRICAS DETERMINÍSTICAS
    // ==========================================
    const inbound = mensagens.filter(m => m.sender_type === 'contact');
    const outbound = mensagens.filter(m => m.sender_type === 'user');

    // 1.1 Tempo médio de resposta (EMPRESA responde ao cliente)
    let tempoRespostaEmpresa = 0;
    let countRespostaEmpresa = 0;
    
    for (let i = 1; i < mensagens.length; i++) {
      if (mensagens[i].sender_type === 'user' && mensagens[i-1].sender_type === 'contact') {
        const diff = new Date(mensagens[i].created_date) - new Date(mensagens[i-1].created_date);
        tempoRespostaEmpresa += diff;
        countRespostaEmpresa++;
      }
    }
    
    const avgReplyCompany = countRespostaEmpresa > 0 
      ? Math.round(tempoRespostaEmpresa / countRespostaEmpresa / (1000 * 60))
      : null;

    // 1.2 Tempo médio de resposta (CLIENTE responde à empresa)
    let tempoRespostaCliente = 0;
    let countRespostaCliente = 0;
    
    for (let i = 1; i < mensagens.length; i++) {
      if (mensagens[i].sender_type === 'contact' && mensagens[i-1].sender_type === 'user') {
        const diff = new Date(mensagens[i].created_date) - new Date(mensagens[i-1].created_date);
        tempoRespostaCliente += diff;
        countRespostaCliente++;
      }
    }
    
    const avgReplyClient = countRespostaCliente > 0
      ? Math.round(tempoRespostaCliente / countRespostaCliente / (1000 * 60))
      : null;

    // 1.3 Follow-ups consecutivos (CRÍTICO: maior streak outbound sem inbound)
    let maxFollowUpStreak = 0;
    let currentStreak = 0;
    
    for (const msg of mensagens) {
      if (msg.sender_type === 'user') {
        currentStreak++;
        maxFollowUpStreak = Math.max(maxFollowUpStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // 1.4 Dias desde última mensagem do cliente
    const lastInbound = inbound.length > 0 ? inbound[inbound.length - 1] : null;
    const daysSinceLastInbound = lastInbound 
      ? Math.floor((Date.now() - new Date(lastInbound.created_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 1.5 Frases de corte (risco relacional)
    const frasesCorte = ['inviável', 'muito pouco', 'obrigada então', 'não cabe', 'não consigo'];
    const cortesDetectados = [];
    
    for (const msg of inbound) {
      const texto = cleanText(msg.content || '').toLowerCase();
      for (const frase of frasesCorte) {
        if (texto.includes(frase)) {
          cortesDetectados.push(`Cliente disse: "${frase}"`);
          break;
        }
      }
    }

    const metricas = {
      total_mensagens: mensagens.length,
      mensagens_inbound: inbound.length,
      mensagens_outbound: outbound.length,
      frequencia_media_dias: parseFloat((periodo_dias / Math.max(1, inbound.length)).toFixed(2)),
      avg_reply_minutes_company: avgReplyCompany,
      avg_reply_minutes_client: avgReplyClient,
      unanswered_followups: maxFollowUpStreak,
      days_since_last_inbound: daysSinceLastInbound,
      taxa_resposta: outbound.length > 0 ? parseFloat(((inbound.length / outbound.length) * 100).toFixed(1)) : 0,
      tempo_medio_resposta_minutos: avgReplyCompany || 0
    };

    // ==========================================
    // 2. ANÁLISE MULTIMODAL AVANÇADA COM IA
    // ==========================================
    const textosMensagens = inbound
      .filter(m => m.content && m.content.length > 5)
      .slice(-30)
      .map(m => cleanText(m.content))
      .join('\n');

    // 🖼️ Buscar mensagens com mídia (imagens) para análise visual
    const mensagensComImagem = inbound
      .filter(m => m.media_type === 'image' && m.media_url)
      .slice(-5);

    let analiseSentimento = {
      sentimento_predominante: 'neutro',
      score_sentimento: 50,
      evolucao_sentimento: 'estavel',
      razoes: []
    };

    let palavrasChave = [];
    let intencoesDetectadas = [];
    let padroesBehaviorais = [];
    let insightsVisuais = [];

    if (textosMensagens.length > 20) {
      try {
        // 🚀 ANÁLISE ÚNICA CONSOLIDADA - Reduz chamadas de IA e melhora contexto
        const promptConsolidado = `Você é um analista de comportamento de clientes B2B. Analise profundamente o histórico abaixo:

📱 HISTÓRICO DE MENSAGENS (últimos ${periodo_dias} dias):
${textosMensagens}

📊 DADOS DO CONTATO:
- Empresa: ${contato.empresa || 'N/A'}
- Cargo: ${contato.cargo || 'N/A'}
- Ramo: ${contato.ramo_atividade || 'N/A'}
- Tipo: ${contato.tipo_contato || 'novo'}

📈 MÉTRICAS:
- Total mensagens: ${metricas.total_mensagens}
- Taxa resposta: ${metricas.taxa_resposta}%
- Tempo médio resposta: ${Math.round(metricas.tempo_medio_resposta_minutos)}min

Forneça uma análise estruturada e ACIONÁVEL para vendas B2B.`;

        const analiseCompleta = await base44.integrations.Core.InvokeLLM({
          prompt: promptConsolidado,
          response_json_schema: {
            type: "object",
            properties: {
              sentimento: {
                type: "object",
                properties: {
                  predominante: { type: "string", enum: ["muito_positivo", "positivo", "neutro", "negativo", "muito_negativo"] },
                  score: { type: "number", minimum: 0, maximum: 100 },
                  evolucao: { type: "string", enum: ["melhorando", "estavel", "piorando"] },
                  razoes: { type: "array", items: { type: "string" } }
                }
              },
              palavras_chave: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    palavra: { type: "string" },
                    frequencia: { type: "number" },
                    categoria: { type: "string", enum: ["produto", "problema", "duvida", "elogio", "reclamacao", "preco", "prazo", "tecnico", "documento", "pagamento", "urgencia"] },
                    relevancia_comercial: { type: "number", minimum: 0, maximum: 10 }
                  }
                }
              },
              topics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    weight: { type: "number", minimum: 0, maximum: 1 }
                  }
                }
              },
              intencoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    intencao: { type: "string" },
                    confianca: { type: "number", minimum: 0, maximum: 100 },
                    evidencias: { type: "array", items: { type: "string" } }
                  }
                }
              },
              objecoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    category: { type: "string" },
                    severity: { type: "string", enum: ["baixa", "media", "alta"] },
                    unlock_hint: { type: "string" },
                    contexto: { type: "string" }
                  }
                }
              },
              padroes_comportamentais: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    padrao: { type: "string" },
                    descricao: { type: "string" },
                    impacto: { type: "string", enum: ["positivo", "neutro", "negativo"] },
                    frequencia: { type: "string", enum: ["rara", "ocasional", "frequente", "cronica"] }
                  }
                }
              },
              fricoes_comerciais: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    friccao: { type: "string" },
                    severidade: { type: "string", enum: ["baixa", "media", "alta"] },
                    origem: { type: "string" },
                    impacto_fechamento: { type: "string" }
                  }
                }
              },
              estranagias_desbloqueio: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    objeção: { type: "string" },
                    estrategia: { type: "string" },
                    mensagem_proposta: { type: "string" }
                  }
                }
              },
              perfil_cliente: {
                type: "string",
                enum: ["analitico", "pragmatico", "relacional", "inovador"]
              },
              nivel_maturidade_compra: {
                type: "string",
                enum: ["consciencia", "consideracao", "decisao", "negociacao", "pronto_comprar", "pos_venda"]
              },
              oportunidades_upsell: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        analiseSentimento = {
          sentimento_predominante: analiseCompleta.sentimento?.predominante || 'neutro',
          score_sentimento: analiseCompleta.sentimento?.score || 50,
          evolucao_sentimento: analiseCompleta.sentimento?.evolucao || 'estavel',
          razoes: analiseCompleta.sentimento?.razoes || []
        };

        palavrasChave = (analiseCompleta.palavras_chave || [])
          .sort((a, b) => (b.relevancia_comercial || 0) - (a.relevancia_comercial || 0))
          .slice(0, 10);

        const topics = (analiseCompleta.topics || []).slice(0, 5);
        const objections = (analiseCompleta.objecoes || []).slice(0, 3);

        intencoesDetectadas = (analiseCompleta.intencoes || []).map(i => ({
          intencao: i.intencao,
          confianca: i.confianca,
          evidencias: i.evidencias || [],
          primeira_deteccao: new Date().toISOString()
        }));

        padroesBehaviorais = analiseCompleta.padroes_comportamentais || [];

      } catch (error) {
        console.error('❌ Erro na análise consolidada:', error);
      }
    }

    // 🖼️ ANÁLISE VISUAL DE IMAGENS (se houver)
    if (mensagensComImagem.length > 0) {
      try {
        const imageUrls = mensagensComImagem
          .map(m => m.media_url)
          .filter(Boolean)
          .slice(0, 3); // Máximo 3 imagens para não ultrapassar limites

        if (imageUrls.length > 0) {
          const analiseVisual = await base44.integrations.Core.InvokeLLM({
            prompt: `Analise estas imagens enviadas pelo cliente e identifique:
1. Produtos/serviços de interesse
2. Problemas técnicos ou necessidades
3. Contexto do negócio (ambiente, equipamentos)
4. Urgência visual (danos, defeitos, etc)

Forneça insights comerciais acionáveis.`,
            file_urls: imageUrls,
            response_json_schema: {
              type: "object",
              properties: {
                produtos_identificados: { type: "array", items: { type: "string" } },
                problemas_detectados: { type: "array", items: { type: "string" } },
                contexto_negocio: { type: "string" },
                nivel_urgencia: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                insights_comerciais: { type: "array", items: { type: "string" } }
              }
            }
          });

          insightsVisuais = analiseVisual.insights_comerciais || [];
          
          // Aplicar tag se urgência crítica detectada em imagens
          if (analiseVisual.nivel_urgencia === 'critica' || analiseVisual.nivel_urgencia === 'alta') {
            const urgenciaTag = await base44.asServiceRole.entities.Tag.list('-created_date', 1, { nome: 'urgencia_visual_detectada' });
            if (urgenciaTag.length === 0) {
              await base44.asServiceRole.entities.Tag.create({
                nome: 'urgencia_visual_detectada',
                categoria: 'visual',
                cor: '#ef4444'
              });
            }
          }

          console.log(`📸 Análise visual concluída: ${imageUrls.length} imagem(ns)`);
        }
      } catch (error) {
        console.warn('⚠️ Erro na análise visual:', error.message);
      }
    }

    // ==========================================
    // 4. SCORECARDS (P0: health, deal_risk, buy_intent, engagement)
    // ==========================================
    
    // 4.1 ENGAGEMENT SCORE (volume + reciprocidade + regularidade)
    const pontos = {
      mensagens: inbound.length * 3,
      reciprocidade: outbound.length > 0 ? (inbound.length / outbound.length) * 40 : 0,
      sentimento: analiseSentimento.score_sentimento * 0.3,
      tempoResposta: avgReplyCompany && avgReplyCompany < 60 ? 20 : avgReplyCompany && avgReplyCompany < 180 ? 10 : 0,
      intencaoCompra: intencoesDetectadas.some(i => i.intencao === 'comprar' || i.intencao === 'cotacao') ? 25 : 0,
      palavrasPositivas: palavrasChave.filter(p => p.categoria === 'elogio' || p.relevancia_comercial >= 8).length * 5
    };

    const scoreEngajamento = Math.min(100, Math.round(Object.values(pontos).reduce((a, b) => a + b, 0)));

    // 4.2 BUY INTENT (0-100 baseado em intenções)
    const intentsCompra = intencoesDetectadas.filter(i => 
      ['comprar', 'cotacao', 'negociacao'].includes(i.intencao)
    );
    const buyIntent = intentsCompra.length > 0
      ? Math.round(intentsCompra.reduce((sum, i) => sum + i.confianca, 0) / intentsCompra.length)
      : 0;

    // 4.3 DIAS PARADO (heurística: desde última mensagem inbound)
    const daysStalled = daysSinceLastInbound || 0;

    // 4.4 FRICÇÃO
    const hasFriction = maxFollowUpStreak >= 3 || cortesDetectados.length > 0;
    const frictionReasons = [
      maxFollowUpStreak >= 3 ? `${maxFollowUpStreak} follow-ups sem resposta` : null,
      ...cortesDetectados
    ].filter(Boolean);

    // 4.5 HEALTH SCORE (sentimento 50% + responsividade 30% + ausência fricção 20%)
    const responsividadeScore = avgReplyClient 
      ? Math.max(0, 100 - (avgReplyClient / 60) * 10) // penaliza respostas lentas
      : 50;
    
    const healthScore = Math.round(
      analiseSentimento.score_sentimento * 0.5 +
      responsividadeScore * 0.3 +
      (hasFriction ? 0 : 20)
    );

    // 4.6 DEAL RISK (dias parado + objeções + follow-ups)
    const objecoesAltas = (objections || []).filter(o => o.severity === 'alta').length;
    const dealRisk = Math.min(100, Math.round(
      Math.min(daysStalled * 10, 40) +
      Math.min(objecoesAltas * 15, 30) +
      Math.min(Math.max(maxFollowUpStreak - 2, 0) * 10, 30)
    ));

    // 4.7 SEGMENTAÇÃO (mantida para compatibilidade)
    let segmentoSugerido = 'lead_frio';
    let estagioVida = 'descoberta';
    let confiancaSegmentacao = 60;

    // 🎯 SEGMENTAÇÃO BASEADA EM DADOS REAIS
    const temIntencaoCompra = intencoesDetectadas.some(i => 
      (i.intencao === 'comprar' || i.intencao === 'cotacao') && i.confianca > 60
    );
    const temReclamacao = intencoesDetectadas.some(i => i.intencao === 'reclamacao');
    const engajamentoAlto = scoreEngajamento > 70;
    const engajamentoBaixo = scoreEngajamento < 30;
    const sentimentoNegativo = analiseSentimento.score_sentimento < 40;

    if (temReclamacao && sentimentoNegativo) {
      segmentoSugerido = 'risco_churn';
      estagioVida = 'reativacao';
      confiancaSegmentacao = 95;
    } else if (temIntencaoCompra && engajamentoAlto) {
      segmentoSugerido = 'lead_quente';
      estagioVida = 'decisao';
      confiancaSegmentacao = 90;
    } else if (inbound.length >= 10 && outbound.length > 0 && (inbound.length / outbound.length) > 0.8 && !sentimentoNegativo) {
      segmentoSugerido = 'cliente_ativo';
      estagioVida = 'pos_venda';
      confiancaSegmentacao = 92;
    } else if (inbound.length >= 5 && analiseSentimento.score_sentimento > 60) {
      segmentoSugerido = 'lead_morno';
      estagioVida = 'consideracao';
      confiancaSegmentacao = 80;
    } else if (engajamentoBaixo || inbound.length === 0) {
      const diasSemMensagens = contato.created_date 
        ? (Date.now() - new Date(contato.created_date).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      
      if (diasSemMensagens > 30) {
        segmentoSugerido = 'cliente_inativo';
        estagioVida = 'reativacao';
        confiancaSegmentacao = 85;
      }
    }

    // ==========================================
    // 5. SISTEMA DE ALERTAS (P0)
    // ==========================================
    const alerts = [];

    if (maxFollowUpStreak >= 3) {
      alerts.push({ level: 'alto', reason: `${maxFollowUpStreak} follow-ups consecutivos sem resposta do cliente` });
    }

    if (daysStalled > 3 && estagioVida === 'negociacao') {
      alerts.push({ level: 'alto', reason: 'Negociação parada há mais de 3 dias' });
    }

    if (dealRisk > 70 && buyIntent > 50) {
      alerts.push({ level: 'alto', reason: 'Alto risco de perda em negociação com boa intenção de compra' });
    }

    if (analiseSentimento.score_sentimento < 40 && temReclamacao) {
      alerts.push({ level: 'alto', reason: 'Reclamação + sentimento negativo detectado' });
    }

    if (hasFriction) {
      alerts.push({ level: 'medio', reason: frictionReasons.join('; ') });
    }

    if (buyIntent > 70 && daysStalled > 2) {
      alerts.push({ level: 'medio', reason: 'Oportunidade quente esfriando (sem interação recente)' });
    }

    // ==========================================
    // 6. HANDOFF E PRÓXIMA AÇÃO
    // ==========================================
    const needManager = (dealRisk > 70 && buyIntent > 50) || (healthScore < 40 && buyIntent > 60);
    
    const handoff = 
      needManager && hasFriction ? 'co_atendimento_gerente' :
      healthScore < 30 && maxFollowUpStreak > 5 ? 'trocar_responsavel' :
      'manter';

    let proximaAcao = 'Acompanhar evolução';
    let acoesPrioritarias = [];
    let messageSuggestion = '';
    
    // 🤖 IA SUGERE AÇÕES BASEADAS NO CONTEXTO COMPLETO
    try {
      const sugestaoAcoes = await base44.integrations.Core.InvokeLLM({
        prompt: `Com base nesta análise de cliente B2B:
- Health Score: ${healthScore}/100
- Deal Risk: ${dealRisk}/100
- Buy Intent: ${buyIntent}/100
- Engagement: ${scoreEngajamento}/100
- Segmento: ${segmentoSugerido}
- Sentimento: ${analiseSentimento.sentimento_predominante} (${analiseSentimento.score_sentimento}/100)
- Intenções: ${intencoesDetectadas.map(i => i.intencao).join(', ') || 'nenhuma clara'}
- Objeções: ${(objections || []).map(o => o.text).join('; ') || 'nenhuma'}
- Alertas: ${alerts.map(a => a.reason).join('; ') || 'nenhum'}
${insightsVisuais.length > 0 ? `- Insights visuais: ${insightsVisuais.join(', ')}` : ''}

Sugira:
1. A melhor ação comercial IMEDIATA (específica, acionável, com prazo em horas)
2. Uma mensagem WhatsApp curta e profissional para enviar ao cliente
3. 2-3 ações secundárias`,
        response_json_schema: {
          type: "object",
          properties: {
            acao_principal: { type: "string" },
            prazo_horas: { type: "number" },
            message_suggestion: { type: "string" },
            acoes_secundarias: { type: "array", items: { type: "string" }, maxItems: 3 },
            justificativa: { type: "string" }
          }
        }
      });

      proximaAcao = sugestaoAcoes.acao_principal;
      acoesPrioritarias = sugestaoAcoes.acoes_secundarias || [];
      messageSuggestion = sugestaoAcoes.message_suggestion || '';
      
    } catch (error) {
      console.warn('⚠️ Erro ao gerar sugestão de ação com IA:', error.message);
      
      // Fallback para regras fixas
      if (segmentoSugerido === 'lead_quente') {
        proximaAcao = 'Enviar proposta comercial formal';
        messageSuggestion = 'Olá! Preparei uma proposta personalizada para você. Posso enviar?';
      } else if (segmentoSugerido === 'cliente_ativo') {
        proximaAcao = 'Verificar oportunidades de upsell';
      } else if (segmentoSugerido === 'risco_churn') {
        proximaAcao = 'URGENTE: Contato imediato para resolver insatisfação';
        messageSuggestion = 'Vi que houve um problema. Podemos conversar para resolver juntos?';
      } else if (segmentoSugerido === 'lead_morno') {
        proximaAcao = 'Agendar call de descoberta';
      } else if (segmentoSugerido === 'cliente_inativo') {
        proximaAcao = 'Campanha de reativação';
      }
    }

    // ==========================================
    // 6A. CALCULAR ROOT CAUSES + EVIDENCE
    // ==========================================
    const rootCauses = [];
    const evidenceSnippets = [];

    // Causa 1: Follow-ups sem resposta
    if (maxFollowUpStreak >= 3) {
      rootCauses.push(`${maxFollowUpStreak} follow-ups consecutivos sem resposta`);
      inbound.length > 0 && evidenceSnippets.push({
        cause: `${maxFollowUpStreak} follow-ups sem resposta`,
        snippet: `Cliente não respondeu aos últimos ${maxFollowUpStreak} contatos`,
        timestamp: new Date().toISOString(),
        thread_id: threadIds[0]
      });
    }

    // Causa 2: Dias parado
    if (daysStalled > 3) {
      rootCauses.push(`Negociação parada há ${daysStalled} dias`);
      lastInbound && evidenceSnippets.push({
        cause: `Parado há ${daysStalled} dias`,
        snippet: `Última mensagem do cliente: ${cleanText(lastInbound.content || '').substring(0, 50)}...`,
        timestamp: lastInbound.created_date,
        thread_id: lastInbound.thread_id
      });
    }

    // Causa 3: Objeções não resolvidas
    if ((objections || []).length > 0) {
      const objecoesTexto = objections.map(o => `"${o.text}"`).join('; ');
      rootCauses.push(`Objeções não resolvidas: ${objecoesTexto}`);
      objections.slice(0, 2).forEach(obj => {
        evidenceSnippets.push({
          cause: `Objeção: ${obj.category}`,
          snippet: `"${obj.text}" - ${obj.unlock_hint}`,
          timestamp: new Date().toISOString(),
          thread_id: threadIds[0]
        });
      });
    }

    // Causa 4: Sentimento negativo
    if (analiseSentimento.score_sentimento < 40) {
      rootCauses.push(`Sentimento predominantemente negativo (${analiseSentimento.score_sentimento}/100)`);
      analiseSentimento.razoes?.length > 0 && evidenceSnippets.push({
        cause: 'Sentimento negativo',
        snippet: analiseSentimento.razoes[0],
        timestamp: new Date().toISOString(),
        thread_id: threadIds[0]
      });
    }

    // Causa 5: Frases de corte detectadas
    if (cortesDetectados.length > 0) {
      rootCauses.push(`Cliente disse: ${cortesDetectados.map(c => `"${c.replace('Cliente disse: ', '')}"`).join(', ')}`);
      cortesDetectados.forEach(corte => {
        evidenceSnippets.push({
          cause: 'Frase de corte',
          snippet: corte,
          timestamp: new Date().toISOString(),
          thread_id: threadIds[0]
        });
      });
    }

    // ==========================================
    // 6B. PAYLOAD HIERÁRQUICO COM INSIGHTS COMPLETO
    // ==========================================
    const payload = {
      scope: {
        mode,
        start: dataInicio.toISOString(),
        end: dataFim.toISOString(),
        threads: threadsScope.length,
        messages: mensagens.length,
        limited_by_visibility: limitedByVisibility,
        visibility_notice: limitedByVisibility 
          ? 'Insights limitados: existem conversas que você não tem permissão para visualizar.'
          : null
      },
      scores: {
        health: healthScore,
        deal_risk: dealRisk,
        buy_intent: buyIntent,
        engagement: scoreEngajamento
      },
      scores_explain: {
        health: `Saúde = Sentimento(${analiseSentimento.score_sentimento}% × 50%) + Responsividade(${responsividadeScore.toFixed(0)}% × 30%) + Fricção(${hasFriction ? 0 : 20}% × 20%)`,
        deal_risk: `Risco = Dias parado(${Math.min(daysStalled * 10, 40)}%) + Objeções altas(${Math.min(objecoesAltas * 15, 30)}%) + Follow-ups(${Math.min(Math.max(maxFollowUpStreak - 2, 0) * 10, 30)}%)`,
        buy_intent: `Intenção = ${intentsCompra.length} intenção(ões) de compra detectada(s) com confiança média ${buyIntent}%`,
        engagement: `Engajamento = Vol(${Math.round(inbound.length * 3)}) + Reciprocidade(${(inbound.length / Math.max(outbound.length, 1) * 40).toFixed(0)}) + Sentimento + Tempo resposta`
      },
      stage: {
        current: estagioVida,
        days_stalled: daysStalled
      },
      root_causes: rootCauses,
      evidence_snippets: evidenceSnippets.slice(0, 5),
      metrics: {
        sentiment_current: analiseSentimento.score_sentimento,
        sentiment_trend: analiseSentimento.evolucao_sentimento,
        friccao: {
          has_friction: hasFriction,
          reasons: frictionReasons
        },
        responsiveness: {
          avg_reply_minutes_company: avgReplyCompany,
          avg_reply_minutes_client: avgReplyClient,
          unanswered_followups: maxFollowUpStreak,
          best_contact_times: []
        }
      },
      topics: topics || [],
      objections: objections || [],
      alerts,
      next_best_action: {
        action: proximaAcao,
        deadline_hours: sugestaoAcoes?.prazo_horas || null,
        message_suggestion: messageSuggestion,
        need_manager: needManager,
        handoff
      }
    };

    // ==========================================
    // 6C. SALVAR ANÁLISE ENRIQUECIDA
    // ==========================================
    const analise = await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
      contact_id,
      periodo_analise: `${dataInicio.toISOString().split('T')[0]} a ${new Date().toISOString().split('T')[0]}`,
      metricas_engajamento: metricas,
      analise_sentimento: analiseSentimento,
      palavras_chave_frequentes: palavrasChave,
      intencoes_detectadas: intencoesDetectadas,
      padroes_comportamentais: padroesBehaviorais,
      insights_visuais: insightsVisuais,
      segmento_sugerido: segmentoSugerido,
      confianca_segmentacao: confiancaSegmentacao,
      estagio_ciclo_vida: estagioVida,
      score_engajamento: scoreEngajamento,
      proxima_acao_sugerida: proximaAcao,
      acoes_prioritarias: acoesPrioritarias,
      ultima_analise: new Date().toISOString(),
      versao_analise: '2.0_multimodal',
      insights: payload
    });

    // ==========================================
    // 7. ATUALIZAR CONTATO + BUSCAR FOTO
    // ==========================================
    const updateData = {
      segmento_atual: segmentoSugerido,
      estagio_ciclo_vida: estagioVida,
      score_engajamento: scoreEngajamento,
      ultima_analise_comportamento: new Date().toISOString()
    };

    // 📸 Buscar foto de perfil se não existir ou estiver antiga (>7 dias)
    const fotoAntiga = !contato.foto_perfil_atualizada_em || 
      (Date.now() - new Date(contato.foto_perfil_atualizada_em).getTime()) > 7 * 24 * 60 * 60 * 1000;

    if (fotoAntiga && threadsScope.length > 0 && threadsScope[0].whatsapp_integration_id) {
      try {
        const fotoResult = await base44.asServiceRole.functions.invoke('buscarFotoPerfilWhatsApp', {
          integration_id: threadsScope[0].whatsapp_integration_id,
          phone: contato.telefone
        });
        
        if (fotoResult?.profilePictureUrl) {
          updateData.foto_perfil_url = fotoResult.profilePictureUrl;
          updateData.foto_perfil_atualizada_em = new Date().toISOString();
          console.log('📸 Foto de perfil atualizada durante análise');
        }
      } catch (error) {
        console.warn('⚠️ Erro ao buscar foto durante análise:', error.message);
      }
    }

    await base44.asServiceRole.entities.Contact.update(contact_id, updateData);

    // ==========================================
    // 8. ATRIBUIR TAGS AUTOMATICAMENTE
    // ==========================================
    const tagsParaAtribuir = [];
    
    if (scoreEngajamento > 80) tagsParaAtribuir.push('alto_engajamento');
    if (segmentoSugerido === 'lead_quente') tagsParaAtribuir.push('oportunidade_quente');
    if (segmentoSugerido === 'risco_churn') tagsParaAtribuir.push('risco_cancelamento');
    if (analiseSentimento.score_sentimento < 40) tagsParaAtribuir.push('insatisfeito');

    for (const tagNome of tagsParaAtribuir) {
      try {
        // Buscar ou criar tag
        let tags = await base44.asServiceRole.entities.Tag.list('-created_date', 1, { nome: tagNome });
        let tag;
        
        if (tags.length === 0) {
          tag = await base44.asServiceRole.entities.Tag.create({
            nome: tagNome,
            categoria: 'comportamento',
            automacao_ativa: true
          });
        } else {
          tag = tags[0];
        }

        // Verificar se já existe a relação
        const existente = await base44.asServiceRole.entities.ContactTag.list('-created_date', 1, {
          contact_id,
          tag_id: tag.id
        });

        if (existente.length === 0) {
          await base44.asServiceRole.entities.ContactTag.create({
            contact_id,
            tag_id: tag.id,
            atribuida_por: 'sistema',
            origem: 'ia',
            confianca_ia: confiancaSegmentacao
          });
        }
      } catch (error) {
        console.error(`Erro ao atribuir tag ${tagNome}:`, error);
      }
    }



    return Response.json({
      success: true,
      analysis_id: analise.id,
      saved: true,
      payload,
      analise,
      resumo: {
        segmento: segmentoSugerido,
        estagio: estagioVida,
        score: scoreEngajamento,
        sentimento: analiseSentimento.sentimento_predominante,
        proxima_acao: proximaAcao,
        tags_atribuidas: tagsParaAtribuir,
        insights_visuais_count: insightsVisuais.length,
        padroes_detectados: padroesBehaviorais.length,
        intencoes_ativas: intencoesDetectadas.filter(i => i.confianca > 70).length,
        nivel_confianca: confiancaSegmentacao,
        root_causes_count: rootCauses.length,
        evidence_count: evidenceSnippets.length
      }
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro na análise de comportamento:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});