import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Análise em Lote de Contatos (Leads/Clientes)
 * 
 * MODO 1 (On-Demand): Recebe contact_ids específicos do componente
 * MODO 2 (Scheduled): Analisa todos contatos ativos do sistema
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Tentar autenticação (pode não ter em automações scheduled)
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      console.log('[ANALISE_LOTE] Rodando sem user context (scheduled automation)');
    }
    
    const body = await req.json().catch(() => ({}));
    const { 
      contact_ids, 
      force, 
      limit = 50, 
      priorizar_ativos = true,
      modo = 'scheduled',
      tipo = ['lead', 'cliente'],
      diasSemMensagem = 2,
      minDealRisk = 30
    } = body;
    
    // ══════════════════════════════════════════════════════════════
    // MODO 1: IDs ESPECÍFICOS (chamada do componente)
    // ══════════════════════════════════════════════════════════════
    if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
      console.log(`[ANALISE_LOTE] Modo direto | IDs: ${contact_ids.length}`);
      
      const contatos = await base44.asServiceRole.entities.Contact.filter(
        { id: { $in: contact_ids } },
        '-ultima_interacao',
        100
      );
      
      const resultados = { total: contatos.length, sucesso: 0, erro: 0, erros: [] };
      
      for (const contato of contatos) {
        try {
          await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
            contact_id: contato.id
          });
          resultados.sucesso++;
          
          // Delay anti-rate-limit
          if (resultados.sucesso < contatos.length) {
            await new Promise(r => setTimeout(r, 300));
          }
        } catch (error) {
          console.error(`[ANALISE_LOTE] Erro ao analisar ${contato.nome}:`, error.message);
          resultados.erro++;
          resultados.erros.push({ 
            contact_id: contato.id, 
            nome: contato.nome,
            erro: error.message 
          });
        }
      }
      
      return Response.json({ 
        success: true, 
        modo: 'direto',
        ...resultados 
      });
    }
    
    // ══════════════════════════════════════════════════════════════
    // MODO 2: PRIORIZAÇÃO (retorna lista ordenada com contexto)
    // ══════════════════════════════════════════════════════════════
    if (modo === 'priorizacao') {
      console.log(`[ANALISE_LOTE] Modo priorização`);
      
      let queryContatos = {
        tipo_contato: { $in: Array.isArray(tipo) ? tipo : [tipo] }
      };
      
      // Filtrar por usuário (exceto admin) - apenas se tiver user
      if (user && user.role !== 'admin') {
        queryContatos.vendedor_responsavel = user.id;
      }
      
      // Filtrar contatos com atividade recente
      if (diasSemMensagem > 0) {
        queryContatos.ultima_interacao = {
          $gte: new Date(Date.now() - diasSemMensagem * 24 * 60 * 60 * 1000).toISOString()
        };
      }
      
      // ✅ Usar service role se não houver user (automações agendadas)
      const client = user ? base44 : base44.asServiceRole;
      
      const contatos = await client.entities.Contact.filter(
        queryContatos,
        '-ultima_interacao',
        limit
      );
      
      // Buscar análises (últimas 24h)
      const contactIds = contatos.map(c => c.id);
      const analises = await client.entities.ContactBehaviorAnalysis.filter(
        { contact_id: { $in: contactIds } },
        '-ultima_analise',
        200
      );
      
      const analisesMap = new Map(analises.map(a => [a.contact_id, a]));
      
      // Enriquecer contatos com análises
      const clientesEnriquecidos = contatos.map(contato => {
        const analise = analisesMap.get(contato.id);
        
        if (!analise || !analise.insights) {
          return null;
        }
        
        const scores = analise.insights.scores || {};
        const stage = analise.insights.stage || {};
        const nextAction = analise.insights.next_best_action || {};
        const rootCauses = analise.insights.root_causes || [];
        
        // Calcular prioridade
        const deal_risk = scores.deal_risk || 0;
        const buy_intent = scores.buy_intent || 0;
        const engagement = scores.engagement || 0;
        const days_stalled = stage.days_stalled || 0;
        
        let prioridadeScore = 0;
        prioridadeScore += deal_risk * 0.4;
        prioridadeScore += (100 - buy_intent) * 0.25;
        prioridadeScore += (100 - engagement) * 0.2;
        prioridadeScore += Math.min(days_stalled * 5, 15);
        
        const prioridadeLabel = 
          prioridadeScore >= 75 ? 'CRITICO' : 
          prioridadeScore >= 55 ? 'ALTO' : 
          prioridadeScore >= 35 ? 'MEDIO' : 'BAIXO';
        
        // Filtrar por minDealRisk
        if (deal_risk < minDealRisk) return null;
        
        return {
          contact_id: contato.id,
          nome: contato.nome,
          empresa: contato.empresa,
          telefone: contato.telefone,
          tipo_contato: contato.tipo_contato,
          deal_risk,
          buy_intent,
          engagement,
          health: scores.health || 0,
          stage_current: stage.current,
          stage_label: stage.label,
          days_stalled,
          root_causes: rootCauses.map(r => r.title || r),
          next_action: nextAction.action,
          suggested_message: nextAction.message_suggestion,
          prioridadeScore: Math.round(prioridadeScore),
          prioridadeLabel
        };
      }).filter(c => c !== null);
      
      // Ordenar por prioridade
      clientesEnriquecidos.sort((a, b) => b.prioridadeScore - a.prioridadeScore);
      
      // Calcular estatísticas
      const stats = {
        total: clientesEnriquecidos.length,
        porPrioridade: {
          CRITICO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'CRITICO').length,
          ALTO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'ALTO').length,
          MEDIO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'MEDIO').length,
          BAIXO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'BAIXO').length
        },
        scoresMedios: {
          deal_risk: Math.round(clientesEnriquecidos.reduce((s, c) => s + c.deal_risk, 0) / clientesEnriquecidos.length) || 0,
          engagement: Math.round(clientesEnriquecidos.reduce((s, c) => s + c.engagement, 0) / clientesEnriquecidos.length) || 0
        }
      };
      
      return Response.json({
        success: true,
        modo: 'priorizacao',
        clientes: clientesEnriquecidos,
        estatisticas: stats
      });
    }
    
    // ══════════════════════════════════════════════════════════════
    // MODO 3: AUTOMAÇÃO SCHEDULED (análise periódica)
    // ══════════════════════════════════════════════════════════════
    console.log(`[ANALISE_LOTE] Modo scheduled | Limit: ${limit}`);
    
    let query = {
      tipo_contato: { $in: Array.isArray(tipo) ? tipo : ['lead', 'cliente'] }
    };
    
    if (priorizar_ativos) {
      query.ultima_interacao = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
    
    // Usar service role para automações (sem user context)
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      query,
      '-ultima_interacao',
      limit
    );
    
    console.log(`[ANALISE_LOTE] ${contatos.length} contatos encontrados`);
    
    const resultados = {
      total_processados: 0,
      analises_criadas: 0,
      analises_puladas: 0,
      erros: []
    };
    
    for (const contato of contatos) {
      resultados.total_processados++;
      
      try {
        // Verificar análise recente (< 24h) - usar service role
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
          resultados.analises_puladas++;
          console.log(`[ANALISE_LOTE] Pulando ${contato.nome} (análise < 24h)`);
          continue;
        }
        
        // Executar análise (service role para chamada interna)
        await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
          contact_id: contato.id
        });
        
        resultados.analises_criadas++;
        console.log(`[ANALISE_LOTE] ✅ ${contato.nome} analisado`);
        
        // Delay anti-rate-limit
        if (resultados.total_processados < contatos.length) {
          await new Promise(r => setTimeout(r, 200));
        }
        
      } catch (error) {
        console.error(`[ANALISE_LOTE] Erro em ${contato.nome}:`, error.message);
        resultados.erros.push({
          contact_id: contato.id,
          nome: contato.nome,
          erro: error.message
        });
      }
    }
    
    return Response.json({
      success: true,
      modo: 'scheduled',
      ...resultados
    });
    
  } catch (error) {
    console.error('[ANALISE_LOTE] Erro crítico:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});