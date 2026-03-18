# CONTRATOS DE DADOS - Arquitetura v10.0.0 "Linha Imutável"

## 📋 Visão Geral

Este documento define os contratos de dados entre os componentes principais do sistema de pré-atendimento.

---

## 1. NormalizedInbound (Entrada do inboundCore)

**Responsável:** Webhooks (Z-API, W-API, Cloud API) → `inboundCore.js`

**Estrutura:**

```typescript
interface NormalizedInbound {
  base44: SDK;               // Cliente SDK autenticado
  contact: Contact;          // Objeto Contact do DB
  thread: MessageThread;     // Objeto MessageThread do DB
  integration: WhatsAppIntegration;  // Objeto WhatsAppIntegration do DB
  message: Message;          // Mensagem salva no DB
  provider: 'z_api' | 'w_api' | 'cloud_api';
  messageContent: string;    // Texto puro da mensagem
  rawPayload: object;        // Payload original do webhook
}
```

**Exemplo:**
```javascript
const params = {
  base44: createClientFromRequest(req),
  contact: { id: '123', nome: 'João', telefone: '+5548999999999' },
  thread: { id: 'thread-1', sector_id: 'vendas', pre_atendimento_state: 'INIT' },
  integration: { id: 'int-1', api_provider: 'z_api' },
  message: { id: 'msg-1', content: 'Olá' },
  provider: 'z_api',
  messageContent: 'Olá',
  rawPayload: { /* payload original Z-API */ }
};
```

---

## 2. UserInput (Entrada Normalizada)

**Responsável:** `inboundCore.normalizarEntrada()` → `preAtendimentoHandler`

**Estrutura:**

```typescript
interface UserInput {
  type: 'text' | 'button' | 'list' | 'media';
  content: string;           // Texto da mensagem ou título do botão
  id?: string;               // ID do botão/lista selecionado
}
```

**Exemplos:**

```javascript
// Mensagem de texto
{ type: 'text', content: 'Quero falar com vendas', id: null }

// Botão clicado
{ type: 'button', content: 'Vendas', id: 'sector_vendas' }

// Lista selecionada
{ type: 'list', content: 'João Silva', id: 'attendant_123' }
```

---

## 3. IntentAnalysisResult (Saída de analisarIntencao)

**Responsável:** `analisarIntencao.js` → `inboundCore` → `preAtendimentoHandler`

**Estrutura:**

```typescript
interface IntentAnalysisResult {
  intent_type: 'sector' | 'request_agent' | 'greeting' | 'unknown';
  sector_slug?: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral';
  agent_request?: {
    requested: boolean;
    setor_preferido?: string;
    nome_atendente?: string;
  };
  confidence: number;        // 0-100
  urgency: 'baixa' | 'media' | 'alta' | 'critica';
  sentiment: 'muito_positivo' | 'positivo' | 'neutro' | 'negativo' | 'muito_negativo';
  explanation: string;       // Justificativa da decisão
  deve_iniciar_ura: boolean; // Se deve disparar URA padrão
  setor_sugerido?: string;   // Setor sugerido em caso de baixa confiança
}
```

**Exemplo:**

```javascript
// Alta confiança - setor detectado
{
  intent_type: 'sector',
  sector_slug: 'vendas',
  confidence: 85,
  urgency: 'media',
  sentiment: 'positivo',
  explanation: 'Cliente mencionou "quero comprar notebook"',
  deve_iniciar_ura: false,  // Pula menu
  setor_sugerido: 'vendas'
}

// Pedido de atendente específico
{
  intent_type: 'request_agent',
  agent_request: {
    requested: true,
    nome_atendente: 'João Silva'
  },
  confidence: 90,
  urgency: 'alta',
  sentiment: 'neutro',
  explanation: 'Cliente pediu explicitamente "quero falar com João"',
  deve_iniciar_ura: false
}

// Baixa confiança - fallback URA
{
  intent_type: 'unknown',
  confidence: 25,
  urgency: 'baixa',
  sentiment: 'neutro',
  explanation: 'Mensagem muito curta ou ambígua',
  deve_iniciar_ura: true,  // Mostra menu padrão
  setor_sugerido: 'geral'
}
```

---

## 4. PreAtendimentoPayload (Entrada do preAtendimentoHandler)

**Responsável:** `inboundCore.processInboundEvent()` → `preAtendimentoHandler.js`

**Estrutura:**

```typescript
interface PreAtendimentoPayload {
  thread_id: string;
  contact_id: string;
  whatsapp_integration_id: string;
  user_input: UserInput;
  intent_context?: IntentAnalysisResult;  // Opcional - só em novos ciclos
  is_new_cycle: boolean;
  provider?: 'z_api' | 'w_api' | 'cloud_api';
}
```

**Exemplo:**

```javascript
{
  thread_id: 'thread-123',
  contact_id: 'contact-456',
  whatsapp_integration_id: 'int-789',
  user_input: { type: 'text', content: 'Quero comprar notebook', id: null },
  intent_context: {
    intent_type: 'sector',
    sector_slug: 'vendas',
    confidence: 85,
    deve_iniciar_ura: false
  },
  is_new_cycle: true,
  provider: 'z_api'
}
```

---

## 5. FluxoController Method Signatures

### processarEstadoINIT
```typescript
static async processarEstadoINIT(
  base44: SDK,
  thread: MessageThread,
  contact: Contact,
  whatsappIntegrationId: string,
  user_input?: UserInput,
  intent_context?: IntentAnalysisResult
): Promise<FluxoResult>
```

**Lógica de Decisão:**
1. Se `intent_context.sector_slug` + `confidence >= 70` → **Fast-track** (pula menu)
2. Se `thread.sector_id` existe → **Sticky Setor** (pergunta se quer voltar)
3. Senão → **Menu Padrão** (mostra opções de setores)

---

### processarWAITING_STICKY_DECISION
```typescript
static async processarWAITING_STICKY_DECISION(
  base44: SDK,
  thread: MessageThread,
  contact: Contact,
  user_input: UserInput,
  whatsappIntegrationId: string
): Promise<FluxoResult>
```

**Respostas esperadas:**
- `sticky_sim`, `sim`, `1` → Continua no setor anterior
- Qualquer outra → Volta ao menu principal

---

### processarWAITING_SECTOR_CHOICE
```typescript
static async processarWAITING_SECTOR_CHOICE(
  base44: SDK,
  thread: MessageThread,
  contact: Contact,
  user_input: UserInput,
  whatsappIntegrationId: string
): Promise<FluxoResult>
```

**Mapeamento de entrada:**
- `1`, `vendas`, `comercial` → `vendas`
- `2`, `financeiro`, `boleto` → `financeiro`
- `3`, `suporte`, `tecnico`, `ajuda` → `assistencia`
- `4`, `fornecedor`, `compras` → `fornecedor`

---

### processarWAITING_ATTENDANT_CHOICE
```typescript
static async processarWAITING_ATTENDANT_CHOICE(
  base44: SDK,
  thread: MessageThread,
  contact: Contact,
  user_input: UserInput,
  whatsappIntegrationId: string
): Promise<FluxoResult>
```

**Comportamento:**
1. Chama `roteamentoInteligente` para encontrar atendente
2. Se encontrar → `COMPLETED` (transfere)
3. Se não encontrar → `WAITING_QUEUE_DECISION` (oferece fila)

---

### processarWAITING_QUEUE_DECISION
```typescript
static async processarWAITING_QUEUE_DECISION(
  base44: SDK,
  thread: MessageThread,
  contact: Contact,
  user_input: UserInput,
  whatsappIntegrationId: string
): Promise<FluxoResult>
```

**Respostas esperadas:**
- `fila_entrar`, `sim`, `1` → Enfileira e marca `COMPLETED`
- `fila_sair`, `2` → Volta ao menu (chama `INIT` novamente)

---

## 6. FluxoResult (Retorno dos métodos do FluxoController)

```typescript
interface FluxoResult {
  success: boolean;
  mode?: 'sticky' | 'menu' | 'fast_track';
  proximo_estado?: string;
  setor?: string;
  allocated?: boolean;
  queue_offered?: boolean;
  enqueued?: boolean;
  error?: string;
  aguardando_nova_resposta?: boolean;
}
```

---

## 7. Pipeline Completo (Fluxo de Dados)

```
┌─────────────────────────────────────────────────────────────┐
│  1. WEBHOOK (Z-API / W-API)                                 │
│     ↓ Raw Payload                                           │
├─────────────────────────────────────────────────────────────┤
│  2. NORMALIZAÇÃO (webhookWapi / webhookFinalZapi)          │
│     ↓ NormalizedInbound                                     │
├─────────────────────────────────────────────────────────────┤
│  3. INBOUND CORE (processInboundEvent)                      │
│     ├─ Normaliza user_input                                 │
│     ├─ Detecta novo ciclo                                   │
│     ├─ Verifica guardas (micro-URA, humano, fornecedor)     │
│     ├─ Chama analisarIntencao (se novo ciclo)              │
│     └─ Monta PreAtendimentoPayload                          │
│     ↓ PreAtendimentoPayload                                 │
├─────────────────────────────────────────────────────────────┤
│  4. PRÉ-ATENDIMENTO HANDLER                                 │
│     ├─ Verifica TTL de COMPLETED/CANCELLED                  │
│     ├─ Trata TIMEOUT (reload)                               │
│     ├─ Roteia para FluxoController baseado em estado        │
│     ↓ { user_input, intent_context, thread, contact }       │
├─────────────────────────────────────────────────────────────┤
│  5. FLUXO CONTROLLER                                        │
│     ├─ INIT: IA → Sticky → Menu                             │
│     ├─ WAITING_STICKY_DECISION                              │
│     ├─ WAITING_SECTOR_CHOICE                                │
│     ├─ WAITING_ATTENDANT_CHOICE → roteamentoInteligente    │
│     └─ WAITING_QUEUE_DECISION → gerenciarFila              │
│     ↓ FluxoResult                                           │
├─────────────────────────────────────────────────────────────┤
│  6. RESULTADO                                               │
│     └─ Estado atualizado + Mensagem enviada                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Regras de Negócio (Ordem de Prioridade)

**No `inboundCore.processInboundEvent`:**

1. **Reset Promoções** (se cliente respondeu)
2. **Micro-URA** (transferência pendente)
3. **Humano Ativo** (< 8h de inatividade)
4. **Guardas de Roteamento** (fornecedor, fidelizado)
5. **Análise de Intenção** (novo ciclo + texto)
6. **Pré-Atendimento** (URA ativa ou novo ciclo)

**No `FluxoController.processarEstadoINIT`:**

1. **Fast-track IA** (confidence >= 70)
2. **Sticky Setor** (memória de setor anterior)
3. **Menu Padrão** (fallback)

---

## 9. Estados da Máquina (MessageThread.pre_atendimento_state)

| Estado                        | Descrição                                      | Próximo Estado                          |
|-------------------------------|------------------------------------------------|-----------------------------------------|
| `INIT`                        | Início do fluxo                                | `WAITING_SECTOR_CHOICE` ou `WAITING_STICKY_DECISION` ou `WAITING_ATTENDANT_CHOICE` (fast-track) |
| `WAITING_STICKY_DECISION`     | Aguardando decisão de voltar ao setor anterior | `WAITING_ATTENDANT_CHOICE` ou `INIT`    |
| `WAITING_SECTOR_CHOICE`       | Aguardando escolha de setor                    | `WAITING_ATTENDANT_CHOICE`              |
| `WAITING_ATTENDANT_CHOICE`    | Buscando/atribuindo atendente                  | `COMPLETED` ou `WAITING_QUEUE_DECISION` |
| `WAITING_QUEUE_DECISION`      | Aguardando decisão de fila                     | `COMPLETED` ou `INIT`                   |
| `TRANSFERRING`                | Transferência em andamento                     | `COMPLETED`                             |
| `COMPLETED`                   | URA concluída (checkpoint cíclico)             | `INIT` (após TTL)                       |
| `CANCELLED`                   | URA cancelada pelo usuário                     | `INIT` (após TTL)                       |
| `TIMEOUT`                     | Timeout de inatividade                         | `INIT` (reset automático)               |

---

## 10. Políticas de TTL (Time-To-Live)

### COMPLETED / CANCELLED
- **Condição:** `!assigned_user_id` + `last_message_at >= 24h`
- **Ação:** Reset para `INIT` (novo ciclo na mesma thread)
- **Implementado em:** `preAtendimentoHandler.js` (linhas 114-139)

### TIMEOUT
- **Condição:** `pre_atendimento_timeout_at <= now`
- **Ação:** Reset para `INIT` + **reload thread** (evitar amnésia)
- **Implementado em:** `preAtendimentoHandler.js` (linhas 144-160)

---

## 11. Dependências e Responsabilidades

### inboundCore.js
- ✅ Normalizar `user_input`
- ✅ Detectar novo ciclo
- ✅ Verificar guardas (humano, fornecedor)
- ✅ Chamar `analisarIntencao` (quando aplicável)
- ✅ Montar `PreAtendimentoPayload`
- ✅ Disparar `preAtendimentoHandler`

### preAtendimentoHandler.js
- ✅ Verificar TTL de `COMPLETED`/`CANCELLED`
- ✅ Tratar `TIMEOUT` (reload)
- ✅ Rotear para `FluxoController` baseado em estado
- ✅ Registrar logs de automação

### FluxoController.js
- ✅ Executar lógica de cada estado
- ✅ Enviar mensagens (delegando a `enviarWhatsApp`)
- ✅ Atualizar estado da thread
- ✅ Decidir baseado em IA (`intent_context`)
- ✅ Implementar "Sticky Setor" (memória)
- ✅ Validação internalizada (sem dependências externas)

### analisarIntencao.js
- ✅ Analisar mensagem com LLM
- ✅ Retornar `IntentAnalysisResult` padronizado
- ✅ Nunca bloquear URA (sempre ter fallback)
- ✅ Blindar parse de resposta do LLM

---

## 12. Microserviços Auxiliares

### roteamentoInteligente
**Entrada:**
```javascript
{
  thread_id: string,
  contact_id: string,
  sector: string,
  check_only?: boolean,
  force_attendant_id?: string
}
```

**Saída:**
```javascript
{
  success: boolean,
  atendente_id?: string,
  atendente_nome?: string,
  error?: string
}
```

### gerenciarFila
**Entrada:**
```javascript
{
  action: 'enqueue' | 'dequeue' | 'remover',
  thread_id: string,
  setor?: string,
  metadata?: object
}
```

**Saída:**
```javascript
{
  success: boolean,
  posicao?: number,
  error?: string
}
```

---

## 13. Convenções de Nomenclatura

- **Funções:** `camelCase` (ex: `processarEstadoINIT`)
- **Estados:** `SCREAMING_SNAKE_CASE` (ex: `WAITING_SECTOR_CHOICE`)
- **Variáveis:** `snake_case` para DB, `camelCase` para código (ex: `thread_id`, `whatsappIntegrationId`)
- **Setores:** `lowercase` (ex: `vendas`, `assistencia`, `financeiro`)

---

## 14. Changelog

### v10.0.0 (2025-12-18)
- ✅ Criado contrato `UserInput` padronizado
- ✅ Criado contrato `IntentAnalysisResult` para IA
- ✅ Criado contrato `PreAtendimentoPayload` para handler
- ✅ Definida ordem de prioridade no pipeline
- ✅ Política de TTL para COMPLETED/CANCELLED
- ✅ Sticky Setor internalizado no FluxoController
- ✅ Validações internalizadas (remoção de validadores.js)
- ✅ Seleção de atendente delegada a microserviço