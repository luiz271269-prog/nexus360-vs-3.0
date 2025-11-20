import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { 
  normalizarPayloadZAPI, 
  validarPayloadNormalizado,
  extrairInstanceId
} from './adapters/zapiAdapter.js';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  WHATSAPP WEBHOOK - Z-API + EVOLUTION API                   ║
 * ║  Versão: 2.0 - Normalização + Multi-Conexão + Filas        ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Processa eventos com:
 * - Normalização de payload via adapters
 * - Persistência de payload bruto para auditoria
 * - Validação rigorosa
 * - Multi-conexão robusta
 * - Auto-enfileiramento inteligente
 * - Download e persistência de mídia
 * - Processamento assíncrono de IA
 */

Deno.serve(async (req) => {
  console.log('[WEBHOOK] ===================================================');
  console.log('[WEBHOOK] Webhook recebido');
  console.log('[WEBHOOK] ===================================================');

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ═══════════════════════════════════════════════════════════
  // TRATAMENTO PARA REQUISIÇÕES GET (HEALTH CHECKS)
  // ═══════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    console.log('[WEBHOOK] INFO: Recebido GET request (health check). Respondendo com 200 OK.');
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. INICIALIZAR BASE44 COM SERVICE ROLE
    // ═══════════════════════════════════════════════════════════
    const base44 = createClientFromRequest(req);

    console.log('[WEBHOOK] OK Base44 inicializado (Service Role)');

    // ================================================================
    // 2. VALIDACAO E PARSING DO PAYLOAD
    // ================================================================
    console.log('[WEBHOOK] Iniciando leitura do body...');
    let evento;
    try {
      const rawBody = await req.text();
      console.log('[WEBHOOK] RAW BODY COMPLETO:', rawBody);
      console.log('[WEBHOOK] Tamanho do body:', rawBody.length, 'caracteres');
      
      if (!rawBody || rawBody.trim() === '') {
        console.error('[WEBHOOK] ERRO: Body vazio recebido');
        return Response.json(
          { success: false, error: 'Empty body' },
          { status: 200, headers: corsHeaders }
        );
      }
      
      evento = JSON.parse(rawBody);
    } catch (e) {
      console.error('[WEBHOOK] ERRO ao parsear JSON:', e.message);
      return Response.json(
        { success: false, error: 'Invalid JSON payload: ' + e.message },
        { status: 200, headers: corsHeaders }
      );
    }

    // Log das chaves do payload para diagnostico
    console.log('[WEBHOOK] Chaves do payload:', Object.keys(evento));
    console.log('[WEBHOOK] Payload completo:', JSON.stringify(evento, null, 2));

    // Extracao robusta de evento e instancia, cobrindo variacoes comuns
    const eventoTipo = evento.event || evento.type || evento.event_type || evento.eventName || 'ReceivedCallback';
    const instanceExtraido = evento.instance || evento.instanceId || evento.instance_id || extrairInstanceId(evento);

    console.log('[WEBHOOK] Extracao tentada:', {
      eventoTipo,
      instanceExtraido,
      evento_event: evento.event,
      evento_type: evento.type,
      evento_instance: evento.instance,
      evento_instanceId: evento.instanceId
    });

    if (!eventoTipo || !instanceExtraido) {
      console.warn('[WEBHOOK] AVISO: Campos obrigatorios faltando (event/type ou instance/instanceId)');
      console.warn('[WEBHOOK] Payload recebido:', JSON.stringify(evento, null, 2));
      console.warn('[WEBHOOK] Chaves disponiveis:', Object.keys(evento).join(', '));

      // Mesmo assim, persistir para auditoria
      try {
        await base44.entities.ZapiPayloadNormalized.create({
          payload_bruto: evento,
          instance_identificado: instanceExtraido || 'unknown',
          evento: eventoTipo || 'unknown',
          timestamp_recebido: new Date().toISOString(),
          sucesso_processamento: false,
          erro_detalhes: 'Campos obrigatórios faltando: event/type ou instance/instanceId'
        });
      } catch (err) {
        console.error('[WEBHOOK] AVISO: Erro ao persistir payload com campos faltando:', err);
      }

      return Response.json(
        { success: true, ignored: 'missing_required_fields' },
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[WEBHOOK] Evento: ${eventoTipo} | Instancia: ${instanceExtraido}`);
    
    // ================================================================
    // 3. PERSISTIR PAYLOAD BRUTO PARA AUDITORIA (SEMPRE)
    // ================================================================
    const timestampRecebido = new Date().toISOString();
    let auditLogId = null;

    try {
      console.log('[WEBHOOK] Tentando persistir payload bruto para auditoria...');
      console.log('[WEBHOOK] VERIFICACAO PRE-INSERT:');
      console.log('[WEBHOOK]   - instance_identificado:', instanceExtraido, '(tipo:', typeof instanceExtraido, ')');
      console.log('[WEBHOOK]   - evento:', eventoTipo, '(tipo:', typeof eventoTipo, ')');
      console.log('[WEBHOOK]   - timestamp_recebido:', timestampRecebido, '(tipo:', typeof timestampRecebido, ')');
      console.log('[WEBHOOK]   - payload_bruto tipo:', typeof evento, '(keys:', Object.keys(evento).length, ')');

      console.log('[WEBHOOK] Chamando base44.asServiceRole.entities.ZapiPayloadNormalized.create...');

      const dadosParaCriar = {
        payload_bruto: evento,
        instance_identificado: instanceExtraido,
        evento: eventoTipo,
        timestamp_recebido: timestampRecebido,
        sucesso_processamento: false
      };

      console.log('[WEBHOOK] Dados que serao enviados:', JSON.stringify(dadosParaCriar, null, 2));

      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create(dadosParaCriar);

      auditLogId = auditLog.id;
      console.log('[WEBHOOK] OK: Payload bruto persistido para auditoria com sucesso!');
      console.log('[WEBHOOK] ID criado:', auditLogId);
      console.log('[WEBHOOK] Objeto completo retornado:', JSON.stringify(auditLog, null, 2));
    } catch (auditError) {
      console.error('[WEBHOOK] ERRO CRITICO ao persistir auditoria');
      console.error('[WEBHOOK] Nome do erro:', auditError.name);
      console.error('[WEBHOOK] Mensagem:', auditError.message);
      console.error('[WEBHOOK] Codigo:', auditError.code);
      console.error('[WEBHOOK] Stack completo:', auditError.stack);
      console.error('[WEBHOOK] Payload que falhou:', JSON.stringify(evento, null, 2));
      console.error('[WEBHOOK] Detalhes do erro completo:', JSON.stringify(auditError, Object.getOwnPropertyNames(auditError), 2));

      // MESMO COM ERRO, continuar processamento
      return Response.json(
        { 
          success: false, 
          error: 'Falha ao persistir payload: ' + auditError.message,
          error_name: auditError.name,
          error_code: auditError.code,
          error_stack: auditError.stack,
          timestamp: timestampRecebido,
          debug: {
            instance: instanceExtraido,
            evento: eventoTipo,
            payload_type: typeof evento,
            payload_keys: Object.keys(evento)
          }
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // ================================================================
    // 3.1 PERSISTIR WEBHOOK LOG (SEMPRE)
    // ================================================================
    try {
      console.log('[WEBHOOK] Tentando persistir WebhookLog:', {
        instance_id: instanceExtraido,
        event_type: eventoTipo,
        timestamp: timestampRecebido
      });

      await base44.asServiceRole.entities.WebhookLog.create({
        timestamp: timestampRecebido,
        provider: 'z_api',
        instance_id: instanceExtraido,
        event_type: eventoTipo,
        payload: evento,
        processed: false, // Será atualizado ao final
        success: false
      });
      console.log('[WEBHOOK] OK: WebhookLog persistido com sucesso');
    } catch (logError) {
      console.error('[WEBHOOK] ERRO ao persistir WebhookLog:', logError.message);
      console.error('[WEBHOOK] Stack:', logError.stack);
    }

    // ================================================================
    // 4. NORMALIZAR PAYLOAD COM ADAPTER
    // ================================================================
    let payloadNormalizado = null;
    try {
      console.log('[WEBHOOK] Chamando normalizarPayloadZAPI...');
      console.log('[WEBHOOK] Evento original - type:', evento.type, '| event:', evento.event);

      payloadNormalizado = normalizarPayloadZAPI(evento);

      console.log('[WEBHOOK] OK: Payload normalizado COMPLETO:', JSON.stringify(payloadNormalizado, null, 2));
      console.log('[WEBHOOK] payloadNormalizado.type =', payloadNormalizado.type);

      const validacao = validarPayloadNormalizado(payloadNormalizado);
      if (!validacao.valido) {
        console.warn('[WEBHOOK] AVISO: Payload normalizado invalido:', validacao.erro);
        return Response.json(
          { success: true, ignored: 'invalid_normalized_payload', details: validacao.erro },
          { status: 200, headers: corsHeaders }
        );
      }

      console.log('[WEBHOOK] OK: Payload normalizado VALIDO');
    } catch (normError) {
      console.error('[WEBHOOK] ERRO na normalizacao:', normError);
      console.error('[WEBHOOK] Stack:', normError.stack);
      return Response.json(
        { success: true, ignored: 'normalization_error', error: normError.message },
        { status: 200, headers: corsHeaders }
      );
    }

    // ================================================================
    // 5. PROCESSAR EVENTO POR TIPO
    // ================================================================
    let resultado;

    console.log('[WEBHOOK] Iniciando switch com type:', payloadNormalizado.type);

    switch (payloadNormalizado.type) {
      case 'qrcode':
        console.log('[WEBHOOK] Entrando em case: qrcode');
        resultado = await processarQRCodeUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;

      case 'connection':
        console.log('[WEBHOOK] Entrando em case: connection');
        resultado = await processarConnectionUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;

      case 'message':
        console.log('[WEBHOOK] Entrando em case: message');
        resultado = await processarMensagemRecebida(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;

      case 'message_update':
        console.log('[WEBHOOK] Entrando em case: message_update');
        resultado = await processarMensagemUpdate(payloadNormalizado, base44, corsHeaders);
        break;

      case 'send_confirmation':
        console.log('[WEBHOOK] Entrando em case: send_confirmation');
        resultado = Response.json(
          { success: true, processed: 'send_confirmation' },
          { status: 200, headers: corsHeaders }
        );
        break;

      case 'unknown':
        console.log('[WEBHOOK] Entrando em case: unknown');
        console.log(`[WEBHOOK] AVISO: Evento nao reconhecido pelo adapter: ${payloadNormalizado.event}`);
        console.log('[WEBHOOK] DEBUG - Payload normalizado completo:', JSON.stringify(payloadNormalizado, null, 2));
        console.log('[WEBHOOK] ATENCAO: Evento sendo IGNORADO - nenhuma persistencia sera feita!');
        resultado = Response.json(
          { success: true, ignored: 'unknown_event', event: payloadNormalizado.event },
          { status: 200, headers: corsHeaders }
        );
        break;

      default:
        console.log('[WEBHOOK] Entrando em case: default');
        console.log(`[WEBHOOK] AVISO: Tipo nao tratado: ${payloadNormalizado.type}`);
        resultado = Response.json(
          { success: true, ignored: 'unknown_type', type: payloadNormalizado.type },
          { status: 200, headers: corsHeaders }
        );
    }

    console.log('[WEBHOOK] Switch concluido. Resultado:', resultado ? 'definido' : 'undefined');
    
    // ================================================================
    // 6. ATUALIZAR AUDITORIA E LOG COM SUCESSO
    // ================================================================
    if (auditLogId) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: true,
          integration_id: payloadNormalizado.integrationId || null
        });
        console.log('[WEBHOOK] OK: Auditoria atualizada com sucesso');
      } catch (auditError) {
        console.error('[WEBHOOK] AVISO: Erro ao atualizar auditoria:', auditError);
      }
    }

    // Atualizar WebhookLog
    try {
      const logs = await base44.asServiceRole.entities.WebhookLog.filter(
        { 
          instance_id: instanceExtraido,
          timestamp: timestampRecebido
        },
        '-timestamp',
        1
      );

      if (logs.length > 0) {
        await base44.asServiceRole.entities.WebhookLog.update(logs[0].id, {
          processed: true,
          success: true
        });
        console.log('[WEBHOOK] OK: WebhookLog atualizado com sucesso');
      }
    } catch (logError) {
      console.error('[WEBHOOK] AVISO: Erro ao atualizar WebhookLog:', logError);
    }

    return resultado;

  } catch (error) {
    console.error('[WEBHOOK] ERRO FATAL:', error);
    console.error('[WEBHOOK] Stack:', error.stack);

    // Tentar atualizar auditoria mesmo com erro
    if (auditLogId) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: false,
          erro_detalhes: error.message
        });
      } catch (updateError) {
        console.error('[WEBHOOK] AVISO: Erro ao atualizar auditoria com erro:', updateError);
      }
    }

    // SEMPRE retornar 200 para evitar retry infinito da Evolution API
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers: corsHeaders }
    );
  }
});

/**
 * ================================================================
 * PROCESSADORES ESPECIFICOS POR TIPO DE EVENTO
 * ================================================================
 */

async function processarQRCodeUpdate(instance, payloadNormalizado, base44, corsHeaders) {
  console.log('[WEBHOOK] Processando atualizacao de QR Code');

  try {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);

    if (!integracao) {
      console.warn(`[WEBHOOK] ⚠️ Nenhuma integração encontrada para instância: ${instance}`);
      return Response.json(
        { success: true, warning: 'integration_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    await base44.entities.WhatsAppIntegration.update(integracao.id, {
      qr_code_url: payloadNormalizado.qrCodeUrl,
      status: 'pendente_qrcode',
      ultima_atividade: new Date().toISOString()
    });

    console.log('[WEBHOOK] OK: QR Code atualizado com sucesso');

    return Response.json(
      { success: true, processed: 'qrcode_updated' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ERRO ao processar QR Code:', error);
    throw error;
  }
}

async function processarConnectionUpdate(instance, payloadNormalizado, base44, corsHeaders) {
  console.log('[WEBHOOK] Processando atualizacao de conexao');

  try {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);

    if (!integracao) {
      console.warn(`[WEBHOOK] AVISO: Nenhuma integracao encontrada para instancia: ${instance}`);
      return Response.json(
        { success: true, warning: 'integration_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    await base44.entities.WhatsAppIntegration.update(integracao.id, {
      status: payloadNormalizado.status,
      ultima_atividade: new Date().toISOString()
    });

    console.log(`[WEBHOOK] OK: Status de conexao atualizado para: ${payloadNormalizado.status}`);

    return Response.json(
      { success: true, processed: 'connection_updated', status: payloadNormalizado.status },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ERRO ao processar conexao:', error);
    throw error;
  }
}

async function processarMensagemRecebida(instance, payloadNormalizado, base44, corsHeaders) {
  console.log('[WEBHOOK] Processando mensagem recebida (normalizada)');
  console.log('[WEBHOOK] Payload normalizado completo:', JSON.stringify(payloadNormalizado, null, 2));

  try {
    // Usar dados normalizados
    const numeroFormatado = payloadNormalizado.from;
    const conteudo = payloadNormalizado.content || '';
    const mediaType = payloadNormalizado.mediaType || 'none';
    const mediaUrl = payloadNormalizado.mediaTempUrl;
    const messageId = payloadNormalizado.messageId;
    const timestamp = payloadNormalizado.timestamp;
    const pushName = payloadNormalizado.pushName;

    console.log(`[WEBHOOK] Numero: ${numeroFormatado}`);
    console.log(`[WEBHOOK] Conteudo: ${conteudo.substring(0, 50)}...`);
    console.log(`[WEBHOOK] Tipo de midia: ${mediaType}`);
    console.log(`[WEBHOOK] Message ID: ${messageId}`);
    console.log(`[WEBHOOK] Timestamp: ${timestamp}`);

    // ================================================================
    // FLUXO TRANSACIONAL MANUAL (SEM SDK TRANSACTION)
    // ================================================================
    let contatoCriado = null;
    let threadCriada = null;
    let mensagemCriada = null;

    try {
      // PASSO 1: BUSCAR OU CRIAR CONTACT
      let contatos = await base44.asServiceRole.entities.Contact.filter({ telefone: numeroFormatado });
      let contato;

      if (contatos.length === 0) {
        console.log('[WEBHOOK] Criando novo contato');
        contato = await base44.asServiceRole.entities.Contact.create({
          nome: pushName || numeroFormatado,
          telefone: numeroFormatado,
          tipo_contato: 'lead',
          whatsapp_status: 'verificado',
          ultima_interacao: new Date().toISOString()
        });
        contatoCriado = contato;
        console.log(`[WEBHOOK] OK: Contato criado: ${contato.id}`);
      } else {
        contato = contatos[0];
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          ultima_interacao: new Date().toISOString()
        });
        console.log(`[WEBHOOK] OK: Contato existente: ${contato.nome}`);
      }

      // PASSO 2: BUSCAR WHATSAPP INTEGRATION (FUNCAO CENTRALIZADA)
      console.log(`[WEBHOOK] Buscando integracao para instance: "${instance}"`);

      const integracao = await buscarIntegracaoPorInstance(instance, base44);

      let integracaoId = null;
      if (integracao) {
        integracaoId = integracao.id;
        console.log(`[WEBHOOK] OK: WhatsAppIntegration encontrada:`, {
          id: integracaoId,
          nome: integracao.nome_instancia,
          numero: integracao.numero_telefone,
          instance_id_provider: integracao.instance_id_provider
        });

        console.log(`[WEBHOOK] DIAGNOSTICO - Comparacao:`, {
          instance_recebida: instance,
          instance_id_db: integracao.instance_id_provider,
          nome_instancia_db: integracao.nome_instancia,
          match_exato: instance === integracao.instance_id_provider,
          match_nome: instance === integracao.nome_instancia
        });
        
        // Atualizar estatísticas de recebimento
        const estatisticasAtualizadas = {
          ...(integracao.estatisticas || {}),
          total_mensagens_recebidas: (integracao.estatisticas?.total_mensagens_recebidas || 0) + 1
        };
        
        await base44.entities.WhatsAppIntegration.update(integracaoId, {
          estatisticas: estatisticasAtualizadas,
          ultima_atividade: new Date().toISOString(),
          status: 'conectado'
        });
      } else {
        console.warn(`[WEBHOOK] AVISO: Nenhuma WhatsAppIntegration encontrada para instancia: ${instance}`);
      }

      // PASSO 3: BUSCAR OU CRIAR THREAD
      let threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id });
      let thread;

      if (threads.length === 0) {
        console.log('[WEBHOOK] Criando nova thread');
        thread = await base44.asServiceRole.entities.MessageThread.create({
          contact_id: contato.id,
          whatsapp_integration_id: integracaoId,
          status: 'aberta',
          primeira_mensagem_at: new Date().toISOString(),
          ultima_atividade: new Date().toISOString(),
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          total_mensagens: 0,
          unread_count: 0
        });
        threadCriada = thread;
        console.log(`[WEBHOOK] OK: Thread criada: ${thread.id}`);
      } else {
        thread = threads[0];
        // Renovar janela 24h e atualizar integration_id se necessario
        const updateData = {
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          ultima_atividade: new Date().toISOString()
        };

        if (integracaoId && !thread.whatsapp_integration_id) {
          updateData.whatsapp_integration_id = integracaoId;
        }

        await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
        console.log(`[WEBHOOK] OK: Thread existente: ${thread.id}`);
      }

      // PASSO 3: PERSISTIR MIDIA (SE HOUVER)
      let mediaUrlPermanente = null;
      if (mediaType !== 'none' && mediaUrl) {
        console.log('[WEBHOOK] Baixando e persistindo midia...');
        mediaUrlPermanente = await baixarEPersistirMidia(mediaUrl, mediaType, base44);
      }

      // PASSO 3.5: VERIFICAR DUPLICIDADE (mesmo whatsapp_message_id)
      if (messageId) {
        const mensagensExistentes = await base44.asServiceRole.entities.Message.filter({
          whatsapp_message_id: messageId
        });

        if (mensagensExistentes.length > 0) {
          console.log(`[WEBHOOK] AVISO: DUPLICIDADE DETECTADA: Message ID ${messageId} ja existe - descartando`);
          return Response.json(
            {
              success: true,
              processed: 'duplicate_discarded',
              message_id: messageId,
              existing_message_id: mensagensExistentes[0].id
            },
            { status: 200, headers: corsHeaders }
          );
        }
      }

      // PASSO 4: CRIAR MESSAGE (USANDO DADOS NORMALIZADOS)
      console.log('[WEBHOOK] Criando message');
      const message = await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        content: conteudo,
        media_url: mediaUrlPermanente || mediaUrl,
        media_type: mediaType,
        channel: 'whatsapp',
        status: 'entregue',
        whatsapp_message_id: messageId,
        sent_at: new Date(timestamp).toISOString(),
        delivered_at: new Date().toISOString(),
        metadata: {
          whatsapp_integration_id: integracaoId
        }
      });
      mensagemCriada = message;
      console.log(`[WEBHOOK] OK: Message criada: ${message.id}`);



      // PASSO 5: ATUALIZAR THREAD
      console.log('[WEBHOOK] Atualizando thread');
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        last_message_content: conteudo.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1
      });
      console.log('[WEBHOOK] OK: Thread atualizada');

      // PASSO 6: CRIAR INTERACAO (SE CLIENTE ASSOCIADO)
      if (contato.cliente_id) {
        console.log('[WEBHOOK] Criando interacao');
        await base44.asServiceRole.entities.Interacao.create({
          cliente_id: contato.cliente_id,
          cliente_nome: contato.empresa || contato.nome,
          contact_id: contato.id,
          thread_id: thread.id,
          tipo_interacao: 'whatsapp',
          data_interacao: new Date().toISOString(),
          resultado: 'sucesso',
          observacoes: conteudo.substring(0, 500)
        });
        console.log('[WEBHOOK] OK: Interacao criada');
      }

      // PASSO 7: PROCESSAR COM IA (ASSINCRONO - NAO BLOQUEIA WEBHOOK)
      processarComIAAsync(thread, message, base44).catch(error => {
        console.error('[WEBHOOK] AVISO: Erro no processamento assincrono de IA:', error);
      });

      // PASSO 8: AUTO-ENFILEIRAR SE THREAD NAO ESTA ATRIBUIDA
      if (!thread.assigned_user_id) {
        const setor = thread.sector_id || 'geral';
        
        console.log('[WEBHOOK] Thread nao atribuida, enfileirando no setor:', setor);
        
        // Chamar função de enfileiramento de forma assíncrona (não bloqueia webhook)
        base44.functions.invoke('gerenciarFila', {
          action: 'enqueue',
          thread_id: thread.id,
          whatsapp_integration_id: integracaoId,
          setor: setor,
          prioridade: thread.prioridade || 'normal',
          metadata: {
            cliente_nome: contato.nome,
            cliente_telefone: contato.telefone
          }
        }).then(async result => {
          if (result.data.success && result.data.fila_entry) {
            console.log('[WEBHOOK] OK: Thread enfileirada com sucesso');
            
            // Atualizar thread com ID da fila
            try {
              await base44.entities.MessageThread.update(thread.id, {
                fila_atendimento_id: result.data.fila_entry.id,
                entrou_na_fila_em: result.data.fila_entry.entrou_em
              });
              console.log('[WEBHOOK] OK: Thread atualizada com fila_atendimento_id');
            } catch (updateError) {
              console.error('[WEBHOOK] AVISO: Erro ao atualizar thread com fila_id:', updateError);
            }
          } else {
            console.log('[WEBHOOK] INFO: Thread ja estava na fila ou erro ao enfileirar');
          }
        }).catch(error => {
          console.error('[WEBHOOK] AVISO: Erro ao enfileirar (nao critico):', error);
        });
      }

      console.log('[WEBHOOK] OK: Mensagem processada com sucesso');

      return Response.json(
        {
          success: true,
          processed: 'message_saved',
          contact_id: contato.id,
          thread_id: thread.id,
          message_id: message.id
        },
        { status: 200, headers: corsHeaders }
      );

    } catch (error) {
      // ROLLBACK MANUAL em caso de erro
      console.error('[WEBHOOK] ERRO no fluxo transacional:', error);

      if (mensagemCriada) {
        await base44.asServiceRole.entities.Message.delete(mensagemCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar mensagem no rollback:', e)
        );
      }

      if (threadCriada) {
        await base44.asServiceRole.entities.MessageThread.delete(threadCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar thread no rollback:', e)
        );
      }

      if (contatoCriado) {
        await base44.asServiceRole.entities.Contact.delete(contatoCriado.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar contato no rollback:', e)
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('[WEBHOOK] ERRO ao processar mensagem:', error);
    throw error;
  }
}

async function processarMensagemUpdate(payloadNormalizado, base44, corsHeaders) {
  console.log('[WEBHOOK] Processando atualizacao de status de mensagem');

  try {
    const messageId = payloadNormalizado.messageId;
    const statusZAPI = payloadNormalizado.status;

    if (!messageId) {
      console.warn('[WEBHOOK] AVISO: Message ID nao encontrado no update');
      return Response.json(
        { success: true, ignored: 'missing_message_id' },
        { status: 200, headers: corsHeaders }
      );
    }

    const mensagens = await base44.entities.Message.filter({
      whatsapp_message_id: messageId
    });

    if (mensagens.length === 0) {
      console.warn(`[WEBHOOK] AVISO: Mensagem nao encontrada: ${messageId}`);
      return Response.json(
        { success: true, ignored: 'message_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    const updates = {};

    if (statusZAPI === 'READ' || statusZAPI === 'read') {
      updates.status = 'lida';
      updates.read_at = new Date().toISOString();
    } else if (statusZAPI === 'DELIVERY_ACK' || statusZAPI === 'delivered') {
      updates.status = 'entregue';
      updates.delivered_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      await base44.entities.Message.update(mensagens[0].id, updates);
      console.log(`[WEBHOOK] OK: Status da mensagem atualizado: ${updates.status}`);
    }

    return Response.json(
      { success: true, processed: 'message_status_updated' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ERRO ao processar update:', error);
    throw error;
  }
}

/**
 * ================================================================
 * FUNCOES AUXILIARES
 * ================================================================
 */

/**
 * Busca integracao por instance - PRIORIZA instance_id_provider
 */
async function buscarIntegracaoPorInstance(instance, base44) {
  if (!instance) {
    console.log('[WEBHOOK] AVISO: Nenhuma instance fornecida para busca');
    return null;
  }
  
  console.log(`[WEBHOOK] Iniciando busca de integracao para: "${instance}"`);
  
  // Listar TODAS as integracoes para diagnostico
  const todasIntegracoes = await base44.entities.WhatsAppIntegration.list();
  console.log(`[WEBHOOK] Total de integracoes cadastradas: ${todasIntegracoes.length}`);
  todasIntegracoes.forEach((int, idx) => {
    console.log(`[WEBHOOK]   ${idx + 1}. ${int.nome_instancia} | instance_id: "${int.instance_id_provider}" | tel: ${int.numero_telefone}`);
  });
  
  // PRIORIDADE 1: Buscar por instance_id_provider (mais confiável)
  let integracoes = await base44.entities.WhatsAppIntegration.filter({
    instance_id_provider: instance
  });
  
  if (integracoes.length > 0) {
    console.log(`[WEBHOOK] OK: Integracao encontrada por instance_id_provider: ${integracoes[0].nome_instancia}`);
    return integracoes[0];
  }
  
  console.log('[WEBHOOK] AVISO: Nenhuma integracao encontrada por instance_id_provider');
  
  // FALLBACK: Buscar por nome_instancia
  integracoes = await base44.entities.WhatsAppIntegration.filter({
    nome_instancia: instance
  });
  
  if (integracoes.length > 0) {
    console.log(`[WEBHOOK] OK: Integracao encontrada por nome_instancia: ${integracoes[0].nome_instancia}`);
    return integracoes[0];
  }
  
  console.log('[WEBHOOK] ERRO: NENHUMA INTEGRACAO ENCONTRADA para instance:', instance);
  return null;
}

async function baixarEPersistirMidia(mediaUrl, mediaType, base44) {
  try {
    console.log(`[MIDIA] Baixando ${mediaType} de:`, mediaUrl.substring(0, 50) + '...');

    // Download da mídia
    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const extensao = getExtensaoPorTipo(mediaType);
    const fileName = `whatsapp_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

    // Upload para storage permanente
    const file = new File([blob], fileName, { type: blob.type });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    console.log('[MIDIA] OK: Midia persistida:', file_url);

    return file_url;

  } catch (error) {
    console.error('[MIDIA] ERRO ao persistir midia:', error);
    // Retornar null em vez de quebrar o fluxo
    return null;
  }
}

function getExtensaoPorTipo(mediaType) {
  const map = {
    'image': 'jpg',
    'video': 'mp4',
    'audio': 'ogg',
    'document': 'pdf',
    'sticker': 'webp'
  };
  return map[mediaType] || 'bin';
}

async function processarComIAAsync(thread, message, base44) {
  try {
    console.log('[IA] Processando mensagem com IA (assincrono)');

    // Carregar últimas 10 mensagens
    const messages = await base44.entities.Message.filter({
      thread_id: thread.id
    }, '-sent_at', 10);

    const contexto = messages.map(m => `${m.sender_type === 'user' ? 'Vendedor' : 'Cliente'}: ${m.content}`).join('\n');

    // Gerar sugestões com LLM
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analise esta conversa de WhatsApp e gere 3 sugestões de resposta profissionais, empáticas e diretas:

${contexto}

Última mensagem do cliente: ${message.content}

Gere 3 sugestões práticas que o vendedor possa usar imediatamente.`,
      response_json_schema: {
        type: "object",
        properties: {
          sugestoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                texto: { type: "string" },
                tom: { type: "string" },
                objetivo: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Salvar sugestões na thread
    await base44.entities.MessageThread.update(thread.id, {
      sugestoes_ia_prontas: response.sugestoes || [],
      ultima_analise_ia: new Date().toISOString()
    });

    console.log('[IA] OK: Sugestoes geradas e salvas');

  } catch (error) {
    console.error('[IA] ERRO no processamento com IA:', error);
    // Não lançar erro para não quebrar o webhook
  }
}