import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Phone,
  MessageSquare,
  Activity,
  Terminal
} from "lucide-react";
import { toast } from "sonner";

export default function TestadorConexoesMultiplas({ integracoes }) {
  const [testando, setTestando] = useState(null);
  const [resultados, setResultados] = useState({});
  const [logs, setLogs] = useState({});
  const [expandido, setExpandido] = useState({});

  useEffect(() => {
    // Carregar resultados salvos do localStorage
    const savedResults = localStorage.getItem('diagnostic_results');
    if (savedResults) {
      try {
        setResultados(JSON.parse(savedResults));
      } catch (e) {
        console.error('Erro ao carregar resultados salvos:', e);
      }
    }
  }, []);

  const salvarResultados = (novosResultados) => {
    setResultados(novosResultados);
    localStorage.setItem('diagnostic_results', JSON.stringify(novosResultados));
  };

  const testarIntegracao = async (integracao) => {
    setTestando(integracao.id);
    const logsArray = [];
    
    const addLog = (msg, tipo = 'info') => {
      const logEntry = { 
        timestamp: new Date().toISOString(), 
        message: msg, 
        type: tipo 
      };
      logsArray.push(logEntry);
      setLogs(prev => ({
        ...prev,
        [integracao.id]: [...(prev[integracao.id] || []), logEntry]
      }));
    };

    try {
      addLog('🚀 Iniciando teste de conexão...', 'info');
      
      // 1. VERIFICAR DADOS DA INTEGRAÇÃO
      addLog(`📋 Nome: ${integracao.nome_instancia}`, 'info');
      addLog(`📞 Telefone: ${integracao.numero_telefone}`, 'info');
      addLog(`🔑 Instance ID: ${integracao.instance_id_provider || 'NÃO CONFIGURADO'}`, integracao.instance_id_provider ? 'success' : 'error');
      addLog(`🔑 API Key: ${integracao.api_key_provider ? 'Configurado' : 'NÃO CONFIGURADO'}`, integracao.api_key_provider ? 'success' : 'error');
      addLog(`🔐 Security Token: ${integracao.security_client_token_header ? 'Configurado' : 'NÃO CONFIGURADO'}`, integracao.security_client_token_header ? 'success' : 'error');
      
      if (!integracao.instance_id_provider) {
        throw new Error('Instance ID não configurado - Configure em "Configurações"');
      }

      // 2. BUSCAR WEBHOOK URL DA INTEGRAÇÃO (salvada automaticamente)
      const webhookUrl = integracao.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;
      addLog(`🌐 URL do Webhook: ${webhookUrl}`, 'info');
      
      if (!integracao.webhook_url) {
        addLog('⚠️ Webhook URL não está salva na integração - usando fallback', 'warning');
      }

      // 3. ENVIAR PAYLOAD DE TESTE
      addLog('📤 Enviando payload de teste...', 'info');
      
      const payloadTeste = {
        instanceId: integracao.instance_id_provider,
        instance: integracao.instance_id_provider, // Adiciona 'instance' também
        type: "ReceivedCallback",
        event: "ReceivedCallback", // Adiciona 'event' também
        phone: "5548999999999",
        momment: Date.now(),
        text: {
          message: `🧪 TESTE AUTOMÁTICO - ${integracao.nome_instancia} - ${new Date().toLocaleString('pt-BR')}`
        }
      };

      addLog(`📦 Payload: ${JSON.stringify(payloadTeste, null, 2)}`, 'info');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadTeste)
      });

      addLog(`📥 Status HTTP: ${response.status}`, response.ok ? 'success' : 'error');

      const result = await response.json();
      addLog(`📊 Resposta: ${JSON.stringify(result, null, 2)}`, result.success ? 'success' : 'warning');

      // 4. RESULTADO FINAL (sem verificar banco - requer service role)
      const sucesso = response.ok && !result.ignored;
      
      salvarResultados({
        ...resultados,
        [integracao.id]: {
          status: sucesso ? 'success' : 'warning',
          timestamp: new Date().toISOString(),
          httpStatus: response.status,
          webhookUrl,
          webhookResponse: result
        }
      });

      if (sucesso) {
        addLog('🎉 TESTE CONCLUÍDO COM SUCESSO!', 'success');
        toast.success(`✅ ${integracao.nome_instancia} testado com sucesso!`);
      } else {
        addLog('⚠️ Teste concluído com avisos', 'warning');
        toast.warning(`⚠️ ${integracao.nome_instancia} respondeu, mas com avisos`);
      }

    } catch (error) {
      addLog(`❌ ERRO: ${error.message}`, 'error');
      toast.error(`❌ Erro ao testar ${integracao.nome_instancia}`);
      
      salvarResultados({
        ...resultados,
        [integracao.id]: {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    } finally {
      setTestando(null);
    }
  };

  const testarTodas = async () => {
    for (const integracao of integracoes) {
      await testarIntegracao(integracao);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay entre testes
    }
  };

  const limparLogs = (integracaoId) => {
    setLogs(prev => ({ ...prev, [integracaoId]: [] }));
  };

  const limparTodos = () => {
    setLogs({});
    setResultados({});
    localStorage.removeItem('diagnostic_results');
    toast.info('Logs e resultados limpos');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getLogIcon = (tipo) => {
    switch (tipo) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  if (integracoes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma integração configurada. Configure uma conexão na aba "Configurações".
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com ações globais */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-blue-900">
                🧪 Testador de Conexões Múltiplas
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Teste todas as integrações WhatsApp de uma vez
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={limparTodos}
                variant="outline"
                size="sm"
              >
                Limpar Tudo
              </Button>
              <Button
                onClick={testarTodas}
                disabled={testando}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {testando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Activity className="w-4 h-4 mr-2" />
                )}
                Testar Todas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de cada integração */}
      {integracoes.map((integracao) => {
        const resultado = resultados[integracao.id];
        const logsIntegracao = logs[integracao.id] || [];
        const isExpanded = expandido[integracao.id];

        return (
          <Card key={integracao.id} className="border-l-4" style={{
            borderLeftColor: resultado?.status === 'success' ? '#22c55e' : 
                           resultado?.status === 'warning' ? '#eab308' : 
                           resultado?.status === 'error' ? '#ef4444' : '#94a3b8'
          }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {integracao.nome_instancia}
                      {resultado && getStatusIcon(resultado.status)}
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      {integracao.numero_telefone}
                    </p>
                    {resultado?.timestamp && (
                      <p className="text-xs text-slate-500 mt-1">
                        Último teste: {new Date(resultado.timestamp).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {logsIntegracao.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => limparLogs(integracao.id)}
                    >
                      Limpar Logs
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandido(prev => ({ ...prev, [integracao.id]: !prev[integracao.id] }))}
                  >
                    <Terminal className="w-4 h-4 mr-2" />
                    {isExpanded ? 'Ocultar' : 'Ver'} Logs
                  </Button>
                  <Button
                    onClick={() => testarIntegracao(integracao)}
                    disabled={testando === integracao.id}
                    size="sm"
                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                  >
                    {testando === integracao.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Testar
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Informações da integração */}
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Instance ID:</span>
                  <Badge variant={integracao.instance_id_provider ? "default" : "destructive"}>
                    {integracao.instance_id_provider || 'Não configurado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Status:</span>
                  <Badge variant={integracao.status === 'conectado' ? "default" : "secondary"}>
                    {integracao.status}
                  </Badge>
                </div>
              </div>

              {/* Resultados do último teste */}
              {resultado && (
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Resultado do Teste:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100">HTTP {resultado.httpStatus}</Badge>
                      <span className="text-slate-600">
                        {resultado.httpStatus === 200 ? '✅ Webhook respondeu' : '❌ Erro HTTP'}
                      </span>
                    </div>
                    {resultado.webhookResponse && (
                      <div className="bg-white p-2 rounded border border-slate-300">
                        <p className="text-xs font-semibold text-slate-700 mb-1">Resposta do Webhook:</p>
                        <pre className="text-xs text-slate-600 overflow-x-auto">
                          {JSON.stringify(resultado.webhookResponse, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                      {resultado.webhookResponse?.success && !resultado.webhookResponse?.ignored ? 
                        <CheckCircle className="w-5 h-5 text-green-600" /> : 
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      }
                      <span className="font-semibold">
                        {resultado.webhookResponse?.success && !resultado.webhookResponse?.ignored 
                          ? 'Teste bem-sucedido' 
                          : 'Teste com avisos - verifique logs'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Console de logs */}
              {isExpanded && logsIntegracao.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                  {logsIntegracao.map((log, idx) => (
                    <div key={idx} className={`mb-1 ${
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-slate-300'
                    }`}>
                      <span className="text-slate-500">
                        [{new Date(log.timestamp).toLocaleTimeString('pt-BR')}]
                      </span>
                      {' '}
                      {getLogIcon(log.type)} {log.message}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}