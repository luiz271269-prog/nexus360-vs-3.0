import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
  Phone,
  Mail,
  Search,
  Plus,
  Grid3x3, // Replaces LayoutGrid
  List, // Replaces LayoutList
  X,
  ArrowLeft,
  Edit,
  Trash2,
  Loader2 // Keep Loader2 for general loading states
} from "lucide-react";
import { toast } from "sonner";
import ClienteForm from "../components/clientes/ClienteForm";
import ClienteTable from "../components/clientes/ClienteTable";
import ClienteKanban from "../components/clientes/ClienteKanban";
import HistoricoQualificacaoCliente from "../components/clientes/HistoricoQualificacaoCliente";
import { listarVendedoresParaSelect } from '../components/lib/vendedorSync';

export default function Clientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteIdParam = searchParams.get('id');

  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [viewMode, setViewMode] = useState('lista'); // Changed default view
  const [vendedores, setVendedores] = useState([]);
  const [viewingDetails, setViewingDetails] = useState(null); // 🆕 NOVO: Estado para "Ver Detalhes"

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    classificacao: 'todos',
    segmento: 'todos',
    vendedor: 'todos'
  });
  const [aba, setAba] = useState('clientes'); // 'clientes' ou 'contatos_fidelizados'

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
  });

  const { data: contatosFidelizados = [], isLoading: isLoadingContatos } = useQuery({
    queryKey: ['contatosFidelizados'],
    queryFn: async () => {
      const contatos = await base44.entities.Contact.list('-updated_date', 1000);
      return (contatos || []).filter(c => c.tipo_contato === 'cliente' && c.atendente_fidelizado_vendas);
    },
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: clientesScores = [] } = useQuery({
    queryKey: ['clientesScores'],
    queryFn: () => base44.entities.ClienteScore.list('-score_total', 500),
  });

  useEffect(() => {
    carregarVendedores();
  }, []);

  useEffect(() => {
    // 🆕 NOVO: Se tem ID na URL, abrir detalhes automaticamente
    if (clienteIdParam && clientes.length > 0) {
      const cliente = clientes.find(c => c.id === clienteIdParam);
      if (cliente) {
        setViewingDetails(cliente);
      }
    } else if (!clienteIdParam && viewingDetails) {
      // If ID is removed from URL, close details
      setViewingDetails(null);
    }
  }, [clienteIdParam, clientes, viewingDetails]); // Added viewingDetails to dependency array

  const carregarVendedores = async () => {
    try {
      const vendedoresFormatados = await listarVendedoresParaSelect();
      setVendedores(vendedoresFormatados || []);
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
    }
  };

  const handleSalvarCliente = async (clienteData, isAutoSave = false) => {
    try {
      if (isAutoSave && editingCliente) {
        // Auto-save silencioso
        await base44.entities.Cliente.update(editingCliente.id, clienteData);
        return; // Não fecha o modal nem mostra toast de sucesso
      }

      if (editingCliente) {
        await base44.entities.Cliente.update(editingCliente.id, clienteData);
        toast.success("Cliente atualizado com sucesso!");
        
        await base44.entities.EventoSistema.create({
          tipo_evento: 'cliente_atualizado',
          entidade_tipo: 'Cliente',
          entidade_id: editingCliente.id,
          dados_evento: {
            cliente_id: editingCliente.id,
            cliente_nome: clienteData.razao_social || clienteData.nome_fantasia,
            status_anterior: editingCliente.status,
            status_novo: clienteData.status,
            dados_atualizados: clienteData
          },
          origem: 'ui_usuario',
          processado: false
        });
      } else {
        const novoCliente = await base44.entities.Cliente.create(clienteData);
        toast.success("Cliente criado com sucesso!");
        
        await base44.entities.EventoSistema.create({
          tipo_evento: 'cliente_criado',
          entidade_tipo: 'Cliente',
          entidade_id: novoCliente.id,
          dados_evento: {
            cliente_id: novoCliente.id,
            cliente_nome: clienteData.razao_social || clienteData.nome_fantasia,
            dados_iniciais: clienteData
          },
          origem: 'ui_usuario',
          processado: false
        });
      }

      setShowForm(false);
      setEditingCliente(null);
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await queryClient.invalidateQueries({ queryKey: ['clientesScores'] });
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      if (!isAutoSave) {
        toast.error("Erro ao salvar cliente");
      }
    }
  };

  const handleEditarCliente = (cliente) => {
    setEditingCliente(cliente);
    setShowForm(true);
    setViewingDetails(null); // Close details view if opened from there
  };

  const handleExcluirCliente = async (clienteId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      await base44.entities.Cliente.delete(clienteId);
      toast.success('Cliente excluído com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await queryClient.invalidateQueries({ queryKey: ['clientesScores'] });
      setViewingDetails(null); // Close details if the viewed client was deleted
      setSearchParams({}); // Clear URL param

      await base44.entities.EventoSistema.create({
        tipo_evento: 'cliente_excluido',
        entidade_tipo: 'Cliente',
        entidade_id: clienteId,
        dados_evento: {
          cliente_id: clienteId,
          // client_name: ? (cannot easily retrieve name after deletion)
        },
        origem: 'ui_usuario',
        processado: false
      });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    }
  };

  const handleVerDetalhes = (cliente) => {
    setViewingDetails(cliente);
    setSearchParams({ id: cliente.id });
  };

  const handleFecharDetalhes = () => {
    setViewingDetails(null);
    setSearchParams({});
  };

  const clientesFiltrados = (clientes || []).filter(cliente => {
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      const match =
        cliente.razao_social?.toLowerCase().includes(busca) ||
        cliente.nome_fantasia?.toLowerCase().includes(busca) ||
        cliente.email?.toLowerCase().includes(busca) ||
        cliente.telefone?.includes(busca) ||
        cliente.cnpj?.includes(busca); // Added CNPJ to search
      if (!match) return false;
    }

    if (filtros.status !== 'todos' && cliente.status !== filtros.status) return false;
    if (filtros.classificacao !== 'todos' && cliente.classificacao !== filtros.classificacao) return false;
    if (filtros.segmento !== 'todos' && cliente.segmento !== filtros.segmento) return false;

    if (filtros.vendedor !== 'todos') {
      if (filtros.vendedor === 'nao_atribuido') {
        if (cliente.vendedor_responsavel) return false;
      } else {
        const vendedorLabel = (vendedores || []).find(v => String(v.value) === String(filtros.vendedor))?.label;
        if (vendedorLabel && cliente.vendedor_responsavel !== vendedorLabel) return false;
      }
    }

    return true;
  });

  const clientesComScore = clientesFiltrados.map(cliente => ({
    ...cliente,
    score: (clientesScores || []).find(s => s.cliente_id === cliente.id)
  }));

  // 🆕 NOVO: Se está vendo detalhes, mostrar página de detalhes
  if (viewingDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header com Botão Voltar */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 rounded-xl shadow-xl border-2 border-slate-700/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleFecharDetalhes}
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {viewingDetails.razao_social || viewingDetails.nome_fantasia || 'Cliente Desconhecido'}
                  </h1>
                  <p className="text-slate-300 text-sm">
                    Detalhes completos e histórico de qualificação
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleEditarCliente(viewingDetails)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  onClick={() => handleExcluirCliente(viewingDetails.id)}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </div>
          </div>

          {/* Informações do Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Dados da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-800">
                <div>
                  <p className="text-slate-500">Razão Social</p>
                  <p className="font-semibold">{viewingDetails.razao_social || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Nome Fantasia</p>
                  <p className="font-semibold">{viewingDetails.nome_fantasia || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">CNPJ</p>
                  <p className="font-semibold">{viewingDetails.cnpj || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Segmento</p>
                  <Badge className="mt-1 bg-blue-100 text-blue-800 hover:bg-blue-200">{viewingDetails.segmento || 'Não definido'}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-green-600" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-800">
                <div>
                  <p className="text-slate-500">Telefone</p>
                  <p className="font-semibold">{viewingDetails.telefone || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">E-mail</p>
                  <p className="font-semibold">{viewingDetails.email || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Contato Principal</p>
                  <p className="font-semibold">{viewingDetails.contato_principal_nome || '-'}</p>
                  <p className="text-xs text-slate-500">{viewingDetails.contato_principal_cargo || ''}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  Status e Classificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-800">
                <div>
                  <p className="text-slate-500">Status Atual</p>
                  <Badge className="mt-1 bg-purple-100 text-purple-800 hover:bg-purple-200">{viewingDetails.status || 'Não definido'}</Badge>
                </div>
                <div>
                  <p className="text-slate-500">Classificação</p>
                  <Badge className="mt-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200">{viewingDetails.classificacao || 'Não definido'}</Badge>
                </div>
                <div>
                  <p className="text-slate-500">Vendedor Responsável</p>
                  <p className="font-semibold">{viewingDetails.vendedor_responsavel || 'Não atribuído'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Histórico de Qualificação */}
          <HistoricoQualificacaoCliente
            clienteId={viewingDetails.id}
            clienteNome={viewingDetails.razao_social || viewingDetails.nome_fantasia}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 rounded-xl shadow-xl border-2 border-slate-700/50 p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Kanban de Gestão de Clientes</h1>
                <p className="text-slate-300 text-sm">
                  Visualize e gerencie todos os seus clientes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setEditingCliente(null);
                  setShowForm(true);
                }}
                size="sm"
                className="h-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>

              <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-600/50">
                <Button
                  variant={aba === 'clientes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAba('clientes')}
                  className={`h-8 px-3 ${aba === 'clientes' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  Clientes
                </Button>
                <Button
                  variant={aba === 'contatos_fidelizados' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAba('contatos_fidelizados')}
                  className={`h-8 px-3 ${aba === 'contatos_fidelizados' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  👤 Contatos Fidelizados
                </Button>
              </div>

              {aba === 'clientes' && (
                <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-600/50 ml-2">
                  <Button
                    variant={viewMode === 'lista' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('lista')}
                    className={`h-8 px-3 ${viewMode === 'lista' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    <List className="w-4 h-4 mr-1" />
                    Lista
                  </Button>
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                    className={`h-8 px-3 ${viewMode === 'kanban' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
                  >
                    <Grid3x3 className="w-4 h-4 mr-1" />
                    Kanban
                  </Button>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <Card className="bg-white/80 backdrop-blur-lg border-2 border-slate-200/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-slate-700">
              <Search className="w-4 h-4 text-blue-600" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Buscar cliente por nome, CNPJ, telefone ou email..."
                    value={filtros.busca}
                    onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                    className="pl-10 h-9 border-slate-300 focus:border-blue-500"
                  />
                </div>
              </div>

              <Select
                value={filtros.status}
                onValueChange={(value) => setFiltros({ ...filtros, status: value })}
              >
                <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Em Risco">Em Risco</SelectItem>
                  <SelectItem value="Promotor">Promotor</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
                  <SelectItem value="Lead Qualificado">Lead Qualificado</SelectItem>
                  <SelectItem value="Lead Frio">Lead Frio</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filtros.classificacao}
                onValueChange={(value) => setFiltros({ ...filtros, classificacao: value })}
              >
                <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Classificações</SelectItem>
                  <SelectItem value="A - Alto Potencial">A - Alto Potencial</SelectItem>
                  <SelectItem value="B - Médio Potencial">B - Médio Potencial</SelectItem>
                  <SelectItem value="C - Baixo Potencial">C - Baixo Potencial</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filtros.vendedor}
                onValueChange={(value) => setFiltros({ ...filtros, vendedor: value })}
              >
                <SelectTrigger className="h-9 border-slate-300 focus:border-blue-500">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Vendedores</SelectItem>
                  {vendedores.map((vendedor) => (
                    <SelectItem key={vendedor.value} value={vendedor.value}>
                      {vendedor.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="nao_atribuido">Não Atribuído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* CONTEÚDO */}
        {aba === 'contatos_fidelizados' ? (
          // ABA: CONTATOS FIDELIZADOS
          <>
            {isLoadingContatos ? (
              <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border-2 border-slate-200/50">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                <span className="ml-3 text-slate-600">Carregando contatos fidelizados...</span>
              </div>
            ) : contatosFidelizados.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border-2 border-slate-200/50">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-lg text-slate-600 font-medium">Nenhum contato fidelizado encontrado.</p>
                <p className="text-sm text-slate-500 mt-2">Contatos classificados como cliente e fidelizados para vendedores aparecerão aqui.</p>
              </div>
            ) : (
              <Card className="shadow-lg border-2 border-slate-200/50">
                <CardHeader className="pb-3 bg-white/80 backdrop-blur-lg rounded-t-xl border-b border-slate-200">
                  <CardTitle className="text-lg text-slate-700 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    {contatosFidelizados.length} Contatos Fidelizados
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left font-semibold text-slate-700">Empresa / Nome</th>
                          <th className="px-6 py-3 text-left font-semibold text-slate-700">Telefone</th>
                          <th className="px-6 py-3 text-left font-semibold text-slate-700">Vendedor</th>
                          <th className="px-6 py-3 text-left font-semibold text-slate-700">Segmento</th>
                          <th className="px-6 py-3 text-left font-semibold text-slate-700">Score Engajamento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contatosFidelizados.map((contato) => {
                          const userId = contato.atendente_fidelizado_vendas;
                          const usuario = usuarios.find(u => u.id === userId || u.full_name === userId || u.email === userId);
                          const vendedorNome = usuario?.full_name || 'Não identificado';

                          return (
                            <tr key={contato.id} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-slate-900">{contato.empresa || 'N/A'}</p>
                                  <p className="text-xs text-slate-500">{contato.nome || ''}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-700">{contato.telefone || '-'}</td>
                              <td className="px-6 py-4">
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">{vendedorNome}</Badge>
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline">{contato.segmento_atual || 'N/A'}</Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        (contato.score_engajamento || 0) >= 70 ? 'bg-green-500' :
                                        (contato.score_engajamento || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(contato.score_engajamento || 0, 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-semibold text-slate-900">{contato.score_engajamento || 0}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border-2 border-slate-200/50">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">Carregando clientes...</span>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white/80 backdrop-blur-lg rounded-xl shadow-lg border-2 border-slate-200/50">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg text-slate-600 font-medium">Nenhum cliente encontrado com os filtros aplicados.</p>
            <Button onClick={() => setFiltros({ busca: '', status: 'todos', classificacao: 'todos', segmento: 'todos', vendedor: 'todos' })} variant="link" className="mt-4 text-blue-600">
              Limpar Filtros
            </Button>
          </div>
        ) : viewMode === 'kanban' ? (
          <ClienteKanban
            clientes={clientesComScore} // Pass clientesComScore
            scores={clientesScores} // Pass raw scores
            onEdit={handleEditarCliente}
            onDelete={handleExcluirCliente}
            loading={isLoading} // Should be false here, but good to pass
            vendedores={vendedores}
            verDetalhes={handleVerDetalhes}
            mode="clientes"
            onAtualizarStatus={async (clienteId, novoStatus) => {
              try {
                await base44.entities.Cliente.update(clienteId, { status: novoStatus });
                await queryClient.invalidateQueries({ queryKey: ['clientes'] });
                toast.success("Status do cliente atualizado!");

                await base44.entities.EventoSistema.create({
                  tipo_evento: 'cliente_status_atualizado',
                  entidade_tipo: 'Cliente',
                  entidade_id: clienteId,
                  dados_evento: {
                    cliente_id: clienteId,
                    status_novo: novoStatus
                  },
                  origem: 'ui_usuario',
                  processado: false
                });

              } catch (error) {
                console.error("Erro ao atualizar status:", error);
                toast.error("Erro ao atualizar status do cliente");
              }
            }}
          />
        ) : (
          <Card className="shadow-lg border-2 border-slate-200/50">
            <CardHeader className="pb-3 bg-white/80 backdrop-blur-lg rounded-t-xl border-b border-slate-200">
              <CardTitle className="text-lg text-slate-700">{clientesFiltrados.length} Clientes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ClienteTable
                clientes={clientesComScore}
                onEdit={handleEditarCliente}
                onDelete={handleExcluirCliente}
                vendedores={vendedores}
                onViewDetails={handleVerDetalhes}
              />
            </CardContent>
          </Card>
        )}

        {/* MODAL DE FORMULÁRIO */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
              <ClienteForm
                cliente={editingCliente}
                vendedores={vendedores} // Pass vendedores to the form
                onSave={handleSalvarCliente}
                onCancel={() => {
                  setShowForm(false);
                  setEditingCliente(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}