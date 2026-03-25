import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { modo = 'diagnostico', aprovarDelecao = false } = await req.json().catch(() => ({}));

    console.log(`[DIAGNOSTICO] Modo: ${modo}, Deletar aprovado: ${aprovarDelecao}`);

    // Buscar contatos em lotes (evitar timeout)
    const todos = await base44.asServiceRole.entities.Contact.list('-created_date', 1000);
    
    console.log(`[DIAGNOSTICO] Total de contatos carregados: ${todos.length}`);

    // Filtro correto: TRÊS condições simultâneas
    const incompletos = todos.filter(c => {
      const nome = (c.nome || '').trim();
      const tel = (c.telefone || '').replace(/\D/g, '');
      
      // Nome é inválido se:
      // - vazio/null
      // - igual ao telefone (número puro)
      // - começa com "Contato " (padrão legacy)
      const nomeEhTelefone = nome === c.telefone || nome === '+' + tel || nome === tel;
      const nomeInvalido = !nome || nomeEhTelefone || nome.toLowerCase().startsWith('contato ');
      
      // Incompleto = nome inválido AND sem empresa AND sem cargo
      const empresaVazia = !c.empresa || c.empresa.trim() === '';
      const cargoVazio = !c.cargo || c.cargo.trim() === '';
      
      return nomeInvalido && empresaVazia && cargoVazio;
    });

    console.log(`[DIAGNOSTICO] Contatos incompletos identificados: ${incompletos.length}`);

    // Analisar cada um: tem thread com mensagens?
    const analise = await Promise.all(
      incompletos.map(async (contato) => {
        try {
          const threads = await base44.asServiceRole.entities.MessageThread.filter(
            { contact_id: contato.id },
            '-created_date',
            5
          );

          const threadComMensagens = threads.find(t => (t.total_mensagens || 0) > 0);

          return {
            id: contato.id,
            nome: contato.nome || '(vazio)',
            telefone: contato.telefone,
            empresa: contato.empresa || '(vazio)',
            cargo: contato.cargo || '(vazio)',
            threads_total: threads.length,
            thread_com_mensagens: !!threadComMensagens,
            acao_recomendada: threadComMensagens ? 'manter_e_enriquecer' : 'pode_deletar'
          };
        } catch (e) {
          console.error(`[DIAGNOSTICO] Erro ao analisar contato ${contato.id}:`, e.message);
          return null;
        }
      })
    );

    const validos = analise.filter(a => a !== null);
    const paraManter = validos.filter(a => a.acao_recomendada === 'manter_e_enriquecer');
    const paraDeleta = validos.filter(a => a.acao_recomendada === 'pode_deletar');

    // MODO DIAGNÓSTICO: apenas relatar
    if (modo === 'diagnostico' || !aprovarDelecao) {
      return Response.json({
        sucesso: true,
        modo: 'diagnostico',
        resumo: {
          total_incompletos: validos.length,
          com_threads_ativas: paraManter.length,
          sem_threads: paraDeleta.length
        },
        recomendacoes: {
          manter: paraManter.slice(0, 20).map(a => `${a.nome} (${a.telefone})`),
          deletar: paraDeleta.slice(0, 20).map(a => `${a.nome} (${a.telefone})`)
        },
        detalhes_completos: validos
      });
    }

    // MODO LIMPEZA: deletar COM aprovação explícita
    if (modo === 'deletar' && aprovarDelecao) {
      console.log(`[LIMPEZA] ⚠️ DELETANDO ${paraDeleta.length} contatos...`);

      let deletados = 0;
      let erros = 0;

      for (const item of paraDeleta) {
        try {
          await base44.asServiceRole.entities.Contact.delete(item.id);
          deletados++;
          console.log(`[LIMPEZA] ✅ Deletado: ${item.nome}`);
        } catch (e) {
          erros++;
          console.error(`[LIMPEZA] ❌ Erro ao deletar ${item.nome}:`, e.message);
        }
      }

      return Response.json({
        sucesso: true,
        modo: 'deletado',
        resumo: {
          deletados,
          erros,
          mantidos: paraManter.length
        }
      });
    }

    return Response.json({
      erro: 'Modo desconhecido. Use modo="diagnostico" ou modo="deletar" com aprovarDelecao=true'
    }, { status: 400 });

  } catch (error) {
    console.error('[DIAGNOSTICO] Erro fatal:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});