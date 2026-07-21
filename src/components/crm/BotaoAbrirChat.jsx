import React from 'react';
import { MessageSquare } from 'lucide-react';
import ClienteChatDrawer from '@/components/clientes/ClienteChatDrawer';
import useChatIndicadores from './useChatIndicadores';

/**
 * Botão "Abrir Chat" do CRM — autocontido (gerencia o próprio drawer).
 * Mostra badge vermelho com nº de mensagens não lidas, igual à barra
 * de contatos da Central de Comunicação.
 * Aceita `cliente` (entidade Cliente) OU `contato` (entidade Contact).
 */
export default function BotaoAbrirChat({ cliente, contato, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const { getIndicadorCliente, getIndicadorContato } = useChatIndicadores();

  const indicador = contato ? getIndicadorContato(contato) : getIndicadorCliente(cliente);
  const telefone = cliente?.telefone || cliente?.celular || contato?.telefone;
  const podeAbrir = !!(telefone || cliente?.id || contato?.cliente_id);

  const clienteDrawer = cliente || {
    id: contato?.cliente_id,
    telefone: contato?.telefone,
    razao_social: contato?.empresa || contato?.nome,
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); if (podeAbrir) setOpen(true); }}
        disabled={!podeAbrir}
        title={
          indicador?.naoLidas
            ? `${indicador.naoLidas} mensagem(ns) não lida(s) — abrir chat`
            : podeAbrir ? 'Abrir chat' : 'Sem telefone cadastrado'
        }
        className={`relative inline-flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-150 ${
          podeAbrir
            ? 'border-slate-300 bg-white text-slate-600 hover:bg-green-500 hover:text-white hover:border-green-500 hover:shadow-md'
            : 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
        } ${className}`}
      >
        <MessageSquare className="w-4 h-4" />
        {indicador?.naoLidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {indicador.naoLidas > 99 ? '99+' : indicador.naoLidas}
          </span>
        )}
      </button>

      {open && (
        <ClienteChatDrawer
          cliente={clienteDrawer}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}