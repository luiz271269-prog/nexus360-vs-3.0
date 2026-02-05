import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Brain,
  Target,
  MessageCircle,
  Zap,
  AlertCircle,
  TrendingUp,
  Clock,
  Copy,
  Download,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function AnaliseDetalhadaContato() {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get("contact_id");
  const [contact, setContact] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contactId) {
      carregarDados();
    }
  }, [contactId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar contato
      const [contactData] = await base44.entities.Contact.filter({ id: contactId });
      setContact(contactData);

      // Buscar análise mais recente
      const analises = await base44.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contactId },
        '-ultima_analise',
        1
      );
      if (analises.length > 0) {
        setAnalise(analises[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!analise) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">Nenhuma análise disponível para este contato</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const insights = analise.insights || {};
  const scores = insights.scores || {};
  const stage = insights.stage || {};
  const rootCauses = insights.root_causes || [];
  const evidences = insights.evidence_snippets || [];
  const alerts = insights.alerts || [];
  const nextAction = insights.next_best_action || {};
  const objections = insights.objections || [];
  const topics = insights.topics || [];

  const getScoreColor = (value) => {
    if (value >= 75) return 'text-green-700';
    if (value >= 50) return 'text-amber-700';
    return 'text-red-700';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="w-8 h-8 text-purple-600" />
              Análise Profunda do Contato
            </h1>
            {contact && (
              <p className="text-lg text-slate-600 mt-2">
                {contact.nome} • {contact.empresa}
              </p>
            )}
            <p className="text-sm text-slate-500 mt-1">
              📊 Análise de: {new Date(analise.ultima_analise).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <Button
            onClick={carregarDados}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Scorecards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-600">Saúde</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(scores.health)}`}>
                {scores.health}
              </div>
              <Progress value={scores.health} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-600">Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(scores.deal_risk)}`}>
                {scores.deal_risk}
              </div>
              <Progress value={scores.deal_risk} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-600">Intenção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(scores.buy_intent)}`}>
                {scores.buy_intent}
              </div>
              <Progress value={scores.buy_intent} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-600">Engajamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(scores.engagement)}`}>
                {scores.engagement}
              </div>
              <Progress value={scores.engagement} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Estágio */}
        {stage.current && (
          <Card className="border-slate-300">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                Estágio no Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Badge className="text-sm px-3 py-1 bg-purple-600">
                  {stage.current?.replace(/_/g, ' ')}
                </Badge>
                <p className="text-xs text-slate-600 mt-2">{stage.label}</p>
              </div>
              {stage.days_stalled > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
                  <Clock className="w-4 h-4" />
                  <span>Parado há <strong>{stage.days_stalled}</strong> dia(s)</span>
                </div>
              )}
              {stage.pipeline_hint && (
                <div className="space-y-1 mt-3">
                  {stage.pipeline_hint.map((hint, i) => (
                    <p key={i} className="text-xs text-slate-700">
                      • {hint}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Causas Raiz + Evidências */}
        {rootCauses.length > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Por Que Está em Risco? (Causas Raiz)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rootCauses.map((cause, i) => (
                <div key={cause.id || i} className="p-3 bg-white rounded border-l-4 border-red-400">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-bold text-slate-900">{cause.title}</p>
                    <Badge className={`text-xs text-white ${getSeverityColor(cause.severity)}`}>
                      {cause.severity}
                    </Badge>
                  </div>
                  {cause.why && (
                    <p className="text-xs text-slate-700 mb-2">📋 {cause.why}</p>
                  )}
                  {evidences[i] && (
                    <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                      <p className="text-xs text-slate-600 italic font-mono">
                        💬 "{evidences[i].text}"
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        🕐 {new Date(evidences[i].ts).toLocaleDateString('pt-BR')} • {evidences[i].topic}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Alertas */}
        {alerts.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Alertas Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={alert.id || i} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'high' ? 'bg-red-100 border-red-400' :
                  alert.severity === 'medium' ? 'bg-yellow-100 border-yellow-400' :
                  'bg-blue-100 border-blue-400'
                }`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                    <Badge className={`text-xs text-white ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-700">{alert.action}</p>
                  {alert.due_at && (
                    <p className="text-xs text-slate-600 mt-1">
                      ⏰ Vencimento: {new Date(alert.due_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Próxima Ação Estruturada */}
        {nextAction.objective && (
          <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                Próxima Ação (Plano de Ação)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white p-3 rounded border border-green-200">
                <p className="text-xs text-slate-500 font-medium mb-1">📌 Objetivo:</p>
                <p className="text-sm font-semibold text-slate-800">{nextAction.objective}</p>
              </div>

              {nextAction.steps && nextAction.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">📋 Passos Prioritários:</p>
                  {nextAction.steps.map((step, i) => (
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

              {nextAction.handoff_recommended && nextAction.handoff_recommended.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">🤝 Encaminhamentos:</p>
                  {nextAction.handoff_recommended.map((h, i) => (
                    <div key={i} className="p-2 bg-white rounded border border-amber-200">
                      <div className="flex items-start gap-2">
                        <Badge className={`text-xs flex-shrink-0 ${
                          h.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'
                        } text-white`}>
                          {h.priority}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-800">{h.to_team}</p>
                          <p className="text-xs text-slate-600">{h.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {nextAction.suggested_message && (
                <div className="bg-white p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-slate-500 mb-1 font-bold">💬 Mensagem Sugerida:</p>
                  <p className="text-xs text-slate-700 mb-3 leading-relaxed whitespace-pre-wrap">
                    {nextAction.suggested_message}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(nextAction.suggested_message);
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

        {/* Objeções */}
        {objections.length > 0 && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Objeções & Estratégia de Desbloqueio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {objections.map((obj, i) => (
                <div key={obj.id || i} className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">{obj.type}</Badge>
                      <p className="text-sm font-semibold text-slate-800">"{obj.text}"</p>
                    </div>
                    <Badge className={`text-xs text-white flex-shrink-0 ${getSeverityColor(obj.severity)}`}>
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

        {/* Temas */}
        {topics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Temas Identificados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    #{topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}