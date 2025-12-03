import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  Zap,
  Shield,
  Users,
  MessageSquare,
  Settings
} from "lucide-react";

export default function PlanoImplementacao() {
  const fases = [
    {
      numero: 0,
      nome: "Preparação e Backup",
      status: "pendente",
      duracao: "30 minutos",
      criticidade: "critica",
      descricao: "Criar backups completos de todos os arquivos críticos antes de qualquer modificação",
      tarefas: [
        "✅ Criar entidade CodeBackup",
        "✅ Criar página de gerenciamento de backups",
        "📋 Fazer backup de inboundWebhook.js",
        "📋 Fazer backup de enviarWhatsApp.js",
        "📋 Fazer backup de agenteIAHandler.js",
        "📋 Fazer backup de ChatWindow.js",
        "📋 Fazer backup de Comunicacao.js",
        "📋 Documentar estado atual do sistema"
      ],
      riscos: ["Nenhum - apenas leitura"],
      rollback: "Não aplicável"
    },
    {
      numero: 1,
      nome: "Configuração de Usuários como Atendentes",
      status: "pendente",
      duracao: "1-2 horas",
      criticidade: "baixa",
      descricao: "Adicionar campos para identificar atendentes e seus setores SEM tocar na comunicação",
      tarefas: [
        "✏️ Atualizar entidade User com novos campos",
        "✏️ Atualizar UsuarioForm para incluir campos de atendente",
        "✏️ Atualizar TabelaUsuarios para exibir status de atendente",
        "✏️ Criar componente de gerenciamento de disponibilidade",
        "🧪 Testar cadastro de usuários (não afeta WhatsApp)"
      ],
      riscos: [
        "Baixo - não afeta fluxo de mensagens existente",
        "Apenas adiciona campos novos à entidade User"
      ],
      rollback: "Remover campos adicionados da entidade User",
      naoAfeta: [
        "❌ NÃO TOCA em inboundWebhook",
        "❌ NÃO TOCA em enviarWhatsApp",
        "❌ NÃO TOCA em agenteIAHandler",
        "❌ NÃO TOCA em ChatWindow"
      ]
    },
    {
      numero: 2,
      nome: "Atualizar MessageThread (Preparação)",
      status: "pendente",
      duracao: "30 minutos",
      criticidade: "media",
      descricao: "Adicionar campos de controle à MessageThread SEM alterar lógica",
      tarefas: [
        "✏️ Adicionar campo pre_atendimento_etapa à MessageThread",
        "✏️ Adicionar campo pre_atendimento_data à MessageThread",
        "🧪 Verificar que threads existentes continuam funcionando",
        "🧪 Testar criação de novas threads"
      ],
      riscos: [
        "Médio - adiciona campos à entidade crítica",
        "Threads existentes NÃO serão afetadas (campos opcionais)"
      ],
      rollback: "Remover campos da entidade MessageThread",
      naoAfeta: [
        "❌ NÃO MODIFICA lógica de inboundWebhook",
        "❌ NÃO MODIFICA envio de mensagens",
        "❌ Threads existentes continuam normais"
      ]
    },
    {
      numero: 3,
      nome: "Criar Função de Pré-Atendimento (Isolada)",
      status: "pendente",
      duracao: "2-3 horas",
      criticidade: "media",
      descricao: "Criar nova função separada para lógica de pré-atendimento",
      tarefas: [
        "✏️ Criar function preAtendimentoHandler.js (NOVA)",
        "✏️ Implementar lógica de menu de setores",
        "✏️ Implementar lógica de seleção de atendentes",
        "✏️ Criar função de roteamento inteligente",
        "🧪 Testar função isoladamente (sem integrar ainda)"
      ],
      riscos: [
        "Baixo - função nova e isolada",
        "Não afeta fluxo existente até ser integrada"
      ],
      rollback: "Deletar arquivo preAtendimentoHandler.js",
      naoAfeta: [
        "❌ NÃO INTEGRADA ao inboundWebhook ainda",
        "❌ Sistema continua funcionando normalmente",
        "❌ Apenas cria código novo, isolado"
      ]
    },
    {
      numero: 4,
      nome: "Integração Cirúrgica ao InboundWebhook",
      status: "pendente",
      duracao: "1-2 horas",
      criticidade: "alta",
      descricao: "Integrar pré-atendimento ao webhook com flag de ativação",
      tarefas: [
        "✏️ Adicionar flag ATIVAR_PRE_ATENDIMENTO no início do inboundWebhook",
        "✏️ Adicionar IF para chamar preAtendimentoHandler SOMENTE se flag = true",
        "✏️ Garantir que fluxo normal continua se flag = false",
        "🧪 Testar com flag DESATIVADA (sistema deve funcionar igual)",
        "🧪 Testar com flag ATIVADA (pré-atendimento deve funcionar)"
      ],
      riscos: [
        "Alto - modifica arquivo crítico",
        "MITIGADO por flag de ativação",
        "Pode ser desativado instantaneamente mudando flag"
      ],
      rollback: "Mudar flag para false ou reverter inboundWebhook para backup",
      protecoes: [
        "🛡️ Flag de ativação para ligar/desligar",
        "🛡️ Lógica antiga preservada no ELSE",
        "🛡️ Logs detalhados em cada etapa",
        "🛡️ Backup completo antes da modificação"
      ]
    },
    {
      numero: 5,
      nome: "Interface de Atendimento (UI)",
      status: "pendente",
      duracao: "2-3 horas",
      criticidade: "baixa",
      descricao: "Atualizar interface para atendentes visualizarem e gerenciarem conversas",
      tarefas: [
        "✏️ Adicionar filtro por atendente em ChatSidebar",
        "✏️ Adicionar indicador de atribuição em ChatWindow",
        "✏️ Criar componente de transferência de atendimento",
        "✏️ Adicionar botão de disponibilidade no header",
        "🧪 Testar interface"
      ],
      riscos: [
        "Baixo - apenas mudanças visuais",
        "Não afeta lógica de backend"
      ],
      rollback: "Reverter componentes visuais",
      naoAfeta: [
        "❌ NÃO AFETA recebimento de mensagens",
        "❌ NÃO AFETA envio de mensagens",
        "❌ Apenas melhora visualização"
      ]
    },
    {
      numero: 6,
      nome: "Testes Completos e Validação",
      status: "pendente",
      duracao: "2-3 horas",
      criticidade: "critica",
      descricao: "Testar todos os cenários possíveis antes de considerar completo",
      tarefas: [
        "🧪 Testar recebimento de mensagens (deve continuar funcionando)",
        "🧪 Testar envio de mensagens (deve continuar funcionando)",
        "🧪 Testar pré-atendimento com flag ATIVA",
        "🧪 Testar roteamento para atendentes",
        "🧪 Testar transferência entre atendentes",
        "🧪 Testar atendente offline/online",
        "🧪 Testar com múltiplas conversas simultâneas",
        "🧪 Monitorar logs por 24h em produção"
      ],
      riscos: ["Nenhum - apenas validação"],
      sucesso: [
        "✅ Mensagens continuam sendo recebidas normalmente",
        "✅ Mensagens continuam sendo enviadas normalmente",
        "✅ Pré-atendimento funciona quando ativado",
        "✅ Roteamento funciona corretamente",
        "✅ Nenhum erro nos logs"
      ]
    }
  ];

  const getStatusIcon = (status) => {
    switch(status) {
      case "completo": return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "em_progresso": return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
      case "pendente": return <Circle className="w-5 h-5 text-slate-400" />;
      default: return <Circle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getCriticidadeColor = (nivel) => {
    switch(nivel) {
      case "critica": return "bg-red-100 text-red-800";
      case "alta": return "bg-orange-100 text-orange-800";
      case "media": return "bg-yellow-100 text-yellow-800";
      case "baixa": return "bg-green-100 text-green-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-purple-900 mb-2">
                  📋 Plano de Implementação: Múltiplos Atendentes
                </h2>
                <p className="text-purple-800 mb-4">
                  Roadmap detalhado e seguro para implementar o sistema de atendimento sem afetar a comunicação Z-API consolidada.
                </p>
                <div className="flex gap-2">
                  <Badge className="bg-purple-100 text-purple-800">
                    {fases.length} fases planejadas
                  </Badge>
                  <Badge className="bg-green-100 text-green-800">
                    <Shield className="w-3 h-3 mr-1" />
                    Abordagem Cirúrgica
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Princípios de Segurança */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Shield className="w-5 h-5" />
              🛡️ Princípios de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">✅ O que FAREMOS</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• Criar backups antes de cada fase</li>
                  <li>• Adicionar funcionalidades de forma isolada</li>
                  <li>• Usar flags para ativar/desativar recursos</li>
                  <li>• Testar exaustivamente cada fase</li>
                  <li>• Documentar todas as mudanças</li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <h4 className="font-bold text-red-900 mb-2">❌ O que NÃO faremos</h4>
                <ul className="space-y-1 text-sm text-red-800">
                  <li>• Modificar envio de mensagens (enviarWhatsApp)</li>
                  <li>• Alterar lógica Z-API consolidada</li>
                  <li>• Fazer mudanças sem backup</li>
                  <li>• Implementar tudo de uma vez</li>
                  <li>• Prosseguir se algo quebrar</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fases */}
        {fases.map((fase, idx) => (
          <Card key={idx} className="border-2 hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(fase.status)}
                  <div>
                    <CardTitle className="text-lg">
                      Fase {fase.numero}: {fase.nome}
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">{fase.descricao}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge className={getCriticidadeColor(fase.criticidade)}>
                    {fase.criticidade}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    ⏱️ {fase.duracao}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {/* Tarefas */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Tarefas
                  </h4>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <ul className="space-y-1 text-sm">
                      {fase.tarefas.map((tarefa, tidx) => (
                        <li key={tidx} className="text-slate-700">{tarefa}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Não Afeta (se houver) */}
                {fase.naoAfeta && (
                  <div>
                    <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      Garantias de Não-Interferência
                    </h4>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <ul className="space-y-1 text-sm">
                        {fase.naoAfeta.map((item, nidx) => (
                          <li key={nidx} className="text-green-800 font-medium">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Proteções (se houver) */}
                {fase.protecoes && (
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Proteções Implementadas
                    </h4>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <ul className="space-y-1 text-sm">
                        {fase.protecoes.map((item, pidx) => (
                          <li key={pidx} className="text-blue-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Riscos */}
                <div>
                  <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    Riscos e Mitigações
                  </h4>
                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                    <ul className="space-y-1 text-sm">
                      {fase.riscos.map((risco, ridx) => (
                        <li key={ridx} className="text-orange-800">{risco}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Rollback */}
                <div>
                  <h4 className="font-semibold text-red-900 mb-2">🔙 Plano de Rollback</h4>
                  <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">{fase.rollback}</p>
                  </div>
                </div>

                {/* Critérios de Sucesso (se houver) */}
                {fase.sucesso && (
                  <div>
                    <h4 className="font-semibold text-green-900 mb-2">✅ Critérios de Sucesso</h4>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <ul className="space-y-1 text-sm">
                        {fase.sucesso.map((criterio, cidx) => (
                          <li key={cidx} className="text-green-800">{criterio}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Resumo Final */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">🎯 Resumo da Abordagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-green-800">
              <p>
                <strong>✅ Segurança em Primeiro Lugar:</strong> Cada fase tem backup completo e plano de rollback.
              </p>
              <p>
                <strong>🎯 Modificações Cirúrgicas:</strong> As funções críticas (enviarWhatsApp, inboundWebhook) só serão tocadas na Fase 4, com proteções robustas.
              </p>
              <p>
                <strong>🛡️ Sistema de Proteção:</strong> Flag de ativação permite ligar/desligar o pré-atendimento instantaneamente.
              </p>
              <p>
                <strong>🧪 Testes Extensivos:</strong> Cada fase é testada antes de prosseguir para a próxima.
              </p>
              <p>
                <strong>📋 Documentação Completa:</strong> Todas as mudanças documentadas e versionadas.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}