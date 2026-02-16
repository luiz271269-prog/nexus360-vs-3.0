import React from "react";
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
import ConfiguracaoCanaisComunicacao from "../components/comunicacao/ConfiguracaoCanaisComunicacao";
import DiagnosticoInbound from "../components/comunicacao/DiagnosticoInbound";
import SearchAndFilter from "../components/comunicacao/SearchAndFilter";
import EmptyState from "../components/comunicacao/EmptyState";
import WebhookInstructions from "../components/comunicacao/WebhookInstructions";
import ErrorBoundary from "../components/comunicacao/ErrorBoundary";
import NotificationSystem from "../components/comunicacao/NotificationSystem";
import ContadorNaoAtribuidas from "../components/comunicacao/ContadorNaoAtribuidas";
import ContatosRequerendoAtencao from "../components/comunicacao/ContatosRequerendoAtencao";
import { useDebounce } from "../components/lib/useDebounce";
import { normalizarTelefone } from "../components/lib/phoneUtils";
import {
  usuarioCorresponde,
  contatoFidelizadoAoUsuario } from
"../components/lib/userMatcher";
import { getUserDisplayName } from "../components/lib/userHelpers";
import * as permissionsService from "../components/lib/permissionsService";

// Funções específicas que ainda não foram migradas
import {
  temPermissaoIntegracao,
  threadConexaoVisivel,
  threadSetorVisivel,
  verificarBloqueioThread,
  podeInteragirNaThread } from
"../components/lib/threadVisibility";
import ModalSemPermissaoConversa from "../components/comunicacao/ModalSemPermissaoConversa";
import BibliotecaAutomacoes from "../components/automacao/BibliotecaAutomacoes";
import CentralControleOperacional from "../components/comunicacao/CentralControleOperacional";
import DiagnosticoCirurgicoEmbed from "../components/comunicacao/DiagnosticoCirurgicoEmbed";
import GerenciadorEtiquetasUnificado from "../components/comunicacao/GerenciadorEtiquetasUnificado";
import GoToConnectionSetup from "../components/comunicacao/GoToConnectionSetup";
import DiagnosticoThreadsInvisiveis from "../components/comunicacao/DiagnosticoThreadsInvisiveis";
import DiagnosticoComparativoThreads from "../components/comunicacao/DiagnosticoComparativoThreads";
import LogsFiltragemViewer from "../components/comunicacao/LogsFiltragemViewer";
import DiagnosticoMensagensInternas from "../components/comunicacao/DiagnosticoMensagensInternas";
import DiagnosticoVisibilidadeContato from "../components/comunicacao/DiagnosticoVisibilidadeContato";


import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { carregarTodasThreads, podeVerThreadInterna } from "../components/lib/internalThreadsService";


// 🔧 DEBUG_VIS: Forçar ativado para diagnóstico
const DEBUG_VIS = true;

export default function Comunicacao() {
  const { data: usuario, isLoading: isLoadingUsuario } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
    refetchOnWindowFocus: true,
    onError: (error) => {
      console.error("Erro ao carregar usuário:", error);
      toast.error(`Erro ao carregar usuário: ${error.message}`);
    }
  });

  // ✅ Carregar integrações PRIMEIRO (necessário para buildUserPermissions)
  const { data: todasIntegracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    onError: (error) => {
      console.error('[Comunicacao] Erro ao carregar integrações:', error);
    }
  });

  // ✅ NEXUS360: Construir permissões processadas
  const userPermissions = React.useMemo(() => {
    if (!usuario) return null;
    console.log('[NEXUS360] 🔧 Construindo permissões para:', usuario.email);
    return permissionsService.buildUserPermissions(usuario, todasIntegracoes);
  }, [usuario, todasIntegracoes]);

  const [threadAtiva, setThreadAtiva] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("conversas");
  const [showContactInfo, setShowContactInfo] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [contatoPreCarregado, setContatoPreCarregado] = React.useState(null); // ✅ Contato já processado da lista
  const [mostrarInstrucoesWebhook, setMostrarInstrucoesWebhook] = React.useState(false);

  // RESTAURADO: Estados para criar novo contato
  const [novoContatoTelefone, setNovoContatoTelefone] = React.useState("");
  const [criandoNovoContato, setCriandoNovoContato] = React.useState(false);

  // 🎯 NOVO: Estado para duplicata detectada pela busca
  const [duplicataEncontrada, setDuplicataEncontrada] = React.useState(null);

  // Estados para seleção múltipla (broadcast)
  const [modoSelecaoMultipla, setModoSelecaoMultipla] = React.useState(false);
  const [contatosSelecionados, setContatosSelecionados] = React.useState([]);
  const [mostrarSelecionados, setMostrarSelecionados] = React.useState(false);
  const [modoEnvioMassa, setModoEnvioMassa] = React.useState(false);
  const [contatosParaEnvioMassa, setContatosParaEnvioMassa] = React.useState([]);

  // Estados para broadcast interno
  const [broadcastInterno, setBroadcastInterno] = React.useState(null); // { destinations: [...] }
  const [isRateLimited, setIsRateLimited] = React.useState(false); // 🚫 Cool-down para 429

  const [filterScope, setFilterScope] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('filterScope') || 'all';
    }
    return 'all';
  });

  const [selectedAttendantId, setSelectedAttendantId] = React.useState(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = React.useState('all');
  const [selectedCategoria, setSelectedCategoria] = React.useState('all');
  const [selectedTipoContato, setSelectedTipoContato] = React.useState('all');
  const [selectedTagContato, setSelectedTagContato] = React.useState('all');

  // Persistir filterScope no localStorage
  React.useEffect(() => {
    localStorage.setItem('filterScope', filterScope);
  }, [filterScope]);

  // Estado para dados do cliente pré-preenchidos (quando clica em cliente_sem_contato)
  const [contactInitialData, setContactInitialData] = React.useState(null);

  // Estado para modal de sem permissão
  const [modalSemPermissao, setModalSemPermissao] = React.useState({
    isOpen: false,
    contato: null,
    atendenteResponsavel: null,
    motivoBloqueio: null,
    threadOriginal: null
  });



  // 🚀 OTIMIZAÇÃO DE PERFORMANCE (UI não trava na troca de filtro)
  const [isPendingFilter, startTransition] = React.useTransition();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (usuario && !localStorage.getItem('filterScope')) {
      const isManager = usuario.role === 'admin' || usuario.role === 'supervisor';
      setFilterScope(isManager ? 'all' : 'my');
    }
  }, [usuario]);

  // ✅ Detectar modo envio em massa via URL
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modo = urlParams.get('modo');
    
    if (modo === 'envio_massa') {
      const contatosSalvos = localStorage.getItem('envio_massa_contatos');
      if (contatosSalvos) {
        try {
          const contatos = JSON.parse(contatosSalvos);
          setContatosParaEnvioMassa(contatos);
          setModoEnvioMassa(true);
          setThreadAtiva(null); // Limpar thread ativa
          localStorage.removeItem('envio_massa_contatos');
          
          // Limpar URL
          window.history.replaceState({}, '', createPageUrl('Comunicacao'));
        } catch (error) {
          console.error('[Comunicacao] Erro ao carregar contatos do localStorage:', error);
        }
      }
    }
  }, []);

  // 🔔 REAL-TIME: Atualizar threads quando houver mudanças
  React.useEffect(() => {
    if (!usuario) return;

    console.log('[COMUNICACAO] 🔔 Ativando listener real-time para threads');

    // ✅ DEBOUNCE: Evitar invalidações excessivas que causam 429
    let debounceTimer = null;
    const invalidacoesPendentes = new Set();

    const unsubscribe = base44.entities.MessageThread.subscribe((event) => {
      console.log(`[COMUNICACAO] 🔔 Thread ${event.type}d:`, event.id);

      // Adicionar à fila de invalidações
      invalidacoesPendentes.add(event.id);

      // Limpar timer anterior
      if (debounceTimer) clearTimeout(debounceTimer);

      // Agendar invalidação em 2 segundos (agrupa múltiplos eventos)
      debounceTimer = setTimeout(() => {
        console.log(`[COMUNICACAO] ♻️ Invalidando ${invalidacoesPendentes.size} thread(s) agrupadas`);

        // ✅ FIX: Invalidar queries SEPARADAS (evita recarregar internas desnecessariamente)
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
        queryClient.invalidateQueries({ queryKey: ['threads-internas'] });

        // Se alguma thread ativa foi atualizada, recarregar mensagens
        if (threadAtiva?.id && invalidacoesPendentes.has(threadAtiva.id)) {
          queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] });
        }

        // Limpar fila
        invalidacoesPendentes.clear();
      }, 2000);
    });

    return () => {
      console.log('[COMUNICACAO] 🔕 Desativando listener real-time');
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [usuario, threadAtiva?.id, queryClient]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 BUSCA DE THREADS SEPARADAS - INTERNAS vs EXTERNAS (Evita 429)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ✅ THREADS INTERNAS: Ritmo lento, menos volume
  const { data: threadsInternas = [], isLoading: loadingThreadsInternas } = useQuery({
    queryKey: ['threads-internas', usuario?.id],
    queryFn: async () => {
      if (!usuario) return [];
      try {
        return await base44.entities.MessageThread.filter(
          { thread_type: { $in: ['team_internal', 'sector_group'] } },
          '-last_message_at',
          100
        );
      } catch (error) {
        console.error('[COMUNICACAO] ❌ Erro ao carregar threads internas:', error);
        return [];
      }
    },
    refetchInterval: 60000, // 60s - Internas são mais estáveis
    staleTime: 60000,
    enabled: !!usuario,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true
  });

  // ══════════════════════════════════════════════════════════════════════
  // ✅ THREADS EXTERNAS: Busca LIVRE (sem RLS)
  // Permissões aplicadas DEPOIS no frontend (canUserSeeThreadBase)
  // ══════════════════════════════════════════════════════════════════════
  const { data: threadsExternas = [], isLoading: loadingThreadsExternas } = useQuery({
    queryKey: ['threads-externas', usuario?.id],
    queryFn: async () => {
      if (isRateLimited || !usuario) return [];
      try {
        console.log('[COMUNICACAO] 🔍 Buscando threads LIVRES (sem filtro de integração/setor)...');
        
        // ✅ Busca GLOBAL via função backend (sem bloqueio de RLS)
        const response = await base44.functions.invoke('buscarThreadsLivre', {
          status: 'aberta',
          limit: 500, // ✅ Aumentado de 200 para 500 (mais threads = menos contatos "órfãos")
          incluirInternas: false
        });

        if (response?.data?.success) {
          console.log('[COMUNICACAO] ✅ Threads externas via busca livre:', response.data.threads.length);
          return response.data.threads || [];
        }

        // Fallback: busca com RLS
        console.warn('[COMUNICACAO] ⚠️ Fallback para busca com RLS');
        return await base44.entities.MessageThread.filter(
          { is_canonical: true, status: { $ne: 'merged' } },
          '-last_message_at',
          500
        );
      } catch (error) {
        if (error?.message?.includes('429') || error?.response?.status === 429) {
          console.warn('[COMUNICACAO] ⚠️ 429 em threads externas! Cool-down de 60s...');
          setIsRateLimited(true);
          setTimeout(() => {
            setIsRateLimited(false);
            console.log('[COMUNICACAO] ✅ Cool-down finalizado');
          }, 60000);
          return [];
        }
        throw error;
      }
    },
    refetchInterval: 90000,
    staleTime: 30000,
    enabled: !!usuario && !isRateLimited,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    onError: (error) => {
      console.error('[COMUNICACAO] Erro ao carregar threads externas:', error);
    }
  });

  // ✅ Buscar análises comportamentais
  const { data: analisesComportamentais = [] } = useQuery({
    queryKey: ['analises-comportamentais'],
    queryFn: async () => {
      try {
        // Buscar todas as análises recentes (últimas 24h)
        const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return await base44.entities.ContactBehaviorAnalysis.filter(
          { analyzed_at: { $gte: dataLimite } },
          '-analyzed_at',
          500
        );
      } catch (error) {
        console.error('[COMUNICACAO] Erro ao carregar análises:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!usuario
  });

  // ✅ COMBINAR: Internas + Externas + Enriquecer com análises
  const threads = React.useMemo(() => {
    const combinadas = [...threadsExternas, ...threadsInternas];
    
    // Criar mapa de análises por contact_id
    const analisesPorContato = new Map();
    analisesComportamentais.forEach(analise => {
      if (!analisesPorContato.has(analise.contact_id)) {
        analisesPorContato.set(analise.contact_id, analise);
      }
    });
    
    // Enriquecer threads com análises
    const enriquecidas = combinadas.map(thread => {
      if (thread.contact_id) {
        const analise = analisesPorContato.get(thread.contact_id);
        if (analise) {
          return { ...thread, _analiseComportamental: analise };
        }
      }
      return thread;
    });
    
    console.log('[COMUNICACAO] 📊 Threads combinadas + análises:', {
      externas: threadsExternas.length,
      internas: threadsInternas.length,
      total: enriquecidas.length,
      com_analise: enriquecidas.filter(t => t._analiseComportamental).length
    });
    
    return enriquecidas;
  }, [threadsExternas, threadsInternas, analisesComportamentais]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔄 AUTO-ENRIQUECIMENTO DE CONTATOS VAZIOS (em background)
  // ═══════════════════════════════════════════════════════════════════════════════
  React.useEffect(() => {
    if (!contatos || contatos.length === 0 || !integracoes || integracoes.length === 0) return;

    // Detectar contatos vazios (score 0)
    const contatosVazios = contatos.filter(c => {
      const nome = (c.nome || '').trim();
      const telefone = (c.telefone || '').replace(/\D/g, '');
      return (
        (!nome || nome === c.telefone || nome === '+' + telefone) &&
        !c.empresa &&
        !c.cargo
      );
    }).slice(0, 10); // Max 10 por vez

    if (contatosVazios.length === 0) return;

    const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
    if (!integracaoAtiva) return;

    console.log(`[COMUNICACAO] 🔍 Auto-enriquecendo ${contatosVazios.length} contatos vazios em background...`);

    // Enriquecer em background (não bloquear UI)
    setTimeout(async () => {
      try {
        await base44.functions.invoke('enriquecerContatosEmLote', {
          contact_ids: contatosVazios.map(c => c.id),
          integration_id: integracaoAtiva.id
        });

        console.log('[COMUNICACAO] ✅ Enriquecimento concluído - atualizando listas...');
        
        // Invalidar cache para atualizar UI
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['contacts-search'] });
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      } catch (error) {
        console.warn('[COMUNICACAO] ⚠️ Erro ao enriquecer em lote:', error.message);
      }
    }, 2000); // 2s delay para não interferir com carregamento inicial
  }, [contatos.length, integracoes.length]); // Trigger quando listas mudam

  const loadingThreads = loadingThreadsInternas || loadingThreadsExternas;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 EXTRAÇÃO DE IDs DE CONTATO - Hidratação Sob Demanda
  // ═══════════════════════════════════════════════════════════════════════════════
  const contactIdsParaCarregar = React.useMemo(() => {
    if (!threads.length) return [];
    const ids = threads.map((t) => t.contact_id).filter((id) => id);
    console.log('[COMUNICACAO] 🎯 IDs de contato para hidratar:', ids.length);
    return [...new Set(ids)]; // Remove duplicatas
  }, [threads]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 BUSCA LIVRE DE CONTATOS - Hidratação sem bloqueio de RLS
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: contatos = [], isLoading: loadingContatos } = useQuery({
    queryKey: ['contacts', contactIdsParaCarregar],
    queryFn: async () => {
      if (contactIdsParaCarregar.length === 0) return [];

      console.log(`[COMUNICACAO] 📎 Hidratando ${contactIdsParaCarregar.length} contatos (busca livre)...`);

      try {
        // ✅ Busca livre via backend (sem RLS - retorna TODOS os contatos)
        const response = await base44.functions.invoke('buscarContatosLivre', {
          searchTerm: null,
          limit: 1000
        });

        if (response?.data?.success) {
          const todosContatos = response.data.contatos || [];
          const idsSet = new Set(contactIdsParaCarregar);
          const contatosNecessarios = todosContatos.filter((c) => idsSet.has(c.id));
          
          // 🔍 LOG CIRÚRGICO: Hidratação
          console.log(`[COMUNICACAO] 📊 HIDRATAÇÃO - User: ${usuario.email}`, {
            recebidos_backend: todosContatos.length,
            necessarios: contatosNecessarios.length,
            solicitados: contactIdsParaCarregar.length,
            user_id_backend: response.data.user_id
          });
          
          return contatosNecessarios;
        }

        // Fallback: busca com RLS
        console.warn('[COMUNICACAO] ⚠️ Fallback para busca com RLS (contatos)');
        const todosContatos = await base44.entities.Contact.list('-last_interaction', 1000);
        const idsSet = new Set(contactIdsParaCarregar);
        return todosContatos.filter((c) => idsSet.has(c.id));
      } catch (error) {
        console.error('[COMUNICACAO] ❌ Erro ao hidratar contatos:', error);
        return [];
      }
    },
    enabled: contactIdsParaCarregar.length > 0,
    keepPreviousData: true,
    staleTime: 60000,
    cacheTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('[Comunicacao] Erro ao carregar contatos:', error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 BUSCA LIVRE NO BANCO - Quando há termo de busca (sem bloqueio de integração)
  // ═══════════════════════════════════════════════════════════════════════════════
  const { data: contatosBuscados = [] } = useQuery({
    queryKey: ['contacts-search', debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.trim().length < 2) return [];

      console.log(`[COMUNICACAO] 🔍 Buscando contatos (LIVRE): "${debouncedSearchTerm}"...`);

      try {
        // ✅ Busca livre via backend (SEM bloqueio de RLS/integração)
        const response = await base44.functions.invoke('buscarContatosLivre', {
          searchTerm: debouncedSearchTerm,
          limit: 500
        });

        let todosBD = [];
        if (response?.data?.success) {
          todosBD = response.data.contatos || [];
          
          // 🔍 LOG CIRÚRGICO: Busca por texto
          console.log(`[COMUNICACAO] 📊 BUSCA LIVRE - User: ${usuario.email}`, {
            termo: debouncedSearchTerm,
            recebidos_backend: todosBD.length,
            user_id_backend: response.data.user_id,
            tem_luiz: todosBD.some(c => c.nome?.toLowerCase().includes('luiz')),
            primeiros_3: todosBD.slice(0, 3).map(c => ({ 
              nome: c.nome, 
              telefone: c.telefone 
            }))
          });
        } else {
          // Fallback: busca com RLS
          console.warn('[COMUNICACAO] ⚠️ Fallback para busca com RLS (busca de contatos)');
          todosBD = await base44.entities.Contact.list('-created_date', 500);
        }

        // ✅ Função de similaridade para fuzzy matching
        const calcularSimilaridade = (str1, str2) => {
          const s1 = str1.toLowerCase().trim();
          const s2 = str2.toLowerCase().trim();

          if (s1 === s2) return 1.0; // Match exato
          if (s1.includes(s2) || s2.includes(s1)) return 0.8; // Contém

          // Verifica se começa com o termo
          if (s1.startsWith(s2) || s2.startsWith(s1)) return 0.7;

          // Verifica a quantidade de caracteres em comum (semelhança parcial)
          let matches = 0;
          for (let char of s2) {
            if (s1.includes(char)) matches++;
          }
          return matches / s2.length * 0.5;
        };

        const term = debouncedSearchTerm.toLowerCase().trim();

        // ✅ BUSCA COM SEMELHANÇA - filtra e ordena por relevância
        const resultados = todosBD.
        map((c) => {
          let score = 0;

          // Nome - peso 5
          const nomeSimilaridade = calcularSimilaridade(c.nome || '', term);
          score += nomeSimilaridade * 5;

          // Empresa - peso 3
          const empresaSimilaridade = calcularSimilaridade(c.empresa || '', term);
          score += empresaSimilaridade * 3;

          // Cargo - peso 2
          const cargoSimilaridade = calcularSimilaridade(c.cargo || '', term);
          score += cargoSimilaridade * 2;

          // Descrição/Observações - peso 1
          const obsSimilaridade = calcularSimilaridade(c.observacoes || '', term);
          score += obsSimilaridade * 1;

          // Telefone - peso 3 (semelhança parcial por dígitos)
          const telNorm = (c.telefone || '').replace(/\D/g, '');
          const termDigitos = term.replace(/\D/g, '');
          let telScore = 0;
          if (termDigitos.length >= 3 && telNorm.includes(termDigitos)) {
            telScore = 0.8; // Contém a sequência de dígitos
          } else if (termDigitos.length > 0 && telNorm.length > 0) {
            // Busca parcial por dígitos
            let matches = 0;
            for (let digit of termDigitos) {
              if (telNorm.includes(digit)) matches++;
            }
            telScore = matches / termDigitos.length * 0.6;
          }
          score += telScore * 3;

          return { contato: c, score };
        }).
        filter((item) => item.score > 0.3) // Mínimo de relevância (30%)
        .sort((a, b) => b.score - a.score) // Ordenar por relevância (maior score primeiro)
        .map((item) => item.contato).
        slice(0, 100); // Limite de 100 resultados

        // 🔍 LOG CIRÚRGICO: Após filtro local (frontend)
        console.log(`[COMUNICACAO] 📊 APÓS FILTRO FRONTEND - User: ${usuario.email}`, {
          termo: debouncedSearchTerm,
          antes_filtro: todosBD.length,
          depois_filtro: resultados.length,
          tem_luiz_antes: todosBD.some(c => c.nome?.toLowerCase().includes('luiz')),
          tem_luiz_depois: resultados.some(c => c.nome?.toLowerCase().includes('luiz')),
          primeiros_3_filtrados: resultados.slice(0, 3).map(c => ({ 
            nome: c.nome, 
            score: c.score 
          }))
        });
        
        return resultados;
      } catch (error) {
        console.error('[COMUNICACAO] ❌ Erro na busca:', error);
        return [];
      }
    },
    staleTime: 30000,
    retry: 1
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date', 200),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 1,
    // ✅ NÃO depende de usuário - começa IMEDIATAMENTE
    refetchOnWindowFocus: false
  });



  const loadingTopics = loadingThreads || isLoadingUsuario;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 BUSCA DE MENSAGENS - BRANCH EXPLÍCITO (Internas vs Externas)
  // ═══════════════════════════════════════════════════════════════════════════════
  const isThreadInterna = threadAtiva?.thread_type === 'team_internal' || threadAtiva?.thread_type === 'sector_group';

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', threadAtiva?.id],
    queryFn: async () => {
      if (!threadAtiva || isRateLimited) return [];

      try {
        // ✅ BRANCH INTERNO: Busca simples, SEM merge
        if (isThreadInterna) {
          console.log('[COMUNICACAO] 🔵 Thread interna - busca direta (SEM merge)');
          const ultimasMensagens = await base44.entities.Message.filter(
            { thread_id: threadAtiva.id },
            '-sent_at',
            500
          );
          console.log(`[COMUNICACAO] 📩 ${ultimasMensagens.length} mensagens internas carregadas`);
          return ultimasMensagens.reverse();
        }

        // ✅ BRANCH EXTERNO: Buscar histórico consolidado (thread atual + merged + MESMO CONTATO)
        let threadIdsParaBuscar = [threadAtiva.id];

        try {
          // Buscar threads merged OFICIALMENTE
          const threadsMerged = await base44.entities.MessageThread.filter(
            {
              merged_into: threadAtiva.id,
              status: 'merged'
            },
            '-created_date',
            20
          );

          if (threadsMerged && threadsMerged.length > 0) {
            console.log(`[COMUNICACAO] 🔀 Encontradas ${threadsMerged.length} threads merged oficialmente`);
            threadIdsParaBuscar.push(...threadsMerged.map((t) => t.id));
          }

          // 🆕 BUSCAR TODAS AS THREADS DO MESMO CONTATO (unificação inteligente)
          if (threadAtiva.contact_id) {
            const todasThreadsDoContato = await base44.entities.MessageThread.filter(
              {
                contact_id: threadAtiva.contact_id,
                status: { $in: ['aberta', 'fechada'] }
              },
              '-created_date',
              50
            );

            if (todasThreadsDoContato && todasThreadsDoContato.length > 1) {
              console.log(`[COMUNICACAO] 🔗 Encontradas ${todasThreadsDoContato.length} threads do mesmo contato - UNIFICANDO histórico`);
              const idsAdicionais = todasThreadsDoContato.map((t) => t.id).filter((id) => !threadIdsParaBuscar.includes(id));
              threadIdsParaBuscar.push(...idsAdicionais);
            }
          }
        } catch (mergedErr) {
          console.warn('[COMUNICACAO] ⚠️ Erro ao buscar threads para unificação:', mergedErr.message);
        }

        console.log(`[COMUNICACAO] 📦 Buscando mensagens de ${threadIdsParaBuscar.length} thread(s) para histórico unificado`);

        // ✅ QUERY: Todas as mensagens (thread atual + merged + mesmo contato)
        const ultimasMensagens = await base44.entities.Message.filter(
          { thread_id: { $in: threadIdsParaBuscar } },
          '-sent_at',
          200 // ✅ OTIMIZAÇÃO: 500 → 200 (60% menos dados iniciais)
        );

        // 🔍 QUERY 2 (DIAGNÓSTICO): APENAS mensagens RECEBIDAS do contato (últimas 50)
        let mensagensRecebidas = [];
        try {
          mensagensRecebidas = await base44.entities.Message.filter(
            {
              thread_id: threadAtiva.id,
              sender_type: 'contact'
            },
            '-sent_at',
            50
          );
        } catch (recebidaErr) {
          console.error('[COMUNICACAO] ❌ Erro ao buscar mensagens recebidas:', recebidaErr.message);
        }

        if (DEBUG_VIS) {
          console.log(`[COMUNICACAO] 📩 TOTAL Mensagens: ${ultimasMensagens.length} | Thread: ${threadAtiva.id}`);
          console.log(`[COMUNICACAO] 📬 Mensagens RECEBIDAS (contact): ${mensagensRecebidas.length}`);

          const porTipo = ultimasMensagens.reduce((acc, m) => {
            acc[m.sender_type] = (acc[m.sender_type] || 0) + 1;
            return acc;
          }, {});
          console.log('[COMUNICACAO] 📊 Breakdown por sender_type:', porTipo);

          console.group('[COMUNICACAO] 🔍 AUDIT: Todas as mensagens (sender_type + visibility)');
          ultimasMensagens.slice(0, 20).forEach((m) => {
            console.log(`  ${m.id.substring(0, 8)}: sender_type=${m.sender_type} | visibility=${m.visibility} | content="${m.content.substring(0, 40)}"`);
          });
          console.groupEnd();

          if (mensagensRecebidas.length > 0) {
            console.log('[COMUNICACAO] ✅ Amostra RECEBIDAS:', mensagensRecebidas.slice(0, 3).map((m) => ({
              id: m.id.substring(0, 8),
              content: m.content.substring(0, 40),
              sender_id: m.sender_id.substring(0, 8),
              sender_type: m.sender_type,
              visibility: m.visibility,
              sent_at: m.sent_at
            })));
          } else {
            console.warn('[COMUNICACAO] ⚠️ NENHUMA mensagem recebida (sender_type=contact) encontrada no banco!');
            console.warn('[COMUNICACAO] ⚠️ Suspeita: RLS rule bloqueando sender_type=contact ou problema no webhook');
          }
        }

        return ultimasMensagens.reverse();
      } catch (error) {
        // 🚫 DETECTAR 429 E ATIVAR COOL-DOWN
        if (error?.message?.includes('429') || error?.response?.status === 429) {
          console.warn('[COMUNICACAO] ⚠️ 429 em mensagens! Ativando cool-down...');
          setIsRateLimited(true);
          setTimeout(() => setIsRateLimited(false), 10000);
          return [];
        }
        throw error;
      }
    },
    enabled: !!threadAtiva && !isRateLimited,
    refetchInterval: isThreadInterna ? 30000 : 20000, // Internas: 30s | Externas: 20s
    staleTime: 10000,
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: true,
    onError: (error) => {
      console.error('[Comunicacao] Erro ao carregar mensagens:', error);
    }
  });

  const { data: gotoIntegracoes = [] } = useQuery({
    queryKey: ['goto-integrations'],
    queryFn: () => base44.entities.GoToIntegration.list(),
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    // ✅ NÃO depende de usuário - começa IMEDIATAMENTE
    onError: (error) => {
      console.error('[Comunicacao] Erro ao carregar GoTo:', error);
    }
  });

  // ✅ CIRÚRGICA P1: Filtrar integrações por whatsapp_permissions + permissoes_visualizacao
  const integracoes = React.useMemo(() => {
    if (!usuario || !todasIntegracoes.length) return [];
    if (usuario.role === 'admin') return todasIntegracoes;

    const whatsappPerms = usuario.whatsapp_permissions || [];
    const perms = usuario.permissoes_visualizacao || {};
    const integracoesVisiveis = perms.integracoes_visiveis || [];

    // Normalizar função
    const normalizar = (v) => v ? String(v).trim().toLowerCase() : '';

    // Filtrar por whatsapp_permissions (can_view: true)
    const integracoesComPermissao = whatsappPerms.
    filter((wp) => wp.can_view === true).
    map((wp) => wp.integration_id);

    // Se há permissões WhatsApp configuradas, usar APENAS essas
    if (integracoesComPermissao.length > 0) {
      const permNorm = new Set(integracoesComPermissao.map(normalizar));
      return todasIntegracoes.filter((i) => permNorm.has(normalizar(i.id)));
    }

    // Fallback: permissoes_visualizacao.integracoes_visiveis
    if (integracoesVisiveis.length === 0) return todasIntegracoes;

    const visiveisNorm = new Set(integracoesVisiveis.map(normalizar));
    return todasIntegracoes.filter((i) => visiveisNorm.has(normalizar(i.id)));
  }, [todasIntegracoes, usuario?.id, usuario?.role, usuario?.whatsapp_permissions, usuario?.permissoes_visualizacao]);

  // ✅ FONTE ÚNICA: Buscar atendentes via função (igual em TODAS as telas)
  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: async () => {
      const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
      if (resultado?.data?.success && resultado?.data?.usuarios) {
        return resultado.data.usuarios;
      }
      return [];
    },
    // ✅ Começa IMEDIATAMENTE (função não precisa de usuário)
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000)
  });

  const { data: mensagensComCategoria = [] } = useQuery({
    queryKey: ['mensagens-com-categoria', selectedCategoria],
    queryFn: async () => {
      if (!selectedCategoria || selectedCategoria === 'all') return [];

      const todasMensagens = await base44.entities.Message.list('-created_date', 200);
      return todasMensagens.filter((m) =>
      Array.isArray(m.categorias) && m.categorias.includes(selectedCategoria)
      );
    },
    enabled: !!selectedCategoria && selectedCategoria !== 'all',
    staleTime: 10 * 60 * 1000,
    cacheTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: 2000,
    refetchOnWindowFocus: false,
    onError: (error) => {
      console.error('[Comunicacao] Erro ao filtrar por categoria:', error);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 HANDLER DE SELEÇÃO DE THREAD/CONTATO/CLIENTE
  // ═══════════════════════════════════════════════════════════════════════════════
  const handleSelecionarThread = React.useCallback(async (threadData) => {
    // ✅ Aceita { id, contatoPreCarregado } ou thread direta
    const thread = threadData.id ? { id: threadData.id } : threadData;
    const contatoPre = threadData.contatoPreCarregado || null;
    
    console.log('🖱️ [Comunicacao] Selecionando:', thread.id, contatoPre ? '(com contato pré-carregado)' : '');
    
    setCriandoNovoContato(false);
    setNovoContatoTelefone("");
    setShowContactInfo(false);
    setContactInitialData(null);
    setContatoPreCarregado(contatoPre);

    // ✅ CRÍTICO: Não buscar do banco se ID for sintético
    const isSyntheticId = thread.id && (
      thread.id.startsWith('contato-sem-thread-') || 
      thread.id.startsWith('cliente-sem-contato-')
    );

    // ✅ Buscar thread completa apenas se for ID real
    let threadCompleta = thread;
    if (thread.id && !thread.contact_id && !thread.thread_type && !isSyntheticId) {
      const threadsEncontradas = threads.find(t => t.id === thread.id);
      if (threadsEncontradas) {
        threadCompleta = threadsEncontradas;
      } else {
        // Buscar do banco apenas para IDs reais
        const res = await base44.entities.MessageThread.filter({ id: thread.id }, '-created_date', 1);
        if (res?.length > 0) {
          threadCompleta = res[0];
        }
      }
    }

    // ✅ CASO 0: USUÁRIO INTERNO - Abrir direto sem validações de WhatsApp
    if (threadCompleta.thread_type === 'team_internal' || threadCompleta.thread_type === 'sector_group') {
      setThreadAtiva(threadCompleta);
      return;
    }

    // 🔧 AUTO-REDIRECIONAR: Se thread é merged, buscar canônica
    if (thread.status === 'merged' && thread.merged_into) {
      console.log(`[Comunicacao] 🔀 Auto-redirecionar: ${thread.id} → ${thread.merged_into}`);
      const threadCanonica = threads.find((t) => t.id === thread.merged_into);
      if (threadCanonica) {
        console.log('[Comunicacao] ✅ Canônica encontrada, abrindo...');
        return handleSelecionarThread(threadCanonica);
      } else {
        console.warn('[Comunicacao] ⚠️ Canônica não encontrada no array, tentando buscar...');
        try {
          const res = await base44.entities.MessageThread.filter({ id: thread.merged_into }, '-created_date', 1);
          if (res?.length > 0) {
            return handleSelecionarThread(res[0]);
          }
        } catch (e) {
          console.error('[Comunicacao] ❌ Erro ao buscar canônica:', e?.message);
        }
      }
    }

    // CASO 1: CLIENTE SEM CONTATO - Abrir criação pré-preenchida
    if (thread.is_cliente_only && thread.cliente_id) {
      const cliente = clientes.find((c) => c.id === thread.cliente_id);
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

    // CASO 2: CONTATO SEM THREAD - Buscar thread CANÔNICA
    if (thread.is_contact_only && thread.contact_id) {
      try {
        // ✅ BUSCAR THREAD CANÔNICA: contact_id + integração ativa
        const integracaoAtiva = integracoes.find((i) => i.status === 'conectado');
        if (!integracaoAtiva) {
          toast.error('❌ Nenhuma integração WhatsApp ativa');
          return;
        }

        const threadsExistentes = await base44.entities.MessageThread.filter(
          {
            contact_id: thread.contact_id,
            whatsapp_integration_id: integracaoAtiva.id,
            is_canonical: true,
            status: 'aberta'
          },
          '-last_message_at',
          1
        );

        if (threadsExistentes && threadsExistentes.length > 0) {
          // Verificar permissão antes de abrir (EXCETO fidelizados)
          const contatoObj = contatos.find((c) => c.id === thread.contact_id);

          // ✅ FIDELIZADO: SEMPRE pode abrir (ignora TODAS as restrições)
          const isFidelizadoAoUsuario = contatoFidelizadoAoUsuario(contatoObj, usuario);
          if (isFidelizadoAoUsuario) {
            console.log('[Comunicacao] ✅ Contato fidelizado - abrindo thread canônica');
            setThreadAtiva(threadsExistentes[0]);
            return;
          }

          const bloqueio = verificarBloqueioThread(usuario, threadsExistentes[0], contatoObj);

          if (bloqueio.bloqueado) {
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

        const novaThread = await base44.entities.MessageThread.create({
          contact_id: thread.contact_id,
          whatsapp_integration_id: integracaoAtiva.id,
          conexao_id: integracaoAtiva.id, // Compatibilidade
          is_canonical: true, // CRÍTICO
          status: 'aberta',
          unread_count: 0,
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          assigned_user_id: usuario.id,
          primeira_mensagem_at: new Date().toISOString()
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

    // CASO 3: THREAD NORMAL - Redirecionar para canônica se houver mais antigas
    const contatoObj = contatos.find((c) => c.id === thread.contact_id);

    // ✅ FIDELIZADO: SEMPRE pode abrir (ignora TODAS as restrições de setor/integração)
    const isFidelizadoAoUsuario = contatoFidelizadoAoUsuario(contatoObj, usuario);
    if (isFidelizadoAoUsuario) {
      console.log('[Comunicacao] ✅ Contato fidelizado - abrindo direto');
      setThreadAtiva(thread);
      return;
    }

    // 🔧 AUTO-REDIRECIONAR para thread canônica se a atual for não-canônica
    if (thread.status === 'merged' && thread.merged_into) {
      console.log(`[Comunicacao] 🔀 Auto-redirecionando thread merged ${thread.id} → ${thread.merged_into}`);
      const threadCanonica = threads.find((t) => t.id === thread.merged_into);
      if (threadCanonica) {
        setThreadAtiva(threadCanonica);
        return;
      }
    }

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

    setThreadAtiva(threadCompleta);
  }, [integracoes, queryClient, clientes, contatos, usuario, threads]);

  // Handler para iniciar nova conversa quando não tem permissão na existente
  const handleIniciarNovaConversaSemPermissao = React.useCallback(async () => {
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

      // Criar nova thread canônica atribuída ao usuário atual
      const novaThread = await base44.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoAtiva.id,
        conexao_id: integracaoAtiva.id, // Compatibilidade
        is_canonical: true, // CRÍTICO
        status: 'aberta',
        unread_count: 0,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true,
        assigned_user_id: usuario.id,
        primeira_mensagem_at: new Date().toISOString()
      });

      await queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      setThreadAtiva(novaThread);
      setModalSemPermissao({ isOpen: false, contato: null, atendenteResponsavel: null, motivoBloqueio: null, threadOriginal: null });
      toast.success('✅ Nova conversa iniciada!');
    } catch (error) {
      console.error('[Comunicacao] Erro ao criar nova thread:', error);
      toast.error('Erro ao iniciar conversa');
    }
  }, [modalSemPermissao, integracoes, usuario, queryClient]);

  // RESTAURADO: Handler para criar novo contato
  const handleCriarNovoContato = React.useCallback(async (dadosContato) => {
    try {
      console.log('[Comunicacao] 🆕 Criando novo contato:', dadosContato);

      const telefoneNormalizado = normalizarTelefone(dadosContato.telefone);
      if (!telefoneNormalizado) {
        toast.error('❌ Telefone inválido');
        return;
      }

      toast.info('🔄 Criando contato...');

      // ✅ Criar contato via função centralizada (ÚNICO ponto de entrada)
      const resultadoContato = await base44.functions.invoke('getOrCreateContactCentralized', {
        telefone: telefoneNormalizado,
        pushName: dadosContato.nome || null,
        profilePicUrl: null
      });

      if (!resultadoContato?.data?.success || !resultadoContato?.data?.contact) {
        throw new Error(resultadoContato?.data?.error || 'Falha ao criar contato');
      }

      const novoContato = resultadoContato.data.contact;
      console.log('[Comunicacao] ✅ Contato garantido:', novoContato.id);

      // Atualizar campos adicionais do formulário
      await base44.entities.Contact.update(novoContato.id, {
        empresa: dadosContato.empresa || null,
        cargo: dadosContato.cargo || null,
        email: dadosContato.email || null,
        vendedor_responsavel: dadosContato.vendedor_responsavel || null,
        ramo_atividade: dadosContato.ramo_atividade || null,
        tipo_contato: dadosContato.tipo_contato || 'novo',
        cliente_id: dadosContato.cliente_id || null
      });

      // ✅ CIRÚRGICA P4: Validar can_send ANTES de criar thread
      const integracaoAtiva = integracoes.find((i) => {
        if (i.status !== 'conectado') return false;

        // Admin pode usar qualquer integração ativa
        if (usuario.role === 'admin') return true;

        // ✅ CRÍTICO: Verificar can_view E can_send
        const whatsappPerms = usuario.whatsapp_permissions || [];

        // Sem restrições configuradas = libera (compatibilidade)
        if (whatsappPerms.length === 0) return true;

        // Buscar permissão específica para esta integração
        const perm = whatsappPerms.find((p) => p.integration_id === i.id);

        // ✅ AMBAS as permissões devem ser true
        if (!perm) return false;
        return perm.can_view === true && perm.can_send === true;
      });

      if (!integracaoAtiva) {
        // Contato foi criado mas não há integração permitida
        toast.warning('⚠️ Contato criado, mas você não tem acesso a nenhuma integração WhatsApp ativa');
        toast.info('💡 Peça a um colega para iniciar a conversa');

        await queryClient.invalidateQueries({ queryKey: ['contacts'] });
        setCriandoNovoContato(false);
        setNovoContatoTelefone("");
        setShowContactInfo(false);
        setContactInitialData(null);
        return;
      }

      toast.info('🔄 Criando conversa...');

      // ✅ Thread SEMPRE canônica e atribuída ao criador (garante acesso total)
      const novaThread = await base44.entities.MessageThread.create({
        contact_id: novoContato.id,
        whatsapp_integration_id: integracaoAtiva.id,
        conexao_id: integracaoAtiva.id, // Compatibilidade
        is_canonical: true, // CRÍTICO: marcar como canônica
        status: 'aberta',
        unread_count: 0,
        total_mensagens: 0,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true,
        assigned_user_id: usuario.id, // ✅ CRIADOR é o dono
        primeira_mensagem_at: new Date().toISOString(),
        last_message_at: new Date().toISOString()
      });

      console.log('[Comunicacao] ✅ Thread criada e atribuída ao criador:', novaThread.id);

      // ✅ Aguardar queries atualizarem (apenas externas, pois nova thread é WhatsApp)
      await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contacts'] }),
      queryClient.invalidateQueries({ queryKey: ['threads-externas'] })]
      );

      // ✅ Aguardar queries serem reexecutadas antes de abrir thread
      await new Promise((r) => setTimeout(r, 500));

      // ✅ Fechar painel e abrir thread diretamente
      setCriandoNovoContato(false);
      setNovoContatoTelefone("");
      setShowContactInfo(false);
      setContactInitialData(null);
      setThreadAtiva(novaThread);

      toast.success('✅ Contato criado! Já pode conversar.');

    } catch (error) {
      console.error('[Comunicacao] Erro ao criar contato:', error);
      toast.error(`Erro ao criar contato: ${error.message}`);
    }
  }, [integracoes, queryClient, usuario]);

  // Handler para atualizar informações do contato (silencioso para auto-save)
  const handleAtualizarContato = React.useCallback(async (dadosAtualizados) => {
    try {
      console.log('[Comunicacao] 🔄 Invalidando cache após edição de contato...');

      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['threads-externas'] });

      if (threadAtiva) {
        const threadAtualizada = await base44.entities.MessageThread.filter({ id: threadAtiva.id });
        if (threadAtualizada && threadAtualizada.length > 0) {
          setThreadAtiva(threadAtualizada[0]);
        }
      }

      // ✅ Sem toast para não poluir UI em auto-save (já tem indicador "Salvando...")
    } catch (error) {
      console.error('[Comunicacao] Erro ao atualizar:', error);
      toast.error('Erro ao atualizar informações');
    }
  }, [threadAtiva, queryClient]);

  // Handler para seleção de destinatários internos
  const handleInternalSelection = React.useCallback((selectionData) => {
    console.log('🔵 [Comunicacao] Seleção interna:', selectionData);

    if (selectionData.mode === 'single') {
      // Abrir thread única na ChatWindow
      setThreadAtiva(selectionData.thread);
      setBroadcastInterno(null);
      setModoSelecaoMultipla(false);
      setContatosSelecionados([]);
      queryClient.invalidateQueries({ queryKey: ['threads'] });
    } else if (selectionData.mode === 'broadcast') {
      // Ativar modo broadcast interno
      setBroadcastInterno(selectionData);
      setModoSelecaoMultipla(true);
      setThreadAtiva(null);
      setContatosSelecionados([]);
    }
  }, [queryClient]);

  // Handler para atualizar mensagens após envio
  const handleAtualizarMensagens = React.useCallback(async (novasMensagens) => {
    if (novasMensagens) {
      queryClient.setQueryData(['mensagens', threadAtiva?.id], novasMensagens);
    } else {
      queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva?.id] });
    }
    // ✅ FIX: Invalidar apenas a query relevante (interna ou externa)
    const isInterna = threadAtiva?.thread_type === 'team_internal' || threadAtiva?.thread_type === 'sector_group';
    queryClient.invalidateQueries({ queryKey: [isInterna ? 'threads-internas' : 'threads-externas'] });
  }, [threadAtiva, queryClient]);

  // 🚀 OPTIMISTIC UI: Envio instantâneo de mensagens INTERNAS
  const handleEnviarMensagemInternaOtimista = React.useCallback(async (dadosEnvio) => {
    if (!threadAtiva || !usuario) return;

    const { texto, pastedImage, attachedFile, attachedFileType, replyToMessage, audioBlob } = dadosEnvio;

    let mediaUrlFinal = null;
    let mediaTypeFinal = 'none';
    let mediaCaptionFinal = null;

    // ✅ FIX DUPLICAÇÃO: Gerar ID temporário UMA VEZ (fora do try/catch)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // ✅ UPLOAD DE MÍDIA ANTES (igual WhatsApp externo)
      if (audioBlob) {
        const timestamp = Date.now();
        const audioFile = new File([audioBlob], `audio-internal-${timestamp}.ogg`, {
          type: 'audio/ogg; codecs=opus',
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: audioFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = 'audio';
      } else
      if (pastedImage) {
        const timestamp = Date.now();
        let mimeType = pastedImage.type || 'image/png';
        if (!mimeType.startsWith('image/')) mimeType = 'image/png';
        const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';

        const imageFile = new File([pastedImage], `internal-${timestamp}.${ext}`, {
          type: mimeType,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = 'image';
        mediaCaptionFinal = texto?.trim() || null;
      } else
      if (attachedFile) {
        const timestamp = Date.now();
        const ext = attachedFile.name.split('.').pop() || 'file';
        const uploadFile = new File([attachedFile], `internal-${timestamp}.${ext}`, {
          type: attachedFile.type,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
        mediaUrlFinal = uploadResponse.file_url;
        mediaTypeFinal = attachedFileType;
        mediaCaptionFinal = texto?.trim() || null;
      }

      // Validação
      if (!texto?.trim() && !mediaUrlFinal) {
        toast.error('Digite uma mensagem ou anexe uma mídia');
        return;
      }

      const contentFinal = texto?.trim() || (mediaUrlFinal ? `[${mediaTypeFinal}]` : '');

      // 1. Criar mensagem temporária (aparece INSTANTANEAMENTE)
      const msgTemp = {
        id: tempId, // ✅ FIX: Usar ID gerado fora do try
        thread_id: threadAtiva.id,
        sender_id: usuario.id,
        sender_type: "user",
        content: contentFinal,
        channel: "interno",
        status: "enviando",
        sent_at: new Date().toISOString(),
        media_url: mediaUrlFinal,
        media_type: mediaTypeFinal,
        media_caption: mediaCaptionFinal,
        reply_to_message_id: replyToMessage?.id || null,
        metadata: {
          optimistic: true,
          user_name: usuario.full_name
        }
      };

      // 2. Atualizar cache INSTANTANEAMENTE
      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return [...antigas, msgTemp];
      });

      // 3. Enviar para servidor em background
      const payload = {
        thread_id: threadAtiva.id,
        content: contentFinal,
        media_type: mediaTypeFinal,
        media_url: mediaUrlFinal,
        media_caption: mediaCaptionFinal,
        reply_to_message_id: replyToMessage?.id || null
      };

      const resultado = await base44.functions.invoke('sendInternalMessage', payload);

      if (resultado.data.success) {
        // 4. ✅ FIX: Remover temporária ANTES de invalidar
        queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
          return antigas.filter((m) => m.id !== tempId);
        });

        // 5. ✅ CRÍTICO: Invalidar queries relacionadas (APENAS internas)
        await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] }),
        queryClient.invalidateQueries({ queryKey: ['threads-internas'] }) // ✅ FIX: Apenas internas
        ]);

        toast.success('✅ Mensagem enviada!');
      } else {
        throw new Error(resultado.data.error || 'Erro ao enviar');
      }
    } catch (error) {
      console.error('[OPTIMISTIC INTERNO] Erro:', error);

      // ROLLBACK: Remover mensagem temporária usando ID correto
      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return antigas.filter((m) => m.id !== tempId);
      });

      toast.error(`Erro ao enviar: ${error.message}`);
    }
  }, [threadAtiva, usuario, queryClient]);

  // 🚀 OPTIMISTIC UI: Envio instantâneo de mensagens EXTERNAS (WhatsApp)
  const handleEnviarMensagemOtimista = React.useCallback(async (dadosEnvio) => {
    if (!threadAtiva || !usuario) return;

    const { texto, integrationId, replyToMessage, mediaUrl, mediaType, mediaCaption, isAudio } = dadosEnvio;

    // ✅ CIRÚRGICA P1.5: Validar can_send ANTES de enviar
    if (usuario.role !== 'admin') {
      const whatsappPerms = usuario.whatsapp_permissions || [];
      if (whatsappPerms.length > 0) {
        const perm = whatsappPerms.find((p) => p.integration_id === integrationId);
        if (!perm || perm.can_send !== true) {
          toast.error('❌ Você não tem permissão para enviar mensagens por esta conexão');
          return;
        }
      }
    }

    // 1. Criar mensagem temporária (aparece instantaneamente na tela)
    const msgTemp = {
      id: `temp-${Date.now()}`,
      thread_id: threadAtiva.id,
      sender_id: usuario.id,
      sender_type: "user",
      recipient_id: threadAtiva.contact_id,
      recipient_type: "contact",
      content: texto || (mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : '[Mídia]'),
      channel: "whatsapp",
      status: "enviando",
      sent_at: new Date().toISOString(),
      media_url: mediaUrl || null,
      media_type: mediaType || 'none',
      media_caption: mediaCaption || null,
      reply_to_message_id: replyToMessage?.id || null,
      metadata: {
        whatsapp_integration_id: integrationId,
        optimistic: true
      }
    };

    // 2. Atualizar cache INSTANTANEAMENTE (0ms lag)
    queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
      return [...antigas, msgTemp];
    });

    // 3. Enviar para servidor em background
    try {
      const contatoAtual = contatos.find((c) => c.id === threadAtiva.contact_id);
      const telefone = contatoAtual?.telefone || contatoAtual?.celular;

      if (!telefone) {
        throw new Error('Contato sem telefone');
      }

      const payload = {
        integration_id: integrationId,
        numero_destino: telefone
      };

      if (mediaUrl) {
        if (isAudio || mediaType === 'audio') {
          payload.audio_url = mediaUrl;
          payload.media_type = 'audio';
        } else {
          payload.media_url = mediaUrl;
          payload.media_type = mediaType;
          if (mediaCaption || texto) {
            payload.media_caption = mediaCaption || texto;
          }
        }
      } else if (texto) {
        payload.mensagem = texto;
      }

      if (replyToMessage?.whatsapp_message_id) {
        payload.reply_to_message_id = replyToMessage.whatsapp_message_id;
      }

      const resultado = await base44.functions.invoke('enviarWhatsApp', payload);

      if (resultado.data.success) {
        // Registrar mensagem real no banco
        await base44.entities.Message.create({
          thread_id: threadAtiva.id,
          sender_id: usuario.id,
          sender_type: "user",
          recipient_id: threadAtiva.contact_id,
          recipient_type: "contact",
          content: msgTemp.content,
          channel: "whatsapp",
          status: "enviada",
          whatsapp_message_id: resultado.data.message_id,
          sent_at: new Date().toISOString(),
          media_url: mediaUrl || null,
          media_type: mediaType || 'none',
          media_caption: mediaCaption || null,
          reply_to_message_id: replyToMessage?.id || null,
          metadata: {
            whatsapp_integration_id: integrationId
          }
        });

        await base44.entities.MessageThread.update(threadAtiva.id, {
          last_message_content: msgTemp.content.substring(0, 100),
          last_message_at: new Date().toISOString(),
          last_message_sender: "user",
          last_human_message_at: new Date().toISOString(),
          last_media_type: mediaType || 'none',
          whatsapp_integration_id: integrationId,
          pre_atendimento_ativo: false
        });

        // 4. Invalidar queries para substituir mensagem temporária pela real (apenas externas)
        queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] });
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      } else {
        throw new Error(resultado.data.error || 'Erro ao enviar');
      }
    } catch (error) {
      console.error('[OPTIMISTIC] ❌ Erro:', error);

      // 5. ROLLBACK: Remover mensagem temporária do cache
      queryClient.setQueryData(['mensagens', threadAtiva.id], (antigas = []) => {
        return antigas.filter((m) => m.id !== msgTemp.id);
      });

      toast.error(`❌ Erro ao enviar: ${error.message}`);
    }
  }, [threadAtiva, usuario, queryClient, contatos]);



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

  // Função de busca melhorada para termos compostos
  const matchBuscaGoogle = React.useCallback((item, termo) => {
    if (!termo || termo.trim().length < 2) return false;

    const normalizarTexto = (t) => {
      if (!t) return '';
      return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };

    const termoNorm = normalizarTexto(termo);
    const termoNumeros = String(termo).replace(/\D/g, '');

    const camposTexto = [
    item.nome, item.empresa, item.cargo, item.email, item.observacoes,
    item.vendedor_responsavel, item.razao_social, item.nome_fantasia,
    item.contato_principal_nome, item.segmento,
    ...(Array.isArray(item.tags) ? item.tags : [])].
    filter(Boolean);

    const camposNumero = [item.telefone, item.cnpj].filter(Boolean);

    const textoCompleto = camposTexto.map((c) => normalizarTexto(String(c))).join(' ');
    const numerosCompletos = camposNumero.map((c) => String(c).replace(/\D/g, '')).join(' ');

    const matchTexto = textoCompleto.includes(termoNorm);
    const matchNumero = termoNumeros.length >= 3 && numerosCompletos.includes(termoNumeros);

    const palavrasTermo = termoNorm.split(' ').filter(Boolean);
    const todasPalavrasEncontradas = palavrasTermo.every((p) => textoCompleto.includes(p));

    return matchTexto || matchNumero || todasPalavrasEncontradas;
  }, []);

  // Calcular score de relevância para ordenação de busca
  const calcularScoreBusca = React.useCallback((contato, termo) => {
    if (!contato || !termo) return 0;

    const normalizarTexto = (t) => {
      if (!t) return '';
      return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };

    const termoNorm = normalizarTexto(termo);
    const nome = normalizarTexto(contato.nome || '');
    const empresa = normalizarTexto(contato.empresa || '');

    let score = 0;

    // Match exato no nome = maior prioridade
    if (nome === termoNorm) score += 100;else
    if (nome.startsWith(termoNorm)) score += 50;else
    if (nome.includes(termoNorm)) score += 20;

    // Match na empresa
    if (empresa === termoNorm) score += 40;else
    if (empresa.includes(termoNorm)) score += 15;

    // Match em outros campos
    const outrosCampos = normalizarTexto((contato.cargo || '') + (contato.observacoes || ''));
    if (outrosCampos.includes(termoNorm)) score += 5;

    return score;
  }, []);

  // PRÉ-INDEXAÇÃO 1: Mapa de contatos (evita recriar dentro de loops)
  const contatosMap = React.useMemo(() => {
    return new Map(contatos.map((c) => [c.id, c]));
  }, [contatos]);

  // ✅ PATCH 3: Segurar "unassigned" até ter dados mínimos carregados
  const hasBaseData = !!usuario && Array.isArray(threads) && threads.length >= 0;
  const effectiveScope =
  !hasBaseData && filterScope === 'unassigned' ? 'all' : filterScope;

  // ═══════════════════════════════════════════════════════════════════════
  // OTIMIZAÇÃO: Pré-calcular o Set de "Não Atribuídas" separadamente
  // Extraído para top-level para evitar nested hooks
  // ═══════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════
  // ✅ PRÉ-CÁLCULO: Threads não-atribuídas visíveis em escopo 'unassigned'
  // IMPORTANTE: Usuários internos já têm sua própria regra (participação)
  // e retornam ANTES desta verificação na VISIBILITY_MATRIX
  // ═══════════════════════════════════════════════════════════════════════
  const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
    if (effectiveScope !== 'unassigned' || !usuario || !userPermissions) return new Set();

    const setIds = new Set();

    threads.forEach((thread) => {
      // ✅ SAGRADO: Usuários internos nunca entram neste Set
      // (têm sua própria regra de visibilidade por participação)
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') return;

      const contato = contatosMap.get(thread.contact_id);

      if (permissionsService.isNaoAtribuida(thread) && permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)) {
        setIds.add(thread.id);
      }
    });
    return setIds;
  }, [threads, contatosMap, usuario, effectiveScope, userPermissions]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // ✅ REMOVIDO: Filtro de duplicatas - Busca SEMPRE mostra todos os contatos
  // Detecção de duplicata serve apenas para alerta informativo (não bloqueia)
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsAProcessar = threads; // ✅ SEM FILTRO de duplicatas

  const threadsFiltradas = React.useMemo(() => {
    if (!usuario || !userPermissions) return [];
    const categoriasSet = selectedCategoria !== 'all' ? new Set(mensagensComCategoria.map((m) => m.thread_id)) : null;
    const temBuscaPorTexto = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
    const threadsComContatoIds = new Set();
    const isAdmin = usuario?.role === 'admin';

    const isFilterUnassigned = effectiveScope === 'unassigned';

    // 🆕 DEDUPLICAÇÃO CONDICIONAL: 
    // - COM BUSCA: NÃO deduplicar (mostrar TODAS as threads do mesmo contato)
    // - SEM BUSCA: Deduplicar normalmente (1 thread por contato)
    const threadMaisRecentePorContacto = new Map();

    threadsAProcessar.forEach((thread) => {// Using threadsAProcessar to respect duplicataEncontrada filter
      // ✅ Usuários internos: NUNCA deduplicam (USUARIOS ≠ CONTATOS)
      // Usuários internos usam pair_key/sector_key como identificador ÚNICO
      // NÃO devem usar contact_id (que é null para usuários internos)
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        // Usar thread_id direto como chave (garantia absoluta de unicidade)
        threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
        return;
      }

      // 🆕 COM BUSCA ATIVA: Mostrar TODAS as threads (sem deduplicar)
      if (temBuscaPorTexto) {
        threadMaisRecentePorContacto.set(`search-all-${thread.id}`, thread);
        return;
      }

      // ✅ SEM BUSCA: Deduplicar por contact_id (comportamento normal)
      const contactId = thread.contact_id;
      if (!contactId) {
        if (isAdmin) {
          threadMaisRecentePorContacto.set(`orphan-${thread.id}`, thread);
        }
        return;
      }

      const existente = threadMaisRecentePorContacto.get(contactId);
      if (!existente) {
        threadMaisRecentePorContacto.set(contactId, thread);
      } else {
        const tsExistente = new Date(existente.last_message_at || existente.updated_date || existente.created_date || 0).getTime();
        const tsAtual = new Date(thread.last_message_at || thread.updated_date || thread.created_date || 0).getTime();

        if (tsAtual > tsExistente) {
          threadMaisRecentePorContacto.set(contactId, thread);
        }
      }
    });

    const threadsUnicas = Array.from(threadMaisRecentePorContacto.values());

    if (DEBUG_VIS) {
      console.log('[COMUNICACAO] 🎯 Threads processadas:', threadsUnicas.length, '| Busca ativa:', temBuscaPorTexto);
    }

    // Registrar IDs de contatos que já têm thread (para evitar duplicatas na busca)
    const contatosComThreadExistente = new Set(threadsUnicas.map((t) => t.contact_id).filter(Boolean));

    // Montar objeto de filtros para threadVisibility
    // ✅ CRÍTICO: Atendente SEMPRE filtra (mesmo em "não atribuídas")
    // Threads transferidas para você devem aparecer independente do escopo
    const filtros = {
      atendenteId: selectedAttendantId,
      integracaoId: selectedIntegrationId,
      scope: filterScope
    };

    // ═══════════════════════════════════════════════════════════════════════
    // MODO BUSCA: Se há termo de busca, relaxar filtros de visibilidade
    // A busca serve para ENCONTRAR contatos e iniciar novas conversas
    // O modal de permissão será exibido ao clicar se necessário
    // ═══════════════════════════════════════════════════════════════════════
    const modoBusca = temBuscaPorTexto;

    // ═══════════════════════════════════════════════════════════════════════════
    // PARTE 1: Filtrar THREADS existentes com REGRAS DE VISUALIZAÇÃO
    // (Usando threadsUnicas - permite múltiplos canais por contato)
    // ═══════════════════════════════════════════════════════════════════════════

    // 🔍 LOGS DETALHADOS: Rastrear onde cada thread é bloqueada
    const logsFiltragem = [];

    const threadsFiltrados = threadsUnicas.filter((thread) => {
      const logThread = (etapa, passou, motivo = '') => {
        // ✅ OT #3: Blindagem de Logs em Produção (só aloca se DEBUG ativo)
        if (!DEBUG_VIS) return;

        logsFiltragem.push({
          threadId: thread.id.substring(0, 8),
          contactId: thread.contact_id?.substring(0, 8),
          etapa,
          passou,
          motivo,
          timestamp: new Date().toISOString()
        });
      };

      // 🔍 DIAGNÓSTICO: Identificar threads de usuários que também são contatos
      const isThreadDeUsuarioQueEContato = DEBUG_VIS && thread.contact_id && contatos.find((c) => {
        const atendenteMatch = atendentes.find((a) =>
        a.email?.toLowerCase() === c.email?.toLowerCase() ||
        a.full_name?.toLowerCase() === c.nome?.toLowerCase()
        );
        return atendenteMatch && c.id === thread.contact_id;
      });

      if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
        const contato = contatosMap.get(thread.contact_id);
        console.log('[COMUNICACAO] 🔍 THREAD DE USUÁRIO-CONTATO:', {
          thread_id: thread.id.substring(0, 8),
          thread_type: thread.thread_type,
          contact_id: thread.contact_id?.substring(0, 8),
          contato_nome: contato?.nome,
          contato_email: contato?.email,
          integration_id: thread.whatsapp_integration_id?.substring(0, 8),
          unread_count: thread.unread_count,
          assigned_user_id: thread.assigned_user_id?.substring(0, 8)
        });
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // ✅ USUÁRIOS INTERNOS - SAGRADOS: Nunca bloqueados por escopos/filtros
      // MAS: Bloqueados durante busca ativa (usuário quer ver resultados da busca)
      // ═══════════════════════════════════════════════════════════════════════════
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        // 🔍 BUSCA ATIVA: Bloquear threads internas (mostrar apenas resultados da busca)
        if (modoBusca) {
          logThread('Modo Busca - Interno', false, 'Threads internas bloqueadas durante busca');
          return false;
        }

        const visInterna = podeVerThreadInterna(thread, usuario);
        logThread('Usuário Interno (INDEPENDENTE)', visInterna, visInterna ? 'Participante ou admin' : 'Não é participante nem admin');
        return visInterna;
      }

      // ⬇️ Daqui pra baixo: SOMENTE threads EXTERNAS (contact_external)

      const contato = contatosMap.get(thread.contact_id);

      if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
        console.log('[COMUNICACAO] 🔍 USUÁRIO-CONTATO - Contato:', contato ? {
          id: contato.id.substring(0, 8),
          nome: contato.nome,
          email: contato.email,
          tipo_contato: contato.tipo_contato
        } : 'NÃO ENCONTRADO');
      }

      if (!contato && thread.contact_id && !isFilterUnassigned) {
        logThread('Contato Existe', true, 'Contato aguardando hidratação (Fail-Safe)');
        if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
          console.log('[COMUNICACAO] ⚠️ USUÁRIO-CONTATO - Contato não hidratado, mas thread passa (Fail-Safe)');
        }
      } else if (!contato && !thread.contact_id && !isFilterUnassigned) {
        logThread('Contato Existe', false, 'Thread órfã sem contact_id (bloqueado exceto em não atribuídas)');
        if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
          console.log('[COMUNICACAO] ❌ USUÁRIO-CONTATO - BLOQUEADO por ser órfã de verdade (sem contact_id)');
        }
        return false;
      }

      logThread('Contato Existe', true, contato ? 'Contato encontrado' : 'Fail-Safe ativado');

      if (thread.contact_id) {
        threadsComContatoIds.add(thread.contact_id);
      }

      // Enriquecer thread com contato para a função de visibilidade
      const threadComContato = { ...thread, contato };

      // ═══════════════════════════════════════════════════════════════════════
      // MODO BUSCA: Aplicar permissões rigorosas mesmo durante a busca
      // ═══════════════════════════════════════════════════════════════════════
      if (modoBusca) {
        // Verificar permissões base mesmo em modo busca (NEXUS360)
        if (!permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)) {
          logThread('Modo Busca - Base', false, 'Bloqueado por visibilidade base');
          if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
            console.log('[COMUNICACAO] ❌ USUÁRIO-CONTATO - Modo Busca bloqueado por VISIBILITY_MATRIX');
          }
          return false;
        }

        logThread('Modo Busca - Base', true, 'Passou visibilidade base');

        if (!contato || !matchBuscaGoogle(contato, debouncedSearchTerm)) {
          logThread('Modo Busca - Match', false, 'Não match com termo de busca');
          return false;
        }

        logThread('Modo Busca - Match', true, 'Match encontrado');

        if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) {
          logThread('Modo Busca - Tipo', false, `Tipo diferente (esperado: ${selectedTipoContato}, atual: ${contato.tipo_contato})`);
          return false;
        }
        logThread('Modo Busca - Tipo', true, 'Tipo OK');

        if (selectedTagContato && selectedTagContato !== 'all') {
          const tags = contato.tags || [];
          if (!tags.includes(selectedTagContato)) {
            logThread('Modo Busca - Tag', false, `Tag não encontrada (esperado: ${selectedTagContato})`);
            return false;
          }
        }
        logThread('Modo Busca - Tag', true, 'Tag OK');

        return true;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // MODO NORMAL (sem busca): Aplicar regras estritas de visibilidade
      // ═══════════════════════════════════════════════════════════════════════

      // ═══════════════════════════════════════════════════════════════════════
      // ✅ FILTRO "NÃO ATRIBUÍDAS" vs "NÃO ADICIONADAS"
      // Threads internas são SAGRADAS - já passaram por sua lógica própria acima
      // ═══════════════════════════════════════════════════════════════════════

      // ✅ NOVO: Filtro "Não Adicionadas" (contact_id === NULL)
      if (filterScope === 'nao_adicionado') {
        // ✅ Threads internas não se aplicam (não têm contact_id por definição)
        if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
          logThread('Filtro Não Adicionadas', false, 'Thread interna (não se aplica)');
          return false;
        }

        // ✅ Apenas threads SEM contact_id passam
        if (thread.contact_id) {
          logThread('Filtro Não Adicionadas', false, 'Thread tem contact_id (não é órfã)');
          return false;
        }

        logThread('Filtro Não Adicionadas', true, 'Thread órfã (contact_id == null)');
        return true; // ✅ Pula outros filtros (thread órfã não tem contato para filtrar)
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ✅ CRÍTICO: Filtros SEMPRE aplicados (INDEPENDENTE do escopo ou busca)
      // ═══════════════════════════════════════════════════════════════════════

      // Filtro de INTEGRAÇÃO (threads externas)
      if (selectedIntegrationId && selectedIntegrationId !== 'all') {
        // ✅ Threads internas não têm integração WhatsApp (pular)
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          // ✅ FIX: Verificar origin_integration_ids[] para threads canônicas unificadas
          const integrationIds = thread.origin_integration_ids?.length > 0 ?
          thread.origin_integration_ids :
          [thread.whatsapp_integration_id];

          if (!integrationIds.includes(selectedIntegrationId)) {
            logThread('Filtro Integração', false, `Integração não encontrada (esperado: ${selectedIntegrationId}, atual: ${integrationIds.join(', ')})`);
            return false;
          }
          logThread('Filtro Integração', true, 'Integração OK (verificou origin_integration_ids)');
        }
      }

      // Filtro de ATENDENTE
      if (selectedAttendantId && selectedAttendantId !== 'all') {
        if (thread.assigned_user_id !== selectedAttendantId) {
          logThread('Filtro Atendente', false, `Atendente diferente (esperado: ${selectedAttendantId}, atual: ${thread.assigned_user_id})`);
          return false;
        }
        logThread('Filtro Atendente', true, 'Atendente OK');
      }

      // Filtro de CATEGORIA (threads externas)
      if (categoriasSet && !(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
        if (!categoriasSet.has(thread.id)) {
          logThread('Filtro Categoria', false, 'Thread não tem mensagem com categoria selecionada');
          return false;
        }
        logThread('Filtro Categoria', true, 'Thread tem mensagem com categoria');
      }

      // Filtro de TIPO DE CONTATO (threads externas)
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          if (contato.tipo_contato !== selectedTipoContato) {
            logThread('Filtro Tipo Contato', false, `Tipo diferente (esperado: ${selectedTipoContato}, atual: ${contato.tipo_contato})`);
            return false;
          }
          logThread('Filtro Tipo Contato', true, 'Tipo OK');
        }
      }

      // Filtro de TAG (threads externas)
      if (selectedTagContato && selectedTagContato !== 'all' && contato) {
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          const tags = contato.tags || [];
          if (!tags.includes(selectedTagContato)) {
            logThread('Filtro Tag', false, `Tag não encontrada (esperado: ${selectedTagContato})`);
            return false;
          }
          logThread('Filtro Tag', true, 'Tag OK');
        }
      }

      if (isFilterUnassigned) {
        // ✅ CURTO-CIRCUITO: Threads internas NUNCA são bloqueadas por escopo
        // (visibilidade delas já foi decidida por participação/admin acima)
        if (!(thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
          // ✅ APENAS para threads EXTERNAS: verificar Set de não atribuídas visíveis
          if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
            logThread('Filtro Não Atribuídas', false, 'Thread não está no Set de não atribuídas visíveis');
            if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
              console.log('[COMUNICACAO] ❌ USUÁRIO-CONTATO - BLOQUEADO por filtro não atribuídas');
            }
            return false;
          }

          logThread('Filtro Não Atribuídas', true, 'Thread está no Set');
        } else {
          // ✅ Threads internas passam direto (já foram validadas acima)
          logThread('Filtro Não Atribuídas', true, 'Thread interna (ignorada pelo escopo)');
        }
      } else {
        // ✅ NEXUS360: Usar canUserSeeThreadBase + aplicar escopo
        const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
        if (!podeVerBase) {
          logThread('Visibilidade Base (Nexus360)', false, 'Bloqueado pela VISIBILITY_MATRIX');

          // 🔍 LOG DETALHADO: Identificar threads bloqueadas
          console.log('[BLOQUEADO] ❌ Thread ID:', thread.id?.substring(0, 8), {
            thread_type: thread.thread_type,
            contact_id: thread.contact_id?.substring(0, 8),
            contato_nome: contato?.nome || 'SEM_CONTATO',
            contato_email: contato?.email || null,
            assigned_user: thread.assigned_user_id?.substring(0, 8),
            integration_id: thread.whatsapp_integration_id?.substring(0, 8),
            sector_id: thread.sector_id,
            unread_count: thread.unread_count,
            motivo_bloqueio: 'canUserSeeThreadBase retornou false'
          });

          if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
            console.log('[COMUNICACAO] ❌ USUÁRIO-CONTATO - BLOQUEADO pela VISIBILITY_MATRIX:', {
              thread_id: thread.id.substring(0, 8),
              thread_type: thread.thread_type,
              contato_nome: contato?.nome,
              userPermissions_resumo: {
                role: userPermissions.role,
                isAdmin: userPermissions.isAdmin,
                attendant_sector: userPermissions.attendant_sector,
                integracoes_visiveis: userPermissions.integracoes_visiveis?.length
              }
            });
          }
          return false;
        }

        // Aplicar filtro de escopo (my/unassigned/all)
        if (filtros.scope && filtros.scope !== 'all') {
          const escopoConfig = { id: filtros.scope, regra: filtros.scope === 'my' ? 'atribuido_ou_fidelizado' : 'sem_assigned_user_id' };
          const threadsComEscopo = permissionsService.aplicarFiltroEscopo([thread], escopoConfig, userPermissions);
          if (threadsComEscopo.length === 0) {
            logThread('Filtro Escopo', false, `Não passou no escopo ${filtros.scope}`);
            return false;
          }
        }

        logThread('Visibilidade Nexus360', true, 'Passou VISIBILITY_MATRIX + escopo');
      }

      if (DEBUG_VIS && isThreadDeUsuarioQueEContato) {
        console.log('[COMUNICACAO] ✅ USUÁRIO-CONTATO - PASSOU em todos os filtros!');
      }

      logThread('✅ APROVADA', true, 'Passou em todos os filtros');
      return true;
    });

    console.log('[COMUNICACAO] 📊 Total de threads filtradas:', threadsFiltrados.length);

    // 🔍 LOG RESUMIDO: Threads bloqueadas por etapa
    const bloqueadasPorEtapa = logsFiltragem.
    filter((l) => !l.passou).
    reduce((acc, log) => {
      acc[log.etapa] = (acc[log.etapa] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(bloqueadasPorEtapa).length > 0) {
      console.log('[COMUNICACAO] 🚫 Threads bloqueadas por etapa:', bloqueadasPorEtapa);
    }

    // Expor logs para diagnóstico
    window._logsFiltragem = logsFiltragem;

    // 🔍 DIAGNÓSTICO: Threads de usuários que também são contatos
    if (DEBUG_VIS) {
      const threadsDeUsuariosContatos = threadsUnicas.filter((t) => {
        if (!t.contact_id) return false;
        const contato = contatosMap.get(t.contact_id);
        if (!contato) return false;
        return atendentes.some((a) =>
        a.email?.toLowerCase() === contato.email?.toLowerCase() ||
        a.full_name?.toLowerCase() === contato.nome?.toLowerCase()
        );
      });

      if (threadsDeUsuariosContatos.length > 0) {
        console.group('[COMUNICACAO] 🔍 THREADS DE USUÁRIOS-CONTATOS');
        threadsDeUsuariosContatos.forEach((t) => {
          const contato = contatosMap.get(t.contact_id);
          const passou = threadsFiltrados.some((tf) => tf.id === t.id);
          console.log(`${passou ? '✅' : '❌'} Thread ${t.id.substring(0, 8)} - ${contato?.nome} (${t.thread_type}) - ${passou ? 'PASSOU' : 'BLOQUEADO'}`);
        });
        console.groupEnd();
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PARTE 2: COM BUSCA - Adicionar contatos sem thread e clientes sem contato
    // IMPORTANTE: Usar contatosComThreadExistente para evitar duplicatas
    // 🎯 DEDUPLICAÇÃO POR TELEFONE: Contatos duplicados devem mostrar apenas o principal
    // ═══════════════════════════════════════════════════════════════════════════
    if (temBuscaPorTexto) {
      // Rastrear contatos por telefone normalizado para evitar duplicatas
      const telefonesJaAcionados = new Set();

      // ✅ COMBINAR: Contatos carregados + contatos buscados no BD (apenas durante busca)
      const todosCont = temBuscaPorTexto ? [...contatos, ...contatosBuscados] : [...contatos];
      const contatosUnicos = new Map(todosCont.map((c) => [c.id, c]));

      // Contatos sem thread - usar Set de contatos que já têm thread
      Array.from(contatosUnicos.values()).forEach((contato) => {
        // ✅ REMOVIDO: Filtro de duplicata não deve bloquear busca
        // Busca SEMPRE mostra todos os contatos (permissões aplicadas ao abrir thread)
        // Duplicatas detectadas servem apenas para alerta informativo

        if (contato.telefone) {
          const telNorm = normalizarTelefone(contato.telefone);
          if (telNorm && telefonesJaAcionados.has(telNorm)) {
            if (DEBUG_VIS) {
              console.log(`[COMUNICACAO] 🚫 Ignorando contato duplicado por telefone: ${contato.id} ${contato.nome}`);
            }
            return;
          }
          if (telNorm) {
            telefonesJaAcionados.add(telNorm);
          }
        }

        if (!isAdmin) {
          if (contatosComThreadExistente.has(contato.id)) return;
          if (threadsComContatoIds.has(contato.id)) return;
          if (contato.bloqueado) return;
        } else {
          if (!temBuscaPorTexto && contatosComThreadExistente.has(contato.id)) return;
        }

        if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;

        threadsFiltrados.push({
          id: `contato-sem-thread-${contato.id}`,
          contact_id: contato.id,
          is_contact_only: true,
          last_message_at: contato.ultima_interacao || contato.created_date,
          last_message_content: null,
          unread_count: 0,
          status: 'sem_conversa',
          _admin_debug: isAdmin ? { bloqueado: contato.bloqueado, tipo: contato.tipo_contato } : null
        });
      });

      // Clientes sem contato associado
      clientes.forEach((cliente) => {
        if (!matchBuscaGoogle(cliente, debouncedSearchTerm)) return;

        // Verificar se cliente já tem contato pelo telefone
        const telefoneCliente = (cliente.telefone || '').replace(/\D/g, '');
        if (telefoneCliente) {
          const jaTemContato = contatos.some((c) => {
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

    // 🔧 Expor dados intermediários para diagnóstico
    window._diagnosticoData = {
      threadsUnicas,
      threadsNaoAtribuidasVisiveis,
      duplicataEncontrada,
      logsFiltragem, // 🆕 Logs detalhados de cada etapa
      filtrosAtivos: {
        scope: filterScope,
        integracaoId: selectedIntegrationId,
        atendenteId: selectedAttendantId,
        tipoContato: selectedTipoContato,
        tagContato: selectedTagContato,
        categoria: selectedCategoria
      },
      estatisticas: {
        totalThreadsUnicas: threadsUnicas.length,
        threadsFiltradas: threadsFiltrados.length,
        bloqueadas: threadsUnicas.length - threadsFiltrados.length,
        bloqueadasPorEtapa
      }
    };

    return threadsFiltrados;
  }, [threads, contatos, clientes, atendentes, usuario, userPermissions, selectedAttendantId, selectedIntegrationId, selectedCategoria, selectedTipoContato, selectedTagContato, debouncedSearchTerm, mensagensComCategoria, matchBuscaGoogle, filterScope, duplicataEncontrada, effectiveScope, threadsNaoAtribuidasVisiveis, threadsAProcessar, contatosMap, contatosBuscados]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 COLEÇÃO ESPECÍFICA PARA MODO BUSCA - Apenas resultados reais da busca
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsResultantesDaBusca = React.useMemo(() => {
    const temBuscaAtiva = !!debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
    if (!temBuscaAtiva) return [];

    const contatosMap = new Map(contatos.map((c) => [c.id, c]));
    const resultados = [];

    // PARTE 1: Threads (internas + externas) que fazem match com o termo
    threadsAProcessar.forEach((thread) => {
      // ✅ THREADS INTERNAS: Buscar por participantes, nome do grupo, etc
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        // Match no nome do grupo
        if (!matchBuscaGoogle({ nome: thread.group_name }, debouncedSearchTerm)) {
          return;
        }

        // Match nos participantes (buscar por nome de usuário)
        const participantsMatch = (thread.participants || []).some((userId) => {
          const att = atendentes.find((a) => a.id === userId);
          return att && matchBuscaGoogle({ nome: att.full_name || att.email }, debouncedSearchTerm);
        });

        if (!matchBuscaGoogle({ nome: thread.group_name }, debouncedSearchTerm) && !participantsMatch) {
          return;
        }

        resultados.push({
          ...thread,
          _searchScore: 50 // Score fixo para internos
        });
        return;
      }

      const contato = contatosMap.get(thread.contact_id);

      // ✅ Verificar permissões base (NEXUS360)
      if (!permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)) {
        return;
      }

      // ✅ Verificar match com termo (só se contato existir)
      if (contato && !matchBuscaGoogle(contato, debouncedSearchTerm)) {
        return;
      }

      // ✅ Aplicar filtros de UI escolhidos pelo usuário
      if (contato) {
        if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) {
          return;
        }

        if (selectedTagContato && selectedTagContato !== 'all') {
          const tags = contato.tags || [];
          if (!tags.includes(selectedTagContato)) {
            return;
          }
        }
      }

      // ✅ PASSOU: Adicionar thread à lista de busca
      resultados.push({
        ...thread,
        contato,
        _searchScore: contato ? calcularScoreBusca(contato, debouncedSearchTerm) : 0
      });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // PARTE 2: Contatos PUROS da busca (SEM bloqueio por thread)
    // ═════════════════════════════════════════════════════════════════════════
    // ✅ CRÍTICO: Em modo busca, contato SEMPRE aparece se existir no banco
    // Permissões são aplicadas ao CLICAR (modal de bloqueio se necessário)
    // ═════════════════════════════════════════════════════════════════════════
    const contatosUnicos = new Map([...contatos, ...contatosBuscados].map((c) => [c.id, c]));
    const contatosJaExibidosComoThread = new Set(resultados.map(r => r.contact_id).filter(Boolean));

    Array.from(contatosUnicos.values()).forEach((contato) => {
      // ✅ ÚNICO BLOQUEIO: Se já foi exibido como thread (evitar duplicata visual)
      if (contatosJaExibidosComoThread.has(contato.id)) return;

      // ✅ Pular bloqueados (contato bloqueado = não pode conversar nunca)
      if (contato.bloqueado) return;

      // ✅ Verificar match de busca
      if (!matchBuscaGoogle(contato, debouncedSearchTerm)) return;

      // ✅ Respeitar apenas filtros de UI escolhidos pelo usuário (tipo/tag)
      if (selectedTipoContato && selectedTipoContato !== 'all' && contato.tipo_contato !== selectedTipoContato) {
        return;
      }

      if (selectedTagContato && selectedTagContato !== 'all') {
        const tags = contato.tags || [];
        if (!tags.includes(selectedTagContato)) {
          return;
        }
      }

      // ✅ PASSOU: Adicionar como "contato sem thread visível"
      // Modal de permissão aparecerá ao clicar se necessário
      resultados.push({
        id: `contato-sem-thread-${contato.id}`,
        contact_id: contato.id,
        is_contact_only: true,
        contato,
        last_message_at: contato.ultima_interacao || contato.created_date,
        last_message_content: null,
        unread_count: 0,
        status: 'sem_conversa',
        _searchScore: calcularScoreBusca(contato, debouncedSearchTerm)
      });
    });

    // ✅ ORDENAR por score de relevância
    return resultados.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
  }, [threads, contatos, contatosBuscados, debouncedSearchTerm, selectedTipoContato, selectedTagContato, matchBuscaGoogle, calcularScoreBusca, threadsAProcessar, userPermissions]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📋 LISTA RECENTE - Modo normal (sem busca)
  // ═══════════════════════════════════════════════════════════════════════════════
  const listaRecentes = React.useMemo(() => {
    const contatosMap = new Map(contatos.map((c) => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));

    // ✅ Enriquecer com contato e usuário
    const enriched = threadsFiltradas.map((thread) => {
      const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
      const contatoObj = thread.contato || contatosMap.get(thread.contact_id);

      return {
        ...thread,
        contato: contatoObj,
        atendente_atribuido: usuarioAtribuido,
        assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null
      };
    });

    // 🎯 Deduplicação por chave única
    const gerarChaveUnica = (contato) => {
      if (!contato) return null;
      const tel = normalizarTelefone(contato.telefone || '') || '';
      const nome = (contato.nome || '').trim().toLowerCase();
      const empresa = (contato.empresa || '').trim().toLowerCase();
      const cargo = (contato.cargo || '').trim().toLowerCase();
      return `${tel}|${nome}|${empresa}|${cargo}`;
    };

    const threadsPorChaveUnica = new Map();
    enriched.forEach((thread) => {
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        threadsPorChaveUnica.set(`internal-${thread.id}`, thread);
        return;
      }

      const chave = gerarChaveUnica(thread.contato);
      if (!chave) {
        threadsPorChaveUnica.set(`orphan-${thread.id}`, thread);
        return;
      }

      const existente = threadsPorChaveUnica.get(chave);
      if (!existente) {
        threadsPorChaveUnica.set(chave, thread);
      } else {
        const tsExistente = new Date(existente.last_message_at || 0).getTime();
        const tsAtual = new Date(thread.last_message_at || 0).getTime();
        if (tsAtual > tsExistente) {
          threadsPorChaveUnica.set(chave, thread);
        }
      }
    });

    const deduplicated = Array.from(threadsPorChaveUnica.values());

    // ✅ Ordenar por tipo + recência
    return deduplicated.sort((a, b) => {
      const getPrioridade = (item) => {
        if (item.is_cliente_only) return 3;
        if (item.is_contact_only) return 2;
        return 1;
      };

      const prioA = getPrioridade(a);
      const prioB = getPrioridade(b);
      if (prioA !== prioB) return prioA - prioB;

      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [threadsFiltradas, contatos, atendentes]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 LISTA BUSCA - Modo pesquisa (com texto digitado)
  // ═══════════════════════════════════════════════════════════════════════════════
  const listaBusca = React.useMemo(() => {
    const contatosMap = new Map(contatos.map((c) => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));

    // ✅ Enriquecer threads com contato e usuário
    const enrichedThreads = threadsResultantesDaBusca.map((thread) => {
      const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
      const contatoObj = thread.contato || contatosMap.get(thread.contact_id);

      return {
        ...thread,
        contato: contatoObj,
        atendente_atribuido: usuarioAtribuido,
        assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null
      };
    });

    // ✅ Ordenar apenas por score de relevância
    return enrichedThreads.sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0));
  }, [threadsResultantesDaBusca, contatos, atendentes]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 SELETOR DE FONTE - Busca ativa ou lista recente?
  // ═══════════════════════════════════════════════════════════════════════════════
  const temBuscaAtiva = debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
  const threadsParaExibir = temBuscaAtiva ? listaBusca : listaRecentes;

  const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';
  const contatoAtivo = threadAtiva ? contatos.find((c) => c.id === threadAtiva.contact_id) : null;

  if (isLoadingUsuario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p>Carregando dados...</p>
        </div>
      </div>);

  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 overflow-hidden">
        <NotificationSystem usuario={usuario} threads={threads} />

        <div className="bg-gradient-to-r px-8 from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-xl flex-shrink-0">
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

            <div className="bg-transparent text-black flex items-center gap-3">
              {/* Contador de Não Atribuidas */}
              <ContadorNaoAtribuidas
                threads={threads}
                integracoes={integracoes}
                usuario={usuario}
                onClickVerFila={() => {
                  setFilterScope('unassigned');
                  setActiveTab('conversas');
                }}
                onClickConexao={(integrationId) => {
                  setFilterScope('unassigned');
                  setSelectedIntegrationId(integrationId);
                  setActiveTab('conversas');
                }}
                className="shadow-lg" />

              {/* Contatos Requerendo Atenção */}
              <ContatosRequerendoAtencao
                usuario={usuario}
                contatos={contatos}
                onSelecionarContato={(threadData) => {
                  // ✅ Recebe { id, contatoPreCarregado }
                  handleSelecionarThread(threadData);
                  setActiveTab('conversas');
                }}
                variant="header" />


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
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
                  queryClient.invalidateQueries({ queryKey: ['threads-internas'] });
                  queryClient.invalidateQueries({ queryKey: ['contacts'] });
                  queryClient.invalidateQueries({ queryKey: ['integracoes'] });
                  queryClient.invalidateQueries({ queryKey: ['atendentes'] });
                  if (threadAtiva) {
                    queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] });
                  }
                  toast.info("🔄 Atualizando dados...");
                }} className="bg-orange-500 text-white px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-8 border-white/30 hover:bg-white/20">


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
          <div className="bg-slate-500 px-6 from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600 flex-shrink-0">
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
                    onFilterScopeChange={(val) => {
                      // 🚀 UI Otimista: Troca a aba visualmente rápido, processa a lista em background
                      startTransition(() => {
                        setFilterScope(val);
                      });
                    }}
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
                    onModoSelecaoMultiplaChange={setModoSelecaoMultipla}
                    isAdmin={usuario?.role === 'admin'}
                    onAbrirDiagnostico={(identificador) => {
                      console.log('[Comunicacao] 🔬 Detectada duplicata:', identificador);
                      toast.info('💡 Use o Unificador Centralizado para corrigir duplicatas');
                    }}
                    // 🎯 NOVO: Passar callback para receber duplicatas detectadas
                    onDuplicataDetectada={setDuplicataEncontrada} />


                  <div className={`flex-1 overflow-y-auto transition-opacity duration-200 ${isPendingFilter ? 'opacity-50' : 'opacity-100'}`}>
                   <ChatSidebar
                      threads={threadsParaExibir}
                      threadAtiva={threadAtiva}
                      onSelecionarThread={handleSelecionarThread}
                      loading={loadingTopics}
                      usuarioAtual={usuario}
                      integracoes={integracoes}
                      atendentes={atendentes}
                      modoSelecaoMultipla={modoSelecaoMultipla}
                      setModoSelecaoMultipla={setModoSelecaoMultipla}
                      contatosSelecionados={contatosSelecionados}
                      setContatosSelecionados={setContatosSelecionados}
                      onSelectInternalDestinations={handleInternalSelection} />

                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {modoEnvioMassa && contatosParaEnvioMassa.length > 0 ? (
                    <ChatWindow
                      thread={null}
                      mensagens={[]}
                      usuario={usuario}
                      contatoPreCarregado={null}
                      onEnviarMensagem={async () => {}}
                      onSendMessageOptimistic={handleEnviarMensagemOtimista}
                      onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista}
                      onShowContactInfo={() => {}}
                      onAtualizarMensagens={handleAtualizarMensagens}
                      integracoes={integracoes}
                      selectedCategoria={selectedCategoria}
                      modoSelecaoMultipla={true}
                      contatosSelecionados={contatosParaEnvioMassa}
                      broadcastInterno={null}
                      onCancelarSelecao={() => {
                        setModoEnvioMassa(false);
                        setContatosParaEnvioMassa([]);
                      }}
                      atendentes={atendentes}
                      filterScope={filterScope}
                      selectedIntegrationId={selectedIntegrationId}
                      selectedAttendantId={selectedAttendantId}
                      contatoAtivo={null}
                    />
                  ) : threadAtiva && !criandoNovoContato || modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno) ?
                  <>
                      <div className="flex-1 overflow-hidden relative">
                        <ChatWindow
                        thread={threadAtiva}
                        mensagens={mensagens}
                        usuario={usuario}
                        contatoPreCarregado={contatoPreCarregado}
                        onEnviarMensagem={async () => {}}
                        onSendMessageOptimistic={handleEnviarMensagemOtimista}
                        onSendInternalMessageOptimistic={handleEnviarMensagemInternaOtimista}
                        onShowContactInfo={() => setShowContactInfo(!showContactInfo)}
                        onAtualizarMensagens={handleAtualizarMensagens}
                        integracoes={integracoes}
                        selectedCategoria={selectedCategoria}
                        modoSelecaoMultipla={modoSelecaoMultipla}
                        contatosSelecionados={contatosSelecionados}
                        broadcastInterno={broadcastInterno}
                        onCancelarSelecao={() => {
                          setModoSelecaoMultipla(false);
                          setContatosSelecionados([]);
                          setBroadcastInterno(null);
                        }}
                        atendentes={atendentes}
                        filterScope={filterScope}
                        selectedIntegrationId={selectedIntegrationId}
                        selectedAttendantId={selectedAttendantId}
                        contatoAtivo={contatoAtivo} />
                      </div>

                      {showContactInfo && contatoAtivo &&
                    <ContactInfoPanel
                      contact={contatoAtivo}
                      threadAtual={threadAtiva}
                      onClose={() => setShowContactInfo(false)}
                      onUpdate={handleAtualizarContato}
                      atendentes={atendentes} />

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
                      onUpdate={handleCriarNovoContato}
                      atendentes={atendentes} />

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
              <div className="h-full overflow-y-auto p-6 space-y-6">
                <LogsFiltragemViewer />
                
                <DiagnosticoComparativoThreads
                  usuario={usuario}
                  filtros={{
                    scope: filterScope,
                    integracaoId: selectedIntegrationId,
                    atendenteId: selectedAttendantId,
                    tipoContato: selectedTipoContato,
                    tagContato: selectedTagContato
                  }}
                  contatos={contatos}
                  duplicataEncontrada={duplicataEncontrada}
                  threadsUnicas={window._diagnosticoData?.threadsUnicas}
                  threadsNaoAtribuidasVisiveis={window._diagnosticoData?.threadsNaoAtribuidasVisiveis} />

                
                <DiagnosticoThreadsInvisiveis
                  usuario={usuario}
                  filtros={{
                    scope: filterScope,
                    integracaoId: selectedIntegrationId,
                    atendenteId: selectedAttendantId
                  }}
                  threads={threadsFiltradas}
                  contatos={contatos} />

                
                <DiagnosticoInbound integracoes={integracoes} />
              </div>
            </TabsContent>

            <TabsContent value="diagnostico-cirurgico" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6 space-y-6">
                <DiagnosticoVisibilidadeContato integracoes={todasIntegracoes} />
                <DiagnosticoCirurgicoEmbed />
                <DiagnosticoMensagensInternas />
              </div>
            </TabsContent>

            <TabsContent value="etiquetas" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <GerenciadorEtiquetasUnificado usuarioAtual={usuario} />
              </div>
            </TabsContent>

            <TabsContent value="configuracoes" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6 space-y-6">
                <ConfiguracaoCanaisComunicacao
                  integracoes={integracoes}
                  usuarioAtual={usuario}
                  onRecarregar={() => {
                    queryClient.invalidateQueries({ queryKey: ['integracoes'] });
                    queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
                  }} />

                <GoToConnectionSetup
                  integracoes={gotoIntegracoes}
                  onRecarregar={() => queryClient.invalidateQueries({ queryKey: ['goto-integrations'] })} />
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
        podeIniciarNova={true} />


      </ErrorBoundary>);


}