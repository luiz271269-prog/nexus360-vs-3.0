import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Target,
  Zap,
  Clock,
  Copy,
  Heart,
  Shield,
  Sparkles,
  Activity
} from "lucide-react";
import { toast } from "sonner";

/**
 * Componente compartilhado que renderiza insights estruturados
 * Reutilizado por: SegmentacaoInteligente e AnaliseDetalhadaContato
 */
export default function InsightRenderer({ insights = {}, showHeader = true }) {
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

  if (!insights || Object.keys(insights).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Scorecards */}
      {scores && Object.keys(scores).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {scores.health !== undefined && (
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Heart className="w-3 h-3" /> Saúde
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(scores.health)}`}>{scores.health}</div>
                <Progress value={scores.health} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          )}
          {scores.deal_risk !== undefined && (
            <Card className="border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Risco
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(scores.deal_risk)}`}>{scores.deal_risk}</div>
                <Progress value={scores.deal_risk} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          )}
          {scores.buy_intent !== undefined && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Intenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(scores.buy_intent)}`}>{scores.buy_intent}</div>
                <Progress value={scores.buy_intent} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          )}
          {scores.engagement !== undefined && (
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Engajamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(scores.engagement)}`}>{scores.engagement}</div>
                <Progress value={scores.engagement} className="h-1.5 mt-2" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
            <Badge className="text-sm px-3 py-1 bg-purple-600">
              {stage.current?.replace(/_/g, ' ')}
            </Badge>
            {stage.label && <p className="text-xs text-slate-600">{stage.label}</p>}
            {stage.days_stalled > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
                <Clock className="w-4 h-4" />
                Parado há <strong>{stage.days_stalled}</strong> dia(s)
              </div>
            )}
            {stage.pipeline_hint && (
              <div className="space-y-1">
                {stage.pipeline_hint.map((hint, i) => (
                  <p key={i} className="text-xs text-slate-700">• {hint}</p>
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
              Por Que Está em Risco?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rootCauses.map((cause, i) => (
              <div key={cause.id || i} className="p-3 bg-white rounded border-l-4 border-red-400">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-bold text-slate-900">{cause.title || cause}</p>
                  <Badge className={`text-xs text-white ${getSeverityColor(cause.severity)}`}>
                    {cause.severity || 'info'}
                  </Badge>
                </div>
                {cause.why && <p className="text-xs text-slate-700 mb-2">📋 {cause.why}</p>}
                {evidences[i] && (
                  <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-200">
                    <p className="text-xs text-slate-600 italic font-mono">💬 "{evidences[i].text}"</p>
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

      {/* Próxima Ação */}
      {nextAction.objective && (
        <Card className="border-green-300 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              Próxima Ação (Plano)
              {nextAction.need_manager && <Badge className="bg-red-500 text-white text-xs ml-auto">⚠️ Gerente</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-xs text-slate-500 font-medium mb-1">📌 Objetivo:</p>
              <p className="text-sm font-semibold text-slate-800">{nextAction.objective}</p>
            </div>

            {nextAction.steps?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">📋 Passos:</p>
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

            {nextAction.handoff_recommended?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">🤝 Encaminhamentos:</p>
                {nextAction.handoff_recommended.map((h, i) => (
                  <div key={i} className="p-2 bg-white rounded border border-amber-200">
                    <div className="flex items-start gap-2">
                      <Badge className={`text-xs flex-shrink-0 ${h.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'} text-white`}>
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
                <p className="text-xs text-slate-500 mb-1 font-bold">💬 Mensagem:</p>
                <p className="text-xs text-slate-700 mb-3 leading-relaxed whitespace-pre-wrap">
                  {nextAction.suggested_message}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(nextAction.suggested_message);
                    toast.success('Copiado!');
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar
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
              Objeções & Desbloqueio
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
                {obj.handling && <p className="text-xs text-green-700 font-medium mt-2">💡 {obj.handling}</p>}
                {obj.context && <p className="text-xs text-slate-600 mt-2">📝 {obj.context}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Temas */}
      {topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Temas</CardTitle>
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
  );
}