# 📋 SPEC: PLAYBOOK 02 - FOLLOW-UP AUTOMÁTICO

**Tipo:** Proativo  
**Gatilho:** thread.idle (> 30min sem resposta do contato)  
**Risco:** Baixo (só cria lembrete/tarefa)  
**Modo Inicial:** Assistente → Parcial  
**Status:** 🟡 Planejado

---

## 🎯 OBJETIVO

Evitar que conversas importantes "caiam no esquecimento" criando automaticamente lembretes ou tarefas para atendentes quando um contato não responde por período definido.

---

## 📥 ENTRADAS (GATILHOS)

### **Gatilho Principal:**
```javascript
// jarvisEventLoop detecta threads idle
{
  type: 'thread.idle',
  thread_id: 'uuid',
  last_contact_message_at: '2026-01-31T14:30:00Z',
  idle_minutes: 45,
  assigned_user_id: 'uuid',
  setor: 'vendas',
  unread_count: 0
}
```

### **Condições para Ativar:**
1. ✅ `last_contact_message_at` > 30 minutos atrás
2. ✅ Thread tem `assigned_user_id` (não é órfã)
3. ✅ Thread está `status: 'aberta'` (não fechada/arquivada)
4. ✅ `unread_count == 0` (atendente já leu a última mensagem do contato)
5. ✅ Não existe follow-up pendente nos últimos 24h (evita spam)

---

## 🧠 CONTEXTO CARREGADO

```javascript
{
  thread: MessageThread,
  contact: Contact,
  assigned_user: User,
  last_messages: Message[], // últimas 5 mensagens
  pending_tasks: TarefaInteligente[], // tarefas abertas relacionadas
  thread_context: ThreadContext, // memória do agente
  cliente: Cliente, // se contact_id está vinculado
  orcamentos_abertos: Orcamento[] // se cliente tem orçamentos em aberto
}
```

---

## 🤖 DECISÃO DO AGENTE

### **Análise de Criticidade:**

O agente classifica a urgência do follow-up baseado em:

#### **Critérios de Alta Prioridade:**
- 🔴 Cliente mencionou prazo/deadline na última conversa
- 🔴 Orçamento em status "negociando" ou "aguardando_cotacao"
- 🔴 Última mensagem continha: "urgente", "hoje", "amanhã", "preciso"
- 🔴 Thread tem categoria: "urgente", "venda", "cotacao"
- 🔴 Contact está em `estagio_ciclo_vida: 'decisao'`

#### **Critérios de Média Prioridade:**
- 🟠 Cliente fez pergunta técnica ou sobre produto
- 🟠 Thread tem `segmento_atual: 'lead_quente'`
- 🟠 Última mensagem foi do contato (não do atendente)

#### **Critérios de Baixa Prioridade:**
- 🟢 Conversa casual sem ação clara
- 🟢 Cliente disse "depois eu falo" / "vou pensar"
- 🟢 Thread já tem > 3 follow-ups sem resposta

### **Saídas Possíveis:**

```javascript
{
  action: 'create_task' | 'create_reminder' | 'suggest_close' | 'no_action',
  priority: 'alta' | 'media' | 'baixa',
  reasoning: string,
  suggested_follow_up_date: ISO8601,
  suggested_message: string | null
}
```

---

## ⚙️ AÇÕES EXECUTADAS

### **Modo Assistente (Fase 1):**
✅ **Cria sugestão no ThreadContext**
```javascript
await base44.entities.ThreadContext.update(thread_context.id, {
  agent_suggestions: [
    ...existing_suggestions,
    {
      tipo: 'follow_up',
      texto: 'Cliente não respondeu há 45min. Sugestão: enviar mensagem de follow-up',
      confianca: 85,
      usado: false,
      prioridade: 'alta',
      data_sugerida: '2026-01-31T16:00:00Z',
      mensagem_sugerida: 'Olá! Vi que você estava interessado em [produto]. Posso te ajudar com mais alguma informação?'
    }
  ]
});
```

✅ **Exibe notificação para atendente em JarvisControl**
```javascript
{
  type: 'follow_up_suggested',
  thread_id: 'uuid',
  contact_name: 'João Silva',
  idle_time: '45 minutos',
  priority: 'alta',
  action_url: '/comunicacao?thread=uuid'
}
```

### **Modo Parcial (Fase 2 - Futuro):**
✅ **Cria automaticamente TarefaInteligente**
```javascript
await base44.entities.TarefaInteligente.create({
  tipo: 'follow_up_automatico',
  titulo: 'Follow-up: João Silva - Orçamento Equipamentos',
  descricao: 'Cliente não respondeu há 45min. Última mensagem: "Vou analisar os preços"',
  prioridade: 'alta',
  atribuido_para: assigned_user_id,
  thread_relacionada: thread_id,
  contact_relacionado: contact_id,
  sugestao_mensagem: 'Olá João! Conseguiu analisar os preços que enviamos?',
  data_vencimento: '2026-01-31T16:00:00Z',
  criado_por_ia: true,
  aprovacao_necessaria: false // em Fase 2, ações de baixo risco não precisam
});
```

---

## 📊 AUDITORIA

### **AgentRun:**
```javascript
{
  trigger_type: 'thread.idle',
  trigger_event_id: thread_id,
  playbook_selected: 'follow_up_automatico',
  execution_mode: 'assistente', // ou 'parcial'
  status: 'concluido',
  context_snapshot: {
    idle_minutes: 45,
    last_message: '...',
    assigned_user: 'Maria Santos',
    priority_score: 85
  },
  started_at: '2026-01-31T15:00:00Z',
  completed_at: '2026-01-31T15:00:02Z',
  duration_ms: 2000
}
```

### **AgentDecisionLog:**
```javascript
{
  agent_run_id: 'uuid',
  step_name: 'analyze_idle_thread',
  decisao_tipo: 'sugestao_follow_up',
  ferramentas_usadas: ['InvokeLLM', 'ThreadContext.update'],
  decisao_tomada: {
    what: 'Criar sugestão de follow-up prioritário',
    why: 'Cliente mencionou prazo na última conversa e não respondeu há 45min',
    confidence: 85,
    priority: 'alta'
  },
  confianca_ia: 85,
  resultado_execucao: 'sucesso',
  timestamp_decisao: '2026-01-31T15:00:01Z'
}
```

---

## 🛡️ GUARDRAILS

### **1. Anti-Spam:**
- ✅ **Cooldown:** Mínimo 4 horas entre follow-ups para o mesmo thread
- ✅ **Limite diário:** Máximo 3 follow-ups automáticos por thread/dia
- ✅ **Limite semanal:** Máximo 10 follow-ups por contato/semana

### **2. Horário de Operação:**
- ✅ **Apenas em horário comercial:** 8h - 18h (timezone do usuário)
- ✅ **Não criar tarefas fora do expediente** (evita notificações indevidas)

### **3. Respeito ao Contexto:**
- ✅ **Não sugerir follow-up** se última mensagem do contato foi: "não me mande mais mensagens", "parar", "cancelar"
- ✅ **Não sugerir follow-up** se thread está em `pre_atendimento_ativo: true`
- ✅ **Não sugerir follow-up** se contact está `bloqueado: true`

### **4. Validação de Dados:**
```javascript
if (!thread.assigned_user_id) {
  return { action: 'no_action', reason: 'Thread não atribuída' };
}

if (thread.status !== 'aberta') {
  return { action: 'no_action', reason: 'Thread fechada/arquivada' };
}

if (contact.bloqueado) {
  return { action: 'no_action', reason: 'Contato bloqueado' };
}
```

---

## 📈 MÉTRICAS DE SUCESSO

### **Operacionais:**
- ⏱️ **Tempo médio de idle reduzido** (antes vs depois)
- 📊 **% de threads com follow-up vs threads esquecidas**
- 🎯 **Taxa de resposta pós-follow-up** (quantos contatos responderam?)
- 🕒 **Tempo até primeira resposta do atendente** (após sugestão)

### **Qualidade da IA:**
- 🎯 **Taxa de aceitação das sugestões** (quantas vezes o atendente usou?)
- ✏️ **Taxa de edição** (usou mas modificou a mensagem?)
- ❌ **Taxa de descarte** (ignorou a sugestão?)

### **Impacto no Negócio:**
- 💰 **Orçamentos convertidos após follow-up**
- 📈 **Aumento na taxa de resposta de leads**
- ⚡ **Redução de SLA de primeira resposta**

---

## 🔄 INTEGRAÇÃO COM OUTROS PLAYBOOKS

### **Playbook 01 (Link Intelligence):**
Se o follow-up contém URL, dispara Playbook 01 para enriquecer contexto.

### **Playbook 03 (Lead Qualification):**
Se contato é novo e ainda não foi qualificado, follow-up pode incluir perguntas de qualificação.

### **Playbook 04 (Smart Routing):**
Se thread não está atribuída ou está no setor errado, follow-up pode incluir sugestão de reatribuição.

---

## 🧪 TESTES NECESSÁRIOS

### **Cenário 1: Thread Idle Simples**
```
DADO: Thread com última mensagem do contato há 35min
QUANDO: jarvisEventLoop detecta idle
ENTÃO: Cria sugestão de follow-up no ThreadContext
E: Exibe notificação em JarvisControl
```

### **Cenário 2: Thread com Orçamento Parado**
```
DADO: Thread idle + Cliente com orçamento "negociando" há 7 dias
QUANDO: jarvisEventLoop detecta idle
ENTÃO: Cria sugestão ALTA prioridade
E: Mensagem sugerida menciona o orçamento
```

### **Cenário 3: Anti-Spam (Cooldown)**
```
DADO: Thread idle + Já teve follow-up há 2 horas
QUANDO: jarvisEventLoop detecta idle novamente
ENTÃO: Não cria nova sugestão (cooldown ativo)
E: Registra decisão "bloqueado por cooldown"
```

### **Cenário 4: Fora do Horário**
```
DADO: Thread idle às 22h (fora do expediente)
QUANDO: jarvisEventLoop detecta idle
ENTÃO: Não cria sugestão (horário inválido)
E: Agenda verificação para próximo dia útil 8h
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Backend:**
- [ ] Adicionar lógica de detecção idle no `jarvisEventLoop`
- [ ] Criar função `analyzeIdleThread()` no `agentOrchestrator`
- [ ] Implementar guardrails de cooldown/horário
- [ ] Adicionar registro de auditoria

### **Entidades:**
- [ ] Adicionar campo `last_follow_up_at` em `ThreadContext`
- [ ] Adicionar campo `follow_up_count_today` em `ThreadContext`
- [ ] Garantir que `TarefaInteligente` aceita `tipo: 'follow_up_automatico'`

### **Frontend:**
- [ ] Adicionar visualização de sugestões de follow-up no chat
- [ ] Adicionar notificação em JarvisControl
- [ ] Adicionar métrica de follow-ups no Dashboard

### **Testes:**
- [ ] Teste unitário: detecção de idle
- [ ] Teste unitário: análise de prioridade
- [ ] Teste integração: criação de sugestão
- [ ] Teste E2E: atendente usa sugestão e envia mensagem

---

## 🚀 ROADMAP DE DEPLOY

### **Fase 1 (Assistente) - Sprint Atual:**
- ✅ Só cria sugestões (não executa)
- ✅ Exibe em JarvisControl
- ✅ Atendente decide se usa ou não
- ✅ Coleta feedback (usado/editado/descartado)

### **Fase 2 (Parcial) - Sprint +2:**
- 🟡 Cria TarefaInteligente automaticamente
- 🟡 Sem aprovação obrigatória para ações de baixo risco
- 🟡 Atendente pode desabilitar por thread/setor

### **Fase 3 (Forte) - Sprint +6:**
- ⚪ Envia mensagem de follow-up automaticamente
- ⚪ Apenas para casos de alta confiança (>90%)
- ⚪ Apenas em threads com histórico positivo
- ⚪ Com kill-switch global (desliga tudo se algo der errado)

---

## 📚 REFERÊNCIAS

- **Arquitetura:** `CONTROL_PLANE_CENTRAL.md`
- **Playbook Anterior:** `SPEC_PLAYBOOK_01_LINK_INTELLIGENCE.md`
- **Entidades:** `AgentRun.json`, `AgentDecisionLog.json`, `ThreadContext.json`, `TarefaInteligente.json`
- **Funções:** `jarvisEventLoop.js`, `agentOrchestrator.js`

---

**Documento de especificação - última atualização: 31/01/2026**  
**Status:** 🟡 Pronto para implementação - Fase 1 (Assistente)