import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Search,
  Grid3x3,
  List,
  ArrowLeft,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import ClienteForm from "./ClienteForm";
import ClienteTable from "./ClienteTable";
import ClienteKanban from "./ClienteKanban";
import HistoricoQualificacaoCliente from "./HistoricoQualificacaoCliente";
import ClientesNaoCadastrados from "./ClientesNaoCadastrados";
import FiltrosClientesPanel from "./FiltrosClientesPanel";
import EtiquetaRecorrencia from "./EtiquetaRecorrencia";
import BotaoAbrirChat from "../crm/BotaoAbrirChat";
import ListasVendedorPanel from "./ListasVendedorPanel";
import { MobileDrawer } from "@/components/mobile/mobileSkillGlobal";
import { getFaturamentoPorCliente } from "@/functions/getFaturamentoPorCliente";
import { cadastrarClienteDeNF } from "@/functions/cadastrarClienteDeNF";

/**
 * Painel completo de Gestão de Clientes — extraído da antiga página Clientes.jsx
 * para ser usado como aba dentro da Central de Qualificação (LeadsQualificados).
 * Recebe usuarioAtual e vendedores da Central; gerencia seus próprios filtros,
 * modo de visualização, aba de fidelizados, form e "ver detalhes".
 */
export default function GestaoClientesPanel({ usuarioAtual, vendedores = [] }) {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [viewMode, setViewMode] = useState('lista');
  const [viewingDetails, setViewingDetails] = useState(null);
  const [aba, setAba] = useState('clientes'); // 'clientes' | 'contatos_fidelizados'

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'todos',
    classificacao: 'todos',
    segmento: 'todos',
    responsavel: 'todos',
    recorrencia: 'todos'
  });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-updated_date', 500),
  });

  const { data: contatosFidelizados = [], isLoading: isLoadingContatos } = useQuery({
    queryKey: ['contatosFidelizados'],
    queryFn: async () => {
      const contatos = await base44.entities.Contact.list('-updated_date', 2000);
      // Fornecedores não são clientes fidelizados — ficam fora desta listagem
      return (contatos || []).filter(c =>
        c.tipo_contato !== 'fornecedor'
      ).filter(c =>
        c.is_cliente_fidelizado ||
        c.is_vip ||
        c.atendente_fidelizado_vendas ||
        c.atendente_fidelizado_assistencia ||
        c.atendente_fidelizado_financeiro ||
        c.atendente_fidelizado_fornecedor
      );
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

  const { data: faturamentoData } = useQuery({
    queryKey: ['faturamentoPorCliente'],
    queryFn: async () => (await getFaturamentoPorCliente({})).data,
    staleTime: 5 * 60 * 1000,
  });
  const faturamentoPorCliente = faturamentoData?.faturamentoPorCliente || {};
  const clientesNaoCadastrados = faturamentoData?.clientesNaoCadastrados || [];

  const handleSalvarCliente = async (clienteData, isAutoSave = false) => {
    try {
      if (isAutoSave && editingCliente?.id) {
        await base44.entities.Cliente.update(editingCliente.id, clienteData);
        return;
      }

      if (editingCliente && editingCliente.id) {
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
      await queryClient.invalidateQueries({ queryKey: ['faturamentoPorCliente'] });
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      if (!isAutoSave) toast.error("Erro ao salvar cliente");
    }
  };

  const handleEditarCliente = (cliente) => {
    setEditingCliente(cliente);
    setShowForm(true);
    setViewingDetails(null);
  };

  const handleCadastrarDeNF = async ({ nome, vendedor }) => {
    try {
      const { data } = await cadastrarClienteDeNF({ nome, vendedor });
      if (!data?.success) {
        toast.error(data?.error || 'Não foi possível cadastrar o cliente');
        return;
      }
      const herd = data.herdado || {};
      const herdadoMsg = [
        herd.telefone && 'telefone',
        herd.contato_principal_nome && 'contato',
        herd.usuario_id && 'responsável'
      ].filter(Boolean).join(', ');
      toast.success(
        data.contato_vinculado
          ? `Cliente cadastrado e vinculado ao contato${herdadoMsg ? ` (${herdadoMsg} herdados)` : ''}!`
          : 'Cliente cadastrado!'
      );
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await queryClient.invalidateQueries({ queryKey: ['contatosFidelizados'] });
      await queryClient.invalidateQueries({ queryKey: ['faturamentoPorCliente'] });
    } catch (error) {
      console.error('Erro ao cadastrar cliente a partir da NF:', error);
      toast.error('Erro ao cadastrar cliente');
    }
  };

  const handleExcluirCliente = async (clienteId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await base44.entities.Cliente.delete(clienteId);
      toast.success('Cliente excluído com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['clientes'] });
      await queryClient.invalidateQueries({ queryKey: ['clientesScores'] });
      setViewingDetails(null);
      await base44.entities.EventoSistema.create({
        tipo_evento: 'cliente_excluido',
        entidade_tipo: 'Cliente',
        entidade_id: clienteId,
        dados_evento: { cliente_id: clienteId },
        origem: 'ui_usuario',
        processado: false
      });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      toast.error('Erro ao excluir cliente');
    }
  };

  const clientesFiltrados = (clientes || []).filter(cliente => {
    const nomeResponsavel = cliente.vendedor_responsavel;

    const temPermissaoVerOutros = ['admin', 'gerente', 'coordenador'].includes(usuarioAtual?.attendant_role) || usuarioAtual?.role === 'admin';
    if (!temPermissaoVerOutros) {
      if (nomeResponsavel !== usuarioAtual?.full_name) return false;
    }

    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      const match =
        cliente.razao_social?.toLowerCase().includes(busca) ||
        cliente.nome_fantasia?.toLowerCase().includes(busca) ||
        cliente.email?.toLowerCase().includes(busca) ||
        cliente.telefone?.includes(busca) ||
        cliente.cnpj?.includes(busca);
      if (!match) return false;
    }

    if (filtros.recorrencia !== 'todos' && faturamentoPorCliente[cliente.id]?.etiqueta !== filtros.recorrencia) return false;
    if (filtros.status !== 'todos' && cliente.status !== filtros.status) return false;
    if (filtros.classificacao !== 'todos' && cliente.classificacao !== filtros.classificacao) return false;
    if (filtros.segmento !== 'todos' && cliente.segmento !== filtros.segmento) return false;

    if (filtros.responsavel !== 'todos') {
      if (filtros.responsavel === 'nao_atribuido') {
        if (nomeResponsavel) return false;
      } else {
        const respLabel = (vendedores || []).find(v => String(v.value) === String(filtros.responsavel))?.label;
        if (respLabel && nomeResponsavel !== respLabel) return false;
      }
    }

    return true;
  });

  // Contador de filtros ativos (para o botão da gaveta mobile)
  const filtrosAtivos = [
    filtros.busca,
    filtros.status !== 'todos',
    filtros.classificacao !== 'todos',
    filtros.segmento !== 'todos',
    filtros.responsavel !== 'todos',
    filtros.recorrencia !== 'todos'
  ].filter(Boolean).length;

  const clientesComScore = clientesFiltrados.map(cliente => ({
    ...cliente,
    score: (clientesScores || []).find(s => s.cliente_id === cliente.id),
    faturamento: faturamentoPorCliente[cliente.id] || null
  }));

  // ── VER DETALHES ──
  if (viewingDetails) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-purple-900 rounded-xl shadow-xl border-2 border-slate-700/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button onClick={() => setViewingDetails(null)} variant="ghost" className="text-white hover:bg-white/10">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {viewingDetails.razao_social || viewingDetails.nome_fantasia || 'Cliente Desconhecido'}
                </h1>
                <p className="text-slate-300 text-sm">Detalhes completos e histórico de qualificação</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleEditarCliente(viewingDetails)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
              <Button onClick={() => handleExcluirCliente(viewingDetails.id)} size="sm" variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Building2 className="w-4 h-4 text-blue-600" /> Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-800">
              <div><p className="text-slate-500">Razão Social</p><p className="font-semibold">{viewingDetails.razao_social || '-'}</p></div>
              <div><p className="text-slate-500">Nome Fantasia</p><p className="font-semibold">{viewingDetails.nome_fantasia || '-'}</p></div>
              <div><p className="text-slate-500">CNPJ</p><p className="font-semibold">{viewingDetails.cnpj || '-'}</p></div>
              <div><p className="text-slate-500">Segmento</p><Badge className="mt-1 bg-blue-100 text-blue-800 hover:bg-blue-200">{viewingDetails.segmento || 'Não definido'}</Badge></div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-green-600" /> Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-800">
              <div><p className="text-slate-500">Telefone</p><p className="font-semibold">{viewingDetails.telefone || '-'}</p></div>
              <div><p className="text-slate-500">E-mail</p><p className="font-semibold">{viewingDetails.email || '-'}</p></div>
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
                <TrendingUp className="w-4 h-4 text-purple-600" /> Status e Classificação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-800">
              <div><p className="text-slate-500">Status Atual</p><Badge className="mt-1 bg-purple-100 text-purple-800 hover:bg-purple-200">{viewingDetails.status || 'Não definido'}</Badge></div>
              <div><p className="text-slate-500">Classificação</p><Badge className="mt-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200">{viewingDetails.classificacao || 'Não definido'}</Badge></div>
              <div><p className="text-slate-500">Vendedor Responsável</p><p className="font-semibold">{viewingDetails.vendedor_responsavel || 'Não atribuído'}</p></div>
            </CardContent>
          </Card>
        </div>

        <HistoricoQualificacaoCliente
          clienteId={viewingDetails.id}
          clienteNome={viewingDetails.razao_social || viewingDetails.nome_fantasia}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* SUB-ABAS + AÇÕES */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 rounded-lg border border-slate-700/50 px-3 py-2">
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
            className={`h-8 px-2 sm:px-3 text-xs sm:text-sm ${aba === 'contatos_fidelizados' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            👤 Fidelizados
          </Button>
          <Button
            variant={aba === 'listas' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAba('listas')}
            className={`h-8 px-2 sm:px-3 text-xs sm:text-sm ${aba === 'listas' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            📋 Listas
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtros em gaveta no mobile (Skill Mobile Global) */}
          <MobileDrawer
            triggerLabel={`Filtros${filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}`}
            side="right"
            width={320}
            className="bg-white"
          >
            <div className="p-4 pt-10">
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" /> Filtros
              </h3>
              <FiltrosClientesPanel
                filtros={filtros}
                setFiltros={setFiltros}
                vendedores={vendedores}
                aba={aba}
                clientes={clientes}
                faturamentoPorCliente={faturamentoPorCliente}
              />
            </div>
          </MobileDrawer>
          {aba === 'clientes' && (
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-600/50">
              <Button
                variant={viewMode === 'lista' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('lista')}
                className={`h-8 px-3 ${viewMode === 'lista' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                <List className="w-4 h-4 mr-1" /> Lista
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className={`h-8 px-3 ${viewMode === 'kanban' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                <Grid3x3 className="w-4 h-4 mr-1" /> Kanban
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* FILTROS — Card visível só no desktop; no mobile ficam na gaveta acima */}
      <Card className={`${aba === 'listas' ? 'hidden' : 'hidden md:block'} bg-white/80 backdrop-blur-lg border-2 border-slate-200/50 shadow-lg`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-700">
            <Search className="w-4 h-4 text-blue-600" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <FiltrosClientesPanel
            filtros={filtros}
            setFiltros={setFiltros}
            vendedores={vendedores}
            aba={aba}
            clientes={clientes}
            faturamentoPorCliente={faturamentoPorCliente}
          />
        </CardContent>
      </Card>

      {/* CONTEÚDO */}
      {aba === 'listas' ? (
        <ListasVendedorPanel
          usuarioAtual={usuarioAtual}
          vendedores={vendedores}
          clientes={clientes}
          onViewDetails={setViewingDetails}
        />
      ) : aba === 'contatos_fidelizados' ? (
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
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Tipo</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Recorrência</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Telefone</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Atendentes Fidelizados</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Sem Contato</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Segmento</th>
                        <th className="px-6 py-3 text-left font-semibold text-slate-700">Score Engajamento</th>
                        <th className="px-6 py-3 text-center font-semibold text-slate-700">Chat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contatosFidelizados.map((contato) => {
                        const resolverNome = (userId) => {
                          if (!userId) return null;
                          const u = usuarios.find(u => u.id === userId || u.full_name === userId || u.email === userId);
                          return u?.full_name || u?.email || userId;
                        };
                        const setores = [
                          { key: 'atendente_fidelizado_vendas', label: 'Vendas', cor: 'bg-blue-100 text-blue-800' },
                          { key: 'atendente_fidelizado_assistencia', label: 'Suporte', cor: 'bg-purple-100 text-purple-800' },
                          { key: 'atendente_fidelizado_financeiro', label: 'Financeiro', cor: 'bg-emerald-100 text-emerald-800' },
                          { key: 'atendente_fidelizado_fornecedor', label: 'Fornecedor', cor: 'bg-amber-100 text-amber-800' },
                        ].filter(s => contato[s.key]);

                        const tipoCfg = {
                          cliente: { label: 'Cliente', cor: 'bg-emerald-500' },
                          lead: { label: 'Lead', cor: 'bg-amber-500' },
                          eventual: { label: 'Eventual', cor: 'bg-slate-500' },
                          ex_cliente: { label: 'Ex-cliente', cor: 'bg-red-400' },
                          fornecedor: { label: 'Fornec.', cor: 'bg-blue-500' },
                          parceiro: { label: 'Parceiro', cor: 'bg-purple-500' },
                          novo: { label: 'Novo', cor: 'bg-slate-400' },
                        }[contato.tipo_contato || 'novo'] || { label: contato.tipo_contato || '—', cor: 'bg-slate-400' };

                        const dataRef = contato.ultima_interacao || contato.updated_date;
                        const diasSemContato = dataRef
                          ? Math.floor((Date.now() - new Date(dataRef).getTime()) / (1000 * 60 * 60 * 24))
                          : null;
                        const corDias = diasSemContato === null
                          ? 'bg-slate-100 text-slate-500'
                          : diasSemContato <= 7 ? 'bg-green-100 text-green-700'
                          : diasSemContato <= 30 ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700';

                        return (
                          <tr key={contato.id} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                {contato.is_vip && <span title="VIP" className="text-amber-500">⭐</span>}
                                <div>
                                  <p className="font-medium text-slate-900">{contato.empresa || contato.nome || 'N/A'}</p>
                                  {contato.empresa && contato.nome && <p className="text-xs text-slate-500">{contato.nome}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4"><Badge className={`${tipoCfg.cor} text-white hover:opacity-90`}>{tipoCfg.label}</Badge></td>
                            <td className="px-6 py-4">
                              {faturamentoPorCliente[contato.cliente_id]?.etiqueta
                                ? <EtiquetaRecorrencia etiqueta={faturamentoPorCliente[contato.cliente_id].etiqueta} />
                                : <span className="text-xs text-slate-400">—</span>}
                            </td>
                            <td className="px-6 py-4 text-slate-700">{contato.telefone || '-'}</td>
                            <td className="px-6 py-4">
                              {setores.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Apenas marcado como fidelizado</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {setores.map(s => (
                                    <div key={s.key} className="flex items-center gap-1.5">
                                      <Badge className={`${s.cor} text-[10px]`}>{s.label}</Badge>
                                      <span className="text-xs text-slate-700">{resolverNome(contato[s.key])}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <Badge className={`${corDias} hover:opacity-90`}>
                                {diasSemContato === null ? 'Sem registro' : diasSemContato === 0 ? 'Hoje' : `${diasSemContato} ${diasSemContato === 1 ? 'dia' : 'dias'}`}
                              </Badge>
                            </td>
                            <td className="px-6 py-4"><Badge variant="outline">{contato.segmento_atual || 'N/A'}</Badge></td>
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
                            <td className="px-6 py-4 text-center">
                              <BotaoAbrirChat contato={contato} />
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
          <Button onClick={() => setFiltros({ busca: '', status: 'todos', classificacao: 'todos', segmento: 'todos', responsavel: 'todos', recorrencia: 'todos' })} variant="link" className="mt-4 text-blue-600">
            Limpar Filtros
          </Button>
        </div>
      ) : viewMode === 'kanban' ? (
        <ClienteKanban
          clientes={clientesComScore}
          scores={clientesScores}
          onEdit={handleEditarCliente}
          onDelete={handleExcluirCliente}
          loading={isLoading}
          vendedores={vendedores}
          verDetalhes={setViewingDetails}
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
                dados_evento: { cliente_id: clienteId, status_novo: novoStatus },
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
              onViewDetails={setViewingDetails}
            />
          </CardContent>
        </Card>
      )}

      {/* CLIENTES QUE FATURARAM MAS NÃO ESTÃO CADASTRADOS */}
      {aba === 'clientes' && clientesNaoCadastrados.length > 0 && (
        <ClientesNaoCadastrados clientes={clientesNaoCadastrados} onCadastrar={handleCadastrarDeNF} />
      )}

      {/* MODAL DE FORMULÁRIO */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <ClienteForm
              cliente={editingCliente}
              vendedores={vendedores}
              onSave={handleSalvarCliente}
              onCancel={() => { setShowForm(false); setEditingCliente(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}