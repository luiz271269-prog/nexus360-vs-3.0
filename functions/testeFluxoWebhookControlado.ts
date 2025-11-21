import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * TESTE CONTROLADO DO FLUXO COMPLETO DO WEBHOOK
 * Replica exatamente o que o webhook faz, mas com logs detalhados
 * em cada etapa para identificar onde está falhando.
 */

Deno.serve(async (req) => {
  const logs = [];
  const addLog = (tipo, mensagem, dados = null) => {
    const log = { 
      tipo, 
      mensagem, 
      timestamp: new Date().toISOString(),
      dados 
    };
    logs.push(log);
    console.log(`[TESTE-CONTROLADO] [${tipo}] ${mensagem}`, dados || '');
  };

  try {
    addLog('INFO', 'Iniciando teste controlado do fluxo webhook');

    // ========== ETAPA 1: INICIALIZAR BASE44 ==========
    addLog('INFO', 'ETAPA 1: Inicializando Base44 com Service Role...');
    const base44 = createClientFromRequest(req);
    addLog('SUCCESS', 'Base44 inicializado');

    // ========== ETAPA 2: PREPARAR PAYLOAD DE TESTE ==========
    addLog('INFO', 'ETAPA 2: Preparando payload de teste...');
    const timestampTeste = Date.now();
    const messageIdTeste = `TESTE_CONTROLADO_${timestampTeste}`;
    
    const payloadTeste = {
      instanceId: 'TESTE_INSTANCE',
      instance: 'TESTE_INSTANCE',
      type: 'ReceivedCallback',
      event: 'ReceivedCallback',
      phone: '5548999000222',
      momment: timestampTeste,
      messageId: messageIdTeste,
      text: { message: 'TESTE CONTROLADO' }
    };
    
    addLog('SUCCESS', 'Payload preparado', { messageId: messageIdTeste });

    // ========== ETAPA 3: TENTAR PERSISTIR ZAPIPALOADNORMALIZED ==========
    addLog('INFO', 'ETAPA 3: Tentando persistir ZapiPayloadNormalized...');
    
    let auditLogId = null;
    try {
      addLog('INFO', '  Preparando dados para create...');
      
      const dadosAudit = {
        payload_bruto: payloadTeste,
        instance_identificado: 'TESTE_INSTANCE',
        evento: 'ReceivedCallback',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false
      };
      
      addLog('INFO', '  Dados preparados', dadosAudit);
      addLog('INFO', '  Chamando base44.asServiceRole.entities.ZapiPayloadNormalized.create...');
      
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create(dadosAudit);
      
      auditLogId = auditLog.id;
      addLog('SUCCESS', `ZapiPayloadNormalized criado com sucesso! ID: ${auditLogId}`, auditLog);
      
    } catch (error) {
      addLog('ERROR', 'FALHA ao criar ZapiPayloadNormalized', {
        error_name: error.name,
        error_message: error.message,
        error_code: error.code,
        error_stack: error.stack,
        error_full: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      return Response.json({
        success: false,
        etapa_falhou: 'ZapiPayloadNormalized.create',
        logs
      });
    }

    // ========== ETAPA 4: NORMALIZAR PAYLOAD ==========
    addLog('INFO', 'ETAPA 4: Normalizando payload...');
    
    const payloadNormalizado = {
      type: 'message',
      from: payloadTeste.phone,
      messageId: payloadTeste.messageId,
      timestamp: new Date(payloadTeste.momment).toISOString(),
      content: payloadTeste.text?.message || '',
      mediaType: 'none',
      pushName: 'Teste'
    };
    
    addLog('SUCCESS', 'Payload normalizado', payloadNormalizado);

    // ========== ETAPA 5: CRIAR CONTACT ==========
    addLog('INFO', 'ETAPA 5: Criando Contact...');
    
    let contact;
    try {
      const contactsExistentes = await base44.asServiceRole.entities.Contact.filter({
        telefone: payloadNormalizado.from
      });
      
      if (contactsExistentes.length > 0) {
        contact = contactsExistentes[0];
        addLog('INFO', '  Contact ja existe', { contact_id: contact.id });
      } else {
        contact = await base44.asServiceRole.entities.Contact.create({
          nome: payloadNormalizado.pushName,
          telefone: payloadNormalizado.from,
          tipo_contato: 'lead'
        });
        addLog('SUCCESS', `Contact criado! ID: ${contact.id}`);
      }
    } catch (error) {
      addLog('ERROR', 'FALHA ao criar Contact', {
        error_message: error.message,
        error_stack: error.stack
      });
      
      return Response.json({
        success: false,
        etapa_falhou: 'Contact.create',
        audit_log_id: auditLogId,
        logs
      });
    }

    // ========== ETAPA 6: CRIAR MESSAGETHREAD ==========
    addLog('INFO', 'ETAPA 6: Criando MessageThread...');
    
    let thread;
    try {
      const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contact.id
      });
      
      if (threadsExistentes.length > 0) {
        thread = threadsExistentes[0];
        addLog('INFO', '  Thread ja existe', { thread_id: thread.id });
      } else {
        thread = await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contact.id,
          status: 'aberta',
          primeira_mensagem_at: new Date().toISOString()
        });
        addLog('SUCCESS', `Thread criada! ID: ${thread.id}`);
      }
    } catch (error) {
      addLog('ERROR', 'FALHA ao criar MessageThread', {
        error_message: error.message,
        error_stack: error.stack
      });
      
      return Response.json({
        success: false,
        etapa_falhou: 'MessageThread.create',
        audit_log_id: auditLogId,
        contact_id: contact.id,
        logs
      });
    }

    // ========== ETAPA 7: VERIFICAR DUPLICIDADE ==========
    addLog('INFO', 'ETAPA 7: Verificando duplicidade de mensagem...');
    
    try {
      const messagesExistentes = await base44.asServiceRole.entities.Message.filter({
        whatsapp_message_id: payloadNormalizado.messageId
      });
      
      if (messagesExistentes.length > 0) {
        addLog('WARNING', 'Mensagem duplicada detectada! Abortando.', {
          message_id: messagesExistentes[0].id
        });
        
        return Response.json({
          success: true,
          resultado: 'duplicata_descartada',
          logs
        });
      } else {
        addLog('SUCCESS', 'Mensagem nao e duplicata');
      }
    } catch (error) {
      addLog('ERROR', 'FALHA ao verificar duplicidade', {
        error_message: error.message
      });
    }

    // ========== ETAPA 8: CRIAR MESSAGE ==========
    addLog('INFO', 'ETAPA 8: Criando Message...');
    
    let message;
    try {
      message = await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contact.id,
        sender_type: 'contact',
        content: payloadNormalizado.content,
        channel: 'whatsapp',
        status: 'entregue',
        whatsapp_message_id: payloadNormalizado.messageId,
        sent_at: payloadNormalizado.timestamp
      });
      
      addLog('SUCCESS', `Message criada! ID: ${message.id}`);
    } catch (error) {
      addLog('ERROR', 'FALHA ao criar Message', {
        error_message: error.message,
        error_stack: error.stack
      });
      
      return Response.json({
        success: false,
        etapa_falhou: 'Message.create',
        audit_log_id: auditLogId,
        contact_id: contact.id,
        thread_id: thread.id,
        logs
      });
    }

    // ========== ETAPA 9: ATUALIZAR AUDITLOG ==========
    addLog('INFO', 'ETAPA 9: Atualizando ZapiPayloadNormalized com sucesso...');
    
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
        sucesso_processamento: true
      });
      addLog('SUCCESS', 'Auditoria atualizada');
    } catch (error) {
      addLog('WARNING', 'Falha ao atualizar auditoria (nao critico)', {
        error_message: error.message
      });
    }

    // ========== SUCESSO TOTAL ==========
    addLog('SUCCESS', 'FLUXO COMPLETO EXECUTADO COM SUCESSO!');

    return Response.json({
      success: true,
      resultado: 'fluxo_completo_ok',
      ids_criados: {
        audit_log: auditLogId,
        contact: contact.id,
        thread: thread.id,
        message: message.id
      },
      logs
    });

  } catch (error) {
    addLog('ERROR', 'ERRO FATAL NAO CAPTURADO', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack
    });

    return Response.json({
      success: false,
      etapa_falhou: 'erro_nao_capturado',
      error: error.message,
      logs
    }, { status: 500 });
  }
});