import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Não autorizado - apenas admins' }, { status: 403 });
    }

    console.log('🧹 [LIMPEZA] Iniciando limpeza de JIDs inválidos...');

    // ====================================
    // 1️⃣ IDENTIFICAR E EXCLUIR CONTATOS INVÁLIDOS
    // ====================================
    const todosContatos = await base44.asServiceRole.entities.Contact.list();
    const contatosInvalidos = todosContatos.filter(contato => {
      const nome = (contato.nome || '').trim();
      const telefone = (contato.telefone || '').trim();

      // Verificar se é JID inválido
      const isJID = 
        /@(broadcast|lid|s\.whatsapp\.net|c\.us)/i.test(nome) ||
        /@(broadcast|lid|s\.whatsapp\.net|c\.us)/i.test(telefone) ||
        /status@/i.test(nome) ||
        /status@/i.test(telefone) ||
        /^[\+\-\d\s]+@/i.test(nome) ||
        /^[\+\-\d\s]+@/i.test(telefone);

      return isJID;
    });

    console.log(`🔍 [CONTATOS] Encontrados ${contatosInvalidos.length} contatos inválidos`);

    for (const contato of contatosInvalidos) {
      try {
        await base44.asServiceRole.entities.Contact.delete(contato.id);
        console.log(`✅ Contato deletado: ${contato.nome || contato.telefone} (${contato.id})`);
      } catch (error) {
        console.error(`❌ Erro ao deletar contato ${contato.id}:`, error);
      }
    }

    // ====================================
    // 2️⃣ IDENTIFICAR E EXCLUIR MENSAGENS INVÁLIDAS
    // ====================================
    const todasMensagens = await base44.asServiceRole.entities.Message.list('-created_date', 5000);
    const mensagensInvalidas = todasMensagens.filter(msg => {
      const content = (msg.content || '').trim();

      // Verificar se é mensagem inválida
      const isInvalida = 
        // JIDs do WhatsApp
        /@(broadcast|lid|s\.whatsapp\.net|c\.us)/i.test(content) ||
        /status@/i.test(content) ||
        /^[\+\-\d\s]+@/i.test(content) ||
        /^\+?\d+@/i.test(content) ||
        
        // Conteúdos genéricos
        /^(Adicionar|Referência|Mídia enviada|Media enviada)$/i.test(content) ||
        
        // Apenas números e símbolos
        (/^[\+\-\s\d@\.]+$/.test(content) && content.length < 50) ||
        
        // Prefixos inválidos
        content.startsWith('[Media type:') ||
        
        // Lista de inválidos
        ['Mídia enviada', 'Media enviada', 'Adicionar', 'Referência', '[No content]', '[Message content missing]', '[Recovered message]'].includes(content);

      return isInvalida;
    });

    console.log(`🔍 [MENSAGENS] Encontradas ${mensagensInvalidas.length} mensagens inválidas`);

    for (const msg of mensagensInvalidas) {
      try {
        await base44.asServiceRole.entities.Message.delete(msg.id);
        console.log(`✅ Mensagem deletada: ${(msg.content || '').substring(0, 50)}... (${msg.id})`);
      } catch (error) {
        console.error(`❌ Erro ao deletar mensagem ${msg.id}:`, error);
      }
    }

    // ====================================
    // 3️⃣ LIMPAR THREADS ÓRFÃS (sem contato válido)
    // ====================================
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list();
    let threadsExcluidas = 0;

    for (const thread of todasThreads) {
      try {
        const contatoExiste = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
        if (!contatoExiste) {
          await base44.asServiceRole.entities.MessageThread.delete(thread.id);
          threadsExcluidas++;
          console.log(`✅ Thread órfã deletada: ${thread.id}`);
        }
      } catch (error) {
        // Contato não existe, deletar thread
        try {
          await base44.asServiceRole.entities.MessageThread.delete(thread.id);
          threadsExcluidas++;
          console.log(`✅ Thread órfã deletada: ${thread.id}`);
        } catch (err) {
          console.error(`❌ Erro ao deletar thread ${thread.id}:`, err);
        }
      }
    }

    const resultado = {
      success: true,
      timestamp: new Date().toISOString(),
      estatisticas: {
        contatos_removidos: contatosInvalidos.length,
        mensagens_removidas: mensagensInvalidas.length,
        threads_orfas_removidas: threadsExcluidas,
        total_removido: contatosInvalidos.length + mensagensInvalidas.length + threadsExcluidas
      },
      detalhes: {
        contatos_removidos: contatosInvalidos.map(c => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone
        })),
        amostra_mensagens: mensagensInvalidas.slice(0, 10).map(m => ({
          id: m.id,
          content: (m.content || '').substring(0, 100)
        }))
      }
    };

    console.log('✅ [LIMPEZA] Concluída com sucesso:', resultado.estatisticas);

    return Response.json(resultado);

  } catch (error) {
    console.error('❌ [LIMPEZA] Erro fatal:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});