import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { MessageSquare, X } from 'lucide-react';

/**
 * Exibe um botão flutuante quando chegam novas mensagens
 * e o usuário NÃO está na página de Comunicação.
 */
export default function NovasMensagensAlert({ usuario, currentPageName }) {
  const [alertas, setAlertas] = useState([]); // { id, contactName, preview, threadId, timestamp }
  const navigate = useNavigate();
  const processadosRef = useRef(new Set());
  const estaNaComunicacao = currentPageName === 'Comunicacao';

  useEffect(() => {
    if (!usuario) return;

    // Limpa alertas ao entrar na tela de Comunicação
    if (estaNaComunicacao) {
      setAlertas([]);
      return;
    }

    // Subscribe em tempo real nas threads
    const unsubscribe = base44.entities.MessageThread.subscribe(async (event) => {
      if (event.type !== 'update' && event.type !== 'create') return;

      const thread = event.data;
      if (!thread) return;

      // Só interessa threads externas com mensagem do contato (não do usuário/sistema)
      if (thread.thread_type !== 'contact_external') return;
      if (thread.last_message_sender !== 'contact') return;

      // Evita duplicar o mesmo alerta
      const chave = `${thread.id}-${thread.last_message_at}`;
      if (processadosRef.current.has(chave)) return;
      processadosRef.current.add(chave);

      // Filtra pelo setor/permissão básica do usuário
      const meuSetor = usuario.attendant_sector || 'geral';
      const isAdmin = usuario.role === 'admin';
      const assignedToMe = thread.assigned_user_id === usuario.id;
      const sharedWithMe = (thread.shared_with_users || []).includes(usuario.id);

      // Mostra se: admin, atribuído a mim, compartilhado comigo, ou setor bate
      if (!isAdmin && !assignedToMe && !sharedWithMe) {
        if (meuSetor !== 'geral') return; // setores específicos só veem o próprio
      }

      // Busca nome do contato para exibir no alerta
      let contactName = thread.last_message_sender_name || 'Contato';
      if (thread.contact_id) {
        try {
          const contatos = await base44.entities.Contact.filter({ id: thread.contact_id });
          if (contatos?.length > 0) {
            contactName = contatos[0].nome || contactName;
          }
        } catch {
          // silencioso
        }
      }

      const novoAlerta = {
        id: chave,
        threadId: thread.id,
        contactId: thread.contact_id,
        contactName,
        preview: thread.last_message_content
          ? thread.last_message_content.substring(0, 60) + (thread.last_message_content.length > 60 ? '…' : '')
          : 'Nova mensagem',
        timestamp: new Date(),
      };

      setAlertas((prev) => {
        // Mantém no máximo 3 alertas visíveis
        const semEste = prev.filter((a) => a.threadId !== thread.id);
        return [novoAlerta, ...semEste].slice(0, 3);
      });

      // Auto-remove após 8 segundos
      setTimeout(() => {
        setAlertas((prev) => prev.filter((a) => a.id !== chave));
        processadosRef.current.delete(chave);
      }, 8000);
    });

    return () => unsubscribe();
  }, [usuario, estaNaComunicacao]);

  // Limpa ao entrar na Comunicação
  useEffect(() => {
    if (estaNaComunicacao) {
      setAlertas([]);
    }
  }, [estaNaComunicacao]);

  if (estaNaComunicacao || alertas.length === 0) return null;

  const handleIrParaComunicacao = (threadId, contactId) => {
    let url = createPageUrl('Comunicacao');
    if (contactId) url += `?contact_id=${contactId}`;
    else if (threadId) url += `?thread_id=${threadId}`;
    navigate(url);
    setAlertas([]);
  };

  const handleFechar = (id, e) => {
    e.stopPropagation();
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="fixed bottom-24 right-6 z-[60] flex flex-col gap-2 items-end">
      {alertas.map((alerta) => (
        <div
          key={alerta.id}
          onClick={() => handleIrParaComunicacao(alerta.threadId, alerta.contactId)}
          className="flex items-start gap-3 bg-white border border-slate-200 shadow-2xl rounded-2xl px-4 py-3 cursor-pointer hover:shadow-3xl hover:scale-[1.02] transition-all duration-200 max-w-[300px] w-full animate-in slide-in-from-right-4 fade-in"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        >
          {/* Ícone */}
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800 truncate">{alerta.contactName}</p>
              <button
                onClick={(e) => handleFechar(alerta.id, e)}
                className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-slate-500" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{alerta.preview}</p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">Toque para abrir ↗</p>
          </div>
        </div>
      ))}
    </div>
  );
}