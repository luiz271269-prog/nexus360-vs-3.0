import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔄 ENRIQUECIMENTO EM LOTE DE CONTATOS VAZIOS
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Busca nome + foto de perfil de múltiplos contatos vazios do WhatsApp
 * Atualiza banco de dados em paralelo (max 5 simultâneos)
 * Retorna lista de contatos atualizados para invalidação de cache
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

  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { contact_ids, integration_id } = await req.json();

    if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
      return Response.json({ error: 'contact_ids array obrigatório' }, { status: 400 });
    }

    if (!integration_id) {
      return Response.json({ error: 'integration_id obrigatório' }, { status: 400 });
    }

    console.log(`[ENRIQUECIMENTO LOTE] 🚀 Processando ${contact_ids.length} contatos...`);

    // Buscar contatos do banco
    const contatos = await Promise.all(
      contact_ids.map(id => base44.asServiceRole.entities.Contact.get(id))
    );

    // Buscar integração
    const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    if (!integracao) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    // Enriquecer em paralelo (max 5 simultâneos para não sobrecarregar WhatsApp)
    const MAX_SIMULTANEO = 5;
    const resultados = [];

    for (let i = 0; i < contatos.length; i += MAX_SIMULTANEO) {
      const lote = contatos.slice(i, i + MAX_SIMULTANEO);
      
      const promessas = lote.map(async (contato) => {
        try {
          // Verificar se está vazio
          const nome = (contato.nome || '').trim();
          const telefone = (contato.telefone || '').replace(/\D/g, '');
          const estaVazio = (
            (!nome || nome === contato.telefone || nome === '+' + telefone) &&
            !contato.empresa &&
            !contato.cargo
          );

          if (!estaVazio) {
            console.log(`[LOTE] ⏭️ Pulando ${contato.id.substring(0, 8)} (já tem dados)`);
            return { id: contato.id, updated: false, reason: 'já_completo' };
          }

          // Buscar nome do WhatsApp
          const nomeResult = await base44.functions.invoke('buscarNomeContatoWhatsApp', {
            telefone: contato.telefone,
            integration_id: integration_id
          });

          let dadosAtualizados = {};
          
          if (nomeResult?.data?.nome_whatsapp) {
            dadosAtualizados.nome = nomeResult.data.nome_whatsapp;
            console.log(`[LOTE] ✅ Nome encontrado: ${dadosAtualizados.nome}`);
          }

          // Buscar foto do WhatsApp
          const fotoResult = await base44.functions.invoke('buscarFotoPerfilWhatsApp', {
            telefone: contato.telefone,
            integration_id: integration_id
          });

          if (fotoResult?.data?.foto_url) {
            dadosAtualizados.foto_perfil_url = fotoResult.data.foto_url;
            dadosAtualizados.foto_perfil_atualizada_em = new Date().toISOString();
            console.log(`[LOTE] ✅ Foto encontrada`);
          }

          if (Object.keys(dadosAtualizados).length === 0) {
            console.log(`[LOTE] ⚠️ Sem dados novos para ${contato.id.substring(0, 8)}`);
            return { id: contato.id, updated: false, reason: 'sem_dados_whatsapp' };
          }

          // Atualizar no banco
          await base44.asServiceRole.entities.Contact.update(contato.id, dadosAtualizados);
          
          console.log(`[LOTE] ✅ Contato ${contato.id.substring(0, 8)} enriquecido:`, dadosAtualizados);
          
          return { 
            id: contato.id, 
            updated: true, 
            dados_atualizados: dadosAtualizados 
          };

        } catch (error) {
          console.error(`[LOTE] ❌ Erro ao enriquecer ${contato.id}:`, error.message);
          return { id: contato.id, updated: false, error: error.message };
        }
      });

      const loteResultados = await Promise.all(promessas);
      resultados.push(...loteResultados);

      // Pequeno delay entre lotes
      if (i + MAX_SIMULTANEO < contatos.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const atualizados = resultados.filter(r => r.updated);
    
    console.log(`[ENRIQUECIMENTO LOTE] ✅ Concluído: ${atualizados.length}/${contatos.length} atualizados`);

    return Response.json({ 
      success: true,
      total: contatos.length,
      atualizados: atualizados.length,
      resultados
    });

  } catch (error) {
    console.error('[ENRIQUECIMENTO LOTE] ❌ ERRO:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});