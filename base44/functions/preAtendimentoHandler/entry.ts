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
  // ⚠️ BLOQUEIO: Cliente com atendente fidelizado — rotear direto sem menu de setor
  if (contact.tipo_contato === 'cliente' || contact.tipo_contato === 'lead') {
    const camposFidelizados = {
      vendas: contact.atendente_fidelizado_vendas,
      assistencia: contact.atendente_fidelizado_assistencia,
      financeiro: contact.atendente_fidelizado_financeiro,
      fornecedor: contact.atendente_fidelizado_fornecedor
    };

    let setorFidelizado = null;
    let atendenteIdFidelizado = null;

    for (const [setor, valor] of Object.entries(camposFidelizados)) {
      if (valor && /^[a-f0-9]{24}$/i.test(String(valor))) {
        setorFidelizado = setor;
        atendenteIdFidelizado = valor;
        break;
      }
    }

    if (atendenteIdFidelizado) {
      console.log(`[PRE-ATENDIMENTO] ⚡ ${contact.tipo_contato.toUpperCase()} fidelizado → roteando direto para setor ${setorFidelizado}`);

      // Buscar nome do atendente
      let atendenteNome = null;
      try {
        const atendente = await base44.asServiceRole.entities.User.get(atendenteIdFidelizado);
        atendenteNome = atendente?.full_name;
      } catch (e) {}

      const primeiroNome = atendenteNome ? atendenteNome.split(' ')[0] : null;
      const hora = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours(); // BRT = UTC-3
      const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
      const nomeContato = contact.nome && !/^\d+$/.test(contact.nome) ? `, ${contact.nome.split(' ')[0]}` : '';
      const setorHumanizado = { vendas: 'Vendas', assistencia: 'Suporte Técnico', financeiro: 'Financeiro', fornecedor: 'Compras', geral: 'Atendimento' }[setorFidelizado] || 'Atendimento';

      const msgFidelizado = primeiroNome
        ? `${saudacao}${nomeContato}! Estamos de volta! 😊 Vou te conectar com *${primeiroNome}* na nossa equipe de *${setorHumanizado}* agora.`
        : `${saudacao}${nomeContato}! Estamos de volta! 😊 Vou te conectar com nossa equipe de *${setorHumanizado}* agora.`;

      await enviarMensagem(base44, contact, integrationId, msgFidelizado);

      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteIdFidelizado,
        sector_id: setorFidelizado,
        pre_atendimento_state: 'COMPLETED',
        pre_atendimento_ativo: false,
        pre_atendimento_completed_at: new Date().toISOString(),
        routing_stage: 'COMPLETED'
      });

      return { success: true, mode: 'cliente_fidelizado_direto', atendente: atendenteNome, setor: setorFidelizado };
    }
  }

  // ⚠️ ANTI-DUPLICATA: Não enviar saudação 2x em 8h
  const ultimaOutbound = thread.last_outbound_at ? new Date(thread.last_outbound_at) : null;
  const horasDesdeUltima = ultimaOutbound ? (Date.now() - ultimaOutbound.getTime()) / (1000 * 60 * 60) : 999;
  
  if (horasDesdeUltima < 8 && thread.pre_atendimento_state === 'WAITING_NEED') {
    console.log(`[PRE-ATENDIMENTO] ⏭️ Já enviou há ${Math.round(horasDesdeUltima)}h → bloqueando duplicata`);
    return { success: true, mode: 'saudacao_duplicata_bloqueada_8h' };
  }

  const hora = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours(); // BRT = UTC-3
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

  // ✅ Se for áudio/mídia genérico sem texto real → aguardar mensagem de texto
  const isAudioGenerico = /^\[?🎤|^\[?áudio|^\[?audio|^\[?imagem|^\[?vídeo|^\[?video|^\[?documento/i.test(mensagem.trim());
  if (isAudioGenerico) {
    console.log('[PRE-ATENDIMENTO] 🎤 Mídia genérica recebida → aguardando texto do cliente');
    // Não rotear ainda, apenas confirmar que recebeu
    const msgAguardo = `Recebi sua mensagem! 😊 Por favor, me diga em texto como posso te ajudar hoje?`;
    await enviarMensagem(base44, contact, integrationId, msgAguardo);
    return { success: true, mode: 'aguardando_texto_apos_midia' };
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
    // ✅ FIX v13: Buscar atendentes COM fallback suave (não quebra se campo vazio)
    const todos = await base44.asServiceRole.entities.User.list('-created_date', 100);

    // PASSO 1: Verificar atendente fidelizado
    const campoFidelizado = {
      vendas: 'atendente_fidelizado_vendas',
      assistencia: 'atendente_fidelizado_assistencia',
      financeiro: 'atendente_fidelizado_financeiro',
      fornecedor: 'atendente_fidelizado_fornecedor'
    }[setor];

    if (campoFidelizado && contact[campoFidelizado]) {
      const valorCampo = contact[campoFidelizado];
      // Validar que é um ObjectId válido (24 hex chars) — ignorar strings literais como "THIAGO"
      const isObjectId = /^[a-f0-9]{24}$/i.test(String(valorCampo));
      if (isObjectId) {
        const fidelizado = todos.find(u => u.id === valorCampo);
        if (fidelizado) {
          atendenteId = fidelizado.id;
          atendenteNome = fidelizado.full_name || fidelizado.email;
          console.log('[PRE-ATENDIMENTO] 🎯 Fidelizado encontrado:', atendenteNome);
        } else {
          console.warn('[PRE-ATENDIMENTO] ⚠️ Fidelizado não encontrado no sistema, buscando alternativa');
        }
      } else {
        console.warn(`[PRE-ATENDIMENTO] ⚠️ Campo ${campoFidelizado} contém valor inválido "${valorCampo}" — ignorando`);
      }
    }

    // PASSO 2: Buscar por setor — sem filtro availability_status (horário comercial já validado)
    if (!atendenteId) {
      const atendentesCandidatos = todos.filter(u => {
        // Deve ter nome ou email válido
        if (!u.full_name && !u.email) return false;
        if (u.availability_status === 'offline') return false; // excluir offline explícito
        // Se setor é 'geral', aceita qualquer atendente
        if (setor === 'geral') return true;

        // Setor exato
        return u.attendant_sector === setor;
      });

      console.log('[PRE-ATENDIMENTO] 👥 Candidatos setor', setor + ':', atendentesCandidatos.length);

      if (atendentesCandidatos.length > 0) {
        const threadsAbertas = await base44.asServiceRole.entities.MessageThread.filter({
          status: 'aberta',
          assigned_user_id: { $in: atendentesCandidatos.map(u => u.id) }
        }, '-created_date', 200);

        const contagemPorAtendente = {};
        for (const t of threadsAbertas) {
          if (t.assigned_user_id) {
            contagemPorAtendente[t.assigned_user_id] = (contagemPorAtendente[t.assigned_user_id] || 0) + 1;
          }
        }

        const melhor = [...atendentesCandidatos].sort((a, b) => {
          return (contagemPorAtendente[a.id] || 0) - (contagemPorAtendente[b.id] || 0);
        })[0];

        if (melhor) {
          atendenteId = melhor.id;
          atendenteNome = melhor.full_name || melhor.email;
          console.log('[PRE-ATENDIMENTO] ✅ Atendente:', atendenteNome);
        }
      }
    }

    // Atribuir à thread se encontrou atendente
    if (atendenteId) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteId,
        sector_id: setor
      });
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

    // Enfileirar diretamente (sem invoke para evitar 403)
    try {
      await base44.asServiceRole.entities.WorkQueueItem.create({
        contact_id: contact.id,
        thread_id: thread.id,
        tipo: 'idle_reativacao',
        reason: 'sem_atendente_disponivel',
        severity: 'high',
        owner_sector_id: setor,
        status: 'open',
        notes: `Cliente aguardando atendimento: ${setor}`
      });
    } catch (e) {
      console.warn('[PRE-ATENDIMENTO] Falha ao enfileirar:', e.message);
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
// HELPERS: Horário comercial e debounce
// ============================================================================

// Verifica se está dentro do horário comercial lendo o FlowTemplate padrão
async function verificarHorarioComercial(base44) {
  try {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter(
      { is_pre_atendimento_padrao: true }, '-created_date', 1
    );
    const tpl = templates[0];
    if (!tpl?.horario_comercial) return { dentroHorario: true, msgForaHorario: null };

    const hc = tpl.horario_comercial;
    const msgFora = tpl.mensagem_fora_horario || 'Olá! Recebemos sua mensagem! Nosso horário é seg-sex 08h às 18h. Retornamos no próximo dia útil às 08h. 🙏';

    // Calcular hora BRT
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const diaSemana = agora.getUTCDay(); // 0=dom, 1=seg ... 6=sab
    const hora = agora.getUTCHours();
    const minuto = agora.getUTCMinutes();
    const minutosDoDia = hora * 60 + minuto;

    // Mapa dia → campo do horario_comercial
    const diasMap = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
    const diaKey = diasMap[diaSemana];
    const configDia = hc[diaKey];

    // null ou ausente = fora de horário nesse dia
    if (!configDia) return { dentroHorario: false, msgForaHorario: msgFora };

    // Formato esperado: "08:00" - "18:00"
    const [hIni, mIni] = (configDia.inicio || '08:00').split(':').map(Number);
    const [hFim, mFim] = (configDia.fim || '18:00').split(':').map(Number);
    const inicioMin = hIni * 60 + mIni;
    const fimMin = hFim * 60 + mFim;

    const dentroHorario = minutosDoDia >= inicioMin && minutosDoDia < fimMin;
    return { dentroHorario, msgForaHorario: dentroHorario ? null : msgFora };
  } catch (e) {
    console.warn('[PRE-ATENDIMENTO] Erro ao verificar horário comercial:', e.message);
    return { dentroHorario: true, msgForaHorario: null }; // fallback: permitir
  }
}

// Busca debounce_segundos do template padrão (default 0 = sem debounce)
async function getDebounceSegundos(base44) {
  try {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter(
      { is_pre_atendimento_padrao: true }, '-created_date', 1
    );
    return templates[0]?.debounce_segundos || 0;
  } catch (e) {
    return 0;
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

    // ── FIX 1: Verificar horário comercial ──────────────────────────────────
    const { dentroHorario, msgForaHorario } = await verificarHorarioComercial(base44);
    if (!dentroHorario) {
      console.log('[PRE-ATENDIMENTO] 🌙 Fora do horário comercial → enviando mensagem padrão');
      await enviarMensagem(base44, contact, integrationId, msgForaHorario);
      return Response.json({ success: true, estado: 'FORA_HORARIO', resultado: { mode: 'fora_horario_comercial' } }, { status: 200, headers });
    }

    // ── FIX 2: Debounce ─────────────────────────────────────────────────────
    const debounceSegundos = await getDebounceSegundos(base44);
    if (debounceSegundos > 0 && user_input?.type !== 'proactive') {
      // Marcar timestamp da última mensagem recebida nesta thread
      const agora = Date.now();
      const ultimoDebounce = thread.campos_personalizados?.debounce_ultimo_ts || 0;
      const diffMs = agora - ultimoDebounce;

      // Atualizar o timestamp para reiniciar o contador
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        campos_personalizados: { ...thread.campos_personalizados, debounce_ultimo_ts: agora }
      });

      if (diffMs < debounceSegundos * 1000) {
        // Mensagem dentro do janela de debounce → aguardar sem responder ainda
        console.log(`[PRE-ATENDIMENTO] ⏳ Debounce ativo (${Math.round(diffMs/1000)}s < ${debounceSegundos}s) → ignorando por ora`);
        return Response.json({ success: true, estado: 'DEBOUNCE', resultado: { mode: 'debounce_aguardando' } }, { status: 200, headers });
      }
    }

    const estado = thread.pre_atendimento_state || 'INIT';
    console.log('[PRE-ATENDIMENTO v12] Thread:', thread_id, '| Estado:', estado);

    // ✅ GUARD CRÍTICO: SE JÁ TEM COMPLETED PARA ESTE CONTACT, verificar re-triagem
    if (estado === 'COMPLETED' || estado === 'CANCELLED' || estado === 'TIMEOUT') {
      // Verificar tempo desde última interação para decidir comportamento
      const ultimaInteracao = thread.last_inbound_at || thread.last_message_at || thread.pre_atendimento_completed_at;
      const horasDesdeUltima = ultimaInteracao
        ? (Date.now() - new Date(ultimaInteracao).getTime()) / (1000 * 60 * 60)
        : 999;

      if (horasDesdeUltima > 7 * 24) {
        // Mais de 7 dias: tratar como novo contato → re-iniciar URA completa
        console.log(`[PRE-ATENDIMENTO] 🔄 Mais de 7 dias sem interação (${Math.round(horasDesdeUltima/24)}d) → reiniciando como novo contato`);
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_completed_at: null,
          assigned_user_id: null,
          sector_id: null,
          routing_stage: 'NEW'
        });
        thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        // Continua para processarINIT abaixo

      } else if (horasDesdeUltima < 7 * 24 && thread.sector_id && thread.assigned_user_id) {
        // Menos de 7 dias com setor/atendente definido
        // Se a mensagem atual é texto real (não áudio genérico), processar direto como WAITING_NEED
        const inputContent = userInput.content || '';
        const isAudioGenerico = /^\[?🎤|^\[?áudio|^\[?audio/i.test(inputContent.trim());
        const temConteudoReal = inputContent.trim().length > 3 && !isAudioGenerico;

        if (temConteudoReal) {
          // Tem texto real → processar direto como se fosse WAITING_NEED (roteamento imediato)
          console.log(`[PRE-ATENDIMENTO] ⚡ Retorno com conteúdo real "${inputContent.substring(0,40)}" → roteando direto`);
          // Resetar estado para processamento
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            pre_atendimento_state: 'WAITING_NEED',
            pre_atendimento_ativo: true,
            assigned_user_id: null,
            sector_id: null
          });
          thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
          const resultado = await processarWAITING_NEED(base44, thread, contact, userInput, integrationId);
          return Response.json({ success: true, estado: 'WAITING_NEED', thread_id: thread.id, resultado }, { status: 200, headers });
        }

        // Sem conteúdo real (áudio/imagem) → saudação + aguardar texto
        console.log(`[PRE-ATENDIMENTO] ⚡ Retorno em ${Math.round(horasDesdeUltima)}h → pedindo o que o cliente precisa`);

        const nomeContato = contact.nome && !/^\d+$/.test(contact.nome) ? contact.nome.split(' ')[0] : null;
        const nomeLabel = nomeContato ? `, ${nomeContato}` : '';

        const msgRetorno = `Olá${nomeLabel}, que bom ter você de volta! 😊 Em que posso te ajudar hoje?`;

        await enviarMensagem(base44, contact, integrationId, msgRetorno);

        // Resetar setor/atendente para forçar nova escolha
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'WAITING_NEED',
          pre_atendimento_ativo: true,
          assigned_user_id: null,
          sector_id: null,
          pre_atendimento_started_at: new Date().toISOString(),
          pre_atendimento_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
        });

        return Response.json({
          success: true,
          estado: 'WAITING_NEED',
          thread_id: thread.id,
          resultado: { mode: 'retorno_rapido_aguardando_input' }
        }, { status: 200, headers });

      } else {
        // ✅ FIX: Sem setor anterior mas dentro de 7 dias → enviar saudação de retorno simples
        // (cobre clientes/leads sem histórico de setor que retornam dentro da semana)
        const nomeContato = contact.nome && !/^\d+$/.test(contact.nome) ? contact.nome.split(' ')[0] : null;
        const nomeLabel = nomeContato ? `, ${nomeContato}` : '';
        const hora = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours(); // BRT = UTC-3
        const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

        const msgRetornoSimples = `${saudacao}${nomeLabel}! Estamos de volta! 😊 Em que posso te ajudar hoje?`;

        let integrationIdRetorno = whatsapp_integration_id || thread.whatsapp_integration_id;
        if (!integrationIdRetorno) {
          const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-created_date', 1);
          if (integracoes.length > 0) integrationIdRetorno = integracoes[0].id;
        }

        if (integrationIdRetorno) {
          await enviarMensagem(base44, contact, integrationIdRetorno, msgRetornoSimples);
        }

        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'WAITING_NEED',
          pre_atendimento_ativo: true,
          pre_atendimento_started_at: new Date().toISOString(),
          pre_atendimento_timeout_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
        });

        console.log('[PRE-ATENDIMENTO] ✅ Saudação de retorno (sem setor anterior) enviada');
        return Response.json({
          success: true,
          estado: 'WAITING_NEED',
          thread_id: thread.id,
          resultado: { mode: 'retorno_sem_setor_anterior' }
        }, { status: 200, headers });
      }
    }

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