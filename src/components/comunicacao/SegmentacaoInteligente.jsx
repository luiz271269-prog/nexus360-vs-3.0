import React from "react";
const { useState, useEffect } = React;
import { base44 } from "@/api/base44Client";
import { analisarComportamentoContato } from "@/functions/analisarComportamentoContato";
import InsightRenderer from "@/components/comunicacao/InsightRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  MessageCircle,
  Clock,
  Tag as TagIcon,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Heart,
  Shield,
  Activity,
  AlertTriangle,
  Copy
} from "lucide-react";
import { toast } from "sonner";

export default function SegmentacaoInteligente({ 
  contactId,
  mode = "period",
  visibleThreadIds = [],
  activeThreadId = null,
  defaultPeriodoDias = 30
}) {
  const [analise, setAnalise] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [tags, setTags] = useState([]);
  const [periodoDias, setPeriodoDias] = useState(defaultPeriodoDias);
  const [modeAtual, setModeAtual] = useState(mode);

  useEffect(() => {
    carregarAnalise();
    carregarTags();
  }, [contactId]);

  const carregarAnalise = async () => {
    try {
      setLoading(true);
      const analises = await base44.entities.ContactBehaviorAnalysis.list('-analyzed_at', 1, { contact_id: contactId });
      
      if (analises.length > 0) {
        setAnalise(analises[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTags = async () => {
    try {
      const contactTags = await base44.entities.ContactTag.filter({ contact_id: contactId });
      const tagIds = contactTags.map(ct => ct.tag_id);
      
      if (tagIds.length > 0) {
        const todasTags = await base44.entities.Tag.list();
        const tagsDoContato = todasTags.filter(t => tagIds.includes(t.id));
        setTags(tagsDoContato.map(t => ({
          ...t,
          origem: contactTags.find(ct => ct.tag_id === t.id)?.origem
        })));
      } else {
        setTags([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const analisarComportamento = async () => {
    setAnalisando(true);
    
    // Guardrail para modo bolha
    if (modeAtual === "bubble" && (!visibleThreadIds || visibleThreadIds.length === 0)) {
      toast.error("Não há threads visíveis na bolha. Abra uma conversa ou mude para análise por período.");
      setAnalisando(false);
      return;
    }

    base44.analytics.track({
      eventName: "ai_segmentation_started",
      properties: {
        mode: modeAtual,
        periodo_dias: modeAtual === "period" ? periodoDias : null,
        visible_threads_count: modeAtual === "bubble" ? (visibleThreadIds?.length || 0) : null
      }
    });

    const toastId = toast.loading(
      `🤖 IA analisando ${modeAtual === "bubble" ? "conversas da bolha" : `últimos ${periodoDias} dias`}...`, 
      { duration: Infinity }
    );
    
    try {
      const payload = {
        contact_id: contactId,
        mode: modeAtual,
        active_thread_id: activeThreadId
      };

      if (modeAtual === "period") {
        payload.periodo_dias = periodoDias;
      }
      if (modeAtual === "bubble") {
        payload.visible_thread_ids = visibleThreadIds;
      }

      const resultado = await analisarComportamentoContato(payload);

      if (resultado.data.success) {
        const resumo = resultado.data.resumo;
        const payloadData = resultado.data.payload;
        
        setPayload(payloadData);

        base44.analytics.track({
          eventName: "ai_segmentation_completed",
          properties: {
            mode: modeAtual,
            periodo_dias: modeAtual === "period" ? periodoDias : null,
            segmento: resumo.segmento || null,
            priority: resumo.priority || null,
            score: resumo.score || null,
            tags_count: resumo.tags_atribuidas?.length || 0,
            bucket: resumo.bucket || null
          }
        });
        
        // Foto será buscada automaticamente ao recarregar o contato no ChatWindow
        
        // Mensagem de sucesso mais informativa
        toast.success(
          `✅ Análise concluída!\n` +
          `📊 Segmento: ${resumo.segmento?.replace(/_/g, ' ')}\n` +
          `⭐ Score: ${resumo.score}/100\n` +
          `${resumo.tags_atribuidas?.length > 0 ? `🏷️ ${resumo.tags_atribuidas.length} tag(s) aplicada(s)` : ''}`,
          { duration: 5000 }
        );

        // Atualizar MessageThreads com nova prioridade baseada na análise
        try {
          const threads = await base44.entities.MessageThread.list('-created_date', 10, { contact_id: contactId });
          
          if (threads.length > 0) {
            // Calcular prioridade baseada no segmento e score
            let novaPrioridade = 'normal';
            
            if (resumo.segmento === 'risco_churn' || resumo.score < 30) {
              novaPrioridade = 'urgente';
            } else if (resumo.segmento === 'lead_quente' || resumo.score > 80) {
              novaPrioridade = 'alta';
            } else if (resumo.segmento === 'lead_morno' || (resumo.score >= 50 && resumo.score <= 80)) {
              novaPrioridade = 'normal';
            } else {
              novaPrioridade = 'baixa';
            }

            // Atualizar prioridade das threads ativas
            for (const thread of threads) {
              if (thread.status === 'aberta' || thread.status === 'aguardando_cliente') {
                await base44.entities.MessageThread.update(thread.id, {
                  prioridade: novaPrioridade
                });
              }
            }

            console.log(`✅ Prioridade das conversas atualizada para: ${novaPrioridade}`);
          }
        } catch (threadError) {
          console.warn('Erro ao atualizar prioridade das threads:', threadError);
        }
        
        await carregarAnalise();
        await carregarTags();
        
        toast.dismiss(toastId);
      } else {
        throw new Error(resultado.data.error || 'Erro desconhecido na análise');
      }
    } catch (error) {
      console.error('❌ Erro ao analisar:', error);
      toast.dismiss(toastId);
      
      // Mensagens de erro mais amigáveis
      base44.analytics.track({
        eventName: "ai_segmentation_failed",
        properties: {
          mode: modeAtual,
          periodo_dias: modeAtual === "period" ? periodoDias : null,
          error: error.message?.substring(0, 100) || "unknown"
        }
      });

      let mensagemErro = 'Erro ao analisar comportamento';
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        mensagemErro = '⏳ Muitas requisições. Aguarde alguns segundos e tente novamente.';
      } else if (error.message?.includes('timeout')) {
        mensagemErro = '⏱️ Análise demorou muito. Tente novamente ou reduza o período.';
      } else if (error.message?.includes('Não autorizado')) {
        mensagemErro = '🔒 Você não tem permissão para analisar contatos.';
      } else if (error.message) {
        mensagemErro = `❌ ${error.message}`;
      }
      
      toast.error(mensagemErro, { duration: 6000 });
    } finally {
      setAnalisando(false);
    }
  };

  const getSegmentoColor = (segmento) => {
    const colors = {
      lead_frio: 'bg-blue-100 text-blue-800 border-blue-200',
      lead_morno: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      lead_quente: 'bg-orange-100 text-orange-800 border-orange-200',
      cliente_ativo: 'bg-green-100 text-green-800 border-green-200',
      cliente_inativo: 'bg-gray-100 text-gray-800 border-gray-200',
      suporte: 'bg-purple-100 text-purple-800 border-purple-200',
      vip: 'bg-pink-100 text-pink-800 border-pink-200',
      risco_churn: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[segmento] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentoIcon = (sentimento) => {
    if (sentimento?.includes('positivo')) return '😊';
    if (sentimento?.includes('negativo')) return '😟';
    return '😐';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com seletor de período e botão de análise */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Segmentação Inteligente</CardTitle>
            </div>
          </div>
          
          {/* Seletor de Modo */}
          <div className="flex items-center gap-2 mb-3">
            <Button
              size="sm"
              variant={modeAtual === "bubble" ? "default" : "outline"}
              onClick={() => setModeAtual("bubble")}
              className={modeAtual === "bubble" ? "bg-purple-600" : ""}
            >
              Conversas Visíveis
            </Button>
            <Button
              size="sm"
              variant={modeAtual === "period" ? "default" : "outline"}
              onClick={() => setModeAtual("period")}
              className={modeAtual === "period" ? "bg-purple-600" : ""}
            >
              Período
            </Button>
          </div>

          {/* Seletor de Período (apenas se mode === period) */}
          {modeAtual === "period" && (
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-slate-600 font-medium">Período:</span>
              <div className="flex gap-2">
                {[7, 15, 30, 60, 90].map(dias => (
                  <Button
                    key={dias}
                    onClick={() => setPeriodoDias(dias)}
                    variant={periodoDias === dias ? "default" : "outline"}
                    size="sm"
                    className={periodoDias === dias ? "bg-purple-600" : ""}
                  >
                    {dias}d
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={analisarComportamento}
            disabled={analisando}
            size="sm"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {analisando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {modeAtual === "bubble" ? "Analisando bolha..." : `Analisando ${periodoDias} dias...`}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {modeAtual === "bubble" ? "Analisar Conversas Visíveis" : `Analisar Últimos ${periodoDias} Dias`}
              </>
            )}
          </Button>

          {analise && (
            <CardDescription className="flex items-center gap-2 mt-3">
              <Clock className="w-3 h-3" />
              Última análise: {new Date(analise.ultima_analise).toLocaleString('pt-BR')}
              {(() => {
                const diasDesdeAnalise = Math.floor((Date.now() - new Date(analise.ultima_analise).getTime()) / (1000 * 60 * 60 * 24));
                if (diasDesdeAnalise > 7) {
                  return (
                    <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                      ⚠️ Recomendado reanalisar
                    </Badge>
                  );
                }
                return null;
              })()}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {!analise ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2 font-medium">Nenhuma análise disponível ainda</p>
            <p className="text-sm text-slate-500 mb-4">
              A IA analisará o histórico de mensagens visíveis para identificar padrões de comportamento,
              sentimento e recomendar ações baseadas nas conversas dos últimos {periodoDias} dias.
            </p>
            
            {/* Seletor de Período na primeira análise */}
            <div className="mb-4 p-3 bg-white rounded-lg border">
              <p className="text-xs text-slate-600 mb-2 font-medium">Selecione o período:</p>
              <div className="flex flex-wrap gap-2">
                {[7, 15, 30, 60, 90].map(dias => (
                  <Button
                    key={dias}
                    onClick={() => setPeriodoDias(dias)}
                    variant={periodoDias === dias ? "default" : "outline"}
                    size="sm"
                    className={periodoDias === dias ? "bg-purple-600" : ""}
                  >
                    {dias} dias
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={analisarComportamento} 
              disabled={analisando}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando últimos {periodoDias} dias...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analisar Últimos {periodoDias} Dias
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Aviso de Visibilidade */}
          {payload?.scope?.limited_by_visibility && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">{payload.scope.visibility_notice}</p>
              </CardContent>
            </Card>
          )}

          {/* Renderizar insights estruturados */}
          <InsightRenderer insights={payload} />

          {/* Scorecards (4 métricas principais) */}
          {payload && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Saúde
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">{payload.scores.health}</div>
                  <Progress value={payload.scores.health} className="h-1 mt-1" />
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Risco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">{payload.scores.deal_risk}</div>
                  <Progress value={payload.scores.deal_risk} className="h-1 mt-1" />
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Intenção
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">{payload.scores.buy_intent}</div>
                  <Progress value={payload.scores.buy_intent} className="h-1 mt-1" />
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Engajamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-700">{payload.scores.engagement}</div>
                  <Progress value={payload.scores.engagement} className="h-1 mt-1" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Causas Raiz + Evidências (Estrutura Profunda) */}
          {payload?.root_causes && payload.root_causes.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Por que está em risco? (Análise Detalhada)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {payload.root_causes.map((cause, i) => (
                  <div key={cause.id || i} className="p-3 bg-white rounded border-l-4 border-red-400">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-bold text-slate-900">{cause.title || cause.cause || cause}</p>
                      <Badge className={`text-xs ${
                        cause.severity === 'high' ? 'bg-red-500' :
                        cause.severity === 'medium' ? 'bg-orange-500' :
                        'bg-yellow-500'
                      } text-white`}>
                        {cause.severity || 'info'}
                      </Badge>
                    </div>
                    {cause.why && (
                      <p className="text-xs text-slate-700 mb-2">📋 {cause.why}</p>
                    )}
                    {payload.evidence_snippets?.[i] && (
                      <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 italic font-mono">
                          💬 "{payload.evidence_snippets[i].snippet}"
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          🕐 {new Date(payload.evidence_snippets[i].ts).toLocaleDateString('pt-BR')} • {payload.evidence_snippets[i].topic}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Estágio + Dias Parado */}
          {payload && (
            <Card className="border-slate-300">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Estágio no Funil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge className="text-sm px-3 py-1">
                    {payload.stage.current?.replace(/_/g, ' ')}
                  </Badge>
                  {payload.stage.days_stalled > 0 && (
                    <div className="text-sm text-slate-600">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Parado há <span className="font-bold">{payload.stage.days_stalled}</span> dia(s)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alertas */}
          {payload?.alerts?.length > 0 && (
            <Card className="border-orange-300 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  Alertas de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {payload.alerts.map((alert, i) => (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${
                    alert.level === 'alto' ? 'bg-red-100 border border-red-300' :
                    alert.level === 'medio' ? 'bg-yellow-100 border border-yellow-300' :
                    'bg-blue-100 border border-blue-300'
                  }`}>
                    <AlertCircle className={`w-4 h-4 mt-0.5 ${
                      alert.level === 'alto' ? 'text-red-600' :
                      alert.level === 'medio' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                    <p className="text-sm font-medium">{alert.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Próxima Ação Estruturada com Passos e Handoff */}
          {payload?.next_best_action && (
            <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  Próxima Ação Recomendada (Plano de Ação)
                  {payload.next_best_action.need_manager && (
                    <Badge className="bg-red-500 text-white text-xs ml-auto">⚠️ Gerente</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Objetivo */}
                <div className="bg-white p-3 rounded border border-green-200">
                  <p className="text-xs text-slate-500 font-medium mb-1">📌 Objetivo:</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {payload.next_best_action.objective || payload.next_best_action.action}
                  </p>
                </div>

                {/* Passos */}
                {payload.next_best_action.steps && payload.next_best_action.steps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700">📋 Passos Prioritários:</p>
                    {payload.next_best_action.steps.map((step, i) => (
                      <div key={i} className="p-2 bg-white rounded border-l-4 border-green-400">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold text-green-600 bg-green-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                            {step.step}
                          </span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-800">{step.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{step.detail}</p>
                            {step.due_at && (
                              <p className="text-xs text-slate-500 mt-1">
                                ⏰ {new Date(step.due_at).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Handoff Recomendado */}
                {payload.next_best_action.handoff_recommended && payload.next_best_action.handoff_recommended.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700">🤝 Encaminhamentos:</p>
                    {payload.next_best_action.handoff_recommended.map((handoff, i) => (
                      <div key={i} className="p-2 bg-white rounded border border-amber-200">
                        <div className="flex items-start gap-2">
                          <Badge className={`text-xs flex-shrink-0 ${
                            handoff.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'
                          } text-white`}>
                            {handoff.priority}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-800">{handoff.to_team}</p>
                            <p className="text-xs text-slate-600">{handoff.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mensagem Sugerida */}
                {payload.next_best_action.message_suggestion && (
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="text-xs text-slate-500 mb-1 font-bold">💬 Mensagem Sugerida:</p>
                    <p className="text-xs text-slate-700 mb-3 leading-relaxed whitespace-pre-wrap">
                      {payload.next_best_action.message_suggestion}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(payload.next_best_action.message_suggestion);
                        toast.success('Mensagem copiada!');
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar para WhatsApp
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Objeções com Estratégia de Desbloqueio */}
          {payload?.objections?.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Objeções & Estratégia de Desbloqueio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {payload.objections.map((obj, i) => (
                  <div key={obj.id || i} className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">{obj.type}</Badge>
                        <p className="text-sm font-semibold text-slate-800">"{obj.text}"</p>
                      </div>
                      <Badge className={`text-xs ${
                        obj.severity === 'alta' || obj.severity === 'high' ? 'bg-red-500' :
                        obj.severity === 'media' || obj.severity === 'medium' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      } text-white flex-shrink-0`}>
                        {obj.severity}
                      </Badge>
                    </div>
                    {obj.handling && (
                      <p className="text-xs text-green-700 font-medium mt-2">
                        💡 Como destravar: {obj.handling}
                      </p>
                    )}
                    {obj.context && (
                      <p className="text-xs text-slate-600 mt-2">📝 Contexto: {obj.context}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Topics */}
          {payload?.topics?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Temas Dominantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payload.topics.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700 min-w-24">{topic.name}</span>
                      <Progress value={topic.weight * 100} className="h-2 flex-1" />
                      <span className="text-xs text-slate-500">{Math.round(topic.weight * 100)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Segmento e Score (mantidos para compatibilidade) */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Segmento</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={`text-base px-3 py-1 ${getSegmentoColor(analise.segmento_sugerido)}`}>
                  <Target className="w-4 h-4 mr-2" />
                  {analise.segmento_sugerido?.replace(/_/g, ' ')}
                </Badge>
                <p className="text-xs text-slate-500 mt-2">
                  Confiança: {analise.confianca_segmentacao}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Score Engajamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-purple-600">
                    {analise.score_engajamento}
                  </div>
                  <div className="flex-1">
                    <Progress value={analise.score_engajamento} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Engajamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Métricas de Engajamento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Total de Mensagens</p>
                <p className="text-2xl font-bold">{analise.metricas_engajamento?.total_mensagens || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Taxa de Resposta</p>
                <p className="text-2xl font-bold">
                  {(() => {
                    const taxa = analise.metricas_engajamento?.taxa_resposta;
                    return typeof taxa === "number" ? taxa.toFixed(1) : "0.0";
                  })()}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tempo Médio Resposta (Empresa)</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {(() => {
                    const tempo = analise.metricas_engajamento?.avg_reply_minutes_company ?? 
                                  analise.metricas_engajamento?.tempo_medio_resposta_minutos;
                    return typeof tempo === "number" ? Math.round(tempo) : 0;
                  })()}min
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Frequência</p>
                <p className="text-xl font-bold">
                  A cada {analise.metricas_engajamento?.frequencia_media_dias?.toFixed(1) || 0} dias
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sentimento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {getSentimentoIcon(analise.analise_sentimento?.sentimento_predominante)}
                Análise de Sentimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">Sentimento Predominante</span>
                    <Badge variant="outline">
                      {analise.analise_sentimento?.sentimento_predominante?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <Progress 
                    value={analise.analise_sentimento?.score_sentimento || 50} 
                    className="h-2"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {analise.analise_sentimento?.evolucao_sentimento === 'melhorando' && (
                    <><TrendingUp className="w-4 h-4 text-green-600" /> Melhorando</>
                  )}
                  {analise.analise_sentimento?.evolucao_sentimento === 'piorando' && (
                    <><TrendingDown className="w-4 h-4 text-red-600" /> Piorando</>
                  )}
                  {analise.analise_sentimento?.evolucao_sentimento === 'estavel' && (
                    <><span className="text-slate-400">—</span> Estável</>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Próxima Ação Sugerida */}
          {analise.proxima_acao_sugerida && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-600" />
                  Próxima Ação Sugerida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-700">
                  {analise.proxima_acao_sugerida}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tags Automáticas */}
          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags Aplicadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="gap-1"
                      style={{ borderColor: tag.cor, color: tag.cor }}
                    >
                      {tag.nome}
                      {tag.origem === 'ia' && (
                        <Brain className="w-3 h-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Palavras-Chave com Relevância */}
          {analise.palavras_chave_frequentes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Palavras-Chave Comerciais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analise.palavras_chave_frequentes.slice(0, 10).map((palavra, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className={`gap-1 ${
                        palavra.relevancia_comercial >= 8 ? 'bg-orange-100 text-orange-800 border-orange-300' : 
                        palavra.relevancia_comercial >= 6 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 
                        'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {palavra.palavra}
                      <span className="text-xs opacity-70">({palavra.frequencia}x)</span>
                      {palavra.relevancia_comercial >= 8 && <Sparkles className="w-3 h-3" />}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}


        </>
      )}
    </div>
  );
}