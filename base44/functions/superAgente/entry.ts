// ============================================================================
// SUPER AGENTE v1.0.0 - Orquestrador Universal de Skills
// ============================================================================
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Modos de execução
const EXECUTION_MODES = {
  COPILOT: 'copilot',              // Mostra plano, aguarda confirmação
  AUTONOMOUS_SAFE: 'autonomous_safe', // Executa ações reversíveis automaticamente
  CRITICAL: 'critical',             // Requer frase de confirmação exata
  DRY_RUN: 'dry_run'               // Apenas simula, não executa
};

// Níveis de risco
const RISK_LEVELS = {
  BAIXO: 'baixo',       // Leitura, análise
  MEDIO: 'medio',       // Atualizações reversíveis, envios controlados
  ALTO: 'alto',         // Atualizações em massa, exclusões com filtro
  CRITICO: 'critico'    // Exclusões em massa, alterações irreversíveis
};

// ============================================================================
// PARSER DE COMANDOS
// ============================================================================

function parseComando(textoUsuario) {
  const texto = textoUsuario.toLowerCase().trim();
  
  // Padrões de comando
  const patterns = {
    listar: /^(listar|analisar|mostrar|buscar)\s+(\w+)(.*)$/,
    atualizar: /^(atualizar|modificar|mudar)\s+(\w+)(.*)$/,
    limpar: /^(limpar|excluir|deletar|remover)\s+(\w+)(.*)$/,
    followup: /^(followup|follow-up|reativar)\s+(.*)$/,
    executar: /^(executar|rodar|aplicar)\s+(\w+)(.*)$/,
    simular: /^(simular|testar|preview)\s+(.*)$/,
    configurar: /^(configurar|config|ajustar)\s+(.*)$/,
    explicar: /^(explicar|porque|por que)\s+(.*)$/
  };

  for (const [tipo, regex] of Object.entries(patterns)) {
    const match = texto.match(regex);
    if (match) {
      return {
        tipo,
        entidade: match[2]?.trim(),
        parametros: match[3]?.trim() || match[2]?.trim(),
        original: textoUsuario
      };
    }
  }

  return {
    tipo: 'chat_livre',
    parametros: textoUsuario,
    original: textoUsuario
  };
}

// ============================================================================
// RESOLVER SKILL
// ============================================================================

async function resolverSkill(base44, comando) {
  const { tipo, entidade, parametros } = comando;
  
  // Buscar skill no registry
  try {
    const skills = await base44.asServiceRole.entities.SkillRegistry.filter(
      { ativa: true },
      '-created_date',
      100
    );

    // Match por tipo de comando
    const skillCandidatas = skills.filter(skill => {
      if (tipo === 'listar' && skill.categoria === 'analise') return true;
      if (tipo === 'atualizar' && skill.categoria === 'gestao_dados') return true;
      if (tipo === 'limpar' && skill.skill_name.includes('limpar')) return true;
      if (tipo === 'followup' && skill.skill_name.includes('follow')) return true;
      if (tipo === 'executar' && entidade && skill.skill_name.includes(entidade)) return true;
      return false;
    });

    // Retornar primeira match ou null
    return skillCandidatas[0] || null;

  } catch (e) {
    console.warn('[SUPER-AGENTE] Erro ao buscar skills:', e.message);
    return null;
  }
}

// ============================================================================
// EXECUTOR DE SKILL
// ============================================================================

async function executarSkill(base44, skill, parametros, modo, usuario) {
  // ✅ parametros_entrada deve ser sempre um objeto (nunca string)
  const parametrosObj = typeof parametros === 'string'
    ? { input: parametros }
    : (parametros && typeof parametros === 'object' ? parametros : {});

  const execucao = {
    skill_name: skill.skill_name,
    triggered_by: 'agentCommand',
    execution_mode: modo,
    user_id: usuario.id,
    parametros_entrada: parametrosObj,
    started_at: new Date()
  };

  try {
    // Validar permissões
    const temPermissao = validarPermissoes(usuario, skill);
    if (!temPermissao) {
      return {
        success: false,
        error: 'Permissão negada',
        message: `Você não tem permissão para executar a skill "${skill.display_name}".`
      };
    }

    // Executar função backend correspondente
    const funcaoPrincipal = skill.funcoes_backend[0];
    
    let resultado;
    if (modo === EXECUTION_MODES.DRY_RUN) {
      resultado = await simularExecucao(base44, skill, parametros);
    } else {
      resultado = await base44.asServiceRole.functions.invoke(funcaoPrincipal, parametros);
    }

    // Registrar execução
    const duracao = Date.now() - execucao.started_at.getTime();
    await base44.asServiceRole.entities.SkillExecution.create({
      ...execucao,
      resultado: resultado.data || resultado,
      success: true,
      duration_ms: duracao
    }).catch(() => {});

    // Atualizar performance da skill
    await atualizarPerformanceSkill(base44, skill.id, true, duracao);

    return {
      success: true,
      resultado: resultado.data || resultado,
      skill_executada: skill.display_name,
      modo: modo,
      duracao_ms: duracao
    };

  } catch (error) {
    const duracao = Date.now() - execucao.started_at.getTime();
    
    await base44.asServiceRole.entities.SkillExecution.create({
      ...execucao,
      success: false,
      error_message: error.message,
      duration_ms: duracao
    }).catch(() => {});

    await atualizarPerformanceSkill(base44, skill.id, false, duracao);

    return {
      success: false,
      error: error.message,
      skill_tentada: skill.display_name
    };
  }
}

// ============================================================================
// VALIDAÇÕES E HELPERS
// ============================================================================

function validarPermissoes(usuario, skill) {
  // Admin: acesso total
  if (usuario.role === 'admin') return true;

  // Skills críticas: apenas admin
  if (skill.nivel_risco === RISK_LEVELS.CRITICO) return false;

  // Skills de gestão de dados: gerente/coordenador
  if (skill.categoria === 'gestao_dados') {
    return ['coordenador', 'gerente'].includes(usuario.attendant_role);
  }

  // Demais: permitido
  return true;
}

async function simularExecucao(base44, skill, parametros) {
  // Simula execução sem alterar dados
  return {
    simulacao: true,
    skill: skill.skill_name,
    parametros: parametros,
    estimativa: 'Esta é uma simulação. Nenhum dado foi alterado.',
    proximo_passo: 'Para executar de verdade, use modo "autonomous_safe" ou "copilot".'
  };
}

async function atualizarPerformanceSkill(base44, skillId, sucesso, duracao) {
  try {
    const skill = await base44.asServiceRole.entities.SkillRegistry.get(skillId);
    const perf = skill.performance || {
      total_execucoes: 0,
      total_sucesso: 0,
      taxa_sucesso: 0,
      tempo_medio_ms: 0
    };

    const novoTotal = perf.total_execucoes + 1;
    const novoSucesso = perf.total_sucesso + (sucesso ? 1 : 0);
    const novoTempoMedio = ((perf.tempo_medio_ms * perf.total_execucoes) + duracao) / novoTotal;

    await base44.asServiceRole.entities.SkillRegistry.update(skillId, {
      performance: {
        total_execucoes: novoTotal,
        total_sucesso: novoSucesso,
        taxa_sucesso: (novoSucesso / novoTotal) * 100,
        tempo_medio_ms: Math.round(novoTempoMedio)
      }
    });
  } catch (e) {
    console.warn('[SUPER-AGENTE] Erro ao atualizar performance:', e.message);
  }
}

// ============================================================================
// GERADOR DE PLANO
// ============================================================================

async function gerarPlanoExecucao(base44, comando, skill, usuario) {
  const prompt = `Você é o planejador de execução do Nexus AI.

COMANDO DO USUÁRIO: "${comando.original}"
SKILL IDENTIFICADA: ${skill.display_name}
DESCRIÇÃO: ${skill.descricao}
RISCO: ${skill.nivel_risco}

USUÁRIO: ${usuario.full_name} (${usuario.role}, ${usuario.attendant_role || 'pleno'})

Gere um plano detalhado de execução explicando:
1. O que será feito exatamente
2. Quais dados serão afetados (com estimativa de quantidade)
3. Se a ação é reversível ou irreversível
4. Próximo passo recomendado

Formato: máximo 5 linhas, objetivo e claro.`;

  try {
    const plano = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: prompt,
      model: 'gemini_3_flash'
    });

    return typeof plano === 'string' ? plano : JSON.stringify(plano);
  } catch (e) {
    return `Executar skill "${skill.display_name}" com os parâmetros fornecidos.`;
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const usuario = await base44.auth.me();

    if (!usuario) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { comando_texto, modo, confirmacao } = await req.json();

    // 1. PARSEAR COMANDO
    const comando = parseComando(comando_texto);
    console.log('[SUPER-AGENTE] Comando parseado:', comando);

    // 2. RESOLVER SKILL
    const skill = await resolverSkill(base44, comando);
    
    if (!skill) {
      return Response.json({
        success: false,
        message: 'Nenhuma skill identificada para este comando. Tente reformular ou use o chat livre do Nexus AI.',
        comando_recebido: comando
      });
    }

    console.log('[SUPER-AGENTE] Skill resolvida:', skill.skill_name);

    // 3. DETERMINAR MODO DE EXECUÇÃO
    const modoExecucao = modo || skill.modo_execucao_padrao;

    // 4. VALIDAR CONFIRMAÇÃO (se necessário)
    if (skill.requer_confirmacao && !confirmacao) {
      const plano = await gerarPlanoExecucao(base44, comando, skill, usuario);
      
      return Response.json({
        success: false,
        requer_confirmacao: true,
        frase_confirmacao: skill.frase_confirmacao,
        skill: skill.display_name,
        plano_execucao: plano,
        nivel_risco: skill.nivel_risco,
        message: `⚠️ Esta é uma ação ${skill.nivel_risco === 'critico' ? 'CRÍTICA' : 'de risco'}.\n\n${plano}\n\nPara confirmar, responda exatamente:\n"${skill.frase_confirmacao}"`
      });
    }

    if (skill.requer_confirmacao && confirmacao !== skill.frase_confirmacao) {
      return Response.json({
        success: false,
        message: `❌ Confirmação inválida. Digite exatamente:\n"${skill.frase_confirmacao}"`
      });
    }

    // 5. EXECUTAR SKILL
    const resultado = await executarSkill(base44, skill, comando.parametros, modoExecucao, usuario);

    // 6. FORMATAR RESPOSTA
    if (resultado.success) {
      return Response.json({
        success: true,
        skill_executada: skill.display_name,
        modo: modoExecucao,
        resultado: resultado.resultado,
        duracao_ms: resultado.duracao_ms,
        message: `✅ Skill "${skill.display_name}" executada com sucesso em modo ${modoExecucao}.`
      });
    } else {
      return Response.json({
        success: false,
        skill_tentada: skill.display_name,
        error: resultado.error,
        message: `❌ Erro ao executar "${skill.display_name}": ${resultado.error}`
      });
    }

  } catch (error) {
    console.error('[SUPER-AGENTE] Erro crítico:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});