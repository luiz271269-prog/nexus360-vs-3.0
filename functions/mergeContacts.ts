import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// FUNÇÃO CENTRALIZADA DE UNIFICAÇÃO DE CONTATOS
// ============================================================================
// Extrai a lógica cirúrgica do UnificadorContatosManual.jsx para backend
// Versão: 1.0.0 - Produção Ready
// Features:
// - Batches de 50 mensagens (evita rate limit)
// - Detecção inteligente de conflitos de threads
// - Atualização de last_message_at com timestamps reais
// - Sincronização de estado threadsMestre em memória
// - Validação de admin
// - Service role para operações privilegiadas
// ============================================================================

const VERSION = '1.0.0';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      version: VERSION, 
      status: 'ready',
      description: 'Unifica contatos duplicados com fusão cirúrgica'
    }, { headers });
  }

  console.log('[MERGE-CONTACTS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[MERGE-CONTACTS] INICIANDO UNIFICAÇÃO CIRÚRGICA');
  
  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    console.error('[MERGE-CONTACTS] ❌ Erro ao inicializar SDK:', e.message);
    return Response.json({ 
      success: false, 
      error: 'Erro ao inicializar SDK: ' + e.message
    }, { status: 500, headers });
  }

  // ✅ VALIDAÇÃO DE ADMIN
  let user;
  try {
    user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      console.log('[MERGE-CONTACTS] ❌ Acesso negado: apenas admin');
      return Response.json({
        success: false,
        error: 'Acesso negado: apenas administradores podem unificar contatos'
      }, { status: 403, headers });
    }
  } catch (e) {
    console.error('[MERGE-CONTACTS] ❌ Erro de autenticação:', e.message);
    return Response.json({
      success: false,
      error: 'Erro de autenticação: ' + e.message
    }, { status: 401, headers });
  }

  // ✅ EXTRAIR PAYLOAD
  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return Response.json({
      success: false,
      error: 'Payload JSON inválido'
    }, { status: 400, headers });
  }

  const { masterContactId, duplicateContactIds } = payload;

  if (!masterContactId || !duplicateContactIds || !Array.isArray(duplicateContactIds) || duplicateContactIds.length === 0) {
    return Response.json({
      success: false,
      error: 'Payload inválido: masterContactId e duplicateContactIds[] são obrigatórios'
    }, { status: 400, headers });
  }

  console.log(`[MERGE-CONTACTS] Master: ${masterContactId}`);
  console.log(`[MERGE-CONTACTS] Duplicatas: ${duplicateContactIds.join(', ')}`);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 0: CARREGAR ENTIDADES
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[MERGE-CONTACTS] STEP 0 - Carregando entidades...');
    
    const masterContact = await base44.asServiceRole.entities.Contact.get(masterContactId);
    if (!masterContact) {
      throw new Error(`Contato mestre ${masterContactId} não encontrado`);
    }

    const duplicateContacts = await Promise.all(
      duplicateContactIds.map(id => base44.asServiceRole.entities.Contact.get(id))
    );

    const validDuplicates = duplicateContacts.filter(c => c !== null);
    if (validDuplicates.length === 0) {
      throw new Error('Nenhuma duplicata válida encontrada');
    }

    console.log(`[MERGE-CONTACTS] ✅ Master: ${masterContact.nome || masterContact.telefone}`);
    console.log(`[MERGE-CONTACTS] ✅ Duplicatas válidas: ${validDuplicates.length}`);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: MERGE DE DADOS (Enriquecimento Inteligente)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[MERGE-CONTACTS] STEP 1 - Merge de dados...');
    
    const updateMestre = {};
    const tagsSet = new Set(masterContact.tags || []);

    for (const dup of validDuplicates) {
      if (!updateMestre.email && dup.email) updateMestre.email = dup.email;
      if (!updateMestre.cargo && dup.cargo) updateMestre.cargo = dup.cargo;
      if (!updateMestre.empresa && dup.empresa) updateMestre.empresa = dup.empresa;
      if (!updateMestre.ramo_atividade && dup.ramo_atividade) updateMestre.ramo_atividade = dup.ramo_atividade;
      
      (dup.tags || []).forEach(tag => tagsSet.add(tag));
    }

    if (tagsSet.size > (masterContact.tags || []).length) {
      updateMestre.tags = Array.from(tagsSet);
    }

    if (Object.keys(updateMestre).length > 0) {
      await base44.asServiceRole.entities.Contact.update(masterContactId, updateMestre);
      console.log(`[MERGE-CONTACTS] ✅ Dados do mestre atualizados:`, Object.keys(updateMestre));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: UNIFICAÇÃO DE THREADS (Detecção Inteligente de Conflitos)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('[MERGE-CONTACTS] STEP 2 - Unificação de threads...');

    // Carregar threads do mestre UMA VEZ e manter em memória
    let threadsMestre = await base44.asServiceRole.entities.MessageThread.filter({ 
      contact_id: masterContactId 
    });

    console.log(`[MERGE-CONTACTS] Threads do mestre carregadas: ${threadsMestre.length}`);

    // Helper: Gerar chave única para thread (blindada contra nulls)
    const getChannelKey = (thread) => {
      const channel = thread.channel || 'whatsapp';
      
      if (channel === 'whatsapp') {
        return thread.whatsapp_integration_id || thread.conexao_id || `legacy_${thread.id}`;
      }
      if (channel === 'instagram') {
        return thread.instagram_integration_id || thread.conexao_id || `legacy_${thread.id}`;
      }
      if (channel === 'facebook') {
        return thread.facebook_integration_id || thread.conexao_id || `legacy_${thread.id}`;
      }
      if (channel === 'phone') {
        return thread.goto_integration_id || thread.conexao_id || `legacy_${thread.id}`;
      }
      if (channel === 'interno') {
        return thread.pair_key || thread.sector_key || `interno_${thread.id}`;
      }
      
      return `unknown_${thread.id}`;
    };

    let totalThreadsMovidas = 0;
    let totalMensagensMovidas = 0;
    let totalInteracoesMovidas = 0;

    // ═══════════════════════════════════════════════════════════════════════
    // PROCESSAR CADA DUPLICATA
    // ═══════════════════════════════════════════════════════════════════════
    for (const duplicata of validDuplicates) {
      console.log(`[MERGE-CONTACTS] 🔄 Processando duplicata: ${duplicata.id} (${duplicata.nome || duplicata.telefone})`);

      // Buscar threads da duplicata
      const threadsDuplicata = await base44.asServiceRole.entities.MessageThread.filter({ 
        contact_id: duplicata.id 
      });

      console.log(`[MERGE-CONTACTS]   → ${threadsDuplicata.length} threads encontradas`);

      for (const threadDup of threadsDuplicata) {
        const channelKey = getChannelKey(threadDup);
        
        // Buscar conflito no estado sincronizado em memória
        const threadConflito = threadsMestre.find(tm => getChannelKey(tm) === channelKey);

        if (threadConflito) {
          // ═════════════════════════════════════════════════════════════════
          // CENÁRIO 1: CONFLITO - Mesclar mensagens em BATCHES de 50
          // ═════════════════════════════════════════════════════════════════
          console.log(`[MERGE-CONTACTS]   ⚠️ Conflito detectado: ${channelKey}`);
          console.log(`[MERGE-CONTACTS]      Thread mestre: ${threadConflito.id}`);
          console.log(`[MERGE-CONTACTS]      Thread duplicata: ${threadDup.id}`);

          // Buscar TODAS as mensagens da thread duplicada
          let offsetMensagens = 0;
          let hasMoreMensagens = true;
          let totalMensagensDuplicata = 0;
          let lastMessageTimestamp = null;

          while (hasMoreMensagens) {
            // Buscar em batches de 50 (evita rate limit)
            const batchMensagens = await base44.asServiceRole.entities.Message.filter(
              { thread_id: threadDup.id },
              '-sent_at',
              50,
              offsetMensagens
            );

            if (batchMensagens.length === 0) {
              hasMoreMensagens = false;
              break;
            }

            console.log(`[MERGE-CONTACTS]      Batch ${Math.floor(offsetMensagens / 50) + 1}: ${batchMensagens.length} mensagens`);

            // Mover cada mensagem para a thread do mestre
            for (const msg of batchMensagens) {
              await base44.asServiceRole.entities.Message.update(msg.id, {
                thread_id: threadConflito.id,
                sender_id: msg.sender_type === 'contact' ? masterContactId : msg.sender_id,
                recipient_id: msg.recipient_type === 'contact' ? masterContactId : msg.recipient_id
              });

              totalMensagensMovidas++;
              totalMensagensDuplicata++;

              // Capturar o timestamp da mensagem mais recente
              if (!lastMessageTimestamp || (msg.sent_at && new Date(msg.sent_at) > new Date(lastMessageTimestamp))) {
                lastMessageTimestamp = msg.sent_at || msg.created_date;
              }
            }

            offsetMensagens += 50;

            // Delay para evitar rate limit
            if (hasMoreMensagens) {
              await new Promise(r => setTimeout(r, 100));
            }
          }

          console.log(`[MERGE-CONTACTS]      ✅ ${totalMensagensDuplicata} mensagens movidas`);

          // Atualizar timestamps da thread mestre com dados REAIS
          const updateThreadMestre = {
            total_mensagens: (threadConflito.total_mensagens || 0) + totalMensagensDuplicata
          };

          if (lastMessageTimestamp) {
            // Atualizar last_message_at com o timestamp REAL da última mensagem movida
            const lastAtual = threadConflito.last_message_at ? new Date(threadConflito.last_message_at) : null;
            const lastNovo = new Date(lastMessageTimestamp);
            
            if (!lastAtual || lastNovo > lastAtual) {
              updateThreadMestre.last_message_at = lastMessageTimestamp;
            }
          }

          await base44.asServiceRole.entities.MessageThread.update(threadConflito.id, updateThreadMestre);

          // Atualizar estado em memória (sincronização)
          const idxMemoria = threadsMestre.findIndex(t => t.id === threadConflito.id);
          if (idxMemoria !== -1) {
            threadsMestre[idxMemoria] = {
              ...threadsMestre[idxMemoria],
              ...updateThreadMestre
            };
          }

          // Marcar thread duplicada como merged e deletar
          await base44.asServiceRole.entities.MessageThread.update(threadDup.id, {
            status: 'merged',
            merged_into: threadConflito.id
          });

          await base44.asServiceRole.entities.MessageThread.delete(threadDup.id);

        } else {
          // ═════════════════════════════════════════════════════════════════
          // CENÁRIO 2: SEM CONFLITO - Reatribuir thread inteira ao mestre
          // ═════════════════════════════════════════════════════════════════
          console.log(`[MERGE-CONTACTS]   ✅ Sem conflito: Reatribuindo thread ${threadDup.id}`);

          await base44.asServiceRole.entities.MessageThread.update(threadDup.id, { 
            contact_id: masterContactId 
          });

          totalThreadsMovidas++;

          // Adicionar ao estado em memória (sincronização)
          threadsMestre.push({
            ...threadDup,
            contact_id: masterContactId
          });
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 3: REDIRECIONAR INTERAÇÕES
      // ═══════════════════════════════════════════════════════════════════════
      const interacoesDuplicata = await base44.asServiceRole.entities.Interacao.filter({ 
        contact_id: duplicata.id 
      });

      for (const int of interacoesDuplicata) {
        await base44.asServiceRole.entities.Interacao.update(int.id, { 
          contact_id: masterContactId 
        });
        totalInteracoesMovidas++;
      }

      console.log(`[MERGE-CONTACTS]   ✅ ${interacoesDuplicata.length} interações movidas`);

      // ═══════════════════════════════════════════════════════════════════════
      // STEP 4: DELETAR CONTATO DUPLICADO
      // ═══════════════════════════════════════════════════════════════════════
      await base44.asServiceRole.entities.Contact.delete(duplicata.id);
      console.log(`[MERGE-CONTACTS]   🗑️ Duplicata ${duplicata.id} deletada`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RESULTADO FINAL
    // ═══════════════════════════════════════════════════════════════════════
    const resultado = {
      success: true,
      masterContactId,
      masterContactName: masterContact.nome || masterContact.telefone,
      stats: {
        duplicatasProcessadas: validDuplicates.length,
        threadsMovidas: totalThreadsMovidas,
        mensagensMovidas: totalMensagensMovidas,
        interacoesMovidas: totalInteracoesMovidas
      },
      timestamp: new Date().toISOString(),
      version: VERSION
    };

    console.log('[MERGE-CONTACTS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[MERGE-CONTACTS] ✅ UNIFICAÇÃO CONCLUÍDA:', resultado.stats);
    console.log('[MERGE-CONTACTS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return Response.json(resultado, { headers });

  } catch (error) {
    console.error('[MERGE-CONTACTS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[MERGE-CONTACTS] ❌ ERRO:', error.message);
    console.error('[MERGE-CONTACTS] Stack:', error.stack);
    console.error('[MERGE-CONTACTS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers });
  }
});