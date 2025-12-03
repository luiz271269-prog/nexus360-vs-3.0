import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function TestSuiteCompleto() {
  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [progresso, setProgresso] = useState(0);
  const [relatorio, setRelatorio] = useState(null);

  const testes = [
    {
      id: 'nexus_classifier',
      nome: 'NexusClassifier - Classificação de Intenções',
      categoria: 'IA',
      descricao: 'Testa classificação de diferentes tipos de mensagens',
      casos: [
        { input: 'Quero comprar um notebook', expectativa: 'vendas' },
        { input: 'Meu produto chegou com defeito', expectativa: 'suporte' },
        { input: 'Onde fica a loja?', expectativa: 'informacao' },
        { input: 'Preciso do boleto', expectativa: 'financeiro' }
      ]
    },
    {
      id: 'nexus_rag',
      nome: 'NexusClassifier - RAG Query',
      categoria: 'IA',
      descricao: 'Testa busca na Base de Conhecimento',
      casos: [
        { input: 'Qual o horário de funcionamento?', expectativa: 'resposta_valida' },
        { input: 'Como faço para devolver um produto?', expectativa: 'resposta_valida' }
      ]
    },
    {
      id: 'playbook_execution',
      nome: 'PlaybookEngine - Execução Básica',
      categoria: 'Automação',
      descricao: 'Testa criação e execução de playbook simples',
      casos: [
        { acao: 'start', expectativa: 'execution_created' },
        { acao: 'process_response', input: 'João Silva', expectativa: 'variable_saved' }
      ]
    },
    {
      id: 'tag_manager',
      nome: 'TagManager - Gestão de Tags',
      categoria: 'Sistema',
      descricao: 'Testa criação, aplicação e remoção de tags',
      casos: [
        { acao: 'create_tag', expectativa: 'tag_created' },
        { acao: 'apply_tag', expectativa: 'tag_applied' },
        { acao: 'process_rules', expectativa: 'rules_processed' }
      ]
    },
    {
      id: 'business_ia',
      nome: 'BusinessIA - Insights Estratégicos',
      categoria: 'IA',
      descricao: 'Testa geração de insights e previsões',
      casos: [
        { acao: 'strategic_insights', expectativa: 'insights_generated' },
        { acao: 'detect_anomalies', expectativa: 'anomalies_checked' }
      ]
    },
    {
      id: 'metrics_engine',
      nome: 'MetricsEngine - Cálculo de KPIs',
      categoria: 'Analytics',
      descricao: 'Testa cálculo de métricas e KPIs',
      casos: [
        { acao: 'calculate_kpis', periodo: 30, expectativa: 'kpis_calculated' }
      ]
    },
    {
      id: 'health_check',
      nome: 'Health Check - Status do Sistema',
      categoria: 'Sistema',
      descricao: 'Verifica saúde de todos os componentes',
      casos: [
        { acao: 'check_system', expectativa: 'status_ok' }
      ]
    }
  ];

  const executarTeste = async (teste, caso) => {
    const inicio = Date.now();
    
    try {
      let resultado;

      switch (teste.id) {
        case 'nexus_classifier':
          resultado = await base44.functions.invoke('nexusClassifier', {
            action: 'classify_intention',
            mensagem: caso.input
          });
          
          return {
            sucesso: resultado.data.intent === caso.expectativa,
            detalhes: `Intent: ${resultado.data.intent} (${Math.round(resultado.data.confidence * 100)}%)`,
            tempo: Date.now() - inicio
          };

        case 'nexus_rag':
          resultado = await base44.functions.invoke('nexusClassifier', {
            action: 'query_rag',
            pergunta: caso.input
          });
          
          return {
            sucesso: resultado.data.resposta && resultado.data.resposta.length > 0,
            detalhes: resultado.data.resposta ? `Resposta: ${resultado.data.resposta.substring(0, 100)}...` : 'Sem resposta',
            tempo: Date.now() - inicio
          };

        case 'playbook_execution':
          // Criar contato de teste
          const contactTest = await base44.entities.Contact.create({
            nome: 'Teste Automatizado',
            telefone: '+5511999999999',
            tags: ['teste_automatizado']
          });

          // Buscar ou criar template de teste
          let templates = await base44.entities.FlowTemplate.filter({ nome: 'Teste Automatizado' });
          let template;
          
          if (templates.length === 0) {
            template = await base44.entities.FlowTemplate.create({
              nome: 'Teste Automatizado',
              categoria: 'vendas',
              gatilhos: ['teste'],
              steps: [
                { type: 'message', texto: 'Olá! Este é um teste.' },
                { type: 'input', texto: 'Qual seu nome?', campo: 'nome' },
                { type: 'end', texto: 'Obrigado!' }
              ],
              ativo: false // Desativado para não interferir em produção
            });
          } else {
            template = templates[0];
          }

          if (caso.acao === 'start') {
            resultado = await base44.functions.invoke('playbookEngine', {
              action: 'start',
              contact_id: contactTest.id,
              flow_template_id: template.id
            });

            return {
              sucesso: !!resultado.data.execution_id,
              detalhes: `Execution ID: ${resultado.data.execution_id}`,
              tempo: Date.now() - inicio,
              executionId: resultado.data.execution_id
            };
          }
          break;

        case 'tag_manager':
          if (caso.acao === 'create_tag') {
            resultado = await base44.functions.invoke('tagManager', {
              action: 'create_tag',
              nome: 'teste_automatizado',
              categoria: 'custom',
              cor: '#FF0000'
            });

            return {
              sucesso: resultado.data.success,
              detalhes: resultado.data.tag_id ? `Tag ID: ${resultado.data.tag_id}` : 'Tag criada',
              tempo: Date.now() - inicio
            };
          }
          break;

        case 'business_ia':
          resultado = await base44.functions.invoke('businessIA', {
            action: caso.acao
          });

          return {
            sucesso: resultado.data.success,
            detalhes: `Insights: ${resultado.data.insights?.length || 0}`,
            tempo: Date.now() - inicio
          };

        case 'metrics_engine':
          resultado = await base44.functions.invoke('metricsEngine', {
            action: caso.acao,
            periodo_dias: caso.periodo
          });

          return {
            sucesso: resultado.data.success,
            detalhes: `KPIs calculados: ${Object.keys(resultado.data.kpis || {}).length}`,
            tempo: Date.now() - inicio
          };

        case 'health_check':
          resultado = await base44.functions.invoke('monitorarSaudeDoSistema', {});

          return {
            sucesso: resultado.data.status_geral !== 'critico',
            detalhes: `Status: ${resultado.data.status_geral}`,
            tempo: Date.now() - inicio
          };

        default:
          return {
            sucesso: false,
            detalhes: 'Teste não implementado',
            tempo: Date.now() - inicio
          };
      }

    } catch (error) {
      return {
        sucesso: false,
        detalhes: `Erro: ${error.message}`,
        tempo: Date.now() - inicio,
        erro: error
      };
    }
  };

  const executarTodosTestes = async () => {
    setExecutando(true);
    setResultados([]);
    setProgresso(0);

    const resultadosCompletos = [];
    const totalTestes = testes.reduce((sum, t) => sum + t.casos.length, 0);
    let testesExecutados = 0;

    for (const teste of testes) {
      for (const caso of teste.casos) {
        const resultado = await executarTeste(teste, caso);
        
        resultadosCompletos.push({
          teste: teste.nome,
          categoria: teste.categoria,
          caso: caso.input || caso.acao,
          ...resultado
        });

        testesExecutados++;
        setProgresso(Math.round((testesExecutados / totalTestes) * 100));
        setResultados([...resultadosCompletos]);

        // Pequeno delay entre testes
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Gerar relatório final
    const sucesso = resultadosCompletos.filter(r => r.sucesso).length;
    const falha = resultadosCompletos.length - sucesso;
    const tempoTotal = resultadosCompletos.reduce((sum, r) => sum + r.tempo, 0);

    setRelatorio({
      total: resultadosCompletos.length,
      sucesso,
      falha,
      taxa_sucesso: Math.round((sucesso / resultadosCompletos.length) * 100),
      tempo_total: tempoTotal,
      tempo_medio: Math.round(tempoTotal / resultadosCompletos.length)
    });

    setExecutando(false);
    
    if (falha === 0) {
      toast.success('✅ Todos os testes passaram!');
    } else {
      toast.warning(`⚠️ ${falha} teste(s) falharam`);
    }
  };

  const limparResultados = () => {
    setResultados([]);
    setProgresso(0);
    setRelatorio(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Suite de Testes Automatizados</CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Validação completa de todos os componentes do sistema
              </p>
            </div>
            <div className="flex gap-2">
              {resultados.length > 0 && (
                <Button variant="outline" onClick={limparResultados}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              )}
              <Button 
                onClick={executarTodosTestes} 
                disabled={executando}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {executando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executando... {progresso}%
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Executar Todos os Testes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Relatório */}
      {relatorio && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{relatorio.total}</div>
                <div className="text-sm text-slate-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{relatorio.sucesso}</div>
                <div className="text-sm text-slate-600">Sucesso</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{relatorio.falha}</div>
                <div className="text-sm text-slate-600">Falhas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{relatorio.taxa_sucesso}%</div>
                <div className="text-sm text-slate-600">Taxa Sucesso</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{relatorio.tempo_medio}ms</div>
                <div className="text-sm text-slate-600">Tempo Médio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Testes */}
      <div className="space-y-4">
        {testes.map(teste => (
          <Card key={teste.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{teste.nome}</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">{teste.descricao}</p>
                </div>
                <Badge>{teste.categoria}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teste.casos.map((caso, idx) => {
                  const resultado = resultados.find(
                    r => r.teste === teste.nome && (r.caso === (caso.input || caso.acao))
                  );

                  return (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        resultado 
                          ? resultado.sucesso 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {resultado ? (
                          resultado.sucesso ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400" />
                        )}
                        <div>
                          <div className="text-sm font-medium">
                            {caso.input || caso.acao}
                          </div>
                          {resultado && (
                            <div className="text-xs text-slate-600 mt-1">
                              {resultado.detalhes}
                            </div>
                          )}
                        </div>
                      </div>
                      {resultado && (
                        <Badge variant="outline" className="text-xs">
                          {resultado.tempo}ms
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}