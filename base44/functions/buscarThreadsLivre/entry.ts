/**
 * Busca livre de threads no banco (sem RLS)
 * PATCH: Desabilita Brotli no Node.js compat layer para evitar bug de descompressão no Deno
 */

// Patch ANTES de qualquer import do SDK (que usa node:https internamente)
import https from 'node:https';
import http from 'node:http';

function patchRequestToDisableBrotli(mod) {
  const origRequest = mod.request.bind(mod);
  mod.request = function(options, callback) {
    // Normaliza options como objeto
    if (typeof options === 'string' || options instanceof URL) {
      const url = new URL(options.toString());
      options = {
        hostname: url.hostname,
        port: url.port || (mod === https ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
      };
    }
    if (!options.headers) options.headers = {};
    // Força apenas gzip/deflate, sem br (brotli)
    options.headers['accept-encoding'] = 'gzip, deflate';
    return origRequest(options, callback);
  };
}

try {
  patchRequestToDisableBrotli(https);
  patchRequestToDisableBrotli(http);
} catch(e) {
  console.warn('[buscarThreadsLivre] Patch Brotli falhou (non-blocking):', e.message);
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { 
      status = 'aberta',
      limit = 500,
      incluirInternas = true 
    } = await req.json();

    const filter = { status };
    if (!incluirInternas) {
      filter.thread_type = 'contact_external';
    }

    const threads = await base44.asServiceRole.entities.MessageThread.filter(
      filter,
      '-last_message_at',
      limit
    );

    const contactIds = [...new Set(
      threads
        .filter(t => t.contact_id)
        .map(t => t.contact_id)
    )];

    let contatosMap = {};
    if (contactIds.length > 0) {
      const contatos = await base44.asServiceRole.entities.Contact.filter(
        { id: { $in: contactIds } },
        '-created_date',
        contactIds.length
      );
      contatosMap = Object.fromEntries(contatos.map(c => [c.id, c]));
    }

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