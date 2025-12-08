import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ══════════════════════════════════════════════════════════════════════════════
// 🧠 MOTOR DE DECISÃO PRÉ-ATENDIMENTO - V3 INTELIGENTE
// ══════════════════════════════════════════════════════════════════════════════
// 
// CARACTERÍSTICAS:
// ✅ 3 Camadas de decisão (Continuidade → Intenção → Fidelização)
// ✅ Anti-redundância com Buffer e Thread Lock
// ✅ Configurável por Conexão/Setor
// ✅ Fail-Safe automático
// ✅ Zero duplicatas, Zero loops
//
// ══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
    });
  }

  const base44 = createClientFromRequest(req);

  try {
    const { thread_id, contact_id, integration_id, mensagem_texto } = await req.json();

    if (!thread_id || !contact_id) {
      return Response.json({ error: 'thread_id e contact_id são obrigatórios' }, { status: 400 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 🛡️ FASE 0: BLINDAGEM ANTI-REDUNDÂNCIA
    // ════════════════════════════════════════════════════════════════════════

    // Marcar início para métricas de tempo
    const tempoInicio = Date.now();

    // 🔒 LOCK: Verificar se thread está ocupada processando
    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

    // Carregar config primeiro para obter lock_timeout_minutos
    const configPrevia = await carregarConfiguracao(base44, integration_id);
    const lockTimeoutMinutos = configPrevia?.lock_timeout_minutos || 5;

    if (thread.metadata?.motor_processando) {
      // Verificar se o lock expirou
      const lockAt = thread.metadata?.motor_lock_at;
      if (lockAt) {
        const tempoDecorrido = (Date.now() - new Date(lockAt).getTime()) / 1000 / 60; // em minutos

        if (tempoDecorrido > lockTimeoutMinutos) {
          console.log(`[MOTOR] ⚠️ Lock da thread ${thread_id} expirado (${Math.round(tempoDecorrido)}min). Forçando liberação.`);

          // Liberar lock expirado e atualizar métrica
          await base44.asServiceRole.entities.MessageThread.update(thread_id, {
            metadata: { ...thread.metadata, motor_processando: false, motor_lock_at: null }
          });

          // Incrementar métrica de locks expirados
          if (configPrevia?.id) {
            const metricas = configPrevia.metricas || {};
            await base44.asServiceRole.entities.MotorDecisaoConfig.update(configPrevia.id, {
              metricas: {
                ...metricas,
                total_locks_expirados: (metricas.total_locks_expirados || 0) + 1
              }
            });
          }
        } else {
          console.log(`[MOTOR] ⏸️ Thread ${thread_id} já está sendo processada. Aguardando...`);
          return Response.json({ 
            success: true, 
            action: 'buffered', 
            message: 'Thread em processamento, mensagem armazenada' 
          });
        }
      } else {
        // Lock sem timestamp - liberar por segurança
        console.log(`[MOTOR] ⚠️ Lock sem timestamp na thread ${thread_id}. Liberando.`);
        await base44.asServiceRole.entities.MessageThread.update(thread_id, {
          metadata: { ...thread.metadata, motor_processando: false }
        });
      }
    }

    // Travar thread durante processamento
    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      metadata: { ...thread.metadata, motor_processando: true, motor_lock_at: new Date().toISOString() }
    });

    try {
      // 📦 BUFFER: Verificar se deve aguardar mais mensagens
      const bufferAtual = await verificarOuCriarBuffer(base44, thread_id, contact_id, integration_id, mensagem_texto);
      
      if (!bufferAtual.pronto_para_processar) {
        console.log(`[MOTOR] ⏳ Buffer aguardando mais mensagens. Expira em: ${bufferAtual.expira_em}`);
        return Response.json({ 
          success: true, 
          action: 'buffering', 
          buffer_expira_em: bufferAtual.expira_em 
        });
      }

      // Buffer pronto - usar texto consolidado
      const textoCompleto = bufferAtual.texto_consolidado || mensagem_texto;

      // ════════════════════════════════════════════════════════════════════════
      // 🔧 FASE 1: CARREGAR CONFIGURAÇÃO (Hierarquia: Específica → Global)
      // ════════════════════════════════════════════════════════════════════════
      
      const config = await carregarConfiguracao(base44, integration_id);

      // 🚨 DISJUNTOR: Motor desligado?
      if (!config || !config.ativo) {
        console.log(`[MOTOR] ⚠️ Motor desativado. Usando fallback padrão.`);
        return Response.json({
          success: true,
          action: 'motor_desativado',
          decisao: { usar_fallback: true, playbook_id: config?.fallback_playbook_id }
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // 🕐 FASE 1.5: VERIFICAR HORÁRIO DE ATENDIMENTO
      // ════════════════════════════════════════════════════════════════════════

      const resultadoHorario = verificarHorarioAtendimento(config);
      
      if (!resultadoHorario.dentroHorario && config.playbook_fora_horario_id) {
        console.log('[MOTOR] 🌙 Fora do horário de atendimento');
        
        // Atualizar métrica
        const metricas = config.metricas || {};
        await base44.asServiceRole.entities.MotorDecisaoConfig.update(config.id, {
          metricas: {
            ...metricas,
            total_decisoes: (metricas.total_decisoes || 0) + 1,
            fora_horario_hits: (metricas.fora_horario_hits || 0) + 1
          }
        });

        return Response.json({
          success: true,
          action: 'fora_horario',
          decisao: {
            camada: 'horario',
            decidiu: true,
            ignorar_bot: false,
            playbook_id: config.playbook_fora_horario_id,
            motivo: resultadoHorario.motivo
          }
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // 🎯 FASE 2: MOTOR DE 3 CAMADAS
      // ════════════════════════════════════════════════════════════════════════

      const decisao = await executarMotorDecisao(base44, {
        thread_id,
        contact_id,
        integration_id,
        textoCompleto,
        config
      });

      // Atualizar métricas
      await atualizarMetricas(base44, config, decisao);

      // Marcar buffer como processado
      if (bufferAtual.buffer_id) {
        await base44.asServiceRole.entities.BufferMensagem.update(bufferAtual.buffer_id, {
          processado: true
        });
      }

      return Response.json({
        success: true,
        decisao,
        config_usada: {
          nome: config.nome_configuracao,
          integration_id: config.integration_id,
          janela_horas: config.janela_continuidade_horas
        }
      });

    } finally {
      // Destravar thread SEMPRE
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        metadata: { ...thread.metadata, motor_processando: false, motor_lock_at: null }
      });
    }

  } catch (error) {
    console.error('[MOTOR] ❌ ERRO CRÍTICO:', error);
    
    // 🧯 FAIL-SAFE: Em caso de erro, retornar fallback
    return Response.json({
      success: true,
      action: 'fail_safe',
      error: error.message,
      decisao: { usar_fallback: true, ignorar_bot: false }
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 📦 BUFFER: Verificar e agrupar mensagens picadas
// ══════════════════════════════════════════════════════════════════════════════
async function verificarOuCriarBuffer(base44, thread_id, contact_id, integration_id, mensagem_texto) {
  const agora = new Date();
  const bufferSegundos = 3; // Padrão: 3 segundos

  // Buscar buffer ativo para esta thread
  const buffersAtivos = await base44.asServiceRole.entities.BufferMensagem.filter({
    thread_id,
    processado: false
  });

  let buffer = buffersAtivos && buffersAtivos.length > 0 ? buffersAtivos[0] : null;

  if (!buffer) {
    // Criar novo buffer
    const expiraEm = new Date(agora.getTime() + bufferSegundos * 1000);
    buffer = await base44.asServiceRole.entities.BufferMensagem.create({
      thread_id,
      contact_id,
      integration_id,
      mensagens_agrupadas: [{
        conteudo: mensagem_texto,
        timestamp: agora.toISOString()
      }],
      texto_consolidado: mensagem_texto,
      primeiro_timestamp: agora.toISOString(),
      ultimo_timestamp: agora.toISOString(),
      expira_em: expiraEm.toISOString(),
      processado: false
    });

    return { 
      buffer_id: buffer.id, 
      pronto_para_processar: false, 
      expira_em: expiraEm.toISOString(),
      texto_consolidado: mensagem_texto
    };
  }

  // Atualizar buffer existente
  const mensagensAtualizadas = [...(buffer.mensagens_agrupadas || []), {
    conteudo: mensagem_texto,
    timestamp: agora.toISOString()
  }];

  const textoConsolidado = mensagensAtualizadas.map(m => m.conteudo).join('\n');
  const novaExpiracao = new Date(agora.getTime() + bufferSegundos * 1000);

  await base44.asServiceRole.entities.BufferMensagem.update(buffer.id, {
    mensagens_agrupadas: mensagensAtualizadas,
    texto_consolidado: textoConsolidado,
    ultimo_timestamp: agora.toISOString(),
    expira_em: novaExpiracao.toISOString()
  });

  // Verificar se buffer expirou
  const expiracaoAnterior = new Date(buffer.expira_em);
  const prontoParaProcessar = agora >= expiracaoAnterior;

  return {
    buffer_id: buffer.id,
    pronto_para_processar: prontoParaProcessar,
    expira_em: novaExpiracao.toISOString(),
    texto_consolidado: textoConsolidado
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ⚙️ CARREGAR CONFIGURAÇÃO (Hierarquia: Específica → Global)
// ══════════════════════════════════════════════════════════════════════════════
async function carregarConfiguracao(base44, integration_id) {
  // 1. Tentar configuração ESPECÍFICA da conexão
  if (integration_id) {
    const configsEspecificas = await base44.asServiceRole.entities.MotorDecisaoConfig.filter({
      integration_id,
      ativo: true
    });

    if (configsEspecificas && configsEspecificas.length > 0) {
      console.log(`[MOTOR] 🎯 Usando config específica para integração ${integration_id}`);
      return configsEspecificas[0];
    }
  }

  // 2. Buscar configuração GLOBAL
  const configsGlobais = await base44.asServiceRole.entities.MotorDecisaoConfig.filter({
    ativo: true
  });

  const configGlobal = configsGlobais.find(c => !c.integration_id);

  if (configGlobal) {
    console.log('[MOTOR] 🌍 Usando configuração GLOBAL');
    return configGlobal;
  }

  console.log('[MOTOR] ⚠️ Nenhuma configuração encontrada');
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 MOTOR DE 3 CAMADAS
// ══════════════════════════════════════════════════════════════════════════════
async function executarMotorDecisao(base44, params) {
  const { thread_id, contact_id, integration_id, textoCompleto, config } = params;

  console.log(`[MOTOR] 🚀 Iniciando decisão para thread ${thread_id}`);

  // ────────────────────────────────────────────────────────────────────────────
  // 📍 CAMADA 1: CONTINUIDADE (Retorno Recente)
  // ────────────────────────────────────────────────────────────────────────────
  const resultadoCamada1 = await verificarContinuidade(base44, thread_id, contact_id, config);
  
  if (resultadoCamada1.decidiu) {
    console.log('[MOTOR] ✅ CAMADA 1 (Continuidade) decidiu:', resultadoCamada1);
    return {
      camada: 'continuidade',
      ...resultadoCamada1
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 📍 CAMADA 2: INTENÇÃO (Palavras-chave + IA)
  // ────────────────────────────────────────────────────────────────────────────
  const resultadoCamada2 = await detectarIntencao(base44, textoCompleto, integration_id, config);
  
  if (resultadoCamada2.decidiu) {
    console.log('[MOTOR] ✅ CAMADA 2 (Intenção) decidiu:', resultadoCamada2);
    return {
      camada: 'intencao',
      ...resultadoCamada2
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 📍 CAMADA 3: FIDELIZAÇÃO (Carteira de Clientes)
  // ────────────────────────────────────────────────────────────────────────────
  if (config.usar_fidelizacao) {
    const resultadoCamada3 = await verificarFidelizacao(base44, contact_id, integration_id);
    
    if (resultadoCamada3.decidiu) {
      console.log('[MOTOR] ✅ CAMADA 3 (Fidelização) decidiu:', resultadoCamada3);
      return {
        camada: 'fidelizacao',
        ...resultadoCamada3
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 📍 FALLBACK: URA/Menu Padrão
  // ────────────────────────────────────────────────────────────────────────────
  console.log('[MOTOR] 🔄 FALLBACK ativado - nenhuma camada decidiu');
  return {
    camada: 'fallback',
    decidiu: true,
    ignorar_bot: false,
    playbook_id: config.fallback_playbook_id,
    motivo: 'Nenhuma regra específica aplicável'
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 📍 CAMADA 1: CONTINUIDADE
// ══════════════════════════════════════════════════════════════════════════════
async function verificarContinuidade(base44, thread_id, contact_id, config) {
  const janelaMilissegundos = (config.janela_continuidade_horas || 48) * 60 * 60 * 1000;
  const agora = new Date();

  // Buscar última interação do usuário (não do contato) nesta thread
  const mensagens = await base44.asServiceRole.entities.Message.filter(
    { thread_id, sender_type: 'user' },
    '-created_date',
    1
  );

  if (!mensagens || mensagens.length === 0) {
    return { decidiu: false };
  }

  const ultimaMsgUsuario = mensagens[0];
  const tempoDecorrido = agora - new Date(ultimaMsgUsuario.created_date);

  if (tempoDecorrido > janelaMilissegundos) {
    console.log(`[MOTOR] ⏰ Continuidade expirada (${Math.round(tempoDecorrido / 3600000)}h)`);
    return { decidiu: false };
  }

  // Dentro da janela - retornar para o mesmo atendente
  const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);

  if (thread.assigned_user_id) {
    console.log(`[MOTOR] ✅ Continuidade detectada - retornando para ${thread.assigned_user_email}`);
    return {
      decidiu: true,
      ignorar_bot: true,
      assigned_user_id: thread.assigned_user_id,
      assigned_user_email: thread.assigned_user_email,
      assigned_user_name: thread.assigned_user_name,
      motivo: `Continuidade dentro de ${config.janela_continuidade_horas}h`
    };
  }

  return { decidiu: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// 📍 CAMADA 2: INTENÇÃO (Palavras-chave + IA)
// ══════════════════════════════════════════════════════════════════════════════
async function detectarIntencao(base44, textoCompleto, integration_id, config) {
  if (!textoCompleto || textoCompleto.trim().length === 0) {
    return { decidiu: false };
  }

  const textoNormalizado = textoCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ─────────────────────────────────────────────────────────────────────────
  // 🔍 ETAPA 2.1: Palavras-chave (Mais rápido, mais confiável)
  // ─────────────────────────────────────────────────────────────────────────
  if (config.usar_intencao_palavras) {
    const regras = await base44.asServiceRole.entities.RegrasIntencao.filter({ ativo: true }, 'prioridade');

    for (const regra of regras) {
      // Filtro por conexão
      if (regra.conexoes_permitidas && regra.conexoes_permitidas.length > 0) {
        if (!regra.conexoes_permitidas.includes(integration_id)) {
          continue;
        }
      }

      // Verificar match de termos
      const matched = verificarMatchRegra(textoNormalizado, regra);

      if (matched) {
        console.log(`[MOTOR] 🎯 Regra matched: "${regra.nome_regra}"`);

        // Incrementar métrica da regra
        const metricas = regra.metricas || {};
        await base44.asServiceRole.entities.RegrasIntencao.update(regra.id, {
          metricas: {
            ...metricas,
            total_matches: (metricas.total_matches || 0) + 1,
            ultima_ativacao: new Date().toISOString()
          }
        });

        return {
          decidiu: true,
          ignorar_bot: true,
          setor: regra.setor_alvo,
          playbook_id: regra.playbook_especifico_id,
          assigned_user_id: regra.atendente_especifico_id,
          fila_id: regra.fila_destino_id,
          motivo: `Intenção detectada: ${regra.nome_regra}`,
          regra_aplicada: regra.nome_regra
        };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🤖 ETAPA 2.2: IA (Opcional, mais lento)
  // ─────────────────────────────────────────────────────────────────────────
  if (config.usar_intencao_ia && config.prompt_ia_intencao) {
    try {
      const resultadoIA = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${config.prompt_ia_intencao}\n\nMensagem do cliente:\n${textoCompleto}`,
        response_json_schema: {
          type: "object",
          properties: {
            setor_detectado: { 
              type: "string", 
              enum: ["vendas", "assistencia", "financeiro", "fornecedor", "geral", "nenhum"] 
            },
            confianca: { type: "number" },
            motivo: { type: "string" }
          }
        }
      });

      if (resultadoIA.setor_detectado !== 'nenhum' && resultadoIA.confianca >= config.threshold_confianca_ia) {
        console.log(`[MOTOR] 🤖 IA detectou: ${resultadoIA.setor_detectado} (${resultadoIA.confianca})`);
        return {
          decidiu: true,
          ignorar_bot: true,
          setor: resultadoIA.setor_detectado,
          motivo: `IA: ${resultadoIA.motivo}`,
          confianca_ia: resultadoIA.confianca
        };
      }
    } catch (error) {
      console.error('[MOTOR] ⚠️ Erro na IA:', error.message);
    }
  }

  return { decidiu: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// 📍 CAMADA 3: FIDELIZAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
async function verificarFidelizacao(base44, contact_id, integration_id) {
  const contato = await base44.asServiceRole.entities.Contact.get(contact_id);

  // Buscar atendente fidelizado (vendedor responsável)
  const vendedorResponsavel = contato.vendedor_responsavel;
  const atendenteVendas = contato.atendente_fidelizado_vendas;
  const atendenteAssistencia = contato.atendente_fidelizado_assistencia;
  const atendenteFinanceiro = contato.atendente_fidelizado_financeiro;

  // Prioridade: atendente específico > vendedor responsável
  let atendenteId = atendenteVendas || atendenteAssistencia || atendenteFinanceiro;

  if (!atendenteId && vendedorResponsavel) {
    // Buscar vendedor pelo nome
    const vendedores = await base44.asServiceRole.entities.Vendedor.filter({ nome: vendedorResponsavel });
    if (vendedores && vendedores.length > 0) {
      atendenteId = vendedores[0].id;
    }
  }

  if (atendenteId) {
    console.log(`[MOTOR] 👤 Fidelização detectada: ${atendenteId}`);
    return {
      decidiu: true,
      ignorar_bot: true,
      assigned_user_id: atendenteId,
      motivo: 'Cliente fidelizado a atendente/vendedor'
    };
  }

  return { decidiu: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// 🔍 VERIFICAR MATCH DE REGRA
// ══════════════════════════════════════════════════════════════════════════════
function verificarMatchRegra(textoNormalizado, regra) {
  const termos = regra.termos_chave || [];
  if (termos.length === 0) return false;

  const termosNormalizados = termos.map(t => 
    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  switch (regra.match_type) {
    case 'all':
      // Todas as palavras devem estar presentes
      return termosNormalizados.every(termo => textoNormalizado.includes(termo));
    
    case 'exact':
      // Frase exata
      const fraseExata = termosNormalizados.join(' ');
      return textoNormalizado.includes(fraseExata);
    
    case 'any':
    default:
      // Qualquer palavra
      return termosNormalizados.some(termo => textoNormalizado.includes(termo));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🕐 VERIFICAR HORÁRIO DE ATENDIMENTO
// ══════════════════════════════════════════════════════════════════════════════
function verificarHorarioAtendimento(config) {
  const agora = new Date();
  const horaAtual = agora.getHours();
  const minutoAtual = agora.getMinutes();
  const diaSemana = agora.getDay(); // 0 = Domingo, 6 = Sábado

  // Dias de atendimento (padrão: segunda a sexta)
  const diasAtivos = config.dias_atendimento_semana || [1, 2, 3, 4, 5];
  const diaUtil = diasAtivos.includes(diaSemana);

  if (!diaUtil) {
    return {
      dentroHorario: false,
      motivo: 'Fora dos dias de atendimento'
    };
  }

  // Horário de atendimento
  const [horaInicio, minInicio] = (config.horario_atendimento_inicio || '08:00').split(':').map(Number);
  const [horaFim, minFim] = (config.horario_atendimento_fim || '18:00').split(':').map(Number);

  const minutosAtual = horaAtual * 60 + minutoAtual;
  const minutosInicio = horaInicio * 60 + minInicio;
  const minutosFim = horaFim * 60 + minFim;

  const dentroHorario = minutosAtual >= minutosInicio && minutosAtual < minutosFim;

  if (!dentroHorario) {
    return {
      dentroHorario: false,
      motivo: `Fora do horário de atendimento (${config.horario_atendimento_inicio} às ${config.horario_atendimento_fim})`
    };
  }

  return { dentroHorario: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// 📊 ATUALIZAR MÉTRICAS
// ══════════════════════════════════════════════════════════════════════════════
async function atualizarMetricas(base44, config, decisao) {
  if (!config || !config.id) return;

  const metricas = config.metricas || {};
  const camadaKey = `${decisao.camada}_hits`;

  await base44.asServiceRole.entities.MotorDecisaoConfig.update(config.id, {
    metricas: {
      ...metricas,
      total_decisoes: (metricas.total_decisoes || 0) + 1,
      [camadaKey]: (metricas[camadaKey] || 0) + 1
    }
  });
}