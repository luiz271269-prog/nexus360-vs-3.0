import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * sincronizarUsuariosSatelites — Replicação automática de usuários
 *
 * Envia (push) a lista de usuários do Nexus360 — com celular particular e
 * preferências de notificação — para todos os apps satélites cadastrados.
 *
 * Satélites são cadastrados na ConfiguracaoSistema chave='satelites_sync_usuarios':
 *   valor: { satelites: [{ nome, url, ativo }] }
 *   - url = endpoint da função receptora no satélite (ex: .../functions/receberUsuariosNexus)
 *   - autenticação: header 'x-hub-token' com o NEXUS_HUB_TOKEN compartilhado
 *
 * Disparos: automação de entidade User (create/update) + agendamento diário.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const HUB_TOKEN = Deno.env.get('NEXUS_HUB_TOKEN');
    if (!HUB_TOKEN) {
      return Response.json({ success: false, error: 'NEXUS_HUB_TOKEN não configurado' }, { status: 500 });
    }

    // Autorização: automação (payload com event), admin logado, ou token do hub
    const payload = await req.json().catch(() => ({}));
    const isAutomation = !!payload?.event;
    if (!isAutomation) {
      const tokenRecebido = req.headers.get('x-hub-token');
      if (tokenRecebido !== HUB_TOKEN) {
        const user = await base44.auth.me().catch(() => null);
        if (!user || user.role !== 'admin') {
          return Response.json({ success: false, error: 'Não autorizado' }, { status: 403 });
        }
      }
    }

    // 1. Carrega destinos (satélites) da configuração
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'satelites_sync_usuarios'
    });
    const satelites = (configs?.[0]?.valor?.satelites || []).filter((s) => s.ativo && s.url);
    if (satelites.length === 0) {
      return Response.json({
        success: true,
        aviso: 'Nenhum satélite ativo cadastrado na configuração satelites_sync_usuarios',
        enviados: 0
      });
    }

    // 2. Monta o diretório de usuários (mesmo formato do usuariosHub)
    const todos = await base44.asServiceRole.entities.User.list();
    const devices = await base44.asServiceRole.entities.UserDevice.filter({ is_active: true });
    const usuariosComDevice = new Set(devices.map((d) => d.user_id));

    const usuarios = (todos || []).map((u) => {
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
        tem_device_push: usuariosComDevice.has(u.id)
      };
    });

    const corpo = {
      origem: 'nexus360',
      tipo: 'sync_usuarios',
      atualizado_em: new Date().toISOString(),
      total: usuarios.length,
      usuarios
    };

    // 3. Envia para cada satélite em paralelo
    const resultados = await Promise.all(
      satelites.map(async (sat) => {
        try {
          const resp = await fetch(sat.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-hub-token': HUB_TOKEN },
            body: JSON.stringify(corpo)
          });
          const texto = await resp.text().catch(() => '');
          return { nome: sat.nome, url: sat.url, status: resp.status, ok: resp.ok, resposta: texto.slice(0, 300) };
        } catch (e) {
          return { nome: sat.nome, url: sat.url, status: 0, ok: false, resposta: e.message };
        }
      })
    );

    const sucesso = resultados.filter((r) => r.ok).length;
    const falhas = resultados.filter((r) => !r.ok);

    // 4. Log de auditoria
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'sincronizacao_dados',
      resultado: falhas.length === 0 ? 'sucesso' : (sucesso > 0 ? 'parcial' : 'erro'),
      timestamp: new Date().toISOString(),
      origem: isAutomation ? 'cron' : 'manual',
      detalhes: {
        mensagem: `Sync de ${usuarios.length} usuários para ${satelites.length} satélites (${sucesso} ok, ${falhas.length} falhas)`,
        dados_contexto: { resultados }
      }
    }).catch((e) => console.error('[syncUsuarios] Falha ao logar:', e.message));

    return Response.json({
      success: falhas.length === 0,
      total_usuarios: usuarios.length,
      satelites_ok: sucesso,
      satelites_falha: falhas.length,
      resultados
    });
  } catch (error) {
    console.error('[sincronizarUsuariosSatelites] ❌ Erro:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});