import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Loader2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

const formatarHorario = (timestamp) => {
  if (!timestamp) return '';
  try {
    const agora = new Date();
    const dataMsg = new Date(timestamp);
    if (agora.toDateString() === dataMsg.toDateString()) return format(dataMsg, 'HH:mm');
    return format(dataMsg, 'dd/MM');
  } catch { return ''; }
};

// Painel standalone de acompanhamento de Broadcast (migrado da Central de Comunicação)
export default function BroadcastThreadsPanel() {
  const navigate = useNavigate();

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['broadcast-threads-panel'],
    queryFn: async () => {
      const response = await base44.functions.invoke('buscarThreadsLivre', {
        status: 'aberta',
        limit: 500,
        incluirInternas: false
      });
      if (response?.data?.success) return response.data.threads || [];
      return [];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false
  });

  const colunas = React.useMemo(() => {
    const agora = Date.now();
    const H24 = 24 * 60 * 60 * 1000;

    const threadsBroadcast = threads.filter(t =>
      t.last_message_content?.startsWith('[Broadcast]') ||
      t.metadata?.ultima_mensagem_origem === 'broadcast_massa'
    );

    const cols = {
      respondeu_aguardando: { id: 'respondeu_aguardando', nome: '🔥 Respondeu — Aguardando', cor: 'from-red-600 to-rose-700', borda: 'border-red-300', threads: [] },
      sem_resposta_velho: { id: 'sem_resposta_velho', nome: '⚡ Sem resposta +24h', cor: 'from-orange-500 to-amber-600', borda: 'border-orange-300', threads: [] },
      sem_resposta_novo: { id: 'sem_resposta_novo', nome: '⏱️ Sem resposta <24h', cor: 'from-yellow-500 to-amber-500', borda: 'border-yellow-300', threads: [] },
      atendido: { id: 'atendido', nome: '✅ Atendido', cor: 'from-emerald-600 to-teal-700', borda: 'border-emerald-300', threads: [] }
    };

    threadsBroadcast.forEach(thread => {
      const lastInbound = thread.last_inbound_at ? new Date(thread.last_inbound_at).getTime() : 0;
      const lastOutbound = thread.last_outbound_at ? new Date(thread.last_outbound_at).getTime() : 0;
      const lastHuman = thread.last_human_message_at ? new Date(thread.last_human_message_at).getTime() : 0;

      if (lastInbound > 0 && lastHuman > lastInbound) {
        cols.atendido.threads.push(thread);
      } else if (thread.last_message_sender === 'contact' && lastInbound > 0) {
        cols.respondeu_aguardando.threads.push(thread);
      } else {
        const idadeMs = agora - (lastOutbound || new Date(thread.last_message_at || 0).getTime());
        if (idadeMs >= H24) cols.sem_resposta_velho.threads.push(thread);
        else cols.sem_resposta_novo.threads.push(thread);
      }
    });

    cols.respondeu_aguardando.threads.sort((a, b) => new Date(a.last_inbound_at || 0) - new Date(b.last_inbound_at || 0));
    cols.sem_resposta_velho.threads.sort((a, b) => new Date(a.last_outbound_at || 0) - new Date(b.last_outbound_at || 0));
    cols.sem_resposta_novo.threads.sort((a, b) => new Date(b.last_outbound_at || 0) - new Date(a.last_outbound_at || 0));
    cols.atendido.threads.sort((a, b) => new Date(b.last_human_message_at || 0) - new Date(a.last_human_message_at || 0));

    return Object.values(cols).filter(c => c.threads.length > 0);
  }, [threads]);

  const abrirConversa = (thread) => {
    navigate(createPageUrl('Comunicacao') + `?thread=${thread.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (colunas.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Nenhuma campanha em massa enviada</p>
        <p className="text-xs mt-1">Conversas que receberam broadcast aparecerão aqui agrupadas por urgência.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {colunas.map(coluna => (
          <div key={coluna.id} className={`flex flex-col flex-shrink-0 w-72 bg-white rounded-xl border-2 ${coluna.borda} overflow-hidden shadow-md`}>
            <div className={`bg-gradient-to-r ${coluna.cor} px-3 py-2 flex items-center justify-between`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Megaphone className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
              </div>
              <Badge className="bg-white/30 text-white text-[10px] font-bold border-0">{coluna.threads.length}</Badge>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[60vh]">
              {coluna.threads.map(thread => {
                const contato = thread.contato || {};
                let nome = '';
                if (contato.empresa) nome += contato.empresa;
                if (contato.nome && contato.nome !== contato.telefone) nome += (nome ? ' - ' : '') + contato.nome;
                if (!nome) nome = contato.telefone || 'Sem Nome';
                return (
                  <div
                    key={thread.id}
                    onClick={() => abrirConversa(thread)}
                    className="px-2 py-2 flex items-center gap-2.5 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden bg-gradient-to-br from-slate-400 to-slate-500 flex-shrink-0">
                      {contato.foto_perfil_url && contato.foto_perfil_url !== 'null' ? (
                        <img src={contato.foto_perfil_url} alt={nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-semibold truncate text-xs text-slate-900">{nome}</h3>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{formatarHorario(thread.last_message_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        {thread.last_message_content || 'Sem mensagens'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}