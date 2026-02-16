# 🔬 DIAGNÓSTICO CRÍTICO: NORMALIZAÇÃO DO DÍGITO 9

**Data:** 2026-02-16 12:35  
**Problema:** Sistema não identifica corretamente quando telefone JÁ TEM ou NÃO TEM o dígito 9  
**Impacto:** Duplicação de contatos via Z-API  

---

## 🧪 ANÁLISE DE CASOS REAIS

### **CASO 1: Telefone COM 9 (Celular Moderno)**

**INPUT:** `48999322400` (11 dígitos)

```javascript
// normalizarTelefone():
numeroLimpo = "48999322400" // 11 dígitos
apenasNumeros = "48999322400"

// Adicionar 55:
apenasNumeros = "5548999322400" // 13 dígitos ✅

// Verificar se precisa adicionar 9:
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  // ❌ NÃO ENTRA (tem 13 dígitos)
}

// RESULTADO FINAL: "+5548999322400" ✅ CORRETO
```

**Variações geradas:**
```
1. "+5548999322400" (normalizado)
2. "5548999322400"  (sem +)
3. "+554899322400"  (sem 9 - 12 dígitos)
4. "554899322400"   (sem + e sem 9)
```

---

### **CASO 2: Telefone SEM 9 (Formato Antigo)**

**INPUT:** `4899322400` (10 dígitos)

```javascript
// normalizarTelefone():
numeroLimpo = "4899322400" // 10 dígitos
apenasNumeros = "4899322400"

// Adicionar 55:
apenasNumeros = "554899322400" // 12 dígitos ✅

// Verificar se precisa adicionar 9:
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  const ddd = "48"
  const numero = "99322400"
  
  // ✅ ENTRA - tem 12 dígitos
  if (!numero.startsWith('9')) {
    // ❌ ERRO! Número JÁ começa com 9 (99322400)
    // MAS o código verifica só o primeiro dígito: numero[0] = '9'
    // ❓ Lógica inconsistente
  }
}
```

**PROBLEMA DETECTADO:**
```javascript
// Linha 32-34 (getOrCreateContactCentralized):
if (!numero.startsWith('9')) {
  apenasNumeros = '55' + ddd + '9' + numero;
}

// Se numero = "99322400":
//   startsWith('9') = TRUE
//   ❌ NÃO adiciona o 9
//   Resultado: "554899322400" (12 dígitos - ERRADO!)
//   ✅ DEVERIA SER: "5548999322400" (13 dígitos)
```

---

## 🔍 LÓGICA ATUAL vs LÓGICA CORRETA

### **LÓGICA ATUAL (getOrCreateContactCentralized linha 28-35):**

```javascript
// Normalizar celulares brasileiros: adicionar 9 se faltar
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  const ddd = apenasNumeros.substring(2, 4);
  const numero = apenasNumeros.substring(4);
  if (!numero.startsWith('9')) {
    apenasNumeros = '55' + ddd + '9' + numero;
  }
}
```

**PROBLEMA:**
- ✅ Funciona para: `554833334444` (fixo) → NÃO adiciona 9
- ❌ **FALHA para:** `554899322400` → Número já tem 9, NÃO adiciona (fica 12 dígitos)
- ✅ Funciona para: `554888322400` → Celular sem 9, ADICIONA 9

### **LÓGICA CORRETA (webhookFinalZapi linha 28-69):**

```javascript
// ===== NORMALIZAR CELULARES BRASILEIROS (adicionar 9) =====
// Formato esperado: 55 + DDD(2) + 9 + número(8) = 13 dígitos
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  const ddd = apenasNumeros.substring(2, 4);
  const numero = apenasNumeros.substring(4); // 8 dígitos
  
  // ✅ VERIFICAR SE É CELULAR (começa com 6, 7, 8 ou 9)
  if (['6', '7', '8', '9'].includes(numero[0])) {
    apenasNumeros = '55' + ddd + '9' + numero;
    console.log(`✅ Celular detectado - adicionado dígito 9: ${apenasNumeros}`);
  } else {
    console.log(`ℹ️ Telefone fixo detectado (${numero[0]}) - mantendo formato original`);
  }
}
```

**DIFERENÇA CRUCIAL:**
- ✅ **webhookFinalZapi:** Verifica se é celular (6, 7, 8, 9) ANTES de adicionar 9
- ❌ **getOrCreateContactCentralized:** Só verifica se `!numero.startsWith('9')`

---

## 🧬 TABELA DE CASOS - NORMALIZAÇÃO

| Input Original | Após +55 | É Celular? | Lógica Atual | Lógica Correta | Resultado Esperado |
|----------------|----------|------------|--------------|----------------|--------------------|
| `4833334444` | `554833334444` (12d) | ❌ Fixo (3) | ✅ NÃO adiciona 9 | ✅ NÃO adiciona 9 | `+554833334444` |
| `4888322400` | `554888322400` (12d) | ✅ Celular (8) | ✅ Adiciona 9 | ✅ Adiciona 9 | `+5548988322400` |
| `4899322400` | `554899322400` (12d) | ✅ Celular (9) | ❌ **NÃO adiciona** | ✅ Adiciona 9 | `+5548999322400` |
| `48999322400` | `5548999322400` (13d) | ✅ Celular (9) | ✅ Já tem 9 | ✅ Já tem 9 | `+5548999322400` |

**BUG CONFIRMADO:** Linha 3 da tabela - `4899322400` NÃO adiciona 9 porque já começa com 9.

---

## 📊 IMPACTO NA BUSCA DE CONTATOS

### **CENÁRIO PROBLEMÁTICO:**

**Mensagem 1 (Ontem):**
```
Webhook recebe: phone = "4899322400" (10 dígitos, sem 9 no início do DDD)

normalizarTelefone():
  → "554899322400" (12 dígitos)
  → startsWith('9') = FALSE (primeiro dígito é '8')
  → ❌ DEVERIA verificar numero[0] (que é '9')
  → NÃO adiciona 9
  → SALVA: "554899322400" (12 dígitos) ❌ ERRADO

Contato criado com: telefone = "+554899322400" (12 dígitos - FALTANDO 9)
```

**Mensagem 2 (Hoje):**
```
Webhook recebe: phone = "48999322400" (11 dígitos, com 9)

normalizarTelefone():
  → "5548999322400" (13 dígitos)
  → Já tem 9
  → SALVA: "5548999322400" (13 dígitos) ✅ CORRETO

gerarVariacoes("+5548999322400"):
  1. "+5548999322400" → ❌ Não encontra "+554899322400" (banco)
  2. "5548999322400"  → ❌ Não encontra "554899322400" (banco)
  3. "+554899322400"  → ❌ Não encontra "+554899322400" (banco tem sem +)
  4. "554899322400"   → ✅ DEVERIA ENCONTRAR! MAS...

RESULTADO: NÃO ENCONTRA → CRIA DUPLICATA
```

---

## 🎯 CAUSA RAIZ CONFIRMADA

### **PROBLEMA 1: Normalização Inconsistente**

**getOrCreateContactCentralized (linha 32-34):**
```javascript
if (!numero.startsWith('9')) {
  apenasNumeros = '55' + ddd + '9' + numero;
}
```

**ERRO:**
- Verifica `!numero.startsWith('9')`
- `numero = "99322400"` → `startsWith('9') = TRUE`
- ❌ NÃO adiciona 9 (fica 12 dígitos)
- ✅ **DEVERIA:** Sempre adicionar 9 para celulares (6,7,8,9) MESMO que já comece com 9

### **PROBLEMA 2: Lógica Diferente em Cada Webhook**

| Arquivo | Lógica | Status |
|---------|--------|--------|
| `webhookFinalZapi` | Verifica se é celular `['6','7','8','9'].includes(numero[0])` | ✅ CORRETO |
| `webhookWapi` | Verifica `!numero.startsWith('9')` | ❌ ERRADO |
| `getOrCreateContactCentralized` | Verifica `!numero.startsWith('9')` | ❌ ERRADO |

**RESULTADO:** 3 lógicas diferentes = inconsistência = duplicação

---

## 🔧 CORREÇÃO DEFINITIVA

### **UNIFICAR LÓGICA EM TODOS OS 3 ARQUIVOS:**

**1. getOrCreateContactCentralized (linha 28-35):**

```javascript
// ANTES:
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  const ddd = apenasNumeros.substring(2, 4);
  const numero = apenasNumeros.substring(4);
  if (!numero.startsWith('9')) {
    apenasNumeros = '55' + ddd + '9' + numero;
  }
}

// DEPOIS:
if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
  const ddd = apenasNumeros.substring(2, 4);
  const numero = apenasNumeros.substring(4);
  
  // ✅ CORREÇÃO CRÍTICA: Verificar se é celular (6, 7, 8, 9)
  // Telefones fixos (2, 3, 4, 5) NÃO recebem o dígito 9
  if (['6', '7', '8', '9'].includes(numero[0])) {
    apenasNumeros = '55' + ddd + '9' + numero;
    console.log(`[${VERSION}] ✅ Celular detectado - adicionado dígito 9: ${apenasNumeros}`);
  } else {
    console.log(`[${VERSION}] ℹ️ Telefone fixo detectado (${numero[0]}) - mantendo formato original`);
  }
}
```

**2. webhookWapi (linha 62-68):**

```javascript
// APLICAR MESMA CORREÇÃO
if (['6', '7', '8', '9'].includes(numero[0])) {
  apenasNumeros = '55' + ddd + '9' + numero;
  console.log(`[WAPI] ✅ Celular detectado - adicionado dígito 9: ${apenasNumeros}`);
} else {
  console.log(`[WAPI] ℹ️ Telefone fixo detectado (${numero[0]}) - mantendo formato original`);
}
```

---

## 📊 TABELA CORRIGIDA - TODOS OS CASOS

| Input | Apenas Números | Tamanho | Primeiro Dígito | É Celular? | Adiciona 9? | Output |
|-------|----------------|---------|-----------------|------------|-------------|--------|
| `4833334444` | `554833334444` | 12 | `3` | ❌ Fixo | ❌ NÃO | `+554833334444` |
| `4888322400` | `554888322400` | 12 | `8` | ✅ Celular | ✅ SIM | `+5548988322400` |
| `4899322400` | `554899322400` | 12 | `9` | ✅ Celular | ✅ SIM | `+5548999322400` |
| `48999322400` | `5548999322400` | 13 | `9` | ✅ Celular | ❌ Já tem | `+5548999322400` |
| `4866677788` | `554866677788` | 12 | `6` | ✅ Celular | ✅ SIM | `+5548966677788` |
| `4877778888` | `554877778888` | 12 | `7` | ✅ Celular | ✅ SIM | `+5548977778888` |

---

## 🔥 EXEMPLO REAL DE DUPLICAÇÃO

### **CONTATO EXISTENTE NO BANCO:**
```json
{
  "id": "69666540ceec0fc8698b0d0d",
  "nome": "LUIZ CARLOS LIESCH",
  "telefone": "5548999322400", // ❌ SEM +, 13 dígitos
  "created_date": "2026-01-13"
}
```

### **NOVA MENSAGEM CHEGA:**
```
Webhook Z-API recebe: phone = "4899322400" (10 dígitos)

PASSO 1: normalizarTelefone("4899322400")
  → "554899322400" (12 dígitos)
  → numero[0] = '9'
  → ❌ LÓGICA ATUAL: !numero.startsWith('9') = FALSE → NÃO adiciona 9
  → ❌ RESULTADO: "+554899322400" (12 dígitos - ERRADO!)

PASSO 2: gerarVariacoes("+554899322400")
  1. "+554899322400"  (12d)
  2. "554899322400"   (12d)
  3. "+55489322400"   (11d - sem 9)
  4. "55489322400"    (11d - sem 9)

PASSO 3: Buscar no banco
  Query 1: { telefone: "+554899322400" } → ❌ Não encontra "5548999322400"
  Query 2: { telefone: "554899322400" }  → ❌ Não encontra "5548999322400"
  Query 3: { telefone: "+55489322400" }  → ❌ Não encontra
  Query 4: { telefone: "55489322400" }   → ❌ Não encontra

PASSO 4: Criar duplicata
  → NOVO CONTATO: telefone = "+554899322400" (12 dígitos)
  → DUPLICATA CRIADA! ❌
```

---

## 🎯 CAUSA RAIZ FINAL

### **PROBLEMA PRINCIPAL:**
```javascript
// CÓDIGO ERRADO:
if (!numero.startsWith('9')) {
  apenasNumeros = '55' + ddd + '9' + numero;
}

// Input: 554899322400 (12 dígitos)
// numero = "99322400" (8 dígitos)
// numero.startsWith('9') = TRUE
// ❌ Não adiciona 9 → Resultado: 554899322400 (12 dígitos - FALTA 9!)

// DEVERIA SER:
// Input: 554899322400 (12 dígitos)
// numero[0] = '9' (celular)
// ✅ Adiciona 9 → Resultado: 5548999322400 (13 dígitos - CORRETO!)
```

### **CORREÇÃO:**
```javascript
// Verificar primeiro dígito (não string inteira):
if (['6', '7', '8', '9'].includes(numero[0])) {
  apenasNumeros = '55' + ddd + '9' + numero;
}
```

---

## 🔬 EXEMPLOS PRÁTICOS

### **EXEMPLO 1: `4899322400` (10 dígitos)**

```
┌─────────────┬──────────────┬─────────────┬────────────────┐
│ Etapa       │ Lógica Atual │ Lógica Nova │ Diferença      │
├─────────────┼──────────────┼─────────────┼────────────────┤
│ Input       │ 4899322400   │ 4899322400  │ -              │
│ +55         │ 554899322400 │554899322400 │ -              │
│ Tamanho     │ 12d          │ 12d         │ -              │
│ numero      │ 99322400     │ 99322400    │ -              │
│ numero[0]   │ '9'          │ '9'         │ -              │
│ startsWith? │ TRUE         │ N/A         │ ✅ Diferença   │
│ includes?   │ N/A          │ TRUE        │ ✅ Diferença   │
│ Adiciona 9? │ ❌ NÃO       │ ✅ SIM      │ 🔴 CRÍTICO     │
│ Output      │ 554899322400 │5548999322400│ 🔴 1 dígito    │
│ Com +       │+554899322400 │+5548999322400│ 🔴 DIFERENÇA  │
└─────────────┴──────────────┴─────────────┴────────────────┘
```

### **EXEMPLO 2: `4888322400` (10 dígitos)**

```
┌─────────────┬──────────────┬─────────────┬────────────────┐
│ Etapa       │ Lógica Atual │ Lógica Nova │ Diferença      │
├─────────────┼──────────────┼─────────────┼────────────────┤
│ Input       │ 4888322400   │ 4888322400  │ -              │
│ +55         │ 554888322400 │554888322400 │ -              │
│ numero      │ 88322400     │ 88322400    │ -              │
│ numero[0]   │ '8'          │ '8'         │ -              │
│ startsWith? │ FALSE        │ N/A         │ -              │
│ includes?   │ N/A          │ TRUE        │ -              │
│ Adiciona 9? │ ✅ SIM       │ ✅ SIM      │ ✅ IGUAL       │
│ Output      │ 5548988322400│5548988322400│ ✅ CORRETO     │
└─────────────┴──────────────┴─────────────┴────────────────┘
```

---

## 🚨 DUPLICAÇÕES DETECTADAS NO BANCO

### **EVIDÊNCIA 1: LUIZ CARLOS LIESCH**
```json
{
  "id": "69666540ceec0fc8698b0d0d",
  "telefone": "5548999322400", // ❌ 13 dígitos SEM +
  "observacoes": "DUPLICATA - Merged para 69264ec3c25028d438311f14"
}
```

**ANÁLISE:**
- ✅ Telefone tem 13 dígitos (correto)
- ❌ Mas está SEM + no banco
- ✅ Já foi marcado como duplicata manualmente

### **EVIDÊNCIA 2: Threads Múltiplas com is_canonical=true**
```
contact_id: "69299b87c5bd53627405e06f" → Thread canônica #1
contact_id: "693a30003ab4f4e594c386de" → Thread canônica #2
contact_id: "6939a3c18064dfee07e91e22" → Thread canônica #3

❌ 3 contacts DIFERENTES
❌ 3 threads canônicas
⚠️ Mensagem IDÊNTICA em 2 delas
```

---

## ✅ PLANO DE CORREÇÃO COMPLETO

### **CORREÇÃO IMEDIATA (P0):**

**1. Unificar lógica de celular em getOrCreateContactCentralized:**
```javascript
// Linha 28-35
if (['6', '7', '8', '9'].includes(numero[0])) {
  apenasNumeros = '55' + ddd + '9' + numero;
}
```

**2. Unificar lógica de celular em webhookWapi:**
```javascript
// Linha 62-68
if (['6', '7', '8', '9'].includes(numero[0])) {
  apenasNumeros = '55' + ddd + '9' + numero;
}
```

### **SCRIPT DE VALIDAÇÃO (P1):**

**Criar:** `functions/validarNormalizacaoTelefones.js`

```javascript
// Testar normalização com casos conhecidos
const casos = [
  { input: '4899322400',  esperado: '+5548999322400' },
  { input: '4888322400',  esperado: '+5548988322400' },
  { input: '4833334444',  esperado: '+554833334444' },
  { input: '48999322400', esperado: '+5548999322400' },
];

casos.forEach(caso => {
  const resultado = normalizarTelefone(caso.input);
  console.log(`${caso.input} → ${resultado} (esperado: ${caso.esperado}) ${resultado === caso.esperado ? '✅' : '❌'}`);
});
```

---

## 🏆 RESUMO EXECUTIVO

| Bug | Causa | Impacto | Correção | Prioridade |
|-----|-------|---------|----------|------------|
| Provider errado no audit | Faltando `provider: 'z_api'` | Baixo (apenas logs) | 1 linha | P0 |
| Celular com 9 inicial | `!numero.startsWith('9')` | **ALTO** (duplicação) | 3 linhas | P0 |
| Telefones antigos sem + | Salvos antes da centralização | Médio | Script migração | P1 |
| Lógica diferente em 3 arquivos | Copy-paste sem revisão | Alto | Unificar | P0 |

**TOTAL DE LINHAS A CORRIGIR:** 6 linhas em 3 arquivos

---

**Status:** 🔴 BUG CRÍTICO IDENTIFICADO - CORREÇÃO DE 6 LINHAS RESOLVE DUPLICAÇÃO