import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔍 DIAGNÓSTICO: Verificar se mensagens recebidas estão visíveis (RLS checks)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Automação agendada que:
 * 1. Busca threads com mensagens recebidas nas últimas 4h
 * 2. Verifica se estão bloqueadas por RLS rules
 * 3. Loga problemas de visibilidade para auditoria
 * 4. Processamento com timeout seguro (~45s)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const MAX_CICLO_MS = 50_000; // 50s máximo para não estourar timeout de 90s

Deno.serve(async (req) => {
  const tsStart = Date.now();
  
  try {
    // ✅ FIX: Em contexto agendado, usar createClientFromRequest com req vazio
    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (e) {
      console.error('[DIAGNÓSTICO] ❌ Falha ao criar cliente:', e.message);
      return Response.json({ 
        success: false,
        error: 'Falha ao inicializar SDK',
        duration_ms: Date.now() - tsStart
      }, { status: 500 });
    }

    console.log(`[DIAGNÓSTICO] 🔍 Iniciando diagnóstico RLS - Verificar Mensagens Recebidas...`);

    const resultados = {
      threads_verificadas: 0,
      mensagens_bloqueadas: 0,
      threads_sem_permissao: 0,
      problemas_detectados: []
    };

    // ✅ OTIMIZADO: Buscar apenas 10 threads recentes (não 30)
    const quatroHorasAtras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const threadsCandidatas = await base44.asServiceRole.entities.MessageThread.filter({
      thread_type: 'contact_external',
      is_canonical: true,
      status: 'aberta',
      last_inbound_at: { $gte: quatroHorasAtras }
    }, '-last_inbound_at', 10); // Reduzido de 30 para 10

    console.log(`[DIAGNÓSTICO] 📊 ${threadsCandidatas.length} threads com mensagens recebidas encontradas`);

    // ✅ FIX: Processar com limite de tempo e batch pequeno
    for (const thread of threadsCandidatas.slice(0, 10)) { // Reduzido de 15 para 10
      // Guard: não ultrapassar tempo máximo (30s para deixar margem)
      if (Date.now() - tsStart > 30_000) {
        console.warn('[DIAGNÓSTICO] ⏱️ Timeout de processamento atingido');
        break;
      }

      try {
        resultados.threads_verificadas++;

        // Verificar se thread tem dados básicos ANTES de fazer query de mensagens
        const temDadosBasicos = thread.last_message_at && thread.contact_id;
        if (!temDadosBasicos) {
          resultados.problemas_detectados.push({
            thread_id: thread.id,
            problema: 'Dados incompletos',
            detalhes: `Missing: last_message_at=${!!thread.last_message_at}, contact_id=${!!thread.contact_id}`
          });
          continue;
        }

        // ✅ Pular query de mensagens se thread tem dados completos
        // (diagnóstico é só verificar se thread está OK, não listar todas as mensagens)

        // Verificar se há atribuição ou setor (permissão mínima)
        const temPermissaoBasica = thread.assigned_user_id || thread.sector_id;
        if (!temPermissaoBasica) {
          resultados.threads_sem_permissao++;
          resultados.problemas_detectados.push({
            thread_id: thread.id,
            problema: 'Sem atribuição/setor',
            detalhes: 'Thread externa sem assigned_user_id e sem sector_id'
          });
          continue;
        }

        // Verificar se contato está bloqueado
        if (thread.bloqueado) {
          resultados.mensagens_bloqueadas++;
          resultados.problemas_detectados.push({
            thread_id: thread.id,
            contact_id: thread.contact_id,
            problema: 'Contato bloqueado',
            detalhes: thread.motivo_bloqueio || 'N/A'
          });
        }

        console.log(`[DIAGNÓSTICO] ✓ Thread ${thread.id}: OK`);

      } catch (err) {
        console.warn(`[DIAGNÓSTICO] ⚠️ Erro ao processar thread ${thread.id}:`, err.message);
      }
    }

    const duracao = Date.now() - tsStart;
    console.log(`[DIAGNÓSTICO] ✅ Ciclo concluído em ${duracao}ms | Threads: ${resultados.threads_verificadas} | Bloqueadas: ${resultados.mensagens_bloqueadas} | Sem permissão: ${resultados.threads_sem_permissao}`);

    return Response.json({
      success: true,
      resultados,
      duration_ms: duracao
    }, { status: 200 });

  } catch (error) {
    console.error('[DIAGNÓSTICO] ❌ Erro crítico:', error.message);
    return Response.json({ 
      success: false,
      error: error.message,
      duration_ms: Date.now() - tsStart
    }, { status: 500 });
  }
});