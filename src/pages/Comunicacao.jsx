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
import {
  canUserSeeThreadWithFilters,
  canUserSeeThreadBase,
  isNaoAtribuida,
  filtrarAtendentesVisiveis,
  verificarBloqueioThread,
  podeInteragirNaThread
} from "../components/lib/threadVisibility";
import ModalSemPermissaoConversa from "../components/comunicacao/ModalSemPermissaoConversa";
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

  // Estado para modal de sem permissão
  const [modalSemPermissao, setModalSemPermissao] = useState({
    isOpen: false,
    contato: null,
    atendenteResponsavel: null,
    motivoBloqueio: null,
    threadOriginal: null
  });

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
  // ALINHADO com threadVisibility.js: usa permissoes_visualizacao.integracoes_visiveis
  const integracoes = React.useMemo(() => {
    if (!usuario || !todasIntegracoes.length) return [];
    if (usuario.role === 'admin') return todasIntegracoes;

    const perms = usuario.permissoes_visualizacao || {};
    const integracoesVisiveis = perms.integracoes_visiveis || [];
    
    // Array vazio = sem restrição (mesma regra do threadVisibility.js)
    if (integracoesVisiveis.length === 0) return todasIntegracoes;

    const normalizar = (v) => (v ? String(v).trim().toLowerCase() : '');
    const visiveisNorm = new Set(integracoesVisiveis.map(normalizar));
    return todasIntegracoes.filter(i => visiveisNorm.has(normalizar(i.id)));
  }, [todasIntegracoes, usuario?.id, usuario?.role, usuario?.permissoes_visualizacao]);

  const { data: atendentesRaw = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    enabled: !!usuario,
    staleTime: 5 * 60 * 1000,
    retry: 2
  });

  // Filtrar atendentes visíveis com base nas permissões do usuário
  const atendentes = React.useMemo(() => {
    return filtrarAtendentesVisiveis(usuario, atendentesRaw);
  }, [atendentesRaw, usuario]);

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
          // Verificar permissão antes de abrir
          const contatoObj = contatos.find(c => c.id === thread.contact_id);
          const bloqueio = verificarBloqueioThread(usuario, threadsExistentes[0], contatoObj);
          
          if (bloqueio.bloqueado) {
            // Mostrar modal explicando o bloqueio
            setModalSemPermissao({
              isOpen: true,
              contato: contatoObj,
              atendenteResponsavel: bloqueio.atendenteResponsavel,
              motivoBloqueio: bloqueio.motivo,
              threadOriginal: threadsExistentes[0]
            });
            return;
          }
          
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
          can_send_without_template: true,
          assigned_user_id: usuario.id,
          assigned_user_name: usuario.full_name,
          assigned_user_email: usuario.email
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

    // CASO 3: THREAD NORMAL - Verificar permissão
    const contatoObj = contatos.find(c => c.id === thread.contact_id);
    const bloqueio = verificarBloqueioThread(usuario, thread, contatoObj);
    
    if (bloqueio.bloqueado) {
      console.log('[Comunicacao] 🔒 Thread bloqueada:', bloqueio);
      setModalSemPermissao({
        isOpen: true,
        contato: contatoObj,
        atendenteResponsavel: bloqueio.atendenteResponsavel,
        motivoBloqueio: bloqueio.motivo,
        threadOriginal: thread
      });
      return;
    }
    
    setThreadAtiva(thread);
  }, [integracoes, queryClient, clientes, contatos, usuario]);

  // Handler para iniciar nova conversa quando não tem permissão na existente
  const handleIniciarNovaConversaSemPermissao = useCallback(async () => {
    const { contato } = modalSemPermissao;
    if (!contato) {
      setModalSemPermissao({ isOpen: false, contato: null, atendenteResponsavel: null, motivoBloqueio: null, threadOriginal: null });
      return;
    }

    try {
      const integracaoAtiva = integracoes.find((i) => i.status === 'conectado');
      if (!integracaoAtiva) {
        toast.error('❌ Nenhuma integração WhatsApp ativa');
        return;
      }

      // Criar nova thread atribuída ao usuário atual
      const novaThread = await base44.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoAtiva.id,
        status: 'aberta',
        unread_count: 0,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true,
        assigned_user_id: usuario.id,
        assigned_user_name: usuario.full_name,
        assigned_user_email: usuario.email
      });

      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      setThreadAtiva(novaThread);
      setModalSemPermissao({ isOpen: false, contato: null, atendenteResponsavel: null, motivoBloqueio: null, threadOriginal: null });
      toast.success('✅ Nova conversa iniciada!');
    } catch (error) {
      console.error('[Comunicacao] Erro ao criar nova thread:', error);
      toast.error('Erro ao iniciar conversa');
    }
  }, [modalSemPermissao, integracoes, usuario, queryClient]);

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
  // ═══════════════════════════════════════════════════════════════════════════════
  // 
  // REGRA 2.1: Conversa atribuída ao usuário (assigned_user_id) → VISÍVEL
  // REGRA 2.2: Contato fidelizado ao usuário → VISÍVEL (mesmo sem atribuição)
  // REGRA 2.3: Permissões por integração WhatsApp → Obrigatório
  // REGRA 2.4: Conversas não atribuídas → VISÍVEIS para usuários com permissão na integração
  //
  // PRIORIDADE (Regra 3):
  // 1. 🟢 Threads ativas (conversas com mensagens)
  // 2. 🟡 Contatos sem thread (apenas com busca)
  // 3. 🔵 Clientes sem contato (apenas com busca)
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
    if (!usuario) return [];

    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const categoriasSet = selectedCategoria !== 'all' ? new Set(mensagensComCategoria.map(m => m.thread_id)) : null;
    const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
    const threadsComContatoIds = new Set();

    // ═══════════════════════════════════════════════════════════════════════════
    // FILTRO ESPECIAL: "Não atribuídas" - Mostrar TODAS as threads sem atribuição
    // Agrupa por contato: se um contato tem QUALQUER thread S/atend visível,
    // mostra TODAS as threads desse contato
    // ═══════════════════════════════════════════════════════════════════════════
    const isFilterUnassigned = filterScope === 'unassigned';

    // PASSO 1: Identificar contatos que têm pelo menos uma thread S/atend visível
    const contatosComThreadsNaoAtribuidas = new Set();
    if (isFilterUnassigned) {
      threads.forEach(thread => {
        const contato = contatosMap.get(thread.contact_id);
        if (!contato) return;

        // Enriquecer thread com contato para verificação de permissão
        const threadComContato = { ...thread, contato };

        // Verificar se é não atribuída E se usuário pode ver (permissões base)
        if (isNaoAtribuida(thread) && canUserSeeThreadBase(usuario, threadComContato)) {
          contatosComThreadsNaoAtribuidas.add(thread.contact_id);
        }
      });
    }

    // PASSO 1.5: Agrupar threads por contact_id - mostrar apenas a mais recente de cada contato
    // CRÍTICO: Isso evita duplicatas quando um contato tem múltiplas threads
    const threadMaisRecentePorContato = new Map();
    threads.forEach(thread => {
      const contactId = thread.contact_id;
      if (!contactId) return;

      const existente = threadMaisRecentePorContato.get(contactId);
      if (!existente) {
        threadMaisRecentePorContato.set(contactId, thread);
      } else {
        // Manter a mais recente baseado em last_message_at ou updated_date
        const dataExistente = new Date(existente.last_message_at || existente.updated_date || existente.created_date || 0);
        const dataAtual = new Date(thread.last_message_at || thread.updated_date || thread.created_date || 0);
        if (dataAtual > dataExistente) {
          threadMaisRecentePorContato.set(contactId, thread);
        }
      }
    });

    // Usar apenas threads únicas por contato
    const threadsUnicas = Array.from(threadMaisRecentePorContato.values());
    
    // Registrar IDs de contatos que já têm thread (para evitar duplicatas na busca)
    const contatosComThreadExistente = new Set(threadsUnicas.map(t => t.contact_id).filter(Boolean));

    // Montar objeto de filtros para threadVisibility
    // Quando filtro é "não atribuídas", não passar atendente específico
    const filtros = {
      atendenteId: isFilterUnassigned ? null : selectedAttendantId,
      integracaoId: selectedIntegrationId,
      scope: filterScope
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PARTE 1: Filtrar THREADS existentes com REGRAS DE VISUALIZAÇÃO
    // (Usando threadsUnicas para evitar duplicatas por contato)
    // ═══════════════════════════════════════════════════════════════════════════
    const threadsFiltrados = threadsUnicas.filter(thread => {
      const contato = contatosMap.get(thread.contact_id);
      
      // Permitir threads sem contato_id se forem S/atend (para não perder threads soltas)
      if (!contato && !isFilterUnassigned) return false;

      if (thread.contact_id) {
        threadsComContatoIds.add(thread.contact_id);
      }

      // Enriquecer thread com contato para a função de visibilidade
      const threadComContato = { ...thread, contato };

      // ═══════════════════════════════════════════════════════════════════════
      // FILTRO "NÃO ATRIBUÍDAS": Lógica por contato
      // Se contato tem alguma S/atend visível → mostra TODAS as threads dele
      // Também inclui threads S/atend "soltas" (sem contact_id)
      // ═══════════════════════════════════════════════════════════════════════
      if (isFilterUnassigned) {
        const contatoId = thread.contact_id;
        const threadNaoAtribuida = isNaoAtribuida(thread);
        
        // Contato está marcado como tendo S/atend OU é uma thread solta S/atend
        const contatoMarcado = contatoId && contatosComThreadsNaoAtribuidas.has(contatoId);
        const threadSoltaNaoAtribuida = !contatoId && threadNaoAtribuida;
        
        if (!contatoMarcado && !threadSoltaNaoAtribuida) {
          return false;
        }
        
        // Verificar permissões base (integração/conexão/setor)
        if (!canUserSeeThreadBase(usuario, threadComContato)) {
          return false;
        }
        
        // Aplicar filtro de integração se selecionado
        if (selectedIntegrationId && selectedIntegrationId !== 'all') {
          if (thread.whatsapp_integration_id !== selectedIntegrationId) return false;
        }
      } else {
        // ═══════════════════════════════════════════════════════════════════════
        // REGRA CENTRAL: Usar módulo threadVisibility.js para outros escopos
        // ═══════════════════════════════════════════════════════════════════════
        if (!canUserSeeThreadWithFilters(usuario, threadComContato, filtros)) {
          return false;
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // FILTROS ADICIONAIS (categoria, tipo contato, tag, busca)
      // ═══════════════════════════════════════════════════════════════════════

      // Filtro de categoria
      if (categoriasSet && !categoriasSet.has(thread.id)) {
        return false;
      }

      // Filtro de tipo de contato (só aplica se tiver contato)
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato) {
        if (contato.tipo_contato !== selectedTipoContato) return false;
      }

      // Filtro de tag (só aplica se tiver contato)
      if (selectedTagContato && selectedTagContato !== 'all' && contato) {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) return false;
      }

      // Busca por texto (só aplica se tiver contato)
      if (temBuscaPorTexto && contato) {
        if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return false;
      }

      return true;
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PARTE 2: COM BUSCA - Adicionar contatos sem thread e clientes sem contato
    // IMPORTANTE: Usar contatosComThreadExistente para evitar duplicatas
    // ═══════════════════════════════════════════════════════════════════════════
    if (temBuscaPorTexto) {
      // Contatos sem thread - usar Set de contatos que já têm thread
      contatos.forEach(contato => {
        // CRÍTICO: Verificar em AMBOS os sets para evitar duplicatas
        if (contatosComThreadExistente.has(contato.id)) return;
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

      // Clientes sem contato associado
      clientes.forEach(cliente => {
        if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;
        
        // Verificar se cliente já tem contato pelo telefone
        const telefoneCliente = (cliente.telefone || '').replace(/\D/g, '');
        if (telefoneCliente) {
          const jaTemContato = contatos.some(c => {
            const tel = (c.telefone || '').replace(/\D/g, '');
            return tel && tel === telefoneCliente;
          });
          if (jaTemContato) return;
        }

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
  }, [threads, contatos, clientes, atendentes, usuario, selectedAttendantId, selectedIntegrationId, selectedCategoria, selectedTipoContato, selectedTagContato, debouncedSearchTerm, mensagensComCategoria, matchBuscaGoogle]);

  // Converter para formato compatível com ChatSidebar + ORDENAÇÃO por PRIORIDADE (Regra 3)
  // DEDUPLICAÇÃO FINAL: Garantir que não há entradas duplicadas por contact_id
  const threadsComContato = React.useMemo(() => {
    const contatosMap = new Map(contatos.map(c => [c.id, c]));
    const atendentesMap = new Map(atendentes.map(a => [a.id, a]));

    // Enriquecer com contato e atendente
    const enriched = threadsFiltradas.map(thread => ({
      ...thread,
      contato: thread.contato || contatosMap.get(thread.contact_id),
      atendente_atribuido: atendentesMap.get(thread.assigned_user_id)
    }));
    
    // DEDUPLICAÇÃO FINAL: Remover duplicatas baseado em contact_id
    // Priorizar threads reais sobre "contato-sem-thread" e "cliente-sem-contato"
    const vistos = new Map();
    const deduplicated = [];
    
    for (const thread of enriched) {
      const contactId = thread.contact_id;
      
      // Se não tem contact_id (cliente sem contato), adicionar direto
      if (!contactId) {
        deduplicated.push(thread);
        continue;
      }
      
      const existente = vistos.get(contactId);
      if (!existente) {
        vistos.set(contactId, thread);
        deduplicated.push(thread);
      } else {
        // Se o existente é "contato-sem-thread" e o atual é thread real, substituir
        if (existente.is_contact_only && !thread.is_contact_only) {
          const idx = deduplicated.indexOf(existente);
          if (idx !== -1) {
            deduplicated[idx] = thread;
            vistos.set(contactId, thread);
          }
        }
        // Caso contrário, manter o existente (já é a thread real ou mais recente)
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ORDENAÇÃO (Regra 3):
    // 1. 🟢 Threads ativas (conversas com mensagens) - prioridade 1
    // 2. 🟡 Contatos sem thread - prioridade 2
    // 3. 🔵 Clientes sem contato - prioridade 3
    // Dentro de cada grupo: mais recente primeiro (last_message_at)
    // ═══════════════════════════════════════════════════════════════════════════
    return deduplicated.sort((a, b) => {
      // Definir prioridade do tipo
      const getPrioridade = (item) => {
        if (item.is_cliente_only) return 3; // Clientes sem contato
        if (item.is_contact_only) return 2; // Contatos sem thread
        return 1; // Threads ativas
      };

      const prioA = getPrioridade(a);
      const prioB = getPrioridade(b);

      // Ordenar por prioridade primeiro
      if (prioA !== prioB) return prioA - prioB;

      // Dentro do mesmo grupo: mais recente primeiro
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
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
        {/* Modal de Sem Permissão */}
        <ModalSemPermissaoConversa
          isOpen={modalSemPermissao.isOpen}
          onClose={() => setModalSemPermissao({ isOpen: false, contato: null, atendenteResponsavel: null, motivoBloqueio: null, threadOriginal: null })}
          contato={modalSemPermissao.contato}
          atendenteResponsavel={modalSemPermissao.atendenteResponsavel}
          motivoBloqueio={modalSemPermissao.motivoBloqueio}
          onIniciarNovaConversa={handleIniciarNovaConversaSemPermissao}
          podeIniciarNova={true}
        />
      </div>
    </ErrorBoundary>);

}