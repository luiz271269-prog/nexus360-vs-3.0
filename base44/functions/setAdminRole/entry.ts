/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FUNÇÃO PARA CONFIGURAR ROLE DE ADMIN                        ║
 * ║  Uso único para configurar administrador do sistema          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Email do administrador
    const adminEmail = 'luiz271269@gmail.com';
    
    console.log('[ADMIN] 🔧 Configurando permissões de administrador...');
    
    // Buscar usuário pelo email
    const usuarios = await base44.asServiceRole.entities.User.filter({
      email: adminEmail
    });
    
    if (!usuarios || usuarios.length === 0) {
      return Response.json({
        success: false,
        error: 'Usuário não encontrado no sistema'
      }, { status: 404 });
    }
    
    const usuario = usuarios[0];
    
    console.log('[ADMIN] 👤 Usuário encontrado:', usuario.email);
    console.log('[ADMIN] 📋 Role atual:', usuario.role);
    
    // Atualizar para admin se ainda não for
    if (usuario.role !== 'admin') {
      await base44.asServiceRole.entities.User.update(usuario.id, {
        role: 'admin',
        is_active: true,
        sector: 'gerencia'
      });
      
      console.log('[ADMIN] ✅ Role atualizado para admin');
      
      return Response.json({
        success: true,
        message: 'Usuário configurado como administrador com sucesso',
        user: {
          email: usuario.email,
          role: 'admin',
          full_name: usuario.full_name
        }
      });
    } else {
      console.log('[ADMIN] ℹ️ Usuário já é administrador');
      
      return Response.json({
        success: true,
        message: 'Usuário já possui permissões de administrador',
        user: {
          email: usuario.email,
          role: usuario.role,
          full_name: usuario.full_name
        }
      });
    }
    
  } catch (error) {
    console.error('[ADMIN] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});