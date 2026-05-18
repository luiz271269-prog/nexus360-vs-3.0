import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Tiers de maturidade baseados na idade da instância
function getInstanceTier(integration, broadcastConfig) {
  const createdAt = new Date(integration.created_date);
  const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays < 7) return { tier: 'novo', max_dia: broadcastConfig?.tier_novo_max_dia ?? 30, age_days: ageDays };
  if (ageDays < 30) return { tier: 'aquecendo', max_dia: broadcastConfig?.tier_aquecendo_max_dia ?? 80, age_days: ageDays };
  return { tier: 'maduro', max_dia: broadcastConfig?.tier_maduro_max_dia ?? 150, age_days: ageDays };
}

// Considera "saudável" se conectado E última atividade ≤ 7 dias
function isHealthy(integration) {
  if (integration.status !== 'conectado') return false;
  if (!integration.ultima_atividade) return true; // sem dado = neutro, não bloqueia
  const ultima = new Date(integration.ultima_atividade);
  const diasDesdeAtividade = Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  return diasDesdeAtividade <= 7;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Carrega config de broadcast (limites por tier)
    const broadcastConfigs = await base44.asServiceRole.entities.BroadcastConfig.filter({ ativo: true });
    const broadcastConfig = broadcastConfigs[0] || null;

    // 2. Carrega TODAS as integrações WhatsApp
    const todasIntegracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();

    // 3. Filtra apenas as do setor comercial (vendas)
    const poolComercial = todasIntegracoes.filter(i =>
      Array.isArray(i.setores_atendidos) && i.setores_atendidos.includes('vendas')
    );

    if (poolComercial.length === 0) {
      return Response.json({
        pool: [],
        total_capacity_today: 0,
        healthy_count: 0,
        stale_count: 0,
        warning: 'Nenhuma integração com setor "vendas" configurada.'
      });
    }

    // 4. Para cada uma, calcula consumo de hoje (envios feitos)
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

    // 5. Monta o resumo de cada integração
    const pool = poolComercial.map(i => {
      const tierInfo = getInstanceTier(i, broadcastConfig);
      const healthy = isHealthy(i);
      const enviosFeitos = consumoPorIntegracao[i.id] || 0;
      const capacityRemaining = Math.max(0, tierInfo.max_dia - enviosFeitos);

      return {
        integration_id: i.id,
        nome_instancia: i.nome_instancia,
        numero_telefone: i.numero_telefone,
        api_provider: i.api_provider,
        status: i.status,
        ultima_atividade: i.ultima_atividade || null,
        tier: tierInfo.tier,
        age_days: tierInfo.age_days,
        max_dia: tierInfo.max_dia,
        envios_hoje: enviosFeitos,
        capacity_remaining: capacityRemaining,
        healthy
      };
    });

    const healthyCount = pool.filter(p => p.healthy).length;
    const staleCount = pool.filter(p => !p.healthy).length;
    const totalCapacityToday = pool
      .filter(p => p.healthy)
      .reduce((sum, p) => sum + p.capacity_remaining, 0);

    return Response.json({
      pool,
      total_capacity_today: totalCapacityToday,
      healthy_count: healthyCount,
      stale_count: staleCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});