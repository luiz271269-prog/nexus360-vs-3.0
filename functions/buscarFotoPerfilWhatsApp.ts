import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ==========================================
// BUSCAR FOTO DE PERFIL DO WHATSAPP
// ==========================================
// Busca a foto de perfil de um contato via Z-API

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

    const { integration_id, phone } = await req.json();

    if (!integration_id || !phone) {
      return Response.json({ 
        error: 'integration_id e phone são obrigatórios' 
      }, { status: 400, headers: corsHeaders });
    }

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    
    if (!integracao) {
      return Response.json({ 
        error: 'Integração não encontrada' 
      }, { status: 404, headers: corsHeaders });
    }

    // Limpar número (remover +, espaços, etc)
    const phoneClean = phone.replace(/\D/g, '');

    // Montar URL da Z-API
    const url = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/profile-picture?phone=${phoneClean}`;

    // Fazer requisição
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Client-Token': integracao.security_client_token_header
      }
    });

    if (!response.ok) {
      console.warn(`[PROFILE_PIC] Erro Z-API: ${response.status}`);
      return Response.json({
        success: false,
        profilePictureUrl: null,
        error: `Z-API Error: ${response.status}`
      }, { status: 200, headers: corsHeaders });
    }

    const data = await response.json();

    // Z-API retorna a foto na propriedade 'link'
    const photoUrl = data.link || null;

    // Salvar URL no contato se disponível
    if (photoUrl) {
      try {
        const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', 1, { 
          telefone: phoneClean 
        });

        if (contatos.length > 0) {
          await base44.asServiceRole.entities.Contact.update(contatos[0].id, {
            foto_perfil_url: photoUrl,
            foto_perfil_atualizada_em: new Date().toISOString()
          });
        }
      } catch (error) {
        console.warn('Erro ao salvar foto no contato:', error);
      }
    }

    console.log(`[PROFILE_PIC] Sucesso. URL encontrada: ${!!photoUrl}`);

    return Response.json({
      success: true,
      profilePictureUrl: photoUrl
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});