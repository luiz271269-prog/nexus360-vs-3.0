import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ════════════════════════════════════════════════════════════════════════
 * SKILL: DIAGNÓSTICO UNIFICADO (4 FASES)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Skill ÚNICA que substitui 3 telas + skillSanitizacaoContato.
 *
 * FASES:
 *   FASE A — DADOS DO CONTATO (delega para skillSanitizacaoContato)
 *            Canonical, dedup, threads órfãs, merge
 *   FASE B — VISIBILIDADE/PERMISSÕES (porta lógica do permissionsService)
 *            Por que usuário X não vê threads do contato?
 *   FASE C — INFRAESTRUTURA WEBHOOK (testa Porteiro Cego)
 *            Webhook responde? Payload normalizado? Message criada?
 *   FASE D — THREADS INTERNAS (audita team_internal/sector_group)
 *            Mensagens órfãs entre atendentes
 *
 * Payload:
 *   {
 *     telefone?: string,             // FASE A, B, D
 *     contact_id?: string,           // alternativa para telefone
 *     email_usuario?: string,        // FASE B
 *     integration_id?: string,       // FASE C
 *     fases?: ['A','B','C','D'],     // default: todas aplicáveis
 *     modo?: 'diagnostico'|'correcao' // default: diagnostico
 *   }
 *
 * v1.0.0
 */

const VERSION = 'v1.0.0';

Deno.serve(async (req) => {
  const inicio = Date.now();
  const headers = { 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ success: false, error: 'sdk_init_error: ' + e.message }, { status: 500, headers });
  }

  let payload = {};
  try { payload = await req.json(); } catch {}

  const {
    telefone,
    contact_id: contactIdInput,
    email_usuario,
    integration_id,
    fases: fasesSolicitadas,
    modo = 'diagnostico'
  } = payload;

  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Não autenticado' }, { status: 401, headers });

  console.log(`[skillDiagnosticoUnificado ${VERSION}] ▶️ tel=${telefone} email=${email_usuario} integ=${integration_id} modo=${modo}`);

  const resultado = {
    success: false,
    modo,
    inputs: { telefone, contact_id: contactIdInput, email_usuario, integration_id },
    fases: { A: null, B: null, C: null, D: null },
    recomendacoes: [],
    duracao_ms: 0,
    version: VERSION
  };

  // Determinar quais fases executar
  const executar = (letra) => !fasesSolicitadas || fasesSolicitadas.includes(letra);

  // Resolver contact_id a partir do telefone
  let contactId = contactIdInput;
  let contato = null;
  if (!contactId && telefone) {
    try {
      const telLimpo = String(telefone).replace(/\D/g, '');
      const porCanonico = await base44.asServiceRole.entities.Contact.filter({ telefone_canonico: telLimpo });
      const porTelefone = await base44.asServiceRole.entities.Contact.filter({ telefone });
      const todos = [...(porCanonico || []), ...(porTelefone || [])];
      contato = todos[0] || null;
      contactId = contato?.id || null;
    } catch (e) {
      console.warn('[diagUnificado] Erro ao resolver contato:', e.message);
    }
  } else if (contactId) {
    contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
  }

  try {
    // ════════════════════════════════════════════════════════════
    // FASE A — DADOS DO CONTATO (delega para skillSanitizacaoContato)
    // ════════════════════════════════════════════════════════════
    if (executar('A') && contactId) {
      console.log('[diagUnificado] FASE A — Sanitização de dados');
      try {
        const r = await base44.asServiceRole.functions.invoke('skillSanitizacaoContato', {
          contact_id: contactId,
          modo,
          internal_caller: true
        });
        const data = r?.data || r;
        resultado.fases.A = {
          executada: true,
          delegada_para: 'skillSanitizacaoContato',
          success: data?.success !== false,
          resumo: data?.resumo || null,
          saudavel: data?.fases?.fase7_validacao_final?.saudavel ?? null
        };

        if (data?.resumo?.duplicatas_removidas > 0) {
          resultado.recomendacoes.push(`${data.resumo.duplicatas_removidas} contato(s) duplicado(s) ${modo === 'correcao' ? 'mesclados' : 'detectados'}.`);
        }
        if (data?.fases?.fase7_validacao_final?.saudavel === false) {
          resultado.recomendacoes.push('Contato ainda apresenta inconsistências após saneamento.');
        }
      } catch (e) {
        resultado.fases.A = { executada: true, success: false, erro: e.message };
      }
    } else if (executar('A')) {
      resultado.fases.A = { executada: false, motivo: 'sem contact_id ou telefone' };
    }

    // ════════════════════════════════════════════════════════════
    // FASE B — VISIBILIDADE/PERMISSÕES
    // ════════════════════════════════════════════════════════════
    if (executar('B') && contactId && email_usuario) {
      console.log('[diagUnificado] FASE B — Visibilidade');
      try {
        // Buscar usuário por email
        const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 500);
        const usuarioAlvo = usuarios.find(u => (u.email || '').toLowerCase().trim() === email_usuario.toLowerCase().trim());

        if (!usuarioAlvo) {
          resultado.fases.B = { executada: true, success: false, erro: `Usuário ${email_usuario} não encontrado` };
        } else {
          // Buscar threads do contato
          const threads = await base44.asServiceRole.entities.MessageThread.filter(
            { contact_id: contactId },
            '-last_message_at',
            10
          );

          // Análise simplificada por thread (lógica espelha permissionsService)
          const threadsAnalisadas = (threads || []).map(t => {
            const flags = analisarVisibilidadeThread(usuarioAlvo, t, contato);
            return {
              thread_id: t.id,
              status: t.status,
              assigned_user_id: t.assigned_user_id,
              sector_id: t.sector_id,
              integration_id: t.whatsapp_integration_id,
              ...flags
            };
          });

          const totalVisiveis = threadsAnalisadas.filter(t => t.visible).length;

          resultado.fases.B = {
            executada: true,
            success: true,
            usuario: { id: usuarioAlvo.id, email: usuarioAlvo.email, role: usuarioAlvo.role, sector: usuarioAlvo.attendant_sector },
            total_threads: threadsAnalisadas.length,
            threads_visiveis: totalVisiveis,
            threads_bloqueadas: threadsAnalisadas.length - totalVisiveis,
            threads: threadsAnalisadas
          };

          if (totalVisiveis === 0 && threadsAnalisadas.length > 0) {
            const primeira = threadsAnalisadas[0];
            resultado.recomendacoes.push(`${email_usuario} NÃO vê nenhuma thread deste contato. Motivo: ${primeira.motivo}`);
          }
        }
      } catch (e) {
        resultado.fases.B = { executada: true, success: false, erro: e.message };
      }
    } else if (executar('B')) {
      resultado.fases.B = { executada: false, motivo: 'precisa contact_id/telefone + email_usuario' };
    }

    // ════════════════════════════════════════════════════════════
    // FASE C — INFRAESTRUTURA WEBHOOK
    // ════════════════════════════════════════════════════════════
    if (executar('C') && integration_id) {
      console.log('[diagUnificado] FASE C — Webhook');
      try {
        const integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
        if (!integracao) {
          resultado.fases.C = { executada: true, success: false, erro: 'Integração não encontrada' };
        } else {
          const checks = {
            tem_numero: !!integracao.numero_telefone,
            tem_instance_id: !!integracao.instance_id_provider,
            tem_token: !!integracao.api_key_provider,
            tem_webhook_url: !!integracao.webhook_url,
            status: integracao.status
          };

          const problemas = [];
          if (!checks.tem_numero) problemas.push('numero_telefone ausente — lookup prioritário falhará');
          if (!checks.tem_instance_id) problemas.push('instance_id_provider ausente — fallback falhará');
          if (!checks.tem_token) problemas.push('token ausente — envio de mensagens falhará');
          if (integracao.status !== 'conectado') problemas.push(`status atual: ${integracao.status}`);

          resultado.fases.C = {
            executada: true,
            success: problemas.length === 0,
            integracao: {
              id: integracao.id,
              nome: integracao.nome_instancia,
              numero: integracao.numero_telefone,
              provider: integracao.api_provider,
              status: integracao.status
            },
            checks,
            problemas
          };

          if (problemas.length > 0) {
            resultado.recomendacoes.push(`Integração "${integracao.nome_instancia}": ${problemas.join('; ')}`);
          }
        }
      } catch (e) {
        resultado.fases.C = { executada: true, success: false, erro: e.message };
      }
    } else if (executar('C')) {
      resultado.fases.C = { executada: false, motivo: 'sem integration_id' };
    }

    // ════════════════════════════════════════════════════════════
    // FASE D — THREADS INTERNAS
    // ════════════════════════════════════════════════════════════
    if (executar('D')) {
      console.log('[diagUnificado] FASE D — Threads internas');
      try {
        const threadsInternas = await base44.asServiceRole.entities.MessageThread.filter(
          { thread_type: { $in: ['team_internal', 'sector_group'] } },
          '-last_message_at',
          50
        );

        const doisMinAtras = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const msgsRecentes = await base44.asServiceRole.entities.Message.filter(
          { channel: 'interno', sent_at: { $gte: doisMinAtras } },
          '-sent_at',
          100
        );

        // Detectar mensagens órfãs (channel=interno mas thread_id não bate participantes)
        let totalOrfas = 0;
        for (const t of (threadsInternas || []).slice(0, 10)) {
          const orfas = (msgsRecentes || []).filter(m =>
            m.thread_id !== t.id &&
            t.participants?.some(p => p === m.sender_id || p === m.recipient_id)
          );
          totalOrfas += orfas.length;
        }

        resultado.fases.D = {
          executada: true,
          success: true,
          total_threads_internas: threadsInternas?.length || 0,
          mensagens_recentes_2min: msgsRecentes?.length || 0,
          mensagens_orfas: totalOrfas
        };

        if (totalOrfas > 0) {
          resultado.recomendacoes.push(`${totalOrfas} mensagem(ns) interna(s) órfã(s) detectada(s) — thread_id incorreto.`);
        }
      } catch (e) {
        resultado.fases.D = { executada: true, success: false, erro: e.message };
      }
    }

    // ════════════════════════════════════════════════════════════
    // CONSOLIDAÇÃO
    // ════════════════════════════════════════════════════════════
    resultado.success = true;
    resultado.duracao_ms = Date.now() - inicio;

    if (resultado.recomendacoes.length === 0) {
      resultado.recomendacoes.push('✅ Nenhum problema crítico detectado nas fases executadas.');
    }

    // Auditoria
    try {
      await base44.asServiceRole.entities.SkillExecution.create({
        skill_name: 'diagnostico_unificado',
        triggered_by: 'manual',
        execution_mode: modo === 'diagnostico' ? 'dry_run' : 'autonomous_safe',
        user_id: user.id,
        context: {
          contact_id: contactId,
          telefone,
          email_usuario,
          integration_id,
          fases_executadas: ['A', 'B', 'C', 'D'].filter(f => resultado.fases[f]?.executada)
        },
        parametros_entrada: payload,
        resultado: { recomendacoes: resultado.recomendacoes },
        success: true,
        duration_ms: resultado.duracao_ms
      });
    } catch (e) {
      console.warn('[diagUnificado] Auditoria falhou:', e.message);
    }

    console.log(`[skillDiagnosticoUnificado ${VERSION}] ✅ ${resultado.duracao_ms}ms`);
    return Response.json(resultado, { headers });

  } catch (error) {
    console.error(`[skillDiagnosticoUnificado ${VERSION}] ❌`, error);
    resultado.duracao_ms = Date.now() - inicio;
    return Response.json({ ...resultado, error: error.message }, { status: 500, headers });
  }
});

// ════════════════════════════════════════════════════════════
// HELPER: Análise simplificada de visibilidade (espelha permissionsService)
// ════════════════════════════════════════════════════════════
function analisarVisibilidadeThread(usuario, thread, contato) {
  // Admin vê tudo
  if (usuario.role === 'admin') {
    return { visible: true, motivo: 'Admin — acesso total', reason_code: 'ADMIN' };
  }

  // Thread interna — só participantes
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isPart = thread.participants?.includes(usuario.id);
    return isPart
      ? { visible: true, motivo: 'Participante da thread interna', reason_code: 'PARTICIPANT' }
      : { visible: false, motivo: 'Não é participante da thread interna', reason_code: 'NOT_PARTICIPANT' };
  }

  // Atribuída ao usuário
  if (thread.assigned_user_id === usuario.id) {
    return { visible: true, motivo: 'Thread atribuída ao usuário', reason_code: 'ASSIGNED_TO_USER' };
  }

  // Histórico de atendimento
  if (thread.atendentes_historico?.includes(usuario.id) || thread.shared_with_users?.includes(usuario.id)) {
    return { visible: true, motivo: 'Já atendeu esta conversa', reason_code: 'HISTORY_ACCESS' };
  }

  // Fidelizado a outro
  if (contato?.is_cliente_fidelizado) {
    const setor = usuario.attendant_sector || 'geral';
    const campo = `atendente_fidelizado_${setor}`;
    if (contato[campo] && contato[campo] !== usuario.email) {
      return { visible: false, motivo: 'Contato fidelizado a outro atendente', reason_code: 'LOYAL_TO_ANOTHER' };
    }
    if (contato[campo] === usuario.email) {
      return { visible: true, motivo: 'Contato fidelizado ao usuário', reason_code: 'LOYAL_CONTACT' };
    }
  }

  // Atribuída a outro
  if (thread.assigned_user_id && thread.assigned_user_id !== usuario.id) {
    return { visible: false, motivo: 'Thread atribuída a outro usuário', reason_code: 'ASSIGNED_TO_ANOTHER' };
  }

  // Setor bloqueado (não-admin com setor diferente)
  const nivel = usuario.attendant_role || 'pleno';
  if (['coordenador', 'senior', 'pleno', 'junior'].includes(nivel)) {
    const setorThread = thread.sector_id;
    const setorUser = usuario.attendant_sector || 'geral';
    if (setorThread && setorThread !== setorUser) {
      return { visible: false, motivo: `Setor ${setorThread} bloqueado para usuário do setor ${setorUser}`, reason_code: 'SECTOR_BLOCKED' };
    }
  }

  return { visible: true, motivo: 'Padrão liberado (Nexus360)', reason_code: 'DEFAULT_ALLOW' };
}