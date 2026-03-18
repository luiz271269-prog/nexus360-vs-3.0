import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Detectar URLs em texto
function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, evento } = await req.json();

    if (action === 'process_message_inbound') {
      // Processar mensagem recebida
      const { message_id, thread_id, content } = evento;

      console.log('[AGENT] 🤖 Processando mensagem:', message_id);

      // 1. Criar AgentRun
      const run = await base44.asServiceRole.entities.AgentRun.create({
        trigger_type: 'message.inbound',
        trigger_event_id: message_id,
        playbook_selected: 'link_intelligence',
        execution_mode: 'assistente',
        status: 'processando',
        context_snapshot: {
          message_id,
          thread_id,
          content_preview: content?.substring(0, 100)
        },
        started_at: new Date().toISOString()
      });

      // 2. Detectar URLs
      const urls = extractUrls(content);

      if (urls.length === 0) {
        // Sem URLs, nada a fazer
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'concluido',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(run.started_at).getTime()
        });

        return Response.json({
          success: true,
          message: 'Nenhuma URL detectada',
          run_id: run.id
        });
      }

      console.log(`[AGENT] 🔗 URLs detectadas: ${urls.length}`);

      // 3. Processar primeira URL (limite de 1 por mensagem para MVP)
      const url = urls[0];

      // 3a. Scrape via Firecrawl
      const scrapeResponse = await base44.functions.invoke('firecrawlService', {
        action: 'scrape',
        url
      });

      if (!scrapeResponse.success) {
        console.error('[AGENT] ❌ Erro ao fazer scrape:', scrapeResponse.error);
        
        await base44.asServiceRole.entities.AgentRun.update(run.id, {
          status: 'falhou',
          error_message: scrapeResponse.error,
          completed_at: new Date().toISOString()
        });

        return Response.json({
          success: false,
          error: scrapeResponse.error,
          run_id: run.id
        });
      }

      const scrapedData = scrapeResponse.data;

      // 3b. Extrair insights com LLM
      const insights = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise este conteúdo de página web e extraia informações relevantes.

Conteúdo:
${scrapedData.content_text.substring(0, 3000)}

Extraia:
1. Tipo de produto/serviço (se houver)
2. Preço aproximado (se mencionado)
3. Especificações principais (3-5 bullet points)
4. Urgência da demanda (baixa/média/alta baseado no contexto)`,
        response_json_schema: {
          type: "object",
          properties: {
            produto: { type: "string" },
            preco_aproximado: { type: "number" },
            specs_principais: { 
              type: "array",
              items: { type: "string" }
            },
            urgencia: { 
              type: "string",
              enum: ["baixa", "media", "alta"]
            }
          }
        }
      });

      console.log('[AGENT] 🧠 Insights extraídos:', insights);

      // 3c. Atualizar ThreadContext
      const existingContext = await base44.asServiceRole.entities.ThreadContext.filter({
        thread_id
      });

      const contextData = {
        thread_id,
        external_sources: [
          ...(existingContext[0]?.external_sources || []),
          {
            source_url: url,
            summary: `${insights.produto || 'Produto'} - ${insights.preco_aproximado ? `R$ ${insights.preco_aproximado}` : 'Preço não identificado'}`,
            fetched_at: new Date().toISOString(),
            cache_id: scrapedData.id
          }
        ],
        entities_extracted: insights,
        updated_by_agent_at: new Date().toISOString()
      };

      if (existingContext.length > 0) {
        await base44.asServiceRole.entities.ThreadContext.update(existingContext[0].id, contextData);
      } else {
        await base44.asServiceRole.entities.ThreadContext.create(contextData);
      }

      // 3d. Gerar sugestão de resposta
      const sugestao = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de vendas profissional.

O cliente enviou este link: ${url}

Identificamos:
- Produto: ${insights.produto || 'Não identificado'}
- Preço: ${insights.preco_aproximado ? `R$ ${insights.preco_aproximado}` : 'Não mencionado'}
- Urgência: ${insights.urgencia}

Gere uma resposta profissional, amigável e útil sugerindo próximos passos (orçamento, demonstração, esclarecimento de dúvidas, etc.).

Seja breve (2-3 frases) e direto.`
      });

      // 3e. Adicionar sugestão ao ThreadContext
      await base44.asServiceRole.entities.ThreadContext.update(
        existingContext[0]?.id || (await base44.asServiceRole.entities.ThreadContext.filter({ thread_id }))[0].id,
        {
          agent_suggestions: [
            {
              tipo: 'resposta_link',
              texto: sugestao,
              confianca: 85,
              usado: false
            }
          ]
        }
      );

      // 3f. Registrar decisão
      await base44.asServiceRole.entities.AgentDecisionLog.create({
        agent_run_id: run.id,
        step_name: 'link_intelligence',
        decisao_tipo: 'sugestao_resposta',
        ferramentas_usadas: ['firecrawlService', 'InvokeLLM', 'ThreadContext'],
        decisao_tomada: {
          url_processada: url,
          insights,
          sugestao
        },
        confianca_ia: 85,
        resultado_execucao: 'sucesso',
        timestamp_decisao: new Date().toISOString()
      });

      // 4. Finalizar AgentRun
      await base44.asServiceRole.entities.AgentRun.update(run.id, {
        status: 'concluido',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(run.started_at).getTime()
      });

      console.log('[AGENT] ✅ Processamento concluído');

      return Response.json({
        success: true,
        run_id: run.id,
        url_processada: url,
        insights,
        sugestao
      });
    }

    return Response.json({
      success: false,
      error: 'Ação não suportada'
    }, { status: 400 });

  } catch (error) {
    console.error('[AGENT] ❌ Erro:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});