import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Copy,
  RefreshCw,
  MessageSquare,
  Database,
  Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoInbound() {
  const [loading, setLoading] = useState(true);
  const [testando, setTestando] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [integracoes, setIntegracoes] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [integracoesData, logsData] = await Promise.all([
        base44.entities.WhatsAppIntegration.list('-created_date'),
        base44.entities.WebhookLog.list('-timestamp', 20)
      ]);

      setIntegracoes(integracoesData);
      setWebhookLogs(logsData);

      if (integracoesData.length > 0 && !selectedIntegration) {
        setSelectedIntegration(integracoesData[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do diagnóstico");
    }
    setLoading(false);
  };

  const gerarWebhookUrl = (integracao) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/functions/inboundWebhook?provider=z_api&instance=${integracao.instance_id_provider}`;
  };

  const copiarWebhookUrl = (integracao) => {
    const url = gerarWebhookUrl(integracao);
    navigator.clipboard.writeText(url);
    toast.success("URL do Webhook copiada!");
  };

  const testarWebhook = async () => {
    if (!selectedIntegration) {
      toast.error("Selecione uma integração primeiro");
      return;
    }

    setTestando(true);
    try {
      const payloadTeste = {
        event: "message-received",
        instanceId: selectedIntegration.instance_id_provider,
        data: {
          key: {
            remoteJid: "5548999322400@s.whatsapp.net",
            fromMe: false,
            id: "TESTE_" + Date.now()
          },
          message: {
            conversation: "Teste de recebimento - " + new Date().toISOString()
          },
          pushName: "Teste VendaPro",
          messageTimestamp: Math.floor(Date.now() / 1000)
        }
      };

      const webhookUrl = gerarWebhookUrl(selectedIntegration);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadTeste)
      });

      const resultado = await response.json();

      if (resultado.success) {
        toast.success("✅ Webhook testado com sucesso!");
        setTimeout(() => carregarDados(), 2000);
      } else {
        toast.error(`❌ Erro no teste: ${resultado.error}`);
      }

    } catch (error) {
      console.error("Erro ao testar webhook:", error);
      toast.error(`Erro ao testar: ${error.message}`);
    }
    setTestando(false);
  };

  const renderStatusBadge = (status) => {
    if (status === true) {
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
    }
    if (status === false) {
      return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Falha</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Pendente</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Diagnóstico de Recebimento (Inbound)</h1>
          <p className="text-slate-600 mt-1">Monitore e teste o recebimento de mensagens da Z-API</p>
        </div>
        <Button onClick={carregarDados} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Integrações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            Integrações WhatsApp Configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {integracoes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma integração WhatsApp configurada
            </div>
          ) : (
            <div className="space-y-4">
              {integracoes.map(integracao => (
                <div
                  key={integracao.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedIntegration?.id === integracao.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedIntegration(integracao)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{integracao.nome_instancia}</h3>
                      <p className="text-sm text-slate-600">{integracao.numero_telefone}</p>
                      <div className="mt-2 flex gap-2">
                        <Badge className={integracao.status === 'conectado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {integracao.status}
                        </Badge>
                        <Badge variant="outline">ID: {integracao.instance_id_provider}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          copiarWebhookUrl(integracao);
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar URL Webhook
                      </Button>
                    </div>
                  </div>

                  {selectedIntegration?.id === integracao.id && (
                    <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">URL do Webhook para configurar na Z-API:</p>
                      <code className="text-xs bg-blue-50 p-2 rounded block break-all text-blue-800">
                        {gerarWebhookUrl(integracao)}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teste Manual */}
      <Card className="border-2 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Teste Manual de Recebimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700 mb-4">
            Simule o recebimento de uma mensagem da Z-API para validar a configuração.
          </p>
          <Button
            onClick={testarWebhook}
            disabled={testando || !selectedIntegration}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {testando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Últimos Webhooks Recebidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-green-600" />
            Últimos Webhooks Recebidos (WebhookLog)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhum webhook recebido ainda
            </div>
          ) : (
            <div className="space-y-3">
              {webhookLogs.map(log => (
                <div key={log.id} className="p-4 border rounded-lg hover:bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {renderStatusBadge(log.success)}
                      <Badge variant="outline">{log.event_type}</Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {log.processing_time_ms && (
                      <span className="text-xs text-slate-500">
                        {log.processing_time_ms}ms
                      </span>
                    )}
                  </div>

                  {log.error && (
                    <div className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">
                      ❌ {log.error}
                    </div>
                  )}

                  {log.result && (
                    <div className="text-sm text-green-700 mt-2 p-2 bg-green-50 rounded">
                      ✅ Thread: {log.result.thread_id} | Contact: {log.result.contact_id}
                    </div>
                  )}

                  <details className="mt-2">
                    <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                      Ver Payload Completo
                    </summary>
                    <pre className="mt-2 text-xs bg-slate-100 p-3 rounded overflow-x-auto">
                      {JSON.stringify(log.raw_data, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}