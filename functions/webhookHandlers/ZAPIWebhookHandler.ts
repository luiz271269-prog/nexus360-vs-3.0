// FUNÇÃO DE NORMALIZAÇÃO DE TELEFONE
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  
  let apenasNumeros = telefone.replace(/\D/g, '');
  
  if (!apenasNumeros) return null;
  if (apenasNumeros.length < 10) return null;
  
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  
  return '+' + apenasNumeros;
}

// EXTRAI TELEFONE DO JID DO WHATSAPP
function extrairTelefoneDeJID(jid) {
  if (!jid) return null;
  const numeroLimpo = jid.split('@')[0];
  return normalizarTelefone(numeroLimpo);
}

export default class ZAPIWebhookHandler {
  constructor(base44ServiceRole) {
    this.base44 = base44ServiceRole;
  }

  async processar(payload, headers) {
    console.log('[ZAPI] 📥 Processando webhook Z-API');
    console.log('[ZAPI] Event Type:', payload.event);
    
    try {
      if (payload.event === 'MESSAGE_RECEIVED') {
        return await this.processarMensagemRecebida(payload);
      }
      
      if (payload.event === 'MESSAGE_STATUS') {
        return await this.processarStatusMensagem(payload);
      }
      
      console.log('[ZAPI] ⚠️ Evento não tratado:', payload.event);
      return {
        success: true,
        message: 'Evento não tratado, mas registrado',
        event_type: payload.event
      };
      
    } catch (error) {
      console.error('[ZAPI] ❌ Erro ao processar webhook:', error);
      throw error;
    }
  }

  async processarMensagemRecebida(payload) {
    console.log('[ZAPI] 💬 Processando mensagem recebida');
    
    try {
      const data = payload.data;
      const key = data.key || {};
      const message = data.message || {};
      
      // EXTRAIR E NORMALIZAR TELEFONE DO REMETENTE
      const remoteJid = key.remoteJid;
      const numeroRemetente = extrairTelefoneDeJID(remoteJid);
      
      if (!numeroRemetente) {
        console.error('[ZAPI] ❌ Não foi possível extrair número do remetente:', remoteJid);
        throw new Error('Número de remetente inválido');
      }
      
      console.log('[ZAPI] 📱 Número normalizado:', numeroRemetente);
      
      const nomeRemetente = data.pushName || numeroRemetente;
      const messageId = key.id;
      const fromMe = key.fromMe;
      
      if (fromMe) {
        console.log('[ZAPI] ⏭️ Mensagem enviada por mim, ignorando');
        return { success: true, message: 'Mensagem própria ignorada' };
      }
      
      let conteudo = '';
      let mediaUrl = null;
      let mediaType = 'none';
      let mediaCaption = null;
      
      if (message.conversation) {
        conteudo = message.conversation;
      } else if (message.extendedTextMessage) {
        conteudo = message.extendedTextMessage.text || '';
      } else if (message.imageMessage) {
        mediaType = 'image';
        mediaCaption = message.imageMessage.caption || '';
        conteudo = `[Imagem${mediaCaption ? ': ' + mediaCaption : ''}]`;
      } else if (message.videoMessage) {
        mediaType = 'video';
        mediaCaption = message.videoMessage.caption || '';
        conteudo = `[Vídeo${mediaCaption ? ': ' + mediaCaption : ''}]`;
      } else if (message.audioMessage) {
        mediaType = 'audio';
        conteudo = '[Áudio]';
      } else if (message.documentMessage) {
        mediaType = 'document';
        const fileName = message.documentMessage.fileName || 'documento';
        conteudo = `[Documento: ${fileName}]`;
      } else {
        conteudo = '[Mensagem não suportada]';
      }
      
      // BUSCAR OU CRIAR CONTATO COM TELEFONE NORMALIZADO
      let contato = await this.buscarOuCriarContato(numeroRemetente, nomeRemetente);
      
      console.log('[ZAPI] 👤 Contato identificado:', contato.id, contato.nome);
      
      // Buscar integração ativa
      const integracoes = await this.base44.entities.WhatsAppIntegration.filter({
        status: 'conectado'
      });
      
      if (integracoes.length === 0) {
        throw new Error('Nenhuma integração WhatsApp ativa encontrada');
      }
      
      const integracao = integracoes[0];
      
      let thread = await this.buscarOuCriarThread(contato.id, integracao.id);
      
      console.log('[ZAPI] 💬 Thread identificada:', thread.id);
      
      // ✅ DEDUPLICAÇÃO CRÍTICA: Verificar se messageId já existe
      const mensagensExistentes = await this.base44.entities.Message.filter({
        whatsapp_message_id: messageId
      });
      
      if (mensagensExistentes.length > 0) {
        console.log('[ZAPI] ⚠️ Mensagem duplicada detectada, ignorando:', messageId);
        return {
          success: true,
          message: 'Mensagem duplicada ignorada',
          duplicate: true,
          message_id: messageId
        };
      }
      
      const novaMensagem = await this.base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        recipient_id: thread.assigned_user_id || 'sistema',
        recipient_type: 'user',
        content: conteudo,
        channel: 'whatsapp',
        status: 'entregue',
        whatsapp_message_id: messageId,
        sent_at: new Date(data.messageTimestamp * 1000).toISOString(),
        delivered_at: new Date().toISOString(),
        media_url: mediaUrl,
        media_type: mediaType,
        media_caption: mediaCaption
      });
      
      console.log('[ZAPI] ✅ Mensagem criada:', novaMensagem.id);
      
      await this.base44.entities.MessageThread.update(thread.id, {
        last_message_content: conteudo.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true
      });
      
      console.log('[ZAPI] ✅ Thread atualizada');
      
      return {
        success: true,
        message: 'Mensagem processada com sucesso',
        contact_id: contato.id,
        thread_id: thread.id,
        message_id: novaMensagem.id
      };
    } catch (error) {
      console.error('[ZAPI] ❌ Erro ao processar mensagem recebida:', error);
      return { success: false, error: error.message };
    }
  }

  async buscarOuCriarContato(telefoneNormalizado, nome) {
    console.log('[ZAPI] 🔍 Buscando contato por telefone normalizado:', telefoneNormalizado);
    
    // BUSCAR CONTATO PELO TELEFONE NORMALIZADO
    const contatosExistentes = await this.base44.entities.Contact.filter({
      telefone: telefoneNormalizado
    });
    
    if (contatosExistentes.length > 0) {
      console.log('[ZAPI] ✅ Contato encontrado:', contatosExistentes[0].id);
      return contatosExistentes[0];
    }
    
    console.log('[ZAPI] 🆕 Criando novo contato');
    
    // CRIAR CONTATO COM TELEFONE NORMALIZADO
    const novoContato = await this.base44.entities.Contact.create({
      nome: nome,
      telefone: telefoneNormalizado,
      tipo_contato: 'lead',
      vendedor_responsavel: 'Sistema',
      whatsapp_status: 'verificado',
      whatsapp_optin: false,
      tags: ['novo_contato', 'whatsapp'],
      observacoes: 'Contato criado automaticamente via webhook WhatsApp',
      ultima_interacao: new Date().toISOString()
    });
    
    console.log('[ZAPI] ✅ Novo contato criado:', novoContato.id);
    
    return novoContato;
  }

  async buscarOuCriarThread(contactId, integrationId) {
    const threadsExistentes = await this.base44.entities.MessageThread.filter({
      contact_id: contactId,
      whatsapp_integration_id: integrationId
    });
    
    if (threadsExistentes.length > 0) {
      return threadsExistentes[0];
    }
    
    const novaThread = await this.base44.entities.MessageThread.create({
      contact_id: contactId,
      whatsapp_integration_id: integrationId,
      last_message_content: 'Conversa iniciada',
      last_message_at: new Date().toISOString(),
      last_message_sender: 'contact',
      unread_count: 0,
      total_mensagens: 0,
      status: 'aberta',
      prioridade: 'normal',
      janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      can_send_without_template: true,
      primeira_mensagem_at: new Date().toISOString()
    });
    
    console.log('[ZAPI] ✅ Nova thread criada:', novaThread.id);
    
    return novaThread;
  }

  async processarStatusMensagem(payload) {
    try {
      const data = payload.data;
      const messageId = data.key?.id;
      const status = data.status;

      console.log('[ZAPI] 📊 Processando status de mensagem:', { messageId, status });

      const mensagens = await this.base44.entities.Message.filter({
        whatsapp_message_id: messageId
      });

      if (mensagens.length === 0) {
        console.log('[ZAPI] ⚠️ Mensagem não encontrada para atualizar status');
        return { success: true, message: 'Message not found' };
      }

      const mensagem = mensagens[0];

      const statusMap = {
        'sent': 'enviada',
        'delivered': 'entregue',
        'read': 'lida',
        'failed': 'falhou',
        'error': 'falhou'
      };

      const novoStatus = statusMap[status] || 'enviada';

      const updates = { status: novoStatus };

      if (novoStatus === 'entregue') {
        updates.delivered_at = new Date().toISOString();
      } else if (novoStatus === 'lida') {
        updates.read_at = new Date().toISOString();
      }

      await this.base44.entities.Message.update(mensagem.id, updates);

      console.log('[ZAPI] ✅ Status da mensagem atualizado:', novoStatus);

      return { success: true, data: { message_id: mensagem.id, new_status: novoStatus } };

    } catch (error) {
      console.error('[ZAPI] ❌ Erro ao processar status:', error);
      return { success: false, error: error.message };
    }
  }
}