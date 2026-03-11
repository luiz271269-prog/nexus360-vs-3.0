import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    console.log(`[sincronizarContactoErros] Iniciando contact=${contact_id}, corrigir=${corrigir}`);

    // 1️⃣ Buscar contato
    const contatos = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (!contatos || contatos.length === 0) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    const contato = contatos[0];
    const erros = [];

    // 2️⃣ Verificar telefone vazio
    if (!contato.telefone || !contato.telefone.trim()) {
      erros.push({
        tipo: 'telefone_vazio',
        descricao: 'Campo telefone está vazio',
        campo: 'telefone',
        valor_atual: contato.telefone || 'NULL'
      });
    }

    // 3️⃣ Verificar telefone_canonico — vazio OU incorreto
    const telefoneNorm = normalizarTelefone(contato.telefone);
    if (!contato.telefone_canonico || !contato.telefone_canonico.trim()) {
      erros.push({
        tipo: 'telefone_canonico_vazio',
        descricao: 'Campo telefone_canonico não foi preenchido',
        campo: 'telefone_canonico',
        valor_atual: contato.telefone_canonico || 'NULL'
      });
    } else if (telefoneNorm && contato.telefone_canonico !== telefoneNorm) {
      erros.push({
        tipo: 'telefone_canonico_incorreto',
        descricao: `telefone_canonico está errado: ${contato.telefone_canonico} → deveria ser ${telefoneNorm}`,
        campo: 'telefone_canonico',
        valor_atual: contato.telefone_canonico,
        valor_correto: telefoneNorm
      });
    }

    // 4️⃣ Verificar duplicatas por telefone
    if (telefoneNorm) {
      const duplicatas = await base44.asServiceRole.entities.Contact.filter({
        telefone_canonico: telefoneNorm,
        id: { $ne: contact_id }
      });
      if (duplicatas && duplicatas.length > 0) {
        erros.push({
          tipo: 'duplicata_encontrada',
          descricao: `Encontradas ${duplicatas.length} duplicata(s) com mesmo telefone`,
          campo: 'telefone_canonico',
          duplicatas: duplicatas.map(d => ({ id: d.id, nome: d.nome }))
        });
      }
    }

    // 5️⃣ Verificar nome
    const nomePuro = (contato.nome || '').trim();
    if (!nomePuro) {
      erros.push({
        tipo: 'nome_vazio',
        descricao: 'Campo nome está vazio',
        campo: 'nome',
        valor_atual: 'NULL'
      });
    } else if (nomePuro.match(/^\+?\d+$/)) {
      erros.push({
        tipo: 'nome_igual_telefone',
        descricao: 'Nome contém apenas números (preenchido com telefone)',
        campo: 'nome',
        valor_atual: nomePuro
      });
    }

    // 6️⃣ CORRIGIR se solicitado
    let corrigidos = [];
    if (corrigir) {
      const updates = {};

      // Corrigir telefone_canonico sempre que incorreto ou vazio
      if (telefoneNorm && contato.telefone_canonico !== telefoneNorm) {
        updates.telefone_canonico = telefoneNorm;
        corrigidos.push(`telefone_canonico corrigido: "${contato.telefone_canonico || 'vazio'}" → "${telefoneNorm}"`);
      }

      // Corrigir nome se vazio
      if (!nomePuro) {
        if (contato.empresa) {
          updates.nome = contato.empresa;
          corrigidos.push('nome preenchido com empresa');
        } else if (contato.telefone) {
          updates.nome = `Contato ${contato.telefone}`;
          corrigidos.push('nome gerado do telefone');
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Contact.update(contact_id, updates);
        console.log(`[sincronizarContactoErros] ✅ Contato corrigido:`, updates);
      }

      // 7️⃣ Consolidar threads + MIGRAR MENSAGENS (correção cirúrgica)
      try {
        const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({ 
          contact_id: contact_id 
        });

        if (todasThreads && todasThreads.length > 0) {
          // Selecionar thread canônica corretamente: is_canonical=true e não merged
          let threadCanonica = todasThreads.find(t => t.is_canonical === true && t.status !== 'merged');
          if (!threadCanonica) {
            // Fallback: a com mais mensagens ou mais recente
            threadCanonica = todasThreads
              .filter(t => t.status !== 'merged')
              .sort((a, b) => (b.total_mensagens || 0) - (a.total_mensagens || 0))[0];
          }
          if (!threadCanonica) {
            threadCanonica = todasThreads[0];
          }

          let threadsConsolidadas = 0;
          let mensagensMigradas = 0;

          for (const thread of todasThreads) {
            if (thread.id === threadCanonica.id) continue;

            // Buscar mensagens presas nesta thread (merged ou não)
            const mensagensPreasas = await base44.asServiceRole.entities.Message.filter({
              thread_id: thread.id
            });

            console.log(`[sincronizarContactoErros] Thread ${thread.id} (${thread.status}): ${mensagensPreasas?.length || 0} mensagens`);

            // Migrar mensagens para a canônica
            if (mensagensPreasas && mensagensPreasas.length > 0) {
              for (const msg of mensagensPreasas) {
                await base44.asServiceRole.entities.Message.update(msg.id, {
                  thread_id: threadCanonica.id
                });
                mensagensMigradas++;
              }
              console.log(`[sincronizarContactoErros] ✅ Migradas ${mensagensPreasas.length} msgs da thread ${thread.id}`);
            }

            // Marcar como merged se ainda não estava
            if (thread.status !== 'merged') {
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                status: 'merged',
                merged_into: threadCanonica.id,
                is_canonical: false
              });
              threadsConsolidadas++;
            }
          }

          // Atualizar total_mensagens da canônica com contagem real
          if (mensagensMigradas > 0 || threadsConsolidadas > 0) {
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

            corrigidos.push(`${threadsConsolidadas} thread(s) consolidada(s), ${mensagensMigradas} mensagem(ns) migrada(s) para thread canônica`);
            corrigidos.push(`total_mensagens da canônica atualizado: ${todasMsgsCanonica?.length || 0}`);
            console.log(`[sincronizarContactoErros] 📊 Thread canônica ${threadCanonica.id} atualizada: ${todasMsgsCanonica?.length} msgs`);
          }
        }
      } catch (threadError) {
        console.warn('[sincronizarContactoErros] Aviso ao consolidar threads:', threadError.message);
      }
    }

    return Response.json({
      success: true,
      contact_id,
      erros_encontrados: erros.length,
      erros,
      corrigidos,
      modo: corrigir ? 'correcao' : 'diagnostico'
    });

  } catch (error) {
    console.error('[sincronizarContactoErros]', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

function normalizarTelefone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
  // Garantir prefixo 55 (Brasil)
  if (clean.length <= 11 && !clean.startsWith('55')) {
    return '55' + clean;
  }
  return clean || '';
}