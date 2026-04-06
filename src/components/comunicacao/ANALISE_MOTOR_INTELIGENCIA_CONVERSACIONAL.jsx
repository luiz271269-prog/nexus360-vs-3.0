# 🧠 Análise: Motor de Inteligência Conversacional

**Data:** 2026-02-05  
**Objetivo:** Comparar estudo teórico "Motor de Inteligência Conversacional" vs implementação atual

---

## 📋 VISÃO GERAL DO ESTUDO

### Objetivo do Sistema
Gerar "painel de saúde comercial" para atendente baseado em conversas, incluindo:
- ✅ Risco de perder negociação
- ✅ Qualidade do relacionamento
- ✅ Intenção de compra e estágio do funil
- ✅ Objeções e temas recorrentes
- ✅ Próximos passos acionáveis

---

## 🔍 ANÁLISE POR ETAPA DO PIPELINE

### Etapa A — Definir Escopo de Conversa

| Aspecto | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **Escopo "Bolha"** | Threads na sidebar + aberta | ❌ Não implementado | 🔴 **FALTA** |
| **Escopo "Histórico"** | Período X dias | ✅ `periodo_dias` (7-90) | ✅ **OK** |
| **Parâmetros aceitos** | `mode`, `sidebar_thread_ids`, `active_thread_id` | Apenas `periodo_dias` | ⚠️ **PARCIAL** |
| **Saída estruturada** | `thread_ids[]`, `start/end`, `messages[]` | ✅ Implementado | ✅ **OK** |

**Conclusão Etapa A:** ⚠️ Modo "histórico" OK, falta modo "bolha" (escopo operacional).

---

### Etapa B — Normalizar Mensagens

| Aspecto | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **role: CLIENTE/EMPRESA** | Normalizado | ✅ `sender_type: contact/user` | ✅ **OK** |
| **type** | text/audio_transcript/image_caption | ✅ `media_type` + análise visual | ✅ **SUPERIOR** |
| **text limpo** | Remove assinaturas | ❌ Não remove assinaturas | ⚠️ **FALTA** |
| **timestamp** | Normalizado | ✅ `created_date` | ✅ **OK** |

**Conclusão Etapa B:** ✅ Normalização OK, falta apenas limpeza de assinaturas (~Nome setor).

---

### Etapa C — Extrair Métricas Determinísticas

#### C.1 Engajamento e Ritmo

| Métrica | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **total mensagens** | ✅ | ✅ `total_mensagens` | ✅ **OK** |
| **msgs/dia por lado** | ✅ | ✅ `mensagens_enviadas`, `mensagens_recebidas` | ✅ **OK** |
| **tempo resposta empresa** | ✅ | ✅ `tempo_medio_resposta_minutos` | ✅ **OK** |
| **tempo resposta cliente** | ✅ | ❌ Não calcula separado | ⚠️ **FALTA** |
| **taxa sem retorno** | ✅ | ⚠️ Usa `taxa_resposta` (inverso) | ⚠️ **IMPLÍCITO** |
| **horários/dias ativos** | ✅ | ❌ Não implementado | 🔴 **FALTA** |

#### C.2 Pressão e Atrito

| Métrica | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **follow-ups consecutivos** | ✅ | ❌ Não calcula | 🔴 **CRÍTICO** |
| **cobrança vs ajuda** | ✅ | ❌ Não diferencia | 🔴 **FALTA** |
| **frases de corte** | Lista específica | ⚠️ Implícito em sentimento | ⚠️ **IMPLÍCITO** |

#### C.3 Progresso Operacional

| Métrica | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **estágio atual** | cotação→negociação→aprovado→OC→entrega | ⚠️ Usa `estagio_ciclo_vida` (genérico) | ⚠️ **DIFERENTE** |
| **dias parado no estágio** | ✅ | ❌ Não calcula | 🔴 **CRÍTICO** |

**Conclusão Etapa C:**
- ✅ Métricas básicas OK (total, taxa resposta)
- 🔴 **FALTA:** follow-ups consecutivos (métrica crítica)
- 🔴 **FALTA:** dias parado no estágio (métrica crítica)
- 🔴 **FALTA:** horários/dias ativos

---

### Etapa D — Classificações por IA

#### D.1 Temas/Assuntos (Taxonomia)

| Categoria | Estudo | Implementado | Status |
|-----------|--------|--------------|--------|
| **Taxonomia fixa** | preço, prazo, técnico, suporte, etc | ⚠️ Usa categorias livres em `palavras_chave` | ⚠️ **LIVRE** |
| **Weight por tema** | 0.0-1.0 | ✅ `relevancia_comercial` 0-10 | ✅ **SIMILAR** |

#### D.2 Intenção e Estágio

| Aspecto | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **Intenção** | cotação\|negociar\|comprar\|suporte\|cancelamento | ✅ `intencoes_detectadas` (7 tipos) | ✅ **OK** |
| **Estágio** | descoberta\|consideração\|decisão\|operacional | ✅ `estagio_ciclo_vida` (6 tipos) | ✅ **OK** |

#### D.3 Sentimento

| Aspecto | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **Score 0-100** | ✅ | ✅ `score_sentimento` | ✅ **OK** |
| **Tendência** | melhorando/estável/piorando | ✅ `evolucao_sentimento` | ✅ **OK** |
| **Evidências** | Trechos curtos | ✅ `razoes[]` | ✅ **OK** |

#### D.4 Objeções

| Aspecto | Estudo | Implementado | Status |
|---------|--------|--------------|--------|
| **Lista de objeções** | ✅ | ✅ `objecoes_identificadas` (via IA) | ✅ **OK** |
| **Severidade** | baixa/média/alta | ❌ Não classifica | 🔴 **FALTA** |
| **Como resolver** | "unlock" sugerido | ❌ Não sugere | 🔴 **FALTA** |

**Conclusão Etapa D:**
- ✅ Análise de IA está MUITO BEM implementada
- ✅ Sentimento, intenção, estágio OK
- 🔴 **FALTA:** severidade de objeções
- 🔴 **FALTA:** sugestão de como destravar objeção

---

### Etapa E — Scorecards (0-100)

| Scorecard | Estudo | Implementado | Status |
|-----------|--------|--------------|--------|
| **Health Score** | saúde relacionamento | ⚠️ Implícito em `score_sentimento` | 🟡 **PARCIAL** |
| **Deal Risk** | risco perder negócio | ❌ Não existe | 🔴 **AUSENTE** |
| **Buy Intent** | intenção compra | ⚠️ Binário (alta/média/baixa), não 0-100 | 🟡 **DIFERENTE** |
| **Engagement Score** | engajamento | ✅ `score_engajamento` 0-100 | ✅ **OK** |
| **Account Potential** | potencial parceria | ❌ Não implementado | 🔴 **FALTA** |

**Conclusão Etapa E:**
- ✅ Engagement Score implementado corretamente
- 🔴 **CRÍTICO:** Deal Risk não existe (métrica essencial)
- 🔴 **CRÍTICO:** Health Score não é explícito
- ⚠️ Buy Intent existe mas formato diferente

---

### Etapa F — Recomendações Acionáveis

| Item | Estudo | Implementado | Status |
|------|--------|--------------|--------|
| **1 ação principal** | Com prazo | ✅ `proxima_acao_sugerida` | ✅ **OK** |
| **2-3 ações secundárias** | Lista | ✅ `acoes_prioritarias[]` | ✅ **OK** |
| **Mensagem sugerida** | Template pronto | ❌ Não gera | 🔴 **FALTA** |
| **Decisão gerente/handoff** | Binário + motivo | ❌ Não implementado | 🔴 **CRÍTICO** |

**Conclusão Etapa F:**
- ✅ Recomendações de ação OK
- 🔴 **FALTA:** Template de mensagem pronta
- 🔴 **FALTA:** Lógica de handoff (manter/co-atendimento/trocar)

---

## 🚨 SISTEMA DE ALERTAS

### Alertas de Risco Alto (Estudo)

| Alerta | Implementado | Status |
|--------|--------------|--------|
| **3 follow-ups sem inbound** | ❌ | 🔴 **AUSENTE** |
| **Cliente responde curto 3x após objeção** | ❌ | 🔴 **AUSENTE** |
| **Estágio parado >3 dias** | ❌ | 🔴 **AUSENTE** |
| **Sentimento caiu >20 pontos** | ❌ (não compara períodos) | 🔴 **AUSENTE** |
| **Frases de corte detectadas** | ⚠️ Implícito em sentimento | ⚠️ **IMPLÍCITO** |

**Conclusão Alertas:** 🔴 **SISTEMA DE ALERTAS NÃO EXISTE**

---

## 📊 ESTRUTURA DE SAÍDA

### Formato Recomendado (Estudo)
```json
{
  "scope": { "mode": "bubble", "threads": 3, "messages": 220 },
  "scores": { "health": 72, "deal_risk": 38, "buy_intent": 81, "engagement": 64 },
  "stage": { "current": "negociacao", "days_stalled": 2 },
  "topics": [{ "name": "preco", "weight": 0.8 }],
  "objections": [{ "text": "...", "severity": "alta", "unlock": "..." }],
  "alerts": [{ "level": "alto", "reason": "..." }],
  "next_best_action": { "action": "...", "deadline": "24h", "message_suggestion": "..." }
}
```

### Formato Atual (Implementado)
```json
{
  "analise": { /* ContactBehaviorAnalysis */ },
  "resumo": {
    "segmento": "lead_quente",
    "estagio": "decisao",
    "score": 85,
    "sentimento": "positivo",
    "proxima_acao": "...",
    "tags_atribuidas": []
  }
}
```

**Diferença:** Formato atual é mais "flat" e focado em segmentação. Falta estrutura hierárquica de scores/alertas/objeções.

---

## 📈 MATRIZ DE GAPS (Crítico → Desejável)

### 🔴 P0 - CRÍTICOS (Impedem uso operacional)

1. ❌ **Deal Risk Score** (0-100) - essencial para priorização
2. ❌ **Health Score** explícito - atualmente implícito em sentimento
3. ❌ **Dias parado no estágio** - métrica core de gestão comercial
4. ❌ **Follow-ups consecutivos sem resposta** - indicador #1 de risco
5. ❌ **Sistema de alertas estruturado** - sem isso, insights ficam "escondidos"
6. ❌ **Modo "bubble"** - escopo operacional essencial

### 🟠 P1 - IMPORTANTES (Aumentam eficácia)

7. ⚠️ **Severidade de objeções** (baixa/média/alta)
8. ⚠️ **Sugestão de "unlock"** para cada objeção
9. ⚠️ **Template de mensagem** pronta para enviar
10. ⚠️ **Decisão de handoff** (manter/co-atendimento/trocar)
11. ⚠️ **Tempo resposta do cliente** separado
12. ⚠️ **Limpeza de assinaturas** em mensagens

### 🟡 P2 - DESEJÁVEIS (Refinamento)

13. 🟡 **Horários/dias mais ativos**
14. 🟡 **Account Potential Score**
15. 🟡 **Taxonomia fixa de temas** (vs livre)
16. 🟡 **Comparação entre períodos** (evolução temporal)

---

## 🎯 PLANO DE IMPLEMENTAÇÃO (MVP → Completo)

### MVP - Versão 1 (7 dias) ⚡
**Objetivo:** Scorecards essenciais + alertas básicos

```javascript
// Adicionar ao retorno:
{
  scores: {
    health: calcularHealthScore(sentimento, responsividade, atrito),
    deal_risk: calcularDealRisk(diasParado, objecoes, followUps),
    buy_intent: converterBuyIntent(intencoesDetectadas), // 0-100
    engagement: scoreEngajamento // já existe
  },
  stage: {
    current: estagioVida,
    days_stalled: calcularDiasParado(mensagens, estagioVida)
  },
  alerts: gerarAlertas({
    followUps: countFollowUpsConsecutivos(mensagens),
    diasParado,
    quedaSentimento: compararSentimento(periodoAtual, periodoAnterior)
  })
}
```

**Métricas Críticas:**
- ✅ Health Score = (sentimento × 0.4) + (responsividade × 0.3) + (ausência_atrito × 0.3)
- ✅ Deal Risk = (dias_parado × 20) + (objecoes_altas × 15) + (follow_ups_sem_resposta × 10)
- ✅ Buy Intent = confiança média das intenções "comprar"/"cotacao" × 100
- ✅ Dias Parado = dias desde última mudança significativa de estágio

**Alertas MVP:**
```javascript
const alerts = [];
if (followUpsConsecutivos >= 3) alerts.push({ level: 'alto', reason: '3+ follow-ups sem resposta' });
if (diasParado > 3 && estagioVida === 'negociacao') alerts.push({ level: 'alto', reason: 'Negociação parada >3 dias' });
if (sentimento < 40 && intencoesDetectadas.some(i => i.intencao === 'reclamacao')) {
  alerts.push({ level: 'critico', reason: 'Reclamação + sentimento negativo' });
}
```

---

### Versão 2 (14 dias) 🚀
**Objetivo:** Modo "bubble" + objeções avançadas

```javascript
// Aceitar modo bubble
const { mode = 'period', sidebar_thread_ids = [], active_thread_id } = await req.json();

// Filtrar threads
if (mode === 'bubble') {
  const bubbleIds = new Set([...sidebar_thread_ids, active_thread_id].filter(Boolean));
  threadsScope = threadsVisible.filter(t => bubbleIds.has(t.id));
}

// Classificar objeções
objections: [
  {
    text: "condição 30/60/90 inviável",
    severity: "alta",
    unlock: "Aprovar parcelamento mantendo valor total",
    confidence: 0.92
  }
]
```

---

### Versão 3 (21 dias) 🎯
**Objetivo:** Handoff inteligente + templates

```javascript
// Lógica de handoff
const handoff = {
  recommendation: calcularHandoff(dealRisk, healthScore, buyIntent),
  reason: gerarRazaoHandoff(),
  suggested_manager: sugerirGerente(perfil_cliente, segmento)
};

// Template de mensagem
next_best_action: {
  action: "Validar condição e fechar",
  deadline: "24h",
  message_suggestion: gerarTemplateMensagem(contexto),
  requires_manager: dealRisk > 70 && buyIntent > 60
}
```

---

## 🏆 COMPARAÇÃO FINAL: ESTUDO vs IMPLEMENTADO

### ✅ O QUE JÁ ESTÁ EXCELENTE

1. 🎉 **Análise consolidada com IA** (superior ao estudo)
2. 🎉 **Análise multimodal de imagens** (não estava no estudo!)
3. ✅ **Segmentação híbrida** (regras + IA)
4. ✅ **Engagement Score** robusto
5. ✅ **Sistema de tags automáticas**
6. ✅ **Detecção de intenções e sentimento**
7. ✅ **Recomendações de ações** (já gera com IA)

### 🔴 O QUE FALTA IMPLEMENTAR (Crítico)

1. ❌ **Deal Risk Score** - métrica essencial ausente
2. ❌ **Health Score explícito** - existe implícito, precisa formalizar
3. ❌ **Dias parado no estágio** - gestão comercial core
4. ❌ **Follow-ups consecutivos** - indicador #1 de atrito
5. ❌ **Sistema de alertas** - insights ficam "escondidos"
6. ❌ **Modo "bubble"** - escopo operacional

### ⚠️ O QUE PRECISA EVOLUIR (Importante)

7. ⚠️ **Severidade de objeções** + sugestão de unlock
8. ⚠️ **Template de mensagem** pronta
9. ⚠️ **Decisão de handoff** estruturada
10. ⚠️ **Buy Intent em 0-100** (hoje é categórico)

---

## 📝 NOTA FINAL

### Score: 7.0/10

**Pontos Fortes:**
- ✅ Base de análise de IA é **excelente**
- ✅ Multimodalidade é **diferencial competitivo**
- ✅ Segmentação está **robusta**
- ✅ Busca de mensagens está **correta** (problema raiz resolvido)

**Pontos de Atenção:**
- 🔴 **Faltam scorecards críticos** (Deal Risk, Health Score explícito)
- 🔴 **Faltam métricas de risco** (follow-ups, dias parado)
- 🔴 **Falta sistema de alertas** (insights não ficam visíveis)
- 🔴 **Falta modo "bubble"** (escopo operacional)

**Recomendação:**
> Implementação atual tem FUNDAÇÃO EXCELENTE, mas **precisa de camada de scorecards + alertas para ser operacionalmente útil**. MVP (7 dias) resolve 80% dos gaps críticos.

---

## 📚 Próximos Passos

1. **Imediato (P0):** Implementar MVP com scorecards essenciais + alertas básicos
2. **Curto prazo (P1):** Modo "bubble" + objeções avançadas
3. **Médio prazo (P2):** Handoff inteligente + templates de mensagem
4. **Longo prazo (P3):** Account Potential + comparação temporal

---

**Documento gerado em:** 2026-02-05  
**Baseado em:** Estudo "Motor de Inteligência Conversacional" vs `analisarComportamentoContato.js