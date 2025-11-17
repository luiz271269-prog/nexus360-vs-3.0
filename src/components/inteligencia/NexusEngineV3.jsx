import { base44 } from '@/api/base44Client';

/**
 * NexusEngine V3 - Motor de IA para Respostas Inteligentes
 * VERSÃO ULTRA-OTIMIZADA - Mínimo de chamadas à API
 */

// Cache global para Base de Conhecimento com TTL longo
let cacheBaseConhecimento = {
  dados: null,
  timestamp: null,
  TTL: 10 * 60 * 1000 // 10 minutos (aumentado de 5 para 10)
};

const NexusEngineV3 = {
  
  /**
   * Gerar resposta inteligente com contexto
   * SIMPLIFICADO para reduzir rate limit
   */
  async gerarResposta(mensagemCliente, contexto = {}) {
    try {
      console.log('[NEXUS] 🧠 Gerando resposta para:', mensagemCliente.substring(0, 50));

      const { historicoMensagens = [] } = contexto;

      // Construir contexto da conversa (últimas 3 mensagens apenas)
      const historicoLimitado = historicoMensagens.slice(-3);
      const historicoTexto = historicoLimitado
        .map(m => `${m.sender_type === 'user' ? 'Atendente' : 'Cliente'}: ${m.content}`)
        .join('\n');

      // Montar contexto SIMPLES para LLM (SEM buscar Base de Conhecimento)
      const contextoBase = `Você é um assistente de atendimento profissional.

${historicoTexto ? `HISTÓRICO:\n${historicoTexto}\n\n` : ''}MENSAGEM DO CLIENTE:
${mensagemCliente}

Gere uma resposta profissional, clara e objetiva.`;

      // Chamar LLM direto (sem contexto da internet ou base de conhecimento)
      const respostaLLM = await base44.integrations.Core.InvokeLLM({
        prompt: contextoBase,
        add_context_from_internet: false
      });

      return {
        resposta: respostaLLM,
        confianca: 0.7,
        fonte: 'llm'
      };

    } catch (error) {
      console.error('[NEXUS] ❌ Erro ao gerar resposta:', error);
      
      // Fallback imediato
      return {
        resposta: 'Obrigado pela sua mensagem. Um de nossos atendentes irá responder em breve.',
        confianca: 0.3,
        fonte: 'fallback',
        erro: error.message
      };
    }
  },

  /**
   * Consultar Base de Conhecimento COM CACHE LONGO
   * NOTA: Esta função NÃO é mais chamada no fluxo principal para evitar rate limit
   */
  async consultarBaseConhecimentoComCache() {
    const agora = Date.now();

    // Verificar cache
    if (
      cacheBaseConhecimento.dados && 
      cacheBaseConhecimento.timestamp &&
      (agora - cacheBaseConhecimento.timestamp) < cacheBaseConhecimento.TTL
    ) {
      console.log('[NEXUS] 📦 Usando Base de Conhecimento do cache');
      return cacheBaseConhecimento.dados;
    }

    // Buscar novos dados
    try {
      console.log('[NEXUS] 🔍 Buscando Base de Conhecimento...');
      
      const docs = await base44.entities.BaseConhecimento.filter({
        ativo: true
      }, '-relevancia_score', 5); // Reduzido de 10 para 5

      const dadosFormatados = docs.map(doc => ({
        titulo: doc.titulo,
        conteudo: doc.conteudo.substring(0, 300), // Limitar tamanho
        relevancia: doc.relevancia_score || 50
      }));

      // Atualizar cache
      cacheBaseConhecimento.dados = dadosFormatados;
      cacheBaseConhecimento.timestamp = agora;

      console.log('[NEXUS] ✅ Base de Conhecimento atualizada:', dadosFormatados.length, 'docs');
      
      return dadosFormatados;

    } catch (error) {
      console.error('[NEXUS] ⚠️ Erro ao consultar Base de Conhecimento:', error);
      // Retornar cache antigo se houver erro
      return cacheBaseConhecimento.dados || [];
    }
  }
};

export default NexusEngineV3;