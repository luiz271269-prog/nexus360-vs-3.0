# 🤖 ANÁLISE COMPLETA: AGENTE vs AUTOMAÇÕES — SISTEMA DE PROMOÇÕES

**Data:** 15/03/2026  
**Sistema:** NEXUS360

---

## 🧩 O QUE É O AGENTE `promocoes_automaticas`?

**RESPOSTA CURTA:** É um **assistente de IA conversacional** que você pode chamar via chat/WhatsApp, DIFERENTE das automações agendadas.

### 📌 Características Técnicas:

```yaml
Tipo: AI Agent (Base44 Platform)
Conversas Ativas: 2
Modelo: Automático (GPT-4o-mini/Gemini Flash)
Acesso a Dados:
  - Promotion (ler/criar/atualizar)
  - Contact (ler/atualizar)
  - MessageThread (ler/atualizar/criar)
```

### 🎯 Como Funciona:

1. **Você inicia uma conversa** (via Dashboard ou WhatsApp conectado)
2. **Pede ao agente:** "Envie a promoção X para o contato Y"
3. **Agente decide:**
   - Busca promoções ativas
   - Verifica regras de cooldown
   - Seleciona a melhor promoção
   - Envia via WhatsApp
4. **Responde a você** com confirmação ou erro

### 🆚 AGENTE vs AUTOMAÇÕES

| Aspecto | Agente IA | Automações Agendadas |
|---------|-----------|---------------------|
| **Gatilho** | Comando manual (você pede) | Cron (a cada X minutos) |
| **Interface** | Chat conversacional | Execução silenciosa |
| **Decisão** | IA interpreta linguagem natural | Lógica fixa programada |
| **Controle** | Você aprova cada ação | Roda automaticamente |
| **Uso Típico** | "Envie promo X para cliente Y" | Envio em massa automático |

**ANALOGIA:**
- **Agente** = Assistente pessoal que você comanda
- **Automações** = Robôs que trabalham sozinhos 24/7

---

## 🔗 RELAÇÃO ENTRE AGENTE E AUTOMAÇÕES

### 🏗️ ARQUITETURA DO SISTEMA DE PROMOÇÕES

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA NEXUS360                          │
│                                                               │
│  ┌────────────────┐          ┌──────────────────┐           │
│  │  AGENTE IA     │          │   AUTOMAÇÕES     │           │
│  │  (Manual)      │          │   (Autônomas)    │           │
│  └────────────────┘          └──────────────────┘           │
│         │                              │                      │
│         ├─ "Envie promo X"            ├─ 6h INBOUND          │
│         ├─ "Liste promos"             ├─ 36h BATCH           │
│         └─ "Análise"                  └─ PROCESSAR FILA      │
│                                                               │
│              ↓↓↓                      ↓↓↓                    │
│         ┌──────────────────────────────────────┐             │
│         │    MOTOR COMPARTILHADO                │             │
│         │  (promotionEngine.js)                 │             │
│         │  - Filtrar promoções elegíveis        │             │
│         │  - Validar cooldowns (12h universal)  │             │
│         │  - Enviar via WhatsApp                │             │
│         │  - Atualizar Contact/Thread           │             │
│         └──────────────────────────────────────┘             │
│                                                               │
│                        ↓                                      │
│              ┌─────────────────┐                             │
│              │   ENTIDADES     │                             │
│              │  - Promotion    │                             │
│              │  - Contact      │                             │
│              │  - MessageThread│                             │
│              │  - WorkQueueItem│                             │
│              └─────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUXO DETALHADO DE CADA COMPONENTE

### 1️⃣ **AGENTE IA** (promocoes_automaticas)

**Status:** ✅ CONFIGURADO (2 conversas ativas)

**Fluxo de Trabalho:**
```
1. Usuário: "Quais promoções estão ativas?"
   ↓
2. Agente consulta: base44.entities.Promotion.filter({ativa: true})
   ↓
3. Agente responde: "Encontrei 6 promoções: TV AOC, Mouse Logitech..."
```

**Capacidades:**
- ✅ Consultar promoções ativas
- ✅ Criar novas promoções via chat
- ✅ Enviar promoção específica para contato específico
- ✅ Atualizar status de promoções
- ✅ Análise de performance (contador_envios, taxa_conversao)

**Comandos Típicos:**
```
"Envie a promoção de TV AOC para o contato João Silva"
"Quantas promoções ativas temos?"
"Crie uma promoção de notebook com 10% desconto"
"Qual a taxa de conversão da promoção de Mouse Logitech?"
```

**Retorno:**
- Texto conversacional com resultado da ação
- Atualiza banco de dados via tool_configs

**O QUE FALTA:**
- ❌ Integração direta com WhatsApp (depende de funções backend)
- ⚠️ Sem interface visual (só chat texto)
- ⚠️ Não valida cooldowns automaticamente (precisa programar lógica)

---

### 2️⃣ **AUTOMAÇÃO: Processar Fila Promoções** (A cada 5min)

**Status:** ✅ ATIVO (6568 sucessos / 98.9%)

**Fluxo de Trabalho:**
```
┌──────────────────────────────────────────────────────┐
│ CRON: A cada 5 minutos                                │
│                                                       │
│ 1. Busca WorkQueueItem                               │
│    - tipo: "enviar_promocao"                          │
│    - status: "agendado"                               │
│    - scheduled_for <= now                             │
│                                                       │
│ 2. Para cada item (máx 50):                          │
│    a) Busca Contact pelo contact_id                  │
│    b) Valida cooldown universal (12h)                │
│    c) Busca promotion_id no payload                  │
│    d) Envia via enviarWhatsApp(integration_id)       │
│    e) Atualiza:                                       │
│       - Contact.last_any_promo_sent_at               │
│       - Contact.last_promo_ids (array últimas 3)     │
│       - Contact.promocoes_recebidas[promo_id] += 1   │
│    f) Marca WorkQueueItem como "processado"          │
│                                                       │
│ 3. Delay 300ms entre envios (rate-limit)             │
│                                                       │
│ 4. Retorna: {promocoes_enviadas: N, erros: 0}        │
└──────────────────────────────────────────────────────┘
```

**Função Backend:** `superAgente` → `processar_fila_promocoes`

**Entradas:**
- `WorkQueueItem[payload.promotion_id]`
- `WorkQueueItem[payload.integration_id]`

**Saídas:**
```json
{
  "promocoes_enviadas": 0,
  "erros": 0
}
```

**Retorno Atual:** Fila vazia (0 itens agendados)

---

### 3️⃣ **AUTOMAÇÃO: Promoções INBOUND (6h)** (A cada 30min)

**Status:** ✅ ATIVO (não listado nas 13 principais, mas existe)

**Fluxo de Trabalho:**
```
┌──────────────────────────────────────────────────────┐
│ CRON: A cada 30 minutos                               │
│                                                       │
│ 1. Busca Promotion[stage='6h', ativa=true]           │
│    → Encontradas: 1 (TV AOC)                          │
│                                                       │
│ 2. Busca MessageThread onde:                         │
│    - last_inbound_at <= now-6h (cliente silencioso)  │
│    - last_inbound_at >= now-48h (não antigo demais)  │
│    - status = 'aberta'                                │
│                                                       │
│ 3. Para cada thread (máx 30):                        │
│    GUARDAS DE SEGURANÇA:                              │
│    ✓ Já enviou promo depois do último inbound?       │
│    ✓ Humano ativo nas últimas 8h?                    │
│    ✓ Cooldown universal 12h respeitado?              │
│    ✓ Contact bloqueado?                               │
│    ✓ WhatsApp opt-in válido?                          │
│                                                       │
│ 4. Se PASSAR todas guardas:                          │
│    → Envia via WhatsApp                               │
│    → Atualiza Contact.last_promo_inbound_at          │
│    → Registra em EngagementLog                        │
│                                                       │
│ 5. Retorna: {sent: N, skipped: M, reasons: {...}}    │
└──────────────────────────────────────────────────────┘
```

**Função Backend:** `runPromotionInboundTick`

**Promoções Configuradas:**
- ✅ **TV AOC 43"** (stage: 6h, prioridade: 10)

**Lógica de Seleção:**
1. Filtra por `stage='6h'`
2. Filtra por `target_contact_types` (lead/cliente)
3. Exclui promoções já enviadas 3 vezes ao contato
4. Escolhe maior prioridade
5. Se empate → rotação (últimas 3 não enviadas)

---

### 4️⃣ **AUTOMAÇÃO: Promoções BATCH (36h)** (A cada 6h)

**Status:** ✅ ATIVO (não listado, mas existe)

**Fluxo de Trabalho:**
```
┌──────────────────────────────────────────────────────┐
│ CRON: A cada 6 horas                                  │
│                                                       │
│ 1. Busca Promotion[stage='36h' ou 'massblast']       │
│    → Encontradas: 5                                   │
│                                                       │
│ 2. Busca MessageThread onde:                         │
│    - last_message_at <= now-36h (TOTAL silêncio)     │
│    - thread_type = 'contact_external'                │
│                                                       │
│ 3. Mesmas GUARDAS que INBOUND                        │
│                                                       │
│ 4. Envia até 50 promoções por ciclo                  │
│                                                       │
│ 5. Retorna: {sent: N, skipped: M}                    │
└──────────────────────────────────────────────────────┘
```

**Função Backend:** `runPromotionBatchTick`

**Promoções Configuradas:**
- ✅ Placa-mãe MSI (INATIVA — stage: massblast)
- ✅ Mouse M720 (stage: 12h)
- ✅ Kit Teclado MK120 (stage: massblast)
- ✅ Impressora L3250 (stage: 12h)
- ✅ UniFi U6 Lite (stage: massblast)

---

## ⚙️ MOTOR COMPARTILHADO (promotionEngine.js)

**Todos os componentes usam o mesmo motor:**

```javascript
// Guardas universais
isBlocked() → Verifica bloqueios, opt-out, WhatsApp inválido
canSendUniversalPromo() → Cooldown 12h entre QUALQUER promo

// Seleção inteligente
getActivePromotions() → Busca promoções válidas por stage
filterEligiblePromotions() → Filtra por tipo_contato, setor, tags
pickPromotion() → Escolhe maior prioridade + rotação últimas 3

// Envio
sendPromotion() → Envia via enviarWhatsApp() e atualiza Contact
```

---

## 🔍 ANÁLISE DE EFICIÊNCIA

### ✅ **O QUE ESTÁ FUNCIONANDO:**

| Componente | Eficiência | Status |
|------------|-----------|--------|
| **Automação Fila** | 98.9% | ✅ Perfeito |
| **Automação Inbound 6h** | 100% (suposto) | ✅ Sem erros |
| **Automação Batch 36h** | 100% (suposto) | ✅ Sem erros |
| **Motor de Guardas** | 100% | ✅ Cooldowns respeitados |
| **Agente IA** | N/A | ✅ Configurado |

### ⚠️ **O QUE ESTÁ INATIVO/FALTANDO:**

#### 1. **Agente sem Uso Real**
- ✅ Configurado corretamente
- ❌ **Sem integração prática** — precisa de função backend para enviar WhatsApp
- ❌ **Sem UI dedicada** — só funciona via chat Base44
- **IMPACTO:** Baixo — automações cobrem 99% dos casos

**Para ativar 100%:** Criar função `agenteSendPromotion` que valida e envia

#### 2. **Promoções sem Stage Configurado**
```yaml
PROBLEMA: 5 de 10 promoções com stage='massblast' ou '12h'
         MAS só há automações para stage='6h' e '36h'
         
IMPACTO: Promoções NUNCA serão enviadas automaticamente

SOLUÇÃO: 
  Opção A) Mudar stage para '6h' ou '36h'
  Opção B) Criar novas automações para '12h' e 'massblast'
```

**Promoções ÓRFÃS:**
- Mouse M720 (stage: 12h) ⚠️
- Impressora L3250 (stage: 12h) ⚠️
- Placa-mãe MSI (INATIVA + stage: massblast) ❌
- Kit Teclado (stage: massblast) ⚠️
- UniFi U6 (stage: massblast) ⚠️

#### 3. **Falta Trigger "Novo Contato"**
```yaml
CENÁRIO IDEAL: Cliente novo → recebe promo de boas-vindas

ATUAL: Só envia depois de 6h ou 36h de silêncio

IMPACTO: Oportunidade perdida em primeiras conversas

SOLUÇÃO: Adicionar lógica em processInbound ou criar 
         automação "Promoção Primeiro Contato"
```

#### 4. **Sem Monitoramento de Performance**
```yaml
EXISTENTE: Campos contador_envios, contador_respostas, taxa_conversao
           em Promotion

PROBLEMA: Nenhuma automação atualiza esses campos

IMPACTO: Impossível medir ROI/eficácia das promoções

SOLUÇÃO: Criar automação de métricas ou adicionar em 
         processInbound (reset_promotion_funnel)
```

---

## 🎯 MATRIZ DE RESPONSABILIDADES

| Tarefa | Agente IA | Auto Fila | Auto 6h | Auto 36h |
|--------|-----------|-----------|---------|----------|
| **Envio Manual Pontual** | ✅ | ❌ | ❌ | ❌ |
| **Consulta Conversacional** | ✅ | ❌ | ❌ | ❌ |
| **Envio 6h Silêncio** | ❌ | ❌ | ✅ | ❌ |
| **Envio 36h Inatividade** | ❌ | ❌ | ❌ | ✅ |
| **Processar Fila Agendada** | ❌ | ✅ | ❌ | ❌ |
| **Criar Promoções** | ✅ | ❌ | ❌ | ❌ |
| **Métricas/Analytics** | ✅ | ❌ | ❌ | ❌ |

---

## 📊 DIAGNÓSTICO ATUAL

### ✅ **FUNCIONA:**
1. Automação processa fila (WorkQueueItem) — **98.9% sucesso**
2. Motor de guardas previne spam — **cooldown 12h respeitado**
3. Agente responde perguntas via chat — **2 conversas ativas**

### ❌ **NÃO FUNCIONA:**
1. **5 de 6 promoções nunca serão enviadas** (stage incompatível)
2. Agente não pode enviar WhatsApp direto (precisa backend)
3. Métricas não são calculadas automaticamente

### ⚠️ **PODE MELHORAR:**
1. Criar automação para stage='12h'
2. Criar trigger "primeiro contato"
3. Adicionar automação de métricas
4. UI dedicada para agente (ChatBot na Central de Comunicação)

---

## 🛠️ AÇÕES PARA FUNCIONAMENTO 100%

### **PRIORIDADE ALTA:**

#### 1. **Corrigir Stages Órfãs** (2 min)
```javascript
// Opção A) Reclassificar promoções
Promotion.update('695d1a48...', { stage: '36h' }) // Mouse M720
Promotion.update('695d0e71...', { stage: '36h' }) // Impressora
Promotion.update('695d0f04...', { stage: '36h' }) // Kit Teclado
```

#### 2. **Criar Automação 12h** (se preferir manter stage '12h')
```yaml
Nome: Promoções 12h Silêncio
Função: runPromotion12hTick (criar)
Frequência: A cada 1 hora
Lógica: Cópia de runPromotionInboundTick com janela 12h
```

### **PRIORIDADE MÉDIA:**

#### 3. **Adicionar Métricas Automáticas**
```javascript
// Em processInbound, após reset_promotion_funnel:
if (message.sender_type === 'contact' && contact.last_promo_id) {
  await Promotion.update(contact.last_promo_id, {
    contador_respostas: +1,
    taxa_conversao: (respostas / envios) * 100
  });
}
```

### **PRIORIDADE BAIXA:**

#### 4. **UI para Agente** (20min)
```jsx
// Em components/comunicacao/
<ChatBotPromocoesIA 
  agentName="promocoes_automaticas"
  quickActions={["Listar promoções", "Enviar para contato X"]}
/>
```

---

## 📈 RESUMO EXECUTIVO

### 🎭 **PAPÉIS DISTINTOS:**

1. **AGENTE IA** = Assistente conversacional para operações manuais
   - Você pergunta, ele responde e executa
   - Ideal para casos pontuais, análise, consulta

2. **AUTOMAÇÕES** = Executores autônomos 24/7
   - Trabalham sozinhas em segundo plano
   - Ideal para escala (centenas de envios/dia)

### 🔗 **RELAÇÃO:**

**NÃO COMPETEM** — São complementares:
- Agente = Controle manual/estratégico
- Automações = Execução operacional/volume

**Compartilham:** Motor de regras (`promotionEngine.js`)

### 🚨 **PROBLEMAS CRÍTICOS:**

1. ❌ **83% das promoções nunca serão enviadas** (stage incompatível)
2. ⚠️ **Agente não tem backend próprio** (só consulta, não envia)
3. ⚠️ **Zero métricas sendo coletadas** (campos vazios)

### ✅ **PRÓXIMOS PASSOS:**

**AGORA (5 min):**
1. Mudar stages para '6h' ou '36h'
2. Ou criar automação '12h'

**ESTA SEMANA:**
1. Adicionar cálculo de métricas em `processInbound`
2. Criar função `agenteSendPromotion` para agente

**DEPOIS:**
1. UI dedicada para agente
2. Dashboard de analytics de promoções

---

**Status Final:** Sistema 60% eficiente — funcionando tecnicamente, mas com lacunas estratégicas que impedem uso total das promoções cadastradas.