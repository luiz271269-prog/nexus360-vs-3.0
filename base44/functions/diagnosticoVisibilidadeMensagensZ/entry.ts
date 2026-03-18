import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VERSION = 'v1.0.0-DIAGNOSE-VISIBILITY';

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return Response.json({ ok: true }, { status: 204 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const diasAtras = body.dias_atras || 7;
    const limite = body.limite || 100;

    console.log(`[${VERSION}] 🔍 Iniciando análise de visibilidade de mensagens (últimos ${diasAtras} dias)`);

    // Data de corte
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - diasAtras);
    const dataCorteISO = dataCorte.toISOString();

    // ✅ 1. CONTAR TOTAL DE MENSAGENS
    console.log(`[${VERSION}] 📊 Buscando mensagens desde: ${dataCorteISO}`);
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { created_date: { $gte: dataCorteISO } },
      '-created_date',
      limite
    );

    console.log(`[${VERSION}] 📧 Total de mensagens encontradas: ${mensagens.length}`);

    // ✅ 2. ANALISAR THREADS ASSOCIADAS
    const threadIds = new Set(mensagens.map(m => m.thread_id).filter(Boolean));
    console.log(`[${VERSION}] 🧵 Threads únicas: ${threadIds.size}`);

    const allThreads = await base44.asServiceRole.entities.MessageThread.filter(
      { id: { $in: Array.from(threadIds) } },
      '-created_date',
      200
    );
    
    // ✅ THREADS INTERNAS: Sempre incluir (não são merged)
    const threads = allThreads.filter(t => {
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') {
        return true;
      }
      return t.status !== 'merged'; // Externas: excluir merged
    });

    console.log(`[${VERSION}] 🧵 Threads recuperadas: ${threads.length} (${allThreads.filter(t => t.thread_type === 'team_internal' || t.thread_type === 'sector_group').length} internas)`);

    // ✅ 3. ANALISAR CONTATOS ASSOCIADOS (apenas threads externas)
    const contactIds = new Set();
    threads.forEach(t => {
      // Threads internas não têm contact_id (têm participants)
      if ((t.thread_type === 'team_internal' || t.thread_type === 'sector_group')) {
        return;
      }
      if (t.contact_id) contactIds.add(t.contact_id);
    });
    mensagens.forEach(m => {
      // Mensagens internas têm sender_type='user' sempre
      if (m.channel === 'interno') return;
      if (m.sender_id) contactIds.add(m.sender_id);
    });

    console.log(`[${VERSION}] 👥 Contatos únicos: ${contactIds.size}`);

    const contatos = await base44.asServiceRole.entities.Contact.filter(
      { id: { $in: Array.from(contactIds) } },
      '-created_date',
      200
    );

    console.log(`[${VERSION}] 👥 Contatos recuperados: ${contatos.length}`);

    // ✅ 4. ANÁLISE DETALHADA POR STATUS
    const analiseStatus = {
      enviando: 0,
      enviada: 0,
      entregue: 0,
      lida: 0,
      recebida: 0,
      falhou: 0,
      sem_status: 0,
    };

    mensagens.forEach(m => {
      const status = m.status || 'sem_status';
      analiseStatus[status] = (analiseStatus[status] || 0) + 1;
    });

    // ✅ 5. ANÁLISE POR TIPO DE MÍDIA
    const analiseMidia = {
      none: 0,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      sticker: 0,
      location: 0,
      contact: 0,
      unknown: 0,
    };

    mensagens.forEach(m => {
      const tipo = m.media_type || 'none';
      analiseMidia[tipo] = (analiseMidia[tipo] || 0) + 1;
    });

    // ✅ 6. ANÁLISE POR REMETENTE
    const analiseRemetente = {
      user: 0,
      contact: 0,
      sistema: 0,
    };

    mensagens.forEach(m => {
      const tipo = m.sender_type || 'unknown';
      if (tipo === 'user' || tipo === 'contact') {
        analiseRemetente[tipo] = (analiseRemetente[tipo] || 0) + 1;
      } else {
        analiseRemetente.sistema = (analiseRemetente.sistema || 0) + 1;
      }
    });

    // ✅ 7. VERIFICAR PROBLEMAS DE INTEGRIDADE
    const problemas = [];

    // Mensagens sem thread
    const semThread = mensagens.filter(m => !m.thread_id);
    if (semThread.length > 0) {
      problemas.push({
        tipo: 'CRÍTICO',
        descricao: `${semThread.length} mensagens sem thread associada`,
        ids: semThread.slice(0, 5).map(m => m.id),
      });
    }

    // Mensagens sem remetente
    const semRemetente = mensagens.filter(m => !m.sender_id);
    if (semRemetente.length > 0) {
      problemas.push({
        tipo: 'AVISO',
        descricao: `${semRemetente.length} mensagens sem sender_id`,
        ids: semRemetente.slice(0, 5).map(m => m.id),
      });
    }

    // Threads orfãs (sem contato) - APENAS threads externas
    const threadsOrfas = threads.filter(t => {
      // Threads internas não precisam de contact_id
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') {
        return false;
      }
      return !t.contact_id;
    });
    if (threadsOrfas.length > 0) {
      problemas.push({
        tipo: 'CRÍTICO',
        descricao: `${threadsOrfas.length} threads EXTERNAS sem contact_id associado`,
        ids: threadsOrfas.slice(0, 5).map(t => t.id),
      });
    }

    // Threads merged sem canonical
    const threadsMerged = threads.filter(t => t.status === 'merged' && !t.merged_into);
    if (threadsMerged.length > 0) {
      problemas.push({
        tipo: 'AVISO',
        descricao: `${threadsMerged.length} threads merged sem referência para merged_into`,
        ids: threadsMerged.slice(0, 5).map(t => t.id),
      });
    }

    // Contatos duplicados (mesmo telefone)
    const contatosPorTelefone = {};
    contatos.forEach(c => {
      if (c.telefone) {
        if (!contatosPorTelefone[c.telefone]) {
          contatosPorTelefone[c.telefone] = [];
        }
        contatosPorTelefone[c.telefone].push(c.id);
      }
    });

    const duplicados = Object.entries(contatosPorTelefone)
      .filter(([_, ids]) => ids.length > 1);

    if (duplicados.length > 0) {
      problemas.push({
        tipo: 'CRÍTICO',
        descricao: `${duplicados.length} grupos de contatos duplicados pelo telefone`,
        detalhes: duplicados.slice(0, 5),
      });
    }

    // ✅ 8. AMOSTRA DE MENSAGENS RECENTES
    const amostraMensagens = mensagens.slice(0, 10).map(m => ({
      id: m.id,
      thread_id: m.thread_id,
      sender_id: m.sender_id,
      sender_type: m.sender_type,
      status: m.status,
      media_type: m.media_type,
      content: m.content ? m.content.substring(0, 50) : 'vazio',
      created_date: m.created_date,
    }));

    // ✅ 9. AMOSTRA DE THREADS
    const amostraThreads = threads.slice(0, 10).map(t => ({
      id: t.id,
      contact_id: t.contact_id,
      status: t.status,
      is_canonical: t.is_canonical,
      channel: t.channel,
      total_mensagens: t.total_mensagens,
      unread_count: t.unread_count,
      last_message_at: t.last_message_at,
    }));

    // ✅ 10. AMOSTRA DE CONTATOS
    const amostraContatos = contatos.slice(0, 10).map(c => ({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      tipo_contato: c.tipo_contato,
      bloqueado: c.bloqueado,
      created_date: c.created_date,
    }));

    const relatorio = {
      versao: VERSION,
      data_analise: new Date().toISOString(),
      periodo: {
        dias_atras: diasAtras,
        data_corte: dataCorteISO,
      },
      resumo: {
        total_mensagens: mensagens.length,
        total_threads: threads.length,
        total_contatos: contatos.length,
      },
      analise_status: analiseStatus,
      analise_midia: analiseMidia,
      analise_remetente: analiseRemetente,
      problemas_detectados: problemas.length,
      problemas: problemas,
      amostra_mensagens: amostraMensagens,
      amostra_threads: amostraThreads,
      amostra_contatos: amostraContatos,
    };

    console.log(`[${VERSION}] ✅ Análise completa! Problemas encontrados: ${problemas.length}`);

    return Response.json(relatorio);

  } catch (error) {
    console.error(`[${VERSION}] ❌ Erro:`, error?.message || error);
    return Response.json({ error: error?.message || 'erro_interno' }, { status: 500 });
  }
});