/**
 * MotorHookCriativoEngajamento
 * 
 * Gera mensagens "hook" que quebram padrão e ativam resposta
 * Independente do conteúdo (promoção, cotação, follow-up)
 * 
 * Estratégia: Psicologia da persuasão + personalização por perfil
 */

export const hookTemplates = {
  // ══════════════════════════════════════════════════════════════
  // HOOK 1: CURIOSIDADE + SCARCITY (funciona com qualquer tipo)
  // ══════════════════════════════════════════════════════════════
  curiosidade_scarcity: {
    nome: '🔍 Curiosidade + Escassez',
    descricao: 'Desperta curiosidade + cria sensação de oportunidade limitada',
    templates: [
      {
        opener: '⏰ Achei algo que você pediu há {dias} atrás...',
        hook: 'mas só conseguimos 2 unidades por esse preço.',
        closer: 'Vale a pena a gente conversar agora?'
      },
      {
        opener: '📌 Encontrei uma solução para o item que você consultou',
        hook: 'Tem estoque limitado essa semana.',
        closer: 'Quer que eu reserve pra você?'
      },
      {
        opener: '🎯 Exatamente o que você perguntou...',
        hook: 'vou estar indisponível na próxima segunda.',
        closer: 'Posso confirmar até amanhã?'
      }
    ],
    applicableTo: ['cotacao_generia', 'follow_up_pendente', 'item_recorrente'],
    psychologyPrinciples: ['curiosidade', 'urgência', 'escassez']
  },

  // ══════════════════════════════════════════════════════════════
  // HOOK 2: RECIPROCIDADE + VALOR (muito eficaz com corporativos)
  // ══════════════════════════════════════════════════════════════
  reciprocidade_valor: {
    nome: '🎁 Reciprocidade + Valor',
    descricao: 'Oferece algo útil ANTES de pedir; gera obrigação social',
    templates: [
      {
        opener: 'Encontrei uma comparação de preços do mercado...',
        hook: '(incluindo seus concorrentes favoritos)',
        closer: 'Quer que eu te mande pra você analisar? Depois conversamos.'
      },
      {
        opener: '📊 Fiz uma análise do seu histórico de compras conosco',
        hook: 'dá pra economizar ~{percentual}% mudando a frequência',
        closer: 'Te envio o detalhe? Aí discutimos.'
      },
      {
        opener: 'Criei um benchmark dos preços atuais do mercado',
        hook: '(sua categoria de produtos)',
        closer: 'Qual você quer receber primeiro?'
      }
    ],
    applicableTo: ['negociacao_stalled', 'cliente_fidelizado', 'price_sensitive'],
    psychologyPrinciples: ['reciprocidade', 'credibilidade', 'valor']
  },

  // ══════════════════════════════════════════════════════════════
  // HOOK 3: AUTORIDADE + PROVA SOCIAL (para indecisos)
  // ══════════════════════════════════════════════════════════════
  autoridade_prova_social: {
    nome: '⭐ Autoridade + Prova Social',
    descricao: 'Usa casos similares/expertise; reduz risco percebido',
    templates: [
      {
        opener: '{num_empresas} empresas no seu ramo já fazem isso conosco',
        hook: 'e conseguiram reduzir custo de {area}',
        closer: 'Você quer saber como eles conseguiram?'
      },
      {
        opener: '✅ A empresa {empresa_similar} lidou com exatamente esse desafio',
        hook: 'e aqui está o que funcionou pra eles',
        closer: 'Te interessa o case?'
      },
      {
        opener: 'Nosso time tem {anos} anos nessa solução específica',
        hook: 'já resolvemos {casos_similares} casos parecidos',
        closer: 'Qual foi o seu maior bloqueio até agora?'
      }
    ],
    applicableTo: ['lead_frio', 'desqualificado_anterior', 'novo_segmento'],
    psychologyPrinciples: ['autoridade', 'prova_social', 'redução_risco']
  },

  // ══════════════════════════════════════════════════════════════
  // HOOK 4: CONTRASTE + PROVOCAÇÃO (para comprador agressivo)
  // ══════════════════════════════════════════════════════════════
  contraste_provocacao: {
    nome: '⚡ Contraste + Provocação',
    descricao: 'Desafia status quo; gera debate/defesa (alta engajamento)',
    templates: [
      {
        opener: 'Aviso: você provavelmente está pagando {valor_a_mais} desnecessariamente',
        hook: 'em {categoria} todo mês',
        closer: 'Quer conferir se é verdade?'
      },
      {
        opener: '🚨 Achei um buraco no seu processo de compra',
        hook: '(e seus concorrentes já exploram isso)',
        closer: 'Deixa eu te mostrar?'
      },
      {
        opener: 'Você está fazendo o oposto do que a maioria no seu ramo faz',
        hook: '(e custos vão ficar maiores daqui pra frente)',
        closer: 'Quer entender por quê?'
      }
    ],
    applicableTo: ['comprador_agressivo', 'price_sensitive', 'processo_formal'],
    psychologyPrinciples: ['contraste', 'reatividade', 'debate']
  },

  // ══════════════════════════════════════════════════════════════
  // HOOK 5: PERSONALIZAÇÃO EXTREMA (para relacionamento frágil)
  // ══════════════════════════════════════════════════════════════
  personalizacao_extrema: {
    nome: '👤 Personalização Extrema',
    descricao: 'Mostra que você estudou; reduz defesa emocional',
    templates: [
      {
        opener: 'Você mencionou que {detalhe_extraído_conversa}',
        hook: 'achei uma solução específica pra isso',
        closer: 'Pode ser interessante?'
      },
      {
        opener: 'Anotei que você prioriza {critério}',
        hook: 'aí preparei uma cotação que bate exatamente em {3_pontos_críticos}',
        closer: 'Olha aí antes de eu enviar pro resto do time?'
      },
      {
        opener: 'Você e eu conversamos {data} sobre {tema}',
        hook: 'pois bem, achei a resposta pro impasse que você apontou',
        closer: 'Avalia comigo?'
      }
    ],
    applicableTo: ['relacionamento_frágil', 'risco_churn', 'negociacao_tensa'],
    psychologyPrinciples: ['atenção', 'respeito', 'reconhecimento']
  }
};

/**
 * Função: Selecionar melhor hook para contato
 * Input: análise (scores, profile, stage, relationship_risk)
 * Output: hook template + variáveis preenchidas
 */
export function selecionarHook(analise) {
  const { relationship_profile, scores, stage, relationship_risk, root_causes } = analise;

  let selectedHook = null;
  let score = 0;

  // Regra 1: Relacionamento frágil → Personalização extrema
  if (relationship_risk?.level === 'high' || relationship_risk?.level === 'critical') {
    return {
      hook: hookTemplates.personalizacao_extrema,
      rationale: 'Risco relacional alto → precisa restaurar confiança',
      priority: 'CRÍTICA'
    };
  }

  // Regra 2: Price sensitive + processo formal → Contraste/provocação
  if (
    relationship_profile?.flags?.includes('price_sensitive') &&
    relationship_profile?.flags?.includes('process_formal')
  ) {
    return {
      hook: hookTemplates.contraste_provocacao,
      rationale: 'Comprador agressivo; responde a desafios',
      priority: 'ALTA'
    };
  }

  // Regra 3: Deal risk < 50 + engagement < 40 → Autoridade + prova social
  if (scores?.deal_risk < 50 && scores?.engagement < 40) {
    return {
      hook: hookTemplates.autoridade_prova_social,
      rationale: 'Lead frio/indecrso; precisa de credibilidade',
      priority: 'ALTA'
    };
  }

  // Regra 4: Cliente fidelizado + stalled → Reciprocidade + valor
  if (relationship_profile?.type === 'cliente_fidelizado' && stage?.current === 'negociacao_stalled') {
    return {
      hook: hookTemplates.reciprocidade_valor,
      rationale: 'Cliente bom mas travado; vale oferecer valor primeiro',
      priority: 'MÉDIA'
    };
  }

  // Regra 5: Default → Curiosidade + escassez
  return {
    hook: hookTemplates.curiosidade_scarcity,
    rationale: 'Hook universal; funciona em qualquer contexto',
    priority: 'MÉDIA'
  };
}

/**
 * Função: Preencher template com dados do contato
 */
export function preencherHook(template, contexto) {
  const {
    contato_nome,
    dias_desde_ultima_msg,
    empresa,
    categoria_produto,
    economia_potencial,
    ultima_conversa_tema,
    ultima_conversa_data
  } = contexto;

  let opener = template.opener;
  let hook = template.hook;
  let closer = template.closer;

  // Substituições genéricas
  opener = opener
    .replace('{dias}', dias_desde_ultima_msg)
    .replace('{num_empresas}', '3-5')
    .replace('{empresa_similar}', empresa || 'CompanyX')
    .replace('{categoria}', categoria_produto || 'sua categoria')
    .replace('{detalhe_extraído_conversa}', ultima_conversa_tema || 'isso')
    .replace('{data}', ultima_conversa_data || 'semana passada')
    .replace('{tema}', ultima_conversa_tema || 'o tema');

  hook = hook
    .replace('{percentual}', economia_potencial || '15-20')
    .replace('{valor_a_mais}', economia_potencial || '15%')
    .replace('{area}', categoria_produto || 'operacional')
    .replace('{3_pontos_críticos}', 'preço, prazo e qualidade');

  return { opener, hook, closer };
}

/**
 * Função: Gerar mensagem final com hook
 * Combina: hook criativo + conteúdo específico
 */
export function gerarMensagemComHook(hookSelecionado, conteudoEspecifico, contexto) {
  const template = hookSelecionado.hook.templates[0];
  const preenchido = preencherHook(template, contexto);

  return {
    // ESTRUTURA 3-PARTES
    hook: {
      opener: preenchido.opener,
      psychological_principle: hookSelecionado.hook.psychologyPrinciples
    },
    content: conteudoEspecifico, // Promoção, cotação, etc
    cta: {
      message: preenchido.closer,
      button_text: 'Sim, vou conferir' // ou 'Avalia comigo' dependendo contexto
    },
    
    // METADADOS
    metadata: {
      hook_type: hookSelecionado.hook.nome,
      hook_rationale: hookSelecionado.rationale,
      hook_priority: hookSelecionado.priority,
      ab_test_variant: `hook_${hookSelecionado.hook.nome.toLowerCase().replace(/\s+/g, '_')}`,
      timestamp_generated: new Date().toISOString()
    }
  };
}

/**
 * Export para uso em funções Deno
 */
export default {
  hookTemplates,
  selecionarHook,
  preencherHook,
  gerarMensagemComHook
};