import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * ANÁLISE DE CONTATOS - PADRÃO BATCHING
 * 
 * Roda a cada 15 min. Processa um lote pequeno de contatos que ainda
 * não foram analisados nas últimas 24h e para antes do timeout do servidor.
 */

const TIMEOUT_LIMITE_MS = 35_000;    // Para em 35s (servidor corta em ~60s)
const MAX_CONTATOS_POR_EXECUCAO = 12; // Lote seguro por execução
const DELAY_ENTRE_INVOKE_MS = 200;    // Fôlego entre chamadas LLM

Deno.serve(async (req) => {
  const inicio = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const base44 = createClientFromRequest(req);
    console.log('[ANALISE] 🚀 Iniciando lote (max: ' + MAX_CONTATOS_POR_EXECUCAO + ' contatos)');

    // Contatos que NÃO foram analisados nas últimas 24h
    // Isso garante rotatividade: cada execução pega os próximos da fila
    const corte24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const contatos = await base44.asServiceRole.entities.Contact.filter(
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        $or: [
          { ultima_analise_comportamento: { $lt: corte24h } },
          { ultima_analise_comportamento: null }
        ]
      },
      '-ultima_interacao',
      MAX_CONTATOS_POR_EXECUCAO
    );

    console.log(`[ANALISE] ${contatos.length} contatos na fila`);

    let processados = 0;
    let falhas = 0;

    for (const contato of contatos) {
      // Verificar tempo restante antes de cada análise
      if (Date.now() - inicio > TIMEOUT_LIMITE_MS) {
        console.warn('[ANALISE] ⏱️ Tempo limite interno atingido — encerrando lote');
        break;
      }

      try {
        await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
          contact_id: contato.id
        });
        processados++;
        console.log(`[ANALISE] ✅ ${contato.nome} (${processados}/${contatos.length})`);
      } catch (err) {
        falhas++;
        console.error(`[ANALISE] ❌ Erro em ${contato.nome}:`, err.message);
      }

      await new Promise(r => setTimeout(r, DELAY_ENTRE_INVOKE_MS));
    }

    const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`[ANALISE] 🏁 Lote finalizado — ${processados} analisados, ${falhas} falhas, ${tempoTotal}s`);

    return Response.json({
      success: true,
      total_na_fila: contatos.length,
      processados,
      falhas,
      tempo_execucao_s: tempoTotal,
      status: processados === contatos.length ? 'completo' : 'parcial'
    });

  } catch (error) {
    console.error('[ANALISE] ❌ Erro crítico:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});