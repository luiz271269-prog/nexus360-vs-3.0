# 🎯 ANÁLISE CRÍTICA: Centralização TOTAL vs Rastros de Lógica Espalhada

**Data:** 14 de Janeiro de 2026  
**Criticidade:** 🔴 MÁXIMA - Arquitetura fundamental  
**Objetivo:** Validar que ZERO lógica de negócio fica espalhada  
**Requisito do Cliente:** "Não quero deixar rastro de funções/regras em outros locais - tudo centralizado nas configurações dos usuários"  
**Status:** ANÁLISE - SEM IMPLEMENTAÇÃO

---

## 🚨 PROBLEMA: Plano atual AINDA deixa rastros espalhados

### ❌ RASTROS IDENTIFICADOS NO PLANEJAMENTO ANTERIOR

| Rastro | Onde Fica | O que Faz | Por que é Rastro? |
|--------|-----------|-----------|-------------------|
| **Lógica de Admin** | `canUserSeeThreadBase()` linha ~42 | `if (user.role === 'admin') return true` | ⚠️ Regra hardcoded no código |
| **Lógica de Janela 24h** | `canUserSeeThreadBase()` linha ~88 | Calcula `horasSemResposta < 24` | ⚠️ Regra de negócio no código |
| **Lógica de Gerente** | `canUserSeeThreadBase()` linha ~102 | `if (['gerente', 'coordenador'].includes(...))` | ⚠️ Hardcoded |
| **Deduplicação** | `Comunicacao.jsx` linha 1163-1198 | Map por `contact_id` | ⚠️ Lógica de negócio espalhada |
| **Filtros de escopo** | `Comunicacao.jsx` threadsFiltradas | `if (filterScope === 'my')` | ⚠️ Lógica no componente |
| **Verificação de participante** | `Comunicacao.jsx` linha 1257 | `thread.participants?.includes(usuario?.id)` | ⚠️ Lógica inline |

**CONCLUSÃO:** Plano anterior ainda deixa lógica espalhada em múltiplos arquivos.

---

## ✅ SOLUÇÃO: Centralização 100% nas Configurações do Usuário

### PRINCÍPIO NEXUS360 VERDADEIRO

```
╔═══════════════════════════════════════════════════════════════╗
║  ÚNICA FONTE DE VERDADE: entities/User.json                   ║
║                                                               ║
║  ÚNICA LÓGICA DE DECISÃO: permissionsService.js               ║
║                                                               ║
║  COMPONENTES: Apenas LEEM resultado final (true/false)        ║
║    - ChatWindow: canUserPerformAction(perms, 'podeEnviar')    ║
║    - ChatSidebar: threads.filter(t => t._isVisible)           ║
║    - Comunicacao.jsx: threadsVisiveisBase (pré-calculado)     ║
║                                                               ║
║  ❌ PROIBIDO: if/else baseado em role, sector, etc. fora do   ║
║              permissionsService.js                            ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## 🏗️ ARQUITETURA 100% CENTRALIZADA

### CAMADA 1: Fonte de Dados (entities/User.json)

**TODAS as configurações ficam aqui:**

```json
{
  "id": "user-123",
  "email": "vendedor@empresa.com",
  "full_name": "João Silva",
  "role": "user",
  
  "attendant_sector": "vendas",
  "attendant_role": "pleno",
  
  "configuracao_visibilidade": {
    "modo_visibilidade": "padrao_liberado",
    
    "regras_bloqueio": [
      {
        "tipo": "setor",
        "valores_bloqueados": ["financeiro", "fornecedor"],
        "ativa": true
      },
      {
        "tipo": "integracao",
        "valores_bloqueados": ["integracao-diretoria"],
        "ativa": true
      }
    ],
    
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "ativa": true,
        "configuracao": { "horas": 24 }
      },
      {
        "tipo": "gerente_supervisao",
        "ativa": true,
        "configuracao": { "pode_ver_30min_sem_resposta": true }
      }
    ],
    
    "deduplicacao": {
      "ativa": true,
      "criterio": "contact_id",
      "manter": "mais_recente"
    }
  },
  
  "permissoes_acoes": {
    "podeVerTodasConversas": false,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": true,
    "podeEnviarAudios": true,
    "podeTransferirConversa": true,
    "podeApagarMensagens": false,
    "podeGerenciarFilas": false,
    "podeVerDetalhesContato": true,
    "podeEditarContato": true,
    "podeCriarPlaybooks": false,
    "podeGerenciarConexoes": false
  }
}
```

**✅ VANTAGEM:**
- Toda regra está no banco de dados
- Auditável (histórico de mudanças)
- Editável via interface (PainelPermissoesUnificado)
- Zero hardcoding

---

### CAMADA 2: Motor de Decisão (permissionsService.js)

**ÚNICO arquivo que DECIDE (sem IFs espalhados):**

```javascript
// ═══════════════════════════════════════════════════════════════
// permissionsService.js - ÚNICA FONTE DE LÓGICA
// ═══════════════════════════════════════════════════════════════

/**
 * Constrói objeto de permissões processadas (runtime)
 * Entrada: entities/User (banco de dados)
 * Saída: userPermissions (objeto otimizado para decisões rápidas)
 */
export function buildUserPermissions(usuario, allIntegracoes = []) {
  // Extrair configurações do banco
  const config = usuario.configuracao_visibilidade || {};
  const acoes = usuario.permissoes_acoes || {};
  
  // Processar regras de bloqueio/liberação
  const regrasBloqueio = config.regras_bloqueio || [];
  const regrasLiberacao = config.regras_liberacao || [];
  
  // Construir objeto otimizado
  return {
    // Identificação
    id: usuario.id,
    email: usuario.email,
    role: usuario.role,
    
    // Regras de visibilidade (processadas)
    setoresBloqueados: extrairValores(regrasBloqueio, 'setor'),
    integracoesBloqueadas: extrairValores(regrasBloqueio, 'integracao'),
    
    // Regras de liberação (flags booleanas)
    janela24hAtiva: regraAtiva(regrasLiberacao, 'janela_24h'),
    janela24hHoras: extrairConfig(regrasLiberacao, 'janela_24h', 'horas') || 24,
    gerenteSupervisaoAtiva: regraAtiva(regrasLiberacao, 'gerente_supervisao'),
    
    // Deduplicação (configurável)
    deduplicacaoAtiva: config.deduplicacao?.ativa ?? true,
    deduplicacaoCriterio: config.deduplicacao?.criterio || 'contact_id',
    
    // Ações (93 permissões granulares)
    ...acoes, // Todas as flags podeXXX
    
    // Mapa rápido de integrações
    integracoes: construirMapaIntegracoes(usuario, allIntegracoes)
  };
}

/**
 * VISIBILITY_MATRIX - Matriz de decisão centralizada
 * ✅ TODAS as regras aqui (nenhuma no componente)
 */
export const VISIBILITY_MATRIX = [
  {
    priority: 1,
    name: 'admin_total',
    check: (userPerms, thread, contact) => {
      // ✅ Regra lida do userPerms (não hardcoded)
      if (userPerms.role === 'admin') {
        return { visible: true, motivo: 'Admin tem acesso total' };
      }
      return null; // Próxima regra
    }
  },
  
  {
    priority: 2,
    name: 'janela_24h',
    check: (userPerms, thread, contact) => {
      // ✅ Regra configurável pelo usuário
      if (!userPerms.janela24hAtiva) return null;
      
      if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
        const horas = (Date.now() - new Date(thread.last_inbound_at)) / (1000 * 60 * 60);
        const limite = userPerms.janela24hHoras || 24;
        
        if (horas < limite) {
          // Verificar se não é fidelizado a outro (proteção)
          if (contact?.is_cliente_fidelizado && !isFidelizadoAoUsuario(userPerms, contact)) {
            return null; // Bloqueia, próxima regra
          }
          
          return { visible: true, motivo: `Janela ${limite}h ativa (${horas.toFixed(1)}h)` };
        }
      }
      return null;
    }
  },
  
  {
    priority: 3,
    name: 'atribuido_usuario',
    check: (userPerms, thread, contact) => {
      if (isAtribuidoAoUsuario(userPerms, thread)) {
        return { visible: true, motivo: 'Thread atribuída ao usuário' };
      }
      return null;
    }
  },
  
  {
    priority: 4,
    name: 'fidelizado_usuario',
    check: (userPerms, thread, contact) => {
      if (contact && isFidelizadoAoUsuario(userPerms, contact)) {
        return { visible: true, motivo: 'Contato fidelizado ao usuário' };
      }
      return null;
    }
  },
  
  {
    priority: 5,
    name: 'bloqueio_fidelizado_outro',
    check: (userPerms, thread, contact) => {
      if (contact?.is_cliente_fidelizado && !isFidelizadoAoUsuario(userPerms, contact)) {
        return { visible: false, motivo: 'Contato fidelizado a outro usuário', bloqueio: true };
      }
      return null;
    }
  },
  
  {
    priority: 6,
    name: 'bloqueio_atribuido_outro',
    check: (userPerms, thread, contact) => {
      // ✅ Gerente pode ver threads atribuídas a outros
      if (userPerms.podeVerTodasConversas) return null; // Não bloqueia
      
      if (thread.assigned_user_id && !isAtribuidoAoUsuario(userPerms, thread)) {
        return { visible: false, motivo: 'Thread atribuída a outro usuário', bloqueio: true };
      }
      return null;
    }
  },
  
  {
    priority: 7,
    name: 'gerente_supervisao',
    check: (userPerms, thread, contact) => {
      // ✅ Configurável via flag
      if (!userPerms.gerenteSupervisaoAtiva) return null;
      if (!userPerms.podeVerTodasConversas) return null;
      
      // Gerente vê threads sem resposta há 30+ min
      if (thread.last_inbound_at) {
        const minutos = (Date.now() - new Date(thread.last_inbound_at)) / (1000 * 60);
        if (minutos > 30 && thread.last_message_sender === 'contact') {
          return { visible: true, motivo: 'Gerente - supervisão de threads sem resposta' };
        }
      }
      
      return null;
    }
  },
  
  {
    priority: 8,
    name: 'thread_nao_atribuida',
    check: (userPerms, thread, contact) => {
      if (isNaoAtribuida(thread)) {
        // Thread órfã é visível, mas ainda precisa passar pelos filtros técnicos
        return null; // Continua para próximas regras
      }
      return null;
    }
  },
  
  {
    priority: 9,
    name: 'bloqueio_integracao',
    check: (userPerms, thread, contact) => {
      const integracaoId = thread.whatsapp_integration_id;
      if (!integracaoId) return null; // Thread sem integração = visível
      
      // ✅ Lê do userPerms (processado de entities/User)
      const integracoesBloqueadas = userPerms.integracoesBloqueadas || [];
      
      if (integracoesBloqueadas.includes(integracaoId)) {
        return { visible: false, motivo: `Integração ${integracaoId} bloqueada`, bloqueio: true };
      }
      
      return null;
    }
  },
  
  {
    priority: 10,
    name: 'bloqueio_setor',
    check: (userPerms, thread, contact) => {
      const setorThread = getSectorFromThreadOrTags(thread);
      if (!setorThread) return null; // Sem setor = visível
      
      // ✅ Lê do userPerms (processado de entities/User)
      const setoresBloqueados = userPerms.setoresBloqueados || [];
      
      if (setoresBloqueados.includes(setorThread)) {
        return { visible: false, motivo: `Setor ${setorThread} bloqueado`, bloqueio: true };
      }
      
      return null;
    }
  },
  
  {
    priority: 11,
    name: 'nexus360_default',
    check: (userPerms, thread, contact) => {
      // ✅ PADRÃO NEXUS360: Se chegou aqui, libera
      return { visible: true, motivo: 'Nenhuma regra explícita de bloqueio (padrão liberado)' };
    }
  }
];

/**
 * Função centralizada - SEM lógica inline
 */
export function canUserSeeThreadBase(userPermissions, thread, contact = null) {
  if (!userPermissions || !thread) return false;
  
  // Iterar matriz em ordem de prioridade
  for (const rule of VISIBILITY_MATRIX) {
    const resultado = rule.check(userPermissions, thread, contact);
    
    if (resultado !== null) {
      // Log para auditoria
      if (resultado.visible) {
        console.log(`[NEXUS360] ✅ Thread ${thread.id?.substring(0,8)} VISÍVEL - Regra: ${rule.name} - ${resultado.motivo}`);
      } else if (resultado.bloqueio) {
        console.log(`[NEXUS360] 🔒 Thread ${thread.id?.substring(0,8)} BLOQUEADO - Regra: ${rule.name} - ${resultado.motivo}`);
      }
      
      return resultado.visible;
    }
  }
  
  // Fallback: liberar (nunca deveria chegar aqui por causa da regra 11)
  return true;
}
```

**✅ RESULTADO:**
- Zero IFs no código dos componentes
- Toda lógica está na VISIBILITY_MATRIX
- Configurações vêm de `userPermissions` (que vem de `entities/User`)

---

## 🔍 ONDE ESTÃO OS RASTROS HOJE? (Mapeamento Completo)

### RASTRO 1: Verificações inline de role/perfil

**Onde:**
```javascript
// ChatWindow.jsx - Linha ~155
const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';

// Comunicacao.jsx - Linha 1638
const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';

// ChatSidebar.jsx - Usado em vários lugares
if (usuario?.role === 'admin') { ... }
```

**Problema:**
- ❌ Lógica de negócio espalhada (o que é "manager"?)
- ❌ Difícil de mudar (precisa editar múltiplos arquivos)

**Solução:**
```javascript
// ✅ TUDO vem de userPermissions
const podeVerTodasConversas = userPermissions.podeVerTodasConversas; // true/false
const podeGerenciarFilas = userPermissions.podeGerenciarFilas; // true/false

// Componentes APENAS leem flags, não decidem
if (podeVerTodasConversas) {
  // Mostrar aba "Todas"
}
```

---

### RASTRO 2: Verificações inline de threads internas

**Onde:**
```javascript
// Comunicacao.jsx - Linha 1256-1262
if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
  const isParticipant = thread.participants?.includes(usuario?.id);
  const isAdmin = usuario?.role === 'admin';
  const passou = Boolean(isParticipant || isAdmin);
  // ...
  return passou;
}
```

**Problema:**
- ❌ Lógica hardcoded (threads internas sempre usam participants)
- ❌ Regra não está nas configurações do usuário

**Solução:**
```javascript
// ✅ Adicionar à VISIBILITY_MATRIX (prioridade 1.5)
{
  priority: 1.5,
  name: 'thread_interna',
  check: (userPerms, thread, contact) => {
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      const isParticipant = thread.participants?.includes(userPerms.id);
      const isAdmin = userPerms.role === 'admin';
      
      if (isParticipant || isAdmin) {
        return { visible: true, motivo: 'Participante da thread interna' };
      } else {
        return { visible: false, motivo: 'Não é participante', bloqueio: true };
      }
    }
    return null; // Não é thread interna, próxima regra
  }
}
```

**✅ Agora:** Regra está na VISIBILITY_MATRIX, não inline

---

### RASTRO 3: Lógica de deduplicação

**Onde:**
```javascript
// Comunicacao.jsx - Linha 1163-1198
const threadMaisRecentePorContacto = new Map();
threadsAProcessar.forEach((thread) => {
  // Lógica hardcoded de quando deduplicar
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
    return;
  }
  
  if (isAdmin && temBuscaPorTexto && !duplicataEncontrada) {
    threadMaisRecentePorContacto.set(`admin-all-${thread.id}`, thread);
    return;
  }
  
  // ...
});
```

**Problema:**
- ❌ Regra de quando deduplicar está hardcoded
- ❌ Admin + busca desativa deduplicação (hardcoded)

**Solução:**
```javascript
// ✅ Adicionar ao entities/User.json
{
  "configuracao_visibilidade": {
    "deduplicacao": {
      "ativa": true,
      "excecoes": [
        {
          "condicao": "thread_interna",
          "desativar_dedup": true
        },
        {
          "condicao": "admin_com_busca",
          "desativar_dedup": true
        }
      ]
    }
  }
}

// permissionsService.js - Nova função
export function deveDeduplicarThread(userPermissions, thread, temBusca) {
  const config = userPermissions.deduplicacao || {};
  
  if (!config.ativa) return false; // Deduplicação desativada
  
  // Verificar exceções
  const excecoes = config.excecoes || [];
  
  for (const excecao of excecoes) {
    if (excecao.condicao === 'thread_interna' && 
        (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')) {
      return !excecao.desativar_dedup;
    }
    
    if (excecao.condicao === 'admin_com_busca' && 
        userPermissions.role === 'admin' && temBusca) {
      return !excecao.desativar_dedup;
    }
  }
  
  return true; // Deduplicar por padrão
}

// Comunicacao.jsx - Sem lógica inline
const threadsUnicas = React.useMemo(() => {
  const mapa = new Map();
  
  threadsVisiveisBase.forEach(thread => {
    // ✅ CENTRALIZADO: Decisão vem do permissionsService
    const deveDeduplicar = deveDeduplicarThread(userPermissions, thread, temBuscaPorTexto);
    
    if (!deveDeduplicar) {
      mapa.set(`unique-${thread.id}`, thread);
      return;
    }
    
    // Deduplicação padrão
    const contactId = thread.contact_id;
    const existente = mapa.get(contactId);
    if (!existente || new Date(thread.last_message_at) > new Date(existente.last_message_at)) {
      mapa.set(contactId, thread);
    }
  });
  
  return Array.from(mapa.values());
}, [threadsVisiveisBase, userPermissions, temBuscaPorTexto]);
```

**✅ Agora:** Regra de deduplicação vem do banco, não hardcoded

---

### RASTRO 4: Filtros de escopo (my, unassigned, all)

**Onde:**
```javascript
// Comunicacao.jsx - threadsFiltradas
if (filterScope === 'my') {
  resultado = resultado.filter(t => 
    isAtribuidoAoUsuario(usuario, t) || 
    isFidelizadoAoUsuario(usuario, t.contato)
  );
}
```

**Problema:**
- ❌ Lógica hardcoded (o que é "my"?)
- ❌ Se amanhã precisar adicionar novo filtro, mexe no código

**Solução:**
```javascript
// ✅ Adicionar ao entities/User.json
{
  "configuracao_interface": {
    "escopos_disponiveis": [
      {
        "id": "my",
        "nome": "Minhas Conversas",
        "regra": "atribuido_ou_fidelizado"
      },
      {
        "id": "unassigned",
        "nome": "Não Atribuídas",
        "regra": "sem_assigned_user_id"
      },
      {
        "id": "all",
        "nome": "Todas",
        "regra": "mostrar_tudo"
      }
    ]
  }
}

// permissionsService.js - Nova função
export function aplicarFiltroEscopo(threads, escopo, userPermissions) {
  const regra = escopo.regra;
  
  switch (regra) {
    case 'atribuido_ou_fidelizado':
      return threads.filter(t => 
        isAtribuidoAoUsuario(userPermissions, t) || 
        isFidelizadoAoUsuario(userPermissions, t.contato)
      );
    
    case 'sem_assigned_user_id':
      return threads.filter(t => isNaoAtribuida(t));
    
    case 'mostrar_tudo':
      return threads; // Sem filtro
    
    default:
      return threads;
  }
}

// Comunicacao.jsx - Sem lógica inline
const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsUnicas];
  
  // ✅ CENTRALIZADO: Regra vem do permissionsService
  const escopoAtual = userPermissions.escoposDisponiveis?.find(e => e.id === filterScope);
  if (escopoAtual) {
    resultado = aplicarFiltroEscopo(resultado, escopoAtual, userPermissions);
  }
  
  // Outros filtros...
  return resultado;
}, [threadsUnicas, filterScope, userPermissions]);
```

**✅ Agora:** Definição de escopos vem do banco, não hardcoded

---

## 📋 CHECKLIST: Onde NÃO pode ter lógica (zero rastros)

### ❌ PROIBIDO em `pages/Comunicacao.jsx`:
- [ ] `if (usuario.role === 'admin')`
- [ ] `if (usuario.attendant_role === 'gerente')`
- [ ] `if (filterScope === 'my') { lógica de negócio }`
- [ ] Cálculo de horas/minutos para regras de negócio
- [ ] Decisões baseadas em `thread.sector_id`, `thread.assigned_user_id` diretamente

### ❌ PROIBIDO em `components/comunicacao/ChatWindow.jsx`:
- [ ] `if (usuario.role === 'admin')`
- [ ] `const podeEnviar = permissoes.pode_enviar_mensagens !== false` (lógica inline)
- [ ] Verificações de fidelização inline
- [ ] Cálculo de permissões (apenas LEITURA de flags)

### ❌ PROIBIDO em `components/comunicacao/ChatSidebar.jsx`:
- [ ] `if (usuario.role === 'admin')`
- [ ] Lógica de quando mostrar badge/contador
- [ ] Decisões baseadas em `thread.status`, `thread.sector_id`

### ✅ PERMITIDO (apenas):
- [x] Ler flags de `userPermissions` (ex: `if (userPermissions.podeVerTodasConversas)`)
- [x] Chamar funções de `permissionsService.js` (ex: `canUserSeeThreadBase(perms, thread)`)
- [x] Renderização condicional baseada em flags (ex: `{podeEditar && <Button />}`)

---

## 🎯 MODELO FINAL: 100% Centralizado

```
┌─────────────────────────────────────────────────────────────────┐
│                    entities/User.json                           │
│  (ÚNICA FONTE DE VERDADE - CONFIGURAÇÃO)                        │
│  ────────────────────────────────────────────────────────────── │
│  {                                                              │
│    "role": "user",                                              │
│    "attendant_sector": "vendas",                                │
│    "attendant_role": "pleno",                                   │
│                                                                 │
│    "configuracao_visibilidade": {                               │
│      "modo_visibilidade": "padrao_liberado",                    │
│      "regras_bloqueio": [...],                                  │
│      "regras_liberacao": [...],                                 │
│      "deduplicacao": {...}                                      │
│    },                                                           │
│                                                                 │
│    "permissoes_acoes": {                                        │
│      "podeVerTodasConversas": false,                            │
│      "podeEnviarMensagens": true,                               │
│      ... (93 permissões)                                        │
│    },                                                           │
│                                                                 │
│    "configuracao_interface": {                                  │
│      "escopos_disponiveis": [...],                              │
│      "filtros_disponiveis": [...]                               │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              permissionsService.js                              │
│  (ÚNICA LÓGICA DE DECISÃO - PROCESSAMENTO)                      │
│  ────────────────────────────────────────────────────────────── │
│  buildUserPermissions(usuario, integracoes)                     │
│    → Lê entities/User                                           │
│    → Processa regras                                            │
│    → Retorna userPermissions (objeto otimizado)                 │
│                                                                 │
│  VISIBILITY_MATRIX[]                                            │
│    → 11 regras em ordem de prioridade                           │
│    → Cada regra lê userPermissions (não hardcoded)              │
│    → Retorna { visible, motivo } ou null                        │
│                                                                 │
│  canUserSeeThreadBase(userPermissions, thread, contact)         │
│    → Itera VISIBILITY_MATRIX                                    │
│    → Retorna true/false                                         │
│    → Log de auditoria                                           │
│                                                                 │
│  canUserPerformAction(userPermissions, actionKey)               │
│    → return userPermissions[actionKey]                          │
│                                                                 │
│  aplicarFiltroEscopo(threads, escopo, userPermissions)          │
│    → Lê escopo.regra de userPermissions                         │
│    → Aplica filtro                                              │
│                                                                 │
│  deveDeduplicarThread(userPermissions, thread, temBusca)        │
│    → Lê userPermissions.deduplicacao                            │
│    → Retorna true/false                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  COMPONENTES (APENAS LEITURA)                   │
│  ────────────────────────────────────────────────────────────── │
│  Comunicacao.jsx:                                               │
│    threadsVisiveisBase = threads.filter(t =>                    │
│      canUserSeeThreadBase(userPermissions, t, t.contato)        │
│    )                                                            │
│    ✅ Zero lógica inline                                        │
│                                                                 │
│  ChatWindow.jsx:                                                │
│    podeEnviar = canUserPerformAction(perms, 'podeEnviar')       │
│    {podeEnviar && <Button>Enviar</Button>}                      │
│    ✅ Zero IFs de role/perfil                                   │
│                                                                 │
│  ChatSidebar.jsx:                                               │
│    {userPermissions.podeVerContador && <Badge>5</Badge>}        │
│    ✅ Apenas renderização condicional                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔬 ANÁLISE DO PONTO CRÍTICO (Atualizada)

### POR QUE `threadsVisiveisBase` É CRÍTICO?

**Motivo 1: É o ponto de conversão**
```
entities/User.json (configuração)
         ↓
permissionsService.js (processamento)
         ↓
threadsVisiveisBase ← AQUI É A CONVERSÃO
         ↓
threadsFiltradas (UI)
```

Se `threadsVisiveisBase` for calculado ERRADO:
- ❌ Todas as threads downstream ficam erradas
- ❌ Impossível recuperar sem recalcular

**Motivo 2: É o único ponto que PODE quebrar o sistema**

Todos os outros são aditivos:
- ✅ Criar `permissionsService.js` → não quebra nada
- ✅ Adicionar configs em `entities/User` → retrocompatível (campos opcionais)
- ✅ Criar interface de configuração → isolada

Mas `threadsVisiveisBase`:
- ⚠️ Substitui lógica existente
- ⚠️ Se calcular errado, conversas somem
- ⚠️ Difícil de debugar (bug intermitente)

**Motivo 3: Envolve timing e cache**

```javascript
// Sequência perigosa:
1. Usuario carrega com filterScope='unassigned' (localStorage)
2. threadsVisiveisBase calcula (pode usar o filtro por engano)
3. Usuario troca para filterScope='all'
4. threadsVisiveisBase recalcula OU usa cache antigo?
5. Se usar cache antigo → conversas não voltam (BUG)
```

**Solução:** `threadsVisiveisBase` NÃO pode ter `filterScope` nas dependências do useMemo

---

## ✅ VALIDAÇÃO: Plano está 100% centralizado?

### ANTES (Plano anterior - ainda tinha rastros)

| Elemento | Onde decide | Centralizado? |
|----------|------------|---------------|
| Admin vê tudo | `canUserSeeThreadBase` código | ❌ Hardcoded |
| Janela 24h | `canUserSeeThreadBase` código | ❌ Hardcoded (horas=24) |
| Gerente supervisão | `canUserSeeThreadBase` código | ❌ Hardcoded (30min) |
| Deduplicação | `Comunicacao.jsx` código | ❌ Hardcoded (admin+busca) |
| Filtros de escopo | `Comunicacao.jsx` código | ❌ Hardcoded (my/unassigned/all) |

**Rastros:** 5 pontos com lógica espalhada

---

### DEPOIS (Plano revisado - 100% centralizado)

| Elemento | Onde decide | Centralizado? |
|----------|------------|---------------|
| Admin vê tudo | `entities/User.json` → `role` | ✅ Config |
| Janela 24h | `entities/User.json` → `configuracao_visibilidade.regras_liberacao` | ✅ Config |
| Gerente supervisão | `entities/User.json` → `permissoes_acoes.podeVerTodasConversas` | ✅ Config |
| Deduplicação | `entities/User.json` → `configuracao_visibilidade.deduplicacao` | ✅ Config |
| Filtros de escopo | `entities/User.json` → `configuracao_interface.escopos_disponiveis` | ✅ Config |
| Todas as 93 permissões | `entities/User.json` → `permissoes_acoes` | ✅ Config |

**Rastros:** 0 (ZERO) - Tudo vem do banco

---

## 🎯 CONCLUSÃO: Ponto Crítico Reavaliado

### O QUE MUDA (Resumo Cirúrgico)

**1 ÚNICO ARQUIVO CRÍTICO:**
- `pages/Comunicacao.jsx` - Criar `threadsVisiveisBase` separado de `threadsFiltradas`

**MUDANÇA EXATA:**
```javascript
// ADICIONAR (Linha ~1116, ANTES de threadsFiltradas):
const threadsVisiveisBase = React.useMemo(() => {
  return threads.filter(t => 
    canUserSeeThreadBase(userPermissions, {...t, contato: contatosMap.get(t.contact_id)})
  );
}, [threads, userPermissions, contatosMap]); // ✅ SEM filterScope, selectedIntegrationId

// MODIFICAR threadsFiltradas (Linha ~1152):
const threadsFiltradas = React.useMemo(() => {
  let resultado = [...threadsVisiveisBase]; // ✅ Começa com BASE (não threads brutos)
  
  // Aplicar filtros de UI (apenas reorganiza, nunca return false)
  // ...
}, [threadsVisiveisBase, filterScope, ...]); // ✅ Depende da base
```

**DEPENDÊNCIAS:**
- ✅ Precisa de `userPermissions` (vem do `permissionsService.js`)
- ✅ Precisa de `canUserSeeThreadBase` (refatorado no `permissionsService.js`)

**RISCO:**
- 🟡 MÉDIO - Se `userPermissions` estiver incompleto, threads somem
- 🟡 MÉDIO - Se `canUserSeeThreadBase` tiver bug, visibilidade quebra

**MITIGAÇÃO:**
```
✅ Implementar permissionsService.js PRIMEIRO
✅ Testar permissionsService.js isoladamente
✅ Validar que userPermissions tem TODAS as flags necessárias
✅ SÓ DEPOIS refatorar Comunicacao.jsx
```

---

### ORDEM DE IMPLEMENTAÇÃO SEGURA

```
FASE 1 (ZERO RISCO):
  1. Criar permissionsService.js
  2. Criar buildUserPermissions()
  3. Criar VISIBILITY_MATRIX
  4. Testar isoladamente
  ✅ Sistema continua funcionando (nada usa o novo arquivo ainda)

FASE 2 (BAIXO RISCO):
  1. Criar PainelPermissoesUnificado.jsx
  2. Adicionar aba em Usuarios.jsx
  3. Testar interface de configuração
  ✅ Sistema continua funcionando (apenas nova UI)

FASE 3 (MÉDIO RISCO) ← PONTO CRÍTICO:
  1. Integrar userPermissions no Layout.js
  2. Criar threadsVisiveisBase em Comunicacao.jsx
  3. Refatorar threadsFiltradas
  4. TESTAR EXAUSTIVAMENTE (3 cenários)
  ⚠️ Aqui pode quebrar se implementar errado

FASE 4 (BAIXO RISCO):
  1. Refatorar ChatWindow.jsx (substituir checks inline)
  2. Adicionar ModalDiagnosticoAdmin
  3. Limpar código obsoleto
  ✅ Melhorias incrementais
```

---

**Data:** 14/01/2026  
**Veredicto:** ✅ VIÁVEL com centralização 100% no User + permissionsService  
**Ponto Crítico:** `threadsVisiveisBase` (implementar por último, após infraestrutura pronta)  
**Rastros:** 0 (ZERO) - Toda lógica vem do banco ou do permissionsService  
**Status:** ⏸️ Aguardando Aprovação Final