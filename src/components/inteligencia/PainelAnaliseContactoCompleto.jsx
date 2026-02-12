import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import ProntuarioInteligenciaContato from './ProntuarioInteligenciaContato';

/**
 * PainelAnaliseContactoCompleto
 * Exibe análise V2 completa (scores, prontuário, playbook, riscos)
 * Integra-se ao painel de detalhes de contato existente
 */
export default function PainelAnaliseContactoCompleto({ contactId, contatoNome }) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAnalise();
  }, [contactId]);

  const carregarAnalise = async () => {
    try {
      setLoading(true);
      const analises = await base44.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contactId },
        '-analyzed_at',
        1
      );

      if (analises.length > 0) {
        setAnalise(analises[0]);
      }
    } catch (error) {
      console.error('[PainelAnaliseCompleto] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Carregando análise...</span>
        </CardContent>
      </Card>
    );
  }

  if (!analise || analise.status !== 'ok') {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-slate-500">Análise não disponível para este contato</p>
        </CardContent>
      </Card>
    );
  }

  const { scores, relationship_profile, relationship_risk, metricas_relacionamento, prontuario_ptbr } = analise;

  return (
    <div className="space-y-4">
      {/* Cards resumidos de scores */}
      {scores && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-slate-200">
            <CardContent className="p-3">
              <p className="text-xs text-slate-600 font-semibold">Saúde</p>
              <p className="text-2xl font-bold text-blue-600">{scores.health}%</p>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${scores.health}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3">
              <p className="text-xs text-slate-600 font-semibold">Risco Deal</p>
              <p className="text-2xl font-bold text-red-600">{scores.deal_risk}%</p>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                <div className="bg-red-600 h-1 rounded-full" style={{ width: `${scores.deal_risk}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3">
              <p className="text-xs text-slate-600 font-semibold">Intenção</p>
              <p className="text-2xl font-bold text-green-600">{scores.buy_intent}%</p>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                <div className="bg-green-600 h-1 rounded-full" style={{ width: `${scores.buy_intent}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-3">
              <p className="text-xs text-slate-600 font-semibold">Engajamento</p>
              <p className="text-2xl font-bold text-purple-600">{scores.engagement}%</p>
              <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                <div className="bg-purple-600 h-1 rounded-full" style={{ width: `${scores.engagement}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Métricas de relacionamento */}
      {metricas_relacionamento && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📊 Métricas de Relacionamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Total de mensagens</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.total_mensagens}</p>
              </div>
              <div>
                <p className="text-slate-500">Razão inbound/outbound</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.ratio_in_out?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Resposta atendente (min)</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.avg_response_time_agent_minutes}</p>
              </div>
              <div>
                <p className="text-slate-500">Resposta contato (min)</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.avg_response_time_contact_minutes}</p>
              </div>
              <div>
                <p className="text-slate-500">Velocidade conversa</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.conversation_velocity?.toFixed(1)} msg/dia</p>
              </div>
              <div>
                <p className="text-slate-500">Maior gap silêncio</p>
                <p className="font-bold text-slate-800">{metricas_relacionamento.max_silence_gap_days?.toFixed(0)} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prontuário completo */}
      <ProntuarioInteligenciaContato analise={analise} />

      {/* Alertas críticos */}
      {analise.alerts && analise.alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-800">⚠️ Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analise.alerts.map((alert, idx) => (
                <div key={idx} className="flex gap-2">
                  <Badge className={
                    alert.level === 'critical' ? 'bg-red-600' :
                    alert.level === 'warning' ? 'bg-orange-600' :
                    'bg-blue-600'
                  }>
                    {alert.level}
                  </Badge>
                  <p className="text-xs text-slate-700">{alert.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}