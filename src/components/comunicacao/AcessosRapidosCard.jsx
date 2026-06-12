import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Zap, Globe, Tag, Instagram, Linkedin, TrendingUp,
  Headphones, DollarSign, ShoppingCart, ExternalLink, Copy
} from 'lucide-react';
import { format } from 'date-fns';

const ICONES = {
  Globe, Tag, Instagram, Linkedin, Zap, TrendingUp,
  Headphones, DollarSign, ShoppingCart
};

// Cartão fino de Acessos Rápidos — renderizado na Central no lugar do texto da mensagem
export default function AcessosRapidosCard({ message }) {
  const { data: itens = [] } = useQuery({
    queryKey: ['acessos-rapidos'],
    queryFn: () => base44.entities.AcessoRapido.filter({ ativo: true }, 'ordem'),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const handleClick = (item) => {
    if (item.tipo === 'pix') {
      navigator.clipboard.writeText(item.url);
      toast.success(`⚡ Chave Pix copiada: ${item.url}`);
    } else {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const horario = message?.sent_at || message?.created_date;

  return (
    <div className="flex justify-end">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 max-w-full">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[9px] text-slate-400">Visite nossos canais</p>
            <p className="text-xs font-bold text-slate-900">NEURALTEC — Acessos rápidos</p>
          </div>
          {horario && (
            <span className="text-[10px] text-slate-400 ml-auto pl-3">
              {format(new Date(horario), 'HH:mm')}
            </span>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {itens.map((item) => {
            const Icone = ICONES[item.icone] || Globe;
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                title={item.titulo}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border border-slate-100 hover:bg-green-50 hover:border-green-200 transition-colors flex-shrink-0 min-w-[58px]"
              >
                <Icone className="w-4 h-4 text-green-600" />
                <span className="text-[10px] text-slate-700 font-medium">{item.titulo}</span>
                {item.tipo === 'pix'
                  ? <Copy className="w-2.5 h-2.5 text-green-500" />
                  : <ExternalLink className="w-2.5 h-2.5 text-green-500" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}