import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Eye,
  Phone,
  MessageSquare,
  Image,
  FileText,
  Mic
} from "lucide-react";
import { format } from "date-fns";

export default function DiagnosticoWebhookReal() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('todos'); // todos, sucesso, erro
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    carregarLogs();
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(carregarLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const webhookLogs = await base44.entities.WebhookLog.list('-timestamp', 50);
      setLogs(webhookLogs);
    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao carregar logs:', error);
    }
    setLoading(false);
  };

  const logsFiltrados = logs.filter(log => {
    if (filtro === 'sucesso') return log.success === true;
    if (filtro === 'erro') return log.success === false;
    return true;
  });

  const getIconeTipoMensagem = (log) => {
    if (log.event_type === 'MessageStatusCallback') {
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    
    const dados = log.raw_data || {};
    
    if (dados.image) return <Image className="w-4 h-4 text-green-500" />;
    if (dados.audio) return <Mic className="w-4 h-4 text-purple-500" />;
    if (dados.document) return <FileText className="w-4 h-4 text-orange-500" />;
    
    return <MessageSquare className="w-4 h-4 text-slate-500" />;
  };

  const getConteudoPreview = (log) => {
    const dados = log.raw_data || {};
    
    if (log.event_type === 'MessageStatusCallback') {
      return `Status: ${dados.status} (${dados.ids?.length || 0} mensagem(ns))`;
    }
    
    if (dados.texto?.mensagem) {
      return dados.texto.mensagem.substring(0, 50) + (dados.texto.mensagem.length > 50 ? '...' : '');
    }
    
    if (dados.image) return '📷 Imagem';
    if (dados.audio) return '🎤 Áudio';
    if (dados.document) return '📄 Documento';
    
    return 'Sem conteúdo';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            Mensagens Reais Recebidas
          </CardTitle>
          <div className="flex items-center gap-2">
            <select 
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso</option>
              <option value="erro">Erro</option>
            </select>
            <Button 
              size="sm" 
              variant="outline"
              onClick={carregarLogs}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logsFiltrados.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma mensagem recebida ainda. Envie uma mensagem do seu WhatsApp para testar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {logsFiltrados.map((log) => (
              <div 
                key={log.id}
                className={`border rounded-lg p-3 ${
                  log.success 
                    ? 'border-green-200 bg-green-50' 
                    : log.processed 
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getIconeTipoMensagem(log)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : log.processed ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="font-medium text-sm">
                          {log.event_type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {log.raw_data?.phone || 'Sem telefone'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {getConteudoPreview(log)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatarTimestamp(log.timestamp)}
                        {log.processing_time_ms && (
                          <span className="ml-2">• {log.processing_time_ms}ms</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandido(expandido === log.id ? null : log.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                {expandido === log.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {log.error && (
                      <Alert className="bg-red-100 border-red-300">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          <strong>Erro:</strong> {log.error}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {log.result && (
                      <div className="bg-green-100 border border-green-300 rounded p-2">
                        <strong className="text-green-900 text-sm">Resultado:</strong>
                        <pre className="text-xs text-green-800 mt-1 overflow-x-auto">
                          {JSON.stringify(log.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="bg-slate-100 border border-slate-300 rounded p-2">
                      <strong className="text-slate-900 text-sm">Payload Completo:</strong>
                      <pre className="text-xs text-slate-700 mt-1 overflow-x-auto max-h-96">
                        {JSON.stringify(log.raw_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatarTimestamp(timestamp) {
  try {
    return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss');
  } catch {
    return timestamp;
  }
}