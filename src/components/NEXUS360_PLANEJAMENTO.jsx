# NEXUS360 — Plano Estratégico do Agente Autônomo
**Data:** 2026-03-09 | **Versão:** 3.0 MÁXIMO DETALHE | **Status:** Documento de Referência Oficial

> ⚠️ REGRA MÁXIMA: Qualquer nova função ou mudança arquitetural deve ser documentada e justificada aqui ANTES de ser implementada.
> Se a necessidade cabe em um módulo IA CORE existente → estenda-o. Não crie função nova.

---

# PARTE 1 — INVENTÁRIO REAL DE FUNÇÕES

## 1.1 — Módulos IA CORE (os "órgãos vitais" — não mexer sem justificativa)

---

### 🔄 `jarvisEventLoop` — v3.0 (NexusAgentLoop)
**Status:** ✅ Ativo e funcional (refatorado 2026-03-09)
**Scheduling:** Automação scheduled a cada 30 minutos
**SDK:** `@base44/sdk@0.8.20`

**Responsabilidade oficial:** Motor central do agente autônomo. Detecta contatos/leads parados, toma decisão e age. É o "proprietário" de prioridades do sistema.

**Fluxo interno completo:**
```
STEP 1 — EventoSistema (geralmente vazio na prática)
  → EventoSistema.filter({processado: false}, limit=20)
  → Para cada: cria AgentRun, marca processado=true
  → ⚠️ PROBLEMA REAL: Quase nenhuma função produz EventoSistema
    → Nos logs aparece: "⏭️ EventoSistema vazio — pulando step 1"
    → Este step é letra morta. Não bloqueia nada, mas nunca faz nada.

STEP 2 — Threads Ociosas (CORAÇÃO DO AGENTE)
  Filtro candidatas:
  → last_message_sender = 'contact'
  → last_message_at < 30min atrás
  → assigned_user_id exists
  → unread_count > 0
  → status = 'aberta'
  → limit = 40 candidatas

  Filtro de cooldown + threshold dinâmico (código real):
  → Se jarvis_next_check_after >= agora → skip (em cooldown)
  → Threshold dinâmico por score de engajamento:
    score >= 70 → threshold = 30min  (contato quente/VIP)
    score 40-70 → threshold = 2h     (contato morno)
    score < 40  → threshold = 6h     (contato frio)
    score null  → threshold = 1h     (sem score)
  → Processa máx 3 threads por ciclo (MAX_THREADS_POR_CICLO = 3)
  → Guard total de 90s (MAX_CICLO_MS = 90.000) — se ultrapassar, aborta

  Para cada thread candidata (até 3):
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Busca prontuário:                                        │
  │    ContactBehaviorAnalysis.filter({contact_id}, '-analyzed_at', 1)
  │    → Extrai: priority_score, priority_label                 │
  │    → Extrai: insights_v2.next_best_action.suggested_message │
  │    → Extrai: relationship_risk.level                        │
  │    → Se sem análise: usa thread.cliente_score como proxy    │
  │                                                             │
  │ 2. Decisão por priority_label:                              │
  │                                                             │
  │  CRÍTICO (score ≥ 75):                                      │
  │    → Contact.get(thread.contact_id) → busca telefone        │
  │    → suggested_message = prontuário.next_best_action.       │
  │      suggested_message OU fallback genérico                 │
  │    → Invoca enviarWhatsApp(integration_id, telefone, msg)   │
  │    → Se sucesso:                                            │
  │      → Message.create(sender_id='nexus_agent',              │
  │          visibility='public_to_customer')                   │
  │      → MessageThread.update(last_outbound_at, last_message) │
  │      → resultados.followups_automaticos++                   │
  │    → Se falhar OU sem telefone → fallback para ALTO         │
  │                                                             │
  │  ALTO (score 55-74) + fallback de CRÍTICO:                  │
  │    → Invoca getOrCreateInternalThread(assigned_user_id)     │
  │    → Monta alerta rico:                                     │
  │      "⏰ Conversa parada Xmin | Score Y/100 (LABEL)"        │
  │      "🔴 Risco relacional: LEVEL" (se análise presente)     │
  │      "💡 Próxima ação: next_action" (se análise presente)   │
  │    → Message.create na thread interna (visibility=internal) │
  │    → Incrementa unread_by[assigned_user_id]++               │
  │    → resultados.alertas_internos++                          │
  │                                                             │
  │  MÉDIO (score 35-54):                                       │
  │    → Apenas registra: acaoExecutada = 'registrado_sem_acao' │
  │    → Sem WhatsApp. Sem alerta. Só aplica cooldown.          │
  │                                                             │
  │  BAIXO (score < 35):                                        │
  │    → Ignora completamente. Não gasta nenhum recurso.        │
  │    → acaoExecutada = 'ignorado_score_baixo'                 │
  │                                                             │
  │ 3. Pós-decisão (sempre):                                    │
  │    → MessageThread.update:                                  │
  │      jarvis_alerted_at = agora                              │
  │      jarvis_next_check_after = agora + 4h (COOLDOWN_HORAS) │
  │      jarvis_last_playbook = acao_executada (se não ignorado)│
  │    → AgentRun.create() para auditoria completa              │
  └─────────────────────────────────────────────────────────────┘

STEP 3 — Orçamentos parados >7 dias
  → Se ciclo já ultrapassou 90s → SKIP (guard de tempo)
  → Orcamento.filter({status: 'enviado', updated_date < 7d}, limit=10)
  → Para cada: TarefaInteligente.create(tipo='follow_up_orcamento')
  ⚠️ PROBLEMA REAL: só status='enviado'. NÃO vê:
    → 'negociando' travado (problema crítico de pipeline)
    → 'vencido' recente (oportunidade de reativação)
    → 'rejeitado' recente (análise de causa perdida)
```

**Campos de controle no banco:**
| Campo | Entidade | Uso |
|---|---|---|
| `jarvis_next_check_after` | MessageThread | Cooldown: quando pode verificar de novo |
| `jarvis_alerted_at` | MessageThread | Quando alertou pela última vez |
| `jarvis_last_playbook` | MessageThread | Última ação executada pelo Jarvis |
| `priority_score` | ContactBehaviorAnalysis | Score 0-100 que define a decisão |
| `priority_label` | ContactBehaviorAnalysis | CRÍTICO/ALTO/MÉDIO/BAIXO |
| `insights_v2.next_best_action.suggested_message` | ContactBehaviorAnalysis | Mensagem pronta para envio direto |

---

### 🔬 `analisarComportamentoContato` — v3 (Motor de Prontuário)
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.8.20`

**Responsabilidade:** Gera o "prontuário de inteligência" completo de um contato. É a única fonte da verdade sobre comportamento, risco e intenção.

**Fluxo interno completo:**
```
ETAPA A — Busca de dados
  → Contact.get(contact_id)
  → MessageThread.filter({contact_id}) → todos os threads

ETAPA B — Busca de mensagens
  → Message.filter({thread_id: {$in: threadIds}}, '-sent_at', limit=100)
  → Inverte para ASC (ordem cronológica)
  → Se 0 threads → cria ContactBehaviorAnalysis(status='insufficient_data'), retorna
  → Se 0 mensagens → idem
  ⚠️ NÃO lê: Orcamento, Venda, Interacao
    → deal_risk calculado sem saber de orçamentos reais

ETAPA C — Timestamps e Buckets
  → lastMessageAt (qualquer sender)
  → lastInboundAt (sender_type = 'contact')
  → lastOutboundAt (sender_type = 'user')
  → daysInactiveInbound = dias sem resposta DO CLIENTE
  → bucketInactive = 'active'|'30'|'60'|'90+' (baseado em inbound)

ETAPA D — Métricas Determinísticas (Hard Stats — sem IA)
  → inboundCount, outboundCount
  → ratioInOut = inbound/outbound
  → responseTimesAgent[] = diff(msg_user após msg_contact), em minutos
  → responseTimesContact[] = diff(msg_contact após msg_user), em minutos
  → Filtro: ignora diffs > 7 dias (silêncios prolongados não são "resposta")
  → avgReplyMinutesAgent (média dos tempos de resposta do atendente)
  → avgReplyMinutesContact (média dos tempos de resposta do cliente)
  → unansweredFollowups = mensagens 'user' nas últimas 10 sem resposta 'contact' depois
  → maxSilenceGapDays = maior gap entre mensagens consecutivas
  → conversationVelocity = totalMsgs / diasHistórico (msgs/dia)
  → last10Balance = {inbound: N, outbound: M} nas últimas 10 msgs

ETAPA E — Análise Semântica via IA (Claude/GPT)
  → Pega últimas 50 mensagens inbound do contato
  → Se texto total < 20 chars → skip (sem dado suficiente)
  → Prompt V2 detalhado pede JSON completo com:

    relationship_profile:
      type: comprador_corporativo_multi_cotacao | cliente_fidelizado |
            lead_quente | suporte_tecnico | financeiro | outro
      flags: price_sensitive | deadline_sensitive | process_formal |
             decision_by_third_party | uses_benchmark | relationship_frictions
      summary: "1 frase"

    scores: {health: 0-100, deal_risk: 0-100, buy_intent: 0-100, engagement: 0-100}

    stage:
      current: primeiro_contato | cotacao_enviada | negociacao |
               negociacao_stalled | perdido | ganho
      days_stalled: número
      last_milestone: "descrição"

    root_causes[]: [{cause, severity: low/medium/high/critical, confidence: 0-1}]

    evidence_snippets[]: [{timestamp, sender, text, related_cause}]

    objections[]: [{type: preco/prazo/marca/condicoes_comerciais/processo,
                    status: open/resolved/recurring, snippet}]

    alerts[]: [{level: info/warning/critical, message}]

    playbook: {goal, rules_of_game[], when_to_compete[], when_to_decline[]}

    next_best_action: {action, priority: low/medium/high/urgent,
                       rationale, suggested_message (máx 300 chars)}

    relationship_risk: {level: low/medium/high/critical, events[]}

    prontuario_ptbr: {
      visao_geral, necessidades_contexto, estado_atual_scores,
      causas_principais, oportunidades_sinais_positivos,
      recomendacoes_objetivas, mensagem_pronta
    }

ETAPA F — Priority Score (algoritmo determinístico real)
  inactivityPoints:
    bucket '30'  → +10 pts
    bucket '60'  → +20 pts
    bucket '90+' → +30 pts

  priorityScore = MIN(100, ROUND(
    inactivityPoints +
    deal_risk * 0.4 +           ← risco alto → score alto
    (100 - buy_intent) * 0.2 +  ← baixa intenção → score alto
    (100 - engagement) * 0.2 +  ← baixo eng → score alto
    MIN(maxSilenceGapDays * 2, 15)  ← até +15pts por silêncio
  ))

  Labels: CRÍTICO ≥75 | ALTO ≥55 | MÉDIO ≥35 | BAIXO <35

  Root causes sintéticas:
  → unansweredFollowups ≥ 3 → "X follow-ups sem resposta"
  → daysInactiveInbound > 7 → "Cliente sem responder há X dias"
  → objecoes.length > 0 → "N objeção(ões) ativa(s)"
  → health < 40 → "Saúde baixa do relacionamento"

ETAPA G — Persistência dupla
  1. ContactBehaviorAnalysis.create({
       status: 'ok',
       insights_v2: {...},         ← FONTE DA VERDADE (JSONB completo)
       prontuario_text: "...",     ← texto concatenado para leitura rápida
       priority_score, priority_label,
       bucket_inactive, days_inactive_inbound,
       relationship_profile, scores, stage,
       root_causes, objections, alerts,
       playbook, next_best_action, relationship_risk,
       ai_insights: {...},          ← campo legado (compatibilidade)
     })

  2. Contact.update({
       score_engajamento: engagement,
       segmento_atual: (calculado),
       estagio_ciclo_vida: stage.current,
       cliente_score: priorityScore,
       campos_personalizados: {
         deal_risk_cached, buy_intent_cached, health_cached, engagement_cached,
         relationship_profile_type, relationship_profile_flags,
         relationship_risk_level, relationship_risk_events_count,
         bucket_inactive, days_inactive_inbound,
         playbook_goal, playbook_when_to_compete, playbook_when_to_decline,
         last_analysis_status, last_analysis_at, last_analysis_priority_label
       }
     })

ETAPA H — Hook pós-análise
  → Invoca acionarAutomacoesPorPlaybook({contact_id, analysis_id})
  → Erros aqui são logados mas não param o retorno de sucesso
```

**Segmentação automática (helper interno):**
- `risco_churn` → deal_risk > 70 AND bucket = '90+'
- `lead_quente` → buy_intent > 70 AND deal_risk < 30
- `lead_morno` → buy_intent > 40 AND deal_risk < 50
- `lead_frio` → bucket = '90+'
- `cliente_ativo` → fallback padrão

---

### 📦 `analisarClientesEmLote` — Orquestrador de Prontuários
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.8.6`
**Scheduling:** Automação scheduled a cada 1 hora (modo scheduled)

**3 modos distintos:**

**MODO 1 — Direto (IDs específicos, chamado pela UI)**
```
→ Recebe contact_ids[]
→ Para cada: invoca analisarComportamentoContato com delay 300ms
→ Retorna {total, sucesso, erro, erros[]}
```

**MODO 2 — Priorização (chamado pela UI de Contatos Inteligentes)**
```
→ Filtra Contact por tipo_contato + inatividade (bucket)
  → bucket_inactive: '30'|'60'|'90'|'all'|null
  → null → dias = MAX(diasSemMensagem, 2) — default 2 dias
→ Promise.all para buscar em paralelo:
  → ContactBehaviorAnalysis últimas 7 dias
  → MessageThreads canônicas (is_canonical=true)
→ Para cada contato:
  CASO 1 — Sem análise ou status=insufficient_data/error:
    → Usa inatividade como proxy de score
    → daysInactive ≥90 → 75pts (CRITICO)
    → daysInactive ≥60 → 60pts (ALTO)
    → daysInactive ≥30 → 40pts (MEDIO)
    → default → 10pts (BAIXO)
    → suggested_message genérica por nome
  CASO 2 — Com análise válida:
    → Extrai deal_risk, buy_intent, engagement, health, stage
    → Filtro DUPLO: (daysInactiveInbound ≥ bucket) OR (deal_risk ≥ minDealRisk)
    → Só exclui se NÃO passar por NENHUM critério
    → DTO padronizado: campos snake_case + camelCase (para compatibilidade UI)
→ Ordena por prioridadeScore DESC
→ Retorna estatísticas:
  {criticos, altos, porPrioridade, porBucket, scoresMedios}
```

**MODO 3 — Scheduled (automático a cada hora)**
```
→ Contact.filter({tipo_contato: ['lead','cliente'],
                  ultima_interacao: {$gte: 90d atrás}}, limit=50)
→ Para cada contato:
  → Verifica análise < 24h → PULA (não recalcula desnecessariamente)
  → Invoca analisarComportamentoContato com delay 200ms
→ Retorna {total_processados, analises_criadas, analises_puladas, erros[]}
```

---

### 🎯 `acionarAutomacoesPorPlaybook` — Hook Pós-Análise
**Status:** ✅ Ativo (corrigido 2026-03-09 — bug 401 por auth.me())
**SDK:** `@base44/sdk@0.8.20`

**Responsabilidade:** Aplicar regras de negócio baseadas no resultado do prontuário. Chamado automaticamente por `analisarComportamentoContato`.

**4 regras implementadas:**
```
REGRA 1 — when_to_decline
  → Se playbook.when_to_decline[] tem regras E se aplicam ao contato:
    → "preço|benchmark" → se deal_risk > 70
    → "volume|genérica" → se engagement < 40
  → Cria WorkQueueItem:
    tipo='avaliar_potencial', severity='low'
    scheduled_for = agora + 7 dias
    payload = {playbook_rules_matched, analysis_id, hook_criativo}

REGRA 2 — when_to_compete
  → Se playbook.when_to_compete[] tem regras E se aplicam:
  → Busca thread canônica
  → MessageThread.update(campos_personalizados):
    playbook_status = 'compete'
    hook_criativo_sugerido = gerado
    last_playbook_check = agora

REGRA 3 — relationship_risk HIGH/CRITICAL
  → Busca thread canônica
  → Cria WorkQueueItem:
    tipo='reativacao', severity='high'/'critical'
    scheduled_for = agora + 24h
    payload = {risk_events, playbook_goal, suggested_action, hook_criativo}

REGRA 4 — Auto-decline (deal_risk>70 + engagement<40)
  → Adiciona tag 'auto_decline_generic_quotes' no Contact
  → Evita envio de cotações genéricas para contatos sem chance

GERADOR DE HOOK CRIATIVO (helper interno — 5 casos):
  1. relationship_risk high/critical → personalizacao_extrema
     "Você mencionou que {tema}... achei solução específica pra isso."
  2. price_sensitive + process_formal → contraste_provocacao
     "Aviso: você provavelmente está pagando a mais nessa categoria..."
  3. deal_risk<50 + engagement<40 → autoridade_prova_social
     "3-5 empresas no seu ramo já fazem isso conosco. Quer saber como?"
  4. cliente_fidelizado + negociacao_stalled → reciprocidade_valor
     "Fiz análise do seu histórico. Dá pra economizar ~15%..."
  5. default → curiosidade_scarcity
     "⏰ Achei algo que você pediu... mas só 2 unidades nesse preço."
```

---

### ⏰ `executarFluxosAgendados` — v2.0
**Status:** ✅ Ativo (reescrito 2026-03-09 — import local quebrado removido)
**SDK:** `@base44/sdk@0.8.20`
**Scheduling:** Automação scheduled a cada 5-10 minutos

**O que faz:**
```
→ FlowExecution.filter({
    status: 'waiting_follow_up',
    next_action_at: {$lte: agora}
  }, limit=20)
→ Para cada:
  → Invoca playbookEngine({action: 'continue_follow_up', execution_id})
  → Se falha: FlowExecution.update(status='erro') + registra execution_history
→ Retorna {total, sucessos, erros}
```

---

### 🎬 `playbookEngine` — v4 (Motor de Execução)
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.7.1`

**Actions disponíveis:**
```
'start' → iniciarExecucao(contact_id, flow_template_id)
  → Busca/cria MessageThread para o contato
  → FlowExecution.create(status='ativo', current_step=0)
  → Executa step 0

'process_response' → processarResposta(execution_id, user_response)
  → Valida input (opcoes, tipo, email, número)
  → Se inválido: retry ou escalação após max_tentativas
  → Se válido: armazena em variables, avança step

'continue_follow_up' → continuarFollowUp(execution_id)
  → Chamado por executarFluxosAgendados
  → current_step + 1
  → Se fim: verifica taxa engajamento
    → taxaEngajamento < 30% + auto_escalate_to_human → escala
    → Senão: finaliza

'cancel' → cancelarExecucao(execution_id)
```

**Tipos de Step suportados:**
```
'message'    → envia WhatsApp + registra Message
              → Se delay_days: status='waiting_follow_up', calcula next_action_at
'input'      → retorna 'wait_input' com campo + opcoes
'ia_classify'→ nexusClassifier → intent → atualiza variables + score do cliente
'action'     → criarLead | agendarFollowUp | enviarOrcamento | atribuirVendedor
'delay'      → pausa por delay_days ou delay_seconds
'end'        → finaliza execução
```

**Escalação para humano (BUG REAL):**
```javascript
// Linha 495 — notifica TODOS os admins, não o atendente responsável
const admins = await base44.asServiceRole.entities.User.filter(
  { role: 'admin' }, 'full_name', 5
);
// ← Nunca busca contact.vendedor_responsavel nem thread.assigned_user_id
```

---

### 📥 `processInbound` — v11.0.0
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.8.20`

**Pipeline completo em ordem exata:**
```
1. IDEMPOTÊNCIA
   → Message.filter({whatsapp_message_id, integration_id})
   → Se > 1 resultado: retorna {skipped: true, reason: 'duplicate'}

2. RESET PROMOÇÕES
   → Se thread tem autoboost_stage/last_boost_at: reset

3. ENGAGEMENT STATE
   → ContactEngagementState ativo? → status='paused'

4. HARD-STOP: HUMANO ATIVO
   humanoAtivo(thread) = true SE:
     assigned_user_id existe
     AND last_human_message_at < 2h atrás
     AND pre_atendimento_ativo = false
   → SE ativo: {stop: true, reason: 'human_active'}

5. AGENDA IA CHECK
   → thread.assistant_mode === 'agenda'
     OR integration.nome_instancia === 'NEXUS_AGENDA_INTEGRATION'
   → SE sim: routeToAgendaIA → STOP

6. CLAUDE AGENDA (keyword detection — antes da URA)
   → Regex: /(agendar|agendamento|marcar|desmarcar|reagendar|remarcar|
              cancelar|horário|horario|disponível|disponivel|consulta|
              visita|reunião|reuniao)/
   → SE detectado E integration.id existe → claudeAgendaAgent → STOP
   ⚠️ BUG: se integration.id ausente no payload → pulado silenciosamente

7. CICLO DETECTION + DECISÃO URA
   novoCiclo = lastInboundAt NULL OR gap >= 12h

   shouldDispatch = true se QUALQUER:
   a) pre_atendimento_ativo = true (URA já rodando)
   b) novoCiclo = true
   c) humanoDormant (atribuído mas last_human_message > 2h) + msg > 4 chars
   d) assigned_user_id = null (sem atendente)

   SE shouldDispatch:
   → FlowTemplate.filter({is_pre_atendimento_padrao: true, ativo: true}, limit=1)
   ⚠️ BUG CRÍTICO: Hoje = 0 FlowTemplates com is_pre_atendimento_padrao=true
   → Retorna: {stop: true, reason: 'pre_atendimento_desativado'}
   → IMPACTO: URA nunca é acionada. Cliente NUNCA é perguntado "qual setor?"
   → Todo o pipeline cai no fallback do Claude para TUDO

8. CLAUDE AI RESPONDER (FALLBACK — ativa hoje porque URA está morta)
   → message.sender_type = 'contact' AND content > 2 chars
   ⚠️ BUG: integration.id ausente → skipped silenciosamente
   → claudeWhatsAppResponder({thread_id, contact_id, content, integration_id, provider})
```

---

### 🤖 `claudeWhatsAppResponder` — v2.1.0
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.8.20` | **IA:** Anthropic `claude-3-5-haiku-20241022`

**O que faz de verdade:**
```
→ Recebe: thread_id, contact_id, message_content, integration_id, provider
→ Promise.all em paralelo:
  → Message.filter({thread_id}, limit=12) → histórico
  → Contact.get(contact_id)
  → WhatsAppIntegration.get(integration_id)

→ Análise da mensagem (keywords simples):
  → urgente: 'urgente', 'emergência', 'quebrou', 'não funciona', 'procon', ...
  → querHumano: 'falar com atendente', 'quero humano', 'chamar gerente', ...
  → intencao: VENDAS | SUPORTE | FINANCEIRO | FORNECEDOR | GERAL (regex)

→ SE urgente OR querHumano:
  → Envia mensagem de transição para o cliente
  → Invoca preAtendimentoHandler para URA
  → Retorna {action: 'escalated_to_human'}

→ SE não precisa escalar:
  → Monta histórico para Claude (últimas 12 msgs, inverte para ASC)
  → System prompt inclui:
    - Dados da empresa (Liesch Informática — hardcoded)
    - Produtos e serviços
    - Políticas de pagamento, garantia, troca
    - Emails por setor
    - Nome do contato para personalização
  → Chama Claude com timeout 15s + 2 retries (backoff 1.5s * tentativa)
  → model: claude-3-5-haiku-20241022
  → max_tokens: 600
  → Envia resposta via enviarMensagem (Z-API ou W-API diretamente)
  → Message.create com metadata completa

→ Fallback de erro:
  → Se Claude falha após retries: envia msg humanizada ao cliente
  → "Desculpe, tivemos uma instabilidade. Nossa equipe foi notificada."

⚠️ LIMITAÇÃO: Dados da empresa são hardcoded no código
   Mudança de produto/serviço requer alterar o código, não o banco.
⚠️ LIMITAÇÃO: Não consulta ContactBehaviorAnalysis antes de responder
   Claude não sabe o histórico de risco/intenção do contato.
```

---

### 📅 `claudeAgendaAgent`
**Status:** ✅ Ativo e funcional
**IA:** Anthropic Claude

**O que faz de verdade:**
```
→ Ativado por: palavras-chave de agendamento no processInbound
→ Capabilities reais:
  → Criar agendamento: verifica disponibilidade no banco (Agendamento entity)
  → Consultar agendamentos do contato
  → Cancelar/reagendar: atualiza Agendamento no banco
  → Valida horário de funcionamento, serviços, duração
  → Responde em PT-BR com tom profissional
→ Contexto: Agendamentos existentes, serviços configurados
→ Fuso: America/Sao_Paulo
```

---

### 💼 `businessIA`
**Status:** ✅ Ativo mas ISOLADO (só UI, não integrado ao ciclo do agente)
**SDK:** `@base44/sdk@0.7.1`

**4 actions disponíveis:**
```
'strategic_insights' → gerarInsightsEstrategicos(base44)
  → Lê últimos 30 dias: FlowTemplate, FlowExecution, Venda, MessageThread
  → Detecta: queda >20% em playbook, engajamento <30%, variação receita >25%
  → Retorna array de insights: {tipo, severidade, titulo, descricao, confianca}

'detect_anomalies' → detectarAnomalias(base44, {playbook_id, periodo_dias})
  → Agrupa FlowExecution por dia
  → Detecta quedas abruptas >30% dia-a-dia
  → Retorna: [{tipo, dia, variacao_percentual, taxa_anterior, taxa_atual}]

'predict_30_days' → preverProximos30Dias(base44)
  → Calcula: receitaAtual, ticketMedio, taxaConversao, pipelineValor
  → Projeta: leads_esperados, conversoes_esperadas, receita_esperada
  → Lê: Venda, FlowExecution, Orcamento(status: enviado/negociando/liberado)

'recommend_actions' → recomendarAcoes(base44)
  → Roda strategic_insights
  → Busca threads com unread>0 e last_sender='contact'
  → Se >10 threads pendentes: gera recomendação de alta prioridade
  → Retorna: [{prioridade, titulo, descricao, passos[], prazo}]

⚠️ PROBLEMA REAL: businessIA não é invocado por ninguém automaticamente.
   Apenas a UI do Dashboard o chama. O Jarvis não sabe o que businessIA retorna.
   → O agente age sem saber se o negócio está em crise ou crescendo.
```

---

### 🎯 `nexusClassifier`
**Status:** ✅ Ativo
**SDK:** `@base44/sdk@0.7.1`

**2 actions:**
```
'classify_intention' → classifyIntention(base44, {mensagem, contexto})
  → Prompt LLM → JSON {intent, confidence, reasoning, entities}
  → Fallback por keywords se LLM falhar
  → Intents: vendas | suporte | financeiro | informacao | outro

'query_rag' → queryRAG(base44, {pergunta, contexto, limit=5})
  → BaseConhecimento.filter({ativo: true}, '-relevancia_score', 50)
  → Score de relevância por palavras comuns (simples, não embedding)
  → Filtra: relevancia > 0.3
  → Monta prompt com contextos encontrados
  → Retorna: {resposta, is_confident, conhecimentos[]}
  ⚠️ LIMITAÇÃO: busca por palavras, não por semântica/embeddings
  ⚠️ LIMITAÇÃO: BaseConhecimento precisa ser populada manualmente
```

---

### 🚪 `preAtendimentoHandler` — v11.0.0
**Status:** ✅ Ativo e funcional
**SDK:** `@base44/sdk@0.8.20`

**O que faz de verdade:**
```
→ URA (Unidade de Resposta Automática) de pré-atendimento
→ Gerencia máquina de estados para cada thread:

Estados e transições:
  INIT → menu de setores (ou sticky se teve setor anterior)
    → Se intent_context.confidence ≥ 70 → fast-track direto para roteamento
    → Se thread.sector_id existe → pergunta se quer continuar no mesmo setor
    → Senão → menu "1-Vendas, 2-Financeiro, 3-Suporte, 4-Fornecedores"

  WAITING_SECTOR_CHOICE → parseando resposta do cliente
    → Reconhece: '1'/'vendas'/'comercial' → setor 'vendas'
    → Reconhece: '2'/'financeiro'/'boleto' → setor 'financeiro'
    → Reconhece: '3'/'suporte'/'tecnico' → setor 'assistencia'
    → Reconhece: '4'/'fornecedor'/'compras' → setor 'fornecedor'
    → Se inválido: re-envia menu

  WAITING_STICKY_DECISION → sim/não para continuar no mesmo setor

  WAITING_ATTENDANT_CHOICE → busca atendente disponível
    → Invoca roteamentoInteligente({thread_id, contact_id, sector})
    → Se atendente encontrado: "Encontrei [nome], transferindo..."
    → Senão: pergunta se quer entrar na fila

  WAITING_QUEUE_DECISION → sim/não para entrar na fila
    → Sim: gerenciarFila({action: 'enqueue'})
    → Não: volta ao INIT

→ Política de libertação: estados COMPLETED/CANCELLED/TIMEOUT → reset para INIT
→ Timeout de 10 minutos por step sem resposta → reset para INIT

⚠️ PROBLEMA REAL: Este handler está funcional e completo,
   MAS nunca é acionado porque processInbound bloqueia na verificação
   de FlowTemplate(is_pre_atendimento_padrao=true) antes de chegar aqui.
   O preAtendimentoHandler está pronto. Falta 1 FlowTemplate no banco.
```

---

## 1.2 — Funções de Suporte (ativas, não são IA CORE)

| Função | Status | O que faz |
|---|---|---|
| `enviarWhatsApp` | ✅ Ativo | Gateway unificado Z-API/W-API/Evolution. Todos os tipos de mídia. |
| `webhookFinalZapi` | ✅ Ativo | Recebe webhooks Z-API, normaliza, cria Contact/Thread/Message |
| `webhookWapi` | ✅ Ativo | Recebe webhooks W-API, normaliza, cria Contact/Thread/Message |
| `roteamentoInteligente` | ✅ Ativo | Busca atendente disponível por setor para assignar conversa |
| `getOrCreateInternalThread` | ✅ Ativo | Cria thread interna entre agente e atendente |
| `gerenciarFila` | ✅ Ativo | Enfileira thread quando sem atendente disponível |
| `runPromotionBatchTick` | ✅ Ativo | Worker de promoções em lote |
| `runPromotionInboundTick` | ✅ Ativo | Worker de promoções inbound |
| `processarFilaBroadcast` | ✅ Ativo | Worker de broadcasts |
| `enviarCampanhaLote` | ✅ Ativo | Envia campanhas em lote (Z-API ou W-API) |
| `gerarSugestoesRespostaContato` | ✅ Ativo | Copiloto: sugere respostas para atendente na UI |

## 1.3 — Funções Deletadas / Obsoletas

| Função | Status | Motivo |
|---|---|---|
| `enviarMensagemMassa` | ✅ DELETADA 2026-03-09 | Wrapper morto → enviarCampanhaLote |
| `enviarPromocoesLote` | ✅ DELETADA 2026-03-09 | Wrapper morto → enviarCampanhaLote |
| Tudo em `_OBSOLETAS_PARA_DELETAR.md` | ⏳ Pendente | Verificar UIs dependentes antes |
| `analisarComportamentoContatoIA` | ⚠️ Verificar | Possível duplicata de analisarComportamentoContato |
| `analisarScorePreditivo` | ⚠️ Verificar | Possível duplicata de lógica no analisarComportamentoContato |

---

# PARTE 2 — FLUXO REAL DO WEBHOOK ATÉ A RESPOSTA

```
╔══════════════════════════════════════════════════════════════════╗
║  CLIENTE MANDA MENSAGEM WHATSAPP                                 ║
╚══════════════════════════════════════════════════════════════════╝
                              │
            ┌─────────────────┴──────────────────┐
            │                                    │
     webhookFinalZapi                       webhookWapi
     (Z-API)                                (W-API)
            │                                    │
            └─────────────────┬──────────────────┘
                              │
                  [Processamento síncrono — ~200ms]
                              │
              1. NORMALIZA payload
                 → Extrai: phone, name, text, media_type
                 → Normaliza telefone (remove +55, dígito 9, etc.)
                 → Filtra: groups, status, reactions → DROP
                              │
              2. DEDUPLICAÇÃO (whatsapp_message_id)
                 → Já existe? → 200 OK silencioso
                              │
              3. BUSCA/CRIA Contact
                 → Busca por telefone_canonico
                 → Se não existe: Contact.create(tipo='novo')
                              │
              4. BUSCA/CRIA MessageThread
                 → Busca thread canônica (is_canonical=true)
                 → Cria se não existe
                 → Atualiza: last_message_at, last_inbound_at, unread_count++
                              │
              5. PERSISTE Message
                 → Message.create(whatsapp_message_id, status='recebida')
                              │
              6. MÍDIA? → spawn async persistirMidia (não bloqueia)
                              │
              7. CHAMA processInbound (async, não bloqueia webhook)
                 → Retorna 200 para o provider imediatamente
                              │
                              ▼
╔══════════════════════════════════════════════════════════════════╗
║  processInbound v11 — Pipeline de Decisão                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  STEP 1: Dedup (2ª verificação) ─────────────── DUPLICATA? STOP ║
║  STEP 2: Reset funil promoções                                   ║
║  STEP 3: Pausa ContactEngagementState ativo                      ║
║                                                                  ║
║  STEP 4: HUMANO ATIVO?                                           ║
║  → last_human_message_at < 2h AND assigned AND não-URA? ─► STOP ║
║                                                                  ║
║  STEP 5: MODO AGENDA?                                            ║
║  → assistant_mode='agenda' → routeToAgendaIA ──────────► STOP  ║
║                                                                  ║
║  STEP 6: KEYWORD AGENDA? (agendar|marcar|horário|...)            ║
║  → claudeAgendaAgent ──────────────────────────────────► STOP  ║
║  ⚠️ SE integration.id ausente → pulado silenciosamente          ║
║                                                                  ║
║  STEP 7: shouldDispatch URA?                                     ║
║  → novoCiclo OR uraAtiva OR humanoDormant OR semAtendente?       ║
║  → SE SIM: busca FlowTemplate(is_pre_atendimento_padrao=true)    ║
║  → ⚠️ HOJE: 0 ENCONTRADOS → {stop, reason:'pre_atendimento_    ║
║                                              desativado'}        ║
║  → SE ENCONTRADO: preAtendimentoHandler ──────────────► STOP   ║
║                                                                  ║
║  STEP 8: FALLBACK — claudeWhatsAppResponder                      ║
║  (Único caminho ativo hoje para a maioria das mensagens)         ║
║  ⚠️ SE integration.id ausente → skipped silenciosamente         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
                              │
                    [PARALELO — Background Schedulers]
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    A cada 1h            A cada 30min         A cada 5min
         │                    │                    │
analisarClientesEmLote   jarvisEventLoop v3    executarFluxos
(modo scheduled)         (NexusAgentLoop)      Agendados v2
         │                    │                    │
         ▼                    ▼                    ▼
  Atualiza prontuário  Detecta threads       Avança FlowExec
  ContactBehaviorAn.   ociosas → decide      waiting_follow_up
  para todos os        CRÍTICO/ALTO/MÉDIO/   via playbookEngine
  leads/clientes       BAIXO → age
  ativos (90d)
         │
         ▼
acionarAutomacoesPor
Playbook (hook)
→ Cria WorkQueueItems
→ Atualiza tags
→ Marca threads prioritárias
```

---

# PARTE 3 — O QUE ESTÁ FUNCIONANDO (pode aproveitar sem reescrita)

| Componente | O que funciona | Confiabilidade |
|---|---|---|
| Webhook Z-API (`webhookFinalZapi`) | Recebe, normaliza, cria Contact/Thread/Message | ✅ Alta |
| Webhook W-API (`webhookWapi`) | Idem para W-API | ✅ Alta |
| `enviarWhatsApp` | Gateway unificado, todos os tipos de mídia | ✅ Alta |
| `processInbound` v11 | Pipeline de roteamento, dedup, reset promos | ✅ Alta |
| `claudeWhatsAppResponder` v2.1 | Resposta automática com retry, timeout, fallback | ✅ Alta |
| `claudeAgendaAgent` | Agendamentos completos com validação de disponibilidade | ✅ Alta |
| `preAtendimentoHandler` v11 | Máquina de estados completa, pronta para uso | ✅ Alta |
| `analisarComportamentoContato` v3 | Prontuário completo com IA + scores determinísticos | ✅ Alta |
| `analisarClientesEmLote` | 3 modos: scheduled/priorização/direto | ✅ Alta |
| `jarvisEventLoop` v3.0 | Loop autônomo com decisão por prontuário | ✅ Alta |
| `acionarAutomacoesPorPlaybook` | Hook pós-análise com 4 regras de negócio | ✅ Alta |
| `executarFluxosAgendados` v2 | Worker de follow-ups agendados | ✅ Alta |
| `playbookEngine` v4 | Execução de flows: mensagem, input, ação, delay | ✅ Alta |
| `businessIA` | Insights de negócio, anomalias, previsão | ✅ Alta (isolado) |
| `nexusClassifier` | Classificação de intenção + RAG básico | ✅ Média |
| `roteamentoInteligente` | Busca atendente disponível por setor | ✅ Alta |
| `getOrCreateInternalThread` | Threads internas entre usuários | ✅ Alta |

---

# PARTE 4 — GAPS REAIS COM EVIDÊNCIA DE CÓDIGO

## GAP 1 — URA nunca dispara (CRÍTICO — bloqueia pré-atendimento)
**Evidência direta do código:**
```javascript
// processInbound.js linha 176-184
const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
  is_pre_atendimento_padrao: true,  // ← ZERO registros com este campo = true
  ativo: true
}, '-created_date', 1);

if (!playbooks?.length) {
  result.actions.push('ura_blocked_no_playbook');
  return Response.json({
    ...stop: true, reason: 'pre_atendimento_desativado'  // ← SEMPRE retorna isso
  });
}
```
**Impacto real:** Toda mensagem que deveria passar pela URA cai direto no Claude. O cliente nunca é perguntado "qual setor?". Setores ficam sem roteamento automático.
**Solução:** Criar 1 FlowTemplate no banco (ver Fase 2).
**Custo:** Nenhuma linha de código nova. Apenas inserção de dados.

---

## GAP 2 — Orçamentos: Jarvis vê apenas "enviado" >7d (ALTO)
**Evidência:**
```javascript
// jarvisEventLoop STEP 3
const orcamentosParados = await base44.asServiceRole.entities.Orcamento.filter({
  status: 'enviado',    // ← SÓ 'enviado'
  updated_date: { $lt: seteDiasAtras.toISOString() }  // ← SÓ >7 dias
}, '-updated_date', 10);
```
**O que o Jarvis NÃO vê:**
- `status: 'negociando'` parado há 3+ dias → cliente esfriando em negociação ativa
- `status: 'vencido'` há < 14 dias → janela de reativação perdida
- `status: 'rejeitado'` há < 30 dias → causa não analisada
**Solução:** Estender Step 3 do jarvisEventLoop (ver Fase 3).

---

## GAP 3 — playbookEngine escala para admins, não para o atendente (MÉDIO)
**Evidência:**
```javascript
// playbookEngine linha 495-508
const admins = await base44.asServiceRole.entities.User.filter(
  { role: 'admin' }, 'full_name', 5
);
for (const admin of admins) {
  await base44.asServiceRole.entities.NotificationEvent.create({
    usuario_id: admin.id,  // ← TODOS os admins
    // ← NUNCA busca contact.vendedor_responsavel
    // ← NUNCA busca thread.assigned_user_id
  });
}
```
**Impacto:** Atendente que está gerenciando o cliente não recebe a notificação de escalação. Administradores recebem alertas de conversas que não são suas.

---

## GAP 4 — claudeWhatsAppResponder não consulta prontuário (MÉDIO)
**Evidência:**
```javascript
// claudeWhatsAppResponder.js
// O system prompt NUNCA inclui dados de ContactBehaviorAnalysis
// Dados hardcoded da empresa, nome do contato, histórico de mensagens
// ← Não sabe: deal_risk, buy_intent, relationship_profile, objeções ativas
```
**Impacto:** Claude responde sem saber se o cliente está em risco, se é price-sensitive, se tem objeções abertas. Pode oferecer promoções para contatos marcados como auto_decline, ou não priorizar contatos CRÍTICO.

---

## GAP 5 — Prontuário não lê dados de Orçamentos/Vendas (MÉDIO)
**Evidência:**
```javascript
// analisarComportamentoContato.js
// ETAPA B — apenas:
const threads = await base44.asServiceRole.entities.MessageThread.filter({contact_id});
const mensagens = await base44.asServiceRole.entities.Message.filter({thread_id: {$in: threadIds}});
// ← Nunca busca: Orcamento, Venda, Interacao
```
**Impacto:** deal_risk calculado sem histórico de compras reais. Um cliente com R$200k em orçamentos aprovados mas que não respondeu há 5 dias pode ter o mesmo score que um lead frio.

---

## GAP 6 — businessIA isolado da tomada de decisão (MÉDIO)
**Evidência:** Não existe nenhuma invocação de `businessIA` dentro do `jarvisEventLoop`.
**Impacto:** O agente toma decisões de "quem alertar" e "com que urgência" sem saber se o negócio está em crise (receita -40%) ou crescendo normalmente. A sensibilidade deveria ser dinâmica.

---

## GAP 7 — integration.id pode chegar null no processInbound (MÉDIO)
**Evidência:**
```javascript
// processInbound v11 linhas 134-136 e 214-217
if (!integration?.id) {
  console.warn(`⚠️ integration.id ausente — claudeAgendaAgent não pode ser acionado`);
  // PARA SILENCIOSAMENTE
}
```
**Impacto:** Mensagens de integrações com ID mal configurado ficam sem resposta automática e sem URA. Silencioso — não aparece como erro, apenas como não-processamento.

---

## GAP 8 — nexusClassifier usa busca por palavras, não embeddings (BAIXO)
**Evidência:**
```javascript
// nexusClassifier.js — calcularRelevancia()
palavrasPergunta.forEach(palavra => {
  if (tituloLower.includes(palavra)) score += 0.3;  // ← string.includes
  if (conteudoLower.includes(palavra)) score += 0.1;
});
// ← Não usa embeddings vetoriais. "computador" não encontra "notebook".
```
**Impacto:** RAG de baixa qualidade semântica. Funcional para termos exatos, falha em sinônimos e variações.

---

# PARTE 5 — ARQUITETURA PROPOSTA (modelo de agentes Anthropic)

```
╔═══════════════════════════════════════════════════════════════════╗
║          AGENTE ORQUESTRADOR CENTRAL (Nexus Agent Loop)          ║
║                    jarvisEventLoop v3.x                           ║
╠═══════════════════════════════════════════════════════════════════╣
║  CICLO A CADA 30MIN:                                              ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ STEP 0 [NOVO]: Contexto do negócio                          │  ║
║  │  → businessIA('detect_anomalies') → ajusta sensibilidade    │  ║
║  │  → Crise (receita -30%) → sensibilidadeBoost +10pts         │  ║
║  │  → Normal → sem ajuste                                      │  ║
║  ├─────────────────────────────────────────────────────────────┤  ║
║  │ STEP 1: Threads ociosas + prontuário → CRÍTICO/ALTO/MÉD/    │  ║
║  │         BAIXO → age (já funciona)                           │  ║
║  ├─────────────────────────────────────────────────────────────┤  ║
║  │ STEP 2 [EXPANDIR]: Orçamentos                               │  ║
║  │  → 'negociando' >3d → alerta interno atendente              │  ║
║  │  → 'enviado' >7d → TarefaInteligente (já existe)            │  ║
║  │  → 'vencido' <14d → WorkQueueItem reativação                │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
╚════════════════════╤══════════════════════════════════════════════╝
                     │ delega para
     ┌───────────────┼────────────────────────────────┐
     │               │                                │
     ▼               ▼                                ▼
┌──────────┐  ┌─────────────────┐  ┌──────────────────────────────┐
│ MOTOR DE │  │  AGENTES DE     │  │  CAMADA DE COMUNICAÇÃO       │
│PRONTUÁRIO│  │  AÇÃO           │  │                              │
│          │  │                 │  │  claudeWhatsApp              │
│ analisar │  │ playbookEngine  │  │  Responder v2.1              │
│Comporta- │  │ (FlowTemplates) │  │  → fallback 24/7             │
│mento     │  │                 │  │  → com contexto empresa      │
│Contato   │  │ acionarAutoma-  │  │  → retry + timeout           │
│          │  │ coesPorPlaybook │  │                              │
│ analisar │  │                 │  │  claudeAgendaAgent           │
│Clientes  │  │ executarFluxos  │  │  → criação/consulta/cancel   │
│EmLote    │  │ Agendados       │  │                              │
│(scheduler│  │                 │  │  preAtendimento              │
│)         │  │                 │  │  Handler (URA)               │
└──────────┘  └─────────────────┘  │  → roteamento por setor     │
                                   │  → fila de espera            │
                                   └──────────────────────────────┘
```

**Princípio de design:**
- O orquestrador central (Jarvis) é o único que toma decisões de prioridade
- Agentes especializados executam, não decidem
- Cada função tem 1 responsabilidade clara
- Nenhuma função reimplementa lógica de outra

---

# PARTE 6 — ROADMAP DETALHADO (ordem de dependência)

## ✅ Fase 1 — CONCLUÍDA (2026-03-09)
- [x] Deletar `enviarMensagemMassa` e `enviarPromocoesLote` (wrappers mortos)
- [x] Corrigir `acionarAutomacoesPorPlaybook` (bug 401 por auth.me() sem user)
- [x] Reescrever `executarFluxosAgendados` v2 (import local quebrado)
- [x] Refatorar `jarvisEventLoop` v3.0 (consulta prontuário antes de agir)

---

## 🔥 Fase 2 — URA Mínima Ativa (PRÓXIMA — sem código novo)
**Dependências:** Fase 1 ✅
**Esforço:** Apenas inserção de 1 registro no banco
**Impacto:** A URA passa a funcionar para 100% das mensagens novas

**O que fazer:**
Criar este FlowTemplate no banco (via UI de Automações ou diretamente):
```json
{
  "nome": "Pré-atendimento Padrão Nexus360",
  "categoria": "geral",
  "tipo_fluxo": "pre_atendimento",
  "is_pre_atendimento_padrao": true,
  "ativo": true,
  "activation_mode": "global",
  "gatilhos": ["*"],
  "steps": [
    {
      "type": "buttons",
      "texto": "Olá! Para qual área você precisa de atendimento?",
      "opcoes": ["💼 Vendas", "🔧 Suporte", "💰 Financeiro", "📦 Fornecedores"]
    },
    {
      "type": "route",
      "mapa": {
        "💼 Vendas": "vendas",
        "🔧 Suporte": "assistencia",
        "💰 Financeiro": "financeiro",
        "📦 Fornecedores": "fornecedor"
      }
    },
    {
      "type": "end",
      "texto": "Perfeito! Aguarde um momento enquanto conectamos você."
    }
  ],
  "mensagem_saudacao": "Olá {saudacao}! Bem-vindo à Liesch Informática.",
  "opcoes_setor": [
    {"label": "💼 Vendas", "setor": "vendas"},
    {"label": "🔧 Suporte", "setor": "assistencia"},
    {"label": "💰 Financeiro", "setor": "financeiro"}
  ]
}
```

---

## 📊 Fase 3 — Jarvis vê mais orçamentos (estender Step 3)
**Dependências:** Fase 1 ✅
**Esforço:** Pequeno — editar jarvisEventLoop Step 3

```javascript
// SUBSTITUIR o Step 3 atual por:

// 3a. Orçamentos 'negociando' travados >3 dias → alerta ao atendente
const negociandoTravados = await base44.asServiceRole.entities.Orcamento.filter({
  status: 'negociando',
  updated_date: { $lt: new Date(agora.getTime() - 3*24*60*60*1000).toISOString() }
}, '-updated_date', 10);

for (const orc of negociandoTravados) {
  // Buscar atendente responsável e criar alerta interno
}

// 3b. Orçamentos 'enviado' >7 dias → TarefaInteligente (já existe — manter)
const enviados = await base44.asServiceRole.entities.Orcamento.filter({
  status: 'enviado',
  updated_date: { $lt: seteDiasAtras.toISOString() }
}, '-updated_date', 10);

// 3c. Orçamentos 'vencido' <14 dias → WorkQueueItem reativação
const vencidosRecentes = await base44.asServiceRole.entities.Orcamento.filter({
  status: 'vencido',
  updated_date: { $gte: new Date(agora.getTime() - 14*24*60*60*1000).toISOString() }
}, '-updated_date', 5);
```

---

## 🧠 Fase 4 — Prontuário com dados de orçamentos
**Dependências:** Fases 1, 3
**Esforço:** Médio — estender ETAPA B do analisarComportamentoContato

```javascript
// Na ETAPA B, após buscar mensagens, adicionar:
const [orcamentos, vendas] = await Promise.all([
  base44.asServiceRole.entities.Orcamento.filter(
    { $or: [
        { cliente_telefone: contact.telefone },
        { cliente_id: contact.cliente_id }
    ]},
    '-data_orcamento', 10
  ),
  base44.asServiceRole.entities.Venda.filter(
    { cliente_nome: contact.nome },  // ou por cliente_id se disponível
    '-data_venda', 5
  )
]);

// No prompt da IA, adicionar seção:
const contextoNegocio = `
HISTÓRICO COMERCIAL:
Orçamentos: ${orcamentos.map(o =>
  `${o.status} R$${o.valor_total?.toLocaleString('pt-BR')} (${o.data_orcamento})`
).join(', ') || 'Nenhum'}
Vendas: ${vendas.map(v =>
  `R$${v.valor_total?.toLocaleString('pt-BR')} (${v.data_venda})`
).join(', ') || 'Nenhuma'}
`;
```

---

## 🔔 Fase 5 — Escalação notifica o atendente certo
**Dependências:** Fase 1 ✅
**Esforço:** Pequeno — corrigir playbookEngine função `escalonarParaHumano`

```javascript
// SUBSTITUIR no playbookEngine função escalonarParaHumano:
// ATUAL:
const admins = await base44.asServiceRole.entities.User.filter({role: 'admin'});

// CORRETO:
const contact = await base44.asServiceRole.entities.Contact.get(execution.contact_id);
const thread = await base44.asServiceRole.entities.MessageThread.get(execution.thread_id);
const responsavelId = thread.assigned_user_id || contact.vendedor_responsavel;

let notificar = [];
if (responsavelId) {
  const responsavel = await base44.asServiceRole.entities.User.get(responsavelId);
  if (responsavel) notificar.push(responsavel);
}
// Admins como fallback se sem responsável
if (notificar.length === 0) {
  const admins = await base44.asServiceRole.entities.User.filter({role: 'admin'}, 'full_name', 3);
  notificar = admins;
}
```

---

## 🔭 Fase 6 — businessIA alimenta sensibilidade do Jarvis
**Dependências:** Fases 1, 3
**Esforço:** Pequeno — adicionar Step 0 no jarvisEventLoop

```javascript
// Adicionar no início do jarvisEventLoop, antes do Step 1:
let sensibilidadeBoost = 0;
try {
  const saude = await base44.asServiceRole.functions.invoke('businessIA', {
    action: 'strategic_insights'
  });
  const criticos = saude.data?.insights?.filter(i =>
    i.tipo === 'alerta' && i.severidade === 'critica'
  ) || [];
  // Em crise → reduz threshold → mais alertas → mais agressivo
  if (criticos.length > 0) {
    sensibilidadeBoost = 10;
    console.log(`[NEXUS-AGENT v3] ⚠️ ${criticos.length} alertas críticos → sensibilidade +${sensibilidadeBoost}`);
  }
} catch (e) {
  console.warn('[NEXUS-AGENT v3] businessIA indisponível — sensibilidade normal');
}

// Usar sensibilidadeBoost nos limiares:
const ALTO_THRESHOLD = 55 - sensibilidadeBoost;  // em crise: 45 em vez de 55
```

---

## 🤖 Fase 7 — claudeWhatsAppResponder com contexto de prontuário
**Dependências:** Fase 1 ✅
**Esforço:** Médio — adicionar busca de prontuário no claudeWhatsAppResponder

```javascript
// Na etapa 1 (Promise.all), adicionar:
const [mensagens, contact, integration, analise] = await Promise.all([
  base44.asServiceRole.entities.Message.filter({thread_id}, '-created_date', 12),
  base44.asServiceRole.entities.Contact.get(contact_id),
  integration_id ? base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id)
                 : Promise.resolve(null),
  base44.asServiceRole.entities.ContactBehaviorAnalysis.filter(
    {contact_id}, '-analyzed_at', 1
  ).then(a => a[0] || null).catch(() => null)
]);

// No system prompt, adicionar seção de contexto de inteligência:
const contextoIA = analise ? `
## INTELIGÊNCIA DO CONTATO (CONFIDENCIAL — não mencionar ao cliente)
- Perfil: ${analise.relationship_profile?.type || 'N/A'}
- Flags: ${analise.relationship_profile?.flags?.join(', ') || 'nenhuma'}
- Score de risco: ${analise.scores?.deal_risk || 0}/100
- Intenção de compra: ${analise.scores?.buy_intent || 0}/100
- Objeções ativas: ${(analise.objections || []).filter(o => o.status === 'open').map(o => o.type).join(', ') || 'nenhuma'}
- Próxima ação recomendada: ${analise.next_best_action?.action || 'N/A'}
- Mensagem sugerida: ${analise.next_best_action?.suggested_message || 'N/A'}

USE ESTE CONTEXTO para personalizar sua resposta sem revelar que tem acesso a estes dados.
` : '';
```

---

# PARTE 7 — REGRAS DE GOVERNANÇA DO CÓDIGO

## Antes de criar qualquer função nova, verificar:
1. O `jarvisEventLoop` pode fazer isso como novo Step?
2. O `analisarComportamentoContato` pode retornar esse dado adicionando ao prompt?
3. O `playbookEngine` + um FlowTemplate resolve?
4. O `businessIA` já calcula isso?
5. O `preAtendimentoHandler` + um estado novo na máquina resolve?

**Se a resposta para todas for NÃO** → documenta aqui e cria a função.

## Módulos IA CORE (não mexer sem justificativa neste documento):
- `jarvisEventLoop`
- `analisarComportamentoContato`
- `analisarClientesEmLote`
- `processInbound`
- `playbookEngine`
- `preAtendimentoHandler`
- `claudeWhatsAppResponder`
- `claudeAgendaAgent`
- `enviarWhatsApp`

## Versionamento obrigatório:
- Qualquer mudança nos módulos IA CORE deve atualizar o comentário de versão no arquivo
- Exemplo: `// jarvisEventLoop - v3.1.0 (adicionado Step 0 — businessIA)`

---

# PARTE 8 — MÉTRICAS DE SAÚDE DO AGENTE

| Métrica | Query Conceitual | Target |
|---|---|---|
| Prontuários atualizados <24h | `ContactBehaviorAnalysis.filter({analyzed_at: {$gte: 24h}})` | >80% dos leads/clientes ativos |
| Threads ociosas sem alerta >4h | `MessageThread.filter({unread_count:{$gt:0}, jarvis_alerted_at: null, assigned: true})` | < 5 |
| AgentRun falhos no último ciclo | `AgentRun.filter({status:'falhou', started_at:{$gte: 30min}})` | 0 |
| FlowExecution com status='erro' | `FlowExecution.filter({status:'erro', completed_at:{$gte: 24h}})` | < 5% do total |
| WorkQueueItems expirados não processados | `WorkQueueItem.filter({status:'agendado', scheduled_for:{$lt: agora}})` | 0 |
| Orçamentos 'negociando' >3d sem alerta | `Orcamento.filter({status:'negociando', updated_date:{$lt: 3d}})` | 0 (após Fase 3) |
| URA ativa (FlowTemplate padrao) | Verificar is_pre_atendimento_padrao=true no banco | ≥ 1 |

---

# PARTE 9 — COMPARAÇÃO ESTUDO vs REALIDADE ATUAL

| Proposta do Estudo | Status | Delta Concreto |
|---|---|---|
| Jarvis como NexusAgentLoop | ✅ Feito v3.0 | Nenhum |
| Consultar prontuário antes de agir | ✅ Feito | Nenhum |
| Decisão em 4 níveis CRÍTICO/ALTO/MÉDIO/BAIXO | ✅ Feito | Nenhum |
| WhatsApp direto para CRÍTICO | ✅ Feito | Monitorar opt-out |
| Alerta interno para ALTO | ✅ Feito | Thread interna funcionando |
| analisarClientesEmLote schedulado | ✅ Feito (a cada 1h) | Nenhum |
| Hook pós-análise | ✅ Feito (corrigido 2026-03-09) | Bug 401 corrigido |
| Worker de follow-ups agendados | ✅ Feito (reescrito 2026-03-09) | Import quebrado corrigido |
| URA integrada ao pipeline | ❌ Gap — código pronto, falta 1 registro no banco | Fase 2 |
| Análise completa de orçamentos | ⚠️ Parcial — só 'enviado'>7d | Fase 3 |
| Prontuário com dados financeiros | ❌ Não inclui Orcamento/Venda | Fase 4 |
| Escalação para atendente responsável | ❌ Vai só para admins | Fase 5 |
| businessIA integrado ao ciclo | ❌ Isolado na UI | Fase 6 |
| Claude com contexto de prontuário | ❌ Claude não vê prontuário | Fase 7 |
| 1 proprietário único de prioridades | ✅ jarvisEventLoop v3 | Nenhum |
| Regra: nova necessidade → evoluir IA CORE | ⚠️ Cultural | Disciplina de equipe |

---

*Última atualização: 2026-03-09*
*Versão: 3.0 — Leitura completa de todos os módulos IA CORE*
*Qualquer mudança arquitetural deve atualizar este arquivo.*