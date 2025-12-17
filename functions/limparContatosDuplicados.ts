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

  console.log('[DEDUPE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DEDUPE] INICIANDO PROCESSO DE LIMPEZA');
  
  let base44;
  try {
    console.log('[DEDUPE] STEP 1 - Inicializando SDK...');
    base44 = createClientFromRequest(req);
    console.log('[DEDUPE] STEP 1 - SDK OK');
  } catch (e) {
    console.error('[DEDUPE] ❌ STEP 1 FALHOU:', e.message, e.stack);
    return Response.json({ 
      success: false, 
      error: 'Erro ao inicializar SDK: ' + e.message,
      stack: e.stack
    }, { status: 500, headers });
  }
  
  try {
    console.log('[DEDUPE] STEP 2 - Buscando contatos (limite 2000)...');
    
    // ✅ REDUZIR LIMITE: 5000 pode causar timeout/rate limit
    let allContacts;
    try {
      allContacts = await base44.asServiceRole.entities.Contact.list('-created_date', 2000);
      console.log('[DEDUPE] STEP 2 - Contatos carregados:', allContacts.length);
    } catch (e) {
      console.error('[DEDUPE] ❌ STEP 2 FALHOU:', e.message, e.stack);
      throw new Error(`Erro ao buscar contatos: ${e.message}`);
    }
    
    if (!allContacts || allContacts.length === 0) {
      return Response.json({
        success: true,
        message: 'Nenhum contato encontrado',
        stats: { total_groups: 0, duplicates_found: 0 }
      }, { headers });
    }
    
    console.log('[DEDUPE] STEP 3 - Agrupando por telefone normalizado...');
    
    // Agrupar por telefone normalizado
    const groups = new Map();
    let contatosSemTelefone = 0;
    let telefonesInvalidos = 0;
    
    for (const contact of allContacts) {
      if (!contact.telefone) {
        contatosSemTelefone++;
        continue;
      }
      
      const normalized = normalizePhone(contact.telefone);
      if (!normalized) {
        telefonesInvalidos++;
        continue;
      }
      
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized).push(contact);
    }
    
    console.log('[DEDUPE] STEP 3 - Agrupamento concluído:', {
      total_grupos: groups.size,
      sem_telefone: contatosSemTelefone,
      telefones_invalidos: telefonesInvalidos
    });
    
    console.log('[DEDUPE] STEP 4 - Iniciando processamento de duplicatas...');
    
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
    
    let gruposProcessados = 0;
    const MAX_DUPLICATES = 50; // ✅ LIMITAR processamento para evitar timeout
    
    // Processar grupos com duplicatas
    for (const [phone, contacts] of groups) {
      if (contacts.length === 1) continue; // Sem duplicata
      
      stats.duplicates_found++;
      
      // ✅ LIMITE: Processar no máximo 50 grupos duplicados por execução
      if (gruposProcessados >= MAX_DUPLICATES) {
        console.log(`[DEDUPE] ⚠️ Limite de ${MAX_DUPLICATES} grupos atingido, pausando...`);
        break;
      }
      gruposProcessados++;
      
      console.log(`[DEDUPE] 🔍 [${gruposProcessados}/${Math.min(stats.duplicates_found, MAX_DUPLICATES)}] Duplicata: ${phone} (${contacts.length} registros)`);
      
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
          // ✅ BATCH UPDATE: Usar update_entities para evitar rate limit
          try {
            // Reapontar threads EM LOTE
            const threadCount = await base44.asServiceRole.entities.MessageThread.filter({
              contact_id: duplicate.id
            }, '-created_date', 1);
            
            if (threadCount && threadCount.length > 0) {
              // Usar API direta de update múltiplo (mais eficiente)
              const updateResult = await fetch(
                `${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/entities/MessageThread/update-many`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`
                  },
                  body: JSON.stringify({
                    query: { contact_id: duplicate.id },
                    data: { contact_id: principal.id }
                  })
                }
              );
              
              if (updateResult.ok) {
                const result = await updateResult.json();
                stats.threads_updated += result.updated_count || 0;
              }
            }
          } catch (e) {
            console.warn(`[DEDUPE] Erro ao reapontar threads:`, e.message);
            stats.errors++;
            stats.errors_details.push(`Threads do ${duplicate.id}: ${e.message}`);
          }
          
          // ✅ Reapontar mensagens EM LOTE
          try {
            const msgCount = await base44.asServiceRole.entities.Message.filter({
              sender_id: duplicate.id,
              sender_type: 'contact'
            }, '-created_date', 1);
            
            if (msgCount && msgCount.length > 0) {
              const updateResult = await fetch(
                `${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/entities/Message/update-many`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`
                  },
                  body: JSON.stringify({
                    query: { sender_id: duplicate.id, sender_type: 'contact' },
                    data: { sender_id: principal.id }
                  })
                }
              );
              
              if (updateResult.ok) {
                const result = await updateResult.json();
                stats.messages_updated += result.updated_count || 0;
              }
            }
          } catch (e) {
            console.warn(`[DEDUPE] Erro ao reapontar mensagens:`, e.message);
            stats.errors++;
            stats.errors_details.push(`Messages do ${duplicate.id}: ${e.message}`);
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
    
    console.log('[DEDUPE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[DEDUPE] ✅ CONCLUÍDO:', stats);
    console.log('[DEDUPE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return Response.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString(),
      version: VERSION,
      warning: stats.duplicates_found > MAX_DUPLICATES ? `Processados ${MAX_DUPLICATES} de ${stats.duplicates_found} duplicatas. Execute novamente para continuar.` : null
    }, { headers });
    
  } catch (error) {
    console.error('[DEDUPE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[DEDUPE] ❌ ERRO GERAL:', error.message);
    console.error('[DEDUPE] ❌ Stack:', error.stack);
    console.error('[DEDUPE] ❌ Full:', JSON.stringify(error, null, 2));
    console.error('[DEDUPE] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack,
      version: VERSION
    }, { status: 500, headers });
  }
});