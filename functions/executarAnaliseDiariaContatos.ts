import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ORQUESTRADOR DIÁRIO DE ANÁLISE DE CONTATOS
 * Executa análise in-line sem chamar função externa (evita 403)
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

    console.log(`[ANALISE_DIARIA] Iniciando rotina diária (service role)`);

    const resultados = {
      modo_execucao: 'scheduled',
      rotinas: [],
      tempo_total_ms: 0,
      total_contatos_analisados: 0,
      total_analises_criadas: 0,
      erros: []
    };

    // Helper: analisar lote direto (sem chamar analisarClientesEmLote)
    async function rodarLote(descricao, filtroContatos, limitContatos) {
      const inicioLote = Date.now();
      console.log(`[ANALISE_DIARIA] 📊 ${descricao}`);

      try {
        const contatos = await base44.asServiceRole.entities.Contact.filter(
          filtroContatos,
          '-ultima_interacao',
          limitContatos
        );

        console.log(`[ANALISE_DIARIA] ${contatos.length} contatos para ${descricao}`);

        let processados = 0;
        let criados = 0;
        const errosInternos = [];

        for (const contato of contatos) {
          processados++;
          
          try {
            // Verificar análise recente (< 24h)
            const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
              {
                contact_id: contato.id,
                created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
              },
              '-created_date',
              1
            );
            
            if (analises.length > 0) {
              continue;
            }

            // Chamar análise
            const resp = await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
              contact_id: contato.id
            });
            
            if (resp.success || resp.data?.success) {
              criados++;
            }
            
            // Delay anti-rate-limit (500ms entre análises)
            if (processados < contatos.length) {
              await new Promise(r => setTimeout(r, 500));
            }
            
          } catch (error) {
            errosInternos.push({ nome: contato.nome, erro: error.message });
            
            // Se atingir rate limit, aguardar mais tempo
            if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
              console.warn(`[ANALISE_DIARIA] Rate limit - aguardando 3s`);
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        }

        const tempo_ms = Date.now() - inicioLote;
        
        resultados.total_contatos_analisados += processados;
        resultados.total_analises_criadas += criados;

        resultados.rotinas.push({
          descricao,
          status: errosInternos.length < contatos.length ? 'sucesso' : 'erro_parcial',
          tempo_ms,
          contatos_encontrados: contatos.length,
          contatos_processados: processados,
          analises_criadas: criados,
          erros: errosInternos.length
        });

        console.log(`[ANALISE_DIARIA] ✅ ${descricao} | ${criados}/${contatos.length} | ${tempo_ms}ms`);

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
    await rodarLote('VARREDURA_30_DIAS', 
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      },
      50 // Reduzido para evitar timeout
    );

    // 2️⃣ INATIVIDADE: 30-59 dias
    await rodarLote('INATIVOS_30_59_DIAS',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { 
          $gte: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      30
    );

    // 3️⃣ INATIVIDADE: 60-89 dias
    await rodarLote('INATIVOS_60_89_DIAS',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { 
          $gte: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      30
    );

    // 4️⃣ CONTATOS VIP
    await rodarLote('CONTATOS_VIP',
      {
        is_vip: true,
        tipo_contato: { $in: ['lead', 'cliente'] }
      },
      20
    );

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
      mensagem: `Análise diária: ${resultados.total_analises_criadas} análises criadas de ${resultados.total_contatos_analisados} processados`,
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