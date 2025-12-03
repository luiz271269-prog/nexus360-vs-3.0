import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  TrendingUp,
  Lightbulb,
  Target,
  Zap,
  RefreshCw
} from 'lucide-react';
import NexusEngineV3 from '../inteligencia/NexusEngineV3';
import { toast } from 'sonner';

/**
 * Painel de Insights IA para o Pipeline de Orçamentos
 * Consome a NKDB para mostrar contexto rico
 */
export default function PainelInsightsIA({ orcamento, onAcaoExecutada }) {
  const [insights, setInsights] = useState(null);
  const [conhecimentoRelevante, setConhecimentoRelevante] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (orcamento) {
      carregarInsights();
    }
  }, [orcamento?.id]);

  const carregarInsights = async () => {
    if (!orcamento) return;

    setCarregando(true);
    try {
      // 1. Buscar conhecimento relevante na NKDB
      const conhecimentos = await NexusEngineV3.consultarConhecimento({
        entidade_origem: 'Orcamento',
        id_entidade_origem: orcamento.id,
        limite: 3
      });

      setConhecimentoRelevante(conhecimentos);

      // 2. Gerar insight contextual usando NKDB
      const insight = await NexusEngineV3.gerarInsightContextual({
        contexto: {
          orcamento_numero: orcamento.numero_orcamento,
          cliente: orcamento.cliente_nome,
          valor: orcamento.valor_total,
          status: orcamento.status,
          dias_desde_criacao: Math.floor(
            (new Date() - new Date(orcamento.created_date)) / (1000 * 60 * 60 * 24)
          ),
          conhecimento_historico: conhecimentos.map(c => c.conteudo_estruturado)
        },
        entidade_tipo: 'Orcamento',
        entidade_id: orcamento.id,
        objetivo: `Analisar orçamento ${orcamento.numero_orcamento} e sugerir a melhor ação para maximizar a probabilidade de fechamento`
      });

      setInsights(insight);

    } catch (error) {
      console.error('[PainelInsightsIA] Erro ao carregar insights:', error);
      toast.error('Erro ao carregar insights da IA');
    } finally {
      setCarregando(false);
    }
  };

  const executarAcaoSugerida = () => {
    if (insights?.proxima_acao && onAcaoExecutada) {
      onAcaoExecutada(insights.proxima_acao);
    }
  };

  if (!orcamento) return null;

  return (
    <div className="space-y-4">
      {/* Header com Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Insights da IA</h3>
        </div>
        <Button
          onClick={carregarInsights}
          disabled={carregando}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          {carregando ? 'Analisando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Loading State */}
      {carregando && !insights && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Brain className="w-12 h-12 text-purple-600 mx-auto mb-3 animate-pulse" />
                <p className="text-purple-900 font-semibold">Analisando orçamento...</p>
                <p className="text-sm text-purple-700 mt-1">Consultando base de conhecimento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights Gerados */}
      {insights && (
        <div className="space-y-3">
          {/* Análise da Situação */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
                <Lightbulb className="w-4 h-4" />
                Análise da Situação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700">{insights.analise}</p>
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
              <p className="text-sm text-slate-700 font-medium">{insights.recomendacao}</p>
            </CardContent>
          </Card>

          {/* Próxima Ação */}
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                <Target className="w-4 h-4" />
                Próxima Melhor Ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 mb-3">{insights.proxima_acao}</p>
              <Button
                onClick={executarAcaoSugerida}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                <Zap className="w-4 h-4 mr-2" />
                Executar Ação Sugerida
              </Button>
            </CardContent>
          </Card>

          {/* Justificativa */}
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-900">
                <Brain className="w-4 h-4" />
                Justificativa (Baseada em Conhecimento Histórico)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-600 italic">{insights.justificativa}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conhecimento Relevante da NKDB */}
      {conhecimentoRelevante.length > 0 && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-900">
              <Brain className="w-4 h-4" />
              Conhecimento Histórico Relevante
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conhecimentoRelevante.map((conhecimento, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-white border border-indigo-200 text-xs"
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className="text-[10px]">
                      {conhecimento.tipo_registro}
                    </Badge>
                    {conhecimento.taxa_sucesso && (
                      <Badge className="bg-green-100 text-green-800 text-[10px]">
                        {conhecimento.taxa_sucesso}% sucesso
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-700 font-medium">{conhecimento.titulo}</p>
                  {conhecimento.tags && conhecimento.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {conhecimento.tags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] py-0 px-1">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}