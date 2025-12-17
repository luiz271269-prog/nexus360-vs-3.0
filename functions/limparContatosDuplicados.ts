import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizePhone } from './lib/phoneNormalizer.js';

// ============================================================================
// UTILITÁRIO DE LIMPEZA - CONSOLIDAR CONTATOS DUPLICADOS
// ============================================================================
// Executar UMA VEZ após correção do sistema
// Agrupa contatos por telefone normalizado e consolida
// v1.0.1: Tratamento de erros robusto + validações
// ============================================================================

const VERSION = 'v1.0.1';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    return Response.json({ 
      version: VERSION, 
      status: 'ready',
      description: 'Consolida contatos duplicados por telefone'
    }, { headers });
  }

  let base44;
  try {
    base44 = createClientFromRequest(req);
  } catch (e) {
    return Response.json({ 
      success: false, 
      error: 'Erro ao inicializar SDK: ' + e.message 
    }, { status: 500, headers });
  }
  
  try {
    console.log(`[DEDUPE ${VERSION}] Iniciando limpeza de duplicatas...`);
    
    // Buscar todos os contatos
    let allContacts;
    try {
      allContacts = await base44.asServiceRole.entities.Contact.list('-created_date', 5000);
    } catch (e) {
      throw new Error(`Erro ao buscar contatos: ${e.message}`);
    }
    
    if (!allContacts || allContacts.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhum contato encontrado',
        stats: { total_groups: 0, duplicates_found: 0 }
      }, { headers });
    }
    
    console.log(`[DEDUPE] ${allContacts.length} contatos encontrados`);
    
    // Agrupar por telefone normalizado
    const groups = new Map();
    
    for (const contact of allContacts) {
      if (!contact.telefone) {
        console.log(`[DEDUPE] ⚠️ Contato sem telefone (ID: ${contact.id})`);
        continue;
      }
      
      const normalized = normalizePhone(contact.telefone);
      if (!normalized) {
        console.log(`[DEDUPE] ⚠️ Telefone inválido: ${contact.telefone} (ID: ${contact.id})`);
        continue;
      }
      
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized).push(contact);
    }
    
    // Estatísticas
    const stats = {
      total_groups: groups.size,
      duplicates_found: 0,
      contacts_merged: 0,
      threads_updated: 0,
      messages_updated: 0,
      errors: 0,
      errors_details: []
    };
    
    // Processar grupos com duplicatas
    for (const [phone, contacts] of groups) {
      if (contacts.length === 1) continue; // Sem duplicata
      
      stats.duplicates_found++;
      
      console.log(`[DEDUPE] 🔍 Duplicata: ${phone} (${contacts.length} registros)`);
      
      // Escolher contato principal (critérios ordenados por prioridade)
      const principal = contacts.reduce((best, current) => {
        // 1. Preferir tipo_contato mais específico
        const tipoOrder = { cliente: 4, lead: 3, parceiro: 2, fornecedor: 1, novo: 0 };
        const bestTipo = tipoOrder[best.tipo_contato] || 0;
        const currentTipo = tipoOrder[current.tipo_contato] || 0;
        if (currentTipo > bestTipo) return current;
        if (currentTipo < bestTipo) return best;
        
        // 2. Preferir com cliente_id
        if (current.cliente_id && !best.cliente_id) return current;
        if (!current.cliente_id && best.cliente_id) return best;
        
        // 3. Preferir com mais interações
        const bestInteracoes = best.ultima_interacao ? 1 : 0;
        const currentInteracoes = current.ultima_interacao ? 1 : 0;
        if (currentInteracoes > bestInteracoes) return current;
        if (currentInteracoes < bestInteracoes) return best;
        
        // 4. Preferir mais antigo (primeiro criado)
        return new Date(current.created_date) < new Date(best.created_date) ? current : best;
      });
      
      console.log(`[DEDUPE]   ✅ Principal: ${principal.id} (${principal.tipo_contato})`);
      
      // Processar duplicatas
      for (const duplicate of contacts) {
        if (duplicate.id === principal.id) continue;
        
        try {
          // Reapontar threads
          let threads = [];
          try {
            threads = await base44.asServiceRole.entities.MessageThread.filter({
              contact_id: duplicate.id
            }, '-created_date', 1000);
          } catch (e) {
            console.warn(`[DEDUPE] Aviso ao buscar threads: ${e.message}`);
          }
          
          for (const thread of threads) {
            try {
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                contact_id: principal.id
              });
              stats.threads_updated++;
            } catch (e) {
              console.error(`[DEDUPE] Erro ao atualizar thread ${thread.id}:`, e.message);
              stats.errors++;
              stats.errors_details.push(`Thread ${thread.id}: ${e.message}`);
            }
          }
          
          // Reapontar mensagens diretas (se houver sender_id = contact)
          let messages = [];
          try {
            messages = await base44.asServiceRole.entities.Message.filter({
              sender_id: duplicate.id,
              sender_type: 'contact'
            }, '-created_date', 1000);
          } catch (e) {
            console.warn(`[DEDUPE] Aviso ao buscar mensagens: ${e.message}`);
          }
          
          for (const message of messages) {
            try {
              await base44.asServiceRole.entities.Message.update(message.id, {
                sender_id: principal.id
              });
              stats.messages_updated++;
            } catch (e) {
              console.error(`[DEDUPE] Erro ao atualizar mensagem ${message.id}:`, e.message);
              stats.errors++;
              stats.errors_details.push(`Message ${message.id}: ${e.message}`);
            }
          }
          
          // Marcar duplicata como merged
          try {
            await base44.asServiceRole.entities.Contact.update(duplicate.id, {
              tipo_contato: 'novo',
              tags: [...(duplicate.tags || []), 'merged', 'duplicata'],
              observacoes: `[MERGED] Consolidado em ${principal.id} em ${new Date().toISOString()}\n\n${duplicate.observacoes || ''}`
            });
            
            stats.contacts_merged++;
            console.log(`[DEDUPE]   ♻️ Merged: ${duplicate.id}`);
          } catch (e) {
            console.error(`[DEDUPE] Erro ao marcar duplicata ${duplicate.id}:`, e.message);
            stats.errors++;
            stats.errors_details.push(`Contact merge ${duplicate.id}: ${e.message}`);
          }
          
        } catch (error) {
          console.error(`[DEDUPE]   ❌ Erro ao processar ${duplicate.id}:`, error.message);
          stats.errors++;
          stats.errors_details.push(`Duplicate ${duplicate.id}: ${error.message}`);
        }
      }
    }
    
    console.log('[DEDUPE] ✅ Concluído:', stats);
    
    return Response.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString(),
      version: VERSION
    }, { headers });
    
  } catch (error) {
    console.error('[DEDUPE] ERRO GERAL:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers });
  }
});