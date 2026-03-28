import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GERADOR DE SUGESTÕES DE IA PARA DIAGNÓSTICOS               ║
 * ║  Versão: 1.0 - Análise inteligente de falhas               ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Analisa resultados de diagnósticos com falhas e gera sugestões
 * de correção usando IA, identificando causas prováveis e ações
 * corretivas específicas para cada tipo de falha.
 */

Deno.serve(async (req) => {
  console.log('[IA-DIAGNOSTICO] 🤖 Iniciando análise de diagnóstico...');

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
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { diagnostico_execucao_id, diagnostico_data } = await req.json();

    let diagnostico;
    
    // Se passou o ID, buscar do banco
    if (diagnostico_execucao_id) {
      const execucoes = await base44.asServiceRole.entities.DiagnosticoExecucao.filter(
        { id: diagnostico_execucao_id }
      );
      if (execucoes.length === 0) {
        return Response.json(
          { success: false, error: 'Diagnóstico não encontrado' },
          { status: 404, headers: corsHeaders }
        );
      }
      diagnostico = execucoes[0];
    } else if (diagnostico_data) {
      // Se passou os dados diretamente
      diagnostico = diagnostico_data;
    } else {
      return Response.json(
        { success: false, error: 'diagnostico_execucao_id ou diagnostico_data são obrigatórios' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[IA-DIAGNOSTICO] 📊 Analisando diagnóstico:', {
      score: diagnostico.score_total,
      status: diagnostico.status_geral,
      etapas: diagnostico.etapas?.length
    });

    // Coletar todos os testes com problemas
    const testesProblematicos = [];
    
    if (diagnostico.etapas) {
      for (const etapa of diagnostico.etapas) {
        if (etapa.testes) {
          for (const teste of etapa.testes) {
            if (teste.status === 'erro' || teste.status === 'aviso') {
              testesProblematicos.push({
                etapa_numero: etapa.numero,
                etapa_nome: etapa.nome,
                teste_nome: teste.nome,
                status: teste.status,
                critico: teste.critico,
                detalhes: teste.detalhes,
                sugestao_correcao_existente: teste.sugestao_correcao
              });
            }
          }
        }
      }
    }

    console.log('[IA-DIAGNOSTICO] ⚠️ Encontrados', testesProblematicos.length, 'testes com problemas');

    if (testesProblematicos.length === 0) {
      return Response.json(
        {
          success: true,
          message: 'Nenhum teste com problemas encontrado',
          sugestoes: []
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // Preparar contexto para a IA
    const contextoCompleto = {
      score_total: diagnostico.score_total,
      status_geral: diagnostico.status_geral,
      etapa_bloqueada: diagnostico.etapa_bloqueada,
      testes_problematicos: testesProblematicos,
      ambiente: diagnostico.ambiente
    };

    // Chamar IA para análise
    console.log('[IA-DIAGNOSTICO] 🧠 Chamando LLM para análise...');
    
    const prompt = `Você é um especialista em diagnóstico de sistemas de integração WhatsApp e webhooks.

Analise o seguinte relatório de diagnóstico que apresentou falhas:

**Score Total:** ${diagnostico.score_total}%
**Status Geral:** ${diagnostico.status_geral}
${diagnostico.etapa_bloqueada ? `**Etapa Bloqueada:** ${diagnostico.etapa_bloqueada}` : ''}

**Testes com Problemas:**

${testesProblematicos.map((t, idx) => `
${idx + 1}. **Etapa ${t.etapa_numero}: ${t.etapa_nome}**
   - Teste: ${t.teste_nome}
   - Status: ${t.status.toUpperCase()}
   - Crítico: ${t.critico ? 'SIM' : 'NÃO'}
   - Detalhes: ${JSON.stringify(t.detalhes, null, 2)}
   ${t.sugestao_correcao_existente ? `- Sugestão Existente: ${t.sugestao_correcao_existente}` : ''}
`).join('\n')}

Para cada teste problemático, forneça:
1. **Causa Provável**: Identifique a raiz do problema
2. **Ações Corretivas**: Passos específicos e práticos para resolver
3. **Prioridade**: Alta, Média ou Baixa (baseado em criticidade)
4. **Comandos/Código**: Se aplicável, forneça exemplos de código ou comandos

Categorize as causas prováveis em:
- **Configuração**: Parâmetros incorretos, URLs, tokens
- **Conectividade**: Firewall, DNS, timeout, certificado SSL
- **Persistência**: Permissões de banco, schema, transaction locks
- **Processamento**: Lógica de negócio, validação, formato de dados
- **Infraestrutura**: Memória, CPU, disco, rate limits

Seja específico e prático nas sugestões.`;

    const resposta = await base44.integrations.Core.InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          analise_geral: {
            type: "object",
            properties: {
              resumo: { type: "string" },
              impacto: { type: "string" },
              tempo_estimado_correcao: { type: "string" }
            }
          },
          sugestoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                etapa_numero: { type: "number" },
                teste_nome: { type: "string" },
                categoria: { 
                  type: "string",
                  enum: ["Configuração", "Conectividade", "Persistência", "Processamento", "Infraestrutura"]
                },
                causa_provavel: { type: "string" },
                acoes_corretivas: {
                  type: "array",
                  items: { type: "string" }
                },
                prioridade: {
                  type: "string",
                  enum: ["Alta", "Média", "Baixa"]
                },
                codigo_exemplo: { type: "string" },
                referencias: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      }
    });

    console.log('[IA-DIAGNOSTICO] ✅ Análise concluída:', {
      sugestoes_geradas: resposta.sugestoes?.length || 0
    });

    // Retornar sugestões
    return Response.json(
      {
        success: true,
        analise_geral: resposta.analise_geral,
        sugestoes: resposta.sugestoes || [],
        testes_analisados: testesProblematicos.length,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[IA-DIAGNOSTICO] ❌ Erro:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500, headers: corsHeaders }
    );
  }
});