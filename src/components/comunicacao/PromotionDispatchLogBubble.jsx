import React from 'react';
import InternalDispatchLogBubble from './InternalDispatchLogBubble';

/**
 * Wrapper retro-compatível.
 * Redireciona para InternalDispatchLogBubble que agora suporta 3 tipos:
 * - promotion_dispatch_log
 * - broadcast_dispatch_log
 * - sequence_dispatch_log
 *
 * O componente decide o visual pelo metadata.message_type da mensagem.
 */
export default function PromotionDispatchLogBubble({ message }) {
  return <InternalDispatchLogBubble message={message} />;
}