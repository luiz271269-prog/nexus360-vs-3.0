# 🎛️ O AGENT ORCHESTRATOR COMO CONTROL PLANE CENTRAL

## Paralelismo Arquitetural: Nexus AI ⟷ Clawbot

---

## 📐 PRINCÍPIO ESTRUTURAL COMUM

A arquitetura do **Agent Orchestrator** do Nexus AI aplica o mesmo princípio estrutural observado em agentes modernos como o Clawbot: a existência de um **control plane central** responsável por coordenar decisões, execuções e governança. Nesse modelo, a inteligência não reside na interface do usuário nem em módulos isolados, mas em uma camada intermediária robusta que recebe eventos, interpreta contexto, decide ações e registra auditoria.

Assim como o gateway do Clawbot orquestra canais e skills, o Agent Orchestrator do Nexus AI centraliza a lógica de decisão sobre a pilha Base44/Nexus. Ele recebe eventos de múltiplas origens (webhooks, automações, NexusChat, jobs agendados), seleciona playbooks, executa tools desacopladas e aplica guardrails (permissões, visibilidade, anti-spam, aprovação humana), mantendo trilha completa via `AgentRun` e `AgentDecisionLog`.

---

## 🔄 DIFERENÇA FUNDAMENTAL: CONTEXTO vs ARQUITETURA

### **Clawbot:**
- **Domínio:** Automação pessoal / desktop local-first
- **Usuários:** Indivíduo (uso pessoal)
- **Dados:** Arquivos locais, APIs pessoais
- **Governança:** Guardrails opcionais (usuário tem controle total)

### **Nexus AI:**
- **Domínio:** Operações de negócio / CRM corporativo
- **Usuários:** Multi-usuário (equipe de vendas/suporte)
- **Dados:** Base de clientes, threads, orçamentos, mensagens
- **Governança:** Guardrails obrigatórios (compliance, permissões, auditoria)

**Conclusão:**  
A diferença fundamental está no **domínio e no escopo**, não na arquitetura. Enquanto o Clawbot opera como um control plane genérico para automação pessoal ou local-first, o Nexus AI implementa esse mesmo padrão sobre um ambiente corporativo, multi-usuário e multi-canal, profundamente integrado ao modelo de dados, regras de negócio e governança do Nexus.

Dessa forma, **NexusChat** e **JarvisControl** tornam-se apenas **interfaces de comando e observabilidade**, e não centros de decisão, preservando a autonomia do agente de forma consistente, auditável e independente de UI.

---

## 📊 DIAGRAMA DO FLUXO DE CONTROLE

```
┌─────────────────────────────────────────────────────────┐
│         CAMADA DE ENTRADA (Eventos / UI / Jobs)        │
│                                                          │
│  • message.inbound (WhatsApp, Instagram, Chat)          │
│  • thread.idle (> 30min sem resposta)                   │
│  • orcamento.stale (> 7 dias sem movimento)             │
│  • ui.command (NexusChat, JarvisControl)                │
│  • scheduled.tick (jarvisEventLoop a cada 5min)         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│          AGENT ORCHESTRATOR (Control Plane)             │
│         agentCommand + agentOrchestrator                │
│                                                          │
│  ✅ Autentica usuário (base44.auth.me)                  │
│  ✅ Carrega contexto (thread, contact, cliente, user)   │
│  ✅ Seleciona playbook (baseado em evento + contexto)   │
│  ✅ Aplica guardrails (whitelist, rate limit, perms)    │
│  ✅ Cria AgentRun (auditoria inicia)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              PLAYBOOKS (Lógica de Negócio)              │
│                                                          │
│  • Playbook 01: Link Intelligence                       │
│    (URL detectada → scrape → insights → sugestão)       │
│                                                          │
│  • Playbook 02: Follow-up Automático                    │
│    (Thread parada → criar lembrete/tarefa)              │
│                                                          │
│  • Playbook 03: Lead Qualification                      │
│    (Cliente novo → scoring → atribuir vendedor)         │
│                                                          │
│  • Playbook 04: Smart Routing                           │
│    (Mensagem → classificar → rotear para setor)         │
│                                                          │
│  • Playbook 05: Chat Response                           │
│    (Pergunta NexusChat → contexto → resposta LLM)       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   TOOLS (Execução)                      │
│                                                          │
│  🔧 firecrawlService    (scraping + cache + whitelist)  │
│  🔧 InvokeLLM           (geração de texto contextual)    │
│  🔧 SendEmail           (envio de emails)                │
│  🔧 RAG                 (busca vetorial conhecimento)    │
│  🔧 IntentClassifier    (classificação de intenção)      │
│  🔧 ScoreCalculator     (scoring de leads/clientes)      │
│  🔧 TaskCreator         (criação de TarefaInteligente)   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           AUDITORIA / MEMÓRIA (Persistência)            │
│                                                          │
│  📝 AgentRun             (1 registro por execução)       │
│  📝 AgentDecisionLog     (detalhes de cada decisão)      │
│  📝 ThreadContext        (memória operacional thread)    │
│  📝 ExternalSourceCache  (cache de scraping 7 dias)     │
│  📝 TarefaInteligente    (ações criadas pelo agente)     │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ GARANTIAS DO CONTROL PLANE CENTRAL

Este padrão garante que **toda ação do agente** seja:

### **1. Rastreável (Auditoria Completa)**
- ✅ Quem disparou (user_id ou "system")
- ✅ Quando (timestamps precisos)
- ✅ O quê (playbook, tools usadas, dados)
- ✅ Por quê (decisao_tomada, confianca_ia)
- ✅ Resultado (sucesso/falha/bloqueio)

### **2. Governada (Guardrails Obrigatórios)**
- ✅ Autenticação verificada antes de qualquer ação
- ✅ Permissões do usuário checadas (setor, role, level)
- ✅ Whitelist de domínios (Firecrawl)
- ✅ Rate limiting (evita spam)
- ✅ Timeout protection (30s máximo)
- ✅ Modo de operação (assistente/parcial/forte)

### **3. Observável (Visibilidade em Tempo Real)**
- ✅ JarvisControl mostra todas as execuções (AgentRun)
- ✅ Dashboard de decisões (AgentDecisionLog)
- ✅ Métricas operacionais (taxa de sucesso, duração média)
- ✅ Agent Session State (online/degraded/offline)
- ✅ Badge dinâmico no Layout (ON/OFF/SLOW/[N])

### **4. Independente de UI (Backend-First)**
- ✅ Agente roda via jarvisEventLoop (scheduled a cada 5min)
- ✅ Não depende de NexusChat estar aberto
- ✅ Não depende de Comunicação estar ativa
- ✅ Processa eventos mesmo sem interação humana
- ✅ Garante continuidade operacional 24/7

---

## 🎯 IMPLICAÇÕES PRÁTICAS

### **Para Desenvolvedores:**
- **UI nunca chama LLM direto** → sempre passa por `agentCommand`
- **Novos playbooks = adicionar à camada de Playbooks** → sem reescrever UI
- **Novas tools = adicionar à camada de Tools** → disponível para todos os playbooks
- **Debugging = olhar JarvisControl** → não precisa ler logs do backend

### **Para Usuários (Atendentes/Gerentes):**
- **NexusChat é a interface conversacional** → faz perguntas, recebe sugestões
- **JarvisControl é a interface operacional** → monitora o que o agente está fazendo
- **Comunicação é independente** → agente enriquece threads, mas não as controla

### **Para o Negócio:**
- **Compliance-ready** → toda ação auditável (LGPD, ISO)
- **Escalável** → adicionar playbooks não impacta performance
- **Confiável** → guardrails garantem que agente não "sai do trilho"
- **Mensurável** → ROI calculável (tempo economizado, conversões, etc.)

---

## 📚 COMPARATIVO FINAL: CLAWBOT vs NEXUS AI

| Aspecto | Clawbot | Nexus AI |
|---------|---------|----------|
| **Arquitetura** | Control plane central | Control plane central ✅ |
| **Usuários** | Individual (desktop) | Multi-usuário (web/mobile) |
| **Dados** | Local-first | Cloud-first (Base44) |
| **Domínio** | Automação pessoal | CRM/Comunicação empresarial |
| **Governança** | Opcional (usuário controla) | Obrigatória (compliance) |
| **Auditoria** | Básica (logs locais) | Completa (AgentRun + DecisionLog) |
| **Observabilidade** | Terminal/logs | JarvisControl (dashboard web) |
| **Guardrails** | Opcionais | Obrigatórios |
| **Independência UI** | ✅ Desktop app | ✅ Backend-first |
| **Autonomia** | ✅ Forte (usuário decide) | ✅ Fases (assistente → parcial → forte) |

**Conclusão:**  
Nexus AI = **Clawbot para empresas**  
Mesma arquitetura de autonomia, contexto corporativo diferente.

---

## 🚀 PRÓXIMOS PASSOS

### **Curto Prazo (Esta Semana):**
1. ✅ Control plane implementado (agentCommand + agentOrchestrator)
2. ✅ Auditoria implementada (AgentRun + AgentDecisionLog)
3. ✅ UI desacoplada (NexusChat + JarvisControl)
4. 🟡 Integrar webhook → agentOrchestrator (Playbook 01)
5. 🟡 Testar com URLs reais (MercadoLivre, Amazon)

### **Médio Prazo (Próximas 2 Semanas):**
1. ⚪ Migrar NexusEngine → Playbook 05 "Chat Response"
2. ⚪ Migrar QualificadorAutomatico → Playbook 03 "Lead Qualification"
3. ⚪ Migrar RoteamentoInteligente → Playbook 04 "Smart Routing"
4. ⚪ Integrar MotorRAGV3 como tool

### **Longo Prazo (Próximos 3 Meses):**
1. ⚪ Fase 2: Autonomia Parcial (ações de baixo risco)
2. ⚪ Dashboard de ROI (tempo economizado, conversões)
3. ⚪ Aprendizado contínuo (feedback loop)
4. ⚪ Auto-otimização de playbooks

---

## 📖 REFERÊNCIAS CRUZADAS

- **Visão Produto:** `PROJETO_AGENTE_AUTONOMO_NEXUS.md`
- **Visão Engenharia:** `ARQUITETURA_UNIFICADA.md`
- **Comparativo Mercado:** `COMPARACAO_MERCADO_CLAWBOT.md`
- **Spec Playbook 01:** `SPEC_PLAYBOOK_01_LINK_INTELLIGENCE.md`
- **Análise Layout:** `ANALISE_LAYOUT_BEST_PRACTICES.md`

---

**Documento de referência - última atualização: 31/01/2026**  
**Status:** ✅ Control plane implementado e operacional