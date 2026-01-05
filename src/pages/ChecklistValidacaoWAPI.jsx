import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ClipboardCheck,
  TrendingUp,
  Zap
} from "lucide-react";

export default function ChecklistValidacaoWAPI() {
  const [checklist, setChecklist] = useState({
    fase1: {
      titulo: "Validação de Texto (W-API)",
      itens: [
        { id: '1.1', texto: 'Enviar mensagem de texto simples do smartphone para número W-API', concluido: false },
        { id: '1.2', texto: 'Verificar no log webhookWapi se chegou ReceivedCallback', concluido: false },
        { id: '1.3', texto: 'Verificar se msgContent.conversation contém o texto enviado', concluido: false },
        { id: '1.4', texto: 'Verificar se payload foi classificado como user-message', concluido: false },
        { id: '1.5', texto: 'Verificar se Contact foi criado/atualizado com telefone normalizado', concluido: false },
        { id: '1.6', texto: 'Verificar se MessageThread foi criado com whatsapp_integration_id correto', concluido: false },
        { id: '1.7', texto: 'Verificar se Message foi criada com channel="whatsapp" e metadata.provider="w_api"', concluido: false },
        { id: '1.8', texto: 'Verificar se mensagem aparece na UI (Central de Comunicação) em < 5 segundos', concluido: false },
        { id: '1.9', texto: 'Verificar se thread.unread_count foi incrementado', concluido: false }
      ],
      criterio: 'Mensagem aparece na interface em < 5 segundos com contador de não lidas atualizado'
    },
    fase2: {
      titulo: "Validação de Status (W-API)",
      itens: [
        { id: '2.1', texto: 'Enviar mensagem pelo VendaPro (via W-API) para o smartphone', concluido: false },
        { id: '2.2', texto: 'Verificar se Message.status = "enviando" → "enviada"', concluido: false },
        { id: '2.3', texto: 'Marcar como lida no smartphone', concluido: false },
        { id: '2.4', texto: 'Verificar no log webhookWapi se chegou webhookdelivery com status READ', concluido: false },
        { id: '2.5', texto: 'Verificar se Message.status foi atualizado para "lida"', concluido: false },
        { id: '2.6', texto: 'Verificar se Message.read_at foi preenchido', concluido: false },
        { id: '2.7', texto: 'Verificar se thread.last_message_at foi atualizado', concluido: false }
      ],
      criterio: 'Status atualiza em < 3 segundos após leitura no smartphone'
    },
    fase3: {
      titulo: "Validação de Mídia (W-API)",
      itens: [
        { id: '3.1', texto: 'Enviar imagem JPG do smartphone', concluido: false },
        { id: '3.2', texto: 'Verificar se msgContent.imageMessage existe no payload', concluido: false },
        { id: '3.3', texto: 'Verificar se media_type = "image" na normalização', concluido: false },
        { id: '3.4', texto: 'Verificar se worker persistirMidiaWapi foi disparado', concluido: false },
        { id: '3.5', texto: 'Verificar se media_url foi atualizada após download', concluido: false },
        { id: '3.6', texto: 'Verificar se imagem renderiza na UI', concluido: false },
        { id: '3.7', texto: 'Gravar e enviar áudio PTT', concluido: false },
        { id: '3.8', texto: 'Verificar se msgContent.audioMessage.ptt existe', concluido: false },
        { id: '3.9', texto: 'Verificar se áudio é reproduzível na UI', concluido: false },
        { id: '3.10', texto: 'Enviar PDF e verificar se documentMessage é processado', concluido: false },
        { id: '3.11', texto: 'Verificar se documento é baixável', concluido: false }
      ],
      criterio: 'Todas as mídias processam corretamente e são acessíveis na UI'
    },
    fase4: {
      titulo: "Validação de Compliance (W-API)",
      itens: [
        { id: '4.1', texto: 'Verificar se thread.janela_24h_expira_em é calculada após mensagem inbound', concluido: false },
        { id: '4.2', texto: 'Verificar se isJanelaAtiva(thread) retorna true após mensagem W-API', concluido: false },
        { id: '4.3', texto: 'Aguardar 24h e verificar se isJanelaAtiva() retorna false', concluido: false },
        { id: '4.4', texto: 'Tentar enviar mensagem livre com janela expirada (deve bloquear)', concluido: false },
        { id: '4.5', texto: 'Enviar template com janela expirada (deve funcionar)', concluido: false },
        { id: '4.6', texto: 'Verificar se hasOptIn(contact) funciona para contatos W-API', concluido: false }
      ],
      criterio: 'Compliance 100% funcional - regras de janela 24h respeitadas'
    },
    fase5: {
      titulo: "Validação de Automação (W-API)",
      itens: [
        { id: '5.1', texto: 'Verificar se processInbound é disparado após ingestão W-API', concluido: false },
        { id: '5.2', texto: 'Verificar se triggers de URA/fluxos funcionam para provider="w_api"', concluido: false },
        { id: '5.3', texto: 'Verificar se AutomationLog registra ações de mensagens W-API', concluido: false },
        { id: '5.4', texto: 'Verificar se score/engajamento atualiza para contatos W-API', concluido: false },
        { id: '5.5', texto: 'Verificar se "próxima ação" é sugerida para threads W-API', concluido: false },
        { id: '5.6', texto: 'Testar transferência de atendimento (W-API → humano)', concluido: false }
      ],
      criterio: 'Sistema autônomo funcionando com mesmo comportamento da Z-API'
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ClipboardCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    Checklist de Validação - W-API + VendaPro
                  </h1>
                  <p className="text-sm text-slate-600 font-normal">
                    Validação completa da integração W-API
                  </p>
                </div>
              </div>
              <Badge
                variant={progressoGeral === 100 ? "default" : "secondary"}
                className="text-lg px-4 py-2 bg-purple-600"
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
        <Card className="border-2 border-indigo-200 bg-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Critérios Gerais de Aprovação W-API
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">&gt; 99%</div>
                <div className="text-sm text-slate-600">Taxa de recebimento</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">&lt; 2s</div>
                <div className="text-sm text-slate-600">Latência média</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">&lt; 1%</div>
                <div className="text-sm text-slate-600">Taxa de erro</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">100%</div>
                <div className="text-sm text-slate-600">Paridade com Z-API</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerta Importante */}
        <Alert className="border-yellow-400 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900 font-bold">Pré-requisito</AlertTitle>
          <AlertDescription className="text-yellow-800 text-sm">
            Antes de iniciar, certifique-se de que os webhooks estão registrados na W-API.
            Use o botão "Registrar Webhooks W-API" na aba Configurações → Diagnóstico.
          </AlertDescription>
        </Alert>

        {/* Fases do Checklist */}
        {Object.entries(checklist).map(([faseKey, fase]) => {
          const progresso = calcularProgresso(faseKey);
          const completo = progresso === 100;
          
          const corFase = {
            fase1: 'purple',
            fase2: 'indigo',
            fase3: 'blue',
            fase4: 'violet',
            fase5: 'fuchsia'
          }[faseKey] || 'purple';

          return (
            <Card key={faseKey} className={completo ? `border-2 border-${corFase}-500` : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {completo ? (
                      <CheckCircle2 className={`w-6 h-6 text-${corFase}-600`} />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-400" />
                    )}
                    <span>{fase.titulo}</span>
                  </div>
                  <Badge variant={completo ? "default" : "secondary"} className={completo ? `bg-${corFase}-600` : ''}>
                    {Math.round(progresso)}%
                  </Badge>
                </CardTitle>
                <Progress value={progresso} className="h-2 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                {fase.itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
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
                
                <Alert className={`mt-4 border-${corFase}-200 bg-${corFase}-50`}>
                  <Zap className={`w-4 h-4 text-${corFase}-600`} />
                  <AlertDescription className={`text-${corFase}-900`}>
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
                  ✅ W-API Validada!
                </h3>
                <p className="text-green-700">
                  Todas as fases foram completadas com sucesso.
                  <br />
                  A integração W-API está funcionando em paridade total com a Z-API.
                  <br />
                  <strong>Você pode prosseguir com confiança para produção.</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}