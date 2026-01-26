import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Consolida threads duplicadas de um contato
 * Marca 1 thread como canônica e as demais como merged
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado - apenas admin' }, { status: 403 });
    }

    const { contact_id, auto_fix_all } = await req.json();

    if (!contact_id && !auto_fix_all) {
      return Response.json({ error: 'contact_id ou auto_fix_all obrigatório' }, { status: 400 });
    }

    const resultados = {
      contatos_processados: 0,
      threads_consolidadas: 0,
      threads_merged: 0,
      erros: []
    };

    let contatosParaProcessar = [];

    if (contact_id) {
      // Processar apenas 1 contato
      const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
      if (contato) contatosParaProcessar = [contato];
    } else {
      // Buscar todos os contatos com threads duplicadas
      const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-updated_date', 1000);
      const mapaContatos = new Map();
      
      todasThreads.forEach(t => {
        if (!t.contact_id) return;
        if (!mapaContatos.has(t.contact_id)) {
          mapaContatos.set(t.contact_id, []);
        }
        mapaContatos.get(t.contact_id).push(t);
      });

      // Filtrar apenas contatos com múltiplas threads
      for (const [contactId, threads] of mapaContatos.entries()) {
        if (threads.length > 1) {
          try {
            const contato = await base44.asServiceRole.entities.Contact.get(contactId);
            if (contato) contatosParaProcessar.push(contato);
          } catch (e) {
            resultados.erros.push(`Erro ao buscar contato ${contactId}: ${e.message}`);
          }
        }
      }
    }

    console.log(`[CONSOLIDAR] Processando ${contatosParaProcessar.length} contatos...`);

    for (const contato of contatosParaProcessar) {
      try {
        // Buscar todas as threads deste contato
        const threads = await base44.asServiceRole.entities.MessageThread.filter(
          { contact_id: contato.id },
          '-last_message_at',
          50
        );

        if (threads.length <= 1) {
          console.log(`[CONSOLIDAR] Contato ${contato.nome} tem apenas 1 thread, pulando...`);
          continue;
        }

        console.log(`[CONSOLIDAR] Contato ${contato.nome} tem ${threads.length} threads duplicadas`);

        // Escolher thread canônica (critérios em ordem):
        // 1. Thread com assigned_user_id (humano já está atendendo)
        // 2. Thread com mais mensagens
        // 3. Thread mais recente
        let threadCanonica = threads[0];
        
        for (const t of threads) {
          // Priorizar thread com atendente
          if (t.assigned_user_id && !threadCanonica.assigned_user_id) {
            threadCanonica = t;
            continue;
          }
          
          // Se ambas têm ou ambas não têm atendente, comparar por mensagens
          if ((t.assigned_user_id && threadCanonica.assigned_user_id) || 
              (!t.assigned_user_id && !threadCanonica.assigned_user_id)) {
            if ((t.total_mensagens || 0) > (threadCanonica.total_mensagens || 0)) {
              threadCanonica = t;
            } else if ((t.total_mensagens || 0) === (threadCanonica.total_mensagens || 0)) {
              // Mesma quantidade de mensagens, escolher a mais recente
              if (new Date(t.last_message_at || 0) > new Date(threadCanonica.last_message_at || 0)) {
                threadCanonica = t;
              }
            }
          }
        }

        // Marcar canônica
        await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
          is_canonical: true,
          status: 'aberta'
        });

        console.log(`[CONSOLIDAR] ✅ Thread canônica: ${threadCanonica.id} (${threadCanonica.total_mensagens || 0} msgs)`);
        resultados.threads_consolidadas++;

        // Marcar as demais como merged
        for (const t of threads) {
          if (t.id === threadCanonica.id) continue;

          await base44.asServiceRole.entities.MessageThread.update(t.id, {
            is_canonical: false,
            status: 'merged',
            merged_into: threadCanonica.id
          });

          console.log(`[CONSOLIDAR] 🔀 Thread merged: ${t.id} -> ${threadCanonica.id}`);
          resultados.threads_merged++;
        }

        resultados.contatos_processados++;

      } catch (e) {
        const erro = `Erro ao consolidar contato ${contato.id}: ${e.message}`;
        console.error(`[CONSOLIDAR] ❌ ${erro}`);
        resultados.erros.push(erro);
      }
    }

    return Response.json({
      success: true,
      resultados
    });

  } catch (error) {
    console.error('[CONSOLIDAR] Erro geral:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});