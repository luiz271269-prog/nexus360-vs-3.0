/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧑‍💼 USER HELPERS - Utilitários para Resolução de Nomes e Setores
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo centraliza a lógica de exibição de nomes de usuários.
 * 
 * REGRA DO NOME (Name Resolver):
 *   Prioridade 1: display_name (Nome de Exibição - Editável pelo sistema)
 *   Prioridade 2: full_name (Nome do Login/Google - Fallback)
 *   Prioridade 3: email (Extrai parte antes do @)
 *   Prioridade 4: "Usuário não visível"
 * 
 * REGRA DO SETOR:
 *   Sempre usar attendant_sector (campo único)
 *   Sem lógica por módulo
 *   Se não existir → retorna vazio ("")
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Retorna o nome de exibição do usuário
 * Segue a hierarquia: display_name > full_name > email > "Usuário não visível"
 * 
 * @param {Object} usuario - Objeto do usuário com campos display_name, full_name, email
 * @returns {string} Nome a ser exibido
 */
export const getNomeUsuario = (usuario) => {
  if (!usuario) return 'Usuário não visível';
  
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
  
  return 'Usuário não visível';
};

/**
 * Retorna o setor do usuário formatado
 * 
 * @param {Object} usuario - Objeto do usuário com campo attendant_sector
 * @returns {string} Setor formatado (capitalizado) ou vazio se não existir
 */
export const getSetorUsuario = (usuario) => {
  if (!usuario || !usuario.attendant_sector) return '';
  
  // Capitalizar primeira letra
  const setor = usuario.attendant_sector;
  return setor.charAt(0).toUpperCase() + setor.slice(1);
};

/**
 * Retorna apenas o primeiro nome do usuário
 * Útil para exibições compactas ou assinaturas
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Primeiro nome
 */
export const getPrimeiroNome = (usuario) => {
  const nomeCompleto = getNomeUsuario(usuario);
  return nomeCompleto.split(' ')[0];
};

/**
 * Retorna a assinatura completa do usuário para mensagens
 * Formato: "Nome (Setor)" ou apenas "Nome" se não houver setor
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Assinatura no formato "Nome (Setor)"
 */
export const getAssinaturaUsuario = (usuario) => {
  const nome = getPrimeiroNome(usuario);
  const setor = getSetorUsuario(usuario);
  return setor ? `${nome} (${setor})` : nome;
};

/**
 * Retorna o nome e setor formatados para exibição
 * Formato: "Nome Completo (Setor)" ou apenas "Nome Completo" se não houver setor
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Nome e setor formatados
 */
export const getNomeComSetor = (usuario) => {
  const nome = getNomeUsuario(usuario);
  const setor = getSetorUsuario(usuario);
  return setor ? `${nome} (${setor})` : nome;
};

/**
 * Retorna as iniciais do nome para avatares
 * 
 * @param {Object} usuario - Objeto do usuário
 * @returns {string} Iniciais (máximo 2 caracteres)
 */
export const getIniciaisUsuario = (usuario) => {
  const nome = getNomeUsuario(usuario);
  if (!nome || nome === 'Usuário não visível') return '?';
  
  const palavras = nome.trim().split(' ').filter(Boolean);
  if (palavras.length >= 2) {
    return `${palavras[0][0]}${palavras[1][0]}`.toUpperCase();
  }
  return nome.substring(0, 2).toUpperCase();
};

/**
 * Busca um usuário pelo ID e retorna seu nome formatado
 * 
 * @param {string} userId - ID do usuário (user_id)
 * @param {Array} listaUsuarios - Lista de usuários
 * @param {boolean} incluirSetor - Se deve incluir o setor
 * @returns {string} Nome do usuário (com ou sem setor)
 */
export const buscarNomeUsuario = (userId, listaUsuarios = [], incluirSetor = false) => {
  if (!userId || !listaUsuarios?.length) return 'Usuário não visível';
  
  const usuario = listaUsuarios.find(u => u.id === userId);
  if (!usuario) return 'Usuário não visível';
  
  return incluirSetor ? getNomeComSetor(usuario) : getNomeUsuario(usuario);
};

/**
 * Retorna o nome de exibição do usuário a partir do user_id
 * FUNÇÃO PRINCIPAL - Usar sempre que precisar exibir nome de usuário
 * 
 * @param {string} userId - ID do usuário
 * @param {Array} listaUsuarios - Lista de usuários disponíveis
 * @param {Object} options - Opções: { incluirSetor: boolean, incluirEmail: boolean }
 * @returns {string} Nome formatado do usuário
 */
export const getUserDisplayName = (userId, listaUsuarios = [], options = {}) => {
  const { incluirSetor = false, incluirEmail = false } = options;
  
  if (!userId) return 'Sem atribuição';
  
  if (!listaUsuarios?.length) return 'Carregando...';
  
  const usuario = listaUsuarios.find(u => u.id === userId);
  
  if (!usuario) return 'Usuário não encontrado';
  
  const nome = getNomeUsuario(usuario);
  
  if (incluirSetor && incluirEmail) {
    const setor = getSetorUsuario(usuario);
    return setor ? `${nome} (${setor}) - ${usuario.email}` : `${nome} - ${usuario.email}`;
  }
  
  if (incluirSetor) {
    return getNomeComSetor(usuario);
  }
  
  if (incluirEmail) {
    return `${nome} - ${usuario.email}`;
  }
  
  return nome;
};

// ✅ COMPATIBILIDADE: Manter aliases das funções antigas (deprecated)
export const getNomeAtendente = getNomeUsuario;
export const getSetorAtendente = getSetorUsuario;
export const getAssinaturaAtendente = getAssinaturaUsuario;
export const getIniciaisAtendente = getIniciaisUsuario;
export const buscarNomeAtendente = buscarNomeUsuario;

export default {
  getNomeUsuario,
  getSetorUsuario,
  getPrimeiroNome,
  getAssinaturaUsuario,
  getNomeComSetor,
  getIniciaisUsuario,
  buscarNomeUsuario,
  getUserDisplayName,
  // Aliases deprecated (manter por compatibilidade)
  getNomeAtendente,
  getSetorAtendente,
  getAssinaturaAtendente,
  getIniciaisAtendente,
  buscarNomeAtendente
};