import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Loader2,
  Radio,
  Settings,
  Zap,
  Info
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoWebhookWAPI({ integracao, onRecarregar }) {
  const [verificando, setVerificando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [statusWebhooks, setStatusWebhooks] = useState(null);
  const [ultimaMensagemRecebida, setUltimaMensagemRecebida] = useState(null);

  const WEBHOOK_URL_ESPERADA = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

  useEffect(() => {
    if (integracao?.api_provider === 'w_api' || integracao?.modo === 'integrator') {
      verificarStatusWebhooks();
      verificarUltimaMensagem();
    }
  }, [integracao?.id]);

  const verificarStatusWebhooks = async () => {
    if (!integracao) return;
    
    setVerificando(true);
    try {
      const response = await base44.functions.invoke('wapiGerenciarWebhooks', {
        action: 'list',
        integration_id: integracao.id
      });

      if (response.data.success) {
        setStatusWebhooks(response.data.webhooks || []);
        console.log('[DIAGNOSTICO] Webhooks encontrados:', response.data.webhooks);
      } else {
        setStatusWebhooks([]);
        console.warn('[DIAGNOSTICO] Erro ao listar webhooks:', response.data.error);
      }
    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao verificar webhooks:', error);
      setStatusWebhooks([]);
    } finally {
      setVerificando(false);
    }
  };

  const verificarUltimaMensagem = async () => {
    try {
      // Buscar última mensagem recebida desta integração
      const mensagens = await base44.entities.Message.filter(
        { 
          channel: 'whatsapp',
          sender_type: 'contact'
        },
        '-created_date',
        50
      );

      const msgDaIntegracao = mensagens.find(m => 
        m.metadata?.whatsapp_integration_id === integracao.id ||
        m.metadata?.instance_id === integracao.instance_id_provider
      );

      if (msgDaIntegracao) {
        setUltimaMensagemRecebida({
          id: msgDaIntegracao.id,
          content: msgDaIntegracao.content,
          created_date: msgDaIntegracao.created_date,
          tempo_desde_recebimento: Math.floor((Date.now() - new Date(msgDaIntegracao.created_date)) / 1000 / 60)
        });
      } else {
        setUltimaMensagemRecebida(null);
      }
    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao verificar mensagens:', error);
    }
  };

  const registrarWebhooksAgora = async () => {
    setRegistrando(true);
    try {
      console.log('[DIAGNOSTICO] 🔧 Forçando registro de webhooks...');
      toast.info('🔄 Registrando webhooks na W-API...');

      const response = await base44.functions.invoke('wapiGerenciarWebhooks', {
        action: 'register',
        integration_id: integracao.id
      });

      console.log('[DIAGNOSTICO] 📥 Resposta:', response.data);

      if (response.data.success) {
        toast.success(
          <div className="space-y-1">
            <p className="font-bold">✅ Webhooks registrados!</p>
            {response.data.resultados?.map((r, i) => (
              <p key={i} className="text-xs">
                {r.sucesso ? '✅' : '❌'} {r.descricao}
              </p>
            ))}
          </div>,
          { duration: 8000 }
        );
        
        await verificarStatusWebhooks();
        if (onRecarregar) await onRecarregar();
      } else {
        toast.error(
          <div className="space-y-1">
            <p className="font-bold">⚠️ {response.data.message}</p>
            {response.data.resultados?.filter(r => !r.sucesso).map((r, i) => (
              <p key={i} className="text-xs">{r.descricao}: {r.erro}</p>
            ))}
          </div>,
          { duration: 10000 }
        );
      }
    } catch (error) {
      console.error('[DIAGNOSTICO] ❌ Erro:', error);
      toast.error('Erro ao registrar webhooks: ' + error.message);
    } finally {
      setRegistrando(false);
    }
  };

  const webhooksEsperados = ['RECEIVED_MESSAGE', 'SENT_MESSAGE', 'DISCONNECTED'];
  const webhooksConfigurados = statusWebhooks?.map(w => w.event) || [];
  const todosConfigurados = webhooksEsperados.every(e => webhooksConfigurados.includes(e));

  const urlConfiguradaCorreta = integracao?.webhook_url === WEBHOOK_URL_ESPERADA;

  return (
    <div className="space-y-4">
      {/* Status Geral */}
      <Card className={`border-2 ${todosConfigurados && urlConfiguradaCorreta ? 'border-green-500 bg-green-50' : 'border-orange-500 bg-orange-50'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Status de Webhooks W-API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* URL do Webhook */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">URL do Webhook</span>
              <Badge className={urlConfiguradaCorreta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {urlConfiguradaCorreta ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {urlConfiguradaCorreta ? 'Correta' : 'Incorreta'}
              </Badge>
            </div>
            
            <div className="bg-white rounded-lg border p-2 flex items-center gap-2">
              <code className="text-[10px] text-slate-600 flex-1 break-all font-mono">
                {integracao?.webhook_url || 'Não configurada'}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(WEBHOOK_URL_ESPERADA);
                  toast.success("URL copiada!");
                }}
                className="h-6 w-6 p-0 flex-shrink-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>

            {!urlConfiguradaCorreta && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <AlertDescription className="text-xs text-red-700">
                  URL esperada: <code className="font-mono text-[10px]">{WEBHOOK_URL_ESPERADA}</code>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Status dos Webhooks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">Webhooks Registrados</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={verificarStatusWebhooks}
                disabled={verificando}
                className="h-6 text-xs"
              >
                {verificando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            </div>

            <div className="space-y-1">
              {webhooksEsperados.map((evento) => {
                const configurado = webhooksConfigurados.includes(evento);
                return (
                  <div key={evento} className="flex items-center justify-between bg-white rounded border p-2">
                    <span className="text-xs text-slate-600">{evento}</span>
                    <Badge className={configurado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {configurado ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {configurado ? 'OK' : 'Falta'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Última Mensagem Recebida */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-700">Última Mensagem Recebida</span>
            {ultimaMensagemRecebida ? (
              <div className="bg-green-50 rounded-lg border border-green-200 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Recebendo mensagens!</span>
                </div>
                <p className="text-[10px] text-green-600 mb-1">"{ultimaMensagemRecebida.content}"</p>
                <p className="text-[10px] text-slate-500">
                  Há {ultimaMensagemRecebida.tempo_desde_recebimento} minutos
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                  <span className="text-xs text-orange-700">Nenhuma mensagem recebida ainda</span>
                </div>
              </div>
            )}
          </div>

          {/* Ação de Registro */}
          {(!todosConfigurados || !urlConfiguradaCorreta) && (
            <div className="pt-2 border-t">
              <Button
                onClick={registrarWebhooksAgora}
                disabled={registrando}
                className="w-full bg-purple-600 hover:bg-purple-700 h-9 text-xs"
              >
                {registrando ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <Settings className="w-3 h-3 mr-2" />
                    Registrar Webhooks na W-API
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-slate-500 mt-1">
                Isso vai configurar automaticamente os 3 webhooks necessários
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções Visuais */}
      {(!ultimaMensagemRecebida || !todosConfigurados) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
              <Info className="w-4 h-4" />
              Como Testar Mensagens Reais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-900 font-medium">Clique em "Registrar Webhooks na W-API" acima</p>
                  <p className="text-[10px] text-blue-700">Isso vai configurar automaticamente os 3 webhooks necessários</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-900 font-medium">Envie uma mensagem do seu smartphone</p>
                  <p className="text-[10px] text-blue-700">Para o número: {integracao?.numero_telefone || 'Configure o número primeiro'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-700">3</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-900 font-medium">Aguarde 5 segundos e clique em "Verificar Status"</p>
                  <p className="text-[10px] text-blue-700">A mensagem deve aparecer em "Última Mensagem Recebida"</p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200">
              <Button
                onClick={() => {
                  verificarStatusWebhooks();
                  verificarUltimaMensagem();
                }}
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <RefreshCw className="w-3 h-3 mr-2" />
                Verificar Status Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnóstico de Payload */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-600" />
            Logs de Payloads Recebidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PayloadLogViewer integrationId={integracao?.id} />
        </CardContent>
      </Card>
    </div>
  );
}

// Componente para visualizar últimos payloads recebidos
function PayloadLogViewer({ integrationId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.filter(
        { integration_id: integrationId },
        '-timestamp_recebido',
        10
      );
      setLogs(payloads);
    } catch (error) {
      console.error('[LOGS] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (integrationId) {
      carregarLogs();
    }
  }, [integrationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-500">Nenhum payload recebido ainda</p>
        <Button onClick={carregarLogs} size="sm" variant="ghost" className="mt-2 h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" />
          Atualizar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">Últimos {logs.length} payloads</span>
        <Button onClick={carregarLogs} size="sm" variant="ghost" className="h-6 text-xs">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-1 max-h-60 overflow-y-auto">
        {logs.map((log) => {
          const sucesso = log.sucesso_processamento;
          const evento = log.evento || log.payload_bruto?.event || 'unknown';
          const timestamp = new Date(log.timestamp_recebido).toLocaleString('pt-BR');

          return (
            <div
              key={log.id}
              className={`p-2 rounded border text-xs ${
                sucesso ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sucesso ? (
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-600" />
                  )}
                  <span className="font-mono text-[10px]">{evento}</span>
                </div>
                <span className="text-[10px] text-slate-500">{timestamp}</span>
              </div>
              {log.payload_bruto?.text?.message && (
                <p className="text-[10px] text-slate-600 mt-1 truncate">
                  📝 "{log.payload_bruto.text.message}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}