# 📡 FLUXO COMPLETO: Como webhookWapi.js é Usado

## 🎯 RESUMO EXECUTIVO

**O que é**: Endpoint HTTP que recebe eventos do W-API (provedor WhatsApp externo)

**URL de acesso**: `https://seu-app.base44.app/api/functions/webhookWapi`

**Quem chama**: Servidores da W-API (https://api.w-api.app) quando algo acontece no WhatsApp

**Quando é chamado**: 
- Cliente envia mensagem WhatsApp
- Status de conexão muda
- Mensagem é lida/entregue
- QR Code é gerado

---

## 🏗️ ARQUITETURA "PORTEIRO CEGO"

### Fase 1: Configuração (Manual - ConfiguracaoWhatsAppUnificado.jsx)
```javascript
// Admin acessa: Dashboard → Comunicacao → Configuração WhatsApp
// Cria integração manualmente ou via W-API Integrador

1. Preenche dados:
   - Nome da instância: "vendas-principal"
   - Instance ID: "T34398-VYR3QD..."
   - Token (Bearer): "eyJhbG..."
   - Webhook URL: "https://seu-app.base44.app/api/functions/webhookWapi"

2. Sistema salva em WhatsAppIntegration:
   {
     id: "abc123",
     nome_instancia: "vendas-principal",
     instance_id_provider: "T34398-VYR3QD...",
     api_key_provider: "eyJhbG...",  // 🔒 SEGURO NO BANCO
     api_provider: "w_api",
     webhook_url: "https://seu-app.base44.app/api/functions/webhookWapi"
   }

3. Webhook é registrado na W-API:
   POST https://api.w-api.app/v1/instance/webhook?instanceId=T34398-VYR3QD...
   Headers: { Authorization: "Bearer eyJhbG..." }
   Body: { webhook: "https://seu-app.base44.app/api/functions/webhookWapi" }
```

---

### Fase 2: Cliente Envia Mensagem WhatsApp

```
┌─────────────────────┐
│  Cliente WhatsApp   │
│  +5548999322400     │
│  "Oi, quero comprar"│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  W-API Provedor                        │
│  https://api.w-api.app                 │
│                                         │
│  1. Recebe mensagem do WhatsApp        │
│  2. Identifica instanceId              │
│  3. Busca webhook configurado          │
└──────────┬──────────────────────────────┘
           │
           │ HTTP POST
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  🚪 PORTEIRO CEGO (webhookWapi.js linha 824-909)               │
│  https://seu-app.base44.app/api/functions/webhookWapi         │
│                                                                 │
│  Payload recebido:                                             │
│  {                                                              │
│    "event": "ReceivedCallback",                                │
│    "instanceId": "T34398-VYR3QD...",  // 🔑 CRACHÁ           │
│    "phone": "5548999322400",                                   │
│    "msgContent": { "conversation": "Oi, quero comprar" },      │
│    "messageId": "msg_123"                                      │
│  }                                                              │
│                                                                 │
│  🔍 PORTEIRO: "Quem é este instanceId?"                        │
│  → Busca no banco: WhatsAppIntegration.filter({                │
│      instance_id_provider: "T34398-VYR3QD..."                  │
│    })                                                           │
│  → Encontra: integration_id = "abc123"                         │
│  → Token NUNCA é usado aqui (seguro no banco)                  │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  📝 PROCESSAMENTO (handleMessage - linha 392-819)              │
│                                                                 │
│  1. Normaliza telefone: +5548999322400                         │
│  2. Busca/cria Contact (contactManager - NÃO USA)              │
│     → Lógica INLINE (linhas 490-553)                           │
│     → 6 variações de telefone (+55489..., 55489..., etc)       │
│                                                                 │
│  3. Busca/cria Thread (contactManager - NÃO USA)               │
│     → Lógica INLINE (linhas 555-622)                           │
│     ❌ PROBLEMA: SEM is_canonical: true (linha 574-586)        │
│                                                                 │
│  4. 🔀 AUTO-MERGE: Se N > 1 threads (linhas 595-622)           │
│     → Marca antigas como merged_into                           │
│     → Define is_canonical: false nas antigas                   │
│     → Canônica = a mais recente (linha 564)                    │
│                                                                 │
│  5. Salva Message (linhas 664-698)                             │
│  6. Atualiza Thread (linhas 700-720)                           │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  🏛️ GERENTE (processInboundEvent - linha 754-793)              │
│                                                                 │
│  → Recebe: { thread_id, contact_id, message_id }               │
│  → Busca Token do banco (asServiceRole)                        │
│  → Decide: URA, IA, Transferência, Promoções                   │
│  → Envia respostas (usando Token seguro)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🐛 BUG DO ÉDER: Por que acontece?

### ❌ Estado Atual (Linha 574-586):
```javascript
thread = await base44.asServiceRole.entities.MessageThread.create({
  contact_id: contato.id,
  whatsapp_integration_id: integracaoId,
  status: 'aberta',
  // ... outros campos
  // ❌ FALTA: is_canonical: true
});
```

### 🔥 Problema:
1. Cliente envia 1ª mensagem → Thread A criada (sem `is_canonical`)
2. Sistema processa, tudo OK
3. Cliente envia 2ª mensagem → Busca thread (linha 559-566):
   ```javascript
   const threads = await base44.asServiceRole.entities.MessageThread.filter({
     contact_id: contato.id,
     whatsapp_integration_id: integracaoId
     // ❌ FALTA: is_canonical: true
   }, '-last_message_at', 1);
   ```
4. **RACE CONDITION**: Se 2 requisições chegam simultaneamente, AMBAS criam threads
5. Auto-merge tenta consertar (linha 595-622), mas:
   - Thread A: `is_canonical: true` (implícito como "a mais recente")
   - Thread B: `is_canonical: false` (marcada como merged)
   - **MAS**: Thread A **NUNCA** recebeu `is_canonical: true` explícito!

6. UI busca threads:
   ```javascript
   // ChatSidebar / Comunicacao
   const threads = await base44.entities.MessageThread.filter({
     whatsapp_integration_id: integracaoId
     // ❌ FALTA: is_canonical: true
   });
   // Resultado: Retorna TODAS (A + B) = conversas duplicadas
   ```

---

## ✅ CORREÇÃO CIRÚRGICA

### 1. Criar thread COM flag (linha 574):
```javascript
thread = await base44.asServiceRole.entities.MessageThread.create({
  contact_id: contato.id,
  whatsapp_integration_id: integracaoId,
  is_canonical: true,  // ✅ ADICIONAR
  status: 'aberta',
  // ... resto
});
```

### 2. Buscar thread SOMENTE canônicas (linha 559):
```javascript
const threads = await base44.asServiceRole.entities.MessageThread.filter({
  contact_id: contato.id,
  whatsapp_integration_id: integracaoId,
  is_canonical: true  // ✅ ADICIONAR
}, '-last_message_at', 1);
```

### 3. UI busca SOMENTE canônicas (ChatSidebar.jsx):
```javascript
const threads = await base44.entities.MessageThread.filter({
  whatsapp_integration_id: integracaoId,
  is_canonical: true  // ✅ ADICIONAR
});
```

---

## 🎯 IMPACTO DAS CORREÇÕES

### ✅ O que MELHORA:
- 🔥 **Bug do Éder**: Resolvido 100% (1 thread por contact+integration)
- 📊 **Performance**: Menos threads para processar
- 🧹 **Limpeza**: Auto-merge previne duplicação futura
- 💡 **Badges**: Contadores precisos (se aplicar correção #7)

### ✅ O que NÃO QUEBRA:
- 🔐 **Permissões**: `assigned_to_me` continua furando bloqueios
- 🔄 **Transferências**: Lógica intacta (assigned_user_id funciona)
- 📱 **Canais múltiplos**: Thread Z-API ≠ Thread W-API (OK)
- 👥 **Contact único**: Continua sendo único por telefone

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] **Correção #1**: `webhookWapi.js` linha 574 → `is_canonical: true`
- [ ] **Correção #2**: `webhookWapi.js` linha 559 → filtro `is_canonical: true`
- [ ] **Correção #3**: `webhookFinalZapi.js` (verificar linhas equivalentes)
- [ ] **Correção #4**: `contactManager.js` linhas 96 e 123
- [ ] **Correção #5**: `pages/Comunicacao.js` → filtro threads
- [ ] **Correção #6**: `components/comunicacao/ChatSidebar.jsx` → filtro threads
- [ ] **Teste**: Enviar 2 mensagens simultâneas (Postman + cURL)
- [ ] **Validação**: Verificar `is_canonical: true` no banco

**Tempo Estimado**: 15-20 minutos
**Risco**: Muito baixo (apenas adiciona filtro)
**Impacto**: Alto (resolve bug crítico)