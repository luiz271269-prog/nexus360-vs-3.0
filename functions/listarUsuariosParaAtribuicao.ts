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

    // Usar serviceRole para buscar TODOS os usuários (bypass segurança)
    const usuarios = await base44.asServiceRole.entities.User.list();
    
    // Retornar apenas campos necessários para atribuição
    const usuariosSimplificados = (usuarios || []).map(u => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      attendant_sector: u.attendant_sector,
      attendant_role: u.attendant_role
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