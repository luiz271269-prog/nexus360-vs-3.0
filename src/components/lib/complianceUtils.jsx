/**
 * ═══════════════════════════════════════════════════════════
 * COMPLIANCE UTILS - VendaPro v3.0
 * ═══════════════════════════════════════════════════════════
 */

export function isJanelaAtiva(thread) {
  if (!thread || !thread.janela_24h_expira_em) {
    return false;
  }
  
  const agora = new Date();
  const expiracao = new Date(thread.janela_24h_expira_em);
  
  return expiracao > agora;
}

export function getTempoRestanteJanela(thread) {
  if (!thread || !thread.janela_24h_expira_em) {
    return 0;
  }
  
  const agora = new Date();
  const expiracao = new Date(thread.janela_24h_expira_em);
  const diffMs = expiracao - agora;
  
  return Math.floor(diffMs / (1000 * 60));
}

export function hasOptIn(contact) {
  if (!contact) {
    return false;
  }
  
  return contact.whatsapp_optin === true;
}

export function formatarTempoRestante(thread) {
  const minutosRestantes = getTempoRestanteJanela(thread);
  
  if (minutosRestantes === 0) {
    return "Sem janela";
  }
  
  if (minutosRestantes < 0) {
    return "Expirada";
  }
  
  const horas = Math.floor(minutosRestantes / 60);
  const minutos = minutosRestantes % 60;
  
  if (horas > 0) {
    return `${horas}h ${minutos}m`;
  }
  
  return `${minutos}m`;
}

export function isJanelaExpirandoEmBreve(thread) {
  const minutosRestantes = getTempoRestanteJanela(thread);
  return minutosRestantes > 0 && minutosRestantes < 120;
}

export function getAcaoRecomendada(thread, contact) {
  const janelaAtiva = isJanelaAtiva(thread);
  const temOptIn = hasOptIn(contact);
  
  if (!temOptIn) {
    return {
      acao: 'solicitar_optin',
      mensagem: 'Solicitar consentimento (opt-in) antes de enviar mensagens',
      prioridade: 'alta',
      pode_enviar: false
    };
  }
  
  if (janelaAtiva) {
    const expirandoEmBreve = isJanelaExpirandoEmBreve(thread);
    
    return {
      acao: 'mensagem_livre',
      mensagem: expirandoEmBreve 
        ? `Janela expira em ${formatarTempoRestante(thread)}. Responda rápido!`
        : 'Pode enviar mensagem livre',
      prioridade: expirandoEmBreve ? 'media' : 'normal',
      pode_enviar: true,
      tipo_envio: 'livre'
    };
  }
  
  return {
    acao: 'usar_template',
    mensagem: 'Janela expirada. Use template aprovado pela Meta',
    prioridade: 'alta',
    pode_enviar: true,
    tipo_envio: 'template'
  };
}