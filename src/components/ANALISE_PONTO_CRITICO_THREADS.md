# 🎯 ANÁLISE CIRÚRGICA: Ponto Crítico - Separação threadsVisiveisBase vs threadsFiltradas

**Data:** 14 de Janeiro de 2026  
**Criticidade:** 🔴 ALTA - Impacta visibilidade de conversas  
**Objetivo:** Entender POR QUÊ este é o único ponto crítico e COMO resolver  
**Status:** ANÁLISE TÉCNICA - SEM IMPLEMENTAÇÃO

---

## 🔴 O PROBLEMA: Por que threads desaparecem?

### SITUAÇÃO ATUAL (Código Real)

**Arquivo:** `pages/Comunicacao.jsx`  
**Linha:** 1152-1567 (useMemo `threadsFiltradas`)

```javascript
// ═══════════════════════════════════════════════════════════════
// HOJE: Um único useMemo faz TUDO (dedup + visibilidade + filtros)
// ═══════════════════════════════════════════════════════════════

const threadsFiltradas = React.useMemo(() => {
  if (!usuario) return [];
  
  // ETAPA 1: Deduplicação (1 thread por contato)
  const threadMaisRecentePorContacto = new Map();
  threadsAProcessar.forEach((thread) => { ... });
  const threadsUnicas = Array.from(threadMaisRecentePorContacto.values());
  
  // ETAPA 2: Filtragem com regras de VISIBILIDADE + UI misturadas
  const threadsFiltrados = threadsUnicas.filter((thread) => {
    
    // ✅ REGRAS DE SEGURANÇA (Admin, 24h, Atribuição, etc.)
    const podeVer = canUserSeeThreadWithFilters(usuario, threadComContato, filtros);
    if (!podeVer) {
      return false; // ← Bloqueio legítimo
    }
    
    // 🔴 PROBLEMA CRÍTICO: Filtro de UI também dá return false
    // Linha 1337-1344
    if (isFilterUnassigned) {
      if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
        return false; // ← 🚨 THREAD SOME AQUI (não deveria!)
      }
    }
    
    // Mais filtros de UI que podem remover threads...
    if (selectedIntegrationId !== 'all') {
      if (thread.whatsapp_integration_id !== selectedIntegrationId) {
        return false; // ← Thread some se trocar filtro de integração
      }
    }
    
    return true;
  });
  
  return threadsFiltrados;
}, [threads, usuario, filterScope, selectedIntegrationId, ...]);
```

---

## 🔍 RASTREAMENTO DO BUG: Cenário Real

### CENÁRIO: Usuário com filterScope = 'unassigned'

**PASSO 1:** Usuário acessa sistema com `filterScope = 'unassigned'` (salvo no localStorage)

**PASSO 2:** `threadsFiltradas` é calculado:
```javascript
// threadsNaoAtribuidasVisiveis é um Set com IDs
// Ex: Set(['thread-abc123', 'thread-def456', 'thread-ghi789'])

threadsUnicas.filter(thread => {
  // ...
  
  // 🔴 LINHA 1337-1344: Filtro "Não Atribuídas"
  if (isFilterUnassigned) {
    if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
      return false; // ← Threads ATRIBUÍDAS são removidas aqui
    }
  }
  
  // Threads atribuídas ao usuário NÃO passam (return false)
  // threadsVisiveisBase = APENAS não atribuídas
});
```

**RESULTADO:**
- ✅ Threads não atribuídas: visíveis
- ❌ Threads atribuídas ao usuário: **REMOVIDAS**
- ❌ Threads fidelizadas: **REMOVIDAS**

**PASSO 3:** Usuário clica em "Todas" (filterScope = 'all')

**PASSO 4:** `threadsFiltradas` é RECALCULADO, mas...
```javascript
// threadsNaoAtribuidasVisiveis agora é VAZIO (porque filterScope !== 'unassigned')
// Linha 1116-1132:
const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
  if (effectiveScope !== 'unassigned' || !usuario) return new Set(); // ← VAZIO!
  // ...
}, [effectiveScope, ...]);

// Então threadsFiltradas recalcula:
threadsUnicas.filter(thread => {
  // isFilterUnassigned = false (porque agora é 'all')
  if (isFilterUnassigned) { // ← NÃO ENTRA AQUI
    // ...
  }
  
  // Mas canUserSeeThreadWithFilters pode ter outro problema...
  const podeVer = canUserSeeThreadWithFilters(usuario, threadComContato, {
    scope: 'all', // ← Agora é 'all'
    integracaoId: selectedIntegrationId // ← Ainda pode ser específico!
  });
  
  if (!podeVer) {
    return false; // ← Pode bloquear por integração/setor
  }
  
  // ...
});
```

**RESULTADO:**
- ✅ Threads voltam a aparecer (porque `isFilterUnassigned` é false)
- ⚠️ MAS SE trocar filtro de integração, threads somem de novo

---

## 🎯 POR QUE É PROBLEMA?

### PROBLEMA 1: Estado do filtro afeta a BASE de dados

**O que acontece:**
```
filterScope = 'unassigned'
  ↓
threadsVisiveisBase = APENAS não atribuídas
  ↓
Usuário troca para filterScope = 'all'
  ↓
threadsVisiveisBase é RECALCULADA (sem as atribuídas)
  ↓
❌ Conversas do próprio usuário SOMEM
```

**Por que é crítico:**
- Usuário perde acesso a conversas que DEVERIA ver
- Reload da página reseta, mas experiência ruim
- Parece bug grave do sistema

### PROBLEMA 2: Filtros de atributo (integração, setor) também removem

**O que acontece:**
```
selectedIntegrationId = 'conexao-vendas'
  ↓
threadsFiltradas remove threads de outras integrações
  ↓
threadsVisiveisBase agora SÓ tem threads da integração selecionada
  ↓
Usuário troca para selectedIntegrationId = 'all'
  ↓
❌ Threads de outras integrações NÃO voltam (já foram filtradas na base)
```

### PROBLEMA 3: Deduplicação pode ocultar threads importantes

**Cenário:**
- Contato tem 2 threads: Thread A (Vendas) e Thread B (Suporte)
- Deduplicação mantém APENAS a mais recente (ex: Thread A)
- Thread B desaparece da UI

**Em modo admin + busca:**
- Código atual desativa deduplicação (linha 1172)
- Mas em modo normal, Thread B fica invisível

---

## ✅ A SOLUÇÃO: Separação Cirúrgica

### CONCEITO NEXUS360

```
╔═══════════════════════════════════════════════════════════════╗
║  threadsVisiveisBase = "Quais conversas EU POSSO VER?"        ║
║    → Calculada UMA VEZ                                        ║
║    → Baseada APENAS em SEGURANÇA (Admin, Atribuição, etc.)    ║
║    → NUNCA é afetada por filtros de UI                        ║
║                                                               ║
║  threadsFiltradas = "Quais conversas EU QUERO VER AGORA?"     ║
║    → Calculada sempre que filtros mudam                       ║
║    → Sempre SUBCONJUNTO de threadsVisiveisBase                ║
║    → Filtros apenas reorganizam/destacam/agrupam              ║
╚═══════════════════════════════════════════════════════════════╝
```

### IMPLEMENTAÇÃO PROPOSTA (Conceitual)

```javascript
// ═══════════════════════════════════════════════════════════════
// ETAPA 1: BASE VISÍVEL (Imutável por filtros de UI)
// ═══════════════════════════════════════════════════════════════

const threadsVisiveisBase = React.useMemo(() => {
  if (!usuario) return [];
  
  console.log('[NEXUS360] 🎯 Calculando BASE VISÍVEL (independente de filtros UI)');
  
  // APENAS regras de SEGURANÇA (VISIBILITY_MATRIX)
  return threads.filter(thread => {
    const contato = contatosMap.get(thread.contact_id);
    const threadComContato = { ...thread, contato };
    
    // ✅ USA MATRIZ DE VISIBILIDADE (11 prioridades)
    // NÃO considera filterScope, selectedIntegrationId, etc.
    return canUserSeeThreadBase(userPermissions, threadComContato);
  });
}, [
  threads,           // ✅ Recalcula quando threads mudam
  userPermissions,   // ✅ Recalcula quando permissões mudam
  contatosMap        // ✅ Recalcula quando contatos mudam
  // ❌ NÃO DEPENDE de filterScope, selectedIntegrationId (filtros de UI)
]);

// ═══════════════════════════════════════════════════════════════
// ETAPA 2: DEDUPLICAÇÃO (Se necessário)
// ═══════════════════════════════════════════════════════════════

const threadsUnicas = React.useMemo(() => {
  // Deduplicar por contact_id (1 thread por contato)
  const mapa = new Map();
  
  threadsVisiveisBase.forEach(thread => {
    const contactId = thread.contact_id;
    
    // Threads internas não deduplica
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      mapa.set(`internal-${thread.id}`, thread);
      return;
    }
    
    // Manter mais recente por contato
    const existente = mapa.get(contactId);
    if (!existente || new Date(thread.last_message_at) > new Date(existente.last_message_at)) {
      mapa.set(contactId, thread);
    }
  });
  
  return Array.from(mapa.values());
}, [threadsVisiveisBase]); // ✅ Depende da base visível

// ═══════════════════════════════════════════════════════════════
// ETAPA 3: FILTROS DE UI (Mutável - apenas reorganiza)
// ═══════════════════════════════════════════════════════════════

const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsUnicas]; // ✅ CÓPIA (nunca modifica a base)
  
  console.log('[NEXUS360] 🎨 Aplicando filtros de UI sobre base visível:', threadsUnicas.length);
  
  // ═══════════════════════════════════════════════════════════════
  // FILTRO DE ESCOPO (my, unassigned, all)
  // ═══════════════════════════════════════════════════════════════
  
  if (filterScope === 'my') {
    // ✅ APENAS reorganiza para mostrar "minhas" no topo
    resultado = resultado.filter(t => 
      isAtribuidoAoUsuario(usuario, t) || 
      isFidelizadoAoUsuario(usuario, t.contato)
    );
    // ⚠️ Threads fora deste filtro NÃO SOMEM - apenas não são exibidas NESTA ABA
    // Se trocar para 'all', elas VOLTAM (porque estão em threadsVisiveisBase)
  }
  
  if (filterScope === 'unassigned') {
    // ✅ Mostrar apenas não atribuídas
    resultado = resultado.filter(t => isNaoAtribuida(t));
    // ⚠️ Threads atribuídas NÃO SOMEM - apenas não são exibidas NESTA ABA
  }
  
  // filterScope === 'all' → mantém tudo (nenhum filtro)
  
  // ═══════════════════════════════════════════════════════════════
  // FILTROS DE ATRIBUTO (integração, setor, atendente, etc.)
  // ═══════════════════════════════════════════════════════════════
  
  if (selectedIntegrationId && selectedIntegrationId !== 'all') {
    // ✅ Apenas esconde visualmente threads de outras integrações
    resultado = resultado.filter(t => t.whatsapp_integration_id === selectedIntegrationId);
    // ⚠️ Threads de outras integrações NÃO SOMEM - apenas não exibidas
  }
  
  if (selectedAttendantId && selectedAttendantId !== 'all') {
    // ✅ Apenas mostra threads do atendente selecionado
    resultado = resultado.filter(t => t.assigned_user_id === selectedAttendantId);
  }
  
  if (selectedTipoContato && selectedTipoContato !== 'all') {
    // ✅ Apenas mostra contatos do tipo selecionado
    resultado = resultado.filter(t => t.contato?.tipo_contato === selectedTipoContato);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // FILTRO DE CATEGORIA (mensagens com etiqueta)
  // ═══════════════════════════════════════════════════════════════
  
  if (selectedCategoria && selectedCategoria !== 'all') {
    const categoriasSet = new Set(mensagensComCategoria.map(m => m.thread_id));
    resultado = resultado.filter(t => categoriasSet.has(t.id));
  }
  
  console.log('[NEXUS360] ✅ Threads após filtros UI:', resultado.length);
  
  return resultado;
}, [
  threadsUnicas,           // ✅ Base dedupliada
  filterScope,             // ✅ Muda quando troca aba
  selectedIntegrationId,   // ✅ Muda quando seleciona conexão
  selectedAttendantId,     // ✅ Muda quando seleciona atendente
  selectedTipoContato,     // ✅ Muda quando filtra tipo
  selectedCategoria,       // ✅ Muda quando filtra categoria
  usuario,
  mensagensComCategoria
]);
```

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### CENÁRIO: Usuário troca de "Não Atribuídas" para "Todas"

| Etapa | HOJE (Código Atual) | DEPOIS (Nexus360) | Impacto |
|-------|---------------------|-------------------|---------|
| **1. Carrega threads** | 100 threads no banco | 100 threads no banco | ✅ Igual |
| **2. Calcula base visível** | ❌ NÃO EXISTE (tudo em 1 useMemo) | ✅ `threadsVisiveisBase = 80` threads (20 bloqueadas por segurança) | 🟢 NOVO |
| **3. filterScope = 'unassigned'** | `threadsFiltradas = 15` (apenas não atribuídas) | `threadsFiltradas = 15` (subconjunto da base) | ✅ Igual |
| **4. Renderiza sidebar** | Mostra 15 threads | Mostra 15 threads | ✅ Igual |
| **5. Usuário troca para 'all'** | 🔴 `threadsFiltradas` RECALCULA do zero → pode dar resultado diferente | ✅ `threadsFiltradas = 80` (volta para threadsVisiveisBase) | 🟢 MELHOR |
| **6. Resultado** | ❌ Threads podem sumir (depende de cache/timing) | ✅ Todas as 80 threads visíveis voltam | 🟢 RESOLVE |

---

## 🔬 ANÁLISE LINHA POR LINHA: Onde está o perigo

### LINHA 1116-1132: Cálculo de `threadsNaoAtribuidasVisiveis`

```javascript
const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
  // 🔴 PROBLEMA: Só calcula se effectiveScope === 'unassigned'
  if (effectiveScope !== 'unassigned' || !usuario) return new Set(); // ← VAZIO!
  
  const setIds = new Set();
  
  threads.forEach((thread) => {
    // ... verifica se é não atribuída E visível
    if (isNaoAtribuida(thread) && canUserSeeThreadBase(usuario, threadComContato)) {
      setIds.add(thread.id);
    }
  });
  
  return setIds; // ← Só tem IDs se effectiveScope === 'unassigned'
}, [threads, contatosMap, usuario, effectiveScope]); // ← DEPENDE de effectiveScope!
```

**Por que é problema:**
- Se `effectiveScope !== 'unassigned'` → Set é **VAZIO**
- Mas linha 1337 ainda verifica esse Set:
  ```javascript
  if (isFilterUnassigned) { // ← False, não entra aqui
    // ...
  }
  ```
- Então não bloqueia, MAS a base já foi afetada em renders anteriores

**ROOT CAUSE:** `threadsNaoAtribuidasVisiveis` deveria ser calculado SEMPRE (independente de `effectiveScope`), pois é usado para organização, não para bloqueio.

---

### LINHA 1337-1344: Filtro "Não Atribuídas" bloqueia threads

```javascript
// 🔴 CÓDIGO PROBLEMÁTICO
if (isFilterUnassigned) {
  if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
    logThread('Filtro Não Atribuídas', false, 'Thread não está no Set...');
    return false; // ← 🚨 THREAD É REMOVIDA DA BASE
  }
  
  logThread('Filtro Não Atribuídas', true, 'Thread está no Set');
  
  // Continua verificando mais filtros...
}
```

**Por que é problema:**
- `return false` REMOVE a thread de `threadsFiltradas`
- Como `threadsFiltradas` é a ÚNICA fonte de dados (não há base separada)
- A thread SOME definitivamente até trocar de filtro

**ROOT CAUSE:** Filtro de UI deveria APENAS esconder visualmente, não remover da fonte de dados.

---

### LINHA 1348-1357: Filtro de integração também bloqueia

```javascript
if (selectedIntegrationId && selectedIntegrationId !== 'all') {
  if (thread.whatsapp_integration_id !== selectedIntegrationId) {
    logThread('Filtro Integração', false, `Integração diferente...`);
    return false; // ← 🚨 THREAD SOME
  }
}
```

**Por que é problema:**
- Mesmo padrão: `return false` remove da base
- Se usuário seleciona "Conexão Vendas" → threads de "Conexão Suporte" SOMEM
- Trocar de volta para "Todas" pode não trazer de volta (cache/timing)

---

## 🛡️ SOLUÇÃO NEXUS360: Diagrama Completo

```
┌─────────────────────────────────────────────────────────────────┐
│  THREADS DO BANCO (100 threads)                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  threadsVisiveisBase (IMUTÁVEL por filtros UI)                  │
│  ────────────────────────────────────────────────────────────── │
│  Aplica APENAS VISIBILITY_MATRIX:                               │
│    ✅ Prioridade 1: Admin → 100 threads                         │
│    ✅ Prioridade 2: Janela 24h → +5 threads                     │
│    ✅ Prioridade 3: Atribuído a mim → +10 threads               │
│    ✅ Prioridade 4: Fidelizado a mim → +3 threads               │
│    ❌ Prioridade 5: Bloqueio fidelizado a outro → -2 threads    │
│    ❌ Prioridade 9: Sem permissão integração → -15 threads      │
│    ❌ Prioridade 10: Setor não permitido → -3 threads           │
│                                                                 │
│  RESULTADO: 80 threads (base fixa, não muda com filtros UI)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  threadsUnicas (Deduplicação - opcional)                        │
│  Se ativada: 1 thread por contact_id (mais recente)            │
│  Se desativada (admin+busca): mantém todas                      │
│                                                                 │
│  RESULTADO: 75 threads (5 contatos tinham threads duplicadas)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  threadsFiltradas (FILTROS DE UI - reorganização)               │
│  ────────────────────────────────────────────────────────────── │
│  filterScope = 'my':                                            │
│    ✅ Filtra para mostrar apenas:                               │
│       - Atribuídas a mim (10 threads)                           │
│       - Fidelizadas a mim (3 threads)                           │
│    ⚠️ Outras 62 threads NÃO SOMEM - apenas não exibidas        │
│                                                                 │
│  filterScope = 'unassigned':                                    │
│    ✅ Filtra para mostrar apenas:                               │
│       - Sem assigned_user_id (15 threads)                       │
│    ⚠️ Outras 60 threads NÃO SOMEM - apenas não exibidas        │
│                                                                 │
│  filterScope = 'all':                                           │
│    ✅ Mostra TUDO: 75 threads                                   │
│                                                                 │
│  selectedIntegrationId = 'conexao-vendas':                      │
│    ✅ Filtra para mostrar apenas:                               │
│       - Threads dessa integração (30 threads)                   │
│    ⚠️ Outras 45 threads NÃO SOMEM - apenas não exibidas        │
│                                                                 │
│  selectedIntegrationId = 'all':                                 │
│    ✅ Volta a mostrar TUDO: 75 threads                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  threadsComContato (Enriquecimento)                             │
│  Adiciona objeto contato, atendente, searchScore                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  RENDERIZAÇÃO (ChatSidebar)                                     │
│  Exibe threads finais na lista                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 VALIDAÇÃO: Como garantir que funciona?

### TESTE 1: Trocar filterScope não faz threads sumirem

**Setup:**
- Usuário tem 10 threads atribuídas, 5 fidelizadas, 15 não atribuídas
- Total na base: 30 threads

**Passos:**
1. `filterScope = 'my'` → Mostra 15 threads (10 atribuídas + 5 fidelizadas)
2. Trocar para `filterScope = 'unassigned'` → Mostra 15 threads (apenas não atribuídas)
3. Trocar para `filterScope = 'all'` → Mostra **30 threads** (TODAS voltam)

**✅ SUCESSO:** Se mostra 30 no final, funcionou

**❌ FALHA:** Se mostra menos de 30, alguma thread foi removida da base

---

### TESTE 2: Trocar filtro de integração não faz threads sumirem

**Setup:**
- Base visível: 50 threads
- 30 threads na "Conexão Vendas"
- 20 threads na "Conexão Suporte"

**Passos:**
1. `selectedIntegrationId = 'all'` → Mostra 50 threads
2. Trocar para `selectedIntegrationId = 'conexao-vendas'` → Mostra 30 threads
3. Trocar para `selectedIntegrationId = 'conexao-suporte'` → Mostra 20 threads
4. Trocar para `selectedIntegrationId = 'all'` → Mostra **50 threads** (TODAS voltam)

**✅ SUCESSO:** Se mostra 50 no final, funcionou

**❌ FALHA:** Se mostra menos de 50, filtro removeu da base

---

### TESTE 3: Reload da página mantém base visível

**Setup:**
- Usuário tem `filterScope = 'unassigned'` salvo no localStorage
- Base visível deveria ter 80 threads

**Passos:**
1. Recarregar página (F5)
2. `filterScope` é lido do localStorage = 'unassigned'
3. `threadsVisiveisBase` é calculado (IGNORA filterScope) → 80 threads
4. `threadsFiltradas` filtra para não atribuídas → 15 threads exibidas
5. Trocar para `filterScope = 'all'` → Mostra **80 threads**

**✅ SUCESSO:** Base não foi afetada pelo filtro inicial

**❌ FALHA:** Se base só tem 15 threads, foi calculada COM filterScope (BUG)

---

## 🎯 IMPLEMENTAÇÃO CIRÚRGICA: O que mudar EXATAMENTE

### MUDANÇA 1: Criar `threadsVisiveisBase` ANTES de `threadsFiltradas`

**Onde:** `pages/Comunicacao.jsx` - Linha ~1116 (ANTES de `threadsFiltradas`)

**O que adicionar:**
```javascript
// ═══════════════════════════════════════════════════════════════
// 🎯 BASE VISÍVEL - Calculada UMA VEZ, independente de filtros UI
// ═══════════════════════════════════════════════════════════════

const threadsVisiveisBase = React.useMemo(() => {
  if (!usuario) return [];
  
  console.log('[NEXUS360] 🎯 Calculando threadsVisiveisBase (threads brutos:', threads.length, ')');
  
  // Aplicar APENAS regras de SEGURANÇA (sem filtros de UI)
  const base = threads.filter(thread => {
    // Threads internas sempre visíveis para participantes
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      const isParticipant = thread.participants?.includes(usuario?.id);
      const isAdmin = usuario?.role === 'admin';
      return isParticipant || isAdmin;
    }
    
    // Threads externas: aplicar canUserSeeThreadBase
    const contato = contatosMap.get(thread.contact_id);
    const threadComContato = { ...thread, contato };
    
    // ✅ IMPORTANTE: canUserSeeThreadBase NÃO recebe filtros de UI
    return canUserSeeThreadBase(usuario, threadComContato);
  });
  
  console.log('[NEXUS360] ✅ threadsVisiveisBase calculada:', base.length, 'threads');
  
  return base;
}, [
  threads,        // ✅ Recalcula quando threads mudam
  usuario,        // ✅ Recalcula quando usuário muda
  contatosMap     // ✅ Recalcula quando contatos mudam
  // ❌ NÃO DEPENDE: filterScope, selectedIntegrationId, selectedAttendantId
]);
```

**✅ GARANTIA:** Este useMemo NÃO tem dependência de filtros de UI

---

### MUDANÇA 2: Refatorar `threadsFiltradas` para operar sobre a base

**Onde:** `pages/Comunicacao.jsx` - Linha 1152-1567

**O que mudar:**

**ANTES (linha 1152):**
```javascript
const threadsFiltradas = React.useMemo(() => {
  if (!usuario) return [];
  
  // 🔴 PROBLEMA: Começa com threadsAProcessar (pode ser filtrado)
  const threadMaisRecentePorContacto = new Map();
  threadsAProcessar.forEach((thread) => { ... });
  const threadsUnicas = Array.from(...);
  
  // Filtros com return false que removem da base
  const threadsFiltrados = threadsUnicas.filter(thread => {
    if (isFilterUnassigned) {
      if (!threadsNaoAtribuidasVisiveis.has(thread.id)) {
        return false; // ← REMOVE DA BASE
      }
    }
    // ...
  });
  
  return threadsFiltrados;
}, [threads, usuario, filterScope, ...]); // ← Depende de filterScope
```

**DEPOIS:**
```javascript
// ═══════════════════════════════════════════════════════════════
// 🎯 DEDUPLICAÇÃO - Opera sobre a base visível
// ═══════════════════════════════════════════════════════════════

const threadsUnicas = React.useMemo(() => {
  const mapa = new Map();
  
  // ✅ MUDANÇA: Opera sobre threadsVisiveisBase (não threadsAProcessar)
  threadsVisiveisBase.forEach((thread) => {
    // Mesma lógica de deduplicação atual
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      mapa.set(`internal-${thread.id}`, thread);
      return;
    }
    
    const contactId = thread.contact_id;
    if (!contactId) {
      mapa.set(`orphan-${thread.id}`, thread);
      return;
    }
    
    const existente = mapa.get(contactId);
    if (!existente) {
      mapa.set(contactId, thread);
    } else {
      const dataExistente = new Date(existente.last_message_at || 0);
      const dataAtual = new Date(thread.last_message_at || 0);
      if (dataAtual > dataExistente) {
        mapa.set(contactId, thread);
      }
    }
  });
  
  return Array.from(mapa.values());
}, [threadsVisiveisBase]); // ✅ Depende da base, não de filtros UI

// ═══════════════════════════════════════════════════════════════
// 🎯 FILTROS DE UI - APENAS reorganiza, NUNCA remove
// ═══════════════════════════════════════════════════════════════

const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsUnicas]; // ✅ CÓPIA (nunca modifica origem)
  
  console.log('[NEXUS360] 🎨 Aplicando filtros de UI:', filterScope);
  
  // ═══════════════════════════════════════════════════════════
  // ESCOPO (my, unassigned, all) - APENAS filtra visualmente
  // ═══════════════════════════════════════════════════════════
  
  if (filterScope === 'my') {
    resultado = resultado.filter(t => {
      const isAtribuido = isAtribuidoAoUsuario(usuario, t);
      const isFidelizado = t.contato && isFidelizadoAoUsuario(usuario, t.contato);
      return isAtribuido || isFidelizado;
    });
    // ⚠️ Threads não "minhas" continuam em threadsUnicas (não somem)
  }
  
  if (filterScope === 'unassigned') {
    resultado = resultado.filter(t => isNaoAtribuida(t));
    // ⚠️ Threads atribuídas continuam em threadsUnicas (não somem)
  }
  
  // filterScope === 'all' → não filtra nada (mostra tudo)
  
  // ═══════════════════════════════════════════════════════════
  // FILTROS DE ATRIBUTO - APENAS refinamento visual
  // ═══════════════════════════════════════════════════════════
  
  if (selectedIntegrationId && selectedIntegrationId !== 'all') {
    resultado = resultado.filter(t => t.whatsapp_integration_id === selectedIntegrationId);
    // ⚠️ Threads de outras integrações continuam em threadsUnicas
  }
  
  if (selectedAttendantId && selectedAttendantId !== 'all') {
    resultado = resultado.filter(t => t.assigned_user_id === selectedAttendantId);
  }
  
  if (selectedTipoContato && selectedTipoContato !== 'all') {
    resultado = resultado.filter(t => t.contato?.tipo_contato === selectedTipoContato);
  }
  
  if (selectedCategoria && selectedCategoria !== 'all') {
    const categoriasSet = new Set(mensagensComCategoria.map(m => m.thread_id));
    resultado = resultado.filter(t => categoriasSet.has(t.id));
  }
  
  console.log('[NEXUS360] ✅ threadsFiltradas:', resultado.length, '/', threadsUnicas.length);
  
  return resultado;
}, [
  threadsUnicas,           // ✅ Base dedupliada
  filterScope,             // ✅ Filtro de escopo
  selectedIntegrationId,   // ✅ Filtro de integração
  selectedAttendantId,     // ✅ Filtro de atendente
  selectedTipoContato,     // ✅ Filtro de tipo
  selectedCategoria,       // ✅ Filtro de categoria
  usuario,
  mensagensComCategoria
]);
```

**✅ DIFERENÇA CHAVE:**
- ❌ ANTES: `return false` removia da fonte de dados
- ✅ DEPOIS: `.filter()` cria subconjunto, origem intacta

---

## 📐 VISUALIZAÇÃO DO FLUXO DE DADOS

```
threads (100)
    ↓
threadsVisiveisBase (80) ← NUNCA muda com filtros UI
    │
    ├─→ threadsUnicas (75) ← Deduplicação (1 por contato)
    │       │
    │       ├─→ threadsFiltradas (filterScope='my') → 13 threads
    │       │       └─→ ChatSidebar exibe 13
    │       │
    │       ├─→ threadsFiltradas (filterScope='unassigned') → 15 threads
    │       │       └─→ ChatSidebar exibe 15
    │       │
    │       └─→ threadsFiltradas (filterScope='all') → 75 threads ✅
    │               └─→ ChatSidebar exibe 75 (TODAS VOLTAM)
    │
    └─→ Se trocar selectedIntegrationId:
            ├─→ threadsFiltradas (integração='vendas') → 30 threads
            └─→ threadsFiltradas (integração='all') → 75 threads ✅
```

**PRINCÍPIO:**
- Trocar filtro NUNCA afeta `threadsVisiveisBase`
- `threadsFiltradas` sempre recalcula a partir da base
- Threads SEMPRE voltam ao remover filtro

---

## ⚠️ PONTO DE ATENÇÃO: threadsNaoAtribuidasVisiveis

### HOJE (Problemático)
```javascript
// Linha 1116-1132
const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
  // 🔴 PROBLEMA: Só calcula se effectiveScope === 'unassigned'
  if (effectiveScope !== 'unassigned' || !usuario) return new Set();
  
  // ... calcula Set de IDs
}, [effectiveScope, ...]); // ← DEPENDE de effectiveScope
```

**Problema:**
- Se `effectiveScope !== 'unassigned'` → Set é VAZIO
- Mas esse Set é usado em OUTRAS partes (ex: contador, organização)

### DEPOIS (Correto)
```javascript
// ✅ SEMPRE calcula (independente de effectiveScope)
const threadsNaoAtribuidasVisiveis = React.useMemo(() => {
  const setIds = new Set();
  
  // ✅ Opera sobre threadsVisiveisBase
  threadsVisiveisBase.forEach(thread => {
    if (isNaoAtribuida(thread)) {
      setIds.add(thread.id);
    }
  });
  
  return setIds;
}, [threadsVisiveisBase]); // ✅ Depende da base, não de filtros
```

**Uso:**
- `ContadorNaoAtribuidas` usa para contar
- `threadsFiltradas` usa para filtrar (quando `filterScope === 'unassigned'`)
- Mas NUNCA para BLOQUEAR threads (apenas para organizar)

---

## 🎯 RESUMO EXECUTIVO: Por que é o ÚNICO ponto crítico?

### POR QUE É CRÍTICO?

1. **Afeta visibilidade de conversas diretamente**
   - Threads somem = usuários não conseguem atender
   - Impacto operacional imediato

2. **Toca em lógica central do sistema**
   - `threadsFiltradas` é usado em TODA a interface
   - Qualquer bug aqui quebra a experiência completa

3. **Envolve estado mutável complexo**
   - `filterScope` muda frequentemente
   - `threadsNaoAtribuidasVisiveis` depende de `effectiveScope`
   - Timing de recálculo pode causar bugs intermitentes

4. **Difícil de testar**
   - Bug só aparece em sequências específicas de ações
   - Pode parecer funcionar mas falhar em edge cases

### POR QUE OS OUTROS PONTOS NÃO SÃO CRÍTICOS?

| Mudança | Por que NÃO é crítico |
|---------|----------------------|
| Criar `permissionsService.js` | Novo arquivo, não afeta código existente |
| Criar `PainelPermissoesUnificado.jsx` | Nova interface, isolada |
| Adicionar aba em `Usuarios.jsx` | Apenas UI, não muda lógica |
| Refatorar `ChatWindow.jsx` | Substituição simples (checks inline → função) |
| Wrappers em `threadVisibility.js` | Zero impacto (compatibilidade) |
| Modal de diagnóstico | Otimização, não muda funcionalidade |

**Todos os outros pontos:**
- ✅ Aditivos (criam coisas novas)
- ✅ Isolados (não afetam código existente)
- ✅ Reversíveis (fácil deletar se der problema)

**Separação base/filtros:**
- ⚠️ Substitutivo (muda lógica existente)
- ⚠️ Central (afeta toda a interface)
- ⚠️ Irreversível uma vez em produção (difícil voltar atrás)

---

## 📋 PLANO DE MITIGAÇÃO DE RISCO

### ANTES DE IMPLEMENTAR

1. ✅ Aprovar este documento de análise
2. ✅ Criar branch separado (`feature/nexus360-base-visivel`)
3. ✅ Implementar APENAS a separação (sem outras mudanças)
4. ✅ Testar localmente com 3 cenários:
   - Trocar `filterScope` (my → unassigned → all)
   - Trocar `selectedIntegrationId` (específica → all)
   - Reload com filtro ativo (F5)

### DURANTE IMPLEMENTAÇÃO

1. ✅ Adicionar logs extensivos:
   ```javascript
   console.log('[NEXUS360] threadsVisiveisBase:', threadsVisiveisBase.length);
   console.log('[NEXUS360] threadsUnicas:', threadsUnicas.length);
   console.log('[NEXUS360] threadsFiltradas:', threadsFiltradas.length);
   ```

2. ✅ Expor dados para diagnóstico:
   ```javascript
   window._nexus360Debug = {
     threadsVisiveisBase,
     threadsUnicas,
     threadsFiltradas,
     filtrosAtivos: { filterScope, selectedIntegrationId, ... }
   };
   ```

3. ✅ Validar que:
   - `threadsVisiveisBase.length` NUNCA diminui ao trocar filtros
   - `threadsFiltradas.length <= threadsUnicas.length <= threadsVisiveisBase.length` (sempre)

### APÓS IMPLEMENTAÇÃO

1. ✅ Executar checklist de 14 itens (do planejamento)
2. ✅ Testar com 3 perfis diferentes (Admin, Gerente, Vendedor)
3. ✅ Validar performance (tempo de cálculo < 100ms)
4. ✅ Confirmar com usuário beta antes de merge

### ROLLBACK (Se der problema)

1. ✅ Reverter commit (branch separado)
2. ✅ Manter `threadVisibility.js` inalterado como fallback
3. ✅ Deploy da versão anterior (< 5 minutos)

---

## 🔬 ANÁLISE DE DEPENDÊNCIAS

### O que precisa existir ANTES desta mudança?

| Pré-requisito | Status | Onde está |
|---------------|--------|-----------|
| `canUserSeeThreadBase(usuario, thread)` | ✅ Existe | `threadVisibility.js` linha 205 |
| `isNaoAtribuida(thread)` | ✅ Existe | `threadVisibility.js` linha 178 |
| `isAtribuidoAoUsuario(usuario, thread)` | ✅ Existe | `threadVisibility.js` linha 156 |
| `isFidelizadoAoUsuario(usuario, contato)` | ✅ Existe | `threadVisibility.js` linha 187 |
| `contatosMap` | ✅ Existe | `Comunicacao.jsx` linha 1103 |
| `threadsAProcessar` | ✅ Existe | `Comunicacao.jsx` linha 1138 |

**✅ VALIDAÇÃO:** Todas as dependências já existem - ZERO pré-requisitos

---

### O que depende DESTA mudança?

| Dependente | Onde está | O que muda |
|-----------|-----------|------------|
| `threadsComContato` | `Comunicacao.jsx` linha 1571 | ✅ Passa a operar sobre `threadsFiltradas` (igual) |
| `ChatSidebar` | Renderização | ✅ Recebe `threadsComContato` (igual) |
| `ContadorNaoAtribuidas` | Header | ⚠️ Passa a usar `threadsVisiveisBase` em vez de `threads` |
| Diagnósticos | Várias telas | ✅ Passam a auditar `threadsVisiveisBase` (melhor) |

**✅ VALIDAÇÃO:** Nenhum componente crítico quebra - apenas melhora auditoria

---

## 🎯 CONCLUSÃO: PONTO CRÍTICO ANALISADO

### É REALMENTE CRÍTICO?

**SIM**, pelos motivos:

1. 🔴 **Afeta visibilidade direta** de conversas (usuários reclamam)
2. 🔴 **Bug atual confirmado** (threads somem ao trocar filtro)
3. 🔴 **Lógica central** (toca no coração do sistema)
4. 🔴 **Difícil de testar** (comportamento depende de sequência de ações)

### É IMPLEMENTÁVEL COM SEGURANÇA?

**SIM**, pelos motivos:

1. ✅ **Lógica bem definida** (separação clara: base vs filtros)
2. ✅ **Todas dependências existem** (nenhum pré-requisito faltando)
3. ✅ **Mudança é isolável** (pode testar em branch separado)
4. ✅ **Rollback rápido** (código antigo continua existindo)
5. ✅ **Migração gradual** (implementar, testar, validar antes de limpar)

### RECOMENDAÇÃO FINAL

```
╔═══════════════════════════════════════════════════════════════╗
║  IMPLEMENTAR COM CUIDADO MÁXIMO                               ║
║                                                               ║
║  ✅ É o único ponto que pode quebrar o sistema                ║
║  ✅ Mas é também o que RESOLVE o bug atual                    ║
║  ✅ Com testes adequados, risco é CONTROLÁVEL                 ║
║                                                               ║
║  📋 ANTES DE IMPLEMENTAR:                                     ║
║     1. Aprovar este documento                                 ║
║     2. Criar branch feature/nexus360-base-visivel             ║
║     3. Implementar APENAS esta separação (sem outras mudanças)║
║     4. Testar extensivamente (checklist de 3 cenários)        ║
║     5. Validar com usuário beta                               ║
║     6. Só então fazer merge                                   ║
╚═══════════════════════════════════════════════════════════════╝
```

---

**Data:** 14/01/2026  
**Analista:** Base44 AI  
**Veredicto:** ✅ CRÍTICO mas IMPLEMENTÁVEL com testes rigorosos  
**Status:** ⏸️ Aguardando Aprovação para Implementação Controlada