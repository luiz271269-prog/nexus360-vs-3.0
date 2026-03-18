# 📊 ARQUITETURA DO SISTEMA DE PROMOÇÕES - v2.0

## 🎯 PRINCÍPIO FUNDAMENTAL: INDEPENDÊNCIA TOTAL DA URA

**As promoções são completamente independentes do pré-atendimento/URA.**

### ✅ O QUE PROMOÇÕES NUNCA FAZEM

1. ❌ NÃO alteram `pre_atendimento_ativo`
2. ❌ NÃO alteram `pre_atendimento_state`
3. ❌ NÃO alteram `sector_id` ou `setor_escolhido_id`
4. ❌ NÃO alteram `assigned_user_id`
5. ❌ NÃO iniciam/processam URA
6. ❌ NÃO dependem de "saudação" ou "escolha de setor"

### ✅ O QUE PROMOÇÕES FAZEM

1. ✅ Enviam mensagem WhatsApp
2. ✅ Registram histórico (`EngagementLog`)
3. ✅ Atualizam timestamps (`last_promo_sent_at`)
4. ✅ Respeitam bloqueios (FORNECEDOR, FINANCEIRO, COMPRAS)
5. ✅ Respeitam cooldowns (6h inbound, 24h batch)
6. ✅ Rotacionam promoções (não repetem a última)

---

## 🔄 TRIGGERS DE PROMOÇÃO

### 1️⃣ TRIGGER INBOUND (6h)

**Arquivo:** `functions/runPromotionInboundTick.js`  
**Execução:** Cron job a cada 1 hora  
**Lógica:**
- Busca threads onde `last_message_at` está entre 6-7h atrás
- Filtra apenas mensagens do CONTATO (não do sistema)
- Envia promoção se elegível

**Guardas:**
1. Humano ativo? (último user respondeu < 8h) → BLOQUEAR
2. Fornecedor/Financeiro/Compras? → BLOQUEAR
3. Cooldown 6h não passou? → BLOQUEAR
4. Sem promoção elegível? → PULAR

**Exemplo de timeline:**
```
10:00 - Cliente envia "oi"
        ↓ (sistema registra, não envia promo)
16:00 - Cron roda, detecta 6h
        ↓ (envia promoção)
16:01 - Cliente recebe promo
```

### 2️⃣ TRIGGER BATCH (24h)

**Arquivo:** `functions/runPromotionBatchTick.js`  
**Execução:** Cron job diário ou a cada 6 horas  
**Lógica:**
- Busca todos os contatos `lead` ou `cliente`
- Filtra quem não recebeu promoção nas últimas 24h
- Envia campanha massiva (limite: 50/execução)

**Guardas:**
1. Fornecedor/Financeiro/Compras? → BLOQUEAR
2. Cooldown 24h não passou? → BLOQUEAR
3. Sem promoção elegível? → PULAR

---

## 🚫 BLOQUEIOS ABSOLUTOS

**Nunca enviar promoções para:**

### Por `tipo_contato`:
- `fornecedor`

### Por `tags`:
- `fornecedor`
- `compras`

### Por `sector_id` (thread):
- `financeiro`
- `cobranca`
- `compras`
- `fornecedor`
- `fornecedores`

### Por `integration`:
- `tipo_canal === 'financeiro'`
- `tipo_canal === 'cobranca'`
- `setor_principal` em `['financeiro', 'cobranca', 'compras']`

---

## 🔐 COOLDOWNS E SEGURANÇA

### Cooldown por Contato
- **Inbound:** 6 horas
- **Batch:** 24 horas
- Campo: `contact.last_promo_sent_at`

### Cooldown por Thread
- **Inbound:** 6 horas
- Campo: `thread.thread_last_promo_sent_at`

### Anti-Repetição
- Sistema rotaciona promoções
- Nunca envia 2x seguidas a mesma promo
- Usa `contact.last_promo_id` para controle

---

## 📁 ARQUIVOS DO SISTEMA

### Core Engine
- `functions/lib/promotionEngine.js` - Motor de promoções (helpers)

### Cron Jobs (Triggers)
- `functions/runPromotionInboundTick.js` - Trigger 6h (inbound)
- `functions/runPromotionBatchTick.js` - Trigger 24h (campanhas)

### Pipeline Inbound
- `functions/lib/inboundCore.js` - **NÃO envia mais promoções**
- `functions/webhookWatsZapi.js` - Z-API webhook
- `functions/webhookWapi.js` - W-API webhook

---

## 🎨 FORMATOS DE MENSAGEM

### Teaser (quando thread tem setor)
```
🎁 Olá, {nome}! Temos ofertas especiais hoje. Quer ver?

1️⃣ Sim, quero ver
2️⃣ Não, obrigado
```

### Direct (completa, sem interação)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *NOTEBOOK GALAXY BOOK 4*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I5 - 16GB RAM - 512 SSD NVme

1. *Galaxy Book 4*
   ~~R$ 2800.00~~ → *R$ 2.299,90*

⏰ *Válido até:* 05/01/2025

_Interessado? Responda que te ajudo com o pedido!_ 🚀
```

---

## 🔄 FLUXO COMPLETO

### Exemplo 1: Cliente envia "Oi" às 10h

**Webhook (10:00:00):**
```
1. Registra mensagem
2. Atualiza thread.last_message_at = 10:00:00
3. ❌ NÃO envia promoção
4. ✅ Inicia URA (se necessário)
5. Cliente recebe menu de setores
```

**Cron Inbound (16:00:00):**
```
1. Busca threads entre 6-7h atrás
2. Encontra thread com last_message_at = 10:00:00
3. Verifica elegibilidade
4. ✅ Envia promoção
5. Cliente recebe promoção 6h depois
```

### Exemplo 2: Cliente envia "Oi" às 10h (segunda vez em 3 dias)

**Webhook (10:00:00):**
```
1. Detecta thread.sector_id já existe (vendas)
2. ✅ Aplica "sticky setor" (sem URA)
3. ❌ NÃO envia promoção (é webhook)
4. Cliente recebe confirmação do setor
```

**Cron Inbound (16:00:00):**
```
1. Encontra thread (6h atrás)
2. Verifica last_promo_sent_at (3 dias atrás)
3. ✅ Cooldown passou (> 6h)
4. ✅ Envia nova promoção
5. Cliente recebe promo diferente da última
```

---

## 🎯 SEGMENTAÇÃO

### Por Tipo de Contato
```javascript
target_contact_types: ["lead", "cliente"]
```

### Por Tags
```javascript
target_tags: ["interessado_notebook", "corporativo"]
```

### Por Setor (thread)
```javascript
target_sectors: ["vendas", "geral"]
```

---

## 📊 LOGS E AUDITORIA

### EngagementLog
```javascript
{
  contact_id: "...",
  thread_id: "...",
  type: "offer",
  status: "sent", // ou "failed", "blocked"
  provider: "z_api",
  message_id: "...",
  metadata: {
    promotion_id: "...",
    promotion_titulo: "...",
    format: "teaser",
    trigger: "inbound_6h", // ou "batch_24h"
    hours_since_last_message: "6.2"
  }
}
```

### Message
```javascript
{
  thread_id: "...",
  sender_id: "system",
  sender_type: "user",
  content: "🎁 Olá...",
  channel: "whatsapp",
  status: "enviada",
  metadata: {
    is_system_message: true,
    message_type: "promotion",
    promotion_id: "...",
    format: "teaser",
    trigger: "inbound_6h"
  }
}
```

---

## ⚙️ CONFIGURAÇÃO DE CRON JOBS

### Executar no Dashboard ou via Scheduler

```bash
# Trigger Inbound (a cada hora)
0 * * * * curl -X POST https://seu-app.base44.app/functions/runPromotionInboundTick

# Trigger Batch (diariamente às 9h)
0 9 * * * curl -X POST https://seu-app.base44.app/functions/runPromotionBatchTick
```

---

## 🚀 RESUMO EXECUTIVO

| Aspecto | Implementação |
|---------|---------------|
| **Independência URA** | ✅ Total - zero interferência |
| **Trigger Inbound** | ✅ Cron 6h (não webhook) |
| **Trigger Batch** | ✅ Cron 24h |
| **Bloqueios** | ✅ Fornecedor/Financeiro/Compras |
| **Cooldowns** | ✅ 6h (inbound) / 24h (batch) |
| **Anti-Repetição** | ✅ Rotação automática |
| **Logs Completos** | ✅ EngagementLog + Message |

---

## 📝 NOTAS FINAIS

1. **Promoções nunca quebram a URA** - são sistemas paralelos
2. **Webhooks apenas registram** - crons executam ações
3. **Cliente pode receber 2 mensagens** - promo (6h) + URA (reabertura)
4. **Ordem pode ser configurada** - adicionar delay entre promo e URA se necessário
5. **Fornecedor/Financeiro NUNCA recebem** - bloqueio em todas as camadas