// chamarIA - Função unificada para chamar IA com fallback automático
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function registrarUsoIA(base44, provider, model, sucesso) {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const existentes = await base44.asServiceRole.entities.NexusMemory.filter({
      owner_user_id: 'sistema',
      tipo: 'metricas_ia',
      conteudo: { $regex: hoje }
    }, '-created_date', 1).catch(() => []);

    const existente = existentes?.[0];
    const metricas = existente ? JSON.parse(existente.conteudo || '{}') : {};
    
    metricas[provider] = (metricas[provider] || 0) + 1;
    metricas.total = (metricas.total || 0) + 1;

    if (existente) {
      await base44.asServiceRole.entities.NexusMemory.update(existente.id, {
        conteudo: JSON.stringify(metricas),
        ultima_acao: provider,
        score_utilidade: metricas.total
      }).catch(() => {});
    } else {
      await base44.asServiceRole.entities.NexusMemory.create({
        owner_user_id: 'sistema',
        tipo: 'metricas_ia',
        conteudo: JSON.stringify({ [provider]: 1, total: 1, data: hoje }),
        ultima_acao: provider,
        score_utilidade: 1
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[CHAMAR-IA] Erro ao registrar métrica:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await req.json();
    
    if (!params.system_prompt || !params.messages) {
      return Response.json({ error: 'Missing system_prompt or messages' }, { status: 400 });
    }

    // ── STEP 1: Carregar configuração ──────────────────────────────
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema
      .filter({ ativa: true }, '-created_date', 10)
      .catch(() => []);
    
    const apiKeyEnv = Deno.env.get('ANTHROPIC_API_KEY');
    const modelPadrao = configs.find(c => c.chave === 'modelo_claude')?.valor?.value || 'claude-3-5-haiku-20241022';
    const modelo = params.model || modelPadrao;

    console.log(`[CHAMAR-IA] Tentando provider: Anthropic com modelo ${modelo}`);

    // ── STEP 2: Tentar Anthropic primeiro ──────────────────────────
    if (apiKeyEnv && apiKeyEnv.length > 10) {
      try {
        const anthropicRequest = {
          model: modelo,
          max_tokens: params.max_tokens || 1500,
          system: params.system_prompt,
          messages: params.messages,
          ...(params.tools ? { tools: params.tools } : {})
        };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKeyEnv,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(anthropicRequest)
        });

        if (response.ok) {
          const data = await response.json();
          
          // Sucesso — registrar e retornar
          registrarUsoIA(base44, 'anthropic', modelo, true).catch(() => {});
          
          console.log('[CHAMAR-IA] ✅ Anthropic respondeu com sucesso');
          return Response.json({
            provider: 'anthropic',
            model: modelo,
            content: data.content,
            stop_reason: data.stop_reason,
            usage: data.usage,
            fallback: false
          });
        } else {
          const erro = await response.text();
          console.warn(`[CHAMAR-IA] ⚠️ Anthropic falhou (${response.status}): ${erro.slice(0, 100)}`);
          // Cai no fallback
        }
      } catch (e) {
        console.warn('[CHAMAR-IA] ⚠️ Anthropic exception:', e.message);
        // Cai no fallback
      }
    } else {
      console.warn('[CHAMAR-IA] ⚠️ Sem API key válida, usando InvokeLLM direto');
    }

    // ── STEP 3: Fallback — InvokeLLM do Base44 ────────────────────
    console.log('[CHAMAR-IA] Ativando fallback com InvokeLLM...');
    
    try {
      let promptCompleto = '';
      
      if (params.system_prompt) {
        promptCompleto += 'INSTRUÇÕES DO SISTEMA:\n' + params.system_prompt + '\n\n';
      }
      
      // Se tem tools, explicar no prompt
      if (params.tools && params.tools.length > 0) {
        promptCompleto += 'FERRAMENTAS DISPONÍVEIS:\n';
        for (const tool of params.tools) {
          promptCompleto += `- ${tool.name}: ${tool.description}\n`;
          if (tool.input_schema?.properties) {
            promptCompleto += `  Parâmetros: ${JSON.stringify(tool.input_schema.properties)}\n`;
          }
        }
        promptCompleto += '\nPara usar uma ferramenta, responda com JSON: {"tool": "nome", "input": {...}}\n';
        promptCompleto += 'Caso contrário, responda normalmente.\n\n';
      }
      
      // Adicionar mensagens
      promptCompleto += 'CONVERSA:\n';
      for (const msg of params.messages) {
        const role = msg.role === 'user' ? 'USUÁRIO' : 'ASSISTENTE';
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        promptCompleto += `${role}: ${content}\n`;
      }
      promptCompleto += '\nRESPOSTA:';

      const invokeParams = {
        prompt: promptCompleto,
        ...(params.tools && params.tools.length > 0 ? {
          response_json_schema: {
            type: 'object',
            properties: {
              tipo_resposta: { type: 'string', enum: ['texto', 'ferramenta'] },
              texto: { type: 'string' },
              tool: { type: 'string' },
              input: { type: 'object' }
            }
          }
        } : {})
      };

      const resultado = await base44.asServiceRole.integrations.Core.InvokeLLM(invokeParams);
      
      // Registrar uso
      registrarUsoIA(base44, 'base44_invokellm', 'default', true).catch(() => {});

      // Converter para formato compatível com Anthropic
      let content;
      if (params.tools && resultado?.tipo_resposta === 'ferramenta' && resultado?.tool) {
        content = [{
          type: 'tool_use',
          id: `fallback_${Date.now()}`,
          name: resultado.tool,
          input: resultado.input || {}
        }];
      } else {
        const textoResposta = typeof resultado === 'string' ? resultado : (resultado?.texto || JSON.stringify(resultado));
        content = [{
          type: 'text',
          text: textoResposta
        }];
      }

      console.log('[CHAMAR-IA] ✅ Fallback InvokeLLM respondeu com sucesso');
      
      return Response.json({
        provider: 'base44_invokellm',
        model: 'base44_default',
        content: content,
        stop_reason: content[0]?.type === 'tool_use' ? 'tool_use' : 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
        fallback: true,
        motivo_fallback: !apiKeyEnv ? 'sem_api_key' : 'anthropic_falhou'
      });

    } catch (fallbackError) {
      console.error('[CHAMAR-IA] ❌ InvokeLLM também falhou:', fallbackError.message);
      
      // Último recurso: erro estático
      return Response.json({
        provider: 'erro',
        model: 'none',
        content: [{
          type: 'text',
          text: 'Desculpe, não consigo processar sua solicitação no momento. O sistema de IA está temporariamente indisponível. Tente novamente em alguns minutos.'
        }],
        stop_reason: 'error',
        erro: fallbackError.message,
        fallback: true
      });
    }

  } catch (error) {
    console.error('[CHAMAR-IA] Erro crítico:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});