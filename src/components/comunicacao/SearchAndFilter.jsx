import React from "react";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, UserPlus, User, Users, Phone, Tag, Check, Filter, X, 
  ChevronDown, Building2, Target, Truck, Handshake, HelpCircle, 
  CheckSquare, AlertCircle, LayoutList, Columns
} from 'lucide-react';
import { normalizarTelefone } from '../lib/phoneUtils';
import { CATEGORIAS_FIXAS } from './CategorizadorRapido';
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import { getUserDisplayName } from '../lib/userHelpers';

// Configuração de tipos de contato
const TIPOS_CONTATO = [
  { value: 'all', label: 'Todos', icon: Users, color: 'bg-slate-500', emoji: '👥' },
  { value: 'novo', label: 'Novos', icon: HelpCircle, color: 'bg-slate-400', emoji: '❓' },
  { value: 'lead', label: 'Leads', icon: Target, color: 'bg-amber-500', emoji: '🎯' },
  { value: 'cliente', label: 'Clientes', icon: Building2, color: 'bg-emerald-500', emoji: '💎' },
  { value: 'fornecedor', label: 'Fornecedores', icon: Truck, color: 'bg-blue-500', emoji: '🏭' },
  { value: 'parceiro', label: 'Parceiros', icon: Handshake, color: 'bg-purple-500', emoji: '🤝' }
];

export default function SearchAndFilter({
  sidebarViewMode,
  onSidebarViewModeChange,
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
  // Novas props para filtro de tipo e tag
  selectedTipoContato,
  onSelectedTipoContatoChange,
  selectedTagContato,
  onSelectedTagContatoChange,
  // Props para seleção múltipla
  modoSelecaoMultipla = false,
  onModoSelecaoMultiplaChange,
  // Para diagnóstico
  isAdmin = false,
  onAbrirDiagnostico,
  // Callback para duplicatas detectadas
  onDuplicataDetectada
}) {
  const [showFilters, setShowFilters] = React.useState(false);

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
  const etiquetasDestaque = React.useMemo(() => {
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

  // ✅ DETECÇÃO DE DUPLICATAS DESATIVADA - NÃO bloqueia busca
  // Busca é SEMPRE livre, permissões aplicadas ao abrir thread
  
  // Normalizar telefone apenas para criar contato
  React.useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      if (novoContatoTelefone) {
        onNovoContatoTelefoneChange('');
      }
      return;
    }

    const telefoneNormalizado = normalizarTelefone(searchTerm);
    if (telefoneNormalizado && telefoneNormalizado !== novoContatoTelefone) {
      onNovoContatoTelefoneChange(telefoneNormalizado);
    } else if (!telefoneNormalizado && novoContatoTelefone) {
      onNovoContatoTelefoneChange('');
    }
  }, [searchTerm, novoContatoTelefone, onNovoContatoTelefoneChange]);

  // Contar filtros ativos
  const filtrosAtivos = [
    filterScope !== 'all' && filterScope !== 'my',
    selectedAttendantId,
    selectedIntegrationId && selectedIntegrationId !== 'all',
    selectedCategoria && selectedCategoria !== 'all',
    selectedTipoContato && selectedTipoContato !== 'all',
    selectedTagContato && selectedTagContato !== 'all'
  ].filter(Boolean).length;

  const limparFiltros = () => {
    onFilterScopeChange('all');
    onSelectedIntegrationChange('all');
    onSelectedCategoriaChange('all');
    if (onSelectedTipoContatoChange) onSelectedTipoContatoChange('all');
    if (onSelectedTagContatoChange) onSelectedTagContatoChange('all');
    setShowFilters(false);
  };

  // Chip de filtro ativo
  const FilterChip = ({ label, emoji, color, onRemove }) => (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white ${color} shadow-sm`}
    >
      {emoji} {label}
      <button onClick={onRemove} className="ml-0.5 hover:bg-white/20 rounded-full p-0.5">
        <X className="w-2.5 h-2.5" />
      </button>
    </motion.span>
  );

  // Botão de opção no popover
  const FilterOption = ({ selected, onClick, icon: Icon, emoji, label, color }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-left text-xs transition-all ${
        selected
          ? `${color} text-white shadow-md`
          : 'hover:bg-slate-100 text-slate-700'
      }`}
    >
      {emoji && <span className="text-sm">{emoji}</span>}
      {Icon && !emoji && <Icon className={`w-3.5 h-3.5 ${selected ? 'text-white' : getIconColor(color)}`} />}
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="w-3 h-3" />}
    </button>
  );

  const getIconColor = (color) => {
    const colorMap = {
      'bg-blue-500': 'text-blue-600',
      'bg-orange-500': 'text-orange-600',
      'bg-red-500': 'text-red-600',
      'bg-emerald-500': 'text-emerald-600',
      'bg-purple-500': 'text-purple-600',
      'bg-green-500': 'text-green-600',
      'bg-green-600': 'text-green-700',
      'bg-slate-500': 'text-slate-600',
      'bg-slate-400': 'text-slate-500'
    };
    return colorMap[color] || 'text-slate-500';
  };

  return (
    <div className="bg-slate-50 text-[#343979] px-3 py-1 rounded-lg border-b border-slate-200 flex-shrink-0 space-y-2 from-white to-slate-50">
      {/* Barra de busca */}
      <div className="flex items-center gap-2">
        {/* Ícones de visualização Kanban/Lista + Seleção Múltipla + Filtros */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {sidebarViewMode && onSidebarViewModeChange && (
            <>
              <button
                onClick={() => { onSidebarViewModeChange('list'); localStorage.setItem('sidebarViewMode', 'list'); }}
                className={`p-1.5 rounded-md transition-colors ${sidebarViewMode === 'list' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                title="Lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => { onSidebarViewModeChange('kanban'); localStorage.setItem('sidebarViewMode', 'kanban'); }}
                className={`p-1.5 rounded-md transition-colors ${sidebarViewMode === 'kanban' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                title="Kanban"
              >
                <Columns className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Botão de Seleção Múltipla */}
          {onModoSelecaoMultiplaChange && (
            <button
              onClick={() => onModoSelecaoMultiplaChange(!modoSelecaoMultipla)}
              className={`p-1.5 rounded-lg transition-all ${
                modoSelecaoMultipla
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                  : 'hover:bg-slate-200 text-slate-500'
              }`}
              title="Selecionar múltiplos contatos para envio em massa"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )}

          {/* Botão de filtros */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <button
                className={`relative p-1.5 rounded-lg transition-all ${
                  filtrosAtivos > 0
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                    : 'hover:bg-slate-200 text-slate-500'
                }`}
              >
                <Filter className="w-4 h-4" />
                {filtrosAtivos > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-orange-600 text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                    {filtrosAtivos}
                  </span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 border-b bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filtros
                </h3>
                {filtrosAtivos > 0 && (
                  <button onClick={limparFiltros} className="text-xs text-orange-300 hover:text-white transition-colors">
                    Limpar todos
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 🔵 ESTÁGIO 2: ESCOPO (Abas de Navegação) */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  📋 Escopo
                </label>
                <div className="space-y-1">
                  {/* A. Minhas Conversas: Atribuídas + Fidelizadas + Interação Recente */}
                  <FilterOption
                    selected={filterScope === 'my'}
                    onClick={() => onFilterScopeChange('my')}
                    icon={User}
                    label="Minhas conversas"
                    color="bg-blue-500"
                  />

                  {/* B. Não Atribuídas: assigned_user_id === NULL */}
                  <FilterOption
                    selected={filterScope === 'unassigned'}
                    onClick={() => onFilterScopeChange('unassigned')}
                    icon={AlertCircle}
                    label="Não atribuídas"
                    color="bg-orange-500"
                  />

                  {/* C. Não Adicionadas: contact_id === NULL (contatos não cadastrados) */}
                  {isAdmin && (
                    <FilterOption
                      selected={filterScope === 'nao_adicionado'}
                      onClick={() => onFilterScopeChange('nao_adicionado')}
                      icon={HelpCircle}
                      label="Não adicionadas"
                      color="bg-red-500"
                    />
                  )}

                  {/* D. Todas: Tudo que passou no Estágio 1 (Segurança) */}
                  {isManager && (
                    <FilterOption
                      selected={filterScope === 'all'}
                      onClick={() => onFilterScopeChange('all')}
                      icon={Users}
                      label="Todas"
                      color="bg-emerald-500"
                    />
                  )}
                </div>
              </div>

              {/* ✅ CORREÇÃO: Por atendente usando getUserDisplayName */}
              {isManager && atendentes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Por Atendente
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {atendentes.map((att) => (
                      <FilterOption
                        key={att.id}
                        selected={selectedAttendantId === att.id}
                        onClick={() => {
                          onFilterScopeChange('specific_user');
                          onSelectedAttendantChange(selectedAttendantId === att.id ? null : att.id);
                        }}
                        icon={User}
                        label={getUserDisplayName(att.id, atendentes, { incluirSetor: true })}
                        color="bg-purple-500"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Por conexão WhatsApp */}
              {integracoes.length > 1 && (
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
                      color="bg-green-500"
                    />
                    {integracoes.map((int) => (
                      <FilterOption
                        key={int.id}
                        selected={selectedIntegrationId === int.id}
                        onClick={() => onSelectedIntegrationChange(int.id)}
                        emoji={int.status === 'conectado' ? '🟢' : '🔴'}
                        label={int.nome_instancia}
                        color="bg-green-600"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Por tipo de contato */}
              {onSelectedTipoContatoChange && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                    Tipo de Contato
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {TIPOS_CONTATO.map((tipo) => (
                      <FilterOption
                        key={tipo.value}
                        selected={selectedTipoContato === tipo.value}
                        onClick={() => onSelectedTipoContatoChange(tipo.value)}
                        emoji={tipo.emoji}
                        label={tipo.label}
                        color={tipo.color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Por etiqueta/destaque - DINÂMICO */}
              {onSelectedTagContatoChange && (
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
                      color="bg-slate-500"
                    />
                    {etiquetasDestaque.map((tag) => (
                      <FilterOption
                        key={tag.value}
                        selected={selectedTagContato === tag.value}
                        onClick={() => onSelectedTagContatoChange(tag.value)}
                        emoji={tag.emoji}
                        label={tag.label}
                        color={tag.color}
                      />
                    ))}
                  </div>
                </div>
              )}

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
                </div>
              </div>
            </div>
          </PopoverContent>
          </Popover>
        </div>{/* fim dos botões à esquerda */}

        {/* Campo de busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar nome, empresa, cargo, descrição..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Chips de filtros ativos */}
      <AnimatePresence>
        {filtrosAtivos > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1.5 overflow-hidden"
          >
            {filterScope !== 'all' && filterScope !== 'my' && (
              <FilterChip
                label={
                  filterScope === 'unassigned' ? 'Não atribuídas' : 
                  filterScope === 'nao_adicionado' ? 'Não adicionadas' :
                  'Por atendente'
                }
                emoji={
                  filterScope === 'unassigned' ? '⚠️' : 
                  filterScope === 'nao_adicionado' ? '❓' :
                  '👤'
                }
                color={
                  filterScope === 'unassigned' ? 'bg-orange-500' :
                  filterScope === 'nao_adicionado' ? 'bg-red-500' :
                  'bg-blue-500'
                }
                onRemove={() => onFilterScopeChange('all')}
              />
            )}

            {selectedIntegrationId && selectedIntegrationId !== 'all' && (
              <FilterChip
                label={integracoes.find((i) => i.id === selectedIntegrationId)?.nome_instancia || 'Conexão'}
                emoji="📱"
                color="bg-green-500"
                onRemove={() => onSelectedIntegrationChange('all')}
              />
            )}

            {selectedTipoContato && selectedTipoContato !== 'all' && (
              <FilterChip
                label={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.label || selectedTipoContato}
                emoji={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.emoji || '👥'}
                color={TIPOS_CONTATO.find((t) => t.value === selectedTipoContato)?.color || 'bg-slate-500'}
                onRemove={() => onSelectedTipoContatoChange && onSelectedTipoContatoChange('all')}
              />
            )}

            {selectedTagContato && selectedTagContato !== 'all' && (
              <FilterChip
                label={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.label || selectedTagContato}
                emoji={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.emoji || '🏷️'}
                color={etiquetasDestaque.find((t) => t.value === selectedTagContato)?.color || 'bg-purple-500'}
                onRemove={() => onSelectedTagContatoChange && onSelectedTagContatoChange('all')}
              />
            )}

            {selectedCategoria && selectedCategoria !== 'all' && (
              <FilterChip
                label={todasCategorias.find((c) => c.value === selectedCategoria)?.label || selectedCategoria}
                emoji={todasCategorias.find((c) => c.value === selectedCategoria)?.emoji || '🏷️'}
                color="bg-purple-500"
                onRemove={() => onSelectedCategoriaChange('all')}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão criar contato - Só aparece quando é telefone válido */}
      {novoContatoTelefone && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <Button
            onClick={onCreateContact}
            className="w-full shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/25"
            size="sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Criar Contato: {novoContatoTelefone}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

// 🔌 Exportar sub-componentes para uso em outras telas
export { TIPOS_CONTATO };