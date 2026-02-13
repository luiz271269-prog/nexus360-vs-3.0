import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 📄 ENVIO UNIFICADO DE DOCUMENTOS (PDF, DOCX, XLSX, etc.)
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * CONTRATO UNIVERSAL:
 * - W-API: POST /v1/message/send-document?instanceId=XXX
 * - Z-API: POST /instances/{instance}/token/{token}/send-document
 * 
 * SIMETRIA TOTAL:
 * - Mesmo payload: { phone, url, caption, fileName }
 * - Mesma validação de URL
 * - Mesmo metadata.midia_persistida
 * - Mesma auditoria
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const VERSION = 'v1.0.0-UNIFIED';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method === 'GET') {
    return Response.json({
      version: VERSION,
      status: 'ok',
      description: 'Envio unificado de documentos (PDF, DOCX, XLSX) via W-API ou Z-API'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      integration_id,
      phone,
      document_url,
      caption = '',
      filename = 'documento.pdf',
      thread_id = null,
      contact_id = null
    } = await req.json();

    // ✅ VALIDAÇÃO
    if (!integration_id || !phone || !document_url) {
      return Response.json({
        success: false,
        error: 'Parâmetros obrigatórios: integration_id, phone, document_url'
      }, { status: 400 });
    }

    // ✅ BUSCAR INTEGRAÇÃO
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) {
      return Response.json({
        success: false,
        error: 'Integração não encontrada'
      }, { status: 404 });
    }

    const provider = integracao.api_provider; // 'w_api' ou 'z_api'
    const numeroFormatado = phone.replace(/\D/g, '');

    console.log(`[sendDocument] 📄 Enviando documento via ${provider.toUpperCase()}`);
    console.log(`[sendDocument] Para: ${numeroFormatado} | Arquivo: ${filename}`);

    let url, headers, payload, responseData;

    // ═══════════════════════════════════════════════════════════════════
    // 🔀 DISPATCH POR PROVIDER
    // ═══════════════════════════════════════════════════════════════════
    if (provider === 'w_api') {
      // W-API: /v1/message/send-document?instanceId=XXX
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;
      
      url = `https://api.w-api.app/v1/message/send-document?instanceId=${instanceId}`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      payload = {
        phone: numeroFormatado,
        url: document_url,
        caption: caption,
        fileName: filename,
        delayMessage: 1
      };

    } else if (provider === 'z_api') {
      // Z-API: /instances/{instance}/token/{token}/send-document
      const baseUrl = integracao.base_url_provider?.replace(/\/$/, '') || 'https://api.z-api.io';
      const instanceId = integracao.instance_id_provider;
      const token = integracao.api_key_provider;
      
      url = `${baseUrl}/instances/${instanceId}/token/${token}/send-document`;
      headers = {
        'Content-Type': 'application/json',
        'Client-Token': integracao.security_client_token_header
      };
      payload = {
        phone: numeroFormatado,
        url: document_url,
        caption: caption,
        fileName: filename
      };

    } else {
      return Response.json({
        success: false,
        error: `Provider não suportado: ${provider}`
      }, { status: 400 });
    }

    console.log(`[sendDocument] 🚀 URL: ${url}`);
    console.log(`[sendDocument] 📦 Payload:`, JSON.stringify(payload).substring(0, 200));

    // ✅ ENVIAR DOCUMENTO
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[sendDocument] ❌ Erro ${provider.toUpperCase()}:`, errorData);
      
      return Response.json({
        success: false,
        error: errorData.message || errorData.error || `HTTP ${response.status}`,
        provider: provider
      }, { status: response.status });
    }

    responseData = await response.json();
    console.log(`[sendDocument] ✅ Enviado com sucesso:`, responseData);

    // ✅ SALVAR MESSAGE NA BASE (se tiver thread/contact)
    let message_id = null;
    if (thread_id || contact_id) {
      try {
        const message = await base44.asServiceRole.entities.Message.create({
          thread_id: thread_id,
          sender_id: user.id,
          sender_type: 'user',
          recipient_id: contact_id,
          recipient_type: 'contact',
          content: caption || `📄 [Documento: ${filename}]`,
          media_url: document_url,
          media_type: 'document',
          media_caption: caption || null,
          channel: 'whatsapp',
          status: 'enviada',
          whatsapp_message_id: responseData.messageId || responseData.key?.id,
          sent_at: new Date().toISOString(),
          metadata: {
            analise_multimodal: null,
            midia_persistida: true,
            deleted: null,
            whatsapp_integration_id: integration_id,
            instance_id: integracao.instance_id_provider,
            canal_nome: integracao.nome_instancia,
            canal_numero: integracao.numero_telefone,
            processed_by: VERSION,
            provider: provider,
            fileName: filename
          }
        });

        message_id = message.id;
        console.log(`[sendDocument] 💾 Message salva: ${message_id}`);

        // ✅ ATUALIZAR THREAD
        if (thread_id) {
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            last_message_at: new Date().toISOString(),
            last_outbound_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_message_content: caption || `📄 [Documento: ${filename}]`,
            last_media_type: 'document',
            total_mensagens: (await base44.asServiceRole.entities.MessageThread.get(thread_id))?.total_mensagens + 1 || 1
          });
        }

      } catch (dbError) {
        console.warn(`[sendDocument] ⚠️ Erro ao salvar na base:`, dbError.message);
        // Não falhar se o envio funcionou
      }
    }

    return Response.json({
      success: true,
      messageId: responseData.messageId || responseData.key?.id,
      message_id: message_id,
      provider: provider,
      fileName: filename,
      providerResponse: responseData
    });

  } catch (error) {
    console.error('[sendDocument] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});