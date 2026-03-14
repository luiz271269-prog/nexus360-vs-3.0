# ORQUESTRADOR — Skills de Pré-Atendimento Autônomo v2.0

## Instruções de Integração

Este é um **pseudocódigo/snippet** para colar no `processInbound.ts` (não é uma função independente).

---

## Posição no processInbound

Substitua o bloco antigo de **pré-atendimento** pelo trecho abaixo (aproximadamente linhas 150-250, após validação de contato/thread).

---

## Código para colar

```typescript
// ════════════════════════════════════════════════════════════════════════════
// SKILL 01 — ACK IMEDIATO (fire-and-forget)
// ════════════════════════════════════════════════════════════════════════════

if (message?.sender_type === 'contact' && thread?.thread_type === 'contact_external') {
  // Fire-and-forget: não aguarda resposta
  base44.asServiceRole.functions.invoke('skillACKImediato', {
    thread_id: thread.id,
    contact_id: contact.id,
    integration_id: thread.whatsapp_integration_id || integration?.id
  }).then(() => {
    console.log(`[ORQUESTR] ✅ ACK Imediato enviado para ${contact?.nome}`);
    result.pipeline.push('ack_imediato_sent');
  }).catch(err => {
    console.warn(`[ORQUESTR] ⚠️ ACK Imediato falhou: ${err.message}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SKILL 02 — INTENT ROUTER (await - crítico para decisão)
// ════════════════════════════════════════════════════════════════════════════

let routerResult = null;

if (message?.sender_type === 'contact' && !thread?.assigned_user_id && thread?.thread_type === 'contact_external') {
  try {
    console.log(`[ORQUESTR] 🧠 Acionando Intent Router para thread ${thread.id}`);
    
    const respRouter = await base44.asServiceRole.functions.invoke('skillIntentRouter', {
      thread_id: thread.id,
      contact_id: contact.id,
      message_content: messageContent || ''
    });

    if (respRouter?.data?.success) {
      routerResult = respRouter.data;
      result.pipeline.push('intent_router_ok');

      console.log(`[ORQUESTR] 🎯 Intent detectado: ${routerResult.setor} (conf: ${(routerResult.confidence * 100).toFixed(0)}%)`);
    }
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Intent Router falhou: ${err.message}`);
    result.pipeline.push('intent_router_failed');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DECISÃO: confidence >= threshold?
// ════════════════════════════════════════════════════════════════════════════

let shouldSkillQueue = false;
let thresholdUsado = 0.65;

if (routerResult?.confidence !== undefined) {
  // Buscar threshold do banco
  try {
    const configThreshold = await base44.asServiceRole.entities.ConfiguracaoSistema.filter(
      { chave: 'ai_router_confidence_threshold' },
      'chave',
      1
    );
    if (configThreshold?.length > 0) {
      thresholdUsado = configThreshold[0].valor?.value || 0.65;
    }
  } catch (e) {
    console.warn(`[ORQUESTR] ⚠️ Erro ao buscar threshold: ${(e as any).message}`);
  }

  shouldSkillQueue = routerResult.confidence >= thresholdUsado;

  console.log(`[ORQUESTR] 📊 Confidence ${(routerResult.confidence * 100).toFixed(0)}% >= threshold ${(thresholdUsado * 100).toFixed(0)}%? ${shouldSkillQueue ? 'SIM → SKILL 03' : 'NÃO → Menu URA'}`);
}

// ════════════════════════════════════════════════════════════════════════════
// SKILL 03 — QUEUE MANAGER (se confidence OK)
// ════════════════════════════════════════════════════════════════════════════

if (shouldSkillQueue && routerResult && !thread?.assigned_user_id) {
  try {
    console.log(`[ORQUESTR] 📋 Acionando Queue Manager para setor ${routerResult.setor}`);

    const respQueue = await base44.asServiceRole.functions.invoke('skillQueueManager', {
      thread_id: thread.id,
      contact_id: contact.id,
      integration_id: thread.whatsapp_integration_id || integration?.id,
      sector_id: routerResult.setor
    });

    if (respQueue?.data?.success) {
      const queueResult = respQueue.data;
      result.pipeline.push('queue_manager_ok');

      if (queueResult.action === 'assigned') {
        console.log(`[ORQUESTR] ✅ Atribuído para ${queueResult.atendente_nome}`);
        result.actions.push('contato_atribuido_automaticamente');
        return Response.json({
          success: true,
          pipeline: result.pipeline,
          actions: result.actions,
          handled_by: 'skill_queue_assigned'
        });
      } else if (queueResult.action === 'queued') {
        console.log(`[ORQUESTR] 📋 Enfileirado em ${routerResult.setor}`);
        result.actions.push('contato_enfileirado_automaticamente');
        return Response.json({
          success: true,
          pipeline: result.pipeline,
          actions: result.actions,
          handled_by: 'skill_queue_queued'
        });
      }
    }
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Queue Manager falhou: ${err.message}`);
    result.pipeline.push('queue_manager_failed');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FALLBACK: Menu URA clássico (confidence < threshold)
// ════════════════════════════════════════════════════════════════════════════

if (!shouldSkillQueue || !routerResult) {
  console.log(`[ORQUESTR] 📞 Confidence baixa ou roteador falhou → acionando Menu URA clássico`);
  
  try {
    await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
      thread_id: thread.id,
      contact_id: contact.id,
      whatsapp_integration_id: thread.whatsapp_integration_id,
      user_input: { type: 'system', content: '' }
    });
    
    result.pipeline.push('pre_atendimento_menu');
    result.actions.push('menu_ura_acionado');
  } catch (err) {
    console.error(`[ORQUESTR] ❌ Menu URA falhou: ${err.message}`);
    result.actions.push('ura_fallback_failed');
  }
}
```

---

## Configuração Necessária

### 1. 4 Funções no Base44

Crie as 4 funções com nomes exatos:
- `skillACKImediato`
- `skillIntentRouter`
- `skillQueueManager`
- `skillSLAGuardian`

(Copiar conteúdo dos 4 arquivos TypeScript criados)

### 2. ConfiguracaoSistema records

Inserir 2 records no banco (usando admin ou API):

```javascript
// Record 1: Threshold de confiança
{
  "chave": "ai_router_confidence_threshold",
  "categoria": "pre_atendimento",
  "valor": { "value": 0.65 },
  "descricao": "Threshold mínimo de confiança para roteamento automático (0.0-1.0)",
  "ativa": true
}

// Record 2: Horário comercial
{
  "chave": "horario_comercial",
  "categoria": "pre_atendimento",
  "valor": { "inicio": 8, "fim": 18, "dias": [1,2,3,4,5] },
  "descricao": "Horário comercial (0=dom...6=sab)",
  "ativa": true
}
```

### 3. SLA Guardian no jarvisEventLoop

Adicionar no `jarvisEventLoop` (existente):

```typescript
// A cada ciclo de 5 minutos, executar:
if (cicloAtual % 5 === 0) {
  try {
    const slaResult = await base44.asServiceRole.functions.invoke('skillSLAGuardian', {});
    console.log(`[JARVIS] SLA Guardian executado:`, slaResult.data?.resultados);
  } catch (err) {
    console.warn(`[JARVIS] SLA Guardian falhou:`, err.message);
  }
}
```

### 4. Validar campos no banco

Confirmar que as entidades têm estes campos:

**MessageThread:**
- `routing_stage` (NEW / INTENT_DETECTED / ROUTED / ASSIGNED / COMPLETED)
- `sector_id`
- `assigned_user_id`
- `entrou_na_fila_em`
- `jarvis_next_check_after`
- `jarvis_last_playbook`
- `atendentes_historico[]`

**Contact:**
- `tipo_contato` (novo / lead / cliente / fornecedor / parceiro)
- `is_vip`
- `classe_abc`
- `atendente_fidelizado_vendas`
- `atendente_fidelizado_assistencia`
- `atendente_fidelizado_financeiro`
- `atendente_fidelizado_fornecedor`

**User:**
- `attendant_sector`
- `current_conversations_count`
- `availability_status`
- `is_whatsapp_attendant`

---

## Fluxo de Execução

```
Inbound WhatsApp
    ↓
processInbound → ORQUESTRADOR
    ↓
1. ACK Imediato (fire-and-forget)
    ↓
2. Intent Router (await)
    ├─ Pattern Match (0ms)
    └─ LLM (se confidence < 0.75)
    ↓
3. Decisão: confidence >= threshold?
    ├─ SIM → Queue Manager
    │   ├─ Atendente disponível? → ASSIGNED + Boas-vindas
    │   └─ Não? → QUEUED + Pergunta qualificadora
    │
    └─ NÃO → Menu URA clássico
    ↓
4. SLA Guardian (periódico, 5min)
   ├─ 5min → Aviso
   ├─ 10min → Reatribuição
   └─ 15min → Escalonamento
```

---

## Monitoramento

- Verificar logs: `[ORQUESTR]`, `[SKILL-ACK]`, `[ROUTER]`, `[QUEUE]`, `[SLA]`
- Campos principais para tracking:
  - `IntentDetection` → histórico de detecções
  - `SkillExecution` → execução de cada skill
  - `WorkQueueItem` → filas e escalonamentos

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| ACK não envia | Validar integração_id e telefone normalizado |
| Intent sempre fallback | Aumentar threshold ou revisar patterns |
| Nenhum atendente atribuído | Verificar User.attendant_sector e availability_status |
| SLA não executa | Confirmar que jarvisEventLoop está rodando a cada 5min |