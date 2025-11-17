import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Clock,
  Zap
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoPreAtendimento() {
  const [loading, setLoading] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [ultimasMensagens, setUltimasMensagens] = useState([]);

  useEffect(() => {
    executarDiagnostico();
  }, []);

  const executarDiagnostico = async () => {
    setLoading(true);
    try {
      // 1. Verificar configurações
      const configs = await base44.entities.ConfiguracaoSistema.list();
      const configHorario = configs.find(c => c.chave === 'horario_expediente_global');
      const configMensagem = configs.find(c => c.chave === 'mensagem_fora_expediente');

      // 2. Verificar atendentes
      const atendentes = await base44.entities.User.filter({
        is_whatsapp_attendant: true
      });

      const atendentesOnline = atendentes.filter(a => a.availability_status === 'online');

      // 3. Verificar últimas mensagens recebidas
      const mensagensRecentes = await base44.entities.Message.filter({
        sender_type: 'contact'
      }, '-created_date', 10);

      // 4. Verificar threads ativas
      const threadsAbertas = await base44.entities.MessageThread.filter({
        status: 'aberta'
      }, '-last_message_at', 10);

      // 5. Verificar logs de automação
      const logsAutomacao = await base44.entities.AutomationLog.filter({
        acao: 'resposta_ia'
      }, '-timestamp', 10);

      // 6. Verificar webhook logs
      const webhookLogs = await base44.entities.WebhookLog.list('-timestamp', 10);

      setDiagnostico({
        configuracoes: {
          horario: !!configHorario,
          mensagemForaExpediente: !!configMensagem,
          horarioAtivo: configHorario?.ativa || false
        },
        atendentes: {
          total: atendentes.length,
          online: atendentesOnline.length,
          setores: {
            vendas: atendentes.filter(a => a.attendant_sector === 'vendas').length,
            assistencia: atendentes.filter(a => a.attendant_sector === 'assistencia').length,
            financeiro: atendentes.filter(a => a.attendant_sector === 'financeiro').length
          }
        },
        mensagens: {
          recentes: mensagensRecentes.length,
          ultimaRecebida: mensagensRecentes[0]?.created_date
        },
        threads: {
          abertas: threadsAbertas.length,
          comAtendente: threadsAbertas.filter(t => t.assigned_user_id).length,
          semAtendente: threadsAbertas.filter(t => !t.assigned_user_id).length
        },
        automacao: {
          tentativas: logsAutomacao.length,
          sucessos: logsAutomacao.filter(l => l.resultado === 'sucesso').length,
          falhas: logsAutomacao.filter(l => l.resultado === 'erro').length
        },
        webhooks: {
          total: webhookLogs.length,
          processados: webhookLogs.filter(w => w.processed).length,
          falhas: webhookLogs.filter(w => !w.success).length
        }
      });

      setUltimasMensagens(mensagensRecentes);

      toast.success("Diagnóstico concluído!");

    } catch (error) {
      console.error("Erro ao executar diagnóstico:", error);
      toast.error("Erro ao executar diagnóstico");
    }
    setLoading(false);
  };

  if (loading && !diagnostico) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const getStatusIcon = (status) => {
    if (status) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Diagnóstico de Pré-Atendimento
            </h1>
            <p className="text-gray-600 mt-1">
              Análise completa do sistema de IA
            </p>
          </div>
          <Button onClick={executarDiagnostico} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {diagnostico && (
          <>
            {/* Status Geral */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-l-4 border-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getStatusIcon(diagnostico.configuracoes.horario)}
                    Configurações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Horário:</span>
                      <Badge className={diagnostico.configuracoes.horario ? 'bg-green-500' : 'bg-red-500'}>
                        {diagnostico.configuracoes.horario ? 'OK' : 'FALTA'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Msg Fora Expediente:</span>
                      <Badge className={diagnostico.configuracoes.mensagemForaExpediente ? 'bg-green-500' : 'bg-red-500'}>
                        {diagnostico.configuracoes.mensagemForaExpediente ? 'OK' : 'FALTA'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getStatusIcon(diagnostico.atendentes.online > 0)}
                    Atendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <Badge variant="outline">{diagnostico.atendentes.total}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Online:</span>
                      <Badge className="bg-green-500">{diagnostico.atendentes.online}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Vendas: {diagnostico.atendentes.setores.vendas} | 
                      Assist: {diagnostico.atendentes.setores.assistencia} | 
                      Fin: {diagnostico.atendentes.setores.financeiro}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-purple-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getStatusIcon(diagnostico.automacao.sucessos > 0)}
                    Automação IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Tentativas:</span>
                      <Badge variant="outline">{diagnostico.automacao.tentativas}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Sucessos:</span>
                      <Badge className="bg-green-500">{diagnostico.automacao.sucessos}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Falhas:</span>
                      <Badge className="bg-red-500">{diagnostico.automacao.falhas}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Threads Abertas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Threads Abertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {diagnostico.threads.abertas}
                    </div>
                    <div className="text-sm text-gray-600">Total Abertas</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {diagnostico.threads.comAtendente}
                    </div>
                    <div className="text-sm text-gray-600">Com Atendente</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {diagnostico.threads.semAtendente}
                    </div>
                    <div className="text-sm text-gray-600">Aguardando</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Últimas Mensagens */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Últimas Mensagens Recebidas ({ultimasMensagens.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ultimasMensagens.map((msg, index) => (
                    <div
                      key={msg.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{msg.content}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Thread: {msg.thread_id} | {new Date(msg.created_date).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {msg.status}
                      </Badge>
                    </div>
                  ))}
                  {ultimasMensagens.length === 0 && (
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription>
                        Nenhuma mensagem recebida recentemente
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Problemas Detectados */}
            {(
              !diagnostico.configuracoes.horario ||
              !diagnostico.configuracoes.mensagemForaExpediente ||
              diagnostico.atendentes.online === 0 ||
              diagnostico.threads.semAtendente > 5
            ) && (
              <Card className="border-l-4 border-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                    Problemas Detectados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {!diagnostico.configuracoes.horario && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertDescription>
                          ❌ Falta configurar horário de expediente
                        </AlertDescription>
                      </Alert>
                    )}
                    {!diagnostico.configuracoes.mensagemForaExpediente && (
                      <Alert className="bg-red-50 border-red-200">
                        <AlertDescription>
                          ❌ Falta configurar mensagem fora de expediente
                        </AlertDescription>
                      </Alert>
                    )}
                    {diagnostico.atendentes.online === 0 && (
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertDescription>
                          ⚠️ Nenhum atendente online no momento
                        </AlertDescription>
                      </Alert>
                    )}
                    {diagnostico.threads.semAtendente > 5 && (
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertDescription>
                          ⚠️ Muitas threads aguardando atendente ({diagnostico.threads.semAtendente})
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recomendações */}
            <Card className="border-l-4 border-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Configure horário de expediente na página de Configurações</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Tenha pelo menos 1 atendente online por setor</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Monitore threads sem atendente regularmente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>Teste o sistema com mensagens reais antes de produção</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}