// redeploy: 2026-03-15T18:30-FORCE
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// PRÉ-ATENDIMENTO HANDLER v12.0.0 - FLUXO CONVERSACIONAL NATURAL
// ============================================================================
// FLUXO:
//   INIT         → Envia saudação + pergunta aberta ("Em que posso ajudar?")
//   WAITING_NEED → Cliente respondeu → IA detecta setor → roteia para atendente
// ============================================================================

function processTextWithEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
}

async function enviarMensagem(base44, contact, integrationId, texto) {
  try {
    // Buscar credenciais da integração diretamente
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    if (!integracao) throw new Error('Integração não encontrada');

    const textoLimpo = processTextWithEmojis(texto);
    const numero = (contact.telefone || '').replace(/\D/g, '');
    const numeroFormatado = numero.startsWith('55') ? numero : '55' + numero;

    let endpoint, body, headers;

    if (integracao.api_provider === 'w_api') {
      endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${integracao.instance_id_provider}`;
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integracao.api_key_provider}` };
      body = { phone: numeroFormatado, message: textoLimpo, delayMessage: 1 };
    } else {
      // Z-API (padrão)
      const baseUrl = integracao.base_url_provider || 'https://api.z-api.io';
      endpoint = `${baseUrl}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      headers = { 'Content-Type': 'application/json', 'Client-Token': integracao.security_client_token_header };
      body = { phone: numeroFormatado, message: textoLimpo };
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok || data.error) {
      console.error('[PRE-ATENDIMENTO] Envio falhou:', data.error || res.status);
      return false;
    }

    console.log('[PRE-ATENDIMENTO] ✅ Mensagem enviada:', data.messageId || data.id);
    return true;
  } catch (e) {
    console.error('[PRE-ATENDIMENTO] Falha ao enviar msg:', e.message);
    return false;
  }
}

// Detectar setor pela mensagem usando IA
async function detectarSetorPorIA(base44, mensagem, contact) {
  try {
    const result = await base44.asServiceRole.functions.invoke('analisarIntencao', {
      mensagem,
      contexto: { contact_id: contact.id }
    });
    
    if (result?.data?.success && result.data.analise?.sector_slug) {
      const analise = result.data.analise;
      const SLUG_NORMALIZER = {
        'suporte': 'assistencia', 'support': 'assistencia', 'tecnico': 'assistencia',
        'vendas': 'vendas', 'comercial': 'vendas', 'sales': 'vendas',
        'financeiro': 'financeiro', 'finance': 'financeiro',
        'fornecedor': 'fornecedor', 'fornecedores': 'fornecedor', 'compras': 'fornecedor',
      };
      const setor = SLUG_NORMALIZER[analise.sector_slug?.toLowerCase()] || analise.sector_slug || 'geral';
      return { setor, confidence: analise.confidence || 0 };
    }
  } catch (e) {
    console.warn('[PRE-ATENDIMENTO] IA falhou:', e.message);
  }

  // Fallback: keywords simples
  const txt = mensagem.toLowerCase();
  if (/vend|compr|preco|preço|orçamento|orcamento|produto|catálogo|catalogo/.test(txt)) return { setor: 'vendas', confidence: 0.7 };
  if (/suport|técnic|tecnic|assistência|assistencia|reparo|quebr|defeito|problema/.test(txt)) return { setor: 'assistencia', confidence: 0.7 };
  if (/finan|boleto|pagamento|pagar|nf|nota|fiscal|cobr/.test(txt)) return { setor: 'financeiro', confidence: 0.7 };
  if (/fornec|compras|pedido|estoque|fatura|mercadoria/.test(txt)) return { setor: 'fornecedor', confidence: 0.7 };

  return { setor: 'geral', confidence: 0.3 };
}

// ============================================================================
// FLUXO: INIT — Saudação + pergunta aberta
// ============================================================================
async function processarINIT(base44, thread, contact, integrationId) {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = contact.nome && !/^\d+$/.test(contact.nome) ? `, ${contact.nome.split(' ')[0]}` : '';

  const msg = `👋 ${saudacao}${nome}! Seja bem-vindo(a)!\n\nEm que posso te ajudar hoje? 😊`;

  const enviou = await enviarMensagem(base44, contact, integrationId, msg);
  if (!enviou) {
    console.error('[PRE-ATENDIMENTO] Falha ao enviar saudação');
    return { success: false, mode: 'saudacao_send_failed' };
  }

  await base44.asServiceRole.entities.MessageThread.update(thread.id, {
    pre_atendimento_state: 'WAITING_NEED',
    pre_atendimento_ativo: true,
    pre_atendimento_started_at: new Date().toISOString(),
    pre_atendimento_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString() // 20min
  });

  console.log('[PRE-ATENDIMENTO] ✅ Saudação enviada, aguardando necessidade do cliente');
  return { success: true, mode: 'saudacao_enviada' };
}

// ============================================================================
// FLUXO: WAITING_NEED — Cliente respondeu, detectar setor e rotear
// ============================================================================
async function processarWAITING_NEED(base44, thread, contact, userInput, integrationId) {
  const mensagem = userInput.content || '';

  if (!mensagem.trim()) {
    return { success: true, mode: 'empty_message_ignored' };
  }

  console.log('[PRE-ATENDIMENTO] 🔍 Detectando setor para:', mensagem.substring(0, 80));

  // Detectar setor pela IA ou keywords
  const { setor } = await detectarSetorPorIA(base44, mensagem, contact);

  console.log('[PRE-ATENDIMENTO] 🎯 Setor detectado:', setor);

  // Atualizar setor na thread
  await base44.asServiceRole.entities.MessageThread.update(thread.id, {
    sector_id: setor,
    pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE'
  });

  // Tentar rotear para atendente
  let atendenteNome = null;
  let atendenteId = null;

  try {
    const rota = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
      thread_id: thread.id,
      contact_id: contact.id,
      sector: setor,
      whatsapp_integration_id: integrationId,
      check_only: false
    });

    if (rota.data?.success && rota.data?.assigned_to) {
      atendenteId = rota.data.assigned_to;
      atendenteNome = rota.data.assigned_to_name || 'um atendente';
    }
  } catch (e) {
    console.error('[PRE-ATENDIMENTO] Roteamento falhou:', e.message);
  }

  if (atendenteNome) {
    // Atendente encontrado → mensagem de transferência humanizada
    const primeiroNome = atendenteNome.split(' ')[0];
    const setorHumanizado = { vendas: 'Vendas', assistencia: 'Suporte Técnico', financeiro: 'Financeiro', fornecedor: 'Compras', geral: 'Atendimento' }[setor] || 'Atendimento';

    const msgTransferencia = `✅ Entendido! Estou te transferindo para *${primeiroNome}* (${setorHumanizado}).\n\nEle te atende logo que possível! 😊`;
    await enviarMensagem(base44, contact, integrationId, msgTransferencia);

    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_ativo: false,
      pre_atendimento_completed_at: new Date().toISOString(),
      pre_atendimento_setor_explicitamente_escolhido: true
    });

    console.log('[PRE-ATENDIMENTO] ✅ Transferido para:', atendenteNome);
    return { success: true, mode: 'transferido', atendente: atendenteNome };

  } else {
    // Sem atendente disponível → aviso de fila
    const setorHumanizado = { vendas: 'Vendas', assistencia: 'Suporte Técnico', financeiro: 'Financeiro', fornecedor: 'Compras', geral: 'Atendimento' }[setor] || 'Atendimento';

    const msgFila = `📋 Entendido! No momento, todos os atendentes de *${setorHumanizado}* estão ocupados.\n\nVocê ficará na fila e será atendido logo que possível! ⏳`;
    await enviarMensagem(base44, contact, integrationId, msgFila);

    // Enfileirar
    try {
      await base44.asServiceRole.functions.invoke('gerenciarFila', {
        action: 'enqueue',
        thread_id: thread.id,
        setor,
        metadata: { nome: contact.nome }
      });
    } catch (e) {
      console.warn('[PRE-ATENDIMENTO] Falha ao enfileirar:', e.message);
      // Criar item manual na fila como fallback
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id: contact.id,
        thread_id: thread.id,
        tipo: 'idle_reativacao',
        reason: 'sem_atendente_disponivel',
        severity: 'high',
        owner_sector_id: setor,
        status: 'open'
      });
    }

    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_ativo: false,
      pre_atendimento_completed_at: new Date().toISOString()
    });

    return { success: true, mode: 'enfileirado', setor };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  try {
    const { thread_id, contact_id, whatsapp_integration_id, user_input } = payload;

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'thread_id e contact_id são obrigatórios' }, { status: 400 });
    }

    const userInput = user_input || { type: 'text', content: '' };

    // Usar sempre serviceRole para funcionar tanto via webhook quanto via invoke direto
  let [thread, contact] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    // Resolver integração WhatsApp
    let integrationId = whatsapp_integration_id || thread.whatsapp_integration_id;
    if (!integrationId) {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-created_date', 1);
      if (integracoes.length > 0) integrationId = integracoes[0].id;
      else return Response.json({ success: false, error: 'Nenhuma integração WhatsApp ativa' }, { status: 500 });
    }

    const estado = thread.pre_atendimento_state || 'INIT';
    console.log('[PRE-ATENDIMENTO v12] Thread:', thread_id, '| Estado:', estado);

    // Verificar timeout (20 min) → resetar para INIT
    if (thread.pre_atendimento_timeout_at && estado !== 'INIT') {
      if (new Date() >= new Date(thread.pre_atendimento_timeout_at)) {
        console.log('[PRE-ATENDIMENTO] Timeout detectado → resetando para INIT');
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_timeout_at: null
        });
        thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      }
    }

    // Estados finalizados → reiniciar
    if (['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(estado)) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'INIT',
        pre_atendimento_ativo: true,
        pre_atendimento_completed_at: null,
        assigned_user_id: null,
        sector_id: null
      });
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    }

    const estadoFinal = thread.pre_atendimento_state || 'INIT';

    let resultado;
    switch (estadoFinal) {
      case 'INIT':
        resultado = await processarINIT(base44, thread, contact, integrationId);
        break;

      case 'WAITING_NEED':
        resultado = await processarWAITING_NEED(base44, thread, contact, userInput, integrationId);
        break;

      // Compatibilidade com estados legados
      case 'WAITING_SECTOR_CHOICE':
      case 'WAITING_STICKY_DECISION':
        resultado = await processarWAITING_NEED(base44, thread, contact, userInput, integrationId);
        break;

      case 'WAITING_ATTENDANT_CHOICE':
      case 'WAITING_QUEUE_DECISION':
        resultado = await processarWAITING_NEED(base44, thread, contact, userInput, integrationId);
        break;

      default:
        resultado = await processarINIT(base44, thread, contact, integrationId);
    }

    // Log não-crítico
    try {
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'resposta_ia',
        thread_id: thread.id,
        contato_id: contact.id,
        resultado: resultado.success ? 'sucesso' : 'erro',
        timestamp: new Date().toISOString(),
        detalhes: { estado_inicial: estadoFinal, resultado }
      });
    } catch (e) {}

    console.log('[PRE-ATENDIMENTO v12] ✅ Concluído:', resultado);
    return Response.json({ success: resultado.success !== false, estado: estadoFinal, resultado }, { status: 200, headers });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO v12] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});