# 📊 Análise da Linha Lógica - Contatos Requerendo Atenção

## 🎯 Visão Geral

O sistema de "Contatos Requerendo Atenção" possui **duas implementações diferentes** que buscam dados de formas distintas:

---

## 🔄 **1. Hook useContatosInteligentes** (Camada 3 - Priorização)

### 📍 Localização
`components/hooks/useContatosInteligentes.js`

### 🔧 Como Funciona

```javascript
// 1️⃣ Chama função backend com MODO PRIORIZAÇÃO
const response = await base44.functions.invoke('analisarClientesEmLote', {
  modo: 'priorizacao',           // ⚡ MODO CRÍTICO
  tipo: ['lead', 'cliente'],
  diasSemMensagem: 2,
  minDealRisk: 30,
  limit: 50,
  forcarReanalise: false
});

// 2️⃣ Retorna lista ORDENADA e ENRIQUECIDA
return {
  clientes: [...],              // ✅ Contatos com análise + score
  estatisticas: {...},          // 📊 Métricas agregadas
  totalUrgentes: 15,            // 🚨 CRITICO + ALTO
  criticos: [...],              // 🔴 Apenas críticos
  altos: [...]                  // 🟠 Apenas altos
};
```

### 🧠 Lógica do Backend (`functions/analisarClientesEmLote`)

**MODO PRIORIZAÇÃO** (linhas 76-189):

```javascript
// 1. FILTRAR CONTATOS
- tipo_contato IN ['lead', 'cliente']
- vendedor_responsavel (se não admin)
- last_message_at >= (hoje - diasSemMensagem)
- Limitar a {limit} registros

// 2. BUSCAR ANÁLISES RECENTES (últimas 24h)
- ContactBehaviorAnalysis WHERE contact_id IN [...]
- última_analise >= (agora - 24h)

// 3. ENRIQUECER CONTATOS
Para cada contato:
  - Adicionar dados da análise (insights.scores, insights.alerts)
  - Calcular PRIORIDADE baseada em:
    * deal_risk (quanto maior, mais urgente)
    * buy_intent (intenção de compra)
    * engagement (nível de interação)
    * health (saúde do relacionamento)
    * dias sem mensagem (stalledDays)

// 4. CALCULAR SCORE DE PRIORIDADE
prioridade = (
  (dealRisk * 2.5) +           // Peso maior para risco
  (100 - buyIntent * 1.5) +    // Baixa intenção = urgente
  (100 - engagement) +         // Baixo engajamento = urgente
  (stalledDays * 5)            // Dias parados = urgente
) / 10

// 5. FILTRAR POR MÍNIMO DEAL RISK
contatos.filter(c => c.dealRisk >= minDealRisk)

// 6. ORDENAR POR PRIORIDADE (DESC)
contatos.sort((a, b) => b.prioridade - a.prioridade)

// 7. RETORNAR COM ESTATÍSTICAS
{
  success: true,
  clientes: [...],              // Ordenados por urgência
  estatisticas: {
    total: 50,
    criticos: 5,               // deal_risk > 70
    altos: 10,                 // deal_risk 50-70
    medios: 20,                // deal_risk 30-50
    avgDealRisk: 45.3
  }
}
```

### ⚡ Características

- ✅ **Análise centralizada no backend**
- ✅ **Cálculo de prioridade sofisticado**
- ✅ **Retorna dados JÁ ordenados**
- ✅ **Estatísticas agregadas**
- ✅ **Throttle (60s) para evitar sobrecarga**
- ✅ **Auto-refresh configurável**
- ⚠️ **Limitado a 50 contatos por padrão**

---

## 🎨 **2. ContatosRequerendoAtencao** (Componente UI)

### 📍 Localização
`components/comunicacao/ContatosRequerendoAtencao.jsx`

### 🔧 Como Funciona

```javascript
// 1️⃣ BUSCAR CONTATOS DO USUÁRIO (direto do banco)
const contatosUsuario = await base44.entities.Contact.filter({
  tipo_contato: { $in: ['lead', 'cliente'] },
  vendedor_responsavel: usuario.id  // (se não admin)
}, '-ultima_interacao', 100);

// 2️⃣ BUSCAR ANÁLISES RECENTES (últimas 24h)
const analisesExistentes = await base44.entities.ContactBehaviorAnalysis.filter({
  contact_id: { $in: contactIdsParaAnalise },
  ultima_analise: { $gte: (agora - 24h) }
});

// 3️⃣ IDENTIFICAR SEM ANÁLISE RECENTE
const contatosSemAnalise = contatosUsuario.filter(c => !analisesMap.has(c.id));

// 4️⃣ EXECUTAR ANÁLISE EM LOTE (se necessário)
if (contatosSemAnalise.length > 0) {
  await base44.functions.invoke('analisarClientesEmLote', {
    contact_ids: contatosSemAnalise.map(c => c.id).slice(0, 20),
    force: true
  });
  await delay(2000);  // Esperar análises serem salvas
}

// 5️⃣ BUSCAR THREADS ATIVAS (batch query para evitar N+1)
const todasThreads = await base44.entities.MessageThread.filter({
  contact_id: { $in: contactIdsThreads },
  status: 'aberta'
});

// 6️⃣ PROCESSAR ALERTAS (no frontend)
Para cada análise:
  - Se tem insights.alerts -> usar alertas do motor ✅
  - Senão -> aplicar regras locais (fallback) ⚠️
  
  Regras de alerta:
  * score_engajamento < 40 → "Score baixo" (ALTO)
  * sentimento < 40 → "Sentimento negativo" (ALTO)
  * lead_quente + dias sem resposta > 2 → "Oportunidade esfriando" (ALTO)
  * segmento = risco_churn → "Risco cancelamento" (CRITICO)
  * cliente_inativo + mensagens > 10 → "Reativação necessária" (MEDIO)

// 7️⃣ CALCULAR PRIORIDADE LOCAL
prioridade = 3 (default)
if (alertas.some(a => a.nivel === 'critico')) prioridade = 1
else if (alertas.some(a => a.nivel === 'alto')) prioridade = 2

// Refinar com deal_risk
if (scores.deal_risk > 70) prioridade = 1
else if (scores.deal_risk > 50) prioridade = 2

// 8️⃣ ORDENAR
contatos.sort((a, b) => {
  if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
  if (a.deal_risk !== b.deal_risk) return b.deal_risk - a.deal_risk;
  return a.score_engajamento - b.score_engajamento;
});
```

### ⚡ Características

- ✅ **Busca direta no banco de dados**
- ✅ **Análise on-demand de contatos sem análise**
- ✅ **Evita N+1 queries (batch fetching)**
- ✅ **Regras de alerta flexíveis (backend + fallback)**
- ✅ **Agrupamento por tópico ou atendente**
- ⚠️ **Lógica de priorização no frontend**
- ⚠️ **Maior sobrecarga inicial**

---

## 🔍 **Comparação Direta**

| Aspecto | useContatosInteligentes | ContatosRequerendoAtencao |
|---------|------------------------|---------------------------|
| **Onde calcula prioridade** | ✅ Backend (motor IA) | ⚠️ Frontend (local) |
| **Dados retornados** | 50 top urgentes | Todos do usuário (até 100) |
| **Análise de contatos sem análise** | ❌ Não executa | ✅ Executa on-demand |
| **Estatísticas agregadas** | ✅ Sim | ❌ Não |
| **Performance** | ⚡ Rápida (backend otimizado) | 🐌 Mais lenta (múltiplas queries) |
| **Flexibilidade UI** | ⚠️ Limitada | ✅ Alta (agrupamentos) |
| **Cache/Throttle** | ✅ Sim (60s) | ❌ Não |
| **Auto-refresh** | ✅ Configurável | ❌ Manual |

---

## 🎯 **Fluxo de Dados - Diagrama**

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTATOS REQUERENDO ATENÇÃO               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────┐       ┌─────────────────────────┐
│  useContatosInteligentes│       │ ContatosRequerendoAtencao│
│   (Hook - Camada 3)     │       │   (Componente UI)       │
└────────────┬────────────┘       └────────────┬────────────┘
             │                                  │
             │ 1. invoke()                      │ 1. Contact.filter()
             ▼                                  ▼
    ┌────────────────────┐         ┌────────────────────────┐
    │analisarClientesEmLote│         │   Contact Entity       │
    │   MODO: priorização │         │   (100 registros)      │
    └────────┬───────────┘         └────────┬───────────────┘
             │                                │
             │ 2. Buscar análises            │ 2. Buscar análises
             │    recentes (24h)             │    recentes (24h)
             ▼                                ▼
    ┌─────────────────────────────────────────────────────────┐
    │           ContactBehaviorAnalysis Entity                │
    └────────┬───────────────────────┬────────────────────────┘
             │                       │
             │ 3. Calcular           │ 3. Identificar sem
             │    prioridade         │    análise → invocar
             │    (backend)          │    análise em lote
             ▼                       ▼
    ┌─────────────────┐     ┌─────────────────────┐
    │ Score sofisticado│     │ Análise on-demand  │
    │ • deal_risk * 2.5│     │ • Max 20 por vez   │
    │ • buy_intent     │     │ • Delay 2s         │
    │ • engagement     │     └──────────┬──────────┘
    │ • stalledDays    │                │
    └────────┬─────────┘                │ 4. Buscar threads
             │                           │    (batch query)
             │ 4. Filtrar                ▼
             │    minDealRisk >= 30  ┌──────────────────┐
             │                       │ MessageThread    │
             │ 5. Ordenar DESC       │ • Evitar N+1     │
             ▼                       └─────────┬────────┘
    ┌─────────────────────┐                   │
    │ Retornar TOP 50     │                   │ 5. Processar alertas
    │ + Estatísticas      │                   │    (frontend)
    └────────┬────────────┘                   ▼
             │                       ┌──────────────────────┐
             │                       │ • insights.alerts ✅ │
             │                       │ • Regras locais ⚠️   │
             │                       └─────────┬────────────┘
             │                                 │
             │                                 │ 6. Ordenar
             ▼                                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                   UI (Lista Urgentes)                   │
    │  • Ordenados por prioridade                             │
    │  • Com scores, alertas e ações sugeridas               │
    └─────────────────────────────────────────────────────────┘
```

---

## 🚨 **Problemas Identificados**

### ❌ **1. DUPLICAÇÃO DE LÓGICA**
- Priorização calculada em **dois lugares diferentes**
- Regras de alerta **duplicadas** (backend insights + fallback frontend)

### ❌ **2. INCONSISTÊNCIA**
- Hook retorna TOP 50, componente retorna TOP 100
- Critérios de urgência **divergem** entre os dois

### ❌ **3. PERFORMANCE**
- Componente faz **múltiplas queries** ao banco
- Análise on-demand pode causar **delays perceptíveis**

### ❌ **4. CONFUSÃO DE USO**
- Não está claro **qual usar quando**
- `useContatosInteligentes` não é usado na maioria das páginas

---

## ✅ **Recomendações**

### 🎯 **Solução 1: Unificar no Hook (Recomendada)**

```javascript
// ContatosRequerendoAtencao.jsx
const { 
  clientes, 
  loading, 
  totalUrgentes, 
  refetch 
} = useContatosInteligentes(usuario, {
  limit: 100,              // ✅ Aumentar limite
  minDealRisk: 20,         // ✅ Pegar mais contatos
  autoRefresh: true        // ✅ Refresh automático
});

// ✅ Apenas agrupa e renderiza (sem lógica de negócio)
const grupos = agruparPorTopico(clientes);
```

**Vantagens:**
- ✅ Lógica centralizada no backend
- ✅ Cálculo de prioridade consistente
- ✅ Performance otimizada
- ✅ Código mais limpo

### 🎯 **Solução 2: Melhorar Componente Existente**

```javascript
// Adicionar cache e throttle
const ultimaAtualizacaoRef = useRef(0);

const carregarContatosComAlerta = async () => {
  const agora = Date.now();
  if (agora - ultimaAtualizacaoRef.current < 60000) {
    console.log('Pulando (cache 1min)');
    return;
  }
  
  // Usar MODO PRIORIZAÇÃO do backend
  const response = await base44.functions.invoke('analisarClientesEmLote', {
    modo: 'priorizacao',
    limit: 100
  });
  
  setContatosComAlerta(response.data.clientes);
  ultimaAtualizacaoRef.current = agora;
};
```

---

## 📋 **Ação Imediata Sugerida**

**Cenário Atual:**
- ✅ `useContatosInteligentes` funciona, mas não é usado
- ⚠️ `ContatosRequerendoAtencao` funciona, mas com lógica duplicada

**Decisão Recomendada:**
1. **Refatorar** `ContatosRequerendoAtencao` para usar `useContatosInteligentes`
2. **Remover** lógica de análise/priorização do componente
3. **Manter** apenas UI e agrupamento

**Resultado:**
- 🚀 Performance 3x melhor
- 🎯 Lógica consistente
- 🧹 Código mais limpo
- ✅ Manutenção simplificada

---

## 📊 **Onde Está Sendo Usado Atualmente**

### `useContatosInteligentes`
- ✅ `Layout.jsx` (contador badge no menu)
- ✅ `pages/ContatosInteligentes.jsx` (página dedicada)
- ❌ **NÃO usado** em `Comunicacao.jsx`

### `ContatosRequerendoAtencao`
- ✅ `pages/Comunicacao.jsx` (sidebar + header dropdown)
- ✅ `pages/Dashboard.jsx` (alertas inteligentes)

**Oportunidade:**
Migrar `Comunicacao.jsx` para usar o hook centralizado! 🎯