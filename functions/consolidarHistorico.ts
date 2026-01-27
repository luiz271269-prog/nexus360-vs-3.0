import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONSOLIDAÇÃO HISTÓRICA - LIMPAR DUPLICATAS ANTIGAS
 * ═══════════════════════════════════════════════════════════════════════════════
 * Elege threads canônicas para cada contact_id e marca duplicatas como merged
 * Processa em lotes para evitar timeout
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const { dry_run = true } = await req.json();

    console.log(`[CONSOLIDACAO] 🚀 Iniciando consolidação (dry_run: ${dry_run})...`);

    const resultado = {
      timestamp: new Date().toISOString(),
      dry_run,
      processados: 0,
      threads_marcadas_canonical: 0,
      threads_marcadas_merged: 0,
      erros: [],
      detalhes: []
    };

    // ═══════════════════════════════════════════════════════════════════
    // 1. BUSCAR TODAS AS THREADS EXTERNAS
    // ═══════════════════════════════════════════════════════════════════
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter(
      { thread_type: 'contact_external' },
      '-primeira_mensagem_at',
      2000
    );

    console.log(`[CONSOLIDACAO] 📊 Total de threads externas: ${todasThreads.length}`);

    // ═══════════════════════════════════════════════════════════════════
    // 2. AGRUPAR POR CONTACT_ID
    // ═══════════════════════════════════════════════════════════════════
    const threadsPorContato = new Map();
    
    for (const thread of todasThreads) {
      if (!thread.contact_id) {
        console.warn(`[CONSOLIDACAO] ⚠️ Thread órfã sem contact_id: ${thread.id}`);
        continue;
      }
      
      if (!threadsPorContato.has(thread.contact_id)) {
        threadsPorContato.set(thread.contact_id, []);
      }
      threadsPorContato.get(thread.contact_id).push(thread);
    }

    console.log(`[CONSOLIDACAO] 👥 Contatos únicos com threads: ${threadsPorContato.size}`);

    // ═══════════════════════════════════════════════════════════════════
    // 3. PROCESSAR CADA GRUPO DE THREADS
    // ═══════════════════════════════════════════════════════════════════
    for (const [contactId, threads] of threadsPorContato) {
      resultado.processados++;
      
      if (threads.length === 1) {
        // Apenas 1 thread - garantir que está marcada como canônica
        const thread = threads[0];
        
        if (!thread.is_canonical || thread.status === 'merged') {
          console.log(`[CONSOLIDACAO] 🔧 Corrigindo thread única: ${thread.id}`);
          
          const detalhe = {
            contact_id: contactId,
            acao: 'corrigir_unica',
            thread_id: thread.id
          };
          
          if (!dry_run) {
            try {
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                is_canonical: true,
                status: 'aberta',
                merged_into: null
              });
              resultado.threads_marcadas_canonical++;
              detalhe.status = 'sucesso';
            } catch (error) {
              detalhe.status = 'erro';
              detalhe.erro = error.message;
              resultado.erros.push(detalhe);
            }
          }
          
          resultado.detalhes.push(detalhe);
        }
        continue;
      }

      // ═══════════════════════════════════════════════════════════════════
      // MÚLTIPLAS THREADS - ELEGER CANÔNICA E MARCAR DEMAIS COMO MERGED
      // ═══════════════════════════════════════════════════════════════════
      console.log(`[CONSOLIDACAO] 🔀 Consolidando ${threads.length} threads para contact: ${contactId.substring(0, 8)}`);
      
      // Ordenar por primeira_mensagem_at (mais antiga primeiro)
      // Se não tiver, usar created_date como fallback
      const threadsOrdenadas = threads.sort((a, b) => {
        const dateA = new Date(a.primeira_mensagem_at || a.created_date || 0);
        const dateB = new Date(b.primeira_mensagem_at || b.created_date || 0);
        return dateA - dateB;
      });
      
      // Thread mais antiga = canônica
      const threadCanonica = threadsOrdenadas[0];
      const threadsDuplicadas = threadsOrdenadas.slice(1);
      
      const detalhe = {
        contact_id: contactId,
        quantidade_threads: threads.length,
        canonical_id: threadCanonica.id,
        duplicadas_ids: threadsDuplicadas.map(t => t.id),
        acao: 'consolidacao'
      };
      
      if (!dry_run) {
        // Marcar canônica
        try {
          await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
            is_canonical: true,
            status: 'aberta',
            merged_into: null
          });
          resultado.threads_marcadas_canonical++;
          detalhe.canonical_status = 'marcada';
        } catch (error) {
          detalhe.canonical_status = 'erro';
          detalhe.canonical_erro = error.message;
          resultado.erros.push({ ...detalhe, etapa: 'marcar_canonical' });
        }
        
        // Marcar duplicadas como merged
        for (const threadDup of threadsDuplicadas) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(threadDup.id, {
              is_canonical: false,
              status: 'merged',
              merged_into: threadCanonica.id
            });
            resultado.threads_marcadas_merged++;
          } catch (error) {
            resultado.erros.push({
              contact_id: contactId,
              thread_id: threadDup.id,
              etapa: 'marcar_merged',
              erro: error.message
            });
          }
        }
        
        detalhe.status = 'sucesso';
      } else {
        detalhe.status = 'simulado';
      }
      
      resultado.detalhes.push(detalhe);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. ESTATÍSTICAS FINAIS
    // ═══════════════════════════════════════════════════════════════════
    resultado.estatisticas = {
      contatos_analisados: todosContatos.length,
      telefones_unicos: threadsPorContato.size,
      contatos_duplicados: resultado.contatos_duplicados.length,
      threads_analisadas: todasThreads.length,
      grupos_processados: resultado.processados,
      threads_marcadas_canonical: resultado.threads_marcadas_canonical,
      threads_marcadas_merged: resultado.threads_marcadas_merged,
      erros_total: resultado.erros.length
    };

    console.log('[CONSOLIDACAO] ✅ Consolidação concluída:', resultado.estatisticas);

    return Response.json({
      success: true,
      resultado
    });

  } catch (error) {
    console.error('[CONSOLIDACAO] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});