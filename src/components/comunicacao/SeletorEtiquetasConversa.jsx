import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, X, Loader2, Plus, Check, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizarSlugEtiqueta } from "../lib/normalizarEtiqueta";

const SETORES = [
  { value: 'geral', label: 'Geral' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'assistencia', label: 'Assistência' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'compras', label: 'Compras' },
];

/**
 * Seletor de etiquetas de CONVERSA (MessageThread.tags).
 * Filtra etiquetas por setor do atendente (geral + setor do usuário).
 * Mesma regra das etiquetas de contato: anti-duplicado por slug canônico
 * e criação restrita a admin / gerente / coordenador.
 */
export default function SeletorEtiquetasConversa({
  thread,
  onUpdate,
  variant = 'default', // 'default' | 'compact'
  disabled = false,
  usuarioAtual = null,
}) {
  const setorUsuario = usuarioAtual?.attendant_sector || 'geral';
  const podeCriarEtiqueta = (() => {
    if (!usuarioAtual) return false;
    if (usuarioAtual.role === 'admin') return true;
    return ['gerente', 'coordenador'].includes(usuarioAtual.attendant_role);
  })();

  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [criandoNova, setCriandoNova] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const queryClient = useQueryClient();

  const etiquetasAtuais = thread?.tags || [];

  const { data: etiquetasDB = [], isLoading } = useQuery({
    queryKey: ['etiquetas-conversa'],
    queryFn: () => base44.entities.EtiquetaConversa.filter({ ativa: true }, 'ordem'),
    staleTime: 5 * 60 * 1000,
  });

  // Etiquetas visíveis: do setor 'geral' OU do setor do usuário (admin vê tudo)
  const etiquetasFiltradas = useMemo(() => {
    const isAdmin = usuarioAtual?.role === 'admin';
    return etiquetasDB.filter(etq => {
      if (busca && !etq.label?.toLowerCase().includes(busca.toLowerCase())) return false;
      if (isAdmin) return true;
      return etq.setor === 'geral' || etq.setor === setorUsuario;
    });
  }, [etiquetasDB, busca, setorUsuario, usuarioAtual]);

  const getEtiquetaConfig = (nome) => {
    return etiquetasDB.find(e => e.nome === nome) || {
      nome,
      label: nome.replace(/_/g, ' '),
      emoji: '🏷️',
      cor: 'bg-slate-400',
    };
  };

  const toggleEtiqueta = async (slug) => {
    if (disabled || salvando || !thread) return;
    setSalvando(true);
    try {
      const novas = etiquetasAtuais.includes(slug)
        ? etiquetasAtuais.filter(e => e !== slug)
        : [...etiquetasAtuais, slug];

      await base44.entities.MessageThread.update(thread.id, { tags: novas });

      const etq = etiquetasDB.find(e => e.nome === slug);
      if (etq && !etiquetasAtuais.includes(slug)) {
        await base44.entities.EtiquetaConversa.update(etq.id, { uso_count: (etq.uso_count || 0) + 1 });
      }

      queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      queryClient.invalidateQueries({ queryKey: ['etiquetas-conversa'] });

      const config = etiquetasDB.find(e => e.nome === slug);
      toast.success(`${config?.emoji || '🏷️'} ${novas.includes(slug) ? 'Adicionada' : 'Removida'}`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[SeletorEtiquetasConversa] Erro:', error);
      toast.error('Erro ao atualizar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  const criarNovaEtiqueta = async () => {
    if (!novaEtiqueta.trim() || salvando) return;
    if (!podeCriarEtiqueta) {
      toast.error('❌ Apenas admin, gerente ou coordenador podem criar etiquetas');
      return;
    }
    setSalvando(true);
    try {
      const slug = normalizarSlugEtiqueta(novaEtiqueta);
      const labelOriginal = novaEtiqueta.trim();

      const existente = etiquetasDB.find(e =>
        normalizarSlugEtiqueta(e.nome) === slug || normalizarSlugEtiqueta(e.label) === slug
      );
      if (existente) {
        toast.warning(`Etiqueta já existe: ${existente.emoji || '🏷️'} ${existente.label}`);
        if (thread && !etiquetasAtuais.includes(existente.nome)) {
          await base44.entities.MessageThread.update(thread.id, { tags: [...etiquetasAtuais, existente.nome] });
          queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
          if (onUpdate) onUpdate();
        }
        setNovaEtiqueta('');
        setCriandoNova(false);
        setSalvando(false);
        return;
      }

      await base44.entities.EtiquetaConversa.create({
        nome: slug,
        label: labelOriginal,
        emoji: '🏷️',
        cor: 'bg-slate-500',
        setor: setorUsuario,
        ativa: true,
        uso_count: 1,
      });

      if (thread) {
        await base44.entities.MessageThread.update(thread.id, { tags: [...etiquetasAtuais, slug] });
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      }

      queryClient.invalidateQueries({ queryKey: ['etiquetas-conversa'] });
      toast.success('✅ Etiqueta criada!');
      setNovaEtiqueta('');
      setCriandoNova(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[SeletorEtiquetasConversa] Erro ao criar:', error);
      toast.error('Erro ao criar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  const conteudo = (
    <div className="max-h-80 overflow-hidden flex flex-col">
      <div className="p-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-700">Etiquetas da Conversa</span>
          {etiquetasAtuais.length > 0 && (
            <Badge variant="secondary" className="text-xs">{etiquetasAtuais.length}</Badge>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mb-2">
          Setor: <span className="font-medium capitalize">{setorUsuario}</span>
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e?.target?.value || '')}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {podeCriarEtiqueta && (
        <div className="p-2 border-b">
          {!criandoNova ? (
            <button
              onClick={() => setCriandoNova(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova etiqueta ({setorUsuario})
            </button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Nome da etiqueta..."
                value={novaEtiqueta}
                onChange={(e) => setNovaEtiqueta(e?.target?.value || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') criarNovaEtiqueta();
                  if (e.key === 'Escape') { setCriandoNova(false); setNovaEtiqueta(''); }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={criarNovaEtiqueta}
                  disabled={!novaEtiqueta.trim() || salvando}
                  className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setCriandoNova(false); setNovaEtiqueta(''); }}
                  className="h-7 text-xs"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {etiquetasAtuais.length > 0 && (
        <div className="p-2 border-b">
          <span className="text-xs text-slate-500 font-medium mb-1 block">Ativas:</span>
          <div className="flex flex-wrap gap-1">
            {etiquetasAtuais.map(nome => {
              const config = getEtiquetaConfig(nome);
              return (
                <Badge
                  key={nome}
                  className={`${config.cor} text-white text-xs cursor-pointer hover:opacity-80`}
                  onClick={() => toggleEtiqueta(nome)}
                >
                  {config.emoji} {config.label}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : etiquetasFiltradas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Nenhuma etiqueta encontrada</p>
        ) : (
          <div className="space-y-1">
            {etiquetasFiltradas.map(etq => {
              const isAtiva = etiquetasAtuais.includes(etq.nome);
              return (
                <button
                  key={etq.nome}
                  onClick={() => toggleEtiqueta(etq.nome)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-all ${
                    isAtiva ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${etq.cor}`} />
                  <span>{etq.emoji}</span>
                  <span className="flex-1 truncate">{etq.label}</span>
                  {etq.setor !== 'geral' && (
                    <span className="text-[9px] uppercase text-slate-400">{etq.setor}</span>
                  )}
                  {isAtiva && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        {variant === 'compact' ? (
          <button className="p-1 rounded-full hover:bg-slate-100 transition-colors" disabled={disabled || salvando}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Tag className="w-4 h-4 text-slate-500 hover:text-blue-600" />}
          </button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 border-dashed hover:border-solid hover:bg-slate-50" disabled={disabled || salvando}>
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            {etiquetasAtuais.length > 0 ? `${etiquetasAtuais.length} etiquetas` : 'Etiquetar conversa'}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        {conteudo}
      </PopoverContent>
    </Popover>
  );
}