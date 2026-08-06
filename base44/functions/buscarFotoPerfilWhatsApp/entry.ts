import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ==========================================
// BUSCAR FOTO DE PERFIL DO WHATSAPP (1 contato)
// ==========================================
// Delega para o resolvedor único (resolverFotoPerfil), que tenta todas as
// instâncias conectadas de todos os provedores. Mantido para compatibilidade
// com os chamadores existentes (integration_id é ignorado de propósito:
// a regra agora é universal, não por instância).

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone || '').replace(/\D/g, '');
    if (!phone) {
      return Response.json({ error: 'phone é obrigatório' }, { status: 400, headers: corsHeaders });
    }

    let contactId = body?.contact_id || null;
    if (!contactId) {
      const achados = await base44.asServiceRole.entities.Contact.filter({ telefone_canonico: phone }, '-updated_date', 1);
      contactId = achados?.[0]?.id || null;
    }

    const resp = await base44.functions.invoke('resolverFotoPerfil', {
      phone,
      contact_id: contactId,
      persistir: true
    });
    const dados = resp?.data || resp;

    return Response.json({
      success: true,
      profilePictureUrl: dados?.file_url || dados?.link || null,
      provider: dados?.provider || null,
      instance_id: dados?.instance_id || null
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error);
    return Response.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
});