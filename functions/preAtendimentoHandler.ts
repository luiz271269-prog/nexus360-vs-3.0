// redeploy: 2026-03-03T15:10
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// PRÉ-ATENDIMENTO HANDLER v11.0.0-INLINE
// Sem nenhum import local - tudo inlinado
// ============================================================================

const PRE_ATENDIMENTO_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos (ajustável)

// --- Inline: emojiHelper (processTextWithEmojis only) ---
function processTextWithEmojis(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '').replace(/\s+/g, ' ').trim();
}

// --- Inline: MenuBuilder ---
function construirMenuBoasVindas(nomeContato) {
  const nome = nomeContato && !/^\d+$/.test(nomeContato) ? nomeContato.split(' ')[0] : '';
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'bom dia' : (hora < 18 ? 'boa tarde' : 'boa noite');
  return `👋 Olá${nome ? ` ${nome}` : ''}! ${saudacao}!\n\nEstou aqui para te conectar com a equipe certa.\n\n🎯 *Para qual setor você gostaria de falar?*\n\n1️⃣ 💼 Vendas\n2️⃣ 💰 Financeiro\n3️⃣ 🔧 Suporte Técnico\n4️⃣ 📦 Fornecedores\n\nDigite o número da opção:`;
}

// --- Inline: enviarMensagem ---
// Bug #9 fix: retornar sucesso/falha para condicionar avanço de estado
async function enviarMensagem(base44, contact, integrationId, texto) {
  try {
    const resultado = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: integrationId,
      numero_destino: contact.telefone,
      mensagem: processTextWithEmojis(texto)
    });
    if (resultado?.data?.success === false) {
      console.error('[PRE-ATENDIMENTO] Envio retornou erro:', resultado.data.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[PRE-ATENDIMENTO] Falha ao enviar msg:', e.message);
    return false;
  }
}

async function atualizarEstado(base44, threadId, novoEstado, setorId = undefined) {
  const updateData = {
    pre_atendimento_state: novoEstado,
    pre_atendimento_ativo: true,  // Bug fix: garantir que sempre está true durante o fluxo
    pre_atendimento_last_interaction: new Date().toISOString(),
    pre_atendimento_timeout_at: new Date(Date.now() + PRE_ATENDIMENTO_TIMEOUT_MS).toISOString()
  };
  if (setorId !== undefined) updateData.sector_id = setorId;
  await base44.asServiceRole.entities.MessageThread.update(threadId, updateData);
}

// --- Inline: FluxoController ---
async function processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, user_input = null, intent_context = null) {
  console.log('[FLUXO] INIT | Input:', user_input?.content, '| IA:', intent_context ? 'Sim' : 'Não');

  // ════════════════════════════════════════════════════════════════
  // [FIX 2] CONTEXTO VIA NEXUS BRAIN ANTES DO MENU
  // Se contato tem histórico, buscar contexto antes de perguntar
  // ════════════════════════════════════════════════════════════════
  let contextoHistorico = null;
  if (!intent_context && contact?.id && thread?.last_message_at) {
    console.log('[FLUXO] [FIX 2] Buscando contexto histórico para:', contact.nome);
    try {
      // Usar fire-and-forget do Brain para enriquecer a memória do contato
      await base44.asServiceRole.functions.invoke('atualizarMemoriaContato', {
        contact_id: contact.id,
        thread_id: thread.id
      }).catch(e => console.warn('[FLUXO] [FIX 2] Brain contexto falhou:', e.message));
    } catch (e) {
      console.warn('[FLUXO] [FIX 2] Erro ao chamar atualizarMemoriaContato:', e.message);
    }
  }

  // Fast-track via IA — Bug 5 fix: normalizar sector_slug para nome interno correto
  const SLUG_NORMALIZER = {
    'suporte': 'assistencia', 'support': 'assistencia', 'tecnico': 'assistencia',
    'vendas': 'vendas', 'comercial': 'vendas', 'sales': 'vendas',
    'financeiro': 'financeiro', 'finance': 'financeiro',
    'fornecedor': 'fornecedor', 'fornecedores': 'fornecedor', 'compras': 'fornecedor',
  };
  if (intent_context?.sector_slug && intent_context.confidence >= 70) {
    const setorNormalizado = SLUG_NORMALIZER[intent_context.sector_slug.toLowerCase()] || intent_context.sector_slug;
    const msg = `✅ Entendi! Vou te direcionar para *${setorNormalizado.toUpperCase()}*.`;
    const enviou = await enviarMensagem(base44, contact, whatsappIntegrationId, msg);
    if (!enviou) {
      console.error('[PRE-ATENDIMENTO] ⚠️ Fast-track: envio falhou, mantendo INIT');
      return { success: false, mode: 'fast_track_send_failed' };
    }
    await atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', setorNormalizado);
    thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    return await processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system', content: '' }, whatsappIntegrationId);
  }

  // Sticky setor
  if (thread.sector_id && !intent_context) {
    const msgSticky = `Olá novamente, ${contact.nome}! 👋\n\nVi que seu último atendimento foi em *${thread.sector_id.toUpperCase()}*. Deseja continuar por lá?\n\n1️⃣ Sim, continuar\n2️⃣ Não, outro assunto`;
    const stickyOk = await enviarMensagem(base44, contact, whatsappIntegrationId, msgSticky);
    if (!stickyOk) return { success: false, mode: 'sticky_send_failed' };
    await atualizarEstado(base44, thread.id, 'WAITING_STICKY_DECISION');
    return { success: true, mode: 'sticky' };
  }

  // Menu principal — listMessage (W-API) ou texto numerado (Z-API, via enviarWhatsApp)
  const nomeMenu = contact.nome && !/^\d+$/.test(contact.nome) ? contact.nome.split(' ')[0] : '';
  const horaMenu = new Date().getHours();
  const saudacaoMenu = horaMenu < 12 ? 'Bom dia' : (horaMenu < 18 ? 'Boa tarde' : 'Boa noite');
  const descricaoMenu = `👋 Olá${nomeMenu ? ` ${nomeMenu}` : ''}! ${saudacaoMenu}! Estou aqui para te conectar com a equipe certa. 🎯`;
  let menuEnviado = false;
  try {
    const res = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
      integration_id: whatsappIntegrationId,
      numero_destino: contact.telefone,
      type: 'list',
      mensagem: descricaoMenu,
      listTitle: '👋 Como podemos te ajudar?',
      listButtonText: 'Ver opções',
      listFooter: 'Liesch Informática',
      listSectionTitle: 'Setores disponíveis',
      interactive_buttons: [
        { rowId: 'setor_vendas',       title: '🛒 Vendas',          description: 'Orçamentos e compras' },
        { rowId: 'setor_financeiro',   title: '💰 Financeiro',       description: 'Pagamentos e cobranças' },
        { rowId: 'setor_suporte',      title: '🔧 Suporte Técnico',  description: 'Assistência e manutenção' },
        { rowId: 'setor_fornecedores', title: '📦 Fornecedores',     description: 'Pedidos e cotações' },
        { rowId: 'setor_livre',        title: '💬 Falar com alguém', description: 'Diga o nome ou setor desejado' },
      ]
    });
    // Bug #9 fix: verificar se envio realmente teve sucesso
    menuEnviado = res?.data?.success !== false;
  } catch (e) {
    console.error('[PRE-ATENDIMENTO] Falha ao enviar list menu:', e.message);
  }
  
  // Bug #9 fix: condicionar avanço de estado ao sucesso do envio
  if (menuEnviado) {
    await atualizarEstado(base44, thread.id, 'WAITING_SECTOR_CHOICE');
    return { success: true, mode: 'menu_list' };
  } else {
    console.error('[PRE-ATENDIMENTO] ⚠️ Menu não enviado, mantendo INIT para retry');
    return { success: false, mode: 'menu_send_failed' };
  }
}

async function processarWAITING_STICKY_DECISION(base44, thread, contact, user_input, whatsappIntegrationId) {
  const entrada = (user_input.content || user_input.id || '').toLowerCase();

  if (['sim', '1', 'quero'].some(x => entrada.includes(x))) {
    const ok = await enviarMensagem(base44, contact, whatsappIntegrationId, `Combinado! Retornando para *${thread.sector_id}*...`);
    if (!ok) return { success: false, mode: 'sticky_confirm_send_failed' };
    await atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', thread.sector_id);
    thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    return await processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system' }, whatsappIntegrationId);
  }

  if (['nao', 'não', '2', 'menu', 'outro'].some(x => entrada.includes(x))) {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'INIT',
      sector_id: null,
      assigned_user_id: null
    });
    thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    return await processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, null, null);
  }

  // Fallback — Bug #8 fix: avisar antes de reapresentar menu
  const fallbackOk = await enviarMensagem(base44, contact, whatsappIntegrationId,
    `Não entendi sua resposta. 😊 Vou te mostrar o menu novamente.`
  );
  if (!fallbackOk) return { success: false, mode: 'sticky_fallback_send_failed' };
  await base44.asServiceRole.entities.MessageThread.update(thread.id, {
    pre_atendimento_state: 'INIT',
    sector_id: null,
    assigned_user_id: null
  });
  thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
  return await processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, null, null);
}

async function processarWAITING_SECTOR_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
  // AJUSTE 3 — Ler selectedRowId do listMessage PRIMEIRO
  const selectedRowId = user_input?.listResponseMessage?.singleSelectReply?.selectedRowId
    || user_input?.interactive?.list_reply?.id
    || user_input?.selectedRowId;

  const MAPA_SETORES = {
    'setor_vendas':       'vendas',
    'setor_financeiro':   'financeiro',
    'setor_suporte':      'assistencia',   // AJUSTE 4: suporte → assistencia
    'setor_fornecedores': 'fornecedor',
    'setor_livre':        'livre',
  };

  if (selectedRowId) {
    const setor = MAPA_SETORES[selectedRowId];
    console.log(`[PRE-ATENDIMENTO] 🔘 selectedRowId=${selectedRowId} → setor=${setor}`);

    if (setor === 'livre') {
      const livreOk = await enviarMensagem(base44, contact, whatsappIntegrationId, 'Com quem ou qual setor você deseja falar? 😊');
      if (!livreOk) return { success: false, mode: 'livre_send_failed' };
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
        pre_atendimento_last_interaction: new Date().toISOString()
      });
      return { success: true, mode: 'livre' };
    }

    if (setor) {
      const ok = await enviarMensagem(base44, contact, whatsappIntegrationId, `Você escolheu: *${setor.toUpperCase()}*.\nBuscando atendentes...`);
      if (!ok) return { success: false, mode: 'sector_rowid_send_failed' };
      await atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', setor);
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        ura_respondida_at: new Date().toISOString()
      });
      thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
      return await processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system' }, whatsappIntegrationId);
    }
  }

  // Fallback: lógica de texto para quem digitar manualmente
  // Bug 6 fix: números usam match exato (=== '1') para evitar includes('1') em "R$100", "13h" etc.
  const entrada = (user_input.content || user_input.id || '').toLowerCase().trim();
  let setor = null;

  if (entrada === '1' || ['vendas', 'comercial'].some(k => entrada.includes(k))) setor = 'vendas';
  else if (entrada === '2' || ['financeiro', 'fat', 'boleto'].some(k => entrada.includes(k))) setor = 'financeiro';
  else if (entrada === '3' || ['suporte', 'tecnico', 'ajuda', 'assistencia'].some(k => entrada.includes(k))) setor = 'assistencia';
  else if (entrada === '4' || ['fornecedor', 'compras'].some(k => entrada.includes(k))) setor = 'fornecedor';

  if (setor) {
    const ok = await enviarMensagem(base44, contact, whatsappIntegrationId, `Você escolheu: *${setor.toUpperCase()}*.\nBuscando atendentes...`);
    if (!ok) return { success: false, mode: 'sector_text_send_failed' };
    await atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', setor);
    await base44.asServiceRole.entities.MessageThread.update(thread.id, { ura_respondida_at: new Date().toISOString() });
    thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
    return await processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system' }, whatsappIntegrationId);
  }

  const invalidOk = await enviarMensagem(base44, contact, whatsappIntegrationId, "❌ Opção inválida. Digite o número ou nome do setor.\n\n" + construirMenuBoasVindas(contact.nome));
  if (!invalidOk) return { success: false, mode: 'invalid_option_send_failed' };
  return { success: false };
}

async function processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
  const setor = thread.sector_id;
  try {
    const rota = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
      thread_id: thread.id,
      contact_id: contact.id,
      sector: setor,
      whatsapp_integration_id: whatsappIntegrationId,
      check_only: false
    });

    if (rota.data?.success && rota.data?.atendente_id) {
      const atendenteNome = rota.data.atendente_nome || 'um atendente';
      const enviado = await enviarMensagem(base44, contact, whatsappIntegrationId, `🥳 Encontrei o atendente *${atendenteNome}* para você! Transferindo...`);
      if (!enviado) console.error('[PRE-ATENDIMENTO] ⚠️ Msg atribuição falhou, mas agente FOI atribuído — completando mesmo assim');
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'COMPLETED',
        pre_atendimento_ativo: false,
        pre_atendimento_completed_at: new Date().toISOString()
      });
      return { success: true, allocated: true, msg_enviada: enviado };
    }

    const msgFila = `No momento, todos os atendentes de *${setor || 'geral'}* estão ocupados. 😕\n\nDeseja aguardar na fila?\n\n1️⃣ Sim, entrar na fila\n2️⃣ Escolher outro setor`;
    const filaOk = await enviarMensagem(base44, contact, whatsappIntegrationId, msgFila);
    if (!filaOk) return { success: false, mode: 'queue_msg_send_failed' };
    await atualizarEstado(base44, thread.id, 'WAITING_QUEUE_DECISION');
    return { success: true, waiting_queue: true };

  } catch (e) {
    console.error('[FLUXO] Erro no roteamento:', e.message);
    await enviarMensagem(base44, contact, whatsappIntegrationId, "Houve um erro técnico. Vamos tentar novamente.");
    return { success: false, error: e.message };
  }
}

async function processarWAITING_QUEUE_DECISION(base44, thread, contact, user_input, whatsappIntegrationId) {
  const entrada = (user_input.content || user_input.id || '').toLowerCase();

  if (['sim', '1'].some(x => entrada.includes(x))) {
    await base44.asServiceRole.functions.invoke('gerenciarFila', {
      action: 'enqueue',
      thread_id: thread.id,
      setor: thread.sector_id,
      metadata: { nome: contact.nome }
    });
    const queuedOk = await enviarMensagem(base44, contact, whatsappIntegrationId, `✅ Você está na fila! Assim que alguém liberar, você será chamado.`);
    if (!queuedOk) console.error('[PRE-ATENDIMENTO] ⚠️ Msg confirmação fila falhou, mas contato FOI enfileirado — completando mesmo assim');
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_ativo: false,
      pre_atendimento_completed_at: new Date().toISOString()
    });
    return { success: true, queued: true, msg_enviada: queuedOk };
  }

  thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
  return await processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, null, null);
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
    const { thread_id, contact_id, whatsapp_integration_id, user_input, intent_context } = payload;

    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'thread_id e contact_id são obrigatórios' }, { status: 400 });
    }

    const userInput = user_input || { type: 'text', content: '' };

    let [thread, contact] = await Promise.all([
      base44.asServiceRole.entities.MessageThread.get(thread_id),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    console.log('[PRE-ATENDIMENTO] Thread:', thread.id, '| Estado:', thread.pre_atendimento_state);

    // Política de libertação
    if (['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(thread.pre_atendimento_state)) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'INIT',
        pre_atendimento_ativo: true,
        pre_atendimento_started_at: new Date().toISOString(),
        pre_atendimento_completed_at: null,
        assigned_user_id: null,
        sector_id: null
      });
      thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    }

    // Verificação de timeout
    if (thread.pre_atendimento_timeout_at && thread.pre_atendimento_state !== 'INIT') {
      if (new Date() >= new Date(thread.pre_atendimento_timeout_at)) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_timeout_at: null,
          pre_atendimento_started_at: new Date().toISOString()
        });
        thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      }
    }

    // Buscar integração
    let whatsappIntegration = payload.whatsappIntegration || null;
    if (!whatsappIntegration && whatsapp_integration_id) {
      whatsappIntegration = await base44.asServiceRole.entities.WhatsAppIntegration.get(whatsapp_integration_id);
    }
    if (!whatsappIntegration) {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-created_date', 1);
      if (integracoes.length > 0) whatsappIntegration = integracoes[0];
      else return Response.json({ success: false, error: 'Nenhuma integração WhatsApp ativa' }, { status: 500 });
    }

    const estadoAtual = thread.pre_atendimento_state || 'INIT';
    console.log('[PRE-ATENDIMENTO] Processando estado:', estadoAtual);

    let resultado;
    switch (estadoAtual) {
      case 'INIT':
        resultado = await processarEstadoINIT(base44, thread, contact, whatsappIntegration.id, userInput, intent_context);
        break;
      case 'WAITING_SECTOR_CHOICE':
        resultado = await processarWAITING_SECTOR_CHOICE(base44, thread, contact, userInput, whatsappIntegration.id);
        break;
      case 'WAITING_STICKY_DECISION':
        resultado = await processarWAITING_STICKY_DECISION(base44, thread, contact, userInput, whatsappIntegration.id);
        break;
      case 'WAITING_ATTENDANT_CHOICE':
        resultado = await processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, userInput, whatsappIntegration.id);
        break;
      case 'WAITING_QUEUE_DECISION':
        resultado = await processarWAITING_QUEUE_DECISION(base44, thread, contact, userInput, whatsappIntegration.id);
        break;
      default:
        resultado = { success: false, erro: `Estado desconhecido: ${estadoAtual}` };
    }

    // Log de automação (não-crítico)
    try {
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'pre_atendimento_step',
        thread_id: thread.id,
        contact_id: contact.id,
        resultado: resultado.success ? 'sucesso' : 'erro',
        timestamp: new Date().toISOString(),
        detalhes: { estado_inicial: estadoAtual, user_input: userInput, resultado }
      });
    } catch (e) {}

    console.log('[PRE-ATENDIMENTO] ✅ Concluído:', resultado);
    return Response.json({ success: resultado.success !== false, estado_atual: estadoAtual, resultado }, { status: 200, headers });

  } catch (error) {
    console.error('[PRE-ATENDIMENTO] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});