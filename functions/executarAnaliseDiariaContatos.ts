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

    // ✅ CORREÇÃO 401: Verificar se há autenticação (automações agendadas não enviam Authorization)
    let user = null;
    try {
      user = await base44.auth.me();
      console.log(`[ANALISE_DIARIA] Executando como usuário: ${user.email}`);
    } catch (authError) {
      console.log(`[ANALISE_DIARIA] Rodando sem autenticação (scheduled automation mode) - usando service role`);
      // OK: Automações agendadas rodam sem user context, apenas com service role
    }

    console.log(`[ANALISE_DIARIA] Iniciando rotina diária (modo: scheduled - service role)`);

    const resultados = {
      modo_execucao: 'scheduled',
      rotinas: [],
      tempo_total_ms: 0,
      total_contatos_analisados: 0,
      total_analises_criadas: 0,
      erros: []
    };

    // Helper: rodar análise in-line (sem chamar função externa)
    async function rodarLote(descricao, filtroContatos, limitContatos) {
      const inicioLote = Date.now();
      console.log(`[ANALISE_DIARIA] 📊 ${descricao}`);

      try {
        // Buscar contatos direto no banco
        const contatos = await base44.asServiceRole.entities.Contact.filter(
          filtroContatos,
          '-ultima_interacao',
          limitContatos
        );

        console.log(`[ANALISE_DIARIA] ${contatos.length} contatos encontrados para ${descricao}`);

        let analisados = 0;
        let criados = 0;
        const errosInternos = [];

        for (const contato of contatos) {
          analisados++;
          
          try {
            // Verificar análise recente (< 24h)
            const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
              {
                contact_id: contato.id,
                ultima_analise: { 
                  $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
                }
              },
              '-ultima_analise',
              1
            );
            
            if (analises.length > 0) {
              console.log(`[ANALISE_DIARIA] ⏭️ Pulando ${contato.nome} (análise < 24h)`);
              continue;
            }

            // Chamar análise diretamente
            await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
              contact_id: contato.id
            });
            
            criados++;
            console.log(`[ANALISE_DIARIA] ✅ ${contato.nome} analisado`);
            
            // Delay anti-rate-limit
            if (analisados < contatos.length) {
              await new Promise(r => setTimeout(r, 200));
            }
            
          } catch (error) {
            console.error(`[ANALISE_DIARIA] Erro em ${contato.nome}:`, error.message);
            errosInternos.push({ nome: contato.nome, erro: error.message });
          }
        }

        const tempo_ms = Date.now() - inicioLote;
        
        resultados.total_contatos_analisados += analisados;
        resultados.total_analises_criadas += criados;

        resultados.rotinas.push({
          descricao,
          status: 'sucesso',
          tempo_ms,
          contatos_encontrados: contatos.length,
          contatos_analisados: analisados,
          analises_criadas: criados,
          erros_internos: errosInternos.length
        });

        console.log(`[ANALISE_DIARIA] ✅ ${descricao} | ${criados} análises criadas | ${tempo_ms}ms`);

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
      200
    );

    // 2️⃣ INATIVIDADE: 30-59 dias sem mensagem
    await rodarLote('INATIVOS_30_59_DIAS',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { 
          $gte: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      100
    );

    // 3️⃣ INATIVIDADE: 60-89 dias sem mensagem
    await rodarLote('INATIVOS_60_89_DIAS',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { 
          $gte: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(),
          $lte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      100
    );

    // 4️⃣ INATIVIDADE: 90+ dias sem mensagem (risco de abandono)
    await rodarLote('INATIVOS_90_PLUS_DIAS',
      {
        tipo_contato: { $in: ['lead', 'cliente'] },
        ultima_interacao: { $lte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() }
      },
      100
    );

    // 5️⃣ CONTATOS VIP: Sempre analisar (independente de inatividade)
    await rodarLote('CONTATOS_VIP',
      {
        is_vip: true,
        tipo_contato: { $in: ['lead', 'cliente'] }
      },
      50
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