/**
 * Motor de Lembretes Global - Integrado com Agente Interno
 * Calcula contadores de alertas para cada página do sistema
 * Executado a cada 5min pelo Layout.jsx
 * 
 * FILTROS APLICADOS:
 * - Apenas contatos tipo "lead" e "cliente"
 * - Apenas contatos do usuário logado (vendedor_responsavel)
 * - Admin vê todos os contatos
 */

/**
 * Calcula lembretes globais para todas as páginas
 * @param {Object} usuario - Usuário autenticado
 * @param {Object} base44 - Cliente Base44
 * @returns {Object} Contadores por página
 */
export async function calcularLembretesGlobal(usuario, base44) {
  const contadores = {};
  const now = Date.now();
  
  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1. CONTATOS PRECISANDO ATENÇÃO (ContactBehaviorAnalysis)
    // FILTRADO: apenas leads/clientes do usuário
    // ═══════════════════════════════════════════════════════════════════════
    let contatosComAlertasIA = 0;
    try {
      // Buscar análises recentes
      const analisesRecentes = await base44.entities.ContactBehaviorAnalysis.filter(
        {
          ultima_analise: { 
            $gte: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() 
          }
        },
        '-ultima_analise',
        200
      );
      
      // Buscar contatos em paralelo (para validar tipo e atribuição)
      const contactIds = [...new Set(analisesRecentes.map(a => a.contact_id))];
      const contatosValidar = await base44.entities.Contact.filter(
        { id: { $in: contactIds } },
        '-created_date',
        300
      );
      
      // Criar mapa para lookup O(1)
      const contatosMap = new Map(contatosValidar.map(c => [c.id, c]));
      
      // Filtrar análises por tipo de contato e atribuição
      const analisesValidas = analisesRecentes.filter(analise => {
        const contato = contatosMap.get(analise.contact_id);
        if (!contato) return false;
        
        // Filtrar apenas leads e clientes
        if (!['lead', 'cliente'].includes(contato.tipo_contato)) return false;
        
        // Filtrar por atribuição (se não for admin)
        if (usuario.role !== 'admin') {
          if (contato.vendedor_responsavel !== usuario.id) return false;
        }
        
        return true;
      });
      
      // Contar apenas análises com alertas reais
      contatosComAlertasIA = analisesValidas.filter(analise => {
        // Priorizar insights.alerts do motor
        if (analise.insights?.alerts && analise.insights.alerts.length > 0) {
          return true;
        }
        
        // Fallback: regras locais
        if (analise.score_engajamento < 40) return true;
        if (analise.analise_sentimento?.score_sentimento < 40) return true;
        if (analise.segmento_sugerido === 'risco_churn') return true;
        if (analise.segmento_sugerido === 'lead_quente') return true;
        
        return false;
      }).length;
    } catch (error) {
      console.warn('[MotorLembretes] Erro ao buscar ContactBehaviorAnalysis:', error.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. CONTATOS PARADOS (WorkQueueItem)
    // Sistema de fila de contatos ociosos > 48h
    // ═══════════════════════════════════════════════════════════════════════
    let contatosParados = 0;
    try {
      const workQueueItems = await base44.entities.WorkQueueItem.filter(
        {
          status: { $in: ['open', 'in_progress'] }
        },
        '-created_date',
        100
      );
      
      // Filtrar por setor/atribuição se não for admin
      if (usuario.role === 'admin') {
        contatosParados = workQueueItems.length;
      } else {
        contatosParados = workQueueItems.filter(item => {
          return item.owner_user_id === usuario.id ||
                 item.owner_sector_id === usuario.attendant_sector ||
                 !item.owner_user_id;
        }).length;
      }
    } catch (error) {
      console.warn('[MotorLembretes] Erro ao buscar WorkQueueItem:', error.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 3. TAREFAS CRÍTICAS (TarefaInteligente)
    // ═══════════════════════════════════════════════════════════════════════
    let tarefasCriticas = 0;
    let tarefasAltas = 0;
    try {
      const tarefas = await base44.entities.TarefaInteligente.filter(
        {
          status: 'pendente'
        },
        '-created_date',
        100
      );
      
      // Filtrar por responsável se não for admin
      const tarefasFiltradas = usuario.role === 'admin'
        ? tarefas
        : tarefas.filter(t => 
            t.responsavel_id === usuario.id || !t.responsavel_id
          );
      
      tarefasCriticas = tarefasFiltradas.filter(t => t.prioridade === 'critica').length;
      tarefasAltas = tarefasFiltradas.filter(t => t.prioridade === 'alta').length;
    } catch (error) {
      console.warn('[MotorLembretes] Erro ao buscar TarefaInteligente:', error.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. ORÇAMENTOS URGENTES (Vencendo em 3 dias)
    // ═══════════════════════════════════════════════════════════════════════
    let orcamentosUrgentes = 0;
    try {
      const orcamentos = await base44.entities.Orcamento.filter(
        {
          status: { $in: ['enviado', 'negociando'] },
          data_vencimento: { 
            $lte: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString() 
          }
        },
        'data_vencimento',
        50
      );
      
      // Filtrar por vendedor se não for admin
      orcamentosUrgentes = usuario.role === 'admin'
        ? orcamentos.length
        : orcamentos.filter(o => o.vendedor === usuario.full_name).length;
    } catch (error) {
      console.warn('[MotorLembretes] Erro ao buscar Orcamento:', error.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 5. THREADS NÃO ATRIBUÍDAS (apenas para managers)
    // ═══════════════════════════════════════════════════════════════════════
    let threadsNaoAtribuidas = 0;
    try {
      if (usuario.role === 'admin' || usuario.attendant_role === 'gerente' || usuario.attendant_role === 'coordenador') {
        const threads = await base44.entities.MessageThread.filter(
          {
            status: 'aberta',
            assigned_user_id: null,
            thread_type: 'contact_external'
          },
          '-last_message_at',
          100
        );
        threadsNaoAtribuidas = threads.length;
      }
    } catch (error) {
      console.warn('[MotorLembretes] Erro ao buscar threads não atribuídas:', error.message);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 6. AGRUPAR POR PÁGINA
    // ═══════════════════════════════════════════════════════════════════════
    contadores['Comunicacao'] = 
      contatosComAlertasIA + 
      contatosParados +
      threadsNaoAtribuidas;
    
    contadores['Dashboard'] = 
      tarefasCriticas +
      Math.min(contatosComAlertasIA, 5);
    
    contadores['Orcamentos'] = orcamentosUrgentes;
    
    contadores['Agenda'] = tarefasCriticas + tarefasAltas;
    
    contadores['LeadsQualificados'] = contatosComAlertasIA;
    
    console.log('[MotorLembretes] ✅ Contadores calculados:', contadores);
    
    return contadores;
    
  } catch (error) {
    console.error('[MotorLembretes] ❌ Erro crítico:', error);
    return {};
  }
}