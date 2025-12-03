import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle,
  ClipboardCheck,
  TrendingUp
} from "lucide-react";

export default function ChecklistValidacaoZAPI() {
  const [checklist, setChecklist] = useState({
    fase1: {
      titulo: "Validação de Texto",
      itens: [
        { id: '1.1', texto: 'Enviar mensagem de texto simples do smartphone', concluido: false },
        { id: '1.2', texto: 'Verificar no WebhookLog se event_type = "ReceivedCallback"', concluido: false },
        { id: '1.3', texto: 'Verificar se raw_data.texto.mensagem contém o texto enviado', concluido: false },
        { id: '1.4', texto: 'Verificar se processed = true e success = true', concluido: false },
        { id: '1.5', texto: 'Verificar se Contact foi criado/atualizado', concluido: false },
        { id: '1.6', texto: 'Verificar se MessageThread foi criado/atualizado', concluido: false },
        { id: '1.7', texto: 'Verificar se Message foi criada com content correto', concluido: false },
        { id: '1.8', texto: 'Verificar se mensagem aparece na UI do VendaPro', concluido: false }
      ],
      criterio: 'Mensagem aparece na interface em < 5 segundos'
    },
    fase2: {
      titulo: "Validação de Status",
      itens: [
        { id: '2.1', texto: 'Enviar mensagem do VendaPro para o smartphone', concluido: false },
        { id: '2.2', texto: 'Marcar como lida no smartphone', concluido: false },
        { id: '2.3', texto: 'Verificar no WebhookLog se chegou event_type = "MessageStatusCallback"', concluido: false },
        { id: '2.4', texto: 'Verificar se status = "READ_BY_ME"', concluido: false },
        { id: '2.5', texto: 'Verificar se Message foi atualizada com status = "lida"', concluido: false },
        { id: '2.6', texto: 'Verificar se read_at foi preenchido', concluido: false },
        { id: '2.7', texto: 'Verificar se thread.janela_24h_expira_em foi atualizada', concluido: false }
      ],
      criterio: 'Status atualiza em < 3 segundos'
    },
    fase3: {
      titulo: "Validação de Mídia",
      itens: [
        { id: '3.1', texto: 'Enviar imagem JPG do smartphone', concluido: false },
        { id: '3.2', texto: 'Verificar se raw_data.image existe', concluido: false },
        { id: '3.3', texto: 'Verificar se media_type = "image"', concluido: false },
        { id: '3.4', texto: 'Verificar se media_url está preenchida', concluido: false },
        { id: '3.5', texto: 'Verificar se imagem renderiza na UI', concluido: false },
        { id: '3.6', texto: 'Gravar e enviar áudio', concluido: false },
        { id: '3.7', texto: 'Verificar se raw_data.audio existe', concluido: false },
        { id: '3.8', texto: 'Verificar se áudio é reproduzível', concluido: false },
        { id: '3.9', texto: 'Enviar PDF', concluido: false },
        { id: '3.10', texto: 'Verificar se documento é baixável', concluido: false }
      ],
      criterio: 'Todas as mídias processam corretamente'
    },
    fase4: {
      titulo: "Validação de Compliance",
      itens: [
        { id: '4.1', texto: 'Verificar função isJanelaAtiva(thread) retorna true após mensagem', concluido: false },
        { id: '4.2', texto: 'Aguardar 24h e verificar se isJanelaAtiva() retorna false', concluido: false },
        { id: '4.3', texto: 'Tentar enviar mensagem livre com janela expirada (deve bloquear)', concluido: false },
        { id: '4.4', texto: 'Enviar template com janela expirada (deve funcionar)', concluido: false },
        { id: '4.5', texto: 'Verificar se hasOptIn(contact) retorna corretamente', concluido: false }
      ],
      criterio: 'Compliance 100% funcional'
    },
    fase5: {
      titulo: "Validação de Automação",
      itens: [
        { id: '5.1', texto: 'Trigger de opt-in funciona (contato sem opt-in recebe template)', concluido: false },
        { id: '5.2', texto: 'AutomationLog registra todas as ações', concluido: false },
        { id: '5.3', texto: 'Score preditivo atualiza após cada mensagem', concluido: false },
        { id: '5.4', texto: 'Próxima ação é sugerida automaticamente', concluido: false }
      ],
      criterio: 'Sistema autônomo funcionando'
    }
  });

  const toggleItem = (fase, itemId) => {
    setChecklist(prev => ({
      ...prev,
      [fase]: {
        ...prev[fase],
        itens: prev[fase].itens.map(item => 
          item.id === itemId ? { ...item, concluido: !item.concluido } : item
        )
      }
    }));
  };

  const calcularProgresso = (fase) => {
    const total = checklist[fase].itens.length;
    const concluidos = checklist[fase].itens.filter(i => i.concluido).length;
    return (concluidos / total) * 100;
  };

  const calcularProgressoGeral = () => {
    const totalItens = Object.values(checklist).reduce((acc, fase) => acc + fase.itens.length, 0);
    const totalConcluidos = Object.values(checklist).reduce(
      (acc, fase) => acc + fase.itens.filter(i => i.concluido).length, 
      0
    );
    return (totalConcluidos / totalItens) * 100;
  };

  const progressoGeral = calcularProgressoGeral();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-2xl">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-8 h-8 text-blue-600" />
                Checklist de Validação - Z-API + VendaPro
              </div>
              <Badge 
                variant={progressoGeral === 100 ? "default" : "secondary"}
                className="text-lg px-4 py-2"
              >
                {Math.round(progressoGeral)}% Completo
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressoGeral} className="h-3" />
          </CardContent>
        </Card>

        {/* Critérios Gerais */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Critérios Gerais de Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">&gt; 99%</div>
                <div className="text-sm text-slate-600">Taxa de recebimento</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">&lt; 2s</div>
                <div className="text-sm text-slate-600">Latência média</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">&lt; 1%</div>
                <div className="text-sm text-slate-600">Taxa de erro</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">&gt; 99.9%</div>
                <div className="text-sm text-slate-600">Uptime</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fases do Checklist */}
        {Object.entries(checklist).map(([faseKey, fase]) => {
          const progresso = calcularProgresso(faseKey);
          const completo = progresso === 100;
          
          return (
            <Card key={faseKey} className={completo ? "border-2 border-green-500" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {completo ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-400" />
                    )}
                    <span>{fase.titulo}</span>
                  </div>
                  <Badge variant={completo ? "default" : "secondary"}>
                    {Math.round(progresso)}%
                  </Badge>
                </CardTitle>
                <Progress value={progresso} className="h-2 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                {fase.itens.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      checked={item.concluido}
                      onCheckedChange={() => toggleItem(faseKey, item.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.id}
                        </Badge>
                        <span className={item.concluido ? "line-through text-slate-500" : ""}>
                          {item.texto}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Alert className="mt-4">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Critério de Sucesso:</strong> {fase.criterio}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          );
        })}

        {/* Status Final */}
        {progressoGeral === 100 && (
          <Card className="border-2 border-green-500 bg-green-50">
            <CardContent className="py-6">
              <div className="text-center space-y-2">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
                <h3 className="text-2xl font-bold text-green-800">
                  ✅ Sistema Validado!
                </h3>
                <p className="text-green-700">
                  Todas as fases foram completadas com sucesso.
                  <br />
                  Você pode prosseguir para os Módulos de IA (V/VII).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}