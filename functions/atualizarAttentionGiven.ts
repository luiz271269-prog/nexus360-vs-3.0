import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Atualiza last_attention_given_at para o contato.
 * 
 * Chamado em 3 lugares:
 * 1. Quando operador envia mensagem
 * 2. Quando operador altera etiquetas
 * 3. Quando operador clica "✓ Atendi"
 * 
 * Esta é a ÚNICA responsabilidade desta função.
 * Sem side-effects, sem análises, sem mudanças em outros campos.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId, tipoAcao = 'manual' } = await req.json();

    if (!contactId) {
      return Response.json(
        { error: 'contactId é obrigatório' },
        { status: 400 }
      );
    }

    // ─── Atualizar contact ──────────────────────────────────────────
    const agora = new Date().toISOString();

    await base44.entities.Contact.update(contactId, {
      last_attention_given_at: agora,
    });

    return Response.json({
      success: true,
      contactId,
      last_attention_given_at: agora,
      tipoAcao,
    });
  } catch (error) {
    console.error('[atualizarAttentionGiven] Erro:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});