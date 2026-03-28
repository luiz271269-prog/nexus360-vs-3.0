import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ==========================================
// BUSCAR NOME DO CONTATO NO WHATSAPP
// ==========================================
// Busca o nome real do contato via Z-API

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

    // Limpar número
    const phoneClean = phone.replace(/\D/g, '');

    // Montar URL da Z-API para buscar dados do contato
    const url = `${integracao.base_url_provider}/instances/${integracao.instance_id_provider}/token/${integracao.api_key_provider}/phone-profile?phone=${phoneClean}`;

    // Fazer requisição
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Client-Token': integracao.security_client_token_header
      }
    });

    if (!response.ok) {
      console.warn(`[CONTACT_NAME] Erro Z-API: ${response.status}`);
      return Response.json({
        success: false,
        contactName: null,
        error: `Z-API Error: ${response.status}`
      }, { status: 200, headers: corsHeaders });
    }

    const data = await response.json();

    // Z-API retorna o nome em diferentes propriedades dependendo do endpoint
    const contactName = data.name || data.pushname || data.notify || null;

    // Atualizar contato se nome encontrado e for diferente do telefone
    if (contactName && contactName !== phoneClean && contactName !== phone) {
      try {
        // Buscar contato pelo telefone normalizado (com + ou sem)
        const telefoneComPlus = phoneClean.startsWith('+') ? phoneClean : `+${phoneClean}`;
        const contatos = await base44.asServiceRole.entities.Contact.filter({ 
          telefone: telefoneComPlus 
        }, '-created_date', 1);

        if (contatos.length > 0) {
          const contatoAtual = contatos[0];
          
          // Só atualizar se o nome atual for genérico ou igual ao telefone
          const nomeAtualGenerico = !contatoAtual.nome || 
            contatoAtual.nome === contatoAtual.telefone ||
            /^[\+\d\s\-\(\)]+$/.test(contatoAtual.nome);

          if (nomeAtualGenerico) {
            await base44.asServiceRole.entities.Contact.update(contatoAtual.id, {
              nome: contactName
            });
          }
        }
      } catch (error) {
        console.warn('Erro ao salvar nome no contato:', error);
      }
    }

    console.log(`[CONTACT_NAME] Sucesso. Nome encontrado: ${!!contactName}`);

    return Response.json({
      success: true,
      contactName: contactName
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro ao buscar nome do contato:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});