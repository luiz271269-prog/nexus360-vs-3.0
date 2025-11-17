
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  TrendingUp,
  Clock,
  Search,
  Copy,
  CheckCircle,
  BarChart3,
  Filter // Added X icon
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ColetorIAUniversal from "../automacao/ColetorIAUniversal";

export default function QuickRepliesManager({
  categoriaFiltro = "all",
  searchTerm = "",
  onCategoriaChange,
  onSearchChange
}) {
  const queryClient = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [editandoResposta, setEditandoResposta] = useState(null); // Renamed from editandoRR
  const [mostrarFormulario, setMostrarFormulario] = useState(false); // Renamed from showForm
  // Removed gerandoIA state
  const [showColetorIA, setShowColetorIA] = useState(false); // Added showColetorIA state

  // Listener para evento de criação via URL
  useEffect(() => {
    const handleCreateEvent = () => {
      console.log('[QUICKREPLY_MANAGER] Evento de criação recebido');
      setEditandoResposta(null); // Use new state name
      setMostrarFormulario(true); // Use new state name
    };

    window.addEventListener('quickreply:create', handleCreateEvent);

    return () => {
      window.removeEventListener('quickreply:create', handleCreateEvent);
    };
  }, []);

  const { data: quickReplies = [], isLoading } = useQuery({
    queryKey: ['quickReplies'],
    queryFn: () => base44.entities.QuickReply.list('-created_date', 200),
    initialData: []
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QuickReply.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quickReplies']);
      toast.success("✅ Resposta rápida criada!");
      setMostrarFormulario(false); // Use new state name
      setEditandoResposta(null); // Use new state name
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuickReply.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quickReplies']);
      toast.success("✅ Resposta rápida atualizada!");
      setMostrarFormulario(false); // Use new state name
      setEditandoResposta(null); // Use new state name
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QuickReply.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['quickReplies']);
      toast.success("✅ Resposta rápida excluída!");
    }
  });

  // Filtrar usando props recebidas do componente pai
  const quickRepliesFiltradas = quickReplies.filter(rr => {
    const matchSearch = !searchTerm ||
      rr.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rr.comando?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rr.conteudo?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategoria = categoriaFiltro === 'all' || categoriaFiltro === 'todos' || rr.categoria === categoriaFiltro;
    const matchStatus = statusFiltro === 'todos' || rr.status === statusFiltro;

    return matchSearch && matchCategoria && matchStatus;
  });

  const handleSalvar = (formData) => {
    if (editandoResposta) { // Use new state name
      updateMutation.mutate({ id: editandoResposta.id, data: formData }); // Use new state name
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExcluir = (id) => {
    if (confirm("Tem certeza que deseja excluir esta resposta rápida?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSalvarDaIA = async (respostas) => {
    try {
      if (!respostas || respostas.length === 0) {
        toast.warning("Nenhuma resposta gerada pela IA para salvar.");
        return;
      }

      for (const resposta of respostas) {
        await base44.entities.QuickReply.create({
          ...resposta,
          ativa: true,
          origem: 'ia_gerada',
          status: 'ativa',
          uso_count: 0,
          metricas_performance: {
            total_usos: 0,
            score_medio_apos_uso: 0,
            taxa_conversao: 0,
            tempo_medio_resposta_cliente: 0,
            aprovacao_vendedores: 100
          }
        });
      }
      queryClient.invalidateQueries(['quickReplies']); // Keep 'quickReplies' for consistency
      toast.success(`${respostas.length} resposta(s) rápida(s) criada(s) com sucesso!`);
    } catch (error) {
      console.error('[QUICK REPLIES] Erro ao salvar respostas da IA:', error);
      toast.error('Erro ao salvar respostas: ' + error.message);
    } finally {
      setShowColetorIA(false);
    }
  };


  const handleCopiarComando = (comando) => {
    navigator.clipboard.writeText(comando);
    toast.success(`📋 Comando copiado: ${comando}`);
  };

  const handleAprovar = async (rr) => {
    try {
      await base44.entities.QuickReply.update(rr.id, {
        status: 'ativa',
        ativa: true,
        feedback_humano: {
          aprovado: true,
          aprovado_por: 'user',
          data_aprovacao: new Date().toISOString()
        }
      });

      queryClient.invalidateQueries(['quickReplies']);
      toast.success("✅ Resposta rápida aprovada!");
    } catch (error) {
      console.error('[QUICK REPLIES] Erro ao aprovar:', error);
      toast.error("❌ Erro ao aprovar resposta rápida");
    }
  };

  const getCategoriaColor = (categoria) => {
    const colors = {
      vendas: 'bg-green-100 text-green-800',
      suporte: 'bg-blue-100 text-blue-800',
      informacoes: 'bg-purple-100 text-purple-800',
      saudacao: 'bg-amber-100 text-amber-800',
      despedida: 'bg-slate-100 text-slate-800',
      agendamento: 'bg-indigo-100 text-indigo-800'
    };
    return colors[categoria] || 'bg-slate-100 text-slate-800';
  };

  // Categorias da sidebar
  const categorias = [
    { value: 'all', label: 'Todas', icon: '📋' },
    { value: 'vendas', label: 'Vendas', icon: '💰' },
    { value: 'suporte', label: 'Suporte', icon: '🛠️' },
    { value: 'informacoes', label: 'Informações', icon: 'ℹ️' },
    { value: 'saudacao', label: 'Saudação', icon: '👋' },
    { value: 'despedida', label: 'Despedida', icon: '👋' },
    { value: 'agendamento', label: 'Agendamento', icon: '📅' }
  ];

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total</p>
                <p className="text-2xl font-bold text-slate-900">{quickReplies.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Ativas</p>
                <p className="text-2xl font-bold text-green-600">
                  {quickReplies.filter(rr => rr.ativa && rr.status === 'ativa').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Aguardando Aprovação</p>
                <p className="text-2xl font-bold text-amber-600">
                  {quickReplies.filter(rr => rr.status === 'sugerida').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Geradas por IA</p>
                <p className="text-2xl font-bold text-purple-600">
                  {quickReplies.filter(rr => rr.origem === 'ia_gerada').length}
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Layout: Sidebar + Tabela */}
      <div className="flex gap-6">
        {/* SIDEBAR DE CATEGORIAS - COLUNA ESQUERDA */}
        <div className="w-64 flex-shrink-0">
          <Card className="sticky top-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Categorias</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categorias.map(cat => {
                  const count = cat.value === 'all'
                    ? quickReplies.length
                    : quickReplies.filter(rr => rr.categoria === cat.value).length;

                  return (
                    <button
                      key={cat.value}
                      onClick={() => onCategoriaChange && onCategoriaChange(cat.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all hover:bg-blue-50 ${
                        categoriaFiltro === cat.value
                          ? 'bg-blue-100 border-l-4 border-blue-600 text-blue-900 font-semibold'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm">{cat.label}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={categoriaFiltro === cat.value ? 'bg-blue-200' : 'bg-slate-200'}
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Busca e Filtros */}
          <Card className="mt-4">
            <CardContent className="pt-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar respostas..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ativa">Ativas</SelectItem>
                  <SelectItem value="sugerida">Sugeridas (Aguardando)</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="arquivada">Arquivadas</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Filter className="w-4 h-4" />
                {quickRepliesFiltradas.length} de {quickReplies.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABELA DE RESPOSTAS RÁPIDAS - COLUNA DIREITA */}
        <div className="flex-1">
          {/* Botões de Ação */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {quickRepliesFiltradas.length} {quickRepliesFiltradas.length === 1 ? 'Resposta' : 'Respostas'}
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowColetorIA(true)}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Criar com IA
              </Button>
              <Button
                onClick={() => {
                  setEditandoResposta(null); // Use new state name
                  setMostrarFormulario(true); // Use new state name
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Resposta Rápida
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-16 text-center text-slate-500">
                  Carregando respostas rápidas...
                </div>
              ) : quickRepliesFiltradas.length === 0 ? (
                <div className="py-16 text-center">
                  <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">
                    {searchTerm || categoriaFiltro !== 'all'
                      ? 'Nenhuma resposta rápida encontrada'
                      : 'Nenhuma resposta rápida cadastrada'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {quickReplies.length === 0
                      ? "Clique em 'Criar com IA' para criar suas primeiras respostas"
                      : "Ajuste os filtros para encontrar o que procura"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-center w-12">
                          <span className="text-xs font-semibold text-slate-600">Ativa</span>
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                          Título e Conteúdo
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Comando
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Usos
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quickRepliesFiltradas.map((rr, index) => {
                        const categoria = categorias.find(c => c.value === rr.categoria);

                        return (
                          <tr
                            key={rr.id}
                            className={`hover:bg-slate-50 transition-colors ${!rr.ativa ? 'opacity-60' : ''} ${
                              rr.status === 'sugerida' ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {/* Checkbox para Ativar/Desativar */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={rr.ativa}
                                onChange={() => {
                                  const newStatus = !rr.ativa;
                                  updateMutation.mutate({
                                    id: rr.id,
                                    data: { ...rr, ativa: newStatus }
                                  });
                                }}
                                className="rounded border-slate-300 w-4 h-4 cursor-pointer"
                                title={rr.ativa ? "Desativar resposta" : "Ativar resposta"}
                              />
                            </td>

                            {/* Título e Conteúdo */}
                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className="text-xl flex-shrink-0 mt-0.5">{categoria?.icon}</span>
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                                    {rr.titulo}
                                    {rr.origem === 'ia_gerada' && (
                                      <Sparkles className="w-4 h-4 text-purple-500" />
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 line-clamp-2">
                                    {rr.conteudo || 'Sem conteúdo'}
                                  </p>
                                  {rr.variaveis_disponiveis && rr.variaveis_disponiveis.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                      {rr.variaveis_disponiveis.slice(0, 3).map((v, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">
                                          {v}
                                        </Badge>
                                      ))}
                                      {rr.variaveis_disponiveis.length > 3 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          +{rr.variaveis_disponiveis.length - 3}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Comando */}
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant="outline"
                                className="cursor-pointer hover:bg-slate-100"
                                onClick={() => handleCopiarComando(rr.comando)}
                                title="Clique para copiar"
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                {rr.comando}
                              </Badge>
                            </td>

                            {/* Usos */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-slate-900">
                                  {rr.metricas_performance?.total_usos || 0}
                                </span>
                                {rr.metricas_performance?.taxa_conversao > 0 && (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {rr.metricas_performance.taxa_conversao}%
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={getCategoriaColor(rr.categoria)}>
                                  {rr.categoria}
                                </Badge>
                                {rr.status === 'sugerida' && (
                                  <Badge className="bg-amber-500 text-white text-xs">
                                    Aguardando
                                  </Badge>
                                )}
                                {!rr.ativa && (
                                  <Badge variant="outline" className="bg-slate-100 text-xs">
                                    Inativa
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* Ações */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                {rr.status === 'sugerida' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleAprovar(rr)}
                                    className="h-8 w-8 hover:bg-green-100"
                                    title="Aprovar"
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditandoResposta(rr); // Use new state name
                                    setMostrarFormulario(true); // Use new state name
                                  }}
                                  className="h-8 w-8 hover:bg-blue-100"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopiarComando(rr.comando)}
                                  className="h-8 w-8 hover:bg-slate-100"
                                  title="Copiar Comando"
                                >
                                  <Copy className="w-4 h-4 text-slate-600" />
                                </Button>

                                {rr.metricas_performance && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-purple-100"
                                    title="Métricas"
                                  >
                                    <BarChart3 className="w-4 h-4 text-purple-600" />
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleExcluir(rr.id)}
                                  className="h-8 w-8 hover:bg-red-100"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Coletor IA */}
      <ColetorIAUniversal
        isOpen={showColetorIA}
        onClose={() => setShowColetorIA(false)}
        tipoTemplate="quick_reply"
        onSalvar={handleSalvarDaIA}
      />

      {/* Form Modal */}
      <Dialog open={mostrarFormulario} onOpenChange={(isOpen) => {
        if (!isOpen) { // If dialog is closed by external click or escape key
          setMostrarFormulario(false);
          setEditandoResposta(null);
        }
      }}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editandoResposta ? 'Editar' : 'Nova'} Resposta Rápida
            </DialogTitle>
            <DialogDescription>
              Preencha os campos para {editandoResposta ? 'editar' : 'criar uma nova'} resposta rápida.
            </DialogDescription>
          </DialogHeader>
          <QuickReplyForm
            quickReply={editandoResposta}
            onSave={handleSalvar}
            onCancel={() => { // This is for the internal form's cancel button
              setMostrarFormulario(false);
              setEditandoResposta(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickReplyForm({ quickReply, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    titulo: '',
    comando: '',
    conteudo: '',
    categoria: 'informacoes',
    variaveis_disponiveis: [],
    ativa: true,
    status: 'ativa',
    origem: 'manual'
  });

  useEffect(() => {
    if (quickReply) {
      setFormData({
        titulo: quickReply.titulo || '',
        comando: quickReply.comando || '',
        conteudo: quickReply.conteudo || '',
        categoria: quickReply.categoria || 'informacoes',
        variaveis_disponiveis: quickReply.variaveis_disponiveis || [],
        ativa: quickReply.ativa !== false,
        status: quickReply.status || 'ativa',
        origem: quickReply.origem || 'manual'
      });
    }
  }, [quickReply]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.comando.trim() || !formData.conteudo.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="block text-sm font-medium mb-2">Título *</Label>
        <Input
          value={formData.titulo}
          onChange={(e) => setFormData({...formData, titulo: e.target.value})}
          placeholder="Ex: Horário de Atendimento"
          required
        />
      </div>

      <div>
        <Label className="block text-sm font-medium mb-2">Comando *</Label>
        <Input
          value={formData.comando}
          onChange={(e) => setFormData({...formData, comando: e.target.value})}
          placeholder="Ex: /horario"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          Use / no início para identificar como comando
        </p>
      </div>

      <div>
        <Label className="block text-sm font-medium mb-2">Categoria *</Label>
        <Select
          value={formData.categoria}
          onValueChange={(value) => setFormData({...formData, categoria: value})}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vendas">Vendas</SelectItem>
            <SelectItem value="suporte">Suporte</SelectItem>
            <SelectItem value="informacoes">Informações</SelectItem>
            <SelectItem value="saudacao">Saudação</SelectItem>
            <SelectItem value="despedida">Despedida</SelectItem>
            <SelectItem value="agendamento">Agendamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="block text-sm font-medium mb-2">Conteúdo *</Label>
        <Textarea
          value={formData.conteudo}
          onChange={(e) => setFormData({...formData, conteudo: e.target.value})}
          placeholder="Ex: Nosso horário de atendimento é de segunda a sexta, das 8h às 18h."
          rows={5}
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          Use variáveis dinâmicas no texto
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {quickReply ? 'Atualizar' : 'Criar'}
        </Button>
      </div>
    </form>
  );
}
