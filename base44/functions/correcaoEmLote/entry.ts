import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const erros = [];
    let threads_corrigidas = 0;
    let contato_luiz_ok = false;
    let contato_luiz2_ok = false;
    let totalEncontradas = 0;

    // ─── CORREÇÃO 1: Resetar TODAS as threads com pre_atendimento_ativo = true ───
    try {
      // Busca em lotes até esgotar todos os registros
      let skip = 0;
      const lote = 50; // Reduzido para 50 por iteração para evitar timeout
      
      while (true) {
        const batch = await base44.asServiceRole.entities.MessageThread.filter(
          { pre_atendimento_ativo: true },
          '-last_message_at',
          lote,
          skip
        );

        if (!batch || batch.length === 0) break;
        totalEncontradas += batch.length;

        for (const thread of batch) {
          try {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              pre_atendimento_ativo: false,
              pre_atendimento_state: 'COMPLETED'
            });
            threads_corrigidas++;
          } catch (e) {
            erros.push(`Thread ${thread.id}: ${e.message}`);
          }
        }

        // Guard de tempo — se já processou muitas, para para evitar timeout
        if (threads_corrigidas >= 250) break;
        if (batch.length < lote) break;
        skip += lote;
      }
    } catch (e) {
      erros.push(`Correção 1 falhou: ${e.message}`);
    }

    // ─── CORREÇÃO 2: Corrigir contato Luiz Liesch ───
    try {
      await base44.asServiceRole.entities.Contact.update('69a74215606827d9dd93e269', {
        tipo_contato: 'parceiro',
        cargo: 'Gerente Geral / Desenvolvedor'
      });
      contato_luiz_ok = true;
    } catch (e) {
      erros.push(`Correção 2 (Luiz Liesch): ${e.message}`);
    }

    // ─── CORREÇÃO 3: Preencher telefone_canonico vazio ───
    try {
      await base44.asServiceRole.entities.Contact.update('69666540ceec0fc8698b0d0d', {
        telefone_canonico: '5548999322400'
      });
      contato_luiz2_ok = true;
    } catch (e) {
      erros.push(`Correção 3 (telefone_canonico): ${e.message}`);
    }

    return Response.json({
      threads_corrigidas,
      totalEncontradas,
      contato_luiz_ok,
      contato_luiz2_ok,
      erros_count: erros.length,
      sucesso: threads_corrigidas > 0 && contato_luiz_ok && contato_luiz2_ok
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});