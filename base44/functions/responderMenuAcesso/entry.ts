import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// RESPONDER MENU ACESSO — REDIRECIONADOR (DEPRECATED)
// ============================================================================
// A lógica do submenu foi UNIFICADA em enviarCartaoAcesso (acao:'submenu').
// Esta função permanece apenas como redirecionador para qualquer chamada legada
// que ainda aponte para 'responderMenuAcesso'. Toda decisão e envio vive na
// fonte única enviarCartaoAcesso.
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const isAutomacao = !!body?.event;
    const msg = isAutomacao ? body.data : body;

    // Só mensagens REAIS do contato (mesmo guard de antes)
    if (isAutomacao && msg?.sender_type !== 'contact') {
      return Response.json({ success: true, skipped: 'nao_eh_mensagem_do_contato' });
    }

    const resposta = body?.resposta || body?.content || body?.data?.content || msg?.content || '';
    const threadId = body?.thread_id || msg?.thread_id;
    if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

    const r = await base44.asServiceRole.functions.invoke('enviarCartaoAcesso', {
      acao: 'submenu',
      thread_id: threadId,
      contact_id: body?.contact_id || msg?.sender_id || null,
      integration_id: body?.integration_id || null,
      resposta
    });
    return Response.json(r?.data || { success: true, redirected: true });
  } catch (error) {
    console.error('[responderMenuAcesso] ❌', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});