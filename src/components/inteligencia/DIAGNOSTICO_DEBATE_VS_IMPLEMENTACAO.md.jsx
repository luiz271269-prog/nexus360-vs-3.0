# 📋 Análise: Debate V2 vs Implementação Atual

## 🎯 O QUE FOI DEBATIDO (Essencial)

### 1. JSON ESTRUTURADO (Prompt V2)
```json
{
  "relationship_profile": { type, flags, summary },
  "scores": { health, deal_risk, engagement, buy_intent },
  "stage": { current, days_stalled, last_milestone },
  "root_causes": [{ cause, severity, confidence }],
  "evidence_snippets": [{ timestamp, sender, text, related_cause }],
  "playbook": { goal, rules_of_game, when_to_compete, when_to_decline },
  "next_best_action": { action, priority, rationale, suggested_message },
  "relationship_risk": { level, events[] }
}
```

### 2. PRONTUÁRIO PT-BR (7 Seções)
```
1. Visão geral
2. Necessidades/contexto
3. Estado atual (scores em linguagem natural)
4. Causas principais
5. Oportunidades/sinais positivos
6. Recomendações objetivas
7. Sugestão de mensagem pronta
```

### 3. CACHE NO CONTACT (para automações)
```
relationship_profile_type
relationship_profile_flags
relationship_risk_level
deal_risk_cached
buy_intent_cached
playbook_goal
when_to_compete / when_to_decline
```

### 4. AUTOMAÇÕES POR PLAYBOOK (triggers)
```
when_to_decline → WorkQueue:LOW (revisar depois)
when_to_compete → MessageThread:PRIORITY (invista agora)
high_risk → WorkQueue:REATIVACAO (24h)
deal_risk>70 + engagement<40 → TAG:auto_decline
```

### 5. ESTRATÉGIA DE ENGAJAMENTO (NOVA - ainda não tinha)
```
❌ Converter lista de contatos em ações de VALOR REAL
❌ Independente do conteúdo específico (promoção, cotação, etc)
✅ Hook criativo que "quebra o padrão" e ativa resposta
```

---

## ✅ O QUE JÁ APLICAMOS

| Item | Status | Detalhe |
|------|--------|---------|
| insights_v2 (JSONB) | ✅ | Campo criado em ContactBehaviorAnalysis |
| prontuario_text | ✅ | Campo criado + concatenação em 7 seções |
| relationship_profile | ✅ | Persiste type, flags, summary |
| playbook | ✅ | Persiste goal, rules_of_game, when_to... |
| relationship_risk | ✅ | Persiste level, events[] |
| scores | ✅ | health, deal_risk, engagement, buy_intent |
| root_causes estruturado | ✅ | Persiste com severity e confidence |
| Cache no Contact | ✅ | 15 campos em campos_personalizados |
| Função acionarAutomacoesPorPlaybook | ✅ | 4 regras (decline, compete, risk, tag) |
| **Hook criativo** | ❌ | **FALTA** |

---

## ❌ GAPS CRÍTICOS AINDA ABERTOS

### GAP 1: Hook Criativo não existe
**Problema:** Temos a análise perfeita, mas não sabemos COMO engajar
- Enviamos mensagem genérica "Dieimis, faz sentido alinharmos..."
- Não quebra padrão, não ativa emoção, não gera urgência
- Taxa de resposta: igual antes

**Solução necessária:** 
- Criar banco de "hooks" por perfil/stage/risk
- Cada mensagem com "gatilho psicológico" diferente
- A/B testing simples de respostas

### GAP 2: Trigger automático de acionarAutomacoesPorPlaybook
**Problema:** Função criada mas não é chamada automaticamente
- analisarComportamentoContato termina, ninguém chama acionarAutomacoesPorPlaybook
- WorkQueueItems nunca são criados
- Automações morrem no código

**Solução necessária:**
- Chamar função ao final de analisarComportamentoContato
- Ou criar automation que monitore ContactBehaviorAnalysis.status = 'ok'

### GAP 3: Filtro em Contatos Inteligentes não explora novo cache
**Problema:** ContatosRequerendoAtencao usa old fields
- Poderia filtrar por "comprador_corporativo_multi_cotacao + price_sensitive"
- Mas só filtra por deal_risk genérico

**Solução necessária:**
- Adicionar filtro por relationship_profile_type
- Adicionar filtro por relationship_risk_level

### GAP 4: Sem conexão Thread ↔ Análise no UI
**Problema:** Abrir conversa, não vejo análise/playbook
- PainelAnaliseContactoCompleto existe mas não é integrado
- Usuário não sabe que existe playbook

**Solução necessária:**
- Integrar painel ao ChatWindow ou ContactInfoPanel
- Mostrar badge "📊 Análise: tipo profile + risk level"

---

## 🔥 ORDEM DE PRIORIDADE (Cirurgias)

### P1 (CRÍTICA): Hook Criativo
**Impacto:** 30-50% aumento em taxa de resposta
**Esforço:** 2-3h
**Dependência:** Nenhuma

### P2 (ALTA): Trigger Automático
**Impacto:** Automações saem do papel
**Esforço:** 30min
**Dependência:** Nenhuma

### P3 (MÉDIA): Filtro melhorado em Contatos Inteligentes
**Impacto:** Priorização mais precisa
**Esforço:** 1h
**Dependência:** P2 (precisa estar rodando)

### P4 (BAIXA): Integração UI no ChatWindow
**Impacto:** Visibilidade para usuários
**Esforço:** 1h
**Dependência:** Nenhuma

---

## 📊 RESUMO DO ESTADO REAL

```
Debate V2 propôs 5 pilares:

✅ 1. JSON estruturado (Implementado)
✅ 2. Prontuário PT-BR (Implementado)
✅ 3. Cache no Contact (Implementado)
✅ 4. Automações por Playbook (Implementado - mas não chamado)
❌ 5. Hook criativo de engajamento (NÃO EXISTE)

→ Resultado: 80% da máquina está montada, mas o "motor" (hook) não funciona
→ Contatos ainda não respondem mais
→ Automações criam tasks que ninguém usa
``