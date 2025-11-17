import { ZAPIService } from './ZAPIService.js';
import { EvolutionAPIService } from './EvolutionAPIService.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PROVIDER FACTORY - FACTORY PATTERN                         ║
 * ║  Instancia o provedor correto baseado na configuração      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class ProviderFactory {
  /**
   * Cria uma instância do provedor correto
   * @param {object} config - Configuração da integração (WhatsAppIntegration)
   * @returns {WhatsAppAdapter} Instância do provedor
   */
  static create(config) {
    if (!config || !config.api_provider) {
      throw new Error('Configuração inválida: api_provider não especificado');
    }

    const provider = config.api_provider.toLowerCase();

    switch (provider) {
      case 'z_api':
      case 'zapi':
        return new ZAPIService(config);

      case 'evolution_api':
      case 'evolution':
        return new EvolutionAPIService(config);

      // Futuro: Meta Cloud API, Twilio, etc.
      // case 'meta_cloud_api':
      //   return new MetaCloudAPIService(config);

      default:
        throw new Error(`Provedor '${config.api_provider}' não suportado`);
    }
  }

  /**
   * Lista de provedores suportados
   */
  static getSupportedProviders() {
    return [
      {
        id: 'evolution_api',
        name: 'Evolution API',
        description: 'API Evolution para WhatsApp Business',
        features: ['qr_code', 'pairing_code', 'media', 'templates'],
        requiresFields: ['instance_id_provider', 'api_key_provider'],
        optionalFields: ['base_url_provider']
      },
      {
        id: 'z_api',
        name: 'Z-API',
        description: 'Z-API para WhatsApp Business',
        features: ['qr_code', 'media', 'templates', 'batch_sending'],
        requiresFields: ['instance_id_provider', 'api_key_provider'],
        optionalFields: ['base_url_provider']
      }
    ];
  }

  /**
   * Obtém informações sobre um provedor específico
   */
  static getProviderInfo(providerId) {
    const providers = this.getSupportedProviders();
    return providers.find(p => p.id === providerId);
  }

  /**
   * Valida se uma configuração está completa para o provedor
   */
  static validateConfig(config) {
    const providerInfo = this.getProviderInfo(config.api_provider);
    
    if (!providerInfo) {
      return {
        valid: false,
        errors: [`Provedor '${config.api_provider}' não suportado`]
      };
    }

    const errors = [];
    
    for (const field of providerInfo.requiresFields) {
      if (!config[field]) {
        errors.push(`Campo obrigatório '${field}' não fornecido`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Exportar também como default
export default ProviderFactory;