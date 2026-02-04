import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Busca livre de contatos no banco (sem RLS)
 * Usado para permitir busca ampla, com filtragem de permissões no frontend
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      status: 'ok',
      description: 'Busca livre de contatos (ignora RLS para permitir busca ampla)'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchTerm, limit = 500 } = await req.json();

    // Buscar contatos sem RLS usando service role
    let contatos = [];
    
    if (searchTerm && searchTerm.trim()) {
      // Busca por texto (nome, empresa, cargo, telefone)
      const termo = searchTerm.trim().toLowerCase();
      
      // Buscar todos e filtrar no backend (mais eficiente que múltiplas queries)
      const todosContatos = await base44.asServiceRole.entities.Contact.list('-created_date', limit);
      
      contatos = todosContatos.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const empresa = (c.empresa || '').toLowerCase();
        const cargo = (c.cargo || '').toLowerCase();
        const telefone = (c.telefone || '').replace(/\D/g, '');
        const termoLimpo = termo.replace(/\D/g, '');
        
        return nome.includes(termo) || 
               empresa.includes(termo) || 
               cargo.includes(termo) ||
               (termoLimpo && telefone.includes(termoLimpo));
      });
    } else {
      // Sem busca - retornar últimos contatos
      contatos = await base44.asServiceRole.entities.Contact.list('-created_date', limit);
    }

    return Response.json({ 
      success: true,
      contatos,
      total: contatos.length,
      user_id: user.id
    });

  } catch (error) {
    console.error('[buscarContatosLivre] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});