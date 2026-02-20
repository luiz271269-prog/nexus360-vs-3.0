import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Database,
  ArrowRight,
  Smartphone,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AnalisadorMensagensRecebidas() {
  const [loading, setLoading] = useState(false);
  const [analise, setAnalise] = useState([]);
  const [webhookInfo, setWebhookInfo] = useState(null);

  useEffect(() => {
    carregarDados();
    buscarInfoWebhook();
  }, []);

  const buscarInfoWebhook = async () => {
    try {
      const webhookUrl = `${window.location.origin}/api/functions/webhookWatsZapi`;
      const response = await fetch(webhookUrl, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        setWebhookInfo(data);
        console.log('[ANALISADOR] 🔧 Webhook Info:', data);
      }
    } catch (error) {
      console.error('[ANALISADOR] ⚠️ Erro ao buscar info do webhook:', error);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar últimos 20 payloads recebidos
      const payloads = await base44.entities.ZapiPayloadNormalized.filter(
        { evento: 'ReceivedCallback' },
        '-timestamp_recebido',
        20
      );

      console.log('[ANALISADOR] 📊 Payloads encontrados:', payloads.length);

      // Para cada payload, buscar a Message correspondente
      const analises = await Promise.all(
        payloads.map(async (payload) => {
          const messageId = payload.payload_bruto?.messageId;
          const instanceRecebida = payload.instance_identificado;
          const integrationId = payload.integration_id;
          const telefoneRemetente = payload.payload_bruto?.phone;

          let message = null;
          let thread = null;
          let integration = null;

          // Buscar Message
          if (messageId) {
            const messages = await base44.entities.Message.filter(
              { whatsapp_message_id: messageId },
              '-created_date',
              1
            );
            if (messages.length > 0) {
              message = messages[0];

              // Buscar Thread
              if (message.thread_id) {
                const threads = await base44.entities.MessageThread.filter(
                  { id: message.thread_id },
                  '-created_date',
                  1
                );
                if (threads.length > 0) {
                  thread = threads[0];
                }
              }
            }
          }

          // Buscar WhatsAppIntegration REAL (pela instance recebida)
          if (instanceRecebida) {
            const integs = await base44.entities.WhatsAppIntegration.filter(
              { instance_id_provider: instanceRecebida }
            );
            if (integs.length > 0) {
              integration = integs[0];
            }
          }

          return {
            payload,
            message,
            thread,
            integration,
            diagnostico: {
              payload_persistido: !!payload,
              message_criada: !!message,
              thread_encontrada: !!thread,
              integration_encontrada: !!integration,
              message_tem_metadata_integration: !!(message?.metadata?.whatsapp_integration_id),
              thread_integration_id: thread?.whatsapp_integration_id,
              integration_id_real: integration?.id,
              match_correto: thread?.whatsapp_integration_id === integration?.id,
              instanceRecebida,
              messageId,
              telefoneRemetente
            }
          };
        })
      );

      setAnalise(analises);
      console.log('[ANALISADOR] ✅ Análise completa:', analises);

    } catch (error) {
      console.error('[ANALISADOR] ❌ Erro:', error);
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status) return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📨 Analisador de Mensagens Recebidas</h2>
          <p className="text-slate-600 mt-1">
            Diagnóstico detalhado: Payload → Message → Thread → Conexão Real
          </p>
          {webhookInfo && (
            <div className="flex items-center gap-3 mt-2">
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                v{webhookInfo.version}
              </Badge>
              <Badge className="bg-green-100 text-green-800 text-xs">
                Build: {webhookInfo.build_date}
              </Badge>
              <Badge className="bg-purple-100 text-purple-800 text-xs">
                Deployed: {webhookInfo.deployed_at ? new Date(webhookInfo.deployed_at).toLocaleString('pt-BR') : 'N/A'}
              </Badge>
              {webhookInfo.uptime_seconds !== undefined && (
                <Badge className="bg-slate-100 text-slate-800 text-xs">
                  Uptime: {Math.floor(webhookInfo.uptime_seconds / 60)}min
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button onClick={carregarDados} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {analise.length === 0 && !loading && (
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Nenhuma mensagem recebida encontrada. Envie uma mensagem de teste pelo WhatsApp.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {analise.map((item, idx) => {
          const diag = item.diagnostico;
          const temErro = !diag.match_correto || !diag.message_tem_metadata_integration;

          return (
            <Card key={idx} className={`${temErro ? 'border-2 border-red-300 bg-red-50/30' : 'border-green-200'}`}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>
                      {format(new Date(item.payload.timestamp_recebido), 'dd/MM/yyyy HH:mm:ss')}
                    </span>
                    {temErro && <Badge className="bg-red-600">ERRO DETECTADO</Badge>}
                    {!temErro && <Badge className="bg-green-600">OK</Badge>}
                  </div>
                  <span className="text-xs text-slate-500">
                    {diag.telefoneRemetente}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* PASSO 1: PAYLOAD RECEBIDO */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(diag.payload_persistido)}
                    <span className="font-semibold text-sm">1. Payload Recebido</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    <p><strong>Instance ID:</strong> {diag.instanceRecebida}</p>
                    <p><strong>Message ID:</strong> {diag.messageId || 'N/A'}</p>
                    <p><strong>Telefone:</strong> {diag.telefoneRemetente}</p>
                    <p><strong>Conteúdo:</strong> {item.payload.payload_bruto?.text?.message?.substring(0, 50) || '[Mídia]'}</p>
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-400 mx-auto" />

                {/* PASSO 2: INTEGRAÇÃO IDENTIFICADA */}
                <div className={`rounded-lg p-3 border ${diag.integration_encontrada ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(diag.integration_encontrada)}
                    <span className="font-semibold text-sm">2. WhatsAppIntegration Identificada</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    {item.integration ? (
                      <>
                        <p><strong>Nome:</strong> {item.integration.nome_instancia}</p>
                        <p><strong>Número:</strong> {item.integration.numero_telefone}</p>
                        <p><strong>ID:</strong> <code className="bg-slate-200 px-1 rounded">{item.integration.id}</code></p>
                      </>
                    ) : (
                      <p className="text-red-600">❌ INTEGRAÇÃO NÃO ENCONTRADA para instance: {diag.instanceRecebida}</p>
                    )}
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-400 mx-auto" />

                {/* PASSO 3: MESSAGE CRIADA */}
                <div className={`rounded-lg p-3 border ${diag.message_criada ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(diag.message_criada)}
                    <span className="font-semibold text-sm">3. Message Criada</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    {item.message ? (
                      <>
                        <p><strong>ID:</strong> <code className="bg-slate-200 px-1 rounded">{item.message.id}</code></p>
                        <p><strong>Thread ID:</strong> {item.message.thread_id}</p>
                        <p className="flex items-center gap-1">
                          <strong>metadata.whatsapp_integration_id:</strong> 
                          {item.message.metadata?.whatsapp_integration_id ? (
                            <span className="text-green-700 font-semibold">
                              {item.message.metadata.whatsapp_integration_id}
                            </span>
                          ) : (
                            <Badge className="bg-red-600 text-white text-[10px] px-1 py-0">NÃO SALVO</Badge>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-red-600">❌ MESSAGE NÃO CRIADA</p>
                    )}
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-400 mx-auto" />

                {/* PASSO 4: THREAD */}
                <div className={`rounded-lg p-3 border ${diag.thread_encontrada ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(diag.thread_encontrada)}
                    <span className="font-semibold text-sm">4. MessageThread</span>
                  </div>
                  <div className="ml-6 space-y-1 text-xs">
                    {item.thread ? (
                      <>
                        <p><strong>ID:</strong> <code className="bg-slate-200 px-1 rounded">{item.thread.id}</code></p>
                        <p className="flex items-center gap-1">
                          <strong>whatsapp_integration_id (na Thread):</strong>
                          {item.thread.whatsapp_integration_id ? (
                            <span className="text-purple-700 font-semibold">
                              {item.thread.whatsapp_integration_id}
                            </span>
                          ) : (
                            <Badge className="bg-red-600 text-white text-[10px] px-1 py-0">NULL</Badge>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-red-600">❌ THREAD NÃO ENCONTRADA</p>
                    )}
                  </div>
                </div>

                {/* DIAGNÓSTICO FINAL */}
                <div className={`rounded-xl p-4 border-2 ${temErro ? 'bg-red-50 border-red-400' : 'bg-green-50 border-green-400'}`}>
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                    {temErro ? (
                      <>
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-900">🚨 PROBLEMA IDENTIFICADO</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-900">✅ TUDO OK</span>
                      </>
                    )}
                  </h4>

                  <div className="space-y-2 text-xs">
                    {/* Checklist */}
                    <div className="flex items-center gap-2">
                      {getStatusIcon(diag.message_tem_metadata_integration)}
                      <span>Message tem metadata.whatsapp_integration_id</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusIcon(diag.match_correto)}
                      <span>Thread.whatsapp_integration_id MATCH com integração real</span>
                    </div>

                    {/* Comparação visual */}
                    {diag.integration_encontrada && (
                      <div className="mt-3 pt-3 border-t border-slate-300">
                        <p className="font-semibold mb-2">🔍 Comparação:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded p-2 border border-blue-200">
                            <p className="text-[10px] text-blue-600 font-semibold mb-1">CONEXÃO REAL (Payload)</p>
                            <p className="font-mono text-xs">{item.integration?.numero_telefone}</p>
                            <p className="text-[10px] text-slate-500 mt-1">ID: {diag.integration_id_real?.substring(0, 8)}...</p>
                          </div>
                          <div className={`rounded p-2 border ${diag.match_correto ? 'bg-white border-green-200' : 'bg-red-100 border-red-300'}`}>
                            <p className="text-[10px] text-purple-600 font-semibold mb-1">THREAD (Salvo no DB)</p>
                            {item.thread?.whatsapp_integration_id ? (
                              <>
                                <p className="font-mono text-xs">
                                  ID: {item.thread.whatsapp_integration_id?.substring(0, 8)}...
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">Status: {diag.match_correto ? '✅ Correto' : '❌ Incorreto'}</p>
                              </>
                            ) : (
                              <p className="text-red-600 font-semibold">NULL</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Erro específico */}
                    {!diag.match_correto && diag.thread_encontrada && diag.integration_encontrada && (
                      <Alert className="mt-3 bg-red-100 border-red-300">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-xs text-red-800">
                          <strong>ERRO:</strong> A thread está associada à conexão ERRADA!
                          <br />
                          <strong>Esperado (Payload):</strong> {item.integration.numero_telefone}
                          <br />
                          <strong>Mas está salvo na Thread:</strong> {diag.thread_integration_id || 'NULL'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {!diag.message_tem_metadata_integration && diag.message_criada && (
                      <Alert className="mt-3 bg-orange-100 border-orange-300">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        <AlertDescription className="text-xs text-orange-800">
                          <strong>AVISO:</strong> Message criada SEM metadata.whatsapp_integration_id
                          <br />
                          O webhook NÃO salvou qual conexão recebeu esta mensagem.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                {/* Detalhes técnicos expansível */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
                    🔧 Ver detalhes técnicos completos
                  </summary>
                  <pre className="mt-2 bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto text-[10px]">
                    {JSON.stringify({
                      payload_bruto: item.payload.payload_bruto,
                      message_completa: item.message,
                      thread_completa: item.thread,
                      integration_completa: item.integration
                    }, null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}