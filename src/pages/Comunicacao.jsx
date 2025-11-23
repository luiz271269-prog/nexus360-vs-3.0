import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Users
} from "lucide-react";
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

  const { data: contatosBrutos = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('-created_date'),
    staleTime: 2 * 60 * 1000,
    retry: 2
  });

  // ✅ FILTRAR CONTATOS VÁLIDOS (excluir IDs de sistema, @lid, @g.us, etc.)
  const contatos = React.useMemo(() => {
    return contatosBrutos.filter(contato => {
      if (!contato.telefone) return false;
      
      const tel = String(contato.telefone).toLowerCase();
      
      // ❌ EXCLUIR padrões de sistema WhatsApp
      if (tel.includes('@lid')) return false;
      if (tel.includes('@g.us')) return false;
      if (tel.includes('@c.us')) return false;
      if (tel.includes('@broadcast')) return false;
      if (tel.includes('@newsletter')) return false;
      
      // ❌ EXCLUIR IDs muito longos (provavelmente são IDs de sistema)
      const numbersOnly = tel.replace(/\D/g, '');
      if (numbersOnly.length > 20) return false;
      
      // ❌ EXCLUIR telefones que começam com +1052 ou outros prefixos inválidos
      if (tel.startsWith('+1052')) return false;
      
      // ✅ ACEITAR apenas números de telefone reais
      return numbersOnly.length >= 10 && numbersOnly.length <= 15;
    });
  }, [contatosBrutos]);

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ['threads', usuario?.id, filterScope, selectedAttendantId],
    queryFn: async () => {
      if (!usuario) return [];

      let queryParams = {};
      const isManager = usuario.role === 'admin' || usuario.role === 'supervisor';

      if (filterScope === 'my') {
        queryParams = { assigned_user_id: usuario.id };
      } else if (filterScope === 'unassigned') {
        if (!isManager) return [];
        queryParams = { assigned_user_id: null };
      } else if (filterScope === 'specific_user' && selectedAttendantId) {
        if (!isManager) return [];
        if (selectedAttendantId === 'all_unfiltered') {
          queryParams = {};
        } else if (selectedAttendantId === 'unassigned_explicit') {
          queryParams = { assigned_user_id: null };
        } else {
          queryParams = { assigned_user_id: selectedAttendantId };
        }
      } else if (filterScope === 'all') {
        if (!isManager) return [];
        queryParams = {};
      }

      const allThreads = await base44.entities.MessageThread.list('-last_message_at', 200);

      if (Object.keys(queryParams).length === 0) {
        return allThreads;
      }

      return allThreads.filter(thread => {
        return Object.keys(queryParams).every(key => {
          if (queryParams[key] === null) {
            return thread[key] === null || thread[key] === undefined;
          }
          return thread[key] === queryParams[key];
        });
      });
    },
    refetchInterval: 10000,
    staleTime: 5000,
    enabled: !!usuario,
    retry: 2
  });

  const { data: mensagens = [] } = useQuery({
    queryKey: ['mensagens', threadAtiva?.id],
    queryFn: () => {
      if (threadAtiva) {
        return base44.entities.Message.filter({ thread_id: threadAtiva.id }, 'created_date', 500);
      }
      return Promise.resolve([]);
    },
    enabled: !!threadAtiva,
    refetchInterval: 5000,
    staleTime: 2000,
    retry: 2
  });

  const { data: todasIntegracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.WhatsAppIntegration.list(),
    staleTime: 2 * 60 * 1000,
    retry: 2
  });

  // Filtrar integrações baseado nas permissões do usuário
  const integracoes = React.useMemo(() => {
    if (!usuario) return [];
    
    // Admin pode ver todas
    if (usuario.role === 'admin') return todasIntegracoes;
    
    // Filtrar por whatsapp_permissions
    const whatsappPerms = usuario.whatsapp_permissions || [];
    if (whatsappPerms.length === 0) return todasIntegracoes; // Sem restrições configuradas = acesso total
    
    return todasIntegracoes.filter(integracao => {
      const perm = whatsappPerms.find(p => p.integration_id === integracao.id);
      return perm ? perm.can_view : false;
    });
  }, [todasIntegracoes, usuario]);

  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    enabled: usuario?.role === 'admin' || usuario?.role === 'supervisor',
    staleTime: 5 * 60 * 1000,
    retry: 2
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

      const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
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

  const threadsFiltradas = threads.filter((thread) => {
    const contato = contatos.find((c) => c.id === thread.contact_id);
    if (!contato) return false;

    // ✅ FILTRO POR PERMISSÕES DE INSTÂNCIA DO USUÁRIO
    if (thread.whatsapp_integration_id && usuario) {
      const whatsappPerms = usuario.whatsapp_permissions || [];
      
      // Admin sempre pode ver todas
      if (usuario.role !== 'admin' && whatsappPerms.length > 0) {
        const perm = whatsappPerms.find(p => p.integration_id === thread.whatsapp_integration_id);
        if (!perm || !perm.can_view) {
          return false; // Usuário não tem permissão para ver threads desta instância
        }
      }
    }

    // ✅ FILTRO POR CANAL WHATSAPP (MULTI-INSTÂNCIA)
    if (selectedIntegrationId && selectedIntegrationId !== 'all') {
      if (thread.whatsapp_integration_id !== selectedIntegrationId) {
        return false;
      }
    }

    // 🔍 BUSCA AMPLIADA: Número + Empresa + Cargo + Nome
    if (debouncedSearchTerm) {
      const termoBusca = debouncedSearchTerm.toLowerCase();
      return (
        contato.nome?.toLowerCase().includes(termoBusca) ||
        contato.empresa?.toLowerCase().includes(termoBusca) ||
        contato.cargo?.toLowerCase().includes(termoBusca) ||
        thread.last_message_content?.toLowerCase().includes(termoBusca) ||
        contato.telefone?.includes(debouncedSearchTerm)
      );
    }

    return true;
  });

  const threadsComContato = threadsFiltradas.map(thread => ({
    ...thread,
    contato: contatos.find(c => c.id === thread.contact_id),
    atendente_atribuido: atendentes.find(a => a.id === thread.assigned_user_id)
  }));

  const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';
  const contatoAtivo = threadAtiva ? contatos.find(c => c.id === threadAtiva.contact_id) : null;

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p>Carregando usuário...</p>
        </div>
      </div>
    );
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
              {integracoes.length === 0 && (
                <Button
                  onClick={() => setMostrarInstrucoesWebhook(true)}
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-white hover:bg-white/20"
                >
                  Configurar Webhook
                </Button>
              )}

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
                    threadAtiva ? queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] }) : Promise.resolve()
                  ]);
                  toast.success("Atualizado!");
                }}
                className="border-white/30 text-white hover:bg-white/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <WebhookInstructions
          isOpen={mostrarInstrucoesWebhook}
          onClose={() => setMostrarInstrucoesWebhook(false)}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-6 flex-shrink-0">
            <TabsList className="bg-transparent">
              <TabsTrigger value="conversas" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                Conversas
              </TabsTrigger>
              <TabsTrigger value="controle" className="gap-2">
                <Activity className="w-4 h-4" />
                Controle Operacional
              </TabsTrigger>
              <TabsTrigger value="automacao" className="gap-2">
                <Zap className="w-4 h-4" />
                Automação
              </TabsTrigger>
              <TabsTrigger value="diagnostico" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Diagnóstico
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="gap-2">
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
                  />

                  <div className="flex-1 overflow-y-auto">
                    <ChatSidebar
                      threads={threadsComContato}
                      threadAtiva={threadAtiva}
                      onSelecionarThread={handleSelecionarThread}
                      loading={loadingThreads}
                      usuarioAtual={usuario}
                      integracoes={integracoes}
                    />
                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {threadAtiva && !criandoNovoContato ? (
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
                        />
                      </div>
                      
                      {showContactInfo && contatoAtivo && (
                        <ContactInfoPanel
                          contact={contatoAtivo}
                          threadAtual={threadAtiva}
                          onClose={() => setShowContactInfo(false)}
                          onUpdate={handleAtualizarContato}
                        />
                      )}
                    </>
                  ) : criandoNovoContato ? (
                    <>
                      <EmptyState 
                        message="Criar Novo Contato" 
                        subtitle="Preencha as informações ao lado" 
                      />
                      
                      <ContactInfoPanel
                        contact={null}
                        novoContatoTelefone={novoContatoTelefone}
                        onClose={() => {
                          setCriandoNovoContato(false);
                          setNovoContatoTelefone("");
                          setShowContactInfo(false);
                        }}
                        onUpdate={handleCriarNovoContato}
                      />
                    </>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB: CONTROLE OPERACIONAL - FILAS + SAÚDE + DASHBOARD CONSOLIDADO */}
            <TabsContent value="controle" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto bg-slate-900">
                <CentralControleOperacional 
                  onSelecionarThread={handleSelecionarThread}
                  usuarioAtual={usuario}
                />
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

            <TabsContent value="configuracoes" className="h-full m-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-6">
                <ConfiguracaoWhatsAppHub
                  integracoes={integracoes}
                  onRecarregar={() => queryClient.invalidateQueries({ queryKey: ['integracoes'] })}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}