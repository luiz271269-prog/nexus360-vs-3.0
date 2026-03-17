import { Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';

/**
 * Hook que retorna ícone, cor e label baseado no status da mensagem.
 * @param {string} status - Status da mensagem (enviando/enviada/entregue/lida/falhou)
 * @param {string} whatsapp_message_id - ID WhatsApp (para diferenciar mensagens confirmadas)
 * @returns {{ Icone: React.Component|null, cor: string, label: string }}
 */
export function useMessageStatus(status, whatsapp_message_id) {
  if (status === 'enviando') {
    return { Icone: Clock, cor: 'text-slate-400', label: 'Enviando' };
  }
  if (status === 'enviada') {
    return { Icone: Check, cor: 'text-slate-400', label: 'Enviada' };
  }
  if (status === 'entregue') {
    return { Icone: CheckCheck, cor: 'text-slate-400', label: 'Entregue' };
  }
  if (status === 'lida') {
    return { Icone: CheckCheck, cor: 'text-blue-500', label: 'Lida' };
  }
  if (status === 'falhou') {
    return { Icone: AlertCircle, cor: 'text-red-500', label: 'Falhou' };
  }
  // Padrão: sem status definido → entregue (padrão WhatsApp)
  return { Icone: CheckCheck, cor: 'text-slate-400', label: 'Entregue' };
}