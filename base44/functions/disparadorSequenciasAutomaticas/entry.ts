import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('[DISPARADOR] 🚀 Iniciando detecção de sequências...');

    // 1. Buscar todas as sequências ativas
    const sequencias = await base44.asServiceRole.entities.SequenciaAutomatica.filter({
      ativa: true
    });

    console.log('[DISPARADOR] 📋 Sequências ativas:', sequencias.length);

    const resultados = {
      disparos: 0,
      proximas_acoes: 0,
      erros: []
    };

    for (const sequencia of sequencias) {
      try {
        const { tipo_gatilho, parametro_gatilho, condicoes_aplicacao } = sequencia;

        // 2. Buscar contatos que acionam este gatilho
        let contatos = [];

        if (tipo_gatilho === 'dias_sem_resposta') {
          const diasAtraso = new Date();
          diasAtraso.setDate(diasAtraso.getDate() - parametro_gatilho.dias);
          
          contatos = await base44.asServiceRole.entities.Contact.filter({
            last_attention_given_at: { $lt: diasAtraso.toISOString() },
            tipo_contato: { $in: condicoes_aplicacao?.tipos_contato || ['lead', 'cliente'] }
          }, '-last_attention_given_at', 100);
        }

        if (tipo_gatilho === 'baixa_intencao_compra') {
          contatos = await base44.asServiceRole.entities.Contact.filter({
            client_score: { 
              $gte: parametro_gatilho.score_minimo || 0,
              $lte: parametro_gatilho.score_maximo || 40
            },
            tipo_contato: { $in: condicoes_aplicacao?.tipos_contato || ['lead'] }
          }, '-client_score', 100);
        }

        if (tipo_gatilho === 'alto_risco_churn') {
          contatos = await base44.asServiceRole.entities.Contact.filter({
            segmento_atual: 'risco_churn',
            tipo_contato: { $in: condicoes_aplicacao?.tipos_contato || ['cliente'] }
          }, '-updated_date', 100);
        }

        console.log(`[DISPARADOR] 👥 Gatilho ${tipo_gatilho}: ${contatos.length} contatos`);

        // 3. Para cada contato, verificar e disparar sequência
        for (const contato of contatos) {
          try {
            // Verificar se já executou
            const execucoes = await base44.asServiceRole.entities.ExecucaoSequencia.filter({
              sequencia_id: sequencia.id,
              contact_id: contato.id,
              status: { $ne: 'falhou' }
            }, '-created_date', 1);

            // BUG FIX 1: lógica de cooldown corrigida
            // Se já existe qualquer execução não-falha, verificar cooldown SEMPRE
            if (execucoes.length > 0) {
              const ultima_exec = execucoes[0];
              const cooldown_ms = (sequencia.cooldown_dias_entre_execucoes || 7) * 24 * 60 * 60 * 1000;
              // BUG FIX 5: usar updated_date da última execução (quando foi efetivamente processada)
              const refDate = ultima_exec.updated_date || ultima_exec.created_date;
              const tempo_desde_ultima = Date.now() - new Date(refDate).getTime();

              if (tempo_desde_ultima < cooldown_ms) {
                continue; // Em cooldown — pular
              }

              // Verificar limite total de execuções por contato
              const limite = sequencia.limite_execucoes_por_contato || 1;
              if (execucoes.length >= limite) {
                continue; // Limite atingido — não criar mais
              }
            }

            // 4. Buscar ou criar thread canônica
            const threads = await base44.asServiceRole.entities.MessageThread.filter({
              contact_id: contato.id,
              is_canonical: true
            }, '-updated_date', 1);

            let threadId;
            if (threads.length > 0) {
              threadId = threads[0].id;
            } else {
              console.warn(`[DISPARADOR] ⚠️ Sem thread para contato ${contato.id}`);
              continue;
            }

            // 5. Criar execução da sequência
            const execucao = await base44.asServiceRole.entities.ExecucaoSequencia.create({
              sequencia_id: sequencia.id,
              contact_id: contato.id,
              thread_id: threadId,
              numero_execucao: (execucoes.length || 0) + 1,
              status: 'aguardando',
              passos_completados: []
            });

            // 6. Agendar primeiro passo
            if (sequencia.passos && sequencia.passos.length > 0) {
              const primeiro_passo = sequencia.passos[0];
              const proxima_acao = new Date();
              // BUG FIX 3: mínimo de 1 hora para evitar loop imediato
              const atraso_dias = primeiro_passo.atraso_dias || 0;
              if (atraso_dias === 0) {
                proxima_acao.setHours(proxima_acao.getHours() + 1);
              } else {
                proxima_acao.setDate(proxima_acao.getDate() + atraso_dias);
              }

              await base44.asServiceRole.entities.ExecucaoSequencia.update(execucao.id, {
                proxima_acao_em: proxima_acao.toISOString()
              });

              resultados.disparos++;
            }

            console.log(`[DISPARADOR] ✅ Sequência iniciada para ${contato.nome}`);

          } catch (error) {
            console.error(`[DISPARADOR] ❌ Erro processando contato:`, error.message);
            resultados.erros.push({
              sequencia: sequencia.nome,
              contato: contato.id,
              erro: error.message
            });
          }
        }

      } catch (error) {
        console.error(`[DISPARADOR] ❌ Erro na sequência ${sequencia.nome}:`, error.message);
        resultados.erros.push({
          sequencia: sequencia.nome,
          erro: error.message
        });
      }
    }

    // 7. Processar próximas ações agendadas
    const execucoes_pendentes = await base44.asServiceRole.entities.ExecucaoSequencia.filter({
      status: 'aguardando',
      proxima_acao_em: { $lte: new Date().toISOString() }
    }, '-proxima_acao_em', 50);

    console.log('[DISPARADOR] ⏰ Próximas ações a executar:', execucoes_pendentes.length);

    for (const exec of execucoes_pendentes) {
      try {
        const sequencia = sequencias.find(s => s.id === exec.sequencia_id);
        if (!sequencia) {
          // BUG FIX 4: sequência desativada/removida → marcar execução como cancelada
          await base44.asServiceRole.entities.ExecucaoSequencia.update(exec.id, {
            status: 'cancelada',
            resultado_final: 'sequencia_inativa'
          }).catch(() => {});
          continue;
        }

        const numero_passo = (exec.passos_completados?.length || 0);
        const passo = sequencia.passos[numero_passo];

        if (!passo) {
          await base44.asServiceRole.entities.ExecucaoSequencia.update(exec.id, {
            status: 'enviado',
            resultado_final: 'sucesso'
          });
          continue;
        }

        // Enviar mensagem
        const contato = await base44.asServiceRole.entities.Contact.get(exec.contact_id);
        let conteudo = passo.conteudo;

        if (passo.usar_analise_ia) {
          // Usar análise IA para personalizar
          const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
            contact_id: exec.contact_id
          }, '-analyzed_at', 1);

          if (analises.length > 0 && analises[0].ai_insights?.next_best_action) {
            conteudo = `${passo.conteudo}\n\n💡 Ação sugerida: ${analises[0].ai_insights.next_best_action.action}`;
          }
        }

        // BUG FIX 2: resolver integração canônica da thread
        const threadDaExec = await base44.asServiceRole.entities.MessageThread.filter(
          { contact_id: exec.contact_id, is_canonical: true }, '-updated_date', 1
        ).catch(() => []);
        const integrationId = threadDaExec[0]?.whatsapp_integration_id || null;

        if (!integrationId) {
          console.warn(`[DISPARADOR] ⚠️ Sem integration_id para contato ${exec.contact_id} — pulando envio`);
          continue;
        }

        const resultado_envio = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: integrationId,
          numero_destino: contato.telefone_canonico || contato.telefone,
          mensagem: conteudo
        });

        // Atualizar execução
        const passos_atualizados = [...(exec.passos_completados || [])];
        passos_atualizados.push({
          numero: numero_passo,
          status: resultado_envio?.data?.id ? 'enviado' : 'falhou',
          enviado_em: new Date().toISOString(),
          message_id: resultado_envio?.data?.id
        });

        // Agendar próximo passo
        let proxima_acao_em = null;
        if (numero_passo + 1 < sequencia.passos.length) {
          const proximo = sequencia.passos[numero_passo + 1];
          proxima_acao_em = new Date();
          proxima_acao_em.setDate(proxima_acao_em.getDate() + (proximo.atraso_dias || 0));
        }

        await base44.asServiceRole.entities.ExecucaoSequencia.update(exec.id, {
          passos_completados: passos_atualizados,
          proxima_acao_em: proxima_acao_em?.toISOString(),
          status: proxima_acao_em ? 'aguardando' : 'enviado'
        });

        resultados.proximas_acoes++;

      } catch (error) {
        console.error(`[DISPARADOR] ❌ Erro executando ação:`, error.message);
      }
    }

    console.log('[DISPARADOR] ✅ Ciclo concluído:', resultados);

    return Response.json({
      success: true,
      summary: resultados
    });

  } catch (error) {
    console.error('[DISPARADOR] ❌ Erro geral:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});