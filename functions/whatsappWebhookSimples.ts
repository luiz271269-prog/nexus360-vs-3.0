// WEBHOOK SIMPLIFICADO - ANÁLISE COMPARATIVA Z-API
// Este webhook recebe os mesmos payloads que o webhookWatsZapi
// para comparação de como cada um processa mensagens da Z-API

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const VERSION = 'v1.1.0-ZAPI-SIMPLE';
const BUILD_DATE = '2025-01-22';
const DEPLOYED_AT = new Date().toISOString();

console.log('=============================================================');
console.log('    WEBHOOK SIMPLES Z-API - STARTUP                         ');
console.log('=============================================================');
console.log('VERSION:', VERSION);
console.log('BUILD DATE:', BUILD_DATE);
console.log('DEPLOYED AT:', DEPLOYED_AT);
console.log('PURPOSE: Análise paralela de payloads Z-API');
console.log('=============================================================');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('[' + VERSION + '] ========== NOVA REQUISIÇÃO ==========');
  console.log('[' + VERSION + '] Timestamp:', new Date().toISOString());

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // HEALTH CHECK com info de versão
  if (req.method === 'GET') {
    console.log('[' + VERSION + '] Health check OK');
    return Response.json({ 
      version: VERSION,
      build_date: BUILD_DATE,
      deployed_at: DEPLOYED_AT,
      status: 'operational',
      uptime_seconds: Math.floor((Date.now() - new Date(DEPLOYED_AT).getTime()) / 1000),
      timestamp: new Date().toISOString(),
      purpose: 'Webhook simplificado para análise de payloads Z-API'
    }, { status: 200, headers: corsHeaders });
  }

  let base44;
  let auditLogId = null;

  try {
    base44 = createClientFromRequest(req);
    console.log('[' + VERSION + '] SDK inicializado');

    // LER PAYLOAD BRUTO
    const rawBody = await req.text();
    console.log('[' + VERSION + '] Payload recebido:', rawBody.length, 'bytes');
    
    if (!rawBody || rawBody.trim() === '') {
      console.warn('[' + VERSION + '] ⚠️ Payload vazio recebido');
      return Response.json({
        success: false,
        error: 'Empty payload',
        version: VERSION
      }, { status: 200, headers: corsHeaders });
    }

    const payload = JSON.parse(rawBody);
    console.log('[' + VERSION + '] ✅ JSON parseado com sucesso');
    console.log('[' + VERSION + '] Payload keys:', Object.keys(payload).join(', '));

    // EXTRAIR DADOS DIRETOS DO PAYLOAD Z-API
    const instanceId = payload.instance || payload.instanceId || payload.instance_id || 'unknown';
    const evento = payload.event || payload.type || 'unknown';
    const messageId = payload.messageId || null;
    const telefone = payload.phone || payload.telefone || null;
    const textoMensagem = payload.text?.message || null;
    const nomeRemetente = payload.senderName || payload.chatName || null;

    console.log('[' + VERSION + '] ===== DADOS EXTRAÍDOS =====');
    console.log('[' + VERSION + '] Instance ID:', instanceId);
    console.log('[' + VERSION + '] Evento:', evento);
    console.log('[' + VERSION + '] Message ID:', messageId);
    console.log('[' + VERSION + '] Telefone:', telefone);
    console.log('[' + VERSION + '] Texto:', textoMensagem ? textoMensagem.substring(0, 50) : 'null');
    console.log('[' + VERSION + '] Nome Remetente:', nomeRemetente);
    console.log('[' + VERSION + '] =========================');

    // SALVAR NO AUDIT LOG COM TAG ESPECIAL
    try {
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: instanceId + '-SIMPLES',
        evento: evento + '-SIMPLES',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: true,
        integration_id: null
      });
      auditLogId = auditLog.id;
      console.log('[' + VERSION + '] ✅ Audit log criado:', auditLogId);
    } catch (err) {
      console.error('[' + VERSION + '] ❌ Falha ao salvar audit log:', err.message);
    }

    // TENTAR PROCESSAR MENSAGEM SE FOR ReceivedCallback
    let processingDetails = null;
    if (evento === 'ReceivedCallback' && telefone && messageId) {
      console.log('[' + VERSION + '] 📨 Tentando processar mensagem...');
      
      try {
        // Buscar ou criar contato
        let contato;
        const contatosExistentes = await base44.asServiceRole.entities.Contact.filter({ 
          telefone: telefone 
        });
        
        if (contatosExistentes.length > 0) {
          contato = contatosExistentes[0];
          console.log('[' + VERSION + '] ✅ Contato encontrado:', contato.id);
        } else {
          contato = await base44.asServiceRole.entities.Contact.create({
            nome: nomeRemetente || telefone,
            telefone: telefone,
            tipo_contato: 'lead',
            whatsapp_status: 'verificado',
            ultima_interacao: new Date().toISOString()
          });
          console.log('[' + VERSION + '] ✅ Contato criado:', contato.id);
        }

        // Buscar integração
        let integracaoId = null;
        if (instanceId !== 'unknown') {
          const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
            instance_id_provider: instanceId 
          });
          if (integracoes.length > 0) {
            integracaoId = integracoes[0].id;
            console.log('[' + VERSION + '] ✅ Integração encontrada:', integracaoId);
          } else {
            console.warn('[' + VERSION + '] ⚠️ Integração não encontrada para instance:', instanceId);
          }
        }

        // Buscar ou criar thread
        let thread;
        const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({ 
          contact_id: contato.id 
        });
        
        if (threadsExistentes.length > 0) {
          thread = threadsExistentes[0];
          console.log('[' + VERSION + '] ✅ Thread encontrada:', thread.id);
          
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            last_message_at: new Date().toISOString(),
            last_message_sender: 'contact',
            last_message_content: textoMensagem ? textoMensagem.substring(0, 100) : '[Sem conteúdo]',
            unread_count: (thread.unread_count || 0) + 1,
            total_mensagens: (thread.total_mensagens || 0) + 1
          });
        } else {
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            whatsapp_integration_id: integracaoId,
            status: 'aberta',
            primeira_mensagem_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            last_message_sender: 'contact',
            last_message_content: textoMensagem ? textoMensagem.substring(0, 100) : '[Sem conteúdo]',
            total_mensagens: 1,
            unread_count: 1
          });
          console.log('[' + VERSION + '] ✅ Thread criada:', thread.id);
        }

        // Verificar duplicidade
        const mensagensExistentes = await base44.asServiceRole.entities.Message.filter({ 
          whatsapp_message_id: messageId 
        });
        
        if (mensagensExistentes.length > 0) {
          console.log('[' + VERSION + '] ⚠️ DUPLICADA detectada:', messageId);
          processingDetails = {
            status: 'duplicate',
            message_id: messageId,
            existing_count: mensagensExistentes.length
          };
        } else {
          // Criar mensagem
          const mensagem = await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: contato.id,
            sender_type: 'contact',
            content: textoMensagem || '[Sem conteúdo]',
            media_url: null,
            media_type: 'none',
            channel: 'whatsapp',
            status: 'recebida',
            whatsapp_message_id: messageId,
            sent_at: new Date().toISOString(),
            metadata: { 
              whatsapp_integration_id: integracaoId,
              processed_by: 'whatsappWebhookSimples',
              version: VERSION
            }
          });
          console.log('[' + VERSION + '] ✅ Mensagem criada:', mensagem.id);
          
          processingDetails = {
            status: 'success',
            message_id: mensagem.id,
            contact_id: contato.id,
            thread_id: thread.id
          };
        }
      } catch (msgErr) {
        console.error('[' + VERSION + '] ❌ Erro ao processar mensagem:', msgErr.message);
        processingDetails = {
          status: 'error',
          error: msgErr.message
        };
      }
    }

    const duration = Date.now() - startTime;
    console.log('[' + VERSION + '] ⏱️ Processamento concluído em', duration, 'ms');

    return Response.json({ 
      success: true,
      version: VERSION,
      processed: {
        instance_id: instanceId,
        evento: evento,
        message_id: messageId,
        telefone: telefone,
        audit_log_id: auditLogId,
        processing_details: processingDetails
      },
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[' + VERSION + '] ❌ ERRO FATAL:', error.message);
    console.error('[' + VERSION + '] Stack:', error.stack);
    
    if (auditLogId && base44) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: false,
          erro_detalhes: error.message
        });
      } catch (e) {
        console.error('[' + VERSION + '] Falha ao atualizar audit log com erro');
      }
    }

    return Response.json({
      success: false,
      error: error.message,
      version: VERSION,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: corsHeaders });
  }
});