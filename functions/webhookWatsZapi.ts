import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v8.4.0 GUARDAS COMPLETAS
// ============================================================================
// 1. Filtrar ULTRA-CEDO antes de qualquer operação
// 2. Logs MÍNIMOS - apenas mensagens reais salvas
// 3. Ignorar: status@broadcast, @lid, grupos, fromMe, typing
// 4. whatsapp_integration_id SEMPRE no metadata
// 5. CORRIGIDO: Normalização de telefone SEM + para evitar duplicatas
// 6. NOVO: Extrai fileId da Z-API para download via API do provedor
// 7. GUARDAS ROBUSTAS: Nunca dispara pré-atend em threads c/ atendente,
//    fornecedores/compras, ou pré-atendimentos já concluídos
// ============================================================================

const VERSION = 'v8.4.0-GUARDAS';
const BUILD_DATE = '2025-12-11';
const BUILD_TIMESTAMP = '20251211-GUARDAS-COMPLETAS';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// NORMALIZAÇÃO DE TELEFONE - VERSÃO UNIFICADA (SEM + para consistência)
// ============================================================================
function normalizarTelefoneUnificado(telefone) {
  if (!telefone) return null;
  
  // Remover sufixos do WhatsApp (@lid, @s.whatsapp.net, @g.us, etc.)
  let numeroLimpo = String(telefone).split('@')[0];
  
  // Remover tudo que não é número (incluindo +)
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  
  // Se não tem números, retornar null
  if (!apenasNumeros) return null;
  
  // Se tem menos de 10 dígitos, é inválido
  if (apenasNumeros.length < 10) return null;
  
  // Se não começa com código do país, assumir Brasil (55)
  if (!apenasNumeros.startsWith('55')) {
    // Se tem 10 ou 11 dígitos, é um número brasileiro sem DDI
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  // IMPORTANTE: Retornar SEM + para garantir consistência entre provedores
  return apenasNumeros;
}

// ============================================================================
// FILTRO ULTRA-RÁPIDO - Retorna motivo se IGNORAR, null se processar
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';

  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const phone = String(payload.phone || '').toLowerCase();

  // IGNORAR IMEDIATAMENTE: status@broadcast e JIDs de sistema
  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  // PERMITIR: QR Code e Connection
  if (tipo.includes('qrcode') || tipo.includes('connection')) {
    return null;
  }

  // IGNORAR: Eventos de presença/digitação (alto volume)
  const eventosLixo = ['presencechatcallback', 'presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) {
    return 'evento_sistema';
  }

  // MessageStatusCallback - ignorar se for de status@broadcast
  if (tipo.includes('messagestatuscallback')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) {
      return 'status_broadcast';
    }
    return null; // Processar atualizações de status válidas
  }

  // Para mensagens recebidas
  if (tipo === 'receivedcallback' || (payload.phone && payload.messageId)) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD - COM EXTRAÇÃO DE fileId DA Z-API
// ============================================================================
function normalizarPayload(payload) {
  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const instanceId = payload.instanceId || payload.instance || null;

  if (tipo.includes('qrcode')) {
    return { type: 'qrcode', instanceId, qrCodeUrl: payload.qrcode || payload.qr };
  }

  if (tipo.includes('connection')) {
    return { type: 'connection', instanceId, status: payload.connected ? 'conectado' : 'desconectado' };
  }

  if (tipo.includes('messagestatuscallback')) {
    return {
      type: 'message_update',
      instanceId,
      messageId: payload.ids?.[0] || null,
      status: payload.status
    };
  }

  // Mensagem real
  const telefone = payload.phone || '';
  const numeroLimpo = normalizarTelefoneUnificado(telefone);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let fileId = null; // ✅ NOVO: Extração do fileId da Z-API
  let conteudo = payload.text?.message || payload.body || '';

  // ✅ EXTRAÇÃO CIRÚRGICA DE MÍDIA - Prioriza fileId sobre URL
  if (payload.image) {
    mediaType = 'image';
    fileId = payload.image.fileId || payload.image.id || null;
    mediaUrl = payload.image.imageUrl || payload.image.url || payload.image.urlWithToken || payload.fileUrl || null;
    conteudo = conteudo || payload.image.caption || '[Imagem]';
  } else if (payload.video) {
    mediaType = 'video';
    fileId = payload.video.fileId || payload.video.id || null;
    mediaUrl = payload.video.videoUrl || payload.video.url || payload.video.urlWithToken || payload.fileUrl || null;
    conteudo = conteudo || payload.video.caption || '[Vídeo]';
  } else if (payload.audio) {
    mediaType = 'audio';
    fileId = payload.audio.fileId || payload.audio.id || null;
    mediaUrl = payload.audio.audioUrl || payload.audio.url || payload.audio.urlWithToken || payload.fileUrl || null;
    conteudo = '[Áudio]';
  } else if (payload.document) {
    mediaType = 'document';
    fileId = payload.document.fileId || payload.document.id || null;
    mediaUrl = payload.document.documentUrl || payload.document.url || payload.document.urlWithToken || payload.fileUrl || null;
    conteudo = conteudo || '[Documento]';
  } else if (payload.sticker) {
    mediaType = 'sticker';
    fileId = payload.sticker.fileId || payload.sticker.id || null;
    mediaUrl = payload.sticker.stickerUrl || payload.sticker.url || payload.fileUrl || null;
    conteudo = '[Sticker]';
  } else if (payload.contactMessage || payload.vcard) {
    mediaType = 'contact';
    conteudo = '📇 Contato compartilhado';
  } else if (payload.location) {
    mediaType = 'location';
    conteudo = '📍 Localização';
  }

  if (!conteudo && mediaType === 'none') {
    return { type: 'unknown', error: 'mensagem_vazia' };
  }

  return {
    type: 'message',
    instanceId,
    messageId: payload.messageId,
    from: numeroLimpo,
    content: conteudo,
    mediaType,
    mediaUrl,
    fileId, // ✅ NOVO: Retorna fileId para uso no download via Z-API
    mediaCaption: payload.image?.caption || payload.video?.caption,
    pushName: payload.senderName || payload.chatName,
    vcard: payload.contactMessage || payload.vcard,
    location: payload.location,
    quotedMessage: payload.quotedMsg
  };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({ version: VERSION, status: 'ok' }, { headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req.clone());
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    const body = await req.text();
    if (!body) return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    payload = JSON.parse(body);
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 200, headers: corsHeaders });
  }

  // FILTRO ULTRA-RÁPIDO (sem logs)
  const motivoIgnorar = deveIgnorar(payload);
  if (motivoIgnorar) {
    return Response.json({ success: true, ignored: true, reason: motivoIgnorar }, { headers: corsHeaders });
  }

  const dados = normalizarPayload(payload);
  if (dados.type === 'unknown') {
    return Response.json({ success: true, ignored: true, reason: dados.error }, { headers: corsHeaders });
  }

  if (dados.instanceId) {
    connectionManager.register(dados.instanceId, { provider: 'z_api' });
  }

  try {
    switch (dados.type) {
      case 'qrcode':
        return await handleQRCode(dados, base44);
      case 'connection':
        return await handleConnection(dados, base44);
      case 'message_update':
        return await handleMessageUpdate(dados, base44);
      case 'message':
        return await handleMessage(dados, payload, base44);
      default:
        return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error('[' + VERSION + '] ERRO:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});

// ============================================================================
// HANDLERS
// ============================================================================
async function handleQRCode(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: dados.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  
  return Response.json({ success: true, processed: 'qrcode' }, { headers: corsHeaders });
}

async function handleConnection(dados, base44) {
  if (!dados.instanceId) return Response.json({ success: true }, { headers: corsHeaders });
  
  try {
    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
      { instance_id_provider: dados.instanceId }, '-created_date', 1
    );
    if (integracoes.length > 0) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: dados.status,
        ultima_atividade: new Date().toISOString()
      });
    }
  } catch (e) {}
  
  return Response.json({ success: true, processed: 'connection', status: dados.status }, { headers: corsHeaders });
}

async function handleMessageUpdate(dados, base44) {
  if (!dados.messageId) return Response.json({ success: true }, { headers: corsHeaders });
  
  try {
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId }, '-created_date', 1
    );
    if (mensagens.length > 0) {
      const statusMap = { 'READ': 'lida', 'READ_BY_ME': 'lida', 'DELIVERED': 'entregue', 'SENT': 'enviada' };
      const novoStatus = statusMap[dados.status];
      if (novoStatus) {
        await base44.asServiceRole.entities.Message.update(mensagens[0].id, { status: novoStatus });
      }
    }
  } catch (e) {}
  
  return Response.json({ success: true, processed: 'status_update' }, { headers: corsHeaders });
}

// ============================================================================
// PRÉ-ATENDIMENTO INLINE (evita chamada externa)
// ============================================================================
async function executarPreAtendimentoInline(base44, params) {
  const { action, thread_id, contact_id, integration_id, resposta_usuario } = params;

  // Determinar saudação baseada no horário
  function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  // Mapear texto de resposta para setor
  function mapearSetorDeResposta(resposta, opcoesSetor) {
    if (!resposta || !opcoesSetor) return null;
    const textoLower = resposta.toLowerCase().trim();
    
    for (const opcao of opcoesSetor) {
      const labelLower = opcao.label.toLowerCase();
      if (textoLower === labelLower || textoLower.includes(opcao.setor) || labelLower.includes(textoLower)) {
        return opcao.setor;
      }
    }
    
    const mapeamento = {
      'vendas': ['venda', 'comprar', 'compra', 'preço', 'orçamento', 'cotação', '1', 'comercial'],
      'assistencia': ['suporte', 'assistencia', 'assistência', 'técnico', 'problema', 'ajuda', '2', 'reparo'],
      'financeiro': ['financeiro', 'boleto', 'pagamento', 'nota', 'fiscal', '3', 'cobrança'],
      'fornecedor': ['fornecedor', 'parceiro', 'fornecimento', '4'],
      'geral': ['outro', 'outros', 'geral', '5', 'não sei']
    };
    
    for (const [setor, palavras] of Object.entries(mapeamento)) {
      if (palavras.some(p => textoLower.includes(p))) {
        return setor;
      }
    }
    return null;
  }

  // ========== AÇÃO: INICIAR ==========
  if (action === 'iniciar') {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
      is_pre_atendimento_padrao: true,
      ativo: true
    }, '-created_date', 1);

    if (templates.length === 0) {
      console.log('[PRE-ATEND] ⚠️ Nenhum template de pré-atendimento configurado');
      return { success: false, error: 'sem_template' };
    }

    const template = templates[0];
    if (template.activation_mode === 'disabled') {
      console.log('[PRE-ATEND] ⚠️ Pré-atendimento desativado');
      return { success: false, skipped: true };
    }

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);

    if (!thread || !contato) {
      return { success: false, error: 'thread_ou_contato_nao_encontrado' };
    }

    const saudacao = getSaudacao();
    
    // 1. Saudação + apresentação
    let mensagemSaudacao = `Olá! ${saudacao}`;
    if (contato.nome && contato.nome !== contato.telefone) {
      mensagemSaudacao = `Olá, ${contato.nome}! ${saudacao}`;
    }
    mensagemSaudacao += ', eu sou o assistente virtual.';

    const opcoesSetor = template.opcoes_setor || [
      { label: '💼 Vendas', setor: 'vendas' },
      { label: '🔧 Suporte Técnico', setor: 'assistencia' },
      { label: '💰 Financeiro', setor: 'financeiro' },
      { label: '📦 Fornecedores', setor: 'fornecedor' }
    ];

    // 2. Quadro com pergunta + 3. Lista de setores + 4. Instrução
    const listaOpcoes = opcoesSetor.map((op, i) => `*${i + 1}.* ${op.label}`).join('\n');
    const blocoSetores = `┌─────────────────────────────────────┐
│  Para qual setor você gostaria de   │
│  falar?                              │
└─────────────────────────────────────┘

${listaOpcoes}

_Responda com o *número* ou *nome* da opção desejada._`;

    // 5. Buscar e formatar promoções (se houver)
    let blocoPromocoes = '';
    try {
      const promocoesResponse = await base44.functions.invoke('buscarPromocoesAtivas', {
        limite: 3,
        integration_id: integration_id,
        setor: thread.sector_id || 'geral'
      });
      
      if (promocoesResponse?.data?.success && promocoesResponse?.data?.texto_formatado) {
        blocoPromocoes = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *PROMOÇÕES EM DESTAQUE:*
${promocoesResponse.data.texto_formatado}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      }
    } catch (e) {
      console.log('[PRE-ATEND] ⚠️ Erro ao buscar promoções:', e.message);
    }

    const mensagemCompleta = `${mensagemSaudacao}\n\n${blocoSetores}${blocoPromocoes}`;

    // Enviar via Z-API diretamente
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) {
      console.error('[PRE-ATEND] ❌ Integração não encontrada:', integration_id);
      return { success: false, error: 'integracao_nao_encontrada' };
    }

    const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
    const zapiHeaders = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) {
      zapiHeaders['Client-Token'] = integracao.security_client_token_header;
    }

    console.log('[PRE-ATEND] 📤 Enviando saudação para:', contato.telefone);
    
    const envioPromise = fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({
        phone: contato.telefone,
        message: mensagemCompleta
      })
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout Z-API')), 10000)
    );
    
    const envioResp = await Promise.race([envioPromise, timeoutPromise]).catch(error => {
      console.error('[PRE-ATEND] Timeout ao enviar:', error);
      throw error;
    });
    
    const envioData = await envioResp.json();
    console.log('[PRE-ATEND] 📥 Resposta Z-API:', JSON.stringify(envioData));

    if (!envioResp.ok || envioData.error) {
      console.error('[PRE-ATEND] ❌ Erro ao enviar:', envioData);
      return { success: false, error: envioData.error || 'erro_envio' };
    }

    const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: template.id,
      contact_id: contact_id,
      thread_id: thread_id,
      whatsapp_integration_id: integration_id,
      status: 'ativo',
      current_step: 0,
      started_at: new Date().toISOString(),
      variables: { saudacao, opcoes_setor: opcoesSetor }
    });

    // Definir timeout de segurança (15 minutos)
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() + 15);
    
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      pre_atendimento_ativo: true,
      pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
      pre_atendimento_started_at: new Date().toISOString(),
      pre_atendimento_timeout_at: timeoutDate.toISOString()
    });

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemCompleta,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: envioData.messageId,
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true }
    });

    console.log('[PRE-ATEND] ✅ Pré-atendimento iniciado | FlowExec:', flowExecution.id);
    return { success: true, flow_execution_id: flowExecution.id };
  }

  // ========== AÇÃO: PROCESSAR RESPOSTA ==========
  if (action === 'processar_resposta') {
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      thread_id: thread_id,
      status: 'ativo'
    }, '-created_date', 1);

    if (execucoes.length === 0) {
      return { success: false, error: 'sem_execucao_ativa' };
    }

    const execucao = execucoes[0];
    const opcoesSetor = execucao.variables?.opcoes_setor || [];
    const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!setorEscolhido) {
      // Resposta não reconhecida - APENAS envia erro, NÃO reenvía URA
      const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integracao.security_client_token_header) {
        zapiHeaders['Client-Token'] = integracao.security_client_token_header;
      }

      await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({
          phone: contato.telefone,
          message: '❓ Opção inválida. Por favor, responda com o *número* da opção desejada (ex: 1, 2, 3).'
        })
      });

      // 🔥 MANTER ESTADO ATIVO - NÃO reenviar URA completa
      console.log('[PRE-ATEND] ⚠️ Resposta inválida - mantendo pré-atendimento ativo');
      return { success: true, understood: false };
    }

    // Buscar atendente fidelizado
    const campoFidelizado = {
      'vendas': 'atendente_fidelizado_vendas',
      'assistencia': 'atendente_fidelizado_assistencia',
      'financeiro': 'atendente_fidelizado_financeiro',
      'fornecedor': 'atendente_fidelizado_fornecedor'
    };
    
    let atendenteFidelizado = null;
    const campo = campoFidelizado[setorEscolhido];
    if (campo && contato[campo]) {
      try {
        atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]);
      } catch (e) {}
    }

    const threadUpdate = {
      sector_id: setorEscolhido,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'COMPLETED',
      pre_atendimento_timeout_at: null
    };

    let mensagemConfirmacao = '';
    if (atendenteFidelizado) {
      threadUpdate.assigned_user_id = atendenteFidelizado.id;
      threadUpdate.assigned_user_name = atendenteFidelizado.full_name;
      mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}*. Aguarde um momento!`;
    } else {
      mensagemConfirmacao = `✅ Entendido! Sua conversa foi direcionada para o setor de *${setorEscolhido}*. Um atendente entrará em contato em breve.`;
    }

    await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
    await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
      status: 'concluido',
      completed_at: new Date().toISOString(),
      variables: { ...execucao.variables, setor_escolhido: setorEscolhido }
    });

    // Enviar confirmação
    const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
    const zapiHeaders = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) {
      zapiHeaders['Client-Token'] = integracao.security_client_token_header;
    }

    await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({ phone: contato.telefone, message: mensagemConfirmacao })
    });

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemConfirmacao,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true, setor_roteado: setorEscolhido }
    });

    console.log('[PRE-ATEND] ✅ Concluído | Setor:', setorEscolhido, '| Fidelizado:', atendenteFidelizado?.id || 'N/A');
    return { success: true, setor_escolhido: setorEscolhido };
  }

  return { success: false, error: 'acao_invalida' };
}

// ============================================================================
// FUNÇÕES AUXILIARES - GUARDAS DE PRÉ-ATENDIMENTO
// ============================================================================

/**
 * Verifica se o contato/thread é de Fornecedor ou Compras
 * Esses casos NUNCA devem passar pelo pré-atendimento
 */
function ehFornecedorOuCompras(contact, thread) {
  // 1. Verificar tipo do contato
  if (contact.tipo_contato === 'fornecedor') return true;
  
  // 2. Verificar tags do contato
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) {
      return true;
    }
  }
  
  // 3. Verificar setor da thread
  const setoresExcluidos = ['fornecedor', 'compras', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) {
    return true;
  }
  
  return false;
}

/**
 * Decide se deve iniciar o pré-atendimento
 * Retorna true apenas se TODAS as condições forem atendidas
 */
function deveIniciarPreAtendimento(contact, thread) {
  // 1. Se já tem setor escolhido e pré-atendimento foi completado → NÃO iniciar
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id) {
    return false;
  }
  
  // 2. Se o pré-atendimento já foi explicitamente escolhido → NÃO iniciar
  if (thread.pre_atendimento_setor_explicitamente_escolhido === true) {
    return false;
  }
  
  // 3. Se é fornecedor/compras → NÃO iniciar
  if (ehFornecedorOuCompras(contact, thread)) {
    return false;
  }
  
  // Se passou por todas as guardas, pode iniciar
  return true;
}

async function handleMessage(dados, payloadBruto, base44) {
  const inicio = Date.now();
  
  // ✅ OTIMIZAÇÃO 1: Buscar duplicata + integração em PARALELO com timeout
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 8000)
  );
  
  const [dupResult, intResult] = await Promise.race([
    Promise.all([
      dados.messageId 
        ? base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: dados.messageId }, '-created_date', 1).catch(() => [])
        : Promise.resolve([]),
      dados.instanceId
        ? base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: dados.instanceId }, '-created_date', 1).catch(() => [])
        : Promise.resolve([])
    ]),
    timeoutPromise
  ]).catch(error => {
    console.error('[WEBHOOK] Timeout na busca inicial:', error);
    return [[], []];
  });

  // Verificar duplicata
  if (dupResult.length > 0) {
    return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
  }

  // Extrair informações da integração para metadata (canal/conexão)
  let integracaoId = null;
  let integracaoInfo = null;
  if (intResult.length > 0) {
    integracaoId = intResult[0].id;
    integracaoInfo = { nome: intResult[0].nome_instancia, numero: intResult[0].numero_telefone };
  }
  
  // Extrair connectedPhone do payload para identificar canal
  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;

  // Extrair foto de perfil do payload Z-API
  const profilePicUrl = payloadBruto.photo
    || payloadBruto.senderName?.profilePicUrl
    || payloadBruto.profilePicUrl
    || null;

  // ✅ OTIMIZAÇÃO 2: Buscar contato + thread em PARALELO com timeout
  const [contatos, threadsExistentes] = await Promise.race([
    Promise.all([
      base44.asServiceRole.entities.Contact.filter({ telefone: dados.from }, '-created_date', 1),
      base44.asServiceRole.entities.MessageThread.filter({ contact_id: { $exists: true } }, '-last_message_at', 500)
    ]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
  ]).catch(error => {
    console.error('[WEBHOOK] Timeout na busca de contato/thread:', error);
    return [[], []];
  });

  // Processar contato
  let contato;
  let isNovoContato = false;
  if (contatos.length > 0) {
    contato = contatos[0];
    const update = { ultima_interacao: new Date().toISOString() };
    if (dados.pushName && (!contato.nome || contato.nome === dados.from)) {
      update.nome = dados.pushName;
    }
    if (profilePicUrl && profilePicUrl !== 'null' && contato.foto_perfil_url !== profilePicUrl) {
      update.foto_perfil_url = profilePicUrl;
      update.foto_perfil_atualizada_em = new Date().toISOString();
    }
    // ✅ Update em background (não bloqueia)
    base44.asServiceRole.entities.Contact.update(contato.id, update).catch(() => {});
  } else {
    isNovoContato = true;
    contato = await base44.asServiceRole.entities.Contact.create({
      nome: dados.pushName || dados.from,
      telefone: dados.from,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: new Date().toISOString(),
      foto_perfil_url: profilePicUrl && profilePicUrl !== 'null' ? profilePicUrl : null,
      foto_perfil_atualizada_em: profilePicUrl ? new Date().toISOString() : null
    });
  }

  // Buscar thread do contato
  let thread = threadsExistentes.find(t => t.contact_id === contato.id);
  const now = new Date().toISOString();
  let isNovaThread = false;

  if (thread) {
    const threadUpdate = {
      last_message_at: now,
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta'
    };
    if (integracaoId && !thread.whatsapp_integration_id) {
      threadUpdate.whatsapp_integration_id = integracaoId;
    }
    // ✅ Update em background (não bloqueia)
    base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate).catch(() => {});
  } else {
    isNovaThread = true;
    thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contato.id,
      whatsapp_integration_id: integracaoId,
      status: 'aberta',
      primeira_mensagem_at: now,
      last_message_at: now,
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      total_mensagens: 1,
      unread_count: 1
    });
  }

  // ============================================================================
  // ✅ PERSISTIR MÍDIA - CIRURGICAMENTE via API do provedor (Z-API)
  // ============================================================================
  let mediaUrlFinal = dados.mediaUrl || null;
  let midiaPersistida = false;
  
  if (dados.mediaType && dados.mediaType !== 'none' && dados.fileId) {
    console.log(`[${VERSION}] 📎 Mídia Z-API detectada: ${dados.mediaType} | fileId: ${dados.fileId}`);
    
    try {
      const resultadoPersistencia = await base44.functions.invoke('persistirMidiaZapi', {
        file_id: dados.fileId,
        integration_id: integracaoId,
        media_type: dados.mediaType,
        filename: dados.content?.replace(/[\[\]]/g, '') || `${dados.mediaType}_${Date.now()}`
      });
      
      if (resultadoPersistencia?.data?.success && resultadoPersistencia?.data?.url) {
        mediaUrlFinal = resultadoPersistencia.data.url;
        midiaPersistida = true;
        console.log(`[${VERSION}] ✅ Mídia persistida via Z-API: ${mediaUrlFinal?.substring(0, 60)}...`);
      } else {
        console.log(`[${VERSION}] ⚠️ Falha ao persistir: ${resultadoPersistencia?.data?.error || 'desconhecido'}`);
        mediaUrlFinal = null;
        midiaPersistida = false;
      }
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao persistir mídia:`, e?.message || e);
      mediaUrlFinal = null;
      midiaPersistida = false;
    }
  }

  // ✅ OTIMIZAÇÃO 3: Salvar mensagem (crítico - aguarda)
  const mensagem = await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: contato.id,
    sender_type: 'contact',
    content: dados.content,
    media_url: mediaUrlFinal,
    media_type: dados.mediaType,
    media_caption: dados.mediaCaption,
    channel: 'whatsapp',
    status: 'recebida',
    whatsapp_message_id: dados.messageId,
    sent_at: now,
    metadata: {
      whatsapp_integration_id: integracaoId,
      instance_id: dados.instanceId,
      connected_phone: connectedPhone,
      canal_nome: integracaoInfo?.nome || null,
      canal_numero: integracaoInfo?.numero || (connectedPhone ? '+' + connectedPhone : null),
      vcard: dados.vcard,
      location: dados.location,
      quoted_message: dados.quotedMessage,
      processed_by: VERSION,
      midia_persistida: midiaPersistida,
      file_id: dados.fileId || null // ✅ Guardar fileId para auditoria
    }
  });

  // ============================================================================
  // ✅ LÓGICA ROBUSTA DE PRÉ-ATENDIMENTO (VERSÃO FINAL - SEM DUPLICAÇÕES)
  // ============================================================================
  
  // ============================================================================
  // 🔥 FLUXO CONSOLIDADO DE DECISÃO PRÉ-ATENDIMENTO
  // ============================================================================
  
  // 🔥 GUARDA 0: Se thread JÁ TEM ATENDENTE HUMANO → nunca roda pré-atendimento
  if (thread.assigned_user_id) {
    console.log('[' + VERSION + '] 👤 Thread já tem atendente humano:', thread.assigned_user_id);
    
    // ✅ Audit log em background (não bloqueia resposta)
    base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: now,
      sucesso_processamento: true
    }).catch(() => {});
    
    const duracao = Date.now() - inicio;
    console.log('[' + VERSION + '] ✅ Msg:', mensagem.id, '| Thread c/ atendente | ' + duracao + 'ms');
    
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      atendente_existente: true
    }, { headers: corsHeaders });
  }
  
  // 🔥 GUARDA 1: VERIFICAR FIDELIZAÇÃO (PRIORIDADE MÁXIMA)
  if (contato.is_cliente_fidelizado === true) {
    console.log('[' + VERSION + '] 🎯 Contato FIDELIZADO - Transferindo direto ao setor');
    
    try {
      // Determinar setor fidelizado
      const setorFidelizado = contato.atendente_fidelizado_vendas ? 'vendas' :
                              contato.atendente_fidelizado_assistencia ? 'assistencia' :
                              contato.atendente_fidelizado_financeiro ? 'financeiro' :
                              contato.atendente_fidelizado_fornecedor ? 'fornecedor' : 'geral';
      
      // Buscar atendente fidelizado
      const campoFidelizado = {
        'vendas': 'atendente_fidelizado_vendas',
        'assistencia': 'atendente_fidelizado_assistencia',
        'financeiro': 'atendente_fidelizado_financeiro',
        'fornecedor': 'atendente_fidelizado_fornecedor'
      };
      
      let atendenteFidelizado = null;
      const campo = campoFidelizado[setorFidelizado];
      if (campo && contato[campo]) {
        try {
          atendenteFidelizado = await base44.asServiceRole.entities.User.get(contato[campo]);
        } catch (e) {}
      }
      
      // Atualizar thread (SEM pré-atendimento)
      const threadUpdate = {
        sector_id: setorFidelizado,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'NAO_INICIADO'
      };
      
      if (atendenteFidelizado) {
        threadUpdate.assigned_user_id = atendenteFidelizado.id;
        threadUpdate.assigned_user_name = atendenteFidelizado.full_name;
      }
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
      
      console.log('[' + VERSION + '] ✅ Fidelizado transferido | Setor:', setorFidelizado, '| Atendente:', atendenteFidelizado?.id || 'N/A');
      
      // 🔥 RETURN IMEDIATO - Nunca entra no pré-atendimento
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        integration_id: integracaoId,
        fidelizado_transferido: true,
        setor: setorFidelizado,
        duration_ms: Date.now() - inicio
      }, { headers: corsHeaders });
      
    } catch (e) {
      console.error('[' + VERSION + '] ❌ Erro ao transferir fidelizado:', e.message);
    }
  }
  
  // 🔥 GUARDA 2: FORNECEDOR / COMPRAS → NUNCA roda pré-atendimento
  if (ehFornecedorOuCompras(contato, thread)) {
    console.log('[' + VERSION + '] 📦 Fornecedor/Compras detectado - ignorando pré-atendimento');
    
    // Se já tem setor definido, apenas continuar
    if (!thread.sector_id) {
      // Definir setor automaticamente
      const setorInferido = contato.tipo_contato === 'fornecedor' ? 'fornecedor' : 'compras';
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        sector_id: setorInferido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'NAO_INICIADO'
      }).catch(() => {});
    }
    
    // ✅ Audit log em background
    base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: now,
      sucesso_processamento: true
    }).catch(() => {});
    
    const duracao = Date.now() - inicio;
    console.log('[' + VERSION + '] ✅ Msg:', mensagem.id, '| Fornecedor/Compras | ' + duracao + 'ms');
    
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      fornecedor_compras: true
    }, { headers: corsHeaders });
  }
  
  // 🔥 PASSO 3: LER ESTADO DO PRÉ-ATENDIMENTO (FONTE ÚNICA DE VERDADE)
  const preAtivo = thread.pre_atendimento_ativo === true;
  
  const SAUDACOES = [
    'oi', 'olá', 'ola', 'oie', 'oii', 'oiii',
    'bom dia', 'boa tarde', 'boa noite',
    'bomdia', 'boatarde', 'boanoite',
    'hey', 'hello', 'hi',
    'e aí', 'e ai', 'eai', 'eae',
    'tudo bem', 'tudo bom', 'como vai',
    'opa', 'fala', 'salve'
  ];
  
  const mensagemLower = (dados.content || '').toLowerCase().trim();
  const isSaudacao = SAUDACOES.some(s => mensagemLower === s || mensagemLower.startsWith(s + ' ') || mensagemLower.startsWith(s + ',') || mensagemLower.startsWith(s + '!'));
  
  // 🔥 GUARDA 3: PRÉ-ATENDIMENTO JÁ FOI CONCLUÍDO → nunca reiniciar
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id) {
    console.log('[' + VERSION + '] ✅ Pré-atendimento já concluído - setor:', thread.sector_id);
    
    // ✅ Audit log em background
    base44.asServiceRole.entities.ZapiPayloadNormalized.create({
      payload_bruto: payloadBruto,
      instance_identificado: dados.instanceId,
      integration_id: integracaoId,
      evento: 'ReceivedCallback',
      timestamp_recebido: now,
      sucesso_processamento: true
    }).catch(() => {});
    
    const duracao = Date.now() - inicio;
    console.log('[' + VERSION + '] ✅ Msg:', mensagem.id, '| Pré-atend concluído | ' + duracao + 'ms');
    
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      pre_atendimento_concluido: true
    }, { headers: corsHeaders });
  }
  
  // 🔥 PASSO 4: PRÉ-ATENDIMENTO ATIVO → PROCESSAR RESPOSTA
  if (preAtivo) {
    console.log('[' + VERSION + '] 🔄 Processando resposta pré-atendimento | Thread:', thread.id);
    
    try {
      await executarPreAtendimentoInline(base44, {
        action: 'processar_resposta',
        thread_id: thread.id,
        contact_id: contato.id,
        integration_id: integracaoId,
        resposta_usuario: dados.content
      });
    } catch (e) {
      console.error('[' + VERSION + '] ❌ Erro ao processar resposta:', e.message);
    }
    
    // 🔥 RETURN IMEDIATO - Nunca continua para outras partes
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      pre_atendimento_resposta_processada: true,
      duration_ms: Date.now() - inicio
    }, { headers: corsHeaders });
  }
  
  // 🔥 PASSO 5: SAUDAÇÃO → DECIDIR SE PODE INICIAR PRÉ-ATENDIMENTO
  if (!preAtivo && isSaudacao) {
    // Usar função de decisão consolidada
    if (deveIniciarPreAtendimento(contato, thread)) {
      console.log('[' + VERSION + '] 🚀 Saudação detectada! Iniciando pré-atendimento | Msg:', mensagemLower);
      
      try {
        await executarPreAtendimentoInline(base44, {
          action: 'iniciar',
          thread_id: thread.id,
          contact_id: contato.id,
          integration_id: integracaoId
        });
        console.log('[' + VERSION + '] ✅ Pré-atendimento iniciado');
      } catch (e) {
        console.error('[' + VERSION + '] ❌ Erro ao iniciar:', e.message);
      }
      
      // 🔥 RETURN IMEDIATO
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        integration_id: integracaoId,
        pre_atendimento_iniciado: true,
        duration_ms: Date.now() - inicio
      }, { headers: corsHeaders });
    } else {
      console.log('[' + VERSION + '] ⛔ Saudação detectada mas pré-atendimento bloqueado por guardas');
    }
  }
  
  // 🔥 PASSO 6: MENSAGEM NORMAL (sem pré-atendimento)
  console.log('[' + VERSION + '] ℹ️ Mensagem normal - pré-atendimento não chamado');

  // ✅ Audit log em background (não bloqueia resposta)
  base44.asServiceRole.entities.ZapiPayloadNormalized.create({
    payload_bruto: payloadBruto,
    instance_identificado: dados.instanceId,
    integration_id: integracaoId,
    evento: 'ReceivedCallback',
    timestamp_recebido: now,
    sucesso_processamento: true
  }).catch(() => {});

  const duracao = Date.now() - inicio;
  console.log('[' + VERSION + '] ✅ Msg:', mensagem.id, '| De:', dados.from, '| Int:', integracaoId, '| ' + duracao + 'ms');

  return Response.json({
    success: true,
    message_id: mensagem.id,
    contact_id: contato.id,
    thread_id: thread.id,
    integration_id: integracaoId,
    duration_ms: duracao,
    mensagem_normal: true
  }, { headers: corsHeaders });
}