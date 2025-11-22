// WEBHOOK SIMPLIFICADO 

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const VERSION = 'v1.0.0-SIMPLE';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  console.log('[' + VERSION + '] REQUEST RECEIVED');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      version: VERSION,
      status: 'operational',
      timestamp: new Date().toISOString()
    }, { status: 200, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('[' + VERSION + '] Payload keys:', Object.keys(payload).join(', '));

    // APENAS REGISTRAR NO AUDIT LOG
    try {
      await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: payload,
        instance_identificado: payload.instance || payload.instanceId || 'unknown',
        evento: payload.event || payload.type || 'unknown',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: true
      });
    } catch (err) {
      console.error('[' + VERSION + '] Failed to save audit log:', err.message);
    }

    return Response.json({ 
      success: true,
      version: VERSION,
      message: 'Payload received and logged'
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[' + VERSION + '] ERROR:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 500, headers: corsHeaders });
  }
});