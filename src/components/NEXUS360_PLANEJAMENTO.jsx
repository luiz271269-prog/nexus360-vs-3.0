# NEXUS360 — Documento de Planejamento Estratégico
**Data:** 2026-03-09 | **Versão:** 1.0 | **Status:** Referência oficial

> ⚠️ Qualquer nova função ou mudança deve ser justificada aqui antes de implementar.

---

## 1. INVENTÁRIO REAL — O que existe de verdade

### IA CORE (manter + evoluir)

| Função | Versão | Status | O que faz de verdade |
|---|---|---|---|
| `jarvisEventLoop` | v3.0 | ✅ Ativo | Vigia threads ociosas, lê ContactBehaviorAnalysis, decide: WhatsApp direto (CRÍTICO), alerta interno (ALTO), registra (MÉDIO), ignora (BAIXO). Cooldown 4h. |
| `analisarComportamentoContato` | — | ✅ Ativo | Motor de prontuário: lê histórico de mensagens, calcula engagement, deal_risk, buy_intent, relationship_risk, sugestão de próxima ação. Salva em ContactBehaviorAnalysis. |
| `analisarClientesEmLote` | — | ✅ Ativo | Orquestrador: 3 modos (direto por IDs / priorização / scheduled). Mantém ContactBehaviorAnalysis atualizado. Chama analisarComportamentoContato para cada contato. |
| `acionarAutomacoesPorPlaybook` | — | ✅ Ativo* | Lê resultado do ContactBehaviorAnalysis, aciona WorkQueueItems por regras (decline, compete, risk). *Corrigido hoje: estava falhando silenciosamente com 401. |
| `executarFluxosAgendados` | v2.0 | ✅ Ativo* | Avança FlowExecutions com next_action_at vencido via playbookEngine. *Reescrito hoje: import local quebrado removido. |
| `claudeWhatsAppResponder` | — | ✅ Ativo | Fallback 24/7 quando não há humano, URA ou playbook. Responde com contexto da empresa. |
| `claudeAgendaAgent` | — | ✅ Ativo | Cria/altera/cancela agendamentos via WhatsApp com verificação real de disponibilidade. |
| `processInbound` | — | ✅ Ativo | Pipeline central de entrada: dedup, reset de funnel, roteamento para Agenda IA / Claude / URA / humano. |
| `playbookEngine` | — | ✅ Ativo | Executor de FlowTemplates. Avança steps, envia mensagens, aplica delay. |
| `nexusClassifier` | — | ✅ Ativo | Classifica intenção (vendas/suporte/financeiro/etc) para roteamento. |
| `enviarWhatsApp` | — | ✅ Ativo | Gateway unificado Z-API / W-API / Evolution. |
| `businessIA` | — | ✅ Ativo | Gera insights de funil, receita, engajamento e anomalias operacionais. |
| `gerarSugestoesRespostaContato` | — | ✅ Ativo | Copiloto do atendente: sugere respostas no chat. |

### LEGADO/OBSOLETO (deletar em sequência)

| Função | Motivo |
|---|---|
| `enviarMensagemMassa` | ✅ Deletada hoje — wrapper morto para enviarCampanhaLote |
| `enviarPromocoesLote` | ✅ Deletada hoje — wrapper morto para enviarCampanhaLote |
| Funções em `_OBSOLETAS_PARA_DELETAR.md` | Deletar conforme disponibilidade |
| Diagnósticos antigos (`diagnosticarContatoDuplicado`, `diagnosisWithLLM`, etc.) | Manter apenas se há UI usando |

---

## 2. FLUXO REAL ATUAL — Mensagem entra, o que acontece

```
Cliente manda WhatsApp
        │
        ▼
webhookFinalZapi / webhookWapi
  → Normaliza payload
  → Dedup (whatsapp_message_id)
  → Cria/atualiza Contact + MessageThread
  → Persiste Message
        │
        ▼
processInbound (pipeline central)
  → Reset de promoção se novo ciclo
  → Atualiza ContactEngagementState
  │
  ├─ SE thread.assistant_mode === 'agenda' → claudeAgendaAgent
  │
  ├─ SE humano respondeu < 10min → PARA (humano está presente)
  │
  ├─ SE URA ativa → preAtendimentoHandler
  │  (⚠️ URA: 0 FlowTemplates com is_pre_atendimento_padrao=true → nunca ativa na prática)
  │
  └─ Fallback → claudeWhatsAppResponder (resposta automática)
        │
        ▼
[A cada hora — Scheduled Automation]
analisarClientesEmLote (modo scheduled)
  → Filtra contatos ativos (últimos 90 dias)
  → Para cada contato: chama analisarComportamentoContato
  → Salva prontuário em ContactBehaviorAnalysis
  → Chama acionarAutomacoesPorPlaybook (cria WorkQueueItems)
        │
        ▼
[A cada 30min — Scheduled Automation]
jarvisEventLoop v3.0 (NexusAgentLoop)
  → Busca threads ociosas (último sender = contact, unread > 0)
  → Para cada thread:
    1. Lê ContactBehaviorAnalysis (prontuário)
    2. Decide por priority_score:
       CRÍTICO → WhatsApp direto com suggested_message do prontuário
       ALTO    → Alerta interno para atendente com score + risco
       MÉDIO   → Registra cooldown, sem ação
       BAIXO   → Ignora
    3. Aplica cooldown 4h (jarvis_next_check_after)
  → Orçamentos parados >7d → cria TarefaInteligente
```

### Onde quebra hoje

| Gap | Impacto | Solução |
|---|---|---|
| URA com 0 templates ativos | Nunca faz pré-atendimento automático | Criar 1 FlowTemplate com `is_pre_atendimento_padrao=true` e steps mínimos |
| EventoSistema poucos produtores | Step 1 do Jarvis sempre vazio | Baixo impacto — Jarvis funciona pelo Step 2 (threads) mesmo assim |
| `analisarComportamentoContato` precisa de mensagens | Contatos sem histórico ficam sem prontuário | Já tratado: `analisarClientesEmLote` usa fallback por inatividade |
| `businessIA` não integrado ao loop | Insights de funil existem mas não alimentam decisões do Jarvis | Ver Fase 3 |
| Orçamentos: Jarvis só vê >7d parados | Não analisa TODOS os orçamentos nem perdas | Ver Fase 2 |

---

## 3. COMPARAÇÃO: O QUE O ESTUDO PROPÔS vs REALIDADE ATUAL

| Proposta do Estudo | Status | Delta / O que falta |
|---|---|---|
| Jarvis como "NexusAgentLoop" / núcleo do agente | ✅ Implementado (v3.0) | Nada — está funcionando |
| Consultar ContactBehaviorAnalysis antes de agir | ✅ Implementado | Nada |
| Decisão em 4 níveis (CRÍTICO/ALTO/MÉDIO/BAIXO) | ✅ Implementado | Nada |
| WhatsApp direto para CRÍTICO | ✅ Implementado | Precisa monitorar taxa de opt-out |
| Alerta interno para ALTO | ✅ Implementado | Funciona via thread interna do atendente |
| analisarClientesEmLote como fila schedulada | ✅ Implementado | Roda a cada hora |
| acionarAutomacoesPorPlaybook como hook | ✅ Implementado* | *Corrigido hoje |
| executarFluxosAgendados avançando follow-ups | ✅ Implementado* | *Reescrito hoje |
| URA como peça do agente (não paralela) | ❌ Gap real | Nenhum FlowTemplate pré-atendimento ativo |
| Análise de orçamentos (não apenas parados >7d) | ⚠️ Parcial | Jarvis cria tarefa, mas não analisa todo o funil |
| "O que estamos perdendo" (orçamentos perdidos) | ❌ Gap real | Nenhuma função analisa orçamentos rejeitados/vencidos |
| businessIA integrado no ciclo de decisão | ❌ Gap real | businessIA existe mas é isolado (só UI) |
| Um "dono" único das prioridades | ✅ Implementado | jarvisEventLoop v3.0 é o proprietário |
| Regra: nova necessidade → evoluir IA CORE, não criar função nova | ⚠️ Cultural | Precisa ser disciplina de equipe |

---

## 4. ARQUITETURA PROPOSTA (baseada no que já existe)

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS AGENT LOOP                         │
│              (jarvisEventLoop v3.x)                         │
│                                                             │
│  Entrada:  MessageThread (ociosa) + ContactBehaviorAnalysis │
│  Decisão:  priority_score → CRÍTICO/ALTO/MÉDIO/BAIXO        │
│  Saída:    WhatsApp direto | Alerta interno | WorkQueueItem │
│            TarefaInteligente | Nada                         │
└───────────────┬──────────────────────────────┬──────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  MOTOR DE PRONTUÁRIO     │    │  CAMADA DE EXECUÇÃO          │
│  analisarComportamento   │    │                              │
│  Contato                 │    │  playbookEngine              │
│         +                │    │  claudeWhatsAppResponder     │
│  analisarClientesEmLote  │    │  claudeAgendaAgent           │
│  (scheduler)             │    │  enviarWhatsApp (gateway)    │
└──────────────────────────┘    └──────────────────────────────┘
                │
                ▼
┌──────────────────────────┐
│  ACIONADORES PÓS-ANÁLISE │
│  acionarAutomacoesPor    │
│  Playbook                │
│  executarFluxosAgendados │
└──────────────────────────┘
```

### O que NÃO deve ser criado como função nova:
- Qualquer "analisador de orçamentos" → estender `jarvisEventLoop` Step 3
- Qualquer "detector de leads frios" → está em `analisarClientesEmLote` (modo priorização)
- Qualquer "motor de follow-up" → é o `playbookEngine` + `executarFluxosAgendados`
- Qualquer "notificador de atendente" → é o Step 2 do `jarvisEventLoop` (alerta ALTO)

---

## 5. ROADMAP — Em ordem de dependência

### Fase 1 — Faxina (sem nova funcionalidade) 🧹
**Objetivo:** eliminar funções duplicadas e deprecated para o código funcionar limpo.

- [x] Deletar `enviarMensagemMassa` e `enviarPromocoesLote`
- [x] Corrigir `acionarAutomacoesPorPlaybook` (bug 401 silencioso)
- [x] Reescrever `executarFluxosAgendados` (import local quebrado)
- [x] Refatorar `jarvisEventLoop` v3.0 (lê prontuário antes de agir)
- [ ] Executar deleções de `_OBSOLETAS_PARA_DELETAR.md` (revisar se há UI dependente primeiro)

### Fase 2 — "Não Perder Negócio" 💰
**Objetivo:** Jarvis detecta orçamentos e leads perdendo tração, não apenas threads ociosas.

**Como fazer (SEM nova função):** Estender `jarvisEventLoop` Step 3 com:
- Orçamentos em status `negociando` há >3 dias sem atualização → alerta ALTO
- Orçamentos em status `vencido` há <7 dias → WorkQueueItem de reativação
- Leads em `lead_quente` sem mensagem há >24h → priority_score boost no Jarvis

**Pré-requisito:** `analisarClientesEmLote` rodando sem erros (monitorar logs).

### Fase 3 — Visão 360 Completa 🔭
**Objetivo:** businessIA alimenta decisões do Jarvis, não fica isolado.

**Como fazer (SEM nova função):** 
- No início de cada ciclo do Jarvis, invocar `businessIA` com action `get_anomalies`
- Se houver anomalia crítica (ex: taxa de conversão caiu 30%), elevar threshold de alerta → mais alertas internos naquele dia
- Resultado: o agente ajusta sensibilidade automaticamente com a saúde do negócio

### Fase 4 — URA Ativa 📞
**Objetivo:** pré-atendimento automático para classificar setor ANTES de acionar humano.

**Como fazer (sem código novo):**
- Criar 1 `FlowTemplate` com `is_pre_atendimento_padrao=true` e 3 steps básicos:
  1. Saudação + botões de setor (Vendas / Suporte / Financeiro)
  2. Roteamento para fila certa
  3. Confirmação + estimativa de atendimento
- `processInbound` já tem o hook para detectar e chamar esse template

### Fase 5 — Orquestração Central de Prioridades 🎯
**Objetivo:** Apenas 1 lugar decide quem é atendido primeiro.

**Como fazer:**
- `jarvisEventLoop` expõe um endpoint `GET /priorities` que retorna a fila ordenada
- A UI de `ContatosInteligentes` consome esse endpoint em vez de calcular sua própria prioridade
- Elimina a duplicação de lógica de priorização entre Jarvis e `analisarClientesEmLote` (modo priorização)

---

## 6. REGRAS DE GOVERNANÇA

### Antes de criar qualquer função nova, verificar:
1. O `jarvisEventLoop` pode fazer isso como novo Step?
2. O `analisarComportamentoContato` pode retornar esse dado?
3. O `playbookEngine` + um FlowTemplate resolve?
4. O `businessIA` já calcula isso?

### Módulos IA CORE (não mexer sem justificativa aqui):
- `jarvisEventLoop`
- `analisarComportamentoContato`
- `analisarClientesEmLote`
- `processInbound`
- `playbookEngine`
- `claudeWhatsAppResponder`
- `claudeAgendaAgent`
- `enviarWhatsApp`

### Critério para novo módulo:
> Só se o caso de uso não couber em nenhum IA CORE existente E for documentado aqui primeiro.

---

## 7. MÉTRICAS DE SUCESSO DO AGENTE

O agente está funcionando bem quando:

| Métrica | Target |
|---|---|
| Contatos com prontuário atualizado (<24h) | >80% dos leads/clientes ativos |
| Threads com unread_count>0 sem alerta >4h | <5% do total |
| Orçamentos `negociando` >3d sem toque | 0 sem WorkQueueItem gerado |
| Taxa de follow-up WhatsApp automático | Monitorar opt-out (alvo: <2%) |
| AgentRun com status `falhou` | <5% no último ciclo |

---

*Este documento é atualizado a cada mudança arquitetural significativa.*