import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { processInboundEvent } from './lib/inboundCore.js';

// ============================================================================
// PROCESS INBOUND - Edge Function Separada para Lógica de Negócio
// ============================================================================
// PROPÓSITO:
// - Isola a lógica de automação/IA do webhook (se travar, webhook continua)
// - Permite timeout maior para processamento de IA
// - Resolve problema de dynamic import com import estático
// ============================================================================

const VERSION = 'v1.0.0';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  console.log('[CORE-WORKER] 📥 REQUEST recebido');

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      version: VERSION, 
      status: 'ready',
      description: 'Processa lógica de negócio para mensagens inbound (Core isolado)'
    }, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { message, contact, thread, integration, provider, messageContent } = payload;

    if (!message || !contact || !thread) {
      return Response.json({ 
        success: false, 
        error: 'message, contact e thread são obrigatórios' 
      }, { status: 400, headers: corsHeaders });
    }

    console.log(`[CORE-WORKER] 🧠 Processando mensagem: ${message.id} | Provider: ${provider || 'unknown'}`);

    // Criar cliente Base44 (service role para automações)
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.error('[CORE-WORKER] ❌ Erro ao criar cliente Base44:', e.message);
      return Response.json({ 
        success: false, 
        error: 'Falha na autenticação' 
      }, { status: 500, headers: corsHeaders });
    }

    // Buscar integração completa se só veio o ID
    let integracaoCompleta = integration;
    if (integration?.id && !integration.api_provider) {
      try {
        integracaoCompleta = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration.id);
      } catch (e) {
        console.warn('[CORE-WORKER] ⚠️ Não foi possível buscar integração completa:', e.message);
      }
    }

    // Executar pipeline de processamento
    const resultado = await processInboundEvent({
      base44,
      contact,
      thread,
      message,
      integration: integracaoCompleta,
      provider: provider || 'unknown',
      messageContent: messageContent || message.content
    });

    console.log('[CORE-WORKER] ✅ Pipeline concluído:', JSON.stringify(resultado).substring(0, 200));

    return Response.json({
      success: true,
      result: resultado,
      message_id: message.id,
      version: VERSION
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[CORE-WORKER] ❌ ERRO FATAL:', error.message);
    console.error('[CORE-WORKER] ❌ Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers: corsHeaders });
  }
});