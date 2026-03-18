import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * 🤖 LLM SRE - Diagnóstico Inteligente de Falhas
 * 
 * Recebe dados estruturados de falhas e usa o LLM para:
 * - Analisar a causa-raiz
 * - Sugerir ações corretivas
 * - Priorizar a severidade
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[DIAGNOSE-LLM] 🔍 Iniciando diagnóstico:', payload);

    // Construir contexto estruturado para o LLM
    const contexto = `
# DIAGNÓSTICO DE SISTEMA - VendaPro

## Componente Afetado
${payload.component || 'Desconhecido'}

## Erro Detectado
${payload.error || 'Nenhum erro específico fornecido'}

## Detalhes Técnicos
${JSON.stringify(payload.details || {}, null, 2)}

## Contexto Adicional
- Timestamp: ${payload.timestamp || new Date().toISOString()}
- Latência: ${payload.latency || 'N/A'}ms
- Status: ${payload.status || 'unknown'}

## Histórico Recente
${payload.recent_history || 'Sem histórico disponível'}

## Sua Missão
Como um SRE especialista em sistemas de comunicação WhatsApp e CRM:

1. **Analise a causa-raiz** do problema com base nos dados fornecidos
2. **Identifique padrões** que possam indicar problemas sistêmicos
3. **Sugira ações corretivas** específicas e executáveis
4. **Classifique a severidade** (baixa, média, alta, crítica)
5. **Estime o tempo de resolução**

Seja específico, técnico e prático nas suas recomendações.
`;

    // Invocar LLM para análise
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: contexto,
      response_json_schema: {
        type: "object",
        properties: {
          causa_raiz: {
            type: "string",
            description: "Análise detalhada da causa raiz do problema"
          },
          severidade: {
            type: "string",
            enum: ["baixa", "media", "alta", "critica"],
            description: "Nível de severidade do problema"
          },
          acoes_corretivas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                acao: { type: "string" },
                prioridade: { type: "string" },
                tempo_estimado: { type: "string" }
              }
            },
            description: "Lista de ações corretivas sugeridas"
          },
          padroes_identificados: {
            type: "array",
            items: { type: "string" },
            description: "Padrões ou tendências identificados"
          },
          recomendacao_monitoramento: {
            type: "string",
            description: "Recomendações para melhorar o monitoramento"
          },
          tempo_resolucao_estimado: {
            type: "string",
            description: "Estimativa de tempo para resolução"
          }
        },
        required: ["causa_raiz", "severidade", "acoes_corretivas"]
      }
    });

    console.log('[DIAGNOSE-LLM] ✅ Diagnóstico concluído:', resultado);

    // Salvar diagnóstico na base de conhecimento
    try {
      await base44.asServiceRole.entities.BaseConhecimento.create({
        titulo: `Diagnóstico: ${payload.component} - ${new Date().toISOString()}`,
        tipo_registro: 'resultado_acao',
        categoria: 'inteligencia',
        conteudo: JSON.stringify(resultado, null, 2),
        conteudo_estruturado: resultado,
        tags: ['diagnostico_automatico', 'sre', payload.component],
        relevancia_score: resultado.severidade === 'critica' ? 100 : 
                          resultado.severidade === 'alta' ? 80 :
                          resultado.severidade === 'media' ? 60 : 40,
        origem_ia: {
          motor_gerador: 'diagnoseWithLLM',
          timestamp_geracao: new Date().toISOString(),
          prompt_usado: contexto.substring(0, 500) + '...',
          modelo_llm: 'gpt-4o-mini'
        },
        aprovado: true,
        ativo: true
      });

      console.log('[DIAGNOSE-LLM] 💾 Diagnóstico salvo na base de conhecimento');
    } catch (saveError) {
      console.warn('[DIAGNOSE-LLM] ⚠️ Erro ao salvar na base de conhecimento:', saveError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        diagnosis: resultado,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[DIAGNOSE-LLM] ❌ Erro no diagnóstico:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        diagnosis: {
          causa_raiz: "Erro ao executar diagnóstico com LLM",
          severidade: "alta",
          acoes_corretivas: [{
            acao: "Verificar logs do sistema e tentar novamente",
            prioridade: "alta",
            tempo_estimado: "5 minutos"
          }]
        }
      }),
      { status: 500, headers }
    );
  }
});