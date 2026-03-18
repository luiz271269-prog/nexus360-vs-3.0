import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// ═════════════════════════════════════════════════════════════════════════
// PROCESSADOR ASSÍNCRONO - ANÁLISE IA E PERSISTÊNCIA DE MÍDIA
// ═════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const startTime = Date.now();
  console.log('[PROCESSADOR] 🚀 Iniciando processamento assíncrono');

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    const {
      webhookLogId,
      messageId,
      threadId,
      integracaoId,
      contactId,
      mediaUrl,
      mediaType,
      content,
      requestId
    } = payload;

    console.log(`[${requestId}] 📦 Payload recebido para processamento:`, {
      messageId,
      threadId,
      temMidia: !!mediaUrl,
      mediaType
    });

    // ═════════════════════════════════════════════════════════════════════
    // 1. PERSISTÊNCIA DE MÍDIA (SE HOUVER)
    // ═════════════════════════════════════════════════════════════════════
    
    let mediaUrlPermanente = mediaUrl;
    let analiseMultimodal = null;

    if (mediaUrl && mediaType !== 'none' && mediaType !== 'location') {
      console.log(`[${requestId}] 📥 Iniciando persistência de mídia: ${mediaType}`);
      
      try {
        // Download da mídia temporária
        const response = await fetch(mediaUrl);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], `${messageId}.${getExtensao(mediaType)}`, {
            type: response.headers.get('content-type') || 'application/octet-stream'
          });

          // Upload para armazenamento permanente
          const uploadResult = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ 
            file 
          });
          
          mediaUrlPermanente = uploadResult.file_uri;
          console.log(`[${requestId}] ✅ Mídia persistida: ${mediaUrlPermanente}`);

          // Atualizar mensagem com URL permanente
          await base44.asServiceRole.entities.Message.update(messageId, {
            media_url: mediaUrlPermanente,
            'metadata.midia_persistida': true
          });

        } else {
          console.error(`[${requestId}] ❌ Erro ao baixar mídia: ${response.status}`);
        }
      } catch (mediaError) {
        console.error(`[${requestId}] ❌ Erro na persistência de mídia:`, mediaError);
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // 2. ANÁLISE MULTIMODAL E SENTIMENTO (IA)
    // ═════════════════════════════════════════════════════════════════════
    
    console.log(`[${requestId}] 🧠 Iniciando análise de IA`);
    
    try {
      const promptAnalise = construirPromptAnalise(content, mediaType, mediaUrl);
      
      const resultadoIA = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: promptAnalise,
        file_urls: mediaUrlPermanente && mediaType === 'image' ? [mediaUrlPermanente] : undefined,
        response_json_schema: {
          type: 'object',
          properties: {
            sentimento: {
              type: 'string',
              enum: ['muito_positivo', 'positivo', 'neutro', 'negativo', 'muito_negativo']
            },
            intencao: {
              type: 'string',
              enum: ['duvida', 'compra', 'reclamacao', 'agradecimento', 'negociacao', 'cancelamento', 'duvida_geral', 'outro']
            },
            urgencia: {
              type: 'string',
              enum: ['baixa', 'media', 'alta', 'critica']
            },
            resumo: {
              type: 'string'
            },
            palavras_chave: {
              type: 'array',
              items: { type: 'string' }
            },
            confianca_resposta: {
              type: 'number',
              minimum: 0,
              maximum: 1
            },
            descricao_midia: {
              type: 'string'
            }
          },
          required: ['sentimento', 'intencao', 'urgencia', 'resumo']
        }
      });

      analiseMultimodal = resultadoIA;
      console.log(`[${requestId}] ✅ Análise de IA concluída:`, {
        sentimento: analiseMultimodal.sentimento,
        intencao: analiseMultimodal.intencao,
        urgencia: analiseMultimodal.urgencia
      });

      // Atualizar mensagem com análise
      await base44.asServiceRole.entities.Message.update(messageId, {
        'metadata.analise_multimodal': analiseMultimodal
      });

      // Atualizar thread com prioridade baseada em urgência
      const prioridadeMap = {
        'critica': 'urgente',
        'alta': 'alta',
        'media': 'normal',
        'baixa': 'baixa'
      };
      
      await base44.asServiceRole.entities.MessageThread.update(threadId, {
        prioridade: prioridadeMap[analiseMultimodal.urgencia] || 'normal',
        sentimento_geral: analiseMultimodal.sentimento
      });

    } catch (iaError) {
      console.error(`[${requestId}] ❌ Erro na análise de IA:`, iaError);
      analiseMultimodal = {
        error: iaError.message,
        sentimento: 'neutro',
        intencao: 'outro',
        urgencia: 'media',
        resumo: 'Erro ao analisar mensagem'
      };
    }

    // ═════════════════════════════════════════════════════════════════════
    // 3. CRIAR INTERAÇÃO (REGISTRO DE AUDITORIA)
    // ═════════════════════════════════════════════════════════════════════
    
    console.log(`[${requestId}] 📝 Criando registro de interação`);
    
    await base44.asServiceRole.entities.Interacao.create({
      contact_id: contactId,
      thread_id: threadId,
      message_id: messageId,
      vendedor: 'IA - NexusEngine',
      tipo_interacao: 'whatsapp',
      data_interacao: new Date().toISOString(),
      resultado: 'mensagem_recebida',
      observacoes: `${content?.substring(0, 100) || '[Mídia]'} | Sentimento: ${analiseMultimodal?.sentimento}`,
      categoria_interacao: 'suporte',
      temperatura_cliente: mapearTemperatura(analiseMultimodal?.sentimento),
      analise_ia: analiseMultimodal
    });

    // ═════════════════════════════════════════════════════════════════════
    // 4. LOG DE AUTOMAÇÃO
    // ═════════════════════════════════════════════════════════════════════
    
    const tempoProcessamento = Date.now() - startTime;
    
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'resposta_ia',
      contato_id: contactId,
      thread_id: threadId,
      integracao_id: integracaoId,
      resultado: 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        mensagem: 'Processamento assíncrono concluído com sucesso',
        tempo_execucao_ms: tempoProcessamento,
        midia_persistida: !!mediaUrlPermanente,
        analise_ia_executada: !!analiseMultimodal,
        dados_contexto: {
          sentimento: analiseMultimodal?.sentimento,
          intencao: analiseMultimodal?.intencao,
          urgencia: analiseMultimodal?.urgencia
        }
      },
      origem: 'sistema',
      prioridade: analiseMultimodal?.urgencia === 'critica' ? 'critica' : 'normal'
    });

    console.log(`[${requestId}] ✅ Processamento assíncrono concluído em ${tempoProcessamento}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        tempoProcessamento,
        analiseMultimodal,
        mediaUrlPermanente
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[PROCESSADOR] ❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers }
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═════════════════════════════════════════════════════════════════════════

function getExtensao(mediaType) {
  const extensoes = {
    image: 'jpg',
    video: 'mp4',
    audio: 'ogg',
    document: 'pdf',
    sticker: 'webp'
  };
  return extensoes[mediaType] || 'bin';
}

function construirPromptAnalise(content, mediaType, mediaUrl) {
  let prompt = `Analise a seguinte mensagem recebida via WhatsApp e forneça insights detalhados:\n\n`;

  if (content) {
    prompt += `**Texto da mensagem:**\n${content}\n\n`;
  }

  if (mediaType && mediaType !== 'none' && mediaType !== 'location') {
    prompt += `**Tipo de mídia anexada:** ${mediaType}\n`;
    if (mediaUrl) {
      prompt += `*A imagem será analisada automaticamente se for fornecida.*\n\n`;
    }
  }

  prompt += `**Instruções:**
1. Identifique o sentimento geral (muito_positivo, positivo, neutro, negativo, muito_negativo)
2. Determine a intenção principal (duvida, compra, reclamacao, agradecimento, negociacao, cancelamento, duvida_geral, outro)
3. Avalie o nível de urgência (baixa, media, alta, critica)
4. Forneça um resumo conciso da mensagem (máximo 200 caracteres)
5. Extraia palavras-chave relevantes
6. Se houver uma imagem anexada, descreva brevemente seu conteúdo em "descricao_midia"
7. Indique sua confiança na análise (0 a 1)

**Contexto:** Esta é uma mensagem de um potencial cliente ou cliente existente em um sistema de vendas B2B.`;

  return prompt;
}

function mapearTemperatura(sentimento) {
  const mapa = {
    'muito_positivo': 'muito_quente',
    'positivo': 'quente',
    'neutro': 'morno',
    'negativo': 'frio',
    'muito_negativo': 'frio'
  };
  return mapa[sentimento] || 'morno';
}