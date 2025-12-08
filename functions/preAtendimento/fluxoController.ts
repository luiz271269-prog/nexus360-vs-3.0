/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FLUXO CONTROLLER - Gerencia transições de estado           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { MenuBuilder } from './menuBuilder.js';
import { ValidadorPreAtendimento } from './validadores.js';
import { AtendenteSelector } from './atendenteSelector.js';
import { sectorButtonMap, mapAttendantButtonToId } from './buttonMappings.js';

export class FluxoController {
  
  static async processarEstadoINIT(base44, thread, contact, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: INIT - Enviando menu de setores');
    
    const mensagem = MenuBuilder.construirMenuBoasVindas(contact.nome);
    await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'WAITING_SECTOR_CHOICE',
      pre_atendimento_timeout_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    return {
      success: true,
      proximo_estado: 'WAITING_SECTOR_CHOICE',
      mensagem_enviada: true
    };
  }
  
  static async processarWAITING_SECTOR_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: WAITING_SECTOR_CHOICE - Processando escolha de setor');
    
    let setorEscolhido = null;
    let isValidInput = false;
    
    const textoParaVerificar = user_input.type === 'text' 
      ? (user_input.content || '').trim() 
      : (user_input.text || '').trim();
    
    // 1. Comandos de cancelamento/ajuda
    if (ValidadorPreAtendimento.verificarComandoCancelamento(textoParaVerificar)) {
      return await this.processarCancelamento(base44, thread, contact, whatsappIntegrationId);
    }
    
    if (ValidadorPreAtendimento.verificarComandoAjuda(textoParaVerificar)) {
      const mensagem = MenuBuilder.construirMensagemAjuda('WAITING_SECTOR_CHOICE');
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      return { success: true, aguardando_nova_resposta: true };
    }
    
    // 2. Input por botão
    if (user_input.type === 'button') {
      const mapped = sectorButtonMap[user_input.id];
      if (mapped) {
        setorEscolhido = mapped;
        isValidInput = true;
      }
    }
    
    // 3. Input por texto (fallback)
    if (!isValidInput && user_input.type === 'text') {
      const validacao = ValidadorPreAtendimento.validarEscolhaSetor(user_input.content);
      if (validacao.valido) {
        setorEscolhido = validacao.setor;
        isValidInput = true;
      }
    }
    
    // 4. Input inválido
    if (!isValidInput) {
      const mensagemErro = MenuBuilder.construirMensagemErro(
        'Opção inválida. Escolha um setor pelos botões ou digite o número correspondente.',
        'setor'
      );
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
      
      const menu = MenuBuilder.construirMenuBoasVindas(contact.nome);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, menu, whatsappIntegrationId);
      
      return { success: false, erro: 'escolha_invalida', aguardando_nova_resposta: true };
    }
    
    // 5. Confirmação "limpa"
    const textoOpcaoEscolhida = user_input.type === 'button' 
      ? user_input.text 
      : ValidadorPreAtendimento.formatarNomeSetor(setorEscolhido);
    
    const msgConfirmacao = `Você escolheu: *${textoOpcaoEscolhida}*\n\nEstou direcionando você para o setor...`;
    await this.enviarMensagemWhatsApp(base44, contact.telefone, msgConfirmacao, whatsappIntegrationId);
    
    console.log('[FLUXO] Setor escolhido:', setorEscolhido);
    
    // 6. Buscar atendentes
    const atendentes = await AtendenteSelector.buscarAtendentesDisponiveis(base44, setorEscolhido);
    
    let proximoEstado = 'WAITING_FALLBACK';
    if (atendentes.length > 0) {
      proximoEstado = 'WAITING_ATTENDANT_CHOICE';
      const mensagem = MenuBuilder.construirMenuAtendentes(atendentes, setorEscolhido);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
    }
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: proximoEstado,
      sector_id: setorEscolhido,
      pre_atendimento_timeout_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    return {
      success: true,
      setor: setorEscolhido,
      atendentes_disponiveis: atendentes.length,
      proximo_estado: proximoEstado
    };
  }
  
  static async processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, user_input, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: WAITING_ATTENDANT_CHOICE - Processando escolha de atendente');
    
    const textoParaVerificar = user_input.type === 'text' 
      ? (user_input.content || '').trim() 
      : (user_input.text || '').trim();
    
    if (ValidadorPreAtendimento.verificarComandoCancelamento(textoParaVerificar)) {
      return await this.processarCancelamento(base44, thread, contact, whatsappIntegrationId);
    }
    
    if (textoParaVerificar.toLowerCase() === 'voltar') {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'INIT',
        sector_id: null
      });
      return await this.processarEstadoINIT(base44, thread, contact, whatsappIntegrationId);
    }
    
    const setor = thread.sector_id;
    const atendentes = await AtendenteSelector.buscarAtendentesDisponiveis(base44, setor);
    
    if (atendentes.length === 0) {
      const mensagem = MenuBuilder.construirMensagemNenhumAtendente(setor);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      return {
        success: false,
        erro: 'nenhum_atendente_disponivel',
        aguardando_callback: true
      };
    }
    
    let atendenteEscolhido = null;
    let isValidInput = false;
    
    // Input por botão
    if (user_input.type === 'button') {
      const attendantId = mapAttendantButtonToId(user_input.id);
      if (attendantId) {
        atendenteEscolhido = atendentes.find(a => a.id === attendantId);
        if (atendenteEscolhido) {
          isValidInput = true;
        }
      }
    }
    
    // Input por texto (fallback)
    if (!isValidInput && user_input.type === 'text') {
      const validacao = ValidadorPreAtendimento.validarEscolhaAtendente(user_input.content, atendentes.length);
      if (validacao.valido) {
        atendenteEscolhido = atendentes[validacao.indice];
        isValidInput = true;
      }
    }
    
    if (!isValidInput) {
      const mensagemErro = MenuBuilder.construirMensagemErro('Opção inválida', 'atendente');
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
      return { success: false, erro: 'escolha_invalida', aguardando_nova_resposta: true };
    }
    
    console.log('[FLUXO] Atendente escolhido:', atendenteEscolhido.full_name);
    
    const disponibilidade = await AtendenteSelector.validarDisponibilidade(base44, atendenteEscolhido.id);
    
    if (!disponibilidade.disponivel) {
      const mensagem = MenuBuilder.construirMensagemAtendenteOcupado(atendenteEscolhido.full_name);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      
      // 🆕 OPÇÃO: Oferecer entrar na fila do setor
      const mensagemFila = {
        type: 'interactive_buttons',
        body: `📋 Você pode aguardar na fila do setor *${setor}* e o próximo atendente disponível irá atendê-lo.`,
        buttons: [
          { id: 'fila_entrar', text: '✅ Entrar na fila' },
          { id: 'fila_outro', text: '🔄 Outro atendente' }
        ]
      };
      
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemFila, whatsappIntegrationId);
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'WAITING_QUEUE_DECISION',
        pre_atendimento_timeout_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
      
      return {
        success: true,
        proximo_estado: 'WAITING_QUEUE_DECISION',
        aguardando_decisao_fila: true
      };
    }
    
    const mensagemConectando = MenuBuilder.construirMensagemConectando(atendenteEscolhido.full_name, setor);
    await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemConectando, whatsappIntegrationId);
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'TRANSFERRING'
    });
    
    try {
      const responseRoteamento = await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
        thread_id: thread.id,
        contact_id: contact.id,
        sector: setor,
        force_attendant_id: atendenteEscolhido.id
      });
      
      console.log('[FLUXO] ✅ Roteamento realizado:', responseRoteamento.data);
      
      const mensagemSucesso = MenuBuilder.construirMensagemSucesso(atendenteEscolhido.full_name);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemSucesso, whatsappIntegrationId);
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'COMPLETED',
        pre_atendimento_ativo: false
      });
      
      // 🆕 INTEGRAÇÃO COM FILA: Remover da fila se estava enfileirada
      try {
        if (thread.fila_atendimento_id) {
          await base44.asServiceRole.functions.invoke('gerenciarFila', {
            action: 'remover',
            thread_id: thread.id,
            motivo: 'atribuido'
          });
          console.log('[FLUXO] ✅ Thread removida da fila após pré-atendimento');
        }
      } catch (filaError) {
        console.warn('[FLUXO] ⚠️ Erro ao remover da fila (não crítico):', filaError);
      }
      
      return {
        success: true,
        proximo_estado: 'COMPLETED',
        atendente: atendenteEscolhido.full_name,
        roteamento: responseRoteamento.data
      };
      
    } catch (error) {
      console.error('[FLUXO] ❌ Erro no roteamento:', error);
      
      const mensagemErro = `😔 Desculpe, houve um erro ao conectar você com o atendente.\n\nPor favor, aguarde que entraremos em contato em breve.`;
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
      
      return {
        success: false,
        erro: 'erro_roteamento',
        detalhes: error.message
      };
    }
  }
  
  static async processarWAITING_QUEUE_DECISION(base44, thread, contact, user_input, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: WAITING_QUEUE_DECISION - Processando decisão de fila');
    
    // Normalizar entrada: botão ou texto
    let escolha;
    if (user_input.type === 'button') {
      escolha = user_input.id;
    } else {
      escolha = user_input.content?.trim();
    }
    
    if (escolha === 'fila_entrar' || escolha === '1') {
      // Cliente optou por entrar na fila
      const setor = thread.sector_id || 'geral';
      
      console.log('[FLUXO] 📥 Cliente optou por entrar na fila do setor:', setor);
      
      // Enfileirar via gerenciarFila
      const resultadoFila = await base44.asServiceRole.functions.invoke('gerenciarFila', {
        action: 'enqueue',
        thread_id: thread.id,
        whatsapp_integration_id: thread.whatsapp_integration_id,
        setor: setor,
        prioridade: 'normal',
        metadata: {
          cliente_nome: contact.nome,
          cliente_telefone: contact.telefone,
          origem: 'pre_atendimento'
        }
      });
      
      if (resultadoFila.data.success) {
        const posicao = resultadoFila.data.posicao || '...';
        const mensagem = `✅ Você entrou na fila do setor *${setor}*!\n\n` +
          `📊 Posição atual: *${posicao}*\n` +
          `⏰ Aguarde que em breve um atendente irá respondê-lo.\n\n` +
          `Você receberá uma notificação quando for sua vez! 🔔`;
        
        await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
        
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          pre_atendimento_state: 'COMPLETED',
          pre_atendimento_ativo: false
        });
        
        return {
          success: true,
          proximo_estado: 'COMPLETED',
          enfileirado: true,
          posicao: posicao
        };
      }
      
    } else if (escolha === 'fila_outro' || escolha === '2') {
      // Cliente optou por escolher outro atendente
      const setor = thread.sector_id;
      const atendentes = await AtendenteSelector.buscarAtendentesDisponiveis(base44, setor);
      const mensagem = MenuBuilder.construirMenuAtendentes(atendentes, setor);
      
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        pre_atendimento_state: 'WAITING_ATTENDANT_CHOICE'
      });
      
      return {
        success: true,
        proximo_estado: 'WAITING_ATTENDANT_CHOICE'
      };
    }
    
    // Resposta inválida
    const mensagemErro = {
      type: 'interactive_buttons',
      body: `❌ Opção inválida. Por favor, escolha uma opção:`,
      buttons: [
        { id: 'fila_entrar', text: '✅ Entrar na fila' },
        { id: 'fila_outro', text: '🔄 Outro atendente' }
      ]
    };
    await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
    
    return {
      success: false,
      erro: 'opcao_invalida',
      aguardando_nova_resposta: true
    };
  }
  
  static async processarCancelamento(base44, thread, contact, whatsappIntegrationId) {
    console.log('[FLUXO] Processando cancelamento');
    
    const mensagem = MenuBuilder.construirMensagemCancelamento();
    await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: 'CANCELLED',
      pre_atendimento_ativo: false,
      status: 'arquivada'
    });
    
    return {
      success: true,
      cancelado: true
    };
  }
  
  static async enviarMensagemWhatsApp(base44, telefone, mensagem, whatsappIntegrationId) {
    try {
      let payload = {
        integration_id: whatsappIntegrationId,
        numero_destino: telefone
      };
      
      // Se mensagem for objeto estruturado (botões)
      if (typeof mensagem === 'object' && mensagem.type === 'interactive_buttons') {
        payload.message_type = 'interactive_buttons';
        payload.mensagem = mensagem.body;
        payload.interactive_buttons = mensagem.buttons;
      } else {
        // Mensagem de texto simples
        payload.mensagem = mensagem;
      }
      
      const response = await base44.asServiceRole.functions.invoke('enviarWhatsApp', payload);
      
      console.log('[FLUXO] ✅ Mensagem enviada com sucesso');
      return response.data;
      
    } catch (error) {
      console.error('[FLUXO] ❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }
}