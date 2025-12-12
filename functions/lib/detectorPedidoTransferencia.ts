// ============================================================================
// DETECTOR DE PEDIDO DE TRANSFERÊNCIA - Micro-URA
// ============================================================================
// Detecta quando o cliente pede transferência de setor/atendente
// mesmo quando já existe um atendente humano na conversa
// ============================================================================

const setorKeywords = {
  vendas: ['venda', 'vendas', 'comercial', '1'],
  assistencia: ['assistencia', 'assistência', 'suporte', 'tecnico', 'técnico', '2'],
  financeiro: ['financeiro', 'boleto', 'pagamento', 'cobrança', 'cobranca', '3'],
  fornecedor: ['fornecedor', 'compras', '4'],
  geral: ['geral', 'outro', '5']
};

/**
 * Detecta se a mensagem contém um pedido de transferência
 * @returns { solicitou: boolean, setor?: string, nome_atendente?: string, texto_original: string }
 */
export function detectarPedidoTransferencia(mensagem, todosAtendentes = []) {
  if (!mensagem || mensagem.trim().length === 0) {
    return { solicitou: false };
  }

  const textoLower = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const palavras = textoLower.split(/\s+/);

  // Padrões que indicam transferência
  const padroesPedido = [
    'quero', 'queria', 'gostaria', 'preciso', 'falar com', 'me passa', 
    'transfere', 'transferir', 'encaminhar', 'direcionar',
    'pode me passar', 'pode transferir'
  ];

  const contemPedido = padroesPedido.some(p => textoLower.includes(p));

  // Verificar menção de setor
  let setorDetectado = null;
  for (const [setor, keywords] of Object.entries(setorKeywords)) {
    if (keywords.some(k => textoLower.includes(k))) {
      setorDetectado = setor;
      break;
    }
  }

  // Verificar menção de nome de atendente
  let atendenteDetectado = null;
  let melhorScore = 0;
  
  for (const atendente of todosAtendentes) {
    if (!atendente.full_name) continue;
    
    const nomeNorm = atendente.full_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const primeiroNome = nomeNorm.split(' ')[0];
    
    for (const palavra of palavras) {
      if (palavra.length < 3) continue;
      
      // Match exato do primeiro nome
      if (palavra === primeiroNome) {
        if (melhorScore < 100) {
          melhorScore = 100;
          atendenteDetectado = atendente;
        }
      }
      // Match parcial
      else if (primeiroNome.startsWith(palavra) && palavra.length >= 3) {
        if (melhorScore < 80) {
          melhorScore = 80;
          atendenteDetectado = atendente;
        }
      }
    }
  }

  // Decisão final
  const solicitou = (contemPedido && (setorDetectado || atendenteDetectado)) || 
                    (setorDetectado && atendenteDetectado);

  if (!solicitou) {
    return { solicitou: false };
  }

  return {
    solicitou: true,
    setor: setorDetectado,
    nome_atendente: atendenteDetectado?.full_name,
    atendente_id: atendenteDetectado?.id,
    texto_original: mensagem.substring(0, 200)
  };
}

/**
 * Verifica se pode enviar pergunta (respeitando janela anti-spam)
 * @returns boolean
 */
export function podeEnviarPergunta(thread) {
  if (!thread.transfer_last_prompt_at) return true;
  
  const ultimaPergunta = new Date(thread.transfer_last_prompt_at);
  const agora = new Date();
  const diferencaMinutos = (agora - ultimaPergunta) / 1000 / 60;
  
  // Janela de 3 minutos
  return diferencaMinutos >= 3;
}

/**
 * Verifica se o pedido expirou
 * @returns boolean
 */
export function pedidoExpirou(thread) {
  if (!thread.transfer_expires_at) return false;
  return new Date(thread.transfer_expires_at) < new Date();
}