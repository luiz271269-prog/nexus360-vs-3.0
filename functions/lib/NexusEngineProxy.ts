/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  NEXUS ENGINE PROXY - Backend Fallback                      ║
 * ║  Classificação básica por palavras-chave quando LLM falha   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export async function classifyIntention(mensagem, contexto = {}) {
  try {
    const mensagemLower = mensagem.toLowerCase().trim();
    
    const keywordsFAQ = ['horário', 'horario', 'endereço', 'endereco', 'telefone', 'contato', 'qual', 'quando', 'onde'];
    const isFAQ = keywordsFAQ.some(kw => mensagemLower.includes(kw));

    const keywordsVendas = ['comprar', 'preço', 'preco', 'quanto custa', 'valor', 'orçamento', 'orcamento', 'produto', 'notebook', 'computador'];
    const isVendas = keywordsVendas.some(kw => mensagemLower.includes(kw));

    const keywordsFinanceiro = ['boleto', 'pagamento', 'parcela', 'nota fiscal', 'nf', 'comprovante', 'fatura', 'cobrança'];
    const isFinanceiro = keywordsFinanceiro.some(kw => mensagemLower.includes(kw));

    const keywordsSuporte = ['problema', 'defeito', 'assistência', 'assistencia', 'conserto', 'reparo', 'quebrou', 'não funciona', 'nao funciona'];
    const isSuporte = keywordsSuporte.some(kw => mensagemLower.includes(kw));

    const keywordsFornecedor = ['fornecedor', 'fornecer', 'vender para vocês', 'parceria', 'distribuidor'];
    const isFornecedor = keywordsFornecedor.some(kw => mensagemLower.includes(kw));

    let intent = 'OUTRO';
    let sector = 'geral';
    let confidence = 0.6;

    if (isFAQ) {
      if (mensagemLower.includes('horário') || mensagemLower.includes('horario')) {
        intent = 'FAQ_HORARIO';
      } else if (mensagemLower.includes('endereço') || mensagemLower.includes('endereco')) {
        intent = 'FAQ_ENDERECO';
      } else if (mensagemLower.includes('telefone') || mensagemLower.includes('contato')) {
        intent = 'FAQ_CONTATO';
      } else {
        intent = 'FAQ_GERAL';
      }
      confidence = 0.85;
      sector = null;
    } else if (isVendas) {
      if (mensagemLower.includes('orçamento') || mensagemLower.includes('orcamento') || mensagemLower.includes('quanto custa')) {
        intent = 'VENDAS_ORCAMENTO';
      } else if (keywordsVendas.slice(7).some(kw => mensagemLower.includes(kw))) {
        intent = 'VENDAS_PRODUTO';
      } else {
        intent = 'VENDAS_GERAL';
      }
      sector = 'vendas';
      confidence = 0.85;
    } else if (isFinanceiro) {
      if (mensagemLower.includes('boleto')) {
        intent = 'FINANCEIRO_BOLETO';
      } else if (mensagemLower.includes('pagamento') || mensagemLower.includes('parcela')) {
        intent = 'FINANCEIRO_PAGAMENTO';
      } else {
        intent = 'FINANCEIRO_GERAL';
      }
      sector = 'financeiro';
      confidence = 0.85;
    } else if (isSuporte) {
      intent = 'SUPORTE_TECNICO';
      sector = 'assistencia';
      confidence = 0.85;
    } else if (isFornecedor) {
      intent = 'FORNECEDOR';
      sector = 'fornecedor';
      confidence = 0.85;
    }

    console.log('[NEXUS PROXY] 🎯 Intent:', intent, `(${Math.round(confidence * 100)}%)`);

    return {
      intent,
      confidence,
      entities: {},
      isFAQ,
      suggestedSector: sector,
      reasoning: 'Classificação baseada em palavras-chave (fallback)'
    };

  } catch (error) {
    console.error('[NEXUS PROXY] ❌ Erro:', error);
    return {
      intent: 'OUTRO',
      confidence: 0,
      entities: {},
      isFAQ: false,
      suggestedSector: 'geral',
      reasoning: 'Erro: ' + error.message
    };
  }
}

export async function queryRAG(pergunta, contexto = {}) {
  try {
    const perguntaLower = pergunta.toLowerCase();
    
    const faqs = {
      'horário': {
        resposta: '🕐 *Horário de Atendimento*\n\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 12h\nDomingo: Fechado',
        confidence: 0.9
      },
      'horario': {
        resposta: '🕐 *Horário de Atendimento*\n\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 12h\nDomingo: Fechado',
        confidence: 0.9
      },
      'endereço': {
        resposta: '📍 *Nosso Endereço*\n\nRua Exemplo, 123\nCentro - São Paulo/SP\nCEP: 01234-567',
        confidence: 0.9
      },
      'endereco': {
        resposta: '📍 *Nosso Endereço*\n\nRua Exemplo, 123\nCentro - São Paulo/SP\nCEP: 01234-567',
        confidence: 0.9
      },
      'telefone': {
        resposta: '📞 *Nossos Contatos*\n\nTelefone: (11) 1234-5678\nWhatsApp: (11) 98765-4321\nEmail: contato@vendapro.com.br',
        confidence: 0.9
      },
      'contato': {
        resposta: '📞 *Nossos Contatos*\n\nTelefone: (11) 1234-5678\nWhatsApp: (11) 98765-4321\nEmail: contato@vendapro.com.br',
        confidence: 0.9
      }
    };

    for (const [chave, dados] of Object.entries(faqs)) {
      if (perguntaLower.includes(chave)) {
        console.log('[NEXUS PROXY] ✅ FAQ encontrado:', chave);
        return {
          resposta: dados.resposta,
          is_confident: true,
          confidence: dados.confidence,
          fonte: 'faq_basica'
        };
      }
    }

    console.log('[NEXUS PROXY] ⚠️ FAQ não encontrado');
    return {
      resposta: null,
      is_confident: false,
      confidence: 0,
      fonte: null
    };

  } catch (error) {
    console.error('[NEXUS PROXY] ❌ Erro RAG:', error);
    return {
      resposta: null,
      is_confident: false,
      confidence: 0,
      fonte: null
    };
  }
}