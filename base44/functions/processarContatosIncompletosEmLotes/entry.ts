import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { lote_tamanho = 10, atraso_ms = 5000 } = await req.json().catch(() => ({}));

    console.log(`[processarContatosIncompletos] Iniciando limpeza em lotes de ${lote_tamanho}...`);

    // Buscar contatos incompletos (sem empresa/cargo)
    const contatosIncompletos = await base44.asServiceRole.entities.Contact.filter(
      {
        $or: [
          { empresa: { $exists: false } },
          { empresa: null },
          { empresa: '' },
          { cargo: { $exists: false } },
          { cargo: null },
          { cargo: '' }
        ]
      },
      '-created_date',
      1000
    );

    console.log(`[processarContatosIncompletos] Encontrados ${contatosIncompletos.length} incompletos`);

    let processados = 0;
    let erros = 0;
    const resultados = [];

    // Processar em lotes
    for (let i = 0; i < contatosIncompletos.length; i += lote_tamanho) {
      const lote = contatosIncompletos.slice(i, i + lote_tamanho);
      const numLote = Math.floor(i / lote_tamanho) + 1;

      console.log(`[processarContatosIncompletos] 📦 Lote ${numLote}: processando ${lote.length} contatos...`);

      for (const contato of lote) {
        try {
          // Verificar se tem threads associadas
          const threads = await base44.asServiceRole.entities.MessageThread.filter(
            { contact_id: contato.id },
            '-created_date',
            5
          );

          if (threads.length === 0) {
            // Sem threads → deletar contato incompleto
            await base44.asServiceRole.entities.Contact.delete(contato.id);
            resultados.push({
              id: contato.id,
              nome: contato.nome || '(sem nome)',
              acao: 'deletado',
              threads: 0
            });
            console.log(`[processarContatosIncompletos] 🗑️ Deletado: ${contato.nome} (sem threads)`);
            processados++;
          } else {
            // Com threads → marcar para revisão manual
            resultados.push({
              id: contato.id,
              nome: contato.nome || '(sem nome)',
              acao: 'manter_para_revisao',
              threads: threads.length,
              thread_ids: threads.map(t => t.id)
            });
            console.log(`[processarContatosIncompletos] 📋 Revisão: ${contato.nome} (${threads.length} threads)`);
            processados++;
          }
        } catch (error) {
          console.error(`[processarContatosIncompletos] ❌ Erro ao processar ${contato.nome}:`, error.message);
          erros++;
        }
      }

      // Aguardar antes do próximo lote (exceto no último)
      if (i + lote_tamanho < contatosIncompletos.length) {
        console.log(`[processarContatosIncompletos] ⏳ Aguardando ${atraso_ms}ms antes do próximo lote...`);
        await new Promise(resolve => setTimeout(resolve, atraso_ms));
      }
    }

    console.log(`[processarContatosIncompletos] ✅ CONCLUÍDO: ${processados} processados, ${erros} erros`);

    return Response.json({
      success: true,
      resumo: {
        total_encontrados: contatosIncompletos.length,
        processados,
        erros,
        deletados: resultados.filter(r => r.acao === 'deletado').length,
        para_revisao: resultados.filter(r => r.acao === 'manter_para_revisao').length
      },
      resultados: resultados.slice(0, 50) // Retorna os primeiros 50 detalhes
    });
  } catch (error) {
    console.error('[processarContatosIncompletos] ❌ Erro fatal:', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});