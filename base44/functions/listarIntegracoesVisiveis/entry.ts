import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// LISTAR INTEGRAÇÕES VISÍVEIS — contorna o RLS admin-only de WhatsAppIntegration
// ============================================================================
// A entidade WhatsAppIntegration tem RLS read=admin. Por isso, usuários não-admin
// recebem lista VAZIA ao chamar .list() direto do frontend, e o seletor "Enviar por"
// fica sem instâncias. Esta função usa service role para ler todas as integrações
// e devolve apenas as que o usuário tem permissão de visualizar.
// ============================================================================

const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Service role para ignorar o RLS admin-only na LEITURA
    const todasIntegracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list('-created_date', 100);

    // Admin enxerga tudo
    if (user.role === 'admin') {
      return Response.json({ success: true, integracoes: todasIntegracoes });
    }

    const whatsappPerms = Array.isArray(user.whatsapp_permissions) ? user.whatsapp_permissions : [];
    const perms = user.permissoes_visualizacao || {};
    const integracoesVisiveis = Array.isArray(perms.integracoes_visiveis) ? perms.integracoes_visiveis : [];

    // 1) whatsapp_permissions com can_view: true → usa APENAS essas
    const idsComPermissao = whatsappPerms
      .filter((wp) => wp.can_view === true)
      .map((wp) => wp.integration_id);

    if (idsComPermissao.length > 0) {
      const permNorm = new Set(idsComPermissao.map(normalizar));
      const visiveis = todasIntegracoes.filter((i) => permNorm.has(normalizar(i.id)));
      return Response.json({ success: true, integracoes: visiveis });
    }

    // 2) Fallback: permissoes_visualizacao.integracoes_visiveis
    if (integracoesVisiveis.length > 0) {
      const visNorm = new Set(integracoesVisiveis.map(normalizar));
      const visiveis = todasIntegracoes.filter((i) => visNorm.has(normalizar(i.id)));
      return Response.json({ success: true, integracoes: visiveis });
    }

    // 3) Sem configuração → mostra todas (comportamento legado)
    return Response.json({ success: true, integracoes: todasIntegracoes });

  } catch (error) {
    console.error('[listarIntegracoesVisiveis] ❌', error.message);
    return Response.json({ success: false, error: error.message, integracoes: [] }, { status: 500 });
  }
});