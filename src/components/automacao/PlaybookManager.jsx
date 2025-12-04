import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Edit,
  Trash2,
  Pause,
  Copy,
  TrendingUp,
  Zap,
  CheckCircle,
  BarChart3,
  Search,
  ArrowLeft,
  Download,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import PlaybookVisualEditor from "./PlaybookVisualEditor";
import BibliotecaPlaybooks from "./BibliotecaPlaybooks";
import ColetorIAUniversal from "./ColetorIAUniversal";

export default function PlaybookManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [selectedPlaybookMetrics, setSelectedPlaybookMetrics] = useState(null);
  const [showBiblioteca, setShowBiblioteca] = useState(false);
  const [showColetorIA, setShowColetorIA] = useState(false);

  useEffect(() => {
    const handleCreateEvent = () => {
      console.log('[PLAYBOOK_MANAGER] Evento de criação recebido');
      setEditingPlaybook(null);
      setShowEditor(true);
    };

    window.addEventListener('playbook:create', handleCreateEvent);

    return () => {
      window.removeEventListener('playbook:create', handleCreateEvent);
    };
  }, []);

  const queryClient = useQueryClient();

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => base44.entities.FlowTemplate.list('-created_date'),
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingPlaybook) {
        return base44.entities.FlowTemplate.update(editingPlaybook.id, data);
      }
      return base44.entities.FlowTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success(editingPlaybook ? 'Playbook atualizado!' : 'Playbook criado!');
      setShowEditor(false);
      setEditingPlaybook(null);
    },
    onError: (error) => {
      toast.error('Erro ao salvar playbook: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FlowTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Playbook excluído!');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.FlowTemplate.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Status atualizado!');
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async (playbook) => {
      const copy = {
        ...playbook,
        nome: `${playbook.nome} (Cópia)`,
        ativo: false
      };
      delete copy.id;
      delete copy.created_date;
      delete copy.updated_date;
      return base44.entities.FlowTemplate.create(copy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Playbook duplicado!');
    }
  });

  const handleEdit = (playbook) => {
    setEditingPlaybook(playbook);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingPlaybook(null);
    setShowEditor(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este playbook?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (playbook) => {
    toggleMutation.mutate({ id: playbook.id, ativo: !playbook.ativo });
  };

  const handleDuplicate = (playbook) => {
    duplicateMutation.mutate(playbook);
  };

  const handleShowMetrics = (playbook) => {
    setSelectedPlaybookMetrics(playbook);
    setShowMetrics(true);
  };

  const handleSaveFromEditor = (playbookData) => {
    saveMutation.mutate(playbookData);
  };

  const handleInstalarDaBiblioteca = () => {
    setShowBiblioteca(false);
    queryClient.invalidateQueries(['playbooks']);
    toast.success('Playbook instalado! Você pode editá-lo agora.');
  };

  const handleSalvarDaIA = async (playbooksToSave) => {
    try {
      for (const playbook of playbooksToSave) {
        const playbookData = {
          ...playbook,
          ativo: true,
          requires_ia: false,
          metricas: {
            total_execucoes: 0,
            total_concluidos: 0,
            total_abandonados: 0,
            tempo_medio_conclusao: 0,
            taxa_sucesso: 0
          }
        };
        delete playbookData.id;
        delete playbookData.created_date;
        delete playbookData.updated_date;

        await base44.entities.FlowTemplate.create(playbookData);
      }
      queryClient.invalidateQueries(['playbooks']);
      toast.success(`${playbooksToSave.length} playbook(s) criado(s) com sucesso!`);
      setShowColetorIA(false);
    } catch (error) {
      console.error("Erro ao salvar playbooks da IA:", error);
      toast.error('Erro ao salvar playbooks: ' + error.message);
    }
  };

  const filteredPlaybooks = playbooks.filter(p => {
    const matchSearch = !searchTerm ||
      p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCategory = selectedCategory === 'all' || p.categoria === selectedCategory;

    return matchSearch && matchCategory;
  });

  const categorias = [
    { value: 'all', label: 'Todas', icon: '📋' },
    { value: 'vendas', label: 'Vendas', icon: '💰' },
    { value: 'suporte', label: 'Suporte', icon: '🛠️' },
    { value: 'informacoes', label: 'Informações', icon: 'ℹ️' },
    { value: 'saudacao', label: 'Saudação', icon: '👋' },
    { value: 'despedida', label: 'Despedida', icon: '👋' },
    { value: 'agendamento', label: 'Agendamento', icon: '📅' },
    { value: 'logistica', label: 'Logística', icon: '🚚' },
    { value: 'financeiro', label: 'Financeiro', icon: '💳' },
    { value: 'pos_venda', label: 'Pós-venda', icon: '⭐' },
    { value: 'geral', label: 'Geral', icon: '🔧' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (showBiblioteca) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setShowBiblioteca(false)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Meus Playbooks
          </Button>
        </div>

        <BibliotecaPlaybooks onInstalar={handleInstalarDaBiblioteca} />
      </div>
    );
  }

  if (showEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setShowEditor(false);
              setEditingPlaybook(null);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Lista
          </Button>
          <h2 className="text-2xl font-bold text-slate-800">
            {editingPlaybook ? `Editando: ${editingPlaybook.nome}` : 'Novo Playbook'}
          </h2>
        </div>

        <PlaybookVisualEditor
          playbook={editingPlaybook}
          onSave={handleSaveFromEditor}
          onCancel={() => {
            setShowEditor(false);
            setEditingPlaybook(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Meus Playbooks</h2>
          <p className="text-slate-600 mt-1">Gerencie fluxos conversacionais automatizados</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowColetorIA(true)}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Criar com IA
          </Button>
          <Button
            onClick={() => setShowBiblioteca(true)}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Biblioteca de Templates
          </Button>
          <Button onClick={handleNew} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Playbook
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Playbooks</p>
                <p className="text-2xl font-bold text-slate-800">{playbooks.length}</p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Ativos</p>
                <p className="text-2xl font-bold text-green-600">
                  {playbooks.filter(p => p.ativo).length}
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
                <p className="text-sm text-slate-600">Inativos</p>
                <p className="text-2xl font-bold text-slate-400">
                  {playbooks.filter(p => !p.ativo).length}
                </p>
              </div>
              <Pause className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa de Sucesso Média</p>
                <p className="text-2xl font-bold text-blue-600">
                  {playbooks.length > 0
                    ? Math.round(
                        playbooks.reduce((sum, p) => sum + (p.metricas?.taxa_sucesso || 0), 0) /
                          playbooks.length
                      )
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Categorias</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categorias.map(cat => {
                  const count = cat.value === 'all'
                    ? playbooks.length
                    : playbooks.filter(p => p.categoria === cat.value).length;

                  return (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all hover:bg-purple-50 ${
                        selectedCategory === cat.value
                          ? 'bg-purple-100 border-l-4 border-purple-600 text-purple-900 font-semibold'
                          : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-sm">{cat.label}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={selectedCategory === cat.value ? 'bg-purple-200' : 'bg-slate-200'}
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          <Card>
            <CardContent className="p-0">
              {filteredPlaybooks.length === 0 ? (
                <div className="py-16 text-center">
                  <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">
                    {searchTerm || selectedCategory !== 'all'
                      ? 'Nenhum playbook encontrado'
                      : 'Nenhum playbook cadastrado'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {searchTerm || selectedCategory !== 'all'
                      ? 'Tente ajustar os filtros'
                      : 'Crie seu primeiro playbook para começar'}
                  </p>
                  {!searchTerm && selectedCategory === 'all' && (
                    <Button onClick={handleNew} className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Playbook
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">
                          <span className="text-xs text-slate-600">Ativo</span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                          Nome e Descrição
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Execuções
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Taxa Sucesso
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlaybooks.map((playbook) => {
                        const categoria = categorias.find(c => c.value === playbook.categoria);
                        const taxaSucesso = playbook.metricas?.taxa_sucesso || 0;

                        return (
                          <tr
                            key={playbook.id}
                            className={`hover:bg-slate-50 transition-colors ${!playbook.ativo && 'opacity-60'}`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={playbook.ativo}
                                onChange={() => handleToggle(playbook)}
                                className="rounded border-slate-300 w-4 h-4 cursor-pointer"
                                title={playbook.ativo ? "Desativar playbook" : "Ativar playbook"}
                              />
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-start gap-2">
                                <span className="text-xl flex-shrink-0 mt-0.5">{categoria?.icon}</span>
                                <div className="flex-1">
                                  <div className="font-semibold text-slate-900 mb-1">{playbook.nome}</div>
                                  <p className="text-sm text-slate-600">
                                    {playbook.descricao || 'Sem descrição'}
                                  </p>
                                  {playbook.gatilhos && playbook.gatilhos.length > 0 && (
                                    <div className="flex gap-1 mt-2">
                                      {playbook.gatilhos.slice(0, 2).map((gatilho, idx) => (
                                        <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">
                                          {gatilho}
                                        </Badge>
                                      ))}
                                      {playbook.gatilhos.length > 2 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          +{playbook.gatilhos.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className="text-sm font-bold text-slate-900">
                                {playbook.metricas?.total_execucoes || 0}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm font-bold ${
                                taxaSucesso >= 80 ? 'text-green-600' :
                                taxaSucesso >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {taxaSucesso.toFixed(0)}%
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(playbook)}
                                  className="h-8 w-8 hover:bg-purple-100"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4 text-purple-600" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleShowMetrics(playbook)}
                                  className="h-8 w-8 hover:bg-blue-100"
                                  title="Métricas"
                                >
                                  <BarChart3 className="w-4 h-4 text-blue-600" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDuplicate(playbook)}
                                  className="h-8 w-8 hover:bg-slate-100"
                                  title="Duplicar"
                                >
                                  <Copy className="w-4 h-4 text-slate-600" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(playbook.id)}
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

      <ColetorIAUniversal
        isOpen={showColetorIA}
        onClose={() => setShowColetorIA(false)}
        tipoTemplate="playbook"
        onSalvar={handleSalvarDaIA}
      />
    </div>
  );
}