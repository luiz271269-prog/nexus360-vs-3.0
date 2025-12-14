import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { connectionManager } from './lib/connectionManager.js';

// ============================================================================
// WEBHOOK WHATSAPP Z-API - v8.5.0 MICRO-URA COMPLETA
// ============================================================================
// CORREÇÕES v8.5.0:
// 1. Micro-URA processada ANTES do hard-stop
// 2. Respostas "1/2" consumidas corretamente (não viram mensagem normal)
// 3. Mensagens de sistema marcadas com is_system_message
// 4. Limpeza de pedidos expirados
// 5. Detecção de novos pedidos mesmo com atendente
// ============================================================================

const VERSION = 'v8.5.0-MICRO-URA';
const BUILD_DATE = '2025-12-12';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// NORMALIZAÇÃO DE TELEFONE
// ============================================================================
function normalizarTelefoneUnificado(telefone) {
  if (!telefone) return null;
  let numeroLimpo = String(telefone).split('@')[0];
  let apenasNumeros = numeroLimpo.replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  return apenasNumeros;
}

// ============================================================================
// FILTRO ULTRA-RÁPIDO
// ============================================================================
function deveIgnorar(payload) {
  if (!payload || typeof payload !== 'object') return 'payload_invalido';
  const tipo = String(payload.type || payload.event || '').toLowerCase();
  const phone = String(payload.phone || '').toLowerCase();

  if (phone.includes('status@') || phone.includes('@broadcast') || 
      phone.includes('@lid') || phone.includes('@g.us')) {
    return 'jid_sistema';
  }

  if (tipo.includes('qrcode') || tipo.includes('connection')) return null;

  const eventosLixo = ['presencechatcallback', 'presence', 'typing', 'composing', 'chat-update', 'call'];
  if (eventosLixo.some(e => tipo.includes(e))) return 'evento_sistema';

  if (tipo.includes('messagestatuscallback')) {
    if (phone.includes('status@') || phone.includes('@broadcast')) return 'status_broadcast';
    return null;
  }

  if (tipo === 'receivedcallback' || (payload.phone && payload.messageId)) {
    if (payload.isGroup === true) return 'grupo';
    if (payload.fromMe === true) return 'from_me';
    if (!payload.phone) return 'sem_telefone';
    return null;
  }

  return 'evento_desconhecido';
}

// ============================================================================
// NORMALIZAR PAYLOAD
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

  const telefone = payload.phone || '';
  const numeroLimpo = normalizarTelefoneUnificado(telefone);
  if (!numeroLimpo) return { type: 'unknown', error: 'telefone_invalido' };

  let mediaType = 'none';
  let mediaUrl = null;
  let fileId = null;
  let conteudo = payload.text?.message || payload.body || '';

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
    fileId,
    mediaCaption: payload.image?.caption || payload.video?.caption,
    pushName: payload.senderName || payload.chatName,
    vcard: payload.contactMessage || payload.vcard,
    location: payload.location,
    quotedMessage: payload.quotedMsg
  };
}

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

import { processarURA, ehFornecedorOuCompras, deveIniciarPreAtendimento, assignedUserStale, aplicarStickySetor, SAUDACOES } from './lib/uraProcessor.js';

// ============================================================================
// PRÉ-ATENDIMENTO INLINE - DEPRECATED (usar uraProcessor.js)
// ============================================================================
async function executarPreAtendimentoInline_DEPRECATED(base44, params) {
  const { action, thread_id, contact_id, integration_id, resposta_usuario } = params;

  function getSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
  }

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

  if (action === 'iniciar') {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
      is_pre_atendimento_padrao: true,
      ativo: true
    }, '-created_date', 1);

    if (templates.length === 0) {
      console.log('[PRE-ATEND] ⚠️ Nenhum template configurado');
      return { success: false, error: 'sem_template' };
    }

    const template = templates[0];
    if (template.activation_mode === 'disabled') {
      console.log('[PRE-ATEND] ⚠️ Desativado');
      return { success: false, skipped: true };
    }

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!thread || !contato) return { success: false, error: 'thread_ou_contato_nao_encontrado' };

    const saudacao = getSaudacao();
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

    const listaOpcoes = opcoesSetor.map((op, i) => `*${i + 1}.* ${op.label}`).join('\n');
    const blocoSetores = `┌─────────────────────────────────────┐
│  Para qual setor você gostaria de   │
│  falar?                              │
└─────────────────────────────────────┘

${listaOpcoes}

_Responda com o *número* ou *nome* da opção desejada._`;

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

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) {
      console.error('[PRE-ATEND] ❌ Integração não encontrada');
      return { success: false, error: 'integracao_nao_encontrada' };
    }

    const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
    const zapiHeaders = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) {
      zapiHeaders['Client-Token'] = integracao.security_client_token_header;
    }

    const envioResp = await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({ phone: contato.telefone, message: mensagemCompleta })
    }).catch(e => { throw e; });
    
    const envioData = await envioResp.json();
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
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true, is_system_message: true }
    });

    console.log('[PRE-ATEND] ✅ Iniciado | FlowExec:', flowExecution.id);
    return { success: true, flow_execution_id: flowExecution.id };
  }

  if (action === 'processar_resposta') {
    const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
      thread_id: thread_id,
      status: 'ativo'
    }, '-created_date', 1);

    if (execucoes.length === 0) return { success: false, error: 'sem_execucao_ativa' };

    const execucao = execucoes[0];
    const opcoesSetor = execucao.variables?.opcoes_setor || [];
    const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!setorEscolhido) {
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

      console.log('[PRE-ATEND] ⚠️ Resposta inválida');
      return { success: true, understood: false };
    }

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
      pre_atendimento_timeout_at: null,
      pre_atendimento_setor_explicitamente_escolhido: true
    };

    let mensagemConfirmacao = '';
    if (atendenteFidelizado) {
      threadUpdate.assigned_user_id = atendenteFidelizado.id;
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
      metadata: { whatsapp_integration_id: integration_id, pre_atendimento: true, setor_roteado: setorEscolhido, is_system_message: true }
    });

    console.log('[PRE-ATEND] ✅ Concluído | Setor:', setorEscolhido);
    return { success: true, setor_escolhido: setorEscolhido };
  }

  return { success: false, error: 'acao_invalida' };
}

// ============================================================================
// GUARDAS
// ============================================================================
function ehFornecedorOuCompras(contact, thread) {
  if (contact.tipo_contato === 'fornecedor') return true;
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) return true;
  }
  const setoresExcluidos = ['fornecedor', 'compras', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) return true;
  return false;
}

function deveIniciarPreAtendimento(contact, thread) {
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id) return false;
  if (thread.pre_atendimento_setor_explicitamente_escolhido === true) return false;
  if (ehFornecedorOuCompras(contact, thread)) return false;
  return true;
}

// ============================================================================
// HANDLE MESSAGE - ORDEM CORRETA
// ============================================================================
async function handleMessage(dados, payloadBruto, base44) {
  const inicio = Date.now();
  
  const [dupResult, intResult] = await Promise.all([
    dados.messageId 
      ? base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: dados.messageId }, '-created_date', 1).catch(() => [])
      : Promise.resolve([]),
    dados.instanceId
      ? base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: dados.instanceId }, '-created_date', 1).catch(() => [])
      : Promise.resolve([])
  ]);

  if (dupResult.length > 0) {
    return Response.json({ success: true, ignored: true, reason: 'duplicata' }, { headers: corsHeaders });
  }

  let integracaoId = null;
  let integracaoInfo = null;
  if (intResult.length > 0) {
    integracaoId = intResult[0].id;
    integracaoInfo = { nome: intResult[0].nome_instancia, numero: intResult[0].numero_telefone };
  }
  
  const connectedPhone = payloadBruto.connectedPhone || payloadBruto.connected_phone || null;
  const profilePicUrl = payloadBruto.photo || payloadBruto.senderName?.profilePicUrl || payloadBruto.profilePicUrl || null;

  const [contatos, threadsExistentes] = await Promise.all([
    base44.asServiceRole.entities.Contact.filter({ telefone: dados.from }, '-created_date', 1),
    base44.asServiceRole.entities.MessageThread.filter({ contact_id: { $exists: true } }, '-last_message_at', 500)
  ]);

  let contato;
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
    base44.asServiceRole.entities.Contact.update(contato.id, update).catch(() => {});
  } else {
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

  let thread = threadsExistentes.find(t => t.contact_id === contato.id);
  const now = new Date().toISOString();

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
    base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate).catch(() => {});
  } else {
    thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contato.id,
      whatsapp_integration_id: integracaoId,
      status: 'aberta',
      primeira_mensagem_at: now,
      last_message_at: now,
      last_message_sender: 'contact',
      last_message_content: (dados.content || '').substring(0, 100),
      total_mensagens: 1,
      unread_count: 1,
      pre_atendimento_setor_explicitamente_escolhido: false,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'INIT',
      transfer_pending: false
    });
  }

  // ✅ PERSISTIR MÍDIA
  let mediaUrlFinal = dados.mediaUrl || null;
  let midiaPersistida = false;
  
  if (dados.mediaType && dados.mediaType !== 'none' && dados.fileId) {
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
      }
    } catch (e) {
      console.error(`[${VERSION}] ❌ Erro ao persistir mídia:`, e?.message || e);
    }
  }

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
      file_id: dados.fileId || null
    }
  });

  // ============================================================================
  // ORDEM CORRETA: MICRO-URA ANTES DE TUDO
  // ============================================================================
  
  // (1) LIMPEZA: Pedidos expirados
  const { detectarPedidoTransferencia, podeEnviarPergunta, pedidoExpirou } = await import('./lib/detectorPedidoTransferencia.js');
  
  if (thread.transfer_pending && pedidoExpirou(thread)) {
    console.log('[' + VERSION + '] ⏳ Micro-URA expirada, limpando');
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      transfer_pending: false,
      transfer_requested_sector_id: null,
      transfer_requested_user_id: null,
      transfer_requested_text: null,
      transfer_confirmed: false,
      transfer_expires_at: null,
      transfer_last_prompt_at: null
    }).catch(() => {});
  }

  // (2) CONSUMIR RESPOSTAS "1/2" PRIMEIRO (ANTES DE QUALQUER OUTRA LÓGICA)
  if (thread.transfer_pending && !pedidoExpirou(thread)) {
    const resposta = dados.content?.trim();
    
    if (resposta === '1' || resposta.toLowerCase().includes('sim')) {
      console.log('[' + VERSION + '] ✅ Cliente CONFIRMOU transferência');
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_confirmed: true
      }).catch(() => {});
      
      const integracao = integracaoId 
        ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
        : null;
      
      if (integracao) {
        const msgConfirm = '✅ Entendido! Seu pedido foi confirmado. Aguarde a transferência.';
        const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
        const zapiHeaders = { 'Content-Type': 'application/json' };
        if (integracao.security_client_token_header) {
          zapiHeaders['Client-Token'] = integracao.security_client_token_header;
        }
        
        await fetch(zapiUrl, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({ phone: contato.telefone, message: msgConfirm })
        }).catch(() => {});
      }
      
      // ✅ CONSUMIR resposta - não processar como mensagem normal
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        duration_ms: duracao,
        micro_ura_resposta_consumida: true,
        acao: 'confirmou'
      }, { headers: corsHeaders });
    }
    else if (resposta === '2' || resposta.toLowerCase().includes('nao') || resposta.toLowerCase().includes('não')) {
      console.log('[' + VERSION + '] ❌ Cliente CANCELOU transferência');
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_requested_text: null,
        transfer_confirmed: false,
        transfer_expires_at: null,
        transfer_last_prompt_at: null
      }).catch(() => {});
      
      // ✅ CONSUMIR resposta - não processar como mensagem normal
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        duration_ms: duracao,
        micro_ura_resposta_consumida: true,
        acao: 'cancelou'
      }, { headers: corsHeaders });
    }
  }

  // (3) HARD-STOP COM MICRO-URA: Se tem atendente (mas verificar se está stale)
  if (thread.assigned_user_id) {
    // Verificar se atendente está "stale" (8h sem atividade)
    if (assignedUserStale(thread, 8)) {
      console.log('[' + VERSION + '] ⏰ Atendente STALE - limpando assigned_user_id');
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        assigned_user_id: null
      }).catch(() => {});
      // Não retorna, continua processamento normal (sticky ou URA)
    } else {
      console.log('[' + VERSION + '] 🛡️ Thread com atendente ATIVO:', thread.assigned_user_id);
      
      // Só detecta novo pedido se não houver um pendente
      if (!thread.transfer_pending) {
      let todosAtendentes = [];
      try {
        const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
        todosAtendentes = usuarios.filter(u => u.full_name && (u.attendant_sector || u.setores_atendidos_ids?.length > 0));
      } catch (e) {}
      
      const deteccao = detectarPedidoTransferencia(dados.content, todosAtendentes);
      
      if (deteccao.solicitou && podeEnviarPergunta(thread)) {
        console.log('[' + VERSION + '] 🔄 Pedido detectado:', deteccao);
        
        const atendenteAtual = todosAtendentes.find(a => a.id === thread.assigned_user_id);
        const nomeAtendente = atendenteAtual?.full_name || 'seu atendente atual';
        
        let pergunta = `Você quer que eu transfira `;
        if (deteccao.setor) pergunta += `para *${deteccao.setor.charAt(0).toUpperCase() + deteccao.setor.slice(1)}*`;
        if (deteccao.nome_atendente) pergunta += ` (*${deteccao.nome_atendente}*)`;
        pergunta += ` agora?\n\n1️⃣ Sim, transferir\n2️⃣ Não, continuar com ${nomeAtendente}`;
        
        const integracao = integracaoId 
          ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId).catch(() => null)
          : null;
        
        if (integracao) {
          const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
          const zapiHeaders = { 'Content-Type': 'application/json' };
          if (integracao.security_client_token_header) {
            zapiHeaders['Client-Token'] = integracao.security_client_token_header;
          }
          
          await fetch(zapiUrl, {
            method: 'POST',
            headers: zapiHeaders,
            body: JSON.stringify({ phone: contato.telefone, message: pergunta })
          }).catch(() => {});
          
          // Registrar mensagem do bot
          await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: 'system',
            sender_type: 'user',
            content: pergunta,
            channel: 'whatsapp',
            status: 'enviada',
            sent_at: new Date().toISOString(),
            metadata: { 
              whatsapp_integration_id: integracaoId, 
              is_system_message: true, 
              message_type: 'micro_ura_prompt' 
            }
          });
        }
        
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 5);
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          transfer_pending: true,
          transfer_requested_sector_id: deteccao.setor,
          transfer_requested_user_id: deteccao.atendente_id,
          transfer_requested_text: deteccao.texto_original,
          transfer_requested_at: now,
          transfer_confirmed: false,
          transfer_expires_at: expiraEm.toISOString(),
          transfer_last_prompt_at: now
        }).catch(() => {});
        
        console.log('[' + VERSION + '] ✅ Micro-URA enviada');
      }
      
      const duracao = Date.now() - inicio;
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
  }
  
  // (4) GUARDA: FIDELIZAÇÃO
  if (contato.is_cliente_fidelizado === true) {
    console.log('[' + VERSION + '] 🎯 FIDELIZADO - Transferindo');
    
    const setorFidelizado = contato.atendente_fidelizado_vendas ? 'vendas' :
                            contato.atendente_fidelizado_assistencia ? 'assistencia' :
                            contato.atendente_fidelizado_financeiro ? 'financeiro' :
                            contato.atendente_fidelizado_fornecedor ? 'fornecedor' : 'geral';
    
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
    
    const threadUpdate = {
      sector_id: setorFidelizado,
      pre_atendimento_ativo: false,
      pre_atendimento_state: 'NAO_INICIADO'
    };
    
    if (atendenteFidelizado) {
      threadUpdate.assigned_user_id = atendenteFidelizado.id;
    }
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, threadUpdate);
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      fidelizado_transferido: true,
      duration_ms: duracao
    }, { headers: corsHeaders });
  }
  
  // (5) GUARDA: FORNECEDOR/COMPRAS
  if (ehFornecedorOuCompras(contato, thread)) {
    console.log('[' + VERSION + '] 📦 Fornecedor/Compras - ignorando PA');
    
    if (!thread.sector_id) {
      const setorInferido = contato.tipo_contato === 'fornecedor' ? 'fornecedor' : 'compras';
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        sector_id: setorInferido,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'NAO_INICIADO'
      }).catch(() => {});
    }
    
    const duracao = Date.now() - inicio;
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
  
  // (6) PRÉ-ATENDIMENTO ATIVO - PROCESSAR RESPOSTA
  const preAtivo = thread.pre_atendimento_ativo === true;
  
  if (preAtivo) {
    console.log('[' + VERSION + '] 🔄 Processando resposta PA');
    
    try {
      await processarURA({
        base44,
        action: 'processar_resposta',
        thread_id: thread.id,
        contact_id: contato.id,
        integration_id: integracaoId,
        resposta_usuario: dados.content,
        provider: 'z_api'
      });
    } catch (e) {
      console.error('[' + VERSION + '] ❌ Erro ao processar:', e.message);
    }
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      pre_atendimento_resposta_processada: true,
      duration_ms: duracao
    }, { headers: corsHeaders });
  }
  
  // (7) REABERTURA: STICKY SETOR ou INICIAR PA
  const SAUDACOES_LOCAL = SAUDACOES;
  
  const mensagemLower = (dados.content || '').toLowerCase().trim();
  const isSaudacao = SAUDACOES_LOCAL.some(s => mensagemLower === s || mensagemLower.startsWith(s + ' ') || mensagemLower.startsWith(s + ',') || mensagemLower.startsWith(s + '!'));
  
  // PRÉ-ATENDIMENTO JÁ CONCLUÍDO COM SETOR - APLICAR STICKY SETOR
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.sector_id && isSaudacao) {
    console.log('[' + VERSION + '] 🔄 PA concluído - aplicando Sticky Setor:', thread.sector_id);
    
    const aplicouSticky = await aplicarStickySetor(base44, thread, contato, integracaoId, 'z_api');
    
    const duracao = Date.now() - inicio;
    return Response.json({
      success: true,
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      integration_id: integracaoId,
      duration_ms: duracao,
      sticky_setor_aplicado: aplicouSticky
    }, { headers: corsHeaders });
  }
  
  if (!preAtivo && isSaudacao) {
    if (deveIniciarPreAtendimento(contato, thread)) {
      console.log('[' + VERSION + '] 🚀 Saudação! Iniciando PA');
      
      try {
        await processarURA({
          base44,
          action: 'iniciar',
          thread_id: thread.id,
          contact_id: contato.id,
          integration_id: integracaoId,
          provider: 'z_api'
        });
      } catch (e) {
        console.error('[' + VERSION + '] ❌ Erro ao iniciar:', e.message);
      }
      
      const duracao = Date.now() - inicio;
      return Response.json({
        success: true,
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id,
        integration_id: integracaoId,
        pre_atendimento_iniciado: true,
        duration_ms: duracao
      }, { headers: corsHeaders });
    }
  }
  
  // (8) MENSAGEM NORMAL
  console.log('[' + VERSION + '] ℹ️ Mensagem normal');

  const duracao = Date.now() - inicio;
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