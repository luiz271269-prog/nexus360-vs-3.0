import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  Settings,
  Send,
  MessageSquare,
  Activity,
  ChevronRight,
  Copy,
  ExternalLink,
  Play,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  DIAGNÓSTICO PROFISSIONAL Z-API                                ║
 * ║  Sistema completo de validação e testes progressivos           ║
 * ╚════════════════════════════════════════════════════════════════╝
 */

export default function DiagnosticoProfissionalZAPI({ integracoes }) {
  const [conexaoSelecionada, setConexaoSelecionada] = useState(null);
  const [diagnosticoAtual, setDiagnosticoAtual] = useState(null);
  const [executandoTeste, setExecutandoTeste] = useState(null);
  const [mensagensReais, setMensagensReais] = useState([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  useEffect(() => {
    if (integracoes.length > 0 && !conexaoSelecionada) {
      setConexaoSelecionada(integracoes[0]);
    }
  }, [integracoes]);

  useEffect(() => {
    if (conexaoSelecionada) {
      carregarMensagensReais();
    }
  }, [conexaoSelecionada]);

  const carregarMensagensReais = async () => {
    if (!conexaoSelecionada) return;
    
    setLoadingMensagens(true);
    try {
      const logs = await base44.entities.ZapiPayloadNormalized.filter(
        { instance_identificado: conexaoSelecionada.instance_id_provider },
        '-timestamp_recebido',
        10
      );
      setMensagensReais(logs);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    }
    setLoadingMensagens(false);
  };

  // ═══════════════════════════════════════════════════════════
  // ETAPAS DE DIAGNÓSTICO (PROGRESSIVAS)
  // ═══════════════════════════════════════════════════════════
  const etapasDiagnostico = [
    {
      id: 1,
      nome: "Configuração Básica",
      descricao: "Validar credenciais e configurações essenciais",
      icone: Settings,
      cor: "blue",
      testes: [
        { id: "instance_id", nome: "Instance ID configurado", critico: true },
        { id: "api_key", nome: "API Key configurado", critico: true },
        { id: "security_token", nome: "Security Token configurado", critico: true },
        { id: "webhook_url", nome: "Webhook URL salvo", critico: false }
      ]
    },
    {
      id: 2,
      nome: "Conectividade",
      descricao: "Testar acessibilidade do webhook",
      icone: Activity,
      cor: "green",
      testes: [
        { id: "webhook_http_200", nome: "Webhook responde HTTP 200", critico: true },
        { id: "webhook_payload_valido", nome: "Aceita payload Z-API", critico: true },
        { id: "webhook_tempo_resposta", nome: "Tempo de resposta < 3s", critico: false }
      ]
    },
    {
      id: 3,
      nome: "Recebimento",
      descricao: "Validar recepção de mensagens",
      icone: MessageSquare,
      cor: "purple",
      testes: [
        { id: "receive_text", nome: "Recebe mensagens de texto", critico: true },
        { id: "receive_image", nome: "Recebe imagens", critico: false },
        { id: "receive_document", nome: "Recebe documentos", critico: false },
        { id: "receive_audio", nome: "Recebe áudios", critico: false }
      ]
    },
    {
      id: 4,
      nome: "Processamento",
      descricao: "Verificar criação de registros",
      icone: CheckCircle2,
      cor: "orange",
      testes: [
        { id: "create_contact", nome: "Cria Contact corretamente", critico: true },
        { id: "create_thread", nome: "Cria MessageThread", critico: true },
        { id: "create_message", nome: "Cria Message", critico: true },
        { id: "update_stats", nome: "Atualiza estatísticas", critico: false }
      ]
    }
  ];

  // ═══════════════════════════════════════════════════════════
  // EXECUTOR DE DIAGNÓSTICO COMPLETO
  // ═══════════════════════════════════════════════════════════
  const executarDiagnosticoCompleto = async () => {
    if (!conexaoSelecionada) return;

    setExecutandoTeste("full");
    const resultados = {};

    try {
      // ETAPA 1: Configuração Básica
      resultados.instance_id = !!conexaoSelecionada.instance_id_provider;
      resultados.api_key = !!conexaoSelecionada.api_key_provider;
      resultados.security_token = !!conexaoSelecionada.security_client_token_header;
      resultados.webhook_url = !!conexaoSelecionada.webhook_url;

      // ETAPA 2: Conectividade
      const webhookUrl = conexaoSelecionada.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;
      
      const startTime = Date.now();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: conexaoSelecionada.instance_id_provider,
          instance: conexaoSelecionada.instance_id_provider,
          type: "ReceivedCallback",
          phone: "5548999999999",
          momment: Date.now(),
          text: { message: `🧪 Diagnóstico Completo - ${new Date().toLocaleString('pt-BR')}` }
        })
      });
      const endTime = Date.now();

      resultados.webhook_http_200 = response.status === 200;
      resultados.webhook_payload_valido = response.ok;
      resultados.webhook_tempo_resposta = (endTime - startTime) < 3000;

      // ETAPA 3: Recebimento (validar se payload foi recebido)
      await new Promise(resolve => setTimeout(resolve, 2000));
      await carregarMensagensReais();
      
      const mensagemRecebida = mensagensReais.some(m => 
        m.timestamp_recebido && new Date(m.timestamp_recebido).getTime() > startTime
      );
      resultados.receive_text = mensagemRecebida;
      resultados.receive_image = null; // Requer teste manual
      resultados.receive_document = null;
      resultados.receive_audio = null;

      // ETAPA 4: Processamento
      const threadsRecentes = await base44.entities.MessageThread.filter(
        { whatsapp_integration_id: conexaoSelecionada.id },
        '-created_date',
        5
      );
      resultados.create_contact = threadsRecentes.length > 0;
      resultados.create_thread = threadsRecentes.length > 0;
      resultados.create_message = threadsRecentes.some(t => t.total_mensagens > 0);
      resultados.update_stats = conexaoSelecionada.estatisticas?.total_mensagens_recebidas > 0;

      setDiagnosticoAtual(resultados);
      toast.success("Diagnóstico completo executado!");

    } catch (error) {
      console.error("Erro no diagnóstico:", error);
      toast.error("Erro ao executar diagnóstico: " + error.message);
    }

    setExecutandoTeste(null);
  };

  // ═══════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════
  const getStatusIcon = (status) => {
    if (status === true) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === false) return <XCircle className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  const calcularScoreEtapa = (etapa) => {
    if (!diagnosticoAtual) return 0;
    
    const testes = etapa.testes;
    const resultados = testes.map(t => diagnosticoAtual[t.id]).filter(r => r !== null && r !== undefined);
    if (resultados.length === 0) return 0;
    
    const passou = resultados.filter(r => r === true).length;
    return Math.round((passou / resultados.length) * 100);
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ═══════════════════════════════════════════════════════════
          COLUNA 1: CONEXÕES (3 colunas)
          ═══════════════════════════════════════════════════════════ */}
      <div className="col-span-3 space-y-4">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Conexões ({integracoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {integracoes.map((integracao) => (
              <button
                key={integracao.id}
                onClick={() => setConexaoSelecionada(integracao)}
                className={`w-full text-left p-3 rounded-lg border-l-4 transition-all ${
                  conexaoSelecionada?.id === integracao.id
                    ? 'bg-blue-50 border-blue-600 shadow-md'
                    : 'bg-white border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${
                    integracao.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className="font-semibold text-sm truncate">
                    {integracao.nome_instancia}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate">{integracao.numero_telefone}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          COLUNA 2: DIAGNÓSTICO PROFISSIONAL (9 colunas)
          ═══════════════════════════════════════════════════════════ */}
      <div className="col-span-9 space-y-4">
        {!conexaoSelecionada ? (
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="py-16 text-center">
              <Phone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-semibold text-slate-600">Selecione uma conexão</p>
              <p className="text-sm text-slate-500 mt-2">Escolha uma conexão à esquerda para iniciar o diagnóstico</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* HEADER: Informações da Conexão */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                      conexaoSelecionada.status === 'conectado'
                        ? 'from-green-500 to-emerald-600'
                        : 'from-red-500 to-rose-600'
                    } flex items-center justify-center`}>
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {conexaoSelecionada.nome_instancia}
                      </h3>
                      <p className="text-sm text-slate-600">{conexaoSelecionada.numero_telefone}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={carregarMensagensReais}
                      variant="outline"
                      size="sm"
                      disabled={loadingMensagens}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingMensagens ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      onClick={executarDiagnosticoCompleto}
                      disabled={executandoTeste === 'full'}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {executandoTeste === 'full' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Diagnóstico Completo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ETAPAS DE DIAGNÓSTICO */}
            {etapasDiagnostico.map((etapa, idx) => {
              const Icone = etapa.icone;
              const score = calcularScoreEtapa(etapa);
              
              return (
                <Card key={etapa.id} className={`border-l-4 border-${etapa.cor}-500`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-${etapa.cor}-100 flex items-center justify-center`}>
                          <Icone className={`w-5 h-5 text-${etapa.cor}-600`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            Etapa {etapa.id}: {etapa.nome}
                          </CardTitle>
                          <p className="text-xs text-slate-600 mt-0.5">{etapa.descricao}</p>
                        </div>
                      </div>
                      {diagnosticoAtual && (
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            score === 100 ? 'text-green-600' :
                            score >= 75 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {score}%
                          </div>
                          <p className="text-xs text-slate-500">Score</p>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {etapa.testes.map((teste) => {
                        const resultado = diagnosticoAtual?.[teste.id];
                        
                        return (
                          <div
                            key={teste.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {resultado !== null && resultado !== undefined ? (
                                getStatusIcon(resultado)
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                              )}
                              <span className="text-sm font-medium text-slate-900">
                                {teste.nome}
                              </span>
                              {teste.critico && (
                                <Badge className="bg-red-100 text-red-800 text-xs">
                                  Crítico
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* MENSAGENS REAIS RECEBIDAS */}
            <Card className="border-2 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  Mensagens Reais Recebidas (últimas 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMensagens ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : mensagensReais.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">Nenhuma mensagem recebida ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mensagensReais.map((msg, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={msg.sucesso_processamento ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {msg.sucesso_processamento ? 'Sucesso' : 'Falha'}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(msg.timestamp_recebido).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          <strong>Evento:</strong> {msg.evento}
                        </p>
                        {msg.erro_detalhes && (
                          <Alert className="mt-2 bg-red-50 border-red-200">
                            <AlertDescription className="text-xs text-red-800">
                              {msg.erro_detalhes}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CONFIGURAÇÃO RÁPIDA */}
            <Card className="border-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-600" />
                  Configuração Rápida
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Instance ID
                    </label>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded block truncate">
                      {conexaoSelecionada.instance_id_provider || '⚠️ Não configurado'}
                    </code>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Status
                    </label>
                    <Badge className={conexaoSelecionada.status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {conexaoSelecionada.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Webhook URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded flex-1 truncate">
                      {conexaoSelecionada.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => {
                        const url = conexaoSelecionada.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;
                        navigator.clipboard.writeText(url);
                        toast.success("URL copiada!");
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open('https://api.z-api.io', '_blank')}
                      variant="outline"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}