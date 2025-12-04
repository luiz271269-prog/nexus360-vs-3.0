import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Rocket,
  Zap,
  CheckCircle,
  AlertCircle,
  Play,
  Settings,
  MessageSquare,
  Users,
  Code,
  Shield,
  TrendingUp,
  Copy,
  ExternalLink,
  Download,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  DOCUMENTAÇÃO COMPLETA DO SISTEMA                            ║
 * ║  Guia definitivo para usar todas as funcionalidades          ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

export default function DocumentacaoCompleta() {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            Documentação Completa
          </h1>
          <p className="text-slate-600 mt-1">
            Tudo que você precisa saber para dominar o sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="inicio" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="inicio">
            <Rocket className="w-4 h-4 mr-2" />
            Início Rápido
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="w-4 h-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="playbooks">
            <Zap className="w-4 h-4 mr-2" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="troubleshooting">
            <AlertCircle className="w-4 h-4 mr-2" />
            Problemas
          </TabsTrigger>
        </TabsList>

        {/* INÍCIO RÁPIDO */}
        <TabsContent value="inicio" className="space-y-6">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle className="w-6 h-6" />
                Sistema Pronto para Uso!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-800">
                Siga os 4 passos abaixo para começar a usar em 5 minutos.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🚀 4 Passos Para Começar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Passo 1 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Configure WhatsApp Z-API</h3>
                  <p className="text-slate-600 mb-3">
                    Acesse: <strong>Comunicação → Configurar WhatsApp</strong>
                  </p>
                  <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                    <p className="text-sm">
                      📱 <strong>Instance ID:</strong> <code className="bg-white px-2 py-1 rounded text-xs">seu_instance_id</code>
                    </p>
                    <p className="text-sm">
                      🔑 <strong>API Key:</strong> <code className="bg-white px-2 py-1 rounded text-xs">seu_api_key</code>
                    </p>
                    <p className="text-sm">
                      🔐 <strong>Client Token:</strong> <code className="bg-white px-2 py-1 rounded text-xs">seu_client_token</code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Passo 2 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Registre o Webhook</h3>
                  <p className="text-slate-600 mb-3">
                    Copie a URL abaixo e cole no painel Z-API:
                  </p>
                  <div className="relative">
                    <code className="block bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                      {window.location.origin}/functions/inboundWebhook
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 text-white hover:bg-slate-800"
                      onClick={() => handleCopyCode(`${window.location.origin}/functions/inboundWebhook`, 'webhook')}
                    >
                      {copiedCode === 'webhook' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Passo 3 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Instale Playbooks</h3>
                  <p className="text-slate-600 mb-3">
                    Acesse: <strong>Biblioteca de Playbooks</strong> e instale os templates prontos
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="font-semibold text-purple-900">🎯 Qualificação BANT</p>
                      <p className="text-xs text-purple-700">Qualifica leads automaticamente</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="font-semibold text-green-900">🔄 Follow-up</p>
                      <p className="text-xs text-green-700">Recupera leads frios</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Passo 4 */}
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  ✓
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 text-green-900">Teste o Sistema!</h3>
                  <p className="text-slate-600 mb-3">
                    Execute o teste End-to-End para validar tudo:
                  </p>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Play className="w-4 h-4 mr-2" />
                    Executar Teste Completo
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIGURAÇÃO */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Configurações Detalhadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div>
                <h3 className="font-bold text-lg mb-3">Integração Z-API</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  <div>
                    <Label className="font-semibold">Instance ID</Label>
                    <p className="text-sm text-slate-600">Encontre em: Painel Z-API → Instâncias</p>
                  </div>
                  <div>
                    <Label className="font-semibold">API Key</Label>
                    <p className="text-sm text-slate-600">Encontre em: Painel Z-API → Token da Instância</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Client Token</Label>
                    <p className="text-sm text-slate-600">Encontre em: Painel Z-API → Conta → Client-Token</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-3">Webhook Configuration</h3>
                <div className="space-y-3">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm font-semibold mb-2">Eventos para Monitorar:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">MESSAGE_RECEIVED</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm">MESSAGE_STATUS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* PLAYBOOKS */}
        <TabsContent value="playbooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚡ Guia de Playbooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div>
                <h3 className="font-bold text-lg mb-3">O que são Playbooks?</h3>
                <p className="text-slate-600">
                  Playbooks são fluxos conversacionais automatizados que guiam o cliente por uma jornada específica. 
                  Eles podem coletar informações, qualificar leads, enviar follow-ups e muito mais.
                </p>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-bold text-lg mb-3">Tipos de Steps</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <p className="font-semibold">message</p>
                    </div>
                    <p className="text-sm text-slate-600">Envia mensagem de texto</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <p className="font-semibold">input</p>
                    </div>
                    <p className="text-sm text-slate-600">Solicita informação</p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* TROUBLESHOOTING */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🔧 Resolvendo Problemas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold mb-2">❌ Webhook não recebe mensagens</h3>
                <p className="text-sm text-slate-600 mb-2"><strong>Solução:</strong></p>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                  <li>Verifique a URL no painel Z-API</li>
                  <li>Confirme o Client-Token no header HTTP</li>
                  <li>Teste em Debug Webhooks</li>
                </ol>
              </div>

              <div className="border-t" />

              <div className="border-l-4 border-amber-500 pl-4">
                <h3 className="font-bold mb-2">⚠️ Playbook não executa</h3>
                <p className="text-sm text-slate-600 mb-2"><strong>Solução:</strong></p>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                  <li>Verifique se o playbook está ativo</li>
                  <li>Revise os gatilhos configurados</li>
                  <li>Veja Analytics Playbooks para debug</li>
                </ol>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}