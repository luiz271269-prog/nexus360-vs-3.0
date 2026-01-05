import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Função para corrigir URLs de webhook incorretas nas integrações
 * Atualiza URLs de preview/sandbox para URLs de produção corretas
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas admin pode executar correções em massa
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // URL de produção correta
    const WEBHOOK_BASE = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions';
    
    const PROVIDERS = {
      z_api: 'webhookWatsZapi',
      w_api: 'webhookWapi'
    };

    // Buscar todas as integrações com service role
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();

    const atualizacoes = [];
    const erros = [];

    for (const integracao of integracoes) {
      try {
        const provider = integracao.api_provider || 'z_api';
        const webhookFn = PROVIDERS[provider] || PROVIDERS.z_api;
        const webhookUrlCorreta = `${WEBHOOK_BASE}/${webhookFn}`;

        // Verificar se precisa atualizar
        const webhookAtual = integracao.webhook_url || '';
        
        const precisaAtualizar = 
          !webhookAtual || 
          webhookAtual.includes('preview-sandbox') || 
          webhookAtual.includes('preview.') ||
          webhookAtual.includes(':3000') ||
          !webhookAtual.includes('/apps/68a7d067890527304dbe8477/');

        if (precisaAtualizar) {
          await base44.asServiceRole.entities.WhatsAppIntegration.update(
            integracao.id,
            { webhook_url: webhookUrlCorreta }
          );

          atualizacoes.push({
            id: integracao.id,
            nome: integracao.nome_instancia,
            provider: provider,
            url_anterior: webhookAtual,
            url_nova: webhookUrlCorreta
          });
        }
      } catch (error) {
        erros.push({
          id: integracao.id,
          nome: integracao.nome_instancia,
          erro: error.message
        });
      }
    }

    return Response.json({
      success: true,
      total_verificadas: integracoes.length,
      total_atualizadas: atualizacoes.length,
      total_erros: erros.length,
      atualizacoes,
      erros
    });

  } catch (error) {
    console.error('[CORRIGIR_WEBHOOKS] Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});