import React from "react";
import { Video, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import VideoCallModule from "./VideoCallModule";

export default function BotaoVideochamada({ contato, thread, usuario, integracoes = [] }) {
  const [sessaoAtiva, setSessaoAtiva] = React.useState(null);
  const [iniciando, setIniciando] = React.useState(false);
  const [menuAberto, setMenuAberto] = React.useState(false);
  const menuRef = React.useRef(null);

  // Fechar menu ao clicar fora
  React.useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const iniciarChamada = async (tipo) => {
    setMenuAberto(false);
    setIniciando(true);

    try {
      // Detectar se é thread interna (usuário interno sem telefone)
      const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

      let payload;

      if (isThreadInterna) {
        // Modo interno: link enviado via mensagem interna na thread
        // user_id_destino = o outro participante (não o usuário atual)
        const outroParticipante = thread?.participants?.find(id => id !== usuario?.id) || null;
        payload = {
          modo: 'interno',
          thread_id: thread.id,
          user_id_destino: outroParticipante,
          tipo
        };
      } else {
        // Modo externo: link enviado via WhatsApp para o telefone do contato
        const integracaoAtiva = integracoes.find(i => i.status === 'conectado') || null;
        payload = {
          modo: 'externo',
          contact_id: contato.id,
          thread_id: thread?.id || null,
          integration_id: integracaoAtiva?.id || null,
          tipo
        };
      }

      const resultado = await base44.functions.invoke('skillInitiateVideoCall', payload);

      if (!resultado?.data?.success) {
        throw new Error(resultado?.data?.error || 'Falha ao iniciar chamada');
      }

      setSessaoAtiva({
        session_id: resultado.data.session_id,
        room_url: resultado.data.room_url,
        room_name: resultado.data.room_name,
        tipo,
        contact_nome: resultado.data.contact_nome,
        link_enviado_whatsapp: resultado.data.link_enviado_whatsapp
      });

      if (isThreadInterna) {
        toast.success(`📹 Chamada iniciada! Link enviado na conversa interna.`);
      } else if (resultado.data.link_enviado_whatsapp) {
        toast.success(`📹 Chamada iniciada! Link enviado via WhatsApp para ${resultado.data.contact_nome}`);
      } else {
        toast.success(`📹 Chamada iniciada! Copie o link para compartilhar.`);
      }

    } catch (e) {
      toast.error('Erro ao iniciar chamada: ' + e.message);
    } finally {
      setIniciando(false);
    }
  };

  return (
    <>
      {/* Botão com dropdown vídeo/voz */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuAberto(prev => !prev)}
          disabled={iniciando}
          className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:from-green-600 hover:to-emerald-700 hover:shadow-lg transition-all disabled:opacity-50"
          title="Iniciar chamada">
          {iniciando
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Video className="w-3.5 h-3.5" />}
        </button>

        {menuAberto && !iniciando && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[160px]">
            <button
              onClick={() => iniciarChamada('video')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-green-50 text-slate-700 text-sm transition-colors">
              <Video className="w-4 h-4 text-green-600" />
              Videochamada
            </button>
            <button
              onClick={() => iniciarChamada('audio')}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 text-slate-700 text-sm transition-colors border-t border-slate-100">
              <Phone className="w-4 h-4 text-blue-600" />
              Chamada de voz
            </button>
          </div>
        )}
      </div>

      {/* Overlay da chamada ativa */}
      {sessaoAtiva && (
        <VideoCallModule
          session={sessaoAtiva}
          onEncerrar={(duracao) => {
            setSessaoAtiva(null);
            console.log(`[BotaoVideochamada] Chamada encerrada após ${duracao}s`);
          }}
          onClose={() => setSessaoAtiva(null)}
        />
      )}
    </>
  );
}