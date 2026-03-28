import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VALIDAÇÃO DE SCHEMA - TESTE REAL DE PERSISTÊNCIA
 * ═══════════════════════════════════════════════════════════════════════════════
 * Cria uma thread de teste e valida se todos os campos críticos persistem:
 * - is_canonical
 * - status
 * - merged_into
 * - primeira_mensagem_at
 * ═══════════════════════════════════════════════════════════════════════════════
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    console.log('[VALIDACAO] 🧪 Iniciando validação de schema...');

    const resultado = {
      timestamp: new Date().toISOString(),
      testes: [],
      schema_valido: true,
      campos_faltando: [],
      campos_ok: []
    };

    // ═══════════════════════════════════════════════════════════════════
    // 1. CRIAR CONTATO DE TESTE
    // ═══════════════════════════════════════════════════════════════════
    const telefoneTest = '+5548999999999';
    let contatoTeste;
    
    try {
      const contatosExistentes = await base44.asServiceRole.entities.Contact.filter(
        { telefone: telefoneTest },
        '-created_date',
        1
      );
      
      if (contatosExistentes.length > 0) {
        contatoTeste = contatosExistentes[0];
        console.log('[VALIDACAO] ♻️ Reutilizando contato de teste existente:', contatoTeste.id);
      } else {
        contatoTeste = await base44.asServiceRole.entities.Contact.create({
          nome: '[TESTE SCHEMA - PODE DELETAR]',
          telefone: telefoneTest,
          tipo_contato: 'novo'
        });
        console.log('[VALIDACAO] ✅ Contato de teste criado:', contatoTeste.id);
      }
      
      resultado.testes.push({ etapa: 'criar_contato', status: 'sucesso', id: contatoTeste.id });
    } catch (error) {
      resultado.testes.push({ etapa: 'criar_contato', status: 'erro', erro: error.message });
      resultado.schema_valido = false;
      return Response.json({ success: true, resultado });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. CRIAR THREAD DE TESTE COM CAMPOS CRÍTICOS
    // ═══════════════════════════════════════════════════════════════════
    let threadTeste;
    const agora = new Date().toISOString();
    
    try {
      threadTeste = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contatoTeste.id,
        thread_type: 'contact_external',
        channel: 'whatsapp',
        is_canonical: true,
        status: 'aberta',
        primeira_mensagem_at: agora,
        last_message_at: agora,
        unread_count: 0,
        total_mensagens: 0
      });
      
      console.log('[VALIDACAO] ✅ Thread de teste criada:', threadTeste.id);
      resultado.testes.push({ etapa: 'criar_thread', status: 'sucesso', id: threadTeste.id });
    } catch (error) {
      resultado.testes.push({ etapa: 'criar_thread', status: 'erro', erro: error.message });
      resultado.schema_valido = false;
      return Response.json({ success: true, resultado });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3. LER THREAD E VALIDAR CAMPOS
    // ═══════════════════════════════════════════════════════════════════
    try {
      const threadLida = await base44.asServiceRole.entities.MessageThread.filter(
        { id: threadTeste.id },
        '-created_date',
        1
      );
      
      if (!threadLida || threadLida.length === 0) {
        throw new Error('Thread criada não foi encontrada na leitura');
      }
      
      const thread = threadLida[0];
      
      // Validar campos críticos
      const camposEsperados = {
        is_canonical: true,
        status: 'aberta',
        primeira_mensagem_at: agora,
        contact_id: contatoTeste.id
      };
      
      for (const [campo, valorEsperado] of Object.entries(camposEsperados)) {
        if (thread[campo] === undefined || thread[campo] === null) {
          resultado.campos_faltando.push(campo);
          resultado.schema_valido = false;
          console.error(`[VALIDACAO] ❌ Campo ${campo} NÃO PERSISTIU!`);
        } else if (thread[campo] !== valorEsperado) {
          resultado.campos_faltando.push(`${campo} (valor: ${thread[campo]}, esperado: ${valorEsperado})`);
          resultado.schema_valido = false;
          console.error(`[VALIDACAO] ❌ Campo ${campo} com valor incorreto: ${thread[campo]} (esperado: ${valorEsperado})`);
        } else {
          resultado.campos_ok.push(campo);
          console.log(`[VALIDACAO] ✅ Campo ${campo} OK`);
        }
      }
      
      resultado.testes.push({ etapa: 'validar_campos', status: 'concluido', thread_lida: thread });
    } catch (error) {
      resultado.testes.push({ etapa: 'validar_campos', status: 'erro', erro: error.message });
      resultado.schema_valido = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. TESTAR UPDATE (MARCAR COMO MERGED)
    // ═══════════════════════════════════════════════════════════════════
    try {
      await base44.asServiceRole.entities.MessageThread.update(threadTeste.id, {
        status: 'merged',
        merged_into: 'thread_ficticia_123',
        is_canonical: false
      });
      
      // Ler novamente
      const threadAtualizada = await base44.asServiceRole.entities.MessageThread.filter(
        { id: threadTeste.id },
        '-created_date',
        1
      );
      
      if (threadAtualizada[0].status !== 'merged') {
        throw new Error('Campo status não persistiu após update');
      }
      if (threadAtualizada[0].merged_into !== 'thread_ficticia_123') {
        throw new Error('Campo merged_into não persistiu após update');
      }
      if (threadAtualizada[0].is_canonical !== false) {
        throw new Error('Campo is_canonical não persistiu após update');
      }
      
      console.log('[VALIDACAO] ✅ Update de campos críticos CONFIRMADO');
      resultado.testes.push({ etapa: 'testar_update', status: 'sucesso' });
    } catch (error) {
      resultado.testes.push({ etapa: 'testar_update', status: 'erro', erro: error.message });
      resultado.schema_valido = false;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. LIMPAR THREAD DE TESTE
    // ═══════════════════════════════════════════════════════════════════
    try {
      await base44.asServiceRole.entities.MessageThread.delete({ id: threadTeste.id });
      console.log('[VALIDACAO] 🗑️ Thread de teste deletada');
      resultado.testes.push({ etapa: 'cleanup', status: 'sucesso' });
    } catch (error) {
      console.warn('[VALIDACAO] ⚠️ Erro ao deletar thread de teste:', error.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. RESULTADO FINAL
    // ═══════════════════════════════════════════════════════════════════
    resultado.conclusao = resultado.schema_valido 
      ? '✅ Schema válido - todos os campos críticos persistem corretamente'
      : '❌ Schema inválido - campos críticos não estão persistindo';

    console.log('[VALIDACAO]', resultado.conclusao);

    return Response.json({
      success: true,
      resultado
    });

  } catch (error) {
    console.error('[VALIDACAO] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});