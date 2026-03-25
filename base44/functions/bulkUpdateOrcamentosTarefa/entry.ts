import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { vendedor, novoStatus = 'enviado', deduplicate = true } = await req.json();

    if (!vendedor) {
      return new Response(JSON.stringify({ error: 'Vendedor obrigatório' }), { status: 400 });
    }

    // 1️⃣ Buscar todos os orçamentos do vendedor
    const orcamentos = await base44.entities.Orcamento.filter({ vendedor: vendedor.trim() });
    console.log(`📋 Encontrados ${orcamentos.length} orçamentos para "${vendedor}"`);

    // 2️⃣ DEDUPLICAÇÃO: remover duplicatas por cliente_nome + valor_total
    let orcamentosUnicos = orcamentos;
    let remocoes = 0;
    
    if (deduplicate) {
      const mapa = new Map();
      const duplicatas = [];

      for (const orc of orcamentos) {
        const chave = `${(orc.cliente_nome || '').toLowerCase().trim()}_${orc.valor_total}`;
        if (mapa.has(chave)) {
          // Duplicata detectada: manter a mais recente, remover a antiga
          duplicatas.push(mapa.get(chave).id);
          mapa.set(chave, orc);
        } else {
          mapa.set(chave, orc);
        }
      }

      // Deletar duplicatas
      for (const dupId of duplicatas) {
        try {
          await base44.entities.Orcamento.delete(dupId);
          remocoes++;
          console.log(`🗑️ Duplicata removida: ${dupId}`);
        } catch (e) {
          console.warn(`⚠️ Erro ao remover ${dupId}:`, e.message);
        }
      }

      orcamentosUnicos = Array.from(mapa.values());
    }

    // 3️⃣ ATUALIZAÇÃO: mover para novo status
    let atualizados = 0;
    const erros = [];

    for (const orc of orcamentosUnicos) {
      if (orc.status !== novoStatus) {
        try {
          await base44.entities.Orcamento.update(orc.id, {
            status: novoStatus,
            updated_date: new Date().toISOString()
          });
          atualizados++;
          console.log(`✅ Atualizado: ${orc.id} → ${novoStatus}`);
        } catch (e) {
          erros.push({ id: orc.id, erro: e.message });
          console.error(`❌ Erro ao atualizar ${orc.id}:`, e.message);
        }
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      resumo: {
        total_inicial: orcamentos.length,
        duplicatas_removidas: remocoes,
        total_unico: orcamentosUnicos.length,
        atualizados,
        status_novo: novoStatus,
        erros: erros.length > 0 ? erros : undefined
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ Erro na operação:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});