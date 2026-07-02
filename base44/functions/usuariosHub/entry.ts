import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * usuariosHub — Diretório Central de Usuários do Nexus360
 *
 * Endpoint consultado pelos apps satélites (Neural Fin, Compras, RH, Site)
 * para obter a lista de usuários com celular particular e preferências de
 * notificação. O cadastro é feito UMA vez aqui no Nexus360 e replicado
 * automaticamente — os satélites nunca mantêm cadastro próprio.
 *
 * Autenticação: mesmo token compartilhado do hub (NEXUS_HUB_TOKEN)
 *   - Header 'x-hub-token: <token>'  OU  query '?token=<token>'
 *
 * Uso nos satélites:
 *   GET  <URL>/functions/usuariosHub               → todos os usuários
 *   GET  <URL>/functions/usuariosHub?email=x@y.com → um usuário específico
 *
 * Retorna apenas os campos necessários para notificação (sem dados sensíveis).
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const HUB_TOKEN = Deno.env.get('NEXUS_HUB_TOKEN');
    if (!HUB_TOKEN) {
      return Response.json({ success: false, error: 'NEXUS_HUB_TOKEN não configurado' }, { status: 500 });
    }
    const url = new URL(req.url);
    const tokenRecebido = req.headers.get('x-hub-token') || url.searchParams.get('token');
    if (tokenRecebido !== HUB_TOKEN) {
      return Response.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Filtro opcional por e-mail (também aceito via POST body)
    let emailFiltro = url.searchParams.get('email');
    if (!emailFiltro && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      emailFiltro = body.email || null;
    }

    const todos = await base44.asServiceRole.entities.User.list();

    // Verifica se o usuário tem devices ativos para push (para o satélite saber o canal disponível)
    const devices = await base44.asServiceRole.entities.UserDevice.filter({ is_active: true });
    const usuariosComDevice = new Set(devices.map((d) => d.user_id));

    let usuarios = (todos || []).map((u) => {
      const config = u.notificacoes_config || {};
      return {
        id: u.id,
        email: (u.email || '').toLowerCase(),
        full_name: u.full_name || '',
        role: u.role,
        telefone_particular: u.telefone_particular || null,
        setor: u.attendant_sector || 'geral',
        recebe_push: config.receber_push !== false,
        recebe_whatsapp: config.receber_whatsapp === true,
        tem_device_push: usuariosComDevice.has(u.id),
        canais_disponiveis: [
          ...(config.receber_push !== false && usuariosComDevice.has(u.id) ? ['push'] : []),
          ...(u.telefone_particular ? ['whatsapp'] : [])
        ]
      };
    });

    if (emailFiltro) {
      const alvo = String(emailFiltro).trim().toLowerCase();
      usuarios = usuarios.filter((u) => u.email === alvo);
      if (usuarios.length === 0) {
        return Response.json({ success: false, error: `Usuário não encontrado: ${alvo}` }, { status: 404 });
      }
    }

    return Response.json({
      success: true,
      total: usuarios.length,
      atualizado_em: new Date().toISOString(),
      usuarios
    });
  } catch (error) {
    console.error('[usuariosHub] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});