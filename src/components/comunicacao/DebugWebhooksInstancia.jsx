import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WebhookLog } from "@/entities/WebhookLog";
import { RefreshCw, Bug, CheckCircle, AlertCircle, Clock, Database } from "lucide-react";

export default function DebugWebhooksInstancia({ integracao }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarLogs = async () => {
    setLoading(true);
    setErro(null);
    
    try {
      const logsData = await WebhookLog.filter(
        { instance_id: integracao.instance_id_provider },
        '-timestamp',
        20
      );
      setLogs(logsData);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
      setErro("Não foi possível carregar os logs de webhook");
      
      // NÃO mostrar toast de erro - pode ser que a entidade não exista ainda
      setLogs([]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    // Carregar logs silenciosamente
    carregarLogs();
    
    // Auto-refresh a cada 10 segundos
    const interval = setInterval(carregarLogs, 10000);
    return () => clearInterval(interval);
  }, [integracao.id]);

  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-sm">Debug de Webhooks (Tempo Real)</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={carregarLogs}
            disabled={loading}
            className="h-8"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {erro && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900">Logs não disponíveis</p>
                <p className="text-xs text-amber-700 mt-1">
                  A entidade WebhookLog pode não estar configurada ainda. O sistema funciona normalmente sem ela.
                </p>
              </div>
            </div>
          </div>
        )}

        {!erro && logs.length === 0 && !loading && (
          <div className="text-center py-8 bg-white rounded-lg border-2 border-dashed border-slate-200">
            <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">Nenhum webhook recebido ainda</p>
            <p className="text-xs text-slate-500 mt-1">
              Envie/receba mensagens para ver os logs aqui
            </p>
          </div>
        )}

        {!erro && logs.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={log.id || index}
                className={`p-3 rounded-lg border text-xs ${
                  log.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    )}
                    <Badge className={log.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {log.event_type || 'unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
                
                {log.error && (
                  <p className="text-red-700 text-xs mt-1">
                    ❌ {log.error}
                  </p>
                )}
                
                {log.raw_data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-slate-600 hover:text-slate-800">
                      Ver dados completos
                    </summary>
                    <pre className="mt-2 text-[10px] bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                      {JSON.stringify(log.raw_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}