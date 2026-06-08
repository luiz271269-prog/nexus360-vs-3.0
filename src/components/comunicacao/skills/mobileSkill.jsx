/**
 * ════════════════════════════════════════════════════════════════════════════
 * SKILL MOBILE CENTRAL — Centro de Comunicação (Nexus360)
 * PROTOCOLO MOBILE — FONTE ÚNICA DE VERDADE (não violar)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📌 REGRA ABSOLUTA:
 *   TODA configuração mobile do Centro de Comunicação mora AQUI, em camadas.
 *   Nenhum código mobile pode ser criado/alterado FORA desta skill.
 *   Mexeu em mobile? É nesta skill — sempre neste formato e nestas funções.
 *
 * ✅ O QUE FAZER (em qualquer pedido/alteração futura de mobile):
 *   1. Comportamento mobile novo  → adicionar/editar um hook nesta skill (camada 1)
 *                                    e re-exportar a partir daqui.
 *   2. Tela/layout mobile novo    → criar o componente em ../mobile/ e
 *                                    re-exportar nesta skill (camada 2).
 *   3. Estilo responsivo da bolha → editar APENAS mobileEstiloMensagem (camada 3).
 *                                    A MessageBubble consome esses tokens, não
 *                                    classes responsivas avulsas.
 *   4. Quem consome (Comunicacao.jsx, MessageBubble, etc.) SEMPRE importa
 *      desta skill com um ÚNICO import. Nunca importa peças mobile direto.
 *
 * ❌ O QUE NUNCA FAZER:
 *   • NUNCA escrever classes responsivas mobile (sm:, px-2, max-w-[92%]…)
 *     soltas dentro de componentes — use mobileEstiloMensagem.
 *   • NUNCA importar MobileHeader/MobileChatArea/hooks mobile direto do caminho
 *     original — importar SEMPRE desta skill.
 *   • NUNCA duplicar lógica mobile em outra página/componente.
 *   • NUNCA mudar este formato de camadas (comportamento / layout / estilo).
 *
 * 🧱 CAMADAS:
 *   1. COMPORTAMENTO — hooks que reagem ao contexto mobile
 *      • useAutoAbrirChatMobileNaSelecao — abre o chat ao selecionar em massa
 *      • useMobileBackButton             — botão "voltar" físico do Android
 *
 *   2. LAYOUT — componentes de tela mobile
 *      • MobileHeader   — header compacto mobile
 *      • MobileChatArea — tela única alternante (lista ↔ chat)
 *
 *   3. ESTILO — tokens responsivos consumidos pela bolha de mensagem
 *      • mobileEstiloMensagem — classes mobile/desktop da MessageBubble
 * ════════════════════════════════════════════════════════════════════════════
 */

// ── CAMADA 1: COMPORTAMENTO ──────────────────────────────────────────────────
export { useAutoAbrirChatMobileNaSelecao } from './mobileSelecaoMassaSkill';
export { useMobileBackButton } from '../../../hooks/useMobileBackButton';

// ── CAMADA 2: LAYOUT ─────────────────────────────────────────────────────────
export { default as MobileHeader } from '../mobile/MobileHeader';
export { default as MobileChatArea } from '../mobile/MobileChatArea';

// ── CAMADA 3: ESTILO (tokens responsivos da bolha de mensagem) ───────────────
//
// Como funciona / como editar (à prova de erro):
//   • Cada token guarda { mobile, desktop } separados + a string `full` pronta.
//   • A MessageBubble SEMPRE consome a propriedade `.full`. Não consome mobile/
//     desktop direto, então você ajusta os breakpoints aqui sem tocar na bolha.
//   • Para mudar só o mobile: edite o campo `mobile` e mantenha o `full` coerente.
//   • Nunca remova o `full` — é o contrato que a bolha lê.
//
// IMPORTANTE (Tailwind): as classes precisam existir literais no código para o
// build não purgar. Por isso o `full` é escrito por extenso (não concatenado).
const TOKENS = {
  // Margem lateral da linha da mensagem
  linha: {
    mobile: 'px-2',          // 8px nas bordas no celular
    desktop: 'sm:px-[5%]',   // 5% nas bordas no desktop
    full: 'flex w-full px-2 sm:px-[5%]',
  },
  // Largura máxima da bolha
  bolha: {
    mobile: 'max-w-[92%]',           // quase tela cheia no celular
    desktop: 'sm:max-w-[72%] md:max-w-[68%]',
    full: 'max-w-[92%] sm:max-w-[72%] md:max-w-[68%]',
  },
  // Padding interno da bolha (apenas quando é texto)
  paddingBolha: {
    mobile: 'px-3.5 py-2',
    desktop: 'sm:px-3 sm:py-1.5',
    full: 'px-3.5 py-2 sm:px-3 sm:py-1.5',
  },
  // Tipografia do corpo do texto
  textoCorpo: {
    mobile: 'text-[13.5px]',
    desktop: 'sm:text-[14.2px]',
    full: 'text-[13.5px] sm:text-[14.2px] leading-[20px] tracking-[0.01em]',
  },
};

// API consumida pela MessageBubble: cada chave devolve a string `full`.
// (mantém compatibilidade total: mobileEstiloMensagem.linha continua sendo string)
export const mobileEstiloMensagem = {
  linha: TOKENS.linha.full,
  bolha: TOKENS.bolha.full,
  paddingBolha: TOKENS.paddingBolha.full,
  textoCorpo: TOKENS.textoCorpo.full,
};

// Acesso granular opcional (mobile/desktop separados) para ajustes futuros.
export const mobileEstiloMensagemTokens = TOKENS;