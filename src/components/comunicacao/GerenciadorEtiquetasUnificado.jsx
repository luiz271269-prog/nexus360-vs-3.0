import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tag, Plus, Pencil, Trash2, Loader2, Search, Filter,
  Building2, Wrench, DollarSign, Truck, Globe, Star,
  AlertCircle, CheckCircle2, Crown, Zap, Target, Handshake
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Configuração dos setores
const SETORES = [
  { value: 'global', label: 'Global (Todos)', icon: Globe, color: 'bg-slate-600' },
  { value: 'vendas', label: 'Vendas', icon: Target, color: 'bg-amber-500' },
  { value: 'assistencia', label: 'Assistência', icon: Wrench, color: 'bg-blue-500' },
  { value: 'financeiro', label: 'Financeiro', icon: DollarSign, color: 'bg-emerald-500' },
  { value: 'fornecedor', label: 'Fornecedor', icon: Truck, color: 'bg-purple-500' },
];

// Categorias de etiquetas
const CATEGORIAS = [
  { value: 'destaque', label: 'Destaque', emoji: '⭐' },
  { value: 'status', label: 'Status', emoji: '📊' },
  { value: 'comportamento', label: 'Comportamento', emoji: '🎯' },
  { value: 'prioridade', label: 'Prioridade', emoji: '🔥' },
  { value: 'outro', label: 'Outro', emoji: '🏷️' },
];

// Cores disponíveis
const CORES = [
  { value: 'bg-red-500', label: 'Vermelho', hex: '#ef4444' },
  { value: 'bg-orange-500', label: 'Laranja', hex: '#f97316' },
  { value: 'bg-amber-500', label: 'Âmbar', hex: '#f59e0b' },
  { value: 'bg-yellow-500', label: 'Amarelo', hex: '#eab308' },
  { value: 'bg-lime-500', label: 'Lima', hex: '#84cc16' },
  { value: 'bg-green-500', label: 'Verde', hex: '#22c55e' },
  { value: 'bg-emerald-500', label: 'Esmeralda', hex: '#10b981' },
  { value: 'bg-teal-500', label: 'Teal', hex: '#14b8a6' },
  { value: 'bg-cyan-500', label: 'Ciano', hex: '#06b6d4' },
  { value: 'bg-blue-500', label: 'Azul', hex: '#3b82f6' },
  { value: 'bg-indigo-500', label: 'Índigo', hex: '#6366f1' },
  { value: 'bg-violet-500', label: 'Violeta', hex: '#8b5cf6' },
  { value: 'bg-purple-500', label: 'Roxo', hex: '#a855f7' },
  { value: 'bg-fuchsia-500', label: 'Fúcsia', hex: '#d946ef' },
  { value: 'bg-pink-500', label: 'Rosa', hex: '#ec4899' },
  { value: 'bg-slate-500', label: 'Cinza', hex: '#64748b' },
];

// Emojis sugeridos
const EMOJIS = ['⭐', '🔥', '💎', '🎯', '🚀', '💰', '🏆', '❤️', '⚡', '👑', '🌟', '✨', '💫', '🔔', '📌', '🎁', '💼', '🤝', '📈', '💡', '🛡️', '⏰', '📋', '✅', '❌', '⚠️', '💤', '🆕', '🔄', '💚'];

// Tipos de contato
const TIPOS_CONTATO = [
  { value: 'novo', label: 'Novo', emoji: '❓' },
  { value: 'lead', label: 'Lead', emoji: '🎯' },
  { value: 'cliente', label: 'Cliente', emoji: '💎' },
  { value: 'fornecedor', label: 'Fornecedor', emoji: '🏭' },
  { value: 'parceiro', label: 'Parceiro', emoji: '🤝' },
];

// Faixas ABC
const FAIXAS_ABC = [
  { value: 'A', label: 'A', color: 'bg-green-500', description: 'Score ≥ 70 (Alto Valor)' },
  { value: 'B', label: 'B', color: 'bg-yellow-500', description: '30 ≤ Score < 70 (Médio)' },
  { value: 'C', label: 'C', color: 'bg-slate-400', description: 'Score < 30 (Baixo)' },
  { value: 'neutro', label: 'Neutro', color: 'bg-slate-300', description: 'Não entra no cálculo ABC' },
];

// Etiquetas fixas padrão (seed inicial)
const ETIQUETAS_FIXAS_PADRAO = [
  { nome: 'vip', label: 'VIP', emoji: '👑', cor: 'bg-yellow-500', tipo: 'fixa', setor: 'global', categoria: 'destaque', destaque: true, ordem: 1 },
  { nome: 'prioridade', label: 'Prioridade', emoji: '🔥', cor: 'bg-red-500', tipo: 'fixa', setor: 'global', categoria: 'prioridade', destaque: true, ordem: 2 },
  { nome: 'fidelizado', label: 'Fidelizado', emoji: '💎', cor: 'bg-cyan-500', tipo: 'fixa', setor: 'global', categoria: 'destaque', destaque: true, ordem: 3 },
  { nome: 'potencial', label: 'Potencial', emoji: '🚀', cor: 'bg-violet-500', tipo: 'fixa', setor: 'global', categoria: 'destaque', destaque: true, ordem: 4 },
  { nome: 'novo', label: 'Novo', emoji: '🆕', cor: 'bg-green-500', tipo: 'fixa', setor: 'global', categoria: 'status', destaque: false, ordem: 10 },
  { nome: 'recompra', label: 'Recompra', emoji: '🔄', cor: 'bg-blue-500', tipo: 'fixa', setor: 'vendas', categoria: 'comportamento', destaque: false, ordem: 11 },
  { nome: 'inativo', label: 'Inativo', emoji: '💤', cor: 'bg-gray-500', tipo: 'fixa', setor: 'global', categoria: 'status', destaque: false, ordem: 12 },
  { nome: 'negociando', label: 'Negociando', emoji: '🤝', cor: 'bg-indigo-500', tipo: 'fixa', setor: 'vendas', categoria: 'status', destaque: false, ordem: 13 },
];

export default function GerenciadorEtiquetasUnificado({ usuarioAtual }) {
  const [busca, setBusca] = useState('');
  const [setorFiltro, setSetorFiltro] = useState('all');
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');
  const [modalAberto, setModalAberto] = useState(false);
  const [etiquetaEditando, setEtiquetaEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    label: '',
    emoji: '🏷️',
    cor: 'bg-slate-500',
    setor: 'global',
    categoria: 'outro',
    destaque: false,
    tipos_contato_aplicaveis: [],
    ordem: 100,
    peso_qualificacao: 0,
    categoria_abc: 'neutro',
    participa_abc: false
  });

  const queryClient = useQueryClient();
  const setorUsuario = usuarioAtual?.attendant_sector || 'geral';
  const isAdmin = usuarioAtual?.role === 'admin';

  // Buscar etiquetas
  const { data: etiquetas = [], isLoading } = useQuery({
    queryKey: ['etiquetas-gerenciador'],
    queryFn: () => base44.entities.EtiquetaContato.list('ordem'),
    staleTime: 2 * 60 * 1000
  });

  // Mutation para criar/editar
  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      if (etiquetaEditando) {
        return base44.entities.EtiquetaContato.update(etiquetaEditando.id, data);
      } else {
        return base44.entities.EtiquetaContato.create({ ...data, ativa: true, uso_count: 0 });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-gerenciador'] });
      queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });
      toast.success(etiquetaEditando ? '✅ Etiqueta atualizada!' : '✅ Etiqueta criada!');
      fecharModal();
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  // Mutation para deletar
  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.EtiquetaContato.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-gerenciador'] });
      queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });
      toast.success('🗑️ Etiqueta removida!');
    }
  });

  // Mutation para toggle ativa
  const toggleAtivaMutation = useMutation({
    mutationFn: ({ id, ativa }) => base44.entities.EtiquetaContato.update(id, { ativa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etiquetas-gerenciador'] });
      queryClient.invalidateQueries({ queryKey: ['etiquetas-contato'] });
    }
  });

  // Filtrar etiquetas
  const etiquetasFiltradas = useMemo(() => {
    return etiquetas.filter(etq => {
      // Busca por texto
      if (busca && !etq.label?.toLowerCase().includes(busca.toLowerCase()) && 
          !etq.nome?.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      // Filtro por setor
      if (setorFiltro !== 'all' && etq.setor !== setorFiltro) {
        return false;
      }
      // Filtro por categoria
      if (categoriaFiltro !== 'all' && etq.categoria !== categoriaFiltro) {
        return false;
      }
      return true;
    });
  }, [etiquetas, busca, setorFiltro, categoriaFiltro]);

  // Agrupar por setor
  const etiquetasPorSetor = useMemo(() => {
    const grupos = {};
    SETORES.forEach(s => grupos[s.value] = []);
    etiquetasFiltradas.forEach(etq => {
      const setor = etq.setor || 'global';
      if (grupos[setor]) {
        grupos[setor].push(etq);
      }
    });
    return grupos;
  }, [etiquetasFiltradas]);

  const abrirModalNovo = () => {
    setEtiquetaEditando(null);
    setFormData({
      nome: '',
      label: '',
      emoji: '🏷️',
      cor: 'bg-slate-500',
      setor: isAdmin ? 'global' : setorUsuario,
      categoria: 'outro',
      destaque: false,
      tipos_contato_aplicaveis: [],
      ordem: 100
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (etq) => {
    setEtiquetaEditando(etq);
    setFormData({
      nome: etq.nome,
      label: etq.label,
      emoji: etq.emoji || '🏷️',
      cor: etq.cor || 'bg-slate-500',
      setor: etq.setor || 'global',
      categoria: etq.categoria || 'outro',
      destaque: etq.destaque || false,
      tipos_contato_aplicaveis: etq.tipos_contato_aplicaveis || [],
      ordem: etq.ordem || 100
    });
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEtiquetaEditando(null);
    setFormData({
      nome: '',
      label: '',
      emoji: '🏷️',
      cor: 'bg-slate-500',
      setor: 'global',
      categoria: 'outro',
      destaque: false,
      tipos_contato_aplicaveis: [],
      ordem: 100
    });
  };

  const handleSalvar = () => {
    if (!formData.label.trim()) {
      toast.error('Nome da etiqueta é obrigatório');
      return;
    }

    const nomeNormalizado = formData.nome || formData.label.trim().toLowerCase().replace(/\s+/g, '_');
    
    salvarMutation.mutate({
      ...formData,
      nome: nomeNormalizado,
      tipo: etiquetaEditando?.tipo === 'fixa' ? 'fixa' : 'personalizada'
    });
  };

  const handleDeletar = (etq) => {
    if (etq.tipo === 'fixa') {
      toast.error('Etiquetas fixas não podem ser deletadas');
      return;
    }
    if (confirm(`Deletar etiqueta "${etq.label}"?`)) {
      deletarMutation.mutate(etq.id);
    }
  };

  const podeEditar = (etq) => {
    if (isAdmin) return true;
    if (etq.tipo === 'fixa') return false;
    if (etq.setor === 'global') return false;
    return etq.setor === setorUsuario;
  };

  const podeDeletar = (etq) => {
    if (etq.tipo === 'fixa') return false;
    if (isAdmin) return true;
    return etq.setor === setorUsuario;
  };

  // Stats
  const stats = {
    total: etiquetas.length,
    fixas: etiquetas.filter(e => e.tipo === 'fixa').length,
    personalizadas: etiquetas.filter(e => e.tipo === 'personalizada').length,
    ativas: etiquetas.filter(e => e.ativa !== false).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-6 h-6 text-purple-600" />
            Gerenciador de Etiquetas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} etiquetas • {stats.fixas} fixas • {stats.personalizadas} personalizadas
          </p>
        </div>
        <Button onClick={abrirModalNovo} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Etiqueta
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar etiqueta..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={setorFiltro} onValueChange={setSetorFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SETORES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <s.icon className="w-4 h-4" /> {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => (
              <SelectItem key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista por Setor */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {SETORES.map(setor => {
            const etiquetasSetor = etiquetasPorSetor[setor.value] || [];
            if (etiquetasSetor.length === 0 && setorFiltro !== 'all' && setorFiltro !== setor.value) return null;

            return (
              <Card key={setor.value} className="overflow-hidden">
                <CardHeader className={`py-3 ${setor.color} bg-opacity-10 border-b`}>
                  <CardTitle className="text-base flex items-center gap-2">
                    <setor.icon className={`w-5 h-5 ${setor.color.replace('bg-', 'text-')}`} />
                    {setor.label}
                    <Badge variant="secondary" className="ml-2">{etiquetasSetor.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {etiquetasSetor.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                      Nenhuma etiqueta neste setor
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <AnimatePresence>
                        {etiquetasSetor.map(etq => (
                          <motion.div
                            key={etq.id}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg border ${
                              etq.ativa !== false ? 'bg-white' : 'bg-slate-100 opacity-60'
                            } hover:shadow-md transition-all`}
                          >
                            <span className={`w-4 h-4 rounded-full ${etq.cor || 'bg-slate-400'}`} />
                            <span className="text-lg">{etq.emoji || '🏷️'}</span>
                            <span className="font-medium text-sm">{etq.label}</span>
                            {etq.tipo === 'fixa' && (
                              <Badge variant="outline" className="text-[10px] px-1">Fixa</Badge>
                            )}
                            {etq.destaque && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                            
                            {/* Ações */}
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                              {podeEditar(etq) && (
                                <button
                                  onClick={() => abrirModalEditar(etq)}
                                  className="p-1 rounded hover:bg-slate-100"
                                >
                                  <Pencil className="w-3 h-3 text-slate-500" />
                                </button>
                              )}
                              {podeDeletar(etq) && (
                                <button
                                  onClick={() => handleDeletar(etq)}
                                  className="p-1 rounded hover:bg-red-100"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              {etiquetaEditando ? 'Editar Etiqueta' : 'Nova Etiqueta'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview */}
            <div className="flex justify-center">
              <Badge className={`${formData.cor} text-white text-base px-4 py-2`}>
                {formData.emoji} {formData.label || 'Prévia'}
              </Badge>
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome da Etiqueta *</Label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ex: Cliente Premium"
              />
            </div>

            {/* Emoji */}
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1 p-2 border rounded-lg max-h-24 overflow-y-auto">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormData(prev => ({ ...prev, emoji }))}
                    className={`w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-slate-100 ${
                      formData.emoji === emoji ? 'bg-purple-100 ring-2 ring-purple-500' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Cor */}
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1">
                {CORES.map(cor => (
                  <button
                    key={cor.value}
                    onClick={() => setFormData(prev => ({ ...prev, cor: cor.value }))}
                    className={`w-8 h-8 rounded-full ${cor.value} ${
                      formData.cor === cor.value ? 'ring-2 ring-offset-2 ring-purple-500' : ''
                    }`}
                    title={cor.label}
                  />
                ))}
              </div>
            </div>

            {/* Setor */}
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select
                value={formData.setor}
                onValueChange={(v) => setFormData(prev => ({ ...prev, setor: v }))}
                disabled={!isAdmin && etiquetaEditando?.tipo === 'fixa'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map(s => (
                    <SelectItem key={s.value} value={s.value} disabled={!isAdmin && s.value === 'global'}>
                      <span className="flex items-center gap-2">
                        <s.icon className="w-4 h-4" /> {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(v) => setFormData(prev => ({ ...prev, categoria: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Destaque */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Exibir em Destaque</Label>
                <p className="text-xs text-slate-500">Aparece na sidebar de conversas</p>
              </div>
              <Switch
                checked={formData.destaque}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, destaque: v }))}
              />
            </div>

            {/* Tipos de contato aplicáveis */}
            <div className="space-y-2">
              <Label>Aplicável a tipos de contato</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_CONTATO.map(tipo => (
                  <button
                    key={tipo.value}
                    onClick={() => {
                      const atual = formData.tipos_contato_aplicaveis || [];
                      const novo = atual.includes(tipo.value)
                        ? atual.filter(t => t !== tipo.value)
                        : [...atual, tipo.value];
                      setFormData(prev => ({ ...prev, tipos_contato_aplicaveis: novo }));
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      (formData.tipos_contato_aplicaveis || []).includes(tipo.value)
                        ? 'bg-purple-100 border-purple-500 text-purple-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'
                    }`}
                  >
                    {tipo.emoji} {tipo.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Deixe vazio para aplicar a todos</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={salvarMutation.isPending || !formData.label.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {salvarMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {etiquetaEditando ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Exportar configurações para uso em outros componentes
export { SETORES, CATEGORIAS, CORES, EMOJIS, TIPOS_CONTATO, ETIQUETAS_FIXAS_PADRAO };