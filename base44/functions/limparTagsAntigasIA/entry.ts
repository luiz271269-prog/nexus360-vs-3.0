import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ==========================================
// LIMPEZA DE TAGS ANTIGAS DA IA
// ==========================================
// Remove tags "ia:*" obsoletas quando novos valores são gerados

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
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        error: 'Apenas administradores podem executar limpeza de tags' 
      }, { status: 403, headers: corsHeaders });
    }

    const { 
      contact_id,
      modo = 'rotacao' // 'rotacao' ou 'completa'
    } = await req.json();

    let totalLimpezas = 0;
    let contatosProcessados = 0;

    if (contact_id) {
      // Limpar um contato específico
      const resultado = await limparTagsContato(base44, contact_id, modo);
      totalLimpezas = resultado.removidas;
      contatosProcessados = 1;
    } else {
      // Limpar todos os contatos (modo lote)
      const contatos = await base44.asServiceRole.entities.Contact.list('-updated_date', 500);
      
      for (const contato of contatos) {
        const resultado = await limparTagsContato(base44, contato.id, modo);
        totalLimpezas += resultado.removidas;
        if (resultado.removidas > 0) contatosProcessados++;
      }
    }

    return Response.json({
      success: true,
      modo,
      contatos_processados: contatosProcessados,
      tags_removidas: totalLimpezas,
      mensagem: `Limpeza concluída: ${totalLimpezas} tag(s) removida(s) de ${contatosProcessados} contato(s)`
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro na limpeza de tags:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});

// ==========================================
// HELPER: Limpar tags de um contato
// ==========================================
async function limparTagsContato(base44, contactId, modo) {
  const contato = await base44.asServiceRole.entities.Contact.get(contactId);
  if (!contato) return { removidas: 0 };

  const tagsAtuais = contato.tags || [];
  let tagsLimpas = [];

  if (modo === 'rotacao') {
    // 🔄 MODO ROTAÇÃO: Remove apenas tags IA conflitantes
    // Mantém a mais recente de cada categoria
    
    const tagsPorCategoria = {};
    
    for (const tag of tagsAtuais) {
      if (!tag.startsWith('ia:')) {
        tagsLimpas.push(tag); // Manter tags manuais
        continue;
      }

      // Extrair categoria (ia:perfil_X, ia:estagio_X, ia:alerta:X)
      const categoria = tag.split(':')[1]?.split('_')[0] || 'geral';
      
      if (!tagsPorCategoria[categoria]) {
        tagsPorCategoria[categoria] = tag;
      }
      // Se já existe na categoria, remove a antiga (mantém apenas a última)
    }

    // Adicionar tags IA filtradas
    tagsLimpas = [...tagsLimpas, ...Object.values(tagsPorCategoria)];

  } else if (modo === 'completa') {
    // 🧹 MODO COMPLETA: Remove TODAS as tags IA
    tagsLimpas = tagsAtuais.filter(t => !t.startsWith('ia:'));
  }

  const removidas = tagsAtuais.length - tagsLimpas.length;

  if (removidas > 0) {
    await base44.asServiceRole.entities.Contact.update(contactId, {
      tags: tagsLimpas
    });
    
    console.log(`🧹 Contato ${contactId}: ${removidas} tag(s) removida(s)`);
  }

  return { removidas };
}