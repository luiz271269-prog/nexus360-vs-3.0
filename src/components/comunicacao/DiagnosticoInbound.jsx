import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Copy,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Loader2,
  Activity,
  Code,
  Clock,
  Phone,
  MessageSquare, // NEW
  Play // NEW
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import GuiaConfiguracao from "./GuiaConfiguracao";
import EstatisticasMensagens from "./EstatisticasMensagens";
import TestadorTiposMidia from "./TestadorTiposMidia";
import DiagnosticoWebhookReal from "./DiagnosticoWebhookReal";

export default function DiagnosticoInbound({ integracoes }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [logExpandido, setLogExpandido] = useState(null);
  const [conexaoSelecionada, setConexaoSelecionada] = useState(integracoes[0] || null);

  useEffect(() => {
    recarregarDados();
  }, []);

  useEffect(() => {
    if (integracoes.length > 0 && !conexaoSelecionada) {
      setConexaoSelecionada(integracoes[0]);
    }
  }, [integracoes]);

  const recarregarDados = async () => { // Renamed from carregarLogs to recarregarDados as per outline
    setLoading(true);
    try {
      const webhookLogs = await base44.entities.WebhookLog.list('-timestamp', 20);
      setLogs(webhookLogs);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
      toast.error("Erro ao carregar logs de webhook");
    }
    setLoading(false);
  };

  const copiarWebhookUrl = (integracao) => {
    const appUrl = window.location.origin;
    const webhookUrl = `${appUrl}/api/functions/inboundWebhook?provider=z_api&instance=${integracao.instance_id_provider}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const enviarMensagemTeste = async (integracao) => {
    setEnviandoTeste(integracao.id);
    try {
      const appUrl = window.location.origin;
      const webhookUrl = `${appUrl}/api/functions/whatsappWebhook`;

      const payloadTeste = {
        event: "messages.upsert",
        instance: integracao.nome_instancia,
        data: {
          messages: [{
            key: {
              remoteJid: "554899999999@s.whatsapp.net",
              id: "TEST_MESSAGE_" + Date.now(),
              fromMe: false
            },
            pushName: "Teste VendaPro",
            message: {
              conversation: `🧪 Teste de recebimento para ${integracao.nome_instancia} (${integracao.numero_telefone})`
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
          }]
        }
      };

      console.log('[TESTE] 📤 Enviando payload de teste:', payloadTeste);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadTeste)
      });

      const result = await response.json();
      console.log('[TESTE] 📥 Resposta do webhook:', result);

      if (response.ok && result.success) {
        toast.success(`✅ Teste para ${integracao.nome_instancia} processado!`, {
          description: `Contact: ${result.contact_id}, Thread: ${result.thread_id}`
        });
        setTimeout(() => recarregarDados(), 2000);
      } else {
        toast.error(`❌ Erro no teste de ${integracao.nome_instancia}`, {
          description: result.error || response.statusText
        });
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem de teste:", error);
      toast.error("Erro ao enviar mensagem de teste: " + error.message);
    }
    setEnviandoTeste(null);
  };

  const getStatusBadge = (log) => {
    if (!log.processed) {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    }
    if (log.success) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sucesso</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  };

  const formatarTimestamp = (timestamp) => {
    try {
      return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🔍 Diagnóstico Inbound</h2>
          <p className="text-slate-600 mt-1">
            Validação completa do sistema de recebimento de mensagens
          </p>
        </div>
        <Button onClick={recarregarDados} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* 🆕 CARD DE ACESSO RÁPIDO AOS TESTES DE PRÉ-ATENDIMENTO */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-purple-900 mb-2">
                🧪 Testes de Pré-atendimento
              </h3>
              <p className="text-sm text-purple-700 mb-4">
                Ambiente isolado para testar o fluxo completo de pré-atendimento: 
                menu de setores, seleção de atendentes e atribuição de conversas.
              </p>
              <a
                href="/TestesPreAtendimento"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Play className="w-4 h-4" />
                Abrir Página de Testes
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NOVO: Tabs para organizar as ferramentas */}
      <Tabs defaultValue="webhook-real" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="webhook-real">
            <Phone className="w-4 h-4 mr-2" />
            Mensagens Reais
          </TabsTrigger>
          <TabsTrigger value="estatisticas">
            <Activity className="w-4 h-4 mr-2" />
            Estatísticas
          </TabsTrigger>
          <TabsTrigger value="testador">
            <Send className="w-4 h-4 mr-2" />
            Testador de Mídia
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Code className="w-4 h-4 mr-2" />
            Logs Completos
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Diagnóstico de Webhooks Reais - LAYOUT EM GRADE (2 COLUNAS) */}
        <TabsContent value="webhook-real">
          {integracoes.length === 0 ? (
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertTriangle className="h-4 w-4 text-yellow-700" />
              <AlertDescription className="text-yellow-800">
                Nenhuma integração configurada. Configure uma conexão na aba "Configurações".
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-12 gap-4 h-[calc(100vh-300px)]">
              {/* COLUNA 1: Lista de Conexões (3 colunas) */}
              <div className="col-span-3 space-y-2 overflow-y-auto pr-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 sticky top-0 bg-white py-2">
                  Conexões ({integracoes.length})
                </h3>
                {integracoes.map((integracao) => (
                  <Card 
                    key={integracao.id} 
                    className={`cursor-pointer transition-all border-l-4 ${
                      conexaoSelecionada?.id === integracao.id 
                        ? 'shadow-lg ring-2 ring-orange-400' 
                        : 'hover:shadow-md'
                    }`}
                    style={{ borderLeftColor: integracao.status === 'conectado' ? '#22c55e' : '#ef4444' }}
                    onClick={() => setConexaoSelecionada(integracao)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          integracao.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        }`} />
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

              {/* COLUNA 2: Mensagens da Conexão Selecionada (9 colunas) */}
              <div className="col-span-9 overflow-y-auto">
                {conexaoSelecionada ? (
                  <div className="space-y-4">
                    <div className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            conexaoSelecionada.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                          }`} />
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {conexaoSelecionada.nome_instancia}
                            </h3>
                            <p className="text-sm text-slate-600">{conexaoSelecionada.numero_telefone}</p>
                          </div>
                        </div>
                        <Badge className={conexaoSelecionada.status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {conexaoSelecionada.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <DiagnosticoWebhookReal integracaoFiltro={conexaoSelecionada} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Phone className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Selecione uma conexão para ver as mensagens</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Aba 2: Estatísticas */}
        <TabsContent value="estatisticas">
          <EstatisticasMensagens />
        </TabsContent>

        {/* Aba 3: Testador de Mídia */}
        <TabsContent value="testador">
          <TestadorTiposMidia integracoes={integracoes} />
        </TabsContent>

        {/* Aba 4: Logs Completos (Mantém a visualização original) */}
        <TabsContent value="logs">
          {/* Guia Passo-a-Passo */}
          <GuiaConfiguracao etapaAtual={1} />

          {/* Instruções de Configuração - SEPARADAS POR CONEXÃO */}
          {integracoes.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {integracoes.map((integracao) => (
                <Card key={integracao.id} className="border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Code className="w-5 h-5 text-blue-600" />
                        {integracao.nome_instancia} - {integracao.numero_telefone}
                      </span>
                      {integracao.status === 'conectado' ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          Desconectado
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Instance ID Verification */}
                    <div className="bg-slate-50 p-4 rounded-lg border-2 border-slate-300">
                      <label className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        Instance ID (Z-API)
                      </label>
                      <div className="bg-white p-3 rounded border border-slate-300">
                        <code className="text-sm font-mono text-slate-900 break-all">
                          {integracao.instance_id_provider || (
                            <span className="text-red-600 font-bold">
                              ⚠️ NÃO CONFIGURADO - MENSAGENS NÃO SERÃO RECEBIDAS!
                            </span>
                          )}
                        </code>
                      </div>
                      {!integracao.instance_id_provider && (
                        <Alert className="bg-red-50 border-red-300 mt-3">
                          <AlertTriangle className="h-4 w-4 text-red-700" />
                          <AlertDescription className="text-red-800 text-xs">
                            <strong>AÇÃO NECESSÁRIA:</strong> Vá para a aba "Configurações" e edite esta integração para adicionar o Instance ID correto da Z-API.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* URL do Webhook */}
                    <div>
                      <label className="text-sm font-medium text-blue-900 mb-2 block">
                        📋 URL do Webhook (Cole na Z-API)
                      </label>
                      <div className="bg-white p-3 rounded-lg border border-blue-300 flex items-center gap-2">
                        <code className="text-sm text-blue-800 flex-1 break-all font-mono">
                          {window.location.origin}/api/functions/whatsappWebhook
                        </code>
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/functions/whatsappWebhook`);
                            toast.success("URL do webhook copiada!");
                          }}
                          className="bg-blue-500 hover:bg-blue-600 flex-shrink-0"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Instruções */}
                    <Alert className="bg-blue-100 border-blue-300">
                      <AlertTriangle className="h-4 w-4 text-blue-700" />
                      <AlertTitle className="text-blue-900">Como Configurar na Z-API</AlertTitle>
                      <AlertDescription className="text-blue-800 text-sm mt-2">
                        <ol className="list-decimal ml-4 space-y-1">
                          <li>Acesse o painel da Z-API: <a href="https://api.z-api.io" target="_blank" rel="noopener noreferrer" className="underline font-bold">https://api.z-api.io</a></li>
                          <li>Vá em <strong>"Instâncias"</strong> → Selecione a instância <strong>{integracao.instance_id_provider}</strong></li>
                          <li>Clique em <strong>"Webhooks e configurações gerais"</strong></li>
                          <li>Cole a URL copiada acima no campo: <strong>"Receive"</strong></li>
                          <li>Clique em <strong>"Salvar"</strong></li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {/* Botões de Ação */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => enviarMensagemTeste(integracao)}
                        disabled={enviandoTeste === integracao.id}
                        className="bg-gradient-to-r from-green-500 to-emerald-600"
                      >
                        {enviandoTeste === integracao.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Testar Recebimento
                      </Button>

                      <Button
                        onClick={() => window.open('https://api.z-api.io', '_blank')}
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Abrir Z-API
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {integracoes.length === 0 && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertTriangle className="h-4 w-4 text-yellow-700" />
              <AlertTitle className="text-yellow-900">Nenhuma Integração Configurada</AlertTitle>
              <AlertDescription className="text-yellow-800">
                Configure uma integração WhatsApp na aba "Configurações" para testar o recebimento de mensagens.
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Últimos Webhooks Recebidos (20 mais recentes)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum webhook recebido ainda.</p>
                  <p className="text-sm mt-1">Envie uma mensagem de teste ou aguarde mensagens reais da Z-API.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge(log)}
                            <Badge variant="outline">{log.provider}</Badge>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.instance_id}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600">
                            <strong>Evento:</strong> {log.event_type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatarTimestamp(log.timestamp)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLogExpandido(logExpandido === log.id ? null : log.id)}
                        >
                          {logExpandido === log.id ? 'Ocultar' : 'Ver Detalhes'}
                        </Button>
                      </div>

                      {log.error && (
                        <Alert className="bg-red-50 border-red-200 mt-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <AlertTitle className="text-red-900">Erro no Processamento</AlertTitle>
                          <AlertDescription className="text-red-800 text-sm">
                            {log.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {log.result && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                          <strong className="text-green-900">Resultado:</strong>
                          <pre className="text-green-800 mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(log.result, null, 2)}
                          </pre>
                        </div>
                      )}

                      {logExpandido === log.id && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded">
                          <p className="text-sm font-bold text-slate-700 mb-2">Raw Data (Payload Completo):</p>
                          <pre className="text-xs text-slate-600 overflow-x-auto max-h-96 overflow-y-auto">
                            {JSON.stringify(log.raw_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}