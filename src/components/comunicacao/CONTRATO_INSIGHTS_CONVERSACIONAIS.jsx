# 📋 Contrato: Insights Conversacionais (Motor de Saúde Comercial)

**Versão:** 1.0  
**Data:** 2026-02-05  
**Sistema:** Nexus360 - Análise de Comportamento de Contatos

---

## 🎯 Modelo de Saída (TypeScript)

```typescript
export type InsightScopeMode = "bubble" | "period";

export interface ConversationInsightsPayload {
  scope: {
    mode: InsightScopeMode;
    start: string;         // ISO
    end: string;           // ISO
    threads: number;       // qtd de threads analisadas
    messages: number;      // qtd de mensagens analisadas
    limited_by_visibility: boolean;
    visibility_notice?: string;
  };
  scores: {
    health: number;        // 0–100 (saúde relacionamento)
    deal_risk: number;     // 0–100 (alto = pior)
    buy_intent: number;    // 0–100 (intenção compra)
    engagement: number;    // 0–100 (engajamento)
    account_potential?: number; // opcional (potencial conta)
  };
  stage: {
    current: "cotacao" | "negociacao" | "aprovado" | "oc_faturamento" | "entrega" | "pos_venda" | "parado";
    days_stalled: number;  // dias sem avanço relevante
  };
  metrics: {
    sentiment_current: number;         // 0–100
    sentiment_trend: "melhorando" | "estavel" | "piorando";
    friccao: {
      has_friction: boolean;
      reasons: string[];              // frases de corte, pressão, etc.
    };
    responsiveness: {
      avg_reply_minutes_company: number | null;
      avg_reply_minutes_client: number | null;
      unanswered_followups: number;    // qtd de follow-ups sem inbound
      best_contact_times: string[];    // ex: ["seg 9-11", "qui 14-16"]
    };
  };
  topics: Array<{
    name: "preco" | "prazo" | "especificacao" | "suporte" | "financeiro" | "concorrencia" | "relacionamento" | string;
    weight: number;        // 0–1
  }>;
  objections: Array<{
    text: string;
    category: "preco" | "prazo" | "condicao_pagamento" | "produto" | "outro";
    severity: "baixa" | "media" | "alta";
    unlock_hint: string;   // o que resolver para destravar
  }>;
  alerts: Array<{
    level: "baixo" | "medio" | "alto";
    reason: string;        // regra que disparou
  }>;
  next_best_action: {
    action: string;        // frase curta
    deadline_hours?: number;
    message_suggestion: string; // texto sugerido p/ WhatsApp
    need_manager: boolean;
    handoff: "manter" | "co_atendimento_gerente" | "trocar_responsavel";
  };
}
```

---

## 🔄 Pipeline de Preenchimento

### Etapa A/B: Escopo + Normalização

```javascript
// INPUT
const { mode, periodo_dias, sidebar_thread_ids, active_thread_id } = params;

// NORMALIZAR MENSAGENS
const normalized = messages.map(m => ({
  role: m.sender_type === 'contact' ? 'CLIENTE' : 'EMPRESA',
  type: m.media_type || 'text',
  text: cleanText(m.content), // remove assinaturas
  ts: new Date(m.created_date),
  thread_id: m.thread_id,
  integration_id: m.metadata?.whatsapp_integration_id
}));

// PREENCHER SCOPE
const payload = {
  scope: {
    mode,
    start: dataInicio.toISOString(),
    end: dataFim.toISOString(),
    threads: threadIds.length,
    messages: messages.length,
    limited_by_visibility: threadsVisible.length < threadsAll.length,
    visibility_notice: limited ? "Insights limitados: existem conversas bloqueadas" : null
  }
};
```

### Etapa C: Métricas Determinísticas

```javascript
// RESPONSIVIDADE
const responsiveness = {
  avg_reply_minutes_company: calcularTempoResposta(normalized, 'CLIENTE', 'EMPRESA'),
  avg_reply_minutes_client: calcularTempoResposta(normalized, 'EMPRESA', 'CLIENTE'),
  unanswered_followups: countFollowUpsConsecutivos(normalized),
  best_contact_times: detectarMelhoresHorarios(normalized)
};

// FRICÇÃO
const friccao = {
  has_friction: responsiveness.unanswered_followups >= 3 || 
                frasesDeCorteBloqueadas.length > 0,
  reasons: [
    responsiveness.unanswered_followups >= 3 ? `${responsiveness.unanswered_followups} follow-ups sem resposta` : null,
    ...frasesDeCorteBloqueadas
  ].filter(Boolean)
};

// ESTÁGIO + DIAS PARADO
const stage = {
  current: detectarEstagio(normalized),
  days_stalled: calcularDiasParado(normalized, estagio)
};

payload.metrics = { responsiveness, friccao };
payload.stage = stage;
```

### Etapa D: Classificações por IA

```javascript
// ANÁLISE CONSOLIDADA
const analiseIA = await base44.integrations.Core.InvokeLLM({
  prompt: `Analise estas conversas B2B...`,
  response_json_schema: {
    type: "object",
    properties: {
      topics: { type: "array", items: { 
        type: "object", 
        properties: { 
          name: { type: "string" }, 
          weight: { type: "number" } 
        }
      }},
      objections: { type: "array", items: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { type: "string", enum: ["preco", "prazo", "condicao_pagamento", "produto", "outro"] },
          severity: { type: "string", enum: ["baixa", "media", "alta"] },
          unlock_hint: { type: "string" }
        }
      }},
      sentiment_current: { type: "number" },
      sentiment_trend: { type: "string", enum: ["melhorando", "estavel", "piorando"] }
    }
  }
});

payload.topics = analiseIA.topics.slice(0, 5);
payload.objections = analiseIA.objections.slice(0, 3);
payload.metrics.sentiment_current = analiseIA.sentiment_current;
payload.metrics.sentiment_trend = analiseIA.sentiment_trend;
```

### Etapa E: Scorecards (0-100)

```javascript
// HEALTH SCORE = sentimento (40%) + responsividade (30%) + ausência fricção (30%)
const health = Math.round(
  (payload.metrics.sentiment_current * 0.4) +
  (normalizarResponsividade(responsiveness) * 0.3) +
  (!friccao.has_friction ? 30 : 0)
);

// DEAL RISK = dias parado (max 40) + follow-ups (max 30) + objeções altas (max 30)
const deal_risk = Math.min(100, Math.round(
  Math.min(40, stage.days_stalled * 10) +
  Math.min(30, responsiveness.unanswered_followups * 10) +
  Math.min(30, payload.objections.filter(o => o.severity === 'alta').length * 15)
));

// BUY INTENT = sinais de intenção × confiança
const buy_intent = calcularBuyIntent(normalized, analiseIA);

// ENGAGEMENT = volume + reciprocidade + regularidade
const engagement = calcularEngagement(normalized, responsiveness);

payload.scores = { health, deal_risk, buy_intent, engagement };
```

### Etapa F: Recomendações + Alertas

```javascript
// ALERTAS
const alerts = [];
if (responsiveness.unanswered_followups >= 3) {
  alerts.push({ level: "alto", reason: "3+ follow-ups sem resposta do cliente" });
}
if (stage.days_stalled > 3 && stage.current === 'negociacao') {
  alerts.push({ level: "alto", reason: "Negociação parada >3 dias" });
}
if (friccao.has_friction) {
  alerts.push({ level: "medio", reason: friccao.reasons.join(", ") });
}

// HANDOFF
const need_manager = (deal_risk > 70 && buy_intent > 50) || 
                     (health < 40 && buy_intent > 60);

const handoff = 
  need_manager && friccao.has_friction ? "co_atendimento_gerente" :
  health < 30 && responsiveness.unanswered_followups > 5 ? "trocar_responsavel" :
  "manter";

// AÇÃO RECOMENDADA
const action = await gerarAcaoIA(payload) || fallbackAction(stage, scores);

payload.alerts = alerts;
payload.next_best_action = {
  action: action.text,
  deadline_hours: action.prazo_horas,
  message_suggestion: action.template,
  need_manager,
  handoff
};
```

---

## 📦 MVP (V1) - Escopo Mínimo

### Backend (analisarComportamentoContato.js)

**Retorno:**
```javascript
{
  scope: { mode, start, end, threads, messages, limited_by_visibility },
  scores: { health, deal_risk, buy_intent, engagement },
  stage: { current, days_stalled },
  topics: [...], // top 5
  objections: [...], // top 3
  alerts: [...],
  next_best_action: { action, deadline_hours, message_suggestion, need_manager, handoff }
}
```

### Frontend (SegmentacaoInteligente.jsx)

**Componentes:**
1. **4 Cards de Score** (health, deal_risk, buy_intent, engagement)
2. **Card de Estágio** (current + days_stalled)
3. **Lista de Objeções** (severity + unlock_hint)
4. **Caixa de Alertas** (level + reason)
5. **Card de Ação** (action + message_suggestion + botão copiar)

---

## 🎯 Regras de Alertas (Gatilhos)

| Condição | Level | Reason |
|----------|-------|--------|
| `unanswered_followups >= 3` | alto | "3+ follow-ups sem resposta" |
| `days_stalled > 3 && stage === 'negociacao'` | alto | "Negociação parada >3 dias" |
| `sentiment_current < 40 && has_friction` | alto | "Sentimento negativo + fricção" |
| `friccao.has_friction` | medio | frases de corte detectadas |
| `buy_intent > 70 && days_stalled > 2` | medio | "Oportunidade quente esfriando" |

---

## 📝 Funções Auxiliares

```javascript
// Limpar texto (remove assinaturas)
function cleanText(text) {
  return text.replace(/~\s*[\w\s]+\s*\([^)]+\)/g, '').trim();
}

// Calcular tempo médio de resposta
function calcularTempoResposta(msgs, from, to) {
  let total = 0, count = 0;
  for (let i = 1; i < msgs.length; i++) {
    if (msgs[i].role === to && msgs[i-1].role === from) {
      total += (msgs[i].ts - msgs[i-1].ts);
      count++;
    }
  }
  return count > 0 ? Math.round(total / count / (1000 * 60)) : null;
}

// Contar follow-ups consecutivos
function countFollowUpsConsecutivos(msgs) {
  let max = 0, current = 0;
  for (const msg of msgs) {
    if (msg.role === 'EMPRESA') {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

// Calcular dias parado
function calcularDiasParado(msgs, estagio) {
  const ultimaProgressao = msgs.reverse().find(m => 
    detectouMudancaEstagio(m, estagio)
  );
  if (!ultimaProgressao) return 0;
  return Math.floor((Date.now() - ultimaProgressao.ts) / (1000 * 60 * 60 * 24));
}
```

---

**Documento mantido por:** Nexus360 Team  
**Última atualização:** 2026-02-05