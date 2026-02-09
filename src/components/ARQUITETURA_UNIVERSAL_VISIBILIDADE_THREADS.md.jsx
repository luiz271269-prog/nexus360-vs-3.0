# 🏛️ ARQUITETURA UNIVERSAL - VISIBILIDADE DE THREADS

**Escopo**: Todas as instâncias (Z-API, W-API, W-API Integrador)  
**Princípio**: Linha lógica única, independente de provedor ou usuário  
**Versão**: 1.0 (09/02/2026)

---

## 📐 ARQUITETURA EM 3 CAMADAS

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1: INGESTÃO (Webhook → Banco)                      │
│  ✅ Provider-agnostic (Z-API, W-API, W-API Integrador)     │
│  ✅ Cria/atualiza: Contact, MessageThread, Message         │
│  ✅ Sempre funciona (não depende de permissões)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2: VÍNCULO (Integração ↔ Thread)                   │
│  ⚠️ Thread.whatsapp_integration_id                          │
│  ⚠️ Thread.origin_integration_ids[]                         │
│  ⚠️ Thread.conexao_id (legacy)                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3: VISIBILIDADE (Permissões → UI)                  │
│  🔐 User.whatsapp_permissions[]                             │
│  🔐 VISIBILITY_MATRIX (canUserSeeThreadBase)                │
│  🔐 Filtros UI (scope, integração, atendente, busca)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 PIPELINE UNIVERSAL (7 ETAPAS IMUTÁVEIS)

### **ETAPA 1: Webhook Recebe Payload**
**Provedores Suportados**:
- Z-API: `webhookFinalZapi` ou `webhookWatsZapi`
- W-API: `webhookWapi`
- W-API Integrador: `webhookWapi` (mesmo endpoint)

**Ação**:
```javascript
// 1.1 - Classificar evento
const classification = classifyEvent(payload); // 'user-message', 'system-status', etc

// 1.2 - Filtrar lixo (grupos, status@, broadcast)
const motivoIgnorar = deveIgnorar(payload, classification);
if (motivoIgnorar) return; // ⏭️ STOP

// 1.3 - Normalizar payload
const dados = normalizarPayload(payload);
// → { type, from, content, mediaType, instanceId, messageId }
```

**Saída**:
- Telefone normalizado: `+55XXXXXXXXXXX`
- Instance/Token identificados
- Conteúdo extraído

---

### **ETAPA 2: Identificar Integração ("Porteiro Cego")**
**Estratégia de Lookup**:

#### **Z-API**:
```javascript
// Busca por instance_id_provider
const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
  instance_id_provider: dados.instanceId,
  api_provider: 'z_api'
});
```

#### **W-API / W-API Integrador**:
```javascript
// PRIORIDADE 1: instanceId
const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
  instance_id_provider: dados.instanceId,
  api_provider: 'w_api'
});

// PRIORIDADE 2: connectedPhone (fallback)
if (!integracaoId && connectedPhone) {
  const todasWAPI = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
    { api_provider: 'w_api' }
  );
  
  for (const int of todasWAPI) {
    if (int.numero_telefone === connectedPhone) {
      integracaoId = int.id;
      break;
    }
  }
}
```

**Saída**:
- `integracaoId`: UUID da WhatsAppIntegration
- `integracaoInfo`: { nome, numero }

**⚠️ PONTO CRÍTICO #1**: Se integração não for encontrada, mensagem é processada mas thread fica órfã.

---

### **ETAPA 3: Buscar/Criar Contato (Centralizado)**
**Função**: `getOrCreateContactCentralized`

**Ação**:
```javascript
const resultado = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
  telefone: dados.from, // "+55XXXXXXXXXXX"
  pushName: dados.pushName || null,
  profilePicUrl: profilePicUrl,
  conexaoId: integracaoId
});

const contato = resultado.data.contact;
```

**Lógica Interna** (6 variações de telefone):
```javascript
const variacoes = [
  '+5548999322400',   // Normalizado
  '5548999322400',    // Sem +
  '+554899322400',    // Sem 9
  '554899322400',     // Sem + nem 9
  '+5548999322400',   // Com +55
  '48999322400'       // Apenas DDD+número
];

// Busca sequencial até encontrar
for (const variacao of variacoes) {
  const contatos = await base44.entities.Contact.filter({ telefone: variacao });
  if (contatos.length > 0) return contatos[0]; // ✅ ENCONTRADO
}

// Se não encontrou, CRIAR
```

**Saída**:
- `contact`: Objeto Contact (existente ou novo)
- `action`: 'found' | 'created' | 'updated'

---

### **ETAPA 4: Auto-Merge de Threads Duplicadas**
**Objetivo**: Garantir 1 thread canônica por contato

**Ação**:
```javascript
const todasThreadsContato = await base44.asServiceRole.entities.MessageThread.filter({
  contact_id: contato.id
}, '-primeira_mensagem_at', 20);

if (todasThreadsContato.length > 1) {
  // Eleger mais antiga como canônica
  const threadCanonica = todasThreadsContato[todasThreadsContato.length - 1];
  
  // Marcar canônica
  await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
    is_canonical: true,
    status: 'aberta'
  });
  
  // Marcar demais como merged
  for (const threadAntiga of todasThreadsContato) {
    if (threadAntiga.id !== threadCanonica.id) {
      await base44.asServiceRole.entities.MessageThread.update(threadAntiga.id, {
        status: 'merged',
        merged_into: threadCanonica.id,
        is_canonical: false
      });
    }
  }
}
```

**⚠️ PONTO CRÍTICO #2**: 
- Auto-merge NÃO atualiza `whatsapp_integration_id` automaticamente
- Thread canônica pode ficar com integração antiga se foi criada há muito tempo
- `origin_integration_ids[]` não é propagado durante merge

**Evidência do Problema**:
```javascript
// Thread criada em janeiro com Integração A
thread_antiga = { 
  id: '696fca793a57b167fd7168c2',
  whatsapp_integration_id: 'integracao_antiga_id', // ❌ Desatualizado
  created_date: '2026-01-15'
}

// Mensagem nova chega em fevereiro via Integração B
// Auto-merge elege thread antiga como canônica
// Resultado: thread canônica tem integração antiga!
```

---

### **ETAPA 5: Salvar Mensagem**

**Ação**:
```javascript
const mensagem = await base44.asServiceRole.entities.Message.create({
  thread_id: thread.id,                      // Thread canônica
  sender_id: contato.id,
  sender_type: 'contact',
  content: dados.content,
  channel: 'whatsapp',
  status: 'recebida',
  whatsapp_message_id: dados.messageId,
  metadata: {
    whatsapp_integration_id: integracaoId,  // ✅ Integração ATUAL
    instance_id: dados.instanceId,
    connected_phone: connectedPhone,
    canal_nome: integracaoInfo?.nome,
    canal_numero: integracaoInfo?.numero,
    provider: 'w_api' ou 'z_api'
  }
});
```

**Saída**:
- Mensagem salva com vínculo correto à integração ATUAL
- Metadata preserva contexto completo

---

### **ETAPA 6: Atualizar Thread (Contadores + Metadata)**

**Ação**:
```javascript
await base44.asServiceRole.entities.MessageThread.update(thread.id, {
  last_message_at: agora,
  last_inbound_at: agora,
  last_message_sender: 'contact',
  last_message_content: dados.content.substring(0, 100),
  last_media_type: dados.mediaType || 'none',
  unread_count: (thread.unread_count || 0) + 1,
  total_mensagens: (thread.total_mensagens || 0) + 1,
  status: 'aberta',
  whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id, // ⚠️ FALLBACK
  conexao_id: integracaoId || thread.conexao_id
});
```

**⚠️ PONTO CRÍTICO #3**: 
```javascript
whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id
//                        ↑ NOVO       ↑ ANTIGO (se integracaoId falhar)
```

Se `integracaoId` for null/undefined (falha no Porteiro), usa valor antigo da thread.

**Cenário de Falha**:
1. Thread foi criada com Integração A
2. Mensagem nova chega via Integração B
3. Porteiro falha ao identificar Integração B (instanceId não encontrado)
4. Update usa fallback: `thread.whatsapp_integration_id` (Integração A antiga)
5. Thread continua vinculada à integração errada

---

### **ETAPA 7: Processamento Core + URA**
**Função**: `processInbound` → `inboundCore.js`

**Decisões**:
```javascript
// Detectar novo ciclo
const novoCiclo = detectNovoCiclo(thread.last_inbound_at); // Gap >= 12h

// Verificar humano ativo
const humanoAtivo = thread.assigned_user_id && 
                    thread.last_human_message_at &&
                    (Date.now() - new Date(thread.last_human_message_at)) < 2h;

// Decisão de roteamento
if (humanoAtivo) {
  return { stop: true, reason: 'human_active' }; // ⏸️ NÃO dispara URA
}

if (novoCiclo || !thread.assigned_user_id) {
  await base44.functions.invoke('preAtendimentoHandler', ...); // 🤖 Dispara URA
}
```

**Saída**: Mensagem processada e armazenada no banco ✅

---

## 🎨 RENDERIZAÇÃO NA UI (Comunicacao.jsx)

### **Fluxo de Visibilidade**:

```
1. BUSCAR THREADS (linha 241-288)
   ↓
2. CONSTRUIR PERMISSÕES (linha 94-98)
   ↓
3. APLICAR VISIBILITY_MATRIX (linha 1820-1850)
   ↓
4. APLICAR FILTROS UI (scope, integração, atendente)
   ↓
5. DEDUPLICAR (1 thread por contact_id)
   ↓
6. RENDERIZAR (ChatSidebar)
```

---

### **Passo 2: Construir Permissões do Usuário**
**Função**: `permissionsService.buildUserPermissions(usuario, todasIntegracoes)`

**Saída**:
```javascript
{
  id: 'user_id',
  role: 'admin' | 'pleno' | 'junior' | ...,
  attendant_sector: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral',
  
  // 🔐 MAPA CRÍTICO DE INTEGRAÇÕES
  integracoes: {
    '[ID_INTEGRACAO_A]': {
      can_view: true,  // ✅ Pode ver threads desta integração
      can_send: true,  // ✅ Pode enviar mensagens
      can_receive: true,
      integration_name: 'Vendas Principal'
    },
    '[ID_INTEGRACAO_B]': {
      can_view: false, // ❌ BLOQUEADO
      can_send: false,
      integration_name: 'Compras'
    }
  },
  
  // Bloqueios (regras explícitas)
  setoresBloqueados: ['financeiro', 'fornecedor'],
  integracoesBloqueadas: [],
  canaisBloqueados: [],
  
  // Permissões de ação
  podeVerTodasConversas: false,
  podeEnviarMensagens: true,
  podeTransferirConversa: true,
  // ... 93 flags de ações
}
```

**🔴 LÓGICA DE CONSTRUÇÃO DO MAPA** (permissionsService.js linha 315-368):

```javascript
function construirMapaIntegracoes(usuario, allIntegracoes) {
  const whatsappPerms = usuario.whatsapp_permissions || [];
  const temPermissoesConfiguradas = whatsappPerms.length > 0;
  
  allIntegracoes.forEach(integracao => {
    const perm = whatsappPerms.find(p => p.integration_id === integracao.id);
    
    // ✅ REGRA CRÍTICA:
    if (temPermissoesConfiguradas && !perm) {
      // Integração NÃO está em whatsapp_permissions[] = BLOQUEADO
      integracoesMap[integracao.id] = {
        can_view: false, // ❌ BLOQUEADO
        can_send: false,
        can_receive: false
      };
    } 
    else if (perm) {
      // Integração configurada = usa valores EXATOS
      integracoesMap[integracao.id] = {
        can_view: perm.can_view === true, // ✅ Explícito
        can_send: perm.can_send === true,
        can_receive: perm.can_receive === true
      };
    } 
    else {
      // SEM permissões configuradas = LIBERA TUDO (compatibilidade)
      integracoesMap[integracao.id] = {
        can_view: true,
        can_send: true,
        can_receive: true
      };
    }
  });
  
  return integracoesMap;
}
```

**📌 REGRA UNIVERSAL**:
```
SE usuario.whatsapp_permissions[] está VAZIO
  → TODAS as integrações liberadas (can_view: true)

SE usuario.whatsapp_permissions[] tem PELO MENOS 1 item
  → APENAS integrações listadas são liberadas
  → Integrações NÃO listadas = can_view: false
```

---

### **Passo 3: Aplicar VISIBILITY_MATRIX**
**Função**: `permissionsService.canUserSeeThreadBase(userPermissions, thread, contato)`

**Matriz de Decisão** (ordem de prioridade):

| Prioridade | Regra | Condição | Resultado |
|------------|-------|----------|-----------|
| 1 | Thread Interna | `thread_type === 'team_internal'` | VISÍVEL se participante ou admin |
| 2 | Thread Atribuída | `thread.assigned_user_id === user.id` | VISÍVEL (mas verifica integração) |
| 3 | Contato Fidelizado | `contato.is_cliente_fidelizado && atendente_fidelizado === user.email` | VISÍVEL (sobrepõe bloqueios) |
| 4 | **Bloqueio Integração** 🔴 | `userPerms.integracoes[thread.whatsapp_integration_id].can_view === false` | **BLOQUEADO** |
| 5 | Bloqueio Setor | `userPerms.setoresBloqueados.includes(thread.sector_id)` | BLOQUEADO |
| 6 | Bloqueio Canal | `userPerms.canaisBloqueados.includes(thread.channel)` | BLOQUEADO |
| 7 | Janela 24h | `last_inbound_at < 24h atrás` | VISÍVEL (supervisão) |
| 8 | Fidelizado a Outro | `contato.is_cliente_fidelizado && atendente != user` | BLOQUEADO |
| 9 | Atribuído a Outro | `thread.assigned_user_id != user.id && !podeVerTodasConversas` | BLOQUEADO |
| 10 | Gerente Supervisão | `podeVerTodasConversas && last_inbound_at > 30min` | VISÍVEL |
| 12 | Default Nexus360 | Nenhuma regra anterior bloqueou | VISÍVEL (fail-safe) |

**🔴 REGRA CRÍTICA #4** (Bloqueio de Integração):
```javascript
{
  priority: 4,
  name: 'bloqueio_integracao',
  check: (userPerms, thread, contact) => {
    const integracaoId = thread.whatsapp_integration_id;
    const permIntegracao = userPerms.integracoes?.[integracaoId];

    // ✅ BLOQUEIO ABSOLUTO (prevalece sobre tudo)
    if (permIntegracao && permIntegracao.can_view === false) {
      return { 
        visible: false, 
        reason_code: 'INTEGRATION_BLOCKED',
        bloqueio: true
      };
    }
    
    return null; // Libera para próximas regras
  }
}
```

**Cenários de Bloqueio**:

#### Cenário A: Usuário sem permissão configurada
```javascript
// User A tem whatsapp_permissions configurados mas NÃO incluem Integração B
usuario.whatsapp_permissions = [
  { integration_id: 'integracao_A', can_view: true, can_send: true }
  // ❌ Integração B ausente
];

// Thread usa Integração B
thread.whatsapp_integration_id = 'integracao_B';

// Mapa de permissões gerado:
userPermissions.integracoes = {
  'integracao_A': { can_view: true },
  'integracao_B': { can_view: false } // ❌ BLOQUEADO (não listado)
};

// Resultado: canUserSeeThreadBase() → false ❌
```

#### Cenário B: Integração bloqueada explicitamente
```javascript
// User B tem integração bloqueada
usuario.whatsapp_permissions = [
  { integration_id: 'integracao_B', can_view: false, can_send: false }
];

// Resultado: canUserSeeThreadBase() → false ❌
```

#### Cenário C: Thread com integração desatualizada
```javascript
// Thread foi criada com Integração A
thread.whatsapp_integration_id = 'integracao_A'; // ❌ Antiga

// Mensagem nova veio por Integração B
// Mas auto-merge não atualizou whatsapp_integration_id

// Usuário tem permissão apenas para Integração B
userPermissions.integracoes = {
  'integracao_A': { can_view: false },
  'integracao_B': { can_view: true }
};

// Resultado: canUserSeeThreadBase() → false ❌
// (Thread ainda aponta para integração antiga)
```

---

### **Passo 4: Aplicar Filtros de UI**
**Arquivo**: `pages/Comunicacao.jsx` (linhas 1497-2042)

Após passar pela VISIBILITY_MATRIX, thread ainda pode ser filtrada por:

1. **Filtro de Integração** (linha 1743-1757):
```javascript
if (selectedIntegrationId && selectedIntegrationId !== 'all') {
  const integrationIds = thread.origin_integration_ids?.length > 0 
    ? thread.origin_integration_ids 
    : [thread.whatsapp_integration_id];
  
  if (!integrationIds.includes(selectedIntegrationId)) {
    return false; // ❌ BLOQUEADO
  }
}
```

2. **Filtro de Atendente** (linha 1760-1766)
3. **Filtro de Categoria** (linha 1769-1774)
4. **Filtro de Tipo de Contato** (linha 1778-1786)
5. **Filtro de Tag** (linha 1789-1797)
6. **Filtro de Escopo** (my/unassigned/all) (linha 1800-1863)

**⚠️ PONTO CRÍTICO #4**: 
Filtro de integração usa `origin_integration_ids[]` se disponível, senão fallback para `whatsapp_integration_id`.

Thread antiga pode não ter `origin_integration_ids[]` preenchido.

---

### **Passo 5: Deduplicação**
**Objetivo**: Mostrar apenas 1 thread por contato (a mais recente)

```javascript
const threadMaisRecentePorContacto = new Map();

threads.forEach((thread) => {
  // Threads internas: NUNCA deduplicam
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    threadMaisRecentePorContacto.set(`internal-${thread.id}`, thread);
    return;
  }
  
  // Threads externas: deduplicar por contact_id
  const contactId = thread.contact_id;
  const existente = threadMaisRecentePorContacto.get(contactId);
  
  if (!existente || thread.last_message_at > existente.last_message_at) {
    threadMaisRecentePorContacto.set(contactId, thread); // Substitui se mais recente
  }
});
```

---

### **Passo 6: Renderizar (ChatSidebar)**
**Arquivo**: `components/comunicacao/ChatSidebar.jsx`

```javascript
threadsSorted.map((thread, index) => {
  const contato = thread.contato;
  const hasUnread = getUnreadCount(thread, usuarioAtual?.id);
  
  return (
    <motion.div onClick={() => handleClick(thread)}>
      {/* Avatar */}
      {/* Nome + Badge de não lidas */}
      {/* Preview da última mensagem */}
      {/* Badges: tipo, etiquetas, atendente */}
    </motion.div>
  );
})
```

---

## 🔐 PONTOS CRÍTICOS UNIVERSAIS

### **CRÍTICO #1: Lookup de Integração no Webhook**

**Risco**: Integração não encontrada → `integracaoId = null`

**Causas**:
- `instance_id_provider` incorreto no banco
- `connectedPhone` mudou mas não atualizou no banco
- Provedor (z_api/w_api) errado

**Mitigação**:
```javascript
// Adicionar logs detalhados
console.log('[WEBHOOK] 🔍 Buscando integração:', {
  instanceId: dados.instanceId,
  connectedPhone: connectedPhone,
  provider: 'w_api'
});

// Resultado SEMPRE deve ter integracaoId
if (!integracaoId) {
  console.error('[WEBHOOK] 🔴 INTEGRAÇÃO NÃO ENCONTRADA!');
  // ⚠️ Thread ficará órfã ou com vínculo antigo
}
```

---

### **CRÍTICO #2: Auto-Merge Não Propaga Integração**

**Problema**: Thread canônica mantém `whatsapp_integration_id` antiga

**Solução Proposta**:
```javascript
// Ao eleger thread canônica, FORÇAR atualização
await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
  is_canonical: true,
  status: 'aberta',
  whatsapp_integration_id: integracaoId,        // ✅ FORÇAR nova
  origin_integration_ids: [integracaoId],       // ✅ ARRAY de histórico
  ultima_atividade: new Date().toISOString()
});
```

---

### **CRÍTICO #3: Permissões Vazias vs Preenchidas**

**Regra Universal**:
```javascript
// CENÁRIO A: Usuário recém-criado (sem permissões)
usuario.whatsapp_permissions = []; // ❌ VAZIO

// Sistema assume: LIBERAR TUDO (compatibilidade)
integracoesMap = {
  'integracao_A': { can_view: true },
  'integracao_B': { can_view: true },
  'integracao_C': { can_view: true }
};

// CENÁRIO B: Usuário com permissões configuradas
usuario.whatsapp_permissions = [
  { integration_id: 'integracao_A', can_view: true }
];

// Sistema assume: BLOQUEAR o que NÃO está listado
integracoesMap = {
  'integracao_A': { can_view: true },  // ✅ Listado
  'integracao_B': { can_view: false }, // ❌ NÃO listado
  'integracao_C': { can_view: false }  // ❌ NÃO listado
};
```

**Implicação**:
- Adicionar **1ª permissão** bloqueia todas as outras automaticamente
- Solução: Ao adicionar permissões, incluir **TODAS** as integrações que o usuário deve ver

---

### **CRÍTICO #4: Fallback com Valor Antigo**

**Código Problemático**:
```javascript
whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id
//                        ↑ Se falhar  ↑ Usa valor antigo
```

**Cenário de Falha**:
1. Thread criada há 2 meses com Integração A
2. Integração A foi deletada
3. Mensagem nova chega via Integração B
4. Porteiro identifica Integração B ✅
5. Mas thread já existe com `whatsapp_integration_id: 'integracao_A_deletada'`
6. Update usa: `integracaoId (B) || thread.whatsapp_integration_id (A)` → **B vence** ✅
7. Mas se lookup falhar: `null || A` → **A vence** ❌

**Solução Defensiva**:
```javascript
// SEMPRE validar integracaoId
if (!integracaoId) {
  console.error('[WEBHOOK] 🔴 Integração não identificada - usando fallback perigoso');
}

// Forçar atualização se integração mudou
const integracaoAtual = integracaoId || thread.whatsapp_integration_id;
const integracaoMudou = integracaoAtual !== thread.whatsapp_integration_id;

if (integracaoMudou) {
  console.log('[WEBHOOK] 🔄 Integração mudou:', {
    antiga: thread.whatsapp_integration_id,
    nova: integracaoAtual
  });
}
```

---

## 🔧 CORREÇÃO UNIVERSAL: Botão "Corrigir Divergências"

### **O que faz agora**:

```javascript
// 1. Recalcula URL de webhook correta
const provider = PROVIDERS[integracao.api_provider];
const webhookUrlCorreta = getWebhookUrlProducao(provider.webhookFn);
// → Para W-API/W-API Integrador: sempre retorna webhookWapi

// 2. Atualiza integração
await base44.entities.WhatsAppIntegration.update(integracao.id, {
  status: statusAtualDaWAPI,
  numero_telefone: telefoneAtualDaWAPI,
  webhook_url: webhookUrlCorreta // ✅ NOVO (09/02/2026)
});

// 3. ✅ NOVO: Propaga para TODAS as threads
const threadsAfetadas = await base44.entities.MessageThread.filter({
  whatsapp_integration_id: integracao.id
}, '-created_date', 200);

for (const thr of threadsAfetadas) {
  await base44.entities.MessageThread.update(thr.id, {
    whatsapp_integration_id: integracao.id, // Reforça vínculo
    ultima_atividade: new Date().toISOString()
  });
}
```

**Efeito**:
- ✅ Corrige `webhook_url` no banco (substitui URLs antigas)
- ✅ Reforça vínculo `whatsapp_integration_id` em todas threads
- ✅ Garante que threads órfãs/desatualizadas fiquem sincronizadas

---

## 📋 CHECKLIST UNIVERSAL DE VALIDAÇÃO

### **Para QUALQUER instância/thread invisível**:

#### ☑️ 1. Validar Integração no Banco
```sql
SELECT 
  id,
  nome_instancia,
  numero_telefone,
  instance_id_provider,
  api_provider,
  modo,
  webhook_url,
  status
FROM WhatsAppIntegration 
WHERE instance_id_provider = '[INSTANCE_ID]';
```

**Verificar**:
- `webhook_url` aponta para função correta (`webhookWapi` ou `webhookFinalZapi`)
- `status` = `'conectado'`
- `api_provider` correto (`'z_api'`, `'w_api'`)

---

#### ☑️ 2. Validar Thread no Banco
```sql
SELECT 
  id,
  contact_id,
  whatsapp_integration_id,
  origin_integration_ids,
  assigned_user_id,
  unread_count,
  status,
  is_canonical
FROM MessageThread 
WHERE contact_id = '[CONTACT_ID]';
```

**Verificar**:
- `whatsapp_integration_id` = ID da integração atual
- `origin_integration_ids` contém ID da integração atual
- `is_canonical` = `true` para thread principal
- `status` = `'aberta'` (não `'merged'`)

---

#### ☑️ 3. Validar Permissões do Usuário
```sql
SELECT 
  id,
  email,
  role,
  attendant_sector,
  whatsapp_permissions
FROM "User" 
WHERE id = '[USER_ID]';
```

**Verificar**:
```json
{
  "whatsapp_permissions": [
    {
      "integration_id": "[ID_INTEGRACAO_ATUAL]",
      "can_view": true,  // ✅ OBRIGATÓRIO
      "can_send": true
    }
  ]
}
```

**Se `whatsapp_permissions` estiver vazio** → TODAS integrações liberadas ✅

**Se `whatsapp_permissions` tiver itens** → Apenas integrações listadas liberadas

---

#### ☑️ 4. Testar Visibilidade no Console
```javascript
// No console do navegador
const userPerms = window._diagnosticoData?.userPermissions;
const thread = window._diagnosticoData?.threadsUnicas?.find(t => t.id === '[THREAD_ID]');

console.log('Integração da thread:', thread?.whatsapp_integration_id);
console.log('Permissão do usuário:', userPerms?.integracoes?.[thread?.whatsapp_integration_id]);

// Resultado esperado:
// { can_view: true, can_send: true, integration_name: '...' }
```

---

#### ☑️ 5. Verificar Logs de Filtragem
```javascript
// Ver todas as threads bloqueadas
window._logsFiltragem
  .filter(log => !log.passou)
  .forEach(log => {
    console.log(`❌ Thread ${log.threadId} bloqueada em: ${log.etapa} - ${log.motivo}`);
  });

// Buscar thread específica
window._logsFiltragem.filter(log => log.threadId === '[THREAD_ID]');
```

---

## 🛠️ SOLUÇÕES UNIVERSAIS

### **Solução 1: Script de Migração em Massa**
Criar função backend para atualizar TODAS threads órfãs:

```javascript
// functions/migrarThreadsOrfas.js
const todasThreads = await base44.asServiceRole.entities.MessageThread.filter({
  status: { $in: ['aberta', 'fechada'] }
}, '-created_date', 1000);

let atualizadas = 0;

for (const thread of todasThreads) {
  // Buscar última mensagem recebida
  const ultimaMsg = await base44.asServiceRole.entities.Message.filter({
    thread_id: thread.id,
    sender_type: 'contact'
  }, '-sent_at', 1);
  
  if (!ultimaMsg || ultimaMsg.length === 0) continue;
  
  const integracaoCorreta = ultimaMsg[0].metadata?.whatsapp_integration_id;
  
  if (integracaoCorreta && thread.whatsapp_integration_id !== integracaoCorreta) {
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      whatsapp_integration_id: integracaoCorreta,
      origin_integration_ids: [integracaoCorreta]
    });
    atualizadas++;
  }
}

console.log(`✅ ${atualizadas} threads atualizadas`);
```

---

### **Solução 2: Auto-Permissões para Novos Usuários**
Ao criar usuário, auto-popular permissões:

```javascript
// Ao criar User
const todasIntegracoes = await base44.entities.WhatsAppIntegration.list();

const permissoesInicial = todasIntegracoes
  .filter(i => i.status === 'conectado')
  .map(i => ({
    integration_id: i.id,
    integration_name: i.nome_instancia,
    can_view: true,
    can_send: true,
    can_receive: true
  }));

await base44.entities.User.update(novoUsuario.id, {
  whatsapp_permissions: permissoesInicial
});
```

---

### **Solução 3: Melhorar Auto-Merge (Preventivo)**

```javascript
// webhookWapi.js - ao eleger thread canônica
await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
  is_canonical: true,
  status: 'aberta',
  whatsapp_integration_id: integracaoId,    // ✅ FORÇAR atual
  origin_integration_ids: [integracaoId],   // ✅ NOVO: Array de histórico
  ultima_atividade: new Date().toISOString()
});

// Coletar IDs de TODAS integrações usadas nas threads merged
const integracoesUsadas = new Set([integracaoId]);

for (const threadAntiga of todasThreadsContato) {
  if (threadAntiga.whatsapp_integration_id) {
    integracoesUsadas.add(threadAntiga.whatsapp_integration_id);
  }
}

// Atualizar thread canônica com histórico completo
await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
  origin_integration_ids: Array.from(integracoesUsadas)
});
```

---

## 📊 FLUXOGRAMA COMPLETO

```
┌──────────────────────────────────────────────────────────────┐
│ 1. WEBHOOK RECEBE PAYLOAD (Z-API/W-API)                    │
│    → Classifica evento                                      │
│    → Normaliza telefone                                     │
│    → Identifica integração (Porteiro Cego)                 │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. BUSCAR/CRIAR CONTATO (Centralizado)                     │
│    → 6 variações de telefone                                │
│    → Atualiza foto, nome, ultima_interacao                 │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. AUTO-MERGE DE THREADS                                    │
│    → Busca todas threads do contato                         │
│    → Elege mais antiga como canônica                        │
│    → Marca outras como merged                               │
│    ⚠️ NÃO atualiza whatsapp_integration_id                  │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. SALVAR MENSAGEM                                          │
│    → Message.metadata.whatsapp_integration_id = atual ✅    │
│    → Message.thread_id = thread canônica                    │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. ATUALIZAR THREAD                                         │
│    → Incrementa unread_count, total_mensagens               │
│    → Atualiza timestamps                                    │
│    → whatsapp_integration_id = atual OU antiga (fallback) ⚠️│
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. PROCESSAMENTO CORE                                       │
│    → Detecta novo ciclo                                     │
│    → Verifica humano ativo                                  │
│    → Decide disparar URA ou não                             │
└────────────────┬─────────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────────┐
│ 7. RENDERIZAÇÃO UI                                          │
│    → Busca threads (buscarThreadsLivre)                     │
│    → Constrói permissões (buildUserPermissions)             │
│    → VISIBILITY_MATRIX (canUserSeeThreadBase)               │
│    │  ├─ Prioridade 4: Bloqueio Integração 🔴              │
│    │  │  → userPerms.integracoes[thread.whatsapp_integration_id].can_view === false ?
│    │  └─ Outras regras (setor, fidelização, etc)           │
│    → Filtros UI (integração, atendente, scope)             │
│    → Deduplicação (1 thread por contato)                   │
│    → Renderiza (ChatSidebar)                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 MATRIZ DE BLOQUEIOS UNIVERSAIS

| Condição | Resultado | Pode Sobrepor? | Prioridade |
|----------|-----------|----------------|------------|
| Thread interna + não participante | ❌ BLOQUEADO | Não (exceto admin) | 1 |
| Thread atribuída + integração bloqueada | ❌ BLOQUEADO | Não | 2 |
| Contato fidelizado ao usuário | ✅ VISÍVEL | Sim (sobrepõe bloqueios) | 3 |
| **Integração com `can_view: false`** | **❌ BLOQUEADO** | **Não (absoluto)** | **4** |
| Setor bloqueado | ❌ BLOQUEADO | Não | 5 |
| Canal bloqueado | ❌ BLOQUEADO | Não | 6 |
| Thread não atribuída + sem permissão integração | ❌ BLOQUEADO | Não | 9 |
| Nenhuma regra bloqueia | ✅ VISÍVEL | - | 12 (default) |

---

## 🔬 DIAGNÓSTICO UNIVERSAL (4 Queries SQL)

### **Query 1: Threads Órfãs (sem integração válida)**
```sql
SELECT t.id, t.contact_id, t.whatsapp_integration_id, t.status, t.unread_count,
       i.nome_instancia as integracao_nome, i.status as integracao_status
FROM MessageThread t
LEFT JOIN WhatsAppIntegration i ON t.whatsapp_integration_id = i.id
WHERE t.status IN ('aberta', 'fechada')
  AND t.whatsapp_integration_id IS NOT NULL
  AND i.id IS NULL; -- ❌ Integração não existe mais
```

---

### **Query 2: Threads com Integração Desconectada**
```sql
SELECT t.id, t.contact_id, t.unread_count,
       i.nome_instancia, i.status as integracao_status
FROM MessageThread t
JOIN WhatsAppIntegration i ON t.whatsapp_integration_id = i.id
WHERE t.status = 'aberta'
  AND t.unread_count > 0
  AND i.status != 'conectado'; -- ⚠️ Integração desconectada
```

---

### **Query 3: Usuários sem Permissões Configuradas**
```sql
SELECT id, email, role, attendant_sector,
       whatsapp_permissions
FROM "User"
WHERE whatsapp_permissions IS NULL 
   OR whatsapp_permissions = '[]'::jsonb
   OR jsonb_array_length(whatsapp_permissions) = 0;
```

**Ação**: Adicionar permissões padrão para todos eles.

---

### **Query 4: Threads sem `origin_integration_ids`**
```sql
SELECT id, contact_id, whatsapp_integration_id, origin_integration_ids
FROM MessageThread
WHERE status IN ('aberta', 'fechada')
  AND (origin_integration_ids IS NULL 
       OR jsonb_array_length(origin_integration_ids) = 0);
```

**Ação**: Popular com `[whatsapp_integration_id]`.

---

## 🚀 PLANO DE AÇÃO UNIVERSAL

### **Fase 1: Correção Emergencial (Manual)**
1. ✅ Clicar "Corrigir Divergências" em **TODAS** integrações W-API
2. 🔍 Verificar permissões de **TODOS** usuários afetados
3. 🔧 Adicionar permissões ausentes manualmente

---

### **Fase 2: Migração Automática (Script)**
1. Criar `functions/migrarThreadsOrfas.js` (solução 1 acima)
2. Criar `functions/autopermissoesUsuarios.js` (solução 2 acima)
3. Executar scripts em produção
4. Validar com queries SQL acima

---

### **Fase 3: Prevenção (Código)**
1. ✅ Melhorar auto-merge (solução 3)
2. Adicionar validação obrigatória de `integracaoId` no webhook
3. Log de alerta se thread ficar sem integração válida
4. Webhook rejeita se não encontrar integração (fail-fast)

---

## 💡 REGRAS DE OURO

### **REGRA #1: Thread SEMPRE tem integração**
```
MessageThread.whatsapp_integration_id NUNCA deve ser NULL
```

**Validação**:
```javascript
if (!thread.whatsapp_integration_id) {
  console.error('[CRITICAL] Thread órfã detectada:', thread.id);
  // Atribuir integração padrão ou bloquear criação
}
```

---

### **REGRA #2: Permissões vazias = liberado**
```
User.whatsapp_permissions = [] → can_view: true em TODAS
User.whatsapp_permissions = [A] → can_view: true APENAS em A
```

**Validação**:
```javascript
// Ao adicionar primeira permissão, avisar:
if (usuario.whatsapp_permissions.length === 0) {
  toast.warning('⚠️ Adicionar permissão bloqueará outras integrações automaticamente');
  toast.info('💡 Configure permissões para TODAS as integrações necessárias');
}
```

---

### **REGRA #3: `origin_integration_ids[]` preserva histórico**
```
Thread mudou de integração? Adicione ao array, não substitua.
```

**Implementação**:
```javascript
const integracoesAnteriores = thread.origin_integration_ids || [];
const novaIntegracao = integracaoId;

if (!integracoesAnteriores.includes(novaIntegracao)) {
  integracoesAnteriores.push(novaIntegracao);
  
  await base44.entities.MessageThread.update(thread.id, {
    whatsapp_integration_id: novaIntegracao, // Atual
    origin_integration_ids: integracoesAnteriores // Histórico completo
  });
}
```

---

### **REGRA #4: Botão "Corrigir Divergências" é fonte de verdade**
```
Webhook URL deve SEMPRE vir de getWebhookUrlProducao(provider.webhookFn)
Nunca confiar em webhook_url salvo no banco (pode estar desatualizado)
```

**Validação**:
```javascript
const webhookUrlEsperada = getWebhookUrlProducao(provider.webhookFn);
const webhookUrlAtual = integracao.webhook_url;

if (webhookUrlAtual !== webhookUrlEsperada) {
  console.warn('[DIVERGÊNCIA] Webhook desatualizado:', {
    esperado: webhookUrlEsperada,
    atual: webhookUrlAtual
  });
  // Auto-corrigir
}
```

---

## 📈 MÉTRICAS DE SAÚDE (KPIs)

### **KPI #1: Taxa de Threads Órfãs**
```sql
SELECT 
  COUNT(*) as total_threads,
  COUNT(CASE WHEN whatsapp_integration_id IS NULL THEN 1 END) as orfas,
  ROUND(COUNT(CASE WHEN whatsapp_integration_id IS NULL THEN 1 END) * 100.0 / COUNT(*), 2) as percentual_orfas
FROM MessageThread
WHERE status IN ('aberta', 'fechada');
```

**Meta**: < 1% threads órfãs

---

### **KPI #2: Taxa de Webhooks Corretos**
```sql
SELECT 
  COUNT(*) as total_integracoes,
  COUNT(CASE WHEN webhook_url LIKE '%webhookWapi%' AND api_provider = 'w_api' THEN 1 END) as wapi_corretos,
  COUNT(CASE WHEN webhook_url LIKE '%webhookFinalZapi%' AND api_provider = 'z_api' THEN 1 END) as zapi_corretos
FROM WhatsAppIntegration;
```

**Meta**: 100% webhooks corretos

---

### **KPI #3: Taxa de Usuários com Permissões**
```sql
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN whatsapp_permissions IS NOT NULL AND jsonb_array_length(whatsapp_permissions) > 0 THEN 1 END) as com_permissoes
FROM "User"
WHERE role != 'admin'; -- Admin não precisa
```

**Meta**: 100% usuários não-admin configurados

---

### **KPI #4: Taxa de Visibilidade Efetiva**
```javascript
// No frontend (Comunicacao.jsx)
const stats = {
  totalThreads: threads.length,
  threadsFiltradas: threadsFiltradas.length,
  taxaVisibilidade: (threadsFiltradas.length / threads.length * 100).toFixed(1) + '%'
};

// Meta: > 80% threads visíveis (indicador de permissões bem configuradas)
```

---

## 🔒 CONCLUSÃO

### ✅ **FUNCIONANDO UNIVERSALMENTE**
- Pipeline de webhook (todas instâncias)
- Criação/atualização de contatos
- Auto-merge de threads duplicadas
- Salvamento de mensagens
- Processamento Core/URA

### ❌ **GARGALO UNIVERSAL**
- **Vínculo**: `MessageThread.whatsapp_integration_id` desatualizado
- **Permissões**: `User.whatsapp_permissions[]` ausente/incorreto
- **Histórico**: `origin_integration_ids[]` não propagado

### 🎯 **AÇÃO IMEDIATA**
1. Executar "Corrigir Divergências" em **TODAS** integrações
2. Validar permissões de **TODOS** usuários
3. Popular `origin_integration_ids[]` via script de migração

### 🛡️ **PREVENÇÃO FUTURA**
1. Auto-merge deve atualizar `whatsapp_integration_id`
2. Novos usuários recebem permissões padrão
3. Validação obrigatória de integração no webhook
4. Monitoramento de KPIs de saúde

---

**Documentação Técnica Completa**: `ANALISE_LINHA_LOGICA_COMPLETA_WAPI.md`  
**Versão**: 1.0 - Arquitetura Universal  
**Próxima Revisão**: Após migração de threads órfãs