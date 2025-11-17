
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Edit,
  Trash2,
  Save,
  X,
  Shield,
  CheckCircle,
  TrendingUp,
  Search,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";


import ColetorIAUniversal from "../automacao/ColetorIAUniversal"; // Added import

export default function PreAtendimentoManager({ categoriaFiltro = "all", searchTerm = "", onCategoriaChange, onSearchChange }) {
  const [editandoRegra, setEditandoRegra] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarColetorIA, setMostrarColetorIA] = useState(false);

  const queryClient = useQueryClient();

  // Buscar regras
  const { data: regras = [], isLoading } = useQuery({
    queryKey: ['preAtendimentoRules'],
    queryFn: () => base44.entities.PreAtendimentoRule.list('-prioridade'),
    initialData: []
  });

  // Mutations
  const salvarMutation = useMutation({
    mutationFn: (data) => {
      if (editandoRegra) {
        return base44.entities.PreAtendimentoRule.update(editandoRegra.id, data);
      }
      return base44.entities.PreAtendimentoRule.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['preAtendimentoRules']);
      toast.success(editandoRegra ? 'Regra atualizada!' : 'Regra criada!');
      setMostrarFormulario(false);
      setEditandoRegra(null);
    },
    onError: (error) => {
      toast.error('Erro ao salvar regra: ' + error.message);
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.PreAtendimentoRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['preAtendimentoRules']);
      toast.success('Regra deletada!');
    }
  });

  const toggleAtivaMutation = useMutation({
    mutationFn: ({ id, ativa }) => base44.entities.PreAtendimentoRule.update(id, { ativa }),
    onSuccess: () => {
      queryClient.invalidateQueries(['preAtendimentoRules']);
    }
  });

  const handleSalvarDaIA = async (regras) => {
    try {
      for (const regra of regras) {
        await base44.entities.PreAtendimentoRule.create({
          ...regra,
          ativa: true,
          metricas: {
            total_aplicacoes: 0,
            taxa_sucesso: 0
          }
        });
      }
      queryClient.invalidateQueries(['preAtendimentoRules']);
      toast.success(`${regras.length} regra(s) criada(s) com sucesso!`);
    } catch (error) {
      toast.error('Erro ao salvar regras: ' + error.message);
    }
  };

  const handleNovo = () => {
    setMostrarColetorIA(true);
  };

  const handleEditar = (regra) => {
    setEditandoRegra(regra);
    setMostrarFormulario(true);
  };

  const handleDeletar = async (id) => {
    if (confirm('Tem certeza que deseja deletar esta regra?')) {
      deletarMutation.mutate(id);
    }
  };

  const handleToggleAtiva = (regra) => {
    toggleAtivaMutation.mutate({ id: regra.id, ativa: !regra.ativa });
  };

  // Filtros
  const regrasFiltradas = regras.filter(r => {
    const matchCategoria = categoriaFiltro === 'all' || r.categoria === categoriaFiltro;
    const matchSearch = !searchTerm || 
      r.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategoria && matchSearch;
  });

  const categorias = [
    { value: 'all', label: 'Todas', icon: '📋', color: 'bg-slate-100' },
    { value: 'bloqueio', label: 'Bloqueio', icon: '🚫', color: 'bg-red-100' },
    { value: 'atribuicao', label: 'Atribuição', icon: '👤', color: 'bg-blue-100' },
    { value: 'horario', label: 'Horário', icon: '🕐', color: 'bg-amber-100' },
    { value: 'fidelizacao', label: 'Fidelização', icon: '⭐', color: 'bg-purple-100' },
    { value: 'gatilho_direto', label: 'Gatilho Direto', icon: '⚡', color: 'bg-green-100' },
    { value: 'ia_alta_confianca', label: 'IA Alta Confiança', icon: '🤖', color: 'bg-indigo-100' },
    { value: 'sistema', label: 'Sistema', icon: '⚙️', color: 'bg-slate-100' }
  ];

  const iconePorCategoria = {
    'bloqueio': '🚫',
    'atribuicao': '👤',
    'horario': '🕐',
    'fidelizacao': '⭐',
    'gatilho_direto': '⚡',
    'ia_alta_confianca': '🤖',
    'sistema': '⚙️'
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (mostrarFormulario) {
    return <FormularioRegra regra={editandoRegra} onSalvar={salvarMutation.mutate} onCancelar={() => {
      setMostrarFormulario(false);
      setEditandoRegra(null);
    }} />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Regras</p>
                <p className="text-2xl font-bold text-slate-800">{regras.length}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Ativas</p>
                <p className="text-2xl font-bold text-green-600">
                  {regras.filter(r => r.ativa).length}
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
                <p className="text-sm text-slate-600">Inativas</p>
                <p className="text-2xl font-bold text-slate-400">
                  {regras.filter(r => !r.ativa).length}
                </p>
              </div>
              <X className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Aplicações Totais</p>
                <p className="text-2xl font-bold text-blue-600">
                  {regras.reduce((sum, r) => sum + (r.metricas?.total_aplicacoes || 0), 0)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Layout Similar ao QuickRepliesManager */}
      <div className="flex gap-6">
        {/* Sidebar de Categorias */}
        <div className="w-64 flex-shrink-0">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg">Categorias</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {categorias.map(cat => {
                  const count = cat.value === 'all' 
                    ? regras.length 
                    : regras.filter(r => r.categoria === cat.value).length;

                  return (
                    <button
                      key={cat.value}
                      onClick={() => onCategoriaChange && onCategoriaChange(cat.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all hover:bg-purple-50 ${
                        categoriaFiltro === cat.value 
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
                        className={categoriaFiltro === cat.value ? 'bg-purple-200' : 'bg-slate-200'}
                      >
                        {count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Busca */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                  placeholder="Buscar regra..."
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão Novo com IA */}
          <Button 
            onClick={handleNovo} 
            className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Nova Regra com IA
          </Button>
        </div>

        {/* Grid de Regras - Formato Cards como Respostas Rápidas */}
        <div className="flex-1">
          {regrasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">
                  Nenhuma regra encontrada
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Crie sua primeira regra de pré-atendimento
                </p>
                <Button onClick={handleNovo} className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Criar com IA
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regrasFiltradas.map((regra) => {
                const categoria = categorias.find(c => c.value === regra.categoria);

                return (
                  <Card 
                    key={regra.id}
                    className={`hover:shadow-lg transition-all cursor-pointer ${
                      !regra.ativa && 'opacity-60'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={regra.ativa}
                            onCheckedChange={() => handleToggleAtiva(regra)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl">{iconePorCategoria[regra.categoria]}</span>
                              <CardTitle className="text-base">{regra.nome}</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {categoria?.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditar(regra);
                            }}
                            className="h-8 w-8 hover:bg-purple-100"
                          >
                            <Edit className="w-4 h-4 text-purple-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletar(regra.id);
                            }}
                            className="h-8 w-8 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <p className="text-sm text-slate-600 mb-3">
                        {regra.descricao || 'Sem descrição'}
                      </p>

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Prioridade {regra.prioridade}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {regra.metricas?.total_aplicacoes || 0} usos
                          </span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="text-[10px]"
                        >
                          {regra.tipo_acao.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Coletor IA - USANDO O UNIVERSAL */}
      <ColetorIAUniversal
        isOpen={mostrarColetorIA}
        onClose={() => setMostrarColetorIA(false)}
        tipoTemplate="pre_atendimento"
        onSalvar={handleSalvarDaIA}
      />
    </div>
  );
}

// Formulário de Edição Manual
function FormularioRegra({ regra, onSalvar, onCancelar }) {
  const [formData, setFormData] = useState(regra || {
    nome: '',
    categoria: 'sistema',
    tipo_acao: 'nao_ativar_pre_atendimento',
    prioridade: 10,
    condicoes: {},
    acao_configuracao: {},
    ativa: true,
    descricao: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{regra ? 'Editar Regra' : 'Nova Regra'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancelar}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome da Regra</Label>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              placeholder="Ex: Cliente Bloqueado"
              required
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              placeholder="Descreva o que esta regra faz..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({...formData, categoria: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bloqueio">🚫 Bloqueio</SelectItem>
                  <SelectItem value="atribuicao">👤 Atribuição</SelectItem>
                  <SelectItem value="horario">🕐 Horário</SelectItem>
                  <SelectItem value="fidelizacao">⭐ Fidelização</SelectItem>
                  <SelectItem value="gatilho_direto">⚡ Gatilho Direto</SelectItem>
                  <SelectItem value="ia_alta_confianca">🤖 IA Alta Confiança</SelectItem>
                  <SelectItem value="sistema">⚙️ Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Ação</Label>
              <Select
                value={formData.tipo_acao}
                onValueChange={(value) => setFormData({...formData, tipo_acao: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_ativar_pre_atendimento">Não Ativar Pré-Atendimento</SelectItem>
                  <SelectItem value="rotear_direto">Rotear Direto</SelectItem>
                  <SelectItem value="enviar_mensagem">Enviar Mensagem</SelectItem>
                  <SelectItem value="bloquear">Bloquear</SelectItem>
                  <SelectItem value="executar_playbook">Executar Playbook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Prioridade (menor = maior prioridade)</Label>
            <Input
              type="number"
              value={formData.prioridade}
              onChange={(e) => setFormData({...formData, prioridade: parseInt(e.target.value)})}
              min="1"
              max="100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-4 h-4 mr-2" />
              Salvar Regra
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
