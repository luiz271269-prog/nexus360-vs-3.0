/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Z-API WEBHOOK HANDLER                                      ║
 * ║  Processa eventos vindos do webhook da Z-API                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default class ZAPIWebhookHandler {
  constructor(base44Client) {
    this.base44 = base44Client;
  }

  async process(evento, instanceIdentifier) {
    console.log('🔵 [Z-API Handler] Processando evento Z-API');
    console.log('🔵 [Z-API Handler] Instance ID:', instanceIdentifier);
    console.log('🔵 [Z-API Handler] Evento completo:', JSON.stringify(evento, null, 2));

    try {
      // Buscar integração pelo instance_id
      const integracoes = await this.base44.asServiceRole.entities.WhatsAppIntegration.filter({
        instance_id_provider: instanceIdentifier
      });

      if (!integracoes || integracoes.length === 0) {
        console.warn(`⚠️ [Z-API Handler] Integração não encontrada para instance: ${instanceIdentifier}`);
        return {
          success: false,
          error: `Integração não encontrada para instance ${instanceIdentifier}`
        };
      }

      const integracao = integracoes[0];
      console.log('✅ [Z-API Handler] Integração encontrada:', integracao.id, integracao.nome_instancia);

      // Determinar tipo de evento Z-API
      // A Z-API pode enviar diferentes estruturas dependendo do evento
      
      // MENSAGEM RECEBIDA
      if (evento.momentsAgo || evento.text || evento.image || evento.isGroupMsg !== undefined) {
        console.log('📩 [Z-API Handler] Evento identificado como: MENSAGEM RECEBIDA');
        return await this.processarMensagemRecebida(evento, integracao);
      }
      
      // STATUS DE MENSAGEM
      if (evento.type === 'MessageStatusCallback' || evento.status || evento.ack) {
        console.log('📊 [Z-API Handler] Evento identificado como: STATUS DE MENSAGEM');
        return await this.processarStatusMensagem(evento, integracao);
      }
      
      // CONEXÃO/DESCONEXÃO
      if (evento.connected !== undefined || evento.event === 'connection') {
        console.log('🔌 [Z-API Handler] Evento identificado como: CONEXÃO/DESCONEXÃO');
        return await this.processarConexao(evento, integracao);
      }

      console.warn('⚠️ [Z-API Handler] Tipo de evento não reconhecido');
      console.log('📋 [Z-API Handler] Estrutura do evento:', Object.keys(evento));

      return {
        success: true,
        message: 'Evento recebido mas não processado (tipo desconhecido)',
        evento_recebido: evento
      };

    } catch (error) {
      console.error('❌ [Z-API Handler] Erro ao processar:', error);
      console.error('Stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processarMensagemRecebida(evento, integracao) {
    console.log('📨 [Z-API Handler] Processando mensagem recebida...');

    try {
      // Extrair dados da mensagem Z-API
      const remetente = evento.phone || evento.from || evento.chatId;
      const texto = evento.text?.message || evento.body || evento.caption || '';
      const tipoMidia = evento.image ? 'image' : 
                        evento.video ? 'video' : 
                        evento.audio ? 'audio' : 
                        evento.document ? 'document' : 'none';
      const urlMidia = evento.image?.downloadUrl || evento.video?.downloadUrl || 
                       evento.audio?.downloadUrl || evento.document?.downloadUrl || null;

      console.log('📱 [Z-API Handler] Remetente:', remetente);
      console.log('💬 [Z-API Handler] Texto:', texto);
      console.log('🖼️ [Z-API Handler] Tipo mídia:', tipoMidia);

      if (!remetente) {
        console.warn('⚠️ [Z-API Handler] Remetente não identificado');
        return { success: false, error: 'Remetente não identificado' };
      }

      // 1. Buscar ou criar contato
      let contatos = await this.base44.asServiceRole.entities.Contact.filter({
        telefone: remetente
      });

      let contato;
      if (!contatos || contatos.length === 0) {
        console.log('➕ [Z-API Handler] Criando novo contato:', remetente);
        contato = await this.base44.asServiceRole.entities.Contact.create({
          nome: evento.senderName || evento.notifyName || remetente,
          telefone: remetente,
          tipo_contato: 'lead',
          whatsapp_status: 'verificado',
          ultima_interacao: new Date().toISOString()
        });
        console.log('✅ [Z-API Handler] Contato criado:', contato.id);
      } else {
        contato = contatos[0];
        console.log('✅ [Z-API Handler] Contato encontrado:', contato.id);
        
        // Atualizar última interação
        await this.base44.asServiceRole.entities.Contact.update(contato.id, {
          ultima_interacao: new Date().toISOString()
        });
      }

      // 2. Buscar ou criar thread
      let threads = await this.base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contato.id
      });

      let thread;
      if (!threads || threads.length === 0) {
        console.log('➕ [Z-API Handler] Criando nova thread para contato:', contato.id);
        thread = await this.base44.asServiceRole.entities.MessageThread.create({
          contact_id: contato.id,
          whatsapp_integration_id: integracao.id,
          last_message_content: texto.substring(0, 100),
          last_message_at: new Date().toISOString(),
          last_message_sender: 'contact',
          unread_count: 1,
          status: 'aberta',
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          primeira_mensagem_at: new Date().toISOString(),
          total_mensagens: 1
        });
        console.log('✅ [Z-API Handler] Thread criada:', thread.id);
      } else {
        thread = threads[0];
        console.log('✅ [Z-API Handler] Thread encontrada:', thread.id);
        
        // Atualizar thread
        await this.base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_content: texto.substring(0, 100),
          last_message_at: new Date().toISOString(),
          last_message_sender: 'contact',
          unread_count: (thread.unread_count || 0) + 1,
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          total_mensagens: (thread.total_mensagens || 0) + 1
        });
      }

      // 3. Criar mensagem
      console.log('➕ [Z-API Handler] Criando mensagem no banco...');
      const mensagem = await this.base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        recipient_id: integracao.id,
        recipient_type: 'user',
        content: texto,
        media_url: urlMidia,
        media_type: tipoMidia,
        channel: 'whatsapp',
        status: 'entregue',
        whatsapp_message_id: evento.messageId || evento.id?.id || null,
        sent_at: new Date().toISOString()
      });

      console.log('✅ [Z-API Handler] Mensagem criada:', mensagem.id);

      // 4. Atualizar estatísticas da integração
      await this.base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
        'estatisticas.total_mensagens_recebidas': (integracao.estatisticas?.total_mensagens_recebidas || 0) + 1,
        ultima_atividade: new Date().toISOString()
      });

      console.log('✅ [Z-API Handler] Mensagem processada com sucesso!');

      return {
        success: true,
        message: 'Mensagem recebida e processada',
        message_id: mensagem.id,
        contact_id: contato.id,
        thread_id: thread.id
      };

    } catch (error) {
      console.error('❌ [Z-API Handler] Erro ao processar mensagem recebida:', error);
      console.error('Stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async processarStatusMensagem(evento, integracao) {
    console.log('📊 [Z-API Handler] Processando status de mensagem...');
    
    // TODO: Implementar atualização de status
    return {
      success: true,
      message: 'Status de mensagem processado'
    };
  }

  async processarConexao(evento, integracao) {
    console.log('🔌 [Z-API Handler] Processando evento de conexão...');
    
    const novoStatus = evento.connected ? 'conectado' : 'desconectado';
    
    await this.base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: novoStatus,
      ultima_atividade: new Date().toISOString()
    });

    return {
      success: true,
      message: `Status atualizado para ${novoStatus}`
    };
  }
}