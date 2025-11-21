import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Terminal,
  Database,
  Eye
} from "lucide-react";
import { toast } from "sonner";

export default function MonitorWebhookLogs() {
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    sucesso: 0,
    erro: 0,
    ultimo: null
  });

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.list('-timestamp_recebido', 20);
      setLogs(payloads);

      const statsCalculadas = {
        total: payloads.length,
        sucesso: payloads.filter(p => p.sucesso_processamento).length,
        erro: payloads.filter(p => !p.sucesso_processamento).length,
        ultimo: payloads[0]?.timestamp_recebido || null
      };
      setStats(statsCalculadas);

      console.log('[MONITOR] Logs atualizados:', statsCalculadas);
    } catch (error) {
      console.error('[MONITOR] Erro ao carregar logs:', error);
      toast.error('Erro ao carregar logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      carregarLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const testarWebhookSimples = async () => {
    try {
      toast.info('Testando webhook simplificado...');
      
      const response = await fetch('/api/functions/whatsappWebhookSimples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance: 'TEST_INSTANCE',
          event: 'test_from_monitor',
          phone: '5548999999999',
          messageId: 'TEST_' + Date.now(),
          text: { message: 'Teste do Monitor' }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Webhook respondeu: ' + result.version);
        setTimeout(carregarLogs, 2000);
      } else {
        toast.error('Webhook retornou erro: ' + result.error);
      }
    } catch (error) {
      toast.error('Erro ao testar webhook: ' + error.message);
    }
  };

  const testarWebhookCompleto = async () => {
    try {
      toast.info('Testando webhook completo (v3.3.1)...');
      
      const response = await fetch('/api/functions/whatsappWebhook?debug=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: 'TEST_INSTANCE',
          event: 'ReceivedCallback',
          phone: '5548999999999',
          messageId: 'TEST_V3_' + Date.now(),
          text: { message: 'Teste Monitor v3.3.1' }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Webhook v3.3.1 OK: ' + (result.processed || 'accepted'));
        setTimeout(carregarLogs, 2000);
      } else {
        toast.error('Webhook v3.3.1 erro: ' + result.error);
      }
    } catch (error) {
      toast.error('Erro ao testar webhook: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <Terminal className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Monitor de Logs Webhook
                </h1>
                <p className="text-slate-300 mt-1">
                  Acompanhamento em tempo real dos payloads recebidos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? "default" : "outline"}
                className={autoRefresh ? "bg-green-600" : ""}
              >
                {autoRefresh ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-pulse" />
                    Auto (5s)
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Manual
                  </>
                )}
              </Button>
              
              <Button
                onClick={carregarLogs}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recarregar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Database className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sucesso}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Erro</p>
                  <p className="text-2xl font-bold text-red-600">{stats.erro}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-slate-500">Último</p>
                <p className="text-sm font-medium">
                  {stats.ultimo ? new Date(stats.ultimo).toLocaleTimeString('pt-BR') : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Testes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Testes Rápidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Os testes abaixo enviam payloads diretamente para os webhooks e verificam se são registrados no banco.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={testarWebhookSimples}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Testar Webhook Simples
              </Button>

              <Button
                onClick={testarWebhookCompleto}
                className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"
              >
                Testar Webhook v3.3.1 (Completo)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Últimos 20 Payloads
              </span>
              {autoRefresh && (
                <Badge className="bg-green-500 animate-pulse">
                  Atualizando a cada 5s
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum payload recebido ainda. Envie uma mensagem de teste via WhatsApp.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border-2 ${
                      log.sucesso_processamento
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.sucesso_processamento ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-semibold text-sm">
                            Evento: <span className="text-blue-600">{log.evento || 'unknown'}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(log.timestamp_recebido).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      
                      <Badge className={log.sucesso_processamento ? 'bg-green-500' : 'bg-red-500'}>
                        {log.sucesso_processamento ? 'Processado' : 'Falhou'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Instance:</span>
                        <span className="ml-2 font-mono text-xs">{log.instance_identificado || 'N/A'}</span>
                      </div>
                      
                      {log.payload_bruto?.messageId && (
                        <div>
                          <span className="text-slate-500">MessageId:</span>
                          <span className="ml-2 font-mono text-xs">{log.payload_bruto.messageId}</span>
                        </div>
                      )}

                      {log.integration_id && (
                        <div>
                          <span className="text-slate-500">Integration ID:</span>
                          <span className="ml-2 font-mono text-xs">{log.integration_id.substring(0, 8)}...</span>
                        </div>
                      )}

                      {log.erro_detalhes && (
                        <div className="col-span-2 mt-2 p-2 bg-red-100 rounded">
                          <span className="text-red-700 text-xs font-semibold">Erro:</span>
                          <p className="text-red-600 text-xs mt-1">{log.erro_detalhes}</p>
                        </div>
                      )}
                    </div>

                    {log.payload_bruto && (
                      <details className="mt-3">
                        <summary className="text-xs text-slate-600 cursor-pointer hover:text-blue-600">
                          Ver payload bruto
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-900 text-green-400 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.payload_bruto, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}