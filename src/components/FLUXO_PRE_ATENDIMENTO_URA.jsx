# 🤖 FLUXO DE PRÉ-ATENDIMENTO E URA - ANÁLISE COMPLETA

## 📋 Versão do Sistema
- **inboundCore**: v10.0.0-IMMUTABLE-LINE
- **webhookWapi**: v25.0.0-CLONE-FIX (req.clone() corrigido)
- **webhookFinalZapi**: v10.0.0-PURE-INGESTION
- **Data**: 2026-01-07

---

## 🎯 PIPELINE COMPLETO (10 ETAPAS)

### Pipeline do `processInboundEvent` (lib/inboundCore.js):

```
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK (Z-API ou W-API)                                       │
│  1. Recebe payload                                              │
│  2. Salva Contact, MessageThread, Message                       │
│  3. Chama processInboundEvent()                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 1: NORMALIZAÇÃO DE INPUT                                 │
│  • Detecta se é texto, botão ou list_reply                      │
│  • Cria objeto userInput { type, content, id }                  │
│  └─→ result.pipeline.push('input_normalized')                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  KILL SWITCH: RESET DE PROMOÇÕES (PRIORIDADE MÁXIMA)            │
│  • Se sender_type = 'contact', SEMPRE reseta:                   │
│    - autoboost_stage = null                                     │
│    - last_boost_at = null                                       │
│    - promo_cooldown_expires_at = null                           │
│  • Contabiliza resposta na Promoção (contador_respostas++)     │
│  └─→ result.pipeline.push('promotion_reset')                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 2: MICRO-URA DE TRANSFERÊNCIA (Safety Check)            │
│  • Se thread.transfer_pending = true:                           │
│    - Verifica se expirou (5 min) → limpa estado                │
│    - Se resposta = "1", "sim" → confirma transferência         │
│    - Se resposta = "2", "não" → cancela transferência          │
│    - Qualquer mensagem longa (>3 chars) → auto-cancela         │
│  └─→ result.pipeline.push('micro_ura_check')                    │
│  └─→ RETORNA SE CONSUMIU (consumed: true)                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 3: PAUSAR ENGAGEMENT STATE (Automações)                 │
│  • Se ContactEngagementState.status = 'active':                 │
│    - Muda para 'paused'                                         │
│    - Registra last_inbound_at                                   │
│  └─→ result.pipeline.push('update_engagement_state')            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 4: HARD-STOP - HUMANO ATIVO? (GUARDA PRINCIPAL)         │
│  • Função: humanoAtivo(thread, 2h)                              │
│  • Condições para BLOQUEAR URA:                                 │
│    ✓ thread.assigned_user_id existe                             │
│    ✓ thread.pre_atendimento_ativo = false                       │
│    ✓ thread.last_human_message_at existe                        │
│    ✓ Gap < 2h desde last_human_message_at                       │
│                                                                  │
│  • Se HUMANO ATIVO:                                             │
│    - Detecta pedido de transferência (IA analisa texto)        │
│    - Envia micro-URA de confirmação ("1-Sim / 2-Não")         │
│    - RETORNA (stop: true, reason: 'human_active')              │
│    - ❌ NÃO CHAMA URA                                           │
│                                                                  │
│  └─→ result.pipeline.push('human_check')                        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 5: DETECTOR DE CICLO (12h)                               │
│  • Função: detectNovoCiclo(last_inbound_at, now)                │
│  • Se Gap >= 12h desde última mensagem RECEBIDA:                │
│    - novoCiclo = true                                           │
│    - result.novoCiclo = true                                    │
│  └─→ result.pipeline.push('cycle_detection')                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 6: GUARDAS DE ROTEAMENTO ESPECIAL                        │
│  • Fornecedor/Compras: Se match → roteia e RETORNA              │
│  • Fidelizado: Se match → roteia e RETORNA                      │
│  └─→ result.pipeline.push('routing_guards')                     │
│  └─→ RETORNA SE ROTEADO (routed: true)                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 7: ANÁLISE DE INTENÇÃO (IA)                              │
│  • CONDIÇÕES para analisar:                                     │
│    ✓ novoCiclo = true (Gap >= 12h)                              │
│    ✓ thread.pre_atendimento_ativo = false                       │
│    ✓ userInput.type = 'text' (não é botão)                      │
│    ✓ userInput.content.length > 2                               │
│                                                                  │
│  • Se SIM:                                                       │
│    - Chama base44.functions.invoke('analisarIntencao')         │
│    - Recebe intentContext (setor sugerido, urgência, etc.)     │
│  └─→ result.pipeline.push('analyzing_intent')                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 8: DECISOR DE DISPATCH (O CÉREBRO)                       │
│  • Variáveis críticas:                                          │
│    - isUraActive = thread.pre_atendimento_ativo                 │
│    - isHumanActive = humanoAtivo(thread, 2h)                    │
│    - isHumanDormant = assigned_user_id existe MAS inativo       │
│                                                                  │
│  • LÓGICA DE DECISÃO (shouldDispatch):                          │
│    1️⃣ Se isUraActive = true → DISPATCH                          │
│    2️⃣ Se novoCiclo = true → DISPATCH                            │
│    3️⃣ Se isHumanDormant = true:                                 │
│       • Mensagem curta (<5 chars, sem "?") → NÃO DISPATCH      │
│       • Mensagem complexa → DISPATCH                            │
│    4️⃣ Se !assigned_user_id (limbo) → DISPATCH                   │
│                                                                  │
│  └─→ result.pipeline.push('pre_atendimento_dispatch')           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 9: DISPATCH PARA URA (SE shouldDispatch = true)         │
│  • Monta payloadUnificado:                                      │
│    - thread_id, contact_id, whatsapp_integration_id             │
│    - user_input (type, content, id)                             │
│    - intent_context (da IA, se houver)                          │
│    - is_new_cycle (boolean)                                     │
│    - provider ('z_api' ou 'w_api')                              │
│                                                                  │
│  • Chama: base44.functions.invoke('preAtendimentoHandler')     │
│  • RETORNA (handled_by_ura: true)                               │
│  └─→ result.actions.push('ura_dispatched')                      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  ETAPA 10: MENSAGEM SOLTA (Fallback)                            │
│  • Se chegou aqui:                                              │
│    - Não é URA ativa                                            │
│    - Não é novo ciclo                                           │
│    - Humano está ativo OU mensagem muito curta                  │
│  • Ação: NADA (apenas registra no banco)                        │
│  └─→ result.pipeline.push('normal_message')                     │
│  └─→ result.actions.push('message_in_cycle_no_ura')             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚨 POR QUE A URA NÃO ESTÁ SENDO CHAMADA

### Cenário Provável (baseado nos prints):

1. **THREAD JÁ TEM HUMANO ATRIBUÍDO** (`assigned_user_id` preenchido)
2. **HUMANO FALOU RECENTEMENTE** (`last_human_message_at` < 2h atrás)
3. **RESULTADO**: `humanoAtivo()` retorna `true` → **HARD-STOP na Etapa 4**

```javascript
// inboundCore.js linha 202-248
if (humanoAtivo(thread)) {
    result.actions.push('human_active_stop');
    // ... detecta pedido de transferência ...
    return { ...result, stop: true, reason: 'human_active' };
}
```

### O que acontece:
- ✅ Mensagem é salva no banco
- ✅ Thread.unread_count é incrementado
- ✅ Thread.last_message_at é atualizado
- ❌ URA NÃO é chamada (humano no controle)
- ❌ Nenhuma resposta automática é enviada

---

## 🔍 QUANDO A URA É CHAMADA (Condições exatas)

A função `shouldDispatch` só retorna `true` em 4 casos:

### 1️⃣ URA JÁ ATIVA (`thread.pre_atendimento_ativo = true`)
```javascript
if (isUraActive) {
    shouldDispatch = true;
}
```
**Motivo**: Uma vez iniciada, a URA mantém controle até concluir ou ser cancelada.

---

### 2️⃣ NOVO CICLO (Gap >= 12h desde `last_inbound_at`)
```javascript
else if (novoCiclo) {
    shouldDispatch = true;
}
```
**Motivo**: Após 12h sem falar, considera-se uma "nova conversa" → URA reinicia.

---

### 3️⃣ HUMANO DORMIU (Atribuído mas inativo há >2h)
```javascript
else if (isHumanDormant) {
    // Heurística: mensagens curtas (<5 chars, sem "?") não acordam robô
    if (userInput.content.length < 5 && !userInput.content.includes('?')) {
        console.log('[CORE] 🤫 Mensagem curta/passiva. Mantendo silêncio.');
        shouldDispatch = false;
    } else {
        console.log('[CORE] 🔔 Cliente demandando atenção. URA assume.');
        shouldDispatch = true;
    }
}
```
**Condições**:
- `thread.assigned_user_id` existe
- `last_human_message_at` existe MAS está há >2h
- Mensagem do cliente é "complexa" (>5 caracteres OU tem "?")

---

### 4️⃣ LIMBO (Sem humano atribuído)
```javascript
else if (!thread.assigned_user_id) {
    shouldDispatch = true;
}
```
**Motivo**: Thread órfã → URA assume automaticamente.

---

## ❌ QUANDO A URA **NÃO** É CHAMADA

### Bloqueio 1: Humano Ativo
```javascript
// inboundCore.js linha 47-63
export function humanoAtivo(thread, horasStale = 2) {
    if (!thread.assigned_user_id) return false;
    if (thread.pre_atendimento_ativo) return false; // URA no controle
    if (!thread.last_human_message_at) return false;
    
    const lastHumanDate = new Date(thread.last_human_message_at);
    const now = new Date();
    const hoursGap = (now - lastHumanDate) / (1000 * 60 * 60);
    
    return hoursGap < 2; // Humano ativo se falou nas últimas 2h
}
```

**Se essa função retorna `true`**:
- ✅ Webhook salva mensagem normalmente
- ✅ `unread_count++` acontece
- ❌ URA não é chamada (linha 202: `return { stop: true }`)
- ❌ Nenhuma resposta automática é enviada

---

### Bloqueio 2: Guardas de Roteamento (Fornecedor/Fidelizado)
```javascript
// inboundCore.js linha 262-280
if (ehFornecedorOuCompras(contact, thread)) {
    await aplicarRoteamentoFornecedor(base44, thread, contact);
    return { routed: true, to: 'fornecedor' };
}

if (classificacao.fidelizado) {
    await aplicarRoteamentoFidelizado(base44, thread, contact);
    return { routed: true, to: 'fidelizado' };
}
```

**Efeito**: Se contato for fornecedor ou fidelizado, URA pode ser pulada.

---

## 🐛 DIAGNÓSTICO DO SEU CASO

### O que os logs mostram:

**Z-API (funcionando)**:
```
✅ Mensagem salva: 6927a5f4...
✅ Thread atualizada: 692650cd... | Não lidas: 3
✅ Inbound Core processado com sucesso
```

**W-API (não aparece na tela)**:
```
✅ Mensagem salva: 692796c4...
✅ Thread atualizada | Não lidas: 1
🔴 GERENTE: Erro no processamento: Arquivo não encontrado (lib/inboundCore.js)
```

### Problema identificado:

1. **Backend salva corretamente** (Contact, Thread, Message)
2. **Erro no `processInboundEvent`** (import falha):
   ```javascript
   const { processInboundEvent } = await import('./lib/inboundCore.js');
   ```
   **Resultado**: URA não é chamada → Nenhuma automação roda

3. **Thread fica "muda"**:
   - `unread_count` incrementa ✅
   - URA não responde ❌
   - Contador aparece na sidebar ✅
   - Mas conversa não tem "vida" (sem pré-atendimento)

---

## 🔧 DIFERENÇAS Z-API vs W-API

| Aspecto | Z-API (✅ Funciona) | W-API (🔴 Erro) |
|---------|---------------------|------------------|
| **SDK Init** | `createClientFromRequest(req.clone())` | ✅ CORRIGIDO (req.clone() adicionado) |
| **asServiceRole** | ✅ Funciona | ✅ CORRIGIDO (era o req.clone()) |
| **Lookup Integração** | Por `instance_id_provider` | Por `connectedPhone` (números limpos) |
| **Import inboundCore** | `✅ Funciona` | `❌ Arquivo não encontrado` |
| **URA Chamada** | ✅ Sim (logs: "Inbound Core processado") | ❌ Não (erro no import) |

---

## ✅ CORREÇÕES APLICADAS

### 1. `webhookWapi.js` - req.clone()
```javascript
// ANTES (QUEBRADO)
base44 = createClientFromRequest(req);

// DEPOIS (CORRIGIDO)
base44 = createClientFromRequest(req.clone());
```
**Efeito**: `asServiceRole` agora funciona → Salva Contact/Thread/Message.

---

### 2. `ChatWindow.js` - Marcação manual de lidas
```javascript
// ANTES: Marcação automática ao abrir conversa
useEffect(() => {
  if (!thread || !usuario || !mensagens.length) return;
  marcarComoLidaMutation.mutate();
}, [thread?.id, mensagens.length, usuario?.id]);

// DEPOIS: Botão manual "Marcar lida (3)"
<button onClick={() => marcarComoLidaMutation.mutate()}>
  Marcar lida ({getUnreadCount(thread, usuario?.id)})
</button>
```
**Efeito**: Contador de não lidas permanece visível até marcação manual.

---

## 🎯 PRÓXIMA AÇÃO NECESSÁRIA

### O erro "Arquivo não encontrado" no W-API precisa ser investigado:

**Linha problemática** (webhookWapi.js:711):
```javascript
const { processInboundEvent } = await import('./lib/inboundCore.js');
```

**Possíveis causas**:
1. Caminho relativo incorreto no ambiente Deno
2. Arquivo `lib/inboundCore.js` não deployado junto com `webhookWapi.js`
3. Permissão de leitura do arquivo

**Teste sugerido**:
```javascript
// Adicionar log antes do import
console.log('[WAPI] 🔍 Tentando importar inboundCore...');
try {
    const { processInboundEvent } = await import('./lib/inboundCore.js');
    console.log('[WAPI] ✅ Import bem-sucedido');
} catch (err) {
    console.error('[WAPI] ❌ Erro no import:', err.message);
    console.error('[WAPI] ❌ Stack:', err.stack);
    console.error('[WAPI] ❌ CWD:', Deno.cwd());
    
    // FALLBACK: Tentar caminho absoluto
    try {
        const { processInboundEvent } = await import('/var/task/functions/lib/inboundCore.js');
        console.log('[WAPI] ✅ Import com caminho absoluto funcionou');
    } catch (err2) {
        console.error('[WAPI] ❌ Caminho absoluto também falhou:', err2.message);
    }
}
```

---

## 📊 FLUXOGRAMA VISUAL

```
MENSAGEM CHEGA
      │
      ▼
┌──────────────────────────┐
│ Webhook salva no banco   │
│ (Contact/Thread/Message) │
└──────────┬───────────────┘
           │
           ▼
    ┌──────────────────┐
    │ processInbound() │
    └──────┬───────────┘
           │
           ▼
    Humano Ativo?
    (< 2h desde last_human)
           │
      ┌────┴────┐
     SIM       NÃO
      │         │
      ▼         ▼
   PARA    Novo Ciclo?
   AQUI    (>= 12h gap)
           │
      ┌────┴────┐
     SIM       NÃO
      │         │
      ▼         ▼
    CHAMA    Humano
     URA    Dormindo?
            (>2h sem falar)
              │
         ┌────┴────┐
        SIM       NÃO
         │         │
         ▼         ▼
    Mensagem    PARA
    complexa?   AQUI
         │
    ┌────┴────┐
   SIM       NÃO
    │         │
    ▼         ▼
  CHAMA     PARA
   URA      AQUI
```

---

## 🎯 RESUMO EXECUTIVO

### ✅ O que está funcionando:
1. Webhooks salvam mensagens (Z-API e W-API)
2. `unread_count` incrementa corretamente
3. Threads aparecem na sidebar (após filtrar por canal)
4. `req.clone()` corrigiu asServiceRole

### ❌ O que NÃO está funcionando (W-API):
1. **Import de `inboundCore.js` falha** → URA não é chamada
2. **Nenhuma resposta automática** (pré-atendimento parado)
3. **Thread fica "morta"** (só recebe, não responde)

### 🔧 Ação corretiva:
Verificar por que o import dinâmico falha no W-API mas funciona no Z-API.

---

## 📝 CHECKLIST DE VALIDAÇÃO

Para confirmar que a URA está sendo chamada, verificar nos logs:

- [ ] `[WAPI] 🏛️ GERENTE: Iniciando processamento com Core...`
- [ ] `[WAPI] 🔐 GERENTE: Integração carregada`
- [ ] `[WAPI] ✅ GERENTE: Processamento concluído com sucesso`
- [ ] `[CORE] 🚀 Pipeline: [input_normalized, promotion_reset, ...]`
- [ ] `[CORE] 🔔 Cliente demandando atenção. URA assume.`
- [ ] `[URA] Mensagem enviada: "Olá! Qual setor deseja?"`

Se qualquer um desses logs **NÃO aparecer**, a URA não está rodando.