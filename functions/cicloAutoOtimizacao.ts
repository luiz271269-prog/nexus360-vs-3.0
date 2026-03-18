import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  CICLO DE AUTO-OTIMIZAÇÃO V4 - Orquestrador Central         ║
 * ║  + Coordenação de todos os motores inteligentes             ║
 * ║  + Priorização dinâmica de tarefas                           ║
 * ║  + Métricas detalhadas e recuperação automática             ║
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
    
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║    CICLO DE AUTO-OTIMIZAÇÃO V4 - INICIANDO                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    const resultados = {
      timestamp: new Date().toISOString(),
      etapas: {},
      tempo_total_ms: 0,
      status_geral: 'sucesso',
      alertas: []
    };

    const inicioGeral = Date.now();

    // ═══════════════════════════════════════════════════════════
    // ETAPA 1: Health Check do Sistema
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('🏥 [1/8] Verificando saúde do sistema...');
      const inicioEtapa = Date.now();
      
      const healthResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/monitorarSaudeDoSistema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const healthResult = await healthResponse.json();
      
      resultados.etapas.health_check = {
        status: healthResult.status_geral || 'saudavel',
        tempo_ms: Date.now() - inicioEtapa,
        detalhes: healthResult
      };

      console.log(`   ✅ Health check concluído (${resultados.etapas.health_check.tempo_ms}ms) - Status: ${healthResult.status_geral}`);
      
      if (healthResult.status_geral === 'critico') {
        console.log('   ⛔ Sistema em estado CRÍTICO - abortando ciclo');
        resultados.status_geral = 'abortado';
        resultados.alertas.push({
          severidade: 'critica',
          mensagem: 'Sistema em estado crítico - ciclo abortado',
          detalhes: healthResult
        });
        
        await notificarAdmins(base44, 'critico', 'Ciclo Auto-Otimização Abortado', 'Sistema em estado crítico');
        
        return Response.json(resultados, { headers });
      }

    } catch (error) {
      console.error('   ❌ Erro no health check:', error.message);
      resultados.etapas.health_check = {
        status: 'erro',
        erro: error.message
      };
      resultados.alertas.push({
        severidade: 'alta',
        mensagem: 'Falha no health check',
        erro: error.message
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 2: Executar Listas Agendadas (FOLLOW-UPS)
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('📅 [2/8] Executando listas agendadas (follow-ups)...');
      const inicioEtapa = Date.now();
      
      const agendadorResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/agendadorAutomacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'executar_listas_agendadas'
        })
      });

      const agendadorResult = await agendadorResponse.json();
      
      resultados.etapas.listas_agendadas = {
        status: agendadorResult.success ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - inicioEtapa,
        processadas: agendadorResult.processadas || 0,
        sucessos: agendadorResult.sucessos || 0,
        erros: agendadorResult.erros || 0,
        execucoes_restantes: agendadorResult.execucoes_restantes || 0
      };

      console.log(`   ✅ Listas agendadas: ${agendadorResult.processadas} processadas, ${agendadorResult.sucessos} sucessos (${resultados.etapas.listas_agendadas.tempo_ms}ms)`);

      if (agendadorResult.erros > 0) {
        resultados.alertas.push({
          severidade: 'media',
          mensagem: `${agendadorResult.erros} execuções de follow-up falharam`,
          detalhes: agendadorResult
        });
      }

    } catch (error) {
      console.error('   ❌ Erro ao executar listas agendadas:', error.message);
      resultados.etapas.listas_agendadas = {
        status: 'erro',
        erro: error.message
      };
      resultados.status_geral = 'parcial';
      resultados.alertas.push({
        severidade: 'alta',
        mensagem: 'Falha ao executar listas agendadas',
        erro: error.message
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 3: Otimizar Playbooks com IA
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('🤖 [3/8] Gerando insights de otimização de playbooks...');
      const inicioEtapa = Date.now();
      
      const insightsResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/gerarInsightsPlaybooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const insightsResult = await insightsResponse.json();
      
      resultados.etapas.otimizacao_playbooks = {
        status: insightsResult.success ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - inicioEtapa,
        insights_gerados: insightsResult.insights_gerados || 0,
        playbooks_analisados: insightsResult.playbooks_analisados || 0
      };

      console.log(`   ✅ Insights gerados: ${insightsResult.insights_gerados} para ${insightsResult.playbooks_analisados} playbooks (${resultados.etapas.otimizacao_playbooks.tempo_ms}ms)`);

      if (insightsResult.insights_gerados > 0) {
        resultados.alertas.push({
          severidade: 'info',
          mensagem: `${insightsResult.insights_gerados} novos insights de otimização disponíveis`,
          detalhes: insightsResult
        });
      }

    } catch (error) {
      console.error('   ❌ Erro ao gerar insights:', error.message);
      resultados.etapas.otimizacao_playbooks = {
        status: 'erro',
        erro: error.message
      };
      resultados.alertas.push({
        severidade: 'baixa',
        mensagem: 'Falha ao gerar insights de playbooks',
        erro: error.message
      });
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 4: Processar Respostas Rápidas com IA
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('💬 [4/8] Analisando conversas para respostas rápidas...');
      const inicioEtapa = Date.now();
      
      // Verificar se há conversas suficientes para análise
      const threads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 50);
      
      if (threads.length >= 20) {
        // Análise de padrões de conversas (simplificado para o ciclo automático)
        const mensagens = await base44.asServiceRole.entities.Message.list('-created_date', 200);
        
        const perguntasFrequentes = {};
        mensagens
          .filter(m => m.sender_type === 'contact')
          .forEach(m => {
            const texto = m.content.toLowerCase();
            if (texto.includes('?') || texto.includes('qual') || texto.includes('como')) {
              const chave = texto.substring(0, 50);
              perguntasFrequentes[chave] = (perguntasFrequentes[chave] || 0) + 1;
            }
          });

        const topPerguntas = Object.entries(perguntasFrequentes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        resultados.etapas.respostas_rapidas = {
          status: 'sucesso',
          tempo_ms: Date.now() - inicioEtapa,
          conversas_analisadas: threads.length,
          padroes_identificados: topPerguntas.length
        };

        console.log(`   ✅ ${threads.length} conversas analisadas, ${topPerguntas.length} padrões identificados (${resultados.etapas.respostas_rapidas.tempo_ms}ms)`);
      } else {
        resultados.etapas.respostas_rapidas = {
          status: 'pulado',
          tempo_ms: Date.now() - inicioEtapa,
          motivo: 'Conversas insuficientes para análise'
        };
        console.log(`   ⏭️  Pulado - conversas insuficientes (${threads.length}/20)`);
      }

    } catch (error) {
      console.error('   ❌ Erro ao processar respostas rápidas:', error.message);
      resultados.etapas.respostas_rapidas = {
        status: 'erro',
        erro: error.message
      };
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 5: Gerenciar Tags Automáticas
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('🏷️ [5/8] Aplicando tags automáticas...');
      const inicioEtapa = Date.now();
      
      const tagResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/tagManager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_auto_tags'
        })
      });

      const tagResult = await tagResponse.json();
      
      resultados.etapas.tags_automaticas = {
        status: tagResult.success ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - inicioEtapa,
        tags_aplicadas: tagResult.tags_aplicadas || 0
      };

      console.log(`   ✅ Tags aplicadas: ${tagResult.tags_aplicadas} (${resultados.etapas.tags_automaticas.tempo_ms}ms)`);

    } catch (error) {
      console.error('   ❌ Erro ao aplicar tags:', error.message);
      resultados.etapas.tags_automaticas = {
        status: 'erro',
        erro: error.message
      };
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 6: Calcular Scores de Clientes
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('📊 [6/8] Atualizando scores de clientes...');
      const inicioEtapa = Date.now();
      
      const contacts = await base44.asServiceRole.entities.Contact.list('-updated_date', 100);
      let scoresAtualizados = 0;

      for (const contact of contacts) {
        try {
          // Buscar interações recentes do contato
          const threads = await base44.asServiceRole.entities.MessageThread.filter({
            contact_id: contact.id
          });

          const mensagens = await base44.asServiceRole.entities.Message.filter({
            thread_id: threads.length > 0 ? threads[0].id : 'none'
          });

          // Calcular score simples baseado em engajamento
          let score = 50; // Base
          score += threads.length * 5; // +5 por thread
          score += mensagens.filter(m => m.sender_type === 'contact').length * 2; // +2 por mensagem
          score = Math.min(100, score); // Máximo 100

          await base44.asServiceRole.entities.Contact.update(contact.id, {
            cliente_score: score
          });

          scoresAtualizados++;
        } catch (error) {
          console.error(`   ⚠️ Erro ao atualizar score do contato ${contact.id}:`, error.message);
        }
      }

      resultados.etapas.scores_clientes = {
        status: 'sucesso',
        tempo_ms: Date.now() - inicioEtapa,
        scores_atualizados: scoresAtualizados,
        total_contacts: contacts.length
      };

      console.log(`   ✅ Scores atualizados: ${scoresAtualizados}/${contacts.length} (${resultados.etapas.scores_clientes.tempo_ms}ms)`);

    } catch (error) {
      console.error('   ❌ Erro ao calcular scores:', error.message);
      resultados.etapas.scores_clientes = {
        status: 'erro',
        erro: error.message
      };
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 7: Limpeza de Execuções Antigas
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('🧹 [7/8] Limpando execuções antigas...');
      const inicioEtapa = Date.now();
      
      const limpezaResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/agendadorAutomacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'limpar_antigas'
        })
      });

      const limpezaResult = await limpezaResponse.json();
      
      resultados.etapas.limpeza = {
        status: limpezaResult.success ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - inicioEtapa,
        removidas: limpezaResult.removidas || 0
      };

      console.log(`   ✅ Execuções antigas removidas: ${limpezaResult.removidas} (${resultados.etapas.limpeza.tempo_ms}ms)`);

    } catch (error) {
      console.error('   ❌ Erro na limpeza:', error.message);
      resultados.etapas.limpeza = {
        status: 'erro',
        erro: error.message
      };
    }

    // ═══════════════════════════════════════════════════════════
    // ETAPA 8: Backup Automático
    // ═══════════════════════════════════════════════════════════
    try {
      console.log('💾 [8/8] Executando backup automático...');
      const inicioEtapa = Date.now();
      
      const backupResponse = await fetch(`${Deno.env.get('BASE44_FUNCTION_URL') || ''}/functions/backupAutomatico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const backupResult = await backupResponse.json();
      
      resultados.etapas.backup = {
        status: backupResult.success ? 'sucesso' : 'erro',
        tempo_ms: Date.now() - inicioEtapa,
        registros_salvos: backupResult.total_registros || 0
      };

      console.log(`   ✅ Backup concluído: ${backupResult.total_registros} registros (${resultados.etapas.backup.tempo_ms}ms)`);

    } catch (error) {
      console.error('   ❌ Erro no backup:', error.message);
      resultados.etapas.backup = {
        status: 'erro',
        erro: error.message
      };
    }

    // ═══════════════════════════════════════════════════════════
    // FINALIZAÇÃO E ENVIO DE NOTIFICAÇÃO
    // ═══════════════════════════════════════════════════════════
    resultados.tempo_total_ms = Date.now() - inicioGeral;

    const etapasComErro = Object.values(resultados.etapas).filter(e => e.status === 'erro').length;
    const etapasSucesso = Object.values(resultados.etapas).filter(e => e.status === 'sucesso').length;
    
    if (etapasComErro > 2) {
      resultados.status_geral = 'falha';
    } else if (etapasComErro > 0) {
      resultados.status_geral = 'parcial';
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log(`║  CICLO CONCLUÍDO - Status: ${resultados.status_geral.toUpperCase().padEnd(37)}║`);
    console.log(`║  Sucesso: ${etapasSucesso}/8 etapas${' '.repeat(42 - String(etapasSucesso).length)}║`);
    console.log(`║  Tempo Total: ${(resultados.tempo_total_ms / 1000).toFixed(2)}s${' '.repeat(48 - String((resultados.tempo_total_ms / 1000).toFixed(2)).length)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Criar NotificationEvent se houver problemas
    if (resultados.status_geral !== 'sucesso' || resultados.alertas.length > 0) {
      await notificarAdmins(
        base44,
        resultados.status_geral === 'falha' ? 'critica' : 'alta',
        'Ciclo de Auto-Otimização - Status: ' + resultados.status_geral.toUpperCase(),
        `Ciclo concluído com ${etapasComErro} etapa(s) com erro e ${resultados.alertas.length} alerta(s).`,
        resultados
      );
    }

    return Response.json(resultados, { headers });

  } catch (error) {
    console.error('❌ ERRO FATAL NO CICLO:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500, headers });
  }
});

async function notificarAdmins(base44, prioridade, titulo, mensagem, metadata = null) {
  try {
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    
    for (const admin of admins) {
      await base44.asServiceRole.entities.NotificationEvent.create({
        tipo: 'erro_playbook',
        titulo,
        mensagem,
        prioridade,
        usuario_id: admin.id,
        usuario_nome: admin.full_name,
        entidade_relacionada: 'FlowTemplate',
        metadata,
        origem: 'cicloAutoOtimizacao'
      });
    }
  } catch (error) {
    console.error('   ⚠️ Erro ao criar notificação:', error.message);
  }
}