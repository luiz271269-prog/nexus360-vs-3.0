# 🎯 ANÁLISE CONSOLIDADA: "CONTATOS PRECISANDO DE ATENÇÃO"
## Nexus360 - Mapeamento Completo da Funcionalidade

**Data:** 2026-02-10  
**Versão:** 2.0 (Consolidada)  
**Fontes:** Código Real + Análises Técnicas + Projeto Agente Interno

---

## 📊 RESUMO EXECUTIVO - STATUS ATUAL

### **Existe Botão?** ✅ SIM - Mas são DOIS sistemas distintos

| Sistema | Localização | Status | Completude |
|---------|-------------|--------|------------|
| **Sistema 1: Badge no Menu Lateral** | `Layout.jsx` → NavItem | ✅ Funcionando | 40% - Apenas contador |
| **Sistema 2: Dropdown na Comunicação** | `Comunicacao.jsx` → ContatosRequerendoAtencao | ✅ Funcionando | 75% - Falta trigger automático |

### **Veredito:**
🟡 **PARCIALMENTE FUNCIONAL** - A UI existe e está bonita, mas **depende de dados que não estão sendo gerados automaticamente**.

---

## 🏗️ ARQUITETURA REAL DO SISTEMA (CÓDIGO ATUAL)

### **SISTEMA 1: Badge no Menu Lateral (Simples)**

```
Layout.jsx
    ↓
calcularLembretesGlobal() (a cada 15min)
    ↓
contadoresLembretes['Comunicacao'] = X
    ↓
NavItem renderiza badge com contador
    ↓
Usuário clica → vai para Comunicacao.jsx
```

**Implementação (Layout.jsx - linha 25-77):**
```javascript
// Função executada a cada 15 minutos
const carregarDadosGlobais = async () => {
  try {
    const contadores = await calcularLembretesGlobal(user, base44);
    setContadoresLembretes(contadores);
  } catch (error) {
    // ...
  }
};

// Badge visual no menu
<NavItem
  href={createPageUrl('Comunicacao')}
  icon={MessageSquare}
  label="Central de Comunicacao"
  lembretesCount={contadoresLembretes['Comunicacao'] || 0}
/>
```

**Problema:** `calcularLembretesGlobal()` **NÃO ESTÁ NO CÓDIGO**!
- ❌ Arquivo `components/global/MotorLembretesGlobal.js` existe mas não tem implementação completa
- ❌ Função retorna objeto vazio na maioria dos casos
- ✅ Badge funciona se houver dados, mas dados não são gerados

---

### **SISTEMA 2: ContatosRequerendoAtencao (Complexo e Robusto)**

```
Comunicacao.jsx (linha 2314)
    ↓
<ContatosRequerendoAtencao variant="header" />
    ↓
Ao expandir: carregarContatosComAlerta()
    ↓
Query: ContactBehaviorAnalysis (últimos 7 dias)
    ↓
Processar alertas (insights.alerts OU regras locais)
    ↓
Agrupar por tópico/usuário
    ↓
Renderizar dropdown com contatos
    ↓
Clicar em contato → abre ChatWindow
```

**Implementação (ContatosRequerendoAtencao.jsx):**

#### **Fase 1: Busca de Análises (linha 41-53)**
```javascript
const analisesRecentes = await base44.entities.ContactBehaviorAnalysis.filter(
  {
    ultima_analise: { 
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() 
    }
  },
  '-ultima_analise',
  100
);
```

#### **Fase 2: Otimização N+1 (linha 56-74)**
```javascript
// ✅ EXCELENTE: Busca TODAS threads em UMA query
const contactIds = [...new Set(analisesRecentes.map(a => a.contact_id))];
const todasThreads = await base44.entities.MessageThread.filter(
  { contact_id: { $in: contactIds }, status: 'aberta' },
  '-last_message_at',
  500
);

// Criar mapa O(1) para lookup
const threadsMap = new Map();
todasThreads.forEach(t => {
  const existing = threadsMap.get(t.contact_id);
  if (!existing || new Date(t.last_message_at) > new Date(existing.last_message_at)) {
    threadsMap.set(t.contact_id, t);
  }
});
```

#### **Fase 3: Processamento de Alertas (linha 77-186)**
```javascript
const contatosProcessados = analisesRecentes.map((analise) => {
  const contato = contatos.find(c => c.id === analise.contact_id);
  const thread = threadsMap.get(analise.contact_id);
  
  let alertas = [];
  let scores = null;
  let nextAction = null;
  
  // ✅ PRIORIZAR: insights do motor de IA
  if (analise.insights?.alerts && analise.insights.alerts.length > 0) {
    alertas = analise.insights.alerts.map(a => ({
      tipo: a.reason?.toLowerCase().replace(/\s+/g, '_'),
      nivel: a.level,  // 'critico', 'alto', 'medio', 'baixo'
      mensagem: a.reason,
      topico: categorizarAlerta(a.reason)
    }));
    
    scores = analise.insights.scores;
    nextAction = analise.insights.next_best_action;
  } else {
    // ⚠️ FALLBACK: Regras locais (compatibilidade)
    if (analise.score_engajamento < 40) {
      alertas.push({
        tipo: 'score_baixo',
        nivel: 'alto',
        mensagem: `Score muito baixo (${analise.score_engajamento}/100)`,
        topico: 'Engajamento Crítico'
      });
    }
    
    if (analise.analise_sentimento?.score_sentimento < 40) {
      alertas.push({
        tipo: 'sentimento_negativo',
        nivel: 'alto',
        mensagem: 'Sentimento negativo detectado',
        topico: 'Risco de Churn'
      });
    }
    
    // ... outras regras
  }
  
  if (alertas.length === 0) return null;
  
  // Calcular prioridade
  let prioridade = 3;
  if (alertas.some(a => a.nivel === 'critico')) prioridade = 1;
  else if (alertas.some(a => a.nivel === 'alto')) prioridade = 2;
  
  // Refinar com deal_risk
  if (scores?.deal_risk > 70) prioridade = Math.min(prioridade, 1);
  else if (scores?.deal_risk > 50) prioridade = Math.min(prioridade, 2);
  
  return { contato, thread, analise, alertas, scores, nextAction, prioridade };
});
```

#### **Fase 4: Categorização de Tópicos (linha 96-101)**
```javascript
const categorizarAlerta = (reason) => {
  if (reason.includes('follow-up')) return 'Follow-ups Sem Resposta';
  if (reason.includes('negociação') || reason.includes('parad')) return 'Negociação Estagnada';
  if (reason.includes('risco')) return 'Risco de Perda';
  if (reason.includes('reclamação') || reason.includes('sentimento')) return 'Risco de Churn';
  if (reason.includes('oportunidade') || reason.includes('quente')) return 'Oportunidade Esfriando';
  return 'Outros Alertas';
};
```

#### **Fase 5: Ordenação e Exibição (linha 191-195)**
```javascript
contatosValidos.sort((a, b) => {
  // 1º critério: Prioridade (1 = crítica primeiro)
  if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
  
  // 2º critério: deal_risk (maior risco primeiro)
  if (a.deal_risk !== b.deal_risk) return b.deal_risk - a.deal_risk;
  
  // 3º critério: score_engajamento (menor engajamento = mais urgente)
  return (a.analise.score_engajamento || 0) - (b.analise.score_engajamento || 0);
});
```

---

## 🔴 PROBLEMA CRÍTICO #1: FONTE DE DADOS VAZIA

### **O que deveria acontecer:**
```
Automação Scheduled (a cada 6h)
    ↓
Executa: analisarClientesEmLote
    ↓
Cria/atualiza: ContactBehaviorAnalysis
    ↓
ContatosRequerendoAtencao lê dados
    ↓
Exibe alertas aos atendentes
```

### **O que está acontecendo:**
```
❌ Nenhuma automação scheduled
    ↓
❌ ContactBehaviorAnalysis vazio (ou 7+ dias desatualizado)
    ↓
ContatosRequerendoAtencao.carregarContatosComAlerta()
    ↓
Query retorna: [] (array vazio)
    ↓
UI exibe: "Tudo sob controle!" (FALSO POSITIVO)
```

### **Evidência no código:**
```javascript
// ContatosRequerendoAtencao.jsx - linha 45-53
const analisesRecentes = await base44.entities.ContactBehaviorAnalysis.filter(
  {
    ultima_analise: { 
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() 
    }
  },
  '-ultima_analise',
  100
);

// Se analisesRecentes.length === 0 → NENHUM contato aparece!
```

### **Confirmação:**
- ❌ Busca em `list_automations` → Nenhuma automação executando `analisarClientesEmLote`
- ❌ Arquivo `functions/analisarClientesEmLote.js` existe mas não é chamado
- ✅ Arquivo `functions/analisarComportamentoContato.js` existe (análise individual)

---

## 🔴 PROBLEMA CRÍTICO #2: DOIS SISTEMAS DESCONEXOS

### **Sistema A: ContatosRequerendoAtencao**
- **Entidade:** `ContactBehaviorAnalysis`
- **Trigger:** ❌ Nenhum (manual)
- **Localização:** Dropdown no header da Comunicação
- **Dados:** Análise de IA completa (insights, scores, próxima ação)

### **Sistema B: ContatosParados**
- **Entidade:** `WorkQueueItem`
- **Trigger:** ✅ `watchdogIdleContacts` (função scheduled)
- **Localização:** Página dedicada `pages/ContatosParados.jsx`
- **Dados:** Contatos parados > 48h

### **Desalinhamento:**
```javascript
// ContatosRequerendoAtencao ← Busca ContactBehaviorAnalysis
const analises = await base44.entities.ContactBehaviorAnalysis.filter(...);

// ContatosParados ← Busca WorkQueueItem
const items = await base44.entities.WorkQueueItem.filter(...);

// ❌ ZERO sincronização entre os dois!
```

### **Impacto:**
- Usuário vê "Tudo sob controle" em um sistema
- Mas tem 10 contatos críticos no outro sistema
- Confusão operacional

---

## 🔍 PROBLEMA CRÍTICO #3: MOTOR DE LEMBRETES NÃO IMPLEMENTADO

### **O que o código espera:**
```javascript
// Layout.jsx - linha 170-172
const contadores = await calcularLembretesGlobal(user, base44);
setContadoresLembretes(contadores);
```

### **O que deveria retornar:**
```javascript
{
  'Comunicacao': 15,    // 15 contatos precisando atenção
  'Dashboard': 5,       // 5 alertas críticos
  'Agenda': 3,          // 3 tarefas urgentes
  'LeadsQualificados': 8, // 8 leads quentes parados
  // ...
}
```

### **O que realmente está implementado (MotorLembretesGlobal.js):**
```javascript
// ❌ ATUAL: Função básica sem lógica completa
export async function calcularLembretesGlobal(usuario, base44) {
  // TODO: Implementar lógica completa
  // Por enquanto retorna apenas alguns contadores
  
  try {
    // Exemplo simplificado (não cobre todos os casos)
    const orcamentosPendentes = await base44.entities.Orcamento.filter({ status: 'pendente' });
    
    return {
      'Agenda': orcamentosPendentes.length
    };
  } catch {
    return {};
  }
}
```

### **O que DEVERIA estar implementado (conforme documentos):**
```javascript
export async function calcularLembretesGlobal(usuario, base44) {
  const contadores = {};
  
  try {
    // 1. Contatos precisando atenção (ContactBehaviorAnalysis)
    const analisesComAlertas = await base44.entities.ContactBehaviorAnalysis.filter({
      ultima_analise: { $gte: new Date(Date.now() - 7*24*60*60*1000).toISOString() },
      'insights.alerts': { $exists: true }  // JSONB query
    });
    
    // 2. Contatos parados (WorkQueueItem)
    const contatosParados = await base44.entities.WorkQueueItem.filter({
      status: { $in: ['open', 'in_progress'] }
    });
    
    // 3. Orçamentos urgentes
    const orcamentosUrgentes = await base44.entities.Orcamento.filter({
      status: 'enviado',
      data_vencimento: { $lte: new Date(Date.now() + 3*24*60*60*1000).toISOString() }
    });
    
    // 4. Tarefas críticas
    const tarefasCriticas = await base44.entities.TarefaInteligente.filter({
      status: 'pendente',
      prioridade: 'critica'
    });
    
    // Agrupar por página
    contadores['Comunicacao'] = analisesComAlertas.length + contatosParados.length;
    contadores['Dashboard'] = tarefasCriticas.length;
    contadores['Orcamentos'] = orcamentosUrgentes.length;
    contadores['Agenda'] = tarefasCriticas.length;
    
    return contadores;
  } catch (error) {
    console.error('[MotorLembretes] Erro:', error);
    return {};
  }
}
```

---

## 🎯 MAPEAMENTO COMPLETO DO FLUXO (COMO DEVERIA SER)

### **CAMADA 1: Detecção e Geração de Alertas (Backend)**

```
┌─────────────────────────────────────────────────────────────────┐
│              CAMADA 1: DETECÇÃO (Backend Scheduled)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AUTOMAÇÃO A (a cada 6h)                                 │   │
│  │  Função: analisarClientesEmLote                          │   │
│  │  ├─ Busca contatos ativos (últimas 72h)                  │   │
│  │  ├─ Para cada contato:                                   │   │
│  │  │   ├─ Coleta mensagens (ASC)                           │   │
│  │  │   ├─ Calcula métricas (tempo, engajamento)            │   │
│  │  │   ├─ Chama IA (gera insights.alerts)                  │   │
│  │  │   └─ Salva em ContactBehaviorAnalysis                 │   │
│  │  └─ Resultado: 100+ análises atualizadas                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AUTOMAÇÃO B (a cada 30min)                              │   │
│  │  Função: watchdogIdleContacts                            │   │
│  │  ├─ Busca threads paradas > 48h                          │   │
│  │  ├─ Cria WorkQueueItem                                   │   │
│  │  └─ Atualiza ContactEngagementState                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WEBHOOK (em tempo real)                                 │   │
│  │  Trigger: Nova mensagem recebida                         │   │
│  │  ├─ Se mensagem crítica (objeção, urgência):             │   │
│  │  │   └─ Executa análise SOB-DEMANDA                      │   │
│  │  └─ Atualiza ContactBehaviorAnalysis                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                CAMADA 2: BANCO DE DADOS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ContactBehaviorAnalysis                                         │
│  ├─ contact_id                                                   │
│  ├─ insights (JSONB) ← COMPLETO                                  │
│  │   ├─ alerts[] ← 🎯 FONTE DOS ALERTAS                          │
│  │   ├─ scores (buy_intent, deal_risk, health, engagement)       │
│  │   ├─ next_best_action (ação sugerida + mensagem pronta)       │
│  │   ├─ root_causes (causas raiz + evidências)                   │
│  │   └─ ... (9 campos totais)                                    │
│  ├─ deal_risk (índice rápido)                                    │
│  ├─ stage_current (índice rápido)                                │
│  └─ ultima_analise                                               │
│                                                                  │
│  WorkQueueItem                                                   │
│  ├─ contact_id                                                   │
│  ├─ reason ('idle_48h', 'idle_72h', etc)                         │
│  ├─ severity ('critical', 'high', 'medium')                      │
│  └─ status ('open', 'in_progress', 'done', 'dismissed')          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           CAMADA 3: AGREGAÇÃO (Frontend - a cada 15min)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  calcularLembretesGlobal(usuario, base44)                        │
│  ├─ Busca ContactBehaviorAnalysis com insights.alerts           │
│  ├─ Busca WorkQueueItem (status: open)                          │
│  ├─ Busca TarefaInteligente (prioridade: critica)               │
│  ├─ Busca Orcamento (vencendo em 3 dias)                        │
│  └─ Retorna: { 'Comunicacao': 12, 'Dashboard': 5, ... }         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│             CAMADA 4: INTERFACE (UI - 2 variantes)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  VARIANTE 1: Badge no Menu (Layout.jsx)                  │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  NavItem                                         │     │   │
│  │  │  ├─ Badge animado (pulse)                        │     │   │
│  │  │  ├─ Cor dinâmica (vermelho/laranja/roxo)         │     │   │
│  │  │  ├─ Contador (1-99+)                             │     │   │
│  │  │  └─ Tooltip: "12 lembretes"                      │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │  Ação: Clique → navigate('/comunicacao')                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  VARIANTE 2: Dropdown na Comunicação                     │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │  ContatosRequerendoAtencao (variant="header")    │     │   │
│  │  │  ├─ Botão com badge                              │     │   │
│  │  │  └─ Dropdown expandido:                          │     │   │
│  │  │      ├─ Agrupamento (tópico/usuário)             │     │   │
│  │  │      ├─ Lista de contatos com alertas            │     │   │
│  │  │      ├─ Badges de prioridade                     │     │   │
│  │  │      ├─ Scores (se disponíveis)                  │     │   │
│  │  │      └─ Próxima ação (se disponível)             │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  │  Ação: Clique em contato → abre ChatWindow           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO E FUNCIONA

### **1. UI Completa e Polida** ✅
- Badge no menu lateral com cores dinâmicas
- Dropdown na página Comunicação
- Agrupamento por tópico/usuário
- Cards de contato com avatar, badges, scores
- Responsivo e com animações

### **2. Query Otimizada** ✅
- Evita N+1 com `$in: contactIds`
- Mapa O(1) para lookup de threads
- Limite de 100 análises

### **3. Sistema de Priorização** ✅
- Ordenação por: prioridade → deal_risk → score_engajamento
- Níveis: crítico, alto, médio, baixo
- Refinamento automático com scores do motor

### **4. Integração com Motor de IA** ✅
- Lê `insights.alerts` do banco
- Extrai scores (buy_intent, deal_risk, health, engagement)
- Exibe `next_best_action` com deadline

### **5. Fallback Inteligente** ✅
- Se `insights.alerts` não existir, usa regras locais:
  - Score engajamento < 40 → Alerta
  - Sentimento negativo → Alerta
  - Lead quente parado > 2 dias → Alerta
  - Segmento = risco_churn → Alerta CRÍTICO

### **6. Categorização Automática** ✅
```javascript
Follow-ups Sem Resposta     ← keywords: 'follow-up'
Negociação Estagnada        ← keywords: 'negociação', 'parad'
Risco de Perda              ← keywords: 'risco'
Risco de Churn              ← keywords: 'reclamação', 'sentimento'
Oportunidade Esfriando      ← keywords: 'oportunidade', 'quente'
Outros Alertas              ← catch-all
```

### **7. Ações do Usuário** ✅
- Clicar em contato → Abre chat
- Alternar agrupamento (tópico/usuário)
- Recarregar lista (botão refresh)

---

## ❌ O QUE ESTÁ FALTANDO (GAPS CRÍTICOS)

### **GAP #1: NENHUMA AUTOMAÇÃO GERANDO DADOS** 🔴 BLOQUEADOR
```sql
-- STATUS ATUAL
SELECT COUNT(*) FROM automations 
WHERE function_name = 'analisarClientesEmLote';
-- Resultado: 0

-- NECESSÁRIO
CREATE AUTOMATION scheduled_analysis
  FUNCTION analisarClientesEmLote
  INTERVAL 6 hours
  PAYLOAD { limit: 100, priorizar_ativos: true };
```

### **GAP #2: MOTOR DE LEMBRETES INCOMPLETO** 🔴 BLOQUEADOR
**Arquivo existe:** `components/global/MotorLembretesGlobal.js`  
**Status:** Função exportada mas implementação básica/incompleta  
**Impacto:** Badge no menu lateral sempre mostra 0

### **GAP #3: SEM AÇÕES DIRETAS NO DROPDOWN** 🟡 IMPORTANTE
**O que falta:**
- [ ] Botão "Marcar como Resolvido"
- [ ] Botão "Dispensar"
- [ ] Botão "Adiar por X horas"
- [ ] Botão "Atribuir a..."
- [ ] Copiar mensagem sugerida

**Comparação:**
```javascript
// ContatosParados.jsx TEM essas ações (linha 196-260):
<Button onClick={() => completeMutation.mutate({ itemId: item.id })}>
  Concluir
</Button>
<Button onClick={() => dismissMutation.mutate({ itemId: item.id, reason: '...' })}>
  Dispensar
</Button>

// ContatosRequerendoAtencao NÃO TEM (só abre chat)
<button onClick={() => onSelecionarContato(item.thread)}>
  {/* Sem botões de ação */}
</button>
```

### **GAP #4: INTEGRAÇÃO FRAGMENTADA** 🟡 IMPORTANTE
Dois sistemas fazendo trabalho similar mas desconexos:
- `ContatosRequerendoAtencao` (IA, insights, scores)
- `ContatosParados` (watchdog, fila, simples)

### **GAP #5: SEM FEEDBACK LOOP** 🟡 IMPORTANTE
**O que falta:**
- Registrar quando atendente age no alerta
- Rastrear tempo de resolução
- Calcular efetividade das ações sugeridas
- Alimentar IA com resultados (aprendizado)

### **GAP #6: SEM MÉTRICAS DE EFETIVIDADE** 🟢 DESEJÁVEL
**O que falta:**
- Dashboard de alertas resolvidos vs ignorados
- Taxa de conversão (alerta → ação → resultado positivo)
- Tempo médio de resolução por tipo de alerta
- Ranking de atendentes (melhor taxa de resolução)

---

## 🧩 SCHEMA COMPLETO DE DADOS (PROJETO AGENTE INTERNO)

### **ContactBehaviorAnalysis (Entidade Existente)**

```typescript
{
  id: string,
  contact_id: string,
  
  // ═══ CAMPOS ÍNDICE (para filtros rápidos) ═══
  deal_risk: number,        // 0-100
  buy_intent: number,       // 0-100
  engagement: number,       // 0-100
  health: number,           // 0-100
  stage_current: string,    // enum
  score_engajamento: number, // LEGADO (mantido para compatibilidade)
  
  // ═══ OBJETO COMPLETO (JSONB) ═══
  insights: {
    scores: {
      buy_intent: number,
      engagement: number,
      deal_risk: number,
      health: number,
      score_explain: ScoreExplanation[]
    },
    
    stage: {
      current: string,
      label: string,
      days_stalled: number,
      pipeline_hint: string[]
    },
    
    root_causes: CausaRaiz[],         // 🎯 Causas raiz + evidências
    evidence_snippets: Evidence[],     // 🎯 Trechos relevantes
    alerts: Alerta[],                  // 🎯 FONTE DOS ALERTAS
    next_best_action: NextAction,      // 🎯 Ação recomendada
    objections: Objecao[],             // 🎯 Objeções detectadas
    topics: string[],                  // 🎯 Temas da conversa
    milestones: Milestone[]            // 🎯 Linha do tempo
  },
  
  // ═══ METADADOS ═══
  scope: {
    mode: 'contact_conversation',
    thread_ids: string[],
    start: datetime,
    end: datetime,
    message_count: number,
    processing_time_ms: number
  },
  
  source_model: string,       // 'claude-3-5-sonnet-2025-02-01'
  insights_version: number,   // 1
  ultima_analise: datetime
}
```

### **Estrutura de `insights.alerts` (Fonte dos Alertas)**

```typescript
interface Alerta {
  id: string,              // al_001, al_002, ...
  severity: 'low' | 'medium' | 'high' | 'critical',
  title: string,           // "Enviar NF/XML/boletos do HD"
  action: string,          // "Confirmar envio para financeiro@..."
  due_at: string,          // ISO datetime
  auto_escalate?: boolean, // Escalar se não resolver
  
  // 🆕 Campos extras (projeto):
  level: 'critico' | 'alto' | 'medio' | 'baixo',  // Mapeado para severity
  reason: string,          // Mensagem legível do alerta
  detected_at?: string     // Quando foi detectado
}
```

---

## 📋 FLUXO COMPLETO - PASSO A PASSO (ESTADO IDEAL)

### **PASSO 1: Trigger Automático (Backend)**
```
CRON: A cada 6 horas
    ↓
Automação executa: analisarClientesEmLote
    ↓
Função backend:
  1. Busca contatos ativos (últimas 72h)
  2. Para cada contato:
     ├─ Busca mensagens em ASC (ordem cronológica)
     ├─ Identifica turning points
     ├─ Calcula métricas (tempo resposta, engajamento)
     ├─ Seleciona contexto inteligente (100 msgs)
     ├─ Chama LLM com prompt estruturado
     ├─ Valida JSON de resposta (schema)
     └─ Persiste em ContactBehaviorAnalysis:
         - insights (JSONB completo)
         - deal_risk, buy_intent, etc (índices)
         - scope (metadados)
    ↓
Resultado: 100+ análises criadas/atualizadas
```

### **PASSO 2: Atualização do Motor de Lembretes (Frontend)**
```
Layout.jsx useEffect (a cada 15min)
    ↓
Chama: calcularLembretesGlobal(usuario, base44)
    ↓
Função:
  1. Query: ContactBehaviorAnalysis WHERE insights.alerts EXISTS
  2. Query: WorkQueueItem WHERE status IN ('open', 'in_progress')
  3. Query: TarefaInteligente WHERE prioridade = 'critica'
  4. Agrupa por página:
     - Comunicacao = analises.length + workQueue.length
     - Dashboard = tarefas.length
     - Agenda = tarefas.length
    ↓
Retorna: { 'Comunicacao': 12, 'Dashboard': 5, 'Agenda': 8 }
    ↓
setContadoresLembretes({ ... })
```

### **PASSO 3: Renderização do Badge (UI)**
```
NavItem renderiza:
    ↓
lembretesCount = contadoresLembretes['Comunicacao'] || 0
    ↓
Se lembretesCount > 0:
  ├─ Badge com contador
  ├─ Cor baseada em quantidade:
  │   - 1-4:  🔴 Vermelho
  │   - 5-9:  🟠 Laranja
  │   - 10+:  🟣 Roxo
  ├─ Animação pulse
  └─ Tooltip: "12 lembretes"
```

### **PASSO 4: Interação do Usuário (Fluxo)**
```
Usuário vê badge animado no menu
    ↓
Clica em "Central de Comunicacao"
    ↓
Página Comunicacao.jsx carrega
    ↓
Header contém: <ContatosRequerendoAtencao variant="header" />
    ↓
Usuário clica no botão do dropdown
    ↓
setExpandido(true)
    ↓
useEffect detecta → carregarContatosComAlerta()
    ↓
Query: ContactBehaviorAnalysis (últimos 7 dias)
    ↓
Processar alertas + priorizar + agrupar
    ↓
Renderizar dropdown com lista
    ↓
Usuário clica em um contato
    ↓
onSelecionarContato(thread)
    ↓
handleSelecionarThread(thread) em Comunicacao.jsx
    ↓
setThreadAtiva(thread)
    ↓
ChatWindow abre com a conversa
```

---

## 🔧 CÓDIGO COMPLETO DO MOTOR DE LEMBRETES (O QUE DEVERIA SER)

### **components/global/MotorLembretesGlobal.js**

```javascript
import { base44 } from '@/api/base44Client';

/**
 * Calcula lembretes globais para todas as páginas
 * Executado a cada 15 minutos pelo Layout.jsx
 */
export async function calcularLembretesGlobal(usuario, base44Client) {
  const contadores = {};
  const now = Date.now();
  
  try {
    // ═══════════════════════════════════════════════════════════
    // 1. CONTATOS PRECISANDO ATENÇÃO (ContactBehaviorAnalysis)
    // ═══════════════════════════════════════════════════════════
    const analisesComAlertas = await base44Client.entities.ContactBehaviorAnalysis.filter(
      {
        ultima_analise: { 
          $gte: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString() 
        }
      },
      '-ultima_analise',
      200
    );
    
    // Contar apenas análises com alertas reais
    const contatosComAlertasIA = analisesComAlertas.filter(a => {
      // Priorizar insights.alerts do motor
      if (a.insights?.alerts && a.insights.alerts.length > 0) return true;
      
      // Fallback: regras locais
      if (a.score_engajamento < 40) return true;
      if (a.analise_sentimento?.score_sentimento < 40) return true;
      if (a.segmento_sugerido === 'risco_churn') return true;
      if (a.segmento_sugerido === 'lead_quente') {
        // Verificar se está parado
        // (simplificado - na prática precisa buscar thread)
        return true;
      }
      
      return false;
    });
    
    // ═══════════════════════════════════════════════════════════
    // 2. CONTATOS PARADOS (WorkQueueItem)
    // ═══════════════════════════════════════════════════════════
    const workQueueItems = await base44Client.entities.WorkQueueItem.filter(
      {
        status: { $in: ['open', 'in_progress'] }
      },
      '-created_date',
      100
    );
    
    // Filtrar por setor/atribuição se não for admin
    const workQueueFiltrados = usuario.role === 'admin' 
      ? workQueueItems
      : workQueueItems.filter(item => {
          return item.owner_user_id === usuario.id ||
                 item.owner_sector_id === usuario.attendant_sector ||
                 !item.owner_user_id; // Não atribuídos
        });
    
    // ═══════════════════════════════════════════════════════════
    // 3. ORÇAMENTOS URGENTES
    // ═══════════════════════════════════════════════════════════
    const orcamentosUrgentes = await base44Client.entities.Orcamento.filter(
      {
        status: { $in: ['enviado', 'negociando'] },
        data_vencimento: { 
          $lte: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString() 
        }
      },
      'data_vencimento',
      50
    );
    
    // Filtrar por vendedor se não for admin
    const orcamentosFiltrados = usuario.role === 'admin'
      ? orcamentosUrgentes
      : orcamentosUrgentes.filter(o => o.vendedor === usuario.full_name);
    
    // ═══════════════════════════════════════════════════════════
    // 4. TAREFAS CRÍTICAS
    // ═══════════════════════════════════════════════════════════
    const tarefasCriticas = await base44Client.entities.TarefaInteligente.filter(
      {
        status: 'pendente',
        prioridade: { $in: ['critica', 'alta'] }
      },
      '-created_date',
      50
    );
    
    // Filtrar por responsável
    const tarefasFiltradas = usuario.role === 'admin'
      ? tarefasCriticas
      : tarefasCriticas.filter(t => 
          t.responsavel_id === usuario.id || !t.responsavel_id
        );
    
    // ═══════════════════════════════════════════════════════════
    // 5. THREADS NÃO ATRIBUÍDAS (apenas para managers)
    // ═══════════════════════════════════════════════════════════
    let threadsNaoAtribuidas = 0;
    if (usuario.role === 'admin' || usuario.attendant_role === 'gerente') {
      const threads = await base44Client.entities.MessageThread.filter(
        {
          status: 'aberta',
          assigned_user_id: null,
          thread_type: 'contact_external'
        },
        '-last_message_at',
        100
      );
      threadsNaoAtribuidas = threads.length;
    }
    
    // ═══════════════════════════════════════════════════════════
    // 6. AGRUPAR POR PÁGINA
    // ═══════════════════════════════════════════════════════════
    contadores['Comunicacao'] = 
      contatosComAlertasIA.length + 
      workQueueFiltrados.length +
      threadsNaoAtribuidas;
    
    contadores['Dashboard'] = 
      tarefasFiltradas.filter(t => t.prioridade === 'critica').length +
      contatosComAlertasIA.filter(c => c.insights?.alerts?.some(a => a.severity === 'critical')).length;
    
    contadores['Orcamentos'] = orcamentosFiltrados.length;
    
    contadores['Agenda'] = tarefasFiltradas.length;
    
    contadores['LeadsQualificados'] = contatosComAlertasIA.filter(c => 
      c.segmento_sugerido === 'lead_quente'
    ).length;
    
    console.log('[MotorLembretes] ✅ Contadores calculados:', contadores);
    
    return contadores;
    
  } catch (error) {
    console.error('[MotorLembretes] ❌ Erro ao calcular lembretes:', error);
    
    // Fallback: retornar vazio para não quebrar UI
    return {};
  }
}
```

---

## 🚀 PLANO DE AÇÃO PARA TORNAR 100% FUNCIONAL

### **FASE 1: CRÍTICA (1-2 dias) - Fazer Funcionar**

#### **Ação 1.1: Criar Automação Scheduled**
```javascript
// No painel Base44 → Automações → Nova Automação
TIPO: Scheduled
NOME: Análise Comportamental Automática
FUNÇÃO: analisarClientesEmLote
INTERVALO: 6 horas
PAYLOAD: { 
  limit: 100, 
  priorizar_ativos: true,
  incluir_leads_quentes: true
}
STATUS: Ativo
```

#### **Ação 1.2: Completar MotorLembretesGlobal.js**
- Copiar código acima para o arquivo
- Testar contadores com dados reais
- Ajustar thresholds conforme necessidade

#### **Ação 1.3: Testar Ciclo Completo**
```bash
# 1. Executar análise manual (teste)
POST /api/functions/analisarClientesEmLote
{ "limit": 10 }

# 2. Verificar se criou análises
SELECT COUNT(*) FROM contact_behavior_analysis 
WHERE ultima_analise > NOW() - INTERVAL '1 hour';

# 3. Abrir Dashboard → Verificar badge no menu
# 4. Clicar em Comunicacao → Verificar dropdown
```

---

### **FASE 2: IMPORTANTE (3-5 dias) - Adicionar Ações**

#### **Ação 2.1: Adicionar Botões de Ação no Dropdown**
```javascript
// ContatosRequerendoAtencao.jsx - Adicionar dentro do card de contato:
<div className="flex gap-2 mt-2">
  <Button
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      handleMarcarResolvido(item.analise.id);
    }}
    className="bg-green-600 hover:bg-green-700 text-white"
  >
    <CheckCircle className="w-3 h-3 mr-1" />
    Resolvido
  </Button>
  
  <Button
    size="sm"
    variant="outline"
    onClick={(e) => {
      e.stopPropagation();
      handleDispensarAlerta(item.analise.id);
    }}
  >
    Dispensar
  </Button>
  
  {item.nextAction?.suggested_message && (
    <Button
      size="sm"
      variant="outline"
      onClick={(e) => {
        e.stopPropagation();
        copiarMensagemSugerida(item.nextAction.suggested_message);
      }}
    >
      <Copy className="w-3 h-3 mr-1" />
      Copiar Msg
    </Button>
  )}
</div>
```

#### **Ação 2.2: Criar Handlers**
```javascript
const handleMarcarResolvido = async (analysisId) => {
  try {
    await base44.entities.ContactBehaviorAnalysis.update(analysisId, {
      'insights.alerts': [] // Limpa alertas
    });
    
    // Registrar log de resolução
    await base44.entities.EngagementLog.create({
      contact_id: item.contato.id,
      acao: 'alerta_resolvido',
      timestamp: new Date().toISOString(),
      usuario_id: usuario.id,
      metadata: { analysis_id: analysisId }
    });
    
    toast.success('✅ Alerta marcado como resolvido!');
    carregarContatosComAlerta(); // Recarregar lista
  } catch (error) {
    toast.error('Erro ao marcar como resolvido');
  }
};
```

---

### **FASE 3: DESEJÁVEL (1-2 semanas) - Consolidar Sistemas**

#### **Ação 3.1: Unificar WorkQueueItem + ContactBehaviorAnalysis**

**Opção A: WorkQueueItem referencia análise**
```javascript
// watchdogIdleContacts.js - Adicionar:
const analise = await ContactBehaviorAnalysis.filter({ contact_id }, '-ultima_analise', 1);

await WorkQueueItem.create({
  contact_id,
  thread_id,
  reason: 'idle_48h',
  severity: 'high',
  analysis_id: analise[0]?.id || null,  // 🆕 Referência
  deal_risk: analise[0]?.deal_risk || 0, // 🆕 Cache
  suggested_action: analise[0]?.insights?.next_best_action?.objective || null // 🆕
});
```

**Opção B: Consolidar em uma única página**
```javascript
// pages/ContatosPrecisandoAtencao.jsx (NOVA)
// Exibe AMBOS:
// - Contatos com alertas de IA (ContactBehaviorAnalysis)
// - Contatos parados por inatividade (WorkQueueItem)
// Ordenados por prioridade unificada
```

---

## 📊 DADOS DE EXEMPLO (CASO BRUNA - ADGEO)

### **O que o motor de IA deveria gerar:**

```json
{
  "contact_id": "xxx-bruna-xxx",
  "insights": {
    "alerts": [
      {
        "id": "al_001",
        "level": "alto",
        "severity": "high",
        "reason": "Documentação pendente (NF/XML/boletos)",
        "title": "Enviar/confirmar NF (PDF), XML e boletos do HD",
        "action": "Confirmar envio para financeiro@adgeo.com.br",
        "due_at": "2026-02-05T12:00:00-03:00"
      },
      {
        "id": "al_002",
        "level": "critico",
        "severity": "critical",
        "reason": "Janela curta renovação antivírus + dúvida servidor",
        "title": "Responder vencimento antivírus + cobertura servidor",
        "action": "Validar licença, informar cobertura, propor versão adequada",
        "due_at": "2026-02-05T17:00:00-03:00",
        "auto_escalate": true
      }
    ],
    
    "scores": {
      "buy_intent": 78,
      "engagement": 72,
      "deal_risk": 41,
      "health": 70
    },
    
    "next_best_action": {
      "objective": "Reduzir atrito e destravar expansão",
      "owner_team": "vendas",
      "priority": "high",
      "deadline": "2026-02-05T17:00:00-03:00",
      "suggested_message": "Bruna, bom dia! Confirmei aqui: já encaminhamos a nota fiscal do HD..."
    }
  }
}
```

### **Como seria exibido no dropdown:**

```
┌───────────────────────────────────────────────────────┐
│  Contatos Requerendo Atenção                    [2]   │
├───────────────────────────────────────────────────────┤
│                                                        │
│  📊 Por Tópico    👤 Por Atendente    🔄              │
│                                                        │
│  ▼ Documentação Pendente (1)                          │
│     ┌─────────────────────────────────────────────┐   │
│     │ 🔴 │ [B] Bruna (Adgeo Administrativo)       │   │
│     │     │ NF/XML/boletos do HD                  │   │
│     │     │ 🟠 alto • Score: 72                   │   │
│     │     │ 💡 Confirmar envio email financeiro   │   │
│     │     │ ⏰ Prazo: hoje 12h                    │   │
│     │     │ [Resolvido] [Dispensar] [Copiar Msg]  │   │
│     └─────────────────────────────────────────────┘   │
│                                                        │
│  ▼ Renovação/Oportunidade (1)                         │
│     ┌─────────────────────────────────────────────┐   │
│     │ 🟣 │ [B] Bruna (Adgeo Administrativo)       │   │
│     │     │ Antivírus vencendo + dúvida servidor  │   │
│     │     │ 🔴 critico • Risco: 41                │   │
│     │     │ 💡 Validar licença + orçar versão     │   │
│     │     │ ⏰ Prazo: hoje 17h                    │   │
│     │     │ [Resolvido] [Dispensar] [Copiar Msg]  │   │
│     └─────────────────────────────────────────────┘   │
│                                                        │
└───────────────────────────────────────────────────────┘
```

---

## 🔬 TESTE DE FUNCIONAMENTO (CHECKLIST)

### **✅ Pré-requisitos:**
1. [ ] Automação `analisarClientesEmLote` ativa
2. [ ] Análises recentes em `ContactBehaviorAnalysis`
3. [ ] `MotorLembretesGlobal.js` implementado

### **✅ Teste Visual:**
```javascript
// 1. Console do browser na página Dashboard:
const user = await base44.auth.me();
const contadores = await calcularLembretesGlobal(user, base44);
console.log('Contadores:', contadores);
// Deve retornar: { 'Comunicacao': 12, 'Dashboard': 5, ... }

// 2. Verificar análises recentes:
const analises = await base44.entities.ContactBehaviorAnalysis.filter(
  { ultima_analise: { $gte: new Date(Date.now() - 7*24*60*60*1000).toISOString() } }
);
console.log('Análises recentes:', analises.length);

// 3. Verificar se motor de IA gerou alertas:
const comAlertas = analises.filter(a => a.insights?.alerts?.length > 0);
console.log('Com alertas IA:', comAlertas.length);
```

### **✅ Teste Funcional:**
1. [ ] Badge aparece no menu lateral
2. [ ] Cor muda conforme quantidade (vermelho → laranja → roxo)
3. [ ] Tooltip mostra "X lembretes" ao hover
4. [ ] Clicar no item → vai para Comunicacao
5. [ ] Dropdown "Contatos Requerendo Atenção" tem badge
6. [ ] Expandir dropdown → mostra lista de contatos
7. [ ] Agrupamento por tópico funciona
8. [ ] Agrupamento por atendente funciona
9. [ ] Clicar em contato → abre chat
10. [ ] Scores são exibidos (se disponíveis)
11. [ ] Próxima ação é exibida (se disponível)

---

## 🎨 MELHORIAS VISUAIS IMPLEMENTADAS

### **1. Cores Dinâmicas do Badge**
```javascript
const getBadgeColor = (count) => {
  if (count >= 10) return 'bg-purple-600';  // Crítico
  if (count >= 5) return 'bg-orange-500';   // Alto
  return 'bg-red-500';                      // Médio
};
```

### **2. Animação Pulse**
```jsx
<div className="... animate-pulse">
  {lembretesCount > 99 ? '99+' : lembretesCount}
</div>
```

### **3. Tooltip Informativo**
```jsx
<div className="tooltip">
  {label}
  {lembretesCount > 0 && (
    <div className="flex items-center gap-1 mt-1">
      <Zap className="w-3 h-3 text-purple-400" />
      <span className="text-purple-300 font-semibold">
        {lembretesCount} lembrete{lembretesCount > 1 ? 's' : ''}
      </span>
    </div>
  )}
</div>
```

### **4. Indicador Visual de Nível no Dropdown**
```jsx
{/* Barra colorida lateral */}
<div className={`w-1 h-full absolute left-0 ${getNivelCor(alerta.nivel)}`} />

{/* Função de cor */}
const getNivelCor = (nivel) => {
  switch (nivel) {
    case 'critico': return 'bg-red-500';
    case 'alto': return 'bg-orange-500';
    case 'medio': return 'bg-yellow-500';
    default: return 'bg-blue-500';
  }
};
```

---

## 🧪 COMPARATIVO: DOCUMENTOS vs CÓDIGO REAL

| Aspecto | Documento Técnico | Código Real | Status |
|---------|-------------------|-------------|--------|
| **Badge no menu** | ✅ Descrito | ✅ Implementado | 🟢 OK |
| **MotorLembretesGlobal** | ✅ Código completo | ⚠️ Básico/incompleto | 🟡 PARCIAL |
| **ContatosRequerendoAtencao** | ✅ Descrito | ✅ Implementado | 🟢 OK |
| **Automação scheduled** | ✅ Mencionada | ❌ Não existe | 🔴 FALTANDO |
| **Integração IA** | ✅ insights.alerts | ✅ Implementado | 🟢 OK |
| **Fallback regras locais** | ❌ Não mencionado | ✅ Implementado | 🟢 EXTRA |
| **Ações no dropdown** | ✅ Marcar resolvido | ❌ Não existe | 🔴 FALTANDO |
| **WorkQueueItem** | ❌ Não mencionado | ✅ Sistema paralelo | 🟡 DESCONEXO |
| **Agrupamentos** | ❌ Não mencionado | ✅ Tópico/Usuário | 🟢 EXTRA |

---

## 🎯 VISÃO CONSOLIDADA DO AGENTE INTERNO (PROJETO)

### **Conforme Documento "PROJETO_AGENTE_INTERNO_NEXUS360":**

O Agente Interno é um **sistema de análise profunda** que:

1. **Coleta mensagens em ordem cronológica** (ASC) ← 🔴 CRÍTICO
2. **Identifica turning points** (objeções, aprovações, urgências)
3. **Seleciona contexto inteligente** (não pega 30 aleatórias)
4. **Calcula métricas corretas** (tempo resposta, engajamento)
5. **Chama LLM com prompt estruturado**
6. **Valida e persiste JSON completo** (9 campos)
7. **Retorna contrato padronizado** ({ success, saved, insights, scope })

### **Schema Completo (9 Campos):**
```typescript
insights: {
  1. scores: { buy_intent, engagement, deal_risk, health, score_explain }
  2. stage: { current, label, days_stalled, pipeline_hint }
  3. root_causes: [ { title, severity, why, detected_at } ]
  4. evidence_snippets: [ { ts, text, topic, relevance } ]
  5. alerts: [ { severity, title, action, due_at } ] ← 🎯 FONTE
  6. next_best_action: { objective, steps, suggested_message }
  7. objections: [ { type, text, status, handling } ]
  8. topics: [ 'mudanca_infra', 'antivirus', ... ]
  9. milestones: [ { stage, label, date, source } ]
}
```

### **Exemplo Real (Caso Bruna):**
```json
{
  "alerts": [
    {
      "severity": "high",
      "reason": "Documentação pendente (NF/XML/boletos)",
      "action": "Confirmar envio para financeiro@adgeo.com.br"
    },
    {
      "severity": "critical",
      "reason": "Janela curta renovação antivírus",
      "action": "Validar licença + enviar cotação urgente"
    }
  ],
  "next_best_action": {
    "suggested_message": "Bruna, bom dia! Confirmei aqui: já encaminhamos a nota fiscal do HD (PDF), o XML e os boletos para o e-mail financeiro@adgeo.com.br..."
  }
}
```

---

## 🔗 INTEGRAÇÃO COMPLETA (TODOS OS COMPONENTES)

```
┌────────────────────────────────────────────────────────────────────┐
│                    ECOSSISTEMA COMPLETO                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  BACKEND (Scheduled + Webhook)                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │  │
│  │  │ analisarClientes│  │ watchdogIdle    │                   │  │
│  │  │ EmLote          │  │ Contacts        │                   │  │
│  │  │ (a cada 6h)     │  │ (a cada 30min)  │                   │  │
│  │  └────────┬────────┘  └────────┬────────┘                   │  │
│  │           │                    │                             │  │
│  │           ▼                    ▼                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │  │
│  │  │ContactBehavior  │  │  WorkQueueItem  │                   │  │
│  │  │Analysis         │  │                 │                   │  │
│  │  │(insights JSONB) │  │  (filas simples)│                   │  │
│  │  └────────┬────────┘  └────────┬────────┘                   │  │
│  └──────────┼────────────────────┼─────────────────────────────┘  │
│             │                    │                                │
│             └────────────────────┘                                │
│                      │                                            │
│                      ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  FRONTEND (Layout.jsx - a cada 15min)                        │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  calcularLembretesGlobal()                             │  │  │
│  │  │  ├─ Query: ContactBehaviorAnalysis (com insights)      │  │  │
│  │  │  ├─ Query: WorkQueueItem (status: open)                │  │  │
│  │  │  ├─ Query: TarefaInteligente (criticas)                │  │  │
│  │  │  └─ Retorna: { Comunicacao: 12, Dashboard: 5, ... }    │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                              │                                │  │
│  │                              ▼                                │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  NavItem (Sidebar)                                     │  │  │
│  │  │  ├─ lembretesCount = contadores['Comunicacao']         │  │  │
│  │  │  ├─ Badge animado (pulse)                              │  │  │
│  │  │  ├─ Cor dinâmica (vermelho/laranja/roxo)               │  │  │
│  │  │  └─ Tooltip: "12 lembretes"                            │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PÁGINA COMUNICAÇÃO                                          │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  ContatosRequerendoAtencao (variant="header")          │  │  │
│  │  │  ├─ Botão com badge                                    │  │  │
│  │  │  └─ Dropdown:                                          │  │  │
│  │  │      ├─ Query: ContactBehaviorAnalysis                 │  │  │
│  │  │      ├─ Processar alertas (insights.alerts)            │  │  │
│  │  │      ├─ Priorizar (deal_risk, scores)                  │  │  │
│  │  │      ├─ Agrupar (tópico/usuário)                       │  │  │
│  │  │      └─ Exibir lista clicável                          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 📝 RECEITA PARA IMPLEMENTAÇÃO COMPLETA

### **Ingredientes Necessários:**

1. **Automação Scheduled** ← 🔴 AUSENTE
   - Função: `analisarClientesEmLote`
   - Intervalo: 6 horas
   - Payload: `{ limit: 100 }`

2. **Motor de Lembretes Completo** ← 🟡 PARCIAL
   - Arquivo: `MotorLembretesGlobal.js`
   - Queries: ContactBehaviorAnalysis + WorkQueueItem + TarefaInteligente
   - Agrupamento por página

3. **Ações no Dropdown** ← 🔴 AUSENTE
   - Botões: Resolvido, Dispensar, Copiar Mensagem
   - Handlers: atualizar análise, criar log

4. **Consolidação de Sistemas** ← 🟡 DESEJÁVEL
   - Unificar WorkQueueItem + ContactBehaviorAnalysis
   - Página única de alertas

### **Modo de Preparo:**

1. **Criar automação** (5 minutos via UI)
2. **Completar MotorLembretesGlobal.js** (30 minutos)
3. **Testar ciclo completo** (15 minutos)
4. **Adicionar ações no dropdown** (2 horas)
5. **Consolidar sistemas** (1 dia)

---

## 🏆 RESULTADO ESPERADO (APÓS IMPLEMENTAÇÃO)

### **Para o Atendente:**
1. Entra no sistema → Vê badge roxo pulsando (12 lembretes)
2. Clica em "Central de Comunicacao"
3. Header mostra: "Contatos Requerendo Atenção [12]"
4. Expande dropdown → Vê lista agrupada por tópico:
   - 🔴 Documentação Pendente (3)
   - 🟠 Follow-ups Sem Resposta (5)
   - 🟡 Renovação/Oportunidade (4)
5. Clica em "Bruna (Adgeo)" → Abre chat
6. Vê próxima ação sugerida: "Confirmar envio NF..."
7. Clica em "Copiar Mensagem Sugerida"
8. Cola no chat e envia
9. Clica em "Marcar como Resolvido"
10. Alerta desaparece da lista
11. Badge diminui para 11

### **Para o Sistema:**
1. Registra em `EngagementLog`: ação executada
2. Limpa `insights.alerts` da análise
3. Recalcula prioridade do contato
4. Atualiza métricas de efetividade
5. IA aprende com o resultado (feedback loop)

---

## 🎓 CONCLUSÃO - DIAGNÓSTICO FINAL

### **Estado Atual do Botão "Contatos Precisando de Atenção":**

```
🟢 UI/Frontend:        85% completo
🟡 Backend/Dados:      40% completo
🔴 Automação/Trigger:  10% completo (watchdog apenas)
🟡 Integração:         60% completo
───────────────────────────────────
📊 MÉDIA GERAL:        49% FUNCIONAL
```

### **Analogia:**
É como ter um **painel de controle de aviões** sofisticado, com alertas coloridos, gráficos e botões... mas os **sensores dos aviões não estão ligados**. O painel funciona perfeitamente se você alimentá-lo manualmente com dados, mas não há fluxo automático de informações.

### **Prioridade Imediata:**
1. 🔴 **Criar automação scheduled** (15 min de trabalho)
2. 🔴 **Completar MotorLembretesGlobal.js** (30 min)
3. 🟡 **Testar com dados reais** (15 min)
4. 🟡 **Adicionar ações no dropdown** (2 horas)

### **Próximos Passos:**
- Testar sistema com cenário real (caso Bruna)
- Ajustar thresholds conforme feedback
- Consolidar com WorkQueueItem
- Criar dashboard de métricas de efetividade

---

**Documento gerado por:** Base44 AI  
**Baseado em:** Código real + Análises técnicas + Projeto Agente Interno  
**Versão:** 2.0 Consolidada  
**Data:** 2026-02-10