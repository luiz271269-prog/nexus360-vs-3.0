import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ==========================================
// SEGMENTAÇÃO AUTOMÁTICA EM LOTE
// ==========================================
// Analisa todos os contatos ativos e segmenta automaticamente

Deno.serve(async (req) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar segmentação em lote' }, 
        { status: 403, headers: corsHeaders });
    }

    console.log('[SEGMENTACAO] Iniciando análise em lote...');

    // Buscar todos contatos não bloqueados
    const contatos = await base44.asServiceRole.entities.Contact.filter({ bloqueado: false });
    
    const resultados = {
      total: contatos.length,
      analisados: 0,
      erros: 0,
      segmentacoes: {}
    };

    for (const contato of contatos) {
      try {
        // Verificar se já foi analisado recentemente (últimas 24h)
        const ultimaAnalise = contato.ultima_analise_comportamento;
        if (ultimaAnalise) {
          const horasDesdeAnalise = (Date.now() - new Date(ultimaAnalise).getTime()) / (1000 * 60 * 60);
          if (horasDesdeAnalise < 24) {
            console.log(`[SEGMENTACAO] Pulando ${contato.nome} - analisado há ${horasDesdeAnalise.toFixed(1)}h`);
            continue;
          }
        }

        // Invocar análise individual
        const resultado = await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
          contact_id: contato.id,
          periodo_dias: 30
        });

        if (resultado.success) {
          resultados.analisados++;
          const segmento = resultado.resumo?.segmento || 'desconhecido';
          resultados.segmentacoes[segmento] = (resultados.segmentacoes[segmento] || 0) + 1;
        } else {
          resultados.erros++;
        }

        // Pequeno delay para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[SEGMENTACAO] Erro ao analisar ${contato.nome}:`, error);
        resultados.erros++;
      }
    }

    console.log('[SEGMENTACAO] Concluído:', resultados);

    return Response.json({
      success: true,
      resultados
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[SEGMENTACAO] Erro geral:', error);
    return Response.json({
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
});