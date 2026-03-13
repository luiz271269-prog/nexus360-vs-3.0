import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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