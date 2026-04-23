import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * getExternalMessages — busca mensagens de uma thread externa (WhatsApp) respeitando
 * as whatsapp_permissions configuradas pelo admin no Gerenciamento de Usuários.
 *
 * Autorização (qualquer uma basta):
 *  1. role === 'admin'
 *  2. thread.assigned_user_id === user.id
 *  3. thread.shared_with_users inclui user.id
 *  4. contact.atendente_fidelizado_{vendas|assistencia|financeiro|fornecedor} === user.id
 *  5. user.whatsapp_permissions tem can_view=true para thread.whatsapp_integration_id
 */

const SETORES_FIDELIZACAO = ['vendas', 'assistencia', 'financeiro', 'fornecedor'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, before_sent_at = null, limit = 20 } = await req.json();
    if (!thread_id) {
      return Response.json({ success: false, error: 'thread_id é obrigatório' }, { status: 400 });
    }

    // 1) Carrega thread via service role (pra ter acesso a permissões + fidelização)
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    if (!thread) {
      return Response.json({ success: false, error: 'Thread não encontrada' }, { status: 404 });
    }

    // 2) Autorização — admin bypassa tudo
    let autorizado = user.role === 'admin';

    // 2a) Responsável da thread
    if (!autorizado && thread.assigned_user_id === user.id) {
      autorizado = true;
    }

    // 2b) Compartilhamento explícito
    if (!autorizado && Array.isArray(thread.shared_with_users) && thread.shared_with_users.includes(user.id)) {
      autorizado = true;
    }

    // 2c) Fidelização ao contato
    if (!autorizado && thread.contact_id) {
      try {
        const contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
        if (contato) {
          for (const setor of SETORES_FIDELIZACAO) {
            if (contato[`atendente_fidelizado_${setor}`] === user.id) {
              autorizado = true;
              break;
            }
          }
        }
      } catch (_) { /* contato pode não existir — segue validação */ }
    }

    // 2d) whatsapp_permissions com can_view=true para a integração da thread
    if (!autorizado && thread.whatsapp_integration_id) {
      const perms = Array.isArray(user.whatsapp_permissions) ? user.whatsapp_permissions : [];
      const perm = perms.find(p => p.integration_id === thread.whatsapp_integration_id);
      if (perm?.can_view === true) {
        autorizado = true;
      }
    }

    if (!autorizado) {
      return Response.json({ success: false, error: 'forbidden', messages: [] }, { status: 403 });
    }

    // 3) Busca mensagens com service role (bypass RLS) já que a autorização foi validada
    const filtro = { thread_id };
    if (before_sent_at) {
      filtro.created_date = { $lt: before_sent_at };
    }

    const messages = await base44.asServiceRole.entities.Message.filter(
      filtro,
      '-created_date',
      limit
    );

    return Response.json({ success: true, messages });
  } catch (error) {
    console.error('[getExternalMessages] erro:', error?.message || error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});