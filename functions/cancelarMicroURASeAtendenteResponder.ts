import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// CANCELADOR DE MICRO-URA - Proteção automática
// ============================================================================
// Se o atendente atual responder enquanto há pedido de transferência pendente,
// cancela automaticamente a micro-URA (não faz sentido continuar perguntando)
// ============================================================================

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({ success: false, error: 'JSON inválido' }, { status: 400, headers: corsHeaders });
  }

  const { thread_id, sender_id } = payload;

  if (!thread_id || !sender_id) {
    return Response.json({ success: false, error: 'thread_id e sender_id obrigatórios' }, { headers: corsHeaders });
  }

  try {
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    
    if (!thread) {
      return Response.json({ success: false, error: 'thread_nao_encontrada' }, { headers: corsHeaders });
    }

    // Verificar se há pedido pendente E se quem está respondendo é o atendente atual
    if (thread.transfer_pending && thread.assigned_user_id === sender_id) {
      console.log('[CANCELADOR] 🛡️ Atendente atual respondeu - cancelando micro-URA');
      
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        transfer_pending: false,
        transfer_requested_sector_id: null,
        transfer_requested_user_id: null,
        transfer_requested_text: null,
        transfer_confirmed: false,
        transfer_expires_at: null
      });
      
      return Response.json({ 
        success: true, 
        cancelled: true, 
        reason: 'atendente_respondeu' 
      }, { headers: corsHeaders });
    }

    return Response.json({ success: true, cancelled: false }, { headers: corsHeaders });

  } catch (error) {
    console.error('[CANCELADOR] Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});