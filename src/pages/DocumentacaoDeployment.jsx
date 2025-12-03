
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  Shield,
  Database,
  Zap,
  CheckCircle,
  Copy,
  ExternalLink,
  AlertTriangle,
  Code,
  Server,
  Globe,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function DocumentacaoDeployment() {
  const [tabAtiva, setTabAtiva] = useState("prereq");

  const copiarTexto = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado para área de transferência!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
              <Rocket className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                🚀 Guia de Implantação
              </h1>
              <p className="text-slate-600 mt-1">
                Documentação completa para deploy em produção do VendaPro CRM
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo em Tabs */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="prereq">Pré-requisitos</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="monitoramento">Monitoramento</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        {/* PRÉ-REQUISITOS */}
        <TabsContent value="prereq" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Contas Necessárias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">Conta Base44</p>
                  <p className="text-sm text-slate-600">Plataforma de hospedagem</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://base44.com" target="_blank" rel="noopener noreferrer">
                    Criar Conta <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">WhatsApp Business API</p>
                  <p className="text-sm text-slate-600">Evolution API ou Z-API</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://evolution-api.com" target="_blank" rel="noopener noreferrer">
                    Acessar <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">Google Cloud Console</p>
                  <p className="text-sm text-slate-600">Para OAuth e Sheets</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                    Acessar <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Variáveis de Ambiente Obrigatórias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm space-y-2 relative">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="absolute top-2 right-2 text-green-400 hover:text-green-300"
                  onClick={() => copiarTexto(`# GOOGLE APIS
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# WHATSAPP - EVOLUTION API
EVOLUTION_API_KEY=sua_chave_evolution
EVOLUTION_BASE_URL=https://sua-evolution.com.br

# WHATSAPP - Z-API
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token_zapi
ZAPI_BASE_URL=https://api.z-api.io

# WEBHOOKS
WEBHOOK_SECRET=gere_uma_senha_forte_aqui
CRON_SECRET=outra_senha_forte_para_cron`)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                
                <div><span className="text-gray-500"># GOOGLE APIS</span></div>
                <div>GOOGLE_CLIENT_ID=seu_client_id_aqui</div>
                <div>GOOGLE_CLIENT_SECRET=seu_client_secret_aqui</div>
                <div>GOOGLE_SERVICE_ACCOUNT_KEY={`{"type":"service_account",...}`}</div>
                
                <div className="pt-2"><span className="text-gray-500"># WHATSAPP - EVOLUTION API</span></div>
                <div>EVOLUTION_API_KEY=sua_chave_evolution</div>
                <div>EVOLUTION_BASE_URL=https://sua-evolution.com.br</div>
                
                <div className="pt-2"><span className="text-gray-500"># WHATSAPP - Z-API</span></div>
                <div>ZAPI_INSTANCE_ID=seu_instance_id</div>
                <div>ZAPI_TOKEN=seu_token_zapi</div>
                <div>ZAPI_BASE_URL=https://api.z-api.io</div>
                
                <div className="pt-2"><span className="text-gray-500"># WEBHOOKS</span></div>
                <div>WEBHOOK_SECRET=gere_uma_senha_forte_aqui</div>
                <div>CRON_SECRET=outra_senha_forte_para_cron</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Como Gerar Secrets Seguros</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Use: <code className="bg-amber-100 px-2 py-1 rounded">openssl rand -base64 64</code>
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Ou: <a href="https://passwordsgenerator.net/" target="_blank" rel="noopener noreferrer" className="underline">passwordsgenerator.net</a>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                Ambientes Recomendados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Badge className="bg-blue-600 mb-2">Desenvolvimento</Badge>
                  <p className="text-sm font-semibold text-slate-900">dev-vendapro.base44.com</p>
                  <p className="text-xs text-slate-600 mt-1">Testes e desenvolvimento</p>
                  <p className="text-xs text-slate-500 mt-1">Dados: Fictícios</p>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <Badge className="bg-amber-600 mb-2">Homologação</Badge>
                  <p className="text-sm font-semibold text-slate-900">staging-vendapro.base44.com</p>
                  <p className="text-xs text-slate-600 mt-1">Testes finais</p>
                  <p className="text-xs text-slate-500 mt-1">Dados: Cópia sanitizada</p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <Badge className="bg-green-600 mb-2">Produção</Badge>
                  <p className="text-sm font-semibold text-slate-900">vendapro.seudominio.com</p>
                  <p className="text-xs text-slate-600 mt-1">Aplicação real</p>
                  <p className="text-xs text-slate-500 mt-1">Dados: Clientes reais</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPLOY PASSO A PASSO */}
        <TabsContent value="deploy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" />
                Deploy Passo a Passo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Passo 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Criar Projeto no Base44</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
                    <li>Acesse <a href="https://base44.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">base44.com</a></li>
                    <li>Clique em "Novo Projeto"</li>
                    <li>Nome: <code className="bg-slate-100 px-2 py-0.5 rounded">VendaPro CRM</code></li>
                    <li>Selecione plano adequado (Pro ou Enterprise recomendado)</li>
                  </ol>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Importar Código</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="font-semibold text-sm mb-2">Opção A: Via GitHub (Recomendado)</p>
                      <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs space-y-1 relative">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="absolute top-1 right-1 text-green-400 hover:text-green-300"
                          onClick={() => copiarTexto(`git init
git add .
git commit -m "Initial commit - VendaPro CRM"
git remote add origin https://github.com/seu-usuario/vendapro-crm.git
git push -u origin main`)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <div>git init</div>
                        <div>git add .</div>
                        <div>git commit -m "Initial commit - VendaPro CRM"</div>
                        <div>git remote add origin https://github.com/seu-usuario/vendapro-crm.git</div>
                        <div>git push -u origin main</div>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        No Base44: Settings → Git → Connect Repository
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-sm mb-2">Opção B: Upload Direto</p>
                      <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs relative">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="absolute top-1 right-1 text-green-400 hover:text-green-300"
                          onClick={() => copiarTexto(`zip -r vendapro-crm.zip . -x "node_modules/*" ".git/*"`)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <div>zip -r vendapro-crm.zip . -x "node_modules/*" ".git/*"</div>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        No Base44: Upload via interface
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Configurar Secrets</h3>
                  <p className="text-sm text-slate-700 mb-2">
                    No Dashboard Base44: <code className="bg-slate-100 px-2 py-0.5 rounded">Settings → Environment Variables → Add Secret</code>
                  </p>
                  <p className="text-sm text-slate-600">
                    Configure todos os secrets listados na aba "Pré-requisitos"
                  </p>
                </div>
              </div>

              {/* Passo 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    4
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Configurar Domínio (Opcional)</h3>
                  <p className="text-sm text-slate-700 mb-2">
                    <code className="bg-slate-100 px-2 py-0.5 rounded">Settings → Domains → Add Custom Domain</code>
                  </p>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold mb-1">Adicione registro DNS:</p>
                    <div className="bg-slate-900 text-green-400 p-2 rounded font-mono text-xs">
                      CNAME: vendapro.seudominio.com → seu-app.base44.com
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 5 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    5
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Deploy Inicial</h3>
                  <p className="text-sm text-slate-700 mb-2">
                    Base44 fará deploy automático após commit
                  </p>
                  <p className="text-sm text-slate-600">
                    Ou force deploy manual: <code className="bg-slate-100 px-2 py-0.5 rounded">Settings → Deployments → Trigger Deploy</code>
                  </p>
                </div>
              </div>

              {/* Passo 6 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">Inicialização do Sistema</h3>
                  <p className="text-sm text-slate-700 mb-2">
                    Após primeiro deploy, o sistema executará automaticamente a inicialização na primeira carga
                  </p>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">O que acontece:</p>
                    <ul className="text-xs text-blue-800 space-y-0.5">
                      <li>✅ Criar estrutura de dados inicial</li>
                      <li>✅ Configurar mapeamentos padrão</li>
                      <li>✅ Criar usuário admin</li>
                      <li>✅ Indexar base de conhecimento</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRAÇÕES */}
        <TabsContent value="integracoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                WhatsApp - Evolution API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">1. Obter Credenciais</h4>
                  <p className="text-sm text-slate-600 mb-2">Acesse: <a href="https://evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">evolution-api.com</a></p>
                  <p className="text-sm text-slate-700">Criar instância → Copiar API Key</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Configurar no VendaPro</h4>
                  <p className="text-sm text-slate-700">Dashboard VendaPro → Comunicação → Configurar WhatsApp</p>
                  <p className="text-sm text-slate-600">Selecionar: Evolution API</p>
                  <p className="text-sm text-slate-600">Colar API Key e Base URL</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Conectar Número</h4>
                  <p className="text-sm text-slate-700">Gerar QR Code → Escanear com WhatsApp</p>
                  <Badge className="bg-green-600 mt-2">Status: Conectado ✅</Badge>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Configurar Webhooks</h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div>
                      <p className="text-xs font-semibold">URL Webhook:</p>
                      <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-1">
                        https://vendapro.seudominio.com/api/inboundWebhook
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Eventos:</p>
                      <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-1">
                        message.received, message.sent, connection.update
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                WhatsApp - Z-API
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">1. Obter Credenciais</h4>
                  <p className="text-sm text-slate-600 mb-2">Acesse: <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">z-api.io</a></p>
                  <p className="text-sm text-slate-700">Criar instância → Copiar Instance ID e Token</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Configurar no VendaPro</h4>
                  <p className="text-sm text-slate-700">Dashboard VendaPro → Comunicação → Configurar WhatsApp</p>
                  <p className="text-sm text-slate-600">Selecionar: Z-API</p>
                  <p className="text-sm text-slate-600">Colar Instance ID e Token</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Conectar Número</h4>
                  <p className="text-sm text-slate-700">Gerar QR Code → Escanear com WhatsApp</p>
                  <Badge className="bg-green-600 mt-2">Status: Conectado ✅</Badge>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Configurar Webhooks</h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                    <div>
                      <p className="text-xs font-semibold">URL Webhook:</p>
                      <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-1">
                        https://vendapro.seudominio.com/api/inboundWebhook
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Google Sheets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-2">1. Criar Service Account</h4>
                  <p className="text-sm text-slate-600 mb-2">Google Cloud Console → IAM & Admin → Service Accounts</p>
                  <p className="text-sm text-slate-700">Criar conta → Baixar JSON Key</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Habilitar APIs</h4>
                  <p className="text-sm text-slate-700">No Google Cloud Console, habilite:</p>
                  <ul className="text-sm text-slate-600 list-disc list-inside mt-1">
                    <li>Google Sheets API</li>
                    <li>Google Drive API</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Configurar no VendaPro</h4>
                  <p className="text-sm text-slate-700">Adicione o JSON Key como variável de ambiente:</p>
                  <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-2">
                    GOOGLE_SERVICE_ACCOUNT_KEY={`{"type":"service_account",...}`}
                  </code>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">4. Compartilhar Planilhas</h4>
                  <p className="text-sm text-slate-700">Compartilhe suas planilhas com o email da Service Account</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Ex: vendapro@seu-projeto.iam.gserviceaccount.com
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONITORAMENTO */}
        <TabsContent value="monitoramento" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Monitoramento de Saúde do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="font-semibold text-blue-900 mb-2">Dashboard de Saúde</p>
                <p className="text-sm text-blue-800">
                  Acesse: <code className="bg-blue-100 px-2 py-0.5 rounded">Dashboard → System Health</code>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>✅ Status de todas as integrações</li>
                  <li>✅ Tempo de resposta de APIs</li>
                  <li>✅ Taxa de sucesso de operações</li>
                  <li>✅ Alertas automáticos</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Componentes Monitorados</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">WhatsApp Z-API</p>
                    <p className="text-xs text-slate-600">Conectividade e latência</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">WhatsApp Evolution</p>
                    <p className="text-xs text-slate-600">Status da instância</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">Webhook Inbound</p>
                    <p className="text-xs text-slate-600">Taxa de processamento</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">Database</p>
                    <p className="text-xs text-slate-600">Performance de queries</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">LLM Integration</p>
                    <p className="text-xs text-slate-600">Disponibilidade da IA</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="font-semibold text-sm">Base44 Platform</p>
                    <p className="text-xs text-slate-600">Status geral</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Logs e Auditoria</h4>
                <p className="text-sm text-slate-700 mb-2">
                  Acesse: <code className="bg-slate-100 px-2 py-0.5 rounded">Dashboard → Auditoria</code>
                </p>
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                  <li>Registro de todas as ações de usuários</li>
                  <li>Histórico de mudanças em dados</li>
                  <li>Logs de integrações e webhooks</li>
                  <li>Exportação de relatórios de auditoria</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Backup e Recuperação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="font-semibold text-green-900 mb-2">Backup Automático</p>
                <p className="text-sm text-green-800">
                  O Base44 realiza backups automáticos diários do banco de dados
                </p>
                <ul className="text-sm text-green-700 mt-2 space-y-1">
                  <li>✅ Backup diário às 3:00 AM (UTC)</li>
                  <li>✅ Retenção de 30 dias</li>
                  <li>✅ Recuperação point-in-time</li>
                  <li>✅ Backups criptografados</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Backup Manual</h4>
                <p className="text-sm text-slate-700 mb-2">
                  Para criar backup manual:
                </p>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
                  <li>Acesse: Dashboard Base44 → Database → Backups</li>
                  <li>Clique em "Create Manual Backup"</li>
                  <li>Aguarde confirmação</li>
                  <li>Download disponível por 7 dias</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Restauração de Backup</h4>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Atenção</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Restauração sobrescreve todos os dados atuais. Faça backup antes de restaurar.
                      </p>
                    </div>
                  </div>
                </div>
                <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1 mt-3">
                  <li>Dashboard Base44 → Database → Backups</li>
                  <li>Selecione o backup desejado</li>
                  <li>Clique em "Restore"</li>
                  <li>Confirme a operação</li>
                  <li>Aguarde conclusão (pode levar vários minutos)</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TROUBLESHOOTING */}
        <TabsContent value="troubleshooting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Problemas Comuns e Soluções
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Problema 1 */}
              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-bold text-red-900 mb-2">❌ WhatsApp não conecta</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm">Sintomas:</p>
                    <p className="text-sm text-slate-600">QR Code não aparece ou erro de conexão</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Soluções:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                      <li>Verifique se as variáveis de ambiente estão corretas</li>
                      <li>Teste a URL base da API (deve estar acessível)</li>
                      <li>Verifique se a instância está ativa no painel do provider</li>
                      <li>Tente recriar a instância</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Teste rápido:</p>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-1">
                      Dashboard → Debug Webhooks → Testar Conexão
                    </code>
                  </div>
                </div>
              </div>

              {/* Problema 2 */}
              <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-bold text-amber-900 mb-2">⚠️ Webhooks não chegam</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm">Sintomas:</p>
                    <p className="text-sm text-slate-600">Mensagens não aparecem no sistema</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Soluções:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                      <li>Verifique URL do webhook no painel do provider</li>
                      <li>Certifique-se que a URL está acessível publicamente</li>
                      <li>Verifique logs de webhook: Dashboard → Debug Webhooks</li>
                      <li>Teste envio manual pelo painel do provider</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">URL correta do webhook:</p>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded block mt-1">
                      https://seu-app.base44.com/api/inboundWebhook
                    </code>
                  </div>
                </div>
              </div>

              {/* Problema 3 */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-bold text-blue-900 mb-2">ℹ️ Importação falha</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm">Sintomas:</p>
                    <p className="text-sm text-slate-600">Erro ao importar arquivos ou planilhas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Soluções:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                      <li>Verifique formato do arquivo (CSV, XLSX suportados)</li>
                      <li>Confirme mapeamento de campos</li>
                      <li>Para Google Sheets: verifique permissões da Service Account</li>
                      <li>Teste com arquivo menor primeiro</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Problema 4 */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-bold text-purple-900 mb-2">🤖 IA não responde ou responde errado</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm">Sintomas:</p>
                    <p className="text-sm text-slate-600">NexusEngine lento ou respostas incorretas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Soluções:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                      <li>Verifique Base de Conhecimento está populada</li>
                      <li>Execute reindexação: Dashboard → Base Conhecimento → Reindexar</li>
                      <li>Revise prompts e templates</li>
                      <li>Verifique logs de IA: Dashboard → IA & Métricas</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Problema 5 */}
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-bold text-green-900 mb-2">🐌 Sistema lento</h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-sm">Sintomas:</p>
                    <p className="text-sm text-slate-600">Dashboard demora para carregar ou queries lentas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Soluções:</p>
                    <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                      <li>Verifique quantidade de registros (limite: 10.000 por entidade recomendado)</li>
                      <li>Use filtros para reduzir dados carregados</li>
                      <li>Limpe cache do navegador</li>
                      <li>Considere arquivar dados antigos</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-600" />
                Logs e Debugging
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Acessar Logs</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                    <span className="text-sm">Logs de Aplicação</span>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded">
                      Base44 → Logs → Application
                    </code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                    <span className="text-sm">Logs de Webhooks</span>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded">
                      Dashboard → Debug Webhooks
                    </code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                    <span className="text-sm">Logs de Auditoria</span>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded">
                      Dashboard → Auditoria
                    </code>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                    <span className="text-sm">Console do Navegador</span>
                    <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded">
                      F12 → Console
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Modo Debug</h4>
                <p className="text-sm text-slate-700 mb-2">
                  Para ativar modo debug detalhado no console:
                </p>
                <div className="bg-slate-900 text-green-400 p-3 rounded-lg font-mono text-xs">
                  localStorage.setItem('DEBUG_MODE', 'true')
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Recarregue a página. Logs detalhados aparecerão no console.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Suporte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">Documentação Base44</p>
                  <p className="text-sm text-slate-600">Guias e tutoriais da plataforma</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://docs.base44.com" target="_blank" rel="noopener noreferrer">
                    Acessar <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-semibold">Comunidade Base44</p>
                  <p className="text-sm text-slate-600">Discord e fóruns</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://community.base44.com" target="_blank" rel="noopener noreferrer">
                    Acessar <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="font-semibold text-blue-900 mb-2">Reportar Bug ou Problema</p>
                <p className="text-sm text-blue-800">
                  Ao reportar, inclua sempre:
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Descrição detalhada do problema</li>
                  <li>Passos para reproduzir</li>
                  <li>Screenshots (se aplicável)</li>
                  <li>Logs do console</li>
                  <li>Ambiente (dev/staging/prod)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
