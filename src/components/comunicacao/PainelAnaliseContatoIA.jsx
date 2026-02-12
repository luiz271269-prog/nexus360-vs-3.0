import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  TrendingUp,
  AlertCircle,
  Zap,
  Target,
  Clock,
  Loader2,
  X,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

export default function PainelAnaliseContatoIA({ contactId, onClose }) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contactId) return;

    const carregarAnalise = async () => {
      try {
        setLoading(true);
        
        // Buscar análise do contato
        const analises = await base44.entities.ContactBehaviorAnalysis.filter({
          contact_id: contactId
        }, '-analyzed_at', 1);

        if (analises.length > 0) {
          setAnalise(analises[0]);
        } else {
          toast.info('Nenhuma análise disponível para este contato');
        }
      } catch (error) {
        console.error('[PainelAnaliseContatoIA] Erro ao carregar análise:', error);
        toast.error('Erro ao carregar análise');
      } finally {
        setLoading(false);
      }
    };

    carregarAnalise();
  }, [contactId]);

  if (!analise && !loading) {
    return (
      <div className="w-96 bg-white rounded-lg shadow-lg border border-slate-200 p-6">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p className="text-sm text-slate-600">Sem análise disponível</p>
          <Button onClick={onClose} size="sm" variant="outline" className="mt-4">
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Brain className="w-5 h-5" />
          <h3 className="font-bold">Análise IA</h3>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-white/20 text-white">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
          <p className="text-sm text-slate-600">Analisando contato...</p>
        </div>
      ) : analise ? (
        <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">STATUS</span>
              <Badge className={
                analise.priority_label === 'CRITICO' ? 'bg-red-500' :
                analise.priority_label === 'ALTO' ? 'bg-orange-500' :
                analise.priority_label === 'MEDIO' ? 'bg-yellow-500' :
                'bg-blue-500'
              }>
                {analise.priority_label || 'BAIXO'}
              </Badge>
            </div>
            <div className="text-xs text-slate-600">
              Score: {analise.priority_score || 0}/100
            </div>
          </div>

          {/* AI Insights */}
          {analise.ai_insights && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  Insights IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {/* Sentimento */}
                {analise.ai_insights.sentiment && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-1">Sentimento</p>
                    <Badge variant="outline" className={
                      analise.ai_insights.sentiment?.includes('positivo') 
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : analise.ai_insights.sentiment?.includes('negativo')
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                    }>
                      {analise.ai_insights.sentiment}
                    </Badge>
                  </div>
                )}

                {/* Scores */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {analise.ai_insights.buy_intent > 0 && (
                    <div className="bg-white rounded p-2">
                      <p className="text-[10px] text-slate-600">Intenção Compra</p>
                      <p className="font-bold text-green-600">{analise.ai_insights.buy_intent}%</p>
                    </div>
                  )}
                  {analise.ai_insights.engagement > 0 && (
                    <div className="bg-white rounded p-2">
                      <p className="text-[10px] text-slate-600">Engajamento</p>
                      <p className="font-bold text-blue-600">{analise.ai_insights.engagement}%</p>
                    </div>
                  )}
                  {analise.ai_insights.deal_risk > 0 && (
                    <div className="bg-white rounded p-2">
                      <p className="text-[10px] text-slate-600">Risco Deal</p>
                      <p className="font-bold text-red-600">{analise.ai_insights.deal_risk}%</p>
                    </div>
                  )}
                  {analise.ai_insights.health > 0 && (
                    <div className="bg-white rounded p-2">
                      <p className="text-[10px] text-slate-600">Saúde Relação</p>
                      <p className="font-bold text-purple-600">{analise.ai_insights.health}%</p>
                    </div>
                  )}
                </div>

                {/* Próxima ação */}
                {analise.ai_insights.next_best_action && (
                  <div className="bg-white rounded p-2 mt-2 border-l-4 border-indigo-500">
                    <p className="text-[10px] font-bold text-indigo-700 mb-1">Próxima Ação</p>
                    <p className="text-xs text-slate-700">{analise.ai_insights.next_best_action.action}</p>
                    {analise.ai_insights.next_best_action.deadline_hours && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        ⏱️ Prazo: {analise.ai_insights.next_best_action.deadline_hours}h
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Métricas */}
          {analise.metricas_relacionamento && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Métricas
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                {analise.metricas_relacionamento.avg_response_time_contact_minutes && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tempo resposta cliente:</span>
                    <span className="font-semibold text-slate-800">
                      {Math.round(analise.metricas_relacionamento.avg_response_time_contact_minutes)}min
                    </span>
                  </div>
                )}
                {analise.metricas_relacionamento.ratio_in_out && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Razão in/out:</span>
                    <span className="font-semibold text-slate-800">
                      {analise.metricas_relacionamento.ratio_in_out.toFixed(2)}
                    </span>
                  </div>
                )}
                {analise.metricas_relacionamento.conversation_velocity && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Velocidade conversa:</span>
                    <span className="font-semibold text-slate-800">
                      {analise.metricas_relacionamento.conversation_velocity.toFixed(1)} msg/dia
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Root Causes */}
          {analise.root_causes && analise.root_causes.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Motivos
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                {analise.root_causes.map((cause, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-orange-600">•</span>
                    <span className="text-slate-700">{cause}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Data análise */}
          <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-2 border-t border-slate-100">
            <Clock className="w-3 h-3" />
            Analisado há {analise.analyzed_at ? 
              Math.round((Date.now() - new Date(analise.analyzed_at).getTime()) / 60000) + 'min' 
              : 'recentemente'}
          </div>
        </div>
      ) : null}
    </div>
  );
}