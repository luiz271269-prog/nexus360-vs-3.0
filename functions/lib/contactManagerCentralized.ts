// ============================================================================
// ✅ GERENCIADOR CENTRALIZADO DE CONTATOS - FONTE ÚNICA DA VERDADE
// ============================================================================
// CRÍTICO: Esta é a ÚNICA função que cria/atualiza contatos
// Todas as conexões (Z-API, W-API, Instagram, Facebook, GoTo) chamam isto
// Garante deduplicação atômica, normalização única, sem variações
// ============================================================================

import { normalizePhone } from './phoneNormalizer.js';

/**
 * Busca foto de perfil via Z-API (async, sem bloquear)
 * @param {object} base44 - SDK Base44
 * @param {string} integrationId - ID da integração Z-API
 * @param {string} contactId - ID do contato
 * @param {string} phoneE164 - Telefone normalizado
 */
async function buscarFotoPerfilAsync(base44, integrationId, contactId, phoneE164) {
  try {
    if (!integrationId) {
      console.log(`[CONTACT-MANAGER-CENTRAL] ⏭️ Nenhuma integração para buscar foto`);
      return;
    }

    // Invocar função de busca de foto (non-blocking)
    await base44.asServiceRole.functions.invoke('buscarFotoPerfilWhatsApp', {
      integration_id: integrationId,
      contact_id: contactId,
      phone: phoneE164
    }).catch(err => {
      console.warn(`[CONTACT-MANAGER-CENTRAL] ⚠️ Erro ao buscar foto (não bloqueia): ${err.message}`);
      // Não lança erro - falha silenciosa
    });
  } catch (e) {
    console.warn(`[CONTACT-MANAGER-CENTRAL] ⚠️ Exception ao agendar busca de foto:`, e.message);
  }
}

/**
 * Busca ou cria contato de forma centralizada
 * @param {object} base44 - SDK Base44
 * @param {string} rawPhone - Telefone em qualquer formato
 * @param {string} nome - Nome do contato
 * @param {string} profilePicUrl - URL da foto de perfil (ou null para buscar)
 * @param {string} pushName - Nome do WhatsApp
 * @param {string} integrationId - ID da integração (para buscar foto se null)
 * @returns {object} - Contact atualizado/criado
 */
export async function getOrCreateContactCentralized(base44, rawPhone, nome, profilePicUrl, pushName, integrationId = null) {
  console.log(`[CONTACT-MANAGER-CENTRAL] 🎯 Processando contato: ${rawPhone} (nome: ${nome || 'N/A'})`);
  
  // ✅ NORMALIZAR telefone único
  const phoneE164 = normalizePhone(rawPhone);
  if (!phoneE164) {
    throw new Error(`[CONTACT-MANAGER] Telefone inválido: ${rawPhone}`);
  }
  
  // 🔍 BUSCA INTELIGENTE: 6 variações para evitar duplicatas
  const telefoneBase = phoneE164.replace(/\D/g, '');
  const variacoes = [
    phoneE164,                                    // +5548999322400
    telefoneBase,                                 // 5548999322400
  ];
  
  // Se tem 13 dígitos (55+DDD+9+8), também buscar sem o 9
  if (telefoneBase.length === 13 && telefoneBase.startsWith('55')) {
    const ddd = telefoneBase.substring(2, 4);
    const numero = telefoneBase.substring(5);
    variacoes.push(`+55${ddd}${numero}`);
    variacoes.push(`55${ddd}${numero}`);
  }
  
  // Se tem 12 dígitos (55+DDD+8), também buscar com o 9
  if (telefoneBase.length === 12 && telefoneBase.startsWith('55')) {
    const ddd = telefoneBase.substring(2, 4);
    const numero = telefoneBase.substring(4);
    variacoes.push(`+55${ddd}9${numero}`);
    variacoes.push(`55${ddd}9${numero}`);
  }
  
  // ✅ BUSCAR em TODAS variações
  let existing = null;
  for (const variacao of variacoes) {
    try {
      const result = await base44.asServiceRole.entities.Contact.filter({
        telefone: variacao
      }, '-created_date', 1);
      
      if (result && result.length > 0) {
        existing = result[0];
        console.log(`[CONTACT-MANAGER-CENTRAL] ✅ Contato ENCONTRADO via variação: ${variacao} -> ID: ${existing.id}`);
        break;
      }
    } catch (e) {
      console.warn(`[CONTACT-MANAGER-CENTRAL] ⚠️ Erro ao buscar variação ${variacao}:`, e.message);
    }
  }
  
  const now = new Date().toISOString();
  
  if (existing) {
    // ✅ ATUALIZAR contato existente (PRESERVA TUDO: assigned_user_id, vendedor, fidelização, cliente_id)
    console.log(`[CONTACT-MANAGER-CENTRAL] 🔄 Atualizando contato existente ID: ${existing.id}`);
    
    const updateData = {
      ultima_interacao: now
    };
    
    // Atualizar nome apenas se melhorar qualidade
    if (nome && nome !== phoneE164 && (!existing.nome || existing.nome === phoneE164)) {
      updateData.nome = nome;
      console.log(`[CONTACT-MANAGER-CENTRAL] 📝 Nome atualizado: ${nome}`);
    }
    
    // Atualizar pushName se disponível e melhor
    if (pushName && pushName !== phoneE164 && pushName !== nome && pushName !== existing.nome) {
      updateData.nome = pushName;
      console.log(`[CONTACT-MANAGER-CENTRAL] 📝 PushName atualizado: ${pushName}`);
    }
    
    // ✅ CRÍTICO: Atualizar FOTO mesmo em contato existente
    if (profilePicUrl && profilePicUrl !== 'null' && profilePicUrl !== existing.foto_perfil_url) {
      updateData.foto_perfil_url = profilePicUrl;
      updateData.foto_perfil_atualizada_em = now;
      console.log(`[CONTACT-MANAGER-CENTRAL] 📸 Foto atualizada: ${profilePicUrl?.substring(0, 60)}...`);
    }
    
    // ✅ Normalizar telefone se necessário (corrigir má normalização passada)
    if (existing.telefone !== phoneE164) {
      console.log(`[CONTACT-MANAGER-CENTRAL] 🔧 Normalizando telefone: ${existing.telefone} -> ${phoneE164}`);
      updateData.telefone = phoneE164;
    }
    
    // Aplicar update
    try {
      await base44.asServiceRole.entities.Contact.update(existing.id, updateData);
      console.log(`[CONTACT-MANAGER-CENTRAL] ✅ Contato atualizado com sucesso`);
    } catch (e) {
      console.error(`[CONTACT-MANAGER-CENTRAL] ❌ Erro ao atualizar contato:`, e.message);
      throw e;
    }
    
    // ✅ SE não tem foto E tem integração, BUSCAR depois (async, non-blocking)
    const contatoAtualizado = { ...existing, ...updateData };
    if (!contatoAtualizado.foto_perfil_url && integrationId) {
      console.log(`[CONTACT-MANAGER-CENTRAL] 📸 Agendando busca de foto (contato ID: ${existing.id})`);
      buscarFotoPerfilAsync(base44, integrationId, existing.id, phoneE164);
    }
    
    // Retornar contato atualizado
    return contatoAtualizado;
  }
  
  // ✅ CRIAR novo contato (SÓ cria se realmente não existe)
  console.log(`[CONTACT-MANAGER-CENTRAL] 🆕 Criando novo contato: ${phoneE164}`);
  
  try {
    const newContact = await base44.asServiceRole.entities.Contact.create({
      nome: pushName || nome || phoneE164,
      telefone: phoneE164,
      tipo_contato: 'lead',
      whatsapp_status: 'verificado',
      ultima_interacao: now,
      foto_perfil_url: profilePicUrl && profilePicUrl !== 'null' ? profilePicUrl : null,
      foto_perfil_atualizada_em: profilePicUrl && profilePicUrl !== 'null' ? now : null,
    });
    
    console.log(`[CONTACT-MANAGER-CENTRAL] ✅ Novo contato criado: ID ${newContact.id}`);
    return newContact;
  } catch (e) {
    console.error(`[CONTACT-MANAGER-CENTRAL] ❌ Erro ao criar contato:`, e.message);
    throw e;
  }
}