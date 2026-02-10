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
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json().catch(() => ({}));
    const { contact_ids, force, limit = 50, priorizar_ativos = true } = body;
    
    // ══════════════════════════════════════════════════════════════
    // MODO 1: IDs ESPECÍFICOS (chamada do componente)
    // ══════════════════════════════════════════════════════════════
    if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
      console.log(`[ANALISE_LOTE] Modo direto | User: ${user.email} | IDs: ${contact_ids.length}`);
      
      const contatos = await base44.entities.Contact.filter(
        { id: { $in: contact_ids } },
        '-ultima_interacao',
        100
      );
      
      const resultados = { total: contatos.length, sucesso: 0, erro: 0, erros: [] };
      
      for (const contato of contatos) {
        try {
          await base44.functions.invoke('analisarComportamentoContato', {
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
    // MODO 2: AUTOMAÇÃO SCHEDULED (análise periódica)
    // ══════════════════════════════════════════════════════════════
    console.log(`[ANALISE_LOTE] Modo scheduled | User: ${user.email} | Limit: ${limit}`);
    
    let query = {
      tipo_contato: { $in: ['lead', 'cliente'] }
    };
    
    if (priorizar_ativos) {
      query.ultima_interacao = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }
    
    // Filtrar por usuário (exceto admin)
    if (user.role !== 'admin') {
      query.vendedor_responsavel = user.id;
    }
    
    const contatos = await base44.entities.Contact.filter(
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
        // Verificar análise recente (< 24h)
        const analises = await base44.entities.ContactBehaviorAnalysis.filter(
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
        
        // Executar análise
        await base44.functions.invoke('analisarComportamentoContato', {
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