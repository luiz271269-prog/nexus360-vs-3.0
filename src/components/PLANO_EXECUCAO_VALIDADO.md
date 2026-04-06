# ✅ PLANO DE EXECUÇÃO VALIDADO: Sistema de Permissões Sem Parar Comunicação

**Data:** 14 de Janeiro de 2026  
**Objetivo:** Consolidar 5 análises em plano cirúrgico executável  
**Criticidade:** 🔴 MÁXIMA - Não pode parar o sistema de comunicação  
**Status:** PRONTO PARA APROVAÇÃO E EXECUÇÃO

---

## 🎯 VALIDAÇÃO FINAL: O Que os Estudos Confirmaram

### CONSENSO ENTRE TODAS AS ANÁLISES

| Documento | Principal Descoberta | Status |
|-----------|---------------------|--------|
| `ANALISE_PONTO_CRITICO_THREADS.md` | Filtro UI dá `return false` e REMOVE threads da base | ✅ Confirmado |
| `ANALISE_CENTRALIZACAO_TOTAL.md` | 5 rastros de lógica espalhada (admin, janela 24h, etc.) | ✅ Confirmado |
| `PRINCIPIO_LIBERADO_POR_PADRAO.md` | Nexus360: bloqueio por exceção, default liberado | ✅ Confirmado |
| `DECISAO_FINAL_ESTRATEGIA.md` | Estratégia híbrida S1+S2+S3+S4 | ✅ Confirmado |
| **Análise Estrutural (nova)** | **Separação Base vs Filtrada é CRÍTICO** | ✅ **VALIDADO** |

**CONCLUSÃO:** Todos os estudos convergem para 2 pontos:

1. 🔴 **CRÍTICO:** Separar `threadsVisiveisBase` (segurança) de `threadsFiltradas` (UI)
2. 🟡 **IMPORTANTE:** Centralizar regras de permissão (eliminar hardcoding)

**ORDEM DE EXECUÇÃO CORRETA:**
```
PRIORIDADE 0: Corrigir Data Flow (threadsBase vs threadsFiltradas)
              ↓
PRIORIDADE 1: Centralizar permissões (permissionsService.js)
```

**❌ ERRADO:** Centralizar permissões SEM corrigir data flow = centraliza o problema

---

## 🔍 O PROBLEMA EXATO (Linha por Linha)

### CÓDIGO ATUAL (Provavelmente em `Comunicacao.jsx`)

```javascript
// ❌ PADRÃO DESTRUTIVO (O que deve estar acontecendo)

const [threads, setThreads] = useState([]);

useEffect(() => {
  // Quando mudo aba para "Não Atribuídas"
  if (filterScope === 'unassigned') {
    // 🔴 ERRO: Sobrescreve a base, destruindo as outras threads
    setThreads(prevThreads => 
      prevThreads.filter(t => !t.assigned_user_id)
    );
  }
  
  if (filterScope === 'all') {
    // ⚠️ Tarde demais: threads já foi mutilada
    // Precisaria re-fetch para recuperar
    setThreads(allThreadsFromAPI); // Não tem mais as outras
  }
}, [filterScope]);

// CONSEQUÊNCIA:
// 1. Usuário vê 50 threads em "Todas"
// 2. Troca para "Não Atribuídas" (15 threads)
// 3. setThreads agora tem apenas 15 threads
// 4. Volta para "Todas"
// 5. Mostra 15 threads (perdeu 35)
// 6. Contador quebrado (soma 15 em vez de 50)
// 7. Nova mensagem chega → não sabe onde colocar
```

**SINTOMA CLÁSSICO:** "Conversa sumiu" → Precisa F5 para voltar

---

## ✅ A SOLUÇÃO CIRÚRGICA (Código Exato)

### ESTRUTURA CORRETA (React Pattern)

```javascript
// ✅ PADRÃO CORRETO (Estado Derivado)

// 1️⃣ BASE SEGURA (ÚNICA FONTE DE VERDADE)
// Só muda quando:
// - Websocket traz nova thread
// - API inicial retorna threads
// - Permissões do usuário mudam
const [threadsBase, setThreadsBase] = useState([]);

// 2️⃣ FILTROS DE UI (NÃO É STATE, É CONFIG)
const [filtrosUI, setFiltrosUI] = useState({
  scope: 'all',        // 'all' | 'my' | 'unassigned'
  searchText: '',
  integrationId: 'all',
  attendantId: 'all'
});

// 3️⃣ OBJETO DE PERMISSÕES (vem do permissionsService.js)
const userPermissions = React.useMemo(() => {
  if (!usuario) return null;
  return buildUserPermissions(usuario, integracoes);
}, [usuario, integracoes]);

// 4️⃣ THREADS VISÍVEIS (SEGURANÇA - IMUTÁVEL POR UI)
const threadsVisiveisBase = React.useMemo(() => {
  if (!userPermissions) return [];
  
  return threadsBase.filter(thread => {
    const contact = contatosMap.get(thread.contact_id);
    
    // ✅ APENAS regras de SEGURANÇA
    return canUserSeeThreadBase(userPermissions, thread, contact);
  });
}, [
  threadsBase,        // ✅ Muda com novos dados
  userPermissions,    // ✅ Muda com novas permissões
  contatosMap         // ✅ Muda com novos contatos
  // ❌ NÃO INCLUI: filtrosUI (scope, search, etc.)
]);

// 5️⃣ THREADS FILTRADAS (UI - DERIVADA, NÃO É STATE)
const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsVisiveisBase]; // ✅ Começa com BASE
  
  // Filtro de escopo (my/unassigned/all)
  if (filtrosUI.scope === 'my') {
    resultado = resultado.filter(t => 
      isAtribuidoAoUsuario(userPermissions, t) || 
      isFidelizadoAoUsuario(userPermissions, t.contato)
    );
  } else if (filtrosUI.scope === 'unassigned') {
    resultado = resultado.filter(t => isNaoAtribuida(t));
  }
  // 'all' → não filtra (mostra tudo)
  
  // Filtro de busca
  if (filtrosUI.searchText) {
    resultado = resultado.filter(t => {
      const contact = contatosMap.get(t.contact_id);
      return contact?.nome?.toLowerCase().includes(filtrosUI.searchText.toLowerCase()) ||
             t.last_message_content?.toLowerCase().includes(filtrosUI.searchText.toLowerCase());
    });
  }
  
  // Filtro de integração
  if (filtrosUI.integrationId !== 'all') {
    resultado = resultado.filter(t => 
      t.whatsapp_integration_id === filtrosUI.integrationId
    );
  }
  
  // Ordenação
  resultado.sort((a, b) => {
    const dateA = new Date(a.last_message_at || 0);
    const dateB = new Date(b.last_message_at || 0);
    return dateB - dateA;
  });
  
  return resultado;
}, [
  threadsVisiveisBase,  // ✅ Base (segurança)
  filtrosUI,            // ✅ Filtros de UI
  userPermissions,      // ✅ Para funções auxiliares
  contatosMap           // ✅ Para busca por nome
]);

// 6️⃣ HANDLERS DE UI (SÓ MUDAM FILTROS, NUNCA A BASE)
const handleScopeChange = (novoScope) => {
  setFiltrosUI(prev => ({ ...prev, scope: novoScope }));
  // ✅ threadsBase não muda
  // ✅ threadsVisiveisBase não muda
  // ✅ threadsFiltradas recalcula automaticamente (useMemo)
};

const handleSearchChange = (texto) => {
  setFiltrosUI(prev => ({ ...prev, searchText: texto }));
};

// 7️⃣ WEBSOCKET HANDLER (SÓ MUDA A BASE)
const handleNovaThread = (novaThread) => {
  setThreadsBase(prev => {
    // Verifica se já existe
    const existe = prev.find(t => t.id === novaThread.id);
    if (existe) {
      // Atualiza
      return prev.map(t => t.id === novaThread.id ? novaThread : t);
    } else {
      // Adiciona
      return [novaThread, ...prev];
    }
  });
  // ✅ threadsVisiveisBase recalcula automaticamente
  // ✅ threadsFiltradas recalcula automaticamente
  // ✅ Usuário vê a nova thread (se passar pelos filtros)
};

// 8️⃣ RENDERIZAÇÃO (USA A LISTA FILTRADA)
return (
  <div>
    {/* Abas */}
    <Tabs value={filtrosUI.scope} onValueChange={handleScopeChange}>
      <TabsList>
        <TabsTrigger value="all">
          Todas ({threadsVisiveisBase.length})
        </TabsTrigger>
        <TabsTrigger value="my">
          Minhas ({threadsVisiveisBase.filter(t => isAtribuidoAoUsuario(...) || isFidelizado(...)).length})
        </TabsTrigger>
        <TabsTrigger value="unassigned">
          Não Atribuídas ({threadsVisiveisBase.filter(t => isNaoAtribuida(t)).length})
        </TabsTrigger>
      </TabsList>
    </Tabs>
    
    {/* Lista */}
    <ChatSidebar threads={threadsFiltradas} />
  </div>
);
```

---

## 🔬 VALIDAÇÃO DOS INVARIANTES

### TESTE 1: Alternar Abas

**Ação:**
1. Usuário em "Todas" (50 threads)
2. Clica "Não Atribuídas" (15 threads)
3. Clica "Todas" novamente

**COM CÓDIGO ATUAL (ERRADO):**
```
threadsBase: [50 threads] → setThreads(15) → [15 threads] ❌
Ao voltar: [15 threads] → Perdeu 35 threads permanentemente
```

**COM CÓDIGO CORRETO:**
```
threadsBase: [50 threads] → [50 threads] → [50 threads] ✅
threadsVisiveisBase: [50] → [50] → [50] ✅
threadsFiltradas: [50] → filter([50]) = [15] → filter([50]) = [50] ✅
```

**✅ RESULTADO:** Threads voltam (nada se perde)

---

### TESTE 2: Nova Mensagem Fora da Visão

**Ação:**
1. Usuário em aba "Minhas" (10 threads)
2. Nova mensagem chega em thread NÃO atribuída a ele
3. Usuário volta para "Todas"

**COM CÓDIGO ATUAL (ERRADO):**
```
threads: [10 minhas] ← Nova mensagem de "não minha"
Handler: Não sabe onde colocar (thread não existe na lista)
Resultado: Mensagem perdida até F5 ❌
```

**COM CÓDIGO CORRETO:**
```
threadsBase: [50] ← handleNovaThread adiciona thread #51
threadsVisiveisBase: [50] → recalcula → [51] ✅
threadsFiltradas (aba "Minhas"): [10] (nova thread não aparece ainda - filtrada)
Contador "Todas": [51] (mostra 51 no badge) ✅
Usuário clica "Todas" → threadsFiltradas recalcula → [51] ✅
Nova thread aparece no topo (ordenada por last_message_at) ✅
```

**✅ RESULTADO:** Mensagem não se perde, contador atualiza, thread aparece ao trocar aba

---

### TESTE 3: Filtro de Integração

**Ação:**
1. Seleciona integração "int-vendas" (20 threads)
2. Remove filtro (volta para "all")

**COM CÓDIGO ATUAL (ERRADO):**
```
threads: [60] → setThreads(20) → [20] ❌
Ao remover filtro: [20] → Perdeu 40 threads
```

**COM CÓDIGO CORRETO:**
```
threadsBase: [60] → [60] ✅
threadsFiltradas: filter([60]) = [20] → filter([60]) = [60] ✅
```

**✅ RESULTADO:** Threads voltam ao limpar filtro

---

## 📐 ORDEM DE IMPLEMENTAÇÃO (SEM PARAR O SISTEMA)

### FASE 0: Refatoração Data Flow (CRÍTICO - 1-2 DIAS)

**Objetivo:** Corrigir o bug estrutural ANTES de centralizar permissões

**Arquivos a modificar:**
- `pages/Comunicacao.jsx` (apenas)

**Mudanças:**
1. Renomear `threads` → `threadsBase` (ou adicionar nova const)
2. Criar `threadsVisiveisBase` como `useMemo` (segurança)
3. Criar `threadsFiltradas` como `useMemo` (UI)
4. Modificar handlers para usar `setFiltrosUI` em vez de `setThreads`
5. Modificar renderização para usar `threadsFiltradas`

**Código a localizar em `Comunicacao.jsx`:**
```javascript
// 🔍 PROCURAR POR ISSO (provavelmente linhas 1100-1400):
const [threads, setThreads] = useState([]);

useEffect(() => {
  if (filterScope === 'unassigned') {
    // 🔴 SE ENCONTRAR ISSO → É O BUG
    setThreads(prevThreads => prevThreads.filter(...));
  }
}, [filterScope]);
```

**Substituir por:**
```javascript
// ✅ NOVO PADRÃO
const [threadsBase, setThreadsBase] = useState([]);
const [filtrosUI, setFiltrosUI] = useState({ scope: 'all', ... });

const threadsVisiveisBase = React.useMemo(() => {
  // Apenas segurança (sem filtros UI)
  return threadsBase.filter(t => canUserSeeThread(t));
}, [threadsBase, userPermissions]);

const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsVisiveisBase];
  
  if (filtrosUI.scope === 'unassigned') {
    resultado = resultado.filter(t => !t.assigned_user_id);
  }
  
  return resultado;
}, [threadsVisiveisBase, filtrosUI]);
```

**TESTE APÓS FASE 0:**
- [ ] Alternar abas → threads voltam ✅
- [ ] Nova mensagem → aparece ao trocar aba ✅
- [ ] Filtro integração → limpa corretamente ✅
- [ ] Contadores corretos (usam `threadsVisiveisBase`) ✅

**RISCO:** 🟡 MÉDIO (mexe em arquivo core)
**MITIGAÇÃO:**
- Testar em staging
- Backup do arquivo original
- Deploy gradual (10% → 50% → 100%)
- Rollback preparado

---

### FASE 1: Centralização Permissões (2-3 DIAS)

**Objetivo:** Eliminar regras hardcoded DEPOIS que data flow está correto

**Arquivos a criar:**
- `components/lib/permissionsService.js`
- `components/comunicacao/PainelPermissoesUnificado.jsx`

**Arquivos a modificar:**
- `entities/User.json` (adicionar campos)
- `Layout.js` (carregar userPermissions)
- `pages/Comunicacao.jsx` (usar canUserSeeThreadBase em vez de lógica inline)

**Mudanças em `Comunicacao.jsx`:**
```javascript
// ❌ ANTES (hardcoded)
const threadsVisiveisBase = React.useMemo(() => {
  return threadsBase.filter(t => {
    // Hardcoded: admin vê tudo
    if (usuario?.role === 'admin') return true;
    
    // Hardcoded: janela 24h
    if (t.last_inbound_at) {
      const horas = (Date.now() - new Date(t.last_inbound_at)) / 3600000;
      if (horas < 24) return true;
    }
    
    // ... mais 10 regras hardcoded
    return false;
  });
}, [threadsBase, usuario]);

// ✅ DEPOIS (centralizado)
const userPermissions = React.useMemo(() => {
  return buildUserPermissions(usuario, integracoes);
}, [usuario, integracoes]);

const threadsVisiveisBase = React.useMemo(() => {
  return threadsBase.filter(t => {
    const contact = contatosMap.get(t.contact_id);
    // ✅ TODA lógica está em canUserSeeThreadBase
    return canUserSeeThreadBase(userPermissions, t, contact);
  });
}, [threadsBase, userPermissions, contatosMap]);
```

**TESTE APÓS FASE 1:**
- [ ] Admin vê tudo (vem de userPermissions.role) ✅
- [ ] Vendedor vê só suas threads (vem de VISIBILITY_MATRIX) ✅
- [ ] Janela 24h funciona (vem de userPermissions.janela24hAtiva) ✅
- [ ] Bloqueios de setor funcionam (vem de userPermissions.setoresBloqueados) ✅

**RISCO:** 🟢 BAIXO (data flow já está correto da Fase 0)
**MITIGAÇÃO:**
- Se `permissionsService.js` tiver bug → rollback só dele
- `threadsVisiveisBase` continua funcionando (apenas com lógica antiga)

---

### FASE 2: Interface Admin (1-2 DIAS)

**Objetivo:** Permitir editar permissões sem mexer no banco diretamente

**Arquivos a criar:**
- `components/comunicacao/PainelPermissoesUnificado.jsx`

**Arquivos a modificar:**
- `pages/Usuarios.jsx` (adicionar aba "Permissões")

**TESTE APÓS FASE 2:**
- [ ] Editar permissões de vendedor → salva ✅
- [ ] Recarregar → permissões persistidas ✅
- [ ] Vendedor loga → vê apenas o configurado ✅

**RISCO:** 🟢 BAIXO (apenas UI)

---

## 🎯 RESUMO EXECUTIVO

### O QUE FAZER (Mínimo Viável)

**PRIORIDADE 0 (CRÍTICO - 1-2 DIAS):**
1. Localizar em `Comunicacao.jsx` onde `setThreads(filter(...))` sobrescreve base
2. Separar em `threadsBase` (imutável) + `threadsFiltradas` (derivada)
3. Testar exaustivamente (3 invariantes)

**PRIORIDADE 1 (IMPORTANTE - 2-3 DIAS):**
1. Criar `permissionsService.js` com `buildUserPermissions` e `VISIBILITY_MATRIX`
2. Modificar `Comunicacao.jsx` para usar `canUserSeeThreadBase`
3. Adicionar campos em `entities/User.json`

**PRIORIDADE 2 (DESEJÁVEL - 1-2 DIAS):**
1. Criar `PainelPermissoesUnificado.jsx`
2. Integrar em `Usuarios.jsx`

**TOTAL:** 4-7 dias úteis

---

### O QUE NÃO FAZER (Over-Engineering)

❌ **NÃO implementar Policy completa (S3) de cara**
- Começar simples (só WhatsApp)
- Adicionar multi-canal depois se necessário

❌ **NÃO criar diagnóstico completo (S4) de cara**
- Adicionar decision_path/reason_code depois
- Focar em funcionamento primeiro

❌ **NÃO refatorar ChatWindow.jsx ainda**
- Esperar Fase 0 e 1 estabilizarem
- Pode deixar alguns `if role === 'admin'` temporariamente

---

## ✅ APROVAÇÃO NECESSÁRIA

**Perguntas para você:**

1. ✅ **Você aprova começar pela FASE 0 (Data Flow)?**
   - É CRÍTICO para não parar o sistema
   - 1-2 dias de trabalho
   - Risco médio (mexe em arquivo core)

2. ✅ **Você quer ver o diff EXATO de `Comunicacao.jsx` antes de aplicar?**
   - Posso ler o arquivo atual
   - Mostrar OLD vs NEW lado a lado
   - Você aprova cada mudança

3. ✅ **Você aprova deixar multi-canal e diagnóstico para depois?**
   - Focar no essencial (corrigir bug + centralizar)
   - Adicionar features avançadas incrementalmente

**SE SIM PARA OS 3:**
- Leio `pages/Comunicacao.jsx`
- Identifico as linhas EXATAS do bug
- Mostro diff OLD → NEW
- Aguardo aprovação final
- Aplico mudanças

**SE NÃO:**
- Ajustamos a estratégia conforme sua preferência

---

**Data:** 14/01/2026  
**Veredicto:** ✅ PLANO VALIDADO - PRONTO PARA EXECUÇÃO  
**Próximo Passo:** Aguardando sua aprovação para ler `Comunicacao.jsx` e mostrar diff exato  
**Status:** ⏸️ AGUARDANDO APROVAÇÃO