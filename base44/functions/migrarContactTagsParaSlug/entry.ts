import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MIGRAÇÃO: Contact.tags - String nome → Slug (imutável)
 * Protege score ABC de renomeações acidentais
 */
const VERSION = 'v1.0.0-MIGRATION-TAGS';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ success: false, error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error' }, { status: 500 });
  }

  console.log(`[${VERSION}] 🚀 Iniciando migração Contact.tags → slug`);

  try {
    // 1. Carregar todas etiquetas (para mapear nome → slug)
    const etiquetas = await base44.asServiceRole.entities.EtiquetaContato.list('-created_date', 1000);
    console.log(`[${VERSION}] 📚 Carregadas ${etiquetas.length} etiquetas`);

    const mapaSlug = {};
    etiquetas.forEach(e => {
      mapaSlug[e.nome] = e.nome; // slug === nome (já normalizado)
    });

    console.log(`[${VERSION}] 🔍 Mapa de slugs criado (${Object.keys(mapaSlug).length} etiquetas)`);

    // 2. Carregar TODOS contatos com tags
    const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', 10000);
    console.log(`[${VERSION}] 👥 Carregados ${contatos.length} contatos`);

    let contatosMigrados = 0;
    let tagsNaoEncontradas = new Set();

    // 3. Migrar cada contato
    for (const contato of contatos) {
      if (!contato.tags || contato.tags.length === 0) {
        continue; // Pula contatos sem tags
      }

      let tagsMigradas = [];
      let precisaMigrar = false;

      for (const tag of contato.tags) {
        const slug = mapaSlug[tag];
        
        if (!slug) {
          console.warn(`[${VERSION}] ⚠️ Tag não encontrada: "${tag}" (contato ${contato.id})`);
          tagsNaoEncontradas.add(tag);
          continue;
        }

        // Se é diferente do original, precisa migrar
        if (tag !== slug) {
          precisaMigrar = true;
        }
        
        tagsMigradas.push(slug);
      }

      // Atualizar se houver mudança
      if (precisaMigrar && tagsMigradas.length > 0) {
        try {
          await base44.asServiceRole.entities.Contact.update(contato.id, { tags: tagsMigradas });
          contatosMigrados++;
          console.log(`[${VERSION}] ✅ Contato ${contato.id} migrado: ${tagsMigradas.length} tags`);
        } catch (updateErr) {
          console.error(`[${VERSION}] ❌ Erro ao migrar contato ${contato.id}:`, updateErr.message);
        }
      }
    }

    const resultado = {
      success: true,
      version: VERSION,
      resultado: {
        total_contatos: contatos.length,
        contatos_migrados: contatosMigrados,
        tags_nao_encontradas: Array.from(tagsNaoEncontradas),
        total_etiquetas: etiquetas.length
      }
    };

    console.log(`[${VERSION}] ✅ Migração concluída!`, resultado.resultado);

    return Response.json(resultado);

  } catch (error) {
    console.error(`[${VERSION}] ❌ ERRO:`, error.message);
    return Response.json({
      success: false,
      error: error.message,
      version: VERSION
    }, { status: 500 });
  }
});