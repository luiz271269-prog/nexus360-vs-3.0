import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, X, Loader2, Plus, Check, Search } from "lucide-react";
import { toast } from "sonner";
import UsuarioDisplay from "./UsuarioDisplay";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Componente unificado para selecionar e aplicar etiquetas a contatos
 * Usado em: ContactInfoPanel, ChatSidebar, SearchAndFilter
 */
export default function SeletorEtiquetasContato({
  contato,
  onUpdate,
  setorUsuario = 'geral',
  tipoContato = 'novo',
  variant = 'default', // 'default' | 'compact' | 'filter' | 'badges-only'
  maxDestaques = 2,
  disabled = false,
  // Para modo filtro
  selectedTags = [],
  onTagsChange,
  // Para criar novas
  permitirCriar = true,
  // Para exibição de usuários
  atendentes = []
}) {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [criandoNova, setCriandoNova] = React.useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = React.useState('');
  const queryClient = useQueryClient();

  const etiquetasAtuais = contato?.tags || selectedTags || [];

  // Buscar todas etiquetas ativas
  const { data: etiquetasDB = [], isLoading } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'ordem'),
    staleTime: 5 * 60 * 1000
  });

  // Filtrar etiquetas aplicáveis ao contexto
  const etiquetasFiltradas = React.useMemo(() => {
    return etiquetasDB.filter(etq => {
      // Filtro de busca
      if (busca && !etq.label?.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      // Filtro de setor (global ou do setor do usuário)
      if (etq.setor && etq.setor !== 'global' && etq.setor !== setorUsuario) {
        return false;
      }
      // Filtro de tipo de contato aplicável
      if (etq.tipos_contato_aplicaveis?.length > 0 && 
          !etq.tipos_contato_aplicaveis.includes(tipoContato)) {
        return false;
      }
      return true;
    });
  }, [etiquetasDB, busca, setorUsuario, tipoContato]);

  // Etiquetas de destaque (para exibição na sidebar)
  const etiquetasDestaque = React.useMemo(() => {
    return etiquetasDB.filter(e => e.destaque === true);
  }, [etiquetasDB]);

  // Toggle etiqueta no contato
  const toggleEtiqueta = async (nomeEtiqueta) => {
    if (disabled || salvando) return;

    // Modo filtro
    if (onTagsChange) {
      const novas = selectedTags.includes(nomeEtiqueta)
        ? selectedTags.filter(t => t !== nomeEtiqueta)
        : [...selectedTags, nomeEtiqueta];
      onTagsChange(novas);
      return;
    }

    // Modo edição de contato
    if (!contato) return;

    setSalvando(true);
    try {
      const novasEtiquetas = etiquetasAtuais.includes(nomeEtiqueta)
        ? etiquetasAtuais.filter(e => e !== nomeEtiqueta)
        : [...etiquetasAtuais, nomeEtiqueta];

      await base44.entities.Contact.update(contato.id, { tags: novasEtiquetas });

      // Atualizar contador de uso
      const etq = etiquetasDB.find(e => e.nome === nomeEtiqueta);
      if (etq && !etiquetasAtuais.includes(nomeEtiqueta)) {
        await base44.entities.EtiquetaContato.update(etq.id, {
          uso_count: (etq.uso_count || 0) + 1
        });
      }

      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });

      const config = etiquetasDB.find(e => e.nome === nomeEtiqueta);
      toast.success(`${config?.emoji || '🏷️'} ${novasEtiquetas.includes(nomeEtiqueta) ? 'Adicionada' : 'Removida'}`);

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[SeletorEtiquetas] Erro:', error);
      toast.error('Erro ao atualizar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  // Criar nova etiqueta
  const criarNovaEtiqueta = async () => {
    if (!novaEtiqueta.trim() || salvando) return;

    setSalvando(true);
    try {
      const nomeNormalizado = novaEtiqueta.trim().toLowerCase().replace(/\s+/g, '_');
      const labelOriginal = novaEtiqueta.trim();

      // Verificar se já existe
      const existente = etiquetasDB.find(e => e.nome === nomeNormalizado);
      if (existente) {
        toast.warning('Etiqueta já existe');
        setNovaEtiqueta('');
        setCriandoNova(false);
        setSalvando(false);
        return;
      }

      // Criar no banco
      await base44.entities.EtiquetaContato.create({
        nome: nomeNormalizado,
        label: labelOriginal,
        emoji: '🏷️',
        cor: 'bg-slate-500',
        tipo: 'personalizada',
        setor: setorUsuario === 'geral' ? 'global' : setorUsuario,
        categoria: 'outro',
        ativa: true,
        uso_count: 1
      });

      // Se tem contato, adicionar a ele
      if (contato) {
        const novasEtiquetas = [...etiquetasAtuais, nomeNormalizado];
        await base44.entities.Contact.update(contato.id, { tags: novasEtiquetas });
        queryClient.invalidateQueries({ queryKey: ['contatos'] });
      }

      // Se modo filtro, adicionar ao filtro
      if (onTagsChange) {
        onTagsChange([...selectedTags, nomeNormalizado]);
      }

      queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });
      toast.success('✅ Etiqueta criada!');
      setNovaEtiqueta('');
      setCriandoNova(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[SeletorEtiquetas] Erro ao criar:', error);
      toast.error('Erro ao criar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  // Helper para obter config da etiqueta
  const getEtiquetaConfig = (nome) => {
    return etiquetasDB.find(e => e.nome === nome) || {
      nome,
      label: nome.replace(/_/g, ' '),
      emoji: '🏷️',
      cor: 'bg-slate-400'
    };
  };

  // Helper para exibir atendente com nome completo
  const getAtendenteName = (atendenteId) => {
    if (!atendenteId) return null;
    const atendente = atendentes.find(a => a.id === atendenteId);
    return atendente?.full_name || atendente?.email || atendenteId;
  };

  // ═══════════════════════════════════════════════════════════════════
  // VARIANTES DE RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════

  // Badges apenas (para exibição na sidebar)
  if (variant === 'badges-only') {
    const etiquetasExibir = etiquetasAtuais
      .map(nome => getEtiquetaConfig(nome))
      .filter(e => e.destaque || etiquetasDestaque.some(d => d.nome === e.nome))
      .slice(0, maxDestaques);

    if (etiquetasExibir.length === 0) return null;

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {etiquetasExibir.map(etq => (
          <span
            key={etq.nome}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${etq.cor} shadow-sm`}
          >
            {etq.emoji} {etq.label}
          </span>
        ))}
      </div>
    );
  }

  // Modo compacto (botão pequeno com popover)
  if (variant === 'compact') {
    return (
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            className="p-1 rounded-full hover:bg-slate-100 transition-colors"
            disabled={disabled || salvando}
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <Tag className="w-4 h-4 text-slate-500 hover:text-purple-600" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <ConteudoPopover
            etiquetasFiltradas={etiquetasFiltradas}
            etiquetasAtuais={etiquetasAtuais}
            busca={busca}
            setBusca={setBusca}
            toggleEtiqueta={toggleEtiqueta}
            criandoNova={criandoNova}
            setCriandoNova={setCriandoNova}
            novaEtiqueta={novaEtiqueta}
            setNovaEtiqueta={setNovaEtiqueta}
            criarNovaEtiqueta={criarNovaEtiqueta}
            salvando={salvando}
            permitirCriar={permitirCriar}
            isLoading={isLoading}
            getEtiquetaConfig={getEtiquetaConfig}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Modo filtro (para SearchAndFilter)
  if (variant === 'filter') {
    return (
      <div className="space-y-2">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar etiqueta..."
            value={busca}
            onChange={(e) => setBusca(e?.target?.value || '')}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Tags selecionadas */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTags.map(nome => {
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
        )}

        {/* Lista de opções */}
        <div className="max-h-40 overflow-y-auto space-y-1">
          {etiquetasFiltradas.map(etq => (
            <button
              key={etq.nome}
              onClick={() => toggleEtiqueta(etq.nome)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-all ${
                selectedTags.includes(etq.nome)
                  ? 'bg-purple-100 text-purple-700'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${etq.cor}`} />
              <span>{etq.emoji}</span>
              <span className="flex-1">{etq.label}</span>
              {selectedTags.includes(etq.nome) && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Modo padrão (botão com texto + popover)
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-dashed hover:border-solid hover:bg-slate-50"
          disabled={disabled || salvando}
        >
          <Tag className="w-3.5 h-3.5 mr-1.5" />
          {etiquetasAtuais.length > 0 ? `${etiquetasAtuais.length} etiquetas` : 'Etiquetar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <ConteudoPopover
          etiquetasFiltradas={etiquetasFiltradas}
          etiquetasAtuais={etiquetasAtuais}
          busca={busca}
          setBusca={setBusca}
          toggleEtiqueta={toggleEtiqueta}
          criandoNova={criandoNova}
          setCriandoNova={setCriandoNova}
          novaEtiqueta={novaEtiqueta}
          setNovaEtiqueta={setNovaEtiqueta}
          criarNovaEtiqueta={criarNovaEtiqueta}
          salvando={salvando}
          permitirCriar={permitirCriar}
          isLoading={isLoading}
          getEtiquetaConfig={getEtiquetaConfig}
        />
      </PopoverContent>
    </Popover>
  );
}

// Componente interno do conteúdo do Popover
function ConteudoPopover({
  etiquetasFiltradas,
  etiquetasAtuais,
  busca,
  setBusca,
  toggleEtiqueta,
  criandoNova,
  setCriandoNova,
  novaEtiqueta,
  setNovaEtiqueta,
  criarNovaEtiqueta,
  salvando,
  permitirCriar,
  isLoading,
  getEtiquetaConfig
}) {
  return (
    <div className="max-h-80 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-slate-700">Etiquetas</span>
          {etiquetasAtuais.length > 0 && (
            <Badge variant="secondary" className="text-xs">{etiquetasAtuais.length}</Badge>
          )}
        </div>
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

      {/* Criar nova */}
      {permitirCriar && (
        <div className="p-2 border-b">
          {!criandoNova ? (
            <button
              onClick={() => setCriandoNova(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova etiqueta personalizada
            </button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Nome da etiqueta..."
                value={novaEtiqueta}
                onChange={(e) => setNovaEtiqueta(e?.target?.value || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') criarNovaEtiqueta();
                  if (e.key === 'Escape') {
                    setCriandoNova(false);
                    setNovaEtiqueta('');
                  }
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={criarNovaEtiqueta}
                  disabled={!novaEtiqueta.trim() || salvando}
                  className="flex-1 h-7 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCriandoNova(false);
                    setNovaEtiqueta('');
                  }}
                  className="h-7 text-xs"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Etiquetas ativas no contato */}
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

      {/* Lista de etiquetas */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : etiquetasFiltradas.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            Nenhuma etiqueta encontrada
          </p>
        ) : (
          <div className="space-y-1">
            {etiquetasFiltradas.map(etq => {
              const isAtiva = etiquetasAtuais.includes(etq.nome);
              return (
                <button
                  key={etq.nome}
                  onClick={() => toggleEtiqueta(etq.nome)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-all ${
                    isAtiva
                      ? 'bg-purple-100 text-purple-700'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${etq.cor}`} />
                  <span>{etq.emoji}</span>
                  <span className="flex-1 truncate">{etq.label}</span>
                  {isAtiva && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook para uso em outros componentes
export function useEtiquetasContato() {
  const { data: etiquetas = [], isLoading } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'ordem'),
    staleTime: 5 * 60 * 1000
  });

  const getConfig = (nome) => {
    return etiquetas.find(e => e.nome === nome) || {
      nome,
      label: nome.replace(/_/g, ' '),
      emoji: '🏷️',
      cor: 'bg-slate-400'
    };
  };

  const etiquetasDestaque = etiquetas.filter(e => e.destaque === true);

  return { etiquetas, etiquetasDestaque, getConfig, isLoading };
}