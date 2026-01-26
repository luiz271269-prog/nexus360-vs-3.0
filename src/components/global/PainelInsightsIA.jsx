import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  X,
  TrendingUp,
  AlertTriangle,
  Target,
  Zap,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  User,
  Building2,
  Clock,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Video,
  Music,
  Download,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * 🆕 PAINEL INSIGHTS IA - VERSÃO 3.0 COM GALERIA DE MÍDIAS
 */

export default function PainelInsightsIA({
  entidade,
  entidadeTipo, // 'Orcamento', 'Cliente', 'Venda', etc.
  onClose
}) {
  const [loading, setLoading] = useState(true);
  const [dadosCRM, setDadosCRM] = useState(null);
  const [insights, setInsights] = useState(null);
  const [processandoAcao, setProcessandoAcao] = useState(false);
  const [midias, setMidias] = useState([]); // 🆕 NOVO
  const navigate = useNavigate();

  useEffect(() => {
    if (entidade) {
      carregarDadosCRM();
      gerarInsights();
    }
  }, [entidade?.id]);

  /**
   * Carrega dados completos do CRM relacionados à entidade
   */
  const carregarDadosCRM = async () => {
    if (!entidade) return;

    setLoading(true);
    try {
      let cliente = null;
      let orcamentos = [];
      let vendas = [];
      let interacoes = [];
      let score = null;
      let threads = [];
      let messages = []; // 🆕 NOVO

      // Identificar o cliente baseado no tipo de entidade
      if (entidadeTipo === 'Cliente') {
        cliente = entidade;
      } else if (entidadeTipo === 'Orcamento' && entidade.cliente_nome) {
        const clientes = await base44.entities.Cliente.filter({
          razao_social: entidade.cliente_nome
        });
        cliente = clientes[0] || null;
      }

      // Se encontrou o cliente, carregar dados relacionados
      if (cliente) {
        [orcamentos, vendas, interacoes, score, threads] = await Promise.all([
          base44.entities.Orcamento.filter({ cliente_nome: cliente.razao_social }),
          base44.entities.Venda.filter({ cliente_nome: cliente.razao_social }),
          base44.entities.Interacao.filter({ cliente_nome: cliente.razao_social }, '-data_interacao', 10),
          base44.entities.ClienteScore.filter({ cliente_id: cliente.id }).then(scores => scores[0] || null),
          base44.entities.MessageThread.filter({ contact_id: cliente.id })
        ]);

        // 🆕 Carregar mensagens com mídia
        if (threads.length > 0) {
          const threadIds = threads.map(t => t.id);
          const allMessages = [];
          
          for (const threadId of threadIds) {
            const msgs = await base44.entities.Message.filter({
              thread_id: threadId
            }, '-sent_at', 50); // Fetch latest 50 messages per thread for media
            allMessages.push(...msgs);
          }
          
          messages = allMessages;

          // Filtrar apenas mensagens com mídia
          const midiasEncontradas = messages
            .filter(m => m.media_url && m.media_type && m.media_type !== 'none')
            .map(m => ({
              id: m.id,
              url: m.media_url,
              tipo: m.media_type,
              nome: m.content || m.media_url.substring(m.media_url.lastIndexOf('/') + 1) || 'Mídia',
              data: m.sent_at,
              sender: m.sender_type,
              thread_id: m.thread_id
            }));

          setMidias(midiasEncontradas);
        }
      }

      setDadosCRM({
        cliente,
        orcamentos,
        vendas,
        interacoes,
        score,
        threads,
        valorTotal: vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0),
        taxaConversao: orcamentos.length > 0 ? Math.round((vendas.length / orcamentos.length) * 100) : 0
      });

    } catch (error) {
      console.error('[PainelInsightsIA] Erro ao carregar dados do CRM:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gera insights contextualizados usando IA
   */
  const gerarInsights = async () => {
    if (!entidade) return;

    try {
      // Importar NexusEngineV3 e gerar insight
      const { default: NexusEngineV3 } = await import('../inteligencia/NexusEngineV3');
      
      const contexto = {
        entidade_tipo: entidadeTipo,
        entidade_dados: entidade,
        objetivo: 'Analisar situação e sugerir melhor ação para maximizar resultado'
      };

      const insight = await NexusEngineV3.gerarInsightContextual({
        contexto,
        entidade_tipo: entidadeTipo,
        entidade_id: entidade.id,
        objetivo: contexto.objetivo
      });

      setInsights(insight);

    } catch (error) {
      console.error('[PainelInsightsIA] Erro ao gerar insights:', error);
    }
  };

  /**
   * Executa a ação imediata sugerida pela IA
   */
  const executarAcaoImediata = async () => {
    if (!insights?.proxima_acao) return;

    setProcessandoAcao(true);
    try {
      const acao = insights.proxima_acao.toLowerCase();

      // Ação: Comunicação (WhatsApp)
      if (acao.includes('whatsapp') || acao.includes('mensagem') || acao.includes('contato')) {
        if (dadosCRM?.cliente) {
          // Navegar para a Central de Comunicação com o cliente selecionado
          navigate(createPageUrl(`Comunicacao?cliente_id=${dadosCRM.cliente.id}`));
          toast.success('🚀 Abrindo WhatsApp com o cliente');
        } else {
          toast.warning('Cliente não encontrado para iniciar comunicação');
        }
      }
      // Ação: Criar Tarefa
      else if (acao.includes('tarefa') || acao.includes('agendar') || acao.includes('follow')) {
        const novaTarefa = await base44.entities.TarefaInteligente.create({
          titulo: insights.proxima_acao,
          descricao: insights.justificativa || 'Ação sugerida pela IA',
          tipo_tarefa: 'follow_up_orcamento',
          prioridade: insights.confianca > 80 ? 'alta' : 'media',
          cliente_id: dadosCRM?.cliente?.id,
          cliente_nome: dadosCRM?.cliente?.razao_social,
          orcamento_id: entidadeTipo === 'Orcamento' ? entidade.id : null,
          vendedor_responsavel: entidade.vendedor || 'Sistema',
          data_prazo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Amanhã
          status: 'pendente',
          contexto_ia: {
            motivo_criacao: insights.analise,
            sugestoes_abordagem: [insights.recomendacao]
          }
        });

        toast.success('✅ Tarefa criada e atribuída ao vendedor');
        navigate(createPageUrl('Agenda'));
      }
      // Ação: Ver Orçamento
      else if (acao.includes('orçamento') || acao.includes('proposta')) {
        if (entidadeTipo === 'Orcamento') {
          navigate(createPageUrl(`OrcamentoDetalhes?id=${entidade.id}`));
          toast.info('📄 Abrindo detalhes do orçamento');
        }
      }
      // Ação Padrão
      else {
        toast.info(`💡 Ação sugerida: ${insights.proxima_acao}`);
      }

      // Registrar feedback automático
      await base44.entities.BaseConhecimento.create({
        titulo: `Ação Executada: ${insights.proxima_acao}`,
        tipo_registro: 'resultado_acao',
        categoria: 'inteligencia',
        conteudo: `Ação imediata executada pelo vendedor a partir do Nexus Co-Piloto`,
        entidade_origem: entidadeTipo,
        id_entidade_origem: entidade.id,
        conteudo_estruturado: {
          acao: insights.proxima_acao,
          confianca_ia: insights.confianca,
          timestamp_execucao: new Date().toISOString()
        },
        tags: ['acao_imediata', 'nexus_copiloto', entidadeTipo.toLowerCase()],
        origem_ia: {
          motor_gerador: 'NexusEngine',
          timestamp_geracao: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[PainelInsightsIA] Erro ao executar ação:', error);
      toast.error('Erro ao executar ação sugerida');
    } finally {
      setProcessandoAcao(false);
    }
  };

  /**
   * 🆕 Renderiza ícone baseado no tipo de mídia
   */
  const renderIconeMidia = (tipo) => {
    if (tipo.startsWith('image')) {
      return <ImageIcon className="w-4 h-4" />;
    } else if (tipo.startsWith('video')) {
      return <Video className="w-4 h-4" />;
    } else if (tipo.startsWith('audio')) {
      return <Music className="w-4 h-4" />;
    } else if (tipo.startsWith('application') || tipo.startsWith('text')) {
      return <FileText className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />; // Default
  };

  /**
   * 🆕 Renderiza preview de mídia
   */
  const renderPreviewMidia = (midia) => {
    if (midia.tipo.startsWith('image')) {
      return (
        <img
          src={midia.url}
          alt={midia.nome}
          className="w-full h-32 object-cover rounded-lg"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImagem indisponível%3C/text%3E%3C/svg%3E';
          }}
        />
      );
    }

    return (
      <div className="w-full h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
        {renderIconeMidia(midia.tipo)}
        <span className="ml-2 text-sm text-slate-600 capitalize">{midia.tipo.split('/')[0]}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Brain className="w-12 h-12 text-purple-600 mx-auto mb-4 animate-pulse" />
            <p className="text-slate-700 font-semibold">Analisando com IA...</p>
            <p className="text-sm text-slate-500 mt-2">Carregando dados do CRM e gerando insights</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nexus Co-Piloto</h2>
                <p className="text-sm text-white/80">Análise Inteligente + Visão 360° + Galeria</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="insights">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Insights IA
                </TabsTrigger>
                <TabsTrigger value="crm">
                  <User className="w-4 h-4 mr-2" />
                  Dados CRM
                </TabsTrigger>
                <TabsTrigger value="midia">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Galeria ({midias.length})
                </TabsTrigger>
                <TabsTrigger value="historico">
                  <Clock className="w-4 h-4 mr-2" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Insights da IA */}
              <TabsContent value="insights" className="space-y-4 mt-4">
                {insights ? (
                  <>
                    {/* Análise */}
                    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
                          <Brain className="w-4 h-4" />
                          Análise da Situação
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 leading-relaxed">{insights.analise}</p>
                        {insights.confianca && (
                          <div className="mt-3 flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Confiança: {insights.confianca}%
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recomendação */}
                    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-900">
                          <TrendingUp className="w-4 h-4" />
                          Recomendação Estratégica
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{insights.recomendacao}</p>
                      </CardContent>
                    </Card>

                    {/* Ação Imediata - DESTAQUE */}
                    <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                          <Target className="w-4 h-4" />
                          Próxima Melhor Ação
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 font-semibold mb-4 leading-relaxed">{insights.proxima_acao}</p>
                        
                        {/* Botão de Ação Imediata */}
                        <Button
                          onClick={executarAcaoImediata}
                          disabled={processandoAcao}
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg"
                        >
                          {processandoAcao ? (
                            <>
                              <Zap className="w-4 h-4 mr-2 animate-spin" />
                              Executando...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-2" />
                              Executar Ação Agora
                              <ChevronRight className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Justificativa */}
                    {insights.justificativa && (
                      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
                            <Brain className="w-4 h-4" />
                            Justificativa
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-slate-600 italic leading-relaxed">{insights.justificativa}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Gerando insights...</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Dados do CRM */}
              <TabsContent value="crm" className="space-y-4 mt-4">
                {dadosCRM?.cliente ? (
                  <>
                    {/* Informações do Cliente */}
                    <Card className="border-2 border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Informações do Cliente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 text-xs">Razão Social</p>
                            <p className="font-semibold text-slate-900">{dadosCRM.cliente.razao_social}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">CNPJ</p>
                            <p className="font-semibold text-slate-900">{dadosCRM.cliente.cnpj || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Segmento</p>
                            <Badge className="mt-1">{dadosCRM.cliente.segmento || 'N/A'}</Badge>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Status</p>
                            <Badge className="mt-1" variant={dadosCRM.cliente.status === 'Ativo' ? 'default' : 'secondary'}>
                              {dadosCRM.cliente.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Contatos */}
                        <div className="pt-3 border-t space-y-2">
                          {dadosCRM.cliente.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-700">{dadosCRM.cliente.telefone}</span>
                            </div>
                          )}
                          {dadosCRM.cliente.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-700">{dadosCRM.cliente.email}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Score do Cliente */}
                    {dadosCRM.score && (
                      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
                            <Zap className="w-4 h-4" />
                            Score do Cliente
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-purple-700 mb-1">Score Total</p>
                              <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold text-purple-900">{dadosCRM.score.score_total}</div>
                                <span className="text-xs text-purple-600">/1000</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-purple-700 mb-1">Urgência</p>
                              <Badge className={`${
                                dadosCRM.score.score_urgencia > 75 ? 'bg-red-500' :
                                dadosCRM.score.score_urgencia > 50 ? 'bg-orange-500' :
                                'bg-blue-500'
                              } text-white`}>
                                {dadosCRM.score.score_urgencia}/100
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-purple-700 mb-1">Potencial Compra</p>
                              <Badge className="bg-green-500 text-white">
                                {dadosCRM.score.score_potencial_compra}/100
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-purple-700 mb-1">Valor Cliente</p>
                              <Badge className="bg-indigo-500 text-white">
                                {dadosCRM.score.score_valor_cliente}/100
                              </Badge>
                            </div>
                          </div>

                          {dadosCRM.score.proxima_melhor_acao && (
                            <div className="mt-4 p-3 bg-white/50 rounded-lg">
                              <p className="text-xs font-medium text-purple-900 mb-1">Melhor Ação Sugerida:</p>
                              <p className="text-sm text-purple-700">{dadosCRM.score.proxima_melhor_acao}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Resumo de Vendas */}
                    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-900">
                          <DollarSign className="w-4 h-4" />
                          Resumo Comercial
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold text-green-900">{dadosCRM.vendas.length}</p>
                            <p className="text-xs text-green-700">Vendas</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-900">{dadosCRM.orcamentos.length}</p>
                            <p className="text-xs text-green-700">Orçamentos</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-900">{dadosCRM.taxaConversao}%</p>
                            <p className="text-xs text-green-700">Conversão</p>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-white/50 rounded-lg">
                          <p className="text-xs text-green-700 mb-1">Valor Total em Vendas</p>
                          <p className="text-lg font-bold text-green-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dadosCRM.valorTotal)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Botões de Ação Rápida */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => {
                          navigate(createPageUrl(`Comunicacao?cliente_id=${dadosCRM.cliente.id}`));
                          toast.success('📱 Abrindo WhatsApp com o cliente');
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        WhatsApp
                      </Button>
                      <Button
                        onClick={() => {
                          navigate(createPageUrl(`Agenda`));
                          toast.info('📅 Abrindo Agenda');
                        }}
                        variant="outline"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Agendar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Dados do cliente não disponíveis</p>
                  </div>
                )}
              </TabsContent>

              {/* 🆕 TAB: GALERIA DE MÍDIAS */}
              <TabsContent value="midia" className="space-y-4 mt-4">
                {midias.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {midias.map((midia) => (
                      <Card key={midia.id} className="border-2 border-slate-200 overflow-hidden hover:border-indigo-400 transition-colors">
                        <CardContent className="p-0">
                          {renderPreviewMidia(midia)}
                          
                          <div className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {renderIconeMidia(midia.tipo)}
                                <span className="text-xs font-semibold text-slate-700 truncate">
                                  {midia.nome.substring(0, 30)}
                                  {midia.nome.length > 30 && '...'}
                                </span>
                              </div>
                              <Badge className="text-[10px]">
                                {midia.sender === 'user' ? 'Enviado' : 'Recebido'}
                              </Badge>
                            </div>

                            <p className="text-xs text-slate-500">
                              {format(new Date(midia.data), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => window.open(midia.url, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Abrir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = midia.url;
                                  a.download = midia.nome;
                                  a.click();
                                  toast.success('📥 Download iniciado');
                                }}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Baixar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold">Nenhuma mídia encontrada</p>
                    <p className="text-slate-400 text-sm mt-2">
                      Imagens, vídeos e documentos aparecerão aqui
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Histórico de Interações */}
              <TabsContent value="historico" className="space-y-3 mt-4">
                {dadosCRM?.interacoes && dadosCRM.interacoes.length > 0 ? (
                  dadosCRM.interacoes.map((interacao, idx) => (
                    <Card key={idx} className="border-2 border-slate-200">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            interacao.tipo_interacao === 'ligacao' ? 'bg-blue-100' :
                            interacao.tipo_interacao === 'whatsapp' ? 'bg-green-100' :
                            interacao.tipo_interacao === 'email' ? 'bg-purple-100' :
                            'bg-slate-100'
                          }`}>
                            {interacao.tipo_interacao === 'ligacao' && <Phone className="w-4 h-4 text-blue-600" />}
                            {interacao.tipo_interacao === 'whatsapp' && <MessageSquare className="w-4 h-4 text-green-600" />}
                            {interacao.tipo_interacao === 'email' && <Mail className="w-4 h-4 text-purple-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-slate-900 capitalize">{interacao.tipo_interacao}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(interacao.data_interacao).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <p className="text-sm text-slate-700">{interacao.observacoes || 'Sem observações'}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={interacao.resultado === 'sucesso' ? 'default' : 'secondary'} className="text-xs">
                                {interacao.resultado}
                              </Badge>
                              {interacao.temperatura_cliente && (
                                <Badge variant="outline" className="text-xs">
                                  {interacao.temperatura_cliente}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhuma interação registrada</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}