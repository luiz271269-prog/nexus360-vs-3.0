import React from 'react';
import InternalDispatchLogBubble from '../InternalDispatchLogBubble';

/**
 * SKILL — Roteador de Logs Internos de Disparo
 *
 * Centraliza a detecção e renderização de bolhas internas (logs) no chat:
 * - promotion_dispatch_log   → promoções
 * - broadcast_dispatch_log   → campanhas em massa
 * - sequence_dispatch_log    → sequências automáticas
 *
 * Uso no MessageBubble:
 *   const internalLog = renderInternalDispatchLog(message);
 *   if (internalLog) return internalLog;
 *
 * Vantagem: tira ~5 linhas + import do MessageBubble.jsx (que está no limite
 * de 2000 linhas) e centraliza a regra em um único arquivo.
 */

const INTERNAL_LOG_TYPES = new Set([
  'promotion_dispatch_log',
  'broadcast_dispatch_log',
  'sequence_dispatch_log'
]);

export function isInternalDispatchLog(message) {
  return INTERNAL_LOG_TYPES.has(message?.metadata?.message_type);
}

export function renderInternalDispatchLog(message) {
  if (!isInternalDispatchLog(message)) return null;
  return <InternalDispatchLogBubble message={message} />;
}