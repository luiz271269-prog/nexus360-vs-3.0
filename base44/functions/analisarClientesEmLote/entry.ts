import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Análise em Lote de Contatos (Leads/Clientes)
 * 
 * MODO 1 (On-Demand): Recebe contact_ids específicos do componente
 * MODO 2 (Scheduled): Analisa todos contatos ativos do sistema
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    
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
      minDealRisk = 30,
      bucket_inactive = null, // '30'|'60'|'90'|'all'|null
      include_sem_analise = true
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
      console.log(`[ANALISE_LOTE] 🎯 Modo priorização`);
      
      let queryContatos = {
        tipo_contato: { $in: Array.isArray(tipo) ? tipo : [tipo] }
      };
      
      // Filtrar por usuário (exceto admin)
      if (user && user.role !== 'admin') {
        queryContatos.vendedor_responsavel = user.id;
      }
      
      // ✅ PATCH 1: Filtro INVERTIDO com suporte a BUCKETS
      const agora = new Date();
      
      // Determinar dias de inatividade por bucket
      let diasInatividade;
      if (bucket_inactive === '90') {
        diasInatividade = 90;
      } else if (bucket_inactive === '60') {
        diasInatividade = 60;
      } else if (bucket_inactive === '30') {
        diasInatividade = 30;
      } else if (bucket_inactive === 'all') {
        diasInatividade = null; // Sem filtro de data
      } else {
        diasInatividade = Math.max(diasSemMensagem, 2); // Default
      }
      
      if (diasInatividade !== null) {
        queryContatos.ultima_interacao = {
          $lte: new Date(agora.getTime() - diasInatividade * 24 * 60 * 60 * 1000).toISOString()
        };
        console.log(`[ANALISE_LOTE] 📅 Buscando contatos inativos há ${diasInatividade}+ dias (bucket: ${bucket_inactive || 'default'})`);
      } else {
        console.log(`[ANALISE_LOTE] 📅 Buscando TODOS contatos (sem filtro de inatividade)`);
      }
      
      const client = user ? base44 : base44.asServiceRole;
      
      // ✅ BUSCAR CONTATOS INATIVOS + CONTATOS FIDELIZADOS/VIP SEPARADAMENTE
      // Contatos leais (fidelizados/VIP) SEMPRE devem aparecer, independente de inatividade
      const [contatosInativosRaw, contatosLeaisRaw] = await Promise.all([
        client.entities.Contact.filter(queryContatos, '-ultima_interacao', limit || 9999),
        client.entities.Contact.filter(
          {
            tipo_contato: { $in: Array.isArray(tipo) ? tipo : [tipo] },
            ...(user && user.role !== 'admin' ? { vendedor_responsavel: user.id } : {}),
            $or: [{ is_cliente_fidelizado: true }, { is_vip: true }]
          },
          '-ultima_interacao',
          200
        ).catch(() => []) // silencioso se falhar
      ]);
      const contatosInativos = Array.isArray(contatosInativosRaw) ? contatosInativosRaw : [];
      const contatosLeais = Array.isArray(contatosLeaisRaw) ? contatosLeaisRaw : [];
      
      // Unificar sem duplicatas (leais têm prioridade)
      const idsLeais = new Set(contatosLeais.map(c => c.id));
      const contatosCombinados = [
        ...contatosLeais,
        ...contatosInativos.filter(c => !idsLeais.has(c.id))
      ];
      
      const contatos = contatosCombinados;
      
      console.log(`[ANALISE_LOTE] 📊 ${contatos.length} contatos inativos encontrados`);
      
      // ✅ Buscar análises (últimas 7 dias - estrutura V3) + threads canônicas
      const contactIds = contatos.map(c => c.id);
      
      const [analises, threads] = await Promise.all([
        client.entities.ContactBehaviorAnalysis.filter(
          { 
            contact_id: { $in: contactIds },
            analyzed_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
          },
          '-analyzed_at',
          200
        ),
        // ✅ PATCH 5: Buscar threads canônicas para navegação
        client.entities.MessageThread.filter(
          { contact_id: { $in: contactIds }, is_canonical: true },
          null,
          200
        )
      ]);
      
      console.log(`[ANALISE_LOTE] ${analises.length} análises + ${threads.length} threads para ${contactIds.length} contatos`);
      
      const analisesMap = new Map(analises.map(a => [a.contact_id, a]));
      const threadsMap = new Map(threads.map(t => [t.contact_id, t]));
      
      // ✅ PATCH 2: NUNCA excluir contatos - devolver com status
      const clientesEnriquecidos = contatos.map(contato => {
        const analise = analisesMap.get(contato.id);
        const thread = threadsMap.get(contato.id);
        
        // Calcular inatividade do próprio contato (fallback)
        const ultimaInteracao = new Date(contato.ultima_interacao || contato.created_date);
        const daysInactive = Math.floor((agora - ultimaInteracao) / (1000 * 60 * 60 * 24));
        
        const bucketInactiveCalc = 
          daysInactive < 30 ? 'active' :
          daysInactive < 60 ? '30' :
          daysInactive < 90 ? '60' : '90+';
        
        // ✅ CASO 1: SEM ANÁLISE ou INSUFFICIENT_DATA
        if (!analise || analise.status === 'insufficient_data' || analise.status === 'error') {
          const prioridadeInatividade = 
            daysInactive >= 90 ? 75 :
            daysInactive >= 60 ? 60 :
            daysInactive >= 30 ? 40 : 10;
          
          const labelInatividade = 
            prioridadeInatividade >= 75 ? 'CRITICO' :
            prioridadeInatividade >= 55 ? 'ALTO' :
            prioridadeInatividade >= 35 ? 'MEDIO' : 'BAIXO';
          
          return {
            contact_id: contato.id,
            nome: contato.nome,
            empresa: contato.empresa,
            telefone: contato.telefone,
            tipo_contato: contato.tipo_contato,
            vendedor_responsavel: contato.vendedor_responsavel,
            assigned_user_id: contato.assigned_user_id,
            thread_id: thread?.id || null,
            status: analise?.status || 'no_analysis',
            deal_risk: 0,
            buy_intent: 0,
            engagement: 0,
            health: 50,
            stage_current: 'descoberta',
            days_inactive_inbound: daysInactive,
            days_inactive_total: daysInactive,
            bucket_inactive: bucketInactiveCalc,
            root_causes: [`${daysInactive} dias sem interação`, 'Sem análise comportamental'],
            rootCause: `${daysInactive} dias sem interação`,
            next_action: 'Retomar contato',
            suggested_message: `Olá ${contato.nome?.split(' ')[0] || ''}! Tudo bem? Gostaria de saber se posso ajudar em algo.`,
            suggestedMessage: `Olá ${contato.nome?.split(' ')[0] || ''}! Tudo bem?`,
            prioridadeScore: prioridadeInatividade,
            prioridadeLabel: labelInatividade,
            analyzed_at: null
          };
        }
        
        // ✅ CASO 2: COM ANÁLISE VÁLIDA (estrutura V3)
        const deal_risk = analise.ai_insights?.deal_risk || 0;
        const buy_intent = analise.ai_insights?.buy_intent || 0;
        const engagement = analise.ai_insights?.engagement || 0;
        const health = analise.ai_insights?.health || 0;
        const stage = analise.ai_insights?.stage_suggested || 'descoberta';
        const nextAction = analise.ai_insights?.next_best_action || {};
        const rootCauses = analise.root_causes || [];
        
        const prioridadeScore = analise.priority_score || 0;
        const prioridadeLabel = analise.priority_label || 'BAIXO';
        
        // ✅ PATCH 3: Regra OR - (inatividade >= bucket) OR (deal_risk >= minDealRisk)
        const daysInactiveInbound = analise.days_inactive_inbound || daysInactive;
        const bucketMinimo = bucket_inactive === '90' ? 90 : bucket_inactive === '60' ? 60 : 30;
        
        const passaPorInatividade = daysInactiveInbound >= bucketMinimo;
        const passaPorRisco = deal_risk >= minDealRisk;
        
        // Só exclui se NÃO passar por NENHUM critério
        if (!passaPorInatividade && !passaPorRisco) {
          console.log(`[ANALISE_LOTE] ⏭️ ${contato.nome} não passa (inatividade=${daysInactiveInbound}d < ${bucketMinimo}d, risco=${deal_risk} < ${minDealRisk})`);
          return null;
        }
        
        // ✅ PATCH 4: DTO padronizado (nomes consistentes)
        return {
          contact_id: contato.id,
          nome: contato.nome,
          empresa: contato.empresa,
          telefone: contato.telefone,
          tipo_contato: contato.tipo_contato,
          vendedor_responsavel: contato.vendedor_responsavel,
          assigned_user_id: contato.assigned_user_id,
          thread_id: thread?.id || null,
          status: analise.status,
          deal_risk,
          dealRisk: deal_risk, // UI usa camelCase
          buy_intent,
          buyIntent: buy_intent,
          engagement,
          health,
          stage_current: stage,
          days_inactive_inbound: daysInactiveInbound,
          days_inactive_total: analise.days_inactive_total || daysInactive,
          bucket_inactive: analise.bucket_inactive || bucketInactiveCalc,
          root_causes: rootCauses,
          rootCause: rootCauses[0] || 'Requer atenção',
          next_action: nextAction.action || 'Acompanhar',
          suggested_message: nextAction.message_suggestion || '',
          suggestedMessage: nextAction.message_suggestion || '', // UI usa camelCase
          prioridadeScore,
          prioridadeLabel,
          analyzed_at: analise.analyzed_at
        };
      }).filter(c => c !== null);
      
      // Ordenar por prioridade
      clientesEnriquecidos.sort((a, b) => b.prioridadeScore - a.prioridadeScore);
      
      console.log(`[ANALISE_LOTE] ✅ ${clientesEnriquecidos.length} contatos enriquecidos com análise`);
      
      // Calcular estatísticas
      const stats = {
        total: clientesEnriquecidos.length,
        criticos: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'CRITICO').length,
        altos: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'ALTO').length,
        porPrioridade: {
          CRITICO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'CRITICO').length,
          ALTO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'ALTO').length,
          MEDIO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'MEDIO').length,
          BAIXO: clientesEnriquecidos.filter(c => c.prioridadeLabel === 'BAIXO').length
        },
        porBucket: {
          active: clientesEnriquecidos.filter(c => c.bucket_inactive === 'active').length,
          '30': clientesEnriquecidos.filter(c => c.bucket_inactive === '30').length,
          '60': clientesEnriquecidos.filter(c => c.bucket_inactive === '60').length,
          '90+': clientesEnriquecidos.filter(c => c.bucket_inactive === '90+').length
        },
        scoresMedios: {
          deal_risk: Math.round(clientesEnriquecidos.reduce((s, c) => s + c.deal_risk, 0) / clientesEnriquecidos.length) || 0,
          engagement: Math.round(clientesEnriquecidos.reduce((s, c) => s + c.engagement, 0) / clientesEnriquecidos.length) || 0,
          health: Math.round(clientesEnriquecidos.reduce((s, c) => s + c.health, 0) / clientesEnriquecidos.length) || 0
        }
      };
      
      ;(async () => {
        try {
          await base44.asServiceRole.entities.SkillExecution.create({
            skill_name: 'analisar_contatos_priorizacao',
            triggered_by: 'user_action',
            execution_mode: 'copilot',
            context: {
              modo: 'priorizacao',
              total_contatos_base: contatos.length,
              dias_sem_mensagem: diasSemMensagem,
              min_deal_risk: minDealRisk,
              bucket_inactive,
              tipo_contato: tipo
            },
            success: true,
            duration_ms: Date.now() - _tsInicio,
            metricas: {
              contatos_retornados: clientesEnriquecidos.length,
              criticos: stats.criticos,
              altos: stats.altos,
              com_analise_valida: clientesEnriquecidos.filter(c => c.status === 'ok').length,
              sem_analise: clientesEnriquecidos.filter(c => c.status === 'no_analysis').length,
              distribuicao_buckets: stats.porBucket
            }
          });
        } catch (e) {
          console.warn('[analisarClientesEmLote] SkillExecution falhou (non-blocking):', e.message);
        }
      })();
      
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
    // Limitar em 5 por execução + hard cutoff de 45s
    const scheduledLimit = Math.min(limit, 5);
    const HARD_CUTOFF_MS = 45_000;
    const tsStart = Date.now();
    
    console.log(`[ANALISE_LOTE] Modo scheduled | Limit: ${scheduledLimit} (max 5 por execução)`);
    
    let query = {
      tipo_contato: { $in: Array.isArray(tipo) ? tipo : ['lead', 'cliente'] }
    };
    
    // ✅ PATCH 6: Scheduled deve analisar também buckets 60/90+
    if (priorizar_ativos) {
      // Pegar últimos 90 dias (em vez de 30) para cobrir todos buckets
      query.ultima_interacao = {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
    
    // Usar service role para automações (sem user context)
    const contatos = await base44.asServiceRole.entities.Contact.filter(
      query,
      '-ultima_interacao',
      scheduledLimit
    );
    
    console.log(`[ANALISE_LOTE] ${contatos.length} contatos encontrados`);
    
    // ✅ BATCH: buscar todas análises recentes de uma vez (evita N queries individuais)
    const contactIdsList = contatos.map(c => c.id);
    const analisesRecentes = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
      {
        contact_id: { $in: contactIdsList },
        analyzed_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
      },
      '-analyzed_at',
      scheduledLimit
    );
    const analisesRecentesSet = new Set(analisesRecentes.map(a => a.contact_id));
    
    const resultados = {
      total_processados: 0,
      analises_criadas: 0,
      analises_puladas: 0,
      erros: [],
      abortado_por_timeout: false
    };
    
    for (const contato of contatos) {
      // ✅ FIX TIMEOUT: Verificar tempo decorrido antes de cada contato
      if (Date.now() - tsStart > HARD_CUTOFF_MS) {
        console.warn(`[ANALISE_LOTE] ⏰ Hard cutoff atingido após ${resultados.total_processados} contatos — abortando para evitar 504`);
        resultados.abortado_por_timeout = true;
        break;
      }
      
      resultados.total_processados++;
      
      try {
        // ✅ Usar set pré-carregado em batch (sem query individual)
        if (analisesRecentesSet.has(contato.id)) {
          resultados.analises_puladas++;
          console.log(`[ANALISE_LOTE] Pulando ${contato.nome} (análise < 24h)`);
          continue;
        }
        
        // Executar análise (service role para chamada interna)
        const resp = await base44.asServiceRole.functions.invoke('analisarComportamentoContato', {
          contact_id: contato.id
        });
        
        // ✅ Verificar sucesso (pode retornar 400 se sem mensagens)
        if (resp.success || resp.data?.success) {
          resultados.analises_criadas++;
          console.log(`[ANALISE_LOTE] ✅ ${contato.nome} analisado`);
        } else {
          resultados.analises_puladas++;
          console.log(`[ANALISE_LOTE] ⏭️ ${contato.nome} pulado (sem dados suficientes)`);
        }
        
        // Delay anti-rate-limit
        await new Promise(r => setTimeout(r, 200));
        
      } catch (error) {
        console.error(`[ANALISE_LOTE] Erro em ${contato.nome}:`, error.message);
        resultados.erros.push({
          contact_id: contato.id,
          nome: contato.nome,
          erro: error.message
        });
      }
    }
    
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'analise_diaria_contatos',
          triggered_by: 'automacao_agendada',
          execution_mode: 'autonomous_safe',
          context: {
            modo: 'scheduled',
            limit: scheduledLimit,
            priorizar_ativos,
            tipo
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            contatos_analisados: resultados.total_processados,
            analises_criadas: resultados.analises_criadas,
            analises_puladas: resultados.analises_puladas,
            erros: resultados.erros.length,
            abortado_por_timeout: resultados.abortado_por_timeout
          }
        });
      } catch (e) {
        console.warn('[analisarClientesEmLote] SkillExecution falhou (non-blocking):', e.message);
      }
    })();
    
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