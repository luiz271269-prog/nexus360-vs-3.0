// ============================================================================
// SKILL 3 — QUEUE MANAGER v1.0
// Objetivo: Manter conversa VIVA quando sem atendente
//           + Sort inteligente por carga + Contexto para atendente
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const base44 = createClientFromRequest(req);
  const startTime = Date.now();
  const payload = await req.json().catch(() => ({}));
  const { thread, contact, intencaoResult } = payload;

  try {
    const setor = intencaoResult?.setor || thread.sector_id || 'vendas';
    const tipoContato = intencaoResult?.tipo_contato || contact.tipo_contato || 'novo';
    const primeiroNome = (contact.nome || 'cliente').split(' ')[0];

    // STEP 1: Atendente fidelizado (prioridade maxima)
    let atendenteEscolhido = null;
    const campoFidelizado = {
      vendas: 'atendente_fidelizado_vendas',
      assistencia: 'atendente_fidelizado_assistencia',
      financeiro: 'atendente_fidelizado_financeiro',
      fornecedor: 'atendente_fidelizado_fornecedor'
    }[setor];

    if (contact[campoFidelizado]) {
      atendenteEscolhido = await base44.asServiceRole.entities.User
        .get(contact[campoFidelizado])
        .catch(() => null);
    }

    // STEP 2: Buscar melhor por carga (se nao tem fidelizado)
    if (!atendenteEscolhido) {
      const usuarios = await base44.asServiceRole.entities.User.filter(
        { attendant_sector: setor },
        null,
        20
      ).catch(() => []);

      if (usuarios.length > 0) {
        // Calcular carga real
        const cargas = await Promise.all(
          usuarios.map(async (u) => {
            const ativas = await base44.asServiceRole.entities.MessageThread.filter(
              { assigned_user_id: u.id, status: 'aberta' },
              null,
              100
            ).catch(() => []);

            const minutosOcioso = u.last_assignment_at
              ? (Date.now() - new Date(u.last_assignment_at).getTime()) / 60000
              : 999;

            const prioridadeCliente = contact.is_vip ? 5 : (contact.classe_abc === 'A' ? 3 : 0);
            const score = (ativas.length * 10) - (Math.min(minutosOcioso, 60) * 0.5) - prioridadeCliente;

            return { usuario: u, carga: ativas.length, score };
          })
        );

        cargas.sort((a, b) => a.score - b.score);
        atendenteEscolhido = cargas[0]?.usuario || null;
      }
    }

    // STEP 3: Atribuir se encontrado
    if (atendenteEscolhido) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteEscolhido.id,
        routing_stage: 'ASSIGNED',
        entrou_na_fila_em: null
      });

      // Registrar historico
      const historico = thread.atendentes_historico || [];
      if (!historico.includes(atendenteEscolhido.id)) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          atendentes_historico: [...historico, atendenteEscolhido.id]
        }).catch(() => null);
      }

      // Notificar setor
      const sectorThreads = await base44.asServiceRole.entities.MessageThread.filter(
        { thread_type: 'sector_group', sector_key: `sector:${setor}` },
        '-created_date',
        1
      ).catch(() => []);

      if (sectorThreads[0]?.id) {
        await base44.asServiceRole.entities.Message.create({
          thread_id: sectorThreads[0].id,
          sender_id: 'nexus_agent',
          sender_type: 'user',
          content: `Nova conversa: ${contact.nome} (${tipoContato}) para ${atendenteEscolhido.full_name}`,
          channel: 'interno',
          visibility: 'internal_only'
        }).catch(() => null);
      }

      return Response.json({
        success: true,
        atendente_atribuido: true,
        atendente_id: atendenteEscolhido.id,
        setor
      });
    }

    // STEP 4: Sem atendente - entrar fila + contextualizar
    const agora = new Date().toISOString();

    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      routing_stage: 'ROUTED',
      entrou_na_fila_em: agora
    });

    // WorkQueueItem
    await base44.asServiceRole.entities.WorkQueueItem.create({
      tipo: 'manual',
      contact_id: contact.id,
      thread_id: thread.id,
      reason: 'urgente',
      severity: contact.is_vip ? 'critical' : 'high',
      owner_sector_id: setor,
      status: 'open',
      notes: `Aguardando atendente de ${setor} desde ${agora}`
    });

    // Mensagem contexto
    const perguntaContexto = {
      vendas: 'Qual produto ou configuracao voce procura?',
      assistencia: 'Pode descrever o problema?',
      financeiro: 'Qual pedido ou nota fiscal?',
      fornecedor: 'Qual empresa e tipo de produto?'
    }[setor] || 'Mais detalhes para agilizar?';

    const msgFila = `Ola, ${primeiroNome}! Direcionando para equipe de ${setor}. ${perguntaContexto}\nAssim que um atendente ficar disponivel, tera suas informacoes!`;

    // Enviar WhatsApp
    const integracaoData = await base44.asServiceRole.entities.WhatsAppIntegration
      .get(thread.whatsapp_integration_id)
      .catch(() => null);

    if (integracaoData?.instance_id) {
      const telefoneLimpo = (contact.telefone || '').replace(/\D/g, '');
      const telefoneE164 = telefoneLimpo.startsWith('55') ? `+${telefoneLimpo}` : `+55${telefoneLimpo}`;

      await fetch(`https://api.z-api.io/instances/${integracaoData.instance_id}/token/${integracaoData.api_key_provider}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: telefoneE164, message: msgFila })
      }).catch(() => null);

      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'nexus_agent',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: msgFila,
        channel: 'whatsapp',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        visibility: 'public_to_customer'
      }).catch(() => null);
    }

    // Log
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'skillQueueManager',
      triggered_by: 'processInbound',
      execution_mode: 'autonomous_safe',
      success: true,
      duration_ms: Date.now() - startTime,
      metricas: { enfileirado: true, sector: setor }
    }).catch(() => null);

    return Response.json({
      success: true,
      atendente_atribuido: false,
      enfileirado: true,
      setor
    });

  } catch (error) {
    console.error('[QUEUE] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});