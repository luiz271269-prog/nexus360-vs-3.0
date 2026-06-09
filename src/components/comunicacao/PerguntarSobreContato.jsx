import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2, X, Database } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Painel de perguntas com respostas EXATAS sobre o contato/cliente da conversa.
// Consulta dados reais: CRM + Contato + Orçamentos + Histórico de mensagens/e-mails.
export default function PerguntarSobreContato({ thread, onClose }) {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState(null);
  const [meta, setMeta] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const perguntar = async () => {
    const q = pergunta.trim();
    if (!q || carregando) return;
    setCarregando(true);
    setErro(null);
    setResposta(null);
    try {
      const res = await base44.functions.invoke('perguntarSobreContato', {
        pergunta: q,
        contact_id: thread?.contact_id || null,
        thread_id: thread?.id || null,
        cliente_id: thread?.cliente_id || null,
      });
      const data = res?.data || res || {};
      setResposta(data.resposta || 'Sem resposta.');
      setMeta({
        orcamentos: data.qtd_orcamentos || 0,
        mensagens: data.qtd_mensagens || 0,
        emails: data.qtd_emails || 0,
        contato: data.tem_contato,
        cliente: data.tem_cliente,
      });
    } catch (e) {
      setErro(e.message || 'Erro ao consultar.');
    } finally {
      setCarregando(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      perguntar();
    }
  };

  return (
    <div className="absolute bottom-full left-2 right-2 mb-2 z-50 bg-white rounded-2xl shadow-2xl border border-indigo-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center gap-2 text-white">
          <Database className="w-4 h-4" />
          <span className="text-sm font-semibold">Perguntar sobre o cliente (dados reais)</span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Qual o valor do último orçamento? Qual a empresa dele?"
            className="w-full pl-9 pr-20 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={perguntar}
            disabled={!pergunta.trim() || carregando}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg"
          >
            {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
          </button>
        </div>

        {erro && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {erro}
          </div>
        )}

        {resposta && (
          <div className="mt-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
            <ReactMarkdown className="prose prose-sm max-w-none text-slate-800">
              {resposta}
            </ReactMarkdown>
            {meta && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-[11px] text-slate-400">
                {meta.contato && <span>✓ Contato</span>}
                {meta.cliente && <span>✓ CRM</span>}
                <span>{meta.orcamentos} orçamento(s)</span>
                <span>{meta.mensagens} mensagem(ns)</span>
                <span>{meta.emails} e-mail(s)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}