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

    const { contact_id, periodo_dias = 30 } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400, headers: corsHeaders });
    }

    // 📊 BUSCAR DADOS DO CONTATO
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contato) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404, headers: corsHeaders });
    }

    // 📊 BUSCAR MENSAGENS DOS ÚLTIMOS X DIAS
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo_dias);

    const todasMensagens = await base44.asServiceRole.entities.Message.list('-created_date', 500);
    const threads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 50, { contact_id });

    const threadIds = threads.map(t => t.id);
    const mensagens = todasMensagens.filter(m => 
      threadIds.includes(m.thread_id) && 
      new Date(m.created_date) >= dataInicio
    );

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
    // 2. ANÁLISE DE SENTIMENTO COM IA
    // ==========================================
    const textosMensagens = mensagensEnviadas
      .filter(m => m.content && m.content.length > 5)
      .slice(-20) // Últimas 20 mensagens
      .map(m => m.content)
      .join('\n');

    let analiseSentimento = {
      sentimento_predominante: 'neutro',
      score_sentimento: 50,
      evolucao_sentimento: 'estavel'
    };

    if (textosMensagens.length > 50) {
      try {
        const resultadoIA = await base44.integrations.Core.InvokeLLM({
          prompt: `Analise o sentimento geral destas mensagens de um cliente:

${textosMensagens}

Retorne JSON estruturado com:
- sentimento_predominante: "muito_positivo", "positivo", "neutro", "negativo", ou "muito_negativo"
- score_sentimento: número de 0 a 100 (0=muito negativo, 100=muito positivo)
- evolucao_sentimento: "melhorando", "estavel", ou "piorando"`,
          response_json_schema: {
            type: "object",
            properties: {
              sentimento_predominante: { type: "string" },
              score_sentimento: { type: "number" },
              evolucao_sentimento: { type: "string" }
            }
          }
        });

        analiseSentimento = resultadoIA;
      } catch (error) {
        console.error('Erro na análise de sentimento:', error);
      }
    }

    // ==========================================
    // 3. PALAVRAS-CHAVE E INTENÇÕES
    // ==========================================
    let palavrasChave = [];
    let intencoesDetectadas = [];

    if (textosMensagens.length > 50) {
      try {
        const resultadoIA = await base44.integrations.Core.InvokeLLM({
          prompt: `Analise estas mensagens e extraia:
1. Top 5 palavras-chave mais frequentes e sua categoria (produto, problema, dúvida, elogio, reclamação)
2. Intenções detectadas (comprar, suporte, informação, reclamação, etc)

Mensagens:
${textosMensagens}`,
          response_json_schema: {
            type: "object",
            properties: {
              palavras_chave: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    palavra: { type: "string" },
                    frequencia: { type: "number" },
                    categoria: { type: "string" }
                  }
                }
              },
              intencoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    intencao: { type: "string" },
                    confianca: { type: "number" }
                  }
                }
              }
            }
          }
        });

        palavrasChave = resultadoIA.palavras_chave || [];
        intencoesDetectadas = (resultadoIA.intencoes || []).map(i => ({
          ...i,
          primeira_deteccao: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Erro na extração de palavras-chave:', error);
      }
    }

    // ==========================================
    // 4. SEGMENTAÇÃO INTELIGENTE
    // ==========================================
    let segmentoSugerido = 'lead_frio';
    let estagioVida = 'descoberta';
    let scoreEngajamento = 30;
    let confiancaSegmentacao = 60;

    // Lógica de segmentação baseada em métricas
    if (mensagensEnviadas.length >= 10 && taxaResposta > 80) {
      segmentoSugerido = 'cliente_ativo';
      estagioVida = 'pos_venda';
      scoreEngajamento = 85;
      confiancaSegmentacao = 90;
    } else if (mensagensEnviadas.length >= 5 && analiseSentimento.score_sentimento > 70) {
      segmentoSugerido = 'lead_quente';
      estagioVida = 'consideracao';
      scoreEngajamento = 70;
      confiancaSegmentacao = 85;
    } else if (mensagensEnviadas.length >= 3) {
      segmentoSugerido = 'lead_morno';
      estagioVida = 'descoberta';
      scoreEngajamento = 50;
      confiancaSegmentacao = 75;
    } else if (mensagensEnviadas.length === 0 && contato.created_date) {
      const diasSemMensagens = (Date.now() - new Date(contato.created_date).getTime()) / (1000 * 60 * 60 * 24);
      if (diasSemMensagens > 30) {
        segmentoSugerido = 'cliente_inativo';
        estagioVida = 'reativacao';
        scoreEngajamento = 10;
      }
    }

    // Ajustar por sentimento
    if (analiseSentimento.score_sentimento < 30) {
      segmentoSugerido = 'risco_churn';
      scoreEngajamento = Math.max(10, scoreEngajamento - 20);
    }

    // ==========================================
    // 5. PRÓXIMA AÇÃO SUGERIDA
    // ==========================================
    let proximaAcao = 'Acompanhar evolução';
    
    if (segmentoSugerido === 'lead_quente') {
      proximaAcao = '🎯 Enviar proposta comercial formal';
    } else if (segmentoSugerido === 'cliente_ativo') {
      proximaAcao = '💎 Verificar oportunidades de upsell';
    } else if (segmentoSugerido === 'risco_churn') {
      proximaAcao = '🚨 URGENTE: Contato imediato para resolver insatisfação';
    } else if (segmentoSugerido === 'lead_morno') {
      proximaAcao = '📞 Agendar call de descoberta';
    } else if (segmentoSugerido === 'cliente_inativo') {
      proximaAcao = '🔄 Campanha de reativação';
    }

    // ==========================================
    // 6. SALVAR ANÁLISE
    // ==========================================
    const analise = await base44.asServiceRole.entities.ContactBehaviorAnalysis.create({
      contact_id,
      periodo_analise: `${dataInicio.toISOString().split('T')[0]} a ${new Date().toISOString().split('T')[0]}`,
      metricas_engajamento: metricas,
      analise_sentimento: analiseSentimento,
      palavras_chave_frequentes: palavrasChave,
      intencoes_detectadas: intencoesDetectadas,
      segmento_sugerido: segmentoSugerido,
      confianca_segmentacao: confiancaSegmentacao,
      estagio_ciclo_vida: estagioVida,
      score_engajamento: scoreEngajamento,
      proxima_acao_sugerida: proximaAcao,
      ultima_analise: new Date().toISOString()
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
        tags_atribuidas: tagsParaAtribuir
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