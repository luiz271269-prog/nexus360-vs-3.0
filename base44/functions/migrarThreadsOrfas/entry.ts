import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ============================================================================
// MIGRAÇÃO: THREADS ÓRFÃS/DESATUALIZADAS
// ============================================================================
// Corrige threads com whatsapp_integration_id desatualizado ou ausente
// Usa última mensagem recebida como fonte de verdade
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ✅ APENAS ADMIN pode executar migração
    if (user?.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    const { dryRun = true, limit = 500 } = await req.json().catch(() => ({}));

    console.log(`[MIGRAÇÃO] 🔍 Iniciando análise${dryRun ? ' (DRY-RUN)' : ' (EXECUÇÃO REAL)'}...`);

    // 1. Buscar threads abertas/fechadas
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
      status: { $in: ['aberta', 'fechada'] }
    }, '-created_date', limit);

    console.log(`[MIGRAÇÃO] 📊 Total de threads para analisar: ${todasThreads.length}`);

    const resultados = {
      analisadas: 0,
      orfas_integração: 0,
      desatualizadas: 0,
      sem_origin_ids: 0,
      atualizadas: 0,
      erros: 0,
      threads_problematicas: []
    };

    for (const thread of todasThreads) {
      resultados.analisadas++;

      try {
        let needsUpdate = false;
        const updateData = {};

        // PROBLEMA 1: Thread sem integração
        if (!thread.whatsapp_integration_id) {
          resultados.orfas_integração++;
          
          // Buscar última mensagem para descobrir integração correta
          const ultimaMsg = await base44.asServiceRole.entities.Message.filter({
            thread_id: thread.id,
            sender_type: 'contact'
          }, '-sent_at', 1);

          if (ultimaMsg && ultimaMsg.length > 0) {
            const integracaoCorreta = ultimaMsg[0].metadata?.whatsapp_integration_id;
            
            if (integracaoCorreta) {
              updateData.whatsapp_integration_id = integracaoCorreta;
              updateData.origin_integration_ids = [integracaoCorreta];
              needsUpdate = true;
              console.log(`[MIGRAÇÃO] 🔧 Thread órfã: ${thread.id.substring(0, 8)} → Integração: ${integracaoCorreta.substring(0, 8)}`);
            }
          }
        }

        // PROBLEMA 2: Thread com integração desatualizada
        if (thread.whatsapp_integration_id) {
          const ultimaMsg = await base44.asServiceRole.entities.Message.filter({
            thread_id: thread.id,
            sender_type: 'contact'
          }, '-sent_at', 1);

          if (ultimaMsg && ultimaMsg.length > 0) {
            const integracaoNaMensagem = ultimaMsg[0].metadata?.whatsapp_integration_id;
            
            if (integracaoNaMensagem && integracaoNaMensagem !== thread.whatsapp_integration_id) {
              resultados.desatualizadas++;
              updateData.whatsapp_integration_id = integracaoNaMensagem;
              
              // Adicionar ao histórico
              const historicoAtual = thread.origin_integration_ids || [];
              const novoHistorico = [...new Set([...historicoAtual, integracaoNaMensagem])];
              updateData.origin_integration_ids = novoHistorico;
              
              needsUpdate = true;
              console.log(`[MIGRAÇÃO] 🔄 Thread desatualizada: ${thread.id.substring(0, 8)} | Antiga: ${thread.whatsapp_integration_id.substring(0, 8)} → Nova: ${integracaoNaMensagem.substring(0, 8)}`);
            }
          }
        }

        // PROBLEMA 3: Thread sem origin_integration_ids
        if (!thread.origin_integration_ids || thread.origin_integration_ids.length === 0) {
          if (thread.whatsapp_integration_id) {
            resultados.sem_origin_ids++;
            updateData.origin_integration_ids = [thread.whatsapp_integration_id];
            needsUpdate = true;
            console.log(`[MIGRAÇÃO] 📝 Thread sem histórico: ${thread.id.substring(0, 8)}`);
          }
        }

        // Executar update (se não for dry-run)
        if (needsUpdate) {
          if (!dryRun) {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
            resultados.atualizadas++;
          }
          
          resultados.threads_problematicas.push({
            thread_id: thread.id.substring(0, 8),
            contact_id: thread.contact_id?.substring(0, 8),
            problemas: {
              orfa: !thread.whatsapp_integration_id,
              desatualizada: updateData.whatsapp_integration_id !== undefined,
              sem_historico: !thread.origin_integration_ids?.length
            },
            correcao: updateData
          });
        }

      } catch (threadErr) {
        console.error(`[MIGRAÇÃO] ❌ Erro ao processar thread ${thread.id}:`, threadErr.message);
        resultados.erros++;
      }

      // Rate limit protection
      if (resultados.analisadas % 50 === 0) {
        console.log(`[MIGRAÇÃO] 📊 Progresso: ${resultados.analisadas}/${todasThreads.length}`);
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const mensagemFinal = dryRun 
      ? `✅ DRY-RUN concluído. ${resultados.orfas_integração + resultados.desatualizadas + resultados.sem_origin_ids} threads precisam de correção.`
      : `✅ Migração concluída! ${resultados.atualizadas} threads atualizadas.`;

    console.log(`[MIGRAÇÃO] ${mensagemFinal}`);

    return Response.json({
      success: true,
      dry_run: dryRun,
      mensagem: mensagemFinal,
      resultados,
      // Mostrar apenas primeiras 20 threads problemáticas
      exemplos: resultados.threads_problematicas.slice(0, 20)
    });

  } catch (error) {
    console.error('[MIGRAÇÃO] ❌ Erro fatal:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});