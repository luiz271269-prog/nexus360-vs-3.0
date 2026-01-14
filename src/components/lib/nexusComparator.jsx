/**
 * ═══════════════════════════════════════════════════════════════
 * NEXUS360 COMPARATOR - Shadow Engine
 * ═══════════════════════════════════════════════════════════════
 * 
 * Compara decisões LEGADO vs NEXUS360 para validação matemática.
 * Usado apenas para diagnóstico - não afeta runtime.
 */

import { canUserSeeThreadBase, buildUserPermissions, diagnosticarVisibilidadeThread } from './permissionsService';

/**
 * Simula decisão do sistema LEGADO (como está hoje).
 * 
 * @param {Object} user - Usuário completo
 * @param {Object} thread - Thread a verificar
 * @returns {Object} { decision: boolean, motivo: string }
 */
export function calcularDecisaoLegado(user, thread) {
  if (!user || !thread) {
    return { decision: false, motivo: 'Dados inválidos' };
  }
  
  // REPRODUZIR lógica atual (simplificada para teste)
  // Você pode importar a função real do threadVisibility.js se preferir
  
  // Admin vê tudo
  if (user.role === 'admin') {
    return { decision: true, motivo: 'Admin - acesso total (legado)' };
  }
  
  // Thread interna - verificar participação
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    const isParticipant = thread.participants?.includes(user.id);
    return {
      decision: isParticipant,
      motivo: isParticipant ? 'Participante thread interna (legado)' : 'Não participante (legado)'
    };
  }
  
  // Thread atribuída ao usuário
  if (thread.assigned_user_id === user.id) {
    return { decision: true, motivo: 'Thread atribuída (legado)' };
  }
  
  // Contato fidelizado
  const setor = user.attendant_sector;
  const camposFidelizacao = {
    vendas: 'atendente_fidelizado_vendas',
    assistencia: 'atendente_fidelizado_assistencia',
    financeiro: 'atendente_fidelizado_financeiro',
    fornecedor: 'atendente_fidelizado_fornecedor'
  };
  
  const campoFidelizacao = camposFidelizacao[setor];
  if (thread.contact?.is_cliente_fidelizado && thread.contact?.[campoFidelizacao] === user.email) {
    return { decision: true, motivo: 'Contato fidelizado (legado)' };
  }
  
  // Bloqueio: fidelizado a outro
  if (thread.contact?.is_cliente_fidelizado && thread.contact?.[campoFidelizacao] && thread.contact?.[campoFidelizacao] !== user.email) {
    return { decision: false, motivo: 'Fidelizado a outro (legado)' };
  }
  
  // Bloqueio: atribuído a outro
  if (thread.assigned_user_id && thread.assigned_user_id !== user.id) {
    // Verificar se tem permissão podeVerTodasConversas
    const podeVerTodas = user.permissoes_comunicacao?.pode_ver_todas_conversas || false;
    if (!podeVerTodas) {
      return { decision: false, motivo: 'Atribuído a outro (legado)' };
    }
  }
  
  // Janela 24h (simplificado)
  if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
    const horas = (Date.now() - new Date(thread.last_inbound_at)) / (1000 * 60 * 60);
    if (horas < 24) {
      return { decision: true, motivo: `Janela 24h ativa (${horas.toFixed(1)}h) - legado` };
    }
  }
  
  // Default: liberado (legado também é permissivo)
  return { decision: true, motivo: 'Default liberado (legado)' };
}

/**
 * Analisa divergência entre legado e Nexus360.
 * 
 * @param {Object} user - Usuário completo
 * @param {Object} thread - Thread a verificar
 * @param {Array} allIntegracoes - Lista de integrações WhatsApp
 * @returns {Object} Resultado da comparação
 */
export function analyzeDivergence(user, thread, allIntegracoes = []) {
  // 1. Decisão LEGADO
  const legado = calcularDecisaoLegado(user, thread);
  
  // 2. Decisão NEXUS360
  const userPermissions = buildUserPermissions(user, allIntegracoes);
  const nexus = {
    decision: canUserSeeThreadBase(userPermissions, thread, thread.contact),
    diagnostico: diagnosticarVisibilidadeThread(userPermissions, thread, thread.contact)
  };
  
  // 3. Comparação
  const isMatch = legado.decision === nexus.decision;
  
  let reason = "✅ Decisões idênticas";
  let severity = "success";
  
  if (!isMatch) {
    if (legado.decision && !nexus.decision) {
      reason = "🚨 CRÍTICO: Legado permite mas Nexus bloqueia (Falso Negativo)";
      severity = "error";
    } else {
      reason = "⚠️ ALERTA: Legado bloqueia mas Nexus permite (Falso Positivo)";
      severity = "warning";
    }
  }
  
  return {
    threadId: thread.id,
    contactName: thread.contact?.nome || thread.last_message_sender_name || "Desconhecido",
    threadType: thread.thread_type || 'contact_external',
    
    // Decisões
    legacyDecision: legado.decision,
    legacyMotivo: legado.motivo,
    
    nexusDecision: nexus.decision,
    nexusMotivo: nexus.diagnostico?.motivo || 'N/A',
    nexusReasonCode: nexus.diagnostico?.reason_code || 'N/A',
    nexusDecisionPath: nexus.diagnostico?.decision_path || [],
    
    // Comparação
    isMatch,
    reason,
    severity,
    
    // Debug
    threadData: {
      assigned: thread.assigned_user_id,
      sector: thread.sector_id,
      integration: thread.whatsapp_integration_id,
      channel: thread.channel
    }
  };
}

/**
 * Executa análise em lote de múltiplas threads.
 * 
 * @param {Object} user - Usuário
 * @param {Array} threads - Lista de threads
 * @param {Array} allIntegracoes - Integrações
 * @returns {Object} Estatísticas + resultados
 */
export function executarAnaliseEmLote(user, threads, allIntegracoes = []) {
  const resultados = threads.map(thread => analyzeDivergence(user, thread, allIntegracoes));
  
  const stats = {
    total: resultados.length,
    matches: resultados.filter(r => r.isMatch).length,
    divergencias: resultados.filter(r => !r.isMatch).length,
    criticosFalsoNegativo: resultados.filter(r => r.severity === 'error').length,
    alertasFalsoPositivo: resultados.filter(r => r.severity === 'warning').length,
    taxa_aderencia: resultados.length > 0 ? (resultados.filter(r => r.isMatch).length / resultados.length * 100).toFixed(1) : 0
  };
  
  return {
    stats,
    resultados,
    timestamp: new Date().toISOString()
  };
}