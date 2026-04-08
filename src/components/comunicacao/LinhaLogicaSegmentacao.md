# LINHA LÓGICA - Segmentação Inteligente (DO CLIQUE ATÉ OS RESULTADOS)

## FLUXO VISUAL COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 0: ESTADO INICIAL (SegmentacaoInteligente Component)                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • analise = null                                                                    │
│ • payload = null                                                                    │
│ • loading = false                                                                   │
│ • analisando = false                                                                │
│ • periodoDias = 30 (default)                                                        │
│ • modeAtual = "period" (padrão)                                                     │
│ • Renderiza: "Nenhuma análise disponível ainda"                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 1: USUÁRIO INTERAGE                                                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 1️⃣ Seleciona período (7, 15, 30, 60, 90 dias)                                        │
│    setPeriodoDias(dias) → estado atualizado                                          │
│                                                                                      │
│ 2️⃣ Seleciona modo (Period ou Conversas Visíveis)                                     │
│    setModeAtual("period" ou "bubble")                                                │
│                                                                                      │
│ 3️⃣ CLICA NO BOTÃO: "Analisar Últimos 30 Dias"                                        │
│    onClick={analisarComportamento}                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 2: VALIDAÇÃO INICIAL                                                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ • setAnalisando(true)                                                                │
│ • Verifica: mode === "bubble" ✓ Há visibleThreadIds?                                │
│ • Se SIM: continua                                                                  │
│ • Se NÃO: toast.error() e sai (guardrail)                                           │
│ • Mostra toast.loading("🤖 IA analisando...")                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 3: MONTAR PAYLOAD PARA BACKEND                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ payload = {                                                                          │
│   contact_id: "abc123",                                                             │
│   mode: "period",                                                                   │
│   active_thread_id: null,                                                           │
│   periodo_dias: 30,  // ← SE mode === "period"                                      │
│   visible_thread_ids: [...],  // ← SE mode === "bubble"                             │
│ }                                                                                    │
│                                                                                      │
│ resultado = await base44.functions.invoke('analisarComportamentoContato', payload)  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 4: BACKEND PROCESSA (analisarComportamentoContato function)                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Busca mensagens dos últimos 30 dias:                                             │
│    Message.filter({ thread_id: in(visibleThreadIds), sent_at >= now-30d })          │
│                                                                                      │
│ 2. Análise Determinística (sem IA):                                                 │
│    • Total mensagens: count()                                                       │
│    • Mensagens recebidas vs enviadas                                                │
│    • Frequência: days between messages                                              │
│    • Tempo médio resposta: avg((sent_at - prev_received_at))                        │
│    • Taxa resposta: (respostas / follow-ups)                                        │
│    • Follow-ups sem resposta: streak count                                          │
│    • Dias desde último inbound                                                      │
│                                                                                      │
│ 3. Análise IA - MOTOR COMPLETO:                                                     │
│    ✓ Análise de Sentimento (transformers)                                           │
│    ✓ Extração de Intenções (NLU)                                                    │
│    ✓ Palavras-chave comerciais (TF-IDF)                                             │
│    ✓ Detecção de Padrões Comportamentais (regras + IA)                              │
│    ✓ Geração de Scores:                                                             │
│      - Health (saúde da relação)                                                    │
│      - Deal Risk (risco de perda)                                                   │
│      - Buy Intent (intenção de compra)                                              │
│      - Engagement (engajamento)                                                     │
│    ✓ Segmentação (lead_frio/morno/quente, cliente_ativo/inativo, risco_churn)      │
│    ✓ Estágio no Funil + Dias Parado                                                 │
│    ✓ Alertas Críticos:                                                              │
│      - Deal Risk > 70 → CRÍTICO                                                     │
│      - Health < 30 → CRÍTICO                                                        │
│      - Days Stalled > 7 → ALTO                                                      │
│      - Unanswered Followups > 3 → ALTO                                              │
│    ✓ Próxima Ação Recomendada:                                                      │
│      - action: "Mensagem de re-engajamento"                                         │
│      - deadline_hours: 24                                                           │
│      - message_suggestion: "[template IA]"                                          │
│      - need_manager: boolean                                                        │
│      - handoff: "manter_atual" | "trocar_responsavel" | "co_atendimento"            │
│    ✓ Objeções Detectadas                                                            │
│    ✓ Temas/Tópicos Dominantes                                                       │
│                                                                                      │
│ 4. Retorna para Frontend:                                                           │
│    {                                                                                 │
│      success: true,                                                                 │
│      resumo: {                                                                      │
│        segmento: "lead_quente",                                                     │
│        score: 82,                                                                   │
│        tags_atribuidas: ["produto_X", "alta_conversao"]                             │
│      },                                                                              │
│      payload: {  // ← ESTRUTURA COMPLETA                                            │
│        scores: {                                                                    │
│          health: 75,                                                                │
│          deal_risk: 25,                                                             │
│          buy_intent: 85,                                                            │
│          engagement: 90                                                             │
│        },                                                                            │
│        stage: {                                                                     │
│          current: "negociacao",                                                     │
│          days_stalled: 2                                                            │
│        },                                                                            │
│        alerts: [                                                                    │
│          { level: "medio", reason: "Follow-up aguardando 3 dias" },                 │
│          ...                                                                        │
│        ],                                                                            │
│        next_best_action: { ... },                                                   │
│        objections: [ ... ],                                                         │
│        topics: [ ... ]                                                              │
│      }                                                                               │
│    }                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 5: FRONTEND RECEBE RESPOSTA                                                    │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ if (resultado.data.success) {                                                       │
│   setPayload(payloadData)  // ← TUDO OS DADOS ESTRUTURADOS                          │
│   setAnalise(carregarAnalise())  // ← Busca ContactBehaviorAnalysis persisted       │
│   setTags(carregarTags())  // ← Tags aplicadas pela IA                              │
│   toast.success("✅ Análise concluída!")                                            │
│                                                                                      │
│   // EFEITO COLATERAL: Atualizar prioridade das threads                             │
│   if (score < 30 || segmento === 'risco_churn')                                     │
│     MessageThread.update({ prioridade: 'urgente' })                                 │
│   else if (score > 80 || segmento === 'lead_quente')                                │
│     MessageThread.update({ prioridade: 'alta' })                                    │
│ }                                                                                    │
│ setAnalisando(false)                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                    ⬇️
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ FASE 6: RENDERIZAÇÃO DOS RESULTADOS                                                 │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ NÃO TEM ANÁLISE AINDA                                                                │
│ ├─ Mostra card vazio com ícone ✨                                                    │
│ └─ Botão "Analisar Últimos 30 Dias"                                                 │
│                                                                                      │
│ TEM ANÁLISE (analise !== null)                                                      │
│ ├─ Aviso de Visibilidade Limitada (se aplicável)                                    │
│ │                                                                                    │
│ ├─ 📊 SCORECARDS (4 cards):                                                          │
│ │  ├─ 💚 Saúde: 75/100                                                               │
│ │  ├─ 🔴 Risco: 25/100                                                               │
│ │  ├─ 🎯 Intenção: 85/100                                                            │
│ │  └─ ✨ Engajamento: 90/100                                                         │
│ │                                                                                    │
│ ├─ 📈 Estágio no Funil:                                                              │
│ │  ├─ Badge: "negociacao"                                                           │
│ │  └─ ⏱️ Parado há 2 dias                                                            │
│ │                                                                                    │
│ ├─ ⚠️ Alertas de Risco (se houver):                                                  │
│ │  └─ [Cada alerta colorido por nível: alto=red, medio=yellow, baixo=blue]          │
│ │                                                                                    │
│ ├─ ⚡ Próxima Ação Recomendada:                                                      │
│ │  ├─ Ação: "Enviar mensagem de re-engajamento"                                     │
│ │  ├─ Prazo: 24h                                                                    │
│ │  ├─ 💡 Mensagem Sugerida: "[texto gerado IA]"                                     │
│ │  │  └─ Botão "Copiar Mensagem"                                                    │
│ │  ├─ Badge: "Co-atendimento com gerente" (se need_manager=true)                    │
│ │  └─ Handoff: "Manter Atual" | "Trocar Responsável" | "Co-atendimento"            │
│ │                                                                                    │
│ ├─ 🚨 Objeções Detectadas (se houver):                                               │
│ │  └─ [Cada objeção: texto + severidade + hint para desbloquear]                    │
│ │                                                                                    │
│ ├─ 🏷️ Temas Dominantes:                                                              │
│ │  └─ [Barra de progresso por tema: peso percentual]                                │
│ │                                                                                    │
│ ├─ 🎯 Segmento + Score:                                                              │
│ │  ├─ Badge colorida: "Lead Quente" (orange)                                        │
│ │  ├─ Confiança: 92%                                                                │
│ │  └─ Score Engajamento: 82/100                                                     │
│ │                                                                                    │
│ ├─ 💬 Métricas de Engajamento:                                                       │
│ │  ├─ Total Mensagens: 47                                                           │
│ │  ├─ Taxa Resposta: 78.5%                                                          │
│ │  ├─ Tempo Médio Resposta: 120 min                                                 │
│ │  └─ Frequência: A cada 0.8 dias                                                   │
│ │                                                                                    │
│ ├─ 😊 Análise de Sentimento:                                                         │
│ │  ├─ Predominante: "Positivo"                                                      │
│ │  ├─ Score: 72/100 (visual progress bar)                                           │
│ │  └─ Evolução: ⬆️ Melhorando                                                        │
│ │                                                                                    │
│ ├─ 🧠 Intenções Detectadas:                                                          │
│ │  └─ [Top 5 intenções com confiança %]                                             │
│ │     Ex: "compra" (95%), "negociação" (87%), etc                                  │
│ │                                                                                    │
│ ├─ 🎨 Insights Visuais (de imagens):                                                 │
│ │  └─ [Lista de insights extraídos de imagens enviadas]                             │
│ │                                                                                    │
│ ├─ 🔄 Padrões Comportamentais:                                                       │
│ │  └─ [Padrões detectados + impacto: ✅ positivo | ⚠️ negativo]                      │
│ │                                                                                    │
│ ├─ 🏷️ Tags Aplicadas (pela IA):                                                      │
│ │  └─ [Badges com tags automáticas + ícone 🧠 se origem=ia]                         │
│ │                                                                                    │
│ └─ 📝 Palavras-Chave Comerciais:                                                     │
│    └─ [Top 10 palavras com frequência e relevância]                                 │
│       Cores: Orange (alta relevância) | Yellow (média) | Gray (baixa)               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## MAPEAMENTO: O QUE CADA RESULTADO SIGNIFICA

### 🟢 **SCORES (0-100)**

| Score | O Quê | O Que Significa | Quando Agir |
|-------|-------|-----------------|------------|
| **Health** | Saúde da Relação | Frequência + Sentimento + Engajamento | <30: relação deteriorando |
| **Deal Risk** | Risco de Perda | Padrão de abandono + score baixo + dias parado | >70: em risco imediato |
| **Buy Intent** | Intenção Compra | Palavras-chave + intenções detectadas + sentimento positivo | >80: momento de oferta |
| **Engagement** | Engajamento Geral | Mensagens + taxa resposta + frequência | <40: cliente dormindo |

---

### 🟡 **ALERTAS**

Sinais de perigo/oportunidade. Níveis:
- **CRÍTICO** (vermelho): Ação imediata hoje
- **ALTO** (laranja): Ação dentro de 24h
- **MÉDIO** (amarelo): Ação dentro de 3 dias
- **BAIXO** (azul): Ação dentro de 1 semana

---

### ⭐ **PRÓXIMA AÇÃO RECOMENDADA**

A IA sugere exatamente o que fazer:
- **action**: "Enviar mensagem de re-engajamento" (ou outra)
- **deadline_hours**: Tempo limite para agir
- **message_suggestion**: Cópia/cola pronta
- **need_manager**: Requer escalação?
- **handoff**: Trocar responsável ou manter?

---

### 🏷️ **TAGS AUTOMÁTICAS**

Aplicadas automaticamente pela IA:
- "alta_conversao", "risco_churn", "produto_X", etc.
- Ajudam a filtrar contatos por características

---

## DADOS SALVOS EM DOIS LUGARES

### 1. **ContactBehaviorAnalysis** (Persistido)
- contact_id
- metricas_engajamento (métricas determinísticas)
- analise_sentimento
- intencoes_detectadas
- padroes_comportamentais
- **insights** (payload completo do motor - NOVO)
- ultima_analise (timestamp)

### 2. **MessageThread** (Atualizado)
- prioridade: "urgente" | "alta" | "normal" | "baixa" (baseada no score)
- score_engajamento (cache)
- ultima_analise_comportamento (referência)

---

## O QUE ESTÁ FALTANDO? (Análise Profunda para Clientes em Risco)

Hoje mostra **SINTOMAS**, falta **CAUSAS + PRESCRIÇÃO**:

1. **Histórico de Mudança** (Timeline)
   - Como evoluíram os scores nas últimas 4 semanas?
   - Quando começou a deteriorar?

2. **Comparação com Peers**
   - Este cliente está melhor/pior que a média do segmento?
   - Benchmarking

3. **Root Cause Analysis (IA)**
   - "Por que deal_risk = 85?"
   - Deve dizer: "Devido a 3 dias sem resposta + 2 objeções não resolvidas + sentimento negativo"

4. **Recomendações Estratégicas** (não só táticas)
   - "Considere re-preço" (se objection = preço)
   - "Transferir para gerente sênior" (se objection = autoridade)
   - "Enviar case study similar" (se hesitação = dúvida técnica)

5. **Ações Sugeridas em Cascata**
   - Ação 1 (hoje): enviar mensagem
   - Ação 2 (amanhã): se sem resposta, chamar
   - Ação 3 (3 dias): se ainda sem resposta, escalou para manager

---

## PRÓXIMOS PASSOS

Para análise **PROFUNDA** de risco, você precisa de:

✅ Componente novo: **AnaliseProfundaClienteRisco** que mostra:
- Timeline de degradação
- Root cause analysis narrativa
- Recomendações estratégicas
- Comparação com benchmarks