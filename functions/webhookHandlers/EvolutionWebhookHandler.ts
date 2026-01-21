/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  EVOLUTION WEBHOOK HANDLER                                   ║
 * ║  Processa eventos específicos da Evolution API              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default class EvolutionWebhookHandler {
  constructor(base44Service) {
    this.base44 = base44Service;
  }

  async process(evento, instanceName) {
    const { event, instance, data } = evento;

    switch (event) {
      case 'qrcode.updated':
        return await this.handleQRCodeUpdate(instance || instanceName, data);
      
      case 'connection.update':
        return await this.handleConnectionUpdate(instance || instanceName, data);
      
      case 'messages.upsert':
        return await this.handleMessageReceived(instance || instanceName, data);
      
      case 'messages.update':
        return await this.handleMessageStatusUpdate(data);
      
      case 'send.message':
        return { success: true, processed: 'send_confirmation' };
      
      default:
        console.log('⚠️ Evento Evolution não tratado:', event);
        return { success: true, ignored: 'unknown_event' };
    }
  }

  async handleQRCodeUpdate(instanceName, data) {
    const integracoes = await this.base44.entities.WhatsAppIntegration.filter({
      nome_instancia: instanceName
    });

    if (integracoes.length > 0) {
      await this.base44.entities.WhatsAppIntegration.update(integracoes[0].id, {
        qr_code_url: data.qrcode,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
    }

    return { success: true, processed: 'qrcode_updated' };
  }

  async handleConnectionUpdate(instanceName, data) {
    const integracoes = await this.base44.entities.WhatsAppIntegration.filter({
      nome_instancia: instanceName
    });

    if (integracoes.length > 0) {
      let novoStatus = 'desconectado';
      
      if (data.state === 'open' || data.status === 'open') {
        novoStatus = 'conectado';
      } else if (data.state === 'connecting') {
        novoStatus = 'reconectando';
      }

      await this.base44.entities.WhatsAppIntegration.update(integracoes[0].id, {
        status: novoStatus,
        ultima_atividade: new Date().toISOString()
      });
    }

    return { success: true, processed: 'connection_updated' };
  }

  async handleMessageReceived(instanceName, data) {
    const mensagem = data.messages?.[0] || data.message || data;
    
    if (!mensagem.key || !mensagem.message) {
      return { success: true, ignored: 'invalid_message_format' };
    }

    // Ignorar mensagens próprias
    if (mensagem.key.fromMe) {
      return { success: true, ignored: 'own_message' };
    }

    const numero = mensagem.key.remoteJid.replace('@s.whatsapp.net', '');
    const conteudo = mensagem.message.conversation || 
                    mensagem.message.extendedTextMessage?.text || 
                    '[Mídia]';

    // Buscar ou criar contato
    let contatos = await this.base44.entities.Contact.filter({ telefone: `+${numero}` });
    let contato;

    if (contatos.length === 0) {
      contato = await this.base44.entities.Contact.create({
        nome: mensagem.pushName || numero,
        telefone: `+${numero}`,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString()
      });
    } else {
      contato = contatos[0];
      await this.base44.entities.Contact.update(contato.id, {
        ultima_interacao: new Date().toISOString()
      });
    }

    // Buscar ou criar thread
    let threads = await this.base44.entities.MessageThread.filter({ contact_id: contato.id });
    let thread;

    if (threads.length === 0) {
      thread = await this.base44.entities.MessageThread.create({
        contact_id: contato.id,
        status: 'aberta',
        primeira_mensagem_at: new Date().toISOString(),
        ultima_atividade: new Date().toISOString(),
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true,
        total_mensagens: 0
      });
    } else {
      thread = threads[0];
      // Renovar janela 24h
      await this.base44.entities.MessageThread.update(thread.id, {
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true
      });
    }

    // Salvar mensagem
    await this.base44.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: conteudo,
      channel: 'whatsapp',
      status: 'entregue',
      whatsapp_message_id: mensagem.key.id,
      sent_at: new Date(mensagem.messageTimestamp * 1000).toISOString(),
      delivered_at: new Date().toISOString()
    });

    // Atualizar thread
    await this.base44.entities.MessageThread.update(thread.id, {
      last_message_content: conteudo.substring(0, 100),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1
    });

    // Criar interação se cliente associado
    if (contato.cliente_id) {
      await this.base44.entities.Interacao.create({
        cliente_id: contato.cliente_id,
        cliente_nome: contato.empresa || contato.nome,
        contact_id: contato.id,
        thread_id: thread.id,
        tipo_interacao: 'whatsapp',
        data_interacao: new Date().toISOString(),
        resultado: 'sucesso',
        observacoes: conteudo
      });
    }

    return { success: true, processed: 'message_saved' };
  }

  async handleMessageStatusUpdate(data) {
    const status = data.status;
    const messageId = data.key?.id;

    if (messageId) {
      const mensagens = await this.base44.entities.Message.filter({
        whatsapp_message_id: messageId
      });

      if (mensagens.length > 0) {
        const updates = {};
        
        if (status === 'READ' || status === 'read') {
          updates.status = 'lida';
          updates.read_at = new Date().toISOString();
        } else if (status === 'DELIVERY_ACK' || status === 'delivered') {
          updates.status = 'entregue';
          updates.delivered_at = new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          await this.base44.entities.Message.update(mensagens[0].id, updates);
        }
      }
    }

    return { success: true, processed: 'message_status_updated' };
  }
}