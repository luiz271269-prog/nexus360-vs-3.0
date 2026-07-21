/**
 * Motor de Lembretes Global - Integrado com Agente Interno
 * Calcula contadores de alertas para cada página do sistema
 * Executado a cada 5min pelo Layout.jsx
 *
 * OTIMIZAÇÃO: as 5 consultas rodam em PARALELO (Promise.all) —
 * tempo total ≈ consulta mais lenta, em vez da soma de todas.
 *
 * FILTROS APLICADOS:
 * - Apenas contatos tipo "lead" e "cliente"
 * - Apenas contatos do usuário logado (vendedor_responsavel)
 * - Admin vê todos os contatos
 */

// 1. Contatos precisando atenção (ContactBehaviorAnalysis)
async function buscarAlertasIA(usuario, base44, now) {
  try {
    const analisesRecentes = await base44.entities.ContactBehaviorAnalysis.filter(
      { ultima_analise: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() } },
      '-ultima_analise',
      200
    );

    const contactIds = [...new Set(analisesRecentes.map(a => a.contact_id))];
    const contatosValidar = await base44.entities.Contact.filter(
      { id: { $in: contactIds } },
      '-created_date',
      300
    );

    const contatosMap = new Map(contatosValidar.map(c => [c.id, c]));

    const analisesValidas = analisesRecentes.filter(analise => {
      const contato = contatosMap.get(analise.contact_id);
      if (!contato) return false;
      if (!['lead', 'cliente'].includes(contato.tipo_contato)) return false;
      if (usuario.role !== 'admin') {
        if (contato.vendedor_responsavel !== usuario.id) return false;
      }
      return true;
    });

    return analisesValidas.filter(analise => {
      if (analise.insights?.alerts && analise.insights.alerts.length > 0) return true;
      if (analise.score_engajamento < 40) return true;
      if (analise.analise_sentimento?.score_sentimento < 40) return true;
      if (analise.segmento_sugerido === 'risco_churn') return true;
      if (analise.segmento_sugerido === 'lead_quente') return true;
      return false;
    }).length;
  } catch (error) {
    console.warn('[MotorLembretes] Erro ao buscar ContactBehaviorAnalysis:', error.message);
    return 0;
  }
}

// 2. Contatos parados (WorkQueueItem > 48h)
async function buscarContatosParados(usuario, base44) {
  try {
    const workQueueItems = await base44.entities.WorkQueueItem.filter(
      { status: { $in: ['open', 'in_progress'] } },
      '-created_date',
      100
    );

    if (usuario.role === 'admin') return workQueueItems.length;
    return workQueueItems.filter(item =>
      item.owner_user_id === usuario.id ||
      item.owner_sector_id === usuario.attendant_sector ||
      !item.owner_user_id
    ).length;
  } catch (error) {
    console.warn('[MotorLembretes] Erro ao buscar WorkQueueItem:', error.message);
    return 0;
  }
}

// 3. Tarefas críticas/altas (TarefaInteligente)
async function buscarTarefas(usuario, base44) {
  try {
    const tarefas = await base44.entities.TarefaInteligente.filter(
      { status: 'pendente' },
      '-created_date',
      100
    );

    const tarefasFiltradas = usuario.role === 'admin'
      ? tarefas
      : tarefas.filter(t =>
          t.vendedor_responsavel === usuario.full_name ||
          t.contexto_ia?.atendente_user_id === usuario.id ||
          t.responsavel_id === usuario.id
        );

    return {
      tarefasCriticas: tarefasFiltradas.filter(t => t.prioridade === 'critica').length,
      tarefasAltas: tarefasFiltradas.filter(t => t.prioridade === 'alta').length,
    };
  } catch (error) {
    console.warn('[MotorLembretes] Erro ao buscar TarefaInteligente:', error.message);
    return { tarefasCriticas: 0, tarefasAltas: 0 };
  }
}

// 4. Orçamentos urgentes (vencendo em 3 dias)
async function buscarOrcamentosUrgentes(usuario, base44, now) {
  try {
    const orcamentos = await base44.entities.Orcamento.filter(
      {
        status: { $in: ['enviado', 'negociando'] },
        data_vencimento: { $lte: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString() }
      },
      'data_vencimento',
      50
    );

    return usuario.role === 'admin'
      ? orcamentos.length
      : orcamentos.filter(o => o.vendedor === usuario.full_name).length;
  } catch (error) {
    console.warn('[MotorLembretes] Erro ao buscar Orcamento:', error.message);
    return 0;
  }
}

// 5. Threads não atribuídas (apenas managers/admin)
async function buscarThreadsNaoAtribuidas(usuario, base44) {
  try {
    if (usuario.role !== 'admin' && usuario.attendant_role !== 'gerente' && usuario.attendant_role !== 'coordenador') {
      return 0;
    }
    const threads = await base44.entities.MessageThread.filter(
      {
        status: 'aberta',
        assigned_user_id: null,
        thread_type: 'contact_external'
      },
      '-last_message_at',
      100
    );
    return threads.length;
  } catch (error) {
    console.warn('[MotorLembretes] Erro ao buscar threads não atribuídas:', error.message);
    return 0;
  }
}

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
    // ✅ PARALELO: todas as consultas disparam ao mesmo tempo.
    // Cada bloco tem seu próprio try/catch interno — uma falha não derruba as outras.
    const [
      contatosComAlertasIA,
      contatosParados,
      { tarefasCriticas, tarefasAltas },
      orcamentosUrgentes,
      threadsNaoAtribuidas,
    ] = await Promise.all([
      buscarAlertasIA(usuario, base44, now),
      buscarContatosParados(usuario, base44),
      buscarTarefas(usuario, base44),
      buscarOrcamentosUrgentes(usuario, base44, now),
      buscarThreadsNaoAtribuidas(usuario, base44),
    ]);

    // Agrupar por página
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

    console.log('[MotorLembretes] ✅ Contadores calculados (paralelo):', contadores);

    return contadores;
  } catch (error) {
    console.error('[MotorLembretes] ❌ Erro crítico:', error);
    return {};
  }
}