import React, { useEffect, useState, useMemo } from "react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, UserPlus, User, Users, AlertCircle, Phone, Tag, Check,
  Filter, X, ChevronDown, Building2, Target, Truck, Handshake, HelpCircle,
  Sparkles, Crown, Zap, Star, CheckSquare } from
'lucide-react';
import { normalizarTelefone } from '../lib/phoneUtils';
import { CATEGORIAS_FIXAS } from './CategorizadorRapido';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from
"@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion, AnimatePresence } from "framer-motion";
import { getUserDisplayName } from '../lib/userHelpers';

// Configuração de tipos de contato
const TIPOS_CONTATO = [
{ value: 'all', label: 'Todos', icon: Users, color: 'bg-slate-500', emoji: '👥' },
{ value: 'novo', label: 'Novos', icon: HelpCircle, color: 'bg-slate-400', emoji: '❓' },
{ value: 'lead', label: 'Leads', icon: Target, color: 'bg-amber-500', emoji: '🎯' },
{ value: 'cliente', label: 'Clientes', icon: Building2, color: 'bg-emerald-500', emoji: '💎' },
{ value: 'fornecedor', label: 'Fornecedores', icon: Truck, color: 'bg-blue-500', emoji: '🏭' },
{ value: 'parceiro', label: 'Parceiros', icon: Handshake, color: 'bg-purple-500', emoji: '🤝' }];


export default function SearchAndFilter({
  searchTerm,
  onSearchChange,
  filterScope,
  onFilterScopeChange,
  selectedAttendantId,
  onSelectedAttendantChange,
  atendentes,
  isManager,
  novoContatoTelefone,
  onNovoContatoTelefoneChange,
  onCreateContact,
  integracoes = [],
  selectedIntegrationId,
  onSelectedIntegrationChange,
  selectedCategoria,
  onSelectedCategoriaChange,
  // Novos props para filtro de tipo e tag
  selectedTipoContato,
  onSelectedTipoContatoChange,
  selectedTagContato,
  onSelectedTagContatoChange,
  // Props para seleção múltipla
  modoSelecaoMultipla = false,
  onModoSelecaoMultiplaChange
}) {
  const [showFilters, setShowFilters] = useState(false);
  
  // Estados locais para seleções múltiplas
  const [selectedIntegrations, setSelectedIntegrations] = useState([]);
  const [selectedAttendants, setSelectedAttendants] = useState([]);
  const [selectedTiposContato, setSelectedTiposContato] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas de contato dinâmicas
  const { data: etiquetasDB = [] } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true, destaque: true }, 'ordem'),
    staleTime: 5 * 60 * 1000
  });

  // Etiquetas de destaque dinâmicas
  const etiquetasDestaque = useMemo(() => {
    return etiquetasDB.map((etq) => ({
      value: etq.nome,
      label: etq.label,
      color: etq.cor || 'bg-slate-500',
      emoji: etq.emoji || '🏷️'
    }));
  }, [etiquetasDB]);

  const todasCategorias = [...CATEGORIAS_FIXAS, ...categoriasDB].map((cat) => ({
    value: cat.nome,
    label: cat.label,
    color: cat.cor,
    emoji: cat.emoji || '🏷️'
  }));

  // Detectar telefone automaticamente
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      if (novoContatoTelefone) {
        onNovoContatoTelefoneChange('');
      }
      return;
    }

    const telefoneNormalizado = normalizarTelefone(searchTerm);

    if (telefoneNormalizado) {
      if (telefoneNormalizado !== novoContatoTelefone) {
        onNovoContatoTelefoneChange(telefoneNormalizado);
      }
    } else {
      if (novoContatoTelefone) {
        onNovoContatoTelefoneChange('');
      }
    }
  }, [searchTerm, novoContatoTelefone, onNovoContatoTelefoneChange]);

  // Contar filtros ativos (incluindo múltiplas seleções)
  const filtrosAtivos = [
    filterScope !== 'all' && filterScope !== 'my',
    selectedIntegrations.length > 0,
    selectedAttendants.length > 0,
    selectedCategoria && selectedCategoria !== 'all',
    selectedTiposContato.length > 0,
    selectedTags.length > 0
  ].filter(Boolean).length;

  const limparFiltros = () => {
    onFilterScopeChange('all');
    setSelectedIntegrations([]);
    setSelectedAttendants([]);
    onSelectedCategoriaChange('all');
    setSelectedTiposContato([]);
    setSelectedTags([]);
    setShowFilters(false);
  };
  
  // Sincronizar arrays com props legados (compatibilidade)
  useEffect(() => {
    if (selectedIntegrations.length === 1) {
      onSelectedIntegrationChange(selectedIntegrations[0]);
    } else if (selectedIntegrations.length === 0) {
      onSelectedIntegrationChange('all');
    }
  }, [selectedIntegrations]);
  
  useEffect(() => {
    if (selectedAttendants.length === 1) {
      onSelectedAttendantChange(selectedAttendants[0]);
    } else if (selectedAttendants.length === 0) {
      onSelectedAttendantChange(null);
    }
  }, [selectedAttendants]);
  
  useEffect(() => {
    if (selectedTiposContato.length === 1 && onSelectedTipoContatoChange) {
      onSelectedTipoContatoChange(selectedTiposContato[0]);
    } else if (selectedTiposContato.length === 0 && onSelectedTipoContatoChange) {
      onSelectedTipoContatoChange('all');
    }
  }, [selectedTiposContato]);
  
  useEffect(() => {
    if (selectedTags.length === 1 && onSelectedTagContatoChange) {
      onSelectedTagContatoChange(selectedTags[0]);
    } else if (selectedTags.length === 0 && onSelectedTagContatoChange) {
      onSelectedTagContatoChange('all');
    }
  }, [selectedTags]);

  // Chip de filtro ativo
  const FilterChip = ({ label, emoji, color, onRemove }) =>
  <motion.span
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.8, opacity: 0 }}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white ${color} shadow-sm`}>

      {emoji} {label}
      <button onClick={onRemove} className="ml-0.5 hover:bg-white/20 rounded-full p-0.5">
        <X className="w-2.5 h-2.5" />
      </button>
    </motion.span>;


  // Botão com checkbox para seleção múltipla
  const MultiSelectOption = ({ checked, onChange, icon: Icon, emoji, label, color }) => (
    <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-all hover:bg-slate-50 cursor-pointer">
      <Checkbox 
        checked={checked}
        onCheckedChange={onChange}
        className="flex-shrink-0"
      />
      {emoji && <span className="flex-shrink-0">{emoji}</span>}
      {Icon && !emoji && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="flex-1 truncate text-xs">{label}</span>
      {checked && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
    </label>
  );

  // Botão de opção simples (single select)
  const FilterOption = ({ selected, onClick, icon: Icon, emoji, label, color }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
        selected
          ? `${color} text-white shadow-md`
          : 'hover:bg-slate-100 text-slate-700'
      }`}
    >
      {emoji && <span className="flex-shrink-0">{emoji}</span>}
      {Icon && !emoji && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="w-3.5 h-3.5" />}
    </button>
  );
  
  // Handlers para seleções múltiplas
  const toggleIntegration = (id) => {
    setSelectedIntegrations(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  
  const toggleAttendant = (id) => {
    setSelectedAttendants(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };
  
  const toggleTipoContato = (tipo) => {
    setSelectedTiposContato(prev => 
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };
  
  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };


  return (
    <div className="bg-slate-50 text-[#343979] px-3 py-1 rounded-lg border-b border-slate-200 flex-shrink-0 space-y-2 from-white to-slate-50">
      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Buscar contato, empresa..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-12 py-2.5 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />

        
        {/* Botão de Seleção Múltipla */}
        {onModoSelecaoMultiplaChange && (
          <button
            onClick={() => onModoSelecaoMultiplaChange(!modoSelecaoMultipla)}
            className={`absolute right-10 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-all ${
              modoSelecaoMultipla
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Selecionar múltiplos contatos para envio em massa"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
        )}

        {/* Botão de filtros */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <button className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-all ${
            filtrosAtivos > 0 ?
            'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md' :
            'hover:bg-slate-100 text-slate-500'}`
            }>
              <Filter className="w-4 h-4" />
              {filtrosAtivos > 0 &&
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-orange-600 text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                  {filtrosAtivos}
                </span>
              }
            </button>
          </PopoverTrigger>
          
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-2 border-b bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4" /> Filtros
                </h3>
                {filtrosAtivos > 0 && (
                  <button
                    onClick={limparFiltros}
                    className="text-xs text-orange-300 hover:text-white transition-colors"
                  >
                    Limpar ({filtrosAtivos})
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[65vh] overflow-y-auto">
              <Accordion type="multiple" defaultValue={["escopo"]} className="w-full">
              <AccordionItem value="escopo" className="border-b-0">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                  📋 ESCOPO
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2 space-y-1">
                  <FilterOption
                    selected={filterScope === 'my'}
                    onClick={() => onFilterScopeChange('my')}
                    icon={User}
                    label="Minhas conversas"
                    color="bg-blue-500"
                  />
                  <FilterOption
                    selected={filterScope === 'unassigned'}
                    onClick={() => onFilterScopeChange('unassigned')}
                    icon={AlertCircle}
                    label="Não atribuídas"
                    color="bg-orange-500"
                  />
                  {isManager && (
                    <FilterOption
                      selected={filterScope === 'all'}
                      onClick={() => onFilterScopeChange('all')}
                      icon={Users}
                      label="Todas"
                      color="bg-emerald-500"
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              {isManager && atendentes.length > 0 && (
                <AccordionItem value="atendentes" className="border-b-0">
                  <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                    👥 ATENDENTES {selectedAttendants.length > 0 && (
                      <Badge className="ml-2 h-4 px-1.5 bg-purple-500 text-white text-[10px]">
                        {selectedAttendants.length}
                      </Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
                    {atendentes.map((att) => (
                      <MultiSelectOption
                        key={att.id}
                        checked={selectedAttendants.includes(att.id)}
                        onChange={() => toggleAttendant(att.id)}
                        icon={User}
                        label={getUserDisplayName(att.id, atendentes, { incluirSetor: true })}
                        color="bg-purple-500"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {integracoes.length > 0 && (
                <AccordionItem value="conexoes" className="border-b-0">
                  <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                    📱 CONEXÕES {selectedIntegrations.length > 0 && (
                      <Badge className="ml-2 h-4 px-1.5 bg-green-500 text-white text-[10px]">
                        {selectedIntegrations.length}
                      </Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-2 space-y-0.5">
                    {integracoes.map((int) => (
                      <MultiSelectOption
                        key={int.id}
                        checked={selectedIntegrations.includes(int.id)}
                        onChange={() => toggleIntegration(int.id)}
                        emoji={int.status === 'conectado' ? '🟢' : '🔴'}
                        label={int.nome_instancia}
                        color="bg-green-600"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {onSelectedTipoContatoChange && (
                <AccordionItem value="tipos" className="border-b-0">
                  <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                    🏷️ TIPO {selectedTiposContato.length > 0 && (
                      <Badge className="ml-2 h-4 px-1.5 bg-amber-500 text-white text-[10px]">
                        {selectedTiposContato.length}
                      </Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-2 grid grid-cols-2 gap-1">
                    {TIPOS_CONTATO.filter(t => t.value !== 'all').map((tipo) => (
                      <MultiSelectOption
                        key={tipo.value}
                        checked={selectedTiposContato.includes(tipo.value)}
                        onChange={() => toggleTipoContato(tipo.value)}
                        emoji={tipo.emoji}
                        label={tipo.label}
                        color={tipo.color}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {onSelectedTagContatoChange && etiquetasDestaque.length > 0 && (
                <AccordionItem value="etiquetas" className="border-b-0">
                  <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                    ⭐ ETIQUETAS {selectedTags.length > 0 && (
                      <Badge className="ml-2 h-4 px-1.5 bg-indigo-500 text-white text-[10px]">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-2 grid grid-cols-2 gap-1">
                    {etiquetasDestaque.map((tag) => (
                      <MultiSelectOption
                        key={tag.value}
                        checked={selectedTags.includes(tag.value)}
                        onChange={() => toggleTag(tag.value)}
                        emoji={tag.emoji}
                        label={tag.label}
                        color={tag.color}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="categorias" className="border-b-0">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-slate-500 hover:no-underline hover:bg-slate-50">
                  🎯 CATEGORIAS {selectedCategoria && selectedCategoria !== 'all' && (
                    <Badge className="ml-2 h-4 px-1.5 bg-purple-500 text-white text-[10px]">1</Badge>
                  )}
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-2 space-y-0.5 max-h-40 overflow-y-auto">
                  <FilterOption
                    selected={!selectedCategoria || selectedCategoria === 'all'}
                    onClick={() => onSelectedCategoriaChange('all')}
                    icon={Tag}
                    label="Todas"
                    color="bg-slate-500"
                  />
                  {todasCategorias.map((cat) => (
                    <FilterOption
                      key={cat.value}
                      selected={selectedCategoria === cat.value}
                      onClick={() => onSelectedCategoriaChange(cat.value)}
                      emoji={cat.emoji}
                      label={cat.label}
                      color={cat.color || 'bg-purple-500'}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
              
              </Accordion>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chips de filtros ativos */}
      <AnimatePresence>
        {filtrosAtivos > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1 overflow-hidden"
          >
            {filterScope !== 'all' && filterScope !== 'my' && (
              <FilterChip
                label={filterScope === 'unassigned' ? 'Não atribuídas' : 'Por atendente'}
                emoji={filterScope === 'unassigned' ? '⚠️' : '👤'}
                color="bg-blue-500"
                onRemove={() => onFilterScopeChange('all')}
              />
            )}
            
            {selectedIntegrations.map(id => {
              const int = integracoes.find(i => i.id === id);
              return int ? (
                <FilterChip
                  key={id}
                  label={int.nome_instancia}
                  emoji="📱"
                  color="bg-green-500"
                  onRemove={() => toggleIntegration(id)}
                />
              ) : null;
            })}
            
            {selectedAttendants.map(id => {
              const nome = getUserDisplayName(id, atendentes);
              return (
                <FilterChip
                  key={id}
                  label={nome.split(' ')[0]}
                  emoji="👤"
                  color="bg-purple-500"
                  onRemove={() => toggleAttendant(id)}
                />
              );
            })}
            
            {selectedTiposContato.map(tipo => {
              const cfg = TIPOS_CONTATO.find(t => t.value === tipo);
              return cfg ? (
                <FilterChip
                  key={tipo}
                  label={cfg.label}
                  emoji={cfg.emoji}
                  color={cfg.color}
                  onRemove={() => toggleTipoContato(tipo)}
                />
              ) : null;
            })}
            
            {selectedTags.map(tag => {
              const cfg = etiquetasDestaque.find(t => t.value === tag);
              return cfg ? (
                <FilterChip
                  key={tag}
                  label={cfg.label}
                  emoji={cfg.emoji}
                  color={cfg.color}
                  onRemove={() => toggleTag(tag)}
                />
              ) : null;
            })}
            
            {selectedCategoria && selectedCategoria !== 'all' && (
              <FilterChip
                label={todasCategorias.find(c => c.value === selectedCategoria)?.label || selectedCategoria}
                emoji={todasCategorias.find(c => c.value === selectedCategoria)?.emoji || '🏷️'}
                color="bg-purple-500"
                onRemove={() => onSelectedCategoriaChange('all')}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão criar contato */}
      {novoContatoTelefone &&
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}>

          <Button
          onClick={onCreateContact}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/25"
          size="sm">

            <UserPlus className="w-4 h-4 mr-2" />
            Criar Contato: {novoContatoTelefone}
          </Button>
        </motion.div>
      }
    </div>);

}