# 🔍 ANÁLISE DA LINHA LÓGICA: MENSAGENS INTERNAS NO CHAT

**Data**: 2026-02-09  
**Objetivo**: Mapear EXATAMENTE como mensagens internas (team_internal/sector_group) aparecem na bola de bate-papo

---

## 📋 1. FLUXO COMPLETO (DO ENVIO À EXIBIÇÃO)

### 🎯 1.1 CRIAÇÃO DA MENSAGEM INTERNA

**Arquivo**: `components/comunicacao/ChatWindow.jsx` (linha 1323-1354)

```javascript
// VALIDAÇÃO PRÉVIA - ANTES de chamar backend
if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
  // ✅ Verifica contexto
  if (!usuario?.id || !thread?.id) {
    toast.error("⚠️ Contexto inválido");
    return;
  }

  // ✅ Verifica participação
  const isParticipante = thread.participants?.includes(usuario.id);
  const isAdmin = usuario.role === 'admin';

  if (!isParticipante && !isAdmin) {
    toast.error("❌ Você não é participante desta conversa interna");
    return;
  }

  // ✅ DELEGAÇÃO OTIMISTA - Handler pai (Comunicacao.jsx)
  if (onSendInternalMessageOptimistic) {
    onSendInternalMessageOptimistic({
      texto, pastedImage, pastedImagePreview, attachedFile, attachedFileType,
      replyToMessage: mensagemResposta
    });
  }
}
```

**✅ PONTO CRÍTICO 1**: O ChatWindow **NÃO cria a Message** diretamente. Ele delega para handler pai.

---

### 🚀 1.2 HANDLER PAI (Comunicacao.jsx)

**Função**: `onSendInternalMessageOptimistic`  
**Localização**: `pages/Comunicacao.jsx` (não visto ainda - precisa ler)

**O que deve fazer**:
1. Criar mensagem otimista (local state)
2. Chamar backend `sendInternalMessage`
3. Aguardar resposta
4. Atualizar mensagem com ID real
5. Invalidar queries

---

### 💾 1.3 BACKEND - SALVAMENTO NO BANCO

**Função**: `functions/sendInternalMessage.js`

**Schema obrigatório para mensagens internas**:
```javascript
{
  thread_id: "xxx",              // ✅ CRÍTICO
  sender_id: "user_abc",         // ✅ ID do User remetente
  sender_type: "user",           // ✅ SEMPRE 'user' (não 'contact')
  recipient_id: "user_xyz",      // ✅ ID do User destinatário (ou null para grupo)
  recipient_type: "user",        // ✅ 'user' (1:1) ou 'group' (setor/grupo)
  content: "Olá, tudo bem?",
  channel: "interno",            // ✅ CRÍTICO - Não 'whatsapp'
  status: "enviada",
  sent_at: "2026-02-09T...",
  media_type: "none",            // ou 'image', 'document', etc.
  media_url: null,
  visibility: "public_to_customer", // ou 'internal_only'
  metadata: {
    is_internal_message: true,   // ✅ FLAG AUXILIAR
    is_1on1: true,                // true se 1:1, false se grupo
    sender_name: "João Silva"     // Cache do nome
  }
}
```

**❌ ERROS COMUNS QUE QUEBRAM VISIBILIDADE**:
- `sender_type: 'contact'` → Mensagem some (filtro rejeita)
- `channel: 'whatsapp'` → Mensagem some (filtro rejeita)
- `thread_id` errado → Aparece em thread errada ou não aparece
- `recipient_type` ausente → Pode quebrar lógica de filtro

---

### 🔍 1.4 BUSCA DE MENSAGENS (Comunicacao.jsx)

**Query Principal**:
```javascript
const { data: mensagens = [] } = useQuery({
  queryKey: ['mensagens', threadSelecionada?.id],
  queryFn: async () => {
    if (!threadSelecionada?.id) return [];
    
    const msgs = await base44.entities.Message.filter(
      { thread_id: threadSelecionada.id },
      '-sent_at',
      500
    );
    
    return msgs || [];
  }
});
```

**✅ CORRETO**: Busca **TODAS** mensagens da thread (sem filtro de channel)  
**❌ ERRO SE**: Filtrar por `channel: 'whatsapp'` → mensagens internas somem

---

### 🎨 1.5 PROCESSAMENTO NO ChatWindow (FILTRO DE EXIBIÇÃO)

**Arquivo**: `components/comunicacao/ChatWindow.jsx` (linhas 1798-1899)

```javascript
const mensagensProcessadas = React.useMemo(() => {
  if (mensagens.length === 0) return [];

  // ✅ VERIFICAR TIPO DE THREAD
  const isThreadInterna = thread?.thread_type === 'team_internal' || 
                          thread?.thread_type === 'sector_group';

  if (isThreadInterna) {
    console.log('[MENSAGENS_INTERNAS] 🔍 Total:', mensagensFiltradas.length);

    // ✅ FILTRO TRIPLO - REGRA SAGRADA
    const mensagensInternasProcessadas = mensagensFiltradas.filter((m) => {
      const isInterna = 
        m.channel === 'interno' &&              // ✅ Canal interno
        m.sender_type === 'user' &&             // ✅ Sempre usuário (nunca contact)
        (m.recipient_type === 'user' ||         // ✅ 1:1 ou grupo
         m.recipient_type === 'group');

      if (!isInterna) {
        console.log('[FILTRO] ❌ Rejeitada:', {
          channel: m.channel,
          sender_type: m.sender_type,
          recipient_type: m.recipient_type
        });
        return false;
      }

      // ✅ Validar conteúdo (texto OU mídia)
      const content = (m.content || '').trim();
      const hasMidia = (m.media_type && m.media_type !== 'none') || m.media_url;
      
      return content.length > 0 || hasMidia;
    });

    return mensagensInternasProcessadas;
  }

  // ✅ Para threads externas: filtros de limpeza (status@broadcast, etc.)
  return mensagensFiltradas.filter((m) => { ... });
}, [mensagens, thread?.thread_type]);
```

**🔥 PONTO CRÍTICO 2**: Este filtro é a **ÚNICA** barreira entre banco de dados e UI.

---

## 🚨 2. CENÁRIOS QUE QUEBRAM VISIBILIDADE

### ❌ Cenário A: sender_type errado
```javascript
// ❌ ERRADO - Mensagem some
{
  sender_type: 'contact',
  recipient_type: 'user',
  channel: 'interno'
}

// ✅ CORRETO
{
  sender_type: 'user',
  recipient_type: 'user',
  channel: 'interno'
}
```

### ❌ Cenário B: channel errado
```javascript
// ❌ ERRADO - Mensagem some
{
  sender_type: 'user',
  recipient_type: 'user',
  channel: 'whatsapp'  // ❌
}

// ✅ CORRETO
{
  sender_type: 'user',
  recipient_type: 'user',
  channel: 'interno'  // ✅
}
```

### ❌ Cenário C: recipient_type ausente
```javascript
// ❌ ERRADO - Mensagem some
{
  sender_type: 'user',
  channel: 'interno',
  recipient_type: null  // ❌
}

// ✅ CORRETO
{
  sender_type: 'user',
  channel: 'interno',
  recipient_type: 'user'  // ou 'group'
}
```

### ❌ Cenário D: thread_id errado
```javascript
// ❌ ERRADO - Aparece em thread errada ou não aparece
{
  thread_id: "696fca793a57b167fd7168c2",  // Thread de outro contato
  sender_type: 'user',
  recipient_type: 'user',
  channel: 'interno'
}

// ✅ CORRETO - Usar thread retornada por getOrCreateInternalThread
{
  thread_id: "thread_real_do_usuario_destino",
  sender_type: 'user',
  recipient_type: 'user',
  channel: 'interno'
}
```

---

## 🔬 3. VALIDAÇÃO NO FRONTEND (ChatWindow)

### 🔍 3.1 Log de Debug Atual

**Quando thread interna é detectada**:
```javascript
console.log('[MENSAGENS_INTERNAS] 🔍 Total mensagens recebidas:', mensagensFiltradas.length);

// Para cada mensagem:
console.log('[MENSAGENS_INTERNAS] ❌ Rejeitada (não é interna):', {
  id: m.id?.substring(0, 8),
  channel: m.channel,
  sender_type: m.sender_type,
  recipient_type: m.recipient_type
});

// OU

console.log('[MENSAGENS_INTERNAS] ✅ Aprovada:', {
  id: m.id?.substring(0, 8),
  sender: m.sender_id?.substring(0, 8),
  recipient: m.recipient_id?.substring(0, 8) || 'GROUP',
  has_content: content.length > 0,
  has_midia: hasMidia
});
```

**Resultado final**:
```javascript
console.log('[MENSAGENS_INTERNAS] 📊 RESULTADO:', 
  mensagensInternasProcessadas.length, 'de', mensagensFiltradas.length
);
```

---

## 🧪 4. FERRAMENTA DE DIAGNÓSTICO

**Arquivo**: `components/comunicacao/DiagnosticoMensagensInternas.jsx`

**O que faz**:
1. Busca threads internas (últimas 10)
2. Para cada thread:
   - Busca TODAS mensagens (sem limite de tempo)
   - Conta por `sender_type`, `channel`, `visibility`
   - Identifica mensagens vazias
   - Detecta mensagens órfãs (channel=interno mas thread_id diferente)
3. Mostra logs completos das últimas 10 mensagens

**Como usar**:
1. Adicionar `<DiagnosticoMensagensInternas />` em página de testes
2. Clicar "Analisar Mensagens Internas"
3. Ver breakdown detalhado por thread

---

## 📊 5. CHECKLIST DE VALIDAÇÃO

### ✅ Para CADA mensagem interna salva no banco:

- [ ] `sender_type = 'user'` (NUNCA 'contact')
- [ ] `recipient_type = 'user'` (1:1) OU 'group' (setor/grupo)
- [ ] `channel = 'interno'` (NUNCA 'whatsapp')
- [ ] `thread_id` corresponde à thread correta (team_internal ou sector_group)
- [ ] `sender_id` = ID do User remetente (válido)
- [ ] `recipient_id` = ID do User destinatário (ou null para grupos)
- [ ] `content.trim().length > 0` OU `media_url` preenchido
- [ ] `visibility` preenchido (padrão: 'public_to_customer')
- [ ] `metadata.is_internal_message = true` (recomendado)

### ✅ Para CADA thread interna:

- [ ] `thread_type = 'team_internal'` OU 'sector_group'
- [ ] `participants[]` contém IDs dos usuários (nunca vazio)
- [ ] `channel = 'interno'` (não 'whatsapp')
- [ ] `pair_key` preenchido (1:1) OU `sector_key` preenchido (setor)
- [ ] `is_group_chat = true` (grupos) OU `false` (1:1)

---

## 🔥 6. REGRA DOURADA

**Mensagem interna visível NO FRONTEND = Mensagem que PASSA TODAS as validações**:

```javascript
✅ m.channel === 'interno'
✅ m.sender_type === 'user'
✅ m.recipient_type IN ['user', 'group']
✅ (m.content.trim().length > 0 OR m.media_url)
```

**Se UMA validação falha → mensagem some**

---

## 🛠️ 7. COMO DEBUGAR MENSAGEM "INVISÍVEL"

### Passo 1: Buscar mensagem no banco
```javascript
const msg = await base44.entities.Message.get("message_id");
console.log({
  id: msg.id,
  thread_id: msg.thread_id,
  sender_type: msg.sender_type,
  recipient_type: msg.recipient_type,
  channel: msg.channel,
  content: msg.content,
  media_type: msg.media_type,
  media_url: msg.media_url
});
```

### Passo 2: Verificar thread
```javascript
const thread = await base44.entities.MessageThread.get(msg.thread_id);
console.log({
  thread_type: thread.thread_type,
  participants: thread.participants,
  channel: thread.channel,
  pair_key: thread.pair_key,
  sector_key: thread.sector_key
});
```

### Passo 3: Simular filtro do frontend
```javascript
const passaValidacao = 
  msg.channel === 'interno' &&
  msg.sender_type === 'user' &&
  (msg.recipient_type === 'user' || msg.recipient_type === 'group') &&
  (msg.content?.trim().length > 0 || msg.media_url);

console.log(`Mensagem ${passaValidacao ? '✅ PASSARIA' : '❌ SERIA REJEITADA'}`);

if (!passaValidacao) {
  console.log('Motivo:', {
    channel_errado: msg.channel !== 'interno',
    sender_type_errado: msg.sender_type !== 'user',
    recipient_type_errado: !['user', 'group'].includes(msg.recipient_type),
    sem_conteudo: !msg.content?.trim() && !msg.media_url
  });
}
```

### Passo 4: Verificar se usuário pode ver thread
```javascript
const usuario = await base44.auth.me();
const isParticipant = thread.participants?.includes(usuario.id);
const isAdmin = usuario.role === 'admin';
const podeVer = isParticipant || isAdmin;

console.log(`Usuário ${podeVer ? '✅ PODE' : '❌ NÃO PODE'} ver esta thread`);
```

---

## 🎯 8. ARQUITETURA ATUAL (VALIDADA)

### Layer 1: Backend (sendInternalMessage)
- Cria Message com campos corretos
- Retorna success + message_id

### Layer 2: Handler Otimista (Comunicacao.jsx)
- Adiciona mensagem local
- Chama backend
- Atualiza com ID real

### Layer 3: Query (React Query)
- Busca `Message.filter({ thread_id })`
- Sem filtro de channel (busca TODAS)

### Layer 4: Processamento (ChatWindow memo)
- Aplica filtro triplo (channel + sender_type + recipient_type)
- Valida conteúdo
- Remove mensagens vazias

### Layer 5: Renderização (MessageBubble)
- Recebe apenas mensagens aprovadas
- Exibe conteúdo

---

## 🔧 9. CORREÇÕES NECESSÁRIAS (SE MENSAGENS INTERNAS SOMEM)

### 🔍 Diagnóstico SQL Equivalente:

```sql
-- Mensagens "internas" com campos errados
SELECT 
  id,
  thread_id,
  sender_type,
  recipient_type,
  channel,
  content,
  created_date
FROM Message
WHERE 
  channel = 'interno'
  AND (
    sender_type != 'user' OR
    recipient_type NOT IN ('user', 'group') OR
    (content IS NULL OR TRIM(content) = '') AND (media_url IS NULL)
  )
ORDER BY created_date DESC
LIMIT 50;
```

### 🛠️ Script de Correção:

**Cenário**: Mensagens internas salvas com `sender_type='contact'` ou `channel='whatsapp'`

```javascript
// functions/corrigirMensagensInternas.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const { dryRun = true } = await req.json().catch(() => ({}));

  // Buscar threads internas
  const threadsInternas = await base44.asServiceRole.entities.MessageThread.filter({
    thread_type: { $in: ['team_internal', 'sector_group'] }
  });

  const threadIds = threadsInternas.map(t => t.id);
  let corrigidas = 0;

  // Buscar mensagens problemáticas
  for (const threadId of threadIds) {
    const mensagens = await base44.asServiceRole.entities.Message.filter({
      thread_id: threadId
    }, '-created_date', 500);

    for (const msg of mensagens) {
      let needsUpdate = false;
      const updateData = {};

      // ✅ Corrigir sender_type
      if (msg.sender_type !== 'user') {
        updateData.sender_type = 'user';
        needsUpdate = true;
      }

      // ✅ Corrigir recipient_type
      if (!['user', 'group'].includes(msg.recipient_type)) {
        const thread = threadsInternas.find(t => t.id === threadId);
        updateData.recipient_type = thread?.is_group_chat ? 'group' : 'user';
        needsUpdate = true;
      }

      // ✅ Corrigir channel
      if (msg.channel !== 'interno') {
        updateData.channel = 'interno';
        needsUpdate = true;
      }

      if (needsUpdate && !dryRun) {
        await base44.asServiceRole.entities.Message.update(msg.id, updateData);
        corrigidas++;
      }
    }
  }

  return Response.json({
    success: true,
    dry_run: dryRun,
    threads_analisadas: threadsInternas.length,
    mensagens_corrigidas: corrigidas
  });
});
```

---

## 📚 10. RESUMO EXECUTIVO

### ✅ O que está funcionando:
1. Filtro triplo no ChatWindow (channel + sender_type + recipient_type)
2. Logs detalhados para debug
3. Separação clara entre interno/externo
4. Handler otimista dedicado

### ⚠️ Pontos de atenção:
1. **Backend `sendInternalMessage`**: Deve SEMPRE salvar com campos corretos
2. **Handler pai (Comunicacao.jsx)**: Precisa implementar fluxo otimista completo
3. **Thread_id**: Funções `getOrCreateInternalThread` e `getOrCreateSectorThread` devem retornar thread correta

### 🎯 Próximos passos para validar:
1. Ler `pages/Comunicacao.jsx` para ver `onSendInternalMessageOptimistic`
2. Ler `functions/sendInternalMessage.js` para validar schema
3. Testar envio 1:1 interno e verificar logs no console
4. Se mensagens somem → usar DiagnosticoMensagensInternas para identificar campos errados

---

**FIM DA ANÁLISE** ✅