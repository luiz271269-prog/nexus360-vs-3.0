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
      periodo_horas = 48,
      modo = 'diagnostico'
    } = payload;

    console.log('[sincronizarMensagensOrfas]', {
      modo,
      periodo_horas,
      thread_id,
      contact_id
    });

    // PASSO 1: Identificar threads suspeitas
    const dataLimite = new Date(Date.now() - periodo_horas * 60 * 60 * 1000);
    
    let filtroThreads = {
      thread_type: 'contact_external',
      status: { $in: ['aberta', 'fechada', 'arquivada'] }
    };

    if (thread_id) {
      filtroThreads.id = thread_id;
    }
    if (contact_id) {
      filtroThreads.contact_id = contact_id;
    }

    const threads = await base44.asServiceRole.entities.MessageThread.filter(filtroThreads);
    console.log(`[sincronizarMensagensOrfas] 📌 Encontradas ${threads.length} threads para análise`);

    const threadsSuspeitas = [];

    // Analisar cada thread
    for (const thread of threads) {
      if (!thread.contact_id) continue;

      // Contar mensagens realmente associadas
      const mensagensVinculadas = await base44.asServiceRole.entities.Message.filter({
        thread_id: thread.id
      });

      // Threshold: se thread tem pouquíssimas mensagens ou nenhuma, é suspeita
      if ((!mensagensVinculadas || mensagensVinculadas.length === 0) && 
          thread.total_mensagens && thread.total_mensagens > 0) {
        
        const contato = await base44.asServiceRole.entities.Contact.filter({
          id: thread.contact_id
        });

        if (contato && contato.length > 0) {
          threadsSuspeitas.push({
            thread_id: thread.id,
            contact_id: thread.contact_id,
            contato_nome: contato[0].nome,
            telefone_contato: contato[0].telefone,
            mensagens_vinculadas: mensagensVinculadas?.length || 0,
            total_mensagens_esperadas: thread.total_mensagens
          });
        }
      }
    }

    console.log(`[sincronizarMensagensOrfas] 🔍 Threads suspeitas: ${threadsSuspeitas.length}`);

    // PASSO 2: Buscar mensagens órfãs
    const detalhes = [];
    let totalMensagensOrfas = 0;
    let totalRevinculadas = 0;

    for (const threadSuspeita of threadsSuspeitas) {
      const telefoneNormalizado = normalizarTelefone(threadSuspeita.telefone_contato);
      if (!telefoneNormalizado) continue;

      console.log(`[sincronizarMensagensOrfas] 🔎 Buscando órfãs para contato ${threadSuspeita.contato_nome}`);

      // Buscar mensagens criadas nos últimas X horas
      const mensagensOrfas = await buscarMensagensOrfas(
        base44,
        telefoneNormalizado,
        threadSuspeita.thread_id,
        threadSuspeita.contact_id,
        dataLimite
      );

      if (mensagensOrfas.length === 0) continue;

      console.log(`[sincronizarMensagensOrfas] 📭 Encontradas ${mensagensOrfas.length} mensagens órfãs`);
      totalMensagensOrfas += mensagensOrfas.length;

      let revinculadas = 0;

      // PASSO 4: Revinculação
      if (modo === 'correcao') {
        for (const msg of mensagensOrfas) {
          try {
            await base44.asServiceRole.entities.Message.update(msg.id, {
              thread_id: threadSuspeita.thread_id,
              sender_id: msg.sender_id || threadSuspeita.contact_id,
              recipient_id: msg.recipient_id || null
            });

            revinculadas++;
            console.log(`[sincronizarMensagensOrfas] ✅ Mensagem ${msg.id} revinculada`);
          } catch (err) {
            console.error(`[sincronizarMensagensOrfas] ❌ Erro ao revinacular ${msg.id}:`, err.message);
          }
        }

        totalRevinculadas += revinculadas;

        // PASSO 5: Atualizar contadores do thread
        try {
          const todasMensagensAtualizadas = await base44.asServiceRole.entities.Message.filter({
            thread_id: threadSuspeita.thread_id
          });

          const ultimaMensagem = todasMensagensAtualizadas?.[todasMensagensAtualizadas.length - 1];

          await base44.asServiceRole.entities.MessageThread.update(threadSuspeita.thread_id, {
            total_mensagens: todasMensagensAtualizadas?.length || 0,
            last_message_at: ultimaMensagem?.sent_at || new Date().toISOString(),
            last_message_sender: ultimaMensagem?.sender_type === 'contact' ? 'contact' : 'user',
            last_message_content: ultimaMensagem?.content?.substring(0, 100) || ''
          });

          console.log(`[sincronizarMensagensOrfas] 📊 Thread ${threadSuspeita.thread_id} atualizado`);
        } catch (err) {
          console.error('[sincronizarMensagensOrfas] Erro ao atualizar thread:', err.message);
        }
      }

      detalhes.push({
        thread_id: threadSuspeita.thread_id,
        contato_nome: threadSuspeita.contato_nome,
        telefone_contato: threadSuspeita.telefone_contato,
        mensagens_encontradas: mensagensOrfas.length,
        mensagens_revinculadas: revinculadas
      });
    }

    console.log('[sincronizarMensagensOrfas] ✅ Sincronização concluída', {
      threads_analisadas: threads.length,
      threads_suspeitas: threadsSuspeitas.length,
      mensagens_orfas_encontradas: totalMensagensOrfas,
      mensagens_revinculadas: totalRevinculadas,
      modo
    });

    return Response.json({
      success: true,
      threads_analisadas: threads.length,
      threads_suspeitas: threadsSuspeitas.length,
      mensagens_orfas_encontradas: totalMensagensOrfas,
      mensagens_revinculadas: totalRevinculadas,
      modo,
      detalhes
    });

  } catch (error) {
    console.error('[sincronizarMensagensOrfas] ERRO CRÍTICO:', error);
    return Response.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
});

// ============================================
// UTILITÁRIOS
// ============================================

function normalizarTelefone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, '');
  // Pega últimos 10-11 dígitos
  return clean.slice(-11) || clean;
}

async function buscarMensagensOrfas(base44, telefoneBusca, threadCorreto, contactIdCorreto, dataLimite) {
  const mensagensOrfas = [];

  try {
    // Buscar TODAS as mensagens recentes do período
    const todasMensagens = await base44.asServiceRole.entities.Message.filter({
      created_date: { $gte: dataLimite.toISOString() },
      channel: { $in: ['whatsapp', 'instagram', 'facebook'] }
    });

    console.log(`[buscarMensagensOrfas] Total de mensagens no período: ${todasMensagens?.length || 0}`);

    if (!todasMensagens || todasMensagens.length === 0) return mensagensOrfas;

    for (const msg of todasMensagens) {
      // Verificar se mensagem está desvinculada ou mal vinculada
      if (msg.thread_id === threadCorreto && msg.sender_id === contactIdCorreto) {
        // Já está corretamente vinculada
        continue;
      }

      // Buscar telefone em múltiplos campos possíveis
      const telefonesNaMensagem = [
        msg.metadata?.connected_phone,
        msg.metadata?.instance_phone,
        msg.sender_phone,
        msg.recipient_phone
      ].filter(Boolean);

      // Normalizar e comparar
      const temTelefoneCorreto = telefonesNaMensagem.some(tel => {
        const telNorm = normalizarTelefone(tel);
        return telNorm === telefoneBusca;
      });

      if (temTelefoneCorreto) {
        // É uma mensagem órfã que pertence a este contato
        mensagensOrfas.push({
          id: msg.id,
          thread_id_atual: msg.thread_id,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          sender_type: msg.sender_type,
          content: msg.content?.substring(0, 50) || '',
          sent_at: msg.sent_at
        });

        console.log(`[buscarMensagensOrfas] 📭 Órfã encontrada: ${msg.id}`);
      }
    }
  } catch (err) {
    console.error('[buscarMensagensOrfas] Erro ao buscar mensagens:', err.message);
  }

  return mensagensOrfas;
}