import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SKILL: detectar_usuarios_inativos
 * 
 * Identifica usuários inativos e sugere ações de reengajamento.
 */

Deno.serve(async (req) => {
  const inicio = Date.now();
  const metricas = {
    usuarios_analisados: 0,
    usuarios_inativos: 0,
    acoes_criadas: 0
  };

  try {
    const base44 = createClientFromRequest(req);
    const { dias_inatividade = 30, criar_workqueue = false } = await req.json().catch(() => ({}));

    // Calcular timestamp de inatividade
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias_inatividade);

    // 1. Buscar todos os usuários
    const usuarios = await base44.asServiceRole.entities.User.list();
    metricas.usuarios_analisados = usuarios.length;

    // 2. Buscar última atividade de cada usuário
    const usuariosInativos = [];

    for (const usuario of usuarios) {
      // Buscar último log de auditoria do usuário
      const ultimoLog = await base44.asServiceRole.entities.AuditLog.filter(
        { usuario_id: usuario.id },
        '-created_date',
        1
      );

      const ultimaAtividade = ultimoLog.length > 0 ? 
        new Date(ultimoLog[0].created_date) : 
        new Date(usuario.created_date);

      const diasInativo = Math.floor((Date.now() - ultimaAtividade.getTime()) / (1000 * 60 * 60 * 24));

      if (diasInativo >= dias_inatividade) {
        usuariosInativos.push({
          id: usuario.id,
          email: usuario.email,
          full_name: usuario.full_name,
          role: usuario.role,
          dias_inativo: diasInativo,
          ultima_atividade: ultimaAtividade.toISOString(),
          risco_churn: diasInativo > 60 ? 'alto' : diasInativo > 30 ? 'medio' : 'baixo',
          acao_sugerida: diasInativo > 60 ? 
            'Contato urgente + treinamento' :
            diasInativo > 30 ?
            'Email de reengajamento' :
            'Lembrete suave'
        });
      }
    }

    metricas.usuarios_inativos = usuariosInativos.length;

    // 3. Se solicitado, criar WorkQueueItems para ação
    if (criar_workqueue && usuariosInativos.length > 0) {
      for (const usuario of usuariosInativos) {
        await base44.asServiceRole.entities.WorkQueueItem.create({
          tipo: 'manual',
          reason: `usuario_inativo_${usuario.dias_inativo}d`,
          severity: usuario.risco_churn === 'alto' ? 'high' : 
                    usuario.risco_churn === 'medio' ? 'medium' : 'low',
          status: 'open',
          payload: {
            usuario_id: usuario.id,
            email: usuario.email,
            dias_inativo: usuario.dias_inativo,
            acao_sugerida: usuario.acao_sugerida
          },
          notes: `Usuário ${usuario.full_name} inativo há ${usuario.dias_inativo} dias. ${usuario.acao_sugerida}`
        });
        metricas.acoes_criadas++;
      }
    }

    // 4. Gerar resumo
    const resumo = {
      total_usuarios: metricas.usuarios_analisados,
      usuarios_inativos: metricas.usuarios_inativos,
      taxa_inatividade: `${(metricas.usuarios_inativos / metricas.usuarios_analisados * 100).toFixed(1)}%`,
      risco_alto: usuariosInativos.filter(u => u.risco_churn === 'alto').length,
      risco_medio: usuariosInativos.filter(u => u.risco_churn === 'medio').length,
      risco_baixo: usuariosInativos.filter(u => u.risco_churn === 'baixo').length,
      acoes_criadas: metricas.acoes_criadas
    };

    return Response.json({
      success: true,
      metricas,
      duration_ms: Date.now() - inicio,
      resumo,
      usuarios_inativos: usuariosInativos.sort((a, b) => b.dias_inativo - a.dias_inativo)
    });

  } catch (error) {
    console.error('[detectarUsuariosInativos] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      metricas,
      duration_ms: Date.now() - inicio
    }, { status: 500 });
  }
});