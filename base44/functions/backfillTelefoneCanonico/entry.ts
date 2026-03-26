// Backfill: Preencher telefone_canonico para contatos antigos sem o campo
// v2.0 — Com delay, paginação, e autenticação admin
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const LOTE_TAMANHO = 100;
const DELAY_MS = 500; // 500ms entre updates (150ms foi insuficiente, test atingiu 429)

function extrairCanonicopTeléfone(telefone) {
  if (!telefone) return null;
  const canonico = String(telefone).replace(/\D/g, '');
  return canonico && canonico.length >= 8 ? canonico : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('❌ SDK init error:', e.message);
    return Response.json({ error: 'sdk_init_error', details: e.message }, { status: 500 });
  }

  try {
    // ✅ Validação: apenas admin pode executar
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      console.warn('⚠️ Tentativa de acesso não-admin ao backfill');
      return Response.json({ error: 'forbidden', message: 'Apenas administradores podem executar' }, { status: 403 });
    }

    console.log('🔍 [BACKFILL] Iniciando preenchimento de telefone_canonico...');
    let totalProcessado = 0;
    let totalErro = 0;
    let totalPulado = 0;
    const erros = [];

    // ✅ Paginação: processa todos os contatos, não apenas 100
    let offset = 0;
    while (true) {
      console.log(`📖 [BACKFILL] Buscando lote com offset ${offset}...`);
      
      const contatos = await base44.asServiceRole.entities.Contact.filter(
        { telefone_canonico: { $in: [null, ''] } },
        '-created_date',
        LOTE_TAMANHO
      );

      if (!contatos || contatos.length === 0) {
        console.log('✅ [BACKFILL] Fim da paginação');
        break;
      }

      console.log(`📞 [BACKFILL] Processando lote de ${contatos.length} contatos`);

      for (const contato of contatos) {
        try {
          // Validar telefone
          if (!contato.telefone) {
            console.debug(`⊘ [BACKFILL] ${contato.id}: sem telefone, pulando`);
            totalPulado++;
            continue;
          }

          const canonico = extrairCanonicopTeléfone(contato.telefone);
          if (!canonico) {
            console.debug(`⊘ [BACKFILL] ${contato.id}: telefone inválido "${contato.telefone}"`);
            totalPulado++;
            continue;
          }

          // ✅ Atualizar com delay para evitar 429
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            telefone_canonico: canonico
          });

          totalProcessado++;
          
          // ✅ Delay entre updates
          if (totalProcessado % 10 === 0) {
            console.log(`✅ [BACKFILL] ${totalProcessado} processados até aqui...`);
          }
          await new Promise(r => setTimeout(r, DELAY_MS));
          
        } catch (e) {
          totalErro++;
          const errorMsg = `${contato.id}: ${e.message}`;
          erros.push({ id: contato.id, error: e.message });
          console.error(`❌ [BACKFILL] Erro ao atualizar:`, errorMsg);
          
          // Delay mesmo em caso de erro
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      }

      // Se recebeu menos que o lote, é a última página
      if (contatos.length < LOTE_TAMANHO) {
        console.log('✅ [BACKFILL] Última página atingida');
        break;
      }

      offset += LOTE_TAMANHO;
    }

    const duracao = totalProcessado * DELAY_MS / 1000;
    console.log(`🎉 [BACKFILL] Concluído em ~${duracao}s: ${totalProcessado} processados, ${totalPulado} pulados, ${totalErro} erros`);

    return Response.json({
      success: true,
      totalProcessado,
      totalErro,
      totalPulado,
      estimadoDuracao: `${duracao.toFixed(1)}s`,
      erros: erros.length > 0 ? erros.slice(0, 10) : undefined
    });

  } catch (e) {
    console.error('❌ [BACKFILL] Erro fatal:', e.message);
    return Response.json({ 
      error: 'backfill_error', 
      details: e.message 
    }, { status: 500 });
  }
});