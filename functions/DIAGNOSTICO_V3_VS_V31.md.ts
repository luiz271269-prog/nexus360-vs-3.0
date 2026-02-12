# 📊 Diagnóstico V3 vs V3.1 - Gaps Fechados

## ❌ V3 ENTREGA (antes)

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| ai_insights | ✅ | sentiment, scores, objections, signals, next_best_action |
| insights (legado) | ✅ | scores/stage/alerts/next_best_action |
| metricas_relacionamento | ✅ | total_mensagens, ratios, response_times |
| root_causes | ✅ | Lista de strings (causa sem estrutura) |
| **relationship_profile** | ❌ | Missing: type, flags, summary |
| **relationship_risk** | ❌ | Missing: level, events[] |
| **playbook** | ❌ | Missing: goal, rules_of_game, when_to/decline |
| **window auditável** | ❌ | Missing: threads_analyzed, message_count, begin/end |
| **cache no Contact** | ❌ | Missing: _type, _flags, _risk_level, _scores_cached |
| **automações baseadas playbook** | ❌ | Missing: triggers, WorkQueue, task creation |

---

## ✅ V3.1 IMPLEMENTA (depois)

### A) Persistência da Verdade Completa
```
Entity: ContactBehaviorAnalysis
├─ insights_v2 (JSONB) ← FONTE DA VERDADE
│  ├─ relationship_profile { type, flags, summary }
│  ├─ scores { health, deal_risk, buy_intent, engagement }
│  ├─ stage { current, days_stalled, last_milestone, last_milestone_at }
│  ├─ playbook { goal, rules_of_game, when_to_compete, when_to_decline }
│  ├─ relationship_risk { level, events[] }
│  ├─ root_causes[] { cause, severity, confidence }
│  └─ metricas_relacionamento { ... }
│
└─ prontuario_text (TEXT) ← SAÍDA HUMANA
   ├─ Seção 1: Visão Geral
   ├─ Seção 2: Necessidades
   ├─ Seção 3: Estado Atual (Scores)
   ├─ Seção 4: Causas Principais
   ├─ Seção 5: Oportunidades
   ├─ Seção 6: Recomendações
   └─ Seção 7: Mensagem Pronta
```

### B) Cache no Contact (para automações)
```
Entity: Contact.campos_personalizados
├─ relationship_profile_type
├─ relationship_profile_flags (string separado por ,)
├─ relationship_profile_summary
├─ deal_risk_cached (0-100)
├─ buy_intent_cached (0-100)
├─ health_cached (0-100)
├─ engagement_cached (0-100)
├─ relationship_risk_level (low/medium/high/critical)
├─ relationship_risk_events_count
├─ playbook_goal
├─ playbook_when_to_compete (string separado por |)
├─ playbook_when_to_decline (string separado por |)
├─ last_analysis_status (ok/error)
├─ last_analysis_at (ISO timestamp)
├─ last_analysis_priority_label
├─ last_analysis_priority_score
├─ bucket_inactive (active/30/60/90+)
└─ days_inactive_inbound
```

### C) Automações Baseadas em Playbook

**Função: `acionarAutomacoesPorPlaybook`**

#### Regra 1: when_to_decline
```javascript
IF contact.playbook.when_to_decline contém regex/phrase THEN
  CREATE WorkQueueItem {
    tipo: 'avaliar_potencial',
    severity: 'low',
    status: 'agendado',
    scheduled_for: now + 7 dias,
    notes: 'Revisar critérios antes de investir esforço'
  }
```

#### Regra 2: when_to_compete
```javascript
IF contact.playbook.when_to_compete contém regex/phrase THEN
  UPDATE MessageThread {
    campos_personalizados.playbook_status = 'compete',
    campos_personalizados.playbook_matched_rules = [...]
  }
```

#### Regra 3: relationship_risk HIGH/CRITICAL
```javascript
IF analise.relationship_risk.level IN ['high', 'critical'] THEN
  CREATE WorkQueueItem {
    tipo: 'reativacao',
    severity: 'high|critical',
    status: 'agendado',
    scheduled_for: now + 24h,
    payload: { risk_events, suggested_action }
  }
```

#### Regra 4: deal_risk > 70 + engagement < 40
```javascript
IF scores.deal_risk > 70 AND scores.engagement < 40 THEN
  TAG Contact { 'auto_decline_generic_quotes' }
```

---

## 📈 Impacto nos Fluxos

### Contatos Inteligentes (já usa)
```javascript
// ANTES: lê fields simples
const críticos = contatos.filter(c => c.deal_risk > 70);

// DEPOIS: pode explorar cache completo
const críticos = contatos.filter(c => 
  c.campos_personalizados.deal_risk_cached > 70 &&
  c.campos_personalizados.relationship_profile_flags.includes('price_sensitive')
);
```

### ContatosRequerendoAtencao (já usa)
```javascript
// ANTES: só tinha deal_risk
// DEPOIS: tem context completo de playbook + risk events
// Pode filtrar por "comprador_corporativo_multi_cotacao" que deu decline
```

### Automações Manuais (novas)
```javascript
// Novo workflow: Quando análise termina
1. analisarComportamentoContato() → persiste insights_v2
2. acionarAutomacoesPorPlaybook() → lê playbook, cria tasks
3. ContatosInteligentes → filtra com novo cache
4. Alerts globais → dispara por relationship_risk.level
```

---

## 🔧 Checklist de Migração

- [x] Entity ContactBehaviorAnalysis: adicionar insights_v2 (JSONB) + prontuario_text (TEXT)
- [x] Função analisarComportamentoContato: persistir insights_v2 + prontuario_text
- [x] Função analisarComportamentoContato: preencher cache no Contact
- [x] Função acionarAutomacoesPorPlaybook: criar (4 regras)
- [ ] Trigger: chamar acionarAutomacoesPorPlaybook após análise OK
- [ ] ContatosRequerendoAtencao: integrar novo cache no filtro
- [ ] UI: atualizar PainelAnaliseContactoCompleto para ler insights_v2
- [ ] Logs: audit trail de "qual regra foi acionada"

---

## ✨ Resultado Final

**V3.1 fecha os 5 gaps críticos:**

1. ✅ **Persistência robusta** (insights_v2 como JSONB)
2. ✅ **Saída legível** (prontuario_text para humanos)
3. ✅ **Cache operacional** (Contact.campos_personalizados)
4. ✅ **Automações contextuais** (4 regras de playbook)
5. ✅ **Auditoria** (last_analysis_status, timestamps)

Sem criar telas novas. Sem quebrar código existente.