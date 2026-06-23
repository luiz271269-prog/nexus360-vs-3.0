// Coordenadas centrais (lat, lng) das capitais/estados brasileiros para
// posicionar marcadores no mapa de clientes. Usado como fallback por UF
// quando não há geocoding por cidade.
export const COORDENADAS_UF = {
  AC: [-9.0238, -70.812],
  AL: [-9.5713, -36.782],
  AM: [-3.4168, -65.8561],
  AP: [1.4144, -51.7865],
  BA: [-12.5797, -41.7007],
  CE: [-5.4984, -39.3206],
  DF: [-15.7998, -47.8645],
  ES: [-19.1834, -40.3089],
  GO: [-15.827, -49.8362],
  MA: [-4.9609, -45.2744],
  MG: [-18.5122, -44.555],
  MS: [-20.7722, -54.7852],
  MT: [-12.6819, -56.9211],
  PA: [-3.4168, -52.2178],
  PB: [-7.24, -36.782],
  PE: [-8.8137, -36.9541],
  PI: [-7.7183, -42.7289],
  PR: [-24.89, -51.55],
  RJ: [-22.9099, -43.2095],
  RN: [-5.4026, -36.9541],
  RO: [-10.9472, -62.8278],
  RR: [2.7376, -62.0751],
  RS: [-30.0346, -51.2177],
  SC: [-27.2423, -50.2189],
  SE: [-10.5741, -37.3857],
  SP: [-22.0, -48.5],
  TO: [-10.1753, -48.2982]
};

// Cidades de Santa Catarina (principal praça) com coordenadas reais para
// marcadores precisos. Demais cidades caem no centro da UF.
export const COORDENADAS_CIDADE = {
  'CRICIUMA|SC': [-28.6775, -49.3697],
  'CRICIÚMA|SC': [-28.6775, -49.3697],
  'NAVEGANTES|SC': [-26.8988, -48.6542],
  'TUBARÃO|SC': [-28.4667, -49.0069],
  'TUBARAO|SC': [-28.4667, -49.0069],
  'ITAJAÍ|SC': [-26.9078, -48.6619],
  'ITAJAI|SC': [-26.9078, -48.6619],
  'BLUMENAU|SC': [-26.9194, -49.0661],
  'BRUSQUE|SC': [-27.0978, -48.9178],
  'TURVO|SC': [-28.9275, -49.6825],
  'FLORIANÓPOLIS|SC': [-27.5954, -48.548],
  'FLORIANOPOLIS|SC': [-27.5954, -48.548],
  'JOINVILLE|SC': [-26.3045, -48.8487],
  'CHAPECÓ|SC': [-27.1004, -52.6152],
  'LAGES|SC': [-27.8158, -50.3258]
};

export function coordenadaPara(cidade, uf) {
  const key = `${(cidade || '').trim().toUpperCase()}|${(uf || '').trim().toUpperCase()}`;
  if (COORDENADAS_CIDADE[key]) return COORDENADAS_CIDADE[key];
  const ufKey = (uf || '').trim().toUpperCase();
  return COORDENADAS_UF[ufKey] || null;
}