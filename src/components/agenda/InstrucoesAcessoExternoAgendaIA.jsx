import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Phone, 
  MessageSquare, 
  Mic, 
  CheckCircle2, 
  Zap,
  ArrowRight,
  Calendar,
  Clock,
  XCircle,
  List
} from "lucide-react";

export default function InstrucoesAcessoExternoAgendaIA() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
          🗓️ Agenda Nexus IA - Acesso Externo
        </h1>
        <p className="text-slate-600 mt-2">Como enviar mensagens para a IA via WhatsApp</p>
      </div>

      {/* Número do Contato */}
      <Card className="border-emerald-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
          <CardTitle className="flex items-center gap-2 text-emerald-900">
            <Phone className="w-5 h-5" />
            📞 Número do Contato Especial
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 rounded-lg border-2 border-emerald-300">
            <Phone className="w-6 h-6 text-emerald-600" />
            <span className="text-2xl font-bold text-emerald-900 tracking-wider">
              +55 48 99999-9999
            </span>
          </div>
          <p className="text-sm text-slate-600 text-center mt-3">
            Telefone do contato AGENDA_IA_NEXUS no banco de dados
          </p>
        </CardContent>
      </Card>

      {/* Fluxo Automático */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Zap className="w-5 h-5" />
            🔄 Fluxo Automático de Processamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Etapa 1 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Cliente envia WhatsApp</p>
                <p className="text-sm text-slate-600 mt-1">
                  Para qualquer chip conectado, mencionando:
                </p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  <p>• "agendar reunião amanhã às 14h"</p>
                  <p>• "lembrete ligar cliente sexta 10h"</p>
                  <p>• "listar minha agenda"</p>
                </div>
              </div>
            </div>

            <ArrowRight className="w-6 h-6 text-slate-400 mx-auto" />

            {/* Etapa 2 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Sistema detecta automaticamente SE:</p>
                <div className="mt-2 space-y-2">
                  <Badge className="bg-purple-100 text-purple-800">assistant_mode = 'agenda'</Badge>
                  <span className="text-slate-600 mx-2">OU</span>
                  <Badge className="bg-green-100 text-green-800">telefone = '+5548999999999'</Badge>
                </div>
              </div>
            </div>

            <ArrowRight className="w-6 h-6 text-slate-400 mx-auto" />

            {/* Etapa 3 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Roteamento Inteligente</p>
                <p className="text-sm text-slate-600 mt-1">
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs">routeToAgendaIA</code> → 
                  <code className="bg-slate-100 px-2 py-1 rounded text-xs ml-2">processScheduleIntent</code>
                </p>
              </div>
            </div>

            <ArrowRight className="w-6 h-6 text-slate-400 mx-auto" />

            {/* Etapa 4 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">IA Processa e Responde</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-slate-700">Criação</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-slate-700">Cancelamento</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <List className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-700">Listagem</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de Mensagem */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <MessageSquare className="w-5 h-5" />
            📨 Tipos de Mensagem Aceitos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Texto</p>
                <p className="text-xs text-slate-600 mt-1">Comandos naturais em português</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <Mic className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Áudio</p>
                <p className="text-xs text-slate-600 mt-1">Transcrição automática + processamento</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Natural</p>
                <p className="text-xs text-slate-600 mt-1">IA interpreta contexto e intenção</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemplos Práticos */}
      <Card className="shadow-lg border-amber-200">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <Clock className="w-5 h-5" />
            💡 Exemplos Práticos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <Calendar className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm text-slate-900">"agendar reunião com fornecedor amanhã 15h"</p>
                <p className="text-xs text-slate-500 mt-1">→ IA cria evento no calendário</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm text-slate-900">"lembrete ligar cliente sexta 10h"</p>
                <p className="text-xs text-slate-500 mt-1">→ IA agenda lembrete + notificação</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <List className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm text-slate-900">"listar meus compromissos"</p>
                <p className="text-xs text-slate-500 mt-1">→ IA retorna próximos eventos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-sm text-slate-900">"cancelar reunião de amanhã"</p>
                <p className="text-xs text-slate-500 mt-1">→ IA cancela evento correspondente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alertas Importantes */}
      <Alert className="border-amber-300 bg-amber-50">
        <AlertDescription className="text-sm text-amber-900">
          ⚠️ <strong>Importante:</strong> O número correto é <code className="bg-amber-100 px-2 py-0.5 rounded">+5548999999999</code> (nove "9s" no final). 
          Mensagens para números diferentes não serão roteadas automaticamente para a Agenda IA.
        </AlertDescription>
      </Alert>

      <Alert className="border-blue-300 bg-blue-50">
        <AlertDescription className="text-sm text-blue-900">
          💡 <strong>Dica:</strong> Para ativar em threads existentes, configure <code className="bg-blue-100 px-2 py-0.5 rounded">assistant_mode = 'agenda'</code> no MessageThread.
        </AlertDescription>
      </Alert>
    </div>
  );
}