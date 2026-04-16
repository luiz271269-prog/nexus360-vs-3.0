import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Mic, MessageCircle, X } from 'lucide-react';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// 🔔 NOTIFICAÇÃO SONORA - Funciona em QUALQUER browser/mobile
// Usa AudioContext para gerar som sem precisar de arquivo externo
// ═══════════════════════════════════════════════════════════════
function tocarSomNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Nota 1 - "ding"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // Lá agudo
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Nota 2 - "dong" (mais aguda, 150ms depois)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, ctx.currentTime + 0.15); // Ré agudo
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.5);

    // Limpar contexto após uso
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch (e) {
    console.warn('[NovasMensagensAlert] Som não disponível:', e.message);
  }
}

// Vibrar o celular (se suportado)
function vibrar() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]); // vibra-pausa-vibra
    }
  } catch {}
}

// Tentar notificação nativa (desktop browsers)
function tentarNotificacaoNativa({ contactName, preview, isAudio, fotoUrl, contactId, threadId }) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const body = isAudio ? '🎤 Mensagem de voz' : (preview || 'Nova mensagem');
    const notif = new Notification(contactName || 'Nova mensagem', {
      body,
      icon: fotoUrl && fotoUrl !== 'null' && fotoUrl !== 'undefined' ? fotoUrl : '/favicon.ico',
      tag: contactId || threadId,
      renotify: true,
      requireInteraction: false,
    });

    notif.onclick = () => {
      window.focus();
      let url = window.location.origin + createPageUrl('Comunicacao');
      if (contactId) url += `?contact_id=${contactId}`;
      window.location.href = url;
      notif.close();
    };

    setTimeout(() => { try { notif.close(); } catch {} }, 8000);
  } catch {}
}

// Pedir permissão uma vez (não bloqueia o fluxo)
function pedirPermissaoSeNecessario() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export default function NovasMensagensAlert({ usuario, currentPageName }) {
  const [alertas, setAlertas] = useState([]);
  const navigate = useNavigate();
  const processadosRef = useRef(new Set());
  const pageNameRef = useRef(currentPageName);
  pageNameRef.current = currentPageName;
  // Flag para saber se o usuário já interagiu com a página (necessário para AudioContext)
  const userInteractedRef = useRef(false);

  // Capturar primeira interação do usuário (necessário para AudioContext no mobile)
  useEffect(() => {
    const markInteracted = () => { userInteractedRef.current = true; };
    window.addEventListener('click', markInteracted, { once: true });
    window.addEventListener('touchstart', markInteracted, { once: true });
    return () => {
      window.removeEventListener('click', markInteracted);
      window.removeEventListener('touchstart', markInteracted);
    };
  }, []);

  // Pedir permissão de notificação ao montar
  useEffect(() => {
    pedirPermissaoSeNecessario();
  }, []);

  // Subscribe único — usa ref para página atual
  useEffect(() => {
    if (!usuario) return;

    console.log('[NovasMensagensAlert] 🔔 Subscribe ativado para:', usuario.email);

    const unsubscribe = base44.entities.MessageThread.subscribe(async (event) => {
      if (event.type !== 'update' && event.type !== 'create') return;

      const thread = event.data;
      if (!thread) return;

      // Log para debug
      console.log('[NovasMensagensAlert] 📨 Evento:', {
        type: event.type,
        sender: thread.last_message_sender,
        threadType: thread.thread_type,
        page: pageNameRef.current,
        content: (thread.last_message_content || '').substring(0, 30)
      });

      // Só notifica mensagens de CONTATOS (não de atendentes)
      if (thread.last_message_sender !== 'contact') return;
      
      // Ignorar threads internas
      if (thread.thread_type && thread.thread_type !== 'contact_external') return;
      
      if (!thread.last_message_at) return;

      // Ignorar se estiver na Comunicacao
      if (pageNameRef.current === 'Comunicacao') return;

      // Deduplicação
      const chave = `${thread.id}-${thread.last_message_at}`;
      if (processadosRef.current.has(chave)) return;
      processadosRef.current.add(chave);

      // Filtro de permissão
      const isAdmin = usuario.role === 'admin';
      const assignedToMe = thread.assigned_user_id === usuario.id;
      const sharedWithMe = (thread.shared_with_users || []).includes(usuario.id);
      const inHistorico = (thread.atendentes_historico || []).includes(usuario.id);
      if (!isAdmin && !assignedToMe && !sharedWithMe && !inHistorico) {
        processadosRef.current.delete(chave);
        return;
      }

      // Dados do contato
      let contactName = thread.last_message_sender_name || 'Contato';
      let fotoUrl = null;
      if (thread.contact_id) {
        try {
          const contatos = await base44.entities.Contact.filter({ id: thread.contact_id });
          if (contatos?.length > 0) {
            contactName = contatos[0].nome || contactName;
            fotoUrl = contatos[0].foto_perfil_url || null;
          }
        } catch {}
      }

      // Preview
      const mediaType = thread.last_media_type;
      let preview = thread.last_message_content || '';
      let isAudio = false;
      if (mediaType === 'audio') { isAudio = true; preview = null; }
      else if (mediaType === 'image') preview = '📷 Imagem';
      else if (mediaType === 'video') preview = '🎥 Vídeo';
      else if (mediaType === 'document') preview = '📄 Documento';
      else if (preview.length > 60) preview = preview.substring(0, 60) + '…';

      console.log('[NovasMensagensAlert] ✅ DISPARANDO alerta para:', contactName);

      // 🔊 SOM + VIBRAÇÃO (funciona no mobile!)
      if (userInteractedRef.current) {
        tocarSomNotificacao();
      }
      vibrar();

      // 🔔 Tentar notificação nativa (funciona no desktop)
      tentarNotificacaoNativa({
        contactName, preview, isAudio, fotoUrl,
        contactId: thread.contact_id, threadId: thread.id,
      });

      // 🎯 Alerta visual (funciona em TUDO)
      const novoAlerta = {
        id: chave,
        threadId: thread.id,
        contactId: thread.contact_id,
        contactName,
        fotoUrl,
        preview,
        isAudio,
        hora: format(new Date(), 'HH:mm'),
      };

      setAlertas((prev) => [novoAlerta, ...prev.filter((a) => a.threadId !== thread.id)].slice(0, 3));

      // Auto-dismiss após 12 segundos
      setTimeout(() => {
        setAlertas((prev) => prev.filter((a) => a.id !== chave));
        processadosRef.current.delete(chave);
      }, 12000);
    });

    return () => unsubscribe();
  }, [usuario]);

  // Limpa ao entrar na Comunicacao
  useEffect(() => {
    if (currentPageName === 'Comunicacao') setAlertas([]);
  }, [currentPageName]);

  const handleClick = useCallback((alerta) => {
    let url = createPageUrl('Comunicacao');
    if (alerta.contactId) url += `?contact_id=${alerta.contactId}`;
    else if (alerta.threadId) url += `?thread_id=${alerta.threadId}`;
    navigate(url);
    setAlertas([]);
  }, [navigate]);

  const handleDismiss = useCallback((e, alertaId) => {
    e.stopPropagation();
    setAlertas((prev) => prev.filter((a) => a.id !== alertaId));
  }, []);

  const getIniciais = (nome) => {
    if (!nome) return '?';
    return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  };

  // Ocultar na Comunicacao ou se sem alertas
  if (currentPageName === 'Comunicacao' || alertas.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none">
      {alertas.map((alerta) => (
        <div
          key={alerta.id}
          onClick={() => handleClick(alerta)}
          className="pointer-events-auto flex items-center gap-3 cursor-pointer rounded-2xl pl-3 pr-2 py-3 w-[300px] animate-slide-in-right"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(249,115,22,0.3)',
            animation: 'notifSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Barra lateral laranja */}
          <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />

          {/* Avatar */}
          <div className="flex-shrink-0 w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {alerta.fotoUrl && alerta.fotoUrl !== 'null' ? (
              <img
                src={alerta.fotoUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span>{getIniciais(alerta.contactName)}</span>
            )}
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3 text-orange-400 flex-shrink-0" />
              <p className="text-white font-semibold text-[13px] truncate leading-tight">
                {alerta.contactName}
              </p>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {alerta.isAudio ? (
                <>
                  <Mic className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-slate-400 text-xs">Mensagem de voz</span>
                </>
              ) : (
                <span className="text-slate-400 text-xs truncate">{alerta.preview || '...'}</span>
              )}
            </div>
            <p className="text-slate-500 text-[10px] mt-0.5">{alerta.hora}</p>
          </div>

          {/* Botão fechar */}
          <button
            onClick={(e) => handleDismiss(e, alerta.id)}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateX(100px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}