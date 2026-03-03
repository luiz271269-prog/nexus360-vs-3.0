import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CALCULA SCORES ABC - Roda 1x/hora via automation
 * Atualiza score_abc e classe_abc de todos contatos com etiquetas
 */
const VERSION = 'v1.0.0-ABC-CALC';

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

  console.log(`[${VERSION}] 🔄 Iniciando cálculo de scores ABC`);

  try {
    // 1. Carregar todas etiquetas com peso_qualificacao
    const etiquetas = await base44.asServiceRole.entities.EtiquetaContato.list('-created_date', 1000);
    const etiquetasABC = etiquetas.filter(e => e.participa_abc && e.peso_qualificacao !== undefined);
    
    console.log(`[${VERSION}] 📚 ${etiquetas.length} etiquetas carregadas (${etiquetasABC.length} participam de ABC)`);

    // 2. Carregar TODOS contatos
    const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', 10000);
    console.log(`[${VERSION}] 👥 ${contatos.length} contatos carregados`);

    let contatosAtualizados = 0;
    const agora = new Date().toISOString();

    // 3. Calcular score para cada contato
    for (const contato of contatos) {
      if (!contato.tags || contato.tags.length === 0) {
        continue; // Pula contatos sem tags
      }

      // Somar pesos das etiquetas que participam de ABC
      let scoreABC = 0;
      let contemABC = false;

      for (const tagSlug of contato.tags) {
        const etiqueta = etiquetasABC.find(e => e.nome === tagSlug);
        if (etiqueta) {
          scoreABC += etiqueta.peso_qualificacao || 0;
          contemABC = true;
        }
      }

      // Determinar classe ABC
      let classeABC = 'none';
      if (contemABC) {
        if (scoreABC >= 70) {
          classeABC = 'A';
        } else if (scoreABC >= 30) {
          classeABC = 'B';
        } else {
          classeABC = 'C';
        }
      }

      // Atualizar apenas se houver mudança
      const scoreAnterior = contato.score_abc ?? 0;
      const classeAnterior = contato.classe_abc ?? 'none';
      
      if (scoreAnterior !== scoreABC || classeAnterior !== classeABC) {
        try {
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            score_abc: scoreABC,
            classe_abc: classeABC,
            score_abc_calculado_em: agora
          });
          contatosAtualizados++;
          
          if (contatosAtualizados % 50 === 0) {
            console.log(`[${VERSION}] ✅ ${contatosAtualizados} contatos processados...`);
          }
        } catch (updateErr) {
          console.error(`[${VERSION}] ❌ Erro ao atualizar contato ${contato.id}:`, updateErr.message);
        }
      }
    }

    const resultado = {
      success: true,
      version: VERSION,
      timestamp: agora,
      resultado: {
        total_contatos: contatos.length,
        contatos_atualizados: contatosAtualizados,
        etiquetas_abc_ativas: etiquetasABC.length
      }
    };

    console.log(`[${VERSION}] ✅ Cálculo concluído!`, resultado.resultado);

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