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
 * Retorna a URL de produção do webhook principal
 * ⚠️ IMPORTANTE: Esta é a URL CORRETA para produção (Base44 Apps)
 */
export function getWebhookUrlProducao(provider = 'z_api') {
  const providerConfig = PROVIDERS[provider] || PROVIDERS.z_api;
  return `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/${providerConfig.webhookFn}`;
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
 * SEMPRE prioriza: webhook_url salvo no banco (fonte única de verdade)
 * Fallback apenas para compatibilidade com instâncias antigas
 */
export function getWebhookUrlIntegracao(integracao) {
  // ✅ FONTE ÚNICA: webhook_url salvo no banco
  if (integracao?.webhook_url) {
    return integracao.webhook_url;
  }
  
  // ⚠️ FALLBACK (apenas para instâncias antigas sem webhook_url)
  console.warn('[WEBHOOK] Integração sem webhook_url configurado, usando fallback:', integracao?.nome_instancia);
  
  // URL de produção como fallback
  const provider = integracao?.api_provider || 'z_api';
  return getWebhookUrlProducao(provider);
}

/**
 * Retorna o nome do provedor formatado
 */
export function getProviderNome(integracao) {
  const provider = integracao?.api_provider || 'z_api';
  return PROVIDERS[provider]?.nome || 'Z-API';
}