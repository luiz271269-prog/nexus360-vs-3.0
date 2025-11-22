/**
 * Utilitário centralizado para geração de URLs de webhook
 * Garante que todos os diagnósticos e testes usem a URL correta
 */

/**
 * Retorna a URL de produção do webhook principal
 * Esta URL deve ser configurada na Z-API
 */
export function getWebhookUrlProducao() {
  return 'https://nexus360-pro.base44.app/api/functions/webhookWatsZapi';
}

/**
 * Retorna a URL do webhook baseada no ambiente atual
 * Útil para testes em preview/staging
 */
export function getWebhookUrlAmbienteAtual() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/functions/webhookWatsZapi`;
}

/**
 * Retorna a URL do webhook de uma integração
 * Prioriza: webhook_url salvo > URL do ambiente > URL de produção
 */
export function getWebhookUrlIntegracao(integracao) {
  if (integracao?.webhook_url) {
    return integracao.webhook_url;
  }
  
  // Se estiver em produção, retorna URL de produção
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname === 'nexus360-pro.base44.app') {
    return getWebhookUrlProducao();
  }
  
  // Caso contrário, retorna URL do ambiente atual
  return getWebhookUrlAmbienteAtual();
}