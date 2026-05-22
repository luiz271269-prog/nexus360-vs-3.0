import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Atualiza last_attention_given_at para o contato.
 * 
 * Chamado em 3 lugares:
 * 1. Quando operador envia mensagem
 * 2. Quando operador altera etiquetas
 * 3. Quando operador clica "✓ Atendi"
 * 
 * CORREÇÃO FORENSE (2026-05-22):
 * - SDK alinhado para 0.8.25 (igual aos webhooks) — evita 403 silencioso
 * - auth.me() agora é OPCIONAL: se token expirou (fire-and-forget após mensagem
 *   outbound), seguimos via asServiceRole. Antes, falha de auth.me() retornava 401
 *   e o SDK ainda chamava Contact.update user-scoped → 403 no painel de logs.
 * - Contact.update agora usa asServiceRole — não depende do token do request.
 * 
 * Esta é a ÚNICA responsabilidade desta função.
 * Sem side-effects, sem análises, sem mudanças em outros campos.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // auth.me() opcional — se token expirou em fire-and-forget, seguimos como service role.
    // Mantemos a chamada para auditoria (saber QUEM disparou quando possível).
    const user = await base44.auth.me().catch(() => null);

    const { contactId, tipoAcao = 'manual' } = await req.json();

    if (!contactId) {
      return Response.json(
        { error: 'contactId é obrigatório' },
        { status: 400 }
      );
    }

    // ─── Atualizar contact via service role (não depende de token do request) ───
    const agora = new Date().toISOString();

    await base44.asServiceRole.entities.Contact.update(contactId, {
      last_attention_given_at: agora,
    });

    return Response.json({
      success: true,
      contactId,
      last_attention_given_at: agora,
      tipoAcao,
      authenticated_user: user?.email || null,
    });
  } catch (error) {
    console.error('[atualizarAttentionGiven] Erro:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});