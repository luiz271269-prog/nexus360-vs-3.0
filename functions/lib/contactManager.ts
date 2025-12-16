// ============================================================================
// GERENCIADOR ÚNICO DE CONTATOS - UPSERT & DEDUPE
// ============================================================================
// Garante contato único por telefone + instância
// Evita duplicação em todos os pontos de entrada
// ============================================================================

import { normalizePhone } from './phoneNormalizer.js';

/**
 * Busca ou cria contato (UPSERT) - fonte única da verdade
 * @param {object} base44 - SDK Base44
 * @param {object} data - Dados do contato
 * @returns {object} - Contact
 */
export async function getOrCreateContact(base44, data) {
  const { telefone, nome, instance_id, profilePicUrl, pushName } = data;
  
  // Normalizar telefone
  const phoneE164 = normalizePhone(telefone);
  if (!phoneE164) {
    throw new Error(`Telefone inválido: ${telefone}`);
  }
  
  // Buscar contato existente (por telefone canônico)
  const existing = await base44.asServiceRole.entities.Contact.filter({
    telefone: phoneE164
  }, '-created_date', 1);
  
  const now = new Date().toISOString();
  
  if (existing.length > 0) {
    // ATUALIZAR contato existente
    const contact = existing[0];
    
    const updateData = {
      ultima_interacao: now
    };
    
    // Atualizar nome se melhorar qualidade
    if (nome && nome !== phoneE164 && (!contact.nome || contact.nome === phoneE164)) {
      updateData.nome = nome;
    }
    
    // Atualizar pushName se disponível
    if (pushName && pushName !== phoneE164 && pushName !== nome) {
      updateData.nome = pushName;
    }
    
    // Atualizar foto de perfil
    if (profilePicUrl && profilePicUrl !== 'null' && contact.foto_perfil_url !== profilePicUrl) {
      updateData.foto_perfil_url = profilePicUrl;
      updateData.foto_perfil_atualizada_em = now;
    }
    
    // Atualizar conexão de origem (se não tinha)
    if (instance_id && !contact.conexao_origem) {
      updateData.conexao_origem = instance_id;
    }
    
    // Aplicar update
    await base44.asServiceRole.entities.Contact.update(contact.id, updateData);
    
    // Retornar contato atualizado
    return { ...contact, ...updateData };
  }
  
  // CRIAR novo contato
  const newContact = await base44.asServiceRole.entities.Contact.create({
    nome: pushName || nome || phoneE164,
    telefone: phoneE164,
    tipo_contato: 'lead',
    whatsapp_status: 'verificado',
    ultima_interacao: now,
    foto_perfil_url: profilePicUrl && profilePicUrl !== 'null' ? profilePicUrl : null,
    foto_perfil_atualizada_em: profilePicUrl ? now : null,
    conexao_origem: instance_id || null
  });
  
  return newContact;
}

/**
 * Busca ou cria thread (UPSERT) - uma thread por contact + instância
 * @param {object} base44 - SDK Base44
 * @param {object} data - Dados da thread
 * @returns {object} - MessageThread
 */
export async function getOrCreateThread(base44, data) {
  const { contact_id, integration_id, instance_id } = data;
  
  // Buscar thread existente (por contact_id)
  // REGRA: Uma thread por contact (não criar múltiplas por setor)
  const existing = await base44.asServiceRole.entities.MessageThread.filter({
    contact_id: contact_id
  }, '-last_message_at', 1);
  
  const now = new Date().toISOString();
  
  if (existing.length > 0) {
    // REUTILIZAR thread existente
    const thread = existing[0];
    
    const updateData = {
      last_message_at: now,
      last_message_sender: 'contact',
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta'
    };
    
    // Atualizar integração se não tinha
    if (integration_id && !thread.whatsapp_integration_id) {
      updateData.whatsapp_integration_id = integration_id;
    }
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
    
    return { ...thread, ...updateData };
  }
  
  // CRIAR nova thread
  const newThread = await base44.asServiceRole.entities.MessageThread.create({
    contact_id: contact_id,
    whatsapp_integration_id: integration_id,
    status: 'aberta',
    primeira_mensagem_at: now,
    last_message_at: now,
    last_message_sender: 'contact',
    total_mensagens: 1,
    unread_count: 1,
    pre_atendimento_setor_explicitamente_escolhido: false,
    pre_atendimento_ativo: false,
    pre_atendimento_state: 'INIT',
    transfer_pending: false
  });
  
  return newThread;
}

/**
 * Atualiza thread com conteúdo da mensagem (sem criar nova)
 * @param {object} base44 - SDK Base44
 * @param {string} threadId - ID da thread
 * @param {object} messageData - Dados da mensagem
 */
export async function updateThreadWithMessage(base44, threadId, messageData) {
  const { content, mediaType, sender } = messageData;
  
  const updateData = {
    last_message_at: new Date().toISOString(),
    last_message_sender: sender || 'contact',
    last_message_content: (content || '').substring(0, 100),
    last_media_type: mediaType || 'none'
  };
  
  await base44.asServiceRole.entities.MessageThread.update(threadId, updateData);
}