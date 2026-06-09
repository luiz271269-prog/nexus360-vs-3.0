/**
 * ════════════════════════════════════════════════════════════════════════════
 * SKILL MOBILE GLOBAL — Nexus360 (FONTE ÚNICA DE VERDADE PARA TODO O APP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 📌 REGRA ABSOLUTA (vale para o APP INTEIRO, não só a Central de Comunicação):
 *   TODA configuração mobile mora AQUI, em camadas. Nenhuma página/componente
 *   pode criar lógica mobile solta (classes responsivas avulsas, <Sheet> mobile
 *   próprio, hooks de breakpoint duplicados). Mexeu em mobile? É nesta skill.
 *
 *   Isso evita ter que criar "uma skill por página" — existe UMA skill mobile
 *   global e cada página apenas CONSOME dela.
 *
 * ✅ O QUE FAZER em qualquer pedido mobile futuro:
 *   1. Comportamento mobile novo (hook)   → CAMADA 1, re-exporta daqui.
 *   2. Tela/primitivo de layout mobile     → criar em ../mobile/ e re-exportar
 *                                            na CAMADA 2.
 *   3. Token responsivo (padding, título…) → editar TOKENS_LAYOUT (CAMADA 3).
 *   4. Quem consome importa SEMPRE desta skill com um único import.
 *
 * ❌ O QUE NUNCA FAZER:
 *   • NUNCA escrever <Sheet> mobile solto numa página → usar MobileDrawer.
 *   • NUNCA espalhar classes responsivas avulsas → usar mobileTokensLayout.
 *   • NUNCA duplicar useIsMobile/breakpoints em componentes.
 *   • NUNCA criar uma "skill mobile" separada por página.
 *
 * 🧱 CAMADAS:
 *   1. COMPORTAMENTO — hooks que reagem ao contexto mobile
 *      • useIsMobile — detecta tela < 768px
 *   2. LAYOUT — primitivos de tela mobile reutilizáveis
 *      • MobileDrawer — gaveta lateral (filtros/menus) padrão
 *   3. ESTILO — tokens responsivos genéricos consumidos pelas páginas
 *      • mobileTokensLayout — padding/título/header responsivos padronizados
 * ════════════════════════════════════════════════════════════════════════════
 */

// ── CAMADA 1: COMPORTAMENTO ──────────────────────────────────────────────────
export { useIsMobile } from '../../hooks/use-mobile';
export { useMobileBackButton } from '../../hooks/useMobileBackButton';

// ── CAMADA 2: LAYOUT ─────────────────────────────────────────────────────────
export { default as MobileDrawer } from './MobileDrawer';

// ── CAMADA 3: ESTILO (tokens responsivos genéricos de layout) ────────────────
//
// Cada token é a string Tailwind PRONTA (literal, para o build não purgar).
// As páginas consomem esses tokens em vez de escrever px-2 md:p-4 soltos.
const TOKENS_LAYOUT = {
  // Padding do container de conteúdo principal de uma página
  paginaPadding: 'p-2 md:p-4',
  // Padding interno de modais/cards
  modalPadding: 'p-3 md:p-6',
  // Cabeçalho de página: empilha no mobile, lado a lado no desktop
  headerWrap: 'flex flex-col md:flex-row md:items-center md:justify-between gap-3',
  // Título principal de página (responsivo)
  titulo: 'text-lg md:text-2xl font-bold truncate',
  // Ícone de destaque do título (caixa)
  tituloIconeBox: 'w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0',
  tituloIcone: 'w-5 h-5 md:w-6 md:h-6',
  // Sidebar que vira gaveta: visível só no desktop
  sidebarDesktopOnly: 'hidden md:block',
  // Conteúdo principal ao lado de sidebar (evita overflow no mobile)
  conteudoFlex: 'flex-1 min-w-0',
};

export const mobileTokensLayout = TOKENS_LAYOUT;