import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * UNIFICACAO_CONTATO_MENSAGENS_PERDIDAS - Protocolo Completo (7 Passos)
 * 
 * PASSO 1: Busca e identificação do contato (campos críticos)
 * PASSO 2: Busca TODAS as threads do contato (canonical, merged, órfãs)
 * PASSO 3: Diagnóstico de mensagens perdidas (threads merged + sender_id)
 * PASSO 4: Diagnóstico de dados desatualizados (scores, flags, segmentação)
 * PASSO 5: Plano de reparação
 * PASSO 6: Aplicar correções na ORDEM CORRETA (msgs → thread → contato)
 * PASSO 7: Checklist final de validação
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    const { contact_id, corrigir = false } = payload;

    if (!contact_id) {
      return Response.json({ error: 'contact_id é obrigatório' }, { status: 400 });
    }

    console.log(`[sincronizarContactoErros] ===== INICIANDO PROTOCOLO COMPLETO =====`);
    console.log(`[sincronizarContactoErros] contact=${contact_id}, corrigir=${corrigir}`);

    // ============================================================
    // PASSO 1 — BUSCA E IDENTIFICAÇÃO DO CONTATO
    // ============================================================
    const contatos = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (!contatos || contatos.length === 0) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }
    const contato = contatos[0];
    const erros = [];
    const corrigidos = [];
    const contactUpdates = {};

    console.log(`[sincronizarContactoErros] Contato: ${contato.nome} | ${contato.telefone} | tipo=${contato.tipo_contato}`);

    // ============================================================
    // PASSO 2 — BUSCA DE TODAS AS THREADS DO CONTATO
    // ============================================================
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: contact_id
    });

    console.log(`[sincronizarContactoErros] Threads encontradas: ${todasThreads.length}`);

    // Classificar threads
    const threadsCanonical = todasThreads.filter(t => t.is_canonical === true && t.status !== 'merged');
    const threadsMerged = todasThreads.filter(t => t.status === 'merged');
    const threadsSemCanonical = todasThreads.filter(t => t.status !== 'merged');

    // Verificar duplicidade de is_canonical
    if (threadsCanonical.length > 1) {
      erros.push({
        tipo: 'multiplas_canonicas',
        descricao: `BUG: ${threadsCanonical.length} threads com is_canonical=true`,
        threads: threadsCanonical.map(t => t.id)
      });
    }

    // Selecionar a thread canônica definitiva
    let threadCanonica = threadsCanonical[0];
    if (!threadCanonica) {
      threadCanonica = threadsSemCanonical.sort((a, b) => (b.total_mensagens || 0) - (a.total_mensagens || 0))[0];
      if (threadCanonica) {
        erros.push({
          tipo: 'sem_thread_canonica',
          descricao: 'Nenhuma thread com is_canonical=true — usando a com mais mensagens como fallback',
          thread_escolhida: threadCanonica.id
        });
      }
    }

    // ============================================================
    // PASSO 3 — DIAGNÓSTICO DE MENSAGENS PERDIDAS
    // ============================================================

    // 3.1: Mensagens presas em threads merged/não-canônicas
    const mensagensPorThread = {};
    let totalMensagensPresasThreads = 0;

    for (const thread of todasThreads) {
      if (!threadCanonica || thread.id === threadCanonica.id) continue;
      const msgs = await base44.asServiceRole.entities.Message.filter({ thread_id: thread.id });
      if (msgs && msgs.length > 0) {
        mensagensPorThread[thread.id] = msgs;
        totalMensagensPresasThreads += msgs.length;
        console.log(`[sincronizarContactoErros] ⚠️ Thread ${thread.id} (${thread.status}): ${msgs.length} mensagens PRESAS`);
        erros.push({
          tipo: 'mensagens_presas_thread_merged',
          descricao: `Thread ${thread.id} (${thread.status}) tem ${msgs.length} mensagens invisíveis`,
          thread_id: thread.id,
          count: msgs.length
        });
      }
    }

    // 3.2: Mensagens enviadas pelo contato com sender_id em thread errada
    const msgsPorSenderId = await base44.asServiceRole.entities.Message.filter({
      sender_id: contact_id,
      sender_type: 'contact'
    });

    let mensagensSenderIdErrado = 0;
    const msgsSenderIdParaMigrar = [];

    if (threadCanonica && msgsPorSenderId && msgsPorSenderId.length > 0) {
      for (const msg of msgsPorSenderId) {
        if (msg.thread_id !== threadCanonica.id) {
          // Verificar se já está mapeada na lista de threads presas
          const jaContada = mensagensPorThread[msg.thread_id]?.some(m => m.id === msg.id);
          if (!jaContada) {
            msgsSenderIdParaMigrar.push(msg);
            mensagensSenderIdErrado++;
          }
        }
      }
      if (mensagensSenderIdErrado > 0) {
        erros.push({
          tipo: 'mensagens_sender_thread_errada',
          descricao: `${mensagensSenderIdErrado} mensagem(ns) do contato em threads fora da canônica`,
          count: mensagensSenderIdErrado
        });
        console.log(`[sincronizarContactoErros] ⚠️ ${mensagensSenderIdErrado} msgs por sender_id em thread errada`);
      }
    }

    // ============================================================
    // PASSO 4 — DIAGNÓSTICO DE DADOS DESATUALIZADOS
    // ============================================================
    const totalMsgsContato = msgsPorSenderId?.length || 0;
    const temHistorico = totalMsgsContato > 0 || (todasThreads.length > 0);

    // 4.1: Verificar telefone_canonico
    const telefoneNorm = normalizarTelefone(contato.telefone);
    if (!contato.telefone || !contato.telefone.trim()) {
      erros.push({ tipo: 'telefone_vazio', descricao: 'Campo telefone está vazio', campo: 'telefone' });
    }
    if (!contato.telefone_canonico || !contato.telefone_canonico.trim()) {
      erros.push({ tipo: 'telefone_canonico_vazio', descricao: 'telefone_canonico não preenchido', campo: 'telefone_canonico' });
      if (telefoneNorm) contactUpdates.telefone_canonico = telefoneNorm;
    } else if (telefoneNorm && contato.telefone_canonico !== telefoneNorm) {
      erros.push({
        tipo: 'telefone_canonico_incorreto',
        descricao: `telefone_canonico incorreto: "${contato.telefone_canonico}" → "${telefoneNorm}"`,
        campo: 'telefone_canonico'
      });
      contactUpdates.telefone_canonico = telefoneNorm;
    }

    // 4.2: Verificar nome
    const nomePuro = (contato.nome || '').trim();
    if (!nomePuro) {
      erros.push({ tipo: 'nome_vazio', descricao: 'Campo nome está vazio', campo: 'nome' });
      const nomeGerado = contato.empresa || `Contato ${contato.telefone}`;
      contactUpdates.nome = nomeGerado;
    } else if (nomePuro.match(/^\+?\d+$/)) {
      erros.push({ tipo: 'nome_igual_telefone', descricao: 'Nome contém apenas números', campo: 'nome' });
    }

    // 4.3: Verificar duplicatas por telefone
    if (telefoneNorm) {
      const duplicatas = await base44.asServiceRole.entities.Contact.filter({
        telefone_canonico: telefoneNorm,
        id: { $ne: contact_id }
      });
      if (duplicatas && duplicatas.length > 0) {
        erros.push({
          tipo: 'duplicata_encontrada',
          descricao: `Encontradas ${duplicatas.length} duplicata(s) com mesmo telefone`,
          duplicatas: duplicatas.map(d => ({ id: d.id, nome: d.nome }))
        });
      }
    }

    // 4.4: Verificar scores zerados (se tem histórico)
    if (temHistorico) {
      if (!contato.score_engajamento || contato.score_engajamento === 0) {
        erros.push({ tipo: 'score_engajamento_zero', descricao: 'score_engajamento=0 mas contato tem histórico', campo: 'score_engajamento' });
        if (contato.tipo_contato === 'cliente') contactUpdates.score_engajamento = 80;
        else if (contato.tipo_contato === 'lead') contactUpdates.score_engajamento = 50;
        else contactUpdates.score_engajamento = 40;
      }
      if (!contato.cliente_score || contato.cliente_score === 0) {
        erros.push({ tipo: 'cliente_score_zero', descricao: 'cliente_score=0 mas contato tem histórico', campo: 'cliente_score' });
        contactUpdates.cliente_score = contactUpdates.score_engajamento || contato.score_engajamento || 40;
      }
    }

    // 4.5: Verificar segmentação
    if (!contato.segmento_atual) {
      erros.push({ tipo: 'segmento_null', descricao: 'segmento_atual não preenchido', campo: 'segmento_atual' });
      if (contato.tipo_contato === 'cliente') contactUpdates.segmento_atual = 'cliente_ativo';
      else if (contato.tipo_contato === 'lead') contactUpdates.segmento_atual = 'lead_morno';
    }
    if (!contato.estagio_ciclo_vida) {
      erros.push({ tipo: 'estagio_null', descricao: 'estagio_ciclo_vida não preenchido', campo: 'estagio_ciclo_vida' });
      if (contato.tipo_contato === 'cliente') contactUpdates.estagio_ciclo_vida = 'fidelizacao';
      else contactUpdates.estagio_ciclo_vida = 'consideracao';
    }

    // 4.6: Verificar whatsapp_status — se tem mensagens recentes via WA deve ser 'verificado'
    const temMensagensWA = msgsPorSenderId?.some(m => m.channel === 'whatsapp');
    if (temMensagensWA && contato.whatsapp_status !== 'verificado') {
      erros.push({
        tipo: 'whatsapp_status_desatualizado',
        descricao: `whatsapp_status="${contato.whatsapp_status}" mas contato tem mensagens WhatsApp recentes`,
        campo: 'whatsapp_status'
      });
      contactUpdates.whatsapp_status = 'verificado';
    }

    // 4.7: Verificar tipo_contato
    if (!contato.tipo_contato || contato.tipo_contato === 'novo') {
      if (temHistorico) {
        erros.push({ tipo: 'tipo_contato_novo_com_historico', descricao: 'tipo_contato=novo mas contato tem histórico de mensagens', campo: 'tipo_contato' });
      }
    }

    // ============================================================
    // PASSO 5 — PLANO DE REPARAÇÃO (log)
    // ============================================================
    console.log(`[sincronizarContactoErros] 📋 DIAGNÓSTICO COMPLETO:`);
    console.log(`  Erros encontrados: ${erros.length}`);
    console.log(`  Msgs presas em threads: ${totalMensagensPresasThreads}`);
    console.log(`  Msgs sender_id errado: ${mensagensSenderIdErrado}`);
    console.log(`  Updates de contato planejados: ${Object.keys(contactUpdates).length}`);

    if (!corrigir) {
      // Retornar diagnóstico completo
      const checklist = gerarChecklist(contato, threadCanonica, threadsCanonical, totalMensagensPresasThreads, mensagensSenderIdErrado, msgsPorSenderId?.length || 0);
      return Response.json({
        success: true,
        contact_id,
        modo: 'diagnostico',
        erros_encontrados: erros.length,
        erros,
        corrigidos: [],
        diagnostico: {
          contato: { nome: contato.nome, tipo: contato.tipo_contato, scores: { engajamento: contato.score_engajamento, cliente: contato.cliente_score }, segmento: contato.segmento_atual, whatsapp_status: contato.whatsapp_status },
          threads: { total: todasThreads.length, canonicas: threadsCanonical.length, merged: threadsMerged.length, canonical_id: threadCanonica?.id },
          mensagens: { total_por_sender: msgsPorSenderId?.length || 0, presas_em_threads: totalMensagensPresasThreads, sender_id_errado: mensagensSenderIdErrado },
          updates_planejados: contactUpdates
        },
        checklist
      });
    }

    // ============================================================
    // PASSO 6 — APLICAR CORREÇÕES NA ORDEM CORRETA
    // ============================================================
    console.log(`[sincronizarContactoErros] ===== APLICANDO CORREÇÕES =====`);

    // ORDEM 1: Migrar mensagens presas em threads secundárias → canônica
    if (threadCanonica) {
      let totalMigradas = 0;

      // 1a: Mensagens presas por thread_id em threads merged/secundárias
      for (const [threadId, mensagens] of Object.entries(mensagensPorThread)) {
        for (const msg of mensagens) {
          try {
            await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
            totalMigradas++;
          } catch (err) {
            console.error(`[sincronizarContactoErros] ❌ Erro ao migrar msg ${msg.id}:`, err.message);
          }
        }
        // Marcar thread secundária como merged
        try {
          const tSecThread = todasThreads.find(t => t.id === threadId);
          if (tSecThread && tSecThread.status !== 'merged') {
            await base44.asServiceRole.entities.MessageThread.update(threadId, {
              status: 'merged',
              merged_into: threadCanonica.id,
              is_canonical: false
            });
          }
        } catch (err) {}
        console.log(`[sincronizarContactoErros] ✅ Migradas ${mensagens.length} msgs da thread ${threadId}`);
      }

      // 1b: Mensagens do sender_id em threads erradas
      for (const msg of msgsSenderIdParaMigrar) {
        try {
          await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
          totalMigradas++;
        } catch (err) {
          console.error(`[sincronizarContactoErros] ❌ Erro ao migrar msg sender_id ${msg.id}:`, err.message);
        }
      }

      if (totalMigradas > 0) {
        corrigidos.push(`${totalMigradas} mensagem(ns) migrada(s) para thread canônica ${threadCanonica.id}`);
      }

      // ORDEM 2: Atualizar contador da thread canônica com contagem real
      const todasMsgsCanonica = await base44.asServiceRole.entities.Message.filter({
        thread_id: threadCanonica.id
      });
      const ultimaMsg = todasMsgsCanonica?.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

      const threadUpdate = {
        total_mensagens: todasMsgsCanonica?.length || 0,
        is_canonical: true,
        status: threadCanonica.status === 'merged' ? 'aberta' : threadCanonica.status
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
      corrigidos.push(`Thread canônica ${threadCanonica.id} atualizada: ${todasMsgsCanonica?.length || 0} mensagens`);
      console.log(`[sincronizarContactoErros] ✅ Thread canônica atualizada: ${todasMsgsCanonica?.length} msgs`);

      // Corrigir threads duplicadas com is_canonical=true
      for (let i = 1; i < threadsCanonical.length; i++) {
        await base44.asServiceRole.entities.MessageThread.update(threadsCanonical[i].id, {
          is_canonical: false
        });
        corrigidos.push(`is_canonical removido da thread duplicada ${threadsCanonical[i].id}`);
      }
    }

    // ORDEM 3: Atualizar dados do contato
    if (Object.keys(contactUpdates).length > 0) {
      await base44.asServiceRole.entities.Contact.update(contact_id, contactUpdates);
      for (const [campo, valor] of Object.entries(contactUpdates)) {
        corrigidos.push(`${campo}: "${contato[campo] || 'vazio'}" → "${valor}"`);
      }
      console.log(`[sincronizarContactoErros] ✅ Contato atualizado:`, contactUpdates);
    }

    // ============================================================
    // PASSO 7 — CHECKLIST FINAL DE VALIDAÇÃO
    // ============================================================
    const contatoAtualizado = { ...contato, ...contactUpdates };
    const threadFinal = threadCanonica ? { ...threadCanonica, ...({ is_canonical: true }) } : null;
    const checklist = gerarChecklist(contatoAtualizado, threadFinal, [threadFinal].filter(Boolean), 0, 0, msgsPorSenderId?.length || 0);

    console.log(`[sincronizarContactoErros] ===== CONCLUÍDO =====`);
    console.log(`  Corrigidos: ${corrigidos.length} item(ns)`);

    return Response.json({
      success: true,
      contact_id,
      modo: 'correcao',
      erros_encontrados: erros.length,
      erros,
      corrigidos,
      checklist
    });

  } catch (error) {
    console.error('[sincronizarContactoErros] ERRO:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

// ============================================
// PASSO 7 — GERADOR DE CHECKLIST
// ============================================
function gerarChecklist(contato, threadCanonica, threadsCanonical, mensagensPresasCount, senderIdErradoCount, totalMsgsContato) {
  return [
    { item: 'Contact.tipo_contato preenchido', ok: !!contato.tipo_contato && contato.tipo_contato !== 'novo', valor: contato.tipo_contato },
    { item: 'Contact.whatsapp_status = verificado', ok: contato.whatsapp_status === 'verificado', valor: contato.whatsapp_status },
    { item: 'Contact.bloqueado = false', ok: !contato.bloqueado, valor: String(contato.bloqueado) },
    { item: 'Contact.score_engajamento > 0', ok: (contato.score_engajamento || 0) > 0, valor: String(contato.score_engajamento || 0) },
    { item: 'Contact.segmento_atual preenchido', ok: !!contato.segmento_atual, valor: contato.segmento_atual },
    { item: 'Contact.estagio_ciclo_vida preenchido', ok: !!contato.estagio_ciclo_vida, valor: contato.estagio_ciclo_vida },
    { item: 'Thread canônica existe (is_canonical=true)', ok: !!threadCanonica, valor: threadCanonica?.id || 'NENHUMA' },
    { item: 'Apenas 1 thread canônica', ok: threadsCanonical.length <= 1, valor: String(threadsCanonical.length) },
    { item: 'Thread canônica status=aberta', ok: threadCanonica?.status === 'aberta', valor: threadCanonica?.status || '-' },
    { item: 'Sem mensagens presas em threads merged', ok: mensagensPresasCount === 0, valor: String(mensagensPresasCount) },
    { item: 'Sem mensagens com sender_id em thread errada', ok: senderIdErradoCount === 0, valor: String(senderIdErradoCount) },
    { item: 'Contact.telefone_canonico preenchido', ok: !!contato.telefone_canonico, valor: contato.telefone_canonico || 'vazio' }
  ];
}

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