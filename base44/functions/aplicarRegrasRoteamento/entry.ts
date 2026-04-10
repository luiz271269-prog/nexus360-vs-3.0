import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * aplicarRegrasRoteamento
 * Recebe texto de uma mensagem, aplica as RegrasIntencao ativas (keyword matching)
 * e retorna o setor/atendente/playbook correspondente.
 * Também pode atualizar o sector_id da thread automaticamente.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message_text, thread_id, auto_apply = true } = await req.json();

    if (!message_text) {
      return Response.json({ error: 'message_text é obrigatório' }, { status: 400 });
    }

    // Carregar todas as regras ativas, ordenadas por prioridade
    const regras = await base44.asServiceRole.entities.RegrasIntencao.filter(
      { ativo: true },
      'prioridade',
      50
    );

    if (!regras || regras.length === 0) {
      return Response.json({ success: true, matched: false, reason: 'Nenhuma regra ativa configurada' });
    }

    const textoNormalizado = message_text.toLowerCase().trim();

    let regraAtivada = null;

    for (const regra of regras) {
      const termos = regra.termos_chave || [];
      if (termos.length === 0) continue;

      const isCaseSensitive = regra.case_sensitive === true;
      const matchType = regra.match_type || 'any';

      const texto = isCaseSensitive ? message_text : textoNormalizado;
      const termosNormalizados = termos.map(t => isCaseSensitive ? t : t.toLowerCase().trim());

      let matched = false;

      if (matchType === 'exact') {
        // Frase exata deve estar contida no texto
        matched = termosNormalizados.some(t => texto.includes(t));
      } else if (matchType === 'all') {
        // Todas as palavras devem estar presentes
        matched = termosNormalizados.every(t => texto.includes(t));
      } else {
        // any (padrão): qualquer palavra basta
        matched = termosNormalizados.some(t => texto.includes(t));
      }

      if (matched) {
        regraAtivada = regra;
        break; // Regras ordenadas por prioridade — primeira match vence
      }
    }

    if (!regraAtivada) {
      return Response.json({ success: true, matched: false, reason: 'Nenhuma regra correspondeu ao texto' });
    }

    console.log(`[REGRAS-ROTEAMENTO] ✅ Regra ativada: "${regraAtivada.nome_regra}" → setor: ${regraAtivada.setor_alvo}`);

    // Atualizar métricas da regra (fire-and-forget)
    const metricas = regraAtivada.metricas || {};
    base44.asServiceRole.entities.RegrasIntencao.update(regraAtivada.id, {
      metricas: {
        ...metricas,
        total_matches: (metricas.total_matches || 0) + 1,
        total_ativacoes: (metricas.total_ativacoes || 0) + 1,
        ultima_ativacao: new Date().toISOString()
      }
    }).catch(() => {});

    // Aplicar o roteamento na thread automaticamente
    if (auto_apply && thread_id) {
      const updateData = { sector_id: regraAtivada.setor_alvo };

      if (regraAtivada.atendente_especifico_id) {
        updateData.assigned_user_id = regraAtivada.atendente_especifico_id;
      }

      await base44.asServiceRole.entities.MessageThread.update(thread_id, updateData);

      console.log(`[REGRAS-ROTEAMENTO] 🎯 Thread ${thread_id} → setor: ${regraAtivada.setor_alvo}`);

      // Delegar ao roteamento ponderado para atribuição ao atendente certo
      if (!regraAtivada.atendente_especifico_id) {
        base44.asServiceRole.functions.invoke('roteamentoInteligente', {
          thread_id,
          sector: regraAtivada.setor_alvo
        }).catch(e => console.warn('[REGRAS-ROTEAMENTO] roteamento ponderado falhou:', e.message));
      }

      // Log de automação
      await base44.asServiceRole.entities.AutomationLog.create({
        acao: 'roteamento_por_palavras_chave',
        thread_id,
        resultado: 'sucesso',
        timestamp: new Date().toISOString(),
        detalhes: {
          regra_id: regraAtivada.id,
          regra_nome: regraAtivada.nome_regra,
          setor_destino: regraAtivada.setor_alvo,
          match_type: regraAtivada.match_type,
          termos_ativados: regraAtivada.termos_chave,
          playbook_id: regraAtivada.playbook_especifico_id || null
        },
        origem: 'aplicarRegrasRoteamento'
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      matched: true,
      regra: {
        id: regraAtivada.id,
        nome: regraAtivada.nome_regra,
        setor_alvo: regraAtivada.setor_alvo,
        playbook_especifico_id: regraAtivada.playbook_especifico_id || null,
        atendente_especifico_id: regraAtivada.atendente_especifico_id || null,
        match_type: regraAtivada.match_type
      },
      aplicado: auto_apply && !!thread_id
    });

  } catch (error) {
    console.error('[REGRAS-ROTEAMENTO] ❌ Erro:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});