/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FLUXO CONTROLLER - v10.0.0 (O Executor Inteligente)         ║
 * ║  Absorveu: Validador, Sticky Logic e Queue Logic             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { MenuBuilder } from './menuBuilder.js';
import { processTextWithEmojis } from '../lib/emojiHelper.js';

export class FluxoController {

  // ===========================================================================
  // 1. ESTADO INIT: O Porteiro (IA + Memória + Menu)
  // ===========================================================================
  static async processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, user_input = null, intent_context = null) {
    console.log('[FLUXO] INIT | Input:', user_input?.content, '| IA:', intent_context ? 'Sim' : 'Não');

    // A. FAST-TRACK VIA IA (Prioridade Máxima)
    if (intent_context?.sector_slug && intent_context.confidence >= 70) {
      console.log(`[FLUXO] 🚀 Fast-track IA para: ${intent_context.sector_slug}`);
      
      const msg = `✅ Entendi! Vou te direcionar para *${intent_context.sector_slug.toUpperCase()}*.`;
      await this.enviarMensagem(base44, contact, whatsappIntegrationId, msg);

      await this.atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', intent_context.sector_slug);
      
      return await this.processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system', content: '' }, whatsappIntegrationId);
    }

    // B. Fast-track via IA para pedido de atendente
    if (intent_context?.intent_type === 'request_agent' && intent_context.confidence >= 70) {
      console.log(`[FLUXO] 🚀 Fast-track IA para pedido de atendente.`);
      await this.enviarMensagem(base44, contact, whatsappIntegrationId, `✅ Entendi! Você quer falar com um atendente. Buscando alguém para te ajudar...`);
      await this.atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', intent_context.sector_slug || 'geral');
      return await this.processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system', content: '' }, whatsappIntegrationId);
    }
    
    // C. STICKY SETOR (Memória de Elefante)
    if (thread.sector_id) {
      console.log(`[FLUXO] 📎 Sticky Setor detectado: ${thread.sector_id}`);
      
      const msgSticky = `Olá novamente, ${contact.nome}! 👋\n\nVi que seu último atendimento foi em *${thread.sector_id.toUpperCase()}*. Deseja continuar por lá?`;
      const botoes = [
        { id: 'sticky_sim', text: '✅ Sim, continuar' },
        { id: 'sticky_nao', text: '🔙 Menu Principal' }
      ];

      await this.enviarMensagem(base44, contact, whatsappIntegrationId, msgSticky, botoes);
      await this.atualizarEstado(base44, thread.id, 'WAITING_STICKY_DECISION');
      return { success: true, mode: 'sticky' };
    }
    
    // D. FALLBACK: MENU PADRÃO
    const menu = MenuBuilder.construirMenuBoasVindas(contact.nome);
    await this.enviarMensagem(base44, contact, whatsappIntegrationId, menu);
    await this.atualizarEstado(base44, thread.id, 'WAITING_SECTOR_CHOICE');
    return { success: true, mode: 'menu' };
  }

  // ===========================================================================
  // 2. DECISÃO DE STICKY (Novo Estado)
  // ===========================================================================
  static async processarWAITING_STICKY_DECISION(base44, thread, contact, user_input, whatsappIntegrationId) {
    const entrada = (user_input.content || user_input.id || '').toLowerCase();

    if (['sticky_sim', 'sim', '1', 'quero'].some(x => entrada.includes(x))) {
      await this.enviarMensagem(base44, contact, whatsappIntegrationId, `Combinado! Retornando para *${thread.sector_id}*...`);
      await this.atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', thread.sector_id);
      return await this.processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system' }, whatsappIntegrationId);
    } 
    
    return await this.processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, null, null);
  }

  // ===========================================================================
  // 3. ESCOLHA DE SETOR
  // ===========================================================================
  static async processarWAITING_SECTOR_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
    const entrada = (user_input.content || user_input.id || '').toLowerCase().trim();
    let setor = null;

    // Mapa simples e direto (Internalizando validação)
    if (['1', 'vendas', 'comercial'].some(k => entrada.includes(k))) setor = 'vendas';
    else if (['2', 'financeiro', 'fat', 'boleto'].some(k => entrada.includes(k))) setor = 'financeiro';
    else if (['3', 'suporte', 'tecnico', 'ajuda', 'assistencia'].some(k => entrada.includes(k))) setor = 'assistencia';
    else if (['4', 'fornecedor', 'compras'].some(k => entrada.includes(k))) setor = 'fornecedor';

    if (setor) {
      await this.enviarMensagem(base44, contact, whatsappIntegrationId, `Você escolheu: *${setor.toUpperCase()}*.\nBuscando atendentes...`);
      await this.atualizarEstado(base44, thread.id, 'WAITING_ATTENDANT_CHOICE', setor);
      return await this.processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, { type: 'system' }, whatsappIntegrationId);
    }

    // Input inválido
    await this.enviarMensagem(base44, contact, whatsappIntegrationId, "❌ Opção inválida. Digite o número ou nome do setor.");
    const menu = MenuBuilder.construirMenuBoasVindas(contact.nome);
    await this.enviarMensagem(base44, contact, whatsappIntegrationId, menu);
    return { success: false };
  }

  // ===========================================================================
  // 4. ESCOLHA DE ATENDENTE E VERIFICAÇÃO DE FILA
  // ===========================================================================
  static async processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
    const setor = thread.sector_id;

    try {
        console.log(`[FLUXO] Tentando rotear para setor: ${setor}`);
        
        const rota = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
            thread_id: thread.id,
            contact_id: contact.id,
            sector: setor,
            check_only: false
        });

        if (rota.data && rota.data.success && rota.data.atendente_id) {
            const atendenteNome = rota.data.atendente_nome || 'um atendente';
            await this.enviarMensagem(base44, contact, whatsappIntegrationId, `🥳 Encontrei o atendente *${atendenteNome}* para você! Transferindo...`);
            
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                pre_atendimento_state: 'COMPLETED',
                pre_atendimento_ativo: false,
                pre_atendimento_completed_at: new Date().toISOString()
            });
            return { success: true, allocated: true };
        } 
        
        console.log('[FLUXO] Sem atendentes livres. Oferecendo fila.');
        const msgFila = `No momento, todos os atendentes de *${setor}* estão ocupados. 😕\n\nDeseja aguardar na fila?\n\n1. ✅ Sim, entrar na fila\n2. 🔄 Escolher outro setor`;
        const btnFila = [
            { id: 'fila_entrar', text: '✅ Entrar na fila' },
            { id: 'fila_sair', text: '🔄 Outro setor' }
        ];

        await this.enviarMensagem(base44, contact, whatsappIntegrationId, msgFila, btnFila);
        await this.atualizarEstado(base44, thread.id, 'WAITING_QUEUE_DECISION');
        return { success: true, waiting_queue: true };

    } catch (e) {
        console.error('[FLUXO] Erro no roteamento:', e);
        await this.enviarMensagem(base44, contact, whatsappIntegrationId, "Houve um erro técnico. Vamos tentar novamente.");
        return { success: false, error: e.message };
    }
  }

  // ===========================================================================
  // 5. DECISÃO DE FILA
  // ===========================================================================
  static async processarWAITING_QUEUE_DECISION(base44, thread, contact, user_input, whatsappIntegrationId) {
    const entrada = (user_input.content || user_input.id || '').toLowerCase();

    if (['fila_entrar', 'sim', '1'].some(x => entrada.includes(x))) {
        await base44.asServiceRole.functions.invoke('gerenciarFila', {
            action: 'enqueue',
            thread_id: thread.id,
            setor: thread.sector_id,
            metadata: { nome: contact.nome }
        });

        await this.enviarMensagem(base44, contact, whatsappIntegrationId, `✅ Você está na fila! Assim que alguém liberar, você será chamado.`);
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            pre_atendimento_state: 'COMPLETED',
            pre_atendimento_ativo: false,
            pre_atendimento_completed_at: new Date().toISOString()
        });
        return { success: true, queued: true };

    } else {
        return await this.processarEstadoINIT(base44, thread, contact, whatsappIntegrationId, null, null);
    }
  }

  // ===========================================================================
  // 🛠️ HELPERS INTERNOS
  // ===========================================================================

  static async enviarMensagem(base44, contact, integrationId, texto, botoes = null) {
      try {
          let payload = {
            integration_id: integrationId,
            numero_destino: contact.telefone,
            mensagem: processTextWithEmojis(texto)
          };

          if (botoes) {
            payload.message_type = 'interactive_buttons';
            payload.interactive_buttons = botoes;
          }

          await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
      } catch (e) {
          console.error('[FLUXO] Falha ao enviar msg:', e.message);
      }
  }

  static async atualizarEstado(base44, threadId, novoEstado, setorId = undefined) {
      const updateData = {
          pre_atendimento_state: novoEstado,
          pre_atendimento_last_interaction: new Date().toISOString(),
          pre_atendimento_timeout_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() 
      };
      if (setorId !== undefined) updateData.sector_id = setorId;
      
      await base44.asServiceRole.entities.MessageThread.update(threadId, updateData);
  }
}