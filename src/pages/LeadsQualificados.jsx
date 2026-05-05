import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Users,
  Activity,
  Grid3x3,
  List,
  RefreshCw,
  Search,
  Plus,
  FileText,
  Zap,
  ShoppingCart
} from "lucide-react";
import { toast } from "sonner";
import ClienteKanban from "../components/clientes/ClienteKanban";
import ClienteTable from "../components/clientes/ClienteTable";
import ClienteForm from "../components/clientes/ClienteForm";
import { listarVendedoresParaSelect, sincronizarClientesComVendedores, sincronizarOrcamentosComUsuarios, getNomeExibicao } from '../components/lib/vendedorSync';
import { validarMudancaStatus, getMensagemMotivacional, getProximaAcaoSugerida } from '../components/clientes/ClienteFormValidation';
import OrcamentoKanbanOptimized from "../components/orcamentos/OrcamentoKanbanOptimized";
import IframeHtmlLoader from "../components/iframes/IframeHtmlLoader";
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

  // Filtro global único de vendedor — aplicado a todas as tabs
  const [filtroVendedorGlobal, setFiltroVendedorGlobal] = useState('todos'); // 'todos' | 'meus' | nome-vendedor

  const [filtrosLeads, setFiltrosLeads] = useState({
    busca: '',
    status: 'todos',
    classificacao: 'todos',
  });

  const [filtrosClientes, setFiltrosClientes] = useState({
    busca: '',
    status: 'todos',
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
    toast.info('Sincronizando dados com usuários...');

    try {
      const [resClientes, resOrcamentos] = await Promise.all([
        sincronizarClientesComVendedores(),
        sincronizarOrcamentosComUsuarios()
      ]);

      if (resClientes.sucesso || resOrcamentos.sucesso) {
        toast.success(`✅ Clientes: ${resClientes.atualizados || 0} | Orçamentos: ${resOrcamentos.atualizados || 0} sincronizados!`);
        await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
        await queryClient.invalidateQueries({ queryKey: ['clientes'] });
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

  // ✅ BULK UPDATE: Atualizar todos os orçamentos de um vendedor para "Enviado" + deduplicar
  const handleBulkUpdateOrcamentos = async (vendedor) => {
    if (!vendedor) { toast.error('Selecione um vendedor'); return; }
    if (!confirm(`Tem certeza? Isso vai:\n1. Mover todos os orçamentos de "${vendedor}" para "Enviado"\n2. Remover duplicatas\n3. Reorganizar resumos`)) return;

    try {
      setSincronizando(true);
      toast.info(`⏳ Processando orçamentos de ${vendedor}...`);

      const response = await fetch('/api/bulkUpdateOrcamentosTarefa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendedor, novoStatus: 'enviado', deduplicate: true })
      });

      if (!response.ok) throw new Error('Erro ao processar');
      const { sucesso, resumo } = await response.json();

      if (sucesso) {
        toast.success(
          `✅ Processado!\n` +
          `📋 Total: ${resumo.total_inicial}\n` +
          `🗑️ Duplicatas removidas: ${resumo.duplicatas_removidas}\n` +
          `✏️ Atualizados: ${resumo.atualizados}`,
          { duration: 5000 }
        );
        await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao processar orçamentos');
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

  const handleUpdateOrcamentoStatus = async (id, novoStatus) => {
    await base44.entities.Orcamento.update(id, { status: novoStatus });
    await queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
  };

  const handleEditOrcamento = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  const handleViewOrcamento = (orcamento) => {
    navigate(createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`));
  };

  // ✅ PERMISSÕES: Carregar usuário atual
  const [usuarioAtual, setUsuarioAtual] = React.useState(null);
  const [vendedorDoUsuario, setVendedorDoUsuario] = React.useState(null);
  
  React.useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuarioAtual(user);
        // Vendedor = nome de exibição do user (prioriza display_name)
        if (user) setVendedorDoUsuario(getNomeExibicao(user));
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  // Níveis de permissão
  const isAdmin = usuarioAtual?.role === 'admin';
  const isGestor = ['gerente', 'coordenador'].includes(usuarioAtual?.attendant_role);
  const isSupervisor = usuarioAtual?.attendant_role === 'senior';
  const podeVerTodos = isAdmin || isGestor || isSupervisor;

  // Resolve o nome do vendedor a aplicar no filtro global
  const resolverFiltroVendedor = (campoVendedor) => {
    if (!podeVerTodos) {
      // Usuário comum: sempre vê apenas os seus
      if (!vendedorDoUsuario) return null; // ainda carregando
      return vendedorDoUsuario;
    }
    // Admin/gestor/supervisor: aplica filtro global
    if (filtroVendedorGlobal === 'todos') return null;
    if (filtroVendedorGlobal === 'meus') return vendedorDoUsuario;
    return filtroVendedorGlobal;
  };

  const leadsFiltrados = (clientes || []).filter((c) => {
    const isLead = ['novo_lead', 'primeiro_contato', 'em_conversa', 'levantamento_dados',
      'pre_qualificado', 'qualificacao_tecnica', 'em_aquecimento',
      'lead_qualificado', 'desqualificado'].includes(c.status);
    if (!isLead) return false;

    const vendedorFiltro = resolverFiltroVendedor(c.vendedor_responsavel);
    if (vendedorFiltro && c.vendedor_responsavel !== vendedorFiltro) return false;

    if (filtrosLeads.busca) {
      const busca = filtrosLeads.busca.toLowerCase();
      const match = c.razao_social?.toLowerCase().includes(busca) ||
        c.nome_fantasia?.toLowerCase().includes(busca) ||
        c.email?.toLowerCase().includes(busca);
      if (!match) return false;
    }

    if (filtrosLeads.status !== 'todos' && c.status !== filtrosLeads.status) return false;
    if (filtrosLeads.classificacao !== 'todos' && c.classificacao !== filtrosLeads.classificacao) return false;
    return true;
  });

  const clientesAtivos = (clientes || []).filter((c) => {
    const isCliente = ['Prospect', 'Ativo', 'Em Risco', 'Promotor'].includes(c.status);
    if (!isCliente) return false;

    const vendedorFiltro = resolverFiltroVendedor(c.vendedor_responsavel);
    if (vendedorFiltro && c.vendedor_responsavel !== vendedorFiltro) return false;

    if (filtrosClientes.busca) {
      const busca = filtrosClientes.busca.toLowerCase();
      const match = c.razao_social?.toLowerCase().includes(busca) ||
        c.nome_fantasia?.toLowerCase().includes(busca);
      if (!match) return false;
    }

    if (filtrosClientes.status !== 'todos' && c.status !== filtrosClientes.status) return false;
    return true;
  });

  const orcamentosFiltrados = orcamentos.filter(orcamento => {
    // Aguarda carregar usuário
    if (!usuarioAtual) return false;

    // ── FILTRO DE PROPRIEDADE ──
    if (!podeVerTodos) {
      // Usuário comum: só vê os seus
      // Verifica por vendedor_id (preferência), nome (fallback legado) ou criador (fallback importação)
      const ehSeu = orcamento.vendedor_id
        ? orcamento.vendedor_id === usuarioAtual.id
        : orcamento.vendedor === vendedorDoUsuario || orcamento.created_by === usuarioAtual.email;
      if (!ehSeu) return false;
    } else if (filtroVendedorGlobal !== 'todos') {
      // Admin/gestor/supervisor com filtro aplicado
      if (filtroVendedorGlobal === 'meus') {
        const ehSeu = orcamento.vendedor_id
          ? orcamento.vendedor_id === usuarioAtual.id
          : orcamento.vendedor === vendedorDoUsuario;
        if (!ehSeu) return false;
      } else {
        // Filtro por vendedor específico: verifica id e nome
        const atendenteAlvo = atendentes.find(a => a.label === filtroVendedorGlobal);
        const ehDoVendedor = atendenteAlvo
          ? (orcamento.vendedor_id === atendenteAlvo.value || orcamento.vendedor === atendenteAlvo.label)
          : orcamento.vendedor === filtroVendedorGlobal;
        if (!ehDoVendedor) return false;
      }
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

        {/* HEADER ULTRA-COMPACTO — fundido com a barra de tabs abaixo */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-3 py-1.5 rounded-lg shadow-lg border border-orange-500/20">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-400 to-orange-600 rounded-md flex items-center justify-center shadow-md flex-shrink-0">
                <Target className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight whitespace-nowrap">Central de Qualificação</h1>
              <span className="hidden md:inline text-[10px] text-slate-400 truncate">Leads · Clientes · Orçamentos</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                onClick={() => {
                  if (activeTab === 'orcamentos') navigate(createPageUrl('OrcamentoDetalhes'));
                  else handleNovoLead();
                }}
                size="sm"
                className="h-7 text-[11px] bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold gap-1 px-2.5 shadow-md">
                <Plus className="w-3 h-3" />
                {activeTab === 'orcamentos' ? 'Novo Orçamento' : 'Novo Lead'}
              </Button>

              {podeVerTodos && (
                <>
                  <Select value={filtroVendedorGlobal} onValueChange={setFiltroVendedorGlobal}>
                    <SelectTrigger className="h-7 w-[140px] text-[11px] bg-slate-800/60 border-slate-700 text-white">
                      <SelectValue placeholder="👤 Vendedor" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                      <SelectItem value="todos" className="text-xs">Todos os vendedores</SelectItem>
                      <SelectItem value="meus" className="text-xs">Meus registros</SelectItem>
                      {atendentes.map((v) =>
                        <SelectItem key={v.value} value={v.label} className="text-xs">{v.label}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleSincronizar}
                    disabled={sincronizando}
                    size="sm"
                    variant="outline"
                    className="bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-700 h-7 text-[11px] gap-1 px-2">
                    <RefreshCw className={`w-3 h-3 ${sincronizando ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>

                  {filtroVendedorGlobal && filtroVendedorGlobal !== 'todos' && filtroVendedorGlobal !== 'meus' && (
                    <Button
                      onClick={() => handleBulkUpdateOrcamentos(filtroVendedorGlobal)}
                      disabled={sincronizando}
                      size="sm"
                      variant="destructive"
                      className="bg-red-500 hover:bg-red-600 h-7 text-[11px] px-2">
                      ⚡ Bulk → Enviado
                    </Button>
                  )}
                </>
                )}
                </div>
                </div>
                </div>

                {/* TABS + FILTROS INTEGRADOS — ultra-compactos */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="bg-slate-900/95 rounded-lg border border-slate-700/50 px-2 py-1.5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                {/* TABS - underline animado */}
                <TabsList className="bg-transparent h-8 p-0 gap-0.5 overflow-x-auto flex-wrap sm:flex-nowrap w-full sm:w-auto">
                <TabsTrigger
                  value="orcamentos"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <FileText className="w-3 h-3 mr-1" />
                  Orçamentos
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-white text-[9px] h-3.5 px-1 data-[state=inactive]:bg-slate-700 data-[state=inactive]:text-slate-300">{orcamentos.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="cotacoes"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Cotações
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-white text-[9px] h-3.5 px-1">
                    {orcamentos.filter(o => ['rascunho','aguardando_cotacao','analisando','liberado'].includes(o.status)).length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="clientes"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <Users className="w-3 h-3 mr-1" />
                  Clientes
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-white text-[9px] h-3.5 px-1">{clientesAtivos.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="leads"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <Target className="w-3 h-3 mr-1" />
                  Leads
                  <Badge variant="secondary" className="ml-1 bg-white/20 text-white text-[9px] h-3.5 px-1">{leadsFiltrados.length}</Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="nexus"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <Zap className="w-3 h-3 mr-1" />
                  Nexus
                </TabsTrigger>
                <TabsTrigger
                  value="listas"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <List className="w-3 h-3 mr-1" />
                  Listas
                </TabsTrigger>
                <TabsTrigger
                  value="nexus_dash"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200 h-8 px-2 sm:px-3 text-[11px] font-semibold whitespace-nowrap rounded-md">
                  <Activity className="w-3 h-3 mr-1" />
                  Dashboard
                </TabsTrigger>
                </TabsList>

                {/* FILTROS COMPACTOS */}
                <div className="flex items-center gap-1 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    placeholder="Buscar..."
                    value={activeTab === 'orcamentos' ? searchTerm : (activeTab === 'leads' ? filtrosLeads.busca : filtrosClientes.busca)}
                    onChange={(e) => {
                      if (activeTab === 'orcamentos') setSearchTerm(e.target.value);
                      else if (activeTab === 'leads') setFiltrosLeads({ ...filtrosLeads, busca: e.target.value });
                      else setFiltrosClientes({ ...filtrosClientes, busca: e.target.value });
                    }}
                    className="pl-7 h-7 w-full sm:w-[160px] text-[11px] bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
                </div>

                {activeTab === 'orcamentos' && (
                  <>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="h-7 px-2 text-[11px] bg-slate-800/60 border border-slate-700 rounded-md text-white">
                      <option value="all">Todos</option>
                      <option value="rascunho">Rascunho</option>
                      <option value="enviado">Enviado</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="rejeitado">Rejeitado</option>
                    </select>
                    <Button
                      variant={viewMode === 'kanban' ? 'default' : 'outline'}
                      onClick={() => setViewMode('kanban')}
                      size="sm"
                      className={`h-7 px-1.5 text-xs ${viewMode === 'kanban' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                      <Grid3x3 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'outline'}
                      onClick={() => setViewMode('table')}
                      size="sm"
                      className={`h-7 px-1.5 text-xs ${viewMode === 'table' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
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
                <OrcamentoKanbanOptimized
                orcamentos={orcamentosFiltrados}
                onUpdateStatus={handleUpdateOrcamentoStatus}
                onView={handleViewOrcamento}
                onEdit={handleEditOrcamento}
                onDelete={handleDeleteOrcamento}
                usuario={usuarioAtual}
                atendentes={atendentes}
                etapasVisiveis={['negociacao']}
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

                {/* TAB: PEDIDOS DE COTAÇÃO (Etapa Interna) */}
                <TabsContent value="cotacoes" className="space-y-2 mt-2">
                {loadingOrcamentos ? (
                <div className="flex items-center justify-center py-20">
                <Activity className="w-8 h-8 animate-spin text-orange-500" />
                <span className="ml-3 text-slate-600">Carregando cotações...</span>
                </div>
                ) : (
                <OrcamentoKanbanOptimized
                orcamentos={orcamentosFiltrados}
                onUpdateStatus={handleUpdateOrcamentoStatus}
                onView={handleViewOrcamento}
                onEdit={handleEditOrcamento}
                onDelete={handleDeleteOrcamento}
                usuario={usuarioAtual}
                atendentes={atendentes}
                etapasVisiveis={['interna']}
                />
                )}
                </TabsContent>

                {/* TAB: NEXUS COMMAND CENTER */}
                <TabsContent value="nexus" className="mt-2">
                <ControlCenter />
                </TabsContent>

                {/* TAB: LISTAS DE TRABALHO */}
                <TabsContent value="listas" className="mt-2">
                  <IframeHtmlLoader
                    url="https://media.base44.com/files/public/68a7d067890527304dbe8477/25e42c650_listas_trabalho_upload.html"
                    title="Listas de Trabalho"
                  />
                </TabsContent>

                {/* TAB: NEXUS DASHBOARD UNIFICADO */}
                <TabsContent value="nexus_dash" className="mt-2">
                  <IframeHtmlLoader
                    url="https://media.base44.com/files/public/68a7d067890527304dbe8477/837e3dede_nexus_dashboard_upload.html"
                    title="Dashboard Unificado"
                  />
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