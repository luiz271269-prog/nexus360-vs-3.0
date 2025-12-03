/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔧 UTILITÁRIO DE COMPARAÇÃO DE USUÁRIOS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PROBLEMA: Em diferentes partes do sistema, usuários/atendentes/vendedores são
 * referenciados de formas inconsistentes:
 * - Por ID (user.id)
 * - Por Nome Completo (user.full_name, vendedor.nome)
 * - Por Email (user.email)
 * - Por Nome do Vendedor (vendedor_responsavel - às vezes é nome, às vezes ID)
 * 
 * SOLUÇÃO: Centralizar a lógica de comparação para funcionar com qualquer formato.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * Normaliza um valor para comparação (lowercase, trim, remove acentos)
 */
export const normalizarParaComparacao = (valor) => {
  if (!valor) return '';
  return String(valor)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Verifica se dois valores representam o mesmo usuário
 * Compara por ID, nome ou email
 * 
 * @param {string|null} valor1 - Primeiro valor (pode ser ID, nome ou email)
 * @param {string|null} valor2 - Segundo valor (pode ser ID, nome ou email)
 * @returns {boolean}
 */
export const valoresIguais = (valor1, valor2) => {
  if (!valor1 || !valor2) return false;
  
  const v1 = normalizarParaComparacao(valor1);
  const v2 = normalizarParaComparacao(valor2);
  
  return v1 === v2;
};

/**
 * Verifica se um usuário corresponde a um valor de referência
 * O valor pode ser ID, nome completo, email, ou parte do email/nome
 * 
 * @param {Object} usuario - Objeto do usuário com id, full_name, email
 * @param {string} valorReferencia - Valor a comparar (ID, nome ou email)
 * @returns {boolean}
 */
export const usuarioCorresponde = (usuario, valorReferencia) => {
  if (!usuario || !valorReferencia) return false;
  
  const ref = normalizarParaComparacao(valorReferencia);
  if (!ref) return false;
  
  // Comparar com ID (exato)
  if (usuario.id && normalizarParaComparacao(usuario.id) === ref) return true;
  
  // Comparar com nome completo (exato)
  if (usuario.full_name && normalizarParaComparacao(usuario.full_name) === ref) return true;
  
  // Comparar com email (exato)
  if (usuario.email && normalizarParaComparacao(usuario.email) === ref) return true;
  
  // Comparar com nome (para entidade Vendedor)
  if (usuario.nome && normalizarParaComparacao(usuario.nome) === ref) return true;
  
  // Comparar prefixo do email (ex: "vendas5" com "vendas5@liesch.com.br")
  if (usuario.email) {
    const emailPrefix = normalizarParaComparacao(usuario.email.split('@')[0]);
    if (emailPrefix === ref) return true;
  }
  
  // Comparar se referência está contida no nome completo (ex: "Thiago" em "Thiago Silva")
  if (usuario.full_name) {
    const fullNameNorm = normalizarParaComparacao(usuario.full_name);
    // Verifica se a referência é exatamente o primeiro nome
    const primeiroNome = fullNameNorm.split(' ')[0];
    if (primeiroNome === ref) return true;
  }
  
  return false;
};

/**
 * Verifica se um contato está fidelizado a um usuário específico
 * Checa todos os campos de fidelização possíveis
 * 
 * @param {Object} contato - Objeto do contato
 * @param {Object} usuario - Objeto do usuário
 * @returns {boolean}
 */
export const contatoFidelizadoAoUsuario = (contato, usuario) => {
  if (!contato || !usuario) return false;
  
  const camposFidelizacao = [
    'vendedor_responsavel',
    'atendente_fidelizado_vendas',
    'atendente_fidelizado_assistencia',
    'atendente_fidelizado_financeiro',
    'atendente_fidelizado_fornecedor'
  ];
  
  return camposFidelizacao.some(campo => {
    const valorCampo = contato[campo];
    return valorCampo && usuarioCorresponde(usuario, valorCampo);
  });
};

/**
 * Verifica se um contato está fidelizado a OUTRO usuário (não o atual)
 * 
 * @param {Object} contato - Objeto do contato
 * @param {Object} usuarioAtual - Objeto do usuário atual
 * @returns {boolean}
 */
export const contatoFidelizadoAOutro = (contato, usuarioAtual) => {
  if (!contato || !usuarioAtual) return false;
  
  const camposFidelizacao = [
    'vendedor_responsavel',
    'atendente_fidelizado_vendas',
    'atendente_fidelizado_assistencia',
    'atendente_fidelizado_financeiro',
    'atendente_fidelizado_fornecedor'
  ];
  
  for (const campo of camposFidelizacao) {
    const valorCampo = contato[campo];
    if (valorCampo) {
      // Se tem valor E não corresponde ao usuário atual = fidelizado a outro
      if (!usuarioCorresponde(usuarioAtual, valorCampo)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Obtém o nome do atendente fidelizado de um contato (primeiro encontrado)
 * 
 * @param {Object} contato - Objeto do contato
 * @returns {string|null}
 */
export const getAtendenteFidelizadoNome = (contato) => {
  if (!contato) return null;
  
  return contato.vendedor_responsavel || 
         contato.atendente_fidelizado_vendas || 
         contato.atendente_fidelizado_assistencia ||
         contato.atendente_fidelizado_financeiro ||
         contato.atendente_fidelizado_fornecedor ||
         null;
};

/**
 * Encontra um usuário em uma lista baseado em qualquer identificador
 * 
 * @param {Array} listaUsuarios - Lista de usuários/vendedores/atendentes
 * @param {string} identificador - ID, nome ou email
 * @returns {Object|null}
 */
export const encontrarUsuario = (listaUsuarios, identificador) => {
  if (!listaUsuarios || !identificador) return null;
  
  return listaUsuarios.find(u => usuarioCorresponde(u, identificador)) || null;
};

/**
 * Cria um mapa de usuários para lookup O(1)
 * Indexa por ID, nome e email
 * 
 * @param {Array} listaUsuarios - Lista de usuários
 * @returns {Map}
 */
export const criarMapaUsuarios = (listaUsuarios) => {
  const mapa = new Map();
  
  if (!listaUsuarios) return mapa;
  
  listaUsuarios.forEach(u => {
    if (u.id) mapa.set(normalizarParaComparacao(u.id), u);
    if (u.full_name) mapa.set(normalizarParaComparacao(u.full_name), u);
    if (u.nome) mapa.set(normalizarParaComparacao(u.nome), u);
    if (u.email) mapa.set(normalizarParaComparacao(u.email), u);
  });
  
  return mapa;
};

export default {
  normalizarParaComparacao,
  valoresIguais,
  usuarioCorresponde,
  contatoFidelizadoAoUsuario,
  contatoFidelizadoAOutro,
  getAtendenteFidelizadoNome,
  encontrarUsuario,
  criarMapaUsuarios
};