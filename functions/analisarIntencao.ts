import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * 🧠 ANÁLISE INTELIGENTE DE INTENÇÃO
 * 
 * Analisa a primeira mensagem do cliente para detectar:
 * - Setor de destino (vendas, assistencia, financeiro, fornecedor, geral)
 * - Solicitação de atendente específico
 * - Confiança na detecção (0-100%)
 * - Contexto adicional (urgência, sentimento)
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

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401, headers });
    }

    const { mensagem, contexto = {} } = await req.json();

    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim() === '') {
      return Response.json({
        error: 'Mensagem inválida',
        details: 'Campo "mensagem" é obrigatório e deve ser texto'
      }, { status: 400, headers });
    }

    console.log('[analisarIntencao] 🧠 Analisando mensagem:', mensagem.substring(0, 100));

    // 📋 Prompt ATUALIZADO com detecção de solicitação de atendente
    const prompt = `Você é um assistente de classificação de mensagens para um sistema de atendimento ao cliente.

SETORES DISPONÍVEIS:
1. **vendas** - Interesse em comprar, orçamento, produto, preço, demonstração
2. **assistencia** - Problemas técnicos, defeitos, conserto, manutenção, reclamação de produto
3. **financeiro** - Pagamento, boleto, 2ª via, fatura, cobrança, débito
4. **fornecedor** - Parceria, fornecimento, ser fornecedor, vender para empresa
5. **geral** - Dúvidas gerais, informações, horários, não se encaixa nos outros
6. **solicitacao_atendente** - Cliente pede nome do atendente ou solicita falar com atendente específico

MENSAGEM DO CLIENTE:
"${mensagem}"

${contexto.historico_anterior ? `\nHISTÓRICO: Cliente já foi atendido no setor "${contexto.historico_anterior}"` : ''}
${contexto.atendente_anterior ? `\nATENDENTE ANTERIOR: ${contexto.atendente_anterior}` : ''}

REGRAS ESPECIAIS:
1. Se o cliente perguntar "qual o nome do atendente?", "quem está me atendendo?", "quem é você?" → setor: "solicitacao_atendente"
2. Se o cliente pedir "posso falar com a Joana?", "me passa o João", "quero falar com a Maria" → setor: "solicitacao_atendente" E extraia o nome
3. Se detectar solicitação de atendente específico, extrair o nome mencionado

ANÁLISE:
Analise a mensagem e retorne JSON com:
- setor: um dos 6 setores acima
- confianca: número de 0 a 100 (quanto mais claro o setor, maior)
- urgencia: "baixa", "media", "alta", "critica"
- sentimento: "positivo", "neutro", "negativo", "frustrado"
- explicacao: breve explicação da escolha (1 linha)
- nome_atendente_solicitado: nome do atendente se mencionado, ou null
- solicita_qualquer_atendente: true se pede qualquer atendente, false se pede específico

EXEMPLOS:
Mensagem: "Qual o nome do atendente?"
→ { "setor": "solicitacao_atendente", "confianca": 95, "urgencia": "baixa", "sentimento": "neutro", "explicacao": "Cliente perguntando nome do atendente", "nome_atendente_solicitado": null, "solicita_qualquer_atendente": true }

Mensagem: "Posso falar com a Joana?"
→ { "setor": "solicitacao_atendente", "confianca": 98, "urgencia": "media", "sentimento": "positivo", "explicacao": "Cliente solicitando atendente específica", "nome_atendente_solicitado": "Joana", "solicita_qualquer_atendente": false }

Mensagem: "Quero fazer um orçamento"
→ { "setor": "vendas", "confianca": 95, "urgencia": "media", "sentimento": "positivo", "explicacao": "Cliente interessado em comprar", "nome_atendente_solicitado": null, "solicita_qualquer_atendente": false }

Mensagem: "Meu produto veio quebrado"
→ { "setor": "assistencia", "confianca": 90, "urgencia": "alta", "sentimento": "frustrado", "explicacao": "Problema com produto recebido", "nome_atendente_solicitado": null, "solicita_qualquer_atendente": false }

Agora analise a mensagem do cliente e retorne apenas o JSON.`;

    // 🤖 Chamar LLM com tratamento robusto de erro
    let resultado;
    try {
      const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            setor: {
              type: "string",
              enum: ["vendas", "assistencia", "financeiro", "fornecedor", "geral", "solicitacao_atendente"]
            },
            confianca: {
              type: "number",
              minimum: 0,
              maximum: 100
            },
            urgencia: {
              type: "string",
              enum: ["baixa", "media", "alta", "critica"]
            },
            sentimento: {
              type: "string",
              enum: ["positivo", "neutro", "negativo", "frustrado"]
            },
            explicacao: {
              type: "string"
            },
            nome_atendente_solicitado: {
              type: ["string", "null"]
            },
            solicita_qualquer_atendente: {
              type: "boolean"
            }
          },
          required: ["setor", "confianca", "urgencia", "sentimento", "explicacao", "solicita_qualquer_atendente"]
        }
      });

      // Normalizar resposta (pode vir em wrapper diferente)
      if (typeof llmResponse === 'string') {
        resultado = JSON.parse(llmResponse);
      } else if (llmResponse.output) {
        resultado = typeof llmResponse.output === 'string' ? JSON.parse(llmResponse.output) : llmResponse.output;
      } else {
        resultado = llmResponse;
      }

      console.log('[analisarIntencao] ✅ Resultado da IA normalizado:', resultado);
    } catch (parseError) {
      console.error('[analisarIntencao] ❌ Erro ao parsear resposta da IA:', parseError);
      resultado = null;
    }

    // Validação robusta com fallback inteligente (nunca bloqueia URA)
    if (!resultado || !resultado.setor || typeof resultado.confianca !== 'number') {
      console.warn('[analisarIntencao] ⚠️ IA retornou resultado inválido ou incompleto. Usando fallback.');
      return Response.json({
        setor: 'geral',
        confianca: 25,
        urgencia: 'media',
        sentimento: 'neutro',
        explicacao: 'Classificação IA falhou. Usando URA padrão.',
        nome_atendente_solicitado: null,
        solicita_qualquer_atendente: false,
        fallback: true,
        deve_iniciar_ura: true
      }, { headers });
    }

    // 📊 Ajustar confiança com base no contexto
    let confiancaFinal = resultado.confianca;

    // Se o cliente já foi atendido no mesmo setor, aumentar confiança
    if (contexto.historico_anterior === resultado.setor && resultado.setor !== 'solicitacao_atendente') {
      confiancaFinal = Math.min(100, confiancaFinal + 10);
      console.log('[analisarIntencao] 📈 Confiança aumentada por histórico:', confiancaFinal);
    }

    // Se a mensagem for muito curta (< 10 caracteres), reduzir confiança
    if (mensagem.trim().length < 10 && resultado.setor !== 'solicitacao_atendente') {
      confiancaFinal = Math.max(20, confiancaFinal - 20);
      console.log('[analisarIntencao] 📉 Confiança reduzida por mensagem curta:', confiancaFinal);
    }

    // 🎯 Se detectou solicitação de atendente com alta confiança, registrar log
    if (resultado.setor === 'solicitacao_atendente' && confiancaFinal >= 80) {
      console.log('[analisarIntencao] 🎯 SOLICITAÇÃO DE ATENDENTE DETECTADA!');
      console.log('[analisarIntencao] 👤 Nome solicitado:', resultado.nome_atendente_solicitado || 'Qualquer atendente');
      
      // 📝 Registrar no AutomationLog
      try {
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'solicitacao_atendente_detectada',
          contato_id: contexto.contact_id || null,
          thread_id: contexto.thread_id || null,
          resultado: 'sucesso',
          timestamp: new Date().toISOString(),
          detalhes: {
            mensagem: mensagem,
            nome_solicitado: resultado.nome_atendente_solicitado,
            solicita_qualquer: resultado.solicita_qualquer_atendente,
            confianca: confiancaFinal
          },
          origem: 'ia',
          prioridade: 'alta'
        });
      } catch (logError) {
        console.error('[analisarIntencao] ⚠️ Erro ao registrar log:', logError);
      }
    }

    // ✅ Retornar análise completa com hint de URA
    const analiseCompleta = {
      setor: resultado.setor,
      confianca: confiancaFinal,
      urgencia: resultado.urgencia,
      sentimento: resultado.sentimento,
      explicacao: resultado.explicacao,
      nome_atendente_solicitado: resultado.nome_atendente_solicitado || null,
      solicita_qualquer_atendente: resultado.solicita_qualquer_atendente,
      deve_transferir_automaticamente: resultado.setor === 'solicitacao_atendente' && confiancaFinal >= 80,
      deve_iniciar_ura: true, // IA nunca bloqueia URA, sempre sugere iniciar
      setor_sugerido: confiancaFinal >= 70 ? resultado.setor : null, // Pré-seleção se alta confiança
      timestamp: new Date().toISOString()
    };

    console.log('[analisarIntencao] 📊 Análise completa:', analiseCompleta);

    return Response.json({
      success: true,
      analise: analiseCompleta
    }, { headers });

  } catch (error) {
    console.error('[analisarIntencao] ❌ Erro:', error);
    return Response.json({
      error: 'Erro ao analisar intenção',
      details: error.message,
      stack: error.stack
    }, { status: 500, headers });
  }
});