import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// ENVIO DE CAMPANHAS - ARQUITETURA ASSÍNCRONA (SAFE BATCH) v2
// ============================================================================
// Modo BROADCAST: enfileira WorkQueueItems instantaneamente → worker envia por baixo
// Modo PROMOÇÃO:  envia saudação imediata + enfileira promoção com delay
//
// ✅ Sem timeout: qualquer volume de contatos retorna em ~1-3s
// ✅ Worker (processarFilaBroadcast) roda a cada 5min e processa em lotes de 20
// ✅ Controle de cooldown via last_any_promo_sent_at
// ✅ NOVO: Delay aleatório 3-12s, 5 variações de saudação, contexto contato
// ============================================================================

// ✅ Variações de saudação para anti-detecção spam
const SAUDACOES_VARIACOES = [
  'Olá {nome}! Tudo bem? 😊',
  'Oi {nome}, como vai?',
  'Bom dia {nome}! 👋',
  'E aí {nome}? Tudo certo?',
  'Opa {nome}! Beleza? 🙂'
];

// Gerar delay aleatório entre 3s e 12s (simula comportamento humano)
function delayAlatorio() {
  return Math.floor(Math.random() * 9000) + 3000; // 3-12s
}

// Selecionar saudação aleatória (anti-detecção)
function saudacaoAleatoria() {
  return SAUDACOES_VARIACOES[Math.floor(Math.random() * SAUDACOES_VARIACOES.length)];
}

// ✅ FASE 2: Variação estrutural sutil (evita fingerprint de mensagem idêntica)
// Aplica 1 de 3 micro-transformações aleatórias
function variarEstrutura(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  const variantes = [
    (t) => t,                                                      // original
    (t) => t.replace(/\. /g, '.\n').replace(/\n{3,}/g, '\n\n'),    // quebra de linha após ponto
    (t) => t.replace(/ +/g, ' ').trim(),                           // normaliza espaços
  ];
  const fn = variantes[Math.floor(Math.random() * variantes.length)];
  return fn(texto);
}

// ✅ FASE 7: Carrega BroadcastConfig (com fallback em defaults)
async function carregarBroadcastConfig(base44) {
  const defaults = {
    tier_novo_max_dia: 30, tier_novo_janela_min: 240,
    tier_aquecendo_max_dia: 80, tier_aquecendo_janela_min: 180,
    tier_maduro_max_dia: 150, tier_maduro_janela_min: 120,
    saturacao_max_bloqueios_24h: 3
  };
  try {
    const lista = await base44.asServiceRole.entities.BroadcastConfig.filter({ nome_config: 'default', ativo: true });
    if (lista.length > 0) return { ...defaults, ...lista[0] };
  } catch (_) {}
  return defaults;
}

// ✅ FASE 3: Auto-tier baseado em idade da integração (agora lê da config)
function calcularTierIntegracao(integration, cfg) {
  const idadeDias = (Date.now() - new Date(integration.created_date).getTime()) / 86400000;
  const totalEnviado = integration.estatisticas?.total_mensagens_enviadas || 0;

  if (idadeDias < 7 || totalEnviado < 100) {
    return { tier: 'novo', maxPorLote: cfg.tier_novo_max_dia, janelaMinutos: cfg.tier_novo_janela_min };
  }
  if (idadeDias < 30 || totalEnviado < 1000) {
    return { tier: 'aquecendo', maxPorLote: cfg.tier_aquecendo_max_dia, janelaMinutos: cfg.tier_aquecendo_janela_min };
  }
  return { tier: 'maduro', maxPorLote: cfg.tier_maduro_max_dia, janelaMinutos: cfg.tier_maduro_janela_min };
}

// ✅ FASE 3: Distribuir envios ao longo de uma janela de tempo
// Retorna array de Date com offsets aleatórios dentro da janela
function calcularSpreadTemporal(quantidade, janelaMinutos, agora) {
  const janelaMs = janelaMinutos * 60 * 1000;
  const slots = [];
  for (let i = 0; i < quantidade; i++) {
    // Distribuição uniforme + jitter de ±15% para parecer natural
    const base = (janelaMs / quantidade) * i;
    const jitter = (Math.random() - 0.5) * (janelaMs / quantidade) * 0.3;
    slots.push(new Date(agora.getTime() + base + jitter));
  }
  return slots;
}

// ✅ FASE 3: Detectar saturação (usa threshold da config)
async function detectarSaturacao(base44, integrationId, cfg) {
  const ontemMs = Date.now() - 24 * 60 * 60 * 1000;
  const limite = cfg?.saturacao_max_bloqueios_24h || 3;
  try {
    const bloqueios = await base44.asServiceRole.entities.Contact.filter({
      bloqueado: true,
      bloqueado_em: { $gte: new Date(ontemMs).toISOString() }
    });
    return bloqueios.length >= limite;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const {
      contact_ids = [],
      modo = 'broadcast',
      mensagem = '',
      personalizar = true,
      delay_minutos = 5,
      texto_saudacao_custom = null,
      media_url = null,
      media_type = 'none',
      media_caption = null,
      integration_id = null,
      mostrar_como_mensagens = true
    } = body;

    console.log(`[CAMPANHA-LOTE] Payload:`, {
      modo,
      total: contact_ids.length,
      mensagem: mensagem?.substring(0, 80),
      media_type
    });

    // ── Validações ──────────────────────────────────────────────────────────
    if ((!mensagem || !mensagem.trim()) && !media_url) {
      return Response.json({ success: false, error: 'Mensagem ou mídia obrigatória' }, { status: 400 });
    }
    if (!contact_ids?.length) {
      return Response.json({ success: false, error: 'Lista de contatos vazia' }, { status: 400 });
    }

    // ── Integração conectada ─────────────────────────────────────────────────
    let integration;
    
    if (integration_id) {
      // Usar integração específica se fornecida
      const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
        id: integration_id, 
        status: 'conectado' 
      });
      if (!integrations.length) {
        return Response.json({ success: false, error: 'Instância selecionada não está conectada' }, { status: 400 });
      }
      integration = integrations[0];
    } else {
      // Fallback: primeira instância conectada
      const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      if (!integrations.length) {
        return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' }, { status: 400 });
      }
      integration = integrations[0];
    }

    // ── Usuário atual (para sender_id e {{atendente}}) ───────────────────────
    let senderId = 'system';
    let nomeAtendente = 'nossa equipe';
    try {
      const me = await base44.auth.me();
      senderId = me?.id || 'system';
      nomeAtendente = me?.full_name?.split(' ')[0] || me?.full_name || 'nossa equipe';
    } catch (_) {}

    const now = new Date();
    const broadcastId = `broadcast_${now.getTime()}`;

    // ── Carregar contatos ────────────────────────────────────────────────────
    const contatosRaw = await base44.asServiceRole.entities.Contact.filter({ id: { $in: contact_ids } });
    console.log(`[CAMPANHA-LOTE] ${contatosRaw.length} contatos carregados`);

    const resultados = [];
    let enfileirados = 0;
    let erros = 0;

    // ✅ FASE 6: Filtrar APENAS contatos com opt-out EXPLÍCITO ou bloqueio manual
    // ⚠️ NÃO filtrar por whatsapp_optin === false: o default do schema é false e isso bloquearia 100% da base
    const contatosOptOut = contatosRaw.filter(c =>
      (Array.isArray(c.tags) && c.tags.includes('opt_out')) ||
      c.bloqueado === true
    );
    contatosOptOut.forEach(c => {
      resultados.push({
        contact_id: c.id,
        nome: c.nome,
        status: 'opt_out',
        motivo: c.bloqueado ? 'Contato bloqueado' : 'Contato fez opt-out / descadastro'
      });
      erros++;
    });
    const contatos = contatosRaw.filter(c =>
      !((Array.isArray(c.tags) && c.tags.includes('opt_out')) || c.bloqueado === true)
    );
    if (contatosOptOut.length > 0) {
      console.warn(`[CAMPANHA-LOTE] 🚫 ${contatosOptOut.length} contatos excluídos por opt-out/bloqueio`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODO BROADCAST → Enfileirar tudo (sem envio direto → sem timeout)
    // ══════════════════════════════════════════════════════════════════════════
    if (modo === 'broadcast') {
      // ✅ FASE 7: Carregar config e FASE 3: Guard de saturação
      const cfg = await carregarBroadcastConfig(base44);
      const saturado = await detectarSaturacao(base44, integration.id, cfg);
      if (saturado) {
        console.warn(`[CAMPANHA-LOTE] 🚫 Integração ${integration.id} saturada. Envio abortado.`);
        return Response.json({
          success: false,
          error: 'Integração saturada: muitos contatos bloquearam nas últimas 24h. Pausa preventiva ativada.',
          motivo: 'saturacao_detectada'
        }, { status: 429 });
      }

      // ✅ FASE 3+7: Calcular tier (usando config)
      const tier = calcularTierIntegracao(integration, cfg);
      const qtdRealEnvio = Math.min(contatos.length, tier.maxPorLote);
      const slotsTemporais = calcularSpreadTemporal(qtdRealEnvio, tier.janelaMinutos, now);
      console.log(`[CAMPANHA-LOTE] 📊 Tier '${tier.tier}': ${qtdRealEnvio}/${contatos.length} msgs em ${tier.janelaMinutos}min`);

      // Se total > maxPorLote, avisar que excedente será descartado
      const contatosExcedentes = contatos.length > tier.maxPorLote
        ? contatos.slice(tier.maxPorLote)
        : [];
      contatosExcedentes.forEach(c => {
        resultados.push({ contact_id: c.id, nome: c.nome, status: 'excedente', motivo: `Tier '${tier.tier}' limita ${tier.maxPorLote}/dia` });
        erros++;
      });
      const contatosParaEnviar = contatos.slice(0, tier.maxPorLote);

      // ✅ OTIMIZAÇÃO: Buscar TODAS as threads de uma vez (não 1 por 1)
      const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: { $in: contatosParaEnviar.map(c => c.id) },
        is_canonical: true
      });
      const threadMap = new Map(threadsExistentes.map(t => [t.contact_id, t]));

      // ✅ OTIMIZAÇÃO: Criar threads faltantes em BATCH
      const contatosSemThread = contatosParaEnviar.filter(c => !threadMap.has(c.id) && c.telefone);
      const novasThreads = await Promise.all(
        contatosSemThread.map(c =>
          base44.asServiceRole.entities.MessageThread.create({
            contact_id: c.id,
            is_canonical: true,
            channel: 'whatsapp',
            whatsapp_integration_id: integration.id,
            status: 'aberta'
          })
        )
      );
      novasThreads.forEach(t => threadMap.set(t.contact_id, t));

      // ✅ Processar contatos
      const workQueuePromises = [];
      const messagePromises = [];
      const threadUpdatePromises = [];
      let slotIdx = 0; // ✅ FASE 3: Índice do slot temporal

      for (const contato of contatosParaEnviar) {
        if (!contato.telefone) {
          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: 'Sem telefone' });
          erros++;
          continue;
        }

        try {
          const thread = threadMap.get(contato.id);
          if (!thread) throw new Error('Thread não encontrada nem criada');

          // ✅ Resolver placeholders com contexto do contato
          const atendenteFidelizado = contato.atendente_fidelizado_vendas || nomeAtendente;
          let mensagemFinal = personalizar
            ? mensagem
                .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
                .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
                .replace(/\{\{atendente\}\}/gi, atendenteFidelizado)
                .replace(/\{\{usuario\}\}/gi, atendenteFidelizado)
                .replace(/\{\{tipo_contato\}\}/gi, contato.tipo_contato || 'cliente')
            : mensagem;

          // ✅ HUMANIZAÇÃO: Se mensagem NÃO começa com saudação, adicionar variação aleatória
          // (evita todas mensagens idênticas = detecção de spam pela Meta)
          if (personalizar && mensagemFinal && !/^(ol[áa]|oi|bom dia|boa tarde|boa noite|e a[íi]|opa)/i.test(mensagemFinal.trim())) {
            const saudacaoTemplate = saudacaoAleatoria();
            const saudacao = saudacaoTemplate
              .replace(/\{nome\}/gi, contato.nome || 'Cliente')
              .replace(/\{empresa\}/gi, contato.empresa || '');
            mensagemFinal = `${saudacao}\n\n${mensagemFinal}`;
          }

          // ✅ FASE 2: Variação estrutural sutil (anti-fingerprint)
          if (personalizar && mensagemFinal) {
            mensagemFinal = variarEstrutura(mensagemFinal);
          }

          // ✅ FASE 3: Usar slot temporal distribuído (não todos no mesmo instante)
          const slotEnvio = slotsTemporais[slotIdx] || now;
          slotIdx++;

          // ✅ BATCH: Enfileirar WorkQueueItem
          workQueuePromises.push(
            base44.asServiceRole.entities.WorkQueueItem.create({
              tipo: 'enviar_broadcast_avulso',
              contact_id: contato.id,
              status: 'pendente',
              scheduled_for: slotEnvio.toISOString(),
              payload: {
                integration_id: integration.id,
                mensagem: mensagemFinal,
                media_url: media_url || null,
                media_type: media_type || 'none',
                media_caption: media_caption || null,
                sender_id: senderId,
                broadcast_id: broadcastId,
                tier_aplicado: tier.tier
              }
            })
          );

          // ✅ BATCH: Criar Message com mídia
          messagePromises.push(
            base44.asServiceRole.entities.Message.create({
              thread_id: thread.id,
              sender_id: senderId,
              sender_type: 'user',
              recipient_id: contato.id,
              recipient_type: 'contact',
              content: media_url ? `[${media_type}]` : mensagemFinal,
              channel: 'whatsapp',
              status: 'pendente',
              sent_at: now.toISOString(),
              visibility: 'public_to_customer',
              media_url: media_url || null,
              media_type: media_type || 'none',
              media_caption: media_caption || null,
              metadata: {
                whatsapp_integration_id: integration.id,
                origem_campanha: 'broadcast_massa',
                broadcast_id: broadcastId,
                aguardando_worker: true
              }
            })
          );

          // ✅ BATCH: Atualizar thread
          threadUpdatePromises.push(
            base44.asServiceRole.entities.MessageThread.update(thread.id, {
              last_message_content: `[Broadcast] ${(mensagemFinal || '').substring(0, 80)}`,
              last_message_at: now.toISOString(),
              last_outbound_at: now.toISOString(),
              last_message_sender: 'user',
              last_human_message_at: now.toISOString(),
              last_media_type: media_url ? media_type : 'none',
              whatsapp_integration_id: integration.id,
              pre_atendimento_ativo: false,
              metadata: {
                ultima_mensagem_origem: 'broadcast_massa',
                broadcast_data: {
                  sent_at: now.toISOString(),
                  broadcast_id: broadcastId
                }
              }
            })
          );

          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'enfileirado' });
          enfileirados++;

        } catch (error) {
          console.error(`[CAMPANHA-LOTE] ❌ ${contato.nome}:`, error.message);
          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: error.message });
          erros++;
        }
      }

      // ✅ Executar TODAS as operações em paralelo
      await Promise.all([...workQueuePromises, ...messagePromises, ...threadUpdatePromises]);

      // 📢 LOG INTERNO: 1 bolha por contato com detalhes da campanha (visível só pro atendente)
      const dispatchLogPromises = contatosParaEnviar
        .filter(c => c.telefone && threadMap.has(c.id))
        .map(contato => {
          const thread = threadMap.get(contato.id);
          const previewMsg = (mensagem || media_caption || `[${media_type}]`).substring(0, 200);
          return base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: senderId,
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: `Campanha em massa enfileirada (broadcast)`,
            channel: 'interno',
            visibility: 'internal_only',
            status: 'lida',
            sent_at: now.toISOString(),
            metadata: {
              is_system_message: true,
              message_type: 'broadcast_dispatch_log',
              dispatch_data: {
                titulo: `Campanha em massa`,
                descricao: previewMsg,
                trigger: 'massa_manual',
                broadcast_id: broadcastId,
                tier_aplicado: tier.tier,
                total_destinatarios: qtdRealEnvio,
                tem_midia: !!media_url,
                imagem: media_type === 'image' ? media_url : null
              }
            }
          });
        });
      await Promise.all(dispatchLogPromises).catch(e => console.warn('[CAMPANHA-LOTE] dispatch_log falhou (non-blocking):', e.message));

      // Auditoria
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'outro',
        resultado: erros === 0 ? 'sucesso' : (enfileirados > 0 ? 'parcial' : 'erro'),
        timestamp: now.toISOString(),
        origem: 'manual',
        detalhes: { mensagem: `Broadcast em massa: ${enfileirados} enfileirados, ${erros} erros` },
        metadata: { automation_type: 'broadcast_massa', contact_ids, enfileirados, erros, broadcast_id: broadcastId }
      }).catch(e => console.warn('[CAMPANHA-LOTE] AutomationLog falhou (non-blocking):', e.message));

      console.log(`[CAMPANHA-LOTE] ✅ ${enfileirados} broadcasts enfileirados (worker processará em lotes)`);

      return Response.json({
        success: true,
        modo: 'broadcast',
        enfileirados,
        erros,
        excedentes: contatosExcedentes.length,
        resultados,
        tier_aplicado: tier.tier,
        janela_minutos: tier.janelaMinutos,
        max_por_lote: tier.maxPorLote,
        mensagem_status: `${enfileirados} msgs distribuídas ao longo de ${tier.janelaMinutos}min (tier: ${tier.tier}).`,
        broadcast_id: broadcastId,
        timestamp: now.toISOString()
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODO PROMOÇÃO → Saudação imediata + enfileirar promoção
    // ══════════════════════════════════════════════════════════════════════════
    if (modo === 'promocao') {
      const promocoes = await base44.asServiceRole.entities.Promotion.filter({
        is_active: true,
        expires_at: { $gte: now.toISOString() }
      }, '-priority', 1);

      if (!promocoes.length) {
        return Response.json({ success: false, error: 'Nenhuma promoção ativa' }, { status: 400 });
      }
      const promo = promocoes[0];

      // ✅ DEDUPLICAÇÃO: Verificar contatos já receberam esta promo recentemente
      const contatosFiltrados = contatos.filter(c => {
        const jaRecebeu = (c.last_promo_ids || []).includes(promo.id);
        const emCooldown = c.last_any_promo_sent_at ? 
          (Date.now() - new Date(c.last_any_promo_sent_at).getTime()) < 12 * 60 * 60 * 1000 : // 12h cooldown
          false;
        
        return !jaRecebeu && !emCooldown;
      });

      console.log(`[CAMPANHA-LOTE] Deduplicação: ${contatos.length} → ${contatosFiltrados.length} contatos (removidos duplicados)`);

      for (const contato of contatosFiltrados) {
        try {
          if (!contato.telefone) {
            resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: 'Sem telefone' });
            erros++;
            continue;
          }

          // Buscar/criar thread canônica
          let threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id, is_canonical: true });
          let thread = threads[0];
          if (!thread) {
            thread = await base44.asServiceRole.entities.MessageThread.create({
              contact_id: contato.id,
              is_canonical: true,
              channel: 'whatsapp',
              whatsapp_integration_id: integration.id,
              status: 'aberta'
            });
          }

          // ✅ Saudação com variação aleatória (anti-spam) + atendente fidelizado
          const atendenteFidelizado = contato.atendente_fidelizado_vendas || nomeAtendente;
          const saudacaoTemplate = texto_saudacao_custom || saudacaoAleatoria();
          const saudacao = saudacaoTemplate
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '')
            .replace(/\{\{atendente\}\}/gi, atendenteFidelizado)
            .replace(/\{\{usuario\}\}/gi, atendenteFidelizado);

          // ✅ FASE 2: Variação estrutural sutil também na saudação de promoção
          const saudacaoVariada = variarEstrutura(saudacao);

          const respSaudacao = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
            integration_id: integration.id,
            numero_destino: contato.telefone,
            mensagem: saudacaoVariada
          });

          if (!respSaudacao.data?.success) throw new Error(respSaudacao.data?.error || 'Erro ao enviar saudação');

          // Persistir saudação
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: senderId,
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: saudacao,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: respSaudacao.data.message_id,
            sent_at: now.toISOString(),
            visibility: 'public_to_customer',
            metadata: { whatsapp_integration_id: integration.id, origem_campanha: 'promocao_saudacao' }
          });

          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_content: saudacao.substring(0, 100),
            last_message_at: now.toISOString(),
            last_outbound_at: now.toISOString(),
            last_message_sender: 'user',
            last_human_message_at: now.toISOString(),
            whatsapp_integration_id: integration.id,
            pre_atendimento_ativo: false
          });

          // ⚠️ NÃO atualizar last_any_promo_sent_at aqui!
          // Esta é apenas a SAUDAÇÃO, não a promoção.
          // O motor enviarPromocao (acionado por processarFilaPromocoes) é o ÚNICO
          // lugar autorizado a marcar last_any_promo_sent_at e last_promo_ids.
          // Fonte única de verdade = enviarPromocao + PromotionDispatchLog.

          // Enfileirar promoção com delay
          const scheduledFor = new Date(now.getTime() + delay_minutos * 60 * 1000);
          await base44.asServiceRole.entities.WorkQueueItem.create({
            tipo: 'enviar_promocao',
            contact_id: contato.id,
            thread_id: thread.id,
            status: 'agendado',
            scheduled_for: scheduledFor.toISOString(),
            payload: { promotion_id: promo.id, integration_id: integration.id, trigger: 'lote_urgentes' },
            metadata: { saudacao_enviada_em: now.toISOString(), delay_minutos }
          });

          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'agendado',
            promo_agendada_para: scheduledFor.toISOString()
          });
          enfileirados++;

          // ✅ Delay aleatório 3-12s (anti-detecção spam, simula humano)
          await new Promise(r => setTimeout(r, delayAlatorio()));

        } catch (error) {
          console.error(`[CAMPANHA-LOTE] ❌ ${contato.nome}:`, error.message);
          resultados.push({ contact_id: contato.id, nome: contato.nome, status: 'erro', motivo: error.message });
          erros++;
        }
      }

      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'envio_template',
        resultado: erros === 0 ? 'sucesso' : (enfileirados > 0 ? 'parcial' : 'erro'),
        timestamp: now.toISOString(),
        origem: 'manual',
        detalhes: { mensagem: `Promoção em lote: ${enfileirados} agendados, ${erros} erros` },
        metadata: { automation_type: 'promocao_lote', contact_ids, enfileirados, erros }
      }).catch(e => console.warn('[CAMPANHA-LOTE] AutomationLog falhou (non-blocking):', e.message));

      return Response.json({
        success: true,
        modo: 'promocao',
        enviados: enfileirados,
        erros,
        resultados,
        timestamp: now.toISOString()
      });
    }

    return Response.json({ success: false, error: `Modo inválido: ${modo}` }, { status: 400 });

  } catch (error) {
    console.error('[CAMPANHA-LOTE] ❌ ERRO GERAL:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});