// claudeWhatsAppResponder - v2.0.0
// Responde automaticamente mensagens de clientes WhatsApp usando Claude (Anthropic)
// Melhorias v2: Promise.all paralelo, retry automático, timeout, AgentRun log, metadata enriquecida

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

// ============================================================
// ⚙️ CONFIG CENTRAL — ajuste modelo, tokens e comportamento
// ============================================================
const CONFIG = {
  model: 'claude-3-5-haiku-20241022',  // Troque por 'claude-sonnet-4-5' para mais qualidade
  max_tokens: 500,
  timeout_ms: 15000,   // 15s timeout para evitar travamento do webhook
  max_retries: 2,       // Tentativas em caso de falha do Claude
  historico_msgs: 10,   // Quantas mensagens do histórico usar como contexto
};
// ============================================================

// ============================================================
// ✏️ PERSONALIZE AQUI com os dados reais da sua empresa
// ============================================================
const EMPRESA = {
  nome: '[NOME DA EMPRESA]',
  segmento: 'Eletrônicos e Tecnologia',
  produtos: 'smartphones, notebooks, acessórios e periféricos',
  pagamento: 'Pix, cartão de crédito em até 12x, boleto',
  prazo_entrega: '3 a 7 dias úteis',
  frete_gratis: 'acima de R$ 299',
  politica_troca: 'até 7 dias após recebimento, produto sem uso',
  garantia: '12 meses para defeitos de fabricação',
  horario_humano: 'seg-sex, 9h às 18h',
  prazo_retorno_fornecedor: '2 dias úteis',
};
// ============================================================

const SYSTEM_PROMPT = `Você é o assistente virtual da ${EMPRESA.nome}, uma loja de ${EMPRESA.segmento}. Seu atendimento é formal, profissional e eficiente via WhatsApp.

## IDENTIDADE
- Nunca finja ser humano se o cliente perguntar diretamente
- Apresente-se como: "Assistente Virtual da ${EMPRESA.nome}"
- Em caso de dúvida, prefira encaminhar a inventar informações

## SOBRE A EMPRESA
- Segmento: ${EMPRESA.segmento}
- Produtos principais: ${EMPRESA.produtos}
- Formas de pagamento: ${EMPRESA.pagamento}
- Prazo de entrega: ${EMPRESA.prazo_entrega}
- Frete grátis: ${EMPRESA.frete_gratis}
- Política de troca: ${EMPRESA.politica_troca}
- Garantia: ${EMPRESA.garantia}
- Horário de atendimento humano: ${EMPRESA.horario_humano}

## O QUE VOCÊ PODE FAZER

### 🛒 VENDAS
- Informar preços e disponibilidade de produtos
- Comparar modelos e recomendar o mais adequado
- Informar prazo e custo de entrega
- Auxiliar no processo de compra

### 🔧 ASSISTÊNCIA TÉCNICA
- Registrar chamados de suporte (coletar: nome, CPF, nº do pedido, descrição do problema)
- Orientar sobre garantia e procedimentos de envio para reparo

### 💰 FINANCEIRO
- Informar sobre formas de pagamento
- Auxiliar com dúvidas de cobrança (coletar: nome, CPF, nº do pedido)
- Encaminhar pedidos de estorno ou nota fiscal

### 🤝 FORNECEDORES
- Receber propostas e coletar dados de contato (nome, empresa, telefone, e-mail)
- Informar que a equipe retornará em até ${EMPRESA.prazo_retorno_fornecedor}

## REGRAS DE OURO
- Nunca invente preços, prazos ou especificações técnicas
- Nunca compartilhe dados de outros clientes
- Respostas curtas e diretas — adequadas para WhatsApp
- Use emojis com moderação ✅
- Finalize sempre com: "Posso ajudá-lo(a) com mais alguma coisa?"`;

// Palavras que indicam urgência e requerem escalação imediata para humano
const PALAVRAS_URGENCIA = [
  'urgente', 'emergência', 'emergencia', 'quebrou', 'parou de funcionar',
  'não funciona', 'nao funciona', 'defeito', 'problema grave',
  'cobrança indevida', 'cobranca indevida', 'fraude', 'danificado',
  'quero cancelar', 'vou reclamar', 'procon', 'reclame aqui'
];

// Palavras que indicam pedido de atendente humano
const PALAVRAS_HUMANO = [
  'falar com atendente', 'falar com pessoa', 'quero humano',
  'atendente humano', 'falar com alguém', 'falar com alguem',
  'me transfere', 'transferir', 'gerente', 'responsável', 'responsavel'
];

function classificarIntencao(texto) {
  const t = (texto || '').toLowerCase();
  if (/(preço|preco|valor|comprar|disponível|disponivel|estoque|frete|entrega|orçamento|orcamento|produto|quanto custa|tem à venda)/.test(t)) return 'VENDAS';
  if (/(defeito|quebrou|não funciona|nao funciona|suporte|garantia|reparo|técnico|tecnico|assistência|assistencia|conserto)/.test(t)) return 'SUPORTE';
  if (/(pagamento|cobrança|cobranca|nota fiscal|estorno|boleto|financeiro|pagar|débito|debito|crédito|credito)/.test(t)) return 'FINANCEIRO';
  if (/(fornecedor|parceria|representante|proposta|distribui|revenda)/.test(t)) return 'FORNECEDOR';
  return 'GERAL';
}

function detectarUrgencia(texto) {
  const t = (texto || '').toLowerCase();
  return PALAVRAS_URGENCIA.some(p => t.includes(p));
}

function detectarPedidoHumano(texto) {
  const t = (texto || '').toLowerCase();
  return PALAVRAS_HUMANO.some(p => t.includes(p));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
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

  const { thread_id, contact_id, message_content, integration_id, provider } = payload;

  if (!thread_id || !contact_id || !message_content) {
    return Response.json({ success: false, error: 'missing_required_fields' }, { status: 400 });
  }

  const reqId = `claude_${Date.now()}`;
  const startedAt = Date.now();
  console.log(`[CLAUDE] 🤖 [${reqId}] Processando thread: ${thread_id}`);

  // Criar AgentRun para rastreamento
  let agentRun = null;
  try {
    agentRun = await base44.asServiceRole.entities.AgentRun.create({
      trigger_type: 'message.inbound',
      trigger_event_id: thread_id,
      playbook_selected: 'claude_whatsapp_responder',
      execution_mode: 'automatico',
      status: 'processando',
      context_snapshot: { thread_id, contact_id, content_preview: message_content?.substring(0, 100) },
      started_at: new Date().toISOString()
    });
  } catch (e) { /* não-crítico */ }

  try {
    // 1. Buscar histórico e contato EM PARALELO (antes era sequencial)
    const [mensagens, contact] = await Promise.all([
      base44.asServiceRole.entities.Message.filter(
        { thread_id },
        '-created_date',
        CONFIG.historico_msgs
      ),
      base44.asServiceRole.entities.Contact.get(contact_id)
    ]);

    // 3. Detectar urgência e pedido de humano ANTES de chamar Claude
    const ehUrgente = detectarUrgencia(message_content);
    const querHumano = detectarPedidoHumano(message_content);
    const intencao = classificarIntencao(message_content);

    console.log(`[CLAUDE] 🔍 Intenção: ${intencao} | Urgente: ${ehUrgente} | Quer humano: ${querHumano}`);

    // Se urgente ou pede humano → NÃO chamar Claude, acionar URA
    if (ehUrgente || querHumano) {
      const motivo = ehUrgente ? 'urgencia_detectada' : 'pedido_humano';
      console.log(`[CLAUDE] 🚨 Escalando para humano (${motivo}). Acionando preAtendimentoHandler...`);

      // Buscar integração para enviar mensagem de transição
      const integration = integration_id
        ? await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id)
        : null;

      // Enviar mensagem de transição ao cliente
      if (integration && contact?.telefone) {
        const msgTransicao = ehUrgente
          ? `Entendo a urgência. Vou transferir você para um de nossos especialistas agora. Aguarde um momento. 🔴`
          : `Claro! Vou te conectar com um atendente agora. Um momento. 😊`;

        const sendUrl = provider === 'w_api'
          ? `${integration.base_url_provider}/messages/send/text`
          : `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;

        if (provider === 'w_api') {
          await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integration.api_key_provider}` },
            body: JSON.stringify({ instanceId: integration.instance_id_provider, number: contact.telefone, text: msgTransicao })
          }).catch(e => console.warn('[CLAUDE] Erro ao enviar msg transição:', e.message));
        } else {
          const headers = { 'Content-Type': 'application/json' };
          if (integration.security_client_token_header) headers['Client-Token'] = integration.security_client_token_header;
          await fetch(sendUrl, {
            method: 'POST', headers,
            body: JSON.stringify({ phone: contact.telefone, message: msgTransicao })
          }).catch(e => console.warn('[CLAUDE] Erro ao enviar msg transição:', e.message));
        }

        // Salvar msg de transição no banco
        await base44.asServiceRole.entities.Message.create({
          thread_id,
          sender_id: 'claude_ai',
          sender_type: 'user',
          content: msgTransicao,
          channel: 'whatsapp',
          status: 'enviada',
          sent_at: new Date().toISOString(),
          metadata: { is_ai_response: true, ai_escalation: true, escalation_reason: motivo }
        });
      }

      // Acionar preAtendimento para rotear para humano
      await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
        thread_id,
        contact_id,
        whatsapp_integration_id: integration_id,
        user_input: { type: 'text', content: message_content }
      }).catch(e => console.warn('[CLAUDE] Erro ao acionar URA:', e.message));

      return Response.json({ success: true, action: 'escalated_to_human', reason: motivo });
    }

    // 4. Montar histórico para contexto do Claude (filtrar mensagens de sistema/automação)
    const historico = mensagens
      .reverse()
      .filter(m => !m.metadata?.is_ai_response || m.metadata?.is_ai_response === true) // incluir IA também
      .filter(m => !(m.sender_id === 'claude_ai' && m.metadata?.ai_escalation)) // excluir msgs de escalação
      .map(m => ({
        role: m.sender_type === 'contact' ? 'user' : 'assistant',
        content: m.content || null
      }))
      .filter(m => m.content && m.content !== '[mídia]'); // excluir mídias sem texto

    // Garantir que começa com mensagem do usuário
    const historicoValido = historico.length > 0 && historico[0].role === 'user'
      ? historico
      : [{ role: 'user', content: message_content }];

    // 5. Chamar Claude com contexto enriquecido
    console.log(`[CLAUDE] 💬 Chamando Claude com ${historicoValido.length} mensagens | Intenção: ${intencao}`);

    const systemPromptFinal = `${SYSTEM_PROMPT}
${contact?.nome ? `\nVocê está falando com ${contact.nome}.` : ''}
\nCONTEXTO DESTA MENSAGEM: Classificada como "${intencao}". Responda de acordo com esse departamento.`;

    // Chamar Claude com retry automático e timeout
    let respostaTexto = null;
    for (let tentativa = 1; tentativa <= CONFIG.max_retries; tentativa++) {
      try {
        console.log(`[CLAUDE] 💬 [${reqId}] Tentativa ${tentativa}/${CONFIG.max_retries} | ${historicoValido.length} msgs | Intenção: ${intencao}`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), CONFIG.timeout_ms)
        );
        const claudePromise = anthropic.messages.create({
          model: CONFIG.model,
          max_tokens: CONFIG.max_tokens,
          system: systemPromptFinal,
          messages: historicoValido,
        });

        const response = await Promise.race([claudePromise, timeoutPromise]);
        respostaTexto = response.content[0]?.text;
        if (respostaTexto) break;
      } catch (e) {
        console.warn(`[CLAUDE] ⚠️ [${reqId}] Tentativa ${tentativa} falhou: ${e.message}`);
        if (tentativa === CONFIG.max_retries) throw e;
        await new Promise(r => setTimeout(r, 1000 * tentativa)); // backoff
      }
    }

    if (!respostaTexto) throw new Error('Claude não retornou resposta após retries');
    console.log(`[CLAUDE] ✅ [${reqId}] Resposta gerada: ${respostaTexto.substring(0, 100)}...`);

    // 6. Buscar integração WhatsApp para envio
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integration) {
      throw new Error(`Integração ${integration_id} não encontrada`);
    }

    // 6. Enviar mensagem pelo WhatsApp
    if (provider === 'z_api') {
      const zapiUrl = `${integration.base_url_provider}/instances/${integration.instance_id_provider}/token/${integration.api_key_provider}/send-text`;
      const headers = { 'Content-Type': 'application/json' };
      if (integration.security_client_token_header) {
        headers['Client-Token'] = integration.security_client_token_header;
      }
      await fetch(zapiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: contact.telefone, message: respostaTexto })
      });
    } else if (provider === 'w_api') {
      await fetch(`${integration.base_url_provider}/messages/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${integration.api_key_provider}`
        },
        body: JSON.stringify({
          instanceId: integration.instance_id_provider,
          number: contact.telefone,
          text: respostaTexto
        })
      });
    }

    // 7. Registrar mensagem no banco
    await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: 'claude_ai',
      sender_type: 'user',
      content: respostaTexto,
      channel: 'whatsapp',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      metadata: {
        whatsapp_integration_id: integration_id,
        is_ai_response: true,
        ai_model: 'claude-3-5-haiku',
        ai_provider: 'anthropic'
      }
    });

    console.log(`[CLAUDE] ✅ Mensagem enviada e registrada`);

    return Response.json({
      success: true,
      response: respostaTexto,
      model: 'claude-3-5-haiku-20241022'
    });

  } catch (error) {
    console.error(`[CLAUDE] ❌ Erro:`, error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});