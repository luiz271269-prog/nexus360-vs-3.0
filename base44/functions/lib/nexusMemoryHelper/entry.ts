// Deduplicação universal para NexusMemory
// Regra: nunca gravar duplicata no mesmo período para mesmo owner_user_id + tipo

export async function salvarMemoriaSemDuplicata(base44, { owner_user_id, tipo, conteudo, contexto = {}, score_utilidade = 0 }) {
  try {
    // ✅ Determinar período de verificação baseado no tipo
    let dataLimite = null;
    let filtroExtra = {};

    if (tipo === 'sessao') {
      // Sessão: checar últimas 2 horas
      dataLimite = new Date(Date.now() - 2 * 60 * 60 * 1000);
    } else if (tipo === 'aprendizado_semanal') {
      // Aprendizado: checar semana atual (segunda-feira ao domingo)
      const agora = new Date();
      dataLimite = new Date(agora);
      dataLimite.setDate(agora.getDate() - agora.getDay() + 1); // início da semana (segunda)
      dataLimite.setHours(0, 0, 0, 0);
    } else {
      // Outros tipos: 24h padrão
      dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // ✅ Buscar registros duplicados
    const registrosExistentes = await base44.asServiceRole.entities.NexusMemory.filter({
      owner_user_id,
      tipo,
      created_date: { $gte: dataLimite.toISOString() }
    }, '-created_date', 10).catch(() => []);

    // ✅ Se já existe, verificar se é idêntico
    if (registrosExistentes.length > 0) {
      const ultimoRegistro = registrosExistentes[0];
      
      // Comparação de conteúdo
      const conteudoIgual = ultimoRegistro.conteudo === conteudo;
      const contextosIguais = JSON.stringify(ultimoRegistro.contexto) === JSON.stringify(contexto);

      if (conteudoIgual && contextosIguais) {
        console.log(`[NEXUS-MEMORY] ⏭️ Duplicata detectada — pulando gravação (${tipo})`);
        return {
          gravado: false,
          motivo: `Registro idêntico já existe (criado ${Math.round((Date.now() - new Date(ultimoRegistro.created_date)) / (1000 * 60))}min atrás)`,
          registro_existente_id: ultimoRegistro.id
        };
      }

      // Para aprendizado_semanal: NUNCA gravar 2 na mesma semana
      if (tipo === 'aprendizado_semanal') {
        console.log(`[NEXUS-MEMORY] ⏭️ Aprendizado_semanal já existe para esta semana — pulando`);
        return {
          gravado: false,
          motivo: 'Aprendizado semanal já registrado para semana atual',
          registro_existente_id: ultimoRegistro.id
        };
      }
    }

    // ✅ Se passou todas as verificações, criar novo registro
    const novoRegistro = await base44.asServiceRole.entities.NexusMemory.create({
      owner_user_id,
      tipo,
      conteudo,
      contexto,
      score_utilidade,
      ultima_acao: tipo === 'sessao' ? 'sessao_criada' : 'aprendizado_registrado'
    });

    console.log(`[NEXUS-MEMORY] ✅ Registro gravado (${tipo})`);
    return {
      gravado: true,
      motivo: 'Novo registro criado',
      registro_id: novoRegistro.id
    };

  } catch (error) {
    console.error(`[NEXUS-MEMORY] ❌ Erro ao salvar: ${error.message}`);
    return {
      gravado: false,
      motivo: `Erro: ${error.message}`
    };
  }
}