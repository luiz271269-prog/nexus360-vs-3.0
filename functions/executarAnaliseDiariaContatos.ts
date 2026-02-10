import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ORQUESTRADOR DIÁRIO DE ANÁLISE DE CONTATOS
 * Executa 5 rotinas em sequência para manter ContactBehaviorAnalysis atualizado
 * Deve ser agendado para rodar 1x por dia (ex: 2h da manhã)
 */
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
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
    }

    const { modo_execucao = 'usuario_atual' } = await req.json().catch(() => ({}));

    console.log(`[ANALISE_DIARIA] Iniciando rotina para usuário ${user.id} (modo: ${modo_execucao})`);

    const resultados = {
      usuario_id: user.id,
      modo_execucao,
      rotinas: [],
      tempo_total_ms: 0,
      total_contatos_analisados: 0,
      total_analises_criadas: 0,
      erros: []
    };

    // Helper: rodar lote e registrar resultado
    async function rodarLote(descricao, payload) {
      const inicioLote = Date.now();
      console.log(`[ANALISE_DIARIA] 📊 ${descricao}`);

      try {
        const resp = await base44.functions.invoke('analisarClientesEmLote', payload);
        const tempo_ms = Date.now() - inicioLote;

        const resumo = resp.data || resp;
        const analisados = resumo.total_processados || 0;
        const criados = resumo.total_analises_criadas || 0;

        resultados.total_contatos_analisados += analisados;
        resultados.total_analises_criadas += criados;

        resultados.rotinas.push({
          descricao,
          status: 'sucesso',
          tempo_ms,
          contatos_analisados: analisados,
          analises_criadas: criados
        });

        console.log(`[ANALISE_DIARIA] ✅ ${descricao} | ${analisados} contatos | ${tempo_ms}ms`);

      } catch (error) {
        const tempo_ms = Date.now() - inicioLote;
        console.error(`[ANALISE_DIARIA] ❌ ${descricao}:`, error);

        resultados.rotinas.push({
          descricao,
          status: 'erro',
          tempo_ms,
          erro: error.message
        });

        resultados.erros.push({
          rotina: descricao,
          erro: error.message
        });
      }
    }

    // ==========================================
    // ROTINAS DE ANÁLISE
    // ==========================================

    // 1️⃣ VARREDURA: Contatos ativos (últimos 30 dias)
    await rodarLote('VARREDURA_30_DIAS', {
      modo: 'agendado',
      tipo: ['lead', 'cliente'],
      limit: 200
    });

    // 2️⃣ INATIVIDADE: 30-59 dias sem mensagem
    await rodarLote('INATIVOS_30_59_DIAS', {
      modo: 'agendado',
      tipo: ['lead', 'cliente'],
      diasSemMensagem: 30,
      limit: 100
    });

    // 3️⃣ INATIVIDADE: 60-89 dias sem mensagem
    await rodarLote('INATIVOS_60_89_DIAS', {
      modo: 'agendado',
      tipo: ['lead', 'cliente'],
      diasSemMensagem: 60,
      limit: 100
    });

    // 4️⃣ INATIVIDADE: 90+ dias sem mensagem (risco de abandono)
    await rodarLote('INATIVOS_90_PLUS_DIAS', {
      modo: 'agendado',
      tipo: ['lead', 'cliente'],
      diasSemMensagem: 90,
      limit: 100
    });

    // 5️⃣ CONTATOS VIP: Sempre analisar (independente de inatividade)
    const contatosVip = await base44.asServiceRole.entities.Contact.filter({
      is_vip: true,
      tipo_contato: { $in: ['lead', 'cliente'] }
    }, '-updated_date', 50);

    if (contatosVip.length > 0) {
      await rodarLote('CONTATOS_VIP', {
        modo: 'sob_demanda',
        contact_ids: contatosVip.map(c => c.id),
        forcarReanalise: true
      });
    }

    // ==========================================
    // FINALIZAÇÃO
    // ==========================================
    resultados.tempo_total_ms = Date.now() - inicio;

    console.log('[ANALISE_DIARIA] ✅ Rotina concluída', {
      tempo_total: `${(resultados.tempo_total_ms / 1000).toFixed(1)}s`,
      contatos: resultados.total_contatos_analisados,
      analises: resultados.total_analises_criadas,
      erros: resultados.erros.length
    });

    return Response.json({
      success: true,
      mensagem: `Análise diária concluída: ${resultados.total_contatos_analisados} contatos processados`,
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