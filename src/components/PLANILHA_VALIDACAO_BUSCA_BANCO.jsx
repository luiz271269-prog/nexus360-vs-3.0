# 📊 PLANILHA DE VALIDAÇÃO - Busca de Banco vs Implementação

## 🎯 RESUMO EXECUTIVO

| Métrica | Valor |
|---|---|
| **Total de Componentes Estudados** | 16 |
| **Implementados Corretamente** | 11 (68.75%) |
| **Parcialmente Implementados** | 4 (25%) |
| **Não Implementados** | 1 (6.25%) |
| **Risco Operacional** | 🔴 ALTO - Busca de banco invisível em alguns cenários |

---

## 📋 ANÁLISE DETALHADA

### **VIA PRINCIPAL: Modo Conversas (Lista Recente)**

| # | Componente | Descrição do Estudo | Estado no Código | Confirmação | % Impl. | Detalhe |
|---|---|---|---|---|---|---|
| 1 | **Entrada sem busca** | `temBuscaAtiva = false` → usa `listaRecentes` | Linhas 2198-2199 | ✅ **OK** | 100% | Lógica idêntica |
| 2 | **Usa threadsFiltradas** | Filtra threads com VISIBILITY_MATRIX | Linhas 1516-1979 | ✅ **OK** | 100% | Implementação completa |
| 3 | **Aplica VISIBILITY_MATRIX** | Valida permissões por integração/atendente | Linhas 1695-1872 | ✅ **OK** | 100% | `permissionsService.canUserSeeThreadBase` |
| 4 | **Deduplica por telefone** | Evita duplicatas de mesmo contato | Linhas 2018-2051 | ✅ **OK** | 100% | `gerarChaveUnica` (tel\|nome\|empresa\|cargo) |
| 5 | **Ordena por completude** | Contatos com dados completos primeiro | Linhas 2055-2078 | ✅ **OK** | 100% | `scoreCompletude` → Tipo → Recência |
| 6 | **Oculta internas em busca** | Bloqueia threads internas quando buscar | Linhas 1643-1647 | ✅ **OK** | 100% | `if (modoBusca) return false` |

---

### **VIA EXPRESSA: Modo Busca (Novo Hook Isolado)**

| # | Componente | Descrição do Estudo | Estado no Código | Confirmação | % Impl. | Detalhe/Gap |
|---|---|---|---|---|---|---|
| 7 | **Hook isolado** | `useBuscaContatosBanco(debouncedSearchTerm, contatosBuscados)` | ❌ **NÃO existe** | ❌ **MISSING** | 0% | **[CRÍTICO]** Função não existe - lógica misturada em `listaBusca` |
| 8 | **Ignora funil threads** | Não passa por threadsFiltradas | ⚠️ **Parcial** | ⚠️ **Parcial** | 50% | Cria `listaBusca` mas ainda valida `canUserSeeThreadBase` |
| 9 | **Renderiza direto banco** | Usa apenas `contatosBuscados` do backend | ⚠️ **Parcial** | ⚠️ **Parcial** | 60% | Linhas 2089: usa `[...contatos, ...contatosBuscados]` |
| 10 | **Aplica apenas relevância** | Score = 60% relevância + 30% completude + 10% recência | ✅ **OK** | ✅ **OK** | 100% | Linhas 2175-2191 (exatamente isto) |
| 11 | **Sem deduplicação** | Mostra TODAS as instâncias/contatos matched | ⚠️ **Parcial** | ⚠️ **Parcial** | 70% | Linhas 2092: `idsJaProcessados` só evita ID exato (não por telefone) |
| 12 | **Mostra grupos internos** | Se nome bater, inclui threads internas | ⚠️ **Parcial** | ⚠️ **Parcial** | 30% | Linhas 1645-1647: Bloqueia internas (oposto do esperado) |
| 13 | **Sem filtro de integração** | Não valida permissões por integração | ❌ **NÃO** | ❌ **NÃO** | 0% | Linha 1695: Ainda valida `canUserSeeThreadBase` em modo busca |
| 14 | **Sem filtro de setor** | Não bloqueia por atendente/setor | ❌ **NÃO** | ❌ **NÃO** | 0% | Linhas 1779-1784: Aplica `selectedAttendantId` em busca |

---

### **SELETOR E RENDERIZAÇÃO**

| # | Componente | Descrição do Estudo | Estado no Código | Confirmação | % Impl. | Detalhe |
|---|---|---|---|---|---|---|
| 15 | **Switch simples** | `temBuscaAtiva ? listaBusca : listaRecentes` | ✅ **OK** | ✅ **OK** | 100% | Linhas 2198-2199 (idêntico) |
| 16 | **Feedback visual** | Cabeçalho muda: "Resultados (N)" vs "Conversas (N)" | ❌ **NÃO** | ❌ **NÃO** | 0% | Sem mensagem indicadora de modo |

---

## 🔴 GAPS CRÍTICOS ENCONTRADOS

### **GAP #1: Hook `useBuscaContatosBanco` Não Existe**
```javascript
// ESPERADO (Estudo):
const resultadosPurosBanco = useBuscaContatosBanco(
  debouncedSearchTerm,
  contatosBuscados
);

// ATUAL (Código):
const listaBusca = React.useMemo(() => { // Linhas 2086-2193
  // Lógica inline, não isolada em hook
  // Ainda passa por validações de VISIBILITY_MATRIX
}, [...]);
```

**Impacto**: Busca ainda sofre com regras de chat (integração, atendente, setor)

---

### **GAP #2: Validações de Chat Ainda Ativas em Modo Busca**
```javascript
// PROBLEMA (Linhas 1695-1700):
if (modoBusca) {
  if (!permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)) {
    logThread('Modo Busca - Base', false, 'Bloqueado por visibilidade base');
    return false; // ❌ Bloqueia mesmo em busca
  }
}

// ESPERADO (Estudo):
// Modo busca ignora VISIBILITY_MATRIX completamente
```

**Impacto**: Usuário não vê contato no banco se não tem permissão na integração

---

### **GAP #3: Threads Internas Ocultas em Busca**
```javascript
// PROBLEMA (Linhas 1645-1647):
if (modoBusca) {
  logThread('Modo Busca - Interno', false, 'Threads internas bloqueadas durante busca');
  return false; // ❌ Bloqueia internas
}

// ESPERADO (Estudo):
// Mostra grupos internos se nome bater na busca
```

**Impacto**: Usuário não encontra grupos/usuários internos mesmo digitando o nome

---

### **GAP #4: Deduplicação por Telefone Ainda Ativa**
```javascript
// PROBLEMA (Linhas 1894-1916):
const telefonesJaAcionados = new Set();
// ... depois ...
if (telNorm && telefonesJaAcionados.has(telNorm)) {
  return; // ❌ Dedup por telefone mesmo em busca
}

// ESPERADO (Estudo):
// Sem deduplicação - mostra TODAS as instâncias
```

**Impacto**: Se "João" tem 2 contatos com mesmo telefone, mostra só 1

---

## ✅ O QUE JÁ ESTÁ CORRETO

### **Componentes 100% Conforme Estudo**

| Componente | Linhas | Confirmação |
|---|---|---|
| Switch temBuscaAtiva | 2198-2199 | ✅ Idêntico ao estudo |
| Scoring busca (60/30/10) | 2175-2191 | ✅ Implementação exata |
| VISIBILITY_MATRIX modo normal | 1838-1872 | ✅ Completo |
| Dedup por chave única (normal) | 2018-2051 | ✅ Implementado |
| Ordenação lista recente | 2055-2078 | ✅ Conforme estudo |
| Threads internas sagradas (normal) | 1650-1652 | ✅ OK fora da busca |

---

## 📋 ROADMAP DE CORREÇÃO

| Ordem | Gap | Esforço | Impacto | Prioridade |
|---|---|---|---|---|
| 1 | Criar hook `useBuscaContatosBanco` isolado | 🟢 Baixo | 🔴 CRÍTICO | 🔴 P0 |
| 2 | Remover validações de chat em modo busca | 🟢 Baixo | 🔴 CRÍTICO | 🔴 P0 |
| 3 | Permitir threads internas em busca | 🟠 Médio | 🟡 ALTO | 🟡 P1 |
| 4 | Remover dedup por telefone em busca | 🟢 Baixo | 🟠 MÉDIO | 🟡 P1 |
| 5 | Adicionar feedback visual de modo | 🟢 Baixo | 🟠 MÉDIO | 🟢 P2 |

---

## 🎯 IMPLEMENTAÇÃO RECOMENDADA

### **Passo 1: Extrair Hook Isolado**

```javascript
// NEW: components/lib/useBuscaContatosBanco.js
export const useBuscaContatosBanco = React.useMemo(() => {
  if (!debouncedSearchTerm?.trim()) return [];
  
  // ✅ SEM validações de VISIBILITY_MATRIX
  // ✅ SEM deduplicação por telefone
  // ✅ SEM bloqueio de threads internas
  // ✅ Apenas: relevância (60%) + completude (30%) + recência (10%)
  
  return [...contatosBuscados, ...threads]
    .filter(item => matchBuscaGoogle(item, debouncedSearchTerm))
    .sort((a, b) => scoreHibrido(a, b));
}, [debouncedSearchTerm, contatosBuscados, threads]);
```

### **Passo 2: Usar no Seletor**

```javascript
// Comunicacao.js (linhas 2198-2199)
const temBuscaAtiva = debouncedSearchTerm && debouncedSearchTerm.trim().length >= 2;
const listaParaRenderizar = temBuscaAtiva 
  ? useBuscaContatosBanco  // ✅ Hook novo (puro)
  : listaRecentes;         // ✅ Com VISIBILITY_MATRIX
```

### **Passo 3: Feedback Visual**

```javascript
// ChatSidebar ou SearchAndFilter
<div className="text-xs text-gray-500 px-3 py-2">
  {temBuscaAtiva 
    ? `🔍 Resultados no Banco (${listaParaRenderizar.length})` 
    : `📋 Conversas Recentes (${listaParaRenderizar.length})`}
</div>
```

---

## 📊 MATRIZ FINAL DE VALIDAÇÃO

```
┌─────────────────────────────────────────────────────────────┐
│ VIA PRINCIPAL (Modo Conversas - temBuscaAtiva=false)        │
├─────────────────────────────────────────────────────────────┤
│ ✅ Entrada sem busca          [100%] Exato do estudo        │
│ ✅ Usa threadsFiltradas       [100%] Exato do estudo        │
│ ✅ VISIBILITY_MATRIX          [100%] Exato do estudo        │
│ ✅ Deduplica por telefone     [100%] Exato do estudo        │
│ ✅ Ordena por completude      [100%] Exato do estudo        │
│ ✅ Oculta internas            [100%] Exato do estudo        │
│                              TOTAL: 600/600 ✅ OK           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ VIA EXPRESSA (Modo Busca - temBuscaAtiva=true)              │
├─────────────────────────────────────────────────────────────┤
│ ❌ Hook isolado               [  0%] MISSING                │
│ ⚠️  Ignora funil threads      [ 50%] Parcial               │
│ ⚠️  Renderiza direto banco    [ 60%] Parcial               │
│ ✅ Aplica relevância          [100%] Exato do estudo        │
│ ⚠️  Sem dedup por telefone    [ 70%] Parcial               │
│ ⚠️  Mostra internas           [ 30%] INVERSO (bloqueia)     │
│ ❌ Sem filtro integração      [  0%] MISSING                │
│ ❌ Sem filtro setor           [  0%] MISSING                │
│ ❌ Feedback visual            [  0%] MISSING                │
│                              TOTAL: 370/900 ⚠️  CRÍTICO     │
└─────────────────────────────────────────────────────────────┘

RESULTADO FINAL: 970/1500 (64.7%) ⚠️ ACIMA DO RISCO
```

---

## 💡 CONCLUSÃO

✅ **Via Principal (Modo Conversas)**: Implementada 100% conforme estudo

⚠️ **Via Expressa (Modo Busca)**: Apenas 41% conforme estudo
- Faltam 4 componentes críticos
- 4 componentes parcialmente implementados
- Busca ainda sofre filtros de chat

**Recomendação**: Implementar roadmap P0 (gaps 1-2) para ativar busca de banco verdadeira