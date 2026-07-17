import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, X, User, Building2, Phone, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Busca global estilo WhatsApp: nome OU número, resultados agrupados,
// clique abre a conversa na Central via deep-link (?contact= / ?cliente=).
// Motor de contatos: buscarContatosLivre (variações de telefone, caso Pamplona).
export default function BuscaGlobalModal({ isOpen, onClose }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState({ contatos: [], clientes: [] });
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTermo('');
      setResultados({ contatos: [], clientes: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = termo.trim();
    if (q.length < 2) {
      setResultados({ contatos: [], clientes: [] });
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      const digitos = q.replace(/\D/g, '');
      const [respContatos, cRazao, cFantasia, cTelefone] = await Promise.all([
        base44.functions.invoke('buscarContatosLivre', { searchTerm: q, limit: 15 }).catch(() => null),
        base44.entities.Cliente.filter({ razao_social: { $regex: q, $options: 'i' } }, '-updated_date', 6).catch(() => []),
        base44.entities.Cliente.filter({ nome_fantasia: { $regex: q, $options: 'i' } }, '-updated_date', 6).catch(() => []),
        digitos.length >= 8
          ? base44.entities.Cliente.filter({ telefone: { $regex: digitos } }, '-updated_date', 6).catch(() => [])
          : Promise.resolve([]),
      ]);

      const clientesMap = new Map();
      [...(cRazao || []), ...(cFantasia || []), ...(cTelefone || [])].forEach((c) => clientesMap.set(c.id, c));

      setResultados({
        contatos: (respContatos?.data?.contatos || []).slice(0, 15),
        clientes: [...clientesMap.values()].slice(0, 8),
      });
      setBuscando(false);
    }, 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [termo]);

  const irPara = (params) => {
    const qs = new URLSearchParams(params).toString();
    onClose();
    navigate(`/Comunicacao?${qs}`);
  };

  if (!isOpen) return null;

  const total = resultados.contatos.length + resultados.clientes.length;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[10vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de busca estilo WhatsApp */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Buscar por nome ou número..."
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {buscando && (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}

          {!buscando && termo.trim().length >= 2 && total === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">
              Nenhum resultado para "{termo}"
            </div>
          )}

          {!buscando && termo.trim().length < 2 && (
            <div className="px-4 py-6 text-sm text-slate-400 text-center">
              Digite pelo menos 2 caracteres (nome ou número)
            </div>
          )}

          {!buscando && resultados.contatos.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Conversas / Contatos
              </div>
              {resultados.contatos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irPara({ contact: c.id })}
                  className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors flex items-center gap-3"
                >
                  {c.foto_perfil_url ? (
                    <img src={c.foto_perfil_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">{c.nome || 'Sem nome'}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <Phone className="w-3 h-3" />{c.telefone || c.email || c.empresa || '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!buscando && resultados.clientes.length > 0 && (
            <div className="pb-2">
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Clientes (CRM)
              </div>
              {resultados.clientes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irPara({ cliente: c.id })}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">{c.nome_fantasia || c.razao_social}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      {c.telefone ? <><Phone className="w-3 h-3" />{c.telefone}</> : (c.cidade || c.cnpj || '—')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 text-center">
          Atalho: Ctrl+K • Enter abre a conversa
        </div>
      </div>
    </div>
  );
}