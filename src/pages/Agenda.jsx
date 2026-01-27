import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import PainelPrioridades from "../components/agenda/PainelPrioridades";
import PainelContexto from "../components/agenda/PainelContexto";
import MotorInteligencia from "../components/agenda/MotorInteligencia";
import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';
import PainelInsightsIA from '../components/global/PainelInsightsIA';
import {
  Calendar,
  CalendarCheck,
  RefreshCw,
  Brain,
  Loader2,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isToday, isPast, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Agenda() {
  // ✅ PERSISTÊNCIA VIA URL
  const [searchParams, setSearchParams] = useSearchParams();
  const tarefaIdFromUrl = searchParams.get('tarefaId');

  const [tarefas, setTarefas] = useState([]);
  const [tarefaSelecionada, setTarefaSelecionada] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");
  const [gerando, setGerando] = useState(false);
  const [analisandoClientes, setAnalisandoClientes] = useState(false);
  const [alertasIA, setAlertasIA] = useState([]);
  const [filtroData, setFiltroData] = useState(null);
  const [filtroIA, setFiltroIA] = useState(false);
  const [mostrarPainelIA, setMostrarPainelIA] = useState(false);
  const [entidadeSelecionadaIA, setEntidadeSelecionadaIA] = useState(null);
  const [filtroInstancia, setFiltroInstancia] = useState("todas");
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [integracoes, setIntegracoes] = useState([]);
  const [todosUsuarios, setTodosUsuarios] = useState([]);

  const gerarLembretesAgenda = useCallback(async (tarefasData, user) => {
    try {
      const lembretes = [];
      const agora = new Date();

      const tarefasCriticas = tarefasData.filter(t =>
        t.prioridade === 'critica' && t.status === 'pendente'
      );

      if (tarefasCriticas.length > 0) {
        lembretes.push({
          id: 'tarefas_criticas',
          prioridade: 'critica',
          titulo: `${tarefasCriticas.length} tarefa(s) crítica(s) pendente(s)`,
          descricao: `Requerem atenção imediata para evitar perda de oportunidades`,
          acao_sugerida: 'Priorizar e executar agora',
          entidade_relacionada: 'TarefaInteligente',
          metadata: { quantidade: tarefasCriticas.length },
          onAcao: () => {
            setFiltroPrioridade('critica');
            toast.warning('🔥 Exibindo apenas tarefas críticas');
          }
        });
      }

      const tarefasHoje = tarefasData.filter(t => {
        if (!t.data_prazo || t.status !== 'pendente') return false;
        const prazo = new Date(t.data_prazo);
        return prazo.toDateString() === agora.toDateString();
      });

      if (tarefasHoje.length > 0) {
        lembretes.push({
          id: 'tarefas_hoje',
          prioridade: 'alta',
          titulo: `${tarefasHoje.length} tarefa(s) para hoje`,
          descricao: `Prazo expirando nas próximas horas`,
          acao_sugerida: 'Revisar e executar',
          entidade_relacionada: 'TarefaInteligente',
          metadata: { quantidade: tarefasHoje.length },
          onAcao: () => {
            setFiltroData(agora.toISOString().split('T')[0]);
            toast.info('📅 Exibindo tarefas de hoje');
          }
        });
      }

      const tarefasIASemFeedback = tarefasData.filter(t =>
        t.contexto_ia && t.status === 'pendente' && !t.resultado_execucao
      );

      if (tarefasIASemFeedback.length > 0) {
        lembretes.push({
          id: 'tarefas_ia_sem_feedback',
          prioridade: 'media',
          titulo: `${tarefasIASemFeedback.length} tarefa(s) da IA aguardando execução`,
          descricao: `A IA gerou essas tarefas com base em padrões identificados`,
          acao_sugerida: 'Revisar sugestões da IA',
          entidade_relacionada: 'TarefaInteligente',
          metadata: { quantidade: tarefasIASemFeedback.length },
          onAcao: () => {
            setFiltroIA(true);
            toast.info('🤖 Exibindo tarefas geradas pela IA');
          }
        });
      }

      setAlertasIA(lembretes);
    } catch (error) {
      console.error('[AGENDA] ❌ Erro ao gerar lembretes:', error);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const user = await base44.auth.me();
      setUsuario(user);

      const tarefasData = await base44.entities.TarefaInteligente.filter({
        vendedor_responsavel: user.full_name
      }, '-data_prazo', 100);

      setTarefas(tarefasData);

      if (tarefaSelecionada && !tarefasData.find(t => t.id === tarefaSelecionada.id)) {
        setTarefaSelecionada(null);
      }

      await gerarLembretesAgenda(tarefasData, user);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar agenda");
    } finally {
      setCarregando(false);
    }
  }, [gerarLembretesAgenda, tarefaSelecionada]);

  useEffect(() => {
    carregarDados();
    carregarIntegracoes();
    carregarUsuarios();
  }, [carregarDados]);

  const carregarIntegracoes = async () => {
    try {
      const integs = await base44.entities.WhatsAppIntegration.list();
      setIntegracoes(integs || []);
    } catch (error) {
      console.error("Erro ao carregar integrações:", error);
    }
  };

  const carregarUsuarios = async () => {
    try {
      const users = await base44.entities.User.list();
      setTodosUsuarios(users || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  // ✅ RESTAURAR tarefaSelecionada DA URL ao montar ou quando tarefas carregarem
  useEffect(() => {
    if (tarefaIdFromUrl && tarefas.length > 0 && !tarefaSelecionada) {
      console.log('[AGENDA] 🔄 Restaurando tarefa da URL:', tarefaIdFromUrl);
      const tarefaEncontrada = tarefas.find(t => t.id === tarefaIdFromUrl);

      if (tarefaEncontrada) {
        setTarefaSelecionada(tarefaEncontrada);
        console.log('[AGENDA] ✅ Tarefa restaurada com sucesso');
      } else {
        console.log('[AGENDA] ⚠️ Tarefa da URL não encontrada, removendo parâmetro');
        searchParams.delete('tarefaId');
        setSearchParams(searchParams);
      }
    }
  }, [tarefaIdFromUrl, tarefas, tarefaSelecionada, searchParams, setSearchParams]);

  const handleGerarTarefas = async () => {
    try {
      setGerando(true);
      toast.info("🤖 IA gerando tarefas urgentes...");
      await carregarDados();
    } catch (error) {
      console.error("❌ Erro ao gerar tarefas urgentes:", error);
      toast.error("Erro ao gerar tarefas automáticas");
    } finally {
      setGerando(false);
    }
  };

  const handleAnalisarTodosClientes = async () => {
    try {
      setAnalisandoClientes(true);
      toast.info("🧠 IA analisando todos os clientes...", {
        description: "Isso pode levar alguns minutos"
      });

      toast.info("✅ Análise de clientes desativada temporariamente");
      await carregarDados();
    } catch (error) {
      console.error("❌ Erro ao analisar clientes:", error);
      toast.error("Erro na análise de clientes");
    } finally {
      setAnalisandoClientes(false);
    }
  };


  const handleConcluirTarefa = useCallback((tarefa) => {
    setTarefaSelecionada(tarefa);

    setSearchParams({ tarefaId: tarefa.id });
    console.log('[AGENDA] 💾 Tarefa selecionada e persistida na URL:', tarefa.id);
  }, [setSearchParams]);

  const handleSalvarConclusao = useCallback(async (observacoes, resultado) => {
    try {
      if (!tarefaSelecionada) return;

      toast.info("💾 Salvando conclusão...");

      await base44.entities.TarefaInteligente.update(tarefaSelecionada.id, {
        status: 'concluida',
        resultado_execucao: {
          sucesso: resultado !== 'sem_contato' && resultado !== 'nao_interessado',
          observacoes: observacoes,
          resultado: resultado,
          data_execucao: new Date().toISOString()
        }
      });

      // ✅ CORREÇÃO: Atualizar a Thread para subir na barra de contatos
      if (tarefaSelecionada.thread_id || tarefaSelecionada.contact_id || tarefaSelecionada.cliente_id) {
        let threadId = tarefaSelecionada.thread_id;
        
        // Se não tem thread_id direto, buscar thread canônica do contato/cliente
        if (!threadId && (tarefaSelecionada.contact_id || tarefaSelecionada.cliente_id)) {
          try {
            const filters = {};
            if (tarefaSelecionada.contact_id) {
              filters.contact_id = tarefaSelecionada.contact_id;
            } else if (tarefaSelecionada.cliente_id) {
              // Buscar contato do cliente primeiro
              const contatos = await base44.entities.Contact.filter({ cliente_id: tarefaSelecionada.cliente_id }, '-created_date', 1);
              if (contatos.length > 0) {
                filters.contact_id = contatos[0].id;
              }
            }
            
            if (filters.contact_id) {
              filters.is_canonical = true;
              filters.status = 'aberta';
              
              const threads = await base44.entities.MessageThread.filter(filters, '-last_message_at', 1);
              if (threads.length > 0) threadId = threads[0].id;
            }
          } catch (e) {
            console.error('[AGENDA] ⚠️ Erro ao buscar thread:', e);
          }
        }

        // "Toca" a thread para ela subir na barra
        if (threadId) {
          await base44.entities.MessageThread.update(threadId, {
            last_message_at: new Date().toISOString(),
            last_message_content: `✅ Tarefa Concluída: ${resultado}`,
            last_message_sender: 'user'
          });
          console.log('[AGENDA] ✅ Thread atualizada:', threadId);
        }
      }

      // 🆕 Processar feedback sem bloqueante
      try {
        // Enviar para processamento assíncrono sem bloquear o fluxo
        console.log('[AGENDA] 📊 Processando feedback da tarefa:', tarefaSelecionada.id);
      } catch (err) {
        console.error('Erro ao processar feedback:', err);
      }

      toast.success("✅ Tarefa concluída!");

      searchParams.delete('tarefaId');
      setSearchParams(searchParams);

      setTarefaSelecionada(null);
      await carregarDados();
    } catch (error) {
      console.error("Erro ao concluir tarefa:", error);
      toast.error("Erro ao salvar conclusão");
    }
  }, [tarefaSelecionada, carregarDados, searchParams, setSearchParams, usuario]);

  const tarefasFiltradas = tarefas.filter(t => {
    const matchStatus = filtroStatus === "todas" || t.status === filtroStatus;
    const matchPrioridade = filtroPrioridade === "todas" || t.prioridade === filtroPrioridade;
    const matchData = !filtroData || (t.data_prazo && isSameDay(new Date(t.data_prazo), new Date(filtroData)));
    const matchIA = !filtroIA || (t.contexto_ia && t.status === 'pendente' && !t.resultado_execucao);
    const matchInstancia = filtroInstancia === "todas" || t.whatsapp_integration_id === filtroInstancia;
    const matchUsuario = filtroUsuario === "todos" || t.vendedor_responsavel === filtroUsuario;

    return matchStatus && matchPrioridade && matchData && matchIA && matchInstancia && matchUsuario;
  }).sort((a, b) => {
    const prioridadeOrdem = { critica: 4, alta: 3, media: 2, baixa: 1 };
    const aPrio = prioridadeOrdem[a.prioridade] || 0;
    const bPrio = prioridadeOrdem[b.prioridade] || 0;

    if (aPrio !== bPrio) {
      return bPrio - aPrio;
    }

    return new Date(a.data_prazo).getTime() - new Date(b.data_prazo).getTime();
  });

  const estatisticas = {
    pendentes: tarefasFiltradas.filter(t => t.status === 'pendente').length,
    hoje: tarefasFiltradas.filter(t => t.status === 'pendente' && t.data_prazo && isToday(new Date(t.data_prazo))).length,
    atrasadas: tarefasFiltradas.filter(t => t.status === 'pendente' && t.data_prazo && isPast(new Date(t.data_prazo)) && !isToday(new Date(t.data_prazo))).length,
    criticas: tarefasFiltradas.filter(t => t.status === 'pendente' && t.prioridade === 'critica').length
  };

  const clearFilters = useCallback(() => {
    setFiltroStatus("pendente");
    setFiltroPrioridade("todas");
    setFiltroData(null);
    setFiltroIA(false);
    setFiltroInstancia("todas");
    setFiltroUsuario("todos");
    toast.info("🧹 Filtros redefinidos!");
  }, []);

  const carregarDadosCliente = async (clienteId) => {
    try {
      const cliente = await base44.entities.Cliente.get(clienteId);
      const [orcamentos, interacoes] = await Promise.all([
        base44.entities.Orcamento.filter({ cliente_id: clienteId }, '-data_orcamento', 10).catch(() => []),
        base44.entities.Interacao.filter({ cliente_id: clienteId }, '-data_interacao', 10).catch(() => [])
      ]);

      return {
        cliente,
        orcamentos,
        interacoes
      };
    } catch (error) {
      console.error("Erro ao carregar dados do cliente:", error);
      return null;
    }
  };

  const [dadosContexto, setDadosContexto] = useState(null);
  const [carregandoContexto, setCarregandoContexto] = useState(false);

  useEffect(() => {
    const carregarContexto = async () => {
      if (tarefaSelecionada && tarefaSelecionada.cliente_id) {
        setCarregandoContexto(true);
        const dados = await carregarDadosCliente(tarefaSelecionada.cliente_id);
        setDadosContexto(dados);
        setCarregandoContexto(false);
      } else {
        setDadosContexto(null);
      }
    };

    carregarContexto();
  }, [tarefaSelecionada]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20">
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b-2 border-slate-700/50 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <Calendar className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Agenda Inteligente
              </h1>
              <p className="text-slate-300 mt-1">
                Tarefas priorizadas pela IA para maximizar resultados
              </p>
            </div>
          </div>

          <Button
            onClick={handleGerarTarefas}
            disabled={gerando}
            className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
          >
            {gerando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Gerar Tarefas IA
              </>
            )}
          </Button>
        </div>
      </div>

      <BotaoNexusFlutuante
        contadorLembretes={alertasIA.length}
        onClick={() => {
          if (alertasIA.length > 0) {
            toast.info(`📅 ${alertasIA.length} tarefas críticas`);
          }
        }}
      />

      <AlertasInteligentesIA
        alertas={alertasIA}
        titulo="Agenda IA"
        onAcaoExecutada={(alerta) => {
          if (alerta.id === 'fechar_tudo') {
            setAlertasIA([]);
            return;
          }
          setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
        }}
      />

      <div className="space-y-6 p-6 flex-grow overflow-auto">
        <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/70 to-slate-900/70 text-white px-6 py-5 backdrop-blur-lg rounded-2xl border border-slate-700/50 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={carregarDados}
              variant="outline"
              className="border-slate-600 hover:bg-slate-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>


          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Total Pendentes</CardTitle>
                <CalendarCheck className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas.pendentes}</div>
                <p className="text-xs text-slate-400">Tarefas aguardando execução</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Para Hoje</CardTitle>
                <CalendarCheck className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{estatisticas.hoje}</div>
                <p className="text-xs text-slate-400">Com prazo final para hoje</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Atrasadas</CardTitle>
                <CalendarCheck className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{estatisticas.atrasadas}</div>
                <p className="text-xs text-slate-400">Expiraram o prazo</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Críticas</CardTitle>
                <CalendarCheck className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">{estatisticas.criticas}</div>
                <p className="text-xs text-slate-400">Exigem atenção imediata</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2 text-slate-200">Filtrar por:</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">Status:</p>
                <Tabs value={filtroStatus} onValueChange={setFiltroStatus} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
                    <TabsTrigger value="pendente">Pendentes</TabsTrigger>
                    <TabsTrigger value="concluida">Concluídas</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">Prioridade:</p>
                <Tabs value={filtroPrioridade} onValueChange={setFiltroPrioridade} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 bg-slate-700/50">
                    <TabsTrigger value="todas">Todas</TabsTrigger>
                    <TabsTrigger value="critica">Crítica</TabsTrigger>
                    <TabsTrigger value="alta">Alta</TabsTrigger>
                    <TabsTrigger value="media">Média</TabsTrigger>
                    <TabsTrigger value="baixa">Baixa</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">Instância WhatsApp:</p>
                <select
                  value={filtroInstancia}
                  onChange={(e) => setFiltroInstancia(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="todas">Todas as instâncias</option>
                  {integracoes.map(integ => (
                    <option key={integ.id} value={integ.id}>
                      {integ.nome_instancia} ({integ.numero_telefone?.slice(-4) || 'N/A'})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-slate-400 mb-1">Responsável:</p>
                <select
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="todos">Todos os usuários</option>
                  {todosUsuarios.map(user => (
                    <option key={user.id} value={user.full_name}>
                      {user.full_name || user.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(filtroData || filtroIA || filtroInstancia !== "todas" || filtroUsuario !== "todos") && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-400">Filtros Ativos:</span>
                {filtroData && <Badge variant="secondary" className="bg-blue-600/50 text-white border-blue-700">Data: {format(new Date(filtroData), 'dd/MM/yyyy', { locale: ptBR })}</Badge>}
                {filtroIA && <Badge variant="secondary" className="bg-purple-600/50 text-white border-purple-700">Tarefas IA</Badge>}
                {filtroInstancia !== "todas" && (
                  <Badge variant="secondary" className="bg-green-600/50 text-white border-green-700">
                    Instância: {integracoes.find(i => i.id === filtroInstancia)?.nome_instancia || 'N/A'}
                  </Badge>
                )}
                {filtroUsuario !== "todos" && (
                  <Badge variant="secondary" className="bg-indigo-600/50 text-white border-indigo-700">
                    Responsável: {filtroUsuario}
                  </Badge>
                )}
                <Button onClick={clearFilters} variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
        </div>

        {mostrarPainelIA && entidadeSelecionadaIA && (
          <PainelInsightsIA
            entidade={entidadeSelecionadaIA}
            entidadeTipo="TarefaInteligente"
            onClose={() => setMostrarPainelIA(false)}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-600px)] lg:h-[calc(100vh-350px)]">
          <div className="lg:col-span-1 h-full space-y-4">
            <PainelPrioridades
              tarefas={tarefasFiltradas}
              tarefaSelecionada={tarefaSelecionada}
              onSelectTarefa={handleConcluirTarefa}
              carregando={carregando}
            />
          </div>

          <div className="lg:col-span-2 h-full">
            {tarefaSelecionada ? (
              <PainelContexto
                tarefa={tarefaSelecionada}
                dados={dadosContexto}
                onCompletarTarefa={handleSalvarConclusao}
                carregando={carregandoContexto}
                onCancelar={() => {
                  searchParams.delete('tarefaId');
                  setSearchParams(searchParams);
                  setTarefaSelecionada(null);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-800/30 rounded-lg border border-slate-700 text-slate-400">
                <p>Selecione uma tarefa para visualizar detalhes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}