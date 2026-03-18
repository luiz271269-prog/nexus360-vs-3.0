import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  AGENDADOR DE AUTOMAÇÕES V3 - Motor de Recorrência          ║
 * ║  + Priorização por ClienteScore e Tags                       ║
 * ║  + Lógica de Follow-up (24h → 3d → 7d → 15d)                 ║
 * ║  + Limpeza automática de execuções antigas                   ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action } = payload;

    console.log('[AGENDADOR] 🎯 Action:', action);

    switch (action) {
      case 'executar_listas_agendadas':
        return Response.json(await executarListasAgendadas(base44), { headers });
      
      case 'limpar_antigas':
        return Response.json(await limparExecucoesAntigas(base44), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[AGENDADOR] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

/**
 * FUNÇÃO PRINCIPAL: Executar Listas Agendadas com Recorrência Inteligente
 * 
 * Lógica:
 * 1. Buscar execuções aguardando follow-up com next_action_at <= agora
 * 2. Priorizar por: ClienteScore > Tags > Prioridade do Template
 * 3. Processar cada execução via playbookEngine
 * 4. Registrar logs e métricas
 */
async function executarListasAgendadas(base44) {
  console.log('[AGENDADOR] 🚀 Iniciando execução de listas agendadas...');

  const inicio = Date.now();
  let processadas = 0;
  let sucessos = 0;
  let erros = 0;

  try {
    // 1. Buscar execuções elegíveis para follow-up
    const agora = new Date();
    const todasExecucoes = await base44.asServiceRole.entities.FlowExecution.list('-next_action_at', 500);
    
    const execucoesElegiveis = todasExecucoes.filter(exec => 
      exec.status === 'waiting_follow_up' &&
      exec.next_action_at &&
      new Date(exec.next_action_at) <= agora
    );

    console.log(`[AGENDADOR] 📋 ${execucoesElegiveis.length} execuções elegíveis para follow-up`);

    if (execucoesElegiveis.length === 0) {
      return {
        success: true,
        message: 'Nenhuma execução elegível para follow-up',
        processadas: 0,
        sucessos: 0,
        erros: 0,
        tempo_ms: Date.now() - inicio
      };
    }

    // 2. Enriquecer com dados de Contact e Template para priorização
    const execucoesEnriquecidas = await Promise.all(
      execucoesElegiveis.map(async (exec) => {
        try {
          const [contact, template] = await Promise.all([
            base44.asServiceRole.entities.Contact.get(exec.contact_id).catch(() => null),
            base44.asServiceRole.entities.FlowTemplate.get(exec.flow_template_id).catch(() => null)
          ]);

          return {
            ...exec,
            contact,
            template,
            score_prioridade: calcularScorePrioridade(exec, contact, template)
          };
        } catch (error) {
          console.error(`[AGENDADOR] ⚠️ Erro ao enriquecer execução ${exec.id}:`, error);
          return null;
        }
      })
    );

    // Remover execuções que falharam no enriquecimento
    const execucoesPriorizadas = execucoesEnriquecidas
      .filter(e => e !== null)
      .sort((a, b) => b.score_prioridade - a.score_prioridade); // Maior score primeiro

    console.log('[AGENDADOR] 🎯 Execuções priorizadas:', execucoesPriorizadas.length);

    // 3. Processar cada execução (limite de 50 por execução para evitar timeout)
    const LIMITE_PROCESSAMENTO = 50;
    const execucoesProcessar = execucoesPriorizadas.slice(0, LIMITE_PROCESSAMENTO);

    for (const execucao of execucoesProcessar) {
      processadas++;

      try {
        console.log(`[AGENDADOR] ⚙️ Processando execução ${execucao.id} (Score: ${execucao.score_prioridade})`);

        // Invocar playbookEngine para continuar o follow-up
        const response = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/playbookEngine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'continue_follow_up',
            execution_id: execucao.id
          })
        });

        const resultado = await response.json();

        if (resultado.success) {
          sucessos++;
          console.log(`[AGENDADOR] ✅ Execução ${execucao.id} processada com sucesso`);

          // Registrar log de sucesso
          await base44.asServiceRole.entities.AutomationLog.create({
            acao: 'follow_up_agendado',
            thread_id: execucao.thread_id,
            contato_id: execucao.contact_id,
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            detalhes: {
              mensagem: `Follow-up executado com sucesso`,
              execution_id: execucao.id,
              playbook_nome: execucao.template?.nome || 'Desconhecido',
              current_step: resultado.current_step,
              next_action_at: resultado.next_action_at
            },
            origem: 'agendador',
            prioridade: 'normal'
          });

        } else {
          throw new Error(resultado.error || 'Erro desconhecido');
        }

      } catch (error) {
        erros++;
        console.error(`[AGENDADOR] ❌ Erro ao processar execução ${execucao.id}:`, error);

        // Registrar log de erro
        await base44.asServiceRole.entities.AutomationLog.create({
          acao: 'follow_up_agendado',
          thread_id: execucao.thread_id,
          contato_id: execucao.contact_id,
          resultado: 'erro',
          timestamp: new Date().toISOString(),
          detalhes: {
            mensagem: `Erro ao executar follow-up: ${error.message}`,
            execution_id: execucao.id,
            erro_completo: error.stack
          },
          origem: 'agendador',
          prioridade: 'alta'
        });

        // Se houver muitos erros consecutivos, abortar
        if (erros > 10 && erros > processadas * 0.5) {
          console.error('[AGENDADOR] ⛔ Muitos erros detectados, abortando execução');
          break;
        }
      }

      // Pequeno delay para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const tempoTotal = Date.now() - inicio;

    console.log(`[AGENDADOR] 🎉 Execução concluída: ${processadas} processadas, ${sucessos} sucessos, ${erros} erros em ${tempoTotal}ms`);

    return {
      success: true,
      processadas,
      sucessos,
      erros,
      tempo_ms: tempoTotal,
      execucoes_restantes: execucoesPriorizadas.length - processadas
    };

  } catch (error) {
    console.error('[AGENDADOR] ❌ Erro fatal:', error);
    throw error;
  }
}

/**
 * Calcular Score de Prioridade para ordenação
 * 
 * Fatores:
 * - ClienteScore (peso 40%)
 * - Tags relevantes (peso 30%)
 * - Prioridade do Template (peso 20%)
 * - Tempo de espera (peso 10%)
 */
function calcularScorePrioridade(exec, contact, template) {
  let score = 0;

  // 1. ClienteScore (0-100) -> peso 40%
  const clienteScore = contact?.cliente_score || 0;
  score += clienteScore * 0.4;

  // 2. Tags relevantes -> peso 30%
  const tagsRelevantes = ['lead_quente', 'oportunidade_alta', 'vip', 'urgente'];
  const contactTags = contact?.tags || [];
  const temTagRelevante = tagsRelevantes.some(tag => contactTags.includes(tag));
  if (temTagRelevante) {
    score += 30;
  }

  // 3. Prioridade do Template (1-10, menor = mais prioritário) -> peso 20%
  const templatePrioridade = template?.prioridade || 10;
  score += (11 - templatePrioridade) * 2; // Inverte a escala

  // 4. Tempo de espera (quanto mais atrasado, maior prioridade) -> peso 10%
  if (exec.next_action_at) {
    const agora = Date.now();
    const nextAction = new Date(exec.next_action_at).getTime();
    const minutosAtraso = Math.max(0, (agora - nextAction) / (1000 * 60));
    score += Math.min(10, minutosAtraso / 10); // Máximo 10 pontos
  }

  return Math.round(score);
}

/**
 * Limpar execuções antigas e concluídas
 * 
 * Remove execuções com status final (concluido, cancelado, erro, escalado_humano)
 * que tenham mais de 90 dias
 */
async function limparExecucoesAntigas(base44) {
  console.log('[AGENDADOR] 🧹 Iniciando limpeza de execuções antigas...');

  try {
    const todasExecucoes = await base44.asServiceRole.entities.FlowExecution.list('-updated_date', 1000);
    
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90); // 90 dias atrás

    const execucoesAntigas = todasExecucoes.filter(exec =>
      ['concluido', 'cancelado', 'erro', 'escalado_humano'].includes(exec.status) &&
      new Date(exec.updated_date) < dataLimite
    );

    console.log(`[AGENDADOR] 🗑️ ${execucoesAntigas.length} execuções antigas encontradas`);

    let removidas = 0;
    for (const exec of execucoesAntigas) {
      try {
        await base44.asServiceRole.entities.FlowExecution.delete(exec.id);
        removidas++;
      } catch (error) {
        console.error(`[AGENDADOR] ⚠️ Erro ao remover execução ${exec.id}:`, error);
      }
    }

    console.log(`[AGENDADOR] ✅ ${removidas} execuções antigas removidas`);

    return {
      success: true,
      encontradas: execucoesAntigas.length,
      removidas
    };

  } catch (error) {
    console.error('[AGENDADOR] ❌ Erro na limpeza:', error);
    throw error;
  }
}