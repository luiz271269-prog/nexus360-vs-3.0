/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BUTTON MAPPINGS - Mapeamento de IDs de botões              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const sectorButtonMap = {
  'setor_vendas': 'vendas',
  'setor_suporte': 'assistencia',
  'setor_financeiro': 'financeiro',
  'setor_fornecedores': 'fornecedor',
};

export const attendantButtonMap = {
  // Será preenchido dinamicamente: att_<user_id> -> user_id
  // Exemplo futuro: 'att_joao123': 'joao123'
};

/**
 * Mapear ID de botão de atendente para ID do usuário
 * @param {string} buttonId - ID do botão (ex: 'att_joao123')
 * @returns {string|null} - ID do usuário ou null se inválido
 */
export function mapAttendantButtonToId(buttonId) {
  if (!buttonId || !buttonId.startsWith('att_')) {
    return null;
  }
  return buttonId.substring(4); // Remove 'att_' prefix
}