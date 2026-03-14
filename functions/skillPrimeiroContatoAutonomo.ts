// ============================================================================
// SKILL: Primeiro Contato Autônomo v1.0.0
// ============================================================================
// Detecta quando menu de pré-atendimento falha e age automaticamente:
// 1. Identifica intenção via IA ("montar pc gamer" → vendas)
// 2. Roteia para setor correto
// 3. Atribui atendente disponível
// 4. Envia boas-vindas humanizadas
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SETOR_MAP = {
  'vendas': ['venda', 'comprar', 'orçamento', 'preço', 'cotação', 'produto', 'pc', 'notebook', 'gamer'],
  'assistencia': ['suporte', 'problema', 'defeito', 'conserto', 'não funciona', 'garantia', 'assistência'],
  'financeiro': ['boleto', 'pagamento', 'fatura', 'parcela', 'financeiro', 'cobrança'],
  'fornecedor': ['fornecedor', 'compras', 'parceria', 'distribuidor']
};

function detectarSetorPorIntencao(mensagem) {
  const texto = mensagem.toLowerCase().trim();
  
  // Match exato de palavras-chave
  for (const [setor, palavras] of Object.entries(SETOR_MAP)) {
    if (palavras.some(p => texto.includes(p))) {
      return setor;
    }
  }
  
  // Fallback: vendas (maioria dos leads)
  return 'vendas';
}

async function buscarAtendenteDisponivel(base44, setor) {
  try {
    const usuarios = await base44.asServiceRole.entities.User.filter({
      attendant_sector: setor,
      is_whatsapp_attendant: true,
      availability_status: { $in: ['online', 'disponível'] }
    }, 'current_conversations_count', 10);

    // Retornar menos carregado
    return usuarios.length > 0 ? usuarios[0] : null;
  } catch (e) {
    console.warn('[SKILL-PRIMEIRO-CONTATO] Erro ao buscar atendente:', e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const tsInicio = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only (automação ou comando manual)
    if (user?.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403, headers }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const { thread_id, contact_id, force_retry, batch_mode } = payload;

    // ══════════════════════════════════════════════════════════════════
    // MODO BATCH: Processar todas as threads travadas
    // ══════════════════════════════════════════════════════════════════
    if (batch_mode) {
      const threadsTravadas = await base44.asServiceRole.entities.MessageThread.filter({
        thread_type: 'contact_external',
        assigned_user_id: { $exists: false },
        pre_atendimento_state: { $in: ['WAITING_SECTOR_CHOICE', 'WAITING_QUEUE_DECISION', 'TIMEOUT'] },
        status: 'aberta'
      }, '-last_message_at', 20);

      const resultados = {
        processadas: 0,
        resgatadas: 0,
        enfileiradas: 0,
        erros: 0
      };

      for (const thread of threadsTravadas) {
        try {
          const resultado = await processarThread(base44, thread.id, tsInicio);
          resultados.processadas++;
          if (resultado.action === 'primeiro_contato_completado') resultados.resgatadas++;
          if (resultado.action === 'enfileirado') resultados.enfileiradas++;
        } catch (err) {
          console.error(`[SKILL-BATCH] Erro thread ${thread.id}:`, err.message);
          resultados.erros++;
        }
      }

      return Response.json({
        success: true,
        batch_mode: true,
        resultados
      }, { headers });
    }

    // ══════════════════════════════════════════════════════════════════
    // MODO INDIVIDUAL: Processar thread específica
    // ══════════════════════════════════════════════════════════════════
    if (!thread_id) {
      return Response.json(
        { success: false, error: 'thread_id obrigatório (ou use batch_mode: true)' },
        { status: 400, headers }
      );
    }

    const resultado = await processarThread(base44, thread_id, tsInicio, force_retry);
    return Response.json(resultado, { headers });

  } catch (error) {
    console.error('[SKILL-PRIMEIRO-CONTATO] ❌ Erro:', error.message);

    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'primeiro_contato_autonomo',
      triggered_by: 'menu_falhou',
      execution_mode: 'autonomous_safe',
      success: false,
      error_message: error.message,
      duration_ms: Date.now() - tsInicio
    }).catch(() => {});

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

// ══════════════════════════════════════════════════════════════════════
// Função principal de processamento
// ══════════════════════════════════════════════════════════════════════
async function processarThread(base44, thread_id, tsInicio, force_retry = false) {
  const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

    // Só atua em threads SEM atendente ou em estado de pré-atendimento travado
    const precisaResgate = 
      !thread.assigned_user_id && 
      (thread.pre_atendimento_state === 'WAITING_SECTOR_CHOICE' || 
       thread.pre_atendimento_state === 'WAITING_QUEUE_DECISION' ||
       thread.pre_atendimento_state === 'TIMEOUT' ||
       force_retry);

    if (!precisaResgate) {
      return Response.json({
        success: false,
        skipped: true,
        reason: 'Thread já tem atendente ou não precisa de resgate'
      }, { headers });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Buscar contexto
    // ══════════════════════════════════════════════════════════════════
    const [contact, mensagens] = await Promise.all([
      thread.contact_id 
        ? base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null)
        : null,
      base44.asServiceRole.entities.Message.filter(
        { thread_id, sender_type: 'contact' },
        'created_date',
        10
      ).catch(() => [])
    ]);

    if (!contact) {
      return Response.json({
        success: false,
        error: 'Thread sem contact_id válido'
      }, { status: 400, headers });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 3: Identificar intenção do contato
    // ══════════════════════════════════════════════════════════════════
    const textoCompleto = mensagens
      .map(m => m.content)
      .filter(Boolean)
      .join(' ');

    const setorDetectado = detectarSetorPorIntencao(textoCompleto);
    console.log(`[SKILL-PRIMEIRO-CONTATO] 🎯 Setor detectado: ${setorDetectado} (texto: "${textoCompleto.substring(0, 50)}")`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 4: Buscar atendente disponível
    // ══════════════════════════════════════════════════════════════════
    const atendente = await buscarAtendenteDisponivel(base44, setorDetectado);

    if (!atendente) {
      console.warn(`[SKILL-PRIMEIRO-CONTATO] ⚠️ Nenhum atendente disponível em ${setorDetectado} — criando WorkQueueItem`);
      
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id: contact.id,
        thread_id: thread.id,
        tipo: 'manual',
        reason: 'primeiro_contato_sem_atendente',
        severity: 'high',
        status: 'open',
        notes: `🆕 Primeiro contato detectado: "${textoCompleto.substring(0, 100)}"\nSetor identificado: ${setorDetectado}\n⚠️ Sem atendente disponível no momento.`
      });

      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        sector_id: setorDetectado,
        pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE',
        pre_atendimento_ativo: false
      });

      return Response.json({
        success: true,
        action: 'enfileirado',
        setor_detectado: setorDetectado,
        message: 'Thread enfileirada para atendimento manual'
      }, { headers });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 5: Atribuir atendente
    // ══════════════════════════════════════════════════════════════════
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      assigned_user_id: atendente.id,
      sector_id: setorDetectado,
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_ativo: false,
      pre_atendimento_completed_at: new Date().toISOString(),
      atendentes_historico: [atendente.id]
    });

    console.log(`[SKILL-PRIMEIRO-CONTATO] ✅ Atribuído para ${atendente.full_name} (${setorDetectado})`);

    // ══════════════════════════════════════════════════════════════════
    // STEP 6: Gerar mensagem de boas-vindas via IA
    // ══════════════════════════════════════════════════════════════════
    let mensagemBoasVindas = null;

    try {
      const prompt = `Você é o atendente ${atendente.full_name || 'da equipe'} de ${setorDetectado}.

Cliente novo "${contact.nome}" enviou:
"${textoCompleto}"

Gere uma mensagem de boas-vindas CURTA (máximo 2 linhas) e profissional que:
1. Cumprimente pelo nome
2. Mostre que entendeu o pedido
3. Ofereça ajuda

Exemplo: "Olá Kauã! Vi que você quer montar um PC gamer. Vou te ajudar a encontrar as melhores opções! 🎮"

NÃO use emojis em excesso. Tom: profissional mas amigável.`;

      const resposta = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash'
      });

      mensagemBoasVindas = typeof resposta === 'string' ? resposta : resposta?.text || null;
    } catch (e) {
      console.warn('[SKILL-PRIMEIRO-CONTATO] ⚠️ IA falhou, usando fallback:', e.message);
      mensagemBoasVindas = `Olá ${contact.nome}! Obrigado pelo contato. Vou te atender agora! 😊`;
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 7: Enviar via WhatsApp
    // ══════════════════════════════════════════════════════════════════
    if (thread.whatsapp_integration_id && contact.telefone && mensagemBoasVindas) {
      try {
        const respEnvio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: thread.whatsapp_integration_id,
          numero_destino: contact.telefone,
          mensagem: mensagemBoasVindas
        });

        if (respEnvio.data?.success) {
          // Salvar mensagem no histórico
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'nexus_agent',
            sender_type: 'user',
            content: mensagemBoasVindas,
            channel: 'whatsapp',
            status: 'enviada',
            sent_at: new Date().toISOString(),
            visibility: 'public_to_customer',
            metadata: {
              is_ai_response: true,
              ai_agent: 'skill_primeiro_contato',
              assigned_to: atendente.id,
              assigned_to_name: atendente.full_name
            }
          });

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_message_content: mensagemBoasVindas.substring(0, 100),
            unread_count: 0
          });

          console.log(`[SKILL-PRIMEIRO-CONTATO] ✅ Boas-vindas enviadas para ${contact.nome}`);
        }
      } catch (envioErr) {
        console.error('[SKILL-PRIMEIRO-CONTATO] ❌ Erro ao enviar WhatsApp:', envioErr.message);
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 8: Registrar execução
    // ══════════════════════════════════════════════════════════════════
    await base44.asServiceRole.entities.SkillExecution.create({
      skill_name: 'primeiro_contato_autonomo',
      triggered_by: 'menu_falhou',
      execution_mode: 'autonomous_safe',
      context: {
        thread_id: thread.id,
        contact_id: contact.id,
        setor_detectado: setorDetectado,
        atendente_atribuido: atendente.id,
        mensagem_enviada: !!mensagemBoasVindas
      },
      success: true,
      duration_ms: Date.now() - tsInicio
    }).catch(() => {});

  return {
    success: true,
    action: 'primeiro_contato_completado',
    setor_detectado: setorDetectado,
    atendente_atribuido: atendente.full_name,
    mensagem_enviada: mensagemBoasVindas
  };
}