import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ==========================================
// SINCRONIZAR TAGS: Contact.tags ↔ ContactTag
// ==========================================
// Garante consistência entre o array simples e a tabela de relações

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
        error: 'Apenas administradores podem sincronizar tags' 
      }, { status: 403, headers: corsHeaders });
    }

    const { 
      contact_id,
      direcao = 'array_to_relational' // 'array_to_relational' ou 'relational_to_array'
    } = await req.json();

    let totalSincronizados = 0;
    let tagsAdicionadas = 0;
    let tagsRemovidas = 0;

    const contatos = contact_id 
      ? [await base44.asServiceRole.entities.Contact.get(contact_id)]
      : await base44.asServiceRole.entities.Contact.list('-updated_date', 500);

    for (const contato of contatos) {
      if (!contato) continue;

      if (direcao === 'array_to_relational') {
        // 📤 Contact.tags → ContactTag
        const tagsArray = contato.tags || [];
        const contactTags = await base44.asServiceRole.entities.ContactTag.filter({ 
          contact_id: contato.id 
        });
        const tagIds = contactTags.map(ct => ct.tag_id);
        const tagsExistentes = tagIds.length > 0
          ? await base44.asServiceRole.entities.Tag.filter({ id: { $in: tagIds } })
          : [];
        
        const nomesExistentes = new Set(tagsExistentes.map(t => t.nome));

        // Criar tags faltantes
        for (const tagNome of tagsArray) {
          if (nomesExistentes.has(tagNome)) continue;

          // Buscar ou criar Tag
          let tags = await base44.asServiceRole.entities.Tag.list('-created_date', 1, { nome: tagNome });
          let tag;

          if (tags.length === 0) {
            const categoria = tagNome.startsWith('ia:') ? 'ia_automatica' : 'manual';
            tag = await base44.asServiceRole.entities.Tag.create({
              nome: tagNome,
              categoria,
              automacao_ativa: tagNome.startsWith('ia:')
            });
          } else {
            tag = tags[0];
          }

          // Criar ContactTag
          const existe = await base44.asServiceRole.entities.ContactTag.list('-created_date', 1, {
            contact_id: contato.id,
            tag_id: tag.id
          });

          if (existe.length === 0) {
            await base44.asServiceRole.entities.ContactTag.create({
              contact_id: contato.id,
              tag_id: tag.id,
              atribuida_por: tagNome.startsWith('ia:') ? 'sistema' : 'usuario',
              origem: tagNome.startsWith('ia:') ? 'ia' : 'manual'
            });
            tagsAdicionadas++;
          }
        }

      } else {
        // 📥 ContactTag → Contact.tags
        const contactTags = await base44.asServiceRole.entities.ContactTag.filter({ 
          contact_id: contato.id 
        });
        const tagIds = contactTags.map(ct => ct.tag_id);
        const tags = tagIds.length > 0
          ? await base44.asServiceRole.entities.Tag.filter({ id: { $in: tagIds } })
          : [];
        
        const nomesAtualizados = tags.map(t => t.nome);
        
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          tags: nomesAtualizados
        });
      }

      totalSincronizados++;
    }

    return Response.json({
      success: true,
      direcao,
      contatos_sincronizados: totalSincronizados,
      tags_adicionadas: tagsAdicionadas,
      tags_removidas: tagsRemovidas
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Erro na sincronização de tags:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});