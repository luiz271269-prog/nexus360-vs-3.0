import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin apenas' }, { status: 403 });
    }

    // Buscar TODAS integrações
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list();
    
    console.log(`[DIAGNOSTICO] 📊 Total de integrações: ${integracoes.length}`);
    
    const diagnostico = [];
    
    for (const integ of integracoes) {
      const info = {
        id: integ.id,
        nome: integ.nome_instancia,
        numero: integ.numero_telefone,
        status: integ.status,
        instance_id: integ.instance_id_provider,
        webhook_url: integ.webhook_url,
        provider: integ.api_provider,
        setores: integ.setores_atendidos || []
      };
      
      // Contar mensagens recentes (últimas 24h)
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mensagensRecentes = await base44.asServiceRole.entities.Message.filter(
        { 
          'metadata.whatsapp_integration_id': integ.id,
          created_date: { $gte: ontem }
        },
        '-created_date',
        100
      );
      
      info.mensagens_24h = mensagensRecentes.length;
      info.ultima_mensagem = mensagensRecentes[0]?.sent_at || null;
      
      // Buscar payloads recentes desta integração
      const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
        {
          integration_id: integ.id,
          timestamp_recebido: { $gte: ontem }
        },
        '-created_date',
        50
      );
      
      info.payloads_24h = payloads.length;
      info.ultimo_payload = payloads[0]?.timestamp_recebido || null;
      
      diagnostico.push(info);
    }
    
    return Response.json({
      success: true,
      total_integracoes: integracoes.length,
      integracoes: diagnostico,
      recomendacao: "Verifique qual integração recebe mensagens de 'COMPRAS SETEP' e confirme webhook ativo"
    });

  } catch (error) {
    console.error('[DIAGNOSTICO] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});