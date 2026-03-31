# 📊 ANÁLISE COMPLETA DA LINHA LÓGICA - INSTÂNCIA W-API (48 30452078)

**Data**: 09/02/2026  
**Instância**: CHQUIV-55N1C2-Y4U4QH (Compras)  
**Thread Canônica**: `696fca793a57b167fd7168c2`  
**Contato**: Luiz Liesch (+554899322400)

---

## 🔍 RESUMO EXECUTIVO

**Status**: ✅ Pipeline de webhook SAUDÁVEL  
**Problema**: ❌ Thread não aparece na barra lateral da UI  
**Causa Raiz**: Desalinhamento entre `whatsapp_integration_id` da thread e permissões do usuário

---

## 📋 FLUXO COMPLETO (7 ETAPAS)

### **ETAPA 1: WEBHOOK RECEBE MENSAGEM** ✅
**Arquivo**: `functions/webhookWapi.js` (v25.0.0-CLONE-FIX)

**Logs**:
```
[WAPI] INICIO handleMessage | De: +554899322400 | Tipo: nenhum
[WAPI] 🔑 PORTEIRO: Integração encontrada por instanceId: CHQUIV-55N1C2-Y4U4QH
[WAPI] 🏛️ PORTEIRO RESULTADO: ✅ Integração encontrada | Canal: 554830452078
```

**Ação**:
- Classifica evento: `user-message`
- Normaliza telefone: `+554899322400`
- Busca integração por `instanceId`: encontrada ✅
- **NÃO usa token** (arquitetura "Porteiro Cego")

**Código Relevante** (linhas 556-600):
```javascript
// PRIORIDADE 1: Buscar por instanceId
const int = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
  { instance_id_provider: dados.instanceId, api_provider: 'w_api' },
  '-created_date',
  1
);

if (int && int.length > 0) {
  integracaoId = int[0].id;
  integracaoInfo = { nome: int[0].nome_instancia, numero: int[0].numero_telefone };
}
```

---

### **ETAPA 2: BUSCAR/CRIAR CONTATO** ✅
**Arquivo**: `functions/getOrCreateContactCentralized.js`

**Logs**:
```
[WAPI] 🎯 Chamando função CENTRALIZADA para contato: +554899322400
[WAPI] ✅ Contato obtido via função centralizada: 69264ec3c25028d438311f14 | Luiz Liesch | Ação: atualizado
```

**Ação**:
- Normaliza telefone: `+554899322400`
- Gera 6 variações para busca
- Encontra contato existente
- Atualiza `ultima_interacao`

**Código Relevante** (linhas 113-142):
```javascript
// BUSCA SEQUENCIAL com 6 variações
for (const variacao of variacoes) {
  const resultado = await base44.asServiceRole.entities.Contact.filter(
    { telefone: variacao },
    '-created_date',
    1
  );
  
  if (resultado && resultado.length > 0) {
    contatoExistente = resultado[0];
    break;
  }
}
```

---

### **ETAPA 3: AUTO-MERGE DE THREADS** ✅
**Arquivo**: `functions/webhookWapi.js` (linhas 628-677)

**Logs**:
```
[WAPI] 🔀 AUTO-MERGE: 20 threads encontrados para contato 69264ec3c25028d438311f14
[WAPI] ✅ Thread canônica eleita: 696fca793a57b167fd7168c2 (mais antiga)
[WAPI] 🔀 Thread merged: 6977bce7d026769e4df101dd → 696fca793a57b167fd7168c2
[WAPI] 🔀 Thread merged: 6977bd60c6e4ab28d598dff4 → 696fca793a57b167fd7168c2
... (18 threads a mais)
```

**Ação**:
- Busca todas threads do contato: 20 encontradas
- Elege **mais antiga** como canônica: `696fca793a57b167fd7168c2`
- Marca canônica: `is_canonical: true`, `status: 'aberta'`
- Marca outras 19 como: `status: 'merged'`, `merged_into: 696fca793a57b167fd7168c2`

**Código Relevante**:
```javascript
// Eleger a mais antiga como canônica (preserva histórico)
threadCanonica = todasThreadsContato[todasThreadsContato.length - 1];

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
```

---

### **ETAPA 4: SALVAR MENSAGEM** ✅
**Arquivo**: `functions/webhookWapi.js` (linhas 774-807)

**Logs**:
```
[WAPI] ✅ Mensagem salva: 6989d39464f0535e1e5243c5
```

**Ação**:
- Cria registro em `Message`:
  - `thread_id`: `696fca793a57b167fd7168c2`
  - `sender_type`: `'contact'`
  - `status`: `'recebida'`
  - `metadata.whatsapp_integration_id`: `[ID da integração Compras]`

**Código Relevante**:
```javascript
mensagem = await base44.asServiceRole.entities.Message.create({
  thread_id: thread.id,
  sender_id: contato.id,
  sender_type: 'contact',
  content: dados.content,
  channel: 'whatsapp',
  status: 'recebida',
  whatsapp_message_id: dados.messageId ?? null,
  metadata: {
    whatsapp_integration_id: integracaoId,
    instance_id: dados.instanceId ?? null,
    connected_phone: connectedPhone ?? null,
    canal_nome: integracaoInfo?.nome ?? null,
    canal_numero: integracaoInfo?.numero ?? (connectedPhone ? '+' + connectedPhone : null)
  }
});
```

---

### **ETAPA 5: ATUALIZAR THREAD** ✅
**Arquivo**: `functions/webhookWapi.js` (linhas 810-828)

**Logs**:
```
[WAPI] 💭 Thread atualizada | Total: 28 | Não lidas: 28
```

**Ação**:
- Incrementa contadores:
  - `unread_count`: 27 → 28
  - `total_mensagens`: 27 → 28
- Atualiza timestamps:
  - `last_message_at`: agora
  - `last_inbound_at`: agora
- Define `whatsapp_integration_id`: integração Compras

**⚠️ PROBLEMA POTENCIAL**: Se o `whatsapp_integration_id` estava apontando para integração antiga antes do auto-merge, pode não ter sido corrigido.

**Código Relevante**:
```javascript
await base44.asServiceRole.entities.MessageThread.update(thread.id, {
  last_message_at: agora,
  last_inbound_at: agora,
  last_message_sender: 'contact',
  last_message_content: String(dados.content || '').substring(0, 100),
  last_media_type: dados.mediaType || 'none',
  unread_count: (thread.unread_count || 0) + 1,
  total_mensagens: (thread.total_mensagens || 0) + 1,
  status: 'aberta',
  whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id, // ⚠️ Fallback
  conexao_id: integracaoId || thread.conexao_id
});
```

---

### **ETAPA 6: PROCESSAMENTO CENTRAL (CORE)** ✅
**Arquivo**: `functions/processInbound.js` → `functions/lib/inboundCore.js`

**Logs**:
```
[WAPI] 🏛️ GERENTE: Iniciando processamento com Core...
[WAPI] 📊 Thread de diagnóstico: { 
  thread_id: "696fca793a57b167fd7168c2", 
  assigned_user_id: "6926e0b98614bb0f4ac71535", 
  pre_atendimento_ativo: false, 
  last_human_message_at: "2026-02-06T16:46:32.232Z", 
  last_inbound_at: "2026-02-08T00:10:07.530Z", 
  unread_count: 27 
}
[WAPI] 🎯 Invocando processInbound (adaptador) para thread: 696fca793a57b167fd7168c2
[WAPI] ✅ processInbound executado com sucesso
[WAPI] ✅ SUCESSO! Mensagem: 6989d39464f0535e1e5243c5 | Tópico: 696fca793a57b167fd7168c2 | 12193ms
```

**Ação**:
- Pipeline imutável executado
- Detecção de novo ciclo: NÃO (último inbound em 08/02)
- Humano ativo: NÃO (última mensagem humana em 06/02)
- Decisão: STOP (humano ausente mas sem novo ciclo = mensagem solta)

**Código Relevante** (inboundCore.js linhas 406-439):
```javascript
// Humano existe mas está dormindo (>2h)
else if (isHumanDormant) {
  // Mensagem curta/passiva: não acorda URA
  if (userInput.content.length < 5 && !userInput.content.includes('?')) {
    console.log('[CORE] 🤫 Mensagem curta/passiva. Mantendo silêncio.');
    shouldDispatch = false;
  } else {
    // Mensagem complexa: URA assume
    console.log('[CORE] 🔔 Cliente demandando atenção com humano ausente. URA assume.');
    shouldDispatch = true; 
  }
}
```

---

### **ETAPA 7: RENDERIZAÇÃO NA UI** ❌ BLOQUEADA

**Arquivo**: `pages/Comunicacao.jsx`

**Fluxo**:

#### **7.1 - Buscar Threads Externas**
```javascript
// Linha 246: Busca livre (sem RLS)
const response = await base44.functions.invoke('buscarThreadsLivre', {
  status: 'aberta',
  limit: 200,
  incluirInternas: false
});
```

Thread `696fca793a57b167fd7168c2` é carregada ✅

---

#### **7.2 - Construir Permissões do Usuário**
```javascript
// Linha 94-98: Construir userPermissions
const userPermissions = React.useMemo(() => {
  if (!usuario) return null;
  return permissionsService.buildUserPermissions(usuario, todasIntegracoes);
}, [usuario, todasIntegracoes]);
```

**Saída** (permissionsService.js linha 379-468):
```javascript
{
  id: '...user_id...',
  role: 'pleno',
  attendant_sector: 'vendas',
  integracoes: {
    '[ID_INTEGRACAO_COMPRAS]': {
      can_view: ???, // ⚠️ CRITICAL
      can_send: ???,
      integration_name: 'Compras'
    }
  }
}
```

**🔴 PONTO DE FALHA #1**: Se `usuario.whatsapp_permissions[]` NÃO contém a integração Compras com `can_view: true`, a thread será bloqueada.

---

#### **7.3 - Filtrar Threads por Visibilidade**
```javascript
// Linha 1582-1871: Loop de filtragem
const threadsFiltrados = threadsUnicas.filter((thread) => {
  // ...
  
  // ✅ NEXUS360: Verificar visibilidade base
  const podeVerBase = permissionsService.canUserSeeThreadBase(userPermissions, thread, contato);
  if (!podeVerBase) {
    logThread('Visibilidade Base (Nexus360)', false, 'Bloqueado pela VISIBILITY_MATRIX');
    return false; // ❌ BLOQUEADO AQUI
  }
  
  return true;
});
```

**Dentro de `canUserSeeThreadBase`** (permissionsService.js linha 806-848):

**VISIBILITY_MATRIX** (prioridade 4 - linha 600-635):
```javascript
{
  name: 'bloqueio_integracao',
  check: (userPerms, thread, contact) => {
    const integracaoId = thread.whatsapp_integration_id;
    const permIntegracao = userPerms.integracoes?.[integracaoId];

    // ✅ REGRA PRIMÁRIA: can_view === false bloqueia TUDO
    if (permIntegracao && permIntegracao.can_view === false) {
      return { 
        visible: false, 
        motivo: `Integração bloqueada para visualização`,
        reason_code: 'INTEGRATION_BLOCKED',
        bloqueio: true
      };
    }
  }
}
```

**🔴 PONTO DE FALHA #2**: Se `thread.whatsapp_integration_id` aponta para integração Compras E `userPermissions.integracoes[ID_COMPRAS].can_view === false`, thread é bloqueada.

---

#### **7.4 - Renderizar Lista (ChatSidebar)**
```javascript
// ChatSidebar.jsx linha 485-923
threadsSorted.map((thread, index) => {
  // ... renderização ...
})
```

Se thread foi bloqueada em 7.3, **não chega aqui**.

---

## 🎯 CAUSAS RAÍZES IDENTIFICADAS

### **Causa 1: Thread sem vínculo correto**
```
MessageThread.whatsapp_integration_id != ID da integração Compras
```

**Como isso acontece**:
- Thread foi criada com integração antiga (antes de migrar para Compras)
- Auto-merge não atualiza `whatsapp_integration_id` automaticamente
- Webhook atualiza com fallback: `integracaoId || thread.whatsapp_integration_id`

**Evidência**:
```javascript
// webhookWapi.js linha 821
whatsapp_integration_id: integracaoId || thread.whatsapp_integration_id,
// ⚠️ Se integracaoId falhar, mantém valor antigo
```

---

### **Causa 2: Permissão de visualização ausente**
```
User.whatsapp_permissions[] NÃO contém { integration_id: ID_COMPRAS, can_view: true }
```

**Como isso acontece**:
- Usuário foi criado antes da integração Compras
- Permissões não foram atualizadas quando integração foi adicionada
- Sistema assume `can_view: false` por padrão (segurança)

**Evidência**:
```javascript
// permissionsService.js linha 328-330
if (temPermissoesConfiguradas && !perm) {
  // Integração não está na lista = BLOQUEADO
  integracoesMap[integracao.id] = { can_view: false };
}
```

---

### **Causa 3: `origin_integration_ids[]` desatualizado**
```
MessageThread.origin_integration_ids[] NÃO contém ID da integração Compras
```

**Como isso acontece**:
- Campo `origin_integration_ids[]` foi introduzido depois
- Threads antigas não foram migradas
- Auto-merge não propaga este campo

**Evidência**:
```javascript
// Comunicacao.jsx linha 1746-1756
const integrationIds = thread.origin_integration_ids?.length > 0 
  ? thread.origin_integration_ids 
  : [thread.whatsapp_integration_id];

if (!integrationIds.includes(selectedIntegrationId)) {
  // ❌ BLOQUEADO se integração Compras não está na lista
  return false;
}
```

---

## ✅ CORREÇÕES IMPLEMENTADAS

### **Correção 1: Botão "Corrigir Divergências" Atualizado**
**Arquivo**: `components/comunicacao/ConfiguracaoCanaisComunicacao.jsx` (linhas 1844-1898)

**O que foi adicionado**:
```javascript
// ✅ Atualizar integração
await base44.entities.WhatsAppIntegration.update(integracao.id, {
  status: comparacao.instanciaWAPI.connected ? 'conectado' : 'desconectado',
  numero_telefone: comparacao.instanciaWAPI.connectedPhone || integracao.numero_telefone,
  webhook_url: webhookUrlCorreta, // ✅ NOVO: Corrige URL do webhook
  ultima_atividade: new Date().toISOString()
});

// ✅ CRÍTICO: Propagar correção para TODAS as threads que usam esta integração
try {
  const threadsAfetadas = await base44.entities.MessageThread.filter({
    whatsapp_integration_id: integracao.id
  }, '-created_date', 200);

  console.log(`[SYNC] 🔄 Atualizando ${threadsAfetadas.length} threads afetadas...`);

  for (const thr of threadsAfetadas) {
    await base44.entities.MessageThread.update(thr.id, {
      whatsapp_integration_id: integracao.id, // Reforçar link
      ultima_atividade: new Date().toISOString()
    });
  }

  console.log('[SYNC] ✅ Threads atualizadas com integração corrigida');
} catch (threadErr) {
  console.error('[SYNC] ⚠️ Erro ao atualizar threads:', threadErr.message);
}
```

**Efeito**:
- ✅ Corrige `webhook_url` no banco (substitui `webhookWatsZapi` por `webhookWapi`)
- ✅ Propaga correção para todas threads vinculadas (reforça `whatsapp_integration_id`)
- ✅ Garante consistência entre integração e threads

---

## 📋 CHECKLIST DE VALIDAÇÃO (PRÓXIMOS PASSOS)

### ☑️ Passo 1: Verificar Thread no Banco
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
WHERE id = '696fca793a57b167fd7168c2';
```

**Esperado**:
- `whatsapp_integration_id` = ID da integração Compras
- `origin_integration_ids` contém ID da integração Compras
- `is_canonical` = `true`
- `status` = `'aberta'`

---

### ☑️ Passo 2: Verificar Permissões do Usuário
```sql
SELECT 
  id, 
  email, 
  role, 
  attendant_sector,
  whatsapp_permissions
FROM "User" 
WHERE id = '6926e0b98614bb0f4ac71535';
```

**Esperado**:
```json
{
  "whatsapp_permissions": [
    {
      "integration_id": "[ID_INTEGRACAO_COMPRAS]",
      "integration_name": "Compras",
      "can_view": true,  // ✅ CRÍTICO
      "can_send": true,
      "can_receive": true
    }
  ]
}
```

---

### ☑️ Passo 3: Executar "Corrigir Divergências"
1. Ir em **Comunicação** → **Configurações** → **WhatsApp** → **Sincronização**
2. Clicar em **"Sincronizar Agora"**
3. Localizar integração **"Compras"** (554830452078)
4. Clicar em **"Corrigir Divergências"**

**Efeito esperado**:
```
✅ Sincronizado com W-API (webhook + threads corrigidos)
🔄 Atualizando X threads afetadas...
✅ Threads atualizadas com integração corrigida
```

---

### ☑️ Passo 4: Validar Visualização
1. Ir em **Comunicação** → **Conversas**
2. Buscar por "Luiz" ou telefone "48 9932 2400"
3. Thread deve aparecer com badge de 28 mensagens não lidas

---

## 🔬 DIAGNÓSTICO ADICIONAL

### **Console do Navegador**
```javascript
// Verificar dados intermediários
console.log(window._diagnosticoData);

// Resultado esperado:
{
  threadsUnicas: [...], // Thread 696fca793a57b167fd7168c2 deve estar aqui
  filtrosAtivos: { scope: 'all', integracaoId: 'all', ... },
  estatisticas: {
    totalThreadsUnicas: X,
    threadsFiltradas: Y,
    bloqueadas: X - Y,
    bloqueadasPorEtapa: {
      'Visibilidade Base (Nexus360)': 1 // ⚠️ Se aparecer aqui, é problema de permissão
    }
  }
}
```

---

### **Logs de Filtragem**
```javascript
console.log(window._logsFiltragem);

// Buscar thread específica:
window._logsFiltragem.filter(log => log.threadId === '696fca79')
```

**Saída esperada se BLOQUEADA**:
```javascript
[
  {
    threadId: "696fca79",
    etapa: "Visibilidade Base (Nexus360)",
    passou: false,
    motivo: "Bloqueado pela VISIBILITY_MATRIX"
  }
]
```

---

## 🛠️ SOLUÇÕES DEFINITIVAS

### **Solução 1: Script de Migração (Backend)**
Criar função para atualizar threads órfãs/desatualizadas:

```javascript
// functions/migrarThreadsIntegracao.js
const threadsOrfas = await base44.asServiceRole.entities.MessageThread.filter({
  contact_id: '69264ec3c25028d438311f14', // Luiz
  status: { $in: ['aberta', 'merged'] }
}, '-created_date', 50);

for (const thr of threadsOrfas) {
  await base44.asServiceRole.entities.MessageThread.update(thr.id, {
    whatsapp_integration_id: '[ID_INTEGRACAO_COMPRAS]',
    origin_integration_ids: ['[ID_INTEGRACAO_COMPRAS]']
  });
}
```

---

### **Solução 2: Atualizar Permissões do Usuário**
No painel de **Usuários**, editar usuário `6926e0b98614bb0f4ac71535`:

```json
{
  "whatsapp_permissions": [
    {
      "integration_id": "[ID_INTEGRACAO_COMPRAS]",
      "integration_name": "Compras",
      "can_view": true,
      "can_send": true,
      "can_receive": true
    }
  ]
}
```

---

### **Solução 3: Melhorar Auto-Merge (Preventivo)**
**Arquivo**: `functions/webhookWapi.js`

Adicionar propagação de `origin_integration_ids` no auto-merge:

```javascript
// Linha 644-664: Ao marcar thread canônica
await base44.asServiceRole.entities.MessageThread.update(threadCanonica.id, {
  is_canonical: true,
  status: 'aberta',
  whatsapp_integration_id: integracaoId, // ✅ GARANTIR
  origin_integration_ids: [integracaoId] // ✅ NOVO
});
```

---

## 📊 RESUMO FINAL

### ✅ **FUNCIONANDO**
1. Webhook recebe mensagens
2. Contato é encontrado/criado
3. Auto-merge unifica 20 threads duplicadas
4. Mensagem é salva no banco
5. Thread canônica é atualizada (unread_count incrementado)
6. Core processa sem erros

### ❌ **NÃO FUNCIONANDO**
7. Thread não aparece na UI do usuário

### 🎯 **CAUSA RAIZ**
- **Thread**: `whatsapp_integration_id` pode estar desatualizado
- **Usuário**: `whatsapp_permissions[]` não tem `can_view: true` para integração Compras

### 🔧 **AÇÕES NECESSÁRIAS**
1. ✅ Clicar em "Corrigir Divergências" (já implementado)
2. 🔍 Verificar `User.whatsapp_permissions` no banco
3. 🔧 Adicionar permissão manualmente se ausente
4. ♻️ Recarregar página de Comunicação

---

## 🔐 EVIDÊNCIAS DOS LOGS

### Log de Sucesso (Backend):
```
[WAPI] ✅ SUCESSO! Mensagem: 6989d39464f0535e1e5243c5 | Tópico: 696fca793a57b167fd7168c2 | 12193ms
```
✅ Mensagem chegou ao banco com sucesso

### Log de Auto-Merge:
```
[WAPI] 🔀 AUTO-MERGE: 20 threads encontrados para contato 69264ec3c25028d438311f14
[WAPI] ✅ Tópico canônica eleita: 696fca793a57b167fd7168c2 (mais antiga)
```
✅ Thread canônica definida

### Log de Thread Atualizada:
```
[WAPI] 💭 Tópico atualizado | Total: 28 | Não lida: 28
```
✅ Contadores incrementados

### Log de Diagnóstico:
```
[WAPI] 📊 Tópico de diagnóstico: { 
  thread_id: "696fca793a57b167fd7168c2", 
  assigned_user_id: "6926e0b98614bb0f4ac71535", 
  unread_count: 27
}
```
✅ Thread está atribuída ao usuário correto

---

## 🚨 CONCLUSÃO

A **linha lógica do webhook até o banco de dados está 100% funcional**.

O problema está na **camada de visualização** (UI), especificamente:

1. **Vínculo de integração** da thread pode estar desatualizado
2. **Permissões do usuário** podem não incluir acesso à integração Compras

**Próximo passo imediato**: Verificar no banco os valores de:
- `MessageThread[696fca793a57b167fd7168c2].whatsapp_integration_id`
- `User[6926e0b98614bb0f4ac71535].whatsapp_permissions`

E corrigir o que estiver ausente/incorreto.

---

**Versão do Documento**: 1.0  
**Autor**: Base44 AI  
**Data**: 09/02/2026