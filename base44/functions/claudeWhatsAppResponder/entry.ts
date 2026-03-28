// claudeWhatsAppResponder - v2.1.0
// Responde automaticamente mensagens de clientes WhatsApp usando Claude (Anthropic)
// Ativado quando: sem humano ativo + sem URA ativa + mensagem requer resposta
// MELHORIAS v2: Promise.all, retry+timeout, reqId, metadata enriquecida, fallback ao cliente

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

// ============================================================
// ✏️ PERSONALIZE AQUI — dados reais da sua empresa
// ============================================================
const EMPRESA = {
  nome:                     'Liesch Informática',
  segmento:                 'Distribuição e Tecnologia em Informática',
  endereco:                 'Av. Centenário, 305 - Pinheirinho, Criciúma - SC',
  telefone:                 '(48) 3045-2077',
  whatsapp:                 '(48) 3045-2076',
  site:                     'www.liesch.net',

  produtos: [
    'notebooks e computadores (uso profissional e alto desempenho)',
    'placas de vídeo e componentes para upgrade',
    'impressoras e monitores',
    'projetores, TVs e celulares',
    'servidores e workstations personalizados',
    'licenças Microsoft (Office, Windows, etc.)',
  ].join(', '),

  servicos: [
    'assistência técnica especializada (manutenção, reparo, otimização)',
    'infraestrutura de rede corporativa',
    'governança de TI',
    'cybersegurança',
    'cloud server e VMs (nuvem pública, privada e servidores dedicados)',
    'automação de processos e agentes de IA empresarial',
    'produtos sob encomenda',
  ].join(', '),

  pagamento:                'Pix, cartão de crédito (consulte condições), boleto bancário',
  prazo_entrega:            'variável conforme produto e disponibilidade de estoque — consulte',
  frete_gratis:             'consulte condições para sua região',
  politica_troca:           'consulte nossa política em liesch.net/política-de-privacidade',
  garantia:                 'garantia de fábrica em todos os produtos + suporte técnico especializado',
  horario_humano:           'seg-sex, horário comercial — consulte pelo WhatsApp (48) 3045-2076',
  prazo_retorno_fornecedor: '1 a 2 dias úteis',

  emails: {
    vendas:      'vendas7@liesch.com.br',
    financeiro:  'financeiro@liesch.com.br',
    fornecedor:  'compras@liesch.com.br',
    rh:          'rh@liesch.com.br',
  },

  diferenciais: [
    'mais de 30 anos no mercado',
    'equipe especializada e certificada',
    'consultoria especializada B2B',
    'nova área de IA e automação empresarial',
  ].join(', '),
};
// ============================================================

// ============================================================
// CONFIGURAÇÕES DE COMPORTAMENTO
// ============================================================
const CONFIG = {
  modelo:           'claude-3-5-haiku-20241022', // troque por claude-3-5-sonnet-20241022 para mais qualidade
  max_tokens:       600,
  historico_msgs:   12,
  timeout_ms:       15000,
  retry_tentativas: 2,
};
// ============================================================

function buildSystemPrompt(nomeContato) {
  return `Você é o assistente virtual da ${EMPRESA.nome}, especializada em ${EMPRESA.segmento}. Atenda com profissionalismo, clareza e agilidade via WhatsApp.

## IDENTIDADE
- Nunca afirme ser humano se perguntado diretamente
- Apresente-se como: "Assistente Virtual da ${EMPRESA.nome}"
- Em caso de dúvida, prefira encaminhar a inventar informações

## DADOS DA EMPRESA
- Endereço: ${EMPRESA.endereco}
- Site: ${EMPRESA.site}
- Produtos: ${EMPRESA.produtos}
- Serviços: ${EMPRESA.servicos}
- Pagamento: ${EMPRESA.pagamento}
- Entrega: ${EMPRESA.prazo_entrega}
- Troca/Devolução: ${EMPRESA.politica_troca}
- Garantia: ${EMPRESA.garantia}
- Atendimento humano: ${EMPRESA.horario_humano}
- Diferenciais: ${EMPRESA.diferenciais}

## CONTATOS POR SETOR
- Vendas: ${EMPRESA.emails.vendas}
- Financeiro: ${EMPRESA.emails.financeiro}
- Fornecedor/Compras: ${EMPRESA.emails.fornecedor}

## O QUE VOCÊ PODE FAZER

### 🛒 VENDAS
- Informar preços e disponibilidade de produtos
- Comparar modelos e recomendar conforme necessidade
- Informar prazo e custo de entrega

### 🔧 SUPORTE / ASSISTÊNCIA TÉCNICA
- Registrar chamados (coletar: nome, CPF, nº do pedido, descrição do problema)
- Orientar sobre garantia e logística de reparo

### 💰 FINANCEIRO / COBRANÇA
- Esclarecer dúvidas sobre pagamentos e cobranças
- Coletar: nome, CPF, nº do pedido para análise
- Encaminhar solicitações de estorno ou 2ª via de NF

### 🤝 FORNECEDORES / PARCERIAS
- Receber propostas com dados: nome, empresa, telefone, e-mail
- Informar retorno em até ${EMPRESA.prazo_retorno_fornecedor}

## REGRAS DE OURO
- Nunca invente preços, prazos ou especificações técnicas
- Nunca compartilhe dados pessoais de outros clientes
- Respostas curtas e diretas (WhatsApp não é e-mail)
- Emojis com moderação ✅
- Finalize sempre com: "Posso ajudá-lo(a) com mais alguma coisa?"
${nomeContato ? `\n## CONTEXTO\nVocê está falando com ${nomeContato}. Use o nome para personalizar.` : ''}`;
}

const PADROES = {
  urgencia: [
    'urgente','emergência','emergencia','quebrou','parou de funcionar',
    'não funciona','nao funciona','defeito grave','problema grave',
    'cobrança indevida','cobranca indevida','fraude','danificado',
    'quero cancelar','vou reclamar','procon','reclame aqui','golpe',
  ],
  humano: [
    'falar com atendente','falar com pessoa','quero humano',
    'atendente humano','falar com alguém','falar com alguem',
    'me transfere','transferir','chamar gerente','falar com gerente',
    'responsável','responsavel','falar com humano',
  ],
  vendas:     /(preço|preco|valor|comprar|disponível|disponivel|estoque|frete|entrega|orçamento|orcamento|produto|quanto custa|à venda|a venda)/,
  suporte:    /(defeito|quebrou|não funciona|nao funciona|suporte|garantia|reparo|técnico|tecnico|assistência|assistencia|conserto|chamado)/,
  financeiro: /(pagamento|cobrança|cobranca|nota fiscal|estorno|boleto|financeiro|pagar|débito|debito|crédito|credito|fatura|cobrado)/,
  fornecedor: /(fornecedor|parceria|representante|proposta|distribui|revenda|atacado)/,
};

function analisarMensagem(texto) {
  const t = (texto || '').toLowerCase();
  return {
    urgente:    PADROES.urgencia.some(p => t.includes(p)),
    querHumano: PADROES.humano.some(p => t.includes(p)),
    intencao:   PADROES.vendas.test(t)     ? 'VENDAS'
              : PADROES.suporte.test(t)    ? 'SUPORTE'
              : PADROES.financeiro.test(t) ? 'FINANCEIRO'
              : PADROES.fornecedor.test(t) ? 'FORNECEDOR'
              : 'GERAL',
  };
}

async function enviarMensagem(provider, integration, telefone, texto) {
  if (!integration || !telefone) throw new Error('Integração ou telefone ausentes');

  if (provider === 'z_api') {
    const url = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
    const headers = { 'Content-Type': 'application/json' };
    if (integration.security_client_token_header) headers['Client-Token'] = integration.security_client_token_header;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone: telefone, message: texto }) });
    if (!res.ok) throw new Error(`Z-API erro ${res.status}`);
  } else if (provider === 'w_api') {
    const res = await fetch(`${integration.base_url_provider}/messages/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integration.api_key_provider}` },
      body: JSON.stringify({ instanceId: integration.instance_id_provider, number: telefone, text: texto }),
    });
    if (!res.ok) throw new Error(`W-API erro ${res.status}`);
  }
}

async function chamarClaude(systemPrompt, historico, tentativa = 1) {
  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model:      CONFIG.modelo,
        max_tokens: CONFIG.max_tokens,
        system:     systemPrompt,
        messages:   historico,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), CONFIG.timeout_ms)
      ),
    ]);
    return response.content[0]?.text || null;
  } catch (err) {
    if (tentativa < CONFIG.retry_tentativas) {
      console.warn(`[CLAUDE] ⚠️ Tentativa ${tentativa} falhou (${err.message}). Retentando...`);
      await new Promise(r => setTimeout(r, 1500 * tentativa));
      return chamarClaude(systemPrompt, historico, tentativa + 1);
    }
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  let base44;
  try { base44 = createClientFromRequest(req); } catch {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  let payload;
  try { payload = await req.json(); } catch {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const { thread_id, contact_id, message_content, integration_id, provider } = payload;
  if (!thread_id || !contact_id || !message_content) {
    return Response.json({ success: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const reqId = Math.random().toString(36).slice(2, 10);
  const inicio = Date.now();
  console.log(`[CLAUDE:${reqId}] 🚀 thread=${thread_id} | provider=${provider}`);

  // AgentRun opcional — não bloqueia se entidade não existir
  let agentRunId = null;
  try {
    const run = await base44.asServiceRole.entities.AgentRun.create({
      agent: 'claudeWhatsAppResponder',
      thread_id, contact_id,
      status: 'running',
      started_at: new Date().toISOString(),
    });
    agentRunId = run?.id ?? null;
  } catch { /* não-crítico */ }

  const finalizarRun = async (status, extra = {}) => {
    if (!agentRunId) return;
    try {
      await base44.asServiceRole.entities.AgentRun.update(agentRunId, {
        status, finished_at: new Date().toISOString(), duration_ms: Date.now() - inicio, ...extra,
      });
    } catch { /* silencioso */ }
  };

  try {
    // 1. Buscar dados em paralelo
    const [mensagens, contact, integration] = await Promise.all([
      base44.asServiceRole.entities.Message.filter({ thread_id }, '-created_date', CONFIG.historico_msgs),
      base44.asServiceRole.entities.Contact.get(contact_id),
      integration_id ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id) : Promise.resolve(null),
    ]);

    // 2. Analisar mensagem
    const { urgente, querHumano, intencao } = analisarMensagem(message_content);
    console.log(`[CLAUDE:${reqId}] 🔍 intenção=${intencao} | urgente=${urgente} | querHumano=${querHumano}`);

    // 3. Escalar para humano se necessário
    if (urgente || querHumano) {
      const motivo = urgente ? 'urgencia_detectada' : 'pedido_humano';
      const msgTransicao = urgente
        ? `Entendo a urgência. Vou transferir você para um de nossos especialistas agora. Aguarde. 🔴`
        : `Claro! Vou te conectar com um atendente agora. Um momento. 😊`;

      if (integration && contact?.telefone) {
        await enviarMensagem(provider, integration, contact.telefone, msgTransicao)
          .catch(e => console.warn(`[CLAUDE:${reqId}] ⚠️ Erro transição: ${e.message}`));
      }

      await base44.asServiceRole.entities.Message.create({
        thread_id, sender_id: 'claude_ai', sender_type: 'user',
        content: msgTransicao, channel: 'whatsapp', status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: { is_ai_response: true, ai_escalation: true, escalation_reason: motivo },
      });

      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id, contact_id,
        whatsapp_integration_id: integration_id,
        user_input: { type: 'text', content: message_content },
      }).catch(e => console.warn(`[CLAUDE:${reqId}] ⚠️ Erro URA: ${e.message}`));

      await finalizarRun('escalated', { escalation_reason: motivo });
      return Response.json({ success: true, action: 'escalated_to_human', reason: motivo });
    }

    // 4. Montar histórico limpo
    const historico = mensagens
      .reverse()
      .filter(m => m.content && m.content !== '[mídia]' && !m.metadata?.ai_escalation)
      .map(m => ({ role: m.sender_type === 'contact' ? 'user' : 'assistant', content: m.content }));

    const historicoFinal = historico.length > 0 && historico[0].role === 'user'
      ? historico
      : [{ role: 'user', content: message_content }];

    // 5. Chamar Claude
    const systemPrompt = buildSystemPrompt(contact?.nome) +
      `\n\n## CONTEXTO DESTA MENSAGEM\nIntenção classificada como: ${intencao}. Responda dentro desse departamento.`;

    console.log(`[CLAUDE:${reqId}] 💬 Chamando ${CONFIG.modelo} | ${historicoFinal.length} msgs`);
    const resposta = await chamarClaude(systemPrompt, historicoFinal);
    if (!resposta) throw new Error('Claude retornou resposta vazia');

    // 6. Enviar e salvar
    if (!integration) throw new Error(`Integração ${integration_id} não encontrada`);
    await enviarMensagem(provider, integration, contact.telefone, resposta);

    await base44.asServiceRole.entities.Message.create({
      thread_id, sender_id: 'claude_ai', sender_type: 'user',
      content: resposta, channel: 'whatsapp', status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integration_id,
        is_ai_response: true,
        ai_model: CONFIG.modelo, ai_provider: 'anthropic',
        ai_intencao: intencao, ai_agent_run: agentRunId,
        duration_ms: Date.now() - inicio,
      },
    });

    await finalizarRun('success', { intencao, response_length: resposta.length });
    console.log(`[CLAUDE:${reqId}] ✅ ${resposta.length} chars | ${Date.now() - inicio}ms`);
    return Response.json({ success: true, response: resposta, intencao, model: CONFIG.modelo });

  } catch (error) {
    console.error(`[CLAUDE:${reqId}] ❌ ${error.message}`);
    await finalizarRun('error', { error: error.message });

    // Fallback humanizado ao cliente
    try {
      const [fb_integration, fb_contact] = await Promise.all([
        integration_id ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id) : Promise.resolve(null),
        base44.asServiceRole.entities.Contact.get(contact_id),
      ]);
      if (fb_integration && fb_contact?.telefone) {
        await enviarMensagem(provider, fb_integration, fb_contact.telefone,
          'Desculpe, tivemos uma instabilidade momentânea. Nossa equipe foi notificada e entrará em contato em breve. 🙏');
      }
    } catch { /* silencioso */ }

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});