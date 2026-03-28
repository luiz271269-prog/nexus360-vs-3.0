import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUDITORIA DE DUPLICATAS - GREP LÓGICO COMPLETO
 * ═══════════════════════════════════════════════════════════════════════════════
 * Identifica todos os pontos no sistema que podem criar duplicatas:
 * - Contatos duplicados por telefone
 * - Threads duplicadas por contact_id
 * - Criações fora do padrão centralizado
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    console.log('[AUDITORIA] 🔍 Iniciando auditoria completa...');

    const resultado = {
      timestamp: new Date().toISOString(),
      contatos_duplicados: [],
      threads_duplicadas: [],
      threads_sem_canonical: [],
      threads_merged_sem_destino: [],
      contatos_sem_telefone: [],
      estatisticas: {}
    };

    // ═══════════════════════════════════════════════════════════════════
    // 1. AUDITORIA DE CONTATOS DUPLICADOS POR TELEFONE
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AUDITORIA] 📞 Auditando contatos duplicados...');
    
    const todosContatos = await base44.asServiceRole.entities.Contact.list('-created_date', 2000);
    const contatosPorTelefone = new Map();
    
    for (const contato of todosContatos) {
      if (!contato.telefone) {
        resultado.contatos_sem_telefone.push({
          id: contato.id,
          nome: contato.nome,
          created_date: contato.created_date
        });
        continue;
      }
      
      const telLimpo = contato.telefone.replace(/\D/g, '');
      
      if (!contatosPorTelefone.has(telLimpo)) {
        contatosPorTelefone.set(telLimpo, []);
      }
      contatosPorTelefone.get(telLimpo).push(contato);
    }
    
    // Identificar duplicatas
    for (const [telefone, contatos] of contatosPorTelefone) {
      if (contatos.length > 1) {
        resultado.contatos_duplicados.push({
          telefone: '+' + telefone,
          quantidade: contatos.length,
          contatos: contatos.map(c => ({
            id: c.id,
            nome: c.nome,
            created_date: c.created_date,
            conexao_origem: c.conexao_origem
          }))
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. AUDITORIA DE THREADS DUPLICADAS POR CONTACT_ID
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AUDITORIA] 💬 Auditando threads duplicadas...');
    
    const todasThreads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 2000);
    const threadsPorContato = new Map();
    
    for (const thread of todasThreads) {
      if (!thread.contact_id) continue;
      
      const chave = thread.contact_id;
      if (!threadsPorContato.has(chave)) {
        threadsPorContato.set(chave, []);
      }
      threadsPorContato.get(chave).push(thread);
    }
    
    // Identificar duplicatas
    for (const [contactId, threads] of threadsPorContato) {
      if (threads.length > 1) {
        const canonicas = threads.filter(t => t.is_canonical === true);
        const merged = threads.filter(t => t.status === 'merged');
        
        resultado.threads_duplicadas.push({
          contact_id: contactId,
          quantidade: threads.length,
          canonicas: canonicas.length,
          merged: merged.length,
          sem_classificacao: threads.length - canonicas.length - merged.length,
          threads: threads.map(t => ({
            id: t.id,
            is_canonical: t.is_canonical,
            status: t.status,
            merged_into: t.merged_into,
            whatsapp_integration_id: t.whatsapp_integration_id,
            created_date: t.created_date,
            last_message_at: t.last_message_at
          }))
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. THREADS SEM CANONICAL (LEGADO)
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AUDITORIA] 🔍 Identificando threads sem is_canonical...');
    
    const threadsSemCanonical = todasThreads.filter(t => 
      t.contact_id && 
      t.is_canonical === undefined && 
      t.status !== 'merged'
    );
    
    resultado.threads_sem_canonical = threadsSemCanonical.map(t => ({
      id: t.id,
      contact_id: t.contact_id,
      whatsapp_integration_id: t.whatsapp_integration_id,
      created_date: t.created_date
    }));

    // ═══════════════════════════════════════════════════════════════════
    // 4. THREADS MERGED SEM DESTINO VÁLIDO
    // ═══════════════════════════════════════════════════════════════════
    console.log('[AUDITORIA] 🔗 Verificando integridade de merged_into...');
    
    const threadsMerged = todasThreads.filter(t => t.status === 'merged');
    const threadIdsSet = new Set(todasThreads.map(t => t.id));
    
    for (const thread of threadsMerged) {
      if (!thread.merged_into) {
        resultado.threads_merged_sem_destino.push({
          id: thread.id,
          contact_id: thread.contact_id,
          problema: 'merged_into_vazio'
        });
      } else if (!threadIdsSet.has(thread.merged_into)) {
        resultado.threads_merged_sem_destino.push({
          id: thread.id,
          contact_id: thread.contact_id,
          merged_into: thread.merged_into,
          problema: 'destino_nao_existe'
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. ESTATÍSTICAS GERAIS
    // ═══════════════════════════════════════════════════════════════════
    resultado.estatisticas = {
      total_contatos: todosContatos.length,
      contatos_unicos_por_telefone: contatosPorTelefone.size,
      contatos_duplicados: resultado.contatos_duplicados.length,
      total_threads: todasThreads.length,
      threads_duplicadas: resultado.threads_duplicadas.length,
      threads_sem_canonical: resultado.threads_sem_canonical.length,
      threads_merged_invalidas: resultado.threads_merged_sem_destino.length,
      taxa_duplicacao_contatos: ((resultado.contatos_duplicados.length / contatosPorTelefone.size) * 100).toFixed(2) + '%',
      taxa_duplicacao_threads: ((resultado.threads_duplicadas.length / todasThreads.length) * 100).toFixed(2) + '%'
    };

    console.log('[AUDITORIA] ✅ Auditoria concluída:', resultado.estatisticas);

    return Response.json({
      success: true,
      resultado
    });

  } catch (error) {
    console.error('[AUDITORIA] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});