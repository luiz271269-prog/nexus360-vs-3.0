// ============================================================================
// GERENCIADOR ÚNICO DE CONTATOS - UPSERT & DEDUPE
// ============================================================================
// Garante contato único por telefone + instância
// Evita duplicação em todos os pontos de entrada
// ============================================================================

import { normalizePhone } from './phoneNormalizer.js';

/**
 * Busca ou cria contato (UPSERT) - fonte única da verdade
 * ✅ REGRA CRÍTICA: Contato é ÚNICO por telefone (independente de provedor/conexão)
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
  
  // 🔍 BUSCA INTELIGENTE: Tentar TODAS variações para evitar duplicatas
  const telefoneBase = phoneE164.replace(/\D/g, '');
  const variacoes = [
    phoneE164,                                    // +5548999322400 (normalizado)
    telefoneBase,                                 // 5548999322400 (sem +)
  ];
  
  // Se tem 13 dígitos (55+DDD+9+8), também buscar sem o 9
  if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
    const ddd = telefoneBase.substring(2, 4);
    const numero = telefoneBase.substring(5);
    variacoes.push(`+55${ddd}${numero}`);        // +554899322400
    variacoes.push(`55${ddd}${numero}`);         // 554899322400
  }
  
  // Se tem 12 dígitos (55+DDD+8), também buscar com o 9
  if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
    const ddd = telefoneBase.substring(2, 4);
    const numero = telefoneBase.substring(4);
    variacoes.push(`+55${ddd}9${numero}`);       // +5548999322400
    variacoes.push(`55${ddd}9${numero}`);        // 5548999322400
  }
  
  // ✅ BUSCAR em TODAS variações (evita duplicatas por má normalização anterior)
  let existing = null;
  for (const variacao of variacoes) {
    const result = await base44.asServiceRole.entities.Contact.filter({
      telefone: variacao
    }, '-created_date', 1);
    
    if (result.length > 0) {
      existing = result[0];
      console.log(`[contactManager] ✅ Contato encontrado via variação: ${variacao} -> ID: ${existing.id}`);
      break;
    }
  }
  
  const now = new Date().toISOString();
  
  if (existing) {
    // ✅ ATUALIZAR contato existente (preserva assigned_user_id, vendedor_responsavel, etc.)
    const contact = existing;
    
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
    
    // Atualizar foto de perfil (se fornecida)
    if (profilePicUrl && profilePicUrl !== 'null' && contact.foto_perfil_url !== profilePicUrl) {
      updateData.foto_perfil_url = profilePicUrl;
      updateData.foto_perfil_atualizada_em = now;
    }
    
    // ✅ REMOVIDO: Não atualizar conexao_origem
    // Contact é independente de provedor/instância
    
    // ✅ GARANTIR telefone normalizado no update (corrigir variações antigas)
    if (contact.telefone !== phoneE164) {
      console.log(`[contactManager] 🔧 Normalizando telefone: ${contact.telefone} -> ${phoneE164}`);
      updateData.telefone = phoneE164;
    }
    
    // Aplicar update
    await base44.asServiceRole.entities.Contact.update(contact.id, updateData);
    
    // ✅ SE não tem foto, buscar via API WhatsApp (Z-API não envia no webhook)
    const contatoAtualizado = { ...contact, ...updateData };
    if (!contatoAtualizado.foto_perfil_url) {
      console.log(`[contactManager] 📸 Contato sem foto, tentando buscar via API...`);
      // Retorna contato sem foto (será buscada later por worker assíncrono)
      contatoAtualizado._buscar_foto_depois = true;
    }
    
    // Retornar contato atualizado
    return contatoAtualizado;
  }
  
  // ✅ CRIAR novo contato SEM conexao_origem
  // Contact não pertence a nenhuma conexão específica
  console.log(`[contactManager] 🆕 Criando novo contato: ${phoneE164}`);
  const newContact = await base44.asServiceRole.entities.Contact.create({
    nome: pushName || nome || phoneE164,
    telefone: phoneE164,
    tipo_contato: 'lead',
    whatsapp_status: 'verificado',
    ultima_interacao: now,
    foto_perfil_url: profilePicUrl && profilePicUrl !== 'null' ? profilePicUrl : null,
    foto_perfil_atualizada_em: profilePicUrl ? now : null,
    conexao_origem: null // ✅ Sempre null - independente de provedor
  });
  
  return newContact;
}

/**
 * Busca ou cria thread (UPSERT) - MÚLTIPLAS threads por contact (uma por integração)
 * ✅ CORRIGIDO: Permite threads separadas para Z-API, W-API, Instagram, etc.
 * @param {object} base44 - SDK Base44
 * @param {object} data - Dados da thread
 * @returns {object} - MessageThread
 */
export async function getOrCreateThread(base44, data) {
  const { contact_id, integration_id, instance_id } = data;
  
  // ✅ BUSCAR THREAD EXISTENTE - Por contact_id + integration_id
  // REGRA: Um contato pode ter múltiplas threads (uma por canal/integração)
  // Exemplo: Contato X tem thread Z-API + thread W-API + thread Instagram
  const existing = await base44.asServiceRole.entities.MessageThread.filter({
    contact_id: contact_id,
    whatsapp_integration_id: integration_id
  }, '-last_message_at', 1);
  
  const now = new Date().toISOString();
  
  if (existing.length > 0) {
    // REUTILIZAR thread existente DESTA integração
    const thread = existing[0];
    
    const updateData = {
      last_message_at: now,
      last_message_sender: 'contact',
      unread_count: (thread.unread_count || 0) + 1,
      total_mensagens: (thread.total_mensagens || 0) + 1,
      status: 'aberta'
    };
    
    // Manter integração (não precisa atualizar, já está na busca)
    await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
    
    return { ...thread, ...updateData };
  }
  
  // ✅ CRIAR nova thread PARA ESTA integração
  // Contact único pode ter N threads (uma por canal)
  const newThread = await base44.asServiceRole.entities.MessageThread.create({
    contact_id: contact_id,
    whatsapp_integration_id: integration_id,
    conexao_id: integration_id,
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