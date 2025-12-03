import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Zap, CheckCircle, AlertCircle, Sparkles, RefreshCw, Target, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function AprendizadoAutomatico() {
  const [processando, setProcessando] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [padroes, setPadroes] = useState(null);

  const queryClient = useQueryClient();

  const { data: execucoes = [] } = useQuery({
    queryKey: ['execucoes_aprendizado'],
    queryFn: () => base44.entities.FlowExecution.list('-updated_date', 1000),
    initialData: []
  });

  const { data: playbooks = [] } = useQuery({
    queryKey: ['playbooks_aprendizado'],
    queryFn: () => base44.entities.FlowTemplate.list(),
    initialData: []
  });

  const analisarPadroes = async () => {
    setProcessando(true);
    try {
      console.log('[APRENDIZADO] Iniciando análise de padrões...');

      // 1. ANÁLISE DE ABANDONO POR STEP
      const abandonoPorStep = analisarAbandonoPorStep(execucoes, playbooks);

      // 2. ANÁLISE DE TEMPO DE RESPOSTA
      const temposResposta = analisarTemposResposta(execucoes, playbooks);

      // 3. ANÁLISE DE INPUTS PROBLEMÁTICOS
      const inputsProblematicos = analisarInputsProblematicos(execucoes);

      // 4. ANÁLISE DE TAXA DE CONVERSÃO
      const taxasConversao = analisarTaxasConversao(execucoes, playbooks);

      // 5. GERAR SUGESTÕES INTELIGENTES
      const novasSugestoes = gerarSugestoesInteligentes(
        abandonoPorStep,
        temposResposta,
        inputsProblematicos,
        taxasConversao
      );

      setPadroes({
        abandonoPorStep,
        temposResposta,
        inputsProblematicos,
        taxasConversao
      });

      setSugestoes(novasSugestoes);

      // Salvar aprendizados na base
      for (const sugestao of novasSugestoes) {
        if (sugestao.salvar) {
          await base44.entities.AprendizadoIA.create({
            tipo_aprendizado: sugestao.tipo,
            contexto: {
              playbook_afetado: sugestao.playbookId,
              metrica: sugestao.metrica
            },
            padrao_identificado: {
              descricao: sugestao.titulo,
              confianca: sugestao.confianca || 75,
              exemplos: sugestao.exemplos || [],
              metricas: sugestao.dados || {}
            },
            aplicabilidade: {
              segmentos_aplicaveis: ['todos']
            },
            ativo: true,
            data_descoberta: new Date().toISOString()
          });
        }
      }

      toast.success(`✨ Análise concluída! ${novasSugestoes.length} insights descobertos.`);
      queryClient.invalidateQueries(['aprendizados']);

    } catch (error) {
      console.error('[APRENDIZADO] Erro:', error);
      toast.error('Erro ao analisar padrões: ' + error.message);
    } finally {
      setProcessando(false);
    }
  };

  const aplicarSugestaoMutation = useMutation({
    mutationFn: async (sugestao) => {
      // Implementar aplicação automática de sugestões
      console.log('[APRENDIZADO] Aplicando sugestão:', sugestao);
      
      if (sugestao.acao === 'revisar_playbook') {
        toast.info('Redirecionando para editor do playbook...');
        // Aqui poderia redirecionar para o editor
      } else if (sugestao.acao === 'ajustar_timeout') {
        // Ajustar timeout automaticamente
        const playbook = playbooks.find(p => p.id === sugestao.playbookId);
        if (playbook) {
          await base44.entities.FlowTemplate.update(playbook.id, {
            timeout_minutos: sugestao.novoValor
          });
          toast.success('Timeout ajustado automaticamente!');
        }
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Aprendizado Automático</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Sistema de análise contínua e otimização de playbooks
                </p>
              </div>
            </div>
            <Button 
              onClick={analisarPadroes} 
              disabled={processando}
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              {processando ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analisar Padrões
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas de Aprendizado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Execuções Analisadas</p>
                <p className="text-3xl font-bold text-purple-600">{execucoes.length}</p>
              </div>
              <Target className="w-10 h-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Playbooks Ativos</p>
                <p className="text-3xl font-bold text-blue-600">{playbooks.filter(p => p.ativo).length}</p>
              </div>
              <Zap className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Insights Gerados</p>
                <p className="text-3xl font-bold text-green-600">{sugestoes.length}</p>
              </div>
              <Sparkles className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Otimizações</p>
                <p className="text-3xl font-bold text-orange-600">
                  {sugestoes.filter(s => s.tipo === 'otimizacao').length}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sugestões de Otimização */}
      {sugestoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Insights e Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sugestoes.map((sug, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-lg border-l-4 ${
                  sug.tipo === 'warning' ? 'border-orange-500 bg-orange-50' :
                  sug.tipo === 'critico' ? 'border-red-500 bg-red-50' :
                  sug.tipo === 'info' ? 'border-blue-500 bg-blue-50' :
                  'border-green-500 bg-green-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {sug.tipo === 'warning' && <AlertCircle className="w-5 h-5 text-orange-600" />}
                      {sug.tipo === 'critico' && <TrendingDown className="w-5 h-5 text-red-600" />}
                      {sug.tipo === 'info' && <Brain className="w-5 h-5 text-blue-600" />}
                      {sug.tipo === 'sucesso' && <CheckCircle className="w-5 h-5 text-green-600" />}
                      
                      <h4 className="font-semibold text-slate-900">{sug.titulo}</h4>
                      
                      {sug.confianca && (
                        <Badge variant="outline" className="text-xs">
                          {sug.confianca}% confiança
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-700 mb-3">{sug.descricao}</p>
                    
                    {sug.impacto && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Impacto estimado: {sug.impacto}</span>
                      </div>
                    )}

                    {sug.exemplos && sug.exemplos.length > 0 && (
                      <details className="text-xs text-slate-600 mt-2">
                        <summary className="cursor-pointer font-medium">Ver exemplos ({sug.exemplos.length})</summary>
                        <ul className="mt-2 ml-4 space-y-1">
                          {sug.exemplos.map((ex, i) => (
                            <li key={i}>• {ex}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  
                  {sug.acao && (
                    <Button
                      size="sm"
                      onClick={() => aplicarSugestaoMutation.mutate(sug)}
                      disabled={aplicarSugestaoMutation.isLoading}
                      className="ml-4"
                    >
                      {sug.acao === 'revisar_playbook' ? 'Revisar' :
                       sug.acao === 'ajustar_timeout' ? 'Ajustar' :
                       'Aplicar'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Padrões Identificados */}
      {padroes && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Abandono por Step */}
          {padroes.abandonoPorStep && padroes.abandonoPorStep.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Steps com Maior Abandono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {padroes.abandonoPorStep.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm font-medium">{item.playbook} - Step {item.step}</span>
                      <Badge className="bg-red-100 text-red-700">{item.taxa}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inputs Problemáticos */}
          {padroes.inputsProblematicos && padroes.inputsProblematicos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Inputs Mais Problemáticos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {padroes.inputsProblematicos.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <span className="text-sm font-medium">{item.campo}</span>
                      <Badge className="bg-orange-100 text-orange-700">{item.erros} erros</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Estado Vazio */}
      {sugestoes.length === 0 && !processando && (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhuma análise realizada ainda
            </h3>
            <p className="text-slate-500 mb-4">
              Clique em "Analisar Padrões" para descobrir insights e otimizações
            </p>
            <Button onClick={analisarPadroes} className="bg-purple-600">
              <Sparkles className="w-4 h-4 mr-2" />
              Iniciar Análise
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ==================== FUNÇÕES DE ANÁLISE ====================

function analisarAbandonoPorStep(execucoes, playbooks) {
  const abandono = [];

  playbooks.forEach(playbook => {
    const execsPlaybook = execucoes.filter(e => e.flow_template_id === playbook.id);
    
    if (execsPlaybook.length < 5) return; // Mínimo de dados

    playbook.steps?.forEach((step, stepIndex) => {
      const abandonoNoStep = execsPlaybook.filter(e => 
        e.status === 'cancelado' && e.current_step === stepIndex
      ).length;

      const taxaAbandono = (abandonoNoStep / execsPlaybook.length) * 100;

      if (taxaAbandono > 20) {
        abandono.push({
          playbook: playbook.nome,
          playbookId: playbook.id,
          step: stepIndex + 1,
          stepTipo: step.type,
          taxa: Math.round(taxaAbandono),
          quantidade: abandonoNoStep
        });
      }
    });
  });

  return abandono.sort((a, b) => b.taxa - a.taxa);
}

function analisarTemposResposta(execucoes, playbooks) {
  const tempos = [];

  playbooks.forEach(playbook => {
    const execsConcluidas = execucoes.filter(e => 
      e.flow_template_id === playbook.id && 
      e.status === 'concluido' &&
      e.started_at
    );

    if (execsConcluidas.length === 0) return;

    const tempoMedio = execsConcluidas.reduce((acc, e) => {
      const inicio = new Date(e.started_at);
      const fim = new Date(e.updated_date);
      return acc + (fim - inicio);
    }, 0) / execsConcluidas.length;

    const minutos = Math.round(tempoMedio / (1000 * 60));

    if (minutos > 10) { // Se demora mais de 10 minutos
      tempos.push({
        playbook: playbook.nome,
        playbookId: playbook.id,
        tempoMedioMinutos: minutos,
        quantidade: execsConcluidas.length
      });
    }
  });

  return tempos.sort((a, b) => b.tempoMedioMinutos - a.tempoMedioMinutos);
}

function analisarInputsProblematicos(execucoes) {
  const problemas = {};

  execucoes.forEach(exec => {
    exec.execution_history?.forEach(h => {
      if (h.error === 'input_invalido' || h.action === 'input_validation_failed') {
        const campo = h.campo || h.step_campo || 'desconhecido';
        if (!problemas[campo]) {
          problemas[campo] = { campo, erros: 0, exemplos: [] };
        }
        problemas[campo].erros++;
        if (h.valor && problemas[campo].exemplos.length < 3) {
          problemas[campo].exemplos.push(h.valor);
        }
      }
    });
  });

  return Object.values(problemas)
    .filter(p => p.erros > 5)
    .sort((a, b) => b.erros - a.erros);
}

function analisarTaxasConversao(execucoes, playbooks) {
  const taxas = [];

  playbooks.forEach(playbook => {
    const execsPlaybook = execucoes.filter(e => e.flow_template_id === playbook.id);
    
    if (execsPlaybook.length < 10) return;

    const concluidas = execsPlaybook.filter(e => e.status === 'concluido').length;
    const taxa = (concluidas / execsPlaybook.length) * 100;

    taxas.push({
      playbook: playbook.nome,
      playbookId: playbook.id,
      taxa: Math.round(taxa),
      total: execsPlaybook.length,
      concluidas
    });
  });

  return taxas.sort((a, b) => a.taxa - b.taxa); // Menor taxa primeiro (problemas)
}

function gerarSugestoesInteligentes(abandono, tempos, inputs, conversao) {
  const sugestoes = [];

  // Sugestões de Abandono
  abandono.slice(0, 3).forEach(a => {
    sugestoes.push({
      tipo: a.taxa > 40 ? 'critico' : 'warning',
      titulo: `Alta taxa de abandono: ${a.playbook}`,
      descricao: `${a.taxa}% dos usuários abandonam no Step ${a.step} (${a.stepTipo}). Considere simplificar ou oferecer ajuda neste ponto.`,
      impacto: `Reduzir abandono pode aumentar conclusões em até ${Math.round(a.taxa / 2)}%`,
      acao: 'revisar_playbook',
      playbookId: a.playbookId,
      metrica: 'abandono',
      confianca: 85,
      salvar: true,
      exemplos: [`Step ${a.step} do tipo ${a.stepTipo} tem ${a.quantidade} abandonos`]
    });
  });

  // Sugestões de Tempo
  tempos.slice(0, 2).forEach(t => {
    sugestoes.push({
      tipo: 'info',
      titulo: `Playbook lento: ${t.playbook}`,
      descricao: `Tempo médio de conclusão é ${t.tempoMedioMinutos} minutos. Considere reduzir steps ou adicionar delays menores.`,
      impacto: 'Melhorar experiência do usuário e engajamento',
      acao: 'ajustar_timeout',
      playbookId: t.playbookId,
      novoValor: Math.max(5, t.tempoMedioMinutos - 5),
      metrica: 'tempo_resposta',
      confianca: 75
    });
  });

  // Sugestões de Inputs
  inputs.slice(0, 3).forEach(i => {
    sugestoes.push({
      tipo: 'warning',
      titulo: `Input problemático: ${i.campo}`,
      descricao: `${i.erros} usuários tiveram dificuldade com o campo "${i.campo}". Considere melhorar a validação ou instruções.`,
      impacto: 'Reduzir frustração e abandono',
      metrica: 'input_validation',
      confianca: 90,
      salvar: true,
      exemplos: i.exemplos
    });
  });

  // Sugestões de Conversão
  conversao.slice(0, 2).forEach(c => {
    if (c.taxa < 50) {
      sugestoes.push({
        tipo: 'critico',
        titulo: `Baixa conversão: ${c.playbook}`,
        descricao: `Apenas ${c.taxa}% de conclusão. Este playbook precisa de revisão urgente.`,
        impacto: `Potencial de dobrar a taxa de conclusão`,
        acao: 'revisar_playbook',
        playbookId: c.playbookId,
        metrica: 'taxa_conversao',
        confianca: 95,
        salvar: true
      });
    }
  });

  // Se não há problemas significativos
  if (sugestoes.length === 0) {
    sugestoes.push({
      tipo: 'sucesso',
      titulo: '✨ Sistema Operando Perfeitamente',
      descricao: 'Todos os playbooks estão com performance satisfatória. Continue monitorando!',
      confianca: 100
    });
  }

  return sugestoes;
}