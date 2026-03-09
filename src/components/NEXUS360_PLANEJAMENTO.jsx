# NEXUS360 — Plano Estratégico do Agente Autônomo
**Data:** 2026-03-09 | **Versão:** 2.0 DETALHADA | **Status:** Documento de Referência Oficial

> ⚠️ REGRA MÁXIMA: Qualquer nova função ou mudança arquitetural deve ser documentada e justificada aqui ANTES de ser implementada.
> Se a necessidade cabe em um módulo IA CORE existente → estenda-o. Não crie função nova.

---

## PARTE 1 — INVENTÁRIO REAL E ESTADO ATUAL

### 1.1 — Módulos IA CORE (os "órgãos vitais")

---

#### 🧠 `jarvisEventLoop` — v3.0 (NexusAgentLoop)
**O que faz de verdade:**
O loop principal do agente autônomo. Roda como scheduled automation a cada 30 minutos.

**Fluxo interno detalhado:**
```
STEP 1 — EventoSistema
  → Busca EventoSistema com processado=false (limit 20)
  → Para cada evento: cria AgentRun, marca processado=true
  → ⚠️ PROBLEMA: Quase nenhuma função produz EventoSistema → step quase sempre vazio

STEP 2 — Threads Ociosas (CORAÇÃO DO AGENTE)
  → Query: last_message_sender='contact' AND last_message_at < 30min atrás
            AND assigned_user_id existe AND unread_count>0 AND status='aberta'
  → Filtra por cooldown (jarvis_next_check_after) e threshold dinâmico:
      score >= 70 → alerta em 30min (contato quente)
      score 40-70 → alerta em 2h (contato morno)
      score < 40  → alerta em 6h (contato frio)
  → Processa máx 3 threads por ciclo (guard MAX_THREADS_POR_CICLO)
  → Guard de 90s total para não estourar timeout
  
  Para cada thread:
    1. Busca ContactBehaviorAnalysis mais recente (ordem -analyzed_at)
    2. Extrai: priority_score, priority_label, suggested_message, relationship_risk
    3. Se sem análise → usa cliente_score da thread como proxy
    
    DECISÃO por priority_label:
    ┌─────────────────────────────────────────────────────────────────┐
    │ CRÍTICO (score>75):                                             │
    │  → Busca telefone do Contact                                    │
    │  → Chama enviarWhatsApp com suggested_message do prontuário    │
    │  → Salva Message na thread (sender_id='nexus_agent')           │
    │  → Atualiza thread (last_outbound_at, last_message_content)    │
    │  → Se falhar → fallback para ALTO                              │
    │  → Se sem telefone → fallback para ALTO                        │
    ├─────────────────────────────────────────────────────────────────┤
    │ ALTO (score 55-75) + fallback de CRÍTICO:                       │
    │  → Chama getOrCreateInternalThread(assigned_user_id)           │
    │  → Cria Message interna com:                                    │
    │    "⏰ Conversa parada há Xmin | Score Y/100 | Risco Z"        │
    │  → Incrementa unread_by do atendente                           │
    ├─────────────────────────────────────────────────────────────────┤
    │ MÉDIO (score 35-54):                                            │
    │  → Apenas registra cooldown, sem ação visível                  │
    ├─────────────────────────────────────────────────────────────────┤
    │ BAIXO (score < 35):                                             │
    │  → Ignora completamente (contato frio, não gasta recursos)     │
    └─────────────────────────────────────────────────────────────────┘
    
    Após decisão:
    → Salva jarvis_next_check_after = agora + 4h (cooldown)
    → Salva jarvis_last_playbook = ação executada
    → Cria AgentRun para auditoria

STEP 3 — Orçamentos parados >7 dias
  → Query: status='enviado' AND updated_date < 7 dias atrás (limit 10)
  → Para cada: cria TarefaInteligente de follow-up
  → ⚠️ PROBLEMA: só pega 'enviado', não pega 'negociando' nem 'vencido'
```

**Variáveis de controle importantes:**
- `COOLDOWN_HORAS = 4` — contato só recebe 1 alerta a cada 4 horas
- `MAX_THREADS_POR_CICLO = 3` — máximo de threads processadas por ciclo de 30min
- `MAX_CICLO_MS = 90.000ms` — guard de tempo total do ciclo

**Campos que usa no banco:**
- `MessageThread.jarvis_alerted_at` — quando alertou pela última vez
- `MessageThread.jarvis_next_check_after` — quando pode verificar novamente  
- `MessageThread.jarvis_last_playbook` — última ação executada
- `ContactBehaviorAnalysis.priority_score` / `.priority_label` / `.insights_v2.next_best_action.suggested_message`
- `ContactBehaviorAnalysis.relationship_risk.level`

---

#### 🔬 `analisarComportamentoContato` — v3 (Motor de Prontuário)
**O que faz de verdade:**
Gera o "prontuário de inteligência" de um contato. É chamado por `analisarClientesEmLote` e pode ser chamado diretamente da UI.

**Fluxo interno detalhado:**
```
ETAPA A — Busca dados
  → Contact.get(contact_id)
  → MessageThread.filter({contact_id}) → todos os threads do contato

ETAPA B — Busca mensagens
  → Message.filter({thread_id: {$in: threadIds}}, '-sent_at', 100)
  → Inverte para ordem ASC (cronológica)
  → Se sem mensagens → cria ContactBehaviorAnalysis com status='insufficient_data'

ETAPA C — Timestamps e Buckets
  → Calcula: lastMessageAt, lastInboundAt, lastOutboundAt
  → Calcula: daysInactiveTotal, daysInactiveInbound, daysInactiveOutbound
  → Bucket de inatividade (baseado em INBOUND do cliente):
      'active' → inbound < 30 dias
      '30'     → 30-59 dias
      '60'     → 60-89 dias
      '90+'    → 90+ dias

ETAPA D — Métricas Determinísticas (Hard Stats)
  → inboundCount, outboundCount, ratioInOut
  → responseTimesAgent[] — tempo resposta do atendente após mensagem do cliente
  → responseTimesContact[] — tempo resposta do cliente após mensagem do atendente
  → avgReplyMinutesAgent, avgReplyMinutesContact
  → unansweredFollowups — follow-ups enviados sem resposta (últimas 10 msgs)
  → maxSilenceGapDays — maior gap de silêncio em dias
  → conversationVelocity — mensagens/dia no histórico
  → last10Balance — balanço inbound/outbound últimas 10 msgs

ETAPA E — Análise de IA (Semântica) via Claude/GPT
  → Usa textos das últimas 50 mensagens inbound do contato
  → Prompt detalhado pede JSON com:
    - relationship_profile: {type, flags[], summary}
      tipos: comprador_corporativo_multi_cotacao | cliente_fidelizado | lead_quente | suporte_tecnico | financeiro | outro
      flags: price_sensitive | deadline_sensitive | process_formal | decision_by_third_party | uses_benchmark | relationship_frictions
    - scores: {health 0-100, deal_risk 0-100, buy_intent 0-100, engagement 0-100}
    - stage: {current, days_stalled, last_milestone, last_milestone_at}
      estágios: primeiro_contato | cotacao_enviada | negociacao | negociacao_stalled | perdido | ganho
    - root_causes[]: [{cause, severity: low/medium/high/critical, confidence}]
    - evidence_snippets[]: [{timestamp, sender, text, related_cause}]
    - objections[]: [{type: preco/prazo/marca/condicoes_comerciais/processo, status: open/resolved/recurring, snippet}]
    - alerts[]: [{level: info/warning/critical, message}]
    - playbook: {goal, rules_of_game[], when_to_compete[], when_to_decline[]}
    - next_best_action: {action, priority: low/medium/high/urgent, rationale, suggested_message (máx 300 chars)}
    - relationship_risk: {level: low/medium/high/critical, events[]}
    - prontuario_ptbr: {visao_geral, necessidades_contexto, estado_atual_scores, causas_principais, oportunidades_sinais_positivos, recomendacoes_objetivas, mensagem_pronta}

ETAPA F — Cálculo do Priority Score (algoritmo real)
  → inactivityPoints: bucket '30'=10pts | '60'=20pts | '90+'=30pts
  → priorityScore = MIN(100, ROUND(
      inactivityPoints +
      deal_risk * 0.4 +          (risco alto → score alto)
      (100 - buy_intent) * 0.2 + (baixa intenção → score alto)
      (100 - engagement) * 0.2 + (baixo engajamento → score alto)
      MIN(maxSilenceGapDays * 2, 15) (gap silêncio → até 15pts extra)
    ))
  → Labels: CRÍTICO ≥75 | ALTO ≥55 | MÉDIO ≥35 | BAIXO <35

ETAPA G — Persistência dupla
  1. ContactBehaviorAnalysis.create() com campos completos:
     - insights_v2 (JSONB — fonte da verdade V3.1)
     - prontuario_text (texto concatenado para leitura rápida)
     - Todos os campos individuais para compatibilidade
  2. Contact.update() com cache de scores:
     - score_engajamento, segmento_atual, estagio_ciclo_vida, cliente_score
     - campos_personalizados: cache de deal_risk, buy_intent, health, relationship_risk, etc.

ETAPA H — Hook pós-análise
  → Chama acionarAutomacoesPorPlaybook({contact_id, analysis_id})
  → Erros aqui são apenas logados, não param o retorno
```

**Segmentação automática (helper interno):**
- `risco_churn` → deal_risk>70 AND bucket='90+'
- `lead_quente` → buy_intent>70 AND deal_risk<30
- `lead_morno` → buy_intent>40 AND deal_risk<50
- `lead_frio` → bucket='90+'
- `cliente_ativo` → default

---

#### 📦 `analisarClientesEmLote` — Orquestrador de Prontuários
**O que faz de verdade:**
Gerencia QUANDO e QUAIS contatos serão analisados. Tem 3 modos distintos.

**Modo 1 — Direto (chamado pela UI com IDs específicos):**
```
→ Recebe contact_ids[]
→ Para cada: chama analisarComportamentoContato com delay 300ms
→ Retorna: {total, sucesso, erro, erros[]}
```

**Modo 2 — Priorização (chamado pela UI de Contatos Inteligentes):**
```
→ Filtra Contact por tipo_contato + dias de inatividade (bucket)
→ Busca ContactBehaviorAnalysis dos últimos 7 dias em paralelo
→ Busca MessageThreads canônicas em paralelo
→ Para cada contato:
  - SE sem análise/insufficient_data/error:
    → Usa inatividade como proxy de prioridade (sem IA)
    → Retorna dados básicos + suggested_message genérica
  - SE com análise válida:
    → Extrai deal_risk, buy_intent, engagement, health, stage, next_action
    → Aplica filtro duplo: (inatividade >= bucket) OR (deal_risk >= minDealRisk)
    → Retorna DTO padronizado com campos snake_case e camelCase
→ Ordena por prioridadeScore DESC
→ Retorna estatísticas: {criticos, altos, porPrioridade, porBucket, scoresMedios}
```

**Modo 3 — Scheduled (roda automaticamente a cada hora):**
```
→ Busca contatos tipo lead/cliente com ultima_interacao nos últimos 90 dias
→ Para cada:
  → Verifica se tem análise < 24h → pula (não recalcula desnecessariamente)
  → Chama analisarComportamentoContato com delay 200ms (anti-rate-limit)
→ Retorna: {total_processados, analises_criadas, analises_puladas, erros[]}
```

---

#### 🎯 `acionarAutomacoesPorPlaybook` — Hook Pós-Análise
**O que faz de verdade:**
Chamado automaticamente após cada `analisarComportamentoContato`. Aplica regras de negócio baseadas no resultado do prontuário.

**Regras reais implementadas:**

```
REGRA 1 — when_to_decline (quando NÃO investir esforço)
  → Avalia playbook.when_to_decline contra campos_personalizados do contato
  → Se deal_risk>70 → regras de preço/benchmark se aplicam
  → Se engagement<40 → regras de volume/genérica se aplicam
  → Cria WorkQueueItem tipo='avaliar_potencial', severity='low'
  → Scheduled para 7 dias no futuro
  → Inclui hook criativo mesmo em decline (para se decidir reengajar)

REGRA 2 — when_to_compete (quando LUTAR pelo cliente)
  → Busca thread canônica do contato
  → Atualiza thread.campos_personalizados com:
    playbook_status='compete'
    playbook_matched_rules=...
    hook_criativo_sugerido=...
    hook_tipo=...

REGRA 3 — relationship_risk HIGH/CRITICAL
  → Busca thread canônica
  → Cria WorkQueueItem tipo='reativacao', severity='high'/'critical'
  → Scheduled para 24h no futuro
  → Inclui risk_events + hook criativo personalizado

REGRA 4 — Auto-decline
  → Se analise.scores.deal_risk>70 AND analise.scores.engagement<40
  → Adiciona tag 'auto_decline_generic_quotes' ao Contact
  → Evita enviar cotações genéricas para contatos sem chance

GERADOR DE HOOK CRIATIVO (helper interno):
  → Risco alto + critical → personalizacao_extrema
  → price_sensitive + process_formal → contraste_provocacao
  → Lead frio (deal_risk<50, engagement<40) → autoridade_prova_social
  → Cliente fidelizado travado → reciprocidade_valor
  → Default → curiosidade_scarcity
```

---

#### ⏰ `executarFluxosAgendados` — v2.0
**O que faz de verdade:**
Worker que roda a cada 5-10 minutos. Avança FlowExecutions com `next_action_at` vencido.

```
→ Busca FlowExecution: status='waiting_follow_up' AND next_action_at <= agora (limit 20)
→ Para cada:
  → Chama playbookEngine({action: 'continue_follow_up', execution_id})
  → Se falhar: marca FlowExecution.status='erro' e registra no execution_history
→ Retorna: {total, sucessos, erros}
```

---

#### 🎬 `playbookEngine` — v4 (Motor de Execução)
**O que faz de verdade:**
Executa FlowTemplates passo a passo. O "runtime" dos scripts de automação.

**Actions disponíveis:**
```
'start' → iniciarExecucao(contact_id, flow_template_id)
  → Busca ou cria MessageThread para o contato
  → Cria FlowExecution com status='ativo'
  → Executa step 0

'process_response' → processarResposta(execution_id, user_response)
  → Valida input contra step.opcoes / step.tipo_input
  → Se inválido: retorna 'retry' ou escala para humano (max_tentativas)
  → Se válido: armazena em variables, avança step

'continue_follow_up' → continuarFollowUp(execution_id)
  → Chamado por executarFluxosAgendados
  → Avança current_step + 1
  → Se chegou ao fim: verifica taxa de engajamento
    → <30% + auto_escalate_to_human → escala para humano
    → Senão: finaliza

'cancel' → cancelarExecucao(execution_id)
```

**Tipos de Step implementados:**
```
'message' → envia WhatsApp via enviarWhatsApp + registra Message
  → Se step.delay_days: status='waiting_follow_up', calcula next_action_at
'input'   → retorna 'wait_input' com campo + opcoes (cliente deve responder)
'ia_classify' → chama nexusClassifier, atualiza variables + score do cliente
'action'  → executa ação: criarLead | agendarFollowUp | enviarOrcamento | atribuirVendedor
'delay'   → pausa execução por delay_days ou delay_seconds
'end'     → finaliza execução
```

**Escalação para humano:**
```
→ Atualiza FlowExecution.status='escalado_humano'
→ Cria NotificationEvent para TODOS os admin (não só o atendente responsável)
→ Cria AutomationLog
→ Atualiza MessageThread.prioridade='alta'
⚠️ PROBLEMA: notifica todos admins, não o atendente assigned_user_id
```

---

#### 📥 `processInbound` — v11.0.0
**O que faz de verdade:**
Pipeline central que processa TODA mensagem inbound recebida do WhatsApp. Chamado pelos webhooks (Z-API, W-API).

**Pipeline completo em ordem:**
```
1. IDEMPOTÊNCIA
   → Busca Message existente com mesmo whatsapp_message_id
   → Se > 1 resultado: skipa como duplicata

2. RESET FUNIL PROMOÇÕES
   → Se thread tem autoboost_stage ou last_boost_at: reseta
   → Garante que nova mensagem cancela funil promocional ativo

3. ATUALIZAR ENGAGEMENT STATE
   → Busca ContactEngagementState ativo para o contato
   → Se encontrado: status='paused', registra last_inbound_at
   → (Pausa campanhas ativas quando cliente responde)

4. HARD-STOP: HUMANO ATIVO
   → humanoAtivo(thread): assigned_user_id existe + last_human_message_at < 2h + pre_atendimento_ativo=false
   → Se ativo: PARA PIPELINE COMPLETAMENTE
   → Retorna {stop: true, reason: 'human_active'}

5. AGENDA IA CHECK
   → thread.assistant_mode === 'agenda' OU integration.nome_instancia === 'NEXUS_AGENDA_INTEGRATION'
   → Se sim: roteia para routeToAgendaIA e PARA

6. CLAUDE AGENDA CHECK (ANTES da URA)
   → Detecta palavras: agendar|agendamento|marcar|desmarcar|reagendar|cancelar|horário|disponível|consulta|visita|reunião
   → Se detectado E integration.id existe: chama claudeAgendaAgent e PARA
   ⚠️ PROBLEMA: se integration.id está ausente no payload, Claude Agenda é silenciosamente pulado

7. CICLO DETECTION + DECISÃO URA
   → novoCiclo = lastInboundAt NULL ou gap >= 12h
   → shouldDispatch = true se:
     a) URA já ativa (pre_atendimento_ativo=true) OU
     b) Novo ciclo OU
     c) Humano dormant (atribuído mas sem resposta > 2h) E mensagem > 4 chars OU
     d) Sem assigned_user_id
   → Se shouldDispatch:
     → Busca FlowTemplate com is_pre_atendimento_padrao=true AND ativo=true
     → Se NENHUM encontrado: retorna {stop: true, reason: 'pre_atendimento_desativado'}
     ⚠️ PROBLEMA CRÍTICO: Hoje NÃO existe nenhum FlowTemplate com is_pre_atendimento_padrao=true
     → Resultado: URA nunca é acionada, pipeline cai no fallback (Claude)
     → Chama preAtendimentoHandler e PARA

8. CLAUDE AI RESPONDER (FALLBACK)
   → Se message.sender_type='contact' E mensagem > 2 chars E integration.id existe
   → Chama claudeWhatsAppResponder
   ⚠️ PROBLEMA: Se integration.id ausente no payload, Claude não é acionado (silencioso)
```

---

#### 🤖 `claudeWhatsAppResponder`
**O que faz de verdade:**
Fallback de atendimento 24/7. Usa Anthropic Claude com contexto completo da empresa.

**Contexto injetado no prompt:**
- Identidade da empresa (nome, produtos, serviços, políticas)
- Histórico de mensagens da thread (últimas N)
- Dados do contato (nome, tipo, empresa)
- Perfil comportamental do contato (se disponível em ContactBehaviorAnalysis)

**Capabilities reais:**
- Responde dúvidas sobre produtos/serviços
- Detecta urgência, pedido de transferência para humano
- Classifica intenção (vendas/suporte/financeiro/etc)
- Escala para humano quando necessário

---

#### 📅 `claudeAgendaAgent`
**O que faz de verdade:**
Agente especializado em agendamentos. Acionado por palavras-chave de agenda no processInbound.

**Capabilities reais:**
- Criar agendamento: verifica disponibilidade real no banco (Agendamento entity)
- Consultar agendamento: lista compromissos do contato
- Cancelar/reagendar: atualiza no banco
- Valida horário de funcionamento, serviços disponíveis, duração
- Responde em português com tom profissional

**Contexto:**
- Agendamentos existentes para calcular disponibilidade
- Serviços configurados com duração
- Fuso horário (America/Sao_Paulo)

---

### 1.2 — Entidades Críticas do Agente

#### `ContactBehaviorAnalysis` — O Prontuário
Campos mais importantes:
```
analyzed_at       — quando foi gerado
status            — 'ok' | 'insufficient_data' | 'error'
priority_score    — 0-100 (algoritmo determinístico + IA)
priority_label    — 'CRITICO' | 'ALTO' | 'MÉDIO' | 'BAIXO'
insights_v2       — JSONB completo (FONTE DA VERDADE V3.1)
  └── relationship_profile: {type, flags[], summary}
  └── scores: {health, deal_risk, buy_intent, engagement}
  └── stage: {current, days_stalled, last_milestone}
  └── root_causes: [{cause, severity, confidence}]
  └── next_best_action: {action, priority, rationale, suggested_message}
  └── relationship_risk: {level, events[]}
  └── playbook: {goal, rules_of_game[], when_to_compete[], when_to_decline[]}
prontuario_text   — texto concatenado para leitura rápida
days_inactive_inbound — dias sem mensagem do cliente
bucket_inactive   — 'active' | '30' | '60' | '90+'
```

#### `MessageThread` — Estado Atual da Conversa
Campos críticos para o agente:
```
last_message_sender       — 'user' | 'contact'
last_message_at           — timestamp última mensagem
last_inbound_at           — timestamp última mensagem DO cliente
last_human_message_at     — timestamp última mensagem de HUMANO (não URA/automação)
unread_count              — mensagens não lidas (cliente não respondeu)
jarvis_next_check_after   — cooldown do Jarvis
jarvis_last_playbook      — última ação do Jarvis
assigned_user_id          — atendente responsável
pre_atendimento_ativo     — URA ativa?
assistant_mode            — 'default' | 'agenda' | 'vendas' | 'suporte'
```

#### `WorkQueueItem` — Fila de Tarefas do Agente
```
tipo     — 'idle_reativacao' | 'enviar_promocao' | 'follow_up' | 'manual' | 'avaliar_potencial' | 'reativacao'
severity — 'low' | 'medium' | 'high' | 'critical'
status   — 'agendado' | 'open' | 'in_progress' | 'processado' | 'done' | 'dismissed' | 'cancelado' | 'erro'
scheduled_for — quando executar
payload  — dados específicos da tarefa (hook_criativo, analysis_id, etc.)
```

#### `FlowExecution` — Instância de Playbook Rodando
```
status             — 'ativo' | 'waiting_follow_up' | 'concluido' | 'cancelado' | 'erro' | 'escalado_humano'
current_step       — índice do step atual no FlowTemplate.steps[]
next_action_at     — quando executarFluxosAgendados deve retomar
follow_up_stage_index — posição no ciclo 24h→3d→7d→15d
variables          — dados coletados durante a execução (nome, interesse, etc.)
execution_history  — log completo de cada step executado
```

---

## PARTE 2 — FLUXO REAL COMPLETO (do webhook à resposta)

```
╔══════════════════════════════════════════════════════════╗
║  CLIENTE MANDA MENSAGEM WHATSAPP                         ║
╚══════════════════════════════════════════════════════════╝
                         │
              ┌──────────┴──────────┐
              │                     │
     webhookFinalZapi          webhookWapi
     (Z-API)                   (W-API)
              │                     │
              └──────────┬──────────┘
                         │
                    NORMALIZA payload
                    → Extrai: phone, name, message, media_type
                    → Normaliza telefone (remove +55, 9º dígito, etc.)
                         │
                  BUSCA/CRIA Contact
                    → Busca por telefone_canonico
                    → Se não existe: cria Contact novo
                         │
                  BUSCA/CRIA MessageThread
                    → Busca thread canônica do contato
                    → Atualiza: last_message_at, last_inbound_at, unread_count++
                         │
                  PERSISTE Message
                    → Cria Message com whatsapp_message_id (para dedup)
                         │
                  MÍDIA? → spawn persistirMidiaZapi/Wapi (async, não bloqueia)
                         │
                  CHAMA processInbound (async)
                         │
                         ▼
╔══════════════════════════════════════════════════════════╗
║  processInbound v11 — Pipeline de Decisão               ║
╠══════════════════════════════════════════════════════════╣
║  1. Dedup (whatsapp_message_id) ──────── se duplicata: STOP
║  2. Reset promoções ─────────────────── se funil ativo: reset
║  3. Update engagement state ────────── pausa campanhas ativas
║                                                          ║
║  4. HUMANO ATIVO? (last_human_message_at < 2h) ─── STOP ║
║                                                          ║
║  5. MODO AGENDA? (assistant_mode='agenda') ───────────── ║
║     → routeToAgendaIA ──────────────────────────── STOP ║
║                                                          ║
║  6. PALAVRAS DE AGENDA? (agendar|marcar|horário|...)──── ║
║     → claudeAgendaAgent ───────────────────────── STOP  ║
║                                                          ║
║  7. shouldDispatch URA?                                  ║
║     a) URA já ativa (pre_atendimento_ativo=true) OU     ║
║     b) Novo ciclo (gap >= 12h) OU                        ║
║     c) Humano dormant + msg > 4 chars OU                 ║
║     d) Sem atendente atribuído                           ║
║     → Busca FlowTemplate(is_pre_atendimento_padrao=true) ║
║     → ⚠️ HOJE: NENHUM ENCONTRADO → STOP (pre_atendimento_desativado)
║     → Se encontrado: preAtendimentoHandler ──────── STOP║
║                                                          ║
║  8. FALLBACK: claudeWhatsAppResponder                    ║
║     (só se integration.id presente no payload)           ║
╚══════════════════════════════════════════════════════════╝
                         │
              [PARALELO — Rodando em Background]
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    A cada 1h        A cada 30min    A cada 5-10min
         │               │               │
analisarClientes   jarvisEventLoop  executarFluxos
EmLote (scheduled)  v3.0 (Nexus)    Agendados v2
         │               │               │
         ▼               ▼               ▼
  Atualiza      Detecta threads    Avança FlowExec
  Prontuários   ociosas + decide   com next_action_at
  (ContactBe-   CRÍTICO/ALTO/     vencido via
  haviorAnalysis) MÉDIO/BAIXO     playbookEngine
         │
         ▼
acionarAutomacoes
PorPlaybook
  → Cria WorkQueueItems
  → Atualiza tags
  → Marca threads prioritárias
```

---

## PARTE 3 — GAPS REAIS COM EVIDÊNCIA DE CÓDIGO

### GAP 1 — URA nunca dispara (CRÍTICO)
**Evidência:**
```javascript
// processInbound linha 176-184
const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
  is_pre_atendimento_padrao: true,
  ativo: true
}, '-created_date', 1);

if (!playbooks?.length) {
  console.log(`[${VERSION}] 🚫 Sem playbook ativo - bloqueando URA`);
  result.actions.push('ura_blocked_no_playbook');
  return Response.json({...stop: true, reason: 'pre_atendimento_desativado'});
}
```
**Impacto:** Toda mensagem que deveria passar pela URA cai direto no Claude.
O cliente nunca é perguntado "qual setor você quer?" — Claude tenta adivinhar.
**Solução:** Criar 1 FlowTemplate com `is_pre_atendimento_padrao=true` e `ativo=true`.

---

### GAP 2 — Orçamentos: Jarvis vê pouco (ALTO)
**Evidência:**
```javascript
// jarvisEventLoop STEP 3, linha ~155
const orcamentosParados = await base44.asServiceRole.entities.Orcamento.filter({
  status: 'enviado',         // ← SÓ 'enviado'! Não vê 'negociando', 'vencido', 'rejeitado'
  updated_date: { $lt: seteDiasAtras.toISOString() }
}, '-updated_date', 10);
```
**Impacto:**
- Orçamento em `negociando` travado por 3 dias → **Jarvis não vê**
- Orçamento `vencido` que pode ser reativado → **Jarvis não vê**
- Orçamento `rejeitado` com causa recuperável → **Jarvis não vê**
**Solução:** Estender Step 3 com múltiplos status e limiares diferentes.

---

### GAP 3 — playbookEngine escala para admins, não para o atendente (MÉDIO)
**Evidência:**
```javascript
// playbookEngine linha 495
const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, 'full_name', 5);
for (const admin of admins) {
  await base44.asServiceRole.entities.NotificationEvent.create({...})
}
// ← Nunca notifica execution.variables.assigned_user_id ou thread.assigned_user_id
```
**Impacto:** Escalações chegam para todos os admins mas não para o vendedor/atendente responsável pelo cliente.
**Solução:** Buscar `Contact.vendedor_responsavel` e notificar esse usuário prioritariamente.

---

### GAP 4 — EventoSistema é produzido por quase ninguém (BAIXO)
**Evidência:**
```javascript
// jarvisEventLoop STEP 1 — sempre loga isso:
// "[NEXUS-AGENT v3] ⏭️ EventoSistema vazio — pulando step 1"
```
**Impacto:** Step 1 do Jarvis é letra morta. AgentRuns criados ali nunca acontecem na prática.
**Solução:** Baixo impacto — o Step 2 (threads) é o motor real. EventoSistema pode ser ignorado ou removido.

---

### GAP 5 — integration.id pode estar ausente no payload (MÉDIO)
**Evidência:**
```javascript
// processInbound linhas 134-136
if (!integration?.id) {
  console.warn(`[${VERSION}] ⚠️ integration.id ausente — claudeAgendaAgent não pode ser acionado`);
} else {
// E linhas 214-217
if (!integration?.id) {
  console.warn(`[${VERSION}] ⚠️ integration.id ausente — claudeWhatsAppResponder não pode ser acionado`);
  result.actions.push('claude_ai_skipped_no_integration');
```
**Impacto:** Mensagens recebidas de integrações sem ID configurado corretamente ficam sem resposta automática.
**Solução:** Validar no webhook antes de chamar processInbound que integration.id está presente.

---

### GAP 6 — businessIA está isolado (MÉDIO)
**Situação atual:** `businessIA` existe e funciona (insights de funil, anomalias, receita), mas é chamado apenas pela UI do Dashboard. O Jarvis não o consulta. Ou seja, o agente toma decisões de "quem alertar" sem saber se o negócio como um todo está bem ou em crise.
**Impacto:** Em um dia de crise (ex: taxa de conversão caiu 40%), o Jarvis continua no ritmo normal.
**Solução:** No início de cada ciclo do Jarvis, invocar businessIA para ajustar sensibilidade.

---

### GAP 7 — Análise de comportamento não inclui dados de Orçamentos (MÉDIO)
**Evidência:**
```javascript
// analisarComportamentoContato — lê apenas:
// Contact, MessageThread, Message
// ← Não lê Orcamento, Venda, Interacao
```
**Impacto:** O prontuário diz "deal_risk=80" mas não sabe que o cliente tem um orçamento de R$50k aprovado e esquecido. O score está errado.
**Solução:** Na ETAPA B, buscar orçamentos e vendas do contato e injetar no contexto da IA.

---

## PARTE 4 — COMPARAÇÃO ESTUDO vs REALIDADE

| Proposta do Estudo | Status Real | Delta Concreto |
|---|---|---|
| Jarvis como NexusAgentLoop | ✅ Feito (v3.0) | Nenhum |
| Consultar prontuário antes de agir | ✅ Feito | Nenhum |
| Decisão 4 níveis CRÍTICO/ALTO/MÉDIO/BAIXO | ✅ Feito | Nenhum |
| WhatsApp direto para CRÍTICO | ✅ Feito | Monitorar opt-out |
| Alerta interno para ALTO | ✅ Feito | Funciona via thread interna |
| analisarClientesEmLote schedulado | ✅ Feito (a cada 1h) | Nenhum |
| Hook pós-análise (acionarAutomacoesPorPlaybook) | ✅ Feito* | *Corrigido 2026-03-09 (bug 401) |
| executarFluxosAgendados avançando follow-ups | ✅ Feito* | *Reescrito 2026-03-09 (import quebrado) |
| URA como peça integrada do agente | ❌ Gap — 0 templates ativos | Criar FlowTemplate mínimo |
| Análise de orçamentos parados | ⚠️ Parcial | Só `status='enviado'` >7d → expandir |
| Análise de orçamentos rejeitados/vencidos | ❌ Não existe | Adicionar no Step 3 do Jarvis |
| "O que estamos perdendo" (funil) | ⚠️ businessIA tem, mas isolado | Integrar ao ciclo do Jarvis |
| Prontuário inclui dados de orçamentos | ❌ Não inclui | Injetar Orcamento/Venda na ETAPA B |
| Escalação notifica o atendente responsável | ❌ Notifica só admins | Corrigir playbookEngine |
| Prioridade centralizada (1 dono) | ✅ Jarvis é o dono | Falta UI consumir fila do Jarvis |

---

## PARTE 5 — ARQUITETURA PROPOSTA (o que deve ser o sistema)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     NEXUS AGENT LOOP                                 │
│                   (jarvisEventLoop v3.x)                             │
│                                                                      │
│  CICLO A CADA 30MIN:                                                 │
│  1. [NOVO] Consultar businessIA → ajustar sensibilidade do dia       │
│  2. Threads ociosas → prontuário → CRÍTICO/ALTO/MÉDIO/BAIXO         │
│  3. [EXPANDIR] Orçamentos: enviado>7d | negociando>3d | vencido<14d │
│                                                                      │
│  ENTRADAS:                                                           │
│  - MessageThread (ociosa, unread, assigned)                          │
│  - ContactBehaviorAnalysis (prontuário atualizado)                  │
│  - Orcamento (parado, vencido) ← GAP a resolver                     │
│                                                                      │
│  SAÍDAS POSSÍVEIS:                                                   │
│  - enviarWhatsApp (direto ao cliente) — CRÍTICO                      │
│  - Message interna (alerta atendente) — ALTO                        │
│  - WorkQueueItem (fila de tarefa) — MÉDIO/ações playbook            │
│  - TarefaInteligente (orçamento parado) — Step 3                    │
│  - AgentRun (auditoria de cada decisão)                              │
└──────────────────┬─────────────────────────────────┬────────────────┘
                   │                                 │
                   ▼                                 ▼
┌─────────────────────────────┐   ┌──────────────────────────────────┐
│  MOTOR DE PRONTUÁRIO        │   │  CAMADA DE EXECUÇÃO              │
│                             │   │                                  │
│  analisarComportamento      │   │  playbookEngine v4               │
│  Contato (por contato)      │   │  - start/process_response        │
│                             │   │  - continue_follow_up            │
│  Lê: Message, Thread        │   │  - cancel/escalate               │
│  [FALTA]: Orcamento, Venda  │   │                                  │
│                             │   │  claudeWhatsAppResponder         │
│  Gera: priority_score,      │   │  - fallback 24/7                 │
│  prontuario_text, playbook, │   │  - contexto empresa + contato    │
│  next_best_action,          │   │                                  │
│  suggested_message           │   │  claudeAgendaAgent               │
│                             │   │  - criação/consulta/cancelamento │
│  analisarClientesEmLote     │   │  - verificação disponibilidade   │
│  (scheduler + orquestrador) │   │                                  │
│  - Modo scheduled (1h)      │   │  enviarWhatsApp (gateway)        │
│  - Modo priorização (UI)    │   │  - Z-API / W-API / Evolution     │
│  - Modo direto (IDs)        │   │  - Todos os tipos de mídia       │
└─────────────────────────────┘   └──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────┐
│  ACIONADORES PÓS-ANÁLISE    │
│                             │
│  acionarAutomacoesPor       │
│  Playbook                   │
│  - Regra decline            │
│  - Regra compete            │
│  - Regra risk               │
│  - Auto-decline             │
│  - Gerador de hook criativo │
│                             │
│  executarFluxosAgendados    │
│  - Avança FlowExecution     │
│  - Ciclo 24h→3d→7d→15d     │
└─────────────────────────────┘
```

### O que NÃO deve ser criado como função nova:
| Necessidade | Onde resolver |
|---|---|
| "Alertar quando lead esfria" | Já existe no Jarvis Step 2 |
| "Detectar cliente esquecido" | Já existe: analisarClientesEmLote modo priorização |
| "Follow-up automático WhatsApp" | Já existe: playbookEngine + FlowTemplate |
| "Notificação de orçamento parado" | Estender Jarvis Step 3 (não criar função nova) |
| "Score de risco de perda" | Já existe: deal_risk em ContactBehaviorAnalysis |
| "O que estamos perdendo" | businessIA já calcula → integrar ao Jarvis |
| "Análise de intenção da mensagem" | Já existe: nexusClassifier |
| "Resposta automática sem humano" | Já existe: claudeWhatsAppResponder |

---

## PARTE 6 — ROADMAP DETALHADO (ordem de dependência)

### ✅ Fase 1 — CONCLUÍDA em 2026-03-09
- [x] Deletar `enviarMensagemMassa`, `enviarPromocoesLote` (wrappers mortos)
- [x] Corrigir `acionarAutomacoesPorPlaybook` (bug 401 silencioso por auth.me())
- [x] Reescrever `executarFluxosAgendados` (import local quebrado)
- [x] Refatorar `jarvisEventLoop` v3.0 (consulta prontuário antes de agir)

---

### 🔥 Fase 2 — URA Mínima Ativa (PRÓXIMA PRIORIDADE)
**Por que primeiro:** Sem URA, o processInbound cai no Claude para TUDO. O cliente nunca é direcionado corretamente. O Jarvis não sabe em que setor classificar a conversa.

**O que fazer (sem criar função nova):**
Criar 1 `FlowTemplate` no banco com:
```json
{
  "nome": "Pré-atendimento Padrão",
  "is_pre_atendimento_padrao": true,
  "ativo": true,
  "activation_mode": "global",
  "steps": [
    {
      "type": "buttons",
      "texto": "Olá {nome}! 👋 Para qual área você precisa de atendimento?",
      "opcoes": ["💼 Vendas", "🔧 Suporte", "💰 Financeiro"]
    },
    {
      "type": "route",
      "mapa": {
        "💼 Vendas": "vendas",
        "🔧 Suporte": "assistencia",
        "💰 Financeiro": "financeiro"
      }
    }
  ]
}
```

**Pré-requisito:** Verificar se `preAtendimentoHandler` está funcional (ler o arquivo).

---

### 📊 Fase 3 — Jarvis vê mais orçamentos
**O que fazer (estender Step 3 do jarvisEventLoop):**
```
ATUAL:
  status='enviado' AND updated_date < 7 dias → cria TarefaInteligente

EXPANDIR PARA:
  status='negociando' AND updated_date < 3 dias → alerta ALTO para atendente
  status='enviado' AND updated_date < 7 dias → já existe (manter)
  status='vencido' AND updated_date < 14 dias → WorkQueueItem reativação
  status='rejeitado' AND updated_date < 30 dias → análise de causa (IA)
```

---

### 🧠 Fase 4 — Prontuário com dados de orçamentos
**O que fazer (estender ETAPA B do analisarComportamentoContato):**
```javascript
// Após buscar mensagens, buscar também:
const orcamentos = await base44.asServiceRole.entities.Orcamento.filter(
  { cliente_telefone: contact.telefone },
  '-data_orcamento', 10
);
// Injetar no prompt da IA:
// "Orçamentos: ${orcamentos.map(o => `${o.status} R$${o.valor_total} (${o.data_orcamento})`).join(', ')}"
```
**Impacto:** deal_risk passa a considerar histórico de compras reais, não só conversas.

---

### 🔔 Fase 5 — Escalação notifica o atendente certo
**O que fazer (corrigir playbookEngine função `escalonarParaHumano`):**
```javascript
// ATUAL (notifica só admins):
const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

// CORRETO:
const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);
const responsavelId = contact.vendedor_responsavel || execution.variables.assigned_user_id;
// Notificar o responsável + admins como fallback
```

---

### 🔭 Fase 6 — businessIA no ciclo do Jarvis
**O que fazer (adicionar no início do jarvisEventLoop):**
```javascript
// STEP 0 (novo): ajustar sensibilidade
let sensibilidadeBoost = 0;
try {
  const anomalias = await base44.asServiceRole.functions.invoke('businessIA', {
    action: 'get_anomalies'
  });
  // Se taxa de conversão caiu >20% → elevar sensibilidade → mais alertas
  if (anomalias.data?.critical_anomalies?.length > 0) {
    sensibilidadeBoost = 10; // reduz threshold de ALTO para capturar mais casos
  }
} catch(e) { /* não bloqueia o ciclo */ }
```

---

## PARTE 7 — MÉTRICAS DE SAÚDE DO AGENTE

### Como saber se o agente está funcionando:

| Métrica | Como medir | Target |
|---|---|---|
| ContactBehaviorAnalysis atualizados nas últimas 24h | `ContactBehaviorAnalysis.filter({analyzed_at: {$gte: 24h atrás}}).count()` | >80% dos leads/clientes ativos |
| Threads com unread_count>0 sem jarvis_alerted_at | `MessageThread.filter({unread_count:{$gt:0}, jarvis_alerted_at: null})` | <10 em qualquer momento |
| AgentRun com status='falhou' no último ciclo | `AgentRun.filter({status:'falhou', started_at:{$gte: 30min}})` | 0 |
| FlowExecution com status='erro' | `FlowExecution.filter({status:'erro', completed_at:{$gte: 24h}})` | <5% do total |
| WorkQueueItems em status='agendado' expirados | `WorkQueueItem.filter({status:'agendado', scheduled_for:{$lt: agora}})` | 0 (workers processando) |
| Orçamentos 'negociando' >3d sem toque | `Orcamento.filter({status:'negociando', updated_date:{$lt: 3d}})` | 0 após Fase 3 |

---

## PARTE 8 — FUNÇÕES PARA DELETAR

> Deletar apenas após confirmar que nenhuma UI ou automação as referencia.

| Função | Motivo | Status |
|---|---|---|
| `enviarMensagemMassa` | ✅ Wrapper morto de enviarCampanhaLote | Deletada 2026-03-09 |
| `enviarPromocoesLote` | ✅ Wrapper morto de enviarCampanhaLote | Deletada 2026-03-09 |
| Tudo em `_OBSOLETAS_PARA_DELETAR.md` | Diagnósticos antigos, duplicatas | Pendente — verificar UIs |
| `analisarComportamentoContatoIA` | Duplicata de analisarComportamentoContato? | Verificar |
| `analisarScorePreditivo` | Duplicata de lógica em analisarComportamentoContato? | Verificar |
| `diagnosticarContatoDuplicado`, `diagnoseWithLLM`, etc | Ferramentas de diagnóstico pontual | Mover para página admin |

---

*Última atualização: 2026-03-09 — Documento de referência oficial do Nexus360.*
*Qualquer mudança arquitetural deve atualizar este arquivo.*