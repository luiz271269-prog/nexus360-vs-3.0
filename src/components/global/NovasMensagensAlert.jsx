import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Mic } from 'lucide-react';
import { format } from 'date-fns';

// Solicita permissão de notificação nativa ao montar
function solicitarPermissaoNotificacao() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function dispararNotificacaoNativa({ contactName, preview, isAudio, fotoUrl, contactId, threadId }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const body = isAudio ? '🎤 Mensagem de voz' : (preview || 'Nova mensagem');
  const notif = new Notification(contactName, {
    body,
    icon: fotoUrl && fotoUrl !== 'null' ? fotoUrl : '/favicon.ico',
    badge: '/favicon.ico',
    tag: contactId || threadId, // agrupa notificações do mesmo contato
    renotify: true,
  });

  notif.onclick = () => {
    window.focus();
    let url = window.location.origin + createPageUrl('Comunicacao');
    if (contactId) url += `?contact_id=${contactId}`;
    else if (threadId) url += `?thread_id=${threadId}`;
    window.location.href = url;
    notif.close();
  };

  // Auto-fecha após 8s
  setTimeout(() => notif.close(), 8000);
}

export default function NovasMensagensAlert({ usuario, currentPageName }) {
  const [alertas, setAlertas] = useState([]);
  const navigate = useNavigate();
  const processadosRef = useRef(new Set());
  const estaNaComunicacao = currentPageName === 'Comunicacao';

  // Solicita permissão de notificação nativa na primeira vez
  useEffect(() => {
    if (usuario) solicitarPermissaoNotificacao();
  }, [usuario]);

  useEffect(() => {
    if (!usuario || estaNaComunicacao) {
      setAlertas([]);
      return;
    }

    const unsubscribe = base44.entities.MessageThread.subscribe(async (event) => {
      if (event.type !== 'update' && event.type !== 'create') return;
      const thread = event.data;
      if (!thread) return;
      if (thread.thread_type !== 'contact_external') return;
      if (thread.last_message_sender !== 'contact') return;

      const chave = `${thread.id}-${thread.last_message_at}`;
      if (processadosRef.current.has(chave)) return;
      processadosRef.current.add(chave);

      // Filtro básico de permissão
      const isAdmin = usuario.role === 'admin';
      const assignedToMe = thread.assigned_user_id === usuario.id;
      const sharedWithMe = (thread.shared_with_users || []).includes(usuario.id);
      if (!isAdmin && !assignedToMe && !sharedWithMe) return;

      // Busca dados do contato (nome + foto)
      let contactName = thread.last_message_sender_name || 'Contato';
      let fotoUrl = null;
      if (thread.contact_id) {
        try {
          const contatos = await base44.entities.Contact.filter({ id: thread.contact_id });
          if (contatos?.length > 0) {
            contactName = contatos[0].nome || contactName;
            fotoUrl = contatos[0].foto_perfil_url || null;
          }
        } catch { /* silencioso */ }
      }

      // Detecta tipo de mídia para o preview
      const mediaType = thread.last_media_type;
      let preview = thread.last_message_content || '';
      if (mediaType === 'audio') preview = null; // vai mostrar o ícone de mic
      else if (mediaType === 'image') preview = '📷 Imagem';
      else if (mediaType === 'video') preview = '🎥 Vídeo';
      else if (mediaType === 'document') preview = '📄 Documento';
      else if (preview.length > 50) preview = preview.substring(0, 50) + '…';

      const novoAlerta = {
        id: chave,
        threadId: thread.id,
        contactId: thread.contact_id,
        contactName,
        fotoUrl,
        preview,
        isAudio: mediaType === 'audio',
        hora: format(new Date(), 'HH:mm'),
      };

      // 🔔 Notificação nativa do sistema operacional (funciona mesmo minimizado)
      dispararNotificacaoNativa({
        contactName,
        preview,
        isAudio: mediaType === 'audio',
        fotoUrl,
        contactId: thread.contact_id,
        threadId: thread.id,
      });

      setAlertas((prev) => {
        const semEste = prev.filter((a) => a.threadId !== thread.id);
        return [novoAlerta, ...semEste].slice(0, 3);
      });

      setTimeout(() => {
        setAlertas((prev) => prev.filter((a) => a.id !== chave));
        processadosRef.current.delete(chave);
      }, 10000);
    });

    return () => unsubscribe();
  }, [usuario, estaNaComunicacao]);

  useEffect(() => {
    if (estaNaComunicacao) setAlertas([]);
  }, [estaNaComunicacao]);

  if (estaNaComunicacao || alertas.length === 0) return null;

  const handleClick = (alerta) => {
    let url = createPageUrl('Comunicacao');
    if (alerta.contactId) url += `?contact_id=${alerta.contactId}`;
    else if (alerta.threadId) url += `?thread_id=${alerta.threadId}`;
    navigate(url);
    setAlertas([]);
  };

  const getIniciais = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  };

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 items-end">
      {alertas.map((alerta) => (
        <div
          key={alerta.id}
          onClick={() => handleClick(alerta)}
          className="flex items-center gap-3 cursor-pointer rounded-2xl px-4 py-3 w-[280px]"
          style={{
            background: 'rgba(30, 30, 30, 0.96)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Avatar */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-bold text-base">
            {alerta.fotoUrl && alerta.fotoUrl !== 'null' ? (
              <img
                src={alerta.fotoUrl}
                alt={alerta.contactName}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span>{getIniciais(alerta.contactName)}</span>
            )}
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate leading-tight">
              {alerta.contactName}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {alerta.isAudio ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  <span className="text-slate-300 text-xs">Mensagem de voz</span>
                </>
              ) : (
                <span className="text-slate-300 text-xs truncate">{alerta.preview || '...'}</span>
              )}
            </div>
            <p className="text-slate-500 text-[11px] mt-1">{alerta.hora}</p>
          </div>
        </div>
      ))}
    </div>
  );
}