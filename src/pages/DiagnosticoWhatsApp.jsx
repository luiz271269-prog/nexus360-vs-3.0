import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  MessageSquare,
  Webhook,
  Database,
  Brain,
  Bug,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIntegration } from "@/entities/WhatsAppIntegration";
import { MessageThread } from "@/entities/MessageThread";
import { Message } from "@/entities/Message";
import { Contact } from "@/entities/Contact";
import { testarConexaoWhatsApp } from "@/functions/testarConexaoWhatsApp";
import { enviarWhatsApp } from "@/functions/enviarWhatsApp";
import { base44 } from "@/api/base44Client";

export default function DiagnosticoWhatsApp() {
  const [testando, setTestando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [integracao, setIntegracao] = useState(null);
  const [numeroTeste, setNumeroTeste] = useState("");
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    carregarIntegracao();
    carregarLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(carregarLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const carregarIntegracao = async () => {
    try {
      const integracoes = await WhatsAppIntegration.filter({ status: "conectado" });
      if (integracoes.length > 0) {
        setIntegracao(integracoes[0]);
        toast.success("Integração WhatsApp encontrada!");
      } else {
        toast.error("Nenhuma integração WhatsApp conectada encontrada");
      }
    } catch (error) {
      console.error("Erro ao carregar integração:", error);
      toast.error("Erro ao carregar integração WhatsApp");
    }
  };

  const carregarLogs = async () => {
    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.list('-timestamp_recebido', 20);
      setLogs(payloads);
      console.log('[DIAGNOSTICO] Logs atualizados:', payloads.length);
    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao carregar logs:', error);
    }
  };

  const executarDiagnosticoCompleto = async () => {
    if (!integracao) {
      toast.error("Nenhuma integração disponível para testar");
      return;
    }

    setTestando(true);
    setResultados([]);
    const novosResultados = [];

    // Teste 1: Conexão com Provider
    novosResultados.push({
      etapa: "Conexão com Provider",
      status: "testando",
      detalhes: "Verificando conexão com Z-API..."
    });
    setResultados([...novosResultados]);

    try {
      const respostaConexao = await testarConexaoWhatsApp({ integration_id: integracao.id });

      if (respostaConexao.data.success && respostaConexao.data.conectado) {
        novosResultados[0] = {
          etapa: "Conexão com Provider",
          status: "sucesso",
          detalhes: `✅ Conectado! Instância: ${respostaConexao.data.instanceName || integracao.nome_instancia}`
        };
      } else {
        novosResultados[0] = {
          etapa: "Conexão com Provider",
          status: "erro",
          detalhes: `❌ Erro: ${respostaConexao.data.erro || "Desconectado"}`
        };
      }
    } catch (error) {
      novosResultados[0] = {
        etapa: "Conexão com Provider",
        status: "erro",
        detalhes: `❌ Erro na chamada: ${error.message}`
      };
    }
    setResultados([...novosResultados]);

    // Teste 2: Webhooks Recebidos (ZapiPayloadNormalized)
    novosResultados.push({
      etapa: "Webhooks Recebidos",
      status: "testando",
      detalhes: "Verificando payloads recebidos..."
    });
    setResultados([...novosResultados]);

    try {
      const payloads = await base44.entities.ZapiPayloadNormalized.list("-timestamp_recebido", 20);
      const payloadsRecentes = payloads.filter(p => {
        const diff = Date.now() - new Date(p.timestamp_recebido).getTime();
        return diff < 5 * 60 * 1000;
      });

      if (payloadsRecentes.length > 0) {
        const sucessos = payloadsRecentes.filter(p => p.sucesso_processamento).length;
        novosResultados[1] = {
          etapa: "Webhooks Recebidos",
          status: "sucesso",
          detalhes: `✅ ${payloadsRecentes.length} payloads nos últimos 5min (${sucessos} processados OK)`
        };
      } else {
        novosResultados[1] = {
          etapa: "Webhooks Recebidos",
          status: "aviso",
          detalhes: "⚠️ Nenhum payload recebido nos últimos 5 minutos"
        };
      }
    } catch (error) {
      novosResultados[1] = {
        etapa: "Webhooks Recebidos",
        status: "erro",
        detalhes: `❌ Erro ao verificar payloads: ${error.message}`
      };
    }
    setResultados([...novosResultados]);

    // Teste 3: Threads de Mensagem
    novosResultados.push({
      etapa: "Threads de Mensagem",
      status: "testando",
      detalhes: "Verificando threads criadas..."
    });
    setResultados([...novosResultados]);

    try {
      const threads = await MessageThread.list("-created_date", 5);

      if (threads.length > 0) {
        novosResultados[2] = {
          etapa: "Threads de Mensagem",
          status: "sucesso",
          detalhes: `✅ ${threads.length} conversas encontradas. Última: ${threads[0].last_message_at ? new Date(threads[0].last_message_at).toLocaleString('pt-BR') : 'N/A'}`
        };
      } else {
        novosResultados[2] = {
          etapa: "Threads de Mensagem",
          status: "aviso",
          detalhes: "⚠️ Nenhuma thread de mensagem encontrada ainda"
        };
      }
    } catch (error) {
      novosResultados[2] = {
        etapa: "Threads de Mensagem",
        status: "erro",
        detalhes: `❌ Erro ao verificar threads: ${error.message}`
      };
    }
    setResultados([...novosResultados]);

    // Teste 4: Mensagens Armazenadas
    novosResultados.push({
      etapa: "Mensagens Armazenadas",
      status: "testando",
      detalhes: "Verificando mensagens no banco..."
    });
    setResultados([...novosResultados]);

    try {
      const mensagens = await Message.list("-sent_at", 10);

      if (mensagens.length > 0) {
        const recebidas = mensagens.filter(m => m.sender_type === "contact").length;
        const enviadas = mensagens.filter(m => m.sender_type === "user").length;

        novosResultados[3] = {
          etapa: "Mensagens Armazenadas",
          status: "sucesso",
          detalhes: `✅ ${mensagens.length} mensagens (${recebidas} recebidas, ${enviadas} enviadas)`
        };
      } else {
        novosResultados[3] = {
          etapa: "Mensagens Armazenadas",
          status: "aviso",
          detalhes: "⚠️ Nenhuma mensagem armazenada ainda"
        };
      }
    } catch (error) {
      novosResultados[3] = {
        etapa: "Mensagens Armazenadas",
        status: "erro",
        detalhes: `❌ Erro ao verificar mensagens: ${error.message}`
      };
    }
    setResultados([...novosResultados]);

    // Teste 5: Contatos Criados
    novosResultados.push({
      etapa: "Contatos Criados",
      status: "testando",
      detalhes: "Verificando contatos..."
    });
    setResultados([...novosResultados]);

    try {
      const contatos = await Contact.list("-created_date", 5);

      if (contatos.length > 0) {
        novosResultados[4] = {
          etapa: "Contatos Criados",
          status: "sucesso",
          detalhes: `✅ ${contatos.length} contatos registrados. Último: ${contatos[0].nome}`
        };
      } else {
        novosResultados[4] = {
          etapa: "Contatos Criados",
          status: "aviso",
          detalhes: "⚠️ Nenhum contato registrado ainda"
        };
      }
    } catch (error) {
      novosResultados[4] = {
        etapa: "Contatos Criados",
        status: "erro",
        detalhes: `❌ Erro ao verificar contatos: ${error.message}`
      };
    }
    setResultados([...novosResultados]);

    setTestando(false);
    toast.success("Diagnóstico completo finalizado!");
  };

  const testarEnvioMensagem = async () => {
    if (!numeroTeste) {
      toast.error("Digite um número de teste");
      return;
    }

    if (!integracao) {
      toast.error("Nenhuma integração disponível");
      return;
    }

    try {
      toast.info("Enviando mensagem de teste...");

      const resultado = await enviarWhatsApp({
        integration_id: integracao.id,
        destinatario: numeroTeste,
        mensagem: `🤖 Teste de diagnóstico VendaPro\n\nHora: ${new Date().toLocaleTimeString('pt-BR')}\n\nSe você recebeu esta mensagem, o sistema está funcionando perfeitamente! ✅`
      });

      if (resultado.data.success) {
        toast.success("Mensagem enviada com sucesso!");
      } else {
        toast.error(`Erro ao enviar: ${resultado.data.error}`);
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "sucesso":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "erro":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "aviso":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "testando":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "sucesso":
        return <Badge className="bg-green-500">Sucesso</Badge>;
      case "erro":
        return <Badge className="bg-red-500">Erro</Badge>;
      case "aviso":
        return <Badge className="bg-yellow-500">Atenção</Badge>;
      case "testando":
        return <Badge className="bg-blue-500">Testando...</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen p-6"> {/* Removed specific background gradient */}
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
                <MessageSquare className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Diagnóstico WhatsApp
                </h1>
                <p className="text-slate-300 mt-1">
                  Ferramentas de análise e troubleshooting
                </p>
              </div>
            </div>

            <Button
              onClick={executarDiagnosticoCompleto}
              disabled={testando}
              className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30"
            >
              {testando ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Diagnosticando...
                </>
              ) : (
                <>
                  <Bug className="w-5 h-5 mr-2" />
                  Executar Diagnóstico
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status da Integração */}
        {integracao && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-orange-500" /> {/* Changed color */}
                Integração Ativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Nome</p>
                  <p className="font-semibold">{integracao.nome_instancia}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Provider</p>
                  <p className="font-semibold capitalize">{integracao.api_provider?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Número</p>
                  <p className="font-semibold">{integracao.numero_telefone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={`${
                    integracao.status === 'conectado' ? 'bg-green-500' :
                    integracao.status === 'desconectado' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`}>
                    {integracao.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botões de Ação - Removed as button is now in header */}

        {/* Teste de Envio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-500" /> {/* Changed color */}
              Teste de Envio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Digite o número (ex: +5548999322400)"
                value={numeroTeste}
                onChange={(e) => setNumeroTeste(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" // Changed ring color
              />
              <Button
                onClick={testarEnvioMensagem}
                className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-500/30" // Changed to orange gradient
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Teste
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resultados do Diagnóstico */}
        {resultados.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados do Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {resultados.map((resultado, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="mt-0.5">
                      {getStatusIcon(resultado.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-900">{resultado.etapa}</h4>
                        {getStatusBadge(resultado.status)}
                      </div>
                      <p className="text-sm text-slate-600">{resultado.detalhes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monitor de Logs em Tempo Real */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-500" />
                Monitor de Logs (Últimos 20 Payloads)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  size="sm"
                  variant={autoRefresh ? "default" : "outline"}
                  className={autoRefresh ? "bg-green-600" : ""}
                >
                  {autoRefresh ? "Auto 5s ✓" : "Manual"}
                </Button>
                <Button onClick={carregarLogs} size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhum payload recebido ainda. Envie uma mensagem via WhatsApp para testar.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border-2 ${
                      log.sucesso_processamento
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.sucesso_processamento ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <div>
                          <p className="font-semibold text-xs">
                            {log.evento || 'unknown'} • {log.instance_identificado || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(log.timestamp_recebido).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge className={log.sucesso_processamento ? 'bg-green-500' : 'bg-red-500'}>
                        {log.sucesso_processamento ? 'OK' : 'ERRO'}
                      </Badge>
                    </div>
                    {log.erro_detalhes && (
                      <div className="mt-2 p-2 bg-red-100 rounded">
                        <p className="text-red-600 text-xs">{log.erro_detalhes}</p>
                      </div>
                    )}
                    {log.payload_bruto?.messageId && (
                      <p className="text-xs text-slate-600 mt-1">
                        MessageId: {log.payload_bruto.messageId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guia de Solução de Problemas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-500" />
              Guia de Solução de Problemas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Webhooks não estão chegando?</strong>
                  <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                    <li>Verifique se a URL do webhook está configurada no painel da Z-API</li>
                    <li>A URL deve ser: <code className="bg-slate-100 px-2 py-1 rounded">https://[SEU_DOMINIO]/api/functions/whatsappWebhook</code></li>
                    <li>Certifique-se de que o HTTPS está habilitado</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  <strong>Mensagens não estão sendo salvas?</strong>
                  <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                    <li>Verifique os logs de webhook em "Debug Webhooks"</li>
                    <li>Confirme que o handler correto está sendo usado (ZAPIWebhookHandler)</li>
                    <li>Verifique se há erros no processamento do webhook</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}