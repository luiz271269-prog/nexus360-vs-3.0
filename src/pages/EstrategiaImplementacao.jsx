import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  Shield,
  Zap,
  Brain,
  Image,
  BarChart3,
  Rocket
} from "lucide-react";

export default function EstrategiaImplementacao() {
  const [faseAtiva, setFaseAtiva] = useState("fase1");

  const fases = [
    {
      id: "fase1",
      titulo: "Estabilização e Segurança",
      semanas: "1-2",
      icone: Shield,
      cor: "text-red-600",
      bgCor: "bg-red-50",
      prioridade: "CRÍTICA",
      sprints: [
        {
          nome: "Sprint 1.1: Webhooks Seguros",
          tarefas: [
            { titulo: "Validação de origem (header secreto Evolution/Z-API)", status: "pendente" },
            { titulo: "Salvar headers HTTP completos no WebhookLog", status: "pendente" },
            { titulo: "Retornar 200 OK sempre (mesmo em erros)", status: "pendente" },
            { titulo: "Monitoramento de volume de webhooks", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 1.2: Otimização de Performance",
          tarefas: [
            { titulo: "Validar cache do MotorLembretesGlobal", status: "concluido" },
            { titulo: "Adicionar skeleton loaders no Dashboard", status: "pendente" },
            { titulo: "Implementar debounce em ações de refresh", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 1.3: Diagnóstico Z-API Completo",
          tarefas: [
            { titulo: "Persistir resultado do diagnóstico em WhatsAppIntegration", status: "pendente" },
            { titulo: "Atualizar status automaticamente", status: "pendente" },
            { titulo: "Extrair e salvar QR Code", status: "pendente" }
          ]
        }
      ]
    },
    {
      id: "fase2",
      titulo: "Processamento Multimodal",
      semanas: "3-4",
      icone: Image,
      cor: "text-purple-600",
      bgCor: "bg-purple-50",
      prioridade: "ALTA",
      sprints: [
        {
          nome: "Sprint 2.1: Persistência de Mídia",
          tarefas: [
            { titulo: "Refatorar extractMessageContent para extrair media_url, mime_type, caption", status: "pendente" },
            { titulo: "Garantir que armazenarMidia salva URL permanente em Message", status: "pendente" },
            { titulo: "Tratar timeouts e erros de download", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 2.2: Análise Multimodal",
          tarefas: [
            { titulo: "Implementar analisarMidia com InvokeLLM", status: "pendente" },
            { titulo: "Salvar resultado em Message.metadata.analise_multimodal", status: "pendente" },
            { titulo: "Criar prompts específicos por tipo de mídia", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 2.3: Integração com IA",
          tarefas: [
            { titulo: "Nexus Engine usa análise multimodal nas sugestões", status: "pendente" },
            { titulo: "Exibir insights visuais no ChatWindow", status: "pendente" },
            { titulo: "Criar casos de uso: análise de produtos, documentos", status: "pendente" }
          ]
        }
      ]
    },
    {
      id: "fase3",
      titulo: "Nexus Engine Autônomo",
      semanas: "5-6",
      icone: Brain,
      cor: "text-blue-600",
      bgCor: "bg-blue-50",
      prioridade: "ALTA",
      sprints: [
        {
          nome: "Sprint 3.1: Disparo Automático da IA",
          tarefas: [
            { titulo: "Após salvar Message, disparar processarComIAAsync", status: "pendente" },
            { titulo: "Nexus Engine analisa contexto (cliente, orçamento, histórico)", status: "pendente" },
            { titulo: "Gerar sugestões de resposta contextualizadas", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 3.2: Modo Autônomo no ChatWindow",
          tarefas: [
            { titulo: "Integrar MotorRaciocinio no NexusChat", status: "pendente" },
            { titulo: "Toggle 'Modo Autônomo' na UI", status: "pendente" },
            { titulo: "Executar tarefas complexas em múltiplos passos", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 3.3: Feedback Loop de Aprendizado",
          tarefas: [
            { titulo: "Capturar feedback automático (vendedor usou sugestão?)", status: "pendente" },
            { titulo: "Salvar em AprendizadoIA", status: "pendente" },
            { titulo: "Motor de auto-otimização ajusta prompts", status: "pendente" }
          ]
        }
      ]
    },
    {
      id: "fase4",
      titulo: "Teletransporte Contextual",
      semanas: "7",
      icone: Zap,
      cor: "text-amber-600",
      bgCor: "bg-amber-50",
      prioridade: "MÉDIA-ALTA",
      sprints: [
        {
          nome: "Sprint 4.1: Badge Flutuante 'Modo Orçamento Ativo'",
          tarefas: [
            { titulo: "Criar componente BadgeOrcamentoAtivo no ChatWindow", status: "pendente" },
            { titulo: "Exibir dados do orçamento (valor, status, prazo)", status: "pendente" },
            { titulo: "Botão 'Sair do Modo Orçamento'", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 4.2: Painel de Contexto Lateral",
          tarefas: [
            { titulo: "Histórico de interações relacionadas ao orçamento", status: "pendente" },
            { titulo: "Score preditivo de fechamento", status: "pendente" },
            { titulo: "Timeline de ações do cliente", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 4.3: Sugestões Contextuais da IA",
          tarefas: [
            { titulo: "IA sugere ações baseadas no status do orçamento", status: "pendente" },
            { titulo: "Ex: 'Enviado' → 'Pergunte se recebeu'", status: "pendente" },
            { titulo: "Ex: 'Negociando' → 'Ofereça condição especial'", status: "pendente" }
          ]
        }
      ]
    },
    {
      id: "fase5",
      titulo: "Observabilidade e Escala",
      semanas: "8+",
      icone: BarChart3,
      cor: "text-green-600",
      bgCor: "bg-green-50",
      prioridade: "MÉDIA",
      sprints: [
        {
          nome: "Sprint 5.1: Dashboards de IA",
          tarefas: [
            { titulo: "Painel de performance da IA (taxa de uso, acurácia)", status: "pendente" },
            { titulo: "Alertas para anomalias (volume baixo, erros frequentes)", status: "pendente" },
            { titulo: "Métricas de aprendizado (evolução dos modelos)", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 5.2: Versionamento de Prompts",
          tarefas: [
            { titulo: "Criar entidade PromptTemplate", status: "pendente" },
            { titulo: "A/B testing de prompts", status: "pendente" },
            { titulo: "Histórico de versões e performance", status: "pendente" }
          ]
        },
        {
          nome: "Sprint 5.3: Escalabilidade",
          tarefas: [
            { titulo: "Implementar fila de processamento (Redis/Bull)", status: "pendente" },
            { titulo: "Load balancing para workers", status: "pendente" },
            { titulo: "Cache distribuído", status: "pendente" }
          ]
        }
      ]
    }
  ];

  const modulos = [
    {
      nome: "Dashboard e Performance",
      fortes: [
        "React Query implementado com cache inteligente",
        "Componentes modularizados",
        "Filtros avançados por período, vendedor, segmento",
        "Motor de Lembretes Global com cache"
      ],
      fracos: [
        "Rate Limit frequente devido a chamadas simultâneas",
        "Cache insuficiente no MotorLembretesGlobal",
        "Falta de debounce em ações de refresh"
      ],
      impacto: { performance: "alta", ux: "media", prioridade: "critica" }
    },
    {
      nome: "Teletransporte Contextual",
      fortes: [
        "Conceito inovador de navegação contextual",
        "Parâmetros URL para passar contexto",
        "Busca/criação automática de contatos e threads"
      ],
      fracos: [
        "Falta feedback visual de que o modo orçamento está ativo",
        "IA não recebe contexto do orçamento automaticamente",
        "Ausência de sugestões contextuais da IA"
      ],
      impacto: { performance: "alta", ux: "alta", prioridade: "alta" }
    },
    {
      nome: "Webhooks e Processamento",
      fortes: [
        "Resposta imediata (200 OK) para evitar retries",
        "Persistência robusta em WebhookLog",
        "Filtro de ruído (ignora eventos irrelevantes)",
        "Handlers modulares por provedor"
      ],
      fracos: [
        "Falta validação de origem (token secreto, signature)",
        "Não salva headers HTTP completos",
        "Não dispara IA automaticamente após salvar mensagem",
        "Mídia não é persistida de forma permanente"
      ],
      impacto: { performance: "critica", ux: "alta", prioridade: "critica" }
    },
    {
      nome: "Nexus Engine - IA",
      fortes: [
        "Conceito de agente multiagente bem definido",
        "Camadas claras: Percepção → Processamento → Núcleo IA",
        "MotorRaciocinio para planejamento multi-passos",
        "Base de Conhecimento para RAG"
      ],
      fracos: [
        "Nexus Engine não é invocado automaticamente após mensagens",
        "Falta integração entre camadas",
        "Sem feedback loop explícito de aprendizado",
        "RAG não está indexado com embeddings"
      ],
      impacto: { performance: "alta", ux: "alta", prioridade: "alta" }
    }
  ];

  const kpis = [
    {
      categoria: "Performance",
      metricas: [
        { nome: "Rate Limit", meta: "< 5 erros/dia", atual: "15 erros/dia", status: "ruim" },
        { nome: "Tempo de resposta webhook", meta: "< 500ms", atual: "350ms", status: "bom" },
        { nome: "Uptime", meta: "> 99.5%", atual: "98.2%", status: "medio" }
      ]
    },
    {
      categoria: "IA",
      metricas: [
        { nome: "Taxa de uso de sugestões", meta: "> 60%", atual: "N/A", status: "pendente" },
        { nome: "Acurácia de análise multimodal", meta: "> 85%", atual: "N/A", status: "pendente" },
        { nome: "Taxa de resolução autônoma", meta: "> 40%", atual: "N/A", status: "pendente" }
      ]
    },
    {
      categoria: "UX",
      metricas: [
        { nome: "Tempo de follow-up", meta: "Redução de 60%", atual: "N/A", status: "pendente" },
        { nome: "NPS dos vendedores", meta: "> 8/10", atual: "N/A", status: "pendente" },
        { nome: "Adoção do teletransporte", meta: "> 70%", atual: "N/A", status: "pendente" }
      ]
    }
  ];

  const StatusIcon = ({ status }) => {
    if (status === "concluido") return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === "pendente") return <Clock className="w-4 h-4 text-gray-400" />;
    return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  };

  const PrioridadeBadge = ({ prioridade }) => {
    const cores = {
      "CRÍTICA": "bg-red-100 text-red-700",
      "ALTA": "bg-orange-100 text-orange-700",
      "MÉDIA-ALTA": "bg-amber-100 text-amber-700",
      "MÉDIA": "bg-blue-100 text-blue-700"
    };
    return <Badge className={cores[prioridade] || "bg-gray-100 text-gray-700"}>{prioridade}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Rocket className="w-8 h-8 text-indigo-600" />
              Estratégia de Implementação
            </h1>
            <p className="text-gray-600 mt-2">Roadmap completo para evolução do VendaPro Pro</p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 text-sm px-4 py-2">
            Versão 1.0 - Janeiro 2025
          </Badge>
        </div>

        {/* Tabs Principais */}
        <Tabs defaultValue="roadmap" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 gap-4">
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            <TabsTrigger value="analise">Análise de Módulos</TabsTrigger>
            <TabsTrigger value="kpis">KPIs e Métricas</TabsTrigger>
            <TabsTrigger value="riscos">Riscos</TabsTrigger>
          </TabsList>

          {/* Tab: Roadmap */}
          <TabsContent value="roadmap" className="space-y-6">
            {/* Visão Geral das Fases */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {fases.map((fase, idx) => {
                const Icone = fase.icone;
                return (
                  <Card
                    key={fase.id}
                    className={`cursor-pointer transition-all ${
                      faseAtiva === fase.id ? "ring-2 ring-indigo-600 shadow-lg" : "hover:shadow-md"
                    }`}
                    onClick={() => setFaseAtiva(fase.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icone className={`w-5 h-5 ${fase.cor}`} />
                        <span className="font-semibold text-sm">Fase {idx + 1}</span>
                      </div>
                      <h3 className="font-medium text-sm mb-2">{fase.titulo}</h3>
                      <p className="text-xs text-gray-600 mb-2">Semanas {fase.semanas}</p>
                      <PrioridadeBadge prioridade={fase.prioridade} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Detalhes da Fase Ativa */}
            {fases.map((fase) => {
              if (faseAtiva !== fase.id) return null;
              const Icone = fase.icone;
              
              return (
                <Card key={fase.id} className={fase.bgCor}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Icone className={`w-6 h-6 ${fase.cor}`} />
                      {fase.titulo}
                      <PrioridadeBadge prioridade={fase.prioridade} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {fase.sprints.map((sprint, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-3">{sprint.nome}</h4>
                        <div className="space-y-2">
                          {sprint.tarefas.map((tarefa, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-3 text-sm">
                              <StatusIcon status={tarefa.status} />
                              <span className={tarefa.status === "concluido" ? "line-through text-gray-500" : ""}>
                                {tarefa.titulo}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* Tab: Análise de Módulos */}
          <TabsContent value="analise" className="space-y-4">
            {modulos.map((modulo, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle>{modulo.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Pontos Fortes
                    </h4>
                    <ul className="space-y-1">
                      {modulo.fortes.map((ponto, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          {ponto}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Pontos Fracos
                    </h4>
                    <ul className="space-y-1">
                      {modulo.fracos.map((ponto, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-red-600">✗</span>
                          {ponto}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <Badge variant="outline">Performance: {modulo.impacto.performance}</Badge>
                    <Badge variant="outline">UX: {modulo.impacto.ux}</Badge>
                    <PrioridadeBadge prioridade={modulo.impacto.prioridade.toUpperCase()} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Tab: KPIs */}
          <TabsContent value="kpis" className="space-y-4">
            {kpis.map((categoria, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" />
                    {categoria.categoria}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoria.metricas.map((metrica, mIdx) => (
                      <div key={mIdx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{metrica.nome}</p>
                          <p className="text-xs text-gray-600">Meta: {metrica.meta}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{metrica.atual}</p>
                          <Badge
                            className={
                              metrica.status === "bom"
                                ? "bg-green-100 text-green-700"
                                : metrica.status === "medio"
                                ? "bg-amber-100 text-amber-700"
                                : metrica.status === "ruim"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {metrica.status === "pendente" ? "Não implementado" : metrica.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Tab: Riscos */}
          <TabsContent value="riscos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Riscos Identificados e Mitigações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    risco: "Rate Limit Persistente",
                    mitigacao: "Cache agressivo + fila de processamento",
                    prioridade: "CRÍTICA"
                  },
                  {
                    risco: "Qualidade da IA",
                    mitigacao: "Prompts versionados + feedback loop + A/B testing",
                    prioridade: "ALTA"
                  },
                  {
                    risco: "Complexidade de Integração",
                    mitigacao: "Testes automatizados + documentação detalhada",
                    prioridade: "MÉDIA"
                  },
                  {
                    risco: "Escalabilidade",
                    mitigacao: "Arquitetura serverless + workers assíncronos",
                    prioridade: "MÉDIA"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-amber-900">{item.risco}</h4>
                      <PrioridadeBadge prioridade={item.prioridade} />
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Mitigação:</span> {item.mitigacao}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Próximo Passo */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Target className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Próximo Passo Recomendado</h3>
                <p className="text-gray-700 mb-4">
                  Iniciar <strong>Sprint 1.1: Webhooks Seguros</strong> da Fase 1 (Estabilização e Segurança).
                </p>
                <div className="bg-white rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-sm text-gray-900">Tarefas prioritárias:</p>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                      Validação de origem (header secreto Evolution/Z-API)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                      Salvar headers HTTP completos no WebhookLog
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                      Retornar 200 OK sempre (mesmo em erros)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}