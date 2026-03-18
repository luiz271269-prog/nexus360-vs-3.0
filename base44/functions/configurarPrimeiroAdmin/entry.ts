import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONFIGURAR PRIMEIRO ADMIN                                   ║
 * ║  Permite que o primeiro usuário se torne admin               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('[CONFIG ADMIN] 🔧 Verificando configuração de administrador...');
    
    // Verificar se já existe algum admin
    const admins = await base44.asServiceRole.entities.User.filter({
      role: 'admin'
    });
    
    if (admins && admins.length > 0) {
      console.log('[CONFIG ADMIN] ⚠️ Já existem administradores no sistema');
      return Response.json({
        success: false,
        error: 'Já existem administradores configurados no sistema. Entre em contato com um administrador existente.'
      }, { status: 403 });
    }
    
    // Obter usuário atual
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({
        success: false,
        error: 'Usuário não autenticado'
      }, { status: 401 });
    }
    
    console.log('[CONFIG ADMIN] 👤 Configurando primeiro admin:', user.email);
    
    // Atualizar usuário para admin
    await base44.asServiceRole.entities.User.update(user.id, {
      role: 'admin',
      sector: 'gerencia',
      is_active: true
    });
    
    console.log('[CONFIG ADMIN] ✅ Primeiro administrador configurado com sucesso');
    
    return Response.json({
      success: true,
      message: 'Você foi configurado como o primeiro administrador do sistema!',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: 'admin'
      }
    });
    
  } catch (error) {
    console.error('[CONFIG ADMIN] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});