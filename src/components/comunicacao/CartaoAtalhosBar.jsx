import React from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, DollarSign, Package, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// Barra neo-brutalista de atalhos abaixo de mensagens recebidas.
// Cada botão envia ao contato a seção correspondente do Cartão de Acesso.
const ATALHOS = [
  { secao: 'financeiro', label: 'Financeiro', Icon: DollarSign, bg: 'bg-amber-300', hover: 'hover:bg-amber-400' },
  { secao: 'catalogo', label: 'Catálogo', Icon: Package, bg: 'bg-cyan-300', hover: 'hover:bg-cyan-400' },
  { secao: 'suporte', label: 'Suporte', Icon: Wrench, bg: 'bg-lime-300', hover: 'hover:bg-lime-400' }
];

export default function CartaoAtalhosBar({ thread, message }) {
  const [enviando, setEnviando] = React.useState(null);

  const enviar = async (secao) => {
    if (enviando) return;
    setEnviando(secao);
    try {
      const res = await base44.functions.invoke('enviarCartaoAcesso', {
        thread_id: thread.id,
        contact_id: thread.contact_id,
        integration_id: message?.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id || null,
        secao
      });
      if (res?.data?.success) {
        toast.success(`✅ ${secao.charAt(0).toUpperCase() + secao.slice(1)} enviado ao contato!`);
      } else {
        throw new Error(res?.data?.error || 'Falha no envio');
      }
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <div className="flex gap-1.5 mt-1 flex-wrap">
      {ATALHOS.map(({ secao, label, Icon, bg, hover }) => (
        <button
          key={secao}
          onClick={(e) => { e.stopPropagation(); enviar(secao); }}
          disabled={!!enviando}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-wide",
            "border-2 border-black rounded-md text-black",
            "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            "active:shadow-none active:translate-x-[2px] active:translate-y-[2px]",
            "transition-all disabled:opacity-50",
            bg, hover
          )}>
          {enviando === secao
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Icon className="w-3 h-3" />}
          {label}
        </button>
      ))}
    </div>
  );
}