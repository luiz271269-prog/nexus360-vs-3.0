import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  DollarSign,
  Users,
  Brain,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import MotorAnaliseAutomatizada from '../inteligencia/MotorAnaliseAutomatizada';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  DASHBOARD INTELIGENTE - ANÁLISES AUTOMATIZADAS             ║
 * ║  Insights em tempo real com IA                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default function DashboardInteligente() {
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState(null);
  const [analisandoChurn, setAnalisandoChurn] = useState(false);
  const [analiseChurn, setAnaliseChurn] = useState(null);
  const [analisandoUpsell, setAnalisandoUpsell] = useState(false);
  const [analiseUpsell, setAnaliseUpsell] = useState(null);

  useEffect(() => {
    carregarAnalises();
  }, []);

  const carregarAnalises = async () => {
    setLoading(true);
    try {
      const [analiseCRM, churn, upsell] = await Promise.all([
        MotorAnaliseAutomatizada.analisarCRMCompleto(),
        MotorAnaliseAutomatizada.analisarRiscoChurn(),
        MotorAnaliseAutomatizada.identificarOportunidadesUpsell()
      ]);

      setAnalise(analiseCRM);
      setAnaliseChurn(churn);
      setAnaliseUpsell(upsell);

    } catch (error) {
      console.error('Erro ao carregar análises:', error);
      toast.error('Erro ao carregar análises do CRM');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Brain className="w-16 h-16 text-purple-600 animate-pulse mb-4" />
        <p className="text-lg font-semibold text-slate-700">Analisando CRM com IA...</p>
        <p className="text-sm text-slate-500 mt-2">Isso pode levar alguns segundos</p>
      </div>
    );
  }

  const saudeGeral = analise?.saude_geral_crm;
  const alertasCriticos = analise?.alertas_criticos || [];
  const oportunidades = analise?.oportunidades || [];
  const tendencias = analise?.tendencias;
  const recomendacoes = analise?.recomendacoes_estrategicas || [];

  return (
    <div className="space-y-6">
      {/* Header com Saúde Geral */}
      <Card className={`border-2 ${
        saudeGeral?.status === 'excelente' ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' :
        saudeGeral?.status === 'saudavel' ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50' :
        saudeGeral?.status === 'atencao' ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50' :
        'border-red-300 bg-gradient-to-br from-red-50 to-pink-50'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                saudeGeral?.status === 'excelente' || saudeGeral?.status === 'saudavel' ?
                'bg-green-500' : saudeGeral?.status === 'atencao' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Saúde do CRM</CardTitle>
                <p className="text-sm text-slate-600 mt-1">{saudeGeral?.diagnostico}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-slate-900">{saudeGeral?.score}/100</div>
              <Badge className={`mt-2 ${
                saudeGeral?.status === 'excelente' ? 'bg-green-600' :
                saudeGeral?.status === 'saudavel' ? 'bg-blue-600' :
                saudeGeral?.status === 'atencao' ? 'bg-amber-600' :
                'bg-red-600'
              } text-white`}>
                {saudeGeral?.status?.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={saudeGeral?.score} className="h-3" />
        </CardContent>
      </Card>

      {/* Grid: Alertas + Oportunidades + Churn + Upsell */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas Críticos */}
        <Card className="border-2 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5" />
              Alertas Críticos ({alertasCriticos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {alertasCriticos.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="text-green-700 font-semibold">Nenhum alerta crítico!</p>
              </div>
            ) : (
              alertasCriticos.map((alerta, idx) => (
                <Card key={idx} className={`border-2 ${
                  alerta.gravidade === 'critica' ? 'border-red-300 bg-red-50' :
                  alerta.gravidade === 'alta' ? 'border-orange-300 bg-orange-50' :
                  'border-yellow-300 bg-yellow-50'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-slate-900">{alerta.titulo}</h4>
                      <Badge className={
                        alerta.gravidade === 'critica' ? 'bg-red-600 text-white' :
                        alerta.gravidade === 'alta' ? 'bg-orange-600 text-white' :
                        'bg-yellow-600 text-white'
                      }>
                        {alerta.gravidade.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700 mb-2">{alerta.descricao}</p>
                    <div className="p-2 bg-white/50 rounded-lg">
                      <p className="text-xs font-medium text-slate-800">
                        💡 Ação: {alerta.acao_recomendada}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Impacto: {alerta.impacto_estimado}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Oportunidades */}
        <Card className="border-2 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Target className="w-5 h-5" />
              Oportunidades ({oportunidades.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {oportunidades.map((opp, idx) => (
              <Card key={idx} className="border-2 border-green-300 bg-green-50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-green-900">{opp.titulo}</h4>
                    <Badge className="bg-green-600 text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(opp.potencial_receita)}
                    </Badge>
                  </div>
                  <p className="text-sm text-green-800 mb-2">{opp.descricao}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-medium text-green-700">
                        Probabilidade: {opp.probabilidade}%
                      </div>
                    </div>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Explorar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Análise de Churn Risk */}
      {analiseChurn && (
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5" />
                Análise de Risco de Churn
              </CardTitle>
              <Button
                onClick={() => carregarAnalises()}
                variant="outline"
                size="sm"
                className="border-amber-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-900">{analiseChurn.total_em_risco}</div>
                <p className="text-sm text-amber-700">Clientes em Risco</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(analiseChurn.valor_total_em_risco)}
                </div>
                <p className="text-sm text-red-700">Valor em Risco</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-900">
                  {analiseChurn.total_em_risco > 0 ? Math.round((analiseChurn.total_em_risco / analiseChurn.clientes.length) * 100) : 0}%
                </div>
                <p className="text-sm text-orange-700">Taxa de Risco</p>
              </div>
            </div>

            {analiseChurn.clientes.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-amber-900 mb-2">Top Clientes em Risco:</h4>
                {analiseChurn.clientes.slice(0, 5).map((c, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900">{c.cliente.razao_social}</h5>
                        <p className="text-xs text-slate-600">{c.riscos.join(' • ')}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-600">{c.pontuacaoRisco}</div>
                        <p className="text-xs text-slate-600">{c.diasSemContato}d sem contato</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Análise de Upsell */}
      {analiseUpsell && (
        <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <TrendingUp className="w-5 h-5" />
              Oportunidades de Upsell/Cross-sell
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-900">{analiseUpsell.total_oportunidades}</div>
                <p className="text-sm text-emerald-700">Oportunidades</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(analiseUpsell.potencial_total)}
                </div>
                <p className="text-sm text-green-700">Potencial de Receita</p>
              </div>
            </div>

            {analiseUpsell.top_oportunidades.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-emerald-900 mb-2">Top Oportunidades:</h4>
                {analiseUpsell.top_oportunidades.slice(0, 5).map((o, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900">{o.cliente.razao_social}</h5>
                        <p className="text-xs text-slate-600">
                          Score: {o.score_potencial} • Ticket Médio: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(o.ticket_medio)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(o.potencial_upsell)}
                        </div>
                        <p className="text-xs text-slate-600">Potencial</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recomendações Estratégicas */}
      {recomendacoes.length > 0 && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Zap className="w-5 h-5" />
              Recomendações Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recomendacoes.map((rec, idx) => (
              <Card key={idx} className="border-2 border-purple-200 bg-white">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-purple-100 text-purple-800">
                          {rec.area}
                        </Badge>
                        <Badge className={
                          rec.prioridade === 'critica' ? 'bg-red-600 text-white' :
                          rec.prioridade === 'alta' ? 'bg-orange-600 text-white' :
                          rec.prioridade === 'media' ? 'bg-blue-600 text-white' :
                          'bg-slate-600 text-white'
                        }>
                          {rec.prioridade}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-slate-900">{rec.recomendacao}</h4>
                      <p className="text-sm text-slate-600 mt-1">Impacto: {rec.impacto_esperado}</p>
                    </div>
                    <Badge variant="outline" className={
                      rec.esforco === 'baixo' ? 'bg-green-50 text-green-700 border-green-200' :
                      rec.esforco === 'medio' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }>
                      Esforço: {rec.esforco}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}