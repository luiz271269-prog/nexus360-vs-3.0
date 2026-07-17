import React from 'react';
import { WhatsAppLogo, InstagramLogo, FacebookLogo } from './CanalLogos';
import { Mail, Phone, MessageSquare, Users } from 'lucide-react';

// Badge com o logo real do canal de origem da mensagem (+ número da conexão, se informado)
const CONFIG_CANAL = {
  whatsapp: { Logo: WhatsAppLogo, classes: 'bg-green-100 text-green-700', label: 'WhatsApp' },
  instagram: { Logo: InstagramLogo, classes: 'bg-pink-100 text-pink-700', label: 'Instagram' },
  facebook: { Logo: FacebookLogo, classes: 'bg-blue-100 text-blue-700', label: 'Facebook' },
  email: { Logo: () => <Mail className="w-3 h-3" />, classes: 'bg-sky-100 text-sky-700', label: 'E-mail' },
  interno: { Logo: () => <Users className="w-3 h-3" />, classes: 'bg-purple-100 text-purple-700', label: 'Interno' },
  phone: { Logo: () => <Phone className="w-3 h-3" />, classes: 'bg-amber-100 text-amber-700', label: 'Telefone' },
  sms: { Logo: () => <MessageSquare className="w-3 h-3" />, classes: 'bg-amber-100 text-amber-700', label: 'SMS' }
};

export default function CanalOrigemBadge({ channel, numero }) {
  const cfg = CONFIG_CANAL[channel] || CONFIG_CANAL.whatsapp;
  const { Logo } = cfg;
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${cfg.classes}`}
      title={`Canal: ${cfg.label}${numero ? ` • ${numero}` : ''}`}
    >
      <span className="[&_svg]:w-3 [&_svg]:h-3 inline-flex"><Logo /></span>
      {numero || cfg.label}
    </span>
  );
}