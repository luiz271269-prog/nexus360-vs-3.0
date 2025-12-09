import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// MOTOR DE PRÉ-ATENDIMENTO - v2.1.0
// ============================================================================
// Responsável por:
// 1. Verificar continuidade (clientes/fidelizados com conversa recente)
// 2. Enviar saudação dinâmica com opções de setor
// 3. Processar resposta do contato (setor, nome de atendente, intenção)
// 4. Rotear para atendente fidelizado ou do setor
// 5. Análise de contexto e intenção (pagamento, cotação, suporte)
// ============================================================================

const VERSION = 'v2.1.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================================
// FUNÇÕES AUXILIARES
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

function similaridade(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  const minLen = Math.min(s1.length, s2.length);
  let prefixMatch = 0;
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) prefixMatch++;
    else break;
  }
  if (prefixMatch >= 3) return 0.7 + (prefixMatch / minLen) * 0.2;
  
  let comum = 0;
  const chars1 = s1.split('');
  const chars2 = s2.split('');
  for (const c of chars1) {
    const idx = chars2.indexOf(c);
    if (idx !== -1) {
      comum++;
      chars2.splice(idx, 1);
    }
  }
  return comum / Math.max(s1.length, s2.length);
}

function matchPalavra(palavra, termos) {
  for (const termo of termos) {
    if (palavra === termo) return true;
    if (palavra.length >= 4 && termo.length >= 4) {
      if (similaridade(palavra, termo) >= 0.75) return true;
    }
  }
  return false;
}

const setorLabels = {
  vendas: 'Vendas',
  assistencia: 'Assistência Técnica',
  financeiro: 'Financeiro',
  fornecedor: 'Fornecedores',
  geral: 'Atendimento Geral'
};

const camposFidelizado = {
  vendas: 'atendente_fidelizado_vendas',
  assistencia: 'atendente_fidelizado_assistencia',
  financeiro: 'atendente_fidelizado_financeiro',
  fornecedor: 'atendente_fidelizado_fornecedor',
  geral: 'atendente_fidelizado_vendas'
};

const keywords = {
  vendas: ['venda', 'vendas', 'compra', 'comprar', 'comprou', 'comprei', 'comercial', 'produto', 'produtos', 'catalogo', 'bicicleta', 'bicicletas', 'bike', 'bikes', 'preco', 'valor', 'desconto', 'promocao', 'estoque', 'disponivel', 'tem', 'quero', 'interessado', 'interesse'],
  assistencia: ['suporte', 'tecnico', 'tecnica', 'assistencia', 'problema', 'problemas', 'defeito', 'defeitos', 'garantia', 'conserto', 'reparo', 'reparar', 'manutencao', 'nao funciona', 'quebrou', 'quebrado', 'trocar', 'troca', 'arrumar'],
  financeiro: ['financeiro', 'boleto', 'boletos', 'pagamento', 'pagamentos', 'pagar', 'paguei', 'pix', 'nota', 'notas', 'fiscal', 'nf', 'nfe', 'cobranca', 'parcela', 'parcelas', 'fatura', 'faturas', 'baixou', 'baixar', 'compensou', 'compensar', 'pago', 'paga', 'recibo', 'comprovante', 'transferencia', 'deposito', 'depositei'],
  fornecedor: ['fornecedor', 'fornecedores', 'parceiro', 'parceiros', 'parceria', 'representante', 'distribuidor', 'atacado', 'revenda', 'revendedor']
};

const intentKeywords = {
  cotacao: ['cotacao', 'orcamento', 'quanto', 'preco', 'valor', 'proposta', 'orcar', 'orcando', 'cotando', 'cotar'],
  suporte: ['ajuda', 'ajudar', 'problema', 'problemas', 'erro', 'erros', 'nao consigo', 'como faco', 'duvida', 'duvidas'],
  pagamento: ['pix', 'boleto', 'pagar', 'paguei', 'pagamento', 'baixou', 'baixar', 'compensou', 'compensar', 'pago', 'paga', 'transferencia', 'deposito', 'depositei', 'transferi'],
  informacao: ['informacao', 'saber', 'gostaria', 'poderia', 'sobre', 'informar']
};

const variacoesNomes = {
  'thais': ['tais', 'thays', 'tays'],
  'gabriel': ['gab', 'gabi', 'grabiel'],
  'rafael': ['rafa', 'rafinha'],
  'lucas': ['luca', 'luke'],
  'maria': ['mari', 'marih'],
  'julia': ['ju', 'julinha', 'juju'],
  'ana': ['aninha', 'anninha'],
  'joao': ['joaozinho', 'jão'],
  'pedro': ['pedrinho', 'ped'],
  'carlos': ['carlão', 'carlinhos', 'carl'],
  'fernanda': ['fer', 'nanda', 'fê'],
  'patricia': ['pat', 'pati', 'patty'],
  'rodrigo': ['rod', 'rods', 'rodriguinho'],
  'marcelo': ['marce', 'cel', 'celinho'],
  'eduardo': ['edu', 'dudu', 'duda'],
  'bruno': ['bru', 'bruninho'],
  'felipe': ['fel', 'felipinho', 'lipe'],
  'guilherme': ['gui', 'guiga', 'guilha'],
  'gustavo': ['gus', 'gu', 'guga'],
  'leonardo': ['leo', 'leozinho'],
  'matheus': ['mat', 'mateus', 'teus'],
  'renato': ['rena', 'renatinho'],
  'andre': ['dre', 'andrezinho'],
  'diego': ['di', 'dieguinho'],
  'fabio': ['fab', 'fabinho'],
  'henrique': ['hen', 'rick', 'rique'],
  'leandro': ['le', 'leandrinho'],
  'marcos': ['marc', 'marquinhos'],
  'paulo': ['paulinho', 'paul'],
  'ricardo': ['ric', 'ricardinho', 'rick'],
  'roberto': ['beto', 'robertinho', 'rob'],
  'sergio': ['serg', 'serginho'],
  'vinicius': ['vini'],
  'alexandre': ['alex', 'xande', 'alê'],
  'daniel': ['dan', 'dani', 'danielzinho'],
  'thiago': ['thi', 'thiaguinho', 'tiago'],
  'victor': ['vic', 'vitinho', 'vitor'],
  'beatriz': ['bia', 'bea', 'biazinha'],
  'camila': ['cami', 'mila'],
  'carolina': ['carol', 'carolzinha', 'lina'],
  'gabriela': ['gabi', 'gabizinha', 'gab'],
  'juliana': ['ju', 'juli', 'julinha'],
  'larissa': ['lari', 'larissinha'],
  'mariana': ['mari', 'marianinha'],
  'natalia': ['nat', 'nati', 'natinha'],
  'vanessa': ['van', 'vanessinha', 'nessa']
};

// ============================================================================
// FUNÇÃO AUXILIAR: BUSCAR INTEGRAÇÃO
// ============================================================================
async function buscarIntegracao(base44, integration_id, thread) {
  let integracao = null;
  
  if (integration_id) {
    try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id); } catch (e) {}
  }
  if (!integracao && thread?.whatsapp_integration_id) {
    try { integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id); } catch (e) {}
  }
  if (!integracao) {
    try {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-ultima_atividade', 1);
      if (integracoes.length > 0) integracao = integracoes[0];
    } catch (e) {}
  }
  
  return integracao;
}

// ============================================================================
// FUNÇÃO AUXILIAR: ENVIAR MENSAGEM
// ============================================================================
async function enviarMensagem(base44, integracao, telefone, mensagem, thread_id) {
  const provider = integracao.api_provider || 'z_api';
  const telefoneNumerico = telefone.replace(/\D/g, '');
  
  try {
    let envioResp;
    if (provider === 'w_api') {
      envioResp = await fetch(`${integracao.base_url_provider || 'https://api.w-api.app/v1'}/${integracao.instance_id_provider}/messages/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integracao.api_key_provider}` },
        body: JSON.stringify({ phone: telefoneNumerico, message: mensagem })
      });
    } else {
      const zapiHeaders = { 'Content-Type': 'application/json' };
      if (integracao.security_client_token_header) zapiHeaders['Client-Token'] = integracao.security_client_token_header;
      envioResp = await fetch(`${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/send-text`, {
        method: 'POST',
        headers: zapiHeaders,
        body: JSON.stringify({ phone: telefoneNumerico, message: mensagem })
      });
    }
    
    const envioData = await envioResp.json();
    
    // Salvar mensagem no banco
    await base44.asServiceRole.entities.Message.create({
      thread_id: thread_id,
      sender_id: 'system',
      sender_type: 'user',
      content: mensagem,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: envioData.messageId || envioData.id,
      sent_at: new Date().toISOString(),
      metadata: { whatsapp_integration_id: integracao.id, pre_atendimento: true }
    });
    
    return { success: true, messageId: envioData.messageId || envioData.id };
  } catch (e) {
    console.error('[PRE-ATEND] ❌ Erro ao enviar mensagem:', e?.message);
    return { success: false, error: e?.message };
  }
}

// ============================================================================
// FUNÇÃO AUXILIAR: BUSCAR ATENDENTE DO SETOR
// ============================================================================
async function buscarAtendenteDoSetor(base44, contato, setor) {
  let atendente = null;
  
  // 1. Tentar atendente fidelizado
  const campo = camposFidelizado[setor];
  if (campo && contato[campo]) {
    try { atendente = await base44.asServiceRole.entities.User.get(contato[campo]); } catch (e) {}
  }
  
  // 2. Se não tem fidelizado, buscar atendente do setor
  if (!atendente) {
    try {
      const atendentesSetor = await base44.asServiceRole.entities.User.filter({
        attendant_sector: setor
      }, '-created_date', 10);
      if (atendentesSetor.length > 0) {
        atendente = atendentesSetor[0];
        console.log(`[PRE-ATEND] 👤 Atendente do setor ${setor} encontrado:`, atendente.full_name);
      }
    } catch (e) {
      console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes do setor:', e?.message);
    }
  }
  
  return atendente;
}

// ============================================================================
// FUNÇÃO AUXILIAR: CARREGAR ATENDENTES
// ============================================================================
async function carregarAtendentes(base44) {
  const todosAtendentes = [];
  
  try {
    const [usuarios, vendedores] = await Promise.all([
      base44.asServiceRole.entities.User.filter({}, '-created_date', 100),
      base44.asServiceRole.entities.Vendedor.filter({ status: 'ativo' }, '-created_date', 50)
    ]);
    
    for (const u of usuarios) {
      if (u.full_name) {
        const nomeNorm = u.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const partes = nomeNorm.split(' ').filter(p => p.length >= 2);
        const pn = partes[0] || '';
        const apelidos = [];
        
        if (pn.length >= 4) {
          apelidos.push(pn.substring(0, 3));
          apelidos.push(pn.substring(0, 4));
        }
        if (variacoesNomes[pn]) {
          apelidos.push(...variacoesNomes[pn]);
        }

        todosAtendentes.push({
          id: u.id,
          nome: u.full_name,
          nomeNorm,
          primeiroNome: pn,
          partes,
          apelidos,
          email: u.email,
          setor: u.attendant_sector || 'geral',
          tipo: 'user'
        });
      }
    }
    
    for (const v of vendedores) {
      if (v.nome && !todosAtendentes.some(a => a.email === v.email)) {
        const nomeNorm = v.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const partes = nomeNorm.split(' ').filter(p => p.length >= 2);
        todosAtendentes.push({
          id: v.id,
          nome: v.nome,
          nomeNorm,
          primeiroNome: partes[0] || '',
          partes,
          apelidos: [],
          email: v.email,
          setor: 'vendas',
          tipo: 'vendedor'
        });
      }
    }
  } catch (e) {
    console.log('[PRE-ATEND] ⚠️ Erro ao carregar atendentes:', e?.message);
  }
  
  return todosAtendentes;
}

// ============================================================================
// FUNÇÃO AUXILIAR: ANALISAR CONTEXTO
// ============================================================================
async function analisarContexto(base44, thread_id, textoAtual) {
  const contexto = {
    setores: { vendas: 0, assistencia: 0, financeiro: 0, fornecedor: 0 },
    intencoes: { cotacao: 0, suporte: 0, pagamento: 0, informacao: 0 }
  };
  
  // Buscar histórico
  let historicoMensagens = [];
  try {
    historicoMensagens = await base44.asServiceRole.entities.Message.filter(
      { thread_id: thread_id },
      '-created_date',
      30
    );
  } catch (e) {}
  
  // Analisar histórico
  for (const msg of historicoMensagens) {
    const conteudo = (msg.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palavrasMsg = conteudo.split(/\s+/).filter(p => p.length >= 2);
    
    for (const [setor, termos] of Object.entries(keywords)) {
      for (const palavra of palavrasMsg) {
        if (matchPalavra(palavra, termos)) {
          contexto.setores[setor]++;
        }
      }
    }
    
    for (const [intent, termos] of Object.entries(intentKeywords)) {
      for (const palavra of palavrasMsg) {
        if (matchPalavra(palavra, termos)) {
          contexto.intencoes[intent]++;
        }
      }
    }
  }
  
  // Analisar mensagem atual (peso maior)
  const textoLower = textoAtual.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const palavrasTexto = textoLower.split(/\s+/).filter(p => p.length > 0);
  
  for (const palavra of palavrasTexto) {
    for (const [setor, termos] of Object.entries(keywords)) {
      if (matchPalavra(palavra, termos)) {
        contexto.setores[setor] += 5;
      }
    }
    for (const [intent, termos] of Object.entries(intentKeywords)) {
      if (matchPalavra(palavra, termos)) {
        contexto.intencoes[intent] += 5;
      }
    }
  }
  
  contexto.setorDominante = Object.entries(contexto.setores).sort((a, b) => b[1] - a[1])[0];
  contexto.intencaoDominante = Object.entries(contexto.intencoes).sort((a, b) => b[1] - a[1])[0];
  contexto.historicoMensagens = historicoMensagens;
  
  return contexto;
}

// ============================================================================
// FUNÇÃO AUXILIAR: BUSCAR ATENDENTE POR NOME
// ============================================================================
function buscarAtendentePorNome(textoLower, palavrasTexto, todosAtendentes, historicoMensagens, thread) {
  let melhorMatch = null;
  let melhorScore = 0;

  for (const atend of todosAtendentes) {
    let score = 0;
    
    for (const palavra of palavrasTexto) {
      if (palavra.length < 2) continue;
      
      if (palavra === atend.primeiroNome) {
        score = Math.max(score, 100);
      } else if (atend.apelidos?.includes(palavra)) {
        score = Math.max(score, 98);
      } else if (similaridade(palavra, atend.primeiroNome) >= 0.75) {
        score = Math.max(score, 95);
      } else if (atend.apelidos) {
        for (const apelido of atend.apelidos) {
          if (similaridade(palavra, apelido) >= 0.8) {
            score = Math.max(score, 90);
            break;
          }
        }
      }
      if (score < 85 && atend.primeiroNome.startsWith(palavra) && palavra.length >= 3) {
        score = Math.max(score, 85);
      } else if (score < 80 && palavra.startsWith(atend.primeiroNome) && atend.primeiroNome.length >= 3) {
        score = Math.max(score, 80);
      }
    }
    
    if (score === 0 && atend.primeiroNome.length >= 3 && textoLower.includes(atend.primeiroNome)) {
      score = 85;
    }

    if (score > 0 && historicoMensagens?.some(m => (m.content || '').toLowerCase().includes(atend.primeiroNome))) {
      score += 10;
    }
    
    if (score > 0 && thread?.assigned_user_id === atend.id) {
      score += 15;
    }

    if (score > melhorScore) {
      melhorScore = score;
      melhorMatch = atend;
    }
  }

  return { melhorMatch, melhorScore };
}

// ============================================================================
// FUNÇÃO: FINALIZAR PRÉ-ATENDIMENTO
// ============================================================================
async function finalizarPreAtendimento(base44, params) {
  const { thread_id, execucao_id, setor, atendente, motivo, integracao, contato, variables } = params;
  
  const threadUpdate = {
    sector_id: setor,
    pre_atendimento_ativo: false,
    pre_atendimento_state: 'COMPLETED'
  };
  
  const setorLabel = setorLabels[setor] || setor;
  let msg;
  
  if (atendente && atendente.full_name) {
    threadUpdate.assigned_user_id = atendente.id;
    threadUpdate.assigned_user_name = atendente.full_name;
    
    // Normalizar nomes para comparação (evitar redundância)
    const nomeAtendente = atendente.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const nomeSetor = setorLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const setorKey = setor.toLowerCase().trim();
    
    // Verificar se o nome do atendente é igual ou muito similar ao nome do setor
    const ehNomeIgualSetor = nomeAtendente === nomeSetor || 
                             nomeAtendente === setorKey ||
                             nomeAtendente.includes(setorKey) ||
                             setorKey.includes(nomeAtendente);
    
    if (ehNomeIgualSetor) {
      // Nome igual ao setor - mostrar só o setor
      msg = `✅ Perfeito! Estou direcionando você para o setor de *${setorLabel}*. Aguarde um instante! 😊`;
    } else {
      // Nome diferente - mostrar nome + setor
      msg = `✅ Perfeito! Vou te conectar com *${atendente.full_name}* do setor de *${setorLabel}*. Aguarde um instante! 😊`;
    }
  } else {
    // Sem atendente específico
    msg = `✅ Certo! Estou direcionando você para o setor de *${setorLabel}*. Um atendente vai te atender em breve! 😊`;
  }
  
  console.log(`[PRE-ATEND] 📤 Finalizando: Setor=${setor} | Atendente=${atendente?.full_name || 'N/A'} | Motivo=${motivo}`);
  
  // Atualizar thread com unread_count forçado (Passagem de Bastão)
  await base44.asServiceRole.entities.MessageThread.update(thread_id, {
    ...threadUpdate,
    unread_count: Math.max(1, threadUpdate.unread_count || 0),
    updated_date: new Date().toISOString()
  });
  
  await base44.asServiceRole.entities.FlowExecution.update(execucao_id, {
    status: 'concluido',
    completed_at: new Date().toISOString(),
    variables: { ...variables, setor_escolhido: setor, motivo }
  });
  
  await enviarMensagem(base44, integracao, contato.telefone, msg, thread_id);
  
  // Mensagem de sistema de transferência para destaque visual
  await base44.asServiceRole.entities.Message.create({
    thread_id: thread_id,
    sender_id: atendente?.id || 'pre_atendimento_bot',
    sender_type: 'user',
    content: `🔔 Conversa direcionada para ${atendente?.full_name || setorLabels[setor] || setor}`,
    channel: 'interno',
    status: 'enviada',
    sent_at: new Date().toISOString(),
    metadata: {
      is_system_message: true,
      message_type: 'transfer',
      setor_destino: setor,
      atendente_destino: atendente?.full_name || null,
      motivo_roteamento: motivo
    }
  });
  
  return { success: true, setor_escolhido: setor, atendente_id: atendente?.id, motivo };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  const { action, thread_id, contact_id, integration_id, resposta_usuario } = payload;
  console.log(`[${VERSION}] 📥 Ação: ${action} | Thread: ${thread_id}`);

  try {
    // ========================================================================
    // AÇÃO: INICIAR PRÉ-ATENDIMENTO
    // ========================================================================
    if (action === 'iniciar') {
      const templates = await base44.asServiceRole.entities.FlowTemplate.filter({
        is_pre_atendimento_padrao: true,
        ativo: true
      }, '-created_date', 1);

      if (templates.length === 0) {
        console.log('[PRE-ATEND] ⚠️ Nenhum template de pré-atendimento configurado');
        return Response.json({ success: false, error: 'sem_template' }, { headers: corsHeaders });
      }

      const template = templates[0];
      if (template.activation_mode === 'disabled') {
        console.log('[PRE-ATEND] ⚠️ Pré-atendimento desativado');
        return Response.json({ success: false, skipped: true }, { headers: corsHeaders });
      }

      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      const contato = await base44.asServiceRole.entities.Contact.get(contact_id);

      if (!thread || !contato) {
        return Response.json({ success: false, error: 'thread_ou_contato_nao_encontrado' }, { headers: corsHeaders });
      }

      const integracao = await buscarIntegracao(base44, integration_id, thread);
      if (!integracao) {
        return Response.json({ success: false, error: 'nenhuma_integracao_disponivel' }, { headers: corsHeaders });
      }

      // ============================================================================
      // 🔄 VERIFICAÇÃO DE CONTINUIDADE (CLIENTES/FIDELIZADOS COM CONVERSA RECENTE)
      // ============================================================================
      const isFidelizado = contato.is_cliente_fidelizado === true;
      const tipoContato = contato.tipo_contato || 'novo';
      const isClienteOuFidelizado = isFidelizado || tipoContato === 'cliente';
      
      // Verificar se há atendente atribuído E conversa recente (< 2 horas)
      if (isClienteOuFidelizado && thread.assigned_user_id && thread.last_message_at) {
        const horasDiferenca = (Date.now() - new Date(thread.last_message_at).getTime()) / (1000 * 60 * 60);
        
        if (horasDiferenca < 2) {
          console.log('[PRE-ATEND] 🔄 Conversa recente detectada! Perguntando continuidade...');
          
          // Buscar dados do atendente atribuído
          let atendenteAnterior = null;
          try {
            atendenteAnterior = await base44.asServiceRole.entities.User.get(thread.assigned_user_id);
          } catch (e) {
            console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendente anterior:', e?.message);
          }
          
          const nomeAtendente = atendenteAnterior?.full_name || thread.assigned_user_name || 'seu atendente anterior';
          
          const mensagemContinuidade = `${getSaudacao()}! 👋\n\nVocê estava conversando com *${nomeAtendente}*.\n\nGostaria de:\n\n1️⃣ *Continuar* com ${nomeAtendente}\n2️⃣ Iniciar um *novo atendimento*\n\n_Digite 1 ou 2._`;
          
          const envio = await enviarMensagem(base44, integracao, contato.telefone, mensagemContinuidade, thread_id);
          
          if (!envio.success) {
            return Response.json({ success: false, error: envio.error || 'erro_envio' }, { headers: corsHeaders });
          }
          
          const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
            flow_template_id: template.id,
            contact_id: contact_id,
            thread_id: thread_id,
            whatsapp_integration_id: integracao.id,
            status: 'ativo',
            current_step: 0,
            started_at: new Date().toISOString(),
            variables: {
              last_assigned_user_id: thread.assigned_user_id,
              last_assigned_user_name: nomeAtendente,
              continuity_mode: true,
              opcoes_setor: template.opcoes_setor || []
            }
          });
          
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            pre_atendimento_ativo: true,
            pre_atendimento_state: 'WAITING_CONTINUITY_CHOICE',
            pre_atendimento_started_at: new Date().toISOString()
          });
          
          console.log('[PRE-ATEND] ✅ Modo continuidade iniciado | FlowExec:', flowExecution.id);
          return Response.json({ success: true, flow_execution_id: flowExecution.id, continuity_mode: true }, { headers: corsHeaders });
        }
      }

      // ============================================================================
      // 📋 FLUXO PADRÃO: SAUDAÇÃO COM OPÇÕES DE SETOR
      // ============================================================================
      const saudacao = getSaudacao();
      let mensagemTexto = template.mensagem_saudacao || 'Olá! {saudacao}, para qual setor você gostaria de falar?';
      mensagemTexto = mensagemTexto.replace('{saudacao}', saudacao);
      
      if (contato.nome && contato.nome !== contato.telefone) {
        mensagemTexto = mensagemTexto.replace('Olá!', `Olá, ${contato.nome}!`);
      }

      const opcoesSetor = template.opcoes_setor || [
        { label: '💼 Vendas', setor: 'vendas' },
        { label: '🔧 Suporte', setor: 'assistencia' },
        { label: '💰 Financeiro', setor: 'financeiro' }
      ];

      const listaOpcoes = opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
      const mensagemCompleta = `${mensagemTexto}\n\n${listaOpcoes}\n\n_Responda com o número ou nome da opção desejada._`;

      console.log('[PRE-ATEND] 📤 Enviando saudação para:', contato.telefone);
      const envio = await enviarMensagem(base44, integracao, contato.telefone, mensagemCompleta, thread_id);
      
      if (!envio.success) {
        return Response.json({ success: false, error: envio.error || 'erro_envio' }, { headers: corsHeaders });
      }

      const flowExecution = await base44.asServiceRole.entities.FlowExecution.create({
        flow_template_id: template.id,
        contact_id: contact_id,
        thread_id: thread_id,
        whatsapp_integration_id: integracao.id,
        status: 'ativo',
        current_step: 0,
        started_at: new Date().toISOString(),
        variables: { saudacao, opcoes_setor: opcoesSetor }
      });

      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        pre_atendimento_ativo: true,
        pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
        pre_atendimento_started_at: new Date().toISOString()
      });

      console.log('[PRE-ATEND] ✅ Pré-atendimento iniciado | FlowExec:', flowExecution.id);
      return Response.json({ success: true, flow_execution_id: flowExecution.id }, { headers: corsHeaders });
    }

    // ========================================================================
    // AÇÃO: PROCESSAR RESPOSTA
    // ========================================================================
    if (action === 'processar_resposta') {
      const execucoes = await base44.asServiceRole.entities.FlowExecution.filter({
        thread_id: thread_id,
        status: 'ativo'
      }, '-created_date', 1);

      if (execucoes.length === 0) {
        return Response.json({ success: false, error: 'sem_execucao_ativa' }, { headers: corsHeaders });
      }

      const execucao = execucoes[0];
      const opcoesSetor = execucao.variables?.opcoes_setor || [];
      const tentativas = execucao.variables?.tentativas_nao_entendidas || 0;
      
      const textoOriginal = (resposta_usuario || '').trim();
      const textoLower = textoOriginal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const palavrasTexto = textoLower.split(/\s+/).filter(p => p.length > 0);
      
      console.log('[PRE-ATEND] 🔍 Analisando:', textoOriginal);
      
      const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
      const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
      const isFidelizado = contato.is_cliente_fidelizado === true;
      const tipoContato = contato.tipo_contato || 'novo';
      
      const integracao = await buscarIntegracao(base44, integration_id, thread);
      if (!integracao) {
        return Response.json({ success: false, error: 'nenhuma_integracao_disponivel' }, { headers: corsHeaders });
      }

      // Analisar contexto
      const contexto = await analisarContexto(base44, thread_id, textoOriginal);
      const todosAtendentes = await carregarAtendentes(base44);
      
      console.log('[PRE-ATEND] 📊 Setor dominante:', contexto.setorDominante[0], '(', contexto.setorDominante[1], ')');
      console.log('[PRE-ATEND] 📊 Intenção dominante:', contexto.intencaoDominante[0], '(', contexto.intencaoDominante[1], ')');

      // ============================================================================
      // 🔄 PRIORIDADE 0: PROCESSAR ESCOLHA DE CONTINUIDADE
      // ============================================================================
      if (estadoAtual === 'WAITING_CONTINUITY_CHOICE') {
        console.log('[PRE-ATEND] 🔄 Processando escolha de continuidade...');
        
        const lastUserId = execucao.variables?.last_assigned_user_id;
        const lastUserName = execucao.variables?.last_assigned_user_name;
        
        // Opção 1: Continuar com atendente anterior
        if (textoLower === '1' || textoLower.includes('continuar') || textoLower.includes('sim')) {
          console.log('[PRE-ATEND] ✅ Escolheu CONTINUAR com atendente anterior');
          
          let atendenteAnterior = null;
          if (lastUserId) {
            try {
              atendenteAnterior = await base44.asServiceRole.entities.User.get(lastUserId);
            } catch (e) {}
          }
          
          const setor = atendenteAnterior?.attendant_sector || thread.sector_id || 'geral';
          
          return Response.json(
            await finalizarPreAtendimento(base44, {
              thread_id, execucao_id: execucao.id, setor,
              atendente: atendenteAnterior ? { id: atendenteAnterior.id, full_name: atendenteAnterior.full_name } : null,
              motivo: 'continuidade_conversa', integracao, contato, variables: execucao.variables
            }),
            { headers: corsHeaders }
          );
        }
        
        // Opção 2: Novo atendimento
        if (textoLower === '2' || textoLower.includes('novo')) {
          console.log('[PRE-ATEND] 🆕 Escolheu NOVO atendimento');
          
          // Resetar atribuição e iniciar fluxo padrão
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            assigned_user_id: null,
            assigned_user_name: null,
            assigned_user_email: null,
            pre_atendimento_state: 'WAITING_SECTOR_CHOICE'
          });
          
          // Enviar menu de setores
          const saudacao = getSaudacao();
          let mensagemTexto = `${saudacao}! Para qual setor você gostaria de falar?\n\n`;
          mensagemTexto += opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
          mensagemTexto += `\n\n_Responda com o número ou nome da opção desejada._`;
          
          await enviarMensagem(base44, integracao, contato.telefone, mensagemTexto, thread_id);
          await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
            variables: { ...execucao.variables, continuity_mode: false }
          });
          
          return Response.json({ success: true, new_flow_started: true }, { headers: corsHeaders });
        }
        
        // Não entendeu - repetir pergunta
        const msgRetry = `🤔 Não entendi. Por favor, escolha:\n\n1️⃣ *Continuar* com ${lastUserName}\n2️⃣ Iniciar um *novo atendimento*\n\n_Digite 1 ou 2._`;
        await enviarMensagem(base44, integracao, contato.telefone, msgRetry, thread_id);
        return Response.json({ success: true, retry_continuity: true }, { headers: corsHeaders });
      }

      // ============================================================================
      // 🤖 PRIORIDADE 1: PERGUNTAS SOBRE O NEXUS360
      // ============================================================================
      const palavrasNexus = ['nexus360', 'nexus 360', 'nexus', 'o que e nexus', 'sobre o nexus', 'como funciona', 'quem e voce', 'quem é você', 'voce e quem', 'você é quem', 'e uma ia', 'é uma ia', 'robo', 'robô', 'bot', 'automatico', 'automático', 'inteligencia artificial', 'ia de atendimento'];
      if (palavrasNexus.some(p => textoLower.includes(p))) {
        console.log('[PRE-ATEND] 🤖 Pergunta sobre Nexus360 detectada!');

        const mensagemNexus = `🤖 Sou a *Nexus360*, sua IA de atendimento!\n\nAnaliso sua necessidade e direciono ao especialista certo, de forma rápida e inteligente. ✨\n\nPara qual setor posso te ajudar?\n\n${opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n')}`;

        await enviarMensagem(base44, integracao, contato.telefone, mensagemNexus, thread_id);
        await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
          variables: { ...execucao.variables, perguntou_nexus: true }
        });

        return Response.json({ success: true, nexus_info_sent: true }, { headers: corsHeaders });
      }

      // ============================================================================
      // 🚨 PRIORIDADE 2: PEDIDO DIRETO DE ATENDENTE HUMANO
      // ============================================================================
      const pedidosHumano = ['atendente', 'humano', 'pessoa', 'falar com alguem', 'quero falar', 'preciso falar', 'me ajuda', 'ajuda', 'atender', 'atendimento', 'falar com voce', 'voces'];
      if (pedidosHumano.some(p => textoLower.includes(p))) {
        console.log('[PRE-ATEND] 🚨 Pedido de atendente humano');
        
        let setorDestino = contexto.setorDominante[1] > 0 ? contexto.setorDominante[0] : (thread?.sector_id || 'geral');
        const atendente = await buscarAtendenteDoSetor(base44, contato, setorDestino);
        
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: setorDestino, atendente,
            motivo: 'pediu_atendente', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // ============================================================================
      // 🔍 PRIORIDADE 3: BUSCA POR NOME DE ATENDENTE
      // ============================================================================
      const { melhorMatch, melhorScore } = buscarAtendentePorNome(textoLower, palavrasTexto, todosAtendentes, contexto.historicoMensagens, thread);

      if (melhorMatch && melhorScore >= 50) {
        console.log('[PRE-ATEND] 👤 Atendente encontrado:', melhorMatch.nome, '| Score:', melhorScore);
        
        let atendente = melhorMatch;
        if (melhorMatch.tipo === 'vendedor' && melhorMatch.email) {
          try {
            const userMatch = await base44.asServiceRole.entities.User.filter({ email: melhorMatch.email }, '-created_date', 1);
            if (userMatch.length > 0) atendente = { ...melhorMatch, id: userMatch[0].id, nome: userMatch[0].full_name };
          } catch (e) {}
        }
        
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: atendente.setor || 'geral', atendente,
            motivo: 'nome_atendente', integracao, contato, variables: { ...execucao.variables, match_score: melhorScore }
          }),
          { headers: corsHeaders }
        );
      }

      // ============================================================================
      // 📋 PRIORIDADE 4: SELEÇÃO EXPLÍCITA DE SETOR POR NÚMERO/NOME
      // ============================================================================
      
      // Verificar se está aguardando escolha de ATENDENTE (já escolheu setor antes)
      const estadoAtual = thread?.pre_atendimento_state;
      const setorJaEscolhido = execucao.variables?.setor_escolhido;
      const atendentesDisponiveis = execucao.variables?.atendentes_disponiveis || [];
      
      if (estadoAtual === 'WAITING_ATTENDANT_CHOICE' && setorJaEscolhido && atendentesDisponiveis.length > 0) {
        console.log('[PRE-ATEND] 👤 Processando escolha de ATENDENTE...');
        
        // Tentar mapear resposta para atendente
        let atendenteEscolhido = null;
        const respostaNum = parseInt(textoLower);
        
        // Por número
        if (!isNaN(respostaNum) && respostaNum >= 1 && respostaNum <= atendentesDisponiveis.length) {
          atendenteEscolhido = atendentesDisponiveis[respostaNum - 1];
        } else {
          // Por nome
          for (const atend of atendentesDisponiveis) {
            const nomeNorm = atend.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const primeiroNome = nomeNorm.split(' ')[0];
            if (textoLower === primeiroNome || textoLower.includes(primeiroNome) || nomeNorm.includes(textoLower)) {
              atendenteEscolhido = atend;
              break;
            }
          }
        }
        
        if (atendenteEscolhido) {
          console.log('[PRE-ATEND] ✅ Atendente escolhido:', atendenteEscolhido.nome);
          return Response.json(
            await finalizarPreAtendimento(base44, {
              thread_id, execucao_id: execucao.id, setor: setorJaEscolhido, 
              atendente: { id: atendenteEscolhido.id, full_name: atendenteEscolhido.nome },
              motivo: 'escolha_atendente', integracao, contato, variables: execucao.variables
            }),
            { headers: corsHeaders }
          );
        } else {
          // Não entendeu - reenviar lista
          const listaAtend = atendentesDisponiveis.map((a, i) => `${i + 1}. ${a.nome}`).join('\n');
          const msgRetry = `🤔 Não identifiquei o atendente. Por favor, escolha:\n\n${listaAtend}\n\n_Digite o número ou nome._`;
          await enviarMensagem(base44, integracao, contato.telefone, msgRetry, thread_id);
          return Response.json({ success: true, retry_attendant: true }, { headers: corsHeaders });
        }
      }
      
      // Processar escolha de SETOR
      const setorEscolhido = mapearSetorDeResposta(resposta_usuario, opcoesSetor);
      
      if (setorEscolhido) {
        console.log('[PRE-ATEND] 📋 Setor selecionado:', setorEscolhido);
        
        // Buscar atendentes do setor
        let atendentesSetor = [];
        try {
          const usuarios = await base44.asServiceRole.entities.User.filter({
            attendant_sector: setorEscolhido
          }, '-created_date', 10);
          atendentesSetor = usuarios.filter(u => u.full_name).map(u => ({ id: u.id, nome: u.full_name }));
        } catch (e) {
          console.log('[PRE-ATEND] ⚠️ Erro ao buscar atendentes:', e?.message);
        }
        
        // Se tem mais de 1 atendente, listar para escolha
        if (atendentesSetor.length > 1) {
          console.log('[PRE-ATEND] 👥 Listando', atendentesSetor.length, 'atendentes do setor', setorEscolhido);
          
          const listaAtendentes = atendentesSetor.map((a, i) => `${i + 1}. ${a.nome}`).join('\n');
          const setorLabel = setorLabels[setorEscolhido] || setorEscolhido;
          const msgEscolha = `👥 *Atendentes disponíveis em ${setorLabel}:*\n\n${listaAtendentes}\n\n_Digite o número ou nome do atendente desejado._`;
          
          await enviarMensagem(base44, integracao, contato.telefone, msgEscolha, thread_id);
          
          // Atualizar estado para aguardar escolha de atendente
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE',
            sector_id: setorEscolhido
          });
          
          await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
            variables: { 
              ...execucao.variables, 
              setor_escolhido: setorEscolhido,
              atendentes_disponiveis: atendentesSetor
            }
          });
          
          return Response.json({ success: true, awaiting_attendant_choice: true, setor: setorEscolhido }, { headers: corsHeaders });
        }
        
        // Se tem 0 ou 1 atendente, transferir direto
        const atendente = atendentesSetor.length === 1 
          ? { id: atendentesSetor[0].id, full_name: atendentesSetor[0].nome }
          : await buscarAtendenteDoSetor(base44, contato, setorEscolhido);
          
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: setorEscolhido, atendente,
            motivo: 'selecao_menu', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // ============================================================================
      // 💰 PRIORIDADE 5: DETECTAR INTENÇÃO POR CONTEXTO
      // ============================================================================
      
      // 4A: Pagamento/Financeiro
      if (contexto.intencoes.pagamento >= 3 || contexto.intencaoDominante[0] === 'pagamento') {
        console.log('[PRE-ATEND] 💰 Intenção: PAGAMENTO/FINANCEIRO');
        const atendente = await buscarAtendenteDoSetor(base44, contato, 'financeiro');
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: 'financeiro', atendente,
            motivo: 'intencao_pagamento', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // 4B: Cotação/Vendas
      if (contexto.intencoes.cotacao >= 3 || contexto.intencaoDominante[0] === 'cotacao' || contexto.setores.vendas > 5) {
        console.log('[PRE-ATEND] 🛒 Intenção: COTAÇÃO/VENDAS');
        const atendente = await buscarAtendenteDoSetor(base44, contato, 'vendas');
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: 'vendas', atendente,
            motivo: 'intencao_cotacao', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // 4C: Suporte/Assistência
      if (contexto.intencoes.suporte >= 3 || contexto.setores.assistencia > 5) {
        console.log('[PRE-ATEND] 🔧 Intenção: SUPORTE/ASSISTÊNCIA');
        const atendente = await buscarAtendenteDoSetor(base44, contato, 'assistencia');
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: 'assistencia', atendente,
            motivo: 'intencao_suporte', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // ============================================================================
      // 🧠 PRIORIDADE 6: INFERIR PELO CONTEXTO DOMINANTE
      // ============================================================================
      if (contexto.setorDominante[1] >= 3) {
        console.log('[PRE-ATEND] 🧠 Setor inferido do contexto:', contexto.setorDominante[0]);
        const atendente = await buscarAtendenteDoSetor(base44, contato, contexto.setorDominante[0]);
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: contexto.setorDominante[0], atendente,
            motivo: 'contexto_inferido', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }

      // ============================================================================
      // ❓ FALLBACK: NÃO ENTENDEU
      // ============================================================================
      console.log('[PRE-ATEND] ❓ Não identificado:', textoLower.substring(0, 50));
      
      const novasTentativas = tentativas + 1;
      await base44.asServiceRole.entities.FlowExecution.update(execucao.id, {
        variables: { ...execucao.variables, tentativas_nao_entendidas: novasTentativas, ultima_resposta: textoOriginal }
      });
      
      // Após 2 tentativas, direciona automaticamente
      if (novasTentativas >= 2) {
        console.log('[PRE-ATEND] ⏩ Direcionando automaticamente após múltiplas tentativas');
        const setorFallback = contexto.setorDominante[1] > 0 ? contexto.setorDominante[0] : (thread?.sector_id || 'geral');
        const atendente = await buscarAtendenteDoSetor(base44, contato, setorFallback);
        return Response.json(
          await finalizarPreAtendimento(base44, {
            thread_id, execucao_id: execucao.id, setor: setorFallback, atendente,
            motivo: 'fallback_automatico', integracao, contato, variables: execucao.variables
          }),
          { headers: corsHeaders }
        );
      }
      
      // Primeira tentativa - pedir novamente
      const nomesDisponiveis = todosAtendentes.slice(0, 3).map(a => a.primeiroNome.charAt(0).toUpperCase() + a.primeiroNome.slice(1));
      
      let msgNaoEntendi = `🤔 Não consegui identificar sua solicitação.\n\n*Escolha uma opção:*\n`;
      msgNaoEntendi += opcoesSetor.map((op, i) => `${i + 1}. ${op.label}`).join('\n');
      msgNaoEntendi += `\n\n💡 Você também pode:\n• Digitar *"atendente"* para falar com alguém\n`;
      if (nomesDisponiveis.length > 0) {
        msgNaoEntendi += `• Digitar o nome (ex: *${nomesDisponiveis[0]}*)\n`;
      }
      msgNaoEntendi += `• Descrever o que precisa`;
      
      await enviarMensagem(base44, integracao, contato.telefone, msgNaoEntendi, thread_id);
      return Response.json({ success: true, understood: false, tentativas: novasTentativas }, { headers: corsHeaders });
    }

    return Response.json({ success: false, error: 'acao_invalida' }, { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});