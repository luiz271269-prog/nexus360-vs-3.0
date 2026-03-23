// ============================================================================
// SKILL 03 — QUEUE MANAGER v1.1
// ============================================================================
// Objetivo: Buscar atendente fidelizado → menor carga → fallback setor geral
// Sem atendente: enfileira + pergunta qualificadora + boas-vindas LLM
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

interface QueuePayload {
  thread_id: string;
  contact_id: string;
  integration_id: string;
  sector_id: string;
}

const PERGUNTAS_QUALIFICADORA = {
  vendas: '📦 Qual produto ou serviço você está procurando?',
  assistencia: '🔧 Pode descrever o problema em detalhes?',
  financeiro: '💳 É sobre um boleto, fatura ou débito?',
  fornecedor: '🤝 Qual é o interesse de parceria?'
};

async function buscarMelhorAtendente(base44: any, setor: string, contact: any): Promise<any> {
  // 1º: atendente fidelizado (MAS SÓ SE ONLINE)
  const campofidelizado = `atendente_fidelizado_${setor}`;
  if (contact[campofidelizado]) {
    try {
      const user = await base44.asServiceRole.entities.User.get(contact[campofidelizado]);
      if (user && user.availability_status === 'online') {
        console.log(`[QUEUE] 🎯 Atendente fidelizado ONLINE: ${user.full_name}`);
        return user;
      } else {
        // ✅ FIX: Atendente fidelizado OFFLINE → não bloqueia, continua para fallback
        console.warn(`[QUEUE] ⚠️ Atendente fidelizado ${user?.full_name} OFFLINE, buscando alternativa`);
      }
    } catch (e) {
      console.warn('[QUEUE] Atendente fidelizado não encontrado:', (e as any).message);
    }
  }

  // 2º: menor carga no setor (sem filtro de status — horário comercial já garantido)
  try {
    let usuarios = await base44.asServiceRole.entities.User.filter(
      {
        attendant_sector: setor,
        is_whatsapp_attendant: true
      },
      'current_conversations_count',
      20
    );

    // Excluir atendente fidelizado se já foi tentado (evita repetição)
    const fidielizado = contact[`atendente_fidelizado_${setor}`];
    if (fidielizado) {
      usuarios = usuarios.filter((u: any) => u.id !== fidielizado);
    }

    if (usuarios?.length > 0) {
      // Sort duplo: status (online first) + carga
      const sorted = usuarios.sort((a: any, b: any) => {
        const statusA = a.availability_status === 'online' ? 0 : 1;
        const statusB = b.availability_status === 'online' ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;
        return (a.current_conversations_count || 0) - (b.current_conversations_count || 0);
      });
      console.log(`[QUEUE] 👥 Atendente alternativo: ${sorted[0].full_name} (setor: ${setor})`);
      return sorted[0];
    }
  } catch (e) {
    console.warn('[QUEUE] Erro ao buscar por setor:', (e as any).message);
  }

  // 3º: fallback setor geral
  try {
    const usuarios = await base44.asServiceRole.entities.User.filter(
      {
        attendant_sector: 'geral',
        is_whatsapp_attendant: true
      },
      'current_conversations_count',
      10
    );
    if (usuarios?.length > 0) {
      return usuarios[0];
    }
  } catch (e) {
    console.warn('[QUEUE] Fallback geral falhou:', (e as any).message);
  }

  console.log('[QUEUE] ❌ Nenhum atendente disponível');
  return null;
}

async function gerarBoasVindas(base44: any, contact: any, setor: string, atendente: any): Promise<string> {
  try {
    const primeiroNome = (contact.nome || '').split(' ')[0];
    const nomeAtendente = atendente?.full_name || 'da equipe';

    const respLLM = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Gere uma boas-vindas específica para o atendimento em ${setor}:
Cliente: ${primeiroNome}
Atendente: ${nomeAtendente}
Tipo: ${contact.tipo_contato || 'novo'}

Máximo 2 linhas, máximo 1 emoji, tom profissional mas humano.
Reconheça o contato e confirme que será ajudado agora.`,
      response_json_schema: {
        type: 'object',
        properties: {
          mensagem: { type: 'string' }
        }
      }
    });

    return (respLLM as any).mensagem || '';
  } catch (e) {
    console.warn('[QUEUE] LLM falhou, usando fallback inline:', (e as any).message);
    const primeiroNome = (contact.nome || '').split(' ')[0];
    return `Olá ${primeiroNome}! ${contact.tipo_contato === 'cliente' ? 'Que bom ter você de volta.' : 'Bem-vindo!'} Vou te ajudar agora! 😊`;
  }
}

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const payload: QueuePayload = await req.json();
    const { thread_id, contact_id, integration_id, sector_id } = payload;

    // Fix 4 — Lock anti-duplicação: não atribuir se já houve outbound nos últimos 60s
    const threadCheck = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    if (threadCheck.last_outbound_at) {
      const diffMs = Date.now() - new Date(threadCheck.last_outbound_at).getTime();
      if (diffMs < 60_000) {
        console.log(`[QUEUE] 🔒 Lock 60s ativo (${Math.round(diffMs / 1000)}s) — skip`);
        return Response.json({ success: true, skipped: true, reason: 'lock_60s' }, { headers });
      }
    }

    if (!thread_id || !contact_id || !sector_id) {
      return Response.json(
        { success: false, error: 'Campos obrigatórios ausentes' },
        { status: 400, headers }
      );
    }

    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    const setor = sector_id || 'vendas';

    // Buscar melhor atendente
    const atendente = await buscarMelhorAtendente(base44, setor, contact);

    // CENÁRIO 1: Atendente disponível → atribuir + boas-vindas
    if (atendente) {
      console.log(`[QUEUE] ✅ Atendente encontrado: ${atendente.full_name}`);

      const boasVindas = await gerarBoasVindas(base44, contact, setor, atendente);

      // Atualizar thread
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        assigned_user_id: atendente.id,
        sector_id: setor,
        routing_stage: 'ASSIGNED',
        atendentes_historico: [atendente.id]
      }).catch(() => {});

      // 🆕 GAP-D: Briefing via Brain ao atendente (fire-and-forget)
      base44.asServiceRole.functions.invoke('nexusAgentBrain', {
        thread_id: thread_id,
        contact_id: contact_id,
        integration_id: integration_id,
        trigger: 'queue_assignment',
        message_content: `[BRIEFING AUTOMÁTICO] Novo contato atribuído: ${contact.nome} (${contact.tipo_contato}). Setor: ${setor}. Prepare um resumo contextual e sugestões para o atendimento.`,
        mode: 'copilot'
      }).catch(e => console.warn('[QUEUE] Brain briefing falhou (não-bloqueante):', (e as any).message));

      // Enviar mensagem de boas-vindas
      if (boasVindas && thread_id && integration_id) {
        try {
          await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id,
            numero_destino: contact.telefone,
            mensagem: boasVindas
          }).catch(() => {});
        } catch (e) {
          console.warn('[QUEUE] Erro ao enviar boas-vindas:', (e as any).message);
        }
      }

      return Response.json({
        success: true,
        action: 'assigned',
        atendente_id: atendente.id,
        atendente_nome: atendente.full_name,
        briefing_brain_triggered: true,
        duration_ms: Date.now() - tsInicio
      }, { headers });
    }

    // CENÁRIO 2: Sem atendente → enfileira + contexto
    console.log(`[QUEUE] 📋 Sem atendente, enfileirando...`);

    const perguntaQualificadora = PERGUNTAS_QUALIFICADORA[setor as keyof typeof PERGUNTAS_QUALIFICADORA] || PERGUNTAS_QUALIFICADORA.vendas;

    // Criar WorkQueueItem
    await base44.asServiceRole.entities.WorkQueueItem.create({
      contact_id,
      thread_id,
      tipo: 'manual',
      reason: 'sem_atendente_disponivel',
      severity: contact.is_vip ? 'critical' : 'high',
      status: 'open',
      owner_sector_id: setor,
      notes: `Contato: ${contact.nome}\nTipo: ${contact.tipo_contato}\nPerguntar: ${perguntaQualificadora}`
    }).catch(() => {});

    // Atualizar thread
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      sector_id: setor,
      routing_stage: 'ROUTED',
      entrou_na_fila_em: new Date().toISOString()
    }).catch(() => {});

    // Enviar pergunta qualificadora
    try {
      const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
      if (integracao?.instance_id_provider && integracao?.api_key_provider) {
        const telefoneLimpo = (contact.telefone || '').replace(/\D/g, '');
        const telefoneE164 = telefoneLimpo.startsWith('55') ? `+${telefoneLimpo}` : `+55${telefoneLimpo}`;

        await fetch(
          `https://api.z-api.io/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: telefoneE164, message: perguntaQualificadora })
          }
        ).then(r => r.json()).catch(() => {});
      }
    } catch (e) {
      console.warn('[QUEUE] Erro ao enviar pergunta:', (e as any).message);
    }

    return Response.json({
      success: true,
      action: 'queued',
      sector_id: setor,
      pergunta_qualificadora: perguntaQualificadora,
      duration_ms: Date.now() - tsInicio
    }, { headers });

  } catch (error) {
    console.error('[QUEUE] Erro:', error);
    return Response.json(
      { success: false, error: (error as any).message },
      { status: 500, headers }
    );
  }
});