# 🔴 ANÁLISE: 2 Bugs Visíveis nas Imagens (Matheus + Schulz)

## RESUMO EXECUTIVO

```
Bug 1: Notificação de transferência DUPLICADA
├─ Timestamp: 16/03 09:55 (mesmo segundo)
├─ Evento: "Conversa com Matheus transferida (→ vendas1)"
├─ Aparece: 2 VEZES
└─ Causa: Race condition — 2 listeners processando o mesmo trigger

Bug 2: Bot enviou "Bem-vindo!" para cliente EXISTENTE
├─ Cliente: Matheus da Silva
├─ Thread original: 13/03 (com Tiago)
├─ Novo áudio: 16/03 09:50
├─ Bot respondeu: "Bem-vindo!" (como se fosse primeiro contato)
└─ Causa: processInbound não encontrou thread canônica

CONEXÃO: Ambos causados por THREAD NÃO CANÔNICA processada em paralelo
```

---

## BUG 1: NOTIFICAÇÃO DE TRANSFERÊNCIA DUPLICADA

### O que aparece nas imagens:
```
09:55:00 → Conversa com Matheus da Silva transferida. (→ vendas1)
09:55:00 → Conversa com Matheus da Silva transferida. (→ vendas1)  ← DUPLICADA!
```

### Raiz do problema:

```
T0: Mensagem chega no webhook
    └─ Z-API: "Matheus enviou: [áudio]"

T1: processInbound processa (paralelo thread 1)
    ├─ Busca/cria Contact: Matheus
    ├─ Busca/cria MessageThread: encontra thread canônica
    ├─ Salva Message
    ├─ Dispara: Message.create() trigger
    └─ jarvisEventLoop acionado

T2: jarvisEventLoop processa (em resposta a Message.create)
    ├─ Analisa: intenção, setor, roteamento
    ├─ Detecta: "Deve transferir para vendas"
    ├─ Cria evento: TransferencyEvent
    ├─ Dispara: Thread.update() trigger
    └─ Notificação enviada ✓

T3: Segundo webhook paralelo (T1 + T2 rodando em paralelo)
    ├─ processInbound processa NOVAMENTE
    ├─ Mesma lógica
    ├─ jarvisEventLoop acionado NOVAMENTE
    └─ Notificação enviada 2ª vez ❌

Resultado:
├─ Event 1: Transferência disparada
├─ Event 2: Transferência disparada NOVAMENTE (mesmo segundo!)
└─ UI mostra: 2 notificações idênticas
```

### Por que acontece (em detalhes):

```
Arquivo: functions/jarvisEventLoop.js

async function jarvisEventLoop(event) {
  if (event.type === 'message.create') {
    // Buscar intent
    const intent = await analyzeIntent(event.data.content);
    
    if (intent.requires_transfer) {
      // 🔴 BUG: Sem deduplicação de eventos!
      // Se jarvisEventLoop rodou 2x para a mesma message_id,
      // dispara 2 transferências
      
      await transferThread(event.thread_id, intent.sector);
      
      // Resultado:
      // ├─ Primeiro jarvis: transferência OK
      // └─ Segundo jarvis: transferência duplicada!
    }
  }
}

// Solução: Verificar se evento já foi processado
async function jarvisEventLoop(event) {
  if (event.type === 'message.create') {
    // ✅ Checar deduplicação
    const alreadyProcessed = await EventLog.filter({
      message_id: event.data.id,
      event_type: 'transfer_triggered'
    });
    
    if (alreadyProcessed.length > 0) {
      return { status: 'deduplicated' };  // Já processado!
    }
    
    const intent = await analyzeIntent(event.data.content);
    
    if (intent.requires_transfer) {
      await transferThread(event.thread_id, intent.sector);
      
      // ✅ Registrar que foi processado
      await EventLog.create({
        message_id: event.data.id,
        event_type: 'transfer_triggered',
        timestamp: new Date()
      });
    }
  }
}
```

---

## BUG 2: BOT ENVIOU "BEM-VINDO!" PARA CLIENTE EXISTENTE

### O que aparece nas imagens:
```
13/03 08:20 → [Tiago respondeu: "..."]
...
16/03 09:50 → [Matheus envia áudio]
16/03 09:50 → Bot: "👋 Boa tarde, Matheus! Seja bem-vindo(a)! Em que posso te ajudar?"
```

### O problema:
- Thread existe desde **13/03** com o Tiago
- Áudio chega em **16/03 09:50**
- Bot tratou como "novo contato" e disparou saudação
- **Isso NÃO deveria acontecer** — conversa já existia!

### Raiz do problema:

```
Cenário 1: processInbound encontra thread MERGED (não canônica)
─────────────────────────────────────────────────────────────

T0: Matheus envia áudio (16/03 09:50)

T1: processInbound busca thread para o contato
    ├─ SELECT * FROM MessageThread
    │  WHERE contact_id = 'matheus_id'
    │  AND thread_type = 'contact_external'
    │  LIMIT 1
    ├─ ❌ PROBLEMA: Encontra thread B (merged)
    │  └─ Thread A (canônica): is_canonical=true, 60 msgs ← NÃO ACHOU!
    │  └─ Thread B (merged): is_canonical=false, 0 msgs ← ACHOU ESSA!
    │
    └─ Salva mensagem em Thread B

T2: Bot processa novamente
    ├─ Detecta: "primeira mensagem em thread B"
    ├─ Dispara: Saudação automática
    └─ Bot responde: "Bem-vindo!" ❌

T3: Sistema depois consolida threads
    ├─ Move msg de B para A (canônica)
    └─ Conversa fica confusa (saudação no meio!)


Cenário 2: processInbound cria NOVA thread
──────────────────────────────────────────

T0: Matheus envia áudio (16/03 09:50)

T1: processInbound busca thread
    ├─ SELECT * FROM MessageThread
    │  WHERE contact_id = 'matheus_id'
    │  AND is_canonical = true
    │  LIMIT 1
    ├─ ❌ Query timeout ou falha
    ├─ Cria NOVA thread C em vez de usar canônica
    └─ Salva em Thread C (nova)

T2: Bot processa
    ├─ Detecta: "nova thread para contato"
    ├─ Dispara: Saudação automática
    └─ Bot responde: "Bem-vindo!" ❌

T3: Sistema depois consolida
    ├─ Move msg de C para A (canônica)
    └─ Saudação fica no histórico confundindo tudo!
```

### Por que a thread canônica não foi encontrada:

```
Arquivo: functions/orquestradorProcessInbound.js

async function findOrCreateThread(contact_id, dados) {
  // ❌ BUG: Query frágil
  const thread = await MessageThread.filter({
    contact_id: contact_id,
    thread_type: 'contact_external'
  })[0];  // Pega primeira, pode ser qualquer uma!
  
  if (!thread) {
    // Cria nova thread
    return await MessageThread.create({
      contact_id: contact_id,
      thread_type: 'contact_external',
      is_canonical: true  // Mas a canônica já existe!
    });
  }
  
  return thread;
}

// ✅ SOLUÇÃO: Buscar canônica especificamente
async function findOrCreateThread(contact_id, dados) {
  // 1. Buscar thread canônica
  const canonicalThread = await MessageThread.filter({
    contact_id: contact_id,
    thread_type: 'contact_external',
    is_canonical: true
  })[0];
  
  if (canonicalThread) {
    return canonicalThread;  // Encontrou canônica!
  }
  
  // 2. Se não encontrou canônica, buscar qualquer thread
  const anyThread = await MessageThread.filter({
    contact_id: contact_id,
    thread_type: 'contact_external'
  })[0];
  
  if (anyThread && anyThread.status !== 'merged') {
    // Thread existe e não está merged
    return anyThread;
  }
  
  // 3. Se tudo falhar, criar nova (última opção!)
  return await MessageThread.create({
    contact_id: contact_id,
    thread_type: 'contact_external',
    is_canonical: true
  });
}
```

---

## 🔗 CONEXÃO: POR QUE OS 2 BUGS ACONTECEM JUNTOS

```
Causa-raiz comum: PROCESSAMENTO EM PARALELO + THREADS MÚLTIPLAS

Fluxo do desastre:

T0: Mensagem chega via webhook
    └─ Matheus envia áudio

T1: processInbound rodando (paralelo A)
    ├─ Busca thread: encontra Thread B (merged)
    ├─ Salva em Thread B
    └─ Dispara Message.create() trigger

T2: jarvisEventLoop rodando (paralelo B, resposta a T1)
    ├─ Detecta: "primeira mensagem em thread nova"
    ├─ Dispara: Bot saudação
    ├─ Dispara: Evento de transferência
    └─ Notificação 1 enviada

T3: processInbound rodando NOVAMENTE (paralelo A2)
    ├─ Webhook entregou mensagem 2x
    ├─ Busca thread: encontra Thread B NOVAMENTE
    ├─ Salva duplicata em Thread B
    └─ Dispara Message.create() trigger NOVAMENTE

T4: jarvisEventLoop rodando NOVAMENTE (paralelo B2, resposta a T3)
    ├─ Detecta: "nova mensagem, transferência necessária"
    ├─ Dispara: Evento de transferência NOVAMENTE
    └─ Notificação 2 enviada (duplicada!)

Resultado:
├─ 2 notificações de transferência (Bug 1)
├─ Bot respondeu "Bem-vindo!" para cliente existente (Bug 2)
└─ Thread está bagunçada
```

---

## ✅ SOLUÇÃO IMEDIATA (Para Matheus)

### Passo 1: Consolidar Thread (igual ao Schulz)
```
1. Abra a aba "🔧 Correção Cirúrgica de Vinculação"
2. Procure por "Matheus da Silva" (+554734516156)
3. Clique "Analisar"
   └─ Deve mostrar: N threads a mover
4. Clique "Corrigir Tudo"
5. Resultado: Todas as threads órfãs movidas para canônica
```

### Passo 2: Limpar Saudação Automática Duplicada
```sql
-- Buscar a saudação duplicada do bot em 16/03 09:50
SELECT id, content, created_date FROM Message 
WHERE thread_id = 'matheus_canonical_thread_id'
AND sender_type = 'user'
AND content LIKE '%Bem-vindo%'
AND DATE(created_date) = '2026-03-16'
ORDER BY created_date DESC;

-- Deletar o registro duplicado (se houver 2)
DELETE FROM Message 
WHERE id = 'message_id_da_saudacao_extra'
AND sender_type = 'user'
AND content LIKE '%Bem-vindo%';
```

### Passo 3: Validar
```
Esperado:
├─ 1 thread canônica para Matheus
├─ Todas as mensagens nela
├─ Apenas 1 saudação automática
└─ Histórico: 13/03 (Tiago) → 16/03 (Matheus, sem "bem-vindo!")
```

---

## ✅ CORREÇÃO DE CÓDIGO (Para Evitar com Outros)

### Fix 1: processInbound — Bloquear se dedup falhar

```javascript
// functions/processInbound.js / orquestradorProcessInbound.js

async function processarMensagem(dados) {
  // ✅ VERIFICAÇÃO DE DEDUP COM TIMEOUT
  try {
    const deduplicacaoTimeout = Promise.race([
      Message.filter({ whatsapp_message_id: dados.messageId }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('dedup_timeout')), 3000)
      )
    ]);
    
    const duplicata = await deduplicacaoTimeout;
    
    if (duplicata.length > 0) {
      // Já existe, retornar sem processar
      return {
        success: true,
        skipped: true,
        reason: 'duplicata_encontrada'
      };
    }
  } catch (err) {
    if (err.message === 'dedup_timeout') {
      // ✅ BLOQUEAR: Não continuar processamento
      return {
        success: false,
        status: 503,
        error: 'dedup_verification_failed',
        retry: true
      };
    }
    throw err;
  }
  
  // Continuar processamento normal...
}
```

### Fix 2: jarvisEventLoop — Deduplicar eventos de transferência

```javascript
// functions/jarvisEventLoop.js

async function handleTransferEvent(event) {
  // ✅ VERIFICAR se transferência já foi disparada
  const recentTransfer = await EventLog.filter({
    message_id: event.message_id,
    event_type: 'transfer_triggered',
    created_date: {
      $gte: new Date(Date.now() - 5000).toISOString()  // últimos 5 segundos
    }
  });
  
  if (recentTransfer.length > 0) {
    // Transferência já foi disparada
    return { status: 'deduplicated' };
  }
  
  // Disparar transferência
  await transferThread(event.thread_id, event.sector);
  
  // ✅ REGISTRAR que foi processado
  await EventLog.create({
    message_id: event.message_id,
    event_type: 'transfer_triggered',
    thread_id: event.thread_id,
    timestamp: new Date()
  });
}
```

### Fix 3: findOrCreateThread — Buscar canônica prioritariamente

```javascript
// functions/lib/inboundCore.js ou similar

async function findOrCreateThread(contact_id, dados) {
  // 1️⃣ Tentar encontrar thread canônica
  const canonicalThread = await MessageThread.filter({
    contact_id: contact_id,
    thread_type: 'contact_external',
    is_canonical: true
  })[0];
  
  if (canonicalThread && canonicalThread.status !== 'merged') {
    return canonicalThread;  // ✅ Canônica encontrada
  }
  
  // 2️⃣ Se não encontrou, buscar thread não-merged
  const openThread = await MessageThread.filter({
    contact_id: contact_id,
    thread_type: 'contact_external',
    status: { $ne: 'merged' }  // Não merged
  })[0];
  
  if (openThread) {
    // Se encontrou thread aberta, fazer ela canônica
    if (!openThread.is_canonical) {
      await MessageThread.update(openThread.id, {
        is_canonical: true
      });
    }
    return openThread;
  }
  
  // 3️⃣ Última opção: criar nova thread
  // (isso significa que a canônica não existe)
  return await MessageThread.create({
    contact_id: contact_id,
    thread_type: 'contact_external',
    is_canonical: true,
    status: 'aberta'
  });
}
```

---

## 📋 CHECKLIST EXECUÇÃO

### Imediato (hoje para Matheus):
- [ ] Executar Correção Cirúrgica de Vinculação
- [ ] Consolidar threads de Matheus
- [ ] Remover saudação automática duplicada
- [ ] Validar: 1 thread, sem "bem-vindo!" duplicado

### Código (próximos dias):
- [ ] Implementar Fix 1 em processInbound (bloquear se dedup falhar)
- [ ] Implementar Fix 2 em jarvisEventLoop (deduplicar eventos)
- [ ] Implementar Fix 3 em findOrCreateThread (buscar canônica)
- [ ] Testar com 2-3 novos contatos
- [ ] Deploy em produção

### Validação após fixes:
- [ ] Nenhuma notificação duplicada
- [ ] Bot não responde "bem-vindo!" para cliente existente
- [ ] Threads consolidadas corretamente
- [ ] Ordem de mensagens correta