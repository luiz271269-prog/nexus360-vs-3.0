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
  const [tabAtiva, setTabAtiva] = useState('perfil'); // 'perfil' | 'assuntos'
  const [analise, setAnalise] = useState(null);
  const [assuntos, setAssuntos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAssuntos, setLoadingAssuntos] = useState(false);
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

  const carregarAssuntos = async () => {
    if (!contactId) return;
    
    try {
      setLoadingAssuntos(true);
      
      const analises = await base44.entities.TopicAnalysis.filter({
        contact_id: contactId
      }, '-analyzed_at', 1);

      if (analises.length > 0) {
        setAssuntos(analises[0]);
      } else {
        setAssuntos(null);
      }
    } catch (error) {
      console.error('[PainelAnaliseContatoIA] Erro ao carregar assuntos:', error);
    } finally {
      setLoadingAssuntos(false);
    }
  };

  const handleReanalise = async () => {
    try {
      setReanalysing(true);
      toast.loading('🧠 Analisando últimas 50 mensagens...', { id: 'reanalise' });
      
      if (tabAtiva === 'perfil') {
        await base44.functions.invoke('analisarComportamentoContato', {
          contact_id: contactId,
          limit: 50
        });
        await carregarAnalise();
      } else {
        await base44.functions.invoke('analisarAssuntosContato', {
          contact_id: contactId,
          limit: 50
        });
        await carregarAssuntos();
      }
      
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
    carregarAssuntos();
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
      {/* Header com Tabs */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
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
        
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabAtiva('perfil')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tabAtiva === 'perfil'
                ? 'bg-white text-purple-700 shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            👤 Perfil & Comportamento
          </button>
          <button
            onClick={() => setTabAtiva('assuntos')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tabAtiva === 'assuntos'
                ? 'bg-white text-purple-700 shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            📋 Assuntos & Contexto
          </button>
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
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            Nenhuma análise de perfil disponível
          </div>
        )
      ) : (
        // TAB ASSUNTOS
        loadingAssuntos ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : assuntos && assuntos.topics?.length > 0 ? (
          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {/* Resumo Global */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-3 border border-purple-200">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-xs font-bold text-purple-900">{assuntos.meta?.total_topics || 0}</p>
                  <p className="text-[9px] text-slate-600">Assuntos</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-orange-600">{assuntos.meta?.open_topics || 0}</p>
                  <p className="text-[9px] text-slate-600">Abertos</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-red-600">{assuntos.meta?.critical_topics || 0}</p>
                  <p className="text-[9px] text-slate-600">Críticos</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600">{assuntos.meta?.total_open_loops || 0}</p>
                  <p className="text-[9px] text-slate-600">Pendências</p>
                </div>
              </div>
            </div>

            {/* Sentimento Global */}
            {assuntos.global_sentiment && (
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-bold text-slate-700 mb-2">📊 Sentimento Geral</p>
                <div className="flex items-center gap-2">
                  <Badge className={
                    assuntos.global_sentiment.overall?.includes('positivo') ? 'bg-green-500' :
                    assuntos.global_sentiment.overall?.includes('negativo') ? 'bg-red-500' :
                    'bg-slate-400'
                  }>
                    {assuntos.global_sentiment.overall}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {assuntos.global_sentiment.trend === 'melhorando' ? '📈 Melhorando' :
                     assuntos.global_sentiment.trend === 'piorando' ? '📉 Piorando' :
                     '➡️ Estável'}
                  </Badge>
                </div>
              </div>
            )}

            {/* Lista de Assuntos */}
            {assuntos.topics.map((topic, idx) => (
              <Card key={idx} className={`border-2 ${
                topic.risk?.level === 'critical' ? 'border-red-500 bg-red-50' :
                topic.risk?.level === 'high' ? 'border-orange-500 bg-orange-50' :
                'border-slate-200 bg-white'
              }`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      {topic.topic}
                    </CardTitle>
                    <Badge className={
                      topic.status === 'ganho' ? 'bg-green-500' :
                      topic.status === 'perdido' ? 'bg-red-500' :
                      topic.status === 'fechado' ? 'bg-blue-500' :
                      topic.status === 'andamento' ? 'bg-orange-500' :
                      'bg-slate-400'
                    }>
                      {topic.status}
                    </Badge>
                  </div>
                  {topic.context_summary && (
                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                      {topic.context_summary}
                    </p>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Timeline */}
                  {topic.timeline && topic.timeline.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">📅 Timeline</p>
                      <div className="space-y-1">
                        {topic.timeline.slice(0, 3).map((event, i) => (
                          <div key={i} className="text-[10px] text-slate-600 flex gap-2">
                            <span className="text-purple-600 font-mono">{event.timestamp}</span>
                            <span className="font-medium">{event.event}:</span>
                            <span className="text-slate-500 line-clamp-1">{event.snippet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentimento */}
                  {topic.sentiment_summary && (
                    <div className="bg-slate-50 rounded p-2">
                      <p className="text-xs font-semibold text-slate-700 mb-1">💭 Sentimento</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={
                          topic.sentiment_summary.current?.includes('positivo') ? 'bg-green-500' :
                          topic.sentiment_summary.current?.includes('negativo') ? 'bg-red-500' :
                          'bg-slate-400'
                        }>
                          {topic.sentiment_summary.current}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">
                          {topic.sentiment_summary.trend === 'melhorando' ? '📈' :
                           topic.sentiment_summary.trend === 'piorando' ? '📉' : '➡️'}
                        </Badge>
                        <span className="text-[10px] text-slate-600">
                          Intensidade: {topic.sentiment_summary.intensity || 0}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Mudanças de Sentimento */}
                  {topic.sentiment_events && topic.sentiment_events.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">🎭 Mudanças</p>
                      <div className="space-y-1">
                        {topic.sentiment_events.slice(0, 2).map((event, i) => (
                          <div key={i} className="bg-yellow-50 border-l-2 border-yellow-500 p-1.5 rounded text-[10px]">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-yellow-700">{event.timestamp}</span>
                              <Badge className={
                                event.sentiment === 'ameaca' ? 'bg-red-600' :
                                event.sentiment === 'pressao' ? 'bg-orange-500' :
                                event.sentiment === 'ansiedade' ? 'bg-yellow-500' :
                                event.sentiment === 'alivio' ? 'bg-green-500' :
                                'bg-blue-500'
                              }>
                                {event.sentiment}
                              </Badge>
                              <span className="text-slate-500">→ {event.target}</span>
                            </div>
                            <p className="text-slate-700 italic">"{event.snippet}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dados Estruturados */}
                  {topic.key_facts && topic.key_facts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">📊 Dados</p>
                      <div className="flex flex-wrap gap-1">
                        {topic.key_facts.slice(0, 4).map((fact, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">
                            {fact.type}: {fact.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pendências */}
                  {topic.open_loops && topic.open_loops.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-2">
                      <p className="text-xs font-semibold text-orange-800 mb-1">⏳ Pendências</p>
                      <div className="space-y-1">
                        {topic.open_loops.map((loop, i) => (
                          <div key={i} className="text-[10px] text-slate-700">
                            <span className="font-semibold text-orange-700">[{loop.owner}]</span> {loop.pending}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risco */}
                  {topic.risk && topic.risk.level !== 'low' && (
                    <div className={`rounded p-2 border-l-4 ${
                      topic.risk.level === 'critical' ? 'bg-red-50 border-red-600' :
                      topic.risk.level === 'high' ? 'bg-orange-50 border-orange-500' :
                      'bg-yellow-50 border-yellow-500'
                    }`}>
                      <p className="text-xs font-bold text-red-800 mb-1">⚠️ Risco {topic.risk.level}</p>
                      <ul className="text-[10px] text-slate-700 space-y-0.5 list-disc list-inside">
                        {topic.risk.reasons?.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Próximos Passos */}
                  {topic.recommended_next_steps && topic.recommended_next_steps.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                      <p className="text-xs font-bold text-blue-800 mb-1">🎯 Próximos Passos</p>
                      <ul className="text-[10px] text-slate-700 space-y-0.5 list-decimal list-inside">
                        {topic.recommended_next_steps.slice(0, 3).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Rodapé */}
            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Analisado há {assuntos.analyzed_at ? 
                  Math.round((Date.now() - new Date(assuntos.analyzed_at).getTime()) / 60000) + 'min' 
                  : 'recentemente'}
              </div>
              <Badge variant="outline" className="text-[9px]">
                {assuntos.window_size || 0} msgs
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-slate-600 mb-3">Nenhuma análise de assuntos disponível</p>
            <Button
              onClick={async () => {
                try {
                  setLoadingAssuntos(true);
                  toast.loading('🧠 Analisando assuntos...', { id: 'analise-assuntos' });
                  await base44.functions.invoke('analisarAssuntosContato', {
                    contact_id: contactId,
                    limit: 50
                  });
                  await carregarAssuntos();
                  toast.success('✅ Análise concluída!', { id: 'analise-assuntos' });
                } catch (error) {
                  toast.error('Erro ao analisar', { id: 'analise-assuntos' });
                }
              }}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Brain className="w-4 h-4 mr-2" />
              Analisar Agora
            </Button>
          </div>
        )
      )}
    </div>
  );
}