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
export const mobileEstiloMensagem = {
  // Margem lateral da linha da mensagem (mobile 8px / desktop 5%)
  linha: 'flex w-full px-2 sm:px-[5%]',
  // Largura máxima da bolha (mobile / tablet / desktop)
  bolha: 'max-w-[92%] sm:max-w-[72%] md:max-w-[68%]',
  // Padding interno da bolha quando é texto (mobile / desktop)
  paddingBolha: 'px-3.5 py-2 sm:px-3 sm:py-1.5',
  // Tipografia do corpo do texto (mobile / desktop)
  textoCorpo: 'text-[13.5px] sm:text-[14.2px] leading-[20px] tracking-[0.01em]',
};