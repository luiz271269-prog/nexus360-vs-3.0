/**
 * Utilitário centralizado para geração de URLs de webhook
 * Garante que todos os diagnósticos e testes usem a URL correta
 * Suporta Z-API e W-API
 */

// Configuração dos provedores
const PROVIDERS = {
  z_api: {
    nome: "Z-API",
    webhookFn: "webhookWatsZapi"
  },
  w_api: {
    nome: "W-API",
    webhookFn: "webhookWapi"
  }
};

/**
 * Retorna a URL de produção do webhook principal (Z-API - padrão)
 * Esta URL deve ser configurada na Z-API
 */
export function getWebhookUrlProducao(provider = 'z_api') {
  const providerConfig = PROVIDERS[provider] || PROVIDERS.z_api;
  return `https://nexus360-pro.base44.app/api/functions/${providerConfig.webhookFn}`;
}

/**
 * Retorna a URL do webhook baseada no ambiente atual
 * Útil para testes em preview/staging
 */
export function getWebhookUrlAmbienteAtual(provider = 'z_api') {
  const providerConfig = PROVIDERS[provider] || PROVIDERS.z_api;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/api/functions/${providerConfig.webhookFn}`;
}

/**
 * Retorna a URL do webhook de uma integração
 * Prioriza: webhook_url salvo > URL do ambiente > URL de produção
 * Detecta automaticamente o provedor da integração
 */
export function getWebhookUrlIntegracao(integracao) {
  // Se já tem webhook_url configurado, usa ele
  if (integracao?.webhook_url) {
    return integracao.webhook_url;
  }
  
  // Detectar provedor
  const provider = integracao?.api_provider || 'z_api';
  const providerConfig = PROVIDERS[provider] || PROVIDERS.z_api;
  
  // Se estiver em produção, retorna URL de produção
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname === 'nexus360-pro.base44.app') {
    return getWebhookUrlProducao(provider);
  }
  
  // Caso contrário, retorna URL do ambiente atual
  return getWebhookUrlAmbienteAtual(provider);
}

/**
 * Retorna o nome do provedor formatado
 */
export function getProviderNome(integracao) {
  const provider = integracao?.api_provider || 'z_api';
  return PROVIDERS[provider]?.nome || 'Z-API';
}