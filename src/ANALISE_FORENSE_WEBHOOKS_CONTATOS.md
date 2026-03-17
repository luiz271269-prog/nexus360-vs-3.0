# 🔍 ANÁLISE FORENSE: WEBHOOKS + CRIAÇÃO DE CONTATOS + DUPLICIDADE

**Data:** 2026-03-17 | **Versão Analisada:** `getOrCreateContactCentralized v2.0.0-CANONICAL-FIRST`

---

## 📋 SUMÁRIO EXECUTIVO

| Aspecto | Status | Severidade | Nota |
|---------|--------|-----------|------|
| **Centralização de Lógica** | ✅ COMPLETO | N/A | Função única em `getOrCreateContactCentralized` |
| **Duplicação de Código (Webhooks)** | ✅ ESPERADO | INFO | `normalizarTelefone()` duplicado em Z-API e W-API (obrigatório em Deno) |
| **Busca de Duplicatas** | ✅ ROBUSTO | N/A | 3 estratégias em cascata (canônico → normalizado → legado) |
| **Race Conditions** | ✅ PROTEGIDO | N/A | Anti-race condition implementado (recheck pós-create) |
| **Normalização de Telefone** | ⚠️ CRÍTICO | ALTO | Lógica complexa com 4 transformações em cascata |

---

## 🔬 ANÁLISE DETALHADA

### 1. DUPLICAÇÃO DE CÓDIGO ENTRE WEBHOOKS

#### **Z-API (webhookFinalZapi)**
```js
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const primeiroDigitoNumero = apenasNumeros[4];
    if (['6', '7', '8', '9'].includes(primeiroDigitoNumero)) {
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
    }
  }
  return '+' + apenasNumeros;
}
```

#### **W-API (webhookWapi)**
```js
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let apenasNumeros = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!apenasNumeros || apenasNumeros.length < 10) return null;
  apenasNumeros = apenasNumeros.replace(/^0+/, '');
  if (!apenasNumeros.startsWith('55')) {
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
      apenasNumeros = '55' + apenasNumeros;
    }
  }
  if (apenasNumeros.startsWith('55') && apenasNumeros.length === 12) {
    const primeiroDigito = apenasNumeros[4];
    if (['6', '7', '8', '9'].includes(primeiroDigito)) {
      apenasNumeros = apenasNumeros.substring(0, 4) + '9' + apenasNumeros.substring(4);
    }
  }
  return '+' + apenasNumeros;
}
```

#### **getOrCreateContactCentralized**
```js
function normalizarTelefone(telefone) {
  if (!telefone) return null;
  let n = String(telefone).split('@')[0].replace(/\D/g, '');
  if (!n || n.length < 8) return null;  // ⚠️ DIFERENÇA: 8 vs 10
  n = n.replace(/^0+/, '');
  if (!n.startsWith('55')) {
    if (n.length === 10 || n.length === 11) n = '55' + n;
  }
  if (n.startsWith('55') && n.length === 12) {
    const d = n[4];
    if (['6','7','8','9'].includes(d)) n = n.substring(0, 4) + '9' + n.substring(4);
  }
  return '+' + n;
}
```

#### 🔴 PROBLEMA CRÍTICO ENCONTRADO:
```
LINHA 13 em getOrCreateContactCentralized:
if (!n || n.length < 8) return null;  // ← Aceita números com 8 dígitos

LINHAS 4-6 em webhookFinalZapi:
if (!apenasNumeros || apenasNumeros.length < 10) return null;  // ← Rejeita < 10

LINHAS 46 em webhookWapi:
if (!apenasNumeros || apenasNumeros.length < 10) return null;  // ← Rejeita < 10
```

**Impacto:** Webhooks rejeitam números com 8-9 dígitos ANTES de chamar a função centralizada, mas a função aceita. Isso cria **potencial de inconsistência**.

---

### 2. FLUXO DE CRIAÇÃO DE CONTATO (ANÁLISE DE PASSOS)

#### **STEP 1: Busca por `telefone_canonico` (PRIORIDADE MÁXIMA)**
```js
const r1 = await base44.asServiceRole.entities.Contact.filter(
  { telefone_canonico: canonico },  // Busca por dígitos puros
  '-created_date',
  1
);
```
✅ **Correto**: Campo mais confiável para novos contatos
- Formato: `5548988634900` (sem símbolos)
- Busca O(1) por índice presumido
- Menos falhas por variações de formato

#### **STEP 2: Busca por `telefone` (FALLBACK LEGADO)**
```js
const r2 = await base44.asServiceRole.entities.Contact.filter(
  { telefone: telefoneNormalizado },  // Busca por +5548988634900
  '-created_date',
  1
);
```
⚠️ **Potencial Problema**: Se contato foi criado com `telefone` desatualizado
- Exemplo: `+55 48 9 88634900` (com espaços) vs `+5548988634900` (sem espaços)
- Base de dados pode ter múltiplos formatos não normalizados

#### **STEP 3: Busca Tolerante por Variações**
```js
for (const variacao of variacoes) {
  for (const campo of ['telefone', 'telefone_canonico']) {
    const r = await base44.asServiceRole.entities.Contact.filter(
      { [campo]: variacao },
      '-created_date',
      1
    );
  }
}
```
✅ **Robusto**: 4-8 variações geradas dinamicamente
```
Exemplo para +5548988634900:
[
  '+5548988634900',     // Com país e +
  '5548988634900',      // Com país, sem +
  '48988634900',        // Sem país, com 9
  '+5548988634900',     // Duplicado (já testado no STEP 2)
  '48988634900',        // Sem país, sem +
  ...
]
```

#### **STEP 4: Match por Empresa (pushName)**
```js
const primeiraPalavra = pushName.split(' ')[0];
const clientesMatch = await base44.asServiceRole.entities.Cliente.filter(
  { razao_social: { $regex: primeiraPalavra } },
  '-created_date',
  1
);
```
⚠️ **Risco de Falso Positivo**: Regex simples em primeira palavra
- `"João Silva"` → busca `razao_social` = `/João/`
- Pode retornar `"João Construtora"` quando deveria ser genérico

---

### 3. ANTI-DUPLICAÇÃO: ESTRATÉGIA DE DEFESA PROFUNDA

#### **A. ANTES DA CRIAÇÃO (3 Buscas em Cascata)**

| Etapa | O Quê | Como | Sucesso = |
|-------|-------|------|----------|
| 1 | Canônico | Filter `telefone_canonico = 5548988634900` | Usa existente |
| 2 | Normalizado | Filter `telefone = +5548988634900` | Usa existente |
| 3 | Legado | Filter variações | Usa existente |
| 4 | Empresa | Regex `razao_social` | Vincula ao Cliente |

**Complexidade:** O(N×M) onde N=variações, M=campos
- Típico: 8 variações × 2 campos = 16 queries ANTES de criar

#### **B. DEPOIS DA CRIAÇÃO (ANTI-RACE)**

```js
// ─ RACE CONDITION EXEMPLO ─
// T1: Inicia create para +5548988634900
// T2: Inicia create para 5548988634900  (mesma pessoa, formato diferente)
// T1: Completa, cria ID=abc123
// T2: Completa, cria ID=def456
// → DUPLICATA CRIADA ❌

// ─ PROTEÇÃO IMPLEMENTADA ─
const recheck = await base44.asServiceRole.entities.Contact.filter(
  { telefone_canonico: canonico },
  'created_date',  // ASC: mais antigo primeiro
  2                // Busca os 2 mais antigos
);

if (recheck && recheck.length > 1) {
  const maisAntigo = recheck[0];
  if (maisAntigo.id !== novoContato.id) {
    await base44.asServiceRole.entities.Contact.delete(novoContato.id);  // ← Delete recém-criado
    return { success: true, contact: maisAntigo, action: 'deduplicated' };
  }
}
```

✅ **Estratégia Correta**: Mantém mais antigo, descarta recém-criado
- Preserva histórico (created_date anterior)
- Garante unicidade pós-create
- Custa 1 query extra + 1 delete (raro)

---

### 4. PROBLEMA CRÍTICO: NORMALIZAÇÃO INCONSISTENTE

#### **Transformação em Cascata:**

```
ENTRADA: "48 9 8863-4900" (usuário final)
    ↓ [Webhooks Z-API/W-API normalizam]
"+5548988634900" (normalizado)
    ↓ [getOrCreateContactCentralized recebe]
normalizarTelefone("+5548988634900")
    ├─ split('@')[0] → "+5548988634900"  (remove JID se houver)
    ├─ replace(/\D/g, '') → "5548988634900"  (remove símbolos)
    ├─ replace(/^0+/, '') → "5548988634900"  (remove zeros iniciais)
    ├─ Adiciona '55' se falta → "5548988634900"  (já tem)
    ├─ Insere '9' em posição 4 se DDD → "5548988634900"  (já tem)
    └─ Adiciona '+' → "+5548988634900"  (resultado final)

extrairCanonicopTeléfone("+5548988634900")
    └─ remove /\D/g → "5548988634900"  (armazenado em DB)
```

#### ⚠️ INCONSISTÊNCIA DETECTADA:

**Em `normalizarTelefone()` (getOrCreateContactCentralized, linha 13):**
```js
if (!n || n.length < 8) return null;
```
Aceita números com **8+ dígitos**

**Em `normalizarTelefone()` (webhooks, linhas 4-6 e 45-46):**
```js
if (!apenasNumeros || apenasNumeros.length < 10) return null;
```
Rejeita números com **< 10 dígitos**

**Cenário de Falha:**
```
1. Webhook recebe número DDD: "48 8863-4900" (10 dígitos)
   → Normaliza: "+5548988634900" ✅
   → Chama getOrCreateContactCentralized ✅

2. Webhook recebe número direto: "8863-4900" (8 dígitos)
   → Rejeita: "apenasNumeros.length < 10" ❌
   → NÃO chama getOrCreateContactCentralized ❌
   → Mensagem perdida ou erro ❌

3. Mas se webhook NÃO tivesse a validação:
   → Chama getOrCreateContactCentralized com "8863-4900" ✅
   → Cria contato com número incompleto ❌
```

---

### 5. DUPLICAÇÃO: CUSTO vs BENEFÍCIO

#### **POR QUE `normalizarTelefone()` É DUPLICADO?**

Razão: **Deno não suporta imports locais em deployed functions**

```js
// ❌ NÃO FUNCIONA em Deno:
import { normalizarTelefone } from './shared/phoneUtils.js';

// ✅ OBRIGADO A DUPLICAR:
function normalizarTelefone(telefone) { ... }
```

**Impacto:**
- Z-API: tem seu próprio `normalizarTelefone()`
- W-API: tem seu próprio `normalizarTelefone()`
- getOrCreateContactCentralized: tem seu próprio `normalizarTelefone()`
- **Total: 3 cópias idênticas (ou quase)**

**Custo de Manutenção:**
- Se corrigir bug em 1 cópia, precisa corrigir em 3
- Risco de desincronização (como o bug de `< 8` vs `< 10`)
- 3×80 linhas = 240 linhas duplicadas

**Mitigation Proposto:**
- Criar uma função `normalizarTelefone()` CANÔNICA em getOrCreateContactCentralized
- Webhooks chamam a função (via `invoke`), não duplicam
- Ou documentar as 3 cópias com comentário: "Duplicado propositalmente em Deno"

---

## 🎯 MATRIZ DE RISCO

| Cenário | Probabilidade | Impacto | Risco | Status |
|---------|--------------|--------|-------|--------|
| **Duplicata por Race Condition** | Baixa (2 requisições simultâneas) | Alto (duplicata no DB) | MÉDIO | ✅ MITIGADO (anti-race) |
| **Normalização Inconsistente** | Média (webhook vs função) | Alto (contatos perdidos) | ALTO | ⚠️ CRÍTICO |
| **Falso Positivo empresa** | Média (regex simples) | Baixo (vinculação errada) | MÉDIO | ⚠️ REVIEW |
| **Contato Legado não encontrado** | Média (dados antigos no DB) | Médio (duplicatas) | MÉDIO | ✅ COBERTO (STEP 3) |
| **Estouro de Query Rate** | Baixa (3+8 queries/contato) | Alto (429 Too Many Requests) | MÉDIO | ⚠️ MONITORAR |

---

## 📊 QUERIES POR CONTATO CRIADO

### **Path Feliz (contato novo):**
```
Webhooks (Z-API/W-API):
  └─ 0 queries (apenas normaliza)

getOrCreateContactCentralized:
  ├─ STEP 1: Filter telefone_canonico (1 query) - MISS
  ├─ STEP 2: Filter telefone (1 query) - MISS
  ├─ STEP 3: Filter variações (até 16 queries) - MISS
  ├─ STEP 4: Cria novo (1 query)
  ├─ Anti-Race Recheck (1 query)
  └─ Total: ~19-20 queries ⚠️

webhookFinalZapi/webhookWapi:
  ├─ Auto-merge (até 20 queries)
  ├─ Cria/busca thread (2-3 queries)
  ├─ Cria mensagem (1 query)
  ├─ Atualiza thread (1 query)
  ├─ processInbound invoke (1 externa)
  └─ Total: ~25-30 queries por mensagem
```

**Problema Potencial:** Com volume alto, pode atingir rate limits do banco.

---

## ✅ CONCLUSÕES E RECOMENDAÇÕES

### **Achados Positivos**
1. ✅ Centralização de lógica de contato em única função
2. ✅ Anti-race condition implementado corretamente
3. ✅ 3 estratégias de busca em cascata (canônico → normalizado → legado)
4. ✅ Suporte a múltiplas variações de formato de telefone
5. ✅ Telemetria adequada (console.log em cada etapa)

### **Achados Negativos (Recomendações)**

| # | Achado | Severidade | Ação |
|---|--------|-----------|------|
| 1 | Inconsistência `< 8` vs `< 10` em normalizarTelefone | ALTO | Sincronizar limites de validação |
| 2 | Duplicação de código em 3 funções | MÉDIO | Documentar ou refatorar via `invoke` |
| 3 | Regex simples em match empresa | MÉDIO | Adicionar exatidão ou log de matches |
| 4 | Até 20 queries por contato novo | MÉDIO | Considerar cache ou batch operations |
| 5 | Sem limite de variações buscadas | BAIXO | Adicionar early exit ou limite |

---

## 🔐 FLUXO SEGURO (RESUMO VISUAL)

```
┌─ WEBHOOK ─────────────────────────────────────────┐
│ getOrCreateContactCentralized({telefone, ...})     │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    BUSCAR EXISTENTE        NÃO ENCONTRADO
         │                       │
    ┌────┴──────────────┐   ┌────┴──────────────┐
    ▼ STEP 1 canonico   │   │ STEP 4 empresa    │
    ▼ STEP 2 normal     │   │ Match empresa     │
    ▼ STEP 3 legado     │   │ Vincula cliente   │
         │              │   │                   │
         └──┬───────────┘   └────────┬──────────┘
            ▼                        ▼
         ATUALIZAR               CRIAR NOVO
            │                        │
         ┌──┴────────┐        ┌──────┴──────┐
         │ nome      │        │ ANTI-RACE   │
         │ foto      │        │ Recheck     │
         │ conexão   │        │ Deduplica   │
         └──┬────────┘        └──────┬──────┘
            │                        │
            └─────────┬──────────────┘
                      ▼
              RETORNA CONTATO
              (action: updated|created|deduplicated)
```

---

## 📌 PRÓXIMOS PASSOS CRÍTICOS

1. **Sincronizar `normalizarTelefone()`** entre webhooks e função central
2. **Testar cenários edge:**
   - Números com 8-9 dígitos
   - Números com espaços/símbolos variados
   - Race conditions (2 webhooks simultâneos)
3. **Monitorar rate limits** em produção (20 queries/contato = alto)
4. **Validar anti-race** em ambiente de teste com carga paralela