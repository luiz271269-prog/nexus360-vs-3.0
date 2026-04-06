# 📊 ANÁLISE LINHA LÓGICA COMPLETA - CENTRAL DE COMUNICAÇÃO

**Data:** 12/02/2026  
**Status:** App em produção  
**Objetivo:** Unificar arquitetura de envios (massa / promoções / automáticos)

---

## 🎯 VISÃO GERAL DO SISTEMA ATUAL

### **3 Caminhos de Envio Identificados**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CENTRAL DE COMUNICAÇÃO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1️⃣ ENVIO MANUAL (UI)                                           │
│     └─> MessageInput.jsx                                        │
│         └─> enviarMensagemUnificada (thread-based)              │
│             └─> enviarWhatsApp (provider-level)                 │
│                                                                   │
│  2️⃣ ENVIO EM MASSA (Broadcast)                                  │
│     └─> enviarMensagemMassa                                     │
│         └─> enviarWhatsApp (direto)                             │
│                                                                   │
│  3️⃣ PROMOÇÕES LOTE (Orquestrado)                                │
│     └─> enviarPromocoesLote                                     │
│         ├─> Saudação: enviarWhatsApp (síncrono)                │
│         └─> Promoção: WorkQueueItem → processarFilaPromocoes   │
│             └─> sendPromotion() do promotionEngine              │
│                 └─> enviarWhatsApp                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 PROBLEMA RAIZ - ERRO 400 EM MASSA

### **Logs de Produção (11/02/2026 15:01)**
```
[PROMO-LOTE] Processando 49 contatos...
[PROMO-LOTE] Concluído: 0 enviados, 49 erros
[ERROR] Request failed with status code 400 (todos os 49)
```

### **Causa Identificada**
```javascript
// ❌ ANTES (payload incompatível)
await base44.functions.invoke('enviarMensagemUnificada', {
  thread_id: thread.id,
  texto: mensagemSaudacao,
  integration_id: thread.whatsapp_integration_id
});

// ✅ CORRIGIDO
await base44.functions.invoke('enviarWhatsApp', {
  integration_id: thread.whatsapp_integration_id,
  numero_destino: contato.telefone,
  mensagem: mensagemSaudacao
});
```

**Aprendizado:** Quando 100% dos envios falham com 400 = schema/contrato errado.

---

## 📋 COMPARATIVO DETALHADO

### **1. ENVIO EM MASSA vs PROMO-LOTE**

| Critério | enviarMensagemMassa | enviarPromocoesLote |
|----------|---------------------|---------------------|
| **Objetivo** | Broadcast único | Saudação + Promoção (2 etapas) |
| **IA/LLM** | ❌ Não usa | ✅ Gera saudação contextual |
| **Persistência** | ❌ Só retorno | ✅ WorkQueueItem |
| **Personalização** | 🟡 Placeholders {{nome}} | ✅ LLM contextual |
| **Delay** | ❌ 500ms fixo | ✅ 5 min programável |
| **Elegibilidade** | ❌ Nenhuma | ⚠️ Parcial (falta bloqueios) |
| **Rotação** | ❌ N/A | ⚠️ Importado mas não usa |
| **Cancelamento** | ❌ Não | ✅ Worker cancela por resposta |
| **N+1 Queries** | ✅ Busca threads 1x1 | ❌ Thread + Mensagens 1x1 |

### **2. WORKER (processarFilaPromocoes) - PADRÃO OURO ✅**

```javascript
// ✅ ESTÁ CORRETO
for (const item of items) {
  // 1. Verifica resposta do cliente
  if (thread.last_inbound_at > metadata.saudacao_enviada_em) {
    await update(item.id, { status: 'cancelado' });
    continue;
  }

  // 2. Envia via promotionEngine (reutiliza toda lógica)
  await sendPromotion(base44, { contact, thread, promo, trigger });

  // 3. Registra histórico de rotação
  const lastIds = readLastPromoIds(contato);
  const nextIds = writeLastPromoIds(lastIds, promotion_id);
  await Contact.update({ last_promo_ids: nextIds });

  // 4. Marca item como processado
  await WorkQueueItem.update(item.id, { status: 'processado' });
}
```

**Por que é padrão ouro:**
- ✅ Respeita cooldown universal (12h)
- ✅ Valida bloqueios (fornecedor, tags, setor)
- ✅ Rotação inteligente (últimas 3)
- ✅ Cancelamento condicional
- ✅ Registro completo (mensagem + histórico)

---

## 🚨 GAPS CRÍTICOS NO PROMO-LOTE

### **Gap 1: N+1 Queries**
```javascript
// ❌ ATUAL (ruim para 50+ contatos)
for (const contato of contatos) {
  const thread = await MessageThread.filter({ contact_id: contato.id });
  const mensagens = await Message.filter({ thread_id: thread.id });
}

// ✅ SOLUÇÃO
const threadIds = contatos.map(c => c.id);
const threadsMap = await MessageThread.filter({
  contact_id: { $in: threadIds },
  is_canonical: true
});
// Reduzir mensagens: buscar apenas last_inbound_at (já está no thread)
```

### **Gap 2: LLM no Loop Síncrono**
```javascript
// ❌ ATUAL (49 chamadas LLM = lento + caro + rate-limit)
for (const contato of contatos) {
  const saudacao = await base44.integrations.Core.InvokeLLM({
    prompt: `Gere saudação para ${contato.nome}...`
  });
}

// ✅ OPÇÃO 1: LLM no Worker (assíncrono)
// Agenda WorkQueueItem sem saudação
// Worker gera + envia

// ✅ OPÇÃO 2: Template + Placeholders (rápido)
const saudacao = `Olá ${contato.nome}! Como vai?`;
```

### **Gap 3: Não Valida Bloqueios**
```javascript
// ❌ FALTA no enviarPromocoesLote
const { blocked, reason } = isBlocked({
  contact: contato,
  thread,
  integration: integracaoDefault
});

if (blocked) {
  console.log(`[PROMO-LOTE] ⛔ Bloqueado: ${reason}`);
  continue;
}
```

### **Gap 4: Não Registra Histórico**
```javascript
// ❌ FALTA: Atualizar last_promo_ids após agendar
// Isso faz a rotação não funcionar de verdade
await Contact.update(contato.id, {
  last_promo_ids: writeLastPromoIds(lastIds, promotion_id)
});
```

---

## ✅ ARQUITETURA UNIFICADA RECOMENDADA

### **Princípio:** Separação de Responsabilidades

```
┌────────────────────────────────────────────────────────────┐
│              CAMADA DE DISPARO (Síncrono)                  │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  • enviarMensagemMassa (broadcast simples)                 │
│    └─> Envia direto via enviarWhatsApp                     │
│                                                              │
│  • enviarPromocoesLote (orquestrador)                      │
│    ├─> Valida bloqueios absolutos                         │
│    ├─> Envia saudação (opcional)                          │
│    └─> Cria WorkQueueItem com payload completo            │
│                                                              │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│          CAMADA DE PROCESSAMENTO (Assíncrono)              │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  • processarFilaPromocoes (worker a cada 5 min)           │
│    ├─> Valida resposta do cliente                         │
│    ├─> Verifica cooldown/horário                          │
│    ├─> Chama sendPromotion() do engine                    │
│    └─> Registra histórico completo                        │
│                                                              │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│              CAMADA DE ENVIO (Agnóstico)                   │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  • enviarMensagemUnificada (thread-based, UI-friendly)    │
│    └─> Resolve connectionId + contactId + threadId        │
│        └─> Delega para enviarWhatsApp                     │
│                                                              │
│  • enviarWhatsApp (provider-level)                        │
│    └─> Z-API / W-API / Evolution (unificado)              │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 PLANO DE AÇÃO (PRIORIZADO)

### **P0 - Urgente (Produção)**
1. ✅ **FEITO:** Corrigir payload 400 (enviarWhatsApp direto)
2. ⏳ **Adicionar logs detalhados de erro**
   ```javascript
   catch (error) {
     const detalhes = error.response?.data || error.data || error.message;
     console.error('[PROMO-LOTE] ❌', JSON.stringify(detalhes, null, 2));
   }
   ```

3. ⏳ **Validar bloqueios antes de agendar**
   ```javascript
   const { blocked, reason } = isBlocked({ contact, thread, integration });
   if (blocked) continue;
   ```

### **P1 - Alta (Performance)**
4. ⏳ **Otimizar queries N+1**
   - Buscar threads em lote ($in)
   - Reduzir busca de mensagens (usar thread.last_inbound_at)

5. ⏳ **Mover LLM para worker** (ou usar template)
   - Opção A: Saudação genérica + placeholders
   - Opção B: LLM assíncrono no worker

### **P2 - Importante (Consistência)**
6. ⏳ **Registrar histórico no lote**
   ```javascript
   await Contact.update(contato.id, {
     last_promo_ids: writeLastPromoIds(lastIds, promotion_id),
     last_any_promo_sent_at: now.toISOString() // CRÍTICO
   });
   ```

7. ⏳ **Unificar contrato de envio**
   - Definir: thread-based OU phone-based
   - Centralizar em 1 função (enviarMensagemUnificada)

---

## 📊 MÉTRICAS DE SUCESSO

### **Antes (11/02/2026)**
```
✅ Enviados: 0
❌ Erros: 49 (100%)
⏱️ Tempo: ~2-3s (sync)
💰 Custo LLM: 49 chamadas
```

### **Depois (Meta)**
```
✅ Enviados: 95%+
❌ Erros: <5%
⏱️ Tempo: <1s agenda + 5min worker
💰 Custo LLM: 0 (template) ou async
📊 Rastreabilidade: 100% (WorkQueueItem)
```

---

## 🎯 DECISÃO FINAL - QUEM FAZ O QUÊ

### **enviarMensagemMassa**
- **Quando:** Broadcast único e simples
- **Validações:** Nenhuma (responsabilidade do usuário)
- **Exemplo:** Aviso de manutenção, comunicado geral

### **enviarPromocoesLote**
- **Quando:** Promoções urgentes com contexto
- **Validações:** Bloqueios absolutos (fornecedor/tags)
- **Envio:** Saudação imediata + Agenda promoção
- **Exemplo:** "Base ativa há 30+ dias sem compra"

### **processarFilaPromocoes (Worker)**
- **Quando:** Sempre que tem item agendado
- **Validações:** Tudo (resposta, cooldown, horário)
- **Envio:** Via sendPromotion() do engine
- **Exemplo:** Processa fila a cada 5 minutos

---

## 🔐 CONTRATO ÚNICO RECOMENDADO

```typescript
// 🎯 FUNÇÃO ÚNICA PARA TODA A APP
enviarMensagemUnificada({
  connectionId: string,      // WhatsAppIntegration.id
  threadId: string,          // MessageThread.id
  contactId: string,         // Contact.id
  content: string,
  mediaType?: 'none' | 'image' | 'video' | 'document',
  mediaUrl?: string,
  replyToMessageId?: string
})

// 🔄 ADAPTADOR INTERNO
enviarWhatsApp({
  integration_id: string,
  numero_destino: string,
  mensagem?: string,
  media_url?: string,
  media_type?: string
})
```

**Hierarquia:**
- UI → `enviarMensagemUnificada` (thread-based)
- Lote/Worker → `enviarWhatsApp` (phone-based, mais direto)
- Provider → Z-API/W-API (agnóstico)

---

## 📝 PRÓXIMOS PASSOS IMEDIATOS

1. ✅ **Corrigir payload** (feito)
2. ⏳ **Adicionar logs detalhados** (P0)
3. ⏳ **Validar bloqueios** (P0)
4. ⏳ **Otimizar queries** (P1)
5. ⏳ **Documentar contrato único** (P2)

---

## 🔗 ARQUIVOS DE REFERÊNCIA

```
functions/
├── enviarMensagemMassa       ✅ Broadcast simples
├── enviarPromocoesLote       ⚠️ Needs fixes (P0-P1)
├── processarFilaPromocoes    ✅ Padrão ouro
├── enviarMensagemUnificada   🔄 Thread-based
├── enviarWhatsApp            🔄 Provider-level
└── lib/
    └── promotionEngine.js    ✅ Core logic

components/comunicacao/
├── MessageInput.jsx          🎨 UI manual
├── ModalEnvioMassa.jsx       🎨 UI broadcast
└── ContatosRequerendoAtencao 🎨 UI promo-lote
```

---

**Última atualização:** 12/02/2026  
**Revisão necessária:** Após implementar P0-P1