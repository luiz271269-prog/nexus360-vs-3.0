import { InvokeLLM } from "@/integrations/Core";
import { Cliente } from "@/entities/Cliente";
import { Interacao } from "@/entities/Interacao";
import { Orcamento } from "@/entities/Orcamento";

/**
 * ═══════════════════════════════════════════════════════════
 * MOTOR DE HIPER-PERSONALIZAÇÃO - ESTUDO 2
 * ═══════════════════════════════════════════════════════════
 * 
 * Identifica o perfil comportamental do cliente em tempo real
 * e adapta a comunicação automaticamente.
 * 
 * Perfis Identificados:
 * - Analítico: Quer dados, números, especificações técnicas
 * - Relacional: Quer relacionamento, confiança, histórias de sucesso
 * - Pragmático: Quer solução rápida, direto ao ponto
 * - Criativo: Quer inovação, diferenciais, visão de futuro
 */

class MotorHiperPersonalizacao {
  constructor() {
    this.cachePerfisPorCliente = new Map();
  }

  /**
   * Identifica o perfil comportamental do cliente
   */
  async identificarPerfil(clienteId) {
    // Verificar cache
    if (this.cachePerfisPorCliente.has(clienteId)) {
      console.log('💾 [Hiper-Personalização] Perfil em cache');
      return this.cachePerfisPorCliente.get(clienteId);
    }

    console.log('🔍 [Hiper-Personalização] Analisando perfil do cliente:', clienteId);

    try {
      // ═══════════════════════════════════════════════════════════
      // COLETAR DADOS DO CLIENTE
      // ═══════════════════════════════════════════════════════════
      const [cliente, interacoes, orcamentos] = await Promise.all([
        Cliente.filter({ id: clienteId }),
        Interacao.filter({ cliente_id: clienteId }),
        Orcamento.filter({ cliente_id: clienteId })
      ]);

      const clienteData = cliente[0];
      if (!clienteData) {
        throw new Error('Cliente não encontrado');
      }

      // ═══════════════════════════════════════════════════════════
      // ANÁLISE DE PERFIL COM IA
      // ═══════════════════════════════════════════════════════════
      const prompt = `Analise o perfil comportamental deste cliente B2B:

**DADOS DO CLIENTE:**
- Empresa: ${clienteData.razao_social}
- Segmento: ${clienteData.segmento}
- Classificação: ${clienteData.classificacao}
- Total de Interações: ${interacoes.length}
- Total de Orçamentos: ${orcamentos.length}

**HISTÓRICO DE INTERAÇÕES (últimas 5):**
${interacoes.slice(0, 5).map(i => `- ${i.tipo_interacao}: ${i.observacoes}`).join('\n')}

**PADRÕES DE COMPRA:**
- Valor médio de orçamentos: R$ ${orcamentos.reduce((sum, o) => sum + o.valor_total, 0) / orcamentos.length || 0}
- Tempo médio de decisão: ${this.calcularTempoMedioDecisao(orcamentos)} dias

Identifique o perfil comportamental predominante e sugira abordagens de comunicação.`;

      const perfil = await InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            tipo_perfil: {
              type: "string",
              enum: ["analitico", "relacional", "pragmatico", "criativo"]
            },
            confianca: {
              type: "number",
              description: "Confiança na identificação (0-100)"
            },
            caracteristicas: {
              type: "array",
              items: { type: "string" },
              description: "Características comportamentais identificadas"
            },
            abordagens_recomendadas: {
              type: "array",
              items: { type: "string" },
              description: "Como se comunicar com este perfil"
            },
            gatilhos_decisao: {
              type: "array",
              items: { type: "string" },
              description: "O que influencia a decisão de compra"
            },
            palavras_chave: {
              type: "array",
              items: { type: "string" },
              description: "Palavras e termos que ressoam com este perfil"
            }
          }
        }
      });

      // Armazenar em cache
      this.cachePerfisPorCliente.set(clienteId, perfil);

      console.log('✅ [Hiper-Personalização] Perfil identificado:', perfil.tipo_perfil);
      return perfil;

    } catch (error) {
      console.error('❌ [Hiper-Personalização] Erro ao identificar perfil:', error);
      return null;
    }
  }

  /**
   * Adapta uma mensagem genérica para o perfil do cliente
   */
  async personalizarMensagem(mensagemGenerica, clienteId) {
    const perfil = await this.identificarPerfil(clienteId);
    
    if (!perfil) {
      return mensagemGenerica; // Fallback
    }

    console.log('✏️ [Hiper-Personalização] Personalizando mensagem para perfil:', perfil.tipo_perfil);

    const prompt = `Reescreva a seguinte mensagem para se adequar ao perfil comportamental do cliente:

**MENSAGEM ORIGINAL:**
${mensagemGenerica}

**PERFIL DO CLIENTE:**
- Tipo: ${perfil.tipo_perfil}
- Características: ${perfil.caracteristicas.join(', ')}
- Palavras-chave que ressoam: ${perfil.palavras_chave.join(', ')}
- Gatilhos de decisão: ${perfil.gatilhos_decisao.join(', ')}

**DIRETRIZES:**
- Mantenha o objetivo da mensagem original
- Adapte o tom, estrutura e vocabulário para o perfil
- Use as palavras-chave e gatilhos identificados
- Seja natural e autêntico

Retorne APENAS a mensagem personalizada, sem explicações.`;

    const mensagemPersonalizada = await InvokeLLM({
      prompt: prompt
    });

    return mensagemPersonalizada;
  }

  /**
   * Sugere próxima melhor ação baseada no perfil
   */
  async sugerirProximaAcao(clienteId, contexto = {}) {
    const perfil = await this.identificarPerfil(clienteId);
    
    if (!perfil) {
      return null;
    }

    const prompt = `Com base no perfil comportamental do cliente, sugira a próxima melhor ação de vendas:

**PERFIL DO CLIENTE:**
${JSON.stringify(perfil, null, 2)}

**CONTEXTO ATUAL:**
${JSON.stringify(contexto, null, 2)}

Sugira a ação mais eficaz para este perfil específico.`;

    const sugestao = await InvokeLLM({
      prompt: prompt,
      response_json_schema: {
        type: "object",
        properties: {
          acao_sugerida: { type: "string" },
          justificativa: { type: "string" },
          script_sugerido: { type: "string" },
          timing_recomendado: { type: "string" }
        }
      }
    });

    return sugestao;
  }

  /**
   * Calcula tempo médio de decisão do cliente
   */
  calcularTempoMedioDecisao(orcamentos) {
    if (orcamentos.length === 0) return 0;

    const tempos = orcamentos
      .filter(o => o.status === 'aprovado' && o.data_orcamento)
      .map(o => {
        const dataOrc = new Date(o.data_orcamento);
        const dataAprov = new Date(o.updated_date);
        return Math.floor((dataAprov - dataOrc) / (1000 * 60 * 60 * 24));
      });

    if (tempos.length === 0) return 0;

    return Math.round(tempos.reduce((sum, t) => sum + t, 0) / tempos.length);
  }

  /**
   * Limpa o cache de perfis (útil para forçar re-análise)
   */
  limparCache(clienteId = null) {
    if (clienteId) {
      this.cachePerfisPorCliente.delete(clienteId);
    } else {
      this.cachePerfisPorCliente.clear();
    }
  }
}

export default new MotorHiperPersonalizacao();