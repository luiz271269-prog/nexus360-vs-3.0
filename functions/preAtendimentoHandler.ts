import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { FluxoController } from './preAtendimento/fluxoController.js';
import { RetryHandler, circuitBreakers } from './lib/retryHandler.js';
import { ErrorHandler } from './lib/errorHandler.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PRÉ-ATENDIMENTO HANDLER - VERSÃO COMPLETA E ROBUSTA        ║
 * ║  ✅ Máquina de estados completa                              ║
 * ║  ✅ Validação de inputs                                      ║
 * ║  ✅ Integração com roteamento inteligente                    ║
 * ║  ✅ Tratamento de erros e fallbacks                          ║
 * ║  ✅ Timeouts e cancelamentos                                 ║
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

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[PRE-ATENDIMENTO] 📥 Payload recebido:', payload);

    // ═══════════════════════════════════════════════════════════
    // 1. NORMALIZAÇÃO DE ENTRADA (Contrato Único)
    // ═══════════════════════════════════════════════════════════
    const { thread_id, contact_id, whatsapp_integration_id } = payload;
    
    if (!thread_id || !contact_id) {
      throw new Error('thread_id e contact_id são obrigatórios');
    }
    
    // Normalizar user_input de forma robusta
    let user_input = { type: 'text', content: '' };
    
    // Prioridade 1: user_input já normalizado
    if (payload.user_input) {
      user_input = payload.user_input;
    }
    // Cloud API format
    else if (payload.messages && payload.messages.length > 0) {
      const msg = payload.messages[0];
      if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
        user_input = {
          type: 'button',
          id: msg.interactive.button_reply.id,
          text: msg.interactive.button_reply.title
        };
      } else if (msg.type === 'text') {
        user_input = {
          type: 'text',
          content: msg.text.body
        };
      }
    }
    // Z-API / W-API format
    else if (payload.button_reply?.id) {
      user_input = {
        type: 'button',
        id: payload.button_reply.id,
        text: payload.button_reply.text
      };
    } else if (payload.message?.text) {
      user_input = {
        type: 'text',
        content: payload.message.text
      };
    } else if (payload.mensagem_cliente) {
      user_input = {
        type: 'text',
        content: payload.mensagem_cliente
      };
    }
    
    console.log('[PRE-ATENDIMENTO] 📝 User Input normalizado:', user_input);

    // ═══════════════════════════════════════════════════════════
    // BUSCAR THREAD E CONTACT
    // ═══════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════
    // 2. BUSCAR THREAD E CONTACT
    // ═══════════════════════════════════════════════════════════
    let [thread, contact] = await RetryHandler.executeWithRetry(
      async () => {
        const t = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        const c = await base44.asServiceRole.entities.Contact.get(contact_id);
        return [t, c];
      },
      {
        maxRetries: 2,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[PRE-ATENDIMENTO] Thread carregada:', {
      id: thread.id,
      estado: thread.pre_atendimento_state,
      ativo: thread.pre_atendimento_ativo
    });

    // ═══════════════════════════════════════════════════════════
    // 3. POLÍTICA DE REABERTURA (Correção do Buraco Negro COMPLETED)
    // ═══════════════════════════════════════════════════════════
    if (thread.pre_atendimento_state === 'COMPLETED') {
      const REABERTURA_TTL_HOURS = 24;
      const lastMessageTime = thread.last_message_at ? new Date(thread.last_message_at).getTime() : 0;
      const nowTime = new Date().getTime();
      const hoursInactive = (nowTime - lastMessageTime) / (1000 * 60 * 60);

      if (!thread.assigned_user_id && hoursInactive >= REABERTURA_TTL_HOURS) {
        console.log(`[PRE-ATENDIMENTO] 🔄 Thread COMPLETED há ${hoursInactive.toFixed(1)}h sem humano. Reabrindo ciclo.`);
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_completed_at: null,
          pre_atendimento_started_at: new Date().toISOString()
        });
        // CRÍTICO: Recarregar thread para garantir estado atualizado
        thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        console.log('[PRE-ATENDIMENTO] Thread reaberta para INIT');
      } else {
        console.log('[PRE-ATENDIMENTO] Thread COMPLETED mas dentro da janela ou com humano ativo. Ignorando.');
        return Response.json({
          success: false,
          erro: 'Pré-atendimento já concluído e ativo',
          estado_atual: 'COMPLETED'
        }, { status: 200, headers });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 4. VERIFICAÇÃO DE TIMEOUT E CORREÇÃO DE MEMÓRIA
    // ═══════════════════════════════════════════════════════════
    if (thread.pre_atendimento_timeout_at) {
      const timeoutDate = new Date(thread.pre_atendimento_timeout_at);
      const now = new Date();
      
      if (now >= timeoutDate && thread.pre_atendimento_state !== 'INIT') {
        console.log('[PRE-ATENDIMENTO] ⏰ Timeout detectado. Resetando para INIT.');
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_timeout_at: null,
          pre_atendimento_started_at: new Date().toISOString()
        });
        // CRÍTICO: Recarregar thread após reset de estado
        thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
        console.log('[PRE-ATENDIMENTO] Estado resetado na memória após timeout');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // BUSCAR INTEGRAÇÃO WHATSAPP
    // ═══════════════════════════════════════════════════════════
    
    let whatsappIntegration = null;
    
    if (whatsapp_integration_id) {
      whatsappIntegration = await base44.asServiceRole.entities.WhatsAppIntegration.get(whatsapp_integration_id);
    } else {
      // Buscar primeira integração ativa
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
        status: 'conectado'
      });
      
      if (integracoes.length > 0) {
        whatsappIntegration = integracoes[0];
      } else {
        throw new Error('Nenhuma integração WhatsApp ativa encontrada');
      }
    }

    console.log('[PRE-ATENDIMENTO] Integração WhatsApp:', whatsappIntegration.id);

    // ═══════════════════════════════════════════════════════════
    // PROCESSAR BASEADO NO ESTADO ATUAL
    // ═══════════════════════════════════════════════════════════
    
    let resultado;
    const estadoAtual = thread.pre_atendimento_state || 'INIT';

    console.log('[PRE-ATENDIMENTO] Processando estado:', estadoAtual);

    switch (estadoAtual) {
      case 'INIT':
        // CRÍTICO: Passa user_input E intent_context para INIT poder decidir
        const intentContext = payload.intent_context || null;
        resultado = await FluxoController.processarEstadoINIT(
          base44,
          thread,
          contact,
          whatsappIntegration.id,
          user_input,
          intentContext
        );
        break;

      case 'WAITING_SECTOR_CHOICE':
        resultado = await FluxoController.processarWAITING_SECTOR_CHOICE(
          base44,
          thread,
          contact,
          user_input,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_STICKY_DECISION':
        resultado = await FluxoController.processarWAITING_STICKY_DECISION(
          base44,
          thread,
          contact,
          user_input,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_ATTENDANT_CHOICE':
        resultado = await FluxoController.processarWAITING_ATTENDANT_CHOICE(
          base44,
          thread,
          contact,
          user_input,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_QUEUE_DECISION':
        resultado = await FluxoController.processarWAITING_QUEUE_DECISION(
          base44,
          thread,
          contact,
          user_input,
          whatsappIntegration.id
        );
        break;

      case 'TRANSFERRING':
        resultado = {
          success: false,
          erro: 'Thread em processo de transferência'
        };
        break;

      case 'COMPLETED':
        // COMPLETED já foi tratado antes do switch com política de reabertura
        console.log('[PRE-ATENDIMENTO] Estado COMPLETED no switch (deveria ter sido tratado antes)');
        resultado = {
          success: false,
          erro: 'Pré-atendimento concluído e ainda ativo',
          proximo_estado: 'COMPLETED'
        };
        break;

      case 'CANCELLED':
        resultado = {
          success: false,
          erro: 'Pré-atendimento foi cancelado'
        };
        break;

      case 'TIMEOUT':
        // TIMEOUT já foi tratado antes do switch, não deveria chegar aqui
        console.log('[PRE-ATENDIMENTO] Estado TIMEOUT detectado no switch (deveria ter sido resetado antes)');
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true,
          pre_atendimento_timeout_at: null
        });
        // Recarregar thread após atualização
        thread = await base44.asServiceRole.entities.MessageThread.get(thread.id);
        resultado = await FluxoController.processarEstadoINIT(
          base44,
          thread,
          contact,
          whatsappIntegration.id,
          user_input
        );
        break;

      default:
        throw new Error(`Estado desconhecido: ${estadoAtual}`);
    }

    // ═══════════════════════════════════════════════════════════
    // LOG DE AUTOMAÇÃO
    // ═══════════════════════════════════════════════════════════
    
    await RetryHandler.executeWithRetry(
      async () => {
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'pre_atendimento_step',
          thread_id: thread.id,
          contact_id: contact.id,
          resultado: resultado.success ? 'sucesso' : 'erro',
          timestamp: new Date().toISOString(),
          detalhes: {
            estado_inicial: estadoAtual,
            estado_final: resultado.proximo_estado || estadoAtual,
            user_input,
            resultado
          }
        });
      },
      {
        maxRetries: 1,
        circuitBreaker: circuitBreakers.database
      }
    );

    console.log('[PRE-ATENDIMENTO] ✅ Processamento concluído:', resultado);

    return Response.json(
      {
        success: resultado.success,
        estado_atual: estadoAtual,
        proximo_estado: resultado.proximo_estado,
        resultado
      },
      { status: 200, headers }
    );

  } catch (error) {
    const errorInfo = ErrorHandler.handle(error, {
      function: 'preAtendimentoHandler'
    });

    console.error('[PRE-ATENDIMENTO] ❌ Erro:', errorInfo);

    return Response.json(
      {
        success: false,
        error: errorInfo.userMessage,
        details: errorInfo.message
      },
      { status: 500, headers }
    );
  }
});