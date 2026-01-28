import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin apenas' }, { status: 403 });
    }

    // Buscar integração "Compras"
    const integracaoCompras = await base44.asServiceRole.entities.WhatsAppIntegration.get('69615d1875e7376cb32e3102');
    
    console.log('[DIAGNOSTICO] 📊 Integração Compras:', integracaoCompras);

    // Buscar últimos 20 payloads desta integração
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
      {
        integration_id: '69615d1875e7376cb32e3102',
        timestamp_recebido: { $gte: ontem }
      },
      '-created_date',
      20
    );

    // Analisar tipos de eventos
    const analise = {
      total_payloads: payloads.length,
      webhookReceived: 0,
      webhookDelivery: 0,
      outros: 0,
      exemplos: []
    };

    for (const p of payloads) {
      const evento = p.evento || p.payload_bruto?.event || 'unknown';
      
      if (evento.includes('Received') || evento === 'ReceivedCallback') {
        analise.webhookReceived++;
      } else if (evento.includes('Delivery') || evento === 'webhookDelivery') {
        analise.webhookDelivery++;
      } else {
        analise.outros++;
      }

      // Guardar exemplos
      if (analise.exemplos.length < 3) {
        analise.exemplos.push({
          timestamp: p.timestamp_recebido,
          evento: evento,
          fromMe: p.payload_bruto?.fromMe,
          phone: p.payload_bruto?.sender?.id || p.payload_bruto?.phone,
          sucesso: p.sucesso_processamento
        });
      }
    }

    // Buscar contato "Miguel da Setep" ou "SETEP"
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { telefone: '+554821025103' },
      '-created_date',
      5
    );

    // Buscar mensagens recentes do chip Compras
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { 
        'metadata.whatsapp_integration_id': '69615d1875e7376cb32e3102',
        created_date: { $gte: ontem }
      },
      '-created_date',
      10
    );

    return Response.json({
      success: true,
      integracao: {
        id: integracaoCompras.id,
        nome: integracaoCompras.nome_instancia,
        numero: integracaoCompras.numero_telefone,
        instance_id: integracaoCompras.instance_id_provider,
        status: integracaoCompras.status,
        webhook_url: integracaoCompras.webhook_url
      },
      analise_payloads: analise,
      contato_miguel: contatos.length > 0 ? contatos[0] : null,
      total_contatos_encontrados: contatos.length,
      mensagens_24h: mensagens.length,
      ultima_mensagem: mensagens[0] || null,
      diagnostico: {
        webhook_registrado: !!integracaoCompras.webhook_url,
        recebe_mensagens_recebidas: analise.webhookReceived > 0,
        recebe_apenas_status: analise.webhookDelivery > 0 && analise.webhookReceived === 0,
        problema_identificado: analise.webhookReceived === 0 ? 'WEBHOOK NÃO RECEBE MENSAGENS RECEBIDAS - Verificar registro no painel W-API' : null
      }
    });

  } catch (error) {
    console.error('[DIAGNOSTICO] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});