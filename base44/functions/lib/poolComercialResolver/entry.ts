// Stub Deno.serve necessário para o Base44 aceitar o deploy de helpers em functions/lib.
// Este arquivo NÃO é invocado como endpoint — é importado por distribuirEnvioMassa.
Deno.serve(() => new Response('lib helper', { status: 200 }));

/**
 * poolComercialResolver — helper para distribuição multi-instância de envios em massa.
 *
 * Estratégia: Afinidade + Tier
 *   1. Se o contato já tem thread com uma integração do pool e ela está saudável → usa essa (affinity)
 *   2. Se a instância afim está stale → pula para próxima saudável do pool (affinity_fallback)
 *   3. Se não tem afinidade no pool → round-robin com peso por tier (round_robin_weighted)
 *
 * IMPORTANTE: este helper é state-less em disco. O cursor de round-robin é por execução
 * (escopo da chamada de distribuirEnvioMassa). Isso evita race conditions entre execuções
 * paralelas e mantém a lógica simples.
 */

// Classifica idade da instância
export function getInstanceTier(integration, broadcastConfig = {}) {
  const createdAt = new Date(integration.created_date);
  const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays < 7) {
    return {
      tier: 'novo',
      max_dia: broadcastConfig.tier_novo_max_dia ?? 30,
      peso: 20,
      age_days: ageDays
    };
  }
  if (ageDays < 30) {
    return {
      tier: 'aquecendo',
      max_dia: broadcastConfig.tier_aquecendo_max_dia ?? 80,
      peso: 30,
      age_days: ageDays
    };
  }
  return {
    tier: 'maduro',
    max_dia: broadcastConfig.tier_maduro_max_dia ?? 150,
    peso: 50,
    age_days: ageDays
  };
}

// Decide se a instância está saudável (conectada + atividade recente)
export function isHealthy(integration) {
  if (integration.status !== 'conectado') return false;
  if (!integration.ultima_atividade) return true;
  const ultima = new Date(integration.ultima_atividade);
  const diasDesdeAtividade = Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  return diasDesdeAtividade <= 7;
}

/**
 * Carrega o pool comercial pronto para distribuição.
 * Retorna objeto { healthy[], stale[], capacityByInstance, broadcastConfig }
 */
export async function loadPoolComercial(base44) {
  const broadcastConfigs = await base44.asServiceRole.entities.BroadcastConfig.filter({ ativo: true });
  const broadcastConfig = broadcastConfigs[0] || {};

  const todasIntegracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();
  const pool = todasIntegracoes.filter(i =>
    Array.isArray(i.setores_atendidos) && i.setores_atendidos.includes('vendas')
  );

  // Calcula consumo de hoje por integração
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const enviosHoje = await base44.asServiceRole.entities.PromotionDispatchLog.filter({
    status: 'enviada',
    created_date: { $gte: inicioHoje.toISOString() }
  });
  const consumoPorIntegracao = {};
  enviosHoje.forEach(log => {
    if (log.integration_id) {
      consumoPorIntegracao[log.integration_id] = (consumoPorIntegracao[log.integration_id] || 0) + 1;
    }
  });

  // Enriquece cada integração com tier e capacidade
  const enriched = pool.map(i => {
    const tierInfo = getInstanceTier(i, broadcastConfig);
    const enviosFeitos = consumoPorIntegracao[i.id] || 0;
    const capacityRemaining = Math.max(0, tierInfo.max_dia - enviosFeitos);
    return {
      ...i,
      tier: tierInfo.tier,
      peso: tierInfo.peso,
      max_dia: tierInfo.max_dia,
      age_days: tierInfo.age_days,
      envios_hoje: enviosFeitos,
      capacity_remaining: capacityRemaining,
      healthy: isHealthy(i)
    };
  });

  const healthy = enriched.filter(p => p.healthy && p.capacity_remaining > 0);
  const stale = enriched.filter(p => !p.healthy);

  return { healthy, stale, all: enriched, broadcastConfig };
}

/**
 * Constrói cursor de round-robin com peso por tier.
 * Retorna um objeto { next() } que devolve a próxima integração respeitando os pesos.
 */
export function createWeightedRoundRobin(healthyPool) {
  if (!healthyPool || healthyPool.length === 0) {
    return { next: () => null };
  }

  // Estado mutável local — não persiste entre execuções
  const counters = healthyPool.map(p => ({
    integration: p,
    sent: 0
  }));

  return {
    next() {
      // Filtra quem ainda tem capacidade
      const elegiveis = counters.filter(c =>
        c.integration.capacity_remaining > c.sent
      );
      if (elegiveis.length === 0) return null;

      // Calcula "score de prioridade" = peso / (1 + sent_relativo)
      // Quanto mais a instância foi usada nesta execução proporcionalmente ao peso, menor a chance
      let melhor = elegiveis[0];
      let melhorScore = -Infinity;
      for (const c of elegiveis) {
        const peso = c.integration.peso;
        const score = peso / (1 + c.sent * 100 / peso);
        if (score > melhorScore) {
          melhorScore = score;
          melhor = c;
        }
      }
      melhor.sent += 1;
      return melhor.integration;
    }
  };
}

/**
 * Resolve qual integração deve enviar para um contato específico.
 *
 * @param {object} params
 * @param {object} params.contact - Contact entity
 * @param {string|null} params.affinityIntegrationId - integration_id da thread existente (ou null)
 * @param {Array} params.healthyPool - pool saudável
 * @param {Array} params.allPool - pool inteiro (para detectar stale fallback)
 * @param {object} params.rrCursor - cursor de round-robin (de createWeightedRoundRobin)
 * @returns {object} { integration, strategy, original_integration_id? }
 */
export function resolveInstanceForContact({ contact, affinityIntegrationId, healthyPool, allPool, rrCursor }) {
  // 1. AFINIDADE PERFEITA: thread no pool E saudável
  if (affinityIntegrationId) {
    const afim = healthyPool.find(p => p.id === affinityIntegrationId);
    if (afim && afim.capacity_remaining > 0) {
      return {
        integration: afim,
        strategy: 'affinity',
        original_integration_id: null
      };
    }

    // 2. AFINIDADE COM FALLBACK: thread no pool, mas stale → pega próxima saudável
    const afimStale = allPool.find(p => p.id === affinityIntegrationId);
    if (afimStale) {
      const next = rrCursor.next();
      if (next) {
        return {
          integration: next,
          strategy: 'affinity_fallback',
          original_integration_id: affinityIntegrationId
        };
      }
      return null;
    }
    // afinidade fora do pool → cai pro round-robin
  }

  // 3. SEM AFINIDADE: round-robin com peso
  const next = rrCursor.next();
  if (next) {
    return {
      integration: next,
      strategy: 'round_robin_weighted',
      original_integration_id: null
    };
  }

  return null;
}

/**
 * Busca a thread mais recente do contato para detectar afinidade.
 * Retorna o whatsapp_integration_id da thread mais recente, ou null.
 */
export async function getAffinityIntegrationId(base44, contactId) {
  if (!contactId) return null;
  const threads = await base44.asServiceRole.entities.MessageThread.filter(
    { contact_id: contactId, channel: 'whatsapp' },
    '-last_message_at',
    1
  );
  if (!threads || threads.length === 0) return null;
  return threads[0].whatsapp_integration_id || null;
}