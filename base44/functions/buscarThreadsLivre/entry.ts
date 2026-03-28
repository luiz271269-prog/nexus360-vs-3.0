import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Busca livre de threads no banco (sem RLS)
 * Retorna threads + contatos associados
 * Filtragem de permissões aplicada no frontend
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
      description: 'Busca livre de threads (ignora RLS, filtros no frontend)'
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar autenticação
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { 
      status = 'aberta',
      limit = 500,
      incluirInternas = true 
    } = await req.json();

    // Buscar threads sem RLS
    const filter = { status };
    if (!incluirInternas) {
      filter.thread_type = 'contact_external';
    }

    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      filter,
      '-last_message_at',
      limit
    );

    // Buscar contatos associados (em batch para performance)
    const contactIds = [...new Set(
      threads
        .filter(t => t.contact_id)
        .map(t => t.contact_id)
    )];

    let contatosMap = {};
    if (contactIds.length > 0) {
      const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', 1000);
      contatosMap = Object.fromEntries(
        contatos
          .filter(c => contactIds.includes(c.id))
          .map(c => [c.id, c])
      );
    }

    // Enriquecer threads com dados de contato
    const threadsEnriquecidas = threads.map(thread => ({
      ...thread,
      contato: thread.contact_id ? contatosMap[thread.contact_id] : null
    }));

    return Response.json({ 
      success: true,
      threads: threadsEnriquecidas,
      total: threadsEnriquecidas.length,
      user_id: user.id
    });

  } catch (error) {
    console.error('[buscarThreadsLivre] Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});