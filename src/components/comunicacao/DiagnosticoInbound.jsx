import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
import DiagnosticoProfissionalZAPI from "./DiagnosticoProfissionalZAPI";

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
      // ✅ BUSCAR URL DO WEBHOOK DA INTEGRAÇÃO
      const webhookUrl = integracao.webhook_url || `${window.location.origin}/api/functions/whatsappWebhook`;

      // ✅ PAYLOAD NO FORMATO REAL DO Z-API
      const payloadTeste = {
        instanceId: integracao.instance_id_provider || integracao.nome_instancia,
        type: "ReceivedCallback",
        phone: "554899999999",
        momment: Date.now(),
        text: {
          message: `🧪 Mensagem de TESTE para ${integracao.nome_instancia} - ${new Date().toLocaleString('pt-BR')}`
        },
        image: null,
        video: null,
        document: null,
        audio: null
      };

      console.log('[TESTE] 📤 URL do webhook:', webhookUrl);
      console.log('[TESTE] 📤 Enviando payload de teste (formato Z-API):', payloadTeste);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadTeste)
      });

      console.log('[TESTE] 📥 Status da resposta:', response.status);
      const result = await response.json();
      console.log('[TESTE] 📥 Resposta do webhook:', result);

      if (response.ok && result.success) {
        toast.success(`✅ Teste enviado para ${integracao.nome_instancia}!`, {
          description: 'Verifique a aba "Mensagens Reais" para ver o resultado'
        });
        setTimeout(() => recarregarDados(), 2000);
      } else {
        toast.warning(`⚠️ Teste processado com avisos`, {
          description: result.ignored || result.error || 'Verifique os logs da função whatsappWebhook'
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

      {/* 🆕 CARD DE TESTE DIRETO DO WEBHOOK */}
      <Card className="border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-orange-900 mb-2">
                🔍 Diagnóstico Direto do Webhook
              </h3>
              <p className="text-sm text-orange-700 mb-4">
                Teste direto do navegador para o webhook com análise completa de status HTTP, 
                tempo de resposta, payload e variações de URL.
              </p>
              <a
                href="/TesteWebhookDireto"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all shadow-lg hover:shadow-xl"
              >
                <Play className="w-4 h-4" />
                Executar Diagnóstico
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sistema de Diagnóstico Profissional */}
      <DiagnosticoProfissionalZAPI integracoes={integracoes} />
              {/* COLUNA ESQUERDA: Conexões (3 colunas) */}
              <div className="col-span-3 space-y-4">
                <div className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Conexões ({integracoes.length})
                  </h3>
                </div>

        {integracoes.length === 0 ? (
          <Alert className="bg-yellow-50 border-yellow-300">
            <AlertTriangle className="h-4 w-4 text-yellow-700" />
            <AlertDescription className="text-yellow-800">
              Nenhuma integração configurada. Configure uma conexão na aba "Configurações".
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 overflow-y-auto h-[calc(100vh-200px)] pr-2">
            {integracoes.map((integracao) => (
              <Card 
                key={integracao.id} 
                className={`cursor-pointer transition-all border-l-4 ${
                  conexaoSelecionada?.id === integracao.id 
                    ? 'shadow-lg ring-2 ring-orange-400 bg-orange-50' 
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
        )}
        </div>

        {/* COLUNA DIREITA: Testes e Diagnósticos (9 colunas) */}
        <div className="col-span-9 space-y-4 overflow-y-auto h-[calc(100vh-200px)]">
        {conexaoSelecionada ? (
          <>
            {/* Header da Conexão Selecionada */}
            <div className="sticky top-0 bg-white z-10 pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    conexaoSelecionada.status === 'conectado' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Diagnósticos - {conexaoSelecionada.nome_instancia}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {conexaoSelecionada.numero_telefone}
                    </p>
                  </div>
                </div>
                <Badge className={conexaoSelecionada.status === 'conectado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {conexaoSelecionada.status}
                </Badge>
              </div>
            </div>

            {/* 1. TESTADOR PROFISSIONAL */}
            <Card className="border-2 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Testador de Conexão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TestadorConexoesMultiplas integracoes={[conexaoSelecionada]} />
              </CardContent>
            </Card>

            {/* 2. MENSAGENS RECEBIDAS */}
            <Card className="border-2 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  Mensagens Recebidas (Tempo Real)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DiagnosticoWebhookReal integracaoFiltro={conexaoSelecionada} />
              </CardContent>
            </Card>

            {/* 3. TESTADOR DE MÍDIA */}
            <Card className="border-2 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-5 h-5 text-purple-600" />
                  Testador de Tipos de Mídia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TestadorTiposMidia integracoes={[conexaoSelecionada]} />
              </CardContent>
            </Card>

            {/* 4. ESTATÍSTICAS */}
            <Card className="border-2 border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  Estatísticas de Mensagens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EstatisticasMensagens />
              </CardContent>
            </Card>

            {/* 5. LOGS WEBHOOK */}
            <Card className="border-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="w-5 h-5 text-slate-600" />
                  Logs de Webhook
                </CardTitle>
              </CardHeader>
              <CardContent>
          {/* Lista de Logs Detalhados */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">Nenhum log de webhook ainda</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(log)}
                          <Badge variant="outline" className="text-xs">{log.event_type}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatarTimestamp(log.timestamp)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLogExpandido(logExpandido === log.id ? null : log.id)}
                      >
                        {logExpandido === log.id ? 'Ocultar' : 'Ver'}
                      </Button>
                    </div>

                    {logExpandido === log.id && (
                      <div className="mt-2 p-2 bg-slate-50 border border-slate-300 rounded">
                        <pre className="text-xs text-slate-600 overflow-x-auto max-h-64">
                          {JSON.stringify(log.raw_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
              </div>
              </CardContent>
              </Card>

              {/* 6. CONFIGURAÇÃO E INSTRUÇÕES */}
              <Card className="border-2 border-blue-200">
              <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-600" />
              Configuração do Webhook
              </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              {/* Instance ID */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300">
              <label className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Code className="w-3 h-3" />
                Instance ID
              </label>
              <code className="text-xs font-mono text-slate-900 break-all">
                {conexaoSelecionada.instance_id_provider || '⚠️ NÃO CONFIGURADO'}
              </code>
              </div>

              {/* URL do Webhook */}
              <div>
              <label className="text-xs font-medium text-slate-700 mb-2 block">
                URL do Webhook
              </label>
              <div className="bg-white p-2 rounded border border-slate-300 flex items-center gap-2">
                <code className="text-xs text-slate-800 flex-1 break-all">
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
              </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2">
              <Button
                onClick={() => enviarMensagemTeste(conexaoSelecionada)}
                disabled={enviandoTeste === conexaoSelecionada.id}
                size="sm"
                className="bg-gradient-to-r from-green-500 to-emerald-600"
              >
                {enviandoTeste === conexaoSelecionada.id ? (
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                ) : (
                  <Send className="w-3 h-3 mr-2" />
                )}
                Testar
              </Button>
              <Button
                onClick={() => window.open('https://api.z-api.io', '_blank')}
                variant="outline"
                size="sm"
              >
                <ExternalLink className="w-3 h-3 mr-2" />
                Abrir Z-API
              </Button>
              </div>
              </CardContent>
              </Card>
              </>
              ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
              <Phone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-semibold">Selecione uma conexão</p>
              <p className="text-sm mt-2">Escolha uma conexão à esquerda para ver todos os testes</p>
              </div>
              </div>
              )}
              </div>
              </div>
    </div>
  );
}