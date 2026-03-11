import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Correção cirúrgica: revincula threads/mensagens de contatos duplicados vazios
 * ao contato principal correto (que tem nome e telefone).
 * 
 * Problema típico: thread está vinculada a um "Contato" vazio (sem nome/telefone)
 * quando o contato real (com nome e telefone) existe separado.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas admin.' }, { status: 403 });
    }

    const payload = await req.json();
    const { contact_id, modo = 'diagnostico' } = payload;

    if (!contact_id) {
      return Response.json({ error: 'contact_id é obrigatório' }, { status: 400 });
    }

    console.log(`[corrigirVinculacao] Iniciando contacto=${contact_id} modo=${modo}`);

    // 1. Buscar contato principal (DEJAIR)
    const contatos = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (!contatos || contatos.length === 0) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }
    const contatoPrincipal = contatos[0];
    const telefone = contatoPrincipal.telefone;

    console.log(`[corrigirVinculacao] Contato principal: ${contatoPrincipal.nome} | telefone: ${telefone}`);

    if (!telefone) {
      return Response.json({ error: 'Contato principal não tem telefone cadastrado' }, { status: 400 });
    }

    const telefoneNorm = normalizarTelefone(telefone);
    const telefoneCanonStr = telefone.replace(/[\s\-\(\)\+]/g, '');

    // 2. Garantir telefone_canonico correto no contato principal
    const needsCanonicoUpdate = !contatoPrincipal.telefone_canonico || 
                                 contatoPrincipal.telefone_canonico !== telefoneCanonStr;

    // 3. Buscar todos os contatos com mesmo telefone (duplicados)
    const variacoes = gerarVariacoesTelefone(telefoneNorm);
    console.log(`[corrigirVinculacao] Variações de telefone:`, variacoes);

    const contatosDuplicados = [];
    for (const variacao of variacoes) {
      try {
        const encontrados = await base44.asServiceRole.entities.Contact.filter({
          telefone_canonico: variacao,
          id: { $ne: contact_id }
        });
        if (encontrados && encontrados.length > 0) {
          contatosDuplicados.push(...encontrados);
        }
      } catch (e) {
        // ignorar
      }
    }

    // Também buscar contatos com telefone direto igual
    try {
      const porTelefone = await base44.asServiceRole.entities.Contact.filter({
        telefone: telefone,
        id: { $ne: contact_id }
      });
      if (porTelefone?.length > 0) {
        for (const c of porTelefone) {
          if (!contatosDuplicados.find(d => d.id === c.id)) {
            contatosDuplicados.push(c);
          }
        }
      }
    } catch (e) {}

    console.log(`[corrigirVinculacao] Duplicados encontrados: ${contatosDuplicados.length}`);

    // 4. Para cada duplicado, encontrar threads vinculadas
    const threadsParaMover = [];
    
    for (const dup of contatosDuplicados) {
      const threadsDosDuplicados = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: dup.id
      });

      if (threadsDosDuplicados && threadsDosDuplicados.length > 0) {
        for (const t of threadsDosDuplicados) {
          threadsParaMover.push({
            thread_id: t.id,
            contact_id_errado: dup.id,
            contato_duplicado_nome: dup.nome || '(sem nome)',
            thread_status: t.status,
            total_mensagens: t.total_mensagens || 0
          });
        }
      }
    }

    // 5. Buscar threads do próprio contato principal
    const threadsProprias = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: contact_id
    });

    console.log(`[corrigirVinculacao] Threads a mover: ${threadsParaMover.length} | Threads próprias: ${threadsProprias.length}`);

    // 6. Buscar mensagens enviadas por sender_id = qualquer duplicado
    const mensagensParaMover = [];
    for (const dup of contatosDuplicados) {
      const msgs = await base44.asServiceRole.entities.Message.filter({
        sender_id: dup.id,
        sender_type: 'contact'
      });
      if (msgs?.length > 0) {
        for (const m of msgs) {
          mensagensParaMover.push({
            message_id: m.id,
            contact_id_errado: dup.id,
            thread_id: m.thread_id
          });
        }
      }
    }

    // Se modo diagnóstico, retornar apenas o relatório
    if (modo === 'diagnostico') {
      return Response.json({
        success: true,
        modo: 'diagnostico',
        contato_principal: {
          id: contact_id,
          nome: contatoPrincipal.nome,
          telefone,
          telefone_canonico_atual: contatoPrincipal.telefone_canonico,
          telefone_canonico_correto: telefoneCanonStr,
          needs_canonico_update: needsCanonicoUpdate
        },
        duplicados_encontrados: contatosDuplicados.map(d => ({
          id: d.id,
          nome: d.nome || '(sem nome)',
          telefone: d.telefone,
          telefone_canonico: d.telefone_canonico
        })),
        threads_para_mover: threadsParaMover,
        mensagens_para_revinular: mensagensParaMover.length,
        threads_proprias: threadsProprias.length
      });
    }

    // 7. MODO CORREÇÃO — executar tudo
    const corrigidos = [];

    // 7a. Corrigir telefone_canonico do contato principal
    if (needsCanonicoUpdate) {
      await base44.asServiceRole.entities.Contact.update(contact_id, {
        telefone_canonico: telefoneCanonStr
      });
      corrigidos.push(`telefone_canonico atualizado: ${telefoneCanonStr}`);
      console.log(`[corrigirVinculacao] ✅ telefone_canonico corrigido`);
    }

    // 7b. Mover threads dos duplicados para o contato principal
    let threadsMovidas = 0;
    for (const t of threadsParaMover) {
      try {
        await base44.asServiceRole.entities.MessageThread.update(t.thread_id, {
          contact_id: contact_id
        });
        threadsMovidas++;
        console.log(`[corrigirVinculacao] ✅ Thread ${t.thread_id} movida para contato principal`);
      } catch (err) {
        console.error(`[corrigirVinculacao] ❌ Erro ao mover thread ${t.thread_id}:`, err.message);
      }
    }
    if (threadsMovidas > 0) {
      corrigidos.push(`${threadsMovidas} thread(s) revinculada(s) ao contato correto`);
    }

    // 7c. Atualizar sender_id das mensagens dos duplicados
    let mensagensCorrigidas = 0;
    for (const m of mensagensParaMover) {
      try {
        await base44.asServiceRole.entities.Message.update(m.message_id, {
          sender_id: contact_id
        });
        mensagensCorrigidas++;
      } catch (err) {
        console.error(`[corrigirVinculacao] ❌ Erro ao corrigir mensagem ${m.message_id}:`, err.message);
      }
    }
    if (mensagensCorrigidas > 0) {
      corrigidos.push(`${mensagensCorrigidas} mensagem(ns) com sender_id corrigido`);
    }

    // 7c.2 Neutralizar duplicados: limpar telefone_canonico para não aparecer mais como duplicata
    for (const dup of contatosDuplicados) {
      try {
        // Verificar se o duplicado ainda tem threads/mensagens (se não, pode neutralizar)
        const threadsRestantes = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: dup.id });
        const temThreads = threadsRestantes && threadsRestantes.length > 0;
        
        // Limpar telefone_canonico do duplicado para não ser encontrado novamente
        await base44.asServiceRole.entities.Contact.update(dup.id, {
          telefone_canonico: `MERGED_${dup.telefone_canonico || dup.id}`,
          observacoes: `[DUPLICATA UNIFICADA em ${new Date().toISOString().split('T')[0]}] Contato principal: ${contact_id}. ${dup.observacoes || ''}`
        });
        corrigidos.push(`Duplicata ${dup.nome || dup.id} neutralizada (telefone_canonico limpo)`);
        console.log(`[corrigirVinculacao] ✅ Duplicata ${dup.id} neutralizada`);
      } catch (err) {
        console.warn(`[corrigirVinculacao] Aviso ao neutralizar duplicata ${dup.id}:`, err.message);
      }
    }

    // 7d. Consolidar threads: se há múltiplas threads do contato principal, manter a mais ativa
    const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: contact_id,
      thread_type: 'contact_external'
    });

    if (todasThreads && todasThreads.length > 1) {
      // Ordenar: aberta primeiro, depois pela última mensagem
      const sorted = todasThreads.sort((a, b) => {
        if (a.status === 'aberta' && b.status !== 'aberta') return -1;
        if (b.status === 'aberta' && a.status !== 'aberta') return 1;
        return new Date(b.last_message_at || b.updated_date || 0) - 
               new Date(a.last_message_at || a.updated_date || 0);
      });

      const principal = sorted[0];
      let threadsConsolidadas = 0;

      for (let i = 1; i < sorted.length; i++) {
        const t = sorted[i];
        if (t.status !== 'merged') {
          try {
            // Mover mensagens desta thread para a principal
            const msgsThread = await base44.asServiceRole.entities.Message.filter({
              thread_id: t.id
            });
            for (const m of msgsThread) {
              await base44.asServiceRole.entities.Message.update(m.id, {
                thread_id: principal.id
              });
            }

            await base44.asServiceRole.entities.MessageThread.update(t.id, {
              status: 'merged',
              merged_into: principal.id
            });
            threadsConsolidadas++;
            console.log(`[corrigirVinculacao] ✅ Thread ${t.id} consolidada em ${principal.id}`);
          } catch (err) {
            console.error(`[corrigirVinculacao] ❌ Erro ao consolidar thread ${t.id}:`, err.message);
          }
        }
      }

      if (threadsConsolidadas > 0) {
        corrigidos.push(`${threadsConsolidadas} thread(s) consolidada(s) na thread principal`);
        
        // Atualizar contador da thread principal
        try {
          const todasMsgs = await base44.asServiceRole.entities.Message.filter({
            thread_id: principal.id
          });
          const ultima = todasMsgs?.[todasMsgs.length - 1];
          await base44.asServiceRole.entities.MessageThread.update(principal.id, {
            total_mensagens: todasMsgs?.length || 0,
            last_message_at: ultima?.sent_at || ultima?.created_date,
            last_message_content: ultima?.content?.substring(0, 100) || '',
            last_message_sender: ultima?.sender_type === 'contact' ? 'contact' : 'user'
          });
        } catch (e) {}
      }
    }

    return Response.json({
      success: true,
      modo: 'correcao',
      corrigidos,
      threads_movidas: threadsMovidas,
      mensagens_corrigidas: mensagensCorrigidas,
      duplicados_processados: contatosDuplicados.length
    });

  } catch (error) {
    console.error('[corrigirVinculacao] ERRO:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

function normalizarTelefone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '');
}

function gerarVariacoesTelefone(tel) {
  if (!tel) return [];
  const clean = tel.replace(/\D/g, '');
  const variações = new Set();
  variações.add(clean);
  
  // Com 55 Brasil
  if (!clean.startsWith('55')) {
    variações.add('55' + clean);
  } else {
    variações.add(clean.slice(2)); // sem 55
  }
  
  // Com/sem dígito 9 (celular Brasil)
  if (clean.length === 13 && clean.startsWith('55')) {
    const semNove = '55' + clean.slice(2, 4) + clean.slice(5);
    variações.add(semNove);
  }
  if (clean.length === 12 && clean.startsWith('55')) {
    const comNove = '55' + clean.slice(2, 4) + '9' + clean.slice(4);
    variações.add(comNove);
  }

  return Array.from(variações);
}