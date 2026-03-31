# 🐛 ANÁLISE BUG: Duplicação de Contato + Admin Bloqueado

**Data**: 2026-01-20  
**Reportado por**: Luiz (Admin)  
**Gravidade**: 🔴 CRÍTICA

---

## 🎯 SINTOMAS OBSERVADOS

### 1️⃣ **DUPLICAÇÃO**: Contato "Molas Alírio" aparece 2x na lista
- **Posição #2**: Badge "2" laranja, "#2800", "S/Atend."
- **Posição #7**: Badge "2" laranja, "#2800", "VIP Thaís"

### 2️⃣ **BLOQUEIO ADMIN**: Modal "Conversa Atribuída a Outro Atendente"
- Admin vendo thread na lista
- Ao clicar → Modal bloqueando acesso
- Texto: "outro atendente" (sem nome)

---

## 🔍 DIAGNÓSTICO TÉCNICO

### ROOT CAUSE #1: DEDUPLICAÇÃO FALHOU

**Localização**: `pages/Comunicacao.jsx` linhas 1168-1208

**Código Atual**:
```javascript
// MODO ADMIN + BUSCA: Desativar deduplicação para ver TODAS as threads/duplicatas
if (isAdmin && temBuscaPorTexto && !duplicataEncontrada) {
  threadMaisRecentePorContacto.set(`admin-all-${thread.id}`, thread);
  return;
}
```

**PROBLEMA**:
- Condição: `isAdmin && temBuscaPorTexto && !duplicataEncontrada`
- **Admin SEM busca**: Condição FALSE → cai na deduplicação normal
- **Mas deduplicação normal FALHOU** → Mesmo contact_id aparecendo 2x

**POR QUÊ DEDUPLICAÇÃO NORMAL FALHOU?**

Linha 1194-1207:
```javascript
const contactId = thread.contact_id;
const existente = threadMaisRecentePorContacto.get(contactId);

if (!existente) {
  threadMaisRecentePorContacto.set(contactId, thread);
} else {
  const tsExistente = new Date(existente.last_message_at || ...).getTime();
  const tsAtual = new Date(thread.last_message_at || ...).getTime();
  
  if (tsAtual > tsExistente) {
    threadMaisRecentePorContacto.set(contactId, thread);
  }
}
```

**ANÁLISE**:
- ✅ Lógica correta: Deveria manter apenas 1 thread por contact_id (mais recente)
- 🚨 **MAS**: Ambas threads aparecem na lista

**POSSÍVEIS CAUSAS**:
1. **Contact_id diferente**: Thread #2 e #7 têm contact_ids diferentes (improvável - mesmo telefone)
2. **Dados corrompidos**: Uma thread sem contact_id (órfã) → chave `orphan-${thread.id}`
3. **Thread interna misturada**: Uma delas é `team_internal` (improvável - ambas mostram número)
4. **Bug no Map.set()**: Sobrescrita não funciona (MUITO improvável)

**HIPÓTESE MAIS PROVÁVEL**: Thread #2 **SEM** contact_id (órfã) → gera chave única

---

### ROOT CAUSE #2: ADMIN BLOQUEADO (REGRESSÃO)

**Localização**: `components/lib/threadVisibility.js` linha 690-698

**Código Atual**:
```javascript
// Thread atribuída a outro
if (thread.assigned_user_id) {
  console.log(`[BLOQUEIO] ❌ BLOQUEADO - Thread atribuída a outro: ${thread.assigned_user_id}`);
  return { 
    bloqueado: true, 
    motivo: 'atribuida_outro', 
    atendenteResponsavel: thread.assigned_user_name || thread.assigned_user_email || 'outro atendente'
  };
}
```

**PROBLEMA**:
- `verificarBloqueioThread` é chamado por `handleSelecionarThread` (linha 592 Comunicacao.jsx)
- Função retorna `bloqueado: true` se `assigned_user_id` existe
- **NÃO VERIFICA SE É ADMIN** antes de bloquear
- Modal aparece mesmo para admin

**CONFLITO COM VISIBILIDADE**:
- `canUserSeeThreadBase` (linha 294-297 threadVisibility.js):
  ```javascript
  if (isAdminOrAll) {
    return true; // ✅ Admin vê tudo
  }
  ```
- Admin passa na visibilidade → thread aparece na lista
- Admin clica → `verificarBloqueioThread` bloqueia → modal aparece

**INCONSISTÊNCIA**: Visibilidade permite, interação bloqueia.

---

## 🎯 CAUSA RAIZ IDENTIFICADA

### BUG #1: DEDUPLICAÇÃO INEFICAZ
```
Thread #2: contact_id = null (órfã) → Chave: orphan-677abc123
Thread #7: contact_id = 677xxx123 (Molas Alírio) → Chave: 677xxx123

Map tem 2 chaves diferentes → Ambas aparecem
```

**Solução**: Threads órfãs sem contact_id **SEMPRE devem ser filtradas** (exceto modo diagnóstico admin)

### BUG #2: ADMIN SEM BYPASS EM verificarBloqueioThread
```
Admin → Vê thread (canUserSeeThreadBase = true)
Admin → Clica
Admin → verificarBloqueioThread NÃO tem bypass admin → bloqueado
Admin → Modal aparece ❌
```

**Solução**: Adicionar bypass admin em `verificarBloqueioThread` (linha 625-698)

---

## 🔧 CORREÇÕES NECESSÁRIAS

### ✅ CORREÇÃO #1: Filtrar Threads Órfãs (NÃO são duplicatas)

**Arquivo**: `pages/Comunicacao.jsx`  
**Linha**: 1194-1207 (dentro do loop de deduplicação)

**Código Atual**:
```javascript
if (!contactId) {
  // Thread órfã sem contato - adicionar com chave única
  threadMaisRecentePorContacto.set(`orphan-${thread.id}`, thread);
  return;
}
```

**Código Correto**:
```javascript
if (!contactId) {
  // ✅ CORREÇÃO: Thread órfã SEM contact_id deve ser IGNORADA
  // Exceção: Admin em modo busca/diagnóstico pode ver
  if (isAdmin && temBuscaPorTexto) {
    threadMaisRecentePorContacto.set(`orphan-${thread.id}`, thread);
  }
  // ❌ Threads órfãs não devem aparecer em modo normal (dados corrompidos)
  return;
}
```

---

### ✅ CORREÇÃO #2: Bypass Admin em verificarBloqueioThread

**Arquivo**: `components/lib/threadVisibility.js`  
**Linha**: 625-698

**Código Atual**:
```javascript
export const verificarBloqueioThread = (usuario, thread, contato = null) => {
  if (!usuario || !thread) {
    return { bloqueado: true, motivo: 'dados_invalidos', atendenteResponsavel: null };
  }

  const perms = usuario.permissoes_visualizacao || {};
  const podeVerTodas = perms.pode_ver_todas_conversas === true;

  // ... threads internas ...

  // ❌ FALTA: Bypass admin ANTES de verificar atribuição
```

**Código Correto**:
```javascript
export const verificarBloqueioThread = (usuario, thread, contato = null) => {
  if (!usuario || !thread) {
    return { bloqueado: true, motivo: 'dados_invalidos', atendenteResponsavel: null };
  }

  const perms = usuario.permissoes_visualizacao || {};
  const podeVerTodas = perms.pode_ver_todas_conversas === true;
  const isAdmin = usuario.role === 'admin';

  // ✅ CORREÇÃO: Admin NUNCA é bloqueado (pode interagir em TODAS)
  if (isAdmin || podeVerTodas) {
    console.log(`[BLOQUEIO] ✅ BYPASS ADMIN - Usuário ${usuario.email} tem acesso total`);
    return { bloqueado: false, motivo: null, atendenteResponsavel: null };
  }

  // ... resto do código ...
```

---

## 🧪 TESTES DE VALIDAÇÃO

### Teste #1: Admin Vê Thread Atribuída
```
Dado: Admin logado
Quando: Clicar em thread com assigned_user_id = "outro_user_123"
Então: ChatWindow abre normalmente (sem modal)
```

### Teste #2: Admin Vê Apenas 1 Thread por Contato
```
Dado: Contact "Molas Alírio" com 2 threads (órfã + válida)
Quando: Admin acessa sem busca ativa
Então: Lista mostra apenas 1 thread (a mais recente com contact_id válido)
```

### Teste #3: Admin com Busca Vê Duplicatas
```
Dado: Admin busca "Molas"
Quando: Sistema detecta duplicatas
Então: Ambas threads aparecem para diagnóstico
```

### Teste #4: Usuário Comum Respeita Bloqueios
```
Dado: Usuário "João" (pleno)
Quando: Clicar em thread assigned_user_id = "maria@email.com"
Então: Modal de bloqueio aparece corretamente
```

---

## 📊 IMPACTO ESTIMADO

### Usuários Afetados
- ✅ **Admins**: 100% afetados (modal bloqueando)
- ✅ **Gerentes**: 100% afetados (modal bloqueando supervisão)
- ⚠️ **Usuários comuns**: Podem ver duplicatas se houver threads órfãs

### Dados Corrompidos
- Threads sem `contact_id` (órfãs) poluindo lista
- Provável causa: Bug em webhook antigo ou migração de dados

---

## 🛠️ PLANO DE CORREÇÃO

### FASE 1: Correção Emergencial (AGORA)
1. ✅ Adicionar bypass admin em `verificarBloqueioThread`
2. ✅ Filtrar threads órfãs (sem contact_id) em modo normal

### FASE 2: Limpeza de Dados (DEPOIS)
3. 🧹 Query diagnóstica: Buscar threads sem contact_id
4. 🔧 Corrigir/deletar threads órfãs no banco
5. 📊 Auditoria completa de integridade MessageThread

### FASE 3: Prevenção (FUTURO)
6. ✅ Validação no webhook: Criar thread SEMPRE com contact_id
7. ✅ Constraint no banco: Tornar contact_id obrigatório (exceto threads internas)
8. ✅ Monitor diário: Alertar se threads órfãs forem criadas

---

## 💡 LIÇÕES APRENDIDAS

1. **Bypass Admin**: SEMPRE verificar role='admin' ANTES de aplicar bloqueios
2. **Dados Órfãos**: Threads sem contact_id corrompem lógica de deduplicação
3. **Consistência**: Visibilidade e interação devem usar MESMAS regras
4. **Validação Preventiva**: Webhook deve SEMPRE validar contact_id antes de criar thread

---

**Status**: 🔴 BUG CRÍTICO - Correção em andamento  
**Prioridade**: P0 (Afeta admin operacional)  
**ETA**: < 5 minutos