# NEXUS360 — 4 Skills de Pré-Atendimento Autônomo v2.0
## Consolidação & Deploy — Março 2026

---

## 📦 Status: 4 Funções TypeScript Criadas ✅

| Arquivo | Skill | Versão |
|---------|-------|--------|
| `skillACKImediato.ts`      | ACK Imediato <2s           | v1.1 |
| `skillIntentRouter.ts`     | Pattern Match → LLM        | v2.1 |
| `skillQueueManager.ts`     | Atendente + Fila           | v1.1 |
| `skillSLAGuardian.ts`      | SLA 5/10/15min             | v2.1 |

---

## 🚀 DEPLOY (5 passos)

### 1️⃣ Copiar 4 funções para Base44

Via Code → Functions → Create, copiar conteúdo de cada `.ts`

### 2️⃣ Inserir 2 ConfiguracaoSistema records

```javascript
// Threshold confiança
{ chave: 'ai_router_confidence_threshold', valor: { value: 0.65 } }

// Horário comercial  
{ chave: 'horario_comercial', valor: { inicio: 8, fim: 18, dias: [1,2,3,4,5] } }
```

### 3️⃣ Colar Orquestrador em processInbound

Substitua bloco antigo de pré-atendimento (linhas ~150-250) com:

```typescript
// SKILL 01 — ACK IMEDIATO (fire & forget)
if (message?.sender_type === 'contact' && thread?.thread_type === 'contact_external') {
  base44.asServiceRole.functions.invoke('skillACKImediato', {
    thread_id: thread.id, contact_id: contact.id, integration_id: thread.whatsapp_integration_id || integration?.id
  }).catch(err => console.warn(`[ORQUESTR] ACK: ${err.message}`));
}

// SKILL 02 — INTENT ROUTER
let routerResult = null;
if (message?.sender_type === 'contact' && !thread?.assigned_user_id && thread?.thread_type === 'contact_external') {
  try {
    const r = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
      thread_id: thread.id, contact_id: contact.id, message_content: messageContent || ''
    });
    if (r?.data?.success) {
      routerResult = r.data;
      console.log(`[ORQUESTR] 🎯 ${routerResult.setor} (${(routerResult.confidence*100|0)}%)`);
    }
  } catch (err) { console.error(`[ORQUESTR] Router: ${err.message}`); }
}

// DECISÃO: confidence >= threshold?
let threshold = 0.65, shouldQueue = false;
if (routerResult?.confidence) {
  try {
    const cfg = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({chave: 'ai_router_confidence_threshold'}, 'chave', 1);
    if (cfg?.length) threshold = cfg[0].valor?.value || 0.65;
  } catch(e) {}
  shouldQueue = routerResult.confidence >= threshold;
}

// SKILL 03 — QUEUE MANAGER
if (shouldQueue && routerResult && !thread?.assigned_user_id) {
  try {
    const q = await base44.asServiceRole.functions.invoke('skillQueueManager', {
      thread_id: thread.id, contact_id: contact.id, integration_id: thread.whatsapp_integration_id || integration?.id, sector_id: routerResult.setor
    });
    if (q?.data?.success && q.data.action === 'assigned') {
      return Response.json({ success: true, handled_by: 'skill_assigned' });
    }
  } catch(err) { console.error(`[ORQUESTR] Queue: ${err.message}`); }
}

// FALLBACK: Menu URA
try {
  await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
    thread_id: thread.id, contact_id: contact.id, whatsapp_integration_id: thread.whatsapp_integration_id,
    user_input: { type: 'system', content: '' }
  });
} catch(err) { console.error(`[ORQUESTR] URA: ${err.message}`); }
```

### 4️⃣ Integrar SLA Guardian em jarvisEventLoop

Adicionar linha:
```typescript
await base44.asServiceRole.functions.invoke('skillSLAGuardian', {});
```

### 5️⃣ Validar campos no banco

- MessageThread: `routing_stage`, `sector_id`, `assigned_user_id`, `entrou_na_fila_em`, `jarvis_next_check_after`
- Contact: `tipo_contato`, `is_vip`, `clase_abc`, `atendente_fidelizado_*`
- User: `attendant_sector`, `current_conversations_count`, `availability_status`

---

## 🔄 FLUXO

```
Inbound
  ↓
ACK (<2s)
  ↓
Intent Router (0ms pattern / 2s LLM)
  ↓
confidence >= 0.65?
  ├─ YES → Queue Manager → ASSIGNED + Boas-vindas
  └─ NO → Menu URA (fallback)

SLA Guardian (5min):
  5min → Aviso
  10min → Reatrib
  15min → Escalação
```

---

## ✅ Checklist Pós-Deploy

- [ ] 4 funções criadas e deployadas
- [ ] 2 ConfiguracaoSistema records inseridos
- [ ] Orquestrador colado em processInbound
- [ ] SLA Guardian integrado a jarvisEventLoop
- [ ] Campos de banco validados
- [ ] Teste manual: enviar msg → verificar logs
- [ ] ACK recebido em <2s ✓
- [ ] Intent detectado ✓
- [ ] Atendente atribuído ou enfileirado ✓

---

**Tudo pronto! Deploy & integração em ~30 minutos.**