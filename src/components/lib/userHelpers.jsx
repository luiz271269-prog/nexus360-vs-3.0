/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧑‍💼 USER HELPERS - Utilitários para Resolução de Nomes e Setores
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo centraliza a lógica de exibição de nomes de usuários/atendentes.
 * 
 * REGRA DO NOME (Name Resolver):
 *   Prioridade 1: display_name (Nome de Exibição - Editável pelo sistema)
 *   Prioridade 2: full_name (Nome do Login/Google - Fallback)
 *   Prioridade 3: email (Último recurso - pega parte antes do @)
 * 
 * REGRA DO SETOR:
 *   Sempre usar attendant_sector (Ex: "Vendas", "Assistência")
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Retorna o nome de exibição do usuário/atendente
 * Segue a hierarquia: display_name > full_name > email
 * 
 * @param {Object} usuario - Objeto do usuário com campos display_name, full_name, email
 * @returns {string} Nome a ser exibido
 */
export const getNomeAtendente = (usuario) => {
  if (!usuario) return 'Desconhecido';
  
  // Hierarquia de prioridade
  if (usuario.display_name && usuario.display_name.trim()) {
    return usuario.display_name.trim();
  }
  
  if (usuario.full_name && usuario.full_name.trim()) {
    return usuario.full_name.trim();
  }
  
  if (usuario.email) {
    // Extrai a parte antes do @ como último recurso
    return usuario.email.split('@')[0];
  }
  
  return 'Desconhecido';
};

/**
 * Retorna apenas o primeiro nome do usuário/atendente
 * Útil para exibições compactas ou assinaturas
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Primeiro nome
 */
export const getPrimeiroNome = (usuario) => {
  const nomeCompleto = getNomeAtendente(usuario);
  return nomeCompleto.split(' ')[0];
};

/**
 * Retorna o setor do atendente formatado
 * 
 * @param {Object} usuario - Objeto do usuário com campo attendant_sector
 * @returns {string} Setor formatado (capitalizado)
 */
export const getSetorAtendente = (usuario) => {
  if (!usuario || !usuario.attendant_sector) return 'Geral';
  
  // Capitalizar primeira letra
  const setor = usuario.attendant_sector;
  return setor.charAt(0).toUpperCase() + setor.slice(1);
};

/**
 * Retorna a assinatura completa do atendente para mensagens
 * Formato: "Nome (Setor)"
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Assinatura no formato "Nome (Setor)"
 */
export const getAssinaturaAtendente = (usuario) => {
  const nome = getPrimeiroNome(usuario);
  const setor = getSetorAtendente(usuario);
  return `${nome} (${setor})`;
};

/**
 * Retorna o nome e setor formatados para exibição em bolhas de mensagem
 * Formato: "Nome Completo (Setor)"
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Nome e setor formatados
 */
export const getNomeComSetor = (usuario) => {
  const nome = getNomeAtendente(usuario);
  const setor = getSetorAtendente(usuario);
  return `${nome} (${setor})`;
};

/**
 * Retorna as iniciais do nome para avatares
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Iniciais (máximo 2 caracteres)
 */
export const getIniciaisAtendente = (usuario) => {
  const nome = getNomeAtendente(usuario);
  if (!nome || nome === 'Desconhecido') return '?';
  
  const palavras = nome.trim().split(' ').filter(Boolean);
  if (palavras.length >= 2) {
    return `${palavras[0][0]}${palavras[1][0]}`.toUpperCase();
  }
  return nome.substring(0, 2).toUpperCase();
};

/**
 * Busca um atendente pelo ID e retorna seu nome formatado
 * 
 * @param {string} atendenteId - ID do atendente
 * @param {Array} listaAtendentes - Lista de atendentes
 * @param {boolean} incluirSetor - Se deve incluir o setor
 * @returns {string} Nome do atendente (com ou sem setor)
 */
export const buscarNomeAtendente = (atendenteId, listaAtendentes = [], incluirSetor = false) => {
  if (!atendenteId || !listaAtendentes?.length) return 'Atendente';
  
  const atendente = listaAtendentes.find(a => a.id === atendenteId);
  if (!atendente) return 'Atendente';
  
  return incluirSetor ? getNomeComSetor(atendente) : getNomeAtendente(atendente);
};

export default {
  getNomeAtendente,
  getPrimeiroNome,
  getSetorAtendente,
  getAssinaturaAtendente,
  getNomeComSetor,
  getIniciaisAtendente,
  buscarNomeAtendente
};