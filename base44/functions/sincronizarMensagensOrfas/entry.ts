import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Sincronizador de Mensagens Órfãs - Protocolo UNIFICACAO_CONTATO_MENSAGENS_PERDIDAS
 * 
 * ESTRATÉGIA 1: Mensagens presas em threads MERGED (causa raiz principal)
 * ESTRATÉGIA 2: Mensagens por sender_id do contato fora da thread canônica (Passo 3.3)
 * ESTRATÉGIA 3: Mensagens órfãs por telefone no metadata (fallback)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      thread_id = null,
      contact_id = null,
      periodo_horas = 72,
      modo = 'diagnostico'
    } = payload;

    console.log('[sincronizarMensagensOrfas] ===== INICIANDO =====');
    console.log('[sincronizarMensagensOrfas]', { modo, periodo_horas, thread_id, contact_id });

    let filtroThreads = { thread_type: 'contact_external' };
    if (thread_id) filtroThreads.id = thread_id;
    if (contact_id) filtroThreads.contact_id = contact_id;

    // Buscar TODAS as threads inclusive merged
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter(filtroThreads);
    console.log(`[sincronizarMensagensOrfas] ${todasThreads.length} threads encontradas (inclusive merged)`);

    const threadsSuspeitas = [];
    let totalMensagensOrfas = 0;
    let totalRevinculadas = 0;
    const detalhes = [];

    // Agrupar por contact_id
    const threadsPorContato = {};
    for (const thread of todasThreads) {
      if (!thread.contact_id) continue;
      if (!threadsPorContato[thread.contact_id]) {
        threadsPorContato[thread.contact_id] = [];
      }
      threadsPorContato[thread.contact_id].push(thread);
    }

    for (const [cid, threads] of Object.entries(threadsPorContato)) {

      // Determinar thread canônica
      let threadCanonica = threads.find(t => t.is_canonical === true && t.status !== 'merged');
      if (!threadCanonica) {
        threadCanonica = threads
          .filter(t => t.status !== 'merged')
          .sort((a, b) => (b.total_mensagens || 0) - (a.total_mensagens || 0))[0];
      }
      if (!threadCanonica) continue;

      let revinculadasTotal = 0;
      const mensagensPreasasIds = new Set();

      // ==============================================================
      // ESTRATÉGIA 1: Mensagens presas em threads não-canônicas
      // ==============================================================
      const threadsSecundarias = threads.filter(t => t.id !== threadCanonica.id);

      for (const threadSec of threadsSecundarias) {
        const mensagensPreasas = await base44.asServiceRole.entities.Message.filter({
          thread_id: threadSec.id
        });

        if (!mensagensPreasas || mensagensPreasas.length === 0) continue;

        for (const m of mensagensPreasas) mensagensPreasasIds.add(m.id);

        console.log(`[sincronizarMensagensOrfas] 📭 [E1] Thread ${threadSec.id} (${threadSec.status}): ${mensagensPreasas.length} msgs presas`);
        totalMensagensOrfas += mensagensPreasas.length;

        threadsSuspeitas.push({
          estrategia: 'thread_merged',
          thread_id_origem: threadSec.id,
          thread_id_destino: threadCanonica.id,
          status_origem: threadSec.status,
          contact_id: cid,
          mensagens_count: mensagensPreasas.length
        });

        let revinculadas = 0;

        if (modo === 'correcao') {
          // ORDEM 1: Migrar mensagens → canônica
          for (const msg of mensagensPreasas) {
            try {
              await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
              revinculadas++;
              console.log(`[sincronizarMensagensOrfas] ✅ [E1] Msg ${msg.id} migrada → ${threadCanonica.id}`);
            } catch (err) {
              console.error(`[sincronizarMensagensOrfas] ❌ Erro ao migrar ${msg.id}:`, err.message);
            }
          }
          totalRevinculadas += revinculadas;
          revinculadasTotal += revinculadas;

          // Marcar thread secundária como merged
          if (threadSec.status !== 'merged') {
            try {
              await base44.asServiceRole.entities.MessageThread.update(threadSec.id, {
                status: 'merged',
                merged_into: threadCanonica.id,
                is_canonical: false
              });
            } catch (err) {}
          }
        }

        // Buscar nome do contato para relatório
        let nomeContato = cid;
        try {
          const cs = await base44.asServiceRole.entities.Contact.filter({ id: cid });
          if (cs?.length > 0) nomeContato = cs[0].nome || cs[0].telefone || cid;
        } catch (_) {}

        detalhes.push({
          estrategia: 'thread_merged',
          contato_nome: nomeContato,
          contact_id: cid,
          thread_id_origem: threadSec.id,
          thread_id_destino: threadCanonica.id,
          status_thread_origem: threadSec.status,
          mensagens_encontradas: mensagensPreasas.length,
          mensagens_revinculadas: revinculadas
        });
      }

      // ==============================================================
      // ESTRATÉGIA 2: Mensagens por sender_id fora da canônica (Passo 3.3)
      // Busca mensagens onde sender_id=contact_id mas thread_id ≠ canônica
      // ==============================================================
      if (contact_id && cid === contact_id) {
        const msgsPorSender = await base44.asServiceRole.entities.Message.filter({
          sender_id: cid,
          sender_type: 'contact'
        });

        const msgsSenderErrado = (msgsPorSender || []).filter(
          m => m.thread_id !== threadCanonica.id && !mensagensPreasasIds.has(m.id)
        );

        if (msgsSenderErrado.length > 0) {
          console.log(`[sincronizarMensagensOrfas] 📭 [E2] ${msgsSenderErrado.length} msgs por sender_id fora da canônica`);
          totalMensagensOrfas += msgsSenderErrado.length;

          threadsSuspeitas.push({
            estrategia: 'sender_id',
            thread_id_destino: threadCanonica.id,
            contact_id: cid,
            mensagens_count: msgsSenderErrado.length
          });

          let revinculadasE2 = 0;
          if (modo === 'correcao') {
            for (const msg of msgsSenderErrado) {
              try {
                await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
                revinculadasE2++;
                console.log(`[sincronizarMensagensOrfas] ✅ [E2] Msg ${msg.id} → ${threadCanonica.id}`);
              } catch (err) {
                console.error(`[sincronizarMensagensOrfas] ❌ [E2] Erro msg ${msg.id}:`, err.message);
              }
            }
            totalRevinculadas += revinculadasE2;
            revinculadasTotal += revinculadasE2;
          }

          detalhes.push({
            estrategia: 'sender_id',
            contact_id: cid,
            thread_id_destino: threadCanonica.id,
            mensagens_encontradas: msgsSenderErrado.length,
            mensagens_revinculadas: revinculadasE2 || 0
          });
        }
      }

      // ORDEM 2: Atualizar total_mensagens da canônica (após todas as migrações)
      if (modo === 'correcao' && revinculadasTotal > 0) {
        try {
          const todasMsgsCanonica = await base44.asServiceRole.entities.Message.filter({
            thread_id: threadCanonica.id
          });
          const ultimaMsg = todasMsgsCanonica?.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

          const threadUpdate = {
            total_mensagens: todasMsgsCanonica?.length || 0,
            is_canonical: true
          };
          if (ultimaMsg?.sent_at || ultimaMsg?.created_date) {
            threadUpdate.last_message_at = ultimaMsg.sent_at || ultimaMsg.created_date;
          }
          if (ultimaMsg?.content) {
            threadUpdate.last_message_content = ultimaMsg.content.substring(0, 100);
          }
          if (ultimaMsg?.sender_type) {
            threadUpdate.last_message_sender = ultimaMsg.sender_type === 'contact' ? 'contact' : 'user';
          }

          await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, threadUpdate);
          console.log(`[sincronizarMensagensOrfas] 📊 Thread canônica ${threadCanonica.id} atualizada: ${todasMsgsCanonica?.length} msgs`);
        } catch (err) {
          console.error('[sincronizarMensagensOrfas] Erro ao atualizar thread canônica:', err.message);
        }
      }
    }

    // ==============================================================
    // ESTRATÉGIA 3: Fallback — órfãs por telefone no metadata
    // Somente se não encontrou nada nas estratégias 1 e 2
    // ==============================================================
    if (contact_id && threadsSuspeitas.length === 0) {
      const dataLimite = new Date(Date.now() - periodo_horas * 60 * 60 * 1000);

      const contatoList = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
      if (contatoList?.length > 0) {
        const contato = contatoList[0];
        const telefoneNorm = normalizarTelefone(contato.telefone);

        if (telefoneNorm) {
          const orfasPorTelefone = await buscarMensagensOrfasPorTelefone(base44, telefoneNorm, contact_id, dataLimite);

          if (orfasPorTelefone.length > 0) {
            totalMensagensOrfas += orfasPorTelefone.length;
            console.log(`[sincronizarMensagensOrfas] 📭 [E3] ${orfasPorTelefone.length} órfãs por telefone`);

            const threadsContato = todasThreads.filter(t => t.contact_id === contact_id && t.status !== 'merged');
            const canonicaFallback = threadsContato.find(t => t.is_canonical) || threadsContato[0];

            let revinculadasE3 = 0;
            if (canonicaFallback && modo === 'correcao') {
              for (const msg of orfasPorTelefone) {
                try {
                  await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: canonicaFallback.id });
                  revinculadasE3++;
                } catch (err) {
                  console.error(`Erro ao migrar ${msg.id}:`, err.message);
                }
              }
              totalRevinculadas += revinculadasE3;

              const todasMsgs = await base44.asServiceRole.entities.Message.filter({ thread_id: canonicaFallback.id });
              await base44.asServiceRole.entities.MessageThread.update(canonicaFallback.id, {
                total_mensagens: todasMsgs?.length || 0
              });
            }

            detalhes.push({
              estrategia: 'por_telefone',
              contato_nome: contato.nome,
              contact_id,
              mensagens_encontradas: orfasPorTelefone.length,
              mensagens_revinculadas: revinculadasE3 || 0
            });
          }
        }
      }
    }

    console.log('[sincronizarMensagensOrfas] ===== CONCLUÍDO =====');
    console.log({
      threads_analisadas: todasThreads.length,
      threads_suspeitas: threadsSuspeitas.length,
      mensagens_orfas_encontradas: totalMensagensOrfas,
      mensagens_revinculadas: totalRevinculadas,
      modo
    });

    return Response.json({
      success: true,
      threads_analisadas: todasThreads.length,
      threads_suspeitas: threadsSuspeitas.length,
      mensagens_orfas_encontradas: totalMensagensOrfas,
      mensagens_revinculadas: totalRevinculadas,
      modo,
      detalhes
    });

  } catch (error) {
    console.error('[sincronizarMensagensOrfas] ERRO CRÍTICO:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

// ============================================
// UTILITÁRIOS
// ============================================

function normalizarTelefone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
  if (clean.length <= 11 && !clean.startsWith('55')) {
    return '55' + clean;
  }
  return clean || '';
}

async function buscarMensagensOrfasPorTelefone(base44, telefoneBusca, contactIdCorreto, dataLimite) {
  const mensagensOrfas = [];
  try {
    const todasMensagens = await base44.asServiceRole.entities.Message.filter({
      created_date: { $gte: dataLimite.toISOString() },
      channel: { $in: ['whatsapp', 'instagram', 'facebook'] }
    });

    for (const msg of todasMensagens || []) {
      if (msg.sender_id === contactIdCorreto) continue;

      const telefonesNaMensagem = [
        msg.metadata?.connected_phone,
        msg.metadata?.instance_phone,
        msg.sender_phone,
        msg.recipient_phone
      ].filter(Boolean);

      const temTelefone = telefonesNaMensagem.some(tel => normalizarTelefone(tel) === telefoneBusca);
      if (temTelefone) {
        mensagensOrfas.push(msg);
      }
    }
  } catch (err) {
    console.error('[buscarMensagensOrfasPorTelefone] Erro:', err.message);
  }
  return mensagensOrfas;
}