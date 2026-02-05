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
    // 1. MÉTRICAS DE ENGAJAMENTO
    // ==========================================
    const mensagensEnviadas = mensagens.filter(m => m.sender_type === 'contact');
    const mensagensRecebidas = mensagens.filter(m => m.sender_type === 'user');

    const frequenciaDias = periodo_dias / Math.max(1, mensagensEnviadas.length);
    
    let tempoMedioResposta = 0;
    let respostasContabilizadas = 0;
    
    for (let i = 1; i < mensagens.length; i++) {
      if (mensagens[i].sender_type === 'user' && mensagens[i-1].sender_type === 'contact') {
        const diff = new Date(mensagens[i].created_date) - new Date(mensagens[i-1].created_date);
        tempoMedioResposta += diff;
        respostasContabilizadas++;
      }
    }
    
    if (respostasContabilizadas > 0) {
      tempoMedioResposta = (tempoMedioResposta / respostasContabilizadas) / (1000 * 60); // em minutos
    }

    const taxaResposta = mensagensEnviadas.length > 0 
      ? (mensagensRecebidas.length / mensagensEnviadas.length) * 100 
      : 0;

    const metricas = {
      total_mensagens: mensagens.length,
      mensagens_enviadas: mensagensEnviadas.length,
      mensagens_recebidas: mensagensRecebidas.length,
      frequencia_media_dias: parseFloat(frequenciaDias.toFixed(2)),
      tempo_medio_resposta_minutos: parseFloat(tempoMedioResposta.toFixed(2)),
      taxa_resposta: parseFloat(taxaResposta.toFixed(2))
    };

    // ==========================================
    // 2. ANÁLISE MULTIMODAL AVANÇADA COM IA
    // ==========================================
    const textosMensagens = mensagensEnviadas
      .filter(m => m.content && m.content.length > 5)
      .slice(-30) // Aumentado para 30 mensagens
      .map(m => m.content)
      .join('\n');

    // 🖼️ Buscar mensagens com mídia (imagens) para análise visual
    const mensagensComImagem = mensagensEnviadas
      .filter(m => m.media_type === 'image' && m.media_url)
      .slice(-5); // Últimas 5 imagens

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
- Taxa resposta: ${metricas.taxa_resposta.toFixed(1)}%
- Tempo médio resposta: ${metricas.tempo_medio_resposta_minutos.toFixed(0)}min

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
                    categoria: { type: "string", enum: ["produto", "problema", "duvida", "elogio", "reclamacao", "preco", "prazo", "tecnico"] },
                    relevancia_comercial: { type: "number", minimum: 0, maximum: 10 }
                  }
                }
              },
              intencoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    intencao: { type: "string", enum: ["comprar", "cotacao", "suporte", "reclamacao", "informacao", "negociacao", "cancelamento"] },
                    confianca: { type: "number", minimum: 0, maximum: 100 },
                    evidencias: { type: "array", items: { type: "string" } }
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
                    impacto: { type: "string", enum: ["positivo", "neutro", "negativo"] }
                  }
                }
              },
              perfil_cliente: {
                type: "string",
                enum: ["analitico", "pragmatico", "relacional", "inovador"]
              },
              nivel_maturidade_compra: {
                type: "string",
                enum: ["consciencia", "consideracao", "decisao", "pronto_comprar"]
              },
              objecoes_identificadas: {
                type: "array",
                items: { type: "string" }
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
    // 4. SEGMENTAÇÃO INTELIGENTE AVANÇADA
    // ==========================================
    let segmentoSugerido = 'lead_frio';
    let estagioVida = 'descoberta';
    let scoreEngajamento = 30;
    let confiancaSegmentacao = 60;

    // 🧠 ALGORITMO HÍBRIDO: Regras + IA
    const pontos = {
      mensagens: mensagensEnviadas.length * 3,
      taxaResposta: taxaResposta * 0.4,
      sentimento: analiseSentimento.score_sentimento * 0.3,
      tempoResposta: tempoMedioResposta < 60 ? 20 : tempoMedioResposta < 180 ? 10 : 0,
      intencaoCompra: intencoesDetectadas.some(i => i.intencao === 'comprar' || i.intencao === 'cotacao') ? 25 : 0,
      palavrasPositivas: palavrasChave.filter(p => p.categoria === 'elogio' || p.relevancia_comercial >= 8).length * 5
    };

    scoreEngajamento = Math.min(100, Math.round(Object.values(pontos).reduce((a, b) => a + b, 0)));

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
    } else if (mensagensEnviadas.length >= 10 && taxaResposta > 80 && !sentimentoNegativo) {
      segmentoSugerido = 'cliente_ativo';
      estagioVida = 'pos_venda';
      confiancaSegmentacao = 92;
    } else if (mensagensEnviadas.length >= 5 && analiseSentimento.score_sentimento > 60) {
      segmentoSugerido = 'lead_morno';
      estagioVida = 'consideracao';
      confiancaSegmentacao = 80;
    } else if (engajamentoBaixo || mensagensEnviadas.length === 0) {
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
    // 5. PRÓXIMA AÇÃO SUGERIDA COM IA
    // ==========================================
    let proximaAcao = 'Acompanhar evolução';
    let acoesPrioritarias = [];
    
    // 🤖 IA SUGERE AÇÕES BASEADAS NO CONTEXTO COMPLETO
    try {
      const sugestaoAcoes = await base44.integrations.Core.InvokeLLM({
        prompt: `Com base nesta análise de cliente:
- Segmento: ${segmentoSugerido}
- Score Engajamento: ${scoreEngajamento}/100
- Sentimento: ${analiseSentimento.sentimento_predominante} (${analiseSentimento.score_sentimento}/100)
- Intenções: ${intencoesDetectadas.map(i => i.intencao).join(', ') || 'nenhuma clara'}
- Palavras-chave comerciais: ${palavrasChave.filter(p => p.relevancia_comercial >= 7).map(p => p.palavra).join(', ') || 'nenhuma'}
${insightsVisuais.length > 0 ? `- Insights visuais: ${insightsVisuais.join(', ')}` : ''}

Sugira a MELHOR ação comercial imediata (específica, acionável, com prazo).`,
        response_json_schema: {
          type: "object",
          properties: {
            acao_principal: { type: "string" },
            prazo_sugerido: { type: "string" },
            acoes_secundarias: { type: "array", items: { type: "string" } },
            justificativa: { type: "string" }
          }
        }
      });

      proximaAcao = `${sugestaoAcoes.acao_principal} (${sugestaoAcoes.prazo_sugerido})`;
      acoesPrioritarias = sugestaoAcoes.acoes_secundarias || [];
      
    } catch (error) {
      console.warn('⚠️ Erro ao gerar sugestão de ação com IA:', error.message);
      
      // Fallback para regras fixas
      if (segmentoSugerido === 'lead_quente') {
        proximaAcao = '🎯 Enviar proposta comercial formal (24h)';
      } else if (segmentoSugerido === 'cliente_ativo') {
        proximaAcao = '💎 Verificar oportunidades de upsell (esta semana)';
      } else if (segmentoSugerido === 'risco_churn') {
        proximaAcao = '🚨 URGENTE: Contato imediato para resolver insatisfação (hoje)';
      } else if (segmentoSugerido === 'lead_morno') {
        proximaAcao = '📞 Agendar call de descoberta (3 dias)';
      } else if (segmentoSugerido === 'cliente_inativo') {
        proximaAcao = '🔄 Campanha de reativação (imediato)';
      }
    }

    // ==========================================
    // 6. SALVAR ANÁLISE ENRIQUECIDA
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
      versao_analise: '2.0_multimodal'
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

    if (fotoAntiga && threads.length > 0 && threads[0].whatsapp_integration_id) {
      try {
        const fotoResult = await base44.asServiceRole.functions.invoke('buscarFotoPerfilWhatsApp', {
          integration_id: threads[0].whatsapp_integration_id,
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
        nivel_confianca: confiancaSegmentacao
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