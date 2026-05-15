import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎯 SKILL ÚNICA — NÃO ATRIBUÍDAS (SSOT)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Centraliza TODA a lógica de "thread realmente não atribuída".
 * Consumida por: Kanban, Contador, Comunicacao.jsx, qualquer outra tela.
 *
 * REGRA DE NEGÓCIO:
 *
 * NÃO conta como "não atribuída":
 *   • Threads internas (team_internal, sector_group)
 *   • Threads sem contact_id
 *   • Threads com assigned_user_* preenchido
 *   • Threads sem last_inbound_at (outbound puro)
 *   • Contato FIDELIZADO (atendente_fidelizado_* ou vendedor_responsavel)
 *   • Thread já atendida há <3 dias (último atendente do histórico = dono implícito)
 *   • Thread já atendida e cliente NÃO voltou (encerrada)
 *
 * CONTA como "não atribuída":
 *   • CASO A: nunca foi atendida (sem histórico nem last_human_message_at)
 *   • CASO B: cliente voltou após último atendimento humano + >3 dias OU sem histórico
 *
 * ─────────────────────────────────────────────────────────────────
 * INPUT:
 *   { modo: 'count' | 'list', filtros?: { integration_id, sector } }
 * OUTPUT:
 *   { success, total, nao_atribuidas, por_setor, por_integracao, threads? }
 * ─────────────────────────────────────────────────────────────────
 */

const JANELA_DONO_IMPLICITO_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias

/**
 * Verifica se o contato é fidelizado a algum atendente.
 * Fidelizado = tem dono fixo, NUNCA cai em "não atribuídas".
 */
function contatoEhFidelizado(contato) {
  if (!contato) return false;
  return Boolean(
    contato.atendente_fidelizado_vendas ||
    contato.atendente_fidelizado_assistencia ||
    contato.atendente_fidelizado_financeiro ||
    contato.atendente_fidelizado_fornecedor ||
    contato.vendedor_responsavel ||
    contato.is_cliente_fidelizado === true
  );
}

/**
 * Aplica a regra completa de "thread realmente não atribuída".
 */
function isThreadRealmenteNaoAtribuida(thread, contato) {
  if (!thread) return false;

  // Threads internas nunca entram
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return false;
  }

  // Sem contato vinculado
  if (!thread.contact_id) return false;

  // Com atendente atribuído → não é "não atribuída"
  if (thread.assigned_user_id || thread.assigned_user_name || thread.assigned_user_email) {
    return false;
  }

  // Contato fidelizado → tem dono implícito, nunca é "não atribuída"
  if (contatoEhFidelizado(contato)) return false;

  // Sem inbound real → ignorar (outbound puro: massa/promoção)
  if (!thread.last_inbound_at) return false;

  const lastInboundMs = new Date(thread.last_inbound_at).getTime();
  const lastHumanMs = thread.last_human_message_at
    ? new Date(thread.last_human_message_at).getTime()
    : 0;
  const jaTeveAtendente = Array.isArray(thread.atendentes_historico)
    && thread.atendentes_historico.length > 0;

  // CASO A: nunca foi atendida → mostrar
  if (!jaTeveAtendente && !lastHumanMs) return true;

  // CASO B: cliente voltou depois do último atendimento humano
  if (lastHumanMs > 0 && lastInboundMs > lastHumanMs) {
    const tempoDesdeUltimoHumano = Date.now() - lastHumanMs;
    // Se atendimento foi recente (<3d) E já teve atendente → último atendente é dono implícito
    if (jaTeveAtendente && tempoDesdeUltimoHumano < JANELA_DONO_IMPLICITO_MS) {
      return false;
    }
    return true;
  }

  // CASO C: já atendida, cliente não voltou → encerrada
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const modo = body.modo === 'list' ? 'list' : 'count';
    const filtros = body.filtros || {};

    // ───────────────────────────────────────────────────────────────
    // 1. BUSCAR THREADS RECENTES (limit alto para cobrir o pool aberto)
    // ───────────────────────────────────────────────────────────────
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 500);

    // Filtro inicial: apenas threads externas abertas
    const threadsCandidatas = todasThreads.filter(t => {
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') return false;
      if (!t.contact_id) return false;
      const statusAberto = !t.status || t.status === 'aberta' || t.status === 'aguardando_cliente';
      if (!statusAberto) return false;
      if (t.assigned_user_id || t.assigned_user_name || t.assigned_user_email) return false;
      if (!t.last_inbound_at) return false;
      return true;
    });

    // ───────────────────────────────────────────────────────────────
    // 2. HIDRATAR CONTATOS EM BULK (1 query)
    // ───────────────────────────────────────────────────────────────
    const contactIds = [...new Set(threadsCandidatas.map(t => t.contact_id).filter(Boolean))];
    let contatosMap = {};

    if (contactIds.length > 0) {
      // Buscar contatos em chunks de 100 (limite seguro)
      const chunks = [];
      for (let i = 0; i < contactIds.length; i += 100) {
        chunks.push(contactIds.slice(i, i + 100));
      }
      for (const chunk of chunks) {
        const contatos = await base44.asServiceRole.entities.Contact.filter({ id: { $in: chunk } }, '-updated_date', 500);
        contatos.forEach(c => { contatosMap[c.id] = c; });
      }
    }

    // ───────────────────────────────────────────────────────────────
    // 3. APLICAR REGRA DE NEGÓCIO (com contato hidratado)
    // ───────────────────────────────────────────────────────────────
    const threadsNaoAtribuidas = threadsCandidatas.filter(t =>
      isThreadRealmenteNaoAtribuida(t, contatosMap[t.contact_id])
    );

    // ───────────────────────────────────────────────────────────────
    // 4. APLICAR FILTROS DE PERMISSÃO DO USUÁRIO
    // ───────────────────────────────────────────────────────────────
    const isAdmin = user.role === 'admin';
    const perms = user.permissoes_visualizacao || {};
    const podeVerTodas = perms.pode_ver_todas_conversas === true;
    const podeVerNaoAtribuidas = perms.pode_ver_nao_atribuidas !== false;

    if (!isAdmin && !podeVerTodas && !podeVerNaoAtribuidas) {
      return Response.json({
        success: true,
        total: 0, nao_atribuidas: 0,
        por_setor: [], por_integracao: [],
        threads: [],
        mensagem: 'Sem permissão para ver não atribuídas'
      });
    }

    const passaPermissao = (thread) => {
      if (isAdmin || podeVerTodas) return true;

      const integracoesVisiveis = perms.integracoes_visiveis || [];
      if (integracoesVisiveis.length > 0) {
        const ok = integracoesVisiveis.some(i =>
          String(i).toLowerCase() === String(thread.whatsapp_integration_id || '').toLowerCase()
        );
        if (!ok) return false;
      }

      const conexoesVisiveis = perms.conexoes_visiveis || [];
      if (conexoesVisiveis.length > 0) {
        const ok = conexoesVisiveis.some(c =>
          String(c).toLowerCase() === String(thread.conexao_id || '').toLowerCase()
        );
        if (!ok) return false;
      }

      const setoresVisiveis = perms.setores_visiveis || [];
      if (setoresVisiveis.length > 0) {
        const ok = setoresVisiveis.some(s =>
          String(s).toLowerCase() === String(thread.sector_id || thread.setor || '').toLowerCase()
        );
        if (!ok) return false;
      }
      return true;
    };

    let threadsVisiveis = threadsNaoAtribuidas.filter(passaPermissao);

    // Filtros opcionais do request
    if (filtros.integration_id) {
      threadsVisiveis = threadsVisiveis.filter(t =>
        String(t.whatsapp_integration_id) === String(filtros.integration_id)
      );
    }
    if (filtros.sector) {
      threadsVisiveis = threadsVisiveis.filter(t =>
        String(t.sector_id || t.setor) === String(filtros.sector)
      );
    }

    // ───────────────────────────────────────────────────────────────
    // 5. AGRUPAMENTOS (breakdown)
    // ───────────────────────────────────────────────────────────────
    const porSetorMap = {};
    const porIntegracaoMap = {};
    threadsVisiveis.forEach(t => {
      const setor = t.sector_id || t.setor || 'sem_setor';
      const integ = t.whatsapp_integration_id || 'sem_integracao';
      porSetorMap[setor] = (porSetorMap[setor] || 0) + 1;
      porIntegracaoMap[integ] = (porIntegracaoMap[integ] || 0) + 1;
    });

    const por_setor = Object.entries(porSetorMap).map(([sector_id, total]) => ({
      sector_id, total, nao_atribuidas: total, travadas: 0
    }));
    const por_integracao = Object.entries(porIntegracaoMap).map(([integration_id, total]) => ({
      integration_id, total
    }));

    // ───────────────────────────────────────────────────────────────
    // 6. RESPOSTA
    // ───────────────────────────────────────────────────────────────
    const payload = {
      success: true,
      total: threadsVisiveis.length,
      nao_atribuidas: threadsVisiveis.length,
      travadas: 0,
      por_setor,
      por_integracao,
      timestamp: new Date().toISOString()
    };

    if (modo === 'list') {
      // Inclui o contato hidratado para a UI
      payload.threads = threadsVisiveis.map(t => ({
        ...t,
        contato: contatosMap[t.contact_id] || null
      }));
    }

    return Response.json(payload);

  } catch (error) {
    console.error('[skillNaoAtribuidas] Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      total: 0, nao_atribuidas: 0,
      por_setor: [], por_integracao: []
    }, { status: 500 });
  }
});