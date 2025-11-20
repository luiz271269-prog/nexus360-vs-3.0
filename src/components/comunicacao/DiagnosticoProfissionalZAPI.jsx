import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  RefreshCw,
  Phone,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Info,
  Download,
  BarChart3,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function DiagnosticoProfissionalZAPI({ integracoes }) {
  const [conexaoSelecionada, setConexaoSelecionada] = useState(null);
  const [executando, setExecutando] = useState(false);
  const [resultadoAtual, setResultadoAtual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [testesExpandidos, setTestesExpandidos] = useState(new Set());

  useEffect(() => {
    if (integracoes.length > 0 && !conexaoSelecionada) {
      setConexaoSelecionada(integracoes[0]);
    }
  }, [integracoes]);

  useEffect(() => {
    if (conexaoSelecionada) {
      carregarHistorico();
    }
  }, [conexaoSelecionada]);

  const carregarHistorico = async () => {
    if (!conexaoSelecionada) return;
    
    setCarregandoHistorico(true);
    try {
      const execucoes = await base44.entities.DiagnosticoExecucao.filter(
        { whatsapp_integration_id: conexaoSelecionada.id },
        '-data_execucao',
        10
      );
      setHistorico(execucoes);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
    setCarregandoHistorico(false);
  };

  const executarDiagnostico = async () => {
    if (!conexaoSelecionada) {
      toast.error('Selecione uma conexão primeiro');
      return;
    }

    setExecutando(true);
    setResultadoAtual(null);

    try {
      const { data } = await base44.functions.invoke('executarDiagnosticoCompleto', {
        whatsapp_integration_id: conexaoSelecionada.id
      });

      if (data.success) {
        setResultadoAtual(data.diagnostico);
        toast.success(data.message);
        await carregarHistorico();
      } else {
        setResultadoAtual(data.diagnostico);
        toast.error(data.error || 'Erro ao executar diagnóstico');
      }
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast.error('Erro ao executar diagnóstico: ' + error.message);
    } finally {
      setExecutando(false);
    }
  };



  // Funções de etapas removidas - agora executadas no backend

  const toggleTesteExpandido = (testeId) => {
    setTestesExpandidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(testeId)) {
        newSet.delete(testeId);
      } else {
        newSet.add(testeId);
      }
      return newSet;
    });
  };

  const copiarLogCompleto = () => {
    if (!resultadoAtual) {
      toast.error('Nenhum resultado para copiar');
      return;
    }

    const logDetalhado = {
      timestamp: new Date().toISOString(),
      integracao: {
        id: conexaoSelecionada.id,
        nome: conexaoSelecionada.nome_instancia,
        numero: conexaoSelecionada.numero_telefone,
        instance_id: conexaoSelecionada.instance_id_provider
      },
      diagnostico: {
        score_total: resultadoAtual.score_total,
        status_geral: resultadoAtual.status_geral,
        tempo_total_ms: resultadoAtual.tempo_total_ms,
        data_execucao: resultadoAtual.data_execucao,
        etapa_bloqueada: resultadoAtual.etapa_bloqueada
      },
      etapas_detalhadas: resultadoAtual.etapas.map(etapa => ({
        numero: etapa.numero,
        nome: etapa.nome,
        score: etapa.score,
        tempo_ms: etapa.tempo_ms,
        status: etapa.status,
        testes: etapa.testes.map(teste => ({
          nome: teste.nome,
          status: teste.status,
          critico: teste.critico,
          tempo_ms: teste.tempo_ms,
          detalhes: teste.detalhes,
          sugestao_correcao: teste.sugestao_correcao
        }))
      })),
      ambiente: resultadoAtual.ambiente,
      comparacao_anterior: resultadoAtual.comparacao_execucao_anterior
    };

    const textoFormatado = JSON.stringify(logDetalhado, null, 2);
    navigator.clipboard.writeText(textoFormatado);
    toast.success('Log completo copiado! Cole em um editor de texto.');
  };



  const getIconeTeste = (status) => {
    switch (status) {
      case 'sucesso':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'erro':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'aviso':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'executando':
        return <Activity className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCorLinha = (status) => {
    switch (status) {
      case 'sucesso':
        return 'bg-green-50 hover:bg-green-100';
      case 'erro':
        return 'bg-red-50 hover:bg-red-100';
      case 'aviso':
        return 'bg-yellow-50 hover:bg-yellow-100';
      default:
        return 'bg-gray-50 hover:bg-gray-100';
    }
  };

  if (integracoes.length === 0) {
    return (
      <Alert className="bg-yellow-50 border-yellow-300">
        <AlertTriangle className="h-4 w-4 text-yellow-700" />
        <AlertDescription className="text-yellow-800">
          Nenhuma integração configurada. Configure uma conexão na aba "Configurações".
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* COLUNA ESQUERDA: Conexões (30%) */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Conexões ({integracoes.length})
          </h3>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {integracoes.map((integracao) => (
            <Card
              key={integracao.id}
              className={`cursor-pointer transition-all border-l-4 ${
                conexaoSelecionada?.id === integracao.id
                  ? 'shadow-lg ring-2 ring-blue-400 bg-blue-50'
                  : 'hover:shadow-md'
              }`}
              style={{
                borderLeftColor: integracao.status === 'conectado' ? '#22c55e' : '#ef4444'
              }}
              onClick={() => setConexaoSelecionada(integracao)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      integracao.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-slate-900 truncate">
                      {integracao.nome_instancia}
                    </h4>
                    <p className="text-xs text-slate-600 truncate">{integracao.numero_telefone}</p>
                    <Badge
                      className={`mt-1 text-[10px] ${
                        integracao.status === 'conectado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {integracao.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* COLUNA DIREITA: Diagnóstico (70%) */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {conexaoSelecionada ? (
          <>
            {/* Header */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        conexaoSelecionada.status === 'conectado'
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {conexaoSelecionada.nome_instancia}
                      </h3>
                      <p className="text-sm text-slate-600">{conexaoSelecionada.numero_telefone}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={carregarHistorico}
                      variant="outline"
                      size="sm"
                      disabled={carregandoHistorico}
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${carregandoHistorico ? 'animate-spin' : ''}`}
                      />
                      Histórico
                    </Button>
                    <Button
                      onClick={executarDiagnostico}
                      disabled={executando}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {executando ? (
                        <>
                          <Activity className="w-4 h-4 mr-2 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Diagnóstico Completo
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grade de Testes */}
            {resultadoAtual && (
              <Card className="border-2 border-slate-200">
                <CardHeader className="pb-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Resultados do Diagnóstico
                      <Badge className="bg-blue-600 text-white">
                        Score: {resultadoAtual.score_total}%
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copiarLogCompleto}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar Log Completo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b-2 border-slate-300">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700 w-12">✓</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700 w-16">Etapa</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-700">Teste</th>
                          <th className="px-4 py-2 text-center font-semibold text-slate-700 w-24">Status</th>
                          <th className="px-4 py-2 text-center font-semibold text-slate-700 w-24">Tempo</th>
                          <th className="px-4 py-2 text-center font-semibold text-slate-700 w-20">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadoAtual.etapas.map((etapa) => (
                          <React.Fragment key={etapa.numero}>
                            {/* Linha de cabeçalho da etapa */}
                            <tr className="bg-slate-200 border-b border-slate-300">
                              <td className="px-4 py-2">
                                {etapa.status === 'sucesso' ? '✅' : etapa.status === 'erro' ? '❌' : '⚠️'}
                              </td>
                              <td className="px-4 py-2 font-bold text-slate-900">
                                {etapa.numero}
                              </td>
                              <td className="px-4 py-2 font-bold text-slate-900">
                                {etapa.nome}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge className={
                                  etapa.score === 100 ? 'bg-green-600 text-white' :
                                  etapa.score >= 75 ? 'bg-yellow-600 text-white' :
                                  'bg-red-600 text-white'
                                }>
                                  {etapa.score}%
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-center text-xs text-slate-600">
                                {etapa.tempo_ms}ms
                              </td>
                              <td></td>
                            </tr>
                            
                            {/* Linhas de testes */}
                            {etapa.testes.map((teste, idx) => (
                              <React.Fragment key={`${etapa.numero}-${idx}`}>
                                <tr 
                                  className={`border-b border-slate-200 transition-colors ${getCorLinha(teste.status)} cursor-pointer`}
                                  onClick={() => toggleTesteExpandido(`${etapa.numero}-${idx}`)}
                                >
                                  <td className="px-4 py-2 text-center">
                                    {getIconeTeste(teste.status)}
                                  </td>
                                  <td className="px-4 py-2 text-slate-500 text-xs text-center">
                                    {etapa.numero}.{idx + 1}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-900">{teste.nome}</span>
                                      {teste.critico && (
                                        <Badge className="bg-red-600 text-white text-[10px] px-1 py-0">
                                          <Zap className="w-3 h-3" />
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <Badge variant="outline" className="text-xs">
                                      {teste.status}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2 text-center text-xs text-slate-500">
                                    {teste.tempo_ms}ms
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    {(teste.detalhes || teste.sugestao_correcao) && (
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <Info className="w-4 h-4 text-blue-600" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                                
                                {/* Detalhes expandidos */}
                                {testesExpandidos.has(`${etapa.numero}-${idx}`) && (teste.detalhes || teste.sugestao_correcao) && (
                                  <tr className="bg-blue-50 border-b border-blue-200">
                                    <td colSpan="6" className="px-4 py-3">
                                      <div className="space-y-2 text-xs">
                                        {teste.detalhes && (
                                          <div className="bg-white rounded p-2 border border-slate-200">
                                            <span className="font-semibold text-slate-700">Detalhes:</span>
                                            <pre className="text-slate-600 mt-1 overflow-x-auto">
                                              {JSON.stringify(teste.detalhes, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                        {teste.sugestao_correcao && (
                                          <Alert className="bg-yellow-50 border-yellow-300">
                                            <AlertDescription className="text-yellow-900 text-xs">
                                              <strong>💡 Sugestão:</strong> {teste.sugestao_correcao}
                                            </AlertDescription>
                                          </Alert>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Histórico Compacto */}
            {historico.length > 0 && (
              <Card className="border-2 border-slate-200">
                <CardHeader className="pb-3 bg-slate-50">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-600" />
                    Últimas Execuções
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 border-b border-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Data/Hora</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Score</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Tempo</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Etapas</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historico.slice(0, 5).map((exec) => (
                          <tr key={exec.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">
                              {format(new Date(exec.data_execucao), "dd/MM HH:mm", { locale: ptBR })}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge className={
                                exec.score_total === 100 ? 'bg-green-600 text-white text-[10px]' :
                                exec.score_total >= 75 ? 'bg-yellow-600 text-white text-[10px]' :
                                'bg-red-600 text-white text-[10px]'
                              }>
                                {exec.score_total}%
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {exec.tempo_total_ms}ms
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {exec.etapas?.length || 0}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => setResultadoAtual(exec)}
                              >
                                Ver
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Phone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-semibold">Selecione uma conexão</p>
              <p className="text-sm mt-2">Escolha uma conexão à esquerda para iniciar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}