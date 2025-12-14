// ============================================================================
// MOTOR ÚNICO DE URA - Usado por Z-API e W-API
// ============================================================================
// Processamento unificado de pré-atendimento para ambos os provedores
// ============================================================================

function getSaudacao() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function mapearSetorDeResposta(resposta, opcoesSetor) {
  if (!resposta || !opcoesSetor) return null;
  const textoLower = resposta.toLowerCase().trim();
  
  // 1. Verificar match exato com opcoes do template
  for (const opcao of opcoesSetor) {
    const labelLower = opcao.label.toLowerCase();
    if (textoLower === labelLower || textoLower.includes(opcao.setor) || labelLower.includes(textoLower)) {
      return opcao.setor;
    }
  }
  
  // 2. Mapeamento de palavras-chave (fallback)
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

/**
 * Processa URA (iniciar ou processar resposta)
 * @param {object} params - { base44, action, thread_id, contact_id, integration_id, resposta_usuario, provider }
 * @returns {object} - { success, error?, flow_execution_id?, setor_escolhido? }
 */
export async function processarURA(params) {
  const { base44, action, thread_id, contact_id, integration_id, resposta_usuario, provider } = params;

  if (action === 'iniciar') {
    const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
      is_pre_atendimento_padrao: true,
      ativo: true
    }, '-created_date', 1);

    if (templates.length === 0) return { success: false, error: 'sem_template' };

    const template = templates[0];
    if (template.activation_mode === 'disabled') return { success: false, skipped: true };

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
      console.log('[URA] ⚠️ Erro ao buscar promoções:', e.message);
    }

    const mensagemCompleta = `${mensagemSaudacao}\n\n${blocoSetores}${blocoPromocoes}`;

    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) return { success: false, error: 'integracao_nao_encontrada' };

    // Envio baseado no provedor
    let envioResp, envioData;

    if (provider === 'z_api') {
      const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integracao.security_client_token_header) {
        zapiHeaders['Client-Token'] = integracao.security_client_token_header;
      }
      envioResp = await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({ phone: contato.telefone, message: mensagemCompleta })
      }).catch(e => { throw e; });
      envioData = await envioResp.json();
    } else if (provider === 'w_api') {
      const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      };
      envioResp = await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          instanceId: integracao.instance_id_provider,
          number: contato.telefone,
          text: mensagemCompleta
        })
      }).catch(e => { throw e; });
      envioData = await envioResp.json();
    } else {
      return { success: false, error: 'provedor_invalido' };
    }
    
    if (!envioResp.ok || envioData.error) {
      console.error('[URA] ❌ Erro ao enviar:', envioData);
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
      whatsapp_message_id: envioData.messageId || envioData.key?.id,
      sent_at: new Date().toISOString(),
      metadata: { 
        whatsapp_integration_id: integration_id, 
        pre_atendimento: true, 
        is_system_message: true,
        message_type: 'ura_prompt'
      }
    });

    console.log('[URA] ✅ Iniciado | FlowExec:', flowExecution.id);
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
      // Enviar mensagem de erro baseado no provedor
      const mensagemErro = '❓ Opção inválida. Por favor, responda com o *número* ou *nome* da opção desejada.';
      
      if (provider === 'z_api') {
        const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
        const zapiHeaders = { 'Content-Type': 'application/json' };
        if (integracao.security_client_token_header) {
          zapiHeaders['Client-Token'] = integracao.security_client_token_header;
        }
        await fetch(zapiUrl, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({ phone: contato.telefone, message: mensagemErro })
        }).catch(() => {});
      } else if (provider === 'w_api') {
        const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
        const wapiHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integracao.api_key_provider}`
        };
        await fetch(wapiUrl, {
          method: 'POST',
          headers: wapiHeaders,
          body: JSON.stringify({
            instanceId: integracao.instance_id_provider,
            number: contato.telefone,
            text: mensagemErro
          })
        }).catch(() => {});
      }

      console.log('[URA] ⚠️ Resposta inválida');
      return { success: true, understood: false };
    }

    // ORDEM CORRETA: setor → atendente → finalizar
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
      mensagemConfirmacao = `✅ Perfeito! Você será atendido por *${atendenteFidelizado.full_name}* do setor de *${setorEscolhido}*. Aguarde!`;
    } else {
      mensagemConfirmacao = `✅ Entendido! Sua conversa foi direcionada para o setor de *${setorEscolhido}*. Um atendente entrará em contato em breve.`;
    }

    await base44.asServiceRole.entities.MessageThread.update(thread_id, threadUpdate);
    await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
      status: 'concluido',
      completed_at: new Date().toISOString(),
      variables: { ...execucao.variables, setor_escolhido: setorEscolhido }
    });

    // Enviar confirmação baseado no provedor
    if (provider === 'z_api') {
      const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integracao.security_client_token_header) {
        zapiHeaders['Client-Token'] = integracao.security_client_token_header;
      }
      await fetch(zapiUrl, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({ phone: contato.telefone, message: mensagemConfirmacao })
      }).catch(() => {});
    } else if (provider === 'w_api') {
      const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
      const wapiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integracao.api_key_provider}`
      };
      await fetch(wapiUrl, {
        method: 'POST',
        headers: wapiHeaders,
        body: JSON.stringify({
          instanceId: integracao.instance_id_provider,
          number: contato.telefone,
          text: mensagemConfirmacao
        })
      }).catch(() => {});
    }

    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagemConfirmacao,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: { 
        whatsapp_integration_id: integration_id, 
        pre_atendimento: true, 
        setor_roteado: setorEscolhido, 
        is_system_message: true,
        message_type: 'ura_confirm'
      }
    });

    console.log('[URA] ✅ Concluído | Setor:', setorEscolhido);
    return { success: true, setor_escolhido: setorEscolhido };
  }

  return { success: false, error: 'acao_invalida' };
}

export function ehFornecedorOuCompras(contact, thread) {
  if (contact.tipo_contato === 'fornecedor') return true;
  if (contact.tags && Array.isArray(contact.tags)) {
    if (contact.tags.includes('fornecedor') || contact.tags.includes('compras')) return true;
  }
  const setoresExcluidos = ['fornecedor', 'compras', 'fornecedores'];
  if (thread.sector_id && setoresExcluidos.includes(thread.sector_id.toLowerCase())) return true;
  return false;
}

/**
 * Verifica se há atendente "stale" (sem atividade recente)
 * @param {object} thread - Thread com assigned_user_id e last_message_at
 * @param {number} horasInatividade - Horas de inatividade para considerar stale (padrão: 8h)
 * @returns {boolean} - true se assigned_user_id está stale
 */
export function assignedUserStale(thread, horasInatividade = 8) {
  if (!thread.assigned_user_id) return false;
  if (!thread.last_message_at) return false;
  
  const lastMessageDate = new Date(thread.last_message_at);
  const agora = new Date();
  const diferencaHoras = (agora - lastMessageDate) / (1000 * 60 * 60);
  
  return diferencaHoras > horasInatividade;
}

/**
 * Implementa "Sticky Setor" - Redireciona automaticamente para o setor anterior
 * @param {object} base44 - SDK
 * @param {object} thread - Thread com sector_id
 * @param {object} contato - Contact
 * @param {string} integracaoId - ID da integração
 * @param {string} provider - 'z_api' ou 'w_api'
 * @returns {Promise<boolean>} - true se aplicou sticky setor
 */
export async function aplicarStickySetor(base44, thread, contato, integracaoId, provider) {
  if (!thread.sector_id) return false;
  
  const mensagem = `✅ Entendido! Vou te direcionar novamente para *${thread.sector_id.charAt(0).toUpperCase() + thread.sector_id.slice(1)}*. ⏳`;
  
  const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integracaoId);
  if (!integracao) return false;
  
  // Enviar confirmação baseado no provedor
  if (provider === 'z_api') {
    const zapiUrl = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`;
    const zapiHeaders = { 'Content-Type': 'application/json' };
    if (integracao.security_client_token_header) {
      zapiHeaders['Client-Token'] = integracao.security_client_token_header;
    }
    await fetch(zapiUrl, {
      method: 'POST',
      headers: zapiHeaders,
      body: JSON.stringify({ phone: contato.telefone, message: mensagem })
    }).catch(() => {});
  } else if (provider === 'w_api') {
    const wapiUrl = `${integracao.base_url_provider}/messages/send/text`;
    const wapiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integracao.api_key_provider}`
    };
    await fetch(wapiUrl, {
      method: 'POST',
      headers: wapiHeaders,
      body: JSON.stringify({
        instanceId: integracao.instance_id_provider,
        number: contato.telefone,
        text: mensagem
      })
    }).catch(() => {});
  }
  
  // Registrar mensagem do sistema
  await base44.asServiceRole.entities.Message.create({
    thread_id: thread.id,
    sender_id: 'system',
    sender_type: 'user',
    content: mensagem,
    channel: 'whatsapp',
    status: 'enviada',
    sent_at: new Date().toISOString(),
    metadata: { 
      whatsapp_integration_id: integracaoId, 
      is_system_message: true,
      message_type: 'sticky_setor'
    }
  });
  
  console.log('[URA] ✅ Sticky Setor aplicado:', thread.sector_id);
  return true;
}

export function deveIniciarPreAtendimento(contact, thread) {
  // Se a URA foi completada E ainda há um atendente atribuído E não está stale, não reinicia
  if (thread.pre_atendimento_state === 'COMPLETED' && thread.assigned_user_id && !assignedUserStale(thread)) {
    return false;
  }
  
  if (thread.pre_atendimento_setor_explicitamente_escolhido === true) return false;
  if (ehFornecedorOuCompras(contact, thread)) return false;
  return true;
}

export const SAUDACOES = [
  'oi', 'olá', 'ola', 'oie', 'oii', 'oiii',
  'bom dia', 'boa tarde', 'boa noite',
  'bomdia', 'boatarde', 'boanoite',
  'hey', 'hello', 'hi',
  'e aí', 'e ai', 'eai', 'eae',
  'tudo bem', 'tudo bom', 'como vai',
  'opa', 'fala', 'salve'
];