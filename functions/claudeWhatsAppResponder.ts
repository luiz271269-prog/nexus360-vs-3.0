// claudeWhatsAppResponder - v1.0.0
// Responde automaticamente mensagens de clientes WhatsApp usando Claude (Anthropic)
// Ativado quando: sem humano ativo + sem URA ativa + mensagem requer resposta

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
});

const SYSTEM_PROMPT = `Você é um assistente de atendimento ao cliente inteligente e prestativo.
Responda de forma educada, clara e concisa em português brasileiro.
Seja natural e humano nas respostas. Não se identifique como IA a menos que perguntado diretamente.
Seu objetivo é ajudar o cliente da melhor forma possível.
Se não souber a resposta ou o assunto for muito específico (ex: preços, estoque, técnico avançado), 
diga que vai verificar e que em breve um atendente entrará em contato.
Mantenha as respostas curtas e diretas - máximo 3 parágrafos.`;

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