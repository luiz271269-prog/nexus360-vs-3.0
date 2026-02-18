import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ORQUESTRADOR DIÁRIO DE ANÁLISE DE CONTATOS
 * 
 * ESTRATÉGIA ANTI-TIMEOUT:
 * - Timeout interno de 45s (servidor corta em ~60s)
 * - Processa poucos contatos por execução (10-15 total)
 * - Prioriza contatos sem análise recente
 * - Delay mínimo entre chamadas (200ms)
 * - Para graciosamente quando tempo limite se aproxima
 */

const TIMEOUT_INTERNO_MS = 45_000; // 45 segundos
const DELAY_ENTRE_CONTATOS_MS = 200;

Deno.serve(async (req) => {
  const inicio = Date.now();

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    console.log('[ANALISE_DIARIA] 🚀 Iniciando (timeout interno: 45s)');

    const resultados = {
      rotinas: [],
      total_contatos_analisados: 0,
      total_analises_criadas: 0,
      total_pulados: 0,
      parou_por_timeout: false,
      erros: []
    };

    // Helper: verificar se tempo está acabando
    const tempoEsgotado = () => (Date.now() - inicio) >= TIMEOUT_INTERNO_MS;

    // Helper: processar um lote de contatos
    async function rodarLote(descricao, filtroContatos, limite) {
      if (tempoEsgotado()) {
        console.warn(`[ANALISE_DIARIA] ⏱️ Pulando ${descricao} - tempo esgotado`);
        resultados.parou_por_timeout = true;
        return;
      }

      const inicioLote = Date.now();
      console.log(`[ANALISE_DIARIA] 📊 ${descricao} (limite: ${limite})`);

      let contatos = [];
      try {
        contatos = await base44.asServiceRole.entities.Contact.filter(
          filtroContatos,
          '-ultima_interacao',
          limite
        );
      } catch (error) {
        console.error(`[ANALISE_DIARIA] ❌ Erro ao buscar ${descricao}:`, error.message);
        resultados.erros.push({ rotina: descricao, erro: error.message });
        return;
      }

      console.log(`[ANALISE_DIARIA] ${contatos.length} contatos em ${descricao}`);

      let processados = 0;
      let criados = 0;
      let pulados = 0;

      // Corte de 24h de análise
      const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      for (const contato of contatos) {
        // Parar se tempo interno esgotado
        if (tempoEsgotado()) {
          console.warn(`[ANALISE_DIARIA] ⏱️ Timeout interno atingido em ${descricao} (${processados}/${contatos.length})`);
          resultados.parou_por_timeout = true;
          break;
        }

        try {
          // Verificar análise recente em memória (sem query extra)
          // Usar apenas a data do contato para evitar N queries extras
          const ultimaAnalise = contato.ultima_analise_comportamento;
          if (ultimaAnalise && ultimaAnalise >= limite24h) {
            pulados++;
            continue;
          }

          await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
            contact_id: contato.id
          });

          criados++;
          processados++;

          if (processados < contatos.length) {
            await new Promise(r => setTimeout(r, DELAY_ENTRE_CONTATOS_MS));
          }

        } catch (error) {
          processados++;
          resultados.erros.push({ nome: contato.nome, erro: error.message });

          // Rate limit: aguardar mais
          if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
            console.warn('[ANALISE_DIARIA] ⚠️ Rate limit - aguardando 5s');
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }

      resultados.total_contatos_analisados += processados;
      resultados.total_analises_criadas += criados;
      resultados.total_pulados += pulados;

      const tempoLote = Date.now() - inicioLote;
      resultados.rotinas.push({
        descricao,
        status: 'ok',
        tempo_ms: tempoLote,
        encontrados: contatos.length,
        processados,
        criados,
        pulados
      });

      console.log(`[ANALISE_DIARIA] ✅ ${descricao} | criados: ${criados} | pulados: ${pulados} | ${tempoLote}ms`);
    }

    // ==========================================
    // ROTINAS - Limites pequenos para caber no timeout
    // Total máximo: ~15 análises × ~2s cada = ~30s
    // ==========================================

    // 1️⃣ ATIVOS (30 dias) - maior prioridade, mais volume
    await rodarLote('ATIVOS_30D',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      },
      8
    );

    // 2️⃣ INATIVOS 30-60 dias
    await rodarLote('INATIVOS_30_60D',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: {
          $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      4
    );

    // 3️⃣ INATIVOS 60-90 dias
    await rodarLote('INATIVOS_60_90D',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: {
          $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      3
    );

    // 4️⃣ VIPs - sempre analisar
    await rodarLote('VIPS',
      { is_vip: true, tipo_contato: { $in: ['lead', 'cliente'] } },
      5
    );

    // ==========================================
    const tempoTotal = Date.now() - inicio;
    console.log('[ANALISE_DIARIA] 🏁 Concluído', {
      tempo_total: `${(tempoTotal / 1000).toFixed(1)}s`,
      analisados: resultados.total_contatos_analisados,
      criados: resultados.total_analises_criadas,
      pulados: resultados.total_pulados,
      timeout: resultados.parou_por_timeout,
      erros: resultados.erros.length
    });

    return Response.json({
      success: true,
      mensagem: `${resultados.total_analises_criadas} análises criadas, ${resultados.total_pulados} puladas (já analisadas), ${resultados.total_contatos_analisados} processados em ${(tempoTotal / 1000).toFixed(1)}s`,
      tempo_total_ms: tempoTotal,
      ...resultados
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[ANALISE_DIARIA] ❌ Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message,
      tempo_ms: Date.now() - inicio
    }, { status: 500, headers: corsHeaders });
  }
});