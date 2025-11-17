import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { RetryHandler, circuitBreakers } from './lib/retryHandler.js';
import { ErrorHandler } from './lib/errorHandler.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  INBOUND WEBHOOK - VERSÃO OTIMIZADA E RESILIENTE            ║
 * ║  ✅ Retry automático para falhas temporárias                ║
 * ║  ✅ Circuit breaker para proteção                           ║
 * ║  ✅ Validação de payloads                                   ║
 * ║  ✅ Integração com pré-atendimento automático               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const startTime = Date.now();
  let base44;
  let payloadRaw = '';

  try {
    base44 = createClientFromRequest(req);
    payloadRaw = await req.text();
    const payload = JSON.parse(payloadRaw);

    console.log('[WEBHOOK] 📥 Recebido:', {
      method: req.method,
      payloadSize: payloadRaw.length,
      timestamp: new Date().toISOString()
    });

    // ═══════════════════════════════════════════════════════════
    // EXTRAIR DADOS DO PAYLOAD
    // ═══════════════════════════════════════════════════════════
    
    const phone = payload.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || 
                  payload.key?.remoteJid?.replace('@s.whatsapp.net', '') ||
                  payload.phone;
    
    const messageText = payload.data?.message?.conversation || 
                        payload.message?.conversation ||
                        payload.data?.message?.extendedTextMessage?.text ||
                        payload.message?.extendedTextMessage?.text ||
                        payload.text;

    const isFromMe = payload.data?.key?.fromMe || 
                     payload.key?.fromMe || 
                     payload.isFromMe || 
                     false;

    const messageId = payload.data?.key?.id || payload.key?.id;
    const timestamp = new Date((payload.data?.messageTimestamp || payload.messageTimestamp || Date.now() / 1000) * 1000).toISOString();

    // Extrair mídia
    let mediaUrl = null;
    let mediaType = null;

    if (payload.data?.message?.imageMessage || payload.message?.imageMessage) {
      mediaUrl = payload.data?.message?.imageMessage?.url || payload.message?.imageMessage?.url;
      mediaType = 'image';
    } else if (payload.data?.message?.videoMessage || payload.message?.videoMessage) {
      mediaUrl = payload.data?.message?.videoMessage?.url || payload.message?.videoMessage?.url;
      mediaType = 'video';
    } else if (payload.data?.message?.documentMessage || payload.message?.documentMessage) {
      mediaUrl = payload.data?.message?.documentMessage?.url || payload.message?.documentMessage?.url;
      mediaType = 'document';
    } else if (payload.data?.message?.audioMessage || payload.message?.audioMessage) {
      mediaUrl = payload.data?.message?.audioMessage?.url || payload.message?.audioMessage?.url;
      mediaType = 'audio';
    }

    console.log('[WEBHOOK] 📨 Mensagem (parsed):', {
      phone,
      hasText: !!messageText,
      isFromMe,
      mediaType,
      messageId
    });

    // Ignorar mensagens próprias
    if (isFromMe) {
      console.log('[WEBHOOK] ⏭️ Ignorando mensagem própria');
      return Response.json({ success: true, ignored: true, reason: 'own_message' }, { status: 200, headers });
    }

    if (!phone) {
      throw new Error('Payload inválido: phone ausente');
    }

    if (!messageText && !mediaUrl) {
      throw new Error('Payload inválido: messageText ou mediaUrl ausente');
    }

    // ═══════════════════════════════════════════════════════════
    // BUSCAR OU CRIAR CONTATO
    // ═══════════════════════════════════════════════════════════
    
    const contact = await RetryHandler.executeWithRetry(
      async () => {
        const contatosExistentes = await base44.asServiceRole.entities.Contact.filter({
          telefone: phone
        });

        if (contatosExistentes.length > 0) {
          return contatosExistentes[0];
        }

        return await base44.asServiceRole.entities.Contact.create({
          nome: phone,
          telefone: phone,
          tipo_contato: 'lead',
          whatsapp_status: 'verificado',
          whatsapp_optin: true,
          whatsapp_optin_data: new Date().toISOString()
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 300,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[WEBHOOK] ✅ Contact:', contact.id);

    // ═══════════════════════════════════════════════════════════
    // BUSCAR OU CRIAR THREAD
    // ═══════════════════════════════════════════════════════════
    
    const thread = await RetryHandler.executeWithRetry(
      async () => {
        const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact.id,
          status: 'aberta'
        });

        if (threadsExistentes.length > 0) {
          return threadsExistentes[0];
        }

        return await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contact.id,
          status: 'aberta',
          prioridade: 'normal',
          can_send_without_template: true,
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          pre_atendimento_ativo: false,
          pre_atendimento_state: null
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 300,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[WEBHOOK] ✅ Thread:', thread.id);

    // ═══════════════════════════════════════════════════════════
    // CRIAR MENSAGEM
    // ═══════════════════════════════════════════════════════════
    
    const message = await RetryHandler.executeWithRetry(
      async () => {
        return await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: contact.id,
          sender_type: 'contact',
          content: messageText,
          media_url: mediaUrl,
          media_type: mediaType,
          channel: 'whatsapp',
          status: 'entregue',
          whatsapp_message_id: messageId,
          sent_at: timestamp,
          delivered_at: timestamp
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 300,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[WEBHOOK] ✅ Message criada:', message.id);

    // ═══════════════════════════════════════════════════════════
    // ATUALIZAR THREAD
    // ═══════════════════════════════════════════════════════════
    
    await RetryHandler.executeWithRetry(
      async () => {
        const currentThread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
        
        return await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_content: message.content ? message.content.substring(0, 100) : null,
          last_message_at: new Date().toISOString(),
          last_message_sender: 'contact',
          unread_count: (currentThread.unread_count || 0) + 1,
          total_mensagens: (currentThread.total_mensagens || 0) + 1
        });
      },
      {
        maxRetries: 2,
        initialDelayMs: 300,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[WEBHOOK] ✅ Thread atualizada:', thread.id);

    // ═══════════════════════════════════════════════════════════
    // DECISÃO: ATIVAR PRÉ-ATENDIMENTO?
    // ═══════════════════════════════════════════════════════════
    
    try {
      const { deveAtivarPreAtendimento, executarDecisao } = await import('./lib/preAtendimentoDecision.js');
      
      const decisao = await deveAtivarPreAtendimento(base44, contact, thread);
      console.log('[WEBHOOK] Decisão de pré-atendimento:', decisao);
      
      const preAtendimentoResultado = await executarDecisao(base44, decisao, thread, contact);
      console.log('[WEBHOOK] Resultado da execução:', preAtendimentoResultado);

      // ═══════════════════════════════════════════════════════════
      // LOG DE AUTOMAÇÃO
      // ═══════════════════════════════════════════════════════════
      
      await RetryHandler.executeWithRetry(
        async () => {
          await base44.asServiceRole.entities.AutomationLog.create({
            acao: 'decisao_pre_atendimento',
            thread_id: thread.id,
            contact_id: contact.id,
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            detalhes: {
              decisao,
              preAtendimentoResultado,
              message_id: message.id
            }
          });
        },
        {
          maxRetries: 2,
          initialDelayMs: 300,
          circuitBreaker: circuitBreakers.database
        }
      );
      console.log('[WEBHOOK] ✅ Log de Automação registrado.');

      const processingTime = Date.now() - startTime;
      console.log(`[WEBHOOK] ✅ Processado em ${processingTime}ms`);

      return Response.json(
        { 
          success: true,
          processed: true,
          action: 'processed',
          pre_atendimento: preAtendimentoResultado,
          processingTime 
        },
        { status: 200, headers }
      );
    } catch (preError) {
      console.error('[WEBHOOK] ⚠️ Erro no pré-atendimento, mas mensagem foi salva:', preError);
      
      const processingTime = Date.now() - startTime;
      
      return Response.json(
        { 
          success: true,
          processed: true,
          action: 'saved_without_preattendance',
          warning: 'Mensagem salva, mas pré-atendimento falhou',
          processingTime 
        },
        { status: 200, headers }
      );
    }

  } catch (error) {
    const errorInfo = ErrorHandler.handle(error, {
      function: 'inboundWebhook',
      payloadSize: payloadRaw.length
    });

    console.error('[WEBHOOK] ❌ Erro fatal:', errorInfo);

    return Response.json(
      { 
        success: false,
        error: errorInfo.userMessage,
        retryable: errorInfo.retryable
      },
      { 
        status: errorInfo.category === ErrorHandler.ERROR_CATEGORIES.VALIDATION ? 400 : 500,
        headers 
      }
    );
  }
});