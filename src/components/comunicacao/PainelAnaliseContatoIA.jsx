import React, { useState, useEffect } from 'react';
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
  Download,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

export default function PainelAnaliseContatoIA({ contactId, onClose }) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reanalysing, setReanalysing] = useState(false);

  const carregarAnalise = async () => {
    if (!contactId) return;
    
    try {
      setLoading(true);
      
      const analises = await base44.entities.ContactBehaviorAnalysis.filter({
        contact_id: contactId
      }, '-analyzed_at', 1);

      if (analises.length > 0) {
        setAnalise(analises[0]);
      } else {
        toast.info('Nenhuma análise disponível');
      }
    } catch (error) {
      console.error('[PainelAnaliseContatoIA] Erro:', error);
      toast.error('Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalise = async () => {
    try {
      setReanalysing(true);
      toast.loading('🧠 Analisando últimas 50 mensagens...', { id: 'reanalise' });
      
      await base44.functions.invoke('analisarComportamentoContato', {
        contact_id: contactId,
        limit: 50
      });
      
      await carregarAnalise();
      toast.success('✅ Análise atualizada!', { id: 'reanalise' });
    } catch (error) {
      console.error('[PainelAnaliseContatoIA] Erro reanálise:', error);
      toast.error('Erro ao reanalisar', { id: 'reanalise' });
    } finally {
      setReanalysing(false);
    }
  };

  useEffect(() => {
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
          <Badge className="bg-white/20 text-white text-[10px] px-1.5">
            50 msgs
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleReanalise}
            disabled={reanalysing}
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-white/20 text-white"
            title="Reanalisar (50 mensagens)">
            {reanalysing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-white/20 text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-3" />
          <p className="text-sm text-slate-600">Analisando contato...</p>
        </div>
      ) : analise ? (
        <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
          {/* Última Mensagem */}
          {analise.last_inbound_at && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-800">Última mensagem</span>
              </div>
              <p className="text-sm text-slate-700 mb-1">
                {mensagensProcessadas?.[mensagensProcessadas.length - 1]?.content?.substring(0, 150) || 'N/D'}
              </p>
              <div className="text-[10px] text-slate-500">
                🕐 {new Date(analise.last_inbound_at).toLocaleString('pt-BR')} ({analise.days_inactive_inbound || 0}d atrás)
              </div>
            </div>
          )}
        
          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">PRIORIDADE</span>
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
              Score: {analise.priority_score || 0}/100 • {analise.window_size || 0} msgs analisadas
            </div>
          </div>

          {/* Prontuário Completo */}
          {analise.prontuario_ptbr && (
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  Prontuário (50 msgs)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {analise.prontuario_ptbr.visao_geral && (
                  <div>
                    <p className="font-bold text-purple-900 mb-1">1️⃣ Visão Geral</p>
                    <p className="text-slate-700 leading-relaxed">{analise.prontuario_ptbr.visao_geral}</p>
                  </div>
                )}
                
                {analise.prontuario_ptbr.necessidades_contexto && (
                  <div>
                    <p className="font-bold text-purple-900 mb-1">2️⃣ Necessidades</p>
                    <p className="text-slate-700 leading-relaxed">{analise.prontuario_ptbr.necessidades_contexto}</p>
                  </div>
                )}
                
                {analise.prontuario_ptbr.causas_principais && (
                  <div>
                    <p className="font-bold text-purple-900 mb-1">4️⃣ Causas Principais</p>
                    <p className="text-slate-700 leading-relaxed">{analise.prontuario_ptbr.causas_principais}</p>
                  </div>
                )}
                
                {analise.prontuario_ptbr.recomendacoes_objetivas && (
                  <div className="bg-white rounded p-2 border-l-4 border-purple-500">
                    <p className="font-bold text-purple-900 mb-1">6️⃣ Recomendações</p>
                    <p className="text-slate-700 leading-relaxed">{analise.prontuario_ptbr.recomendacoes_objetivas}</p>
                  </div>
                )}
                
                {analise.prontuario_ptbr.mensagem_pronta && (
                  <div className="bg-green-50 rounded p-2 border border-green-200">
                    <p className="font-bold text-green-900 mb-1">💬 Mensagem Sugerida</p>
                    <p className="text-slate-700 leading-relaxed italic">{analise.prontuario_ptbr.mensagem_pronta}</p>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(analise.prontuario_ptbr.mensagem_pronta);
                        toast.success('✅ Copiada!');
                      }}
                      size="sm"
                      variant="outline"
                      className="mt-2 h-6 text-[10px]"
                    >
                      📋 Copiar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scores (Compacto) */}
          {analise.scores && (
            <div className="grid grid-cols-2 gap-2">
              {analise.scores.buy_intent > 0 && (
                <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                  <p className="text-[10px] text-green-700 font-semibold">Intenção Compra</p>
                  <p className="font-bold text-green-600 text-lg">{analise.scores.buy_intent}%</p>
                </div>
              )}
              {analise.scores.engagement > 0 && (
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                  <p className="text-[10px] text-blue-700 font-semibold">Engajamento</p>
                  <p className="font-bold text-blue-600 text-lg">{analise.scores.engagement}%</p>
                </div>
              )}
              {analise.scores.deal_risk > 0 && (
                <div className="bg-red-50 rounded-lg p-2 border border-red-200">
                  <p className="text-[10px] text-red-700 font-semibold">Risco Deal</p>
                  <p className="font-bold text-red-600 text-lg">{analise.scores.deal_risk}%</p>
                </div>
              )}
              {analise.scores.health > 0 && (
                <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                  <p className="text-[10px] text-purple-700 font-semibold">Saúde Relação</p>
                  <p className="font-bold text-purple-600 text-lg">{analise.scores.health}%</p>
                </div>
              )}
            </div>
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

          {/* Rodapé com timestamp */}
          <div className="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Analisado há {analise.analyzed_at ? 
                Math.round((Date.now() - new Date(analise.analyzed_at).getTime()) / 60000) + 'min' 
                : 'recentemente'}
            </div>
            <Badge variant="outline" className="text-[9px]">
              {analise.window_size || 0} msgs
            </Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}