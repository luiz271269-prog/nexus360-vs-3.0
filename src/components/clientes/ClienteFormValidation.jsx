/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  VALIDAÇÃO DE DADOS POR ETAPA DO FUNIL DE LEADS              ║
 * ║  Define campos obrigatórios e validações por status          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export const REGRAS_VALIDACAO_POR_ETAPA = {
  novo_lead: {
    camposObrigatorios: ['razao_social', 'vendedor_responsavel'],
    camposDestacados: ['razao_social', 'vendedor_responsavel', 'telefone', 'email'],
    mensagemEtapa: '🆕 Novo Lead - Registre o contato inicial e identifique a empresa',
    descricaoEtapa: 'Primeira entrada de dados no sistema. Registre a empresa e atribua um vendedor responsável.'
  },
  
  primeiro_contato: {
    camposObrigatorios: ['razao_social', 'vendedor_responsavel', 'telefone'],
    camposDestacados: ['telefone', 'email', 'contato_principal_nome'],
    mensagemEtapa: '📞 Primeiro Contato - Estabeleça comunicação e confirme os dados de contato',
    descricaoEtapa: 'Confirme o telefone principal e e-mail. Identifique a pessoa de contato na empresa.',
    validacaoCustomizada: (formData) => {
      if (!formData.telefone || formData.telefone.trim().length < 8) {
        return 'Informe um telefone válido (mínimo 8 dígitos)';
      }
      return null;
    }
  },
  
  em_conversa: {
    camposObrigatorios: ['razao_social', 'vendedor_responsavel', 'telefone', 'email', 'contato_principal_nome'],
    camposDestacados: ['email', 'contato_principal_nome', 'contato_principal_cargo'],
    mensagemEtapa: '💬 Em Conversa - Aprofunde o diálogo e identifique o decisor',
    descricaoEtapa: 'Confirme o e-mail e identifique o nome completo e cargo do contato principal. Entenda as dores iniciais.',
    validacaoCustomizada: (formData) => {
      if (!formData.email || !formData.email.includes('@')) {
        return 'Informe um e-mail válido';
      }
      if (!formData.contato_principal_nome || formData.contato_principal_nome.trim().length < 3) {
        return 'Informe o nome completo do contato principal';
      }
      return null;
    }
  },
  
  levantamento_dados: {
    camposObrigatorios: [
      'razao_social', 
      'vendedor_responsavel', 
      'telefone', 
      'email',
      'contato_principal_nome',
      'numero_maquinas',
      'numero_funcionarios',
      'interesses_produtos'
    ],
    camposDestacados: [
      'numero_maquinas', 
      'numero_funcionarios', 
      'interesses_produtos',
      'segmento',
      'valor_recorrente_mensal'
    ],
    mensagemEtapa: '📋 Levantamento de Dados - Colete informações operacionais e de necessidade',
    descricaoEtapa: 'Pergunte sobre infraestrutura (máquinas, funcionários), processos internos e objetivos. Identifique oportunidades para seus produtos/serviços.',
    validacaoCustomizada: (formData) => {
      if (!formData.interesses_produtos || formData.interesses_produtos.length === 0) {
        return 'Adicione pelo menos um produto/serviço de interesse';
      }
      if (!formData.numero_funcionarios || formData.numero_funcionarios <= 0) {
        return 'Informe o número de funcionários da empresa';
      }
      if (formData.numero_maquinas === null || formData.numero_maquinas === undefined || formData.numero_maquinas < 0) {
        return 'Informe o número de máquinas/equipamentos (pode ser 0)';
      }
      return null;
    }
  },
  
  pre_qualificado: {
    camposObrigatorios: [
      'razao_social',
      'vendedor_responsavel',
      'telefone',
      'email',
      'contato_principal_nome',
      'numero_maquinas',
      'numero_funcionarios',
      'interesses_produtos',
      'classificacao'
    ],
    camposDestacados: ['classificacao', 'segmento', 'valor_recorrente_mensal'],
    mensagemEtapa: '✅ Pré-Qualificado - Defina o potencial e o segmento do lead',
    descricaoEtapa: 'Analise os dados coletados e classifique o lead (A, B ou C). Valide o fit com seu perfil de cliente ideal.',
    validacaoCustomizada: (formData) => {
      if (!formData.classificacao) {
        return 'Defina a classificação do lead (A, B ou C)';
      }
      return null;
    }
  },
  
  qualificacao_tecnica: {
    camposObrigatorios: [
      'razao_social',
      'vendedor_responsavel',
      'telefone',
      'email',
      'contato_principal_nome',
      'numero_maquinas',
      'numero_funcionarios',
      'interesses_produtos',
      'classificacao',
      'necessidade_verificada',
      'capacidade_compra_verificada'
    ],
    camposDestacados: ['necessidade_verificada', 'capacidade_compra_verificada', 'observacoes'],
    mensagemEtapa: '🔍 Qualificação Técnica - Verifique necessidade real e capacidade de compra (BANT)',
    descricaoEtapa: 'Valide: Budget (orçamento), Authority (autoridade), Need (necessidade real) e Timing (prazo de implementação). Marque as confirmações.',
    validacaoCustomizada: (formData) => {
      if (!formData.necessidade_verificada) {
        return 'Confirme que a necessidade foi verificada com o lead';
      }
      if (!formData.capacidade_compra_verificada) {
        return 'Confirme que a capacidade de compra foi verificada (orçamento e autoridade)';
      }
      return null;
    }
  },
  
  em_aquecimento: {
    camposObrigatorios: [
      'razao_social',
      'vendedor_responsavel',
      'telefone',
      'email',
      'contato_principal_nome',
      'necessidade_verificada',
      'capacidade_compra_verificada'
    ],
    camposDestacados: ['observacoes', 'interesses_produtos'],
    mensagemEtapa: '🔥 Em Aquecimento - Nutra o lead com informações relevantes',
    descricaoEtapa: 'Envie cases de sucesso, demonstrações e materiais relevantes. Registre nas observações os materiais compartilhados e dúvidas levantadas.',
    validacaoCustomizada: (formData) => {
      if (!formData.observacoes || formData.observacoes.trim().length < 10) {
        return 'Registre nas observações os materiais enviados e acompanhamento realizado (mínimo 10 caracteres)';
      }
      return null;
    }
  },
  
  lead_qualificado: {
    camposObrigatorios: [
      'razao_social',
      'vendedor_responsavel',
      'telefone',
      'email',
      'contato_principal_nome',
      'necessidade_verificada',
      'capacidade_compra_verificada',
      'valor_recorrente_mensal'
    ],
    camposDestacados: ['valor_recorrente_mensal', 'observacoes', 'interesses_produtos'],
    mensagemEtapa: '🎯 Lead Qualificado - Confirme que está pronto para proposta comercial',
    descricaoEtapa: 'Valide o valor recorrente mensal estimado. Registre o alinhamento final de escopo e expectativas.',
    validacaoCustomizada: (formData) => {
      if (!formData.valor_recorrente_mensal || formData.valor_recorrente_mensal <= 0) {
        return 'Informe o valor recorrente mensal estimado para este lead';
      }
      return null;
    }
  },
  
  desqualificado: {
    camposObrigatorios: ['razao_social', 'vendedor_responsavel', 'motivo_desqualificacao'],
    camposDestacados: ['motivo_desqualificacao', 'observacoes'],
    mensagemEtapa: '❌ Desqualificado - Registre o motivo para aprendizado futuro',
    descricaoEtapa: 'Documente detalhadamente o motivo da desqualificação para análise e melhoria do processo de qualificação.',
    validacaoCustomizada: (formData) => {
      if (!formData.motivo_desqualificacao || formData.motivo_desqualificacao.trim().length < 10) {
        return 'Descreva o motivo da desqualificação de forma detalhada (mínimo 10 caracteres)';
      }
      return null;
    }
  }
};

/**
 * Valida se um lead pode avançar para determinado status
 */
export function validarMudancaStatus(formData, novoStatus) {
  const regras = REGRAS_VALIDACAO_POR_ETAPA[novoStatus];
  
  if (!regras) {
    return { valido: true };
  }
  
  // Validar campos obrigatórios
  const camposVazios = regras.camposObrigatorios.filter(campo => {
    const valor = formData[campo];
    
    // Verificar arrays vazios
    if (Array.isArray(valor)) {
      return valor.length === 0;
    }
    
    // Verificar booleanos (devem ser true para serem "preenchidos")
    if (typeof valor === 'boolean') {
      return !valor;
    }
    
    // Verificar números (devem ser >= 0, mas podem ser 0 para numero_maquinas)
    if (typeof valor === 'number') {
      if (campo === 'numero_maquinas') {
        return valor === null || valor === undefined || valor < 0;
      }
      return valor <= 0;
    }
    
    // Verificar strings vazias
    return !valor || valor.toString().trim() === '';
  });
  
  if (camposVazios.length > 0) {
    const nomesAmigaveis = camposVazios.map(campo => getNomeCampoAmigavel(campo));
    return {
      valido: false,
      mensagem: `⚠️ Campos obrigatórios não preenchidos para esta etapa:\n\n${nomesAmigaveis.join('\n')}`,
      camposFaltantes: camposVazios
    };
  }
  
  // Validação customizada
  if (regras.validacaoCustomizada) {
    const erroCustomizado = regras.validacaoCustomizada(formData);
    if (erroCustomizado) {
      return {
        valido: false,
        mensagem: erroCustomizado
      };
    }
  }
  
  return { valido: true };
}

/**
 * Retorna nome amigável do campo
 */
function getNomeCampoAmigavel(campo) {
  const nomes = {
    razao_social: '• Razão Social',
    vendedor_responsavel: '• Vendedor Responsável',
    telefone: '• Telefone',
    email: '• E-mail',
    contato_principal_nome: '• Nome do Contato Principal',
    contato_principal_cargo: '• Cargo do Contato Principal',
    numero_maquinas: '• Número de Máquinas',
    numero_funcionarios: '• Número de Funcionários',
    interesses_produtos: '• Produtos/Serviços de Interesse',
    classificacao: '• Classificação (A, B ou C)',
    segmento: '• Segmento',
    necessidade_verificada: '• Necessidade Verificada',
    capacidade_compra_verificada: '• Capacidade de Compra Verificada',
    valor_recorrente_mensal: '• Valor Recorrente Mensal',
    motivo_desqualificacao: '• Motivo da Desqualificação',
    observacoes: '• Observações'
  };
  return nomes[campo] || `• ${campo}`;
}

/**
 * Retorna mensagem motivacional baseada na etapa
 */
export function getMensagemMotivacional(status) {
  const mensagens = {
    novo_lead: '🎯 Novo lead! Vamos começar a jornada de qualificação',
    primeiro_contato: '📞 Hora do primeiro contato! Confirme os dados e estabeleça conexão',
    em_conversa: '💬 Lead está engajado! Aprofunde o relacionamento',
    levantamento_dados: '📋 Coletando informações importantes para qualificar',
    pre_qualificado: '✅ Caminhando para a qualificação! Defina o potencial',
    qualificacao_tecnica: '🔍 Verificando fit técnico e capacidade de compra (BANT)',
    em_aquecimento: '🔥 Aquecendo para o fechamento! Nutra o relacionamento',
    lead_qualificado: '🎉 Lead QUALIFICADO! Próximo passo: Proposta comercial',
    desqualificado: '📝 Documentar aprendizados para melhorar o processo'
  };
  
  return mensagens[status] || 'Atualizando lead...';
}

/**
 * Retorna a próxima ação sugerida pela IA para cada etapa
 */
export function getProximaAcaoSugerida(status) {
  const acoes = {
    novo_lead: {
      tipo: 'ligacao_urgente',
      titulo: 'Fazer primeiro contato nas próximas 24h',
      descricao: 'Entre em contato o mais rápido possível para validar o interesse e agendar uma conversa inicial',
      prioridade: 'alta'
    },
    primeiro_contato: {
      tipo: 'follow_up_orcamento',
      titulo: 'Agendar conversa de descoberta',
      descricao: 'Agende uma reunião ou call para entender as necessidades, desafios e objetivos do lead',
      prioridade: 'alta'
    },
    em_conversa: {
      tipo: 'follow_up_orcamento',
      titulo: 'Coletar informações operacionais detalhadas',
      descricao: 'Perguntar sobre estrutura, número de funcionários, máquinas, processos e dores específicas',
      prioridade: 'media'
    },
    levantamento_dados: {
      tipo: 'reuniao_fechamento',
      titulo: 'Analisar fit e apresentar solução inicial',
      descricao: 'Verificar se temos solução adequada e apresentar uma visão inicial de como podemos ajudar',
      prioridade: 'alta'
    },
    pre_qualificado: {
      tipo: 'reuniao_fechamento',
      titulo: 'Realizar qualificação técnica (BANT)',
      descricao: 'Verificar Budget (orçamento), Authority (autoridade), Need (necessidade real) e Timing (prazo)',
      prioridade: 'alta'
    },
    qualificacao_tecnica: {
      tipo: 'follow_up_orcamento',
      titulo: 'Enviar materiais de aquecimento',
      descricao: 'Compartilhar cases de sucesso, ROI estimado, demonstrações e materiais técnicos relevantes',
      prioridade: 'media'
    },
    em_aquecimento: {
      tipo: 'reuniao_fechamento',
      titulo: 'Preparar e apresentar proposta comercial',
      descricao: 'Lead está maduro! Elaborar proposta personalizada e agendar apresentação',
      prioridade: 'critica'
    },
    lead_qualificado: {
      tipo: 'reuniao_fechamento',
      titulo: 'Apresentar proposta e negociar',
      descricao: 'Agendar reunião de apresentação da proposta comercial e discutir condições',
      prioridade: 'critica'
    },
    desqualificado: {
      tipo: 'follow_up_orcamento',
      titulo: 'Documentar aprendizados',
      descricao: 'Registrar motivo detalhado e avaliar possível reativação futura',
      prioridade: 'baixa'
    }
  };
  
  return acoes[status] || null;
}