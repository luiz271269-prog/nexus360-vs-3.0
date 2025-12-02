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
import PlaybookManager from "../components/automacao/PlaybookManager"; // This import is now redundant but kept for safety if it's used elsewhere or if its removal is not explicit. The new component `BibliotecaAutomacoes` will be used instead in the UI.
import SearchAndFilter from "../components/comunicacao/SearchAndFilter";
import EmptyState from "../components/comunicacao/EmptyState";
import WebhookInstructions from "../components/comunicacao/WebhookInstructions";
import ErrorBoundary from "../components/comunicacao/ErrorBoundary";
import NotificationSystem from "../components/comunicacao/NotificationSystem";
import { useDebounce } from "../components/lib/useDebounce";
import { normalizarTelefone } from "../components/lib/phoneUtils";
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

  const [filterScope, setFilterScope] = useState('all');
  const [selectedAttendantId, setSelectedAttendantId] = useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('all');
  const [selectedCategoria, setSelectedCategoria] = useState('all');
  const [selectedTipoContato, setSelectedTipoContato] = useState('all');
  const [selectedTagContato, setSelectedTagContato] = useState('all');

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

  const { data: contatos = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    retry: 1
  });

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['threads', usuario?.id, filterScope, selectedAttendantId],
    queryFn: async () => {
      if (!usuario) return [];

      const isManager = usuario.role === 'admin' || usuario.role === 'supervisor';
      
      // ⚡ OTIMIZAÇÃO: Buscar apenas 50 threads mais recentes
      const allThreads = await base44.entities.MessageThread.list('-last_message_at', 50);

      // ============================================================================
      // 🔐 LÓGICA DE VISIBILIDADE DE CONVERSAS (ATENDENTES)
      // ============================================================================
      // OBJETIVO: Garantir que NENHUMA conversa nova se perca
      // 
      // REGRAS DE VISIBILIDADE (em ordem de prioridade):
      // 1. Conversa atribuída ao usuário → SEMPRE VISÍVEL
      // 2. Permissão de Conexão WhatsApp → Verificar se usuário tem acesso
      // 3. Permissão de Setor → Verificar compatibilidade de setor
      // 4. Conversas NOVAS (sem atendente) → Visíveis para quem tem acesso à conexão E setor
      // ============================================================================
      
      if (!isManager && usuario.is_whatsapp_attendant) {
        // Configurações do usuário
        const setorPrincipal = usuario.attendant_sector || 'geral';
        const setoresPermitidos = usuario.whatsapp_setores || [setorPrincipal];
        const funcao = usuario.attendant_role || 'junior';
        const permissoesConexao = usuario.whatsapp_permissions || [];
        
        // Gestores podem ver todas as conversas do seu setor (mesmo de outros atendentes)
        const ehGestor = ['gerente', 'coordenador', 'supervisor'].includes(funcao);
        
        return allThreads.filter((thread) => {
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 1: MINHAS CONVERSAS - Sempre visíveis
          // ═══════════════════════════════════════════════════════════════════
          if (thread.assigned_user_id === usuario.id) {
            return true;
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 2: VERIFICAR PERMISSÃO DE CONEXÃO WHATSAPP
          // Se usuário tem permissões específicas, verificar acesso à conexão
          // ═══════════════════════════════════════════════════════════════════
          let temPermissaoConexao = true; // Default: sem restrições
          
          if (permissoesConexao.length > 0 && thread.whatsapp_integration_id) {
            const perm = permissoesConexao.find(p => p.integration_id === thread.whatsapp_integration_id);
            temPermissaoConexao = perm?.can_view === true;
          }
          
          if (!temPermissaoConexao) {
            return false; // Sem acesso à conexão = não vê
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 3: VERIFICAR PERMISSÃO DE SETOR
          // Usuário deve ter acesso ao setor da conversa
          // ═══════════════════════════════════════════════════════════════════
          const setorConversa = thread.sector_id || 'geral';
          
          const temPermissaoSetor = 
            setorPrincipal === 'geral' ||           // Usuário "geral" vê tudo
            setorConversa === 'geral' ||             // Conversa sem setor = visível
            setorConversa === setorPrincipal ||      // Mesmo setor
            setoresPermitidos.includes(setorConversa); // Setor na lista de permitidos
          
          if (!temPermissaoSetor) {
            return false; // Sem acesso ao setor = não vê
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 4: GESTORES - Veem todas do setor (mesmo de outros)
          // ═══════════════════════════════════════════════════════════════════
          if (ehGestor) {
            return true; // Gestor com acesso à conexão e setor = vê tudo
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 5: CONVERSAS NOVAS (SEM ATENDENTE) - NÃO PODEM SE PERDER!
          // Atendentes veem conversas não atribuídas se tiverem acesso
          // ═══════════════════════════════════════════════════════════════════
          if (!thread.assigned_user_id) {
            return true; // Sem atendente + tem permissão conexão + tem permissão setor = VISÍVEL
          }
          
          // ═══════════════════════════════════════════════════════════════════
          // REGRA 6: Conversas de OUTROS atendentes - Não visíveis
          // ═══════════════════════════════════════════════════════════════════
          return false;
        });
        
      } else if (!isManager && !usuario.is_whatsapp_attendant) {
        // Usuário não é atendente de WhatsApp = não vê conversas
        return [];
      }

      // Admin/Manager vê tudo
      return allThreads;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    enabled: !!usuario,
    retry: 1
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', threadAtiva?.id],
    queryFn: () => {
      if (threadAtiva) {
        return base44.entities.Message.filter({ thread_id: threadAtiva.id }, 'created_date', 200);
      }
      return Promise.resolve([]);
    },
    enabled: !!threadAtiva,
    refetchInterval: 5000,
    staleTime: 2000,
    retry: 1
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
    staleTime: 60 * 1000,
    retry: 1
  });

  const handleSelecionarThread = useCallback((thread) => {
    console.log('🔴 Selecionando thread:', thread.id);
    setCriandoNovoContato(false);
    setNovoContatoTelefone("");
    setShowContactInfo(false);
    setThreadAtiva(thread);
  }, []);

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
  // 🔍 FUNÇÃO AUXILIAR: Verificar se contato pertence ao atendente selecionado
  // ═══════════════════════════════════════════════════════════════════════════════
  const verificarContatoPertenceAoAtendente = React.useCallback((contato, atendenteInfo) => {
    if (!atendenteInfo || !contato) return false;
    
    const { id, full_name, email } = atendenteInfo;
    
    // Verificar todos os campos de fidelização
    const camposParaVerificar = [
      contato.vendedor_responsavel,
      contato.atendente_fidelizado_vendas,
      contato.atendente_fidelizado_assistencia,
      contato.atendente_fidelizado_financeiro,
      contato.atendente_fidelizado_fornecedor
    ];
    
    return camposParaVerificar.some(campo => 
      campo && (campo === id || campo === full_name || campo === email)
    );
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 FUNÇÃO AUXILIAR: Verificar se contato passa nos filtros básicos
  // ═══════════════════════════════════════════════════════════════════════════════
  const contatoPassaNosFiltros = React.useCallback((contato, atendenteInfo, ignorarFiltroAtendente = false) => {
    if (!contato) return false;
    
    // Filtro de tipo de contato
    if (selectedTipoContato && selectedTipoContato !== 'all') {
      if (contato.tipo_contato !== selectedTipoContato) return false;
    }

    // Filtro de tag/destaque do contato
    if (selectedTagContato && selectedTagContato !== 'all') {
      const tags = contato.tags || [];
      if (!tags.includes(selectedTagContato)) return false;
    }

    // Filtro por atendente selecionado (IGNORADO quando há busca por texto)
    if (atendenteInfo && !ignorarFiltroAtendente) {
      if (!verificarContatoPertenceAoAtendente(contato, atendenteInfo)) {
        return false;
      }
    }

    // Filtro de busca
    if (debouncedSearchTerm) {
      const termo = debouncedSearchTerm.toLowerCase();
      const matchBusca = 
        contato.nome?.toLowerCase().includes(termo) ||
        contato.empresa?.toLowerCase().includes(termo) ||
        contato.cargo?.toLowerCase().includes(termo) ||
        contato.telefone?.includes(debouncedSearchTerm);
      if (!matchBusca) return false;
    }

    return true;
  }, [selectedTipoContato, selectedTagContato, debouncedSearchTerm, verificarContatoPertenceAoAtendente]);

  const threadsFiltradas = React.useMemo(() => {
    // 🗺️ Criar maps para lookups O(1)
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const categoriasSet = selectedCategoria !== 'all' ? new Set(mensagensComCategoria.map(m => m.thread_id)) : null;
    const permMap = usuario?.role !== 'admin' && usuario?.whatsapp_permissions?.length > 0
      ? new Map(usuario.whatsapp_permissions.map(p => [p.integration_id, p.can_view]))
      : null;

    // 🔍 Buscar info do atendente selecionado
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));
    const atendenteInfo = selectedAttendantId && selectedAttendantId !== 'all' 
      ? atendentesMap.get(selectedAttendantId) 
      : null;

    // ═══════════════════════════════════════════════════════════════════════════════
    // PARTE 1: Filtrar THREADS existentes
    // BUSCA POR TEXTO: Mostra TODOS os resultados, independente de atendente
    // ═══════════════════════════════════════════════════════════════════════════════
    const temBuscaPorTexto = !!debouncedSearchTerm;
    const threadsComContatoIds = new Set();
    const threadsFiltrados = threads.filter(thread => {
      const contato = contatosMap.get(thread.contact_id);
      if (!contato) return false;

      threadsComContatoIds.add(thread.contact_id);

      // ✅ FILTRO POR ATENDENTE - IGNORADO quando há busca por texto!
      if (atendenteInfo && !temBuscaPorTexto) {
        const threadAtribuidaAoAtendente = thread.assigned_user_id === atendenteInfo.id;
        const contatoFidelizadoAoAtendente = verificarContatoPertenceAoAtendente(contato, atendenteInfo);
        
        // Mostrar APENAS se atribuída OU fidelizada ao atendente selecionado
        if (!threadAtribuidaAoAtendente && !contatoFidelizadoAoAtendente) {
          return false;
        }
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

      // Filtro de tag/destaque do contato
      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) return false;
      }

      // Filtro de busca
      if (debouncedSearchTerm) {
        const termo = debouncedSearchTerm.toLowerCase();
        const matchBusca = 
          contato.nome?.toLowerCase().includes(termo) ||
          contato.empresa?.toLowerCase().includes(termo) ||
          contato.cargo?.toLowerCase().includes(termo) ||
          thread.last_message_content?.toLowerCase().includes(termo) ||
          contato.telefone?.includes(debouncedSearchTerm);
        if (!matchBusca) return false;
      }

      return true;
    });

    // ═══════════════════════════════════════════════════════════════════════════════
    // PARTE 2: Adicionar CONTATOS SEM THREAD que passam nos filtros
    // BUSCA POR TEXTO: Mostra TODOS os contatos que batem, independente de atendente
    // FILTROS: Aplica normalmente os filtros de atendente/tipo/tag
    // ═══════════════════════════════════════════════════════════════════════════════
    const temBuscaPorTexto = !!debouncedSearchTerm;
    const temFiltroAtivo = atendenteInfo || 
      (selectedTipoContato && selectedTipoContato !== 'all') || 
      (selectedTagContato && selectedTagContato !== 'all');

    const contatosSemThread = [];
    if (temBuscaPorTexto || temFiltroAtivo) {
      contatos.forEach(contato => {
        // Pular contatos que já têm thread
        if (threadsComContatoIds.has(contato.id)) return;
        
        // Pular contatos bloqueados
        if (contato.bloqueado) return;

        // Se é busca por texto, IGNORA o filtro de atendente para mostrar TODOS os resultados
        const ignorarFiltroAtendente = temBuscaPorTexto;
        if (!contatoPassaNosFiltros(contato, atendenteInfo, ignorarFiltroAtendente)) return;

        // Criar "pseudo-thread" para exibição
        contatosSemThread.push({
          id: `contato-sem-thread-${contato.id}`,
          contact_id: contato.id,
          is_contact_only: true, // Flag para identificar
          last_message_at: contato.ultima_interacao || contato.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
          assigned_user_id: null,
          assigned_user_name: null
        });
      });
    }

    // Combinar threads + contatos sem thread
    return [...threadsFiltrados, ...contatosSemThread];
  }, [threads, contatos, atendentes, usuario?.id, usuario?.role, selectedAttendantId, selectedIntegrationId, selectedCategoria, selectedTipoContato, selectedTagContato, debouncedSearchTerm, mensagensComCategoria, verificarContatoPertenceAoAtendente, contatoPassaNosFiltros]);

  const threadsComContato = React.useMemo(() => {
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));

    return threadsFiltradas.map(thread => ({
      ...thread,
      contato: contatosMap.get(thread.contact_id),
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
                    onSelectedTagContatoChange={setSelectedTagContato} />


                  <div className="flex-1 overflow-y-auto">
                    <ChatSidebar
                      threads={threadsComContato}
                      threadAtiva={threadAtiva}
                      onSelecionarThread={handleSelecionarThread}
                      loading={loadingThreads}
                      usuarioAtual={usuario}
                      integracoes={integracoes} />

                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {threadAtiva && !criandoNovoContato ?
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
                        selectedCategoria={selectedCategoria} />

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
                      message="Criar Novo Contato"
                      subtitle="Preencha as informações ao lado" />

                      
                      <ContactInfoPanel
                      contact={null}
                      novoContatoTelefone={novoContatoTelefone}
                      onClose={() => {
                        setCriandoNovoContato(false);
                        setNovoContatoTelefone("");
                        setShowContactInfo(false);
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