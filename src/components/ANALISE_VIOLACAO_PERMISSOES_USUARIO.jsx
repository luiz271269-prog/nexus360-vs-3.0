# 🔴 ANÁLISE: Violação de Permissões e Instâncias de Usuário

## 1. O PROBLEMA OBSERVADO

```
Contato: Lucas Michel Cordeiro Werner
Telefone: +554830452079

Mensagem 1 (08:28):
├─ De: Cliente (Lucas)
├─ Texto: "Bom dia"
├─ Setor esperado: VENDAS (Lead identificado)
└─ Atribuição correta: Usuário de VENDAS

Mensagem 2 (09:52):
├─ De: Tifhany (financeiro)
├─ Texto: "_~ Tifhany (financeiro)_"
├─ Setor real: FINANCEIRO
└─ ❌ VIOLAÇÃO: Tifhany não deveria poder responder conversa de VENDAS
```

### O Problema:
**Por que Tifhany (financeiro) conseguiu responder uma conversa que deveria ser exclusiva do setor VENDAS?**

---

## 2. ANÁLISE ESTRUTURAL: ONDE O SISTEMA FALHA

### A. Falta de Validação na Thread
```javascript
// CURRENT (QUEBRADO):
MessageThread table:
├─ contact_id: contato_lucas
├─ assigned_user_id: "tifhany"  ← ⚠️ Nenhuma validação!
├─ sector_id: "financeiro"      ← ⚠️ Pode ser qualquer setor!
└─ thread_type: "contact_external"

// O SISTEMA NÃO VERIFICA:
✗ Se Tifhany tem permissão para este setor
✗ Se a instância pode ser acessada por Tifhany
✗ Se Tifhany está liberado para vendas
✗ Se há conflito de setor
```

### B. Ausência de Controle de Acesso (ACL)
```javascript
// NÃO EXISTE:
User_Sector_Assignment table
├─ user_id: "tifhany"
├─ setor: "financeiro"
├─ pode_acessar_outros: false/true
├─ instance_ids_liberadas: ["integ_123"]
└─ data_inicio/data_fim: permissão válida?

// RESULTADO:
Tifhany consegue acessar QUALQUER thread
Não importa setor/instância/permissão
```

### C. Webhook não Valida Atribução
```
webhookFinalZapi.ts → handleMessage():
├─ Recebe mensagem de Lucas
├─ Busca/cria contato
├─ Busca/cria thread
├─ Atribui ao atendente
│  └─ ❌ NÃO VALIDA:
│     ├─ Setor do atendente
│     ├─ Instâncias liberadas
│     ├─ Permissões ativas
│     └─ Conflitos com setor esperado
└─ Salva thread com assigned_user_id = qualquer um
```

---

## 3. FLUXO ESPERADO vs FLUXO ATUAL

### ✅ FLUXO CORRETO (o que deveria acontecer):

```
1. Lucas envia "Bom dia" (08:28)
   ├─ Webhook recebe em instância VENDAS
   ├─ Sistema detecta: Lead → setor VENDAS
   └─ Busca atendentes disponíveis:
      ├─ Filtro 1: user.attendant_sector === "vendas"
      ├─ Filtro 2: user.status === "ativo"
      ├─ Filtro 3: user.allowed_instances.includes(integ_id)
      └─ Resultado: [João, Maria, Pedro] (todas de vendas)

2. Thread criada:
   ├─ thread.assigned_user_id = "joao" (vendedor disponível)
   ├─ thread.sector_id = "vendas"
   ├─ thread.whatsapp_integration_id = integ_vendas
   └─ thread.access_control = {
      allowed_users: ["joao", "gerente_vendas"],
      allowed_sectors: ["vendas"]
   }

3. Tifhany tenta responder:
   ├─ Sistema valida: Tifhany.setor === "financeiro"
   ├─ Verifica: allowed_users.includes("tifhany") ?
   ├─ Resultado: ❌ NÃO, acesso negado!
   └─ Exibe: "Sem permissão. Conversa é do setor Vendas"
```

### ❌ FLUXO ATUAL (o que está acontecendo):

```
1. Lucas envia "Bom dia" (08:28)
   ├─ Webhook recebe
   ├─ Cria thread
   ├─ thread.assigned_user_id = ??? (algoritmo indefinido)
   └─ thread.sector_id = undefined/null

2. Tifhany acessa Dashboard
   ├─ Busca: MessageThread.filter({})
   ├─ Retorna: TODAS as threads (sem filtro de setor)
   ├─ Tifhany vê: conversa de Lucas
   ├─ Tifhany clica: "Responder"
   └─ ❌ Nenhuma validação!

3. Sistema salva resposta:
   ├─ Message.create({
   │  thread_id: thread_lucas,
   │  sender_id: "tifhany",
   │  sender_type: "user",
   │  content: "_~ Tifhany (financeiro)_"
   └─ })
   └─ ✅ Salvo (sem nenhuma verificação de permissão)

4. UI mostra:
   ├─ Conversa com 2 mensagens
   ├─ Cliente: "Bom dia" (08:28)
   ├─ Tifhany: "Bom dia" (09:52)
   └─ ⚠️ Cross-setor (violação!)
```

---

## 4. ROOT CAUSES IDENTIFICADOS

### 1️⃣ Webhook não atribui thread corretamente

**Arquivo:** `webhookFinalZapi.ts` (linhas 812-879)

```typescript
// ❌ PROBLEMA: Auto-atribuição não valida setor
let thread = await base44.asServiceRole.entities.MessageThread.create({
  contact_id: contato.id,
  whatsapp_integration_id: integracaoId,
  // ⚠️ NÃO TEM:
  // assigned_user_id: ??? (não atribui a ninguém!)
  // sector_id: ??? (não detecta setor)
  // access_control: ??? (não cria ACL)
});

// Resultado: thread criada sem atribuição
// Depois QUALQUER usuário consegue responder
```

### 2️⃣ UI não filtra threads por permissão

**Arquivo:** `components/comunicacao/ChatSidebar.tsx` (ou similar)

```typescript
// ❌ PROBLEMA: Retorna todas as threads
const threads = await MessageThread.filter({});
// Deveria ser:
const threads = await MessageThread.filter({
  $or: [
    { assigned_user_id: user.id },
    { shared_with_users: { $in: [user.id] } },
    { allowed_sectors: { $in: [user.attendant_sector] } }
  ]
});
```

### 3️⃣ Motor de decisão ignora instâncias

**Arquivo:** `functions/motorDecisaoPreAtendimento.ts` (ou roteamento)

```typescript
// ❌ PROBLEMA: Não verifica instâncias liberadas
async function atribuirAtendente(contact, sector) {
  // Busca atendentes disponíveis
  const atendentes = await User.filter({
    attendant_sector: sector,
    status: 'ativo'
  });
  // ⚠️ FALTA VALIDAR:
  // ✗ atendente.allowed_instances.includes(integration_id)
  // ✗ atendente.setor === sector
  // ✗ atendente.pode_acessar_outras_integrações
}
```

### 4️⃣ Permissões de User não estão estruturadas

**Tabela User:**
```json
{
  id: "tifhany",
  role: "user",
  attendant_sector: "financeiro",
  // ❌ FALTAM CAMPOS:
  allowed_sectors: ["financeiro"],  // Só pode acessar este setor
  allowed_instance_ids: ["integ_123"],  // Só pode usar estas instâncias
  pode_acessar_outras_integrações: false,
  data_liberacao_inicio: "2026-01-01",
  data_liberacao_fim: "2026-12-31"
}
```

---

## 5. EXPLICAÇÃO DO COMPORTAMENTO ATUAL

### Por que Tifhany conseguiu responder (BUGADO):

```
Sequência de eventos:

1. Lucas envia msg (08:28)
   └─ Webhook cria thread SEM assigned_user_id

2. Thread fica "aberta" sem atribuição
   └─ Qualquer usuário a vê no dashboard

3. Tifhany (financeiro) abre Comunicação
   └─ Vê TODAS as threads (sem filtro de setor)

4. Tifhany clica em "Responder"
   └─ Sistema NÃO valida se ela tem permissão

5. Mensagem salva na thread
   ├─ sender_id: "tifhany"
   ├─ sender_type: "user"
   └─ ❌ Sem nenhuma validação de ACL

6. UI renderiza:
   ├─ Resposta de Tifhany visível
   └─ Sem indicação de violação
```

---

## 6. SOLUÇÃO: 4 COMPONENTES A IMPLEMENTAR

### Componente 1: Estrutura de Permissões em User
```typescript
interface UserPermissions {
  allowed_sectors: string[];  // ['financeiro']
  allowed_instance_ids: string[];  // ['integ_123', 'integ_456']
  cross_sector_access: boolean;  // false = só seu setor
  cross_instance_access: boolean;  // false = só suas instâncias
  permission_level: 'viewer' | 'responder' | 'manager' | 'admin';
  validity_period: {
    start_date: ISO8601,
    end_date: ISO8601
  };
}
```

### Componente 2: ACL em MessageThread
```typescript
interface ThreadAccessControl {
  allowed_users: string[];  // ['joao', 'maria']
  allowed_sectors: string[];  // ['vendas']
  assigned_sector: string;  // 'vendas'
  assigned_instance_id: string;
  confidentiality_level: 'public' | 'internal' | 'restricted';
}
```

### Componente 3: Validação no Webhook
```typescript
// ADICIONAR em webhookFinalZapi.ts
async function validarEAtribuirThread(contato, integracaoId) {
  // 1. Detectar setor esperado (do contato/lead/origem)
  const setorEsperado = await inferirSetor(contato);
  
  // 2. Buscar atendentes elegíveis
  const atendentes = await User.filter({
    $and: [
      { attendant_sector: setorEsperado },
      { allowed_instance_ids: { $in: [integracaoId] } },
      { status: 'ativo' }
    ]
  });
  
  // 3. Eleger atendente (por carga de trabalho, etc)
  const atendente = elegerMelhorAtendente(atendentes);
  
  // 4. Criar thread COM permissões estruturadas
  const thread = await MessageThread.create({
    contact_id: contato.id,
    assigned_user_id: atendente?.id || null,
    assigned_sector: setorEsperado,
    whatsapp_integration_id: integracaoId,
    access_control: {
      allowed_users: [atendente?.id, ...gerentes_setor],
      allowed_sectors: [setorEsperado],
      assigned_instance_id: integracaoId
    }
  });
}
```

### Componente 4: Validação na UI (antes de responder)
```typescript
// ADICIONAR em ChatWindow.tsx (antes de salvar resposta)
async function validarPermissaoResponder(thread, usuarioAtual) {
  // 1. Verificar se usuário está na ACL
  if (!thread.access_control.allowed_users.includes(usuarioAtual.id)) {
    throw new Error('Sem permissão: usuário não está na ACL');
  }
  
  // 2. Verificar setor
  if (!usuarioAtual.allowed_sectors.includes(thread.assigned_sector)) {
    throw new Error(`Sem permissão: seu setor (${usuarioAtual.attendant_sector}) 
                     não pode acessar setor ${thread.assigned_sector}`);
  }
  
  // 3. Verificar instância
  if (!usuarioAtual.allowed_instance_ids.includes(thread.whatsapp_integration_id)) {
    throw new Error('Sem permissão: você não tem acesso a esta instância');
  }
  
  // 4. Verificar data de validade
  const agora = new Date();
  if (usuarioAtual.permission_validity?.end_date < agora) {
    throw new Error('Permissão expirada');
  }
  
  // Tudo OK, pode responder
  return true;
}
```

---

## 7. CHECKLIST DE CORREÇÃO

### Fase 1: Estrutura de Dados (hoje)
- [ ] Adicionar campos em User schema: `allowed_sectors`, `allowed_instance_ids`, `permission_level`
- [ ] Adicionar campo em MessageThread: `access_control` (JSON)
- [ ] Preencher dados históricos (todos users têm seu setor/instâncias padrão)

### Fase 2: Webhook (hoje)
- [ ] Implementar `inferirSetor()` para detectar setor esperado
- [ ] Implementar busca de atendentes elegíveis (com filtro de setor + instância)
- [ ] Atualizar `handleMessage()` para criar thread COM assigned_user_id e ACL

### Fase 3: UI (hoje)
- [ ] Filtrar threads por `allowed_sectors` e `allowed_instance_ids`
- [ ] Antes de salvar resposta: chamar `validarPermissaoResponder()`
- [ ] Mostrar mensagem clara se sem permissão

### Fase 4: Limpeza (amanhã)
- [ ] Auditar MessageThread histórico
- [ ] Para cada thread: se falta `assigned_sector`, inferir do contato
- [ ] Para cada thread: se falta `access_control`, gerar ACL baseado em setor

---

## 8. RESULTADO ESPERADO APÓS CORREÇÃO

```
✅ DEPOIS DA CORREÇÃO:

1. Lucas envia "Bom dia" (08:28)
   └─ Thread criada COM assigned_sector="vendas" ✅

2. Tifhany abre Dashboard
   ├─ Busca: MessageThread.filter({allowed_sectors: 'financeiro'})
   ├─ Resultado: VAZIO (thread é de vendas)
   └─ Thread NÃO aparece para Tifhany ✅

3. Se Tifhany conseguisse abrir thread de vendas:
   ├─ Clica "Responder"
   ├─ Sistema valida: Tifhany.allowed_sectors.includes('vendas')?
   ├─ Resposta: NÃO ❌
   └─ Mensagem: "Sem permissão. Esta conversa é do setor Vendas" ⛔

4. Resultado:
   ├─ Resposta de Tifhany NUNCA é salva
   ├─ Thread mantém: Lucas (cliente) → Vendedor (correto)
   └─ Cross-setor violado ✅ PREVENIDO
```

---

## 9. RESUMO

| Problema | Causa | Solução |
|---|---|---|
| Tifhany consegue responder conversa de Vendas | Thread sem assigned_sector | Adicionar assigned_sector + ACL em MessageThread |
| Tifhany vê threads de outros setores | UI sem filtro de setor | Filtrar por allowed_sectors |
| Nenhuma validação ao responder | Falta validarPermissaoResponder() | Implementar ACL check antes de salvar |
| Instâncias não são respeitadas | allowed_instance_ids não existe em User | Estruturar permissões de instância |

**Conclusão:** O sistema está funcionando em modo "aberto" (sem ACL). Precisa implementar estrutura de permissões em 4 pontos: User schema, MessageThread ACL, Webhook (criar com validação), UI (filtrar + validar).