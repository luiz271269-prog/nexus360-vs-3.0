import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ════════════════════════════════════════════════════════════════════════
 * FUNÇÃO BACKEND CENTRALIZADA - MERGE DE CONTATOS
 * ════════════════════════════════════════════════════════════════════════
 * 
 * ✅ ÚNICA FONTE DE VERDADE para unificação de contatos
 * ✅ Consolida lógica de UnificadorContatosManual (melhor implementação)
 * ✅ Features:
 *    - Merge de dados inteligente (sem sobrescrever)
 *    - Detecção de conflitos de threads por canal+integração
 *    - Movimentação em lotes (50 msgs por vez - evita rate limit)
 *    - Timestamps reais (last_message_at correto)
 *    - Reatribuição de interações
 *    - Limpeza completa e delete seguro
 * 
 * @param {string} masterContactId - ID do contato mestre (mantido)
 * @param {string[]} duplicateContactIds - IDs dos contatos duplicados (deletados)
 * 
 * @returns {object} {
 *   success: boolean,
 *   error?: string,
 *   stats: {
 *     duplicatasProcessadas: number,
 *     threadsMovidas: number,
 *     mensagensMovidas: number,
 *     interacoesMovidas: number
 *   },
 *   masterContactName: string
 * }
 * 
 * v2.0.0 - Backend centralizado
 */

const VERSION = 'v2.0.0';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return Response.json({ 
      error: 'Método não permitido. Use POST.',
      version: VERSION 
    }, { status: 405, headers });
  }

  console.log('[MERGE] ════════════════════════════════════════════════════════');
  console.log('[MERGE] INICIANDO UNIFICAÇÃO DE CONTATOS');

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (error) {
    console.error('[MERGE] ❌ Erro ao inicializar SDK:', error);
    return Response.json({
      success: false,
      error: 'Erro ao inicializar SDK: ' + error.message
    }, { status: 500, headers });
  }

  try {
    const { masterContactId, duplicateContactIds } = await req.json();

    // Validações
    if (!masterContactId || !duplicateContactIds || !Array.isArray(duplicateContactIds)) {
      return Response.json({
        success: false,
        error: 'Parâmetros inválidos. Esperado: { masterContactId: string, duplicateContactIds: string[] }'
      }, { status: 400, headers });
    }

    // Se lista vazia, apenas consolidada a mestre (agrupa threads se duplicadas)
    if (duplicateContactIds.length === 0) {
      console.log('[MERGE] ℹ️ Consolidando threads do mestre (sem duplicatas)...');
      
      // Buscar threads do mestre
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: masterContactId
      });
      
      console.log('[MERGE] Threads do mestre:', threads.length);
      
      return Response.json({
        success: true,
        stats: {
          duplicatasProcessadas: 0,
          threadsMovidas: 0,
          mensagensMovidas: 0,
          interacoesMovidas: 0
        },
        masterContactName: mestre.nome || mestre.telefone,
        message: 'Consolidação concluída (sem duplicatas para mesclar)',
        version: VERSION
      }, { headers });
    }

    console.log('[MERGE] Master:', masterContactId);
    console.log('[MERGE] Duplicatas:', duplicateContactIds);

    // Buscar contato mestre
    const mestre = await base44.asServiceRole.entities.Contact.get(masterContactId);
    if (!mestre) {
      return Response.json({
        success: false,
        error: 'Contato mestre não encontrado'
      }, { status: 404, headers });
    }

    console.log('[MERGE] ✅ Mestre carregado:', mestre.nome || mestre.telefone);

    // Estatísticas
    const stats = {
      duplicatasProcessadas: 0,
      threadsMovidas: 0,
      mensagensMovidas: 0,
      interacoesMovidas: 0
    };

    // Carregar threads do mestre UMA VEZ (para detectar conflitos)
    const threadsMestre = await base44.asServiceRole.entities.MessageThread.filter({ 
      contact_id: masterContactId 
    });
    console.log('[MERGE] Threads do mestre:', threadsMestre.length);

    // ════════════════════════════════════════════════════════════════════
    // PROCESSAR CADA DUPLICATA
    // ════════════════════════════════════════════════════════════════════
    for (const duplicataId of duplicateContactIds) {
      console.log('[MERGE] ─────────────────────────────────────────────────');
      console.log('[MERGE] Processando duplicata:', duplicataId);

      // ✅ DELAY anti-rate-limit entre duplicatas
      await new Promise(r => setTimeout(r, 300));

      // Buscar duplicata (ignorar se já deletada/não encontrada)
      let duplicata;
      try {
        duplicata = await base44.asServiceRole.entities.Contact.get(duplicataId);
      } catch (e) {
        if (e.status === 404) {
          console.warn('[MERGE] ⚠️ Duplicata já deletada ou não encontrada, pulando:', duplicataId);
          continue;
        }
        throw e;
      }
      if (!duplicata) {
        console.warn('[MERGE] ⚠️ Duplicata não encontrada, pulando:', duplicataId);
        continue;
      }

      // ──────────────────────────────────────────────────────────────────
      // 1. MERGE DE DADOS (sem sobrescrever dados existentes)
      // ──────────────────────────────────────────────────────────────────
      const updateMestre = {};
      
      if (!mestre.email && duplicata.email) updateMestre.email = duplicata.email;
      if (!mestre.cargo && duplicata.cargo) updateMestre.cargo = duplicata.cargo;
      if (!mestre.empresa && duplicata.empresa) updateMestre.empresa = duplicata.empresa;
      if (!mestre.foto_perfil_url && duplicata.foto_perfil_url) {
        updateMestre.foto_perfil_url = duplicata.foto_perfil_url;
      }
      
      // Merge de tags (união)
      const tagsSet = new Set(mestre.tags || []);
      (duplicata.tags || []).forEach(t => tagsSet.add(t));
      if (tagsSet.size > (mestre.tags || []).length) {
        updateMestre.tags = Array.from(tagsSet);
      }

      if (Object.keys(updateMestre).length > 0) {
        await base44.asServiceRole.entities.Contact.update(masterContactId, updateMestre);
        console.log('[MERGE] ✅ Dados mesclados:', Object.keys(updateMestre));
      }

      // ──────────────────────────────────────────────────────────────────
      // 2. MERGE DE THREADS
      // ──────────────────────────────────────────────────────────────────
      const threadsDup = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: duplicataId
      });
      console.log('[MERGE] Threads da duplicata:', threadsDup.length);

      for (const threadDup of threadsDup) {
        // Chave de canal blindada (canal + integração)
        const getChannelKey = (t) => {
          const ch = t.channel || 'desconhecido';
          let intId = 'nulo';
          if (ch === 'whatsapp') intId = t.whatsapp_integration_id || t.conexao_id || 'nulo';
          else if (ch === 'instagram') intId = t.instagram_integration_id;
          else if (ch === 'facebook') intId = t.facebook_integration_id;
          else if (ch === 'phone') intId = t.goto_integration_id;
          else if (ch === 'interno') intId = 'internal';
          return `${ch}:${intId}`;
        };

        const keyDup = getChannelKey(threadDup);
        const threadConflito = threadsMestre.find(tm => getChannelKey(tm) === keyDup);

        if (threadConflito) {
          // ───────────────────────────────────────────────────────────────
          // CONFLITO: Mover mensagens em LOTES
          // ───────────────────────────────────────────────────────────────
          console.log('[MERGE] 🔀 Conflito detectado:', keyDup);
          let movidasAqui = 0;

          while (true) {
            const msgs = await base44.asServiceRole.entities.Message.filter(
              { thread_id: threadDup.id },
              '-sent_at',
              500
            );
            if (msgs.length === 0) break;

            // Lotes de 50 para evitar rate limit
            const chunkSize = 50;
            for (let i = 0; i < msgs.length; i += chunkSize) {
              const batch = msgs.slice(i, i + chunkSize);
              await Promise.all(batch.map(m => 
                base44.asServiceRole.entities.Message.update(m.id, {
                  thread_id: threadConflito.id,
                  recipient_id: masterContactId
                })
              ));
            }

            movidasAqui += msgs.length;
            if (msgs.length < 500) break;
          }

          console.log('[MERGE] ✅ Mensagens movidas:', movidasAqui);
          stats.mensagensMovidas += movidasAqui;

          // Atualizar last_message_at REAL
          if (movidasAqui > 0) {
            const lastMsgs = await base44.asServiceRole.entities.Message.filter(
              { thread_id: threadConflito.id },
              '-sent_at',
              1
            );
            const lastAt = lastMsgs[0]?.sent_at || lastMsgs[0]?.created_date || new Date().toISOString();
            
            await base44.asServiceRole.entities.MessageThread.update(threadConflito.id, {
              last_message_at: lastAt,
              total_mensagens: (threadConflito.total_mensagens || 0) + movidasAqui
            });

            // Atualizar memória
            const idx = threadsMestre.findIndex(tm => tm.id === threadConflito.id);
            if (idx !== -1) {
              threadsMestre[idx].last_message_at = lastAt;
              threadsMestre[idx].total_mensagens = (threadConflito.total_mensagens || 0) + movidasAqui;
            }
          }

          // Marcar thread antiga como merged
          await base44.asServiceRole.entities.MessageThread.update(threadDup.id, {
            status: 'merged',
            is_canonical: false,
            merged_into: threadConflito.id
          });

        } else {
          // ───────────────────────────────────────────────────────────────
          // SEM CONFLITO: Reatribuir thread
          // ───────────────────────────────────────────────────────────────
          await base44.asServiceRole.entities.MessageThread.update(threadDup.id, {
            contact_id: masterContactId,
            is_canonical: true
          });

          // Adicionar ao array em memória
          threadsMestre.push({
            ...threadDup,
            contact_id: masterContactId,
            is_canonical: true
          });

          stats.threadsMovidas++;
          console.log('[MERGE] ✅ Thread reatribuída:', threadDup.id);
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // 3. INTERAÇÕES
      // ──────────────────────────────────────────────────────────────────
      const interacoes = await base44.asServiceRole.entities.Interacao.filter({
        contact_id: duplicataId
      });
      
      for (const int of interacoes) {
        await base44.asServiceRole.entities.Interacao.update(int.id, {
          contact_id: masterContactId
        });
      }
      stats.interacoesMovidas += interacoes.length;
      console.log('[MERGE] ✅ Interações movidas:', interacoes.length);

      // ──────────────────────────────────────────────────────────────────
      // 4. LIMPEZA E DELETE
      // ──────────────────────────────────────────────────────────────────
      // Validar threads restantes
      const threadsFinais = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: duplicataId
      });
      const ativas = threadsFinais.filter(t => t.status !== 'merged');
      
      if (ativas.length > 0) {
        console.warn('[MERGE] ⚠️ Threads ativas restantes, reatribuindo:', ativas.length);
        for (const t of ativas) {
          await base44.asServiceRole.entities.MessageThread.update(t.id, {
            contact_id: masterContactId
          });
        }
      }

      // DELETE da duplicata
      await base44.asServiceRole.entities.Contact.delete(duplicataId);
      stats.duplicatasProcessadas++;
      console.log('[MERGE] ✅ Duplicata deletada:', duplicataId);
    }

    // ════════════════════════════════════════════════════════════════════
    // 🆕 PÓS-PROCESSAMENTO: CONSOLIDAR PARA UMA ÚNICA THREAD CANÔNICA
    // ════════════════════════════════════════════════════════════════════
    console.log('[MERGE] 🔄 Consolidando múltiplas threads em uma única canônica...');
    
    const threadsFinaisDoMestre = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: masterContactId,
      status: { $ne: 'merged' } // Excluir as já merged
    });
    
    console.log('[MERGE] Threads finais do mestre:', threadsFinaisDoMestre.length);
    
    if (threadsFinaisDoMestre.length > 1) {
      // Usar a primeira thread como canônica
      const threadCanonica = threadsFinaisDoMestre[0];
      console.log('[MERGE] ✅ Thread canônica selecionada:', threadCanonica.id);
      
      // Mover mensagens de todas as outras para a canônica
      for (let i = 1; i < threadsFinaisDoMestre.length; i++) {
        const threadSecundaria = threadsFinaisDoMestre[i];
        console.log('[MERGE] 🔀 Consolidando thread:', threadSecundaria.id);
        
        // Mover mensagens em lotes
        let movidasAqui = 0;
        while (true) {
          const msgs = await base44.asServiceRole.entities.Message.filter(
            { thread_id: threadSecundaria.id },
            '-sent_at',
            500
          );
          if (msgs.length === 0) break;
          
          const chunkSize = 50;
          for (let j = 0; j < msgs.length; j += chunkSize) {
            const batch = msgs.slice(j, j + chunkSize);
            await Promise.all(batch.map(m => 
              base44.asServiceRole.entities.Message.update(m.id, {
                thread_id: threadCanonica.id
              })
            ));
          }
          
          movidasAqui += msgs.length;
          if (msgs.length < 500) break;
        }
        
        stats.mensagensMovidas += movidasAqui;
        
        // Marcar como merged
        await base44.asServiceRole.entities.MessageThread.update(threadSecundaria.id, {
          status: 'merged',
          is_canonical: false,
          merged_into: threadCanonica.id
        });
        
        console.log('[MERGE] ✅ Thread consolidada:', movidasAqui, 'mensagens movidas');
      }
      
      // Atualizar last_message_at da thread canônica
      const lastMsgs = await base44.asServiceRole.entities.Message.filter(
        { thread_id: threadCanonica.id },
        '-sent_at',
        1
      );
      const lastAt = lastMsgs[0]?.sent_at || lastMsgs[0]?.created_date || new Date().toISOString();
      
      await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
        last_message_at: lastAt,
        total_mensagens: threadsFinaisDoMestre.reduce((sum, t) => sum + (t.total_mensagens || 0), 0)
      });
      
      console.log('[MERGE] ✅ Thread canônica atualizada');
    }

    console.log('[MERGE] ════════════════════════════════════════════════════════');
    console.log('[MERGE] ✅ UNIFICAÇÃO COMPLETA');
    console.log('[MERGE] Stats:', stats);
    console.log('[MERGE] ════════════════════════════════════════════════════════');

    return Response.json({
      success: true,
      stats: stats,
      masterContactName: mestre.nome || mestre.telefone,
      version: VERSION
    }, { headers });

  } catch (error) {
    console.error('[MERGE] ❌ ERRO:', error);
    console.error('[MERGE] Stack:', error.stack);
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers });
  }
});