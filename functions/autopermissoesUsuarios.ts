import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// AUTO-PERMISSÕES: CONFIGURAÇÃO AUTOMÁTICA PARA USUÁRIOS
// ============================================================================
// Adiciona whatsapp_permissions[] para usuários sem configuração
// Libera TODAS integrações ativas por padrão
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ✅ APENAS ADMIN pode executar
    if (user?.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    const { dryRun = true, incluirAdmins = false } = await req.json().catch(() => ({}));

    console.log(`[AUTO-PERMS] 🔍 Iniciando${dryRun ? ' (DRY-RUN)' : ' (EXECUÇÃO REAL)'}...`);

    // 1. Buscar todas integrações ativas
    const integracoesAtivas = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    }, '-created_date', 100);

    console.log(`[AUTO-PERMS] 📡 ${integracoesAtivas.length} integrações ativas encontradas`);

    if (integracoesAtivas.length === 0) {
      return Response.json({
        success: false,
        error: 'Nenhuma integração ativa. Configure conexões WhatsApp primeiro.'
      }, { status: 400 });
    }

    // 2. Buscar usuários sem permissões configuradas
    const todosUsuarios = await base44.asServiceRole.entities.User.list('-created_date', 200);

    const usuariosSemPermissoes = todosUsuarios.filter(u => {
      // Pular admins se não solicitado
      if (!incluirAdmins && u.role === 'admin') return false;
      
      // Verificar se whatsapp_permissions está vazio ou ausente
      const perms = u.whatsapp_permissions || [];
      return perms.length === 0;
    });

    console.log(`[AUTO-PERMS] 👥 ${usuariosSemPermissoes.length} usuários sem permissões encontrados`);

    const resultados = {
      usuarios_analisados: usuariosSemPermissoes.length,
      usuarios_atualizados: 0,
      erros: 0,
      detalhes: []
    };

    // 3. Configurar permissões padrão para cada usuário
    const permissoesPadrao = integracoesAtivas.map(integ => ({
      integration_id: integ.id,
      integration_name: integ.nome_instancia || 'Sem nome',
      can_view: true,
      can_send: true,
      can_receive: true,
      configurado_automaticamente: true,
      configurado_em: new Date().toISOString()
    }));

    for (const usuario of usuariosSemPermissoes) {
      try {
        console.log(`[AUTO-PERMS] 🔧 Configurando: ${usuario.email} (${usuario.role})`);

        if (!dryRun) {
          await base44.asServiceRole.entities.User.update(usuario.id, {
            whatsapp_permissions: permissoesPadrao
          });
          resultados.usuarios_atualizados++;
        }

        resultados.detalhes.push({
          usuario_id: usuario.id.substring(0, 8),
          email: usuario.email,
          role: usuario.role,
          sector: usuario.attendant_sector,
          permissoes_adicionadas: permissoesPadrao.length,
          integracoes: permissoesPadrao.map(p => p.integration_name)
        });

      } catch (userErr) {
        console.error(`[AUTO-PERMS] ❌ Erro ao atualizar ${usuario.email}:`, userErr.message);
        resultados.erros++;
      }

      // Rate limit protection
      if (resultados.usuarios_analisados % 20 === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const mensagemFinal = dryRun 
      ? `✅ DRY-RUN concluído. ${usuariosSemPermissoes.length} usuários precisam de permissões.`
      : `✅ Migração concluída! ${resultados.usuarios_atualizados} usuários configurados.`;

    console.log(`[AUTO-PERMS] ${mensagemFinal}`);

    return Response.json({
      success: true,
      dry_run: dryRun,
      mensagem: mensagemFinal,
      integracoes_liberadas: integracoesAtivas.length,
      permissoes_por_usuario: permissoesPadrao.length,
      resultados,
      // Mostrar apenas primeiros 10 usuários
      exemplos: resultados.detalhes.slice(0, 10)
    });

  } catch (error) {
    console.error('[AUTO-PERMS] ❌ Erro fatal:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});