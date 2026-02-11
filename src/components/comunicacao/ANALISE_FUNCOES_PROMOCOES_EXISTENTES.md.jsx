# 🔍 ANÁLISE: Funções de Promoções Automáticas Existentes

**Data:** 2026-02-11  
**Objetivo:** Verificar redundância antes de criar novas funções

---

## 📋 FUNÇÕES EXISTENTES

### 1️⃣ `runPromotionInboundTick` (CRON - 6h)
**Arquivo:** `functions/runPromotionInboundTick.js`  
**Trigger:** Cron a cada 30min  
**Lógica:**
- Busca threads onde `last_inbound_at` foi **há 6+ horas**
- Filtra promoções com `stage='6h'`
- Guarda: humano ativo (8h), cooldown 12h, bloqueios
- Envia promoção direto (SEM saudação)
- Atualiza `last_promo_inbound_at`

**Usa:** `promotionEngine.js` completo ✅

---

### 2️⃣ `runPromotionBatchTick` (CRON - 36h)
**Arquivo:** `functions/runPromotionBatchTick.js`  
**Trigger:** Cron diário/6h  
**Lógica:**
- Busca threads **totalmente inativas há 36h+** (`last_message_at`)
- Filtra promoções com `stage='36h'`
- Cooldown 12h, bloqueios
- Envia promoção direto (SEM saudação)
- Atualiza `last_promo_batch_at`

**Usa:** `promotionEngine.js` completo ✅

---

### 3️⃣ `runCadenceTick` (CRON - Cadência)
**Arquivo:** `functions/runCadenceTick.js`  
**Trigger:** Cron periódico  
**Lógica:**
- Sistema de **cadência multi-estágio** (1/7...5/7)
- Busca `ContactEngagementState` com `next_touch_at <= now`
- Envia mensagens baseadas em **políticas** (`CyclePolicy`)
- Controle de janela de horário, caps diários
- Avança para próximo stage automaticamente

**Usa:** Entities `ContactEngagementState` + `CyclePolicy` ✅

---

### 4️⃣ `lib/promotionEngine.js` (MOTOR)
**Arquivo:** `functions/lib/promotionEngine.js`  
**Funções:**
- `isBlocked()` - Verifica bloqueios absolutos
- `getActivePromotions()` - Busca promoções ativas
- `filterEligiblePromotions()` - Filtra por tipo/setor/tags
- `pickPromotion()` - Seleciona com rotação inteligente
- `canSendUniversalPromo()` - Cooldown 12h universal
- `isHumanActive()` - Detecta atendente ativo
- `formatPromotionMessage()` - Formata mensagem
- `sendPromotion()` - Envia e registra no banco

**Status:** ✅ MOTOR COMPLETO E ROBUSTO

---

### 5️⃣ `agents/promocoes_automaticas.json` (AGENTE)
**Arquivo:** `agents/promocoes_automaticas.json`  
**Lógica:**
- Agente IA que verifica promoções ativas
- Envia ao contato quando inicia conversa
- Suporta imagem + formatação

**Status:** ⚠️ Não integrado com sistema de cron

---

### 6️⃣ `GerenciadorPromocoes.jsx` (UI)
**Arquivo:** `components/automacao/GerenciadorPromocoes.jsx`  
**Funcionalidade:**
- CRUD de promoções
- Upload de imagens
- Configuração de stages, targets, cooldown
- Métricas de envios/respostas

**Status:** ✅ UI COMPLETA

---

## 🆚 COMPARAÇÃO: Existente vs Solicitado

| ASPECTO | EXISTENTE | SOLICITADO | OVERLAP |
|---------|-----------|----------|---------|
| **Trigger** | Cron automático (6h/36h) | Manual (botão) | ❌ Diferente |
| **Alvo** | Todos threads elegíveis | Contatos urgentes específicos | ❌ Diferente |
| **Saudação** | ❌ Não envia | ✅ Saudação IA + 5min | ❌ Diferente |
| **Delay** | 0min (direto) | 5min entre saudação/promo | ❌ Diferente |
| **Seleção Promo** | ✅ Motor completo | ✅ Mesma lógica | ✅ REUTILIZAR |
| **Envio** | ✅ `sendPromotion()` | ✅ Mesma lógica | ✅ REUTILIZAR |
| **Bloqueios** | ✅ `isBlocked()` | ✅ Mesma lógica | ✅ REUTILIZAR |

---

## ✅ DECISÃO: REUTILIZAR MOTOR + NOVA FUNÇÃO

### O que JÁ EXISTE e deve ser REUTILIZADO:
1. ✅ `promotionEngine.js` - REUTILIZAR 100%
2. ✅ Entidade `Promotion` - OK
3. ✅ `GerenciadorPromocoes.jsx` - UI já existe
4. ✅ Automações cron (6h/36h) - Mantém funcionando

### O que é NOVO e necessário:
1. ❌ Função `enviarPromocoesLote` - Envio manual com saudação
2. ❌ Processador de fila com delay de 5min
3. ❌ Botão na UI "Contatos Urgentes"

---

## 🛠️ ARQUITETURA PROPOSTA

### Fluxo Completo:

```
Usuário clica "Enviar Promoções Auto" (49 contatos)
    ↓
[enviarPromocoesLote]
    ├─ Para cada contato:
    │   ├─ Buscar últimas 5 mensagens
    │   ├─ Gerar saudação contextualizada (IA)
    │   ├─ Enviar saudação
    │   ├─ Criar WorkQueueItem (scheduled_for: +5min)
    │   └─ payload: { promotion_id, integration_id }
    ↓
[AGUARDAR 5 MINUTOS]
    ↓
[processarFilaPromocoes] (cron a cada 1min)
    ├─ Buscar WorkQueueItems prontos
    ├─ Verificar se cliente NÃO respondeu
    │   ├─ Se respondeu → cancelar promoção
    │   └─ Se não respondeu → enviar promoção
    ├─ Usar promotionEngine.pickPromotion()
    ├─ Usar promotionEngine.sendPromotion()
    └─ Atualizar controles (last_promo_ids, etc)
```

---

## 🔄 INTEGRAÇÃO COM SISTEMA EXISTENTE

### Reutilizar do `promotionEngine.js`:

```javascript
import {
  isBlocked,           // ✅ Bloqueios (fornecedor, tags, etc)
  getActivePromotions, // ✅ Buscar promoções válidas
  filterEligiblePromotions, // ✅ Filtrar por tipo/setor
  pickPromotion,       // ✅ Seleção com rotação
  sendPromotion,       // ✅ Envio + registro
  readLastPromoIds,    // ✅ Histórico últimas 3
  writeLastPromoIds,   // ✅ Atualizar histórico
  canSendUniversalPromo // ✅ Cooldown 12h
} from './lib/promotionEngine.js';
```

### Novo: Apenas a camada de orquestração

```javascript
// enviarPromocoesLote.js
for (const contato of contatos) {
  // 1. Gerar saudação IA
  const saudacao = await gerarSaudacaoIA(contato, mensagens);
  
  // 2. Enviar saudação
  await enviarWhatsApp({ texto: saudacao });
  
  // 3. Agendar promoção (+5min)
  // ✅ REUTILIZAR: pickPromotion() do engine
  const promos = await getActivePromotions(base44, now);
  const eligible = filterEligiblePromotions(promos, contato, thread);
  const promo = pickPromotion(eligible, contato);
  
  await WorkQueueItem.create({
    tipo: 'enviar_promocao',
    scheduled_for: new Date(now + 5min),
    payload: { promotion_id: promo.id }
  });
}

// processarFilaPromocoes.js
for (const item of fila) {
  // ✅ REUTILIZAR: sendPromotion() do engine
  await sendPromotion(base44, { contact, thread, promo, trigger: 'lote_urgentes' });
}
```

---

## 📊 RESUMO

| COMPONENTE | STATUS | AÇÃO |
|------------|--------|------|
| `promotionEngine.js` | ✅ Existe | REUTILIZAR |
| `runPromotionInboundTick` | ✅ Existe (6h) | Mantém funcionando |
| `runPromotionBatchTick` | ✅ Existe (36h) | Mantém funcionando |
| `runCadenceTick` | ✅ Existe (cadência) | Mantém funcionando |
| `enviarPromocoesLote` | ❌ Nova | Criar (usa engine) |
| `processarFilaPromocoes` | ❌ Nova | Criar (usa engine) |
| Botão UI | ❌ Novo | Adicionar |
| WorkQueueItem entity | ❓ Verificar | Criar se não existe |

---

## ⚠️ PROBLEMAS DETECTADOS

### Erro: `processarFilaPromocoes` não encontrada

**Causa:** Função foi criada mas não deployou (erro no deploy?)

**Solução:** 
1. Verificar se `WorkQueueItem` entity existe
2. Simplificar lógica se necessário
3. Re-deploy

---

## 💡 RECOMENDAÇÃO FINAL

**✅ APROVEITAR:** 95% do código do `promotionEngine.js`  
**✅ CRIAR:** Apenas orquestração de lote + delay  
**✅ SIMPLICIDADE:** Usar WorkQueueItem OU delay direto (setTimeout no backend)

**Próximo passo:** Verificar se WorkQueueItem existe e corrigir deploy