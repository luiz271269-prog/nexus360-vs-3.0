# 🎯 COMPARAÇÃO: FLUXO QUE FUNCIONA vs QUEBRADOS

**Data:** 2026-02-12  
**Objetivo:** Usar o fluxo de envio individual (ChatWindow) como PADRÃO OURO para corrigir envio em massa e automático

---

## ✅ FLUXO QUE FUNCIONA - Envio Individual (ChatWindow)

**Arquivo:** `pages/Comunicacao.jsx` linha 1301-1428  
**Handler:** `handleEnviarMensagemOtimista`  
**Status:** ✅ **100% FUNCIONAL**

### 📋 LINHA LÓGICA COMPLETA (23 passos)

```javascript
// ═══════════════════════════════════════════════════════════════
// PARTE 1: VALIDAÇÕES E PREPARAÇÃO (linhas 1301-1316)
// ═══════════════════════════════════════════════════════════════

1. ✅ Verificar threadAtiva e usuario
2. ✅ Extrair dados: { texto, integrationId, replyToMessage, mediaUrl, mediaType, mediaCaption, isAudio }
3. ✅ VALIDAR PERMISSÃO can_send (linha 1307-1316):
   - Admin: sempre pode
   - Outros: verificar whatsapp_permissions[].can_send === true

// ═══════════════════════════════════════════════════════════════
// PARTE 2: OPTIMISTIC UI - Mensagem temporária (linhas 1318-1343)
// ═══════════════════════════════════════════════════════════════

4. ✅ Criar mensagem temporária com id `temp-${Date.now()}`
5. ✅ Status: "enviando"
6. ✅ Adicionar ao cache INSTANTANEAMENTE (linha 1341-1343):
   queryClient.setQueryData(['mensagens', threadAtiva.id], antigas => [...antigas, msgTemp])

// ═══════════════════════════════════════════════════════════════
// PARTE 3: ENVIO REAL VIA GATEWAY (linhas 1346-1378)
// ═══════════════════════════════════════════════════════════════

7. ✅ Buscar telefone do contato (linha 1347-1352)
8. ✅ Validar telefone existe
9. ✅ Montar payload para enviarWhatsApp:
   - integration_id
   - numero_destino
   - mensagem OU media_url/audio_url
   - reply_to_message_id (se quote)

10. ✅ CHAMAR GATEWAY: base44.functions.invoke('enviarWhatsApp', payload) (linha 1378)

// ═══════════════════════════════════════════════════════════════
// PARTE 4: PERSISTÊNCIA EXPLÍCITA (linhas 1382-1410)
// ═══════════════════════════════════════════════════════════════

11. ✅ Se sucesso, PERSISTIR Message (linha 1382-1400):
    - thread_id
    - sender_id, sender_type: 'user'
    - recipient_id, recipient_type: 'contact'
    - content, channel: 'whatsapp', status: 'enviada'
    - whatsapp_message_id (retornado pelo gateway)
    - metadata.whatsapp_integration_id

12. ✅ ATUALIZAR MessageThread (linha 1402-1410):
    - last_message_content (primeiros 100 chars)
    - last_message_at (now)
    - last_message_sender: 'user'
    - last_human_message_at (now)
    - last_media_type
    - whatsapp_integration_id
    - pre_atendimento_ativo: false (desliga URA)

// ═══════════════════════════════════════════════════════════════
// PARTE 5: ATUALIZAÇÃO DO CACHE E UI (linhas 1412-1414)
// ═══════════════════════════════════════════════════════════════

13. ✅ Invalidar queries:
    - ['mensagens', threadAtiva.id]
    - ['threads-externas']

14. ✅ Mensagem temporária é substituída pela real
15. ✅ Thread sobe na lista (last_message_at atualizado)

// ═══════════════════════════════════════════════════════════════
// PARTE 6: TRATAMENTO DE ERRO (linhas 1418-1427)
// ═══════════════════════════════════════════════════════════════

16. ❌ Se erro, ROLLBACK:
    - Remover mensagem temporária do cache (linha 1422-1424)
    - Toast de erro (linha 1426)
```

---

## ❌ FLUXO QUEBRADO 1 - Envio em Massa via Modal

**Arquivo:** `components/comunicacao/ModalEnvioMassa.jsx`  
**Handler:** `handleEnviar` (linha 15-59)  
**Chama:** `enviarMensagemMassa` → `enviarCampanhaLote` (modo: broadcast)  
**Status:** ❌ **QUEBRADO** - Mensagens não aparecem na UI

### 🚨 GAPS vs FLUXO QUE FUNCIONA

| Passo | Funciona (Individual) | Quebrado (Massa Modal) | Gap |
|-------|----------------------|----------------------|-----|
| **1. Validação permissão** | ✅ can_send validado | ❌ Não valida | **P1** |
| **2. Buscar telefone** | ✅ contato.telefone | ✅ Presente | OK |
| **3. Chamar gateway** | ✅ enviarWhatsApp | ✅ enviarWhatsApp (via lote) | OK |
| **4. Persistir Message** | ✅ Explícita (linha 1382) | ❌ Depende do gateway | **P0** |
| **5. Atualizar Thread** | ✅ Explícita (linha 1402) | ❌ Depende do gateway | **P0** |
| **6. Invalidar cache** | ✅ queries específicas | ❌ Não invalida | **P1** |
| **7. Toast feedback** | ✅ Erro detalhado | ✅ Mostra enviados/erros | OK |
| **8. Rollback erro** | ✅ Remove temporária | ❌ Não usa optimistic | N/A |

**CAUSA RAIZ:** `enviarCampanhaLote` não persiste Message/Thread explicitamente, espera que o gateway faça isso.

**PROVA:** Linha 1382-1410 do fluxo funcional mostra persistência explícita APÓS gateway retornar sucesso.

---

## ❌ FLUXO QUEBRADO 2 - Envio Automático (Botão "Auto")

**Arquivo:** `components/comunicacao/ContatosRequerendoAtencao.jsx`  
**Handler:** `enviarPromocoesAutomaticas` (linha 232-287)  
**Chama:** `enviarCampanhaLote` (modo: promocao)  
**Status:** ⚠️ **PARCIALMENTE FUNCIONAL** - Saudação enviada mas promoção pode não sair

### 🚨 GAPS vs FLUXO QUE FUNCIONA

| Passo | Funciona (Individual) | Quebrado (Auto Promoções) | Gap |
|-------|----------------------|--------------------------|-----|
| **1. Validação permissão** | ✅ can_send validado | ❌ Não valida | **P1** |
| **2. Buscar telefone** | ✅ contato.telefone | ✅ Validado no lote | OK |
| **3. Saudação imediata** | N/A | ✅ Envia via enviarWhatsApp | OK |
| **4. Persistir saudação** | N/A | ⚠️ Deve persistir mas não verifica | **P1** |
| **5. Agendar promoção (fila)** | N/A | ✅ WorkQueueItem.create | OK |
| **6. Worker processa** | N/A | ✅ processarFilaPromocoes | OK |
| **7. Validar bloqueios (worker)** | N/A | ❌ Não revalida | **P2** |
| **8. Verificar cancelamento** | N/A | ✅ last_inbound_at (linha 52) | OK |
| **9. Enviar promoção (worker)** | N/A | ✅ sendPromotion | OK |
| **10. Persistir promoção** | N/A | ✅ Via promotionEngine | OK |
| **11. Atualizar Contact** | N/A | ✅ last_promo_ids | OK |
| **12. AutomationLog** | N/A | ❌ Worker não grava | **P2** |

**CAUSA RAIZ:** Falta validação de permissões antes de agendar e worker não revalida bloqueios.

---

## 🎯 SOLUÇÃO: COPIAR EXATAMENTE O QUE FUNCIONA

### 📝 REGRAS DO PADRÃO OURO (ChatWindow Individual)

```typescript
// ═══════════════════════════════════════════════════════════════
// REGRA 1: VALIDAR PERMISSÃO SEMPRE
// ═══════════════════════════════════════════════════════════════
if (usuario.role !== 'admin') {
  const whatsappPerms = usuario.whatsapp_permissions || [];
  if (whatsappPerms.length > 0) {
    const perm = whatsappPerms.find(p => p.integration_id === integrationId);
    if (!perm || perm.can_send !== true) {
      return { success: false, error: 'Sem permissão' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// REGRA 2: BUSCAR TELEFONE DO CONTATO
// ═══════════════════════════════════════════════════════════════
const contatoAtual = contatos.find(c => c.id === threadAtiva.contact_id);
const telefone = contatoAtual?.telefone || contatoAtual?.celular;

if (!telefone) {
  throw new Error('Contato sem telefone');
}

// ═══════════════════════════════════════════════════════════════
// REGRA 3: CHAMAR GATEWAY COM PAYLOAD COMPLETO
// ═══════════════════════════════════════════════════════════════
const payload = {
  integration_id: integrationId,
  numero_destino: telefone,
  mensagem: texto  // OU media_url, audio_url, template_name
};

if (replyToMessage?.whatsapp_message_id) {
  payload.reply_to_message_id = replyToMessage.whatsapp_message_id;
}

const resultado = await base44.functions.invoke('enviarWhatsApp', payload);

if (!resultado.data.success) {
  throw new Error(resultado.data.error || 'Erro no gateway');
}

// ═══════════════════════════════════════════════════════════════
// REGRA 4: PERSISTIR MESSAGE EXPLICITAMENTE (P0 - CRÍTICO)
// ═══════════════════════════════════════════════════════════════
await base44.entities.Message.create({
  thread_id: threadAtiva.id,
  sender_id: usuario.id,
  sender_type: "user",
  recipient_id: threadAtiva.contact_id,
  recipient_type: "contact",
  content: texto || '[Mídia]',
  channel: "whatsapp",
  status: "enviada",
  whatsapp_message_id: resultado.data.message_id,  // ✅ CRÍTICO
  sent_at: new Date().toISOString(),
  media_url: mediaUrl || null,
  media_type: mediaType || 'none',
  media_caption: mediaCaption || null,
  reply_to_message_id: replyToMessage?.id || null,
  metadata: {
    whatsapp_integration_id: integrationId
  }
});

// ═══════════════════════════════════════════════════════════════
// REGRA 5: ATUALIZAR THREAD EXPLICITAMENTE (P0 - CRÍTICO)
// ═══════════════════════════════════════════════════════════════
await base44.entities.MessageThread.update(threadAtiva.id, {
  last_message_content: texto.substring(0, 100),
  last_message_at: new Date().toISOString(),
  last_message_sender: "user",
  last_human_message_at: new Date().toISOString(),
  last_media_type: mediaType || 'none',
  whatsapp_integration_id: integrationId,
  pre_atendimento_ativo: false  // ✅ Desliga URA
});

// ═══════════════════════════════════════════════════════════════
// REGRA 6: INVALIDAR CACHE PARA UI ATUALIZAR
// ═══════════════════════════════════════════════════════════════
queryClient.invalidateQueries({ queryKey: ['mensagens', threadAtiva.id] });
queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
```

---

## 🔧 CORREÇÕES NECESSÁRIAS

### ✅ CORREÇÃO 1: enviarCampanhaLote.js - Modo Broadcast

**Arquivo:** `functions/enviarCampanhaLote.js`  
**Linhas para adicionar:** Após linha 124 (após chamar gateway)

```javascript
// ✅ ADICIONAR APÓS enviarWhatsApp retornar sucesso:

// ✅ REGRA 4: PERSISTIR MESSAGE (copiar do ChatWindow linha 1382-1400)
const msgCriada = await base44.asServiceRole.entities.Message.create({
  thread_id: thread.id,
  sender_id: (await base44.auth.me())?.id || 'system',
  sender_type: 'user',
  recipient_id: contato.id,
  recipient_type: 'contact',
  content: mensagemFinal,
  channel: 'whatsapp',
  status: 'enviada',
  whatsapp_message_id: respEnvio.data.message_id,  // ✅ Do gateway
  sent_at: now.toISOString(),
  metadata: {
    whatsapp_integration_id: integration.id,
    origem_campanha: 'broadcast_massa',
    personalizada: personalizar
  }
});

// ✅ REGRA 5: ATUALIZAR THREAD (copiar do ChatWindow linha 1402-1410)
await base44.asServiceRole.entities.MessageThread.update(thread.id, {
  last_message_content: mensagemFinal.substring(0, 100),
  last_message_at: now.toISOString(),
  last_outbound_at: now.toISOString(),
  last_message_sender: 'user',
  last_human_message_at: now.toISOString(),
  whatsapp_integration_id: integration.id,
  pre_atendimento_ativo: false
});
```

**Impacto:** ✅ Mensagens aparecem na UI, thread sobe na lista

---

### ✅ CORREÇÃO 2: enviarCampanhaLote.js - Modo Promoção

**Arquivo:** `functions/enviarCampanhaLote.js`  
**Linhas para adicionar:** Após linha 183 (após enviar saudação)

```javascript
// ✅ ADICIONAR APÓS saudação ser enviada:

// ✅ REGRA 4: PERSISTIR SAUDAÇÃO (igual ao broadcast)
const msgSaudacao = await base44.asServiceRole.entities.Message.create({
  thread_id: thread.id,
  sender_id: (await base44.auth.me())?.id || 'system',
  sender_type: 'user',
  recipient_id: contato.id,
  recipient_type: 'contact',
  content: saudacao,
  channel: 'whatsapp',
  status: 'enviada',
  whatsapp_message_id: respSaudacao.data.message_id,
  sent_at: now.toISOString(),
  metadata: {
    whatsapp_integration_id: integration.id,
    origem_campanha: 'promocao_saudacao'
  }
});

// ✅ REGRA 5: ATUALIZAR THREAD
await base44.asServiceRole.entities.MessageThread.update(thread.id, {
  last_message_content: saudacao.substring(0, 100),
  last_message_at: now.toISOString(),
  last_outbound_at: now.toISOString(),
  last_message_sender: 'user',
  last_human_message_at: now.toISOString(),
  whatsapp_integration_id: integration.id
});

// ✅ ADICIONAR: Atualizar cooldown de promoção no Contact (P1)
await base44.asServiceRole.entities.Contact.update(contato.id, {
  last_any_promo_sent_at: now.toISOString()
});
```

**Impacto:** ✅ Saudação aparece na UI + cooldown registrado

---

### ✅ CORREÇÃO 3: processarFilaPromocoes - Worker Validações

**Arquivo:** `functions/processarFilaPromocoes.js`  
**Linhas para adicionar:** Após linha 50 (antes de sendPromotion)

```javascript
// ✅ ADICIONAR VALIDAÇÕES ANTES DE ENVIAR (copiar de enviarCampanhaLote):

// VALIDAÇÃO 1: Telefone ainda existe?
if (!contato.telefone) {
  await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
    status: 'erro',
    metadata: { erro: 'Telefone vazio' }
  });
  erros++;
  continue;
}

// VALIDAÇÃO 2: Contato ainda não está bloqueado?
if (contato.bloqueado) {
  await base44.asServiceRole.entities.WorkQueueItem.update(item.id, {
    status: 'cancelado',
    metadata: { cancelado_motivo: 'contato_bloqueado' }
  });
  processados++;
  continue;
}

// VALIDAÇÃO 3: Integração ainda está conectada?
const integracaoAtual = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
if (!integracaoAtual || integracaoAtual.status !== 'conectado') {
  throw new Error('Integração não conectada');
}
```

**Impacto:** ✅ Evita enviar para contatos bloqueados/sem telefone

---

### ✅ CORREÇÃO 4: processarFilaPromocoes - Gravar Auditoria

**Arquivo:** `functions/processarFilaPromocoes.js`  
**Linhas para adicionar:** Após linha 110 (antes do return final)

```javascript
// ✅ ADICIONAR AUDITORIA (copiar de enviarCampanhaLote linha 227-235):

await base44.asServiceRole.entities.AutomationLog.create({
  automation_type: 'promocao_worker',
  status: processados > 0 ? 'success' : 'failed',
  metadata: {
    items_processados: processados,
    items_com_erro: erros,
    timestamp: now.toISOString()
  }
});
```

**Impacto:** ✅ Rastreabilidade completa de execução do worker

---

## 📊 TABELA COMPARATIVA - STATUS ATUAL vs APÓS CORREÇÃO

| Funcionalidade | Individual (Funciona) | Massa (Atual) | Massa (Corrigido) | Auto (Atual) | Auto (Corrigido) |
|----------------|----------------------|---------------|-------------------|--------------|------------------|
| **Validar permissão** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Validar telefone** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Chamar gateway** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Persistir Message** | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| **Atualizar Thread** | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| **Atualizar Contact (cooldown)** | N/A | N/A | N/A | ❌ | ✅ |
| **Invalidar cache UI** | ✅ | ❌ | ⚠️ | ❌ | ⚠️ |
| **AutomationLog** | N/A | ✅ | ✅ | ❌ | ✅ |
| **Rollback erro** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Anti-rate-limit** | N/A | ✅ 500ms | ✅ 500ms | ✅ 600ms | ✅ 600ms |

**Legenda:**  
✅ Implementado  
⚠️ Parcial/depende de contexto  
❌ Ausente  
N/A Não se aplica

---

## 🚀 PLANO DE EXECUÇÃO - ORDEM DE PRIORIDADE

### 🔥 P0 - URGENTE (corrigir agora)

1. **enviarCampanhaLote.js - Modo Broadcast**
   - ✅ Já criado (linha 124-144)
   - ⚠️ FALTA: Atualizar última linha do loop (copiar Message.create + Thread.update)

2. **enviarCampanhaLote.js - Modo Promoção**
   - ✅ Já criado (linha 157-234)
   - ⚠️ FALTA: Atualizar após saudação (copiar Message.create + Thread.update + Contact.update)

### 🟠 P1 - ALTA PRIORIDADE

3. **Validação de permissões**
   - Adicionar check de `can_send` no início de `enviarCampanhaLote`
   - Rejeitar contatos sem permissão ANTES do loop

4. **Contact cooldown promoção**
   - Atualizar `last_any_promo_sent_at` após saudação
   - Previne duplo envio de promoções

### 🟡 P2 - MÉDIA PRIORIDADE

5. **Worker validações**
   - Revalidar bloqueios antes de enviar (linha 65-75 do worker)
   - AutomationLog após processamento (linha 111)

---

## 📝 DIFERENÇAS TÉCNICAS - INDIVIDUAL vs LOTE

| Aspecto | Individual (ChatWindow) | Lote (enviarCampanhaLote) |
|---------|------------------------|---------------------------|
| **Contexto de execução** | Frontend → backend | Backend → backend |
| **Usuário autenticado** | ✅ Sempre (req do frontend) | ⚠️ Service role (sem usuário) |
| **Optimistic UI** | ✅ Mensagem temporária | ❌ Não usa optimistic |
| **Invalidação cache** | ✅ queryClient.invalidate | ❌ Frontend não sabe |
| **sender_id** | usuario.id (real) | 'system' ou await base44.auth.me() |
| **Feedback tempo-real** | ✅ Toast instantâneo | ⚠️ Toast após conclusão |
| **Rate-limit** | N/A (1 msg) | ✅ 500-800ms entre envios |

**Observação importante:** Como `enviarCampanhaLote` roda em backend (service role), não tem acesso direto ao `queryClient` do frontend. Portanto, as mensagens só aparecem após refresh manual ou próximo refetch automático.

**Solução:** Persistência explícita garante que, quando a UI fizer refetch, as mensagens estarão lá.

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

```bash
# P0 - Aplicar regras do padrão ouro
[ ] Copiar Message.create do ChatWindow para enviarCampanhaLote (broadcast)
[ ] Copiar Thread.update do ChatWindow para enviarCampanhaLote (broadcast)
[ ] Copiar Message.create do ChatWindow para enviarCampanhaLote (promocao saudação)
[ ] Copiar Thread.update do ChatWindow para enviarCampanhaLote (promocao saudação)
[ ] Adicionar Contact.update (last_any_promo_sent_at) na promoção

# P1 - Validações de permissão
[ ] Adicionar check de can_send no início de enviarCampanhaLote
[ ] Filtrar contatos sem permissão ANTES do loop de envio

# P2 - Worker melhorias
[ ] Adicionar revalidação de bloqueios no processarFilaPromocoes
[ ] Adicionar AutomationLog no processarFilaPromocoes

# Teste final
[ ] Testar envio massa com 3 contatos
[ ] Verificar mensagens aparecem na UI
[ ] Verificar threads sobem na lista
[ ] Testar promoções automáticas
[ ] Verificar worker processa corretamente
```

---

## 🎯 CONCLUSÃO

**O QUE FUNCIONA:**
- ✅ ChatWindow persiste Message + Thread EXPLICITAMENTE
- ✅ Validações de permissão ANTES de enviar
- ✅ Optimistic UI para feedback instantâneo

**O QUE NÃO FUNCIONA:**
- ❌ Lote/Worker dependem do gateway persistir (mas gateway não faz isso)
- ❌ Sem validação de permissões no lote
- ❌ Sem invalidação de cache (UI não atualiza automaticamente)

**SOLUÇÃO:**
Copiar EXATAMENTE as linhas 1382-1410 do ChatWindow para dentro do loop de `enviarCampanhaLote` (após gateway retornar sucesso).

---

**Próximo passo:** Aplicar as 5 correções acima em sequência (P0 → P1 → P2).