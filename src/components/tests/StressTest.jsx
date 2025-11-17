import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Zap, 
  Activity, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Server,
  Download
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { Cliente } from "@/entities/Cliente";
import { Produto } from "@/entities/Produto";
import { Orcamento } from "@/entities/Orcamento";
import { Venda } from "@/entities/Venda";
import { MotorRAG } from "../inteligencia/MotorRAG";

/**
 * StressTest - Testes de Carga e Performance
 * Valida limites e escalabilidade do sistema
 */
export default function StressTest() {
  const [configuracao, setConfiguracao] = useState({
    usuarios_simultaneos: 10,
    duracao_segundos: 30,
    tipo_teste: 'mixed',
    intervalo_requisicao: 100
  });

  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [metricas, setMetricas] = useState([]);
  const [erros, setErros] = useState([]);

  const TIPOS_TESTE = [
    { 
      value: 'read_only', 
      label: 'Somente Leitura',
      descricao: 'Testa apenas operações de consulta (GET)',
      icon: Database
    },
    { 
      value: 'write_heavy', 
      label: 'Escrita Intensiva',
      descricao: 'Testa criação e atualização de dados',
      icon: TrendingUp
    },
    { 
      value: 'mixed', 
      label: 'Misto (Recomendado)',
      descricao: 'Combina leitura e escrita de forma balanceada',
      icon: Activity
    },
    { 
      value: 'ai_intensive', 
      label: 'IA Intensiva',
      descricao: 'Testa busca RAG e processamento IA',
      icon: Zap
    }
  ];

  /**
   * Executa teste de carga
   */
  const executarStressTest = async () => {
    setExecutando(true);
    setResultados(null);
    setMetricas([]);
    setErros([]);

    const timestampInicio = Date.now();
    const metricsData = [];
    const errorsData = [];
    
    toast.info(`🚀 Iniciando teste com ${configuracao.usuarios_simultaneos} usuários simultâneos`);

    try {
      const totalRequisicoes = Math.floor(
        (configuracao.duracao_segundos * 1000) / configuracao.intervalo_requisicao
      );

      const intervaloColeta = 2000; // Coletar métricas a cada 2s
      let metricasColetadas = 0;

      // Coletor de métricas em tempo real
      const intervalMetrics = setInterval(() => {
        if (metricsData.length > 0) {
          const ultimasMetricas = metricsData.slice(-10);
          const latenciaMedia = ultimasMetricas.reduce((acc, m) => acc + m.latencia, 0) / ultimasMetricas.length;
          const taxaSucesso = (ultimasMetricas.filter(m => m.sucesso).length / ultimasMetricas.length) * 100;

          setMetricas(prev => [...prev, {
            timestamp: metricasColetadas * 2,
            latencia_media: Math.round(latenciaMedia),
            taxa_sucesso: Math.round(taxaSucesso),
            requisicoes: ultimasMetricas.length
          }]);

          metricasColetadas++;
        }
      }, intervaloColeta);

      // Executar requisições em paralelo
      const promessas = [];

      for (let i = 0; i < configuracao.usuarios_simultaneos; i++) {
        const promessa = executarUsuarioSimulado(
          i,
          totalRequisicoes,
          configuracao,
          metricsData,
          errorsData
        );
        promessas.push(promessa);
      }

      await Promise.all(promessas);
      clearInterval(intervalMetrics);

      const tempoTotal = Date.now() - timestampInicio;

      // Calcular estatísticas finais
      const latencias = metricsData.map(m => m.latencia);
      const sucessos = metricsData.filter(m => m.sucesso).length;
      const falhas = metricsData.filter(m => !m.sucesso).length;

      const estatisticas = {
        tempo_total_ms: tempoTotal,
        requisicoes_total: metricsData.length,
        requisicoes_sucesso: sucessos,
        requisicoes_falha: falhas,
        taxa_sucesso: ((sucessos / metricsData.length) * 100).toFixed(2),
        throughput: ((metricsData.length / tempoTotal) * 1000).toFixed(2),
        latencia_media: (latencias.reduce((a, b) => a + b, 0) / latencias.length).toFixed(2),
        latencia_min: Math.min(...latencias),
        latencia_max: Math.max(...latencias),
        latencia_p50: calcularPercentil(latencias, 50),
        latencia_p95: calcularPercentil(latencias, 95),
        latencia_p99: calcularPercentil(latencias, 99)
      };

      setResultados(estatisticas);
      setErros(errorsData);

      if (estatisticas.taxa_sucesso >= 95) {
        toast.success(`✅ Teste concluído com sucesso! Taxa: ${estatisticas.taxa_sucesso}%`);
      } else if (estatisticas.taxa_sucesso >= 80) {
        toast.warning(`⚠️ Teste concluído com avisos. Taxa: ${estatisticas.taxa_sucesso}%`);
      } else {
        toast.error(`❌ Teste revelou problemas. Taxa: ${estatisticas.taxa_sucesso}%`);
      }

    } catch (error) {
      console.error("Erro no stress test:", error);
      toast.error("Erro ao executar teste de carga");
    }

    setExecutando(false);
  };

  /**
   * Simula um usuário fazendo requisições
   */
  const executarUsuarioSimulado = async (userId, totalReqs, config, metricsArray, errorsArray) => {
    const requisicoesPorUsuario = Math.ceil(totalReqs / config.usuarios_simultaneos);

    for (let i = 0; i < requisicoesPorUsuario; i++) {
      try {
        const timestampInicio = Date.now();
        
        // Escolher operação baseada no tipo de teste
        const operacao = escolherOperacao(config.tipo_teste);
        await executarOperacao(operacao);

        const latencia = Date.now() - timestampInicio;

        metricsArray.push({
          userId,
          timestamp: Date.now(),
          operacao,
          latencia,
          sucesso: true
        });

      } catch (error) {
        metricsArray.push({
          userId,
          timestamp: Date.now(),
          latencia: 0,
          sucesso: false
        });

        errorsArray.push({
          userId,
          timestamp: Date.now(),
          erro: error.message
        });
      }

      // Aguardar intervalo entre requisições
      await new Promise(resolve => setTimeout(resolve, config.intervalo_requisicao));
    }
  };

  /**
   * Escolhe operação aleatória baseada no tipo de teste
   */
  const escolherOperacao = (tipoTeste) => {
    const operacoes = {
      read_only: ['list_clientes', 'list_produtos', 'list_vendas', 'list_orcamentos'],
      write_heavy: ['create_cliente', 'update_cliente', 'create_produto', 'create_orcamento'],
      mixed: ['list_clientes', 'list_produtos', 'create_cliente', 'list_vendas', 'create_produto'],
      ai_intensive: ['rag_busca', 'rag_busca', 'list_clientes', 'rag_busca']
    };

    const ops = operacoes[tipoTeste] || operacoes.mixed;
    return ops[Math.floor(Math.random() * ops.length)];
  };

  /**
   * Executa operação específica
   */
  const executarOperacao = async (operacao) => {
    switch (operacao) {
      case 'list_clientes':
        await Cliente.list('-created_date', 20);
        break;

      case 'list_produtos':
        await Produto.list('-created_date', 20);
        break;

      case 'list_vendas':
        await Venda.list('-created_date', 20);
        break;

      case 'list_orcamentos':
        await Orcamento.list('-created_date', 20);
        break;

      case 'create_cliente':
        const cliente = await Cliente.create({
          razao_social: `Stress Test ${Date.now()}`,
          vendedor_responsavel: "Teste Carga",
          status: "Prospect"
        });
        await Cliente.delete(cliente.id);
        break;

      case 'update_cliente':
        const clientes = await Cliente.list('-created_date', 1);
        if (clientes.length > 0) {
          await Cliente.update(clientes[0].id, { observacoes: `Update ${Date.now()}` });
        }
        break;

      case 'create_produto':
        const produto = await Produto.create({
          codigo: `STRESS-${Date.now()}`,
          nome: `Produto Teste ${Date.now()}`,
          preco_venda: 100,
          categoria: "Hardware",
          ativo: true
        });
        await Produto.delete(produto.id);
        break;

      case 'create_orcamento':
        const orcamento = await Orcamento.create({
          numero_orcamento: `ORC-STRESS-${Date.now()}`,
          cliente_nome: "Teste Stress",
          vendedor: "Teste",
          data_orcamento: new Date().toISOString().slice(0, 10),
          valor_total: 1000,
          status: "rascunho"
        });
        await Orcamento.delete(orcamento.id);
        break;

      case 'rag_busca':
        await MotorRAG.buscarConhecimento("teste stress", { limite: 3 });
        break;

      default:
        await Cliente.list('-created_date', 10);
    }
  };

  /**
   * Calcula percentil
   */
  const calcularPercentil = (array, percentil) => {
    const sorted = [...array].sort((a, b) => a - b);
    const index = Math.ceil((percentil / 100) * sorted.length) - 1;
    return sorted[index];
  };

  /**
   * Exporta resultados
   */
  const exportarResultados = () => {
    if (!resultados) return;

    const relatorio = {
      configuracao,
      estatisticas: resultados,
      metricas_tempo_real: metricas,
      erros: erros.slice(0, 100),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stress-test-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Relatório exportado com sucesso");
  };

  const tipoSelecionado = TIPOS_TESTE.find(t => t.value === configuracao.tipo_teste);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 border-2 border-orange-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-600 via-red-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
                <Zap className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-700 to-red-700 bg-clip-text text-transparent">
                  Testes de Carga e Performance
                </h1>
                <p className="text-slate-600 mt-1">
                  Valide os limites e escalabilidade do sistema
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Configuração do Teste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label>Usuários Simultâneos</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={configuracao.usuarios_simultaneos}
                onChange={(e) => setConfiguracao({
                  ...configuracao,
                  usuarios_simultaneos: parseInt(e.target.value) || 1
                })}
                disabled={executando}
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Máximo recomendado: 50
              </p>
            </div>

            <div>
              <Label>Duração (segundos)</Label>
              <Input
                type="number"
                min="10"
                max="300"
                value={configuracao.duracao_segundos}
                onChange={(e) => setConfiguracao({
                  ...configuracao,
                  duracao_segundos: parseInt(e.target.value) || 10
                })}
                disabled={executando}
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Recomendado: 30-60s
              </p>
            </div>

            <div>
              <Label>Intervalo entre Requisições (ms)</Label>
              <Input
                type="number"
                min="50"
                max="5000"
                step="50"
                value={configuracao.intervalo_requisicao}
                onChange={(e) => setConfiguracao({
                  ...configuracao,
                  intervalo_requisicao: parseInt(e.target.value) || 100
                })}
                disabled={executando}
                className="mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Menor = mais intenso
              </p>
            </div>

            <div>
              <Label>Tipo de Teste</Label>
              <Select
                value={configuracao.tipo_teste}
                onValueChange={(value) => setConfiguracao({
                  ...configuracao,
                  tipo_teste: value
                })}
                disabled={executando}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_TESTE.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipoSelecionado && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
              <tipoSelecionado.icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">{tipoSelecionado.label}</h4>
                <p className="text-sm text-blue-700 mt-1">{tipoSelecionado.descricao}</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button
              onClick={executarStressTest}
              disabled={executando}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {executando ? (
                <>
                  <Activity className="w-5 h-5 mr-2 animate-pulse" />
                  Executando Teste...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Iniciar Teste de Carga
                </>
              )}
            </Button>

            {resultados && (
              <Button
                onClick={exportarResultados}
                variant="outline"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar Resultados
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progresso em Tempo Real */}
      {executando && metricas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 animate-pulse text-orange-600" />
              Monitoramento em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  label={{ value: 'Tempo (s)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis yAxisId="left" label={{ value: 'Latência (ms)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Taxa Sucesso (%)', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="latencia_media" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  name="Latência Média"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="taxa_sucesso" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Taxa Sucesso"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Resultados */}
      {resultados && (
        <>
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Throughput</p>
                    <p className="text-2xl font-bold">{resultados.throughput}</p>
                    <p className="text-xs text-slate-500">req/s</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Taxa de Sucesso</p>
                    <p className={`text-2xl font-bold ${
                      parseFloat(resultados.taxa_sucesso) >= 95 ? 'text-green-600' :
                      parseFloat(resultados.taxa_sucesso) >= 80 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {resultados.taxa_sucesso}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {resultados.requisicoes_sucesso}/{resultados.requisicoes_total}
                    </p>
                  </div>
                  {parseFloat(resultados.taxa_sucesso) >= 95 ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-yellow-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Latência Média</p>
                    <p className="text-2xl font-bold">{resultados.latencia_media}ms</p>
                    <p className="text-xs text-slate-500">
                      Min: {resultados.latencia_min}ms | Max: {resultados.latencia_max}ms
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total de Requisições</p>
                    <p className="text-2xl font-bold">{resultados.requisicoes_total}</p>
                    <p className="text-xs text-slate-500">
                      Em {(resultados.tempo_total_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <Database className="w-8 h-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Percentis de Latência */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Latência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">P50 (Mediana)</p>
                  <p className="text-3xl font-bold text-slate-900">{resultados.latencia_p50}ms</p>
                  <p className="text-xs text-slate-500 mt-1">50% das requisições abaixo deste valor</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 mb-2">P95</p>
                  <p className="text-3xl font-bold text-blue-900">{resultados.latencia_p95}ms</p>
                  <p className="text-xs text-blue-600 mt-1">95% das requisições abaixo deste valor</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 mb-2">P99</p>
                  <p className="text-3xl font-bold text-purple-900">{resultados.latencia_p99}ms</p>
                  <p className="text-xs text-purple-600 mt-1">99% das requisições abaixo deste valor</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Erros */}
          {erros.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Erros Detectados ({erros.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {erros.slice(0, 20).map((erro, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-red-200">
                      <p className="text-sm font-mono text-red-800">{erro.erro}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Usuário #{erro.userId} • {new Date(erro.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                  {erros.length > 20 && (
                    <p className="text-sm text-red-600 text-center py-2">
                      + {erros.length - 20} erros adicionais (veja o relatório exportado)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">📊 Análise e Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {parseFloat(resultados.taxa_sucesso) >= 95 && (
                  <div className="flex items-start gap-3 p-3 bg-green-100 rounded-lg border border-green-300">
                    <CheckCircle className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-900">Sistema Estável</h4>
                      <p className="text-sm text-green-700">
                        O sistema está lidando bem com a carga atual. Taxa de sucesso excelente.
                      </p>
                    </div>
                  </div>
                )}

                {parseFloat(resultados.latencia_media) > 1000 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
                    <AlertTriangle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-yellow-900">Latência Elevada</h4>
                      <p className="text-sm text-yellow-700">
                        A latência média está acima de 1 segundo. Considere otimizar queries ou aumentar recursos.
                      </p>
                    </div>
                  </div>
                )}

                {resultados.requisicoes_falha > resultados.requisicoes_total * 0.05 && (
                  <div className="flex items-start gap-3 p-3 bg-red-100 rounded-lg border border-red-300">
                    <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900">Taxa de Erro Alta</h4>
                      <p className="text-sm text-red-700">
                        Mais de 5% das requisições falharam. Investigue os logs de erro e considere implementar rate limiting.
                      </p>
                    </div>
                  </div>
                )}

                {parseFloat(resultados.throughput) > 50 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-100 rounded-lg border border-blue-300">
                    <TrendingUp className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-900">Alta Capacidade</h4>
                      <p className="text-sm text-blue-700">
                        O sistema está processando mais de 50 requisições por segundo. Excelente throughput!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}