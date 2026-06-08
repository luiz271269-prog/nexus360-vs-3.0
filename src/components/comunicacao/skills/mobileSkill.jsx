/**
 * ════════════════════════════════════════════════════════════════════════════
 * SKILL MOBILE CENTRAL — Centro de Comunicação (Nexus360)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📌 REGRA DE OURO:
 *   TODA configuração mobile do Centro de Comunicação mora AQUI, em camadas.
 *   Nada de código mobile avulso espalhado em páginas/componentes.
 *   Mexeu em mobile? É nesta skill.
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
 *
 * ➕ Para adicionar config mobile nova: registre na camada correta DESTE arquivo
 *    e consuma a partir daqui (import único). Não crie config mobile fora daqui.
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