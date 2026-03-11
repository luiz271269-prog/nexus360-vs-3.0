import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    console.log('[sincronizarMensagensOrfas]', { modo, periodo_horas, thread_id, contact_id });

    // ==============================================================
    // ESTRATÉGIA 1: Mensagens presas em threads MERGED (causa raiz DEJAIR)
    // Busca TODAS as threads do contato, inclusive merged
    // ==============================================================

    let filtroThreads = { thread_type: 'contact_external' };
    if (thread_id) filtroThreads.id = thread_id;
    if (contact_id) filtroThreads.contact_id = contact_id;

    // ⚠️ CRÍTICO: incluir threads merged — é onde as mensagens ficam presas
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter(filtroThreads);
    console.log(`[sincronizarMensagensOrfas] ${todasThreads.length} threads encontradas (inclusive merged)`);

    const threadsSuspeitas = [];
    let totalMensagensOrfas = 0;
    let totalRevinculadas = 0;
    const detalhes = [];

    // Agrupar threads por contact_id para encontrar a canônica de cada contato
    const threadsPorContato = {};
    for (const thread of todasThreads) {
      if (!thread.contact_id) continue;
      if (!threadsPorContato[thread.contact_id]) {
        threadsPorContato[thread.contact_id] = [];
      }
      threadsPorContato[thread.contact_id].push(thread);
    }

    for (const [cid, threads] of Object.entries(threadsPorContato)) {
      // Encontrar a thread canônica do contato
      let threadCanonica = threads.find(t => t.is_canonical === true && t.status !== 'merged');
      if (!threadCanonica) {
        threadCanonica = threads
          .filter(t => t.status !== 'merged')
          .sort((a, b) => (b.total_mensagens || 0) - (a.total_mensagens || 0))[0];
      }
      if (!threadCanonica) continue;

      // Verificar threads não-canônicas (merged, fechadas, etc.) que têm mensagens presas
      const threadsSecundarias = threads.filter(t => t.id !== threadCanonica.id);

      for (const threadSec of threadsSecundarias) {
        const mensagensPreasas = await base44.asServiceRole.entities.Message.filter({
          thread_id: threadSec.id
        });

        if (!mensagensPreasas || mensagensPreasas.length === 0) continue;

        console.log(`[sincronizarMensagensOrfas] 📭 Thread ${threadSec.id} (${threadSec.status}) tem ${mensagensPreasas.length} mensagens presas`);
        totalMensagensOrfas += mensagensPreasas.length;

        threadsSuspeitas.push({
          thread_id_origem: threadSec.id,
          thread_id_destino: threadCanonica.id,
          status_origem: threadSec.status,
          contact_id: cid,
          mensagens: mensagensPreasas
        });

        let revinculadas = 0;

        if (modo === 'correcao') {
          // Migrar mensagens presas → thread canônica
          for (const msg of mensagensPreasas) {
            try {
              await base44.asServiceRole.entities.Message.update(msg.id, {
                thread_id: threadCanonica.id
              });
              revinculadas++;
              console.log(`[sincronizarMensagensOrfas] ✅ Mensagem ${msg.id} migrada para ${threadCanonica.id}`);
            } catch (err) {
              console.error(`[sincronizarMensagensOrfas] ❌ Erro ao migrar ${msg.id}:`, err.message);
            }
          }

          totalRevinculadas += revinculadas;

          // Atualizar total_mensagens da canônica com contagem real
          if (revinculadas > 0) {
            try {
              const todasMsgsCanonica = await base44.asServiceRole.entities.Message.filter({
                thread_id: threadCanonica.id
              });

              const ultimaMsg = todasMsgsCanonica?.[todasMsgsCanonica.length - 1];

              const threadUpdate = {
                total_mensagens: todasMsgsCanonica?.length || 0,
                is_canonical: true
              };
              if (ultimaMsg?.sent_at) threadUpdate.last_message_at = ultimaMsg.sent_at;
              if (ultimaMsg?.content) threadUpdate.last_message_content = ultimaMsg.content.substring(0, 100);
              if (ultimaMsg?.sender_type) threadUpdate.last_message_sender = ultimaMsg.sender_type === 'contact' ? 'contact' : 'user';

              await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, threadUpdate);
              console.log(`[sincronizarMensagensOrfas] 📊 Thread canônica ${threadCanonica.id} atualizada: ${todasMsgsCanonica?.length} msgs`);
            } catch (err) {
              console.error('[sincronizarMensagensOrfas] Erro ao atualizar thread canônica:', err.message);
            }
          }
        }

        // Buscar nome do contato para relatório
        let nomeContato = cid;
        try {
          const cs = await base44.asServiceRole.entities.Contact.filter({ id: cid });
          if (cs?.length > 0) nomeContato = cs[0].nome || cs[0].telefone || cid;
        } catch (_) {}

        detalhes.push({
          contato_nome: nomeContato,
          contact_id: cid,
          thread_id_origem: threadSec.id,
          thread_id_destino: threadCanonica.id,
          status_thread_origem: threadSec.status,
          mensagens_encontradas: mensagensPreasas.length,
          mensagens_revinculadas: revinculadas
        });
      }
    }

    // ==============================================================
    // ESTRATÉGIA 2: Mensagens órfãs por telefone no metadata (fallback)
    // Busca mensagens recentes sem thread válida usando phone matching
    // ==============================================================
    if (contact_id && threadsSuspeitas.length === 0) {
      const dataLimite = new Date(Date.now() - periodo_horas * 60 * 60 * 1000);

      const contatoList = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
      if (contatoList?.length > 0) {
        const contato = contatoList[0];
        const telefoneNorm = normalizarTelefone(contato.telefone);

        if (telefoneNorm) {
          const orfasPorTelefone = await buscarMensagensOrfasPorTelefone(
            base44, telefoneNorm, contact_id, dataLimite
          );

          if (orfasPorTelefone.length > 0) {
            totalMensagensOrfas += orfasPorTelefone.length;
            console.log(`[sincronizarMensagensOrfas] 📭 Estratégia 2: ${orfasPorTelefone.length} órfãs por telefone`);

            // Encontrar thread canônica para esse contato
            const threadsContato = todasThreads.filter(t => t.contact_id === contact_id && t.status !== 'merged');
            const canonicaFallback = threadsContato.find(t => t.is_canonical) || threadsContato[0];

            if (canonicaFallback && modo === 'correcao') {
              for (const msg of orfasPorTelefone) {
                try {
                  await base44.asServiceRole.entities.Message.update(msg.id, {
                    thread_id: canonicaFallback.id
                  });
                  totalRevinculadas++;
                } catch (err) {
                  console.error(`Erro ao migrar ${msg.id}:`, err.message);
                }
              }

              const todasMsgs = await base44.asServiceRole.entities.Message.filter({ thread_id: canonicaFallback.id });
              await base44.asServiceRole.entities.MessageThread.update(canonicaFallback.id, {
                total_mensagens: todasMsgs?.length || 0
              });
            }

            detalhes.push({
              contato_nome: contato.nome,
              contact_id,
              estrategia: 'por_telefone',
              mensagens_encontradas: orfasPorTelefone.length,
              mensagens_revinculadas: modo === 'correcao' ? orfasPorTelefone.length : 0
            });
          }
        }
      }
    }

    console.log('[sincronizarMensagensOrfas] ✅ Concluído', {
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