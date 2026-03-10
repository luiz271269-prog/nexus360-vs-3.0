import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode sincronizar mensagens órfãs' }, { status: 403 });
    }

    const payload = await req.json();
    const { contact_id, thread_id, periodo_horas = 48, modo = 'diagnostico' } = payload;

    if (!contact_id && !thread_id) {
      return Response.json({ error: 'contact_id ou thread_id é obrigatório' }, { status: 400 });
    }

    console.log(`[sincronizarMensagensOrfas] Iniciando modo="${modo}" | contact_id="${contact_id}" | thread_id="${thread_id}"`);

    // 1️⃣ BUSCAR THREADS SUSPEITAS
    const threadsQuery = {
      thread_type: 'contact_external',
      status: { $in: ['aberta', 'fechada'] }
    };
    if (thread_id) threadsQuery.id = thread_id;
    if (contact_id) threadsQuery.contact_id = contact_id;

    const threadsSuspeitas = await base44.asServiceRole.entities.MessageThread.filter(threadsQuery, '-created_date', 1000);
    console.log(`[sincronizarMensagensOrfas] ${threadsSuspeitas.length} threads encontradas`);

    const dataLimit = new Date(Date.now() - periodo_horas * 60 * 60 * 1000).toISOString();

    let threadsAnalisadas = 0;
    let mensagensOrfasEncontradas = 0;
    let mensagensRevinculadas = 0;
    let erroCount = 0;
    const detalhes = [];

    // 2️⃣ PROCESSAR CADA THREAD
    for (const thread of threadsSuspeitas) {
      try {
        threadsAnalisadas++;

        // Buscar contato
        if (!thread.contact_id) {
          console.log(`[sincronizarMensagensOrfas] ⚠️ Thread ${thread.id} sem contact_id, pulando`);
          continue;
        }

        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: thread.contact_id });
        const contato = contatos[0];
        if (!contato) {
          console.log(`[sincronizarMensagensOrfas] ⚠️ Contato ${thread.contact_id} não encontrado`);
          continue;
        }

        const telefonoContato = normalizarTelefone(contato.telefone);
        if (!telefonoContato) {
          console.log(`[sincronizarMensagensOrfas] ⚠️ Contato ${contato.nome} sem telefone válido`);
          continue;
        }

        console.log(`[sincronizarMensagensOrfas] 🔍 Analisando thread ${thread.id} | Contato: ${contato.nome} | Tel: ${telefonoContato}`);

        // 3️⃣ BUSCAR MENSAGENS NÃO VINCULADAS OU MAL VINCULADAS
        // Mensagens com sender_id = contact_id mas thread_id diferente ou vazio
        const msgQuery = {
          sender_type: 'contact',
          created_date: { $gte: dataLimit }
        };

        const mensagens = await base44.asServiceRole.entities.Message.filter(msgQuery, '-created_date', 2000);
        
        let orfasNesta = 0;
        let revinculadasNesta = 0;

        for (const msg of mensagens) {
          try {
            // Verificar se é "órfã" desta thread
            if (msg.sender_id === thread.contact_id && msg.thread_id !== thread.id) {
              orfasNesta++;
              mensagensOrfasEncontradas++;

              if (modo === 'correcao') {
                // Atualizar vinculação
                await base44.asServiceRole.entities.Message.update(msg.id, {
                  thread_id: thread.id,
                  contact_id: thread.contact_id
                });
                revinculadasNesta++;
                mensagensRevinculadas++;
                console.log(`[sincronizarMensagensOrfas] ✅ Mensagem ${msg.id} revinculada`);
              }
            }
          } catch (msgErr) {
            erroCount++;
            console.error(`[sincronizarMensagensOrfas] ❌ Erro ao processar msg ${msg.id}:`, msgErr.message);
          }
        }

        // 4️⃣ ATUALIZAR CONTADORES DA THREAD (se modo correção)
        if (modo === 'correcao' && revinculadasNesta > 0) {
          try {
            const msgsDaThread = await base44.asServiceRole.entities.Message.filter({ thread_id: thread.id });
            const ultimaMsg = msgsDaThread[0];
            
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              total_mensagens: msgsDaThread.length,
              last_message_at: ultimaMsg?.sent_at || ultimaMsg?.created_date,
              last_message_sender: ultimaMsg?.sender_type,
              unread_count: msgsDaThread.filter(m => m.status === 'recebida').length
            });
            console.log(`[sincronizarMensagensOrfas] 🔄 Thread ${thread.id} atualizada`);
          } catch (updateErr) {
            console.error(`[sincronizarMensagensOrfas] ❌ Erro ao atualizar thread:`, updateErr.message);
          }
        }

        if (orfasNesta > 0) {
          detalhes.push({
            thread_id: thread.id,
            contato_nome: contato.nome,
            telefone_contato: telefonoContato,
            mensagens_encontradas: orfasNesta,
            mensagens_revinculadas: revinculadasNesta,
            status: revinculadasNesta > 0 ? 'sucesso' : 'diagnosticado'
          });
        }

      } catch (threadErr) {
        erroCount++;
        console.error(`[sincronizarMensagensOrfas] ❌ Erro na thread ${thread.id}:`, threadErr.message);
      }
    }

    const resultado = {
      success: true,
      threads_analisadas: threadsAnalisadas,
      mensagens_orfas_encontradas: mensagensOrfasEncontradas,
      mensagens_revinculadas: mensagensRevinculadas,
      erro_count: erroCount,
      modo: modo,
      detalhes: detalhes
    };

    console.log(`[sincronizarMensagensOrfas] ✅ Concluído:`, JSON.stringify(resultado));
    return Response.json(resultado);

  } catch (error) {
    console.error('[sincronizarMensagensOrfas]', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

function normalizarTelefone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^55/, '').replace(/^0+/, '');
}