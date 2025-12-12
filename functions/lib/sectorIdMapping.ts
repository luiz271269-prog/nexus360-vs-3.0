// ============================================================================
// MAPEAMENTO ÚNICO DE SETORES - FONTE ÚNICA DE VERDADE
// ============================================================================
// IDs padronizados para garantir consistência em todo o sistema
// Usar SEMPRE estes IDs para lógica de roteamento/filtro
// ============================================================================

export const SECTOR_IDS = {
  VENDAS: 'sector_vendas',
  ASSISTENCIA: 'sector_assistencia',
  FINANCEIRO: 'sector_financeiro',
  FORNECEDOR: 'sector_fornecedor',
  GERAL: 'sector_geral'
};

export const SECTOR_LABELS = {
  sector_vendas: 'Vendas',
  sector_assistencia: 'Assistência',
  sector_financeiro: 'Financeiro',
  sector_fornecedor: 'Fornecedores',
  sector_geral: 'Geral'
};

// Mapear texto de setor → sector_id
export function textoParaSectorId(setor) {
  const mapa = {
    'vendas': SECTOR_IDS.VENDAS,
    'assistencia': SECTOR_IDS.ASSISTENCIA,
    'financeiro': SECTOR_IDS.FINANCEIRO,
    'fornecedor': SECTOR_IDS.FORNECEDOR,
    'geral': SECTOR_IDS.GERAL
  };
  return mapa[setor?.toLowerCase()] || `sector_${setor}`;
}

// Mapear sector_id → texto
export function sectorIdParaTexto(sectorId) {
  return SECTOR_LABELS[sectorId] || sectorId?.replace('sector_', '') || 'geral';
}

// Validar se sector_id é válido
export function isValidSectorId(sectorId) {
  return Object.values(SECTOR_IDS).includes(sectorId);
}