import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function BotaoAtivarAgendaIA({ thread, onUpdate }) {
  const [alterando, setAlterando] = useState(false);
  
  const isAgendaAtiva = thread?.assistant_mode === 'agenda';
  
  const handleToggle = async () => {
    if (!thread?.id) return;
    
    setAlterando(true);
    try {
      const novoModo = isAgendaAtiva ? 'default' : 'agenda';
      
      await base44.entities.MessageThread.update(thread.id, {
        assistant_mode: novoModo
      });
      
      toast.success(
        novoModo === 'agenda' 
          ? '🗓️ Agenda IA ativada para esta conversa'
          : '✅ Modo normal restaurado'
      );
      
      if (onUpdate) onUpdate();
      
    } catch (error) {
      console.error('Erro ao alternar modo:', error);
      toast.error('❌ Erro ao alterar modo da conversa');
    } finally {
      setAlterando(false);
    }
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isAgendaAtiva ? "default" : "outline"}
            size="sm"
            onClick={handleToggle}
            disabled={alterando}
            className={
              isAgendaAtiva 
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                : ""
            }
          >
            {alterando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isAgendaAtiva ? (
              <Calendar className="w-4 h-4" />
            ) : (
              <CalendarOff className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isAgendaAtiva 
              ? '🗓️ Agenda IA Ativa - Clique para desativar' 
              : '📅 Ativar Agenda IA nesta conversa'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}