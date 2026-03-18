/**
 * ═══════════════════════════════════════════════════════════
 * ANÁLISE DE SCORE PREDITIVO - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Worker robusto que analisa threads e gera score preditivo
 * de propensão à compra usando LLM.
 * 
 * Melhorias implementadas:
 * - Prompt estruturado e preciso
 * - Validação rigorosa da saída
 * - Fallback inteligente
 * - Logs detalhados para auditoria
 * - Retorno JSON estruturado com próxima ação
 */

import { createClient } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const { thread_id } = await req.json();
    
    console.log(`[SCORE PREDITIVO] 🎯 Analisando thread: ${thread_id}`);
    
    const startTime = Date.now();
    
    // Inicializar Base44
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      Deno.env.get('BASE44_API_KEY')
    );
    
    // 1. Buscar dados da thread
    const thread = await base44.entities.MessageThread.get(thread_id);
    const contact = await base44.entities.Contact.get(thread.contact_id);
    
    // 2. Buscar histórico de mensagens (últimas 50)
    const mensagens = await base44.entities.Message.filter(
      { thread_id },
      '-created_date',
      50
    );
    
    // 3. Buscar cliente associado (se existir)
    let cliente = null;
    if (contact.cliente_id) {
      try {
        cliente = await base44.entities.Cliente.get(contact.cliente_id);
      } catch (error) {
        console.warn(`[SCORE PREDITIVO] Cliente não encontrado: ${contact.cliente_id}`);
      }
    }
    
    // 4. Construir contexto estruturado
    const contexto = construirContexto(thread, contact, mensagens, cliente);
    
    // 5. Gerar score com LLM
    let resultado;
    try {
      resultado = await analisarComLLM(base44, contexto, thread.score_preditivo);
    } catch (error) {
      console.error(`[SCORE PREDITIVO] ❌ Erro no LLM:`, error);
      
      // Fallback: manter score anterior
      resultado = {
        score: thread.score_preditivo || 50,
        next_action: 'aguardar_interacao',
        confidence: 0.3,
        reasoning: 'Erro no LLM - mantido score anterior',
        fallback: true
      };
    }
    
    // 6. Validar e normalizar score
    const scoreValidado = validarScore(resultado.score);
    
    // 7. Atualizar thread no Base44
    await base44.entities.MessageThread.update(thread_id, {
      score_preditivo: scoreValidado,
      ultima_analise_ia: new Date().toISOString(),
      proxima_acao_sugerida: resultado.next_action
    });
    
    // 8. Registrar log detalhado
    const duracao = Date.now() - startTime;
    
    await base44.entities.AutomationLog.create({
      acao: 'atualizar_score_preditivo',
      thread_id,
      contact_id: contact.id,
      resultado: resultado.fallback ? 'falha_llm' : 'sucesso',
      timestamp: new Date().toISOString(),
      origem: 'cron',
      prioridade: scoreValidado >= 80 ? 'alta' : scoreValidado >= 50 ? 'normal' : 'baixa',
      detalhes: {
        score_anterior: thread.score_preditivo || 0,
        score_novo: scoreValidado,
        variacao: scoreValidado - (thread.score_preditivo || 0),
        next_action: resultado.next_action,
        confidence: resultado.confidence,
        reasoning: resultado.reasoning,
        tempo_processamento_ms: duracao,
        fallback_usado: resultado.fallback || false,
        total_mensagens_analisadas: mensagens.length
      }
    });
    
    console.log(`[SCORE PREDITIVO] ✅ Análise concluída em ${duracao}ms`);
    console.log(`[SCORE PREDITIVO] Score: ${scoreValidado} | Ação: ${resultado.next_action}`);
    
    return Response.json({
      success: true,
      score: scoreValidado,
      next_action: resultado.next_action,
      confidence: resultado.confidence,
      duracao_ms: duracao
    });
    
  } catch (error) {
    console.error('[SCORE PREDITIVO] ❌ Erro fatal:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});

/**
 * Constrói contexto estruturado para o LLM
 */
function construirContexto(thread, contact, mensagens, cliente) {
  // Formatar histórico de mensagens
  const historicoFormatado = mensagens
    .slice(0, 20) // Limitar a 20 mais recentes para não estourar contexto
    .reverse()
    .map((msg, idx) => {
      const sender = msg.sender_type === 'contact' ? 'Cliente' : 'Atendente';
      const conteudo = msg.content.substring(0, 200); // Limitar cada mensagem
      return `${idx + 1}. ${sender}: ${conteudo}`;
    })
    .join('\n');
  
  // Informações do contato
  const infoContato = `
- Nome: ${contact.nome || 'Não informado'}
- Telefone: ${contact.telefone}
- Tipo: ${contact.tipo_contato}
- Tags: ${contact.tags?.join(', ') || 'Nenhuma'}
- Última Interação: ${thread.last_message_at ? new Date(thread.last_message_at).toLocaleString('pt-BR') : 'N/A'}
`.trim();
  
  // Informações do cliente (se existir)
  const infoCliente = cliente ? `
- Razão Social: ${cliente.razao_social}
- Segmento: ${cliente.segmento}
- Status: ${cliente.status}
- Classificação: ${cliente.classificacao}
- Vendedor Responsável: ${cliente.vendedor_responsavel}
`.trim() : 'Não é cliente cadastrado';
  
  // Métricas da thread
  const metricas = `
- Total de Mensagens: ${thread.total_mensagens || 0}
- Status: ${thread.status}
- Prioridade Atual: ${thread.prioridade || 'normal'}
- Score Anterior: ${thread.score_preditivo || 'Não calculado'}
- Sentimento Geral: ${thread.sentimento_geral || 'Não analisado'}
`.trim();
  
  return {
    historico: historicoFormatado,
    contato: infoContato,
    cliente: infoCliente,
    metricas
  };
}

/**
 * Analisa contexto com LLM e retorna resultado estruturado
 */
async function analisarComLLM(base44, contexto, scoreAnterior) {
  const prompt = `Você é o **Agente Preditivo do VendaPro**, especializado em análise de propensão à compra em conversas de WhatsApp B2B.

**SUA MISSÃO:**
Analisar o histórico de conversa e calcular a **propensão à compra** deste contato em uma escala de **0 a 100**.

**CONTEXTO DO CONTATO:**
${contexto.contato}

**INFORMAÇÕES DO CLIENTE:**
${contexto.cliente}

**MÉTRICAS DA CONVERSA:**
${contexto.metricas}

**HISTÓRICO DA CONVERSA (últimas 20 mensagens):**
${contexto.historico}

**CRITÉRIOS DE PONTUAÇÃO:**
- **0-20:** Lead frio, sem interesse ou sem resposta
- **21-40:** Interesse inicial, mas muitas objeções
- **41-60:** Interesse moderado, pedindo informações
- **61-80:** Interesse alto, discutindo condições
- **81-100:** Pronto para fechar, pedindo proposta/orçamento

**PRÓXIMAS AÇÕES POSSÍVEIS:**
- \`enviar_proposta\`: Cliente demonstrou interesse, enviar orçamento
- \`agendar_reuniao\`: Cliente quer mais detalhes, agendar call
- \`enviar_catalogo\`: Cliente perguntando sobre produtos
- \`responder_objecao\`: Cliente tem dúvidas ou objeções
- \`aguardar_interacao\`: Aguardar resposta do cliente
- \`escalar_gerente\`: Negociação complexa, escalar para gerente
- \`follow_up_suave\`: Cliente interessado mas não respondeu, fazer follow-up

**IMPORTANTE:**
- Seja rigoroso: scores altos só para clientes realmente prontos
- Considere o histórico completo, não apenas a última mensagem
- Avalie o tom, urgência e clareza das perguntas do cliente
- ${scoreAnterior ? `Score anterior: ${scoreAnterior}. Se mudou muito, explique o porquê.` : ''}

**RETORNE EM JSON ESTRITO:**
{
  "score": 75,
  "next_action": "enviar_proposta",
  "confidence": 0.85,
  "reasoning": "Cliente perguntou sobre preços e condições de pagamento, demonstrando forte interesse. Mencionou prazo de decisão de 1 semana."
}`;

  // Chamar LLM com schema estruturado
  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: false,
    response_json_schema: {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Score de propensão à compra'
        },
        next_action: {
          type: 'string',
          enum: [
            'enviar_proposta',
            'agendar_reuniao',
            'enviar_catalogo',
            'responder_objecao',
            'aguardar_interacao',
            'escalar_gerente',
            'follow_up_suave'
          ],
          description: 'Próxima melhor ação a tomar'
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confiança na análise (0 a 1)'
        },
        reasoning: {
          type: 'string',
          description: 'Justificativa detalhada da pontuação'
        }
      },
      required: ['score', 'next_action', 'confidence', 'reasoning']
    }
  });
  
  return resposta;
}

/**
 * Valida e normaliza o score
 */
function validarScore(score) {
  // Garantir que é número
  const numScore = typeof score === 'number' ? score : parseInt(score, 10);
  
  // Verificar se é válido
  if (isNaN(numScore)) {
    console.warn(`[SCORE PREDITIVO] Score inválido: ${score}, usando 50`);
    return 50;
  }
  
  // Clamp entre 0 e 100
  return Math.min(Math.max(numScore, 0), 100);
}