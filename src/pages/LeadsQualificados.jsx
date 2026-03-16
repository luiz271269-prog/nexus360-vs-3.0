import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Users,
  TrendingUp,
  AlertCircle,
  Activity,
  Grid3x3,
  List,
  RefreshCw,
  Filter,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  FileText,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import ClienteKanban from "../components/clientes/ClienteKanban";
import ClienteTable from "../components/clientes/ClienteTable";
import ClienteForm from "../components/clientes/ClienteForm";
import { listarVendedoresParaSelect, sincronizarClientesComVendedores } from '../components/lib/vendedorSync';
import { validarMudancaStatus, getMensagemMotivacional, getProximaAcaoSugerida } from '../components/clientes/ClienteFormValidation';
import OrcamentoKanban from "../components/orcamentos/OrcamentoKanban";
import OrcamentoTable from "../components/orcamentos/OrcamentoTable";
import ControlCenter from "../components/dashboard/ControlCenter";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function LeadsQualificados() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');
  const [atendentes, setAtendentes] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [activeTab, setActiveTab] = useState('orcamentos');
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const navigate = useNavigate();

  const [filtrosLeads, setFiltrosLeads] = useState({
    busca: '',
    status: 'todos',
    classificacao: 'todos',
    vendedor: 'todos',
    usuario_filtro: null // Filtro de usuário para supervisores
  });

  const [filtrosClientes, setFiltrosClientes] = useState({
    busca: '',
    status: 'todos',
    vendedor: 'todos',
    usuario_filtro: null // Filtro de usuário para supervisores
  });

  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500)
  });

  const { data: clientesScores = [] } = useQuery({
    queryKey: ['clientesScores'],
    queryFn: () => base44.entities.ClienteScore.list('-score_total', 500)
  });

  const { data: orcamentos = [], isLoading: loadingOrcamentos } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const data = await base44.entities.Orcamento.list();
      return data;
    },
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [vendedoresData] = await Promise.all([
        listarVendedoresParaSelect()
      ]);

      setAtendentes(vendedoresData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (leadId, novoStatus) => {
    try {
      const lead = (clientes || []).find((l) => l.id === leadId);

      if (!lead) {
        console.error('❌ Lead not found:', leadId);
        toast.error('Erro ao identificar o lead.');
        return;
      }

      console.log('🔄 Iniciando mudança de status:', {
        leadId,
        statusAnterior: lead.status,
        novoStatus
      });

      setPendingStatusChange({ lead, novoStatus });
      setEditingCliente(lead);
      setShowClienteForm(true);

      toast.info(getMensagemMotivacional(novoStatus));

    } catch (error) {
      console.error('❌ Erro ao processar mudança de status:', error);
      toast.error('Erro ao processar mudança de status.');
    }
  };

  const handleSalvarCliente = async (clienteData, isAutoSave = false) => {
    try {
      if (pendingStatusChange) {
        const { lead, novoStatus } = pendingStatusChange;

        if (isAutoSave) {
          await base44.entities.Cliente.update(lead.id, clienteData);
          return;
        }

        const validacao = validarMudancaStatus(clienteData, novoStatus);

        if (!validacao.valido) {
          toast.error(validacao.mensagem);
          return;
        }

        await base44.entities.Cliente.update(lead.id, {
          ...clienteData,
          status: novoStatus
        });

        toast.success(`✅ Lead movido para "${novoStatus}"`);

        const acaoSugerida = getProximaAcaoSugerida(novoStatus);
        if (acaoSugerida && novoStatus !== 'desqualificado') {
          try {
            await gerarTarefaAutomatica(lead, novoStatus, acaoSugerida);
          } catch (error) {
            console.error('Erro ao gerar tarefa automática:', error);
          }
        }

        try {
          await base44.entities.EventoSistema.create({
            tipo_evento: 'cliente_atualizado',
            entidade_tipo: 'Cliente',
            entidade_id: lead.id,
            dados_evento: {
              cliente_id: lead.id,
              cliente_nome: lead.razao_social || lead.nome_fantasia,
              status_anterior: lead.status,
              status_novo: novoStatus,
              dados_atualizados: clienteData
            },
            origem: 'ui_usuario',
            processado: false
          });
        } catch (error) {
          console.error('Erro ao registrar evento:', error);
        }

        setPendingStatusChange(null);
        setShowClienteForm(false);
        setEditingCliente(null);

      } else {
        if (isAutoSave && editingCliente) {
          await base44.entities.Cliente.update(editingCliente.id, clienteData);
          return;
        }

        if (editingCliente) {
          await base44.entities.Cliente.update(editingCliente.id, clienteData);
          toast.success('Cliente atualizado com sucesso!');
        } else {
          await base44.entities.Cliente.create(clienteData);
          toast.success('Lead criado com sucesso!');
        }

        setShowClienteForm(false);
        setEditingCliente(null);
      }

      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await queryClient.invalidateQueries({ queryKey: ['clientesScores'] });
      await carregarDados();

    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      if (!isAutoSave) {
        toast.error('Erro ao salvar cliente');
      }
    }
  };

  const gerarTarefaAutomatica = async (lead, novoStatus, acaoSugerida) => {
    try {
      const tarefasExistentes = await base44.entities.TarefaInteligente.filter({
        cliente_id: lead.id,
        status: 'pendente'
      });

      if (tarefasExistentes.length > 0) {
        console.log('⏭️ Lead já tem tarefa pendente, não criando nova');
        return;
      }

      const prazo = new Date();
      if (acaoSugerida.prioridade === 'critica') {
        prazo.setHours(prazo.getHours() + 2);
      } else if (acaoSugerida.prioridade === 'alta') {
        prazo.setDate(prazo.getDate() + 1);
      } else {
        prazo.setDate(prazo.getDate() + 3);
      }

      await base44.entities.TarefaInteligente.create({
        titulo: `${acaoSugerida.titulo} - ${lead.razao_social || lead.nome_fantasia}`,
        descricao: acaoSugerida.descricao,
        tipo_tarefa: acaoSugerida.tipo,
        prioridade: acaoSugerida.prioridade,
        cliente_id: lead.id,
        cliente_nome: lead.razao_social || lead.nome_fantasia,
        vendedor_responsavel: lead.vendedor_responsavel || 'Não atribuído',
        data_prazo: prazo.toISOString(),
        status: 'pendente',
        contexto_ia: {
          motivo_criacao: `Lead movido para "${novoStatus}"`,
          sugestoes_abordagem: [acaoSugerida.descricao],
          etapa_funil: novoStatus
        }
      });

      toast.success(`🤖 Tarefa automática criada: ${acaoSugerida.titulo}`, {
        duration: 4000
      });

    } catch (error) {
      console.error('Erro ao gerar tarefa automática:', error);
    }
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    toast.info('Sincronizando vendedores...');

    try {
      const resultado = await sincronizarClientesComVendedores();

      if (resultado.sucesso) {
        toast.success(`✅ ${resultado.atualizados} clientes sincronizados!`);
        await carregarDados();
      } else {
        toast.error('Erro na sincronização');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao sincronizar');
    } finally {
      setSincronizando(false);
    }
  };

  const handleEditarCliente = (cliente) => {
    setEditingCliente(cliente);
    setPendingStatusChange(null);
    setShowClienteForm(true);
  };

  const handleNovoLead = () => {
    setEditingCliente(null);
    setPendingStatusChange(null);
    setShowClienteForm(true);
  };

  const handleExcluirCliente = async (clienteId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      await base44.entities.Cliente.delete(clienteId);
      toast.success('Cliente excluído com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await carregarDados();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir cliente');
    }
  };

  const verDetalhes = (cliente) => {
    window.open(`/Clientes?id=${cliente.id}`, '_blank');
  };

  const handleDeleteOrcamento = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      await base44.entities.Orcamento.delete(id);
      toast.success('Orçamento excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
    } catch (error) {
      toast.error('Erro ao excluir orçamento');
      console.error(error);
    }
  };

  const handleEditOrcamento = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  const handleViewOrcamento = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  // ✅ PERMISSÕES: Carregar usuário atual
  const [usuarioAtual, setUsuarioAtual] = React.useState(null);
  
  React.useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuarioAtual(user);
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  const leadsFiltrados = (clientes || []).filter((c) => {
    const isLead = ['novo_lead', 'primeiro_contato', 'em_conversa', 'levantamento_dados',
      'pre_qualificado', 'qualificacao_tecnica', 'em_aquecimento',
      'lead_qualificado', 'desqualificado'].includes(c.status);

    if (!isLead) return false;

    // ✅ PERMISSÃO: Admin vê todos, usuário normal vê apenas seus
    const temPermissaoVerOutros = ['admin', 'gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);
    const vendedorFiltrado = filtrosLeads.usuario_filtro || usuarioAtual?.full_name;
    
    if (!temPermissaoVerOutros) {
      if (c.vendedor_responsavel !== usuarioAtual?.full_name) return false;
    } else if (filtrosLeads.usuario_filtro) {
      if (c.vendedor_responsavel !== filtrosLeads.usuario_filtro) return false;
    }

    if (filtrosLeads.busca) {
      const busca = filtrosLeads.busca.toLowerCase();
      const match = c.razao_social?.toLowerCase().includes(busca) ||
        c.nome_fantasia?.toLowerCase().includes(busca) ||
        c.email?.toLowerCase().includes(busca);
      if (!match) return false;
    }

    if (filtrosLeads.status !== 'todos' && c.status !== filtrosLeads.status) return false;
    if (filtrosLeads.classificacao !== 'todos' && c.classificacao !== filtrosLeads.classificacao) return false;

    if (filtrosLeads.vendedor !== 'todos') {
      if (filtrosLeads.vendedor === 'nao_atribuido') {
        if (c.vendedor_responsavel) return false;
      } else {
        const vendedorLabel = (atendentes || []).find((v) => String(v.value) === String(filtrosLeads.vendedor))?.label;
        if (vendedorLabel && c.vendedor_responsavel !== vendedorLabel) return false;
      }
    }

    return true;
  });

  const clientesAtivos = (clientes || []).filter((c) => {
    const isCliente = ['Prospect', 'Ativo', 'Em Risco', 'Promotor'].includes(c.status);

    if (!isCliente) return false;

    // ✅ PERMISSÃO: Admin vê todos, usuário normal vê apenas seus
    const temPermissaoVerOutros = ['admin', 'gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);
    
    if (!temPermissaoVerOutros) {
      if (c.vendedor_responsavel !== usuarioAtual?.full_name) return false;
    } else if (filtrosClientes.usuario_filtro) {
      if (c.vendedor_responsavel !== filtrosClientes.usuario_filtro) return false;
    }

    if (filtrosClientes.busca) {
      const busca = filtrosClientes.busca.toLowerCase();
      const match = c.razao_social?.toLowerCase().includes(busca) ||
        c.nome_fantasia?.toLowerCase().includes(busca);
      if (!match) return false;
    }

    if (filtrosClientes.status !== 'todos' && c.status !== filtrosClientes.status) return false;

    if (filtrosClientes.vendedor !== 'todos') {
      const vendedorLabel = (atendentes || []).find((v) => String(v.value) === String(filtrosClientes.vendedor))?.label;
      if (vendedorLabel && c.vendedor_responsavel !== vendedorLabel) return false;
    }

    return true;
  });

  const orcamentosFiltrados = orcamentos.filter(orcamento => {
    // ✅ PERMISSÃO: Admin vê todos, usuário normal vê apenas seus
    if (usuarioAtual?.role !== 'admin') {
      if (orcamento.vendedor !== usuarioAtual?.full_name) return false;
    }

    const matchesSearch = searchTerm === '' ||
      orcamento.numero_orcamento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orcamento.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || orcamento.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const scoresParaKanban = clientesScores || [];

  return (
    <div className="bg-gradient-to-br px-1 py-1 rounded-md min-h-screen from-slate-50 via-gray-50 to-slate-100">
      <div className="max-w-[1920px] mx-auto space-y-2">

        {/* HEADER COMPACTO NO TOPO */}
        <div className="bg-orange-500 p-3 opacity-90 rounded-lg from-white via-orange-50 to-white shadow-lg border border-orange-200/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex items-center justify-center shadow-md">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">🎯 Central de Qualificação</h1>
                <p className="text-slate-600 text-xs">
                  Funil de Leads + Gestão de Clientes + Pipeline de Orçamentos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSincronizar}
                disabled={sincronizando}
                size="sm"
                variant="outline"
                className="bg-slate-800 text-slate-600 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground border-slate-300 hover:bg-slate-100 h-8">
                <RefreshCw className={`w-3 h-3 mr-1 ${sincronizando ? 'animate-spin' : ''}`} />
                Sync
              </Button>

              <Button
                onClick={() => {
                  if (activeTab === 'orcamentos') {
                    navigate(createPageUrl('OrcamentoDetalhes'));
                  } else {
                    handleNovoLead();
                  }
                }}
                size="sm"
                className="bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white shadow-md h-8 text-xs">
                <Plus className="w-4 h-4 mr-1" />
                {activeTab === 'leads' ? 'Novo Lead' : activeTab === 'clientes' ? 'Novo Cliente' : 'Novo Orçamento'}
              </Button>
            </div>
          </div>
        </div>

        {/* TABS + FILTROS INTEGRADOS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-gradient-to-r from-black via-orange-900/50 to-black rounded-lg border border-orange-500/20 p-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              {/* TABS - scroll horizontal no mobile */}
              <TabsList className="bg-transparent h-9 p-0 gap-1 overflow-x-auto flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <TabsTrigger
                  value="orcamentos"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-500 data-[state=active]:text-white text-slate-300 h-9 px-2 sm:px-4 text-xs font-semibold whitespace-nowrap">
                  <FileText className="w-3 h-3 mr-1" />
                  Business ORÇAMENTOS
                  <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 text-[10px] h-4">{orcamentos.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="clientes"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-500 data-[state=active]:text-white text-slate-300 h-9 px-2 sm:px-4 text-xs font-semibold whitespace-nowrap">
                  <Users className="w-3 h-3 mr-1" />
                  Gestão CLIENTES
                  <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 text-[10px] h-4">{clientesAtivos.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="leads"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-orange-500 data-[state=active]:text-white text-slate-300 h-9 px-2 sm:px-4 text-xs font-semibold whitespace-nowrap">
                  <Target className="w-3 h-3 mr-1" />
                  Qualifica LEADS
                  <Badge variant="secondary" className="ml-1 bg-orange-100 text-orange-700 text-[10px] h-4">{leadsFiltrados.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="nexus"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-500 data-[state=active]:text-white text-slate-300 h-9 px-2 sm:px-4 text-xs font-semibold whitespace-nowrap">
                  <Zap className="w-3 h-3 mr-1" />
                  Nexus
                </TabsTrigger>
              </TabsList>

              {/* FILTROS COMPACTOS */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    placeholder="Buscar..."
                    value={activeTab === 'orcamentos' ? searchTerm : (activeTab === 'leads' ? filtrosLeads.busca : filtrosClientes.busca)}
                    onChange={(e) => {
                      if (activeTab === 'orcamentos') {
                        setSearchTerm(e.target.value);
                      } else if (activeTab === 'leads') {
                        setFiltrosLeads({ ...filtrosLeads, busca: e.target.value });
                      } else {
                        setFiltrosClientes({ ...filtrosClientes, busca: e.target.value });
                      }
                    }}
                    className="pl-7 h-7 w-full sm:w-[180px] text-xs bg-black/30 border-orange-500/30 text-white placeholder:text-slate-400" />
                </div>

                {activeTab !== 'orcamentos' && (
                  <Select
                    value={activeTab === 'leads' ? filtrosLeads.vendedor : filtrosClientes.vendedor}
                    onValueChange={(v) => {
                      if (activeTab === 'leads') {
                        setFiltrosLeads({ ...filtrosLeads, vendedor: v });
                      } else {
                        setFiltrosClientes({ ...filtrosClientes, vendedor: v });
                      }
                    }}>
                    <SelectTrigger className="h-7 w-[140px] text-xs bg-black/30 border-orange-500/30 text-white">
                      <SelectValue placeholder="Vendedor" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-slate-600">
                      <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                      {atendentes.map((v) =>
                        <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>
                      )}
                      <SelectItem value="nao_atribuido" className="text-xs">Não Atribuído</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {activeTab === 'orcamentos' && (
                  <>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="h-7 px-3 text-xs bg-black/30 border border-orange-500/30 rounded-md text-white">
                      <option value="all">Todos Status</option>
                      <option value="rascunho">Rascunho</option>
                      <option value="enviado">Enviado</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="rejeitado">Rejeitado</option>
                    </select>

                    <Button
                      variant={viewMode === 'kanban' ? 'default' : 'outline'}
                      onClick={() => setViewMode('kanban')}
                      size="sm"
                      className={`h-7 px-2 text-xs ${viewMode === 'kanban' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-black/30 border-orange-500/30 text-white'}`}>
                      <Grid3x3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      onClick={() => setViewMode('table')}
                      size="sm"
                      className={`h-7 px-2 text-xs ${viewMode === 'table' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-black/30 border-orange-500/30 text-white'}`}>
                      <List className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* TAB: FUNIL DE LEADS */}
          <TabsContent value="leads" className="space-y-2 mt-2">
            {loading ?
              <div className="flex items-center justify-center py-20">
                <Activity className="w-8 h-8 animate-spin text-orange-500" />
                <span className="ml-3 text-slate-600">Carregando leads...</span>
              </div> :
              <ClienteKanban
                clientes={leadsFiltrados}
                scores={scoresParaKanban}
                onStatusChange={handleStatusChange}
                onEdit={handleEditarCliente}
                loading={loading}
                verDetalhes={verDetalhes}
                mode="leads" />
            }
          </TabsContent>

          {/* TAB: CLIENTES ATIVOS */}
          <TabsContent value="clientes" className="space-y-2 mt-2">
            <ClienteKanban
              clientes={clientesAtivos}
              scores={scoresParaKanban}
              onStatusChange={handleStatusChange}
              onEdit={handleEditarCliente}
              loading={loadingClientes}
              verDetalhes={verDetalhes}
              mode="clientes" />
          </TabsContent>

          {/* TAB: PIPELINE DE ORÇAMENTOS */}
          <TabsContent value="orcamentos" className="space-y-2 mt-2">
            {loadingOrcamentos ? (
              <div className="flex items-center justify-center py-20">
                <Activity className="w-8 h-8 animate-spin text-orange-500" />
                <span className="ml-3 text-slate-600">Carregando orçamentos...</span>
              </div>
            ) : viewMode === 'kanban' ? (
              <OrcamentoKanban
                orcamentos={orcamentosFiltrados}
                onView={handleViewOrcamento}
                onEdit={handleEditOrcamento}
                onDelete={handleDeleteOrcamento}
                usuario={usuarioAtual}
                onUpdateStatus={(id, status) => {
                  base44.entities.Orcamento.update(id, { status });
                  queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
                  toast.success(`Orçamento movido para "${status}"`);
                }}
              />
            ) : (
              <OrcamentoTable
                orcamentos={orcamentosFiltrados}
                onView={handleViewOrcamento}
                onEdit={handleEditOrcamento}
                onDelete={handleDeleteOrcamento}
              />
            )}
          </TabsContent>

          {/* TAB: NEXUS COMMAND CENTER */}
          <TabsContent value="nexus" className="mt-2">
            <ControlCenter />
          </TabsContent>
        </Tabs>

        {/* MODAL DE FORMULÁRIO */}
        {showClienteForm &&
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-slate-200">
              <ClienteForm
                cliente={editingCliente}
                novoStatus={pendingStatusChange?.novoStatus}
                onSave={handleSalvarCliente}
                onCancel={() => {
                  setShowClienteForm(false);
                  setEditingCliente(null);
                  setPendingStatusChange(null);
                }} />
            </div>
          </div>
        }
      </div>
    </div>
  );
}