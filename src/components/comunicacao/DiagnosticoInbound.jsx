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
  MessageSquare,
  Play,
  Zap,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import DiagnosticoProfissionalZAPI from "./DiagnosticoProfissionalZAPI";
import AnalisadorMensagensRecebidas from "./AnalisadorMensagensRecebidas";

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

      {/* 🆕 ANALISADOR DE MENSAGENS RECEBIDAS - DIAGNÓSTICO EM TEMPO REAL */}
      <AnalisadorMensagensRecebidas />

      {/* Sistema de Diagnóstico Profissional */}
      <DiagnosticoProfissionalZAPI integracoes={integracoes} />

      {/* Grid de Testes Extras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Teste Fluxo Controlado */}
        <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-purple-900 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              🔬 Teste de Fluxo Controlado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-purple-800">
              Replica EXATAMENTE o fluxo do webhook com logs detalhados de cada etapa para 
              identificar onde está falhando a persistência.
            </p>
            <Button
              onClick={() => window.open('/pages/TesteFluxoControlado', '_blank')}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              🚀 Abrir Teste Controlado
            </Button>
          </CardContent>
        </Card>

        {/* Card: Teste Persistência Direta */}
        <Card className="border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Database className="w-5 h-5" />
              💾 Teste de Persistência Direta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-indigo-800">
              Testa se o Service Role consegue persistir dados diretamente no banco.
              Identifica se o problema é permissão ou código.
            </p>
            <Button
              onClick={() => window.open('/pages/TestePersistenciaDireta', '_blank')}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              🔍 Abrir Teste Persistência
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}