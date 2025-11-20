import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Database,
  Webhook,
  MessageSquare,
  Activity,
  Eye,
  Code,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoDetalhado() {
  const [loading, setLoading] = useState(false);
  const [integracoes, setIntegracoes] = useState([]);
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState(null);
  const [dados, setDados] = useState({
    payloads: [],
    messages: [],
    webhookLogs: [],
    threads: [],
    contacts: []
  });
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    carregarIntegracoes();
  }, []);

  useEffect(() => {
    if (integracaoSelecionada) {
      carregarDados();
    }
  }, [integracaoSelecionada]);

  useEffect(() => {
    if (autoRefresh && integracaoSelecionada) {
      const interval = setInterval(carregarDados, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, integracaoSelecionada]);

  const carregarIntegracoes = async () => {
    try {
      const ints = await base44.entities.WhatsAppIntegration.list();
      setIntegracoes(ints);
      if (ints.length > 0) {
        setIntegracaoSelecionada(ints[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar integrações:', error);
      toast.error('Erro ao carregar integrações');
    }
  };

  const carregarDados = async () => {
    if (!integracaoSelecionada) return;

    setLoading(true);
    try {
      console.log('[DIAGNOSTICO] Carregando dados para:', integracaoSelecionada.instance_id_provider);

      // Buscar últimos 20 payloads
      const payloads = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter(
        { instance_identificado: integracaoSelecionada.instance_id_provider },
        '-timestamp_recebido',
        20
      );

      // Buscar últimas 20 messages
      const messages = await base44.asServiceRole.entities.Message.list('-created_date', 20);

      // Buscar últimos 20 webhook logs
      const webhookLogs = await base44.asServiceRole.entities.WebhookLog.filter(
        { instance_id: integracaoSelecionada.instance_id_provider },
        '-timestamp',
        20
      );

      // Buscar últimas 10 threads
      const threads = await base44.asServiceRole.entities.MessageThread.list('-created_date', 10);

      // Buscar últimos 10 contacts
      const contacts = await base44.asServiceRole.entities.Contact.list('-created_date', 10);

      setDados({
        payloads,
        messages,
        webhookLogs,
        threads,
        contacts
      });

      console.log('[DIAGNOSTICO] Dados carregados:', {
        payloads: payloads.length,
        messages: messages.length,
        webhookLogs: webhookLogs.length,
        threads: threads.length,
        contacts: contacts.length
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatarTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              Diagnóstico Detalhado - Visão Cirúrgica
            </h1>
            <p className="text-slate-600 mt-1">
              Monitore em tempo real cada etapa do processamento de mensagens
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            <Button onClick={carregarDados} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
          </div>
        </div>

        {/* Seletor de Integração */}
        {integracoes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Instância Monitorada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {integracoes.map(int => (
                  <Button
                    key={int.id}
                    variant={integracaoSelecionada?.id === int.id ? 'default' : 'outline'}
                    onClick={() => setIntegracaoSelecionada(int)}
                    size="sm"
                  >
                    {int.nome_instancia}
                  </Button>
                ))}
              </div>
              {integracaoSelecionada && (
                <div className="mt-3 text-xs text-slate-600 space-y-1">
                  <p><strong>Instance ID:</strong> {integracaoSelecionada.instance_id_provider}</p>
                  <p><strong>Telefone:</strong> {integracaoSelecionada.numero_telefone}</p>
                  <p><strong>Status:</strong> {integracaoSelecionada.status}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Grid de Dados */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ZapiPayloadNormalized */}
          <Card>
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                ZapiPayloadNormalized
                <Badge className="ml-auto">{dados.payloads.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {dados.payloads.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Nenhum payload recebido
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Timestamp</th>
                        <th className="px-3 py-2 text-left">Evento</th>
                        <th className="px-3 py-2 text-center">Sucesso</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.payloads.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2">{formatarTimestamp(p.timestamp_recebido)}</td>
                          <td className="px-3 py-2">{p.evento}</td>
                          <td className="px-3 py-2 text-center">
                            {p.sucesso_processamento ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => {
                                console.log('[PAYLOAD]', p);
                                toast.info('Payload logado no console');
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* WebhookLog */}
          <Card>
            <CardHeader className="bg-purple-50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Webhook className="w-4 h-4 text-purple-600" />
                WebhookLog
                <Badge className="ml-auto">{dados.webhookLogs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {dados.webhookLogs.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Nenhum webhook log
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Timestamp</th>
                        <th className="px-3 py-2 text-left">Event</th>
                        <th className="px-3 py-2 text-center">Processado</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.webhookLogs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2">{formatarTimestamp(log.timestamp)}</td>
                          <td className="px-3 py-2">{log.event_type}</td>
                          <td className="px-3 py-2 text-center">
                            {log.processed ? (
                              <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-yellow-600 mx-auto" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => {
                                console.log('[WEBHOOK-LOG]', log);
                                toast.info('Webhook log logado no console');
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader className="bg-green-50">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-green-600" />
                Message
                <Badge className="ml-auto">{dados.messages.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {dados.messages.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Nenhuma mensagem
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Created</th>
                        <th className="px-3 py-2 text-left">Content</th>
                        <th className="px-3 py-2 text-left">WA ID</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.messages.map((msg) => (
                        <tr key={msg.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2">{formatarTimestamp(msg.created_date)}</td>
                          <td className="px-3 py-2 truncate max-w-[150px]">
                            {msg.content?.substring(0, 30) || 'N/A'}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[100px]" title={msg.whatsapp_message_id}>
                            {msg.whatsapp_message_id?.substring(0, 15) || 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => {
                                console.log('[MESSAGE]', msg);
                                toast.info('Message logada no console');
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                Contact
                <Badge className="ml-auto">{dados.contacts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                {dados.contacts.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Nenhum contato
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-left">Telefone</th>
                        <th className="px-3 py-2 text-left">Created</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.contacts.map((contact) => (
                        <tr key={contact.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2">{contact.nome}</td>
                          <td className="px-3 py-2">{contact.telefone}</td>
                          <td className="px-3 py-2">{formatarTimestamp(contact.created_date)}</td>
                          <td className="px-3 py-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => {
                                console.log('[CONTACT]', contact);
                                toast.info('Contact logado no console');
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Alertas */}
        <Alert className="bg-yellow-50 border-yellow-300">
          <AlertTriangle className="h-4 w-4 text-yellow-700" />
          <AlertDescription className="text-yellow-800">
            <strong>Como usar:</strong> Execute o diagnóstico na aba Diagnóstico, depois volte aqui
            e clique em Recarregar para ver se os payloads/messages foram criados. Use os botões 👁️ 
            para logar os dados completos no console do navegador (F12).
          </AlertDescription>
        </Alert>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">🔍 Checklist de Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <p><strong>1. Execute o Diagnóstico Completo</strong> na aba Diagnóstico</p>
            <p><strong>2. Volte aqui</strong> e clique em Recarregar</p>
            <p><strong>3. Verifique se apareceram:</strong></p>
            <ul className="ml-6 space-y-1 list-disc">
              <li>Novos registros em <strong>ZapiPayloadNormalized</strong> (deve ter 4 registros de teste)</li>
              <li>Novos registros em <strong>WebhookLog</strong> (deve ter 4 registros de teste)</li>
              <li>Novos registros em <strong>Message</strong> (deve ter pelo menos 1 mensagem de teste)</li>
              <li>Novos registros em <strong>Contact</strong> (deve ter pelo menos 1 contato de teste)</li>
            </ul>
            <p><strong>4. Use os botões 👁️</strong> para inspecionar cada registro no console</p>
            <p><strong>5. Se NENHUM payload foi criado:</strong> O webhook não está recebendo as mensagens</p>
            <p><strong>6. Se payloads foram criados MAS messages não:</strong> O processamento está falhando</p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}