import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ✅ ENRIQUECIMENTO AUTOMÁTICO - Atualiza contatos vazios com dados do WhatsApp
 * 
 * Quando um contato tem apenas telefone (criado por webhook), esta função:
 * 1. Busca nome e foto de perfil via API do WhatsApp
 * 2. Atualiza o contato no banco automaticamente
 * 3. Retorna os dados atualizados
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

    const { contact_id, integration_id } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });
    }

    // Buscar contato
    const contato = await base44.asServiceRole.entities.Contact.filter(
      { id: contact_id },
      '-created_date',
      1
    );

    if (!contato || contato.length === 0) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    const contatoAtual = contato[0];
    
    // Verificar se está vazio (apenas telefone)
    const nome = (contatoAtual.nome || '').trim();
    const telefone = (contatoAtual.telefone || '').replace(/\D/g, '');
    const estaVazio = (
      (!nome || nome === contatoAtual.telefone || nome === '+' + telefone) &&
      !contatoAtual.empresa &&
      !contatoAtual.cargo
    );

    if (!estaVazio) {
      console.log('[enriquecerContatoVazio] ℹ️ Contato já tem dados:', contact_id);
      return Response.json({
        success: true,
        updated: false,
        reason: 'Contato já possui dados básicos',
        contact: contatoAtual
      });
    }

    // Buscar integração
    const integracaoAtiva = integration_id 
      ? await base44.asServiceRole.entities.WhatsAppIntegration.filter({ id: integration_id }, '-created_date', 1)
      : await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' }, '-created_date', 1);

    if (!integracaoAtiva || integracaoAtiva.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Nenhuma integração WhatsApp disponível' 
      }, { status: 400 });
    }

    const integracao = integracaoAtiva[0];
    const telefoneNormalizado = contatoAtual.telefone.replace(/\D/g, '');

    console.log('[enriquecerContatoVazio] 🔍 Buscando dados do WhatsApp:', telefoneNormalizado);

    let nomeWhatsApp = null;
    let fotoWhatsApp = null;
    const dadosAtualizados = {};

    // Buscar nome via API do provedor
    try {
      const payload = {
        integration_id: integracao.id,
        numero_telefone: contatoAtual.telefone
      };

      const resultadoNome = await base44.asServiceRole.functions.invoke('buscarNomeContatoWhatsApp', payload);
      
      if (resultadoNome?.data?.success && resultadoNome.data.nome) {
        nomeWhatsApp = resultadoNome.data.nome;
        dadosAtualizados.nome = nomeWhatsApp;
        console.log('[enriquecerContatoVazio] ✅ Nome encontrado:', nomeWhatsApp);
      }
    } catch (error) {
      console.warn('[enriquecerContatoVazio] ⚠️ Erro ao buscar nome:', error.message);
    }

    // Buscar foto via API do provedor
    try {
      const payload = {
        integration_id: integracao.id,
        numero_telefone: contatoAtual.telefone
      };

      const resultadoFoto = await base44.asServiceRole.functions.invoke('buscarFotoPerfilWhatsApp', payload);
      
      if (resultadoFoto?.data?.success && resultadoFoto.data.foto_url) {
        fotoWhatsApp = resultadoFoto.data.foto_url;
        dadosAtualizados.foto_perfil_url = fotoWhatsApp;
        dadosAtualizados.foto_perfil_atualizada_em = new Date().toISOString();
        console.log('[enriquecerContatoVazio] ✅ Foto encontrada');
      }
    } catch (error) {
      console.warn('[enriquecerContatoVazio] ⚠️ Erro ao buscar foto:', error.message);
    }

    // Atualizar contato se encontrou dados
    if (Object.keys(dadosAtualizados).length > 0) {
      await base44.asServiceRole.entities.Contact.update(contact_id, dadosAtualizados);
      
      console.log('[enriquecerContatoVazio] ✅ Contato atualizado:', {
        contact_id,
        campos_atualizados: Object.keys(dadosAtualizados)
      });

      return Response.json({
        success: true,
        updated: true,
        dados_atualizados: dadosAtualizados,
        contact: { ...contatoAtual, ...dadosAtualizados }
      });
    }

    return Response.json({
      success: true,
      updated: false,
      reason: 'Nenhum dado adicional encontrado no WhatsApp',
      contact: contatoAtual
    });

  } catch (error) {
    console.error('[enriquecerContatoVazio] ❌ ERRO:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});