# 🔍 ANÁLISE FORENSE: Duplicação de Mensagens (16/03 09:36:59)

## 1. EVIDÊNCIA VISUAL ENCONTRADA

### Tela mostra duplicação:
```
Guilherme: "Bom dia, tudo bem?"  [16/03 09:35]
Guilherme: "Bom dia, tudo bem?"  [16/03 09:35]  ← DUPLICADA!
Guilherme: "Tudo bem também?"    [16/03 09:36]
Tiago:     "Claro, vou verificar..." [resposta]
Guilherme: "Sobre esse pedido..." [16/03 09:36]
Guilherme: "Tudo bem também?"    [16/03 09:37]  ← DUPLICADA!
```

### Padrão identificado:
```
Mensagem 1: "Bom dia, tudo bem?" → APARECE 2x na tela
Mensagem 2: "Tudo bem também?" → APARECE 2x na tela

Taxa estimada: 2 de cada 6 mensagens são duplicadas (33% de duplicação)
```

---

## 2. ANÁLISE DOS LOGS WEBHOOK

### Linha do tempo detalhada (16/03 09:36:59):

```
09:36:59 [v10.0.0-PURE-INGESTION] 📥 Carga recebida (1/2):
         messageId: "3EB088DF055A2B821D601D"
         phone: "554896472000"
         message: "Tudo bem também?"
         momento: 1773664608000

09:36:59 [v10.0.0-INGESTÃO PURA] 💬 Nova mensagem de: +5548996472000
         Via: 554830452076

09:36:59 [v10.0.0-INGESTÃO PURA] ✅ Mensagem salva: 69b7f96b2b7d705d828637d7
         Mídia persistente: falsa

09:36:59 [v10.0.0-INGESTÃO PURA] 🔀 Tópico mesclado:
         6995b4d650aa48890bc93094 → 693ac07944bea5f785cc4f2a
         (Merge de 2 threads diferentes para 1 canônica)

09:36:59 [v10.0.0-INGESTÃO PURA] ✅ Mensagem salva: 69b7f96b2b7d705d828637d7
         (MESMA MESSAGE_ID do log anterior!)

09:37:00 [v10.0.0-PURE-INGESTION] 🎯 Invocando processInbound (adaptador)
         para thread: 693ac07944bea5f785cc4f2a

09:37:00 [v10.0.0-PURA-INGESTÃO] ✅ Mensagem salva: 69b7f96c977ceb0b0fb2111c
         De: +5548999176874

09:37:00 [v10.0.0-PURE-INGESTION] 🎯 Invocando processInbound (adaptador)
         para thread: 6995aad75d921358b54c7493

09:37:01 [v10.0.0-PURE-INGESTION] ✅ Mensagem salva: 69b7f96d832653d0123965ca
         De: +5548996472000

09:37:02 [v10.0.0-INGESTÃO PURA] ✅ SUCESSO! Msg: 69b7f96b2b7d705d828637d7
         De: +5548996472000
         Int: 68ecf26a5ca42338e76804a0 | 12748ms

09:37:03 [v10.0.0-INGESTÃO PURA] ✅ SUCESSO! Msg: 69b7f96d832653d0123965ca
         De: +5548996472000
         Interno: 68ecf26a5ca42338e76804a0 | 4793ms
```

---

## 3. ROOT CAUSE #1: WEBHOOK RECEBE MENSAGEM 2 VEZES

### Evidência nos logs:

```
WEBHOOK RECEBEU:
1️⃣ 09:36:59 (primeira chamada POST)
   messageId: "3EB088DF055A2B821D601D"
   message: "Tudo bem também?"
   ✅ Salvo em Message entity (message_id = 69b7f96b...)

2️⃣ 09:36:59 (segunda chamada POST - DUPLICADA)
   messageId: "3EB088DF055A2B821D601D" (MESMO!)
   message: "Tudo bem também?"
   ✅ Tentou salvar novamente (LÓGICA DE DEDUPLICAÇÃO FALHOU!)
```

### Por que a deduplicação não funcionou?

**Análise do código webhookFinalZapi.ts (linhas 639-655):**

```typescript
// ✅ DEDUPLICAÇÃO RIGOROSA - Se duplicata, ignora
if (dados.messageId) {
  try {
    const dup = await base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId },
      '-created_date',
      1 // Apenas a primeira
    );
    if (dup.length > 0) {
      console.log(`[${VERSION}] ⏭️ DUPLICATA por messageId: ${dados.messageId}`);
      return jsonOk({ success: true, ignored: true, reason: 'duplicata_message_id' });
    }
  } catch (err) {
    console.warn(`[${VERSION}] ⚠️ Erro ao verificar duplicata`);
    // ⚠️ CONTINUA PROCESSAMENTO MESMO COM ERRO!
  }
}
```

**🔴 PROBLEMA CRÍTICO:**

Se a query falhar (erro de conexão, timeout, etc.), o webhook **continua processando** e salva a mensagem duplicada.

---

## 4. ROOT CAUSE #2: THREAD MERGE DURANTE PROCESSAMENTO

### Logs mostram merge acontecendo:

```
09:36:59 [v10.0.0-INGESTÃO PURA] 🔀 Tópico mesclado:
         6995b4d650aa48890bc93094 → 693ac07944bea5f785cc4f2a
```

**Possível sequência:**

```
09:36:59 (primeira chamada webhook):
  ├─ Detecta contato +5548996472000
  ├─ Busca threads existentes
  ├─ Encontra 2 threads antigas (6995b4d... e 6995b4d65...)
  ├─ AUTO-MERGE: marca 1 como canônica, outra como merged
  └─ Salva mensagem em thread canônica

09:36:59 (segunda chamada webhook - mesma mensagem):
  ├─ Detecta MESMO contato +5548996472000
  ├─ Busca threads existentes novamente
  ├─ Encontra a thread canônica (já foi merged!)
  ├─ Query de deduplicação **falha com erro de conexão** (timeout do merge?)
  └─ CRIA DUPLICATA porque echo.warn() permite continuar

RESULTADO: Mesma mensagem salva 2x em 2 threads diferentes!
```

---

## 5. ROOT CAUSE #3: AUTO-MERGE CRIA RACE CONDITION

### Código do auto-merge (linhas 735-810):

```typescript
// 🔧 AUTO-MERGE: Unificar todas as threads antigas (ANTES de criar/usar)
try {
  const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter(
    { contact_id: contato.id },
    '-primeira_mensagem_at',
    20
  );

  if (todasThreadsContato && todasThreadsContato.length > 1) {
    // ⚠️ CRÍTICO: Múltiplas operações de UPDATE em paralelo:
    
    // 1. Atualiza thread A como canônica
    await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
      is_canonical: true,
      ...
    });

    // 2. Marca outras threads como merged
    for (const threadAntiga of todasThreadsContato) {
      if (threadAntiga.id !== threadCanonica.id) {
        await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
          status: 'merged',
          merged_into: threadCanonica.id,
          ...
        });
      }
    }
  }
}
```

**🔴 RACE CONDITION:**

```
Timeline com 2 webhooks simultâneos:

T1 (webhook A):
  ├─ getOrCreateContactCentralized() → contato X
  ├─ Busca threads: [Thread-A, Thread-B, Thread-C]
  └─ Inicia AUTO-MERGE...

T2 (webhook B - PARALELO):
  ├─ getOrCreateContactCentralized() → contato X (MESMO)
  ├─ Busca threads: [Thread-A, Thread-B, Thread-C]
  └─ Inicia AUTO-MERGE...

T3:
  ├─ Webhook A: UPDATE Thread-A ✅
  ├─ Webhook B: UPDATE Thread-A ⚠️ (conflito? ou OK?)
  └─ Webhook A: Salva mensagem em Thread-A
  └─ Webhook B: Salva mensagem em Thread-C (estava marcada como merged!)

RESULTADO: Mensagem aparece em 2 threads diferentes!
```

---

## 6. IMPACTO NA UI

### Por que o usuário vê duplicação:

```
MessageThread canvas renderiza TODAS as threads para um contato:
├─ Busca: MessageThread.filter({ contact_id: contato })
├─ Se retorna múltiplas threads (não apenas is_canonical=true)
└─ Component renderiza mensagens de TODAS as threads

Quando message "Tudo bem também?" é salva em DUAS threads:
├─ Thread-A: [msg_1, msg_2, msg_duplicada]
├─ Thread-C: [msg_a, msg_b, msg_duplicada]
└─ UI renderiza CONCATENADAS (não unificadas)

RESULTADO: Duplicação visível na tela
```

---

## 7. SOLUÇÕES RECOMENDADAS

### 🔴 CRÍTICO (hoje):

#### A) **Timeout na deduplicação** (linha 642)
```typescript
// ANTES (continuava mesmo com erro):
const dup = await base44.asServiceRole.entities.Message.filter(
  { whatsapp_message_id: dados.messageId },
  '-created_date',
  1
);
if (dup.length > 0) {
  // ...
} catch (err) {
  console.warn('Erro ao verificar duplicata');
  // ⚠️ CONTINUA SALVANDO!
}

// DEPOIS (bloqueia se não conseguir verificar):
try {
  const dup = await Promise.race([
    base44.asServiceRole.entities.Message.filter(
      { whatsapp_message_id: dados.messageId },
      '-created_date',
      1
    ),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 5000)
    )
  ]);
  
  if (dup.length > 0) {
    return jsonOk({ success: true, ignored: true, reason: 'duplicata_message_id' });
  }
} catch (err) {
  // ⚠️ BLOQUEIA: não pode processar sem saber se duplicata
  console.error('BLOQUEANDO: falha ao verificar duplicata');
  return jsonOk({ success: false, error: 'dedup_verification_failed' });
}
```

#### B) **Mutex/Lock no AUTO-MERGE** (linhas 735-810)
```typescript
// Implementar lock por contact_id para evitar race condition:
const MERGE_LOCKS = new Map(); // global

async function autoMergeComLock(contato_id) {
  // Se já tem lock, esperar
  while (MERGE_LOCKS.has(contato_id)) {
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Adquirir lock
  MERGE_LOCKS.set(contato_id, Date.now());
  
  try {
    // ... código do auto-merge ...
  } finally {
    // Liberar lock
    MERGE_LOCKS.delete(contato_id);
  }
}
```

#### C) **Renderizar apenas thread canônica no UI**
```typescript
// ANTES:
MessageThread.filter({ contact_id: contato })

// DEPOIS:
MessageThread.filter({ 
  contact_id: contato,
  is_canonical: true,  // ← APENAS canônica!
  status: 'aberta'
})
```

### ⚠️ IMPORTANTE (semana que vem):

1. Auditar todas as mensagens de 16/03 entre 09:30-09:45 para quantificar duplicatas
2. Implementar soft-delete para mensagens duplicadas (não remover, apenas marcar)
3. Adicionar campo `source_webhook_call_id` para rastrear duplicatas

---

## 8. CHECKLIST DE CORREÇÃO

- [ ] **Passo 1:** Adicionar timeout de 5s na query de deduplicação (linha 642)
- [ ] **Passo 2:** **BLOQUEAR** processamento se dedup falhar (não continuar com warn)
- [ ] **Passo 3:** Implementar mutex em auto-merge (uma thread por contato)
- [ ] **Passo 4:** Forçar UI renderizar apenas is_canonical=true (não multiple threads)
- [ ] **Passo 5:** Adicionar campo `webhook_call_id` em Message (para debug)
- [ ] **Passo 6:** Audit 16/03: Contar quantas duplicatas foram criadas

---

## 9. VALIDAÇÃO

```javascript
// Query para encontrar duplicatas reais:
SELECT whatsapp_message_id, COUNT(*) as qty
FROM Message
WHERE created_date >= '2026-03-16 09:30:00'
  AND created_date <= '2026-03-16 09:50:00'
  AND whatsapp_message_id IS NOT NULL
GROUP BY whatsapp_message_id
HAVING COUNT(*) > 1;

// Se retornar registros: duplicatas confirmadas
// Usar para cleanup e documentação
``