import { base44 } from "@/api/base44Client";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HELPER DE PRÉ-ATENDIMENTO - LÓGICA MODULAR                ║
 * ║  Gerencia o fluxo de seleção de setor e atendente         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const SETORES = [
  { id: 'vendas', numero: '1', emoji: '⿡', nome: 'Vendas' },
  { id: 'assistencia', numero: '2', emoji: '⿢', nome: 'Assistência' },
  { id: 'financeiro', numero: '3', emoji: '⿣', nome: 'Financeiro' },
  { id: 'fornecedor', numero: '4', emoji: '⿤', nome: 'Fornecedor' }
];

export async function gerarMensagemBoasVindas(nomeEmpresa = "VendaPro") {
  const opcoesSetores = SETORES.map(s => `${s.emoji} ${s.nome}`).join('\n');
  
  return `Bem-vindo(a) à *${nomeEmpresa}*! 👋

Escolha uma das opções abaixo para ser atendido:

${opcoesSetores}

_Digite o número da opção desejada._`;
}

export async function gerarMensagemEscolhaAtendente(setor, atendentes) {
  const setorInfo = SETORES.find(s => s.id === setor);
  
  if (!atendentes || atendentes.length === 0) {
    return `Desculpe, não há atendentes disponíveis no setor *${setorInfo?.nome}* no momento. 😔

Por favor, aguarde ou tente novamente mais tarde.`;
  }

  const opcoesAtendentes = atendentes.map((atendente, index) => {
    const emoji = index === 0 ? '⿡' : index === 1 ? '⿢' : '⿣';
    const generoEmoji = atendente.full_name?.toLowerCase().includes('a') ? '🙋‍♀' : '🙋‍♂';
    return `${emoji} ${atendente.full_name} ${generoEmoji}`;
  }).join('\n');

  return `Certo! No setor *${setorInfo?.nome}*, você deseja falar com:

${opcoesAtendentes}

_Digite o número do atendente desejado._`;
}

export async function buscarAtendentesDisponiveis(setor) {
  try {
    const atendentes = await base44.asServiceRole.entities.User.filter({
      is_whatsapp_attendant: true,
      attendant_sector: setor,
      availability_status: 'online'
    });

    // Filtrar por capacidade disponível
    const atendentesComCapacidade = atendentes.filter(atendente => {
      const cargaAtual = atendente.current_conversations_count || 0;
      const capacidadeMax = atendente.max_concurrent_conversations || 5;
      return cargaAtual < capacidadeMax;
    });

    // Ordenar por menor carga
    atendentesComCapacidade.sort((a, b) => {
      return (a.current_conversations_count || 0) - (b.current_conversations_count || 0);
    });

    return atendentesComCapacidade;
  } catch (error) {
    console.error('[PRE-ATENDIMENTO] Erro ao buscar atendentes:', error);
    return [];
  }
}

export function interpretarEscolha(mensagemCliente, opcoes) {
  const texto = mensagemCliente.trim().toLowerCase();
  
  // Tentar interpretar como número
  const numero = parseInt(texto);
  if (!isNaN(numero) && numero >= 1 && numero <= opcoes.length) {
    return opcoes[numero - 1];
  }

  // Tentar interpretar como nome parcial
  for (const opcao of opcoes) {
    const nomeOpcao = (opcao.nome || opcao.full_name || '').toLowerCase();
    if (nomeOpcao.includes(texto) || texto.includes(nomeOpcao)) {
      return opcao;
    }
  }

  return null;
}

export async function atribuirConversaAoAtendente(threadId, atendenteId) {
  try {
    const atendente = await base44.asServiceRole.entities.User.get(atendenteId);
    
    // Atualizar a thread
    await base44.asServiceRole.entities.MessageThread.update(threadId, {
      assigned_user_id: atendenteId,
      assigned_user_name: atendente.full_name,
      pre_atendimento_ativo: false,
      pre_atendimento_etapa: 'completo'
    });

    // Incrementar contagem de conversas do atendente
    await base44.asServiceRole.entities.User.update(atendenteId, {
      current_conversations_count: (atendente.current_conversations_count || 0) + 1
    });

    return {
      success: true,
      atendente_nome: atendente.full_name
    };
  } catch (error) {
    console.error('[PRE-ATENDIMENTO] Erro ao atribuir conversa:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getMensagemErroOpcaoInvalida(etapa) {
  if (etapa === 'menu_setores') {
    return `Desculpe, não entendi sua escolha. 😕

Por favor, digite o *número* da opção desejada (1, 2, 3 ou 4).`;
  }

  if (etapa === 'menu_atendentes') {
    return `Desculpe, não consegui identificar o atendente. 😕

Por favor, digite o *número* correspondente ao atendente desejado.`;
  }

  return "Desculpe, houve um erro. Por favor, tente novamente.";
}