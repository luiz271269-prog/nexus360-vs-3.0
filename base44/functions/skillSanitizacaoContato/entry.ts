import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ════════════════════════════════════════════════════════════════════════
 * SKILL: SANITIZAÇÃO FORENSE DE CONTATO
 * ════════════════════════════════════════════════════════════════════════
 *
 * Orquestrador único que executa em sequência todas as etapas de
 * saneamento de um contato (deduplicação, mensagens órfãs, threads,
 * canonical, etc). Substitui ~220 linhas de orquestração no frontend.
 *
 * Modos:
 *   - 'diagnostico' : apenas analisa e retorna o que faria
 *   - 'correcao'    : analisa + executa todas as fases
 *
 * Fases (executadas em ordem):
 *   FASE 1 — Diagnóstico inicial (scan)
 *   FASE 2 — Deduplicar mensagens (mesmo whatsapp_message_id)
 *   FASE 3 — Sincronizar mensagens órfãs (3 estratégias)
 *   FASE 4 — Migrar threads órfãs (whatsapp_integration_id)
 *   FASE 5 — Saneamento do contato principal (canonical + tags)
 *   FASE 6 — Mesclar duplicatas via mergeContacts
 *   FASE 7 — Validação final (re-scan)
 *
 * Payload:
 *   { contact_id: string, modo?: 'diagnostico'|'correcao' (default), periodo_horas?: number }
 *
 * Retorna:
 *   { success, modo, contato, fases: {1..7}, resumo, duracao_ms }
 *
 * v1.0.0
 */

const VERSION = 'v1.0.0';

Deno.serve(async (req) => {
  const inicio = Date.now();
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error: ' + e.message }, { status: 500, headers });
  }

  let payload = {};
  try { payload = await req.json(); } catch {}

  const { contact_id, modo = 'correcao', periodo_horas = 72, internal_caller = false } = payload;

  // Auth: aceita user logado OU invocação interna (entity hooks, automações)
  const user = await base44.auth.me().catch(() => null);
  if (!user && !internal_caller) {
    return Response.json({ success: false, error: 'Não autenticado' }, { status: 401, headers });
  }

  if (!contact_id) {
    return Response.json({ success: false, error: 'contact_id é obrigatório' }, { status: 400, headers });
  }

  console.log(`[skillSanitizacao ${VERSION}] ▶️ INICIANDO contato=${contact_id} modo=${modo}`);

  const resultado = {
    success: false,
    modo,
    contato: null,
    fases: {
      fase1_diagnostico_inicial: null,
      fase2_dedup_mensagens: null,
      fase3_sync_orfas: null,
      fase4_threads_orfas: null,
      fase5_saneamento_contato: null,
      fase6_merge_duplicatas: null,
      fase7_validacao_final: null
    },
    resumo: {
      duplicatas_removidas: 0,
      mensagens_dedup: 0,
      mensagens_revinculadas: 0,
      threads_corrigidas: 0,
      canonical_corrigido: false,
      tags_limpas: 0
    },
    erros: [],
    duracao_ms: 0,
    version: VERSION
  };

  try {
    // ────────────────────────────────────────────────────────────
    // FASE 1 — Diagnóstico inicial (carrega contato e duplicatas)
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 1 — Diagnóstico inicial');

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contato) {
      return Response.json({ success: false, error: 'Contato não encontrado' }, { status: 404, headers });
    }

    resultado.contato = {
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      telefone_canonico: contato.telefone_canonico
    };

    // Buscar duplicatas por telefone E telefone_canonico
    const telefoneEsperado = (contato.telefone || '').replace(/\D/g, '');
    const duplicatas = [];

    if (contato.telefone) {
      const porTelefone = await base44.asServiceRole.entities.Contact.filter({
        telefone: contato.telefone
      });
      for (const c of porTelefone || []) {
        if (c.id !== contact_id && !duplicatas.find(d => d.id === c.id)) {
          duplicatas.push(c);
        }
      }
    }

    if (telefoneEsperado) {
      const porCanonico = await base44.asServiceRole.entities.Contact.filter({
        telefone_canonico: telefoneEsperado
      });
      for (const c of porCanonico || []) {
        if (c.id !== contact_id && !duplicatas.find(d => d.id === c.id)) {
          duplicatas.push(c);
        }
      }
    }

    resultado.fases.fase1_diagnostico_inicial = {
      contato_carregado: true,
      duplicatas_encontradas: duplicatas.length,
      duplicatas_ids: duplicatas.map(d => ({ id: d.id, nome: d.nome }))
    };

    console.log(`[skillSanitizacao] FASE 1 ✅ ${duplicatas.length} duplicata(s) encontrada(s)`);

    // ────────────────────────────────────────────────────────────
    // FASE 2 — Deduplicar mensagens (mesmo whatsapp_message_id)
    // [INLINE — service_role direto, sem invoke HTTP]
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 2 — Deduplicar mensagens');
    try {
      const threadsContato = await base44.asServiceRole.entities.MessageThread.filter({ contact_id });
      const threadIds = (threadsContato || []).map(t => t.id);

      let mensagensAnalisadas = 0;
      let gruposDuplicados = 0;
      let mensagensDeletadas = 0;

      if (threadIds.length > 0) {
        let todasMensagens = [];
        for (const tid of threadIds) {
          const msgs = await base44.asServiceRole.entities.Message.filter(
            { thread_id: tid },
            '-created_date',
            2000
          );
          todasMensagens = todasMensagens.concat(msgs || []);
        }
        mensagensAnalisadas = todasMensagens.length;

        // Agrupar por whatsapp_message_id
        const grupos = new Map();
        for (const msg of todasMensagens) {
          const wid = msg.whatsapp_message_id;
          if (!wid) continue;
          if (!grupos.has(wid)) grupos.set(wid, []);
          grupos.get(wid).push(msg);
        }

        // Detectar e deletar duplicatas (mantém a mais antiga)
        for (const [, msgs] of grupos.entries()) {
          if (msgs.length < 2) continue;
          gruposDuplicados++;
          msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
          const deletar = msgs.slice(1);

          if (modo === 'correcao') {
            for (const dup of deletar) {
              try {
                await base44.asServiceRole.entities.Message.delete(dup.id);
                mensagensDeletadas++;
              } catch (err) {
                console.warn(`[FASE 2] Erro ao deletar ${dup.id}:`, err.message);
              }
            }
          }
        }
      }

      resultado.fases.fase2_dedup_mensagens = {
        success: true,
        threads_analisadas: threadIds.length,
        mensagens_analisadas: mensagensAnalisadas,
        grupos_duplicados: gruposDuplicados,
        mensagens_deletadas: mensagensDeletadas
      };
      resultado.resumo.mensagens_dedup = mensagensDeletadas;
      console.log(`[skillSanitizacao] FASE 2 ✅ ${mensagensDeletadas} msg(s) duplicada(s) removida(s)`);
    } catch (e) {
      console.warn('[skillSanitizacao] FASE 2 ⚠️', e.message);
      resultado.erros.push({ fase: 2, erro: e.message });
    }

    // ────────────────────────────────────────────────────────────
    // FASE 3 — Sincronizar mensagens órfãs
    // [INLINE — service_role direto, estratégias 1+2]
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 3 — Sincronizar mensagens órfãs');
    try {
      const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id,
        thread_type: 'contact_external'
      });

      // Determinar thread canônica
      let threadCanonica = (todasThreads || []).find(t => t.is_canonical === true && t.status !== 'merged');
      if (!threadCanonica) {
        threadCanonica = (todasThreads || [])
          .filter(t => t.status !== 'merged')
          .sort((a, b) => (b.total_mensagens || 0) - (a.total_mensagens || 0))[0];
      }

      let threadsSuspeitas = 0;
      let mensagensOrfasEncontradas = 0;
      let mensagensRevinculadas = 0;

      if (threadCanonica) {
        // E1: mensagens em threads não-canônicas/merged
        const threadsSecundarias = (todasThreads || []).filter(t => t.id !== threadCanonica.id);
        const mensagensPreasasIds = new Set();

        for (const threadSec of threadsSecundarias) {
          const msgsPresas = await base44.asServiceRole.entities.Message.filter({
            thread_id: threadSec.id
          });
          if (!msgsPresas || msgsPresas.length === 0) continue;

          threadsSuspeitas++;
          mensagensOrfasEncontradas += msgsPresas.length;
          for (const m of msgsPresas) mensagensPreasasIds.add(m.id);

          if (modo === 'correcao') {
            for (const msg of msgsPresas) {
              try {
                await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
                mensagensRevinculadas++;
              } catch (err) {
                console.warn(`[FASE 3 E1] Erro ${msg.id}:`, err.message);
              }
            }
            if (threadSec.status !== 'merged') {
              try {
                await base44.asServiceRole.entities.MessageThread.update(threadSec.id, {
                  status: 'merged',
                  merged_into: threadCanonica.id,
                  is_canonical: false
                });
              } catch (e) {}
            }
          }
        }

        // E2: mensagens por sender_id fora da canônica
        const msgsPorSender = await base44.asServiceRole.entities.Message.filter({
          sender_id: contact_id,
          sender_type: 'contact'
        });
        const msgsSenderErrado = (msgsPorSender || []).filter(
          m => m.thread_id !== threadCanonica.id && !mensagensPreasasIds.has(m.id)
        );

        if (msgsSenderErrado.length > 0) {
          mensagensOrfasEncontradas += msgsSenderErrado.length;
          if (modo === 'correcao') {
            for (const msg of msgsSenderErrado) {
              try {
                await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
                mensagensRevinculadas++;
              } catch (err) {
                console.warn(`[FASE 3 E2] Erro ${msg.id}:`, err.message);
              }
            }
          }
        }

        // Atualizar contadores da canônica
        if (modo === 'correcao' && mensagensRevinculadas > 0) {
          try {
            const todasMsgs = await base44.asServiceRole.entities.Message.filter({
              thread_id: threadCanonica.id
            });
            const ultima = (todasMsgs || []).sort((a, b) =>
              new Date(b.created_date) - new Date(a.created_date)
            )[0];
            const upd = { total_mensagens: todasMsgs?.length || 0, is_canonical: true };
            if (ultima?.sent_at || ultima?.created_date) {
              upd.last_message_at = ultima.sent_at || ultima.created_date;
            }
            await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, upd);
          } catch (e) {
            console.warn('[FASE 3] Erro ao atualizar canônica:', e.message);
          }
        }
      }

      resultado.fases.fase3_sync_orfas = {
        success: true,
        thread_canonica_id: threadCanonica?.id || null,
        threads_suspeitas: threadsSuspeitas,
        mensagens_orfas: mensagensOrfasEncontradas,
        mensagens_revinculadas: mensagensRevinculadas
      };
      resultado.resumo.mensagens_revinculadas = mensagensRevinculadas;
      console.log(`[skillSanitizacao] FASE 3 ✅ ${mensagensRevinculadas} msg(s) revinculada(s)`);
    } catch (e) {
      console.warn('[skillSanitizacao] FASE 3 ⚠️', e.message);
      resultado.erros.push({ fase: 3, erro: e.message });
    }

    // ────────────────────────────────────────────────────────────
    // FASE 4 — Threads órfãs (whatsapp_integration_id desatualizado)
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 4 — Threads órfãs');
    try {
      const threadsContato = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id,
        thread_type: 'contact_external'
      });

      let threadsCorrigidas = 0;
      for (const thread of threadsContato || []) {
        if (thread.status === 'merged') continue;

        // Se thread sem integração ou integração diferente da última msg
        const ultimaMsg = await base44.asServiceRole.entities.Message.filter(
          { thread_id: thread.id, sender_type: 'contact' },
          '-sent_at',
          1
        );
        const integracaoMsg = ultimaMsg?.[0]?.metadata?.whatsapp_integration_id;

        if (integracaoMsg && integracaoMsg !== thread.whatsapp_integration_id) {
          if (modo === 'correcao') {
            const historicoAtual = thread.origin_integration_ids || [];
            const novoHistorico = [...new Set([...historicoAtual, integracaoMsg])];
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              whatsapp_integration_id: integracaoMsg,
              origin_integration_ids: novoHistorico
            });
          }
          threadsCorrigidas++;
        } else if (!thread.whatsapp_integration_id && integracaoMsg) {
          if (modo === 'correcao') {
            await base44.asServiceRole.entities.MessageThread.update(thread.id, {
              whatsapp_integration_id: integracaoMsg,
              origin_integration_ids: [integracaoMsg]
            });
          }
          threadsCorrigidas++;
        }
      }

      resultado.fases.fase4_threads_orfas = {
        success: true,
        threads_analisadas: threadsContato?.length || 0,
        threads_corrigidas: threadsCorrigidas
      };
      resultado.resumo.threads_corrigidas = threadsCorrigidas;
      console.log(`[skillSanitizacao] FASE 4 ✅ ${threadsCorrigidas} thread(s) com integração corrigida`);
    } catch (e) {
      console.warn('[skillSanitizacao] FASE 4 ⚠️', e.message);
      resultado.erros.push({ fase: 4, erro: e.message });
    }

    // ────────────────────────────────────────────────────────────
    // FASE 5 — Saneamento do contato (canonical + tags merged/duplicata)
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 5 — Saneamento do contato');
    try {
      const update = {};
      const canonicoAtual = contato.telefone_canonico || '';
      const canonicoCorrompido = canonicoAtual.includes('MERGED_');
      const canonicoErrado = !canonicoCorrompido && telefoneEsperado && canonicoAtual !== telefoneEsperado;

      if ((canonicoCorrompido || canonicoErrado || !canonicoAtual) && telefoneEsperado) {
        update.telefone_canonico = telefoneEsperado;
        resultado.resumo.canonical_corrigido = true;
      }

      const tags = contato.tags || [];
      const tagsMergedCount = tags.filter(t => t === 'merged' || t === 'duplicata').length;
      const tagsAcumuladas = tags.length > 10;

      if (tagsMergedCount > 0 || tagsAcumuladas) {
        const tagsLimpas = [...new Set(tags.filter(t => t !== 'merged' && t !== 'duplicata'))];
        update.tags = tagsLimpas;
        resultado.resumo.tags_limpas = tags.length - tagsLimpas.length;
      }

      if (Object.keys(update).length > 0 && modo === 'correcao') {
        await base44.asServiceRole.entities.Contact.update(contact_id, update);
      }

      resultado.fases.fase5_saneamento_contato = {
        success: true,
        canonical_corrigido: !!update.telefone_canonico,
        canonical_antes: canonicoAtual,
        canonical_depois: update.telefone_canonico || canonicoAtual,
        tags_removidas: resultado.resumo.tags_limpas,
        aplicado: modo === 'correcao'
      };
      console.log(`[skillSanitizacao] FASE 5 ✅ canonical=${!!update.telefone_canonico} tags_removidas=${resultado.resumo.tags_limpas}`);
    } catch (e) {
      console.warn('[skillSanitizacao] FASE 5 ⚠️', e.message);
      resultado.erros.push({ fase: 5, erro: e.message });
    }

    // ────────────────────────────────────────────────────────────
    // FASE 6 — Mesclar duplicatas via mergeContacts
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 6 — Mesclar duplicatas');
    if (duplicatas.length > 0 && modo === 'correcao') {
      try {
        // Escolher mestre: o contato passado como parâmetro é o mestre
        const r = await base44.asServiceRole.functions.invoke('mergeContacts', {
          masterContactId: contact_id,
          duplicateContactIds: duplicatas.map(d => d.id)
        });
        const data = r?.data || r;
        resultado.fases.fase6_merge_duplicatas = {
          success: data?.success !== false,
          stats: data?.stats || null
        };
        resultado.resumo.duplicatas_removidas = data?.stats?.duplicatasProcessadas || 0;
        console.log(`[skillSanitizacao] FASE 6 ✅ ${data?.stats?.duplicatasProcessadas || 0} duplicata(s) merged`);
      } catch (e) {
        console.warn('[skillSanitizacao] FASE 6 ⚠️', e.message);
        resultado.erros.push({ fase: 6, erro: e.message });
      }
    } else {
      resultado.fases.fase6_merge_duplicatas = {
        success: true,
        skipped: true,
        motivo: duplicatas.length === 0 ? 'sem_duplicatas' : 'modo_diagnostico'
      };
    }

    // ────────────────────────────────────────────────────────────
    // FASE 7 — Validação final (re-scan)
    // ────────────────────────────────────────────────────────────
    console.log('[skillSanitizacao] FASE 7 — Validação final');
    try {
      const contatoFinal = await base44.asServiceRole.entities.Contact.get(contact_id);
      const threadsFinal = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id,
        status: { $ne: 'merged' }
      });

      const duplicatasFinais = telefoneEsperado
        ? (await base44.asServiceRole.entities.Contact.filter({ telefone_canonico: telefoneEsperado }))
            .filter(c => c.id !== contact_id)
        : [];

      resultado.fases.fase7_validacao_final = {
        success: true,
        contato_canonical_final: contatoFinal?.telefone_canonico,
        threads_ativas: threadsFinal?.length || 0,
        duplicatas_residuais: duplicatasFinais.length,
        saudavel: duplicatasFinais.length === 0 &&
                  contatoFinal?.telefone_canonico === telefoneEsperado &&
                  !(contatoFinal?.telefone_canonico || '').includes('MERGED_')
      };
      console.log(`[skillSanitizacao] FASE 7 ✅ saudavel=${resultado.fases.fase7_validacao_final.saudavel}`);
    } catch (e) {
      console.warn('[skillSanitizacao] FASE 7 ⚠️', e.message);
      resultado.erros.push({ fase: 7, erro: e.message });
    }

    resultado.success = true;
    resultado.duracao_ms = Date.now() - inicio;

    // Registrar SkillExecution para auditoria
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'sanitizacao_contato_forense',
        triggered_by: internal_caller ? 'entity_hook' : 'manual',
        execution_mode: modo === 'diagnostico' ? 'dry_run' : 'autonomous_safe',
        user_id: user?.id || 'system',
        context: {
          contact_id,
          estado_inicial: `${duplicatas.length} duplicatas`,
          estado_final: resultado.fases.fase7_validacao_final?.saudavel ? 'saudavel' : 'parcial'
        },
        parametros_entrada: { contact_id, modo, periodo_horas },
        resultado: resultado.resumo,
        success: true,
        duration_ms: resultado.duracao_ms
      });
    } catch (e) {
      console.warn('[skillSanitizacao] Erro ao registrar SkillExecution:', e.message);
    }

    console.log(`[skillSanitizacao ${VERSION}] ✅ CONCLUÍDO em ${resultado.duracao_ms}ms`, resultado.resumo);
    return Response.json(resultado, { headers });

  } catch (error) {
    console.error(`[skillSanitizacao ${VERSION}] ❌ ERRO FATAL:`, error);
    resultado.duracao_ms = Date.now() - inicio;
    resultado.erros.push({ fatal: true, erro: error.message, stack: error.stack });
    return Response.json({ ...resultado, error: error.message }, { status: 500, headers });
  }
});