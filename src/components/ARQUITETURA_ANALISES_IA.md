# 🧠 ARQUITETURA DE ANÁLISES IA — DUAL MOTOR

## 📋 SEPARAÇÃO CLARA DOS DOIS MOTORES

### **Motor A — Análise de CONTATO (Perfil & Comportamento)**
**Objetivo:** Entender o "jeito" do contato ao longo do tempo  
**Foco:** Macro, padrão comportamental, risco relacional  
**Entrada:** 50-200 mensagens (últimas semanas/meses)  
**Saída:** Perfil + Score + Sinais + Riscos (SEM mensagem pronta)  
**Função:** `analisarComportamentoContato`  
**Entidade:** `ContactBehaviorAnalysis`  
**UI:** Aba "Perfil & Comportamento" no `PainelAnaliseContatoIA`

**Campos retornados:**
- `relationship_profile` (tipo, flags, summary)
- `scores` (health, deal_risk, buy_intent, engagement)
- `stage` (current, days_stalled, last_milestone)
- `root_causes[]` (motivos de travamento/perda)
- `evidence_snippets[]` (trechos evidência)
- `objections[]` (objeções ativas)
- `alerts[]` (alertas críticos)
- `playbook` (goal, rules, when_to_compete/decline)
- `next_best_action` (ação, prioridade, rationale)
- `relationship_risk` (level, events)
- `prontuario_ptbr` (visão geral, necessidades, recomendações)
- `metricas_relacionamento` (ratio, velocidade, gaps)

---

### **Motor B — Análise de ASSUNTOS (Topics & Contexto)**
**Objetivo:** Organizar a conversa em assuntos e analisar cada um  
**Foco:** Micro, contexto por tópico, sentimento por trecho  
**Entrada:** 50 mensagens COMPLETAS (sem otimização)  
**Saída:** Topics + Timeline + Sentimento + Pendências + Risco (SEM mensagem pronta)  
**Função:** `analisarAssuntosContato`  
**Entidade:** `TopicAnalysis`  
**UI:** Aba "Assuntos & Contexto" no `PainelAnaliseContatoIA`

**Campos retornados (por assunto):**
- `topic` (nome do assunto: SSD, Carregador Mac, NF ICMS)
- `status` (aberto, andamento, fechado, perdido, ganho)
- `context_summary` (resumo executivo 2-3 linhas)
- `timeline[]` (marcos: pedido → negociação → pressão → confirmação)
- `sentiment_summary` (current, trend, intensity)
- `sentiment_events[]` (mudanças de sentimento com evidência)
- `key_facts[]` (valores, quantidades, prazos, condições)
- `open_loops[]` (pendências com owner: cliente/vendedor/interno/fornecedor)
- `risk` (level + reasons)
- `recommended_next_steps[]` (ações sem mensagem)

---

## 🎯 QUANDO USAR CADA MOTOR

| Situação | Motor | Por quê |
|----------|-------|---------|
| Ver histórico/padrão do contato | **Motor A** | Perfil macro, comportamento geral |
| Entender "como é" o cliente | **Motor A** | Flags: price_sensitive, formal, benchmark |
| Avaliar risco de churn/perda | **Motor A** | Saúde relação, deal_risk, buy_intent |
| Ver cronologia de assuntos | **Motor B** | Timeline por topic, marcos |
| Entender sentimento em negociações | **Motor B** | Mudanças: neutro → pressão → ameaça |
| Rastrear pendências | **Motor B** | Open loops (de quem é a bola) |
| Diagnóstico de perda de deal | **Motor B** | Evidências por assunto, risco específico |

---

## 🚫 O QUE **NÃO** FAZ

### Motor A **NÃO** gera:
- ❌ Mensagens prontas por playbook
- ❌ Respostas rápidas "clique para usar"
- ✅ Apenas análise + recomendações de ação

### Motor B **NÃO** gera:
- ❌ Mensagens prontas por assunto
- ❌ Sugestões de resposta
- ✅ Apenas contexto + timeline + sentimento + pendências

---

## 📱 TERCEIRO SISTEMA: Sugestões de Resposta (separado)

**Função:** `gerarSugestoesRespostaContato`  
**Objetivo:** Gerar respostas rápidas (formal/amigável/objetiva)  
**Entrada:** 8-12 mensagens úteis (otimizado)  
**Saída:** 3 sugestões prontas para usar  
**UI:** `SugestorRespostasRapidas` (botão IA no chat)

**Diferença crítica:**
- Motor A/B: análise profunda (50 msgs) → contexto/diagnóstico
- Sugestões: análise rápida (8-12 msgs) → copy-paste pronto

**Cache:**
- Motor A/B: sem cache (sempre completo)
- Sugestões: cache 15min (performance)

---

## 📊 EXEMPLOS PRÁTICOS

### Exemplo 1: Fernando — Carregador Mac
**Motor A (Perfil):**
- Tipo: `comprador_corporativo_multi_cotacao`
- Flags: `price_sensitive`, `deadline_sensitive`, `decision_by_third_party`
- Health: 45% | Deal Risk: 60% | Buy Intent: 30%
- Risk Level: **medium**
- Playbook: quando competir (urgência real), quando declinar (multi-cotação pura)

**Motor B (Assuntos):**
```json
{
  "topics": [
    {
      "topic": "Carregador / Fonte americana Mac",
      "status": "andamento",
      "timeline": [
        { "timestamp": "06/02 10:30", "event": "problema_identificado", "snippet": "equipamento com padrão americano" },
        { "timestamp": "06/02 11:00", "event": "pressao_interna", "snippet": "querendo devolver, apagar incêndio" },
        { "timestamp": "09/02 14:00", "event": "troca_fotos", "snippet": "confusão de modelos" }
      ],
      "sentiment_summary": {
        "current": "negativo",
        "trend": "piorando",
        "intensity": 75
      },
      "sentiment_events": [
        { "timestamp": "06/02 11:00", "sentiment": "ameaca", "target": "voce_vendedor", "snippet": "querendo devolver" },
        { "timestamp": "06/02 15:00", "sentiment": "pressao", "target": "situacao", "snippet": "ganhar férias forçadas" }
      ],
      "open_loops": [
        { "pending": "Confirmar peça correta + prazo real", "owner": "vendedor", "since": "2026-02-09" },
        { "pending": "Rastreio da entrega", "owner": "fornecedor", "since": "2026-02-10" }
      ],
      "risk": {
        "level": "high",
        "reasons": ["Risco devolução", "Pressão interna cliente", "Confusão técnica"]
      },
      "recommended_next_steps": [
        "Confirmar modelo com foto",
        "Informar prazo realista com rastreio",
        "Backup: cotação fornecedor alternativo"
      ]
    },
    {
      "topic": "SSD — negociação e perda",
      "status": "perdido",
      "sentiment_summary": { "current": "neutro", "trend": "estavel", "intensity": 40 },
      "risk": { "level": "low", "reasons": [] },
      "recommended_next_steps": [
        "Registrar perdido por preço/concorrência",
        "Gatilho reativação se preço cair 10%"
      ]
    }
  ]
}
```

---

## 🔄 FLUXO DE USO NA UI

1. **Usuário abre detalhes do contato**
   - Aba "IA" → 2 sub-abas: "Perfil" e "Assuntos"

2. **Aba Perfil:**
   - Carrega `ContactBehaviorAnalysis` (última análise)
   - Mostra: prontuário, scores, métricas, causas
   - Botão "Reanalisar" → chama `analisarComportamentoContato`

3. **Aba Assuntos:**
   - Carrega `TopicAnalysis` (última análise)
   - Mostra: cards por assunto (timeline, sentimento, pendências, risco)
   - Botão "Reanalisar" → chama `analisarAssuntosContato`

4. **No chat (sugestões rápidas):**
   - Botão "IA" → `SugestorRespostasRapidas`
   - Chama `gerarSugestoesRespostaContato` (8-12 msgs úteis)
   - 3 opções: formal, amigável, objetiva

---

## ⚙️ CONFIGURAÇÃO TÉCNICA

### Motor A
```javascript
await base44.functions.invoke('analisarComportamentoContato', {
  contact_id: '123',
  limit: 50 // ou 100/200
});
```

### Motor B
```javascript
await base44.functions.invoke('analisarAssuntosContato', {
  contact_id: '123',
  limit: 50 // SEMPRE 50 mensagens completas
});
```

### Sugestões
```javascript
await base44.functions.invoke('gerarSugestoesRespostaContato', {
  thread_id: 'abc',
  contact_id: '123',
  limit: 50, // otimiza internamente para 8-12
  tones: ['formal', 'amigavel', 'objetiva']
});
```

---

## 🎯 PRINCÍPIOS DE DESIGN

1. **Motor A** = "Quem é esse cliente?"
2. **Motor B** = "O que está acontecendo?"
3. **Sugestões** = "O que responder agora?"

4. **Separação clara:**
   - Análise profunda (A+B) → sem mensagens prontas
   - Sugestões rápidas → com mensagens prontas

5. **Performance:**
   - Motor A/B: execução sob demanda (botão "Reanalisar")
   - Sugestões: cache 15min + otimização de mensagens

6. **Dados completos:**
   - Motor B não filtra mensagens úteis — mantém TODAS as 50
   - Necessário para timeline e contexto de assuntos

---

## 📝 ROADMAP DE MELHORIAS

### P1 (Imediato)
- ✅ Entidade `TopicAnalysis` criada
- ✅ Função `analisarAssuntosContato` criada
- ✅ UI com 2 abas (Perfil + Assuntos)
- ✅ Botão reanalisar por aba

### P2 (Próximo)
- [ ] Auto-análise de assuntos ao enviar/receber mensagem
- [ ] Badge "novo assunto detectado"
- [ ] Timeline visual (linha do tempo gráfica)
- [ ] Exportar prontuário completo (PDF)

### P3 (Futuro)
- [ ] Comparação de sentimento entre assuntos
- [ ] Alertas de assuntos críticos (dashboard)
- [ ] Busca semântica por assunto
- [ ] Merge de assuntos duplicados

---

**Status:** ✅ Arquitetura implementada e funcional  
**Última revisão:** 13/02/2026