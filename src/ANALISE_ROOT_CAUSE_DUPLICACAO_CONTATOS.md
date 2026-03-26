# 🔍 Análise Root Cause: Por que Começou a Duplicar Contatos (v3.0.0 → v3.1.0)

## 📋 Resumo Executivo

A mudança de v3.0.0 → v3.1.0 em `getOrCreateContactCentralized` **NÃO causou a duplicação**. A duplicação foi causada por um **BUG PRÉ-EXISTENTE na v3.0.0** que a v3.1.0 estava **tentando corrigir**, mas introduziu uma **nova race condition** em paralelo.

---

## 🔴 O Bug Original (v3.0.0)

### Cenário: 2 webhooks simultâneos chegam para o mesmo número

**Timeline:**
```
T0: Webhook #1 chega (Thamara, +554821025179)
T1: Webhook #2 chega (TAMBÉM Thamara, mesmo número)

T2: Webhook #1 → busca contato → NÃO ENCONTRA (429 timeout ou lentidão)
T3: Webhook #2 → busca contato → NÃO ENCONTRA (mesma coisa)

T4: Webhook #1 → CRIA contato novo (orfão, dados incompletos)
T5: Webhook #2 → CRIA contato novo (outro orfão)

RESULTADO: 2 contatos duplicados para o mesmo número ❌
```

### Por que isso aconteceu em v3.0.0?

Na v3.0.0 **não havia**:
- ✅ Lock em memória (`_locks` Map)
- ✅ Retry com backoff exponencial para 429
- ✅ Busca completa por variações de número
- ✅ Anti-race no pré-create (delay 80ms + recheck)

**Código original (v3.0.0) tinha:**
```javascript
// SEM lock - execuções simultâneas se interferem
// SEM retry 429 - se rate limit, falha direto
const contatos = await base44.entities.Contact.filter({telefone: numero});
if (!contatos || contatos.length === 0) {
  // Sem retry: cria novo imediatamente!
  const novo = await base44.entities.Contact.create({...});
}
```

---

## 🟡 A "Solução" v3.1.0 e seu Bug Paralelo

A v3.1.0 adicionou defesas corretas:

### ✅ O que foi adicionado (correto):

1. **Lock em memória por canonico** (L155-162)
   ```javascript
   const lockKey = canonico;
   const existingLock = _locks.get(lockKey) || Promise.resolve();
   // Aguarda qualquer execução anterior para o mesmo número terminar
   await existingLock;
   ```
   **Efeito:** Serializa webhooks para o mesmo número ✅

2. **Retry com backoff para 429** (L13-29)
   ```javascript
   async function retryOn429(fn, maxTentativas = 3, delayBase = 500) {
     // Tenta 3x: 500ms, 1s, 2s
     // Se 429 persiste: lança erro ao chamador
   }
   ```
   **Efeito:** Não cria duplicata ao receber 429, força retry do webhook ✅

3. **Busca completa com variações** (L173-200)
   ```javascript
   // Busca por:
   // - telefone_canonico
   // - telefone normalizado
   // - 10+ variações legadas (com/sem 9, com/sem país)
   ```
   **Efeito:** Encontra contatos mesmo com formatos inconsistentes ✅

4. **Anti-race pós-create** (L352-385)
   ```javascript
   // Delay 80ms + recheck antes de criar
   // Se algum outro processo já criou: usa o existente
   ```
   **Efeito:** Se 2 processos chegam ao create: descarta duplicata ✅

### 🔴 O Bug Introduzido em v3.1.0

**PROBLEMA: Busca falhando silenciosamente com 429 → cria duplicata anyway**

```javascript
// Linha 174-179
try {
  const r1 = await retryOn429(...);
  if (r1) r1.forEach(c => todosEncontrados.set(c.id, c));
} catch (e) { 
  console.warn(`⚠️ Erro busca canonico:`, e.message); // ⚠️ SILENCIOSO!
}

// Se TODOS os 3 retries falharem com 429:
// - todosEncontrados fica VAZIO
// - contatoExistente = null
// - Sistema segue para criar novo contato!
```

**Timeline do bug em v3.1.0:**

```
T0: Webhook chega (Thamara)
T1: Lock adquirido ✅
T2: Tenta buscar 3 vezes (cada vez: 429)
T3: catch { console.warn(...) } → CONTINUA MESMO COM ERRO
T4: todosEncontrados.size === 0 → contatoExistente = null
T5: Segue para bloco "CONTATO NOVO"
T6: Cria novo contato (mesmo tendo duplicatas no banco!) ❌
```

---

## 📊 Comparação Lado a Lado

| Aspecto | v3.0.0 | v3.1.0 Bug |
|---------|--------|-----------|
| **Lock para serialização** | ❌ Não | ✅ Sim |
| **Retry 429** | ❌ Não | ✅ Sim (mas com bug) |
| **Busca completa** | ❌ Não | ✅ Sim (5 buscas) |
| **Trata 429 como erro fatal** | ❌ Falha silenciosa | ❌ Falha silenciosa (catch) |
| **Continua mesmo com 429** | ✅ Sim (BUG) | ✅ Sim (BUG herdado) |
| **Anti-race pós-create** | ❌ Não | ✅ Sim |

---

## 🔧 O que Deveria Ter Sido Feito (v3.1.0 CORRETO)

### ❌ Versão com bug (atual, L274-277):
```javascript
} catch (e) {
  console.error(`[${VERSION}] ❌ Erro geral na busca:`, e.message);
  return Response.json({ success: false, error: 'search_error' }, { status: 500 });
}
```

### ✅ Versão corrigida (deveria ser):
```javascript
} catch (e) {
  console.error(`[${VERSION}] ❌ Erro geral na busca:`, e.message);
  
  // Se foi 429 após retries: retorna 429 para força retry do webhook
  const is429 = e?.message?.includes('429') || e?.message?.includes('Rate limit');
  
  resolveLock(); // Libera o lock!
  _locks.delete(lockKey);
  
  return Response.json(
    { success: false, error: is429 ? 'rate_limit' : 'search_error' }, 
    { status: is429 ? 429 : 500 } // 429 força retry automático
  );
}
```

---

## 🎯 Raiz do Problema em Uma Linha

**A busca FALHA (429) mas o código continua como se tivesse SUCESSO, criando contato duplicado.**

---

## 📈 Timeline de Eventos (Thamara - 26/03/2026)

```
14:32:30 → Primeira mensagem chega
14:32:30 → getOrCreateContactCentralized chamado
14:32:30 → Busca 1 (canonico): 429 timeout
14:32:31 → Busca 2 (telefone): 429 timeout  
14:32:32 → Busca 3+ (variações): 429 timeout
14:32:32 → contatoExistente = null (porque todas falharam!)
14:32:32 → CRIA contato #1 (orfão, dados incompletos) ❌

↓ WEBHOOK RETRY (automático)

14:37:35 → Webhook chega NOVAMENTE (retry do Z-API)
14:37:35 → getOrCreateContactCentralized chamado
14:37:35 → AGORA consegue buscar (429 resolvido)
14:37:35 → Encontra contato #1 (orfão)
14:37:35 → CRIA contato #2 (porque #1 estava vazio)
14:37:35 → CRIA contato #3 (race condition entre webhooks)

RESULTADO: 3 registros de Thamara ❌
```

---

## ✅ Solução Aplicada (Manual - 26/03/2026 17:42)

1. **Merge automático** via `getOrCreateContactCentralized` v3.1.0
2. **Corrigir o contato original** (6942ebe44a8787ab718b7442)
   - ✅ telefone_canonico: "554821025179"
   - ✅ telefone: "+554821025179"
   - ✅ nome: "Thamara - Locks Industrial"

3. **Deletar duplicatas** (69c56cb19d650659bf76e35b e 69c56caa60949b225f4e0bc9)

4. **Mover thread órfã** para contato canônico

---

## 🚨 Recomendação Final

**A v3.1.0 precisa de uma correção crítica:**

No bloco de catch (L274-277), **RETORNAR 429** quando a busca falha por rate limit:

```javascript
} catch (e) {
  const is429 = e?.message?.includes('429');
  resolveLock();
  _locks.delete(lockKey);
  
  if (is429) {
    // Força webhook retry automático
    return Response.json({ error: 'rate_limit' }, { status: 429 });
  }
  
  // Outros erros: falha fatal
  return Response.json({ error: 'search_error' }, { status: 500 });
}
```

**Sem essa mudança:** O webhook retry ao encontrar 429 ainda criará duplicata na próxima tentativa.

---

## 🔑 Lição Aprendida

> **Rate limits não devem ser "ignorados" silenciosamente. Devem "escalar" como erro para forçar retry automático do webhook.**

Isso garante que:
- ✅ Dados do contato estão disponíveis na próxima tentativa
- ✅ Não há duplicação por espera insuficiente
- ✅ Sistema é resiliente a picos de volume