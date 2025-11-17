import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  Target,
  BarChart3,
  Users,
  MessageSquare,
  Clock,
  XCircle,
  Activity
} from "lucide-react";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  ANÁLISE CRÍTICA DO SISTEMA DE PLAYBOOKS                      ║
 * ║  Identificação de pontos fortes, fracos e oportunidades       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function AnalisePlaybooksCritica() {
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState(null);

  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks_analise'],
    queryFn: () => base44.entities.FlowTemplate.list(),
    initialData: []
  });

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes_analise'],
    queryFn: () => base44.entities.FlowExecution.list('-updated_date', 1000),
    initialData: []
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['insights_analise'],
    queryFn: () => base44.entities.PlaybookInsight.filter({ status: 'pendente' }),
    initialData: []
  });

  const realizarAnaliseCritica = async () => {
    setAnalisando(true);
    try {
      const resultado = {
        pontos_fortes: [],
        pontos_fracos: [],
        gaps_criticos: [],
        oportunidades: [],
        metricas_sistema: {},
        recomendacoes_priorizadas: []
      };

      // ===== PONTOS FORTES =====
      
      if (playbooks.length > 0) {
        resultado.pontos_fortes.push({
          categoria: 'Estrutura',
          descricao: 'Sistema de playbooks implementado com entidades bem definidas',
          impacto: 'Alto',
          evidencia: `${playbooks.length} playbooks configurados`
        });
      }

      const playbooksAtivos = playbooks.filter(p => p.ativo);
      if (playbooksAtivos.length > 0) {
        resultado.pontos_fortes.push({
          categoria: 'Automação',
          descricao: 'Playbooks ativos gerando automação',
          impacto: 'Alto',
          evidencia: `${playbooksAtivos.length} playbooks ativos`
        });
      }

      if (execucoes.length > 0) {
        const execucoesRecentes = execucoes.filter(e => {
          const diffHoras = (new Date() - new Date(e.created_date)) / (1000 * 60 * 60);
          return diffHoras <= 24;
        });

        if (execucoesRecentes.length > 0) {
          resultado.pontos_fortes.push({
            categoria: 'Engajamento',
            descricao: 'Sistema ativo com execuções recentes',
            impacto: 'Alto',
            evidencia: `${execucoesRecentes.length} execuções nas últimas 24h`
          });
        }
      }

      // ===== PONTOS FRACOS =====

      // 1. Falta de testes A/B
      resultado.pontos_fracos.push({
        categoria: 'Otimização',
        descricao: 'Sem sistema de A/B testing para playbooks',
        impacto: 'Médio',
        solucao: 'Implementar FlowTemplateVersion com suporte a testes A/B'
      });

      // 2. Análise limitada de abandono
      const taxaAbandonoGeral = execucoes.length > 0 ? 
        (execucoes.filter(e => e.status === 'cancelado').length / execucoes.length) * 100 : 0;

      if (taxaAbandonoGeral > 30) {
        resultado.pontos_fracos.push({
          categoria: 'Performance',
          descricao: `Taxa de abandono alta: ${taxaAbandonoGeral.toFixed(1)}%`,
          impacto: 'Alto',
          solucao: 'Implementar análise detalhada de abandono por step + IA para otimização'
        });
      }

      // 3. Falta de personalização
      resultado.pontos_fracos.push({
        categoria: 'Personalização',
        descricao: 'Playbooks não se adaptam ao perfil do usuário',
        impacto: 'Médio',
        solucao: 'Integrar com ClienteScore e adaptar fluxos dinamicamente'
      });

      // 4. Métricas de negócio desconectadas
      resultado.pontos_fracos.push({
        categoria: 'ROI',
        descricao: 'Falta correlação direta entre playbooks e resultados de venda',
        impacto: 'Alto',
        solucao: 'Criar campo "conversao_gerada" em FlowExecution + dashboard de ROI'
      });

      // ===== GAPS CRÍTICOS =====

      // 1. Ações customizadas não implementadas
      const acoesNaoImplementadas = [
        'criarLead',
        'enviarOrcamento',
        'agendarFollowUp',
        'atribuirVendedor',
        'atualizarClienteScore'
      ];

      resultado.gaps_criticos.push({
        categoria: 'Integração',
        descricao: 'Ações customizadas são placeholders',
        criticidade: 'Crítica',
        acao_imediata: `Implementar as ${acoesNaoImplementadas.length} ações prioritárias no playbookEngine.js`,
        itens: acoesNaoImplementadas
      });

      // 2. RAG não integrado ao preAtendimento
      resultado.gaps_criticos.push({
        categoria: 'IA',
        descricao: 'Base de Conhecimento não é consultada durante execução de playbooks',
        criticidade: 'Alta',
        acao_imediata: 'Integrar MotorRAGV3 no step "ia_classify" do playbookEngine'
      });

      // 3. Sem sistema de rollback
      resultado.gaps_criticos.push({
        categoria: 'Segurança',
        descricao: 'Sem histórico de versões ou rollback de playbooks',
        criticidade: 'Média',
        acao_imediata: 'Implementar FlowTemplateVersion com backup automático antes de editar'
      });

      // 4. Falta de monitoramento em tempo real
      resultado.gaps_criticos.push({
        categoria: 'Observabilidade',
        descricao: 'Sem dashboard em tempo real de playbooks executando',
        criticidade: 'Média',
        acao_imediata: 'Criar componente "LivePlaybookMonitor" com WebSocket'
      });

      // ===== OPORTUNIDADES =====

      resultado.oportunidades.push({
        categoria: 'Expansão',
        descricao: 'Biblioteca de Playbooks Templates',
        potencial: 'Alto',
        implementacao: 'Criar repositório com templates pré-configurados (vendas, suporte, cobrança)',
        roi_estimado: '40% redução no tempo de setup'
      });

      resultado.oportunidades.push({
        categoria: 'IA Generativa',
        descricao: 'Geração automática de playbooks via LLM',
        potencial: 'Muito Alto',
        implementacao: 'Usuário descreve o objetivo, LLM gera o JSON do FlowTemplate completo',
        roi_estimado: '70% mais rápido criar novos fluxos'
      });

      resultado.oportunidades.push({
        categoria: 'Predictive Analytics',
        descricao: 'Prever qual playbook terá maior taxa de conversão para cada lead',
        potencial: 'Alto',
        implementacao: 'ML model baseado em histórico de conversões + perfil do lead',
        roi_estimado: '25% aumento na conversão'
      });

      resultado.oportunidades.push({
        categoria: 'Multi-canal',
        descricao: 'Estender playbooks para Email + SMS + Voice',
        potencial: 'Médio',
        implementacao: 'Adaptar playbookEngine para suportar múltiplos canais',
        roi_estimado: '50% mais touchpoints com clientes'
      });

      // ===== MÉTRICAS DO SISTEMA =====

      resultado.metricas_sistema = {
        total_playbooks: playbooks.length,
        playbooks_ativos: playbooksAtivos.length,
        total_execucoes: execucoes.length,
        taxa_sucesso_geral: execucoes.length > 0 ? 
          (execucoes.filter(e => e.status === 'concluido').length / execucoes.length) * 100 : 0,
        taxa_abandono_geral: taxaAbandonoGeral,
        insights_pendentes: insights.length,
        categorias_cobertas: [...new Set(playbooks.map(p => p.categoria))].length
      };

      // ===== RECOMENDAÇÕES PRIORIZADAS =====

      resultado.recomendacoes_priorizadas = [
        {
          prioridade: 1,
          titulo: 'Implementar Ações Customizadas Reais',
          descricao: 'As 5 ações principais (criarLead, enviarOrcamento, etc.) precisam ser funcionais',
          esforco: 'Médio',
          impacto: 'Crítico',
          prazo_sugerido: '1 semana'
        },
        {
          prioridade: 2,
          titulo: 'Integrar RAG no Playbook Engine',
          descricao: 'Steps "ia_classify" devem consultar Base de Conhecimento',
          esforco: 'Baixo',
          impacto: 'Alto',
          prazo_sugerido: '3 dias'
        },
        {
          prioridade: 3,
          titulo: 'Dashboard de Performance em Tempo Real',
          descricao: 'Visualizar playbooks executando agora + métricas live',
          esforco: 'Médio',
          impacto: 'Alto',
          prazo_sugerido: '1 semana'
        },
        {
          prioridade: 4,
          titulo: 'Sistema de Versionamento e Rollback',
          descricao: 'Histórico de alterações + capacidade de reverter mudanças',
          esforco: 'Médio',
          impacto: 'Médio',
          prazo_sugerido: '2 semanas'
        },
        {
          prioridade: 5,
          titulo: 'Correlação com Métricas de Vendas',
          descricao: 'Medir quanto cada playbook contribui para vendas reais',
          esforco: 'Alto',
          impacto: 'Alto',
          prazo_sugerido: '2 semanas'
        },
        {
          prioridade: 6,
          titulo: 'Templates de Playbooks',
          descricao: 'Biblioteca com 10-15 playbooks prontos para clonar',
          esforco: 'Baixo',
          impacto: 'Médio',
          prazo_sugerido: '1 semana'
        },
        {
          prioridade: 7,
          titulo: 'A/B Testing de Fluxos',
          descricao: 'Testar variações de playbooks automaticamente',
          esforco: 'Alto',
          impacto: 'Alto',
          prazo_sugerido: '3 semanas'
        },
        {
          prioridade: 8,
          titulo: 'Gerador de Playbooks via IA',
          descricao: 'Descrever objetivo → LLM gera playbook completo',
          esforco: 'Alto',
          impacto: 'Muito Alto',
          prazo_sugerido: '4 semanas'
        }
      ];

      setAnalise(resultado);
    } catch (error) {
      console.error('[ANÁLISE] Erro:', error);
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Activity className="w-9 h-9" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Análise Crítica - Sistema de Playbooks</CardTitle>
                  <p className="text-purple-100 mt-1">
                    Identificação de pontos fortes, fracos, gaps e oportunidades
                  </p>
                </div>
              </div>

              <Button
                onClick={realizarAnaliseCritica}
                disabled={analisando}
                size="lg"
                className="bg-white text-purple-600 hover:bg-purple-50"
              >
                {analisando ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Realizar Análise
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Resultados da Análise */}
        {analise && (
          <>
            {/* Métricas do Sistema */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Total Playbooks</p>
                      <p className="text-2xl font-bold">{analise.metricas_sistema.total_playbooks}</p>
                    </div>
                    <Target className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Taxa Sucesso</p>
                      <p className="text-2xl font-bold text-green-600">
                        {analise.metricas_sistema.taxa_sucesso_geral.toFixed(1)}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Taxa Abandono</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {analise.metricas_sistema.taxa_abandono_geral.toFixed(1)}%
                      </p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Insights Pendentes</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {analise.metricas_sistema.insights_pendentes}
                      </p>
                    </div>
                    <Brain className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pontos Fortes */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-6 h-6" />
                  Pontos Fortes ({analise.pontos_fortes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.pontos_fortes.map((ponto, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              {ponto.categoria}
                            </Badge>
                            <Badge className="bg-green-600">{ponto.impacto} Impacto</Badge>
                          </div>
                          <p className="font-semibold text-slate-800">{ponto.descricao}</p>
                          <p className="text-sm text-slate-600 mt-1">📊 {ponto.evidencia}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pontos Fracos */}
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-6 h-6" />
                  Pontos Fracos ({analise.pontos_fracos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.pontos_fracos.map((ponto, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-orange-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                              {ponto.categoria}
                            </Badge>
                            <Badge className="bg-orange-600">{ponto.impacto} Impacto</Badge>
                          </div>
                          <p className="font-semibold text-slate-800">{ponto.descricao}</p>
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                            <p className="text-sm text-blue-800">
                              💡 <strong>Solução:</strong> {ponto.solucao}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Gaps Críticos */}
            <Card className="border-2 border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-6 h-6" />
                  Gaps Críticos ({analise.gaps_criticos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.gaps_criticos.map((gap, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border-2 border-red-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                              {gap.categoria}
                            </Badge>
                            <Badge className="bg-red-600">{gap.criticidade}</Badge>
                          </div>
                          <p className="font-semibold text-slate-800 text-lg">{gap.descricao}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                        <p className="text-sm font-semibold text-yellow-800">
                          ⚡ Ação Imediata:
                        </p>
                        <p className="text-sm text-yellow-700 mt-1">
                          {gap.acao_imediata}
                        </p>
                      </div>

                      {gap.itens && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Itens afetados:</p>
                          <div className="flex flex-wrap gap-2">
                            {gap.itens.map((item, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Oportunidades */}
            <Card className="border-2 border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Zap className="w-6 h-6" />
                  Oportunidades ({analise.oportunidades.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.oportunidades.map((op, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                              {op.categoria}
                            </Badge>
                            <Badge className="bg-purple-600">{op.potencial} Potencial</Badge>
                          </div>
                          <p className="font-semibold text-slate-800 text-lg">{op.descricao}</p>
                          <p className="text-sm text-slate-600 mt-2">
                            🔧 {op.implementacao}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                            <TrendingUp className="w-4 h-4" />
                            {op.roi_estimado}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recomendações Priorizadas */}
            <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <BarChart3 className="w-6 h-6" />
                  Roadmap Recomendado - Top {analise.recomendacoes_priorizadas.length} Prioridades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analise.recomendacoes_priorizadas.map((rec, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white p-5 rounded-xl border-2 border-indigo-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
                          #{rec.prioridade}
                        </div>

                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-slate-800 mb-2">
                            {rec.titulo}
                          </h3>
                          <p className="text-sm text-slate-600 mb-3">
                            {rec.descricao}
                          </p>

                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge 
                              className={
                                rec.impacto === 'Crítico' ? 'bg-red-600' :
                                rec.impacto === 'Alto' ? 'bg-orange-600' :
                                'bg-blue-600'
                              }
                            >
                              {rec.impacto} Impacto
                            </Badge>

                            <Badge variant="outline" className="border-purple-300 text-purple-700">
                              {rec.esforco} Esforço
                            </Badge>

                            <Badge variant="outline" className="border-green-300 text-green-700">
                              <Clock className="w-3 h-3 mr-1" />
                              {rec.prazo_sugerido}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Estado Inicial */}
        {!analise && !analisando && (
          <Card className="border-dashed border-2 border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Activity className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500 text-lg font-medium">
                Clique em "Realizar Análise" para começar
              </p>
              <p className="text-slate-400 text-sm mt-2">
                A análise crítica identificará todos os pontos de melhoria do sistema
              </p>
            </Card>
          </CardContent>
        )}
      </div>
    </div>
  );
}