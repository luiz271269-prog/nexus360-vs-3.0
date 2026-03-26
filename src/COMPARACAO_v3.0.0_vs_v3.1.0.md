# 🔄 Comparação Detalhada: v3.0.0 vs v3.1.0

## 1️⃣ **LOCK EM MEMÓRIA**

### v3.0.0 ❌
```javascript
// NADA — sem lock
// Se 2 webhooks chegam simultâneos, ambos executam em paralelo
// Ambos NÃO encontram o contato → ambos CRIAM
```

### v3.1.0 ✅
```javascript
// Linhas 10-11
const _locks = new Map();

// Linhas 155-162
const lockKey = canonico;
const existingLock = _locks.get(lockKey) || Promise.resolve();
let resolveLock;
const newLock = new Promise(r => { resolveLock = r; });
_locks.set(lockKey, existingLock.then(() => newLock));
await existingLock; // ⭐ Aguarda o webhook anterior terminar
```

**Efeito:** Webhooks para o mesmo número são **serializados** (um por vez).

---

## 2️⃣ **RETRY COM BACKOFF EXPONENCIAL PARA 429**

### v3.0.0 ❌
```javascript
// Busca simples, sem retry
const contatos = await base44.entities.Contact.filter({telefone: numero});
// Se 429 → Error lançado → cria novo contato
```

### v3.1.0 ✅
```javascript
// Linhas 13-29
async function retryOn429(fn, maxTentativas = 3, delayBase = 500) {
  for (let i = 0; i < maxTentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      const is429 = e?.message?.includes('429') || 
                    e?.message?.includes('Rate limit') || 
                    e?.message?.includes('Limite de taxa');
      if (is429 && i < maxTentativas - 1) {
        const delay = delayBase * Math.pow(2, i); // 500ms, 1s, 2s
        console.warn(`[CENTRALIZED] 429 na busca, aguardando ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
}

// Uso (Linha 175)
await retryOn429(() => base44.asServiceRole.entities.Contact.filter(...))
```

**Efeito:** Tenta 3x antes de desistir (backoff: 500ms → 1s → 2s).

---

## 3️⃣ **BUSCA COMPLETA POR VARIAÇÕES**

### v3.0.0 ❌
```javascript
// Busca simples por um campo
const contatos = await base44.entities.Contact.filter({
  telefone: numero // OU
});
// Se número estiver em formato diferente no banco → NÃO ENCONTRA
```

### v3.1.0 ✅
```javascript
// Linhas 173-200
// Busca 1: por telefone_canonico (até 10 registros)
await retryOn429(() => base44.asServiceRole.entities.Contact.filter(
  { telefone_canonico: canonico }, 'created_date', 10
));

// Busca 2: por telefone normalizado (até 5 registros)
await retryOn429(() => base44.asServiceRole.entities.Contact.filter(
  { telefone: telefoneNormalizado }, 'created_date', 5
));

// Busca 3-N: por 10+ variações legadas
// Exemplos de variações para 5548999322400:
// - Com país: 554899322400, +554899322400
// - Sem país: 4899322400, 48999322400
// - Com/sem 9: 554848999322400 (13 dígitos)
// - E mais 7 variações...

for (const variacao of variacoes) {
  await retryOn429(() => base44.asServiceRole.entities.Contact.filter(
    { [campo]: variacao }, 'created_date', 3
  ));
}
```

**Efeito:** Encontra contatos mesmo com **formatos inconsistentes** no banco.

---

## 4️⃣ **MERGE AUTOMÁTICO DE DUPLICATAS**

### v3.0.0 ❌
```javascript
// Se encontra múltiplos contatos → escolhe o primeiro
// Resto é ignorado → duplicatas viram órfãs no banco
```

### v3.1.0 ✅
```javascript
// Linhas 204-271
if (lista.length > 1) {
  console.warn(`🔀 MERGE: ${lista.length - 1} duplicata(s)`);
  
  // PASSO 1: Merge dados (campos vazios preenchidos)
  for (const dup of lista.slice(1)) {
    for (const campo of camposEscalares) {
      if (vazio(valAtual) && !vazio(dup[campo])) {
        mergeData[campo] = dup[campo]; // ⭐ Herda dados do duplicado
      }
    }
    // Booleanos: true prevalece
    // Tags: union completa
  }
  
  // PASSO 2: Atualizar o canônico com dados do merge
  await base44.asServiceRole.entities.Contact.update(
    contatoExistente.id, mergeData
  );
  
  // PASSO 3: Deletar duplicatas
  for (const dup of lista.slice(1)) {
    await base44.asServiceRole.entities.Contact.delete(dup.id); // ⭐ Limpa
  }
}
```

**Efeito:** Quando encontra 3 contatos → **merge nos dados** do mais antigo + **deleta os outros**.

---

## 5️⃣ **ANTI-RACE PRÉ-CREATE**

### v3.0.0 ❌
```javascript
// Cria direto sem checar
const novo = await base44.entities.Contact.create({...});
// Se outro webhook criou no meio → 2 contatos com mesmo número
```

### v3.1.0 ✅
```javascript
// Linhas 317-332
// Delay de espera para outro webhook terminar
await new Promise(r => setTimeout(r, 80));

// Recheck: será que já foi criado?
const recheckAntes = await base44.asServiceRole.entities.Contact.filter(
  { telefone_canonico: canonico }, '-created_date', 1
);

if (recheckAntes && recheckAntes.length > 0) {
  // Alguém criou enquanto eu aguardava → usa o existente
  const existente = recheckAntes[0];
  await base44.asServiceRole.entities.Contact.update(existente.id, {...});
  return { contact: existente, action: 'deduplicated_pre_create' };
}

// Agora sim, cria com segurança
const novoContato = await base44.asServiceRole.entities.Contact.create({...});
```

**Efeito:** Se 2 webhooks chegam simultaneamente → **apenas 1 cria**, o outro usa.

---

## 6️⃣ **ANTI-RACE PÓS-CREATE**

### v3.0.0 ❌
```javascript
// Nada — se ambos criaram, ambos ficam no banco
```

### v3.1.0 ✅
```javascript
// Linhas 352-385
// Depois de criar, recheck se alguém criou antes
const recheck = await base44.asServiceRole.entities.Contact.filter(
  { telefone_canonico: canonico }, 'created_date', 2
);

if (recheck && recheck.length > 1) {
  const maisAntigo = recheck[0];
  if (maisAntigo.id !== novoContato.id) {
    // Eu criei DEPOIS de outro → merge meus dados no antigo + deleto a mim
    await base44.asServiceRole.entities.Contact.update(maisAntigo.id, mergeRace);
    await base44.asServiceRole.entities.Contact.delete(novoContato.id); // ⭐ Cleanup
    return { contact: maisAntigo, action: 'deduplicated' };
  }
}
```

**Efeito:** Se race condition acontece no create → **automaticamente limpa**.

---

## 📊 Tabela Resumida

| Feature | v3.0.0 | v3.1.0 |
|---------|--------|--------|
| **Lock em memória** | ❌ | ✅ |
| **Retry 429 com backoff** | ❌ | ✅ (500ms → 1s → 2s) |
| **Busca por variações** | ❌ (1 busca) | ✅ (5+ buscas) |
| **Merge automático** | ❌ | ✅ |
| **Anti-race pré-create** | ❌ | ✅ (delay 80ms + recheck) |
| **Anti-race pós-create** | ❌ | ✅ (recheck + cleanup) |
| **Linhas de código** | ~150 | ~393 |
| **Complexidade** | Simples (bugs) | Alta (mas segura) |

---

## 🎯 Exemplo Prático: Diferença em Ação

### Cenário: 2 webhooks simultâneos (Thamara, +554821025179)

### v3.0.0 Resultado ❌
```
T0: Webhook #1 chega
T1: Webhook #2 chega
T2: #1 busca → não encontra (sem retry)
T3: #2 busca → não encontra (sem retry)
T4: #1 cria contato A
T5: #2 cria contato B
RESULTADO: 2 DUPLICATAS NO BANCO ❌
```

### v3.1.0 Resultado ✅
```
T0: Webhook #1 chega
T1: Webhook #2 chega (aguarda fila)
T2: #1 adquire lock
T3: #1 busca (com retry 429)
T4: #1 encontra OU cria contato
T5: #1 libera lock
T6: #2 adquire lock
T7: #2 busca → encontra contato de #1
T8: #2 atualiza (sem criar)
RESULTADO: 1 CONTATO, ATUALIZADO ✅
```

---

## 🔴 BUG Remanescente em v3.1.0

Apesar dos avanços, há 1 bug:

**Se 429 persiste após 3 retries:**
- ❌ Sistema continua silencioso (catch absorve erro)
- ❌ Cria contato novo mesmo tendo duplicatas
- ✅ Deveria retornar HTTP 429 ao webhook para força retry

**Solução:** Retornar `{ status: 429 }` na linha 276 quando é 429.