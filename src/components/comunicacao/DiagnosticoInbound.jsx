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
import { getWebhookUrlIntegracao } from "../lib/webhookUtils";

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
    const webhookUrl = getWebhookUrlIntegracao(integracao);
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const enviarMensagemTeste = async (integracao) => {
    setEnviandoTeste(integracao.id);
    try {
      // ✅ BUSCAR URL DO WEBHOOK DA INTEGRAÇÃO
      const webhookUrl = getWebhookUrlIntegracao(integracao);

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





      {/* 🆕 ANALISADOR DE MENSAGENS RECEBIDAS - DIAGNÓSTICO EM TEMPO REAL */}
      <AnalisadorMensagensRecebidas />

      {/* Sistema de Diagnóstico Profissional */}
      <DiagnosticoProfissionalZAPI integracoes={integracoes} />


    </div>
  );
}