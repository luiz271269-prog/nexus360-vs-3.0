import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
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

    const { thread_id, contact_id, action, user_message, whatsapp_integration_id } = payload;

    if (!thread_id || !contact_id) {
      throw new Error('thread_id e contact_id são obrigatórios');
    }

    // ═══════════════════════════════════════════════════════════
    // BUSCAR THREAD E CONTACT
    // ═══════════════════════════════════════════════════════════
    
    const [thread, contact] = await RetryHandler.executeWithRetry(
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

    console.log('[PRE-ATENDIMENTO] Thread:', {
      id: thread.id,
      estado: thread.pre_atendimento_state,
      ativo: thread.pre_atendimento_ativo
    });

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
        resultado = await FluxoController.processarEstadoINIT(
          base44,
          thread,
          contact,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_SECTOR_CHOICE':
        if (!user_message) {
          throw new Error('user_message é obrigatório para WAITING_SECTOR_CHOICE');
        }
        resultado = await FluxoController.processarWAITING_SECTOR_CHOICE(
          base44,
          thread,
          contact,
          user_message,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_ATTENDANT_CHOICE':
        if (!user_message) {
          throw new Error('user_message é obrigatório para WAITING_ATTENDANT_CHOICE');
        }
        resultado = await FluxoController.processarWAITING_ATTENDANT_CHOICE(
          base44,
          thread,
          contact,
          user_message,
          whatsappIntegration.id
        );
        break;

      case 'WAITING_QUEUE_DECISION':
        if (!user_message) {
          throw new Error('user_message é obrigatório para WAITING_QUEUE_DECISION');
        }
        resultado = await FluxoController.processarWAITING_QUEUE_DECISION(
          base44,
          thread,
          contact,
          user_message,
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
        resultado = {
          success: false,
          erro: 'Pré-atendimento já foi concluído'
        };
        break;

      case 'CANCELLED':
        resultado = {
          success: false,
          erro: 'Pré-atendimento foi cancelado'
        };
        break;

      case 'TIMEOUT':
        // Reiniciar fluxo
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'INIT',
          pre_atendimento_ativo: true
        });
        resultado = await FluxoController.processarEstadoINIT(
          base44,
          thread,
          contact,
          whatsappIntegration.id
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
            user_message,
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