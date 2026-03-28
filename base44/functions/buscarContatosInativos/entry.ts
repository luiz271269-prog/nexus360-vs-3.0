import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Busca contatos (leads/clientes) que fazem 5+ dias sem mensagens
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      dias_minimo = 5,
      tipo = ['lead', 'cliente'],
      limit = 100,
      incluir_sem_thread = true
    } = body;

    // Data limite: 5 dias atrás
    const dataLimite = new Date(Date.now() - dias_minimo * 24 * 60 * 60 * 1000).toISOString();

    // Buscar contatos inativos
    let queryContatos = {
      tipo_contato: { $in: Array.isArray(tipo) ? tipo : [tipo] },
      $or: [
        { ultima_interacao: { $lte: dataLimite } },
        { ultima_interacao: null }
      ]
    };

    // Filtrar por vendedor (exceto admin)
    if (user.role !== 'admin') {
      queryContatos.vendedor_responsavel = user.id;
    }

    const contatos = await base44.entities.Contact.filter(
      queryContatos,
      '-ultima_interacao',
      limit
    );

    console.log(`[BUSCA_INATIVOS] ${contatos.length} contatos encontrados (${dias_minimo}+ dias)`);

    // Buscar threads canônicas para validar se tem mensagens
    const contactIds = contatos.map(c => c.id);
    const threads = await base44.entities.MessageThread.filter({
      contact_id: { $in: contactIds },
      is_canonical: true
    });

    const threadsMap = new Map(threads.map(t => [t.contact_id, t]));

    // Filtrar: só contatos SEM thread OU com thread mas sem mensagens
    const resultados = [];
    
    for (const contato of contatos) {
      const thread = threadsMap.get(contato.id);
      
      // Se não tem thread e incluir_sem_thread = true
      if (!thread && incluir_sem_thread) {
        resultados.push({
          contact_id: contato.id,
          nome: contato.nome,
          empresa: contato.empresa,
          telefone: contato.telefone,
          tipo_contato: contato.tipo_contato,
          vendedor_responsavel: contato.vendedor_responsavel,
          ultima_interacao: contato.ultima_interacao,
          dias_inativo: Math.floor((Date.now() - new Date(contato.ultima_interacao || contato.created_date)) / (1000 * 60 * 60 * 24)),
          tem_mensagens: false,
          thread_id: null
        });
        continue;
      }

      // Se tem thread, verificar se tem mensagens
      if (thread) {
        const mensagens = await base44.entities.Message.filter({
          thread_id: thread.id
        }, null, 1);

        if (mensagens.length === 0) {
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            empresa: contato.empresa,
            telefone: contato.telefone,
            tipo_contato: contato.tipo_contato,
            vendedor_responsavel: contato.vendedor_responsavel,
            ultima_interacao: contato.ultima_interacao,
            dias_inativo: Math.floor((Date.now() - new Date(contato.ultima_interacao || contato.created_date)) / (1000 * 60 * 60 * 24)),
            tem_mensagens: false,
            thread_id: thread.id
          });
        }
      }
    }

    console.log(`[BUSCA_INATIVOS] ✅ ${resultados.length} contatos sem mensagens`);

    return Response.json({
      success: true,
      contatos: resultados,
      total: resultados.length,
      criterios: {
        dias_minimo,
        tipo,
        incluir_sem_thread
      }
    });

  } catch (error) {
    console.error('[BUSCA_INATIVOS] Erro:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});