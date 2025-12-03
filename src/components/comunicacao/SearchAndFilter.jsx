import React, { useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { motion, AnimatePresence } from "framer-motion";

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
  onSelectedTagContatoChange
}) {
  const [showFilters, setShowFilters] = useState(false);

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

  // Contar filtros ativos
  const filtrosAtivos = [
  filterScope !== 'all' && filterScope !== 'my',
  selectedIntegrationId && selectedIntegrationId !== 'all',
  selectedCategoria && selectedCategoria !== 'all',
  selectedTipoContato && selectedTipoContato !== 'all',
  selectedTagContato && selectedTagContato !== 'all'].
  filter(Boolean).length;

  const limparFiltros = () => {
    onFilterScopeChange('all');
    onSelectedIntegrationChange('all');
    onSelectedCategoriaChange('all');
    if (onSelectedTipoContatoChange) onSelectedTipoContatoChange('all');
    if (onSelectedTagContatoChange) onSelectedTagContatoChange('all');
    setShowFilters(false);
  };

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


  // Botão de opção no popover
  const FilterOption = ({ selected, onClick, icon: Icon, emoji, label, color }) =>
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
    selected ?
    `${color} text-white shadow-md` :
    'hover:bg-slate-100 text-slate-700'}`
    }>

      {emoji && <span>{emoji}</span>}
      {Icon && !emoji && <Icon className="w-4 h-4" />}
      <span className="flex-1">{label}</span>
      {selected && <Check className="w-4 h-4" />}
    </button>;


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
            <div className="p-3 border-b bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filtros
                </h3>
                {filtrosAtivos > 0 &&
                <button
                  onClick={limparFiltros}
                  className="text-xs text-orange-300 hover:text-white transition-colors">

                    Limpar todos
                  </button>
                }
              </div>
            </div>
            
            <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Escopo de conversas */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  Escopo
                </label>
                <div className="space-y-1">
                  <FilterOption
                    selected={filterScope === 'my'}
                    onClick={() => onFilterScopeChange('my')}
                    icon={User}
                    label="Minhas conversas"
                    color="bg-blue-500" />

                  {isManager &&
                  <>
                      <FilterOption
                      selected={filterScope === 'unassigned'}
                      onClick={() => onFilterScopeChange('unassigned')}
                      icon={AlertCircle}
                      label="Não atribuídas"
                      color="bg-orange-500" />

                      <FilterOption
                      selected={filterScope === 'all'}
                      onClick={() => onFilterScopeChange('all')}
                      icon={Users}
                      label="Todas"
                      color="bg-emerald-500" />

                    </>
                  }
                </div>
              </div>

              {/* Por atendente (se manager) */}
              {isManager && atendentes.length > 0 &&
              <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Por Atendente
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {atendentes.map((att) =>
                  <FilterOption
                    key={att.id}
                    selected={selectedAttendantId === att.id}
                    onClick={() => {
                      onFilterScopeChange('specific_user');
                      onSelectedAttendantChange(selectedAttendantId === att.id ? null : att.id);
                    }}
                    icon={User}
                    label={att.full_name}
                    color="bg-purple-500" />

                  )}
                  </div>
                </div>
              }

              {/* Por conexão WhatsApp */}
              {integracoes.length > 1 &&
              <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Conexão WhatsApp
                  </label>
                  <div className="space-y-1">
                    <FilterOption
                    selected={!selectedIntegrationId || selectedIntegrationId === 'all'}
                    onClick={() => onSelectedIntegrationChange('all')}
                    icon={Phone}
                    label="Todas conexões"
                    color="bg-green-500" />

                    {integracoes.map((int) =>
                  <FilterOption
                    key={int.id}
                    selected={selectedIntegrationId === int.id}
                    onClick={() => onSelectedIntegrationChange(int.id)}
                    emoji={int.status === 'conectado' ? '🟢' : '🔴'}
                    label={int.nome_instancia}
                    color="bg-green-600" />

                  )}
                  </div>
                </div>
              }

              {/* Por tipo de contato */}
              {onSelectedTipoContatoChange &&
              <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Tipo de Contato
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {TIPOS_CONTATO.map((tipo) =>
                  <FilterOption
                    key={tipo.value}
                    selected={selectedTipoContato === tipo.value}
                    onClick={() => onSelectedTipoContatoChange(tipo.value)}
                    emoji={tipo.emoji}
                    label={tipo.label}
                    color={tipo.color} />

                  )}
                  </div>
                </div>
              }

              {/* Por etiqueta/destaque - DINÂMICO */}
              {onSelectedTagContatoChange &&
              <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Destaque
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <FilterOption
                    selected={!selectedTagContato || selectedTagContato === 'all'}
                    onClick={() => onSelectedTagContatoChange('all')}
                    icon={Tag}
                    label="Todos"
                    color="bg-slate-500" />

                    {etiquetasDestaque.map((tag) =>
                  <FilterOption
                    key={tag.value}
                    selected={selectedTagContato === tag.value}
                    onClick={() => onSelectedTagContatoChange(tag.value)}
                    emoji={tag.emoji}
                    label={tag.label}
                    color={tag.color} />

                  )}
                  </div>
                </div>
              }

              {/* Por categoria de mensagem */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  Categoria de Mensagem
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <FilterOption
                    selected={!selectedCategoria || selectedCategoria === 'all'}
                    onClick={() => onSelectedCategoriaChange('all')}
                    icon={Tag}
                    label="Todas categorias"
                    color="bg-slate-500" />

                  {todasCategorias.map((cat) =>
                  <FilterOption
                    key={cat.value}
                    selected={selectedCategoria === cat.value}
                    onClick={() => onSelectedCategoriaChange(cat.value)}
                    emoji={cat.emoji}
                    label={cat.label}
                    color={cat.color || 'bg-purple-500'} />

                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chips de filtros ativos */}
      <AnimatePresence>
        {filtrosAtivos > 0 &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="flex flex-wrap gap-1.5 overflow-hidden">

            {filterScope !== 'all' && filterScope !== 'my' &&
          <FilterChip
            label={filterScope === 'unassigned' ? 'Não atribuídas' : 'Por atendente'}
            emoji={filterScope === 'unassigned' ? '⚠️' : '👤'}
            color="bg-blue-500"
            onRemove={() => onFilterScopeChange('all')} />

          }
            
            {selectedIntegrationId && selectedIntegrationId !== 'all' &&
          <FilterChip
            label={integracoes.find((i) => i.id === selectedIntegrationId)?.nome_instancia || 'Conexão'}
            emoji="📱"
            color="bg-green-500"
            onRemove={() => onSelectedIntegrationChange('all')} />

          }
            
            {selectedTipoContato && selectedTipoContato !== 'all' &&
          <FilterChip
            label={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.label || selectedTipoContato}
            emoji={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.emoji || '👥'}
            color={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.color || 'bg-slate-500'}
            onRemove={() => onSelectedTipoContatoChange && onSelectedTipoContatoChange('all')} />

          }
            
            {selectedTagContato && selectedTagContato !== 'all' &&
          <FilterChip
            label={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.label || selectedTagContato}
            emoji={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.emoji || '🏷️'}
            color={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.color || 'bg-purple-500'}
            onRemove={() => onSelectedTagContatoChange && onSelectedTagContatoChange('all')} />

          }
            
            {selectedCategoria && selectedCategoria !== 'all' &&
          <FilterChip
            label={todasCategorias.find((c) => c.value === selectedCategoria)?.label || selectedCategoria}
            emoji={todasCategorias.find((c) => c.value === selectedCategoria)?.emoji || '🏷️'}
            color="bg-purple-500"
            onRemove={() => onSelectedCategoriaChange('all')} />

          }
          </motion.div>
        }
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