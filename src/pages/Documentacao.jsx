import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Book, 
  Rocket, 
  Settings, 
  Code, 
  TrendingUp, 
  Shield,
  Zap,
  Brain,
  Tag,
  BarChart3,
  CheckCircle2
} from 'lucide-react';

export default function Documentacao() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          VendaPro Automation Engine 🤖
        </h1>
        <p className="text-xl text-slate-600">
          Plataforma inteligente e escalável de automação de vendas e atendimento
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Badge className="bg-blue-500">v4.0 Stable</Badge>
          <Badge className="bg-green-500">Production Ready</Badge>
          <Badge className="bg-purple-500">AI Powered</Badge>
        </div>
      </div>

      {/* Visão Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5" />
            Visão Geral
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p className="text-slate-600 leading-relaxed">
            O <strong>VendaPro Automation Engine</strong> é uma plataforma construída sobre a infraestrutura <strong>Base44</strong> que combina 
            <strong> automação avançada</strong>, <strong>inteligência artificial</strong>, <strong>aprendizado contínuo</strong> e 
            <strong> análise preditiva</strong> para transformar leads em vendas de forma autônoma e inteligente.
          </p>
        </CardContent>
      </Card>

      {/* Principais Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Principais Funcionalidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Motor de Automação */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-blue-600">
                <CheckCircle2 className="w-5 h-5" />
                Motor de Automação (Playbook Engine)
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• Execução de fluxos conversacionais complexos</li>
                <li>• Tipos de etapas: message, input, route, action, delay, ia_classify</li>
                <li>• Variáveis dinâmicas e contexto persistente</li>
                <li>• Versionamento com histórico completo</li>
                <li>• Métricas de performance automáticas</li>
              </ul>
            </div>

            {/* IA Integrada */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-purple-600">
                <Brain className="w-5 h-5" />
                Inteligência Artificial Integrada
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• NexusClassifier: Classificação de intenções</li>
                <li>• RAG: Respostas baseadas em Base de Conhecimento</li>
                <li>• Agente IA: Atendimento autônomo</li>
                <li>• Business IA: Insights estratégicos e previsões</li>
                <li>• Aprendizado contínuo e auto-otimização</li>
              </ul>
            </div>

            {/* Analytics */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-green-600">
                <BarChart3 className="w-5 h-5" />
                Analytics e Métricas
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• Nexus Command Center: Painel centralizado</li>
                <li>• KPIs em tempo real: conversões, taxa de sucesso</li>
                <li>• Tracking de custos de IA (tokens, modelos)</li>
                <li>• Relatórios preditivos para 30 dias</li>
                <li>• Exportação de relatórios (CSV/PDF)</li>
              </ul>
            </div>

            {/* Sistema de Tags */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-amber-600">
                <Tag className="w-5 h-5" />
                Sistema de Tags Inteligente
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• Segmentação automática de contatos</li>
                <li>• Regras automáticas para aplicação</li>
                <li>• Métricas por tag: conversão, ticket médio</li>
                <li>• Integração com playbooks (gatilhos por tags)</li>
                <li>• Gestão visual no TagManager</li>
              </ul>
            </div>

            {/* Marketplace */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-indigo-600">
                <TrendingUp className="w-5 h-5" />
                Playbook Marketplace
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• Biblioteca de +20 playbooks prontos</li>
                <li>• Filtros por categoria, setor e nível</li>
                <li>• Instalação com 1 clique</li>
                <li>• Avaliações e métricas compartilhadas</li>
                <li>• Customização pós-instalação</li>
              </ul>
            </div>

            {/* Auto-Otimização */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-red-600">
                <Settings className="w-5 h-5" />
                Ciclo de Auto-Otimização
              </div>
              <ul className="text-sm text-slate-600 space-y-1 ml-7">
                <li>• Execução diária automatizada (Cron)</li>
                <li>• Health Check completo do sistema</li>
                <li>• Executor de listas agendadas</li>
                <li>• Otimização de playbooks com IA</li>
                <li>• Backups quinzenais automáticos</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Arquitetura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Arquitetura do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-900 text-slate-50 p-6 rounded-lg font-mono text-sm overflow-x-auto">
            <pre>{`vendapro-automation-engine/
├── functions/                    # Backend (Deno Deploy)
│   ├── playbookEngine.js        # Motor principal de execução
│   ├── agenteIAHandler.js       # Agente IA autônomo
│   ├── nexusClassifier.js       # Classificação de intenções
│   ├── businessIA.js            # Insights estratégicos
│   ├── tagManager.js            # Gestão de tags
│   ├── playbookMarketplace.js   # Marketplace de playbooks
│   ├── cicloAutoOtimizacao.js   # Cron diário de otimização
│   ├── monitorarSaudeDoSistema.js # Health check profundo
│   ├── metricsEngine.js         # Cálculo de KPIs
│   └── inboundWebhook.js        # Recebimento WhatsApp
│
├── pages/                        # Frontend (React)
│   ├── Dashboard.jsx            # Visão geral de vendas
│   ├── NexusCommandCenter.jsx   # Painel de controle
│   ├── Comunicacao.jsx          # Central de conversas
│   ├── PlaybooksAutomacao.jsx   # Gestão de playbooks
│   └── BaseConhecimento.jsx     # Gerenciamento RAG
│
├── components/                   # Componentes React
│   ├── automacao/
│   │   ├── PlaybookManager.jsx
│   │   ├── PlaybookVisualEditor.jsx
│   │   └── PlaybookMarketplace.jsx
│   ├── dashboard/
│   │   ├── ControlCenter.jsx
│   │   └── HealthMonitor.jsx
│   └── tags/
│       └── TagManager.jsx
│
└── entities/                     # Schemas (JSON)
    ├── FlowTemplate.json
    ├── FlowExecution.json
    ├── Contact.json
    ├── Tag.json
    ├── PlaybookMarketplace.json
    └── AutomationLog.json`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Começando */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Começando
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Passo 1 */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm">1</span>
              Configurar Variáveis de Ambiente
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              No painel do Base44, configure as seguintes variáveis:
            </p>
            <div className="bg-slate-100 p-4 rounded-lg text-sm font-mono">
              <div className="text-slate-700">
                # IA<br/>
                OPENAI_API_KEY=sk-...<br/><br/>
                
                # Cron Jobs<br/>
                CRON_SECRET=seu-secret-unico<br/><br/>
                
                # Base44 (pré-configurados)<br/>
                BASE44_APP_ID=...<br/>
                BASE44_SERVICE_ROLE_KEY=...
              </div>
            </div>
          </div>

          {/* Passo 2 */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm">2</span>
              Configurar Integração WhatsApp
            </h3>
            <p className="text-sm text-slate-600 mb-2">
              Acesse <strong>Comunicação → Configuração WhatsApp</strong> e adicione:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• <strong>Provedor</strong>: Z-API ou Evolution API</li>
              <li>• <strong>Instance ID</strong> e <strong>API Key</strong></li>
              <li>• <strong>Client Token</strong> (segurança)</li>
              <li>• <strong>Webhook URL</strong>: https://seu-app.base44.app/functions/inboundWebhook</li>
            </ul>
          </div>

          {/* Passo 3 */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm">3</span>
              Criar Primeiro Playbook
            </h3>
            <p className="text-sm text-slate-600 mb-2">
              Opções:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• Acesse <strong>Playbooks & Automação</strong> → <strong>Novo Playbook</strong></li>
              <li>• Ou instale um pronto do <strong>Marketplace</strong></li>
            </ul>
          </div>

          {/* Passo 4 */}
          <div>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm">4</span>
              Ativar Ciclo de Auto-Otimização
            </h3>
            <p className="text-sm text-slate-600 mb-2">
              O <code className="bg-slate-200 px-2 py-1 rounded">cicloAutoOtimizacao.js</code> já está configurado como Cron Job diário (02:00h).
            </p>
            <p className="text-sm text-slate-600">
              Valide em: <strong>System Health → Últimas Execuções</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Exemplos de Código */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Exemplos de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Criar Playbook */}
          <div>
            <h4 className="font-semibold mb-2">Criando um Playbook</h4>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`{
  "nome": "Boas-vindas e Qualificação",
  "categoria": "vendas",
  "gatilhos": ["oi", "olá", "bom dia"],
  "steps": [
    {
      "type": "message",
      "texto": "Olá! Bem-vindo(a) à VendaPro 👋"
    },
    {
      "type": "input",
      "texto": "Qual é o seu nome?",
      "campo": "nome",
      "tipo_input": "text"
    },
    {
      "type": "ia_classify",
      "texto": "Classificar intenção do cliente"
    },
    {
      "type": "route",
      "mapa": {
        "vendas": "fluxo_vendas",
        "suporte": "fluxo_suporte"
      }
    }
  ],
  "default_variables": {
    "nome_empresa": "VendaPro",
    "telefone_suporte": "11 99999-9999"
  }
}`}</pre>
            </div>
          </div>

          {/* Gerenciar Tags */}
          <div>
            <h4 className="font-semibold mb-2">Gerenciando Tags</h4>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`// Criar tag
await base44.entities.Tag.create({
  nome: "cliente_vip",
  categoria: "segmentacao",
  cor: "#FFD700",
  regras_automaticas: {
    aplicar_automaticamente: true,
    condicoes: [
      { campo: "total_compras", operador: "greater_than", valor: "5" }
    ]
  }
});

// Aplicar tag manualmente
await base44.functions.invoke('tagManager', {
  action: 'apply_tag',
  contact_id: "...",
  tag_id: "...",
  motivo: "Cliente solicitou upgrade"
});`}</pre>
            </div>
          </div>

          {/* Consultar Métricas */}
          <div>
            <h4 className="font-semibold mb-2">Consultando Métricas</h4>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{`// KPIs Gerais
const metricas = await base44.functions.invoke('metricsEngine', {
  action: 'calculate_kpis',
  periodo_dias: 30
});

// Insights Estratégicos
const insights = await base44.functions.invoke('businessIA', {
  action: 'strategic_insights'
});

// Health Check
const health = await base44.functions.invoke('monitorarSaudeDoSistema', {});`}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manutenção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Manutenção e Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Logs e Auditoria</h4>
            <p className="text-sm text-slate-600">
              Todos os eventos são registrados em:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4 mt-2">
              <li>• <code className="bg-slate-200 px-2 py-1 rounded">AutomationLog</code>: Logs de execuções e ações</li>
              <li>• <code className="bg-slate-200 px-2 py-1 rounded">WebhookLog</code>: Logs de webhooks recebidos</li>
              <li>• <code className="bg-slate-200 px-2 py-1 rounded">IAUsageMetric</code>: Tracking de uso de IA e custos</li>
            </ul>
            <p className="text-sm text-slate-600 mt-2">
              Acesse em: <strong>Auditoria</strong> no menu lateral.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Health Check Manual</h4>
            <div className="bg-slate-100 p-3 rounded-lg text-sm font-mono">
              await base44.functions.invoke('monitorarSaudeDoSistema', {`{}`});
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Reindexar Base de Conhecimento</h4>
            <p className="text-sm text-slate-600 mb-2">
              Se a busca RAG estiver desatualizada:
            </p>
            <div className="bg-slate-100 p-3 rounded-lg text-sm font-mono">
              await base44.functions.invoke('reindexarRAG', {`{}`});
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roadmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm"><strong>Fase 1</strong>: Núcleo de Automação Estável</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm"><strong>Fase 2</strong>: Inteligência e Aprendizado Contínuo</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm"><strong>Fase 3</strong>: Dashboard e Métricas de Negócio</span>
            </div>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-blue-500 animate-spin" />
              <span className="text-sm"><strong>Fase 4</strong>: Expansão de Integrações (CRM, ERP)</span>
            </div>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="text-sm"><strong>Fase 5</strong>: White-label e Multi-Tenant</span>
            </div>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="text-sm"><strong>Fase 6</strong>: Mobile App (React Native)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 pt-6 border-t">
        <p>© 2025 VendaPro. Todos os direitos reservados.</p>
        <p className="mt-2">
          Desenvolvido com ❤️ usando <strong>Base44</strong>, <strong>React</strong>, <strong>Deno</strong> e <strong>OpenAI</strong>
        </p>
      </div>
    </div>
  );
}