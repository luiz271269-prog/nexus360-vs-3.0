# 🛠️ IMPLEMENTAÇÃO: MÓDULO PLANO DE AÇÃO DE RETENÇÃO
## Fluxo Visual + Arquitetura Técnica + Sequência

---

## 1. FLUXO VISUAL PASSO-A-PASSO (O QUE O USUÁRIO VÊ)

### PASSO 1: Gestor acessa Gestão Comercial

```
URL: /GestaoComercial
┌──────────────────────────────────────────────────────────────┐
│ 📊 GESTÃO COMERCIAL                                          │
├──────────────────────────────────────────────────────────────┤
│ Taxa Conversão: 35%  │ Atendentes: 8  │ Threads: 45          │
│ Em Risco: 12                                                 │
├──────────────────────────────────────────────────────────────┤
│ ⚠️ CLIENTES EM RISCO                                         │
├──────────────────────────────────────────────────────────────┤
│ Score | Cliente          │ Motivo              │ Dias | Ação │
├───────┼──────────────────┼─────────────────────┼──────┼──────┤
│ 85%   │ Empresa ABC Ltd  │ Sem resposta 8d    │ 8    │[🔄] │
│ 78%   │ Tech Solutions   │ Baixo engajamento  │ 12   │[🔄] │
│ 72%   │ Global Trade     │ Sentimento negativo│ 5    │[🔄] │
└──────────────────────────────────────────────────────────────┘
```

### PASSO 2: Clica em "🔄" (Planejar Recuperação)

```
Modal abre:
┌──────────────────────────────────────────────────┐
│ 📋 Plano de Ação - Retenção                      │
├──────────────────────────────────────────────────┤
│                                                  │
│ Cliente (read-only):                            │
│ ┌────────────────────────────────────────────┐ │
│ │ Empresa ABC Ltd                            │ │
│ │ ⚠️ Sem resposta há 8 dias                   │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│ Estratégia de Recuperação:                      │
│ [v] 📞 Ligação Direcionada                      │
│     📧 Email Personalizado                      │
│     🎁 Oferta Especial                          │
│     📊 Análise Customizada                      │
│     🤝 Visita Presencial                        │
│                                                  │
│ Atribuir a:                                     │
│ [v] -- Selecione --                             │
│     João Silva (Vendedor)                       │
│     Maria Santos (Suporte)                      │
│     Carlos Mendes (Account Manager)             │
│                                                  │
│ Prazo para Primeiro Contato:                    │
│ [✓] 24h    [ ] 48h    [ ] 7 dias               │
│                                                  │
│ Observações/Contexto:                           │
│ ┌────────────────────────────────────────────┐ │
│ │ Cliente teve problema com atendimento.     │ │
│ │ Oferecer 10% desconto + análise gratuita   │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│         [Cancelar]  [✅ Criar Plano]            │
└──────────────────────────────────────────────────┘
```

### PASSO 3: Clica "✅ Criar Plano"

```
Sistema processa:
✅ Plano criado para Empresa ABC
✅ Tarefa atribuída a João Silva
✅ João foi notificado

Modal fecha, volta à tabela.
Linha da Empresa ABC agora mostra: "🟢 Plano Ativo"
```

### PASSO 4: Atendente (João) recebe notificação

```
WhatsApp do João (em tempo real):
┌────────────────────────────────┐
│ 🔔 Você foi designado!          │
│ Recuperar: Empresa ABC Ltd     │
│ Motivo: Sem resposta há 8 dias │
│ Prazo: 24h (até amanhã 14:30)  │
│ Ver: /Agenda?tarefaId=xyz      │
└────────────────────────────────┘

Dashboard dele (Agenda):
┌──────────────────────────────────────┐
│ 🎯 TAREFAS & FOLLOW-UPS              │
├──────────────────────────────────────┤
│ [CRÍTICA] 🔄 Recuperar Empresa ABC   │
│   Prazo: Hoje - 14:30                │
│   Contexto: Cliente teve problema... │
│                                      │
│   [Atualizar Tentativa] [Concluir]  │
└──────────────────────────────────────┘
```

### PASSO 5: João realiza ação (ligação/email)

**Cenário A: Alcançou o cliente**
```
João clica em "Atualizar Tentativa"

Modal aparece:
┌──────────────────────────────┐
│ ✅ Resultado da Tentativa     │
├──────────────────────────────┤
│ Data: 16/03/2026 14:00       │
│ Tipo: [v] Ligação            │
│        [ ] Email             │
│        [ ] WhatsApp          │
│        [ ] Reunião           │
│                              │
│ Resultado:                   │
│ [v] Alcançado                │
│ [ ] Não Alcançado            │
│ [ ] Reagendado               │
│                              │
│ Observação:                  │
│ Cliente estava offline. Ofereci
│ desconto 10%. Vai analisar e
│ retorna amanhã.              │
│                              │
│   [Registrar]  [Cancelar]   │
└──────────────────────────────┘
```

**Sistema atualiza em tempo real:**
```
✅ Tentativa registrada
📍 Plano em Execução (status mudou)
📊 Score de risco baixou: 85% → 65%
🔔 Gestor recebeu update: "João fez contato com Empresa ABC"
```

### PASSO 6: Automação de Check-in (em 12h)

Se João não registrou nada em 12h:
```
WhatsApp para João:
┌────────────────────────────────┐
│ ⏰ Lembrete: Plano de Retenção  │
│ Empresa ABC - prazo vence em 12h│
│ Você registrou tentativa?      │
│ [ Ver Tarefa ]                 │
└────────────────────────────────┘
```

### PASSO 7: Conclusão do Plano

**Cenário A: Cliente Recuperado**
```
João marca tarefa como "Concluída"

Dashboard do Gestor atualiza:
┌──────────────────────────────────┐
│ 🎉 CLIENTE RECUPERADO!           │
│ Empresa ABC retomou contato      │
│ Score anterior: 85% → Atual: 25% │
│ Ação: João Silva                │
│ Data: 16/03/2026                │
│ Próximo Follow-up: Em 30 dias    │
└──────────────────────────────────┘

Tabela de Risco (GestaoComercial):
❌ Empresa ABC já NÃO aparece na lista
✅ Saiu de "Em Risco" e voltou para "Cliente Ativo"

Relatório de Retenção:
✅ +1 Cliente Recuperado esta semana
```

**Cenário B: Plano Falhou (Prazo venceu)**
```
Automação roda em T+24h:

Dashboard do Gestor:
┌──────────────────────────────────┐
│ ❌ PLANO NÃO ALCANÇOU META       │
│ Empresa ABC - Prazo expirou      │
│ Tentativas: 1 (1 alcançado, etc) │
│ Status: Cliente Perdido Provável │
│ Ação Sugerida:                  │
│ → Contato executivo (gestor)    │
│ → Oferta especial (última chance)│
│ → Análise do que deu errado      │
└──────────────────────────────────┘

Opções disponíveis:
[🔄 Criar novo plano] [📧 Contato Executivo] [📊 Análise]
```

---

## 2. ARQUITETURA TÉCNICA (POR TRÁS DOS PANOS)

### 2.1 Estrutura de Pastas

```
projeto/
├── pages/
│   └── GestaoComercial.jsx        ← Página principal (já existe/será criada)
│
├── components/
│   └── gestao-comercial/          ← Nova pasta para módulo
│       ├── ModalPlanoRetencao.jsx ← Modal para criar plano
│       ├── TabelaClientesRisco.jsx← Tabela com botão "Planejar"
│       ├── StatusPlanoCard.jsx    ← Card mostrando status do plano
│       ├── TemplatesRetencao.json ← Templates de estratégias
│       └── utils/
│           └── calcularScoreRisco.js
│
├── entities/
│   └── PlanoRetencao.json         ← Nova entidade no banco
│
├── functions/
│   ├── notificarAtendentePlanoRetencao.js       ← Automação 1
│   ├── verificarProgressoPlanoRetencao.js       ← Automação 2
│   ├── escalarPlanoRetencaoVencido.js           ← Automação 3
│   ├── registrarTentativaRetencao.js            ← Automação 4
│   └── finalizarPlanoRetencao.js                ← Automação 5
│
└── App.jsx                        ← Adicionar rota /GestaoComercial
```

### 2.2 Fluxo de Dados (Diagrama)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONT-END                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GestaoComercial.jsx                                            │
│      ↓ (carrega dados)                                          │
│  ContactBehaviorAnalysis + MessageThread → Tabela de Risco    │
│      ↓ (user clica 🔄)                                          │
│  ModalPlanoRetencao.jsx                                         │
│      ├─ fetch: User.list() (atendentes)                         │
│      ├─ Preenche: estratégia, responsável, prazo, obs          │
│      └─ onClick: handleCriarPlano()                             │
│          ↓ (faz 2 operações em paralelo)                        │
│          ├─ POST PlanoRetencao.create()                         │
│          └─ POST TarefaInteligente.create()                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                    (request vai para servidor)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACK-END (Base44)                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Cria PlanoRetencao                                          │
│     {                                                           │
│       contact_id: "123abc"                                      │
│       estrategia: "ligacao"                                     │
│       responsavel_user_id: "user_xyz"                           │
│       prazo_original: "2026-03-17T14:30:00"                     │
│       status: "ativo"                                           │
│     }                                                           │
│                                                                  │
│  2. Cria TarefaInteligente                                      │
│     {                                                           │
│       title: "🔄 Recuperar Empresa ABC"                         │
│       status: "pendente"                                        │
│       prioridade: "alta"                                        │
│       plano_retencao_id: <novo_id>                              │
│       tipo: "retencao"                                          │
│     }                                                           │
│                                                                  │
│  3. Dispara Automação 1: notificarAtendentePlanoRetencao        │
│     └─ Envia WhatsApp: "João, você foi designado..."           │
│                                                                  │
│  4. Responde ao front: "✅ Plano criado"                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
                  (response volta para front)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONT-END (Confirmação)                                         │
├─────────────────────────────────────────────────────────────────┤
│  Toast: "✅ Plano criado com sucesso"                           │
│  Modal fecha                                                    │
│  Tabela recarrega                                               │
│  Linha da Empresa ABC agora mostra: "🟢 Plano Ativo"           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Automações (Rodam em Background)

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTOMAÇÃO 1: Notificar Atendente (IMEDIATA)                     │
├─────────────────────────────────────────────────────────────────┤
│ Trigger:     TarefaInteligente.create() com tipo="retencao"     │
│ Executa:     notificarAtendentePlanoRetencao.js                 │
│ Ação:                                                           │
│   1. Busca dados do plano                                       │
│   2. Busca dados do atendente                                   │
│   3. Envia WhatsApp: "João, você foi designado..."              │
│   4. Registra timestamp                                         │
│ Tempo: <1s                                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AUTOMAÇÃO 2: Check-in em 12h (SCHEDULED)                        │
├─────────────────────────────────────────────────────────────────┤
│ Trigger:     Cron job a cada 12 horas                           │
│ Executa:     verificarProgressoPlanoRetencao.js                 │
│ Ação:                                                           │
│   1. Busca todos PlanoRetencao com status="ativo"               │
│   2. Verifica se há tentativa registrada                        │
│   3. Se não: envia reminder ao atendente                        │
│   4. Se sim: atualiza status para "em_execucao"                 │
│ Tempo: ~5-10s por plano                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AUTOMAÇÃO 3: Escalação (SCHEDULED)                              │
├─────────────────────────────────────────────────────────────────┤
│ Trigger:     Cron job a cada 6 horas                            │
│ Executa:     escalarPlanoRetencaoVencido.js                     │
│ Ação:                                                           │
│   1. Busca PlanoRetencao com prazo < now e sem sucesso          │
│   2. Muda status para "em_falha"                                │
│   3. Alerta gestor: "Plano de João expirou"                     │
│ Tempo: ~5-10s por plano                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AUTOMAÇÃO 4: Registrar Tentativa (ENTITY)                       │
├─────────────────────────────────────────────────────────────────┤
│ Trigger:     TarefaInteligente.update() com resultado            │
│ Executa:     registrarTentativaRetencao.js                      │
│ Ação:                                                           │
│   1. Busca PlanoRetencao vinculado                              │
│   2. Registra tentativa em array                                │
│   3. Recalcula score de risco do cliente                        │
│   4. Atualiza ContactBehaviorAnalysis                           │
│ Tempo: ~2-3s                                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ AUTOMAÇÃO 5: Finalizar Plano (ENTITY)                           │
├─────────────────────────────────────────────────────────────────┤
│ Trigger:     TarefaInteligente.update() com status="concluida"  │
│ Executa:     finalizarPlanoRetencao.js                          │
│ Ação:                                                           │
│   1. Busca PlanoRetencao                                        │
│   2. Valida resultado: "cliente_recuperado" ou "cliente_perdido"│
│   3. Atualiza score final                                       │
│   4. Alerta gestor: "Cliente recuperado! ✅"                     │
│   5. Registra na história do cliente                            │
│ Tempo: ~3-5s                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. SEQUÊNCIA DE IMPLEMENTAÇÃO

### Fase 1: Estrutura Base (Dia 1-2)

**1.1 Criar Entidade PlanoRetencao**
```bash
Arquivo: entities/PlanoRetencao.json
Ação: Escrever JSON schema com todos os campos
Tempo: 30min
```

**1.2 Criar Modal**
```bash
Arquivo: components/gestao-comercial/ModalPlanoRetencao.jsx
Ação: Componente React com form
Tempo: 1-2h
Dependências: Dialog, Button, Select do shadcn/ui
```

**1.3 Integrar Modal em GestaoComercial**
```bash
Arquivo: pages/GestaoComercial.jsx
Ação: Adicionar botão "🔄" em cada linha da tabela
Ação: Quando clicado, abre ModalPlanoRetencao
Tempo: 30min
```

**1.4 Criar Automação 1 (Notificação)**
```bash
Arquivo: functions/notificarAtendentePlanoRetencao.js
Ação: Enviar WhatsApp quando TarefaInteligente criada
Tempo: 1-2h
Dependências: sendWhatsApp() ou integração WhatsApp
```

**Checkpoint:** Gestor consegue criar plano, atendente recebe notificação ✅

### Fase 2: Automações (Dia 3-4)

**2.1 Criar Automação 2 (Check-in 12h)**
```bash
Arquivo: functions/verificarProgressoPlanoRetencao.js
Ação: Cron job a cada 12h, envia reminder
Tempo: 1h
```

**2.2 Criar Automação 3 (Escalação 24h)**
```bash
Arquivo: functions/escalarPlanoRetencaoVencido.js
Ação: Cron job a cada 6h, alerta se prazo passou
Tempo: 1h
```

**2.3 Criar Automação 4 (Registrar Tentativa)**
```bash
Arquivo: functions/registrarTentativaRetencao.js
Ação: Quando João registra tentativa, atualiza plano
Tempo: 1-2h
```

**2.4 Criar Automação 5 (Finalizar)**
```bash
Arquivo: functions/finalizarPlanoRetencao.js
Ação: Quando tarefa concluída, fecha plano
Tempo: 1h
```

**Checkpoint:** Todo ciclo funciona automaticamente ✅

### Fase 3: Polish (Dia 5)

**3.1 Dashboard Widget**
```bash
Arquivo: components/dashboard/PainelRetencao.jsx
Ação: Card mostrando: Recuperados, Em Andamento, Vencidos
Tempo: 1h
```

**3.2 Testes E2E**
```bash
Ação: Testar fluxo completo:
  1. Criar plano
  2. Atendente recebe notificação
  3. Registra tentativa
  4. Sistema atualiza score
  5. Conclui plano
Tempo: 2-3h
```

**3.3 Treinamento**
```bash
Tempo: 1h
Público: Gestores e Atendentes
```

---

## 4. ONDE ENCAIXA NA NAVEGAÇÃO

### Rota Principal

```
/GestaoComercial
├── Menu lateral (Layout.jsx) → Adicionar link
├── Abas:
│   ├── 📊 Desempenho de Atendentes
│   ├── 🎯 Funil de Vendas
│   └── ⚠️ CLIENTES EM RISCO ← NOVO MODAL AQUI
│
└── Modal: Plano de Retenção ← NOVO MODAL
    └── Quando criado:
        - Tarefa aparece em /Agenda
        - Widget atualiza em /Dashboard
```

### Fluxo de Navegação

```
Dashboard (/Dashboard)
    ↓ Clica: "📊 Gestão Comercial"
GestaoComercial (/GestaoComercial)
    ├─ Vê cliente em risco "Empresa ABC"
    └─ Clica: "🔄 Planejar"
        ↓
    ModalPlanoRetencao (modal popup)
        └─ Preencheu e criou
            ↓
    Toast: "✅ Plano Criado"
    ↓
    Tabela atualiza: "Empresa ABC: 🟢 Plano Ativo"
    ↓ (João, atendente, recebe WhatsApp)
Agenda (/Agenda)
    ├─ Nova tarefa: "🔄 Recuperar Empresa ABC"
    ├─ Clica: "Atualizar Tentativa"
    └─ Registra resultado
        ↓
    GestaoComercial (volta)
        └─ Empresa ABC: Score mudou 85% → 65%
            └─ Se alcançou sucesso, sai de "Em Risco"
```

---

## 5. COMO O SISTEMA TRABALHA INTERNAMENTE

### Exemplo Real: Cliente Recuperado

```
T+0 Minutos: Gestor cria plano
┌────────────────────────────────────────────────────────┐
│ GestaoComercial.jsx                                    │
│ ModalPlanoRetencao.jsx                                 │
│ const handleCriarPlano = async () => {                 │
│   // Cria 2 registros em paralelo                      │
│   await Promise.all([                                  │
│     base44.entities.PlanoRetencao.create({...}),       │
│     base44.entities.TarefaInteligente.create({...})    │
│   ])                                                   │
│ }                                                      │
└────────────────────────────────────────────────────────┘
                        ↓ (back-end processa)
┌────────────────────────────────────────────────────────┐
│ Base44 Database                                        │
│ PlanoRetencao (novo):                                  │
│   id: "plano_001"                                      │
│   contact_id: "123abc"                                 │
│   estrategia: "ligacao"                                │
│   responsavel_user_id: "user_joao"                     │
│   prazo_original: "2026-03-17T14:30"                   │
│   status: "ativo"                                      │
│   tentativas: []                                       │
│                                                        │
│ TarefaInteligente (nova):                              │
│   id: "tarefa_001"                                     │
│   title: "🔄 Recuperar Empresa ABC"                    │
│   plano_retencao_id: "plano_001"                       │
│   status: "pendente"                                   │
└────────────────────────────────────────────────────────┘
                        ↓ (dispara automação)
┌────────────────────────────────────────────────────────┐
│ notificarAtendentePlanoRetencao.js                     │
│ (Automação 1 - IMEDIATA)                               │
│                                                        │
│ Busca:                                                 │
│   - PlanoRetencao (id: plano_001)                      │
│   - User (id: user_joao)                               │
│   - Contact (id: 123abc)                               │
│                                                        │
│ Envia WhatsApp:                                        │
│   "🔔 Você foi designado!                              │
│    Recuperar: Empresa ABC Ltd                          │
│    Motivo: Sem resposta há 8 dias                      │
│    Prazo: 24h (até amanhã 14:30)                       │
│    Ver: /Agenda?tarefaId=tarefa_001"                   │
└────────────────────────────────────────────────────────┘
                        ↓ (João recebe no WhatsApp)

T+14:00 (mesma tarde): João faz ligação
┌────────────────────────────────────────────────────────┐
│ Agenda.jsx (página de João)                            │
│ PainelContexto (tarefa selecionada)                    │
│                                                        │
│ João vê:                                               │
│   🔄 Recuperar Empresa ABC Ltd                         │
│   Prazo: Hoje - 14:30                                  │
│   Contexto: "Sem resposta há 8 dias. Oferecer 10%..."  │
│                                                        │
│ Clica: [Atualizar Tentativa]                           │
│   ├─ Data: 16/03/2026 14:00                            │
│   ├─ Tipo: Ligação                                     │
│   ├─ Resultado: Alcançado                              │
│   ├─ Observação: "Cliente estava offline, ofereci      │
│   │  desconto 10%, retorna amanhã"                     │
│   └─ [Registrar]                                       │
└────────────────────────────────────────────────────────┘
                        ↓ (back-end processa)
┌────────────────────────────────────────────────────────┐
│ registrarTentativaRetencao.js                          │
│ (Automação 4 - Dispara na update da TarefaInteligente) │
│                                                        │
│ 1. Busca PlanoRetencao (id: plano_001)                 │
│                                                        │
│ 2. Adiciona tentativa ao array:                        │
│    tentativas: [{                                      │
│      data: "2026-03-16T14:00:00",                      │
│      tipo: "ligacao",                                  │
│      resultado: "alcancado",                           │
│      observacoes: "Cliente estava offline..."          │
│    }]                                                  │
│                                                        │
│ 3. Atualiza status:                                    │
│    status: "em_execucao"                               │
│                                                        │
│ 4. Recalcula score de risco:                           │
│    - Tinha: 85% (sem resposta 8 dias)                  │
│    - Agora: 65% (há contato recente)                   │
│    Atualiza ContactBehaviorAnalysis                    │
│                                                        │
│ 5. Registra evento no log                              │
└────────────────────────────────────────────────────────┘
                        ↓ (front-end atualiza)
┌────────────────────────────────────────────────────────┐
│ Agenda.jsx (João)                                      │
│ Toast: "✅ Tentativa registrada"                       │
│ Tarefa muda para "em_execucao"                         │
│                                                        │
│ GestaoComercial.jsx (Gestor)                           │
│ Tabela recarrega automaticamente                       │
│ Empresa ABC agora mostra:                              │
│   Score: 85% → 65%                                     │
│   Status: 🔄 Plano em Execução                         │
│   Última ação: "João fez contato - 14:00"              │
└────────────────────────────────────────────────────────┘

T+17/03/2026 (próximo dia): Cliente retorna
┌────────────────────────────────────────────────────────┐
│ Comunicacao.jsx (Atendente)                            │
│ Cliente envia mensagem:                                │
│ "Oi João, analisei a proposta e tenho interesse..."   │
│                                                        │
│ Sistema detecta: MessageThread de cliente em risco     │
│ Dispara automaticamente:                               │
│   - Atualiza ContactBehaviorAnalysis (sentimento +)    │
│   - Marca: "Cliente retomou contato"                   │
└────────────────────────────────────────────────────────┘
                        ↓ (João vê na Agenda)
┌────────────────────────────────────────────────────────┐
│ Agenda.jsx (João)                                      │
│ Tarefa com opção: [Concluir com Sucesso]              │
│ João clica, escreve: "Cliente recuperado, retomou..."  │
└────────────────────────────────────────────────────────┘
                        ↓ (back-end processa)
┌────────────────────────────────────────────────────────┐
│ finalizarPlanoRetencao.js                              │
│ (Automação 5 - Dispara na update final da TarefaInt.)  │
│                                                        │
│ 1. Atualiza PlanoRetencao:                             │
│    status: "em_sucesso"                                │
│    resultado_final: "cliente_recuperado"               │
│    cliente_score_final: 35%                            │
│    concluido_em: "2026-03-17T15:30"                    │
│                                                        │
│ 2. Remove cliente de "Em Risco" em GestaoComercial     │
│                                                        │
│ 3. Alerta gestor no Dashboard:                         │
│    "🎉 CLIENTE RECUPERADO!                             │
│     Empresa ABC - Ação: João Silva"                    │
│                                                        │
│ 4. Sugere próxima ação: "Follow-up em 30 dias"         │
└────────────────────────────────────────────────────────┘
                        ↓ (front-end atualiza)
┌────────────────────────────────────────────────────────┐
│ Dashboard.jsx (Gestor)                                 │
│ PainelRetencao:                                        │
│   ✅ Recuperados: 1 (+1 hoje)                          │
│   🔄 Em andamento: 5                                   │
│   ❌ Perdidos: 0                                       │
│                                                        │
│ GestaoComercial.jsx (Gestor)                           │
│ Tabela "Em Risco":                                     │
│   ❌ Empresa ABC REMOVIDA (não aparece mais)           │
│   ✅ Apareça em relatório: "Recuperado em 24h"         │
└────────────────────────────────────────────────────────┘
```

---

## 6. RESUMO: COMO FUNCIONA

### O Usuário Final (Gestor) Vê:

```
1. Entra em /GestaoComercial
2. Vê tabela com "20 Clientes em Risco"
3. Clica "🔄 Planejar" em um cliente
4. Preencheu form (estratégia, atendente, prazo, obs)
5. Clicou "✅ Criar Plano"
6. Toast confirma: "Plano criado!"
7. Tabela atualiza com status: "🟢 Plano Ativo"
8. Vai embora, sistema trabalha
9. 12h depois, recebe update: "João fez contato"
10. 24h depois, recebe resultado: "Cliente recuperado ✅"
```

### O Back-end Faz (Automático):

```
1. Salva PlanoRetencao no banco
2. Cria TarefaInteligente
3. Envia WhatsApp ao atendente (IMEDIATA)
4. A cada 12h, checa se há progresso (REMINDER)
5. A cada 6h, checa se prazo venceu (ESCALAÇÃO)
6. Quando atendente registra tentativa, atualiza score
7. Quando conclusão confirmada, finaliza plano
8. Remove cliente de "Em Risco"
9. Registra no histórico do cliente
```

---

## PRONTO PARA IMPLEMENTAR?

**Sim, se aprovado:**
1. ✅ Estrutura clara
2. ✅ Componentes definidos
3. ✅ Automações mapeadas
4. ✅ Fluxo de dados documentado
5. ✅ Timeline realista (5 dias)
6. ✅ Zero risco de quebrar existente

**Status:** 🟡 **AGUARDANDO APROVAÇÃO FINAL**