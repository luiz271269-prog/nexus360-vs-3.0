# 🎯 PLANO DE EXECUÇÃO DEFINITIVO: MOTOR DE AUTOMAÇÕES NEXUS360

**Data:** 2026-01-19  
**Objetivo:** Consolidar TODOS os debates em um roadmap executável - da teoria ao código.

---

## 📖 **SÍNTESE DOS 3 ESTUDOS**

### **ESTUDO 1: DEBATE URA vs IMPLEMENTADO**
- ✅ FlowTemplate existe (schema parcial)
- ❌ FluxoController v10 é 100% hardcoded
- ❌ Falta interface admin "Meus Playbooks"
- **Conclusão:** 40% do caminho - falta executor genérico + UI

### **ESTUDO 2: ESTRATÉGIA CONTEXT-AWARE**
- ✅ Tipos de contato (novo, lead, cliente, fornecedor)
- ✅ Etiquetas (vip, inadimplente, nao_ura)
- ✅ Motor de resolução (filtra por tipo + tags + prioridade)
- **Conclusão:** URA precisa ser inteligente sobre quem está chamando

### **ESTUDO 3: ARQUITETURA COMPLETA**
- ✅ 3 camadas (entrada → orquestração → execução)
- ✅ 5 abas (URA, Playbooks, Promoções, Respostas, Dashboard)
- ✅ Motores especializados por tipo
- **Conclusão:** Biblioteca de Automações = hub central

---

## 🏗️ **ARQUITETURA UNIFICADA: 4 CAMADAS**

```
┌─────────────────────────────────────────────────────────────────┐
│ CAMADA 0: INTERFACE (Biblioteca de Automações)                  │
│ ═══════════════════════════════════════════════════════════════ │
│ pages/Automacoes.jsx                                             │
│ ├─ ABA 1: URAs Pré-Atendimento (PlaybookManagerURA)            │
│ ├─ ABA 2: Playbooks Genéricos (PlaybookManager)                │
│ ├─ ABA 3: Promoções & Ofertas (GerenciadorPromocoes)           │
│ ├─ ABA 4: Respostas Rápidas (QuickRepliesManager)              │
│ └─ ABA 5: Dashboard (DashboardAutomacoes)                       │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ (Admin cria/edita FlowTemplate)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAMADA 1: ENTRADA (Webhooks Multi-Canal)                        │
│ ═══════════════════════════════════════════════════════════════ │
│ webhookWapi.js ──┐                                              │
│ webhookZapi.js ──┼──> Normalizar Payload                        │
│ instagramWeb.js ─┤                                              │
│ facebookWeb.js ──┤                                              │
│ gotoWebhook.js ──┘                                              │
│                                                                  │
│ Saída: { contact, thread, message, integration, provider }      │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAMADA 2: ORQUESTRAÇÃO CENTRAL (inboundCore)                    │
│ ═══════════════════════════════════════════════════════════════ │
│ functions/lib/inboundCore.js                                     │
│                                                                  │
│ FLUXO DE DECISÃO (Prioridade):                                  │
│                                                                  │
│ 1️⃣ Verificar Promoção Inbound (6h)                              │
│    └─ Cooldown >= 6h? → runPromotionInboundTick                │
│                                                                  │
│ 2️⃣ Verificar Bypass URA                                         │
│    ├─ motorDecisaoPreAtendimento(thread, contact)               │
│    ├─ Fora de horário? → Playbook "Fora Horário"               │
│    ├─ Fidelizado? → Direto atendente                           │
│    ├─ Tag "nao_ura"? → Pular URA                               │
│    └─ Continuidade 24h? → Perguntar                            │
│                                                                  │
│ 3️⃣ Resolver Playbook (Context-Aware)                            │
│    └─ resolverPlaybookParaMensagem(contact, thread, integration)│
│       ├─ Filtra por tipo_contato                                │
│       ├─ Filtra por tags_obrigatorias/bloqueadas                │
│       ├─ Filtra por conexoes_permitidas                         │
│       ├─ Filtra por horário comercial                           │
│       └─ Desempate por prioridade + especificidade              │
│                                                                  │
│ 4️⃣ Rotear para Motor Correto                                    │
│    ├─ tipo_fluxo = "pre_atendimento" → preAtendimentoHandler   │
│    ├─ tipo_fluxo = "follow_up_*" → playbookEngine              │
│    ├─ tipo_fluxo = "bot_*" → playbookEngine                    │
│    └─ Nenhum? → Fluxo normal (humano)                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAMADA 3: EXECUÇÃO (Motores Especializados)                     │
│ ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ MOTOR A: FluxoControllerV11 (URA Pré-Atendimento)        │   │
│ │ ──────────────────────────────────────────────────────── │   │
│ │ Entrada: playbook + thread + contact + userInput         │   │
│ │                                                           │   │
│ │ 1. Verificar TTL (COMPLETED → INIT?)                     │   │
│ │ 2. Carregar estado atual (playbook.estados[])            │   │
│ │ 3. Renderizar mensagem (template + variáveis)            │   │
│ │ 4. Avaliar transições:                                   │   │
│ │    ├─ IA Fast-Track (confiança >= limiar)               │   │
│ │    ├─ Sticky Memory (retornar setor anterior)           │   │
│ │    ├─ Guardian Mode (atendente ausente)                 │   │
│ │    ├─ Botão clicado (opcoes[])                          │   │
│ │    └─ Timeout (config_global.timeout_padrao)            │   │
│ │ 5. Executar ações:                                       │   │
│ │    ├─ setar_sector_id                                   │   │
│ │    ├─ atribuir_atendente (roteamento)                   │   │
│ │    ├─ entrar_fila                                       │   │
│ │    └─ enviar_mensagem                                   │   │
│ │ 6. Atualizar thread.pre_atendimento_state               │   │
│ │ 7. Registrar métricas (playbook.metricas_playbook)      │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ MOTOR B: PlaybookEngine (Genérico)                       │   │
│ │ ──────────────────────────────────────────────────────── │   │
│ │ Tipos suportados:                                        │   │
│ │ - follow_up_vendas (nurturing 24h/3d/7d)                │   │
│ │ - bot_qualificacao (coletar dados + score)              │   │
│ │ - bot_suporte (FAQ automatizado)                        │   │
│ │                                                           │   │
│ │ 1. Buscar/Criar FlowExecution                            │   │
│ │ 2. Executar step atual (message/delay/action)            │   │
│ │ 3. Se delay → agendar next_action_at                     │   │
│ │ 4. Se end → marcar status = 'concluido'                  │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ MOTOR C: PromotionEngine                                 │   │
│ │ ──────────────────────────────────────────────────────── │   │
│ │ Tipos:                                                    │   │
│ │ - Inbound (6h após mensagem)                             │   │
│ │ - Batch (24h base ativa)                                 │   │
│ │                                                           │   │
│ │ 1. Filtrar contatos por cooldown universal (12h)         │   │
│ │ 2. Aplicar regras segmentacao (tags/tipo/score)          │   │
│ │ 3. Enviar promoção (rotação de templates)                │   │
│ │ 4. Atualizar contadores (promocoes_recebidas)            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ MOTOR D: QuickRepliesManager                             │   │
│ │ ──────────────────────────────────────────────────────── │   │
│ │ 1. Buscar resposta por atalho/categoria                  │   │
│ │ 2. Substituir variáveis ({{nome}}, {{empresa}})          │   │
│ │ 3. Retornar texto renderizado                            │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ **LINHA LÓGICA COMPLETA: EXEMPLO REAL**

### **CENÁRIO: Cliente João (tipo: "cliente", tags: ["inadimplente"])**

```
┌─────────────────────────────────────────────────────────────┐
│ T+0s: João manda "Oi" via WhatsApp                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.1s: webhookWapi.js recebe payload                       │
│ ├─ Validar signature W-API                                  │
│ ├─ Normalizar para formato padrão                           │
│ └─ Chamar processInbound(payload)                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.2s: inboundCore.js (Orquestração)                       │
│ ├─ Buscar/Criar Contact (João)                              │
│ │  └─ tipo_contato: "cliente"                               │
│ │  └─ tags: ["inadimplente"]                                │
│ ├─ Buscar/Criar MessageThread                               │
│ ├─ Salvar Message                                            │
│ └─ Analisar intenção (IA opcional)                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.3s: DECISÃO 1 - Verificar Promoção Inbound              │
│ ├─ last_inbound_at = há 8h                                  │
│ ├─ Cooldown 6h passou? ✅ SIM                               │
│ └─ ❌ BLOQUEADO: Tag "inadimplente" exclui promoções        │
│ (continua para próxima decisão)                              │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.4s: DECISÃO 2 - motorDecisaoPreAtendimento              │
│ ├─ Fidelizado? ❌ NÃO                                       │
│ ├─ Fora de horário? ❌ NÃO (14:30)                          │
│ ├─ Tag "nao_ura"? ❌ NÃO                                    │
│ └─ ✅ LIBERA para URA                                       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.5s: DECISÃO 3 - resolverPlaybookParaMensagem            │
│                                                              │
│ Playbooks Avaliados:                                         │
│                                                              │
│ 1️⃣ "URA Vendas Padrão" (prioridade 10)                      │
│    ├─ tipos_permitidos: ["novo", "lead", "cliente"] ✅      │
│    ├─ tags_bloqueadas: ["vip", "inadimplente"] ❌           │
│    └─ BLOQUEADO (tem tag bloqueada)                         │
│                                                              │
│ 2️⃣ "URA Cobrança" (prioridade 50)                           │
│    ├─ tags_obrigatorias: ["inadimplente"] ✅                │
│    ├─ setores_permitidos: ["financeiro"] ✅                 │
│    └─ ✅ APROVADO                                           │
│                                                              │
│ 🏆 ESCOLHIDO: "URA Cobrança" (maior prioridade)             │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.6s: ROTA PARA EXECUTOR                                   │
│ ├─ playbook.tipo_fluxo = "pre_atendimento"                  │
│ └─ Chamar → preAtendimentoHandler(playbook, thread, ...)    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.7s: preAtendimentoHandler (Orquestrador)                 │
│ ├─ Verificar TTL (COMPLETED há < 24h?)                      │
│ │  └─ ❌ Primeira vez (thread.state = null → INIT)          │
│ ├─ Carregar playbook "URA Cobrança"                         │
│ └─ Instanciar FluxoControllerV11(playbook)                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+0.8s: FluxoControllerV11.processarEstado("INIT")          │
│                                                              │
│ Estado INIT (do playbook "URA Cobrança"):                    │
│ ├─ mensagem_template: "Olá {nome}! Detectamos uma          │
│ │   pendência financeira. Te direciono para Financeiro."    │
│ ├─ tipo_entrada: "skip" (sem interação)                     │
│ └─ transicoes[0]:                                            │
│    ├─ condicao: { tipo: "system" }                          │
│    ├─ acoes_pre_transicao:                                  │
│    │  └─ { tipo: "setar_sector_id", valor: "financeiro" }  │
│    └─ proximo_estado: "WAITING_ATTENDANT_CHOICE"            │
│                                                              │
│ EXECUÇÃO:                                                    │
│ 1. Renderizar: "Olá João! Detectamos..."                    │
│ 2. Enviar mensagem (enviarMensagemUnificada)                │
│ 3. Executar ação: thread.sector_id = "financeiro"           │
│ 4. Atualizar: thread.pre_atendimento_state = "WAITING_*"   │
│ 5. Chamar: roteamentoInteligente(setor: "financeiro")       │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+1.2s: roteamentoInteligente                                │
│ ├─ Buscar atendentes disponíveis (setor: financeiro)        │
│ ├─ Score de alocação (carga, performance)                   │
│ └─ Atribuir: thread.assigned_user_id = "maria@..."          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ T+1.5s: ESTADO FINAL                                         │
│ ├─ João vê: "Olá João! Detectamos uma pendência..."         │
│ ├─ Thread marcada: sector_id = "financeiro"                 │
│ ├─ Thread atribuída: assigned_user_id = "maria@..."         │
│ ├─ Maria (atendente) recebe notificação                     │
│ └─ Métrica registrada: playbook.metricas.total_execucoes++ │
└─────────────────────────────────────────────────────────────┘
```

**TEMPO TOTAL:** ~1.5 segundos (webhook → atendente atribuído)

---

## 📊 **MATRIZ DE GATILHOS: QUANDO CADA MOTOR AGE**

| Motor | Tipo Automação | Gatilho | Frequência | Exemplo |
|-------|---------------|---------|-----------|---------|
| **FluxoControllerV11** | Playbook URA | Mensagem inbound + regras_ativacao | Tempo real | Cliente → URA Cobrança |
| **PlaybookEngine** | Playbook genérico | Palavra-chave / Evento | Tempo real / Agendado | "catálogo" → Bot Catálogo |
| **PromotionEngine Inbound** | Promoção reativa | 6h sem mensagem | Webhook (verificação) | Cliente inativo 6h → Oferta |
| **PromotionEngine Batch** | Promoção agendada | Cron 24h | Agendamento | Base ativa 36h → Promo |
| **QuickRepliesManager** | Resposta rápida | Atendente clica | Manual | Atendente → "Obrigado pelo contato" |
| **executarProximaAcao** | Follow-Up | FlowExecution.next_action_at | Agendamento | 3 dias após → "Ainda interessado?" |

---

## 🎨 **INTEGRAÇÃO COM LAYOUT: ADICIONAR ABA "AUTOMAÇÕES"**

### **MUDANÇA 1: Adicionar Item ao Menu**

**Arquivo:** `layout.js` (linha ~85)

```javascript
const todosMenuItems = [
  { name: "Central de Comunicacao", icon: MessageSquare, page: "Comunicacao" },
  { name: "Dashboard", icon: Home, page: "Dashboard" },
  { name: "Metas de Vendas", icon: Users, page: "Vendedores" },
  { name: "Leads & Qualificacao", icon: Target, page: "LeadsQualificados" },
  { name: "Clientes", icon: Building2, page: "Clientes" },
  { name: "Produtos", icon: Package, page: "Produtos" },
  
  // 🆕 BIBLIOTECA DE AUTOMAÇÕES
  { name: "Automações", icon: Workflow, page: "Automacoes" },
  
  { name: "Agenda Inteligente", icon: Calendar, page: "Agenda" },
  { name: "Importação", icon: Upload, page: "Importacao" },
  { name: "Gerenciamento de Usuários", icon: UserCog, page: "Usuarios" },
  { name: "Auditoria", icon: Shield, page: "Auditoria" }
];
```

### **MUDANÇA 2: Controle de Acesso por Perfil**

**Dentro de `getMenuItemsParaPerfil(usuario):`**

```javascript
// Administrador - acesso total
if (role === 'admin') {
  return todosMenuItems; // ✅ Inclui "Automações"
}

// Gerência (coordenador/gerente)
if (['coordenador', 'gerente'].includes(nivelAtendente)) {
  // Gerente de QUALQUER setor pode acessar automações
  return todosMenuItems.filter(item => [
    'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Vendedores', 
    'Clientes', 'Produtos', 'Agenda', 
    'Automacoes' // ✅ Gerente edita playbooks/promoções
  ].includes(item.page));
}

// Supervisor (senior)
if (nivelAtendente === 'senior') {
  // Senior NÃO edita automações (só visualiza execuções)
  return todosMenuItems.filter(item => [
    'Comunicacao', 'LeadsQualificados', 'Clientes', 
    'Agenda', 'Dashboard', 'Produtos'
    // ❌ Sem "Automacoes"
  ].includes(item.page));
}
```

---

## 📂 **ESTRUTURA DE ARQUIVOS DEFINITIVA**

```
📂 PROJECT ROOT
│
├─ 📂 entities/
│  ├─ FlowTemplate.json ⭐ (Playbooks URA + Genéricos)
│  │  ├─ config_global
│  │  ├─ estados[]
│  │  ├─ regras_ativacao (tipos + tags + prioridade)
│  │  └─ metricas_playbook
│  │
│  ├─ FlowExecution.json (Estado de execução)
│  ├─ Promotion.json (Promoções)
│  ├─ QuickReply.json (Respostas Rápidas)
│  ├─ MessageThread.json (pre_atendimento_state)
│  └─ Contact.json (tipo_contato + tags)
│
├─ 📂 pages/
│  └─ Automacoes.jsx ⭐ (Página principal - 5 abas)
│
├─ 📂 components/automacao/
│  ├─ BibliotecaAutomacoes.jsx ⭐ (Container com tabs)
│  ├─ PlaybookManagerURA.jsx ⭐ (Gestão URAs)
│  ├─ PlaybookManager.jsx (Gestão genérica)
│  ├─ GerenciadorPromocoes.jsx (Promoções)
│  ├─ QuickRepliesManager.jsx (Respostas rápidas)
│  ├─ DashboardAutomacoes.jsx ⭐ (Métricas consolidadas)
│  │
│  ├─ 📁 editores/
│  │  ├─ EditorPlaybookURA.jsx ⭐ (Modal/Sidebar)
│  │  ├─ SecaoConfigGlobal.jsx (TTL, IA, sticky, guardian)
│  │  ├─ EditorEstados.jsx ⭐ (Lista estados + drag-drop)
│  │  ├─ EditorEstadoIndividual.jsx (Mensagem, botões, transições)
│  │  ├─ EditorRegrasAtivacao.jsx ⭐ (Tipos, tags, instâncias)
│  │  ├─ EditorTransicoes.jsx (Condições → Ações → Próximo)
│  │  └─ PreviewFluxoURA.jsx (Diagrama visual)
│  │
│  └─ 📁 visualizacao/
│     ├─ PlaybookCardURA.jsx (Card na lista)
│     ├─ MetricasPlaybook.jsx (Gráficos)
│     └─ ValidadorPlaybook.jsx (Verifica erros)
│
├─ 📂 functions/
│  │
│  ├─ 📁 webhooks/ (CAMADA 1: Entrada)
│  │  ├─ webhookWapi.js
│  │  ├─ webhookFinalZapi.js
│  │  ├─ instagramWebhook.js
│  │  └─ facebookWebhook.js
│  │
│  ├─ 📁 lib/ (CAMADA 2: Orquestração)
│  │  ├─ inboundCore.js ⭐ (Motor central)
│  │  ├─ resolverPlaybookParaMensagem.js ⭐ (Seletor)
│  │  └─ promotionEngine.js (Motor promoções)
│  │
│  ├─ 📁 preAtendimento/ (CAMADA 3: Executor URA)
│  │  ├─ FluxoControllerV11.js ⭐ (Executor genérico)
│  │  ├─ fluxoController.js (v10 - DEPRECAR após v11)
│  │  ├─ menuBuilder.js (v10 - DEPRECAR)
│  │  └─ buttonMappings.js (v10 - DEPRECAR)
│  │
│  ├─ preAtendimentoHandler.js ⭐ (Orquestrador URA)
│  ├─ motorDecisaoPreAtendimento.js (Bypass Layer)
│  ├─ playbookEngine.js (Executor genérico)
│  ├─ runPromotionInboundTick.js (Promoção 6h)
│  ├─ runPromotionBatchTick.js (Promoção 24h - Cron)
│  └─ executarProximaAcao.js (Follow-Up agendado - Cron)
│
└─ Layout.js ⭐ (Adicionar item "Automações")
```

**⭐ = Arquivos novos ou modificados neste plano**

---

## 🔄 **CICLO DE VIDA COMPLETO: CRIAR → EXECUTAR → MEDIR**

### **FASE 1: CRIAÇÃO (Interface Admin)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin abre pages/Automacoes.jsx                          │
│ └─ Aba "URAs Pré-Atendimento"                               │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Clica "Nova URA"                                          │
│ └─ Abre EditorPlaybookURA (modal)                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Preenche dados:                                           │
│                                                              │
│ 📝 DADOS BÁSICOS:                                            │
│    ├─ Nome: "URA Cobrança"                                  │
│    ├─ Descrição: "Para clientes inadimplentes"             │
│    └─ Categoria: "Financeiro"                               │
│                                                              │
│ 🎯 REGRAS DE ATIVAÇÃO:                                       │
│    ├─ Prioridade: 50                                         │
│    ├─ Tipos Permitidos: [cliente] (checkbox)                │
│    ├─ Tags Obrigatórias: "inadimplente" (input + chip)      │
│    └─ Setores: [financeiro] (select)                        │
│                                                              │
│ ⚙️ CONFIG GLOBAL:                                            │
│    ├─ TTL COMPLETED: 24h (slider)                           │
│    ├─ Gap Novo Ciclo: 12h (slider)                          │
│    ├─ Usar IA no INIT: OFF (toggle)                         │
│    ├─ Usar Sticky: OFF (toggle)                             │
│    └─ Usar Guardian: OFF (toggle)                           │
│                                                              │
│ 🗺️ ESTADOS:                                                  │
│    ├─ INIT                                                   │
│    │  ├─ Mensagem: "Olá {nome}! Detectamos..."             │
│    │  ├─ Tipo Entrada: "skip"                               │
│    │  └─ Transição → setar_sector_id("financeiro") → WAITING│
│    │                                                         │
│    ├─ WAITING_ATTENDANT_CHOICE                              │
│    │  ├─ Mensagem: "Conectando com atendente..."           │
│    │  ├─ Ação: atribuir_atendente (roteamento)             │
│    │  └─ Transição → COMPLETED                              │
│    │                                                         │
│    └─ COMPLETED                                              │
│       └─ Mensagem: "Transferido! Aguarde."                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Clica "Salvar"                                            │
│ └─ POST: base44.entities.FlowTemplate.create({...})         │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Playbook salvo no banco                                   │
│ ├─ ID: "pb_abc123"                                          │
│ ├─ ativo: true                                               │
│ └─ tipo_fluxo: "pre_atendimento"                            │
└─────────────────────────────────────────────────────────────┘
```

---

### **FASE 2: ATIVAÇÃO (Seletor de Playbook)**

```
┌─────────────────────────────────────────────────────────────┐
│ Cliente João manda "Oi" (tem tag: "inadimplente")           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ inboundCore chama:                                           │
│ resolverPlaybookParaMensagem(contact, thread, integration)  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Motor de Resolução:                                          │
│                                                              │
│ SELECT * FROM FlowTemplate                                   │
│ WHERE tipo_fluxo = 'pre_atendimento'                        │
│   AND ativo = true                                           │
│ ORDER BY prioridade DESC                                     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Para cada playbook:                                          │
│                                                              │
│ FILTRO 1: tipos_permitidos                                  │
│ ├─ URA Cobrança: tipos = [] (todos)                         │
│ └─ ✅ PASSA                                                 │
│                                                              │
│ FILTRO 2: tipos_bloqueados                                  │
│ ├─ URA Vendas: tipos_bloqueados = ["fornecedor"]            │
│ ├─ João.tipo_contato = "cliente"                            │
│ └─ ✅ PASSA                                                 │
│                                                              │
│ FILTRO 3: tags_obrigatorias                                 │
│ ├─ URA Cobrança: tags_obrigatorias = ["inadimplente"]       │
│ ├─ João.tags = ["inadimplente"]                             │
│ └─ ✅ PASSA (tem a tag)                                     │
│                                                              │
│ FILTRO 4: tags_bloqueadas                                   │
│ ├─ URA Vendas: tags_bloqueadas = ["inadimplente", "vip"]    │
│ ├─ João.tags = ["inadimplente"]                             │
│ └─ ❌ BLOQUEADO (tem tag bloqueada)                         │
│                                                              │
│ RESULTADO: URA Cobrança APROVADO (prioridade 50)            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Retorna: playbook = { id: "pb_abc123", nome: "URA Cobrança" }│
└─────────────────────────────────────────────────────────────┘
```

---

### **FASE 3: EXECUÇÃO (FluxoControllerV11)**

```
┌─────────────────────────────────────────────────────────────┐
│ preAtendimentoHandler recebe:                                │
│ ├─ playbook_id: "pb_abc123"                                 │
│ ├─ thread_id: "thread_xyz"                                  │
│ └─ user_input: { type: "text", content: "Oi" }             │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Verificar TTL                                             │
│ ├─ thread.pre_atendimento_state = null                      │
│ └─ ✅ Primeira execução → INIT                              │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Instanciar Executor                                       │
│ const controller = new FluxoControllerV11(playbook);        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Processar Estado INIT                                     │
│                                                              │
│ const estadoConfig = playbook.estados.find(               │
│   e => e.nome_interno === 'INIT'                            │
│ );                                                           │
│                                                              │
│ estadoConfig = {                                             │
│   nome_interno: "INIT",                                      │
│   mensagem_template: "Olá {nome}! Detectamos...",          │
│   tipo_entrada: "skip",                                      │
│   usar_ia_fast_track: false,                                │
│   transicoes: [{                                             │
│     condicao: { tipo: "system" },                           │
│     acoes_pre_transicao: [{                                 │
│       tipo: "setar_sector_id",                              │
│       parametros: { valor: "financeiro" }                   │
│     }],                                                      │
│     proximo_estado: "WAITING_ATTENDANT_CHOICE"              │
│   }]                                                         │
│ }                                                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Renderizar Mensagem                                       │
│ const msg = renderTemplate(                                  │
│   "Olá {nome}! Detectamos...",                              │
│   { nome: contact.nome }                                     │
│ );                                                           │
│ // Resultado: "Olá João! Detectamos..."                     │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Enviar Mensagem                                           │
│ await enviarMensagemUnificada(base44, {                      │
│   thread_id,                                                 │
│   content: msg,                                              │
│   integration_id                                             │
│ });                                                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Avaliar Transições                                        │
│ const transicao = estadoConfig.transicoes[0];                │
│ // condicao.tipo = "system" → sempre executa                │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Executar Ações Pré-Transição                             │
│ for (const acao of transicao.acoes_pre_transicao) {         │
│   if (acao.tipo === "setar_sector_id") {                    │
│     await base44.entities.MessageThread.update(thread_id, { │
│       sector_id: "financeiro"                                │
│     });                                                      │
│   }                                                          │
│ }                                                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Atualizar Estado                                          │
│ await base44.entities.MessageThread.update(thread_id, {     │
│   pre_atendimento_state: "WAITING_ATTENDANT_CHOICE"         │
│ });                                                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Recursão (processar próximo estado)                       │
│ return controller.processarEstado(...);                      │
│ // Vai para WAITING_ATTENDANT_CHOICE → chama roteamento     │
└─────────────────────────────────────────────────────────────┘
```

---

### **FASE 4: MEDIÇÃO (Métricas Automáticas)**

```
┌─────────────────────────────────────────────────────────────┐
│ Ao final da execução (estado = COMPLETED):                  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Atualizar FlowTemplate.metricas_playbook:                    │
│                                                              │
│ await base44.entities.FlowTemplate.update(playbook_id, {    │
│   metricas_playbook: {                                       │
│     total_execucoes: metricas.total_execucoes + 1,          │
│     total_concluidos: metricas.total_concluidos + 1,        │
│     tempo_medio_conclusao_segundos: calcularMedia(...),     │
│     taxa_conclusao_percentual: (concluidos / execucoes) * 100│
│   }                                                          │
│ });                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 **BIBLIOTECA DE AUTOMAÇÕES: 5 ABAS DETALHADAS**

### **ABA 1: URAs PRÉ-ATENDIMENTO**

**Responsável:** `components/automacao/PlaybookManagerURA.jsx`

**Features:**
- Lista playbooks filtrados: `tipo_fluxo = "pre_atendimento"`
- Card por playbook mostrando:
  - Nome + Status (ativo/inativo)
  - Regras de ativação (tipos, tags, prioridade)
  - Métricas (execuções, taxa conclusão, tempo médio)
- Ações:
  - Criar Nova URA
  - Editar (abre EditorPlaybookURA)
  - Duplicar
  - Ativar/Desativar
  - Deletar (com confirmação)

**Código:**

```jsx
export default function PlaybookManagerURA() {
  const [playbooks, setPlaybooks] = useState([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [playbookSelecionado, setPlaybookSelecionado] = useState(null);
  
  const { data: playbooksData, isLoading } = useQuery({
    queryKey: ['playbooks-ura'],
    queryFn: () => base44.entities.FlowTemplate.filter({
      tipo_fluxo: 'pre_atendimento'
    }, '-prioridade', 50)
  });
  
  useEffect(() => {
    if (playbooksData) setPlaybooks(playbooksData);
  }, [playbooksData]);
  
  const criarPlaybookVazio = () => {
    const novoPlaybook = {
      nome: "Nova URA",
      tipo_fluxo: "pre_atendimento",
      categoria: "geral",
      regras_ativacao: {
        prioridade: 10,
        escopo_contato: "externo",
        tipos_permitidos: [],
        tags_obrigatorias: [],
        tags_bloqueadas: []
      },
      config_global: {
        ttl_completed_horas: 24,
        gap_novo_ciclo_horas: 12,
        usar_ia_no_init: true,
        limiar_confianca_ia: 70,
        usar_sticky: true,
        usar_guardian: true
      },
      estados: [
        {
          nome_interno: "INIT",
          titulo_admin: "Início",
          mensagem_template: "Olá, {nome}! {saudacao}",
          tipo_entrada: "buttons",
          opcoes: [],
          transicoes: []
        },
        {
          nome_interno: "COMPLETED",
          titulo_admin: "Concluído",
          mensagem_template: "Transferido com sucesso!",
          tipo_entrada: "system"
        }
      ],
      ativo: false // Criado inativo (admin ativa após configurar)
    };
    
    setPlaybookSelecionado(novoPlaybook);
    setModoEdicao(true);
  };
  
  return (
    <div className="space-y-6">
      
      {/* HEADER COM MÉTRICAS */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">URAs Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {playbooks.filter(p => p.ativo).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Taxa Conclusão Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {calcularTaxaMedia(playbooks)}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatarTempoMedio(playbooks)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Execuções Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {calcularExecucoesHoje(playbooks)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* LISTA DE PLAYBOOKS */}
      <div className="space-y-4">
        {playbooks.map(pb => (
          <PlaybookCardURA 
            key={pb.id}
            playbook={pb}
            onClick={() => {
              setPlaybookSelecionado(pb);
              setModoEdicao(true);
            }}
            onToggle={async () => {
              await base44.entities.FlowTemplate.update(pb.id, {
                ativo: !pb.ativo
              });
              // Refetch
            }}
          />
        ))}
      </div>
      
      {/* BOTÃO CRIAR */}
      <Button 
        onClick={criarPlaybookVazio}
        className="w-full"
        size="lg"
      >
        <Plus className="w-5 h-5 mr-2" />
        Nova URA Pré-Atendimento
      </Button>
      
      {/* EDITOR MODAL */}
      {modoEdicao && (
        <EditorPlaybookURA 
          playbook={playbookSelecionado}
          onSave={async (dados) => {
            if (dados.id) {
              await base44.entities.FlowTemplate.update(dados.id, dados);
            } else {
              await base44.entities.FlowTemplate.create(dados);
            }
            setModoEdicao(false);
            // Refetch
          }}
          onClose={() => setModoEdicao(false)}
        />
      )}
      
    </div>
  );
}
```

---

### **ABA 2: PLAYBOOKS GENÉRICOS**

**Responsável:** `components/automacao/PlaybookManager.jsx`

**Tipos suportados:**
- `follow_up_vendas` (nurturing 24h/3d/7d/15d)
- `bot_qualificacao` (coletar dados + score IA)
- `bot_suporte` (FAQ automatizado)
- `bot_cobranca` (lembretes de pagamento)
- `nurturing_leads` (aquecimento de leads frios)

**Diferença da Aba 1:**
- Usa `FlowExecution` (estados persistidos por contato)
- Suporta delays (next_action_at)
- Pode rodar em paralelo com URA

---

### **ABA 3: PROMOÇÕES & OFERTAS**

**Responsável:** `components/automacao/GerenciadorPromocoes.jsx`

**Features:**
- Criar promoção (tipo: inbound/batch)
- Definir público-alvo:
  - Tipos de contato
  - Tags obrigatórias/bloqueadas
  - Score mínimo (cliente_score >= 50)
- Agendar:
  - Data início/fim
  - Horário envio
  - Cron (ex: "0 10 * * *" = 10h todo dia)
- Templates de mensagem com variáveis
- Rotação de mensagens (evitar repetição)
- Cooldown configurável (12h/24h/48h)

---

### **ABA 4: RESPOSTAS RÁPIDAS**

**Responsável:** `components/automacao/QuickRepliesManager.jsx`

**Features:**
- Lista categorizada (Vendas, Suporte, Financeiro)
- Criar resposta com:
  - Atalho (ex: "/obrigado")
  - Categoria
  - Texto com variáveis: `{{nome}}`, `{{empresa}}`, `{{vendedor}}`
- Preview em tempo real
- Uso em ChatWindow (botão ou atalho)

---

### **ABA 5: DASHBOARD GLOBAL**

**Responsável:** `components/automacao/DashboardAutomacoes.jsx`

**Métricas Consolidadas:**

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 VISÃO GERAL (Últimos 30 dias)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │ URAs     │ Playbooks│ Promoções│ Respostas│              │
│ │ Ativas   │ Ativos   │ Ativas   │ Rápidas  │              │
│ ├──────────┼──────────┼──────────┼──────────┤              │
│ │    3     │    7     │    5     │   24     │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │ Execuções│ Conclusões│ Abandonos│ Timeouts │              │
│ │ Totais   │          │          │          │              │
│ ├──────────┼──────────┼──────────┼──────────┤              │
│ │  1,250   │  1,088   │   102    │    60    │              │
│ │          │  (87%)   │  (8%)    │  (5%)    │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ 📈 TENDÊNCIAS                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Gráfico de Linha: Execuções por Dia]                       │
│                                                              │
│ [Gráfico de Pizza: Distribuição por Tipo]                   │
│   - URAs: 45%                                                │
│   - Playbooks: 30%                                           │
│   - Promoções: 25%                                           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ 🏆 TOP 5 AUTOMAÇÕES (Por Execuções)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. URA Vendas Padrão        - 850 exec - 91% conclusão      │
│ 2. Bot Qualificação Leads   - 340 exec - 78% conclusão      │
│ 3. Promoção Inbound 6h      - 220 exec - 15% conversão      │
│ 4. Follow-Up 3 Dias         - 180 exec - 65% conclusão      │
│ 5. URA Cobrança             -  90 exec - 82% conclusão      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 **CONCEITOS-CHAVE CONSOLIDADOS**

### **1. AUTOMAÇÃO (Conceito Guarda-Chuva)**

**Definição:**
> Qualquer lógica automática que executa ações sem intervenção humana.

**Tipos:**
- **Playbooks** (fluxos conversacionais multi-step)
- **Promoções** (disparos comerciais agendados/reativos)
- **Respostas Rápidas** (templates de texto)
- **Campanhas** (sequências de mensagens)
- **Gatilhos** (ações baseadas em eventos)

**Campos Comuns:**
```json
{
  "nome": "string",
  "descricao": "string",
  "categoria": "vendas|suporte|financeiro|geral",
  "ativo": "boolean",
  "regras_ativacao": { /* ... */ },
  "metricas": { /* ... */ }
}
```

---

### **2. PLAYBOOK (Tipo Específico de Automação)**

**Definição:**
> Fluxo conversacional categorizado com estados, transições e ações.

**Subtipos:**
- `pre_atendimento` (URA)
- `follow_up_vendas` (nurturing)
- `bot_qualificacao` (coletor de dados)
- `bot_suporte` (FAQ)
- `bot_cobranca` (lembretes)

**Campos Específicos:**
```json
{
  "tipo_fluxo": "pre_atendimento|follow_up_*|bot_*",
  "config_global": { /* TTL, IA, sticky, guardian */ },
  "estados": [ /* INIT, WAITING_*, COMPLETED */ ],
  "regras_ativacao": { /* tipos, tags, conexões */ },
  "metricas_playbook": { /* execuções, conclusões */ }
}
```

---

### **3. REGRAS DE ATIVAÇÃO (Filtro Inteligente)**

**Componentes:**

```javascript
regras_ativacao: {
  
  // A. QUEM É O CONTATO?
  escopo_contato: "externo|interno|todos",
  tipos_permitidos: ["lead", "cliente"],      // Vazio = todos
  tipos_bloqueados: ["fornecedor", "interno"], // Exclusão explícita
  
  // B. ETIQUETAS (Segmentação)
  tags_obrigatorias: ["whatsapp_ok"],         // TEM que ter (AND)
  tags_bloqueadas: ["vip", "nao_ura"],       // NÃO pode ter (OR)
  
  // C. ONDE ENTROU?
  conexoes_permitidas: ["integ_abc123"],      // IDs WhatsAppIntegration
  
  // D. SETORES
  setores_permitidos: ["vendas", "financeiro"],
  setor_default: "vendas",
  
  // E. HORÁRIO
  horario_inicio: "08:00",
  horario_fim: "18:00",
  dias_semana_ativos: [1, 2, 3, 4, 5],
  bypass_fora_horario: true,
  
  // F. DESEMPATE
  prioridade: 50 // Maior = prioridade (1-100)
}
```

---

### **4. CONFIG_GLOBAL (Comportamento da URA)**

```javascript
config_global: {
  
  // CICLO DE VIDA
  ttl_completed_horas: 24,        // Resetar COMPLETED → INIT após X horas
  gap_novo_ciclo_horas: 12,       // Silêncio >= X horas = novo ciclo
  timeout_padrao_minutos: 10,     // Timeout por estado
  
  // FEATURES OPCIONAIS
  usar_ia_no_init: true,          // Fast-track IA no INIT
  limiar_confianca_ia: 70,        // Confiança mínima (0-100)
  usar_sticky: true,              // Oferecer retorno ao setor anterior
  usar_guardian: true,            // Detectar atendente ausente
  
  // MENSAGENS DE SISTEMA
  mensagem_timeout: "⏰ Tempo esgotado. Digite OI para recomeçar.",
  mensagem_cancelamento: "❌ Atendimento cancelado.",
  mensagem_erro: "⚠️ Ocorreu um erro. Aguarde um atendente."
}
```

---

### **5. ESTADOS (Máquina de Estados da URA)**

```javascript
estados: [
  {
    nome_interno: "INIT",
    titulo_admin: "Início",
    descricao: "Primeiro contato - define rota",
    
    mensagem_template: "Olá, {nome}! {saudacao}. Para qual setor você gostaria de falar?",
    
    tipo_entrada: "buttons", // buttons|text|number|skip|system
    
    usar_ia_fast_track: true,     // Permite IA pular este estado
    usar_sticky_memory: true,     // Oferece retorno ao setor anterior
    usar_guardian_mode: true,     // Detecta atendente ausente
    timeout_minutos: 10,          // Sobrescreve global
    
    opcoes: [
      { id: "1", label: "💼 Vendas", valor: "vendas", emoji: "💼" },
      { id: "2", label: "🔧 Suporte", valor: "assistencia", emoji: "🔧" },
      { id: "3", label: "💰 Financeiro", valor: "financeiro", emoji: "💰" }
    ],
    
    transicoes: [
      {
        condicao: {
          tipo: "ia_intent",            // button_match|text_contains|ia_intent|system|timeout
          valor: "vendas",
          confianca_minima: 70
        },
        acoes_pre_transicao: [
          {
            tipo: "setar_sector_id",
            parametros: { valor: "vendas" }
          }
        ],
        mensagem_transicao: "Perfeito! Te direcionando para Vendas...",
        proximo_estado: "WAITING_ATTENDANT_CHOICE"
      },
      {
        condicao: {
          tipo: "button_match",
          valor: "1" // Botão "Vendas"
        },
        acoes_pre_transicao: [
          { tipo: "setar_sector_id", parametros: { valor: "vendas" } }
        ],
        proximo_estado: "WAITING_ATTENDANT_CHOICE"
      },
      {
        condicao: { tipo: "timeout" },
        mensagem_transicao: "⏰ Tempo esgotado. Digite OI para recomeçar.",
        proximo_estado: "TIMEOUT"
      }
    ]
  },
  
  {
    nome_interno: "WAITING_ATTENDANT_CHOICE",
    titulo_admin: "Aguardando Atendente",
    mensagem_template: "Conectando você com um atendente de {setor}...",
    tipo_entrada: "system",
    
    transicoes: [
      {
        condicao: { tipo: "system" },
        acoes_pre_transicao: [
          {
            tipo: "atribuir_atendente",
            parametros: { 
              chamar_roteamento: true,
              setor_origem: "sector_id"
            }
          }
        ],
        proximo_estado: "COMPLETED"
      }
    ]
  },
  
  {
    nome_interno: "COMPLETED",
    titulo_admin: "Concluído",
    mensagem_template: "✅ Transferido! Aguarde que um atendente responderá em breve.",
    tipo_entrada: "system"
  }
]
```

---

## 🔧 **CÓDIGO DO EXECUTOR GENÉRICO**

### **Arquivo: `functions/preAtendimento/FluxoControllerV11.js`**

```javascript
/**
 * ═══════════════════════════════════════════════════════════════
 * FLUXO CONTROLLER V11 - EXECUTOR GENÉRICO
 * ═══════════════════════════════════════════════════════════════
 * 
 * ENTRADA: playbook (FlowTemplate) + contexto (thread, contact, input)
 * SAÍDA: Executa estado atual e transições
 * 
 * ZERO LÓGICA DE NEGÓCIO HARDCODED - tudo lido do playbook
 */

export class FluxoControllerV11 {
  constructor(playbook) {
    this.playbook = playbook;
    this.config = playbook.config_global || {};
  }
  
  /**
   * Método principal - processa estado atual
   */
  async processarEstado(base44, thread, contact, integrationId, userInput, intentContext) {
    const estadoAtual = thread.pre_atendimento_state || 'INIT';
    
    console.log(`[V11] 🎯 Processando estado: ${estadoAtual}`);
    
    // ══════════════════════════════════════════════════════════
    // 1. BUSCAR CONFIGURAÇÃO DO ESTADO NO PLAYBOOK
    // ══════════════════════════════════════════════════════════
    
    const estadoConfig = this.playbook.estados.find(
      e => e.nome_interno === estadoAtual
    );
    
    if (!estadoConfig) {
      console.error(`[V11] ❌ Estado '${estadoAtual}' não encontrado no playbook`);
      return { erro: 'estado_invalido' };
    }
    
    // ══════════════════════════════════════════════════════════
    // 2. VERIFICAR FAST-TRACKS (IA, Sticky, Guardian)
    // ══════════════════════════════════════════════════════════
    
    // A. IA Fast-Track (pula estado se IA tem certeza)
    if (estadoConfig.usar_ia_fast_track && intentContext?.confidence >= this.config.limiar_confianca_ia) {
      const transicaoIA = this.encontrarTransicaoIA(estadoConfig, intentContext);
      if (transicaoIA) {
        console.log(`[V11] 🚀 IA Fast-Track ativado (${intentContext.confidence}%)`);
        return await this.executarTransicao(base44, thread, contact, integrationId, transicaoIA);
      }
    }
    
    // B. Sticky Memory (retornar ao setor anterior)
    if (estadoConfig.usar_sticky_memory && thread.sector_id && estadoAtual === 'INIT') {
      return await this.executarStickyCheck(base44, thread, contact, integrationId, estadoConfig);
    }
    
    // C. Guardian Mode (atendente ausente)
    if (estadoConfig.usar_guardian_mode && thread.assigned_user_id && estadoAtual === 'INIT') {
      return await this.executarGuardianMode(base44, thread, contact, integrationId, estadoConfig);
    }
    
    // ══════════════════════════════════════════════════════════
    // 3. RENDERIZAR E ENVIAR MENSAGEM
    // ══════════════════════════════════════════════════════════
    
    const mensagem = this.renderTemplate(estadoConfig.mensagem_template, {
      nome: contact.nome,
      saudacao: this.gerarSaudacao(),
      setor: this.getNomeSetor(thread.sector_id)
    });
    
    const botoes = estadoConfig.tipo_entrada === 'buttons' ? estadoConfig.opcoes : null;
    
    await this.enviarMensagem(base44, contact, integrationId, mensagem, botoes);
    
    // Se tipo_entrada = "skip" ou "system", executar transição imediatamente
    if (estadoConfig.tipo_entrada === 'skip' || estadoConfig.tipo_entrada === 'system') {
      const transicaoAuto = estadoConfig.transicoes.find(t => t.condicao.tipo === 'system');
      if (transicaoAuto) {
        return await this.executarTransicao(base44, thread, contact, integrationId, transicaoAuto);
      }
    }
    
    // ══════════════════════════════════════════════════════════
    // 4. AGUARDAR INPUT E AVALIAR TRANSIÇÕES
    // ══════════════════════════════════════════════════════════
    
    // (Input vem da próxima chamada do webhook - não é síncrono)
    // Esta chamada termina aqui, aguardando próxima mensagem
    
    return { 
      success: true, 
      estado_atual: estadoAtual, 
      aguardando_input: estadoConfig.tipo_entrada !== 'skip'
    };
  }
  
  /**
   * Avalia transições baseado em userInput
   * (Chamado na PRÓXIMA mensagem do usuário)
   */
  async avaliarTransicoes(estadoConfig, userInput, intentContext) {
    for (const transicao of estadoConfig.transicoes || []) {
      const { tipo, valor } = transicao.condicao;
      
      switch (tipo) {
        case 'button_match':
          if (userInput?.button_id === valor) return transicao;
          break;
        
        case 'text_contains':
          if (userInput?.content?.toLowerCase().includes(valor.toLowerCase())) {
            return transicao;
          }
          break;
        
        case 'ia_intent':
          if (intentContext?.intent === valor && 
              intentContext?.confidence >= (transicao.condicao.confianca_minima || 70)) {
            return transicao;
          }
          break;
        
        case 'system':
          return transicao; // Sempre executa
        
        case 'timeout':
          // Verificado externamente por preAtendimentoHandler
          return transicao;
      }
    }
    
    return null; // Nenhuma transição bateu
  }
  
  /**
   * Executa transição (ações + mudança de estado)
   */
  async executarTransicao(base44, thread, contact, integrationId, transicao) {
    console.log(`[V11] 🔀 Executando transição → ${transicao.proximo_estado}`);
    
    // ══════════════════════════════════════════════════════════
    // 1. EXECUTAR AÇÕES PRÉ-TRANSIÇÃO
    // ══════════════════════════════════════════════════════════
    
    for (const acao of transicao.acoes_pre_transicao || []) {
      await this.executarAcao(base44, thread, contact, acao);
    }
    
    // ══════════════════════════════════════════════════════════
    // 2. ENVIAR MENSAGEM DE TRANSIÇÃO (se houver)
    // ══════════════════════════════════════════════════════════
    
    if (transicao.mensagem_transicao) {
      const msgTransicao = this.renderTemplate(transicao.mensagem_transicao, {
        nome: contact.nome,
        setor: this.getNomeSetor(thread.sector_id)
      });
      
      await this.enviarMensagem(base44, contact, integrationId, msgTransicao);
    }
    
    // ══════════════════════════════════════════════════════════
    // 3. ATUALIZAR ESTADO
    // ══════════════════════════════════════════════════════════
    
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_state: transicao.proximo_estado,
      pre_atendimento_ativo: transicao.proximo_estado !== 'COMPLETED'
    });
    
    // Atualizar objeto local
    thread.pre_atendimento_state = transicao.proximo_estado;
    
    // ══════════════════════════════════════════════════════════
    // 4. SE COMPLETED, REGISTRAR MÉTRICA
    // ══════════════════════════════════════════════════════════
    
    if (transicao.proximo_estado === 'COMPLETED') {
      await this.registrarConclusao(base44, thread);
      return { success: true, completado: true };
    }
    
    // ══════════════════════════════════════════════════════════
    // 5. RECURSÃO (processar próximo estado)
    // ══════════════════════════════════════════════════════════
    
    if (transicao.proximo_estado !== 'COMPLETED') {
      return await this.processarEstado(base44, thread, contact, integrationId, null, null);
    }
    
    return { success: true };
  }
  
  /**
   * Executar ação individual
   */
  async executarAcao(base44, thread, contact, acao) {
    console.log(`[V11] ⚡ Executando ação: ${acao.tipo}`);
    
    switch (acao.tipo) {
      
      case 'setar_sector_id':
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          sector_id: acao.parametros.valor
        });
        thread.sector_id = acao.parametros.valor;
        break;
      
      case 'atribuir_atendente':
        const resultado = await base44.functions.invoke('roteamentoInteligente', {
          thread_id: thread.id,
          setor: thread.sector_id || acao.parametros.setor
        });
        
        if (resultado.atendente_id) {
          await base44.asServiceRole.entities.MessageThread.update(thread.id, {
            assigned_user_id: resultado.atendente_id
          });
          thread.assigned_user_id = resultado.atendente_id;
        }
        break;
      
      case 'entrar_fila':
        await base44.functions.invoke('gerenciarFila', {
          acao: 'adicionar',
          thread_id: thread.id,
          setor: thread.sector_id || acao.parametros.setor
        });
        break;
      
      case 'atualizar_contato':
        await base44.asServiceRole.entities.Contact.update(contact.id, acao.parametros.campos);
        break;
      
      case 'chamar_funcao':
        await base44.functions.invoke(acao.parametros.funcao_nome, acao.parametros.args || {});
        break;
    }
  }
  
  /**
   * Renderizar template com variáveis
   */
  renderTemplate(template, variaveis) {
    let resultado = template;
    
    for (const [chave, valor] of Object.entries(variaveis)) {
      resultado = resultado.replace(new RegExp(`{${chave}}`, 'g'), valor || '');
    }
    
    return resultado;
  }
  
  /**
   * Enviar mensagem (com ou sem botões)
   */
  async enviarMensagem(base44, contact, integrationId, texto, botoes = null) {
    const payload = {
      thread_id: contact.thread_id, // Assumindo que está no contact
      content: texto,
      integration_id: integrationId
    };
    
    if (botoes && botoes.length > 0) {
      payload.buttons = botoes.map(b => ({
        id: b.id,
        text: b.label
      }));
    }
    
    await base44.functions.invoke('enviarMensagemUnificada', payload);
  }
  
  /**
   * Registrar conclusão (métricas)
   */
  async registrarConclusao(base44, thread) {
    const tempoExecucao = (Date.now() - new Date(thread.pre_atendimento_started_at)) / 1000;
    
    const metricas = this.playbook.metricas_playbook || {};
    
    await base44.asServiceRole.entities.FlowTemplate.update(this.playbook.id, {
      metricas_playbook: {
        total_execucoes: (metricas.total_execucoes || 0) + 1,
        total_concluidos: (metricas.total_concluidos || 0) + 1,
        tempo_medio_conclusao_segundos: calcularMedia(
          metricas.tempo_medio_conclusao_segundos,
          tempoExecucao,
          metricas.total_concluidos
        ),
        taxa_conclusao_percentual: 
          ((metricas.total_concluidos + 1) / (metricas.total_execucoes + 1)) * 100
      }
    });
    
    // Marcar thread
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      pre_atendimento_completed_at: new Date().toISOString()
    });
  }
  
  // ... helpers (gerarSaudacao, getNomeSetor, etc.)
}
```

---

## 📊 **ROADMAP EXECUTÁVEL**

### **SPRINT 0: FUNDAÇÃO (1-2 dias) ✅ FAZER AGORA**

**Tarefas:**

1. **Expandir Schema FlowTemplate**
   ```bash
   entities/FlowTemplate.json
   ├─ Adicionar config_global
   ├─ Adicionar estados[]
   ├─ Adicionar regras_ativacao (completo com tipos + tags)
   └─ Adicionar metricas_playbook
   ```

2. **Criar Motor de Resolução**
   ```bash
   functions/lib/resolverPlaybookParaMensagem.js
   ├─ Filtros: tipo_contato, tags, conexão, horário
   └─ Desempate: prioridade + especificidade
   ```

3. **Adicionar ao Layout**
   ```bash
   layout.js
   └─ Adicionar item "Automações" (admin + gerente)
   ```

4. **Criar Página Básica**
   ```bash
   pages/Automacoes.jsx
   └─ Importar BibliotecaAutomacoes
   ```

**Resultado:** Estrutura pronta para receber playbooks.

---

### **SPRINT 1: EXECUTOR V11 (3 dias)**

**Tarefas:**

1. **Criar FluxoControllerV11**
   ```bash
   functions/preAtendimento/FluxoControllerV11.js
   ├─ processarEstado() genérico
   ├─ avaliarTransicoes() baseado em playbook
   ├─ executarAcao() (setar setor, atribuir, fila)
   ├─ renderTemplate() (placeholders)
   └─ registrarConclusao() (métricas)
   ```

2. **Adaptar preAtendimentoHandler**
   ```javascript
   // Modo híbrido:
   if (playbook.estados) {
     const controller = new FluxoControllerV11(playbook);
     return await controller.processarEstado(...);
   } else {
     // Fallback v10
     return await FluxoController.processarEstado(...);
   }
   ```

3. **Integrar resolverPlaybookParaMensagem em inboundCore**
   ```javascript
   const playbook = await resolverPlaybookParaMensagem(base44, contact, thread, integrationId);
   
   if (playbook) {
     await base44.functions.invoke('preAtendimentoHandler', {
       playbook_id: playbook.id,
       // ...
     });
   }
   ```

**Resultado:** URA roda via playbook (com fallback v10).

---

### **SPRINT 2: INTERFACE ADMIN (5 dias)**

**Tarefas:**

1. **Atualizar BibliotecaAutomacoes**
   ```jsx
   <Tabs>
     <TabsContent value="ura">
       <PlaybookManagerURA />
     </TabsContent>
     <TabsContent value="playbooks">
       <PlaybookManager tipo_fluxo={["follow_up_*", "bot_*"]} />
     </TabsContent>
     // ... (manter abas existentes)
     <TabsContent value="dashboard">
       <DashboardAutomacoes />
     </TabsContent>
   </Tabs>
   ```

2. **Criar Componentes Editores**
   ```bash
   components/automacao/editores/
   ├─ EditorPlaybookURA.jsx (modal principal)
   ├─ SecaoConfigGlobal.jsx (sliders/toggles)
   ├─ EditorEstados.jsx (lista + add/remove)
   ├─ EditorEstadoIndividual.jsx (form individual)
   ├─ EditorRegrasAtivacao.jsx (multi-selects)
   └─ PreviewFluxoURA.jsx (react-flow ou custom)
   ```

3. **Criar Dashboard**
   ```bash
   components/automacao/DashboardAutomacoes.jsx
   ├─ Cards de métricas globais
   ├─ Gráficos (recharts)
   └─ Tabela Top 5 playbooks
   ```

**Resultado:** Admin edita URA visualmente.

---

### **SPRINT 3: SCRIPT DE MIGRAÇÃO (1 dia)**

**Tarefas:**

1. **Criar Script**
   ```bash
   functions/scripts/migrarURAv10ParaPlaybook.js
   ```

2. **Lógica:**
   ```javascript
   // Ler código atual (fluxoController v10)
   const estadosLegado = [
     { nome: "INIT", mensagem: "linha 80 do menuBuilder" },
     { nome: "WAITING_SECTOR_CHOICE", mensagem: "linha 148" },
     // ...
   ];
   
   // Converter para FlowTemplate
   const playbookMigrado = {
     nome: "URA Padrão v10 (Migrado)",
     tipo_fluxo: "pre_atendimento",
     is_pre_atendimento_padrao: true,
     config_global: {
       ttl_completed_horas: 24,
       gap_novo_ciclo_horas: 12,
       usar_ia_no_init: true,
       usar_sticky: true,
       usar_guardian: true
     },
     estados: estadosLegado.map(e => ({
       nome_interno: e.nome,
       mensagem_template: e.mensagem,
       // ... converter buttonMappings para opcoes[]
     }))
   };
   
   // Salvar
   await base44.entities.FlowTemplate.create(playbookMigrado);
   ```

**Resultado:** Playbook equivalente ao código v10 no banco.

---

### **SPRINT 4: LIMPEZA (1 dia)**

**Tarefas:**

1. **Remover Código Legado**
   ```bash
   ❌ DELETE: functions/preAtendimento/fluxoController.js (v10)
   ❌ DELETE: functions/preAtendimento/menuBuilder.js
   ❌ DELETE: functions/preAtendimento/buttonMappings.js
   ```

2. **Renomear V11 → Padrão**
   ```bash
   FluxoControllerV11.js → fluxoController.js
   ```

3. **Atualizar Docs**
   ```markdown
   README.md:
   - URA é 100% configurável via FlowTemplate
   - Mudanças via "Automações" → "URAs"
   - Zero necessidade de programar
   ```

**Resultado:** Zero código hardcoded de URA.

---

## 🎯 **AÇÕES IMEDIATAS (PRÓXIMOS 30 MINUTOS)**

### **OPÇÃO A: Começar pelo Schema (Recomendado)**

1. Expandir `entities/FlowTemplate.json`
2. Criar playbook seed "URA Padrão v10"
3. Testar criação manual via frontend

### **OPÇÃO B: Começar pelo Layout**

1. Adicionar "Automações" ao menu
2. Criar `pages/Automacoes.jsx` básica
3. Importar `BibliotecaAutomacoes` existente

### **OPÇÃO C: Começar pelo Motor de Resolução**

1. Criar `functions/lib/resolverPlaybookParaMensagem.js`
2. Integrar em `inboundCore.js`
3. Testar com playbook mock

---

## ✅ **VALIDAÇÃO FINAL**

### **Arquitetura está sólida?**
✅ **SIM.** Motivos:
- Separação clara de camadas (entrada → orquestração → execução)
- Playbook = dado (não código)
- Regras de ativação = filtro inteligente (context-aware)
- Interface admin = CRUD padrão (sem lógica complexa)
- Métricas automáticas (rastreabilidade)

### **É escalável?**
✅ **SIM.** Suporta:
- Ilimitados playbooks (filtrados por regras)
- Múltiplos tipos (URA, follow-up, bots)
- Extensível (novos tipos de ação via executarAcao)
- Testável (playbook = JSON)

### **Tempo estimado?**
- Sprint 0: 1-2 dias
- Sprint 1: 3 dias
- Sprint 2: 5 dias
- Sprint 3: 1 dia
- Sprint 4: 1 dia
- **Total: ~12 dias úteis (2.5 semanas)**

---

## 🚀 **DECISÃO: O QUE FAZER AGORA?**

**Caminho Crítico (Ordem recomendada):**

1. ✅ **Expandir Schema** (30min)
2. ✅ **Adicionar ao Layout** (5min)
3. ✅ **Criar Motor de Resolução** (1h)
4. ✅ **Criar FluxoControllerV11** (3h)
5. ✅ **Criar Interface Básica** (2h)

**Resultado:** Sistema funcional em modo híbrido (~1 dia de trabalho).

---

**STATUS:** ✅ Linha lógica completa mapeada - da interface ao código, do webhook à execução, com roadmap executável de 12 dias.