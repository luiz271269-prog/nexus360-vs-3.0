import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ✅ SCRIPT DE LIMPEZA DE CONTATOS DUPLICADOS
 * 
 * Este script:
 * 1. Encontra contatos com telefones duplicados (com e sem +)
 * 2. Mantém o contato mais antigo
 * 3. Atualiza threads e mensagens para referenciar o contato correto
 * 4. Remove os contatos duplicados
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('[LIMPEZA] 🧹 Iniciando limpeza de contatos duplicados...');
    
    // Buscar todos os contatos
    const todosContatos = await base44.asServiceRole.entities.Contact.list();
    console.log(`[LIMPEZA] 📊 Total de contatos: ${todosContatos.length}`);
    
    // Agrupar por telefone normalizado
    const contatosPorTelefone = {};
    
    for (const contato of todosContatos) {
      if (!contato.telefone) continue;
      
      // Normalizar: remover espaços, hífen, etc e garantir +
      let telefoneNormalizado = contato.telefone.replace(/[\s\-()]/g, '');
      if (!telefoneNormalizado.startsWith('+')) {
        telefoneNormalizado = '+' + telefoneNormalizado.replace(/^\+/, '');
      }
      
      if (!contatosPorTelefone[telefoneNormalizado]) {
        contatosPorTelefone[telefoneNormalizado] = [];
      }
      
      contatosPorTelefone[telefoneNormalizado].push(contato);
    }
    
    // Processar duplicatas
    let totalDuplicatasRemovidas = 0;
    const relatorio = [];
    
    for (const [telefone, contatos] of Object.entries(contatosPorTelefone)) {
      if (contatos.length <= 1) continue;
      
      console.log(`[LIMPEZA] 🔍 Encontrado ${contatos.length} contatos com telefone: ${telefone}`);
      
      // Ordenar por data de criação (manter o mais antigo)
      contatos.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      const contatoPrincipal = contatos[0];
      const duplicatas = contatos.slice(1);
      
      console.log(`[LIMPEZA] ✅ Mantendo contato: ${contatoPrincipal.id} (${contatoPrincipal.nome})`);
      
      // Atualizar telefone do contato principal para formato normalizado
      if (contatoPrincipal.telefone !== telefone) {
        await base44.asServiceRole.entities.Contact.update(contatoPrincipal.id, {
          telefone: telefone
        });
        console.log(`[LIMPEZA] 🔄 Telefone atualizado para: ${telefone}`);
      }
      
      for (const duplicata of duplicatas) {
        console.log(`[LIMPEZA] 🗑️  Processando duplicata: ${duplicata.id}`);
        
        // Buscar threads associadas à duplicata
        const threads = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: duplicata.id
        });
        
        // Atualizar threads para referenciar o contato principal
        for (const thread of threads) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            contact_id: contatoPrincipal.id
          });
          console.log(`[LIMPEZA]   📝 Thread ${thread.id} atualizada`);
        }
        
        // Buscar mensagens associadas à duplicata
        const mensagens = await base44.asServiceRole.entities.Message.filter({
          sender_id: duplicata.id,
          sender_type: 'contact'
        });
        
        // Atualizar mensagens para referenciar o contato principal
        for (const mensagem of mensagens) {
          await base44.asServiceRole.entities.Message.update(mensagem.id, {
            sender_id: contatoPrincipal.id
          });
        }
        
        if (mensagens.length > 0) {
          console.log(`[LIMPEZA]   💬 ${mensagens.length} mensagens atualizadas`);
        }
        
        // Remover o contato duplicado
        await base44.asServiceRole.entities.Contact.delete(duplicata.id);
        console.log(`[LIMPEZA]   ✅ Contato duplicado removido: ${duplicata.id}`);
        
        totalDuplicatasRemovidas++;
      }
      
      relatorio.push({
        telefone,
        contato_principal: {
          id: contatoPrincipal.id,
          nome: contatoPrincipal.nome
        },
        duplicatas_removidas: duplicatas.length,
        threads_atualizadas: threads.length
      });
    }
    
    console.log('[LIMPEZA] ✅ Limpeza concluída!');
    console.log(`[LIMPEZA] 📊 Total de duplicatas removidas: ${totalDuplicatasRemovidas}`);
    
    return Response.json({
      success: true,
      message: 'Limpeza de contatos duplicados concluída',
      estatisticas: {
        total_contatos_analisados: todosContatos.length,
        grupos_duplicados_encontrados: relatorio.length,
        total_duplicatas_removidas: totalDuplicatasRemovidas
      },
      detalhes: relatorio
    });
    
  } catch (error) {
    console.error('[LIMPEZA] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});