// claudeWhatsAppResponder - v1.0.0
// Responde automaticamente mensagens de clientes WhatsApp usando Claude (Anthropic)
// Ativado quando: sem humano ativo + sem URA ativa + mensagem requer resposta

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

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

  console.log(`[CLAUDE] 🤖 Processando resposta para thread: ${thread_id}`);

  try {
    // 1. Buscar histórico recente da conversa (últimas 10 mensagens)
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { thread_id },
      '-created_date',
      10
    );

    // 2. Buscar dados do contato para personalizar resposta
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);

    // 3. Montar histórico para contexto do Claude
    const historico = mensagens
      .reverse()
      .map(m => ({
        role: m.sender_type === 'contact' ? 'user' : 'assistant',
        content: m.content || '[mídia]'
      }))
      .filter(m => m.content !== '[mídia]' || m.role === 'user');

    // Garantir que começa com mensagem do usuário
    const historicoValido = historico.length > 0 && historico[0].role === 'user'
      ? historico
      : [{ role: 'user', content: message_content }];

    // 4. Chamar Claude
    console.log(`[CLAUDE] 💬 Chamando Claude com ${historicoValido.length} mensagens de histórico`);

    const systemPromptFinal = contact?.nome
      ? `${SYSTEM_PROMPT}\nVocê está falando com ${contact.nome}.`
      : SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: systemPromptFinal,
      messages: historicoValido,
    });

    const respostaTexto = response.content[0]?.text;

    if (!respostaTexto) {
      throw new Error('Claude não retornou resposta');
    }

    console.log(`[CLAUDE] ✅ Resposta gerada: ${respostaTexto.substring(0, 100)}...`);

    // 5. Buscar integração WhatsApp para envio
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