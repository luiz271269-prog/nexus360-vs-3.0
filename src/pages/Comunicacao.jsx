import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Settings,
  RefreshCw,
  Zap,
  MessageCircle,
  Activity,
  BarChart3,
  Users,
  Bug } from
"lucide-react";
import { toast } from "sonner";

import ChatSidebar from "../components/comunicacao/ChatSidebar";
import ChatWindow from "../components/comunicacao/ChatWindow";
import ContactInfoPanel from "../components/comunicacao/ContactInfoPanel";
import ConfiguracaoWhatsAppHub from "../components/comunicacao/ConfiguracaoWhatsAppHub";
import DiagnosticoInbound from "../components/comunicacao/DiagnosticoInbound";
import SearchAndFilter from "../components/comunicacao/SearchAndFilter";
import EmptyState from "../components/comunicacao/EmptyState";
import WebhookInstructions from "../components/comunicacao/WebhookInstructions";
import ErrorBoundary from "../components/comunicacao/ErrorBoundary";
import NotificationSystem from "../components/comunicacao/NotificationSystem";
import { useDebounce } from "../components/lib/useDebounce";
import { normalizarTelefone } from "../components/lib/phoneUtils";
import { 
  usuarioCorresponde, 
  contatoFidelizadoAoUsuario 
} from "../components/lib/userMatcher";
import BibliotecaAutomacoes from "../components/automacao/BibliotecaAutomacoes";
import CentralControleOperacional from "../components/comunicacao/CentralControleOperacional";
import DiagnosticoCirurgicoEmbed from "../components/comunicacao/DiagnosticoCirurgicoEmbed";
import GerenciadorEtiquetasUnificado from "../components/comunicacao/GerenciadorEtiquetasUnificado";


export default function Comunicacao() {
  const [usuario, setUsuario] = useState(null);
  const [threadAtiva, setThreadAtiva] = useState(null);
  const [activeTab, setActiveTab] = useState("conversas");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [mostrarInstrucoesWebhook, setMostrarInstrucoesWebhook] = useState(false);

  // RESTAURADO: Estados para criar novo contato
  const [novoContatoTelefone, setNovoContatoTelefone] = useState("");
  const [criandoNovoContato, setCriandoNovoContato] = useState(false);

  // Estados para seleção múltipla (broadcast)
  const [modoSelecaoMultipla, setModoSelecaoMultipla] = useState(false);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);

  const [filterScope, setFilterScope] = useState('all');
  const [selectedAttendantId, setSelectedAttendantId] = useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('all');
  const [selectedCategoria, setSelectedCategoria] = useState('all');
  const [selectedTipoContato, setSelectedTipoContato] = useState('all');
  const [selectedTagContato, setSelectedTagContato] = useState('all');

  // Estado para dados do cliente pré-preenchidos (quando clica em cliente_sem_contato)
  const [contactInitialData, setContactInitialData] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuario(user);
        const isManager = user.role === 'admin' || user.role === 'supervisor';
        setFilterScope(isManager ? 'all' : 'my');
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        toast.error(`Erro: ${error.message}`);
      }
    };
    carregarUsuario();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 BUSCA DE DADOS - Direto no frontend (sem função backend)
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: contatos = [], isLoading: loadingContatos } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('-created_date', 300),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date', 200),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['threads', usuario?.id],
    queryFn: async () => {
      if (!usuario) return [];
      const allThreads = await base44.entities.MessageThread.list('-last_message_at', 100);
      return allThreads;
    },
    refetchInterval: 30000,
    staleTime: 15000,
    enabled: !!usuario,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const loadingTopics = loadingThreads;

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', threadAtiva?.id],
    queryFn: () => {
      if (threadAtiva) {
        return base44.entities.Message.filter({ thread_id: threadAtiva.id }, 'created_date', 200);
      }
      return Promise.resolve([]);
    },
    enabled: !!threadAtiva,
    refetchInterval: 15000, // Aumentado para 15s para evitar rate limit
    staleTime: 10000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  const { data: todasIntegracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 1
  });

  // Filtrar integrações baseado nas permissões do usuário
  const integracoes = React.useMemo(() => {
    if (!usuario || !todasIntegracoes.length) return [];
    if (usuario.role === 'admin') return todasIntegracoes;

    const whatsappPerms = usuario.whatsapp_permissions || [];
    if (whatsappPerms.length === 0) return todasIntegracoes;

    const permMap = new Map(whatsappPerms.map(p => [p.integration_id, p.can_view]));
    return todasIntegracoes.filter(i => permMap.get(i.id));
  }, [todasIntegracoes, usuario?.id, usuario?.role]);

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    enabled: usuario?.role === 'admin' || usuario?.role === 'supervisor',
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // 🏷️ Buscar mensagens com categoria selecionada para filtrar threads na sidebar
  const { data: mensagensComCategoria = [] } = useQuery({
    queryKey: ['mensagens-com-categoria', selectedCategoria],
    queryFn: async () => {
      if (!selectedCategoria || selectedCategoria === 'all') return [];
      
      const todasMensagens = await base44.entities.Message.list('-created_date', 200);
      return todasMensagens.filter(m => 
        Array.isArray(m.categorias) && m.categorias.includes(selectedCategoria)
      );
    },
    enabled: !!selectedCategoria && selectedCategoria !== 'all',
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 HANDLER DE SELEÇÃO DE THREAD/CONTATO/CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleSelecionarThread = useCallback(async (thread) => {
    console.log('🖱️ [Comunicacao] Selecionando:', thread.id);
    setCriandoNovoContato(false);
    setNovoContatoTelefone("");
    setShowContactInfo(false);
    setContactInitialData(null);

    // CASO 1: CLIENTE SEM CONTATO - Abrir criação pré-preenchida
    if (thread.is_cliente_only && thread.cliente_id) {
      const cliente = clientes.find(c => c.id === thread.cliente_id);
      if (cliente) {
        setContactInitialData({
          cliente_id: cliente.id,
          empresa: cliente.nome_fantasia || cliente.razao_social,
          nome: cliente.contato_principal_nome || cliente.razao_social,
          telefone: cliente.telefone,
          vendedor_responsavel: cliente.vendedor_responsavel,
          ramo_atividade: cliente.ramo_atividade,
          tipo_contato: 'cliente',
          cargo: cliente.contato_principal_cargo || '',
          email: cliente.email || ''
        });
        setNovoContatoTelefone(cliente.telefone || '');
        setCriandoNovoContato(true);
        setShowContactInfo(true);
        setThreadAtiva(null);
        toast.info('💎 Cliente sem contato. Preencha para criar.');
        return;
      }
    }

    // CASO 2: CONTATO SEM THREAD - Buscar/criar thread
    if (thread.is_contact_only && thread.contact_id) {
      try {
        const threadsExistentes = await base44.entities.MessageThread.filter({ contact_id: thread.contact_id });
        
        if (threadsExistentes && threadsExistentes.length > 0) {
          setThreadAtiva(threadsExistentes[0]);
          return;
        }

        const integracaoAtiva = integracoes.find((i) => i.status === 'conectado');
        if (!integracaoAtiva) {
          toast.error('❌ Nenhuma integração WhatsApp ativa');
          return;
        }

        const novaThread = await base44.entities.MessageThread.create({
          contact_id: thread.contact_id,
          whatsapp_integration_id: integracaoAtiva.id,
          status: 'aberta',
          unread_count: 0,
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true
        });

        await queryClient.invalidateQueries({ queryKey: ['threads'] });
        setThreadAtiva(novaThread);
        toast.info('📋 Conversa iniciada.');
        return;
      } catch (error) {
        console.error('[Comunicacao] Erro ao criar thread:', error);
        toast.error('Erro ao abrir conversa');
        return;
      }
    }

    // CASO 3: THREAD NORMAL
    setThreadAtiva(thread);
  }, [integracoes, queryClient, clientes]);

  // RESTAURADO: Handler para criar novo contato
  const handleCriarNovoContato = useCallback(async (dadosContato) => {
    try {
      console.log('[Comunicacao] Criando novo contato:', dadosContato);

      const telefoneNormalizado = normalizarTelefone(dadosContato.telefone);
      if (!telefoneNormalizado) {
        toast.error('❌ Telefone inválido');
        return;
      }

      const novoContato = await base44.entities.Contact.create({
        ...dadosContato,
        telefone: telefoneNormalizado,
        whatsapp_status: 'nao_verificado'
      });

      const integracaoAtiva = integracoes.find((i) => i.status === 'conectado');
      if (!integracaoAtiva) {
        toast.error('❌ Nenhuma integração WhatsApp ativa encontrada');
        return;
      }

      const novaThread = await base44.entities.MessageThread.create({
        contact_id: novoContato.id,
        whatsapp_integration_id: integracaoAtiva.id,
        status: 'aberta',
        unread_count: 0,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true
      });

      toast.success('✅ Contato criado com sucesso!');

      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['threads'] });

      setCriandoNovoContato(false);
      setNovoContatoTelefone("");
      setShowContactInfo(false);
      setThreadAtiva(novaThread);

    } catch (error) {
      console.error('[Comunicacao] Erro ao criar contato:', error);
      toast.error(`Erro ao criar contato: ${error.message}`);
    }
  }, [integracoes, queryClient]);

  // RESTAURADO: Handler para atualizar informações do contato
  const handleAtualizarContato = useCallback(async (dadosAtualizados) => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['threads'] });

      if (threadAtiva) {
        const threadAtualizada = await base44.entities.MessageThread.filter({ id: threadAtiva.id });
        if (threadAtualizada && threadAtualizada.length > 0) {
          setThreadAtiva(threadAtualizada[0]);
        }
      }

      toast.success('✅ Informações atualizadas!');
    } catch (error) {
      console.error('[Comunicacao] Erro ao atualizar:', error);
      toast.error('Erro ao atualizar informações');
    }
  }, [threadAtiva, queryClient]);

  // RESTAURADO: Handler para atualizar mensagens após envio
  const handleAtualizarMensagens = useCallback(async (novasMensagens) => {
    if (novasMensagens) {
      queryClient.setQueryData(['mensagens', threadAtiva?.id], novasMensagens);
    } else {
      await queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva?.id] });
    }
    await queryClient.invalidateQueries({ queryKey: ['threads'] });
  }, [threadAtiva, queryClient]);



  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 REGRAS DE VISUALIZAÇÃO - PROCESSAMENTO LOCAL
  // SEM BUSCA: Mostrar APENAS conversas WhatsApp ativas (threads) - igual WhatsApp
  // COM BUSCA: Mostrar busca unificada (threads + contatos + clientes)
  // ═══════════════════════════════════════════════════════════════════════════════

  // Função de busca estilo Google
  const matchBuscaGoogle = React.useCallback((item, termo) => {
    if (!termo || termo.length < 2) return true;
    
    const normalizarTexto = (t) => {
      if (!t) return '';
      return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };
    
    const termoNorm = normalizarTexto(termo);
    const termoNumeros = String(termo).replace(/\D/g, '');
    const palavras = termoNorm.split(/\s+/).filter(p => p.length > 0);
    
    const camposTexto = [
      item.nome, item.empresa, item.cargo, item.email, item.observacoes,
      item.vendedor_responsavel, item.razao_social, item.nome_fantasia,
      item.contato_principal_nome, item.segmento,
      ...(Array.isArray(item.tags) ? item.tags : [])
    ].filter(Boolean);
    
    const camposNumero = [item.telefone, item.cnpj].filter(Boolean);
    
    const textoCompleto = camposTexto.map(c => normalizarTexto(String(c))).join(' ');
    const numerosCompletos = camposNumero.map(c => String(c).replace(/\D/g, '')).join(' ');
    
    const todasPalavrasEncontradas = palavras.every(p => textoCompleto.includes(p));
    const numeroEncontrado = termoNumeros.length >= 3 && numerosCompletos.includes(termoNumeros);
    
    return todasPalavrasEncontradas || numeroEncontrado;
  }, []);

  const threadsFiltradas = React.useMemo(() => {
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const categoriasSet = selectedCategoria !== 'all' ? new Set(mensagensComCategoria.map(m => m.thread_id)) : null;
    const permMap = usuario?.role !== 'admin' && usuario?.whatsapp_permissions?.length > 0
      ? new Map(usuario.whatsapp_permissions.map(p => [p.integration_id, p.can_view]))
      : null;
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));
    const atendenteInfo = selectedAttendantId && selectedAttendantId !== 'all' 
      ? atendentesMap.get(selectedAttendantId) 
      : null;

    const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
    const threadsComContatoIds = new Set();

    // PARTE 1: Filtrar THREADS existentes
    const threadsFiltrados = threads.filter(thread => {
      const contato = contatosMap.get(thread.contact_id);
      if (!contato) return false;
      
      threadsComContatoIds.add(thread.contact_id);

      // Filtro por atendente (ignorado quando há busca)
      if (atendenteInfo && !temBuscaPorTexto) {
        const threadAtribuidaAoAtendente = thread.assigned_user_id === atendenteInfo.id;
        if (!threadAtribuidaAoAtendente) return false;
      }

      // Filtro de integração
      if (selectedIntegrationId !== 'all' && thread.whatsapp_integration_id !== selectedIntegrationId) {
        return false;
      }

      // Filtro de categoria
      if (categoriasSet && !categoriasSet.has(thread.id)) {
        return false;
      }

      // Filtro de permissões
      if (permMap && thread.whatsapp_integration_id) {
        if (!permMap.get(thread.whatsapp_integration_id)) return false;
      }

      // Filtro de tipo de contato
      if (selectedTipoContato && selectedTipoContato !== 'all') {
        if (contato.tipo_contato !== selectedTipoContato) return false;
      }

      // Filtro de tag
      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) return false;
      }

      // Busca por texto
      if (temBuscaPorTexto) {
        if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return false;
      }

      return true;
    });

    // PARTE 2: COM BUSCA - Adicionar contatos sem thread e clientes sem contato
    if (temBuscaPorTexto) {
      // Contatos sem thread
      contatos.forEach(contato => {
        if (threadsComContatoIds.has(contato.id)) return;
        if (contato.bloqueado) return;
        if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;

        threadsFiltrados.push({
          id: `contato-sem-thread-${contato.id}`,
          contact_id: contato.id,
          is_contact_only: true,
          last_message_at: contato.ultima_interacao || contato.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa'
        });
      });

      // Clientes sem contato
      clientes.forEach(cliente => {
        if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;
        
        const telefoneCliente = (cliente.telefone || '').replace(/\D/g, '');
        const jaTemContato = contatos.some(c => {
          const tel = (c.telefone || '').replace(/\D/g, '');
          return tel && telefoneCliente && tel === telefoneCliente;
        });
        if (jaTemContato) return;

        threadsFiltrados.push({
          id: `cliente-sem-contato-${cliente.id}`,
          cliente_id: cliente.id,
          is_cliente_only: true,
          last_message_at: cliente.ultimo_contato || cliente.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
          contato: {
            id: `cli-${cliente.id}`,
            nome: cliente.razao_social || cliente.nome_fantasia || cliente.contato_principal_nome,
            empresa: cliente.nome_fantasia || cliente.razao_social,
            telefone: cliente.telefone,
            email: cliente.email,
            cargo: cliente.contato_principal_cargo,
            tipo_contato: 'cliente',
            tags: [],
            is_from_cliente: true
          }
        });
      });
    }

    return threadsFiltrados;
  }, [threads, contatos, clientes, atendentes, usuario?.role, selectedAttendantId, selectedIntegrationId, selectedCategoria, selectedTipoContato, selectedTagContato, debouncedSearchTerm, mensagensComCategoria, matchBuscaGoogle]);

  // Converter para formato compatível com ChatSidebar
  const threadsComContato = React.useMemo(() => {
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));

    return threadsFiltradas.map(thread => ({
      ...thread,
      contato: thread.contato || contatosMap.get(thread.contact_id),
      atendente_atribuido: atendentesMap.get(thread.assigned_user_id)
    }));
  }, [threadsFiltradas, contatos, atendentes]);

  const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';
  const contatoAtivo = threadAtiva ? contatos.find((c) => c.id === threadAtiva.contact_id) : null;

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p>Carregando usuário...</p>
        </div>
      </div>);

  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 overflow-hidden">
        <NotificationSystem usuario={usuario} />

        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 p-4 shadow-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Central de Comunicacao
                </h1>
                <p className="text-sm text-slate-300">
                  WhatsApp, Templates e Automação
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {integracoes.length === 0 &&
              <Button
                onClick={() => setMostrarInstrucoesWebhook(true)}
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/20">

                  Configurar Webhook
                </Button>
              }

              <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                toast.info("Recarregando...");
                await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['threads'] }),
                queryClient.invalidateQueries({ queryKey: ['contacts'] }),
                queryClient.invalidateQueries({ queryKey: ['integracoes'] }),
                queryClient.invalidateQueries({ queryKey: ['atendentes'] }),
                threadAtiva ? queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] }) : Promise.resolve()]
                );
                toast.success("Atualizado!");
              }}
              className="border-white/30 text-white hover:bg-white/20">

                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <WebhookInstructions
          isOpen={mostrarInstrucoesWebhook}
          onClose={() => setMostrarInstrucoesWebhook(false)} />


        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 border-b border-slate-600 flex-shrink-0">
            <TabsList className="bg-transparent border-0">
              <TabsTrigger value="conversas" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <MessageCircle className="w-4 h-4" />
                Conversas
              </TabsTrigger>
              <TabsTrigger value="controle" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <Activity className="w-4 h-4" />
                Controle Operacional
              </TabsTrigger>
              <TabsTrigger value="automacao" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <Zap className="w-4 h-4" />
                Automação
              </TabsTrigger>
              <TabsTrigger value="diagnostico" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <BarChart3 className="w-4 h-4" />
                Diagnóstico
              </TabsTrigger>
              <TabsTrigger value="diagnostico-cirurgico" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <Bug className="w-4 h-4" />
                Diagnóstico Cirúrgico
              </TabsTrigger>
              <TabsTrigger value="etiquetas" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <Users className="w-4 h-4" />
                Etiquetas
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-slate-300 hover:text-white transition-all">
                <Settings className="w-4 h-4" />
                Configurações
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* TAB: CONVERSAS */}
            <TabsContent value="conversas" className="h-full m-0 p-0">
              <div className="flex h-full">
                <div className="w-80 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
                  {/* RESTAURADO: SearchAndFilter com TODOS os props */}
                  <SearchAndFilter
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterScope={filterScope}
                    onFilterScopeChange={setFilterScope}
                    selectedAttendantId={selectedAttendantId}
                    onSelectedAttendantChange={setSelectedAttendantId}
                    atendentes={atendentes}
                    isManager={isManager}
                    novoContatoTelefone={novoContatoTelefone}
                    onNovoContatoTelefoneChange={setNovoContatoTelefone}
                    onCreateContact={() => {
                      setCriandoNovoContato(true);
                      setThreadAtiva(null);
                      setShowContactInfo(true);
                    }}
                    integracoes={integracoes}
                    selectedIntegrationId={selectedIntegrationId}
                    onSelectedIntegrationChange={setSelectedIntegrationId}
                    selectedCategoria={selectedCategoria}
                    onSelectedCategoriaChange={setSelectedCategoria}
                    selectedTipoContato={selectedTipoContato}
                    onSelectedTipoContatoChange={setSelectedTipoContato}
                    selectedTagContato={selectedTagContato}
                    onSelectedTagContatoChange={setSelectedTagContato}
                    modoSelecaoMultipla={modoSelecaoMultipla}
                    onModoSelecaoMultiplaChange={setModoSelecaoMultipla} />


                  <div className="flex-1 overflow-y-auto">
                    <ChatSidebar
                      threads={threadsComContato}
                      threadAtiva={threadAtiva}
                      onSelecionarThread={handleSelecionarThread}
                      loading={loadingTopics}
                      usuarioAtual={usuario}
                      integracoes={integracoes}
                      modoSelecaoMultipla={modoSelecaoMultipla}
                      setModoSelecaoMultipla={setModoSelecaoMultipla}
                      contatosSelecionados={contatosSelecionados}
                      setContatosSelecionados={setContatosSelecionados} />

                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {(threadAtiva && !criandoNovoContato) || (modoSelecaoMultipla && contatosSelecionados.length > 0) ?
                  <>
                      <div className="flex-1 overflow-hidden">
                        <ChatWindow
                        thread={threadAtiva}
                        mensagens={mensagens}
                        usuario={usuario}
                        onEnviarMensagem={async () => {}}
                        onShowContactInfo={() => setShowContactInfo(!showContactInfo)}
                        onAtualizarMensagens={handleAtualizarMensagens}
                        integracoes={integracoes}
                        selectedCategoria={selectedCategoria}
                        modoSelecaoMultipla={modoSelecaoMultipla}
                        contatosSelecionados={contatosSelecionados}
                        onCancelarSelecao={() => {
                          setModoSelecaoMultipla(false);
                          setContatosSelecionados([]);
                        }} />

                      </div>
                      
                      {showContactInfo && contatoAtivo &&
                    <ContactInfoPanel
                      contact={contatoAtivo}
                      threadAtual={threadAtiva}
                      onClose={() => setShowContactInfo(false)}
                      onUpdate={handleAtualizarContato} />

                    }
                    </> :
                  criandoNovoContato ?
                  <>
                      <EmptyState
                      message={contactInitialData ? "Criar Contato do Cliente" : "Criar Novo Contato"}
                      subtitle={contactInitialData ? `Cliente: ${contactInitialData.empresa || contactInitialData.nome}` : "Preencha as informações ao lado"} />

                      
                      <ContactInfoPanel
                      contact={null}
                      novoContatoTelefone={novoContatoTelefone}
                      defaultValues={contactInitialData}
                      onClose={() => {
                        setCriandoNovoContato(false);
                        setNovoContatoTelefone("");
                        setShowContactInfo(false);
                        setContactInitialData(null);
                      }}
                      onUpdate={handleCriarNovoContato} />

                    </> :

                  <EmptyState />
                  }
                </div>
              </div>
            </TabsContent>

            {/* TAB: CONTROLE OPERACIONAL - FILAS + SAÚDE + DASHBOARD CONSOLIDADO */}
            <TabsContent value="controle" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto bg-slate-900">
                <CentralControleOperacional
                  onSelecionarThread={handleSelecionarThread}
                  usuarioAtual={usuario} />

              </div>
            </TabsContent>

            {/* TAB: AUTOMAÇÃO */}
            <TabsContent value="automacao" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <BibliotecaAutomacoes />
              </div>
            </TabsContent>

            <TabsContent value="diagnostico" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <DiagnosticoInbound integracoes={integracoes} />
              </div>
            </TabsContent>

            <TabsContent value="diagnostico-cirurgico" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <DiagnosticoCirurgicoEmbed />
              </div>
            </TabsContent>

            <TabsContent value="etiquetas" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <GerenciadorEtiquetasUnificado usuarioAtual={usuario} />
              </div>
            </TabsContent>

            <TabsContent value="configuracoes" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <ConfiguracaoWhatsAppHub
                  integracoes={integracoes}
                  usuarioAtual={usuario}
                  onRecarregar={() => queryClient.invalidateQueries({ queryKey: ['integracoes'] })} />

              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ErrorBoundary>);

}