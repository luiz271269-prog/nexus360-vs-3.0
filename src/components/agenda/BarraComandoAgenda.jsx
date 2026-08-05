import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import ComandoNaturalInput from '@/components/agenda/ComandoNaturalInput';

// Barra de comando da Agenda: fale, digite ou envie imagem e o item
// (tarefa, lembrete, ligação ou agendamento) é criado automaticamente.
export default function BarraComandoAgenda({ onCriado }) {
  const [enviando, setEnviando] = useState(false);

  const handleComando = async (texto) => {
    setEnviando(true);
    try {
      const { data } = await base44.functions.invoke('agendarPorComando', { texto });
      if (data?.success) {
        toast.success(data.mensagem);
        onCriado?.();
      } else {
        toast.error(data?.mensagem || '❌ Não consegui agendar');
      }
    } catch (error) {
      console.error('[BARRA-COMANDO-AGENDA]', error);
      toast.error('❌ Erro ao agendar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl border border-agenda-border bg-agenda-panel/45 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-agenda-muted">
        <Sparkles className="h-4 w-4 text-agenda-accent" />
        Fale ou escreva: "lembrete ligar fornecedor amanhã 10h", "tarefa enviar orçamento sexta"
      </div>
      <ComandoNaturalInput enviando={enviando} onComando={handleComando} />
    </div>
  );
}