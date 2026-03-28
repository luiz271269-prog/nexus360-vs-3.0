import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Função para Processar Eventos Pendentes
 * Integrado com Sistema de Gatilhos Automáticos
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verificar autenticação - permitir tanto usuário logado quanto cron secret
        const authHeader = req.headers.get('authorization');
        const cronSecret = Deno.env.get('CRON_SECRET');
        
        let isAuthorized = false;
        let executionMode = 'unknown';
        
        // Verificar se é execução via CRON
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
            isAuthorized = true;
            executionMode = 'cron';
            console.log("🤖 Execução via CRON detectada");
        } else {
            // Verificar se é usuário autenticado
            try {
                const user = await base44.auth.me();
                if (user) {
                    isAuthorized = true;
                    executionMode = 'manual';
                    console.log(`👤 Execução manual por usuário: ${user.email}`);
                }
            } catch (error) {
                console.log("❌ Falha na autenticação de usuário");
            }
        }
        
        if (!isAuthorized) {
            return Response.json({ 
                error: 'Unauthorized',
                message: 'Você precisa estar autenticado para executar esta ação'
            }, { status: 401 });
        }
        
        console.log("🤖 [ProcessadorEventos] Iniciando processamento...");
        console.log(`📊 Modo de execução: ${executionMode}`);
        
        // 🆕 NOVO: Verificar gatilhos pendentes primeiro
        try {
            const gatilhosResult = await base44.asServiceRole.functions.invoke('sistemaGatilhos', {
                action: 'verificar_gatilhos_pendentes'
            });
            console.log(`[ProcessadorEventos] ✅ Gatilhos verificados: ${gatilhosResult.data.processadas} execuções iniciadas`);
        } catch (error) {
            console.error('[ProcessadorEventos] ⚠️ Erro ao verificar gatilhos:', error);
        }
        
        // Buscar eventos não processados
        const eventos = await base44.asServiceRole.entities.EventoSistema.filter({
            processado: false
        }, '-timestamp', 50);
        
        console.log(`📊 [ProcessadorEventos] ${eventos.length} eventos pendentes`);
        
        let processados = 0;
        let erros = 0;
        const resultados = [];
        
        for (const evento of eventos) {
            try {
                console.log(`🔄 Processando evento: ${evento.tipo_evento} (${evento.id})`);
                
                // 🆕 NOVO: Processar através do sistema de gatilhos
                const resultado = await processarEventoComGatilhos(base44, evento);
                
                // Marcar como processado
                await base44.asServiceRole.entities.EventoSistema.update(evento.id, {
                    processado: true,
                    resultados_processamento: resultado
                });
                
                processados++;
                resultados.push({
                    evento_id: evento.id,
                    tipo: evento.tipo_evento,
                    status: 'sucesso',
                    resultado
                });
                
                console.log(`✅ Evento ${evento.id} processado com sucesso`);
                
            } catch (error) {
                console.error(`❌ Erro ao processar evento ${evento.id}:`, error);
                erros++;
                
                // As per outline, the EventoSistema.update on error is removed.
                // Events that cause an error here will remain `processado: false`
                // and will be retried in the next execution.
                
                resultados.push({
                    evento_id: evento.id,
                    tipo: evento.tipo_evento,
                    status: 'erro',
                    erro: error.message
                });
            }
        }
        
        console.log(`✅ [ProcessadorEventos] Concluído: ${processados} processados, ${erros} erros`);
        
        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            execution_mode: executionMode,
            eventos_processados: processados,
            erros: erros,
            detalhes: resultados
        });
        
    } catch (error) {
        console.error("❌ [ProcessadorEventos] Erro geral:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
});

/**
 * Processa evento através do sistema de gatilhos
 */
async function processarEventoComGatilhos(base44, evento) {
    const { tipo_evento, dados_evento } = evento;
    
    // Tentar processar através do sistema de gatilhos
    try {
        const gatilhoResult = await base44.asServiceRole.functions.invoke('sistemaGatilhos', {
            action: 'processar_evento',
            tipo_evento,
            dados_evento
        });
        
        if (gatilhoResult.data?.processed && gatilhoResult.data?.resultado?.acionado) {
            console.log(`[ProcessadorEventos] 🎯 Gatilho acionado: ${gatilhoResult.data.resultado.playbook_nome}`);
            return {
                processado_via_gatilho: true,
                ...gatilhoResult.data.resultado
            };
        }
    } catch (error) {
        console.error('[ProcessadorEventos] ⚠️ Erro ao processar gatilho:', error);
        // Continue to traditional processing if gatilho system fails to invoke or process
    }
    
    // Fallback: processar da forma tradicional (Motor Inteligencia, etc.)
    const traditionalResult = await processarEventoTradicional(base44, evento);
    return {
        processado_via_gatilho: false,
        processado_via_motor: true,
        ...traditionalResult
    };
}

/**
 * Processamento tradicional (fallback)
 */
async function processarEventoTradicional(base44, evento) {
    const { tipo_evento, dados_evento, entidade_id, entidade_tipo } = evento;
    
    switch (tipo_evento) {
        case 'mensagem_whatsapp_recebida':
        case 'mensagem_whatsapp_enviada':
            return await processarEventoMensagem(base44, dados_evento);
        
        case 'orcamento_criado':
        case 'orcamento_status_mudou':
            return await processarEventoOrcamento(base44, dados_evento);
        
        case 'cliente_criado':
        case 'cliente_atualizado':
            return await processarEventoCliente(base44, dados_evento);
        
        case 'venda_criada':
            return await processarEventoVenda(base44, dados_evento);
        
        case 'tarefa_concluida':
            return await processarEventoTarefa(base44, dados_evento);
        
        default:
            console.log(`⚠️ Tipo de evento não tratado (tradicional): ${tipo_evento}`);
            return { processado: false, motivo: 'Tipo de evento não tratado' };
    }
}

/**
 * Processa eventos de mensagens WhatsApp
 */
async function processarEventoMensagem(base44, dados) {
    const { cliente_id, contato_id } = dados;
    
    if (!cliente_id) {
        return { processado: false, motivo: 'Cliente não identificado' };
    }
    
    // Importar MotorInteligencia - usar caminho relativo
    const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
    
    // Recalcular score do cliente
    console.log(`🧠 Recalculando score do cliente ${cliente_id}`);
    const novoScore = await MotorInteligencia.analisarCliente(cliente_id);
    
    // Verificar se precisa gerar tarefa urgente
    if (novoScore && novoScore.score_urgencia >= 85) {
        const tarefasExistentes = await base44.asServiceRole.entities.TarefaInteligente.filter({
            cliente_id: cliente_id,
            status: 'pendente'
        });
        
        if (tarefasExistentes.length === 0) {
            console.log(`🎯 Gerando tarefa urgente para cliente ${cliente_id}`);
            await MotorInteligencia.gerarTarefasUrgentes({ cliente_id });
        }
    }
    
    return {
        processado: true,
        score_atualizado: novoScore?.score_total,
        tarefa_gerada: novoScore?.score_urgencia >= 85
    };
}

/**
 * Processa eventos de orçamento
 */
async function processarEventoOrcamento(base44, dados) {
    const { orcamento_id, cliente_nome, status_novo } = dados;
    
    // Criar fluxo inteligente para orçamentos enviados
    if (status_novo === 'enviado') {
        const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
        await MotorInteligencia.criarFluxoOrcamento(orcamento_id);
    }
    
    // Atualizar score do cliente
    const clientes = await base44.asServiceRole.entities.Cliente.filter({
        razao_social: cliente_nome
    });
    
    if (clientes.length > 0) {
        const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
        await MotorInteligencia.analisarCliente(clientes[0].id);
    }
    
    return { processado: true, fluxo_criado: status_novo === 'enviado' };
}

/**
 * Processa eventos de cliente
 */
async function processarEventoCliente(base44, dados) {
    const { cliente_id, status_anterior, status_novo } = dados;
    
    // Análise inicial do cliente
    const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
    const score = await MotorInteligencia.analisarCliente(cliente_id);
    
    // 🆕 NOVO: Verificar timeout em etapas (lead parado muito tempo)
    if (status_novo && status_anterior && status_novo === status_anterior) {
        await verificarTimeoutEtapa(base44, cliente_id, status_novo);
    }
    
    // 🆕 NOVO: Gerar insights ao mudar etapa
    if (status_novo && status_anterior && status_novo !== status_anterior) {
        await gerarInsightMudancaEtapa(base44, cliente_id, status_anterior, status_novo);
    }
    
    return { processado: true, score_inicial: score?.score_total };
}

/**
 * Processa eventos de venda
 */
async function processarEventoVenda(base44, dados) {
    const { cliente_nome } = dados;
    
    // Atualizar score do cliente após venda
    const clientes = await base44.asServiceRole.entities.Cliente.filter({
        razao_social: cliente_nome
    });
    
    if (clientes.length > 0) {
        const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
        await MotorInteligencia.analisarCliente(clientes[0].id);
    }
    
    return { processado: true };
}

/**
 * Processa eventos de tarefa concluída
 */
async function processarEventoTarefa(base44, dados) {
    const { tarefa_id, cliente_id, observacoes, resultado } = dados;
    
    if (!tarefa_id) {
        return { processado: false, motivo: 'Tarefa ID não informado' };
    }
    
    // Processar feedback da tarefa
    const MotorInteligencia = (await import('../components/agenda/MotorInteligencia.js')).default;
    const analise = await MotorInteligencia.processarFeedbackTarefa(
        tarefa_id,
        observacoes || 'Tarefa concluída',
        resultado || 'sucesso'
    );
    
    return { 
        processado: true,
        feedback_processado: true,
        efetividade_ia: analise?.efetividade_sugestao_ia
    };
}

/**
 * 🆕 NOVO: Verifica se lead está muito tempo em uma etapa
 */
async function verificarTimeoutEtapa(base44, clienteId, statusAtual) {
    try {
        const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
        if (!cliente) return;

        const diasNaEtapa = calcularDiasNaEtapa(cliente.updated_date);
        
        // Limites de tempo por etapa (em dias)
        const timeoutsPorEtapa = {
            novo_lead: 2,
            primeiro_contato: 3,
            em_conversa: 5,
            levantamento_dados: 7,
            pre_qualificado: 5,
            qualificacao_tecnica: 7,
            em_aquecimento: 10,
            lead_qualificado: 15
        };

        const limiteEtapa = timeoutsPorEtapa[statusAtual];
        
        if (limiteEtapa && diasNaEtapa >= limiteEtapa) {
            console.log(`⏰ Lead ${cliente.razao_social} parado em "${statusAtual}" há ${diasNaEtapa} dias`);
            
            // Criar notificação
            await base44.asServiceRole.entities.NotificationEvent.create({
                tipo: 'tarefa_urgente',
                titulo: `⏰ Lead parado há ${diasNaEtapa} dias`,
                mensagem: `O lead "${cliente.razao_social}" está em "${statusAtual}" há ${diasNaEtapa} dias. Recomendamos ação imediata.`,
                prioridade: diasNaEtapa >= limiteEtapa * 2 ? 'critica' : 'alta',
                usuario_id: cliente.created_by,
                usuario_nome: cliente.vendedor_responsavel,
                entidade_relacionada: 'Cliente',
                entidade_id: clienteId,
                acao_sugerida: {
                    tipo: 'navegar',
                    destino: `/LeadsQualificados?id=${clienteId}`
                }
            });

            // Criar tarefa de reativação
            const tarefasExistentes = await base44.asServiceRole.entities.TarefaInteligente.filter({
                cliente_id: clienteId,
                status: 'pendente'
            });

            if (tarefasExistentes.length === 0) {
                await base44.asServiceRole.entities.TarefaInteligente.create({
                    titulo: `🔥 URGENTE: Reativar lead ${cliente.razao_social}`,
                    descricao: `Lead parado em "${statusAtual}" há ${diasNaEtapa} dias. Ação necessária para evitar perda.`,
                    tipo_tarefa: 'reativacao_cliente',
                    prioridade: 'critica',
                    cliente_id: clienteId,
                    cliente_nome: cliente.razao_social,
                    vendedor_responsavel: cliente.vendedor_responsavel || 'Não atribuído',
                    data_prazo: new Date().toISOString(),
                    status: 'pendente',
                    contexto_ia: {
                        motivo_criacao: `Lead inativo há ${diasNaEtapa} dias`,
                        etapa_funil: statusAtual,
                        dias_inativo: diasNaEtapa
                    }
                });
            }
        }
    } catch (error) {
        console.error('Erro ao verificar timeout:', error);
    }
}

/**
 * 🆕 NOVO: Gera insights quando lead muda de etapa
 */
async function gerarInsightMudancaEtapa(base44, clienteId, statusAnterior, statusNovo) {
    try {
        const cliente = await base44.asServiceRole.entities.Cliente.get(clienteId);
        if (!cliente) return;

        console.log(`📊 Lead "${cliente.razao_social}" avançou: ${statusAnterior} → ${statusNovo}`);

        // Registrar na Base de Conhecimento
        await base44.asServiceRole.entities.BaseConhecimento.create({
            titulo: `Progressão de Lead: ${statusAnterior} → ${statusNovo}`,
            tipo_registro: 'insight_cliente',
            categoria: 'estrategia',
            conteudo: `Lead "${cliente.razao_social}" progrediu de "${statusAnterior}" para "${statusNovo}"`,
            conteudo_estruturado: {
                cliente_id: clienteId,
                cliente_nome: cliente.razao_social,
                status_anterior: statusAnterior,
                status_novo: statusNovo,
                vendedor: cliente.vendedor_responsavel,
                segmento: cliente.segmento,
                classificacao: cliente.classificacao
            },
            entidade_origem: 'Cliente',
            id_entidade_origem: clienteId,
            tags: ['progressao_funil', statusNovo, cliente.segmento],
            relevancia_score: statusNovo === 'lead_qualificado' ? 90 : 70,
            aprovado: true,
            ativo: true
        });

        // Se chegou em "lead_qualificado", criar alerta especial
        if (statusNovo === 'lead_qualificado') {
            await base44.asServiceRole.entities.NotificationEvent.create({
                tipo: 'tarefa_urgente',
                titulo: `🎯 Lead Qualificado: ${cliente.razao_social}`,
                mensagem: `Parabéns! O lead está pronto para proposta comercial.`,
                prioridade: 'alta',
                usuario_id: cliente.created_by,
                usuario_nome: cliente.vendedor_responsavel,
                entidade_relacionada: 'Cliente',
                entidade_id: clienteId,
                acao_sugerida: {
                    tipo: 'navegar',
                    destino: `/Orcamentos?criar_para_cliente=${clienteId}`
                }
            });
        }

    } catch (error) {
        console.error('Erro ao gerar insight:', error);
    }
}

/**
 * Calcula quantos dias se passaram desde uma data
 */
function calcularDiasNaEtapa(dataAtualizacao) {
    if (!dataAtualizacao) return 0;
    const agora = new Date();
    const atualizacao = new Date(dataAtualizacao);
    const diffMs = agora - atualizacao;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}