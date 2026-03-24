// ============================================================================
// ROTEADOR CENTRAL - Decisão determinística por tipo de contato
// ============================================================================
// Substitui "ifs espalhados" por ordem imutável de prioridade
// ============================================================================


// Tipos válidos mapeados no sistema
const TIPOS_VALIDOS = ['novo', 'lead', 'cliente', 'eventual', 'ex_cliente', 'fornecedor', 'parceiro'];

/**
 * Classifica o tipo de contato e se é fidelizado
 * @param {object} contact - Contact entity
 * @returns {object} - { tipo, fidelizado, comportamento }
 *   comportamento: 'normal' | 'eventual' | 'reativacao'
 */
export function classificarContato(contact) {
  // ✅ Fidelizado = flag manual OR qualquer atendente dedicado por setor
  const fidelizado = contact.is_cliente_fidelizado === true ||
    !!(contact.atendente_fidelizado_vendas ||
       contact.atendente_fidelizado_assistencia ||
       contact.atendente_fidelizado_financeiro ||
       contact.atendente_fidelizado_fornecedor);
  let tipo = contact.tipo_contato || 'novo';

  // ✅ Garantir que tipos novos (eventual, ex_cliente) sejam reconhecidos
  if (!TIPOS_VALIDOS.includes(tipo)) tipo = 'novo';

  // Inferência por tags (fallback se tipo_contato for 'novo')
  if (tipo === 'novo' && contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) {
      tipo = 'fornecedor';
    } else if (contact.tags.includes('parceiro') || contact.tags.includes('revenda')) {
      tipo = 'parceiro';
    } else if (contact.tags.includes('lead') || contact.tags.includes('lead_quente')) {
      tipo = 'lead';
    } else if (contact.tags.includes('cliente')) {
      tipo = 'cliente';
    } else if (contact.tags.includes('eventual')) {
      tipo = 'eventual';
    } else if (contact.tags.includes('ex_cliente') || contact.tags.includes('inativo')) {
      tipo = 'ex_cliente';
    }
  }

  // Inferência por cliente_id
  if (tipo === 'novo' && contact.cliente_id) tipo = 'cliente';

  // Comportamento para lógica de URA e promoções
  const comportamento =
    tipo === 'eventual'   ? 'eventual' :
    tipo === 'ex_cliente' ? 'reativacao' : 'normal';

  return { tipo, fidelizado, comportamento };
}

/**
 * Decide modo de reabertura baseado em janela de tempo e setor conhecido
 * @param {object} thread - MessageThread
 * @param {Date} now - Data atual
 * @param {number} horasJanela - Horas para considerar "reabertura" (padrão: 12h)
 * @returns {object} - { modo: 'sticky'|'mini'|'full'|'none', setor?: string }
 */
export function decidirReabertura(thread, now, horasJanela = 12) {
  // Importar função de checagem (inline para evitar circular)
  const humanoAtivo = (t) => {
    if (!t.assigned_user_id) return false;
    if (t.pre_atendimento_ativo) return false;
    if (!t.last_human_message_at) return false;
    const lastHumanDate = new Date(t.last_human_message_at);
    const hoursGap = (now - lastHumanDate) / (1000 * 60 * 60);
    return hoursGap < 2; // Humano ativo se falou nas últimas 2h
  };
  
  // Se tem humano ativo (não stale) → none
  if (humanoAtivo(thread)) {
    return { modo: 'none' };
  }
  
  // Se não tem sector_id → full (URA completa)
  if (!thread.sector_id) {
    return { modo: 'full' };
  }
  
  // Se tem setor mas nunca concluiu URA → full
  if (thread.pre_atendimento_state !== 'COMPLETED') {
    return { modo: 'full' };
  }
  
  // Se tem setor e completou → verificar janela
  if (!thread.last_message_at) {
    return { modo: 'full' };
  }
  
  const lastMessageDate = new Date(thread.last_message_at);
  const diferencaHoras = (now - lastMessageDate) / (1000 * 60 * 60);
  
  if (diferencaHoras <= horasJanela) {
    return { modo: 'sticky', setor: thread.sector_id };
  }

  return { modo: 'mini', setor: thread.sector_id };
}

/**
 * Decide modo de reabertura levando em conta tipo_contato (eventual/ex_cliente)
 * Wrapper sobre decidirReabertura para uso nos handlers que têm o contato disponível.
 */
export function decidirReaberturaComTipo(thread, contact, now, horasJanela = 12) {
  const tipo = contact?.tipo_contato;
  // ex_cliente: sempre URA completa com saudação especial de retorno
  if (tipo === 'ex_cliente') return { modo: 'full', motivoRetorno: true };

  const base = decidirReabertura(thread, now, horasJanela);

  // eventual fora da janela → mini simplificada
  if (tipo === 'eventual' && base.modo === 'mini') {
    return { ...base, simplificado: true };
  }

  return base;
}

/**
 * Seleciona o FlowTemplate adequado para o contato
 * @param {object} base44 - SDK
 * @param {object} classificacao - { tipo, fidelizado }
 * @returns {Promise<object|null>} - FlowTemplate ou null
 */
export async function selecionarTemplate(base44, classificacao) {
  const { tipo } = classificacao;
  
  // 1. Buscar template específico por tipo_contato_alvo
  const templatesEspecificos = await base44.asServiceRole.entities.FlowTemplate.filter({
    tipo_contato_alvo: tipo,
    tipo_fluxo: 'pre_atendimento',
    ativo: true
  }, '-created_date', 1);
  
  if (templatesEspecificos.length > 0) {
    return templatesEspecificos[0];
  }
  
  // 2. Fallback: template padrão
  const templatesPadrao = await base44.asServiceRole.entities.FlowTemplate.filter({
    is_pre_atendimento_padrao: true,
    ativo: true
  }, '-created_date', 1);
  
  if (templatesPadrao.length > 0) {
    return templatesPadrao[0];
  }
  
  // 3. Fallback final: qualquer template de pre_atendimento
  const templatesGerais = await base44.asServiceRole.entities.FlowTemplate.filter({
    tipo_fluxo: 'pre_atendimento',
    ativo: true
  }, '-created_date', 1);
  
  return templatesGerais.length > 0 ? templatesGerais[0] : null;
}

/**
 * Aplica roteamento por fidelização
 * @param {object} base44 - SDK
 * @param {object} thread - MessageThread
 * @param {object} contato - Contact
 * @returns {Promise<object>} - { success, setor?, atendente_id? }
 */
export async function aplicarRoteamentoFidelizado(base44, thread, contato) {
  const setorFidelizado = contato.atendente_fidelizado_vendas ? 'vendas' :
                          contato.atendente_fidelizado_assistencia ? 'assistencia' :
                          contato.atendente_fidelizado_financeiro ? 'financeiro' :
                          contato.atendente_fidelizado_fornecedor ? 'fornecedor' : 'geral';
  
  const campoFidelizado = {
    'vendas': 'atendente_fidelizado_vendas',
    'assistencia': 'atendente_fidelizado_assistencia',
    'financeiro': 'atendente_fidelizado_financeiro',
    'fornecedor': 'atendente_fidelizado_fornecedor'
  };
  
  let atendenteFidelizado = null;
  const campo = campoFidelizado[setorFidelizado];
  if (campo && contato[campo]) {
    try {
      atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]);
    } catch (e) {}
  }
  
  const threadUpdate = {
    sector_id: setorFidelizado,
    pre_atendimento_ativo: false,
    pre_atendimento_state: 'NAO_INICIADO'
  };
  
  if (atendenteFidelizado) {
    threadUpdate.assigned_user_id = atendenteFidelizado.id;
  }
  
  await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
  
  return {
    success: true,
    setor: setorFidelizado,
    atendente_id: atendenteFidelizado?.id || null
  };
}

/**
 * Aplica roteamento para fornecedor/compras
 * @param {object} base44 - SDK
 * @param {object} thread - MessageThread
 * @param {object} contato - Contact
 * @returns {Promise<object>} - { success, setor }
 */
export async function aplicarRoteamentoFornecedor(base44, thread, contato) {
  if (!thread.sector_id) {
    const setorInferido = contato.tipo_contato === 'fornecedor' ? 'fornecedor' : 'compras';
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      sector_id: setorInferido,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'NAO_INICIADO'
    }).catch(() => {});
    
    return { success: true, setor: setorInferido };
  }
  
  return { success: true, setor: thread.sector_id };
}

/**
 * Verifica se é fornecedor/compras
 * @param {object} contact - Contact
 * @param {object} thread - MessageThread
 * @returns {boolean}
 */
export function ehFornecedorOuCompras(contact, thread) {
  // ✅ ex_cliente e eventual NÃO são fornecedor
  if (contact.tipo_contato === 'fornecedor') return true;
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) return true;
  }
  const setoresExcluidos = ['fornecedor', 'compras', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) return true;
  return false;
}