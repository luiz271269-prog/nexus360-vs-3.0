/**
 * ═══════════════════════════════════════════════════════════
 * AUTOMATION LOGGER - VendaPro
 * ═══════════════════════════════════════════════════════════
 * 
 * Sistema centralizado de logging para ações automatizadas
 */

import { base44 } from "@/api/base44Client";

export async function logAutomacao(dados) {
  try {
    const logData = {
      acao: dados.acao,
      contato_id: dados.contato_id || null,
      thread_id: dados.thread_id || null,
      usuario_id: dados.usuario_id || null,
      integracao_id: dados.integracao_id || null,
      resultado: dados.resultado || 'sucesso',
      timestamp: new Date().toISOString(),
      detalhes: {
        mensagem: dados.mensagem || '',
        template_id: dados.template_id || null,
        erro_codigo: dados.erro_codigo || null,
        erro_mensagem: dados.erro_mensagem || null,
        tentativas: dados.tentativas || 1,
        tempo_execucao_ms: dados.tempo_execucao_ms || 0,
        dados_contexto: dados.dados_contexto || {}
      },
      origem: dados.origem || 'sistema',
      prioridade: dados.prioridade || 'normal',
      metadata: dados.metadata || {},
      reprocessavel: dados.reprocessavel !== false
    };

    const log = await base44.entities.AutomationLog.create(logData);
    
    console.log('[AUTOMATION_LOG] ✅ Log criado:', log.id, '-', dados.acao);
    
    return log;
    
  } catch (error) {
    console.error('[AUTOMATION_LOG] ❌ Erro ao criar log:', error);
    // Não lançar erro para não quebrar o fluxo principal
    return null;
  }
}

export async function logMensagemRecebida(thread, mensagem, tempoProcessamento) {
  return logAutomacao({
    acao: 'resposta_ia',
    thread_id: thread?.id,
    contato_id: thread?.contact_id,
    resultado: 'sucesso',
    mensagem: `Mensagem recebida: "${mensagem.content?.substring(0, 50)}..."`,
    tempo_execucao_ms: tempoProcessamento,
    dados_contexto: {
      media_type: mensagem.media_type,
      whatsapp_message_id: mensagem.whatsapp_message_id,
      janela_ativa: thread?.can_send_without_template
    }
  });
}

export async function logEnvioTemplate(thread, template, sucesso, erro = null) {
  return logAutomacao({
    acao: 'envio_template',
    thread_id: thread?.id,
    contato_id: thread?.contact_id,
    resultado: sucesso ? 'sucesso' : 'erro',
    template_id: template?.id,
    mensagem: sucesso 
      ? `Template "${template?.nome}" enviado com sucesso`
      : `Falha ao enviar template: ${erro}`,
    erro_mensagem: erro,
    dados_contexto: {
      template_nome: template?.nome,
      template_categoria: template?.categoria
    }
  });
}

export async function logOptInCapturado(contact, origem) {
  return logAutomacao({
    acao: 'envio_optin',
    contato_id: contact?.id,
    resultado: 'sucesso',
    mensagem: `Opt-in capturado de ${contact?.nome || contact?.telefone}`,
    dados_contexto: {
      origem_optin: origem,
      telefone: contact?.telefone,
      whatsapp_optin_data: contact?.whatsapp_optin_data
    }
  });
}

export async function logJanelaExpirada(thread) {
  return logAutomacao({
    acao: 'notificacao_expiracao_janela',
    thread_id: thread?.id,
    contato_id: thread?.contact_id,
    resultado: 'sucesso',
    mensagem: 'Janela de 24h expirada',
    prioridade: 'alta',
    dados_contexto: {
      janela_expirou_em: thread?.janela_24h_expira_em,
      ultimo_contato: thread?.last_message_at
    }
  });
}