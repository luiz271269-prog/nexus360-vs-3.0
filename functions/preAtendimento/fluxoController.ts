/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FLUXO CONTROLLER - Gerencia transições de estado           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { MenuBuilder } from './menuBuilder.js';
import { ValidadorPreAtendimento } from './validadores.js';
import { AtendenteSelector } from './atendenteSelector.js';

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
  
  static async processarWAITING_SECTOR_CHOICE(base44, thread, contact, mensagemUsuario, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: WAITING_SECTOR_CHOICE - Processando escolha de setor');
    
    if (ValidadorPreAtendimento.verificarComandoCancelamento(mensagemUsuario)) {
      return await this.processarCancelamento(base44, thread, contact, whatsappIntegrationId);
    }
    
    if (ValidadorPreAtendimento.verificarComandoAjuda(mensagemUsuario)) {
      const mensagem = MenuBuilder.construirMensagemAjuda('WAITING_SECTOR_CHOICE');
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      return { success: true, aguardando_nova_resposta: true };
    }
    
    const validacao = ValidadorPreAtendimento.validarEscolhaSetor(mensagemUsuario);
    
    if (!validacao.valido) {
      const mensagemErro = MenuBuilder.construirMensagemErro(validacao.erro, 'setor');
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
      return { success: false, erro: validacao.erro, aguardando_nova_resposta: true };
    }
    
    const setor = validacao.setor;
    console.log('[FLUXO] Setor escolhido:', setor);
    
    const atendentes = await AtendenteSelector.buscarAtendentesDisponiveis(base44, setor);
    const mensagem = MenuBuilder.construirMenuAtendentes(atendentes, setor);
    await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
    
    const proximoEstado = atendentes.length > 0 ? 'WAITING_ATTENDANT_CHOICE' : 'WAITING_FALLBACK';
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: proximoEstado,
      sector_id: setor,
      pre_atendimento_timeout_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
    
    return {
      success: true,
      setor,
      atendentes_disponiveis: atendentes.length,
      proximo_estado: proximoEstado
    };
  }
  
  static async processarWAITING_ATTENDANT_CHOICE(base44, thread, contact, mensagemUsuario, whatsappIntegrationId) {
    console.log('[FLUXO] Estado: WAITING_ATTENDANT_CHOICE - Processando escolha de atendente');
    
    if (ValidadorPreAtendimento.verificarComandoCancelamento(mensagemUsuario)) {
      return await this.processarCancelamento(base44, thread, contact, whatsappIntegrationId);
    }
    
    if (mensagemUsuario?.trim().toLowerCase() === 'voltar') {
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
    
    const validacao = ValidadorPreAtendimento.validarEscolhaAtendente(mensagemUsuario, atendentes.length);
    
    if (!validacao.valido) {
      const mensagemErro = MenuBuilder.construirMensagemErro(validacao.erro, 'atendente');
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagemErro, whatsappIntegrationId);
      return { success: false, erro: validacao.erro, aguardando_nova_resposta: true };
    }
    
    const atendenteEscolhido = atendentes[validacao.indice];
    console.log('[FLUXO] Atendente escolhido:', atendenteEscolhido.full_name);
    
    const disponibilidade = await AtendenteSelector.validarDisponibilidade(base44, atendenteEscolhido.id);
    
    if (!disponibilidade.disponivel) {
      const mensagem = MenuBuilder.construirMensagemAtendenteOcupado(atendenteEscolhido.full_name);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, mensagem, whatsappIntegrationId);
      
      const menuAtendentes = MenuBuilder.construirMenuAtendentes(atendentes, setor);
      await this.enviarMensagemWhatsApp(base44, contact.telefone, menuAtendentes, whatsappIntegrationId);
      
      return {
        success: false,
        erro: 'atendente_indisponivel',
        aguardando_nova_resposta: true
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
      const response = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
        integration_id: whatsappIntegrationId,
        phone: telefone,
        message: mensagem
      });
      
      console.log('[FLUXO] ✅ Mensagem enviada com sucesso');
      return response.data;
      
    } catch (error) {
      console.error('[FLUXO] ❌ Erro ao enviar mensagem:', error);
      throw error;
    }
  }
}