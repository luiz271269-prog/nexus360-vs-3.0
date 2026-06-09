import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, X, User, Building2, Phone, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Busca global unificada: pesquisa simultânea em Contatos (CRM) e Clientes.
// Resultados clicáveis abrem o registro na Central de Comunicação.
export default function BuscaGlobalJarvis({ onNavigate }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState({ contatos: [], clientes: [] });
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

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
      try {
        const [contatos, clientes] = await Promise.all([
          base44.entities.Contact.filter({ nome: { $regex: q, $options: 'i' } }, '-updated_date', 8).catch(() => []),
          base44.entities.Cliente.filter({ nome: { $regex: q, $options: 'i' } }, '-updated_date', 8).catch(() => []),
        ]);
        setResultados({ contatos: contatos || [], clientes: clientes || [] });
      } catch (e) {
        console.warn('[BuscaGlobalJarvis] erro:', e?.message);
        setResultados({ contatos: [], clientes: [] });
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [termo]);

  const irPara = (params) => {
    const qs = new URLSearchParams(params).toString();
    navigate(`/Comunicacao?${qs}`);
    setTermo('');
    setAberto(false);
    onNavigate?.();
  };

  const totalResultados = resultados.contatos.length + resultados.clientes.length;
  const mostrarPainel = aberto && termo.trim().length >= 2;

  return (
    <div className="relative px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => setAberto(true)}
          placeholder="Buscar cliente ou contato (CRM)..."
          className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
        />
        {termo && (
          <button
            onClick={() => { setTermo(''); setAberto(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {mostrarPainel && (
        <div className="absolute left-4 right-4 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl max-h-80 overflow-y-auto">
          {buscando && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
            </div>
          )}

          {!buscando && totalResultados === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">
              Nenhum resultado para "{termo}"
            </div>
          )}

          {!buscando && resultados.clientes.length > 0 && (
            <div>
              <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Clientes (CRM)
              </div>
              {resultados.clientes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irPara({ cliente: c.id })}
                  className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">{c.nome || c.empresa || 'Sem nome'}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      {c.telefone || c.celular ? <><Phone className="w-3 h-3" />{c.telefone || c.celular}</> : (c.email ? <><Mail className="w-3 h-3" />{c.email}</> : c.empresa)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!buscando && resultados.contatos.length > 0 && (
            <div>
              <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3 h-3" /> Contatos
              </div>
              {resultados.contatos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => irPara({ contact: c.id })}
                  className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors flex items-center gap-3"
                >
                  {c.foto_perfil_url ? (
                    <img src={c.foto_perfil_url} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-purple-600" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">{c.nome || 'Sem nome'}</p>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      {c.telefone ? <><Phone className="w-3 h-3" />{c.telefone}</> : (c.email ? <><Mail className="w-3 h-3" />{c.email}</> : c.empresa)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}