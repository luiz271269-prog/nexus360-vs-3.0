import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SKILL SDR: Detectar Leads Frios
 * Identifica contatos sem interação em 30/60/90+ dias e classifica por potencial
 */

interface LeadFrio {
  contact_id: string;
  nome: string;
  dias_sem_contato: number;
  ultimo_status: string;
  valor_orcamentos_abertos: number;
  total_interacoes_historico: number;
  classificacao: 'alto_potencial' | 'medio_potencial' | 'baixo_potencial';
  motivo_inatividade: string;
  prioridade: number;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const _tsInicio = Date.now(); // SkillExecution: medir duration_ms
    
    const body = await req.json().catch(() => ({}));
    const { 
      dias_inatividade = 30,
      limite = 100,
      classificacao_minima = null
    } = body;
    
    console.log(`[DETECTAR_LEADS_FRIOS] Buscando leads inativos há ${dias_inatividade}+ dias`);
    
    // 1. Buscar contatos sem interação recente
    const dataLimite = new Date(Date.now() - dias_inatividade * 86400000);
    
    const contatos = await base44.asServiceRole.entities.Contact.filter({
      ultima_interacao: { $lte: dataLimite.toISOString() },
      tipo_contato: { $in: ['lead', 'cliente'] }
    }, '-ultima_interacao', limite);
    
    console.log(`[DETECTAR_LEADS_FRIOS] ${contatos.length} contatos encontrados`);
    
    const leads: LeadFrio[] = [];
    
    // 2. Para cada contato, analisar potencial de reativação
    for (const contact of contatos) {
      try {
        // Buscar threads
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact.id
        }, '-last_message_at', 5);
        
        const threadPrincipal = threads[0];
        if (!threadPrincipal) continue;
        
        const diasSemContato = Math.floor(
          (Date.now() - new Date(threadPrincipal.last_message_at || contact.ultima_interacao || contact.created_date).getTime()) / 86400000
        );
        
        // Buscar orçamentos abertos
        const orcamentos = await base44.asServiceRole.entities.Orcamento.filter({
          cliente_nome: contact.nome,
          status: { $in: ['negociando', 'aguardando_resposta', 'liberado', 'enviado'] }
        }, null, 10);
        
        const valorOrcamentos = orcamentos.reduce((sum, o) => sum + (o.valor_total || 0), 0);
        
        // Total de interações históricas
        const totalInteracoes = threads.reduce((sum, t) => sum + (t.total_mensagens || 0), 0);
        
        // 3. Classificar potencial
        const classificacao = classificarPotencialReativacao({
          dias_sem_contato: diasSemContato,
          valor_orcamentos: valorOrcamentos,
          total_interacoes: totalInteracoes,
          tags: contact.tags || []
        });
        
        // Filtro de classificação mínima
        if (classificacao_minima) {
          const ordem = { 'alto_potencial': 3, 'medio_potencial': 2, 'baixo_potencial': 1 };
          if (ordem[classificacao] < ordem[classificacao_minima]) continue;
        }
        
        const prioridade = calcularPrioridade(classificacao, valorOrcamentos, totalInteracoes);
        
        leads.push({
          contact_id: contact.id,
          nome: contact.nome || contact.telefone || 'Sem nome',
          dias_sem_contato: diasSemContato,
          ultimo_status: threadPrincipal.pre_atendimento_state || 'sem_status',
          valor_orcamentos_abertos: valorOrcamentos,
          total_interacoes_historico: totalInteracoes,
          classificacao,
          motivo_inatividade: inferirMotivoInatividade(threadPrincipal, orcamentos),
          prioridade
        });
      } catch (error) {
        console.error(`[DETECTAR_LEADS_FRIOS] Erro ao processar ${contact.nome}:`, error.message);
      }
    }
    
    // Ordenar por prioridade
    leads.sort((a, b) => b.prioridade - a.prioridade);
    
    // 4. Métricas
    const metricas = {
      total_leads: leads.length,
      alto_potencial: leads.filter(l => l.classificacao === 'alto_potencial').length,
      medio_potencial: leads.filter(l => l.classificacao === 'medio_potencial').length,
      baixo_potencial: leads.filter(l => l.classificacao === 'baixo_potencial').length,
      valor_total_orcamentos: leads.reduce((sum, l) => sum + l.valor_orcamentos_abertos, 0),
      prioridade_media: leads.length > 0 ? leads.reduce((sum, l) => sum + l.prioridade, 0) / leads.length : 0
    };
    
    console.log(`[DETECTAR_LEADS_FRIOS] ✅ ${metricas.total_leads} leads detectados (${metricas.alto_potencial} alto potencial)`);
    
    // 5. Registrar execução
    ;(async () => {
      try {
        await base44.asServiceRole.entities.SkillExecution.create({
          skill_name: 'detectar_leads_frios',
          triggered_by: 'user_action',
          execution_mode: 'autonomous_safe',
          context: {
            dias_inatividade,
            limite,
            classificacao_minima
          },
          success: true,
          duration_ms: Date.now() - _tsInicio,
          metricas: {
            total_leads: metricas.total_leads,
            alto_potencial: metricas.alto_potencial,
            medio_potencial: metricas.medio_potencial,
            baixo_potencial: metricas.baixo_potencial,
            valor_total_orcamentos: metricas.valor_total_orcamentos
          }
        });
      } catch (e) {
        console.warn('[detectarLeadsFrios] SkillExecution falhou (non-blocking):', e.message);
      }
    })();
    
    return Response.json({
      success: true,
      leads,
      metricas
    });
    
  } catch (error) {
    console.error('[DETECTAR_LEADS_FRIOS] Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});

// ============ FUNÇÕES AUXILIARES ============

function classificarPotencialReativacao(dados: {
  dias_sem_contato: number;
  valor_orcamentos: number;
  total_interacoes: number;
  tags: string[];
}): 'alto_potencial' | 'medio_potencial' | 'baixo_potencial' {
  let score = 0;
  
  // Orçamentos abertos = alto potencial
  if (dados.valor_orcamentos > 5000) score += 40;
  else if (dados.valor_orcamentos > 1000) score += 20;
  
  // Histórico de interações
  if (dados.total_interacoes > 20) score += 30;
  else if (dados.total_interacoes > 10) score += 15;
  
  // Inatividade moderada é melhor que extrema
  if (dados.dias_sem_contato <= 60) score += 30;
  else if (dados.dias_sem_contato <= 90) score += 15;
  
  if (score >= 70) return 'alto_potencial';
  if (score >= 40) return 'medio_potencial';
  return 'baixo_potencial';
}

function calcularPrioridade(
  classificacao: string,
  valor_orcamentos: number,
  total_interacoes: number
): number {
  let prioridade = 0;
  
  if (classificacao === 'alto_potencial') prioridade += 5;
  else if (classificacao === 'medio_potencial') prioridade += 3;
  else prioridade += 1;
  
  prioridade += Math.min(valor_orcamentos / 2000, 3);
  prioridade += Math.min(total_interacoes / 10, 2);
  
  return Math.round(Math.min(prioridade, 10));
}

function inferirMotivoInatividade(thread: any, orcamentos: any[]): string {
  if (orcamentos.length > 0) return 'aguardando_resposta_orcamento';
  if (thread.pre_atendimento_state === 'TIMEOUT') return 'abandono_pre_atendimento';
  if (!thread.assigned_user_id) return 'sem_atendente_atribuido';
  return 'inatividade_natural';
}