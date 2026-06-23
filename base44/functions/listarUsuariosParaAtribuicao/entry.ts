import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Lista todos os usuários para atribuição de conversas
 * Usa serviceRole para bypass das regras de segurança da entidade User
 */
Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar se usuário está autenticado
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Não autenticado' }, { status: 401, headers: corsHeaders });
    }

    // ✅ Buscar TODOS os usuários (sem filtro de is_whatsapp_attendant)
    const usuarios = await base44.asServiceRole.entities.User.list();
    
    // Filtrar apenas os que têm nome válido, ordenar por setor + created_date (ordem de cadastro)
    const ORDEM_SETOR = { vendas: 0, assistencia: 1, financeiro: 2, fornecedor: 3, geral: 4 };
    const usuariosSimplificados = (usuarios || [])
      .filter(u => u.full_name || u.display_name || u.email)
      .sort((a, b) => {
        const setorA = ORDEM_SETOR[a.attendant_sector] ?? 5;
        const setorB = ORDEM_SETOR[b.attendant_sector] ?? 5;
        if (setorA !== setorB) return setorA - setorB;
        // Dentro do mesmo setor, ordenar por data de criação (ordem de cadastro)
        return new Date(a.created_date || 0) - new Date(b.created_date || 0);
      })
      .map((u, index) => ({
        id: u.id,
        full_name: u.full_name,
        display_name: u.display_name,
        email: u.email,
        role: u.role,
        attendant_sector: u.attendant_sector,
        attendant_role: u.attendant_role,
        foto_url: u.foto_url || u.foto_perfil_url || null,  // foto de perfil para avatar nos contatos internos
        // Campos de vendedor (usados na tela Gestão de Vendedores / metas)
        codigo: u.codigo || null,
        meta_mensal: u.meta_mensal || 0,
        meta_ligacoes_diarias: u.meta_ligacoes_diarias || 0,
        meta_whatsapp_diarios: u.meta_whatsapp_diarios || 0,
        meta_emails_diarios: u.meta_emails_diarios || 0,
        status_vendedor: u.status_vendedor || null,
        carga_trabalho_atual: u.carga_trabalho_atual || 0,
        capacidade_maxima: u.capacidade_maxima || 0,
        telefone_ramal: u.telefone_ramal || null,
        _ordem_cadastro: index  // índice preservado para ordenação no frontend
      }));

    console.log('[listarUsuarios] Total de usuários:', usuariosSimplificados.length);

    return Response.json({ 
      success: true, 
      usuarios: usuariosSimplificados 
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[listarUsuarios] Erro:', error.message);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500, headers: corsHeaders });
  }
});