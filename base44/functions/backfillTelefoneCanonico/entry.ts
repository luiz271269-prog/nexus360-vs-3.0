// Backfill: Preencher telefone_canonico para contatos antigos sem o campo
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function extrairCanonicopTeléfone(telefone) {
  if (!telefone) return null;
  return String(telefone).replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ error: 'sdk_init_error', details: e.message }, { status: 500 });
  }

  try {
    // Buscar contatos sem telefone_canonico (null ou '')
    console.log('🔍 Buscando contatos sem telefone_canonico...');
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { telefone_canonico: { $in: [null, ''] } },
      '-created_date',
      100
    );

    if (!contatos || contatos.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhum contato com telefone_canonico vazio encontrado',
        totalProcessado: 0
      });
    }

    console.log(`📞 Encontrados ${contatos.length} contatos para processar`);

    let totalProcessado = 0;
    let totalErro = 0;
    const erros = [];

    for (const contato of contatos) {
      try {
        if (!contato.telefone) {
          console.warn(`⚠️ Contato ${contato.id} sem telefone, pulando...`);
          totalErro++;
          continue;
        }

        const canonico = extrairCanonicopTeléfone(contato.telefone);
        if (!canonico) {
          console.warn(`⚠️ Contato ${contato.id} com telefone inválido: ${contato.telefone}`);
          totalErro++;
          continue;
        }

        // Atualizar com telefone_canonico
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          telefone_canonico: canonico
        });

        totalProcessado++;
        if (totalProcessado % 10 === 0) {
          console.log(`✅ Processados ${totalProcessado}/${contatos.length}`);
        }
      } catch (e) {
        totalErro++;
        erros.push({ id: contato.id, error: e.message });
        console.error(`❌ Erro ao atualizar ${contato.id}:`, e.message);
      }
    }

    console.log(`🎉 Backfill concluído: ${totalProcessado} sucesso, ${totalErro} erro`);

    return Response.json({
      success: true,
      totalProcessado,
      totalErro,
      totalEncontrado: contatos.length,
      erros: erros.length > 0 ? erros : undefined
    });
  } catch (e) {
    console.error('❌ Erro fatal:', e.message);
    return Response.json({ 
      error: 'backfill_error', 
      details: e.message 
    }, { status: 500 });
  }
});