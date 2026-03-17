import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function KanbanChatWindow({ orcamento, usuario, onClose }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    buscarThread();
  }, [orcamento?.id]);

  const buscarThread = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
      if (!telefone) {
        setErro('Telefone não cadastrado para este cliente.');
        setCarregando(false);
        return;
      }

      const tel = telefone.replace(/\D/g, '');

      let contatos = await base44.entities.Contact.filter({ telefone_canonico: tel });
      if (!contatos?.length) {
        contatos = await base44.entities.Contact.filter({ telefone: telefone });
      }
      if (!contatos?.length) {
        setErro(`Contato não encontrado: ${telefone}`);
        setCarregando(false);
        return;
      }

      const c = contatos[0];
      const threads = await base44.entities.MessageThread.filter({ contact_id: c.id, is_canonical: true });

      if (!threads?.length) {
        setErro('Nenhuma conversa WhatsApp encontrada para este contato.');
        setCarregando(false);
        return;
      }

      setThreadId(threads[0].id);
    } catch (e) {
      setErro('Erro ao buscar conversa: ' + (e.message || 'erro desconhecido'));
    } finally {
      setCarregando(false);
    }
  };

  const abrirNoComunicacao = () => {
    if (threadId) {
      sessionStorage.setItem('comunicacao_open_thread', threadId);
    }
    navigate(createPageUrl('Comunicacao'));
    onClose();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {orcamento.cliente_nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-xs truncate">{orcamento.cliente_nome}</p>
            <p className="text-slate-400 text-[10px]">
              {orcamento.cliente_telefone || orcamento.cliente_celular || 'Sem telefone'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors ml-2 p-1 rounded-lg hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo */}
      <div className="p-5 flex flex-col items-center gap-4">
        {carregando ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            <span className="text-xs text-slate-400">Buscando conversa...</span>
          </div>
        ) : erro ? (
          <div className="flex flex-col items-center gap-3 text-center py-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{erro}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center py-2">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Conversa encontrada. Clique para abrir no chat completo.
            </p>
          </div>
        )}

        {!carregando && !erro && threadId && (
          <button
            onClick={abrirNoComunicacao}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Chat Completo
          </button>
        )}
      </div>
    </div>
  );
}