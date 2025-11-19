import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Phone,
  Clock,
  Zap,
  Eye,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function TestadorRecebimentoMensagens() {
  const [loading, setLoading] = useState(false);
  const [testando, setTestando] = useState(false);
  const [threads, setThreads] = useState([]);
  const [mensagensRecentes, setMensagensRecentes] = useState([]);
  const [integracoes, setIntegracoes] = useState([]);
  
  // Dados do teste
  const [numeroTeste, setNumeroTeste] = useState('');
  const [mensagemTeste, setMensagemTeste] = useState('Teste de recebimento - ' + new Date().toLocaleTimeString());

  useEffect(() => {
    carregarDados();
    
    // Polling a cada 5 segundos para verificar novas mensagens
    const interval = setInterval(carregarDados, 5000);
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    try {
      const [threadsData, mensagensData, integracoesData] = await Promise.all([
        base44.entities.MessageThread.list('-last_message_at', 10),
        base44.entities.Message.list('-sent_at', 20),
        base44.entities.WhatsAppIntegration.list()
      ]);

      setThreads(threadsData);
      setMensagensRecentes(mensagensData);
      setIntegracoes(integracoesData);
    } catch (error) {
      console.error('[TESTE-RECEBIMENTO] Erro ao carregar dados:', error);
    }
  };

  const simularWebhookRecebimento = async () => {
    if (!numeroTeste) {
      toast.error('Informe um número de telefone para teste');
      return;
    }

    setTestando(true);
    
    try {
      console.log('[TESTE-RECEBIMENTO] 🧪 Simulando webhook...');
      
      // Formatar número
      let numeroFormatado = numeroTeste.replace(/\D/g, '');
      if (!numeroFormatado.startsWith('55')) {
        numeroFormatado = '55' + numeroFormatado;
      }

      // Buscar integração ativa
      const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
      if (!integracaoAtiva) {
        toast.error('Nenhuma integração WhatsApp conectada');
        setTestando(false);
        return;
      }

      console.log('[TESTE-RECEBIMENTO] 📱 Integração:', integracaoAtiva.nome_instancia);
      console.log('[TESTE-RECEBIMENTO] 📞 Número:', numeroFormatado);

      // ✅ PAYLOAD EXATAMENTE COMO A Z-API ENVIA (ReceivedCallback)
      const payloadSimulado = {
        type: 'ReceivedCallback',
        instanceId: integracaoAtiva.instance_id_provider,
        messageId: 'TESTE_MSG_' + Date.now(),
        telefone: numeroFormatado,
        fromMe: false,
        momment: Date.now(),
        status: 'RECEIVED',
        chatName: 'Teste Simulado',
        senderName: 'Teste Simulado',
        photo: null,
        broadcast: false,
        text: {
          message: mensagemTeste
        }
      };

      console.log('[TESTE-RECEBIMENTO] 📦 Payload simulado (formato Z-API):', JSON.stringify(payloadSimulado, null, 2));

      // Chamar webhook diretamente
      const webhookUrl = `${window.location.origin}/api/functions/whatsappWebhook`;
      console.log('[TESTE-RECEBIMENTO] 🔗 Chamando webhook:', webhookUrl);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payloadSimulado)
      });

      const resultado = await response.json();

      console.log('[TESTE-RECEBIMENTO] 📥 Resposta do webhook:', resultado);

      if (resultado.success) {
        toast.success('✅ Mensagem simulada processada com sucesso!', {
          description: `Contact: ${resultado.contact_id || 'N/A'}, Thread: ${resultado.thread_id || 'N/A'}`,
          duration: 5000
        });

        // Aguardar um pouco e recarregar dados
        setTimeout(() => {
          carregarDados();
        }, 2000);

      } else {
        toast.error('❌ Erro ao processar webhook simulado', {
          description: resultado.error || 'Erro desconhecido'
        });
      }

    } catch (error) {
      console.error('[TESTE-RECEBIMENTO] ❌ Erro:', error);
      toast.error('Erro ao simular recebimento', {
        description: error.message
      });
    }

    setTestando(false);
  };

  const formatarTelefone = (tel) => {
    if (!tel) return '';
    const limpo = tel.replace(/\D/g, '');
    if (limpo.length === 13) {
      return `+${limpo.substring(0, 2)} (${limpo.substring(2, 4)}) ${limpo.substring(4, 9)}-${limpo.substring(9)}`;
    }
    return tel;
  };

  const formatarDataHora = (iso) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      return date.toLocaleString('pt-BR');
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-blue-900">
            <MessageSquare className="w-6 h-6" />
            🧪 Testador de Recebimento de Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800">
            Use este painel para simular o recebimento de mensagens WhatsApp e verificar 
            se elas aparecem corretamente na Central de Comunicação.
          </p>
        </CardContent>
      </Card>

      {/* Status das Integrações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Status das Integrações WhatsApp
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={carregarDados}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {integracoes.length === 0 ? (
            <Alert className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>❌ Nenhuma integração configurada</strong>
                <br />
                Vá em "Configuração" para adicionar uma instância Z-API
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integracoes.map(integracao => (
                <div 
                  key={integracao.id}
                  className="p-4 border-2 rounded-lg"
                  style={{
                    borderColor: integracao.status === 'conectado' ? '#10b981' : '#ef4444',
                    backgroundColor: integracao.status === 'conectado' ? '#ecfdf5' : '#fef2f2'
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-800">{integracao.nome_instancia}</h4>
                    <Badge className={
                      integracao.status === 'conectado' 
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }>
                      {integracao.status === 'conectado' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {integracao.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {integracao.numero_telefone}
                  </p>
                  {integracao.ultima_atividade && (
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3" />
                      Última atividade: {formatarDataHora(integracao.ultima_atividade)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Simulador de Recebimento */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Send className="w-5 h-5" />
            Simular Recebimento de Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800">
              <strong>💡 Como funciona:</strong>
              <br />
              1. Informe um número de telefone (com DDD)
              <br />
              2. Clique em "Simular Recebimento"
              <br />
              3. O sistema criará uma mensagem como se tivesse chegado via WhatsApp
              <br />
              4. Verifique se aparece na aba "Conversas" da Central de Comunicação
            </AlertDescription>
          </Alert>

          <div>
            <Label>Número de Telefone (com DDD)</Label>
            <Input
              type="tel"
              placeholder="48999322400"
              value={numeroTeste}
              onChange={(e) => setNumeroTeste(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Exemplo: 48999322400 (será convertido para +5548999322400)
            </p>
          </div>

          <div>
            <Label>Mensagem de Teste</Label>
            <Textarea
              value={mensagemTeste}
              onChange={(e) => setMensagemTeste(e.target.value)}
              placeholder="Digite a mensagem que será simulada..."
              className="h-24"
            />
          </div>

          <Button
            onClick={simularWebhookRecebimento}
            disabled={testando || !numeroTeste || integracoes.length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {testando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Simular Recebimento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Threads Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-600" />
            Conversas Recentes (últimas 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Nenhuma conversa encontrada. Simule um recebimento acima.
            </p>
          ) : (
            <div className="space-y-2">
              {threads.map(thread => (
                <div 
                  key={thread.id}
                  className="p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800">
                      {thread.contact_id || 'Sem contato'}
                    </span>
                    {thread.unread_count > 0 && (
                      <Badge className="bg-red-500 text-white">
                        {thread.unread_count} nova{thread.unread_count > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 truncate">
                    {thread.last_message_content || 'Sem mensagens'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatarDataHora(thread.last_message_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagens Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Mensagens Recentes (últimas 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mensagensRecentes.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Nenhuma mensagem encontrada.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mensagensRecentes.map(msg => (
                <div 
                  key={msg.id}
                  className={`p-3 border rounded-lg ${
                    msg.sender_type === 'contact' 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={
                      msg.sender_type === 'contact'
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-500 text-white'
                    }>
                      {msg.sender_type === 'contact' ? 'Recebida' : 'Enviada'}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatarDataHora(msg.sent_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{msg.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {msg.channel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {msg.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}