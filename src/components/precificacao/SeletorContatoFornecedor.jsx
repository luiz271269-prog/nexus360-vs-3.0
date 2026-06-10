import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, MessageSquare, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Campo de busca de contato para vincular à precificação.
 * Permite abrir conversa direta com o contato (fornecedor) na Central de Comunicação.
 */
export default function SeletorContatoFornecedor({ contato, onSelect }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const navigate = useNavigate();

  const buscar = async () => {
    if (!termo.trim() || termo.trim().length < 2) return;
    setBuscando(true);
    try {
      const res = await base44.functions.invoke('buscarContatosLivre', { searchTerm: termo.trim(), limit: 20 });
      setResultados(res?.data?.contatos?.slice(0, 8) || []);
    } catch (e) {
      toast.error(`Erro na busca: ${e.message}`);
    } finally {
      setBuscando(false);
    }
  };

  const pedirAtualizacao = () => {
    if (!contato?.telefone) {
      toast.error('Contato sem telefone');
      return;
    }
    navigate('/Comunicacao');
    // Aguarda a Central montar e expor o handler global
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      if (typeof window.handleAbrirConversaPorTelefone === 'function') {
        clearInterval(timer);
        window.handleAbrirConversaPorTelefone(contato.telefone, contato.nome);
      } else if (tentativas > 40) {
        clearInterval(timer);
      }
    }, 250);
  };

  if (contato) {
    return (
      <div>
        <Label className="text-xs font-semibold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
          <span className="text-pink-400">👤</span> Contato Vinculado
        </Label>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-8 px-2 flex items-center bg-slate-800/50 border border-pink-500/30 rounded-md text-xs text-white truncate">
            {contato.nome}
          </div>
          <Button size="icon" onClick={pedirAtualizacao} title="Pedir atualização via mensagem"
            className="h-8 w-8 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onSelect(null)} title="Remover vínculo"
            className="h-8 w-8 text-slate-400 hover:text-red-400 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Label className="text-xs font-semibold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent leading-none flex items-center gap-1 mb-2">
        <span className="text-pink-400">👤</span> Contato (fornecedor)
      </Label>
      <div className="flex items-center gap-1">
        <Input
          placeholder="Buscar contato..."
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="h-8 text-xs px-2 py-1 bg-slate-800/50 border-pink-500/30 focus:border-pink-400 focus:ring-pink-400/50 text-white placeholder:text-slate-400" />
        <Button size="icon" onClick={buscar} disabled={buscando}
          className="h-8 w-8 bg-slate-700 hover:bg-slate-600 shrink-0">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Search className="w-4 h-4 text-white" />}
        </Button>
      </div>
      {resultados.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
          {resultados.map((c) => (
            <button key={c.id}
              onClick={() => { onSelect({ id: c.id, nome: c.nome, telefone: c.telefone, empresa: c.empresa || '' }); setResultados([]); setTermo(''); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0">
              <div className="text-xs text-white font-medium truncate">{c.nome}</div>
              <div className="text-[10px] text-slate-400 truncate">{c.empresa ? `${c.empresa} · ` : ''}{c.telefone || 'sem telefone'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}