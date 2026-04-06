# 🏗️ ARQUITETURA 4 CAMADAS - Contatos Inteligentes
## Nexus360 - Sistema Completo de Priorização

---

## 📋 VISÃO GERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA 4 CAMADAS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] Análise Profunda        [2] Aquecimento/Lote              │
│      por Contato                  (Scheduled)                   │
│         ↓                              ↓                         │
│  ContactBehaviorAnalysis  ←───────────┘                         │
│  (insights completos)                                           │
│         ↓                                                        │
│  [3] Priorização             [4] Interface                      │
│      Operacional                  (UI/UX)                       │
│         ↓                              ↓                         │
│  Lista ordenada           →   Sidebar + Página                  │
│  com scores                   com ações                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔬 CAMADA 1: Análise Profunda por Contato

**Responsabilidade:** Entender comportamento de UM contato específico

### Arquivos:
```
📁 functions/
  └─ analisarComportamentoContato.js

📁 entities/
  └─ ContactBehaviorAnalysis.json
```

### Fluxo:
```javascript
// Input
{ contact_id: "abc123" }

// Processamento
1. Buscar mensagens: Message.filter({ contact_id }, 'created_date', 100)
2. Extrair contexto:
   - Últimas 50-100 mensagens
   - Imagens (se houver)
   - Sentimento geral
3. Chamar IA com prompt especializado
4. Gerar insights completos

// Output (ContactBehaviorAnalysis)
{
  contact_id: "abc123",
  // Campos rasos (query-friendly)
  deal_risk: 75,
  buy_intent: 45,
  engagement: 60,
  health: 55,
  ultima_analise: "2026-02-10T10:30:00Z",
  
  // JSONB completo (insights)
  insights: {
    scores: { deal_risk, buy_intent, engagement, health },
    stage: { current, label, days_stalled },
    root_causes: [{ title, description }],
    evidence_snippets: ["msg1", "msg2"],
    alerts: [{ level, reason }],
    next_best_action: { 
      action, 
      deadline_hours, 
      message_suggestion 
    },
    objections: [],
    topics: [],
    milestones: []
  }
}
```

### Quando executar:
- ✅ On-demand (clique em "Analisar contato")
- ✅ Via Camada 2 (análise em lote)
- ✅ Webhook (nova mensagem crítica)

---

## ⚙️ CAMADA 2: Motor de Aquecimento / Análise em Lote

**Responsabilidade:** Manter análises atualizadas para TODOS os contatos (leads/clientes) do banco

### Arquivos:
```
📁 functions/
  └─ analisarClientesEmLote.js (MODO: scheduled)
```

### Fluxo:
```javascript
// Input (Scheduled)
{
  limit: 50,
  priorizar_ativos: true,
  tipo: ['lead', 'cliente'],
  diasInatividade: 7
}

// Processamento
1. Query Contact:
   - tipo_contato IN ['lead', 'cliente']
   - ultima_interacao <= hoje - 7 dias
   - assigned_to = user.id (se não admin)
   
2. Para cada contato:
   - Verifica análise recente (< 24h)
   - Se não existe → chama analisarComportamentoContato
   - Delay 200ms (anti-rate-limit)
   
3. Retorna: { processados, criados, pulados, erros }

// Output
ContactBehaviorAnalysis atualizado para 50 contatos
```

### Quando executar:
- ✅ **Scheduler diário**: Contatos com 2+ dias sem mensagem
- ✅ **Scheduler semanal**: Clientes com 7+ dias sem interação (health check)
- ✅ **On-demand**: Botão "Atualizar análises"

---

## 🎯 CAMADA 3: Priorização Operacional

**Responsabilidade:** Transformar análises em lista ordenada ACIONÁVEL

### Arquivos:
```
📁 functions/
  └─ analisarClientesEmLote.js (MODO: priorizacao)

📁 components/hooks/
  └─ useContatosInteligentes.js
```

### Fluxo (Backend):
```javascript
// Input (Priorização)
{
  modo: 'priorizacao',
  tipo: ['lead', 'cliente'],
  diasSemMensagem: 2,
  minDealRisk: 30,
  limit: 50
}

// Processamento
1. Query Contact (filtrado por user)
2. Buscar ContactBehaviorAnalysis
3. Para cada contato:
   - Extrair scores, stage, root_causes, next_action
   - Calcular prioridadeScore:
     = 0.4*deal_risk + 
       0.25*(100-buy_intent) + 
       0.2*(100-engagement) + 
       0.15*min(days_stalled*5, 15)
   - Determinar prioridadeLabel (CRITICO/ALTO/MEDIO/BAIXO)
4. Ordenar por prioridadeScore DESC
5. Calcular estatísticas agregadas

// Output
{
  success: true,
  modo: 'priorizacao',
  clientes: [
    {
      contact_id, nome, empresa, telefone, tipo_contato,
      deal_risk, buy_intent, engagement, health,
      stage_current, stage_label, days_stalled,
      root_causes: ["Sem resposta há 5d", "NF pendente"],
      next_action: "Confirmar recebimento da NF",
      suggested_message: "Olá! Sobre a NF...",
      prioridadeScore: 78,
      prioridadeLabel: "CRITICO"
    },
    ...
  ],
  estatisticas: {
    total: 23,
    porPrioridade: { CRITICO: 3, ALTO: 7, MEDIO: 10, BAIXO: 3 },
    scoresMedios: { deal_risk: 45, engagement: 62 }
  }
}
```

### Fluxo (Frontend - Hook):
```javascript
// useContatosInteligentes.js
const { clientes, estatisticas, loading, totalUrgentes } = 
  useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 30,
    limit: 50,
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000
  });

// Features do hook:
- Auto-refresh a cada 5min
- Throttle (60s) para evitar chamadas duplicadas
- Recarrega ao focar janela
- Try-catch com fallback
- Retorna: clientes, estatisticas, criticos, altos, refetch()
```

---

## 🎨 CAMADA 4: Interface (UI/UX)

**Responsabilidade:** Mostrar alertas e dar ações rápidas

### 4.1 Sidebar (Layout.jsx)

**Arquivo:** `Layout.js`

```javascript
// Usa hook
const { totalUrgentes, criticos } = useContatosInteligentes(globalUsuario);

// Mapeia contadores
const contadoresLembretes = {
  'Comunicacao': totalUrgentes,
  'ContatosInteligentes': totalUrgentes, // Nova página
  'Dashboard': criticos.length
};

// NavItem renderiza badge
<NavItem 
  lembretesCount={contadoresLembretes['ContatosInteligentes']}
  href={createPageUrl('ContatosInteligentes')}
  icon={Target}
  label="Contatos Urgentes"
/>
```

### 4.2 Página ContatosInteligentes.jsx

**Arquivo:** `pages/ContatosInteligentes.jsx`

**Estrutura:**
```jsx
<ContatosInteligentes>
  {/* Header */}
  <Header>
    <Title>Contatos Inteligentes</Title>
    <Button onClick={refetch}>Atualizar</Button>
  </Header>
  
  {/* Estatísticas */}
  <Grid cols={4}>
    <StatCard title="Críticos" value={criticos.length} color="red" />
    <StatCard title="Alta Prioridade" value={altos.length} color="orange" />
    <StatCard title="Total Urgentes" value={totalUrgentes} color="blue" />
    <StatCard title="Total Analisados" value={clientes.length} />
  </Grid>
  
  {/* Filtros */}
  <Filtros>
    <Button variant={filtroAtivo === 'todos'} onClick={() => set('todos')}>
      Todos ({clientes.length})
    </Button>
    <Button variant={filtroAtivo === 'critico'} onClick={() => set('critico')}>
      Críticos ({criticos.length})
    </Button>
    <Button variant={filtroAtivo === 'alto'} onClick={() => set('alto')}>
      Alta Prioridade ({totalUrgentes})
    </Button>
  </Filtros>
  
  {/* Lista */}
  <Grid cols={3}>
    {clientesFiltrados.map(cliente => (
      <ClienteCard key={cliente.contact_id} cliente={cliente} />
    ))}
  </Grid>
</ContatosInteligentes>
```

### 4.3 Componente ClienteCard

**Arquivo:** `components/inteligencia/ClienteCard.jsx`

**Estrutura:**
```jsx
<Card borderLeft={cor por prioridade}>
  <CardHeader>
    {/* Nome, empresa, telefone */}
    <Badge prioridade={CRITICO/ALTO/MEDIO/BAIXO} />
    <Badges>
      {stage_current}
      {days_stalled}d parado
      {tipo_contato}
    </Badges>
  </CardHeader>
  
  <CardContent>
    {/* Scores */}
    <Grid cols={4}>
      <Score label="Risco" value={deal_risk} />
      <Score label="Intenção" value={buy_intent} />
      <Score label="Engaj." value={engagement} />
      <Score label="Saúde" value={health} />
    </Grid>
    
    {/* Causas raiz */}
    <Section title="Causas:">
      <Badge>{root_cause_1}</Badge>
      <Badge>{root_cause_2}</Badge>
    </Section>
    
    {/* Ação recomendada */}
    <Box bg="blue-50">
      <Text>💡 Ação Recomendada:</Text>
      <Text>{next_action}</Text>
    </Box>
    
    {/* Botões */}
    <Flex gap={2}>
      <Button onClick={navigate('/comunicacao?contact=...')}>
        Responder
      </Button>
      <Button onClick={copiarMensagem}>
        Copiar Msg
      </Button>
    </Flex>
  </CardContent>
</Card>
```

---

## 🔄 FLUXO COMPLETO (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO 4 CAMADAS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⏰ AUTOMAÇÃO DIÁRIA (00:00)                                     │
│     └── analisarClientesEmLote (modo: scheduled)                │
│         ├── Query: leads/clientes com 2+ dias sem msg           │
│         ├── Para cada: chama analisarComportamentoContato       │
│         └── Atualiza: ContactBehaviorAnalysis                   │
│                                                                  │
│  ⏰ AUTOMAÇÃO SEMANAL (Segunda 06:00)                            │
│     └── analisarClientesEmLote (modo: scheduled)                │
│         ├── Query: clientes com 7+ dias sem msg                 │
│         └── Health check semanal                                │
│                                                                  │
│  👤 USUÁRIO ABRE O SISTEMA                                       │
│     └── Layout.jsx carrega                                      │
│         └── useContatosInteligentes()                           │
│             └── analisarClientesEmLote (modo: priorizacao)      │
│                 ├── Busca Contact (filtrado por user)           │
│                 ├── Busca ContactBehaviorAnalysis               │
│                 ├── Calcula prioridadeScore                     │
│                 └── Retorna lista ordenada                      │
│                     ↓                                            │
│                 setContadores({ ContatosInteligentes: 12 })     │
│                     ↓                                            │
│                 NavItem mostra badge "12" (animate pulse)       │
│                                                                  │
│  🖱️ USUÁRIO CLICA NO BADGE                                       │
│     └── Navigate → /contatos-inteligentes                       │
│         └── ContatosInteligentes.jsx renderiza                  │
│             ├── Cards de estatísticas                           │
│             ├── Filtros (todos/críticos/altos)                  │
│             └── Grid de ClienteCard                             │
│                 ├── Scores coloridos                            │
│                 ├── Causas raiz                                 │
│                 ├── Ação recomendada                            │
│                 └── Botões:                                     │
│                     ├── Responder → /comunicacao                │
│                     └── Copiar Msg → clipboard                  │
│                                                                  │
│  ✅ USUÁRIO AGE EM < 5 SEGUNDOS                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 MAPEAMENTO COMPLETO DE ARQUIVOS

### 🔴 CAMADA 1: Análise Profunda

| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `functions/analisarComportamentoContato.js` | Backend | Análise de UM contato via IA |
| `entities/ContactBehaviorAnalysis.json` | Schema | Armazenar insights completos |

**API da Camada 1:**
```javascript
// Entrada
POST /api/functions/analisarComportamentoContato
{ "contact_id": "abc123" }

// Saída
{
  success: true,
  contact_id: "abc123",
  analise: { /* ContactBehaviorAnalysis */ }
}
```

---

### 🟠 CAMADA 2: Aquecimento/Lote

| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `functions/analisarClientesEmLote.js` | Backend | Processar múltiplos contatos |
| Automação ID `697cc305...` | Scheduler | Executar a cada 6h |

**API da Camada 2:**
```javascript
// Entrada (Scheduled)
POST /api/functions/analisarClientesEmLote
{
  "modo": "scheduled",
  "limit": 50,
  "priorizar_ativos": true,
  "tipo": ["lead", "cliente"]
}

// Saída
{
  success: true,
  modo: "scheduled",
  total_processados: 50,
  analises_criadas: 23,
  analises_puladas: 27,
  erros: []
}
```

---

### 🟡 CAMADA 3: Priorização Operacional

| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `functions/analisarClientesEmLote.js` | Backend | Retornar lista ordenada (modo: priorizacao) |
| `components/hooks/useContatosInteligentes.js` | Hook | Gerenciar estado + auto-refresh |

**API da Camada 3:**
```javascript
// Entrada (Frontend via hook)
POST /api/functions/analisarClientesEmLote
{
  "modo": "priorizacao",
  "tipo": ["lead", "cliente"],
  "diasSemMensagem": 2,
  "minDealRisk": 30,
  "limit": 50
}

// Saída
{
  success: true,
  modo: "priorizacao",
  clientes: [
    {
      contact_id, nome, empresa, telefone, tipo_contato,
      deal_risk, buy_intent, engagement, health,
      stage_current, days_stalled,
      root_causes: ["Causa 1", "Causa 2"],
      next_action: "Confirmar recebimento",
      suggested_message: "Olá! Sobre...",
      prioridadeScore: 78,
      prioridadeLabel: "CRITICO"
    }
  ],
  estatisticas: {
    total: 23,
    porPrioridade: { CRITICO: 3, ALTO: 7, ... },
    scoresMedios: { deal_risk: 45, ... }
  }
}
```

**Hook:**
```javascript
const { 
  clientes,        // Array ordenado
  estatisticas,    // Stats agregadas
  loading,         // Estado
  totalUrgentes,   // CRITICO + ALTO
  criticos,        // Apenas CRITICO
  altos,           // Apenas ALTO
  refetch          // Forçar reload
} = useContatosInteligentes(usuario, opcoes);
```

---

### 🟢 CAMADA 4: Interface (UI/UX)

| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `Layout.js` | Layout | Sidebar + contadores globais |
| `pages/ContatosInteligentes.jsx` | Página | Lista filtrada de contatos |
| `components/inteligencia/ClienteCard.jsx` | Card | Exibir contato + ações |
| `components/comunicacao/ContatosRequerendoAtencao.jsx` | Dropdown | Versão compacta (header) |

**Fluxo Layout:**
```javascript
// Layout.jsx
const { totalUrgentes, criticos } = useContatosInteligentes(globalUsuario);

const contadoresLembretes = {
  'ContatosInteligentes': totalUrgentes,
  'Dashboard': criticos.length
};

<NavItem 
  page="ContatosInteligentes"
  lembretesCount={totalUrgentes}
  icon={Target}
/>
```

**Fluxo Página:**
```javascript
// ContatosInteligentes.jsx
const { clientes, estatisticas, loading, refetch } = 
  useContatosInteligentes(usuario);

const [filtroAtivo, setFiltroAtivo] = useState('todos');

const clientesFiltrados = clientes.filter(c => {
  if (filtroAtivo === 'critico') return c.prioridadeLabel === 'CRITICO';
  if (filtroAtivo === 'alto') return ['CRITICO','ALTO'].includes(c.prioridadeLabel);
  return true;
});

return (
  <Grid>
    <StatCards stats={estatisticas} />
    <Filtros ativo={filtroAtivo} onChange={setFiltroAtivo} />
    <Grid cols={3}>
      {clientesFiltrados.map(c => <ClienteCard cliente={c} />)}
    </Grid>
  </Grid>
);
```

---

## 🔄 SINCRONIZAÇÃO ENTRE CAMADAS

```
┌─────────────────────────────────────────────────────────────────┐
│  Camada 1          Camada 2          Camada 3        Camada 4   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Contato X]   →   [Scheduler]   →   [Hook]      →   [UI]      │
│       ↓                ↓                ↓               ↓        │
│  analisarComport.  analisarLote   useContatos    Layout/Página  │
│       ↓                ↓                ↓               ↓        │
│  ContactBehavior.  (reutiliza)    GET lista      Badge + Cards  │
│  insights: {...}   análise < 24h  ordenada       com ações      │
│                                                                  │
│  FONTE ÚNICA       MANUTENÇÃO     PRIORIZAÇÃO    VISUALIZAÇÃO   │
│  DA VERDADE        PERIÓDICA      OPERACIONAL    ACIONÁVEL      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 QUANDO USAR CADA CAMADA

| Situação | Camada | Arquivo | Trigger |
|----------|--------|---------|---------|
| Analisar 1 contato específico | 1 | `analisarComportamentoContato` | Clique "Analisar" |
| Manter base atualizada (diário) | 2 | `analisarClientesEmLote` (scheduled) | Automação 6h |
| Health check semanal | 2 | `analisarClientesEmLote` (scheduled) | Automação semanal |
| Ver quem atender AGORA | 3+4 | `useContatosInteligentes` + Página | Abrir sistema |
| Badge no menu | 3+4 | Hook + Layout | Auto-refresh 5min |
| Dropdown rápido | 4 | `ContatosRequerendoAtencao` | Clique botão |

---

## 📊 MÉTRICAS DE SUCESSO POR CAMADA

### Camada 1 (Análise):
- ✅ 100% dos contatos analisados têm `insights` completo
- ✅ < 5s para analisar 1 contato
- ✅ Multimodal (texto + imagens)

### Camada 2 (Aquecimento):
- ✅ 95%+ dos contatos ativos têm análise < 24h
- ✅ Scheduler 0% falhas
- ✅ 50 contatos/execução sem rate limit

### Camada 3 (Priorização):
- ✅ Resposta < 2s para 50 contatos
- ✅ Priorização científica (fórmula validada)
- ✅ Estatísticas agregadas em tempo real

### Camada 4 (Interface):
- ✅ Badge atualiza a cada 5min
- ✅ Página carrega em < 1s
- ✅ Ação "Copiar Msg" em 1 clique

---

## 🚀 PRÓXIMOS PASSOS (Implementação)

### ✅ Já Implementado:
- [x] Camada 1: `analisarComportamentoContato` (existente)
- [x] Camada 2: `analisarClientesEmLote` (criado)
- [x] Automação scheduled (6h)
- [x] Filtros por leads/clientes do usuário

### 🆕 Recém Criado:
- [x] Camada 3: Hook `useContatosInteligentes`
- [x] Camada 3: Modo priorização em `analisarClientesEmLote`
- [x] Camada 4: Página `ContatosInteligentes.jsx`
- [x] Camada 4: Componente `ClienteCard.jsx`

### 🔧 Ajustes Necessários:
- [ ] Adicionar rota no menu do Layout
- [ ] Testar modo priorização
- [ ] Validar cálculo de prioridadeScore
- [ ] Ajustar thresholds conforme feedback

---

## 🎓 DOCUMENTAÇÃO DE USO

### Para Desenvolvedores:

**Adicionar novo score:**
1. Editar: `analisarComportamentoContato` (prompt IA)
2. Adicionar campo em: `ContactBehaviorAnalysis.insights.scores`
3. Usar em: `calcularPrioridade()` na Camada 3

**Mudar critérios de priorização:**
1. Editar: `functions/analisarClientesEmLote.js` (modo priorizacao)
2. Ajustar pesos em: `prioridadeScore = 0.4*deal_risk + ...`

**Adicionar novo filtro:**
1. Editar: `pages/ContatosInteligentes.jsx`
2. Adicionar botão em: `<Filtros>`
3. Implementar lógica em: `clientesFiltrados.filter(...)`

### Para Usuários:

**Como usar o sistema:**
1. Abrir app → Badge mostra número de urgentes
2. Clicar badge → Vai para página de Contatos Inteligentes
3. Ver cards ordenados por prioridade (vermelho = urgente)
4. Ler "Ação Recomendada" + causas
5. Clicar "Copiar Msg" → Colar no WhatsApp
6. OU clicar "Responder" → Abrir chat direto

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Infraestrutura:
- [x] Camada 1 funcionando (análise por contato)
- [x] Camada 2 funcionando (scheduled)
- [x] Camada 3 implementada (priorização)
- [x] Camada 4 implementada (UI)
- [ ] Rota adicionada ao menu
- [ ] Testes end-to-end

### Filtros:
- [x] Apenas leads/clientes
- [x] Apenas contatos do usuário logado
- [x] Admin vê todos
- [x] Respeita vendedor_responsavel

### Performance:
- [x] Queries otimizadas (N+1 evitado)
- [x] Cache de análises (< 24h)
- [x] Auto-refresh inteligente (5min)
- [x] Throttle (60s)

### UX:
- [x] Badge animado no menu
- [x] Página dedicada com filtros
- [x] Cards informativos
- [x] Ações rápidas (1 clique)

---

**Status:** ✅ Arquitetura 4 camadas implementada  
**Próximo passo:** Adicionar rota "Contatos Inteligentes" no menu do Layout