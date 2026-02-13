# 📋 PLANEJAMENTO: SEPARAÇÃO DE ANÁLISES - ASSUNTOS vs PERFIL/COMPORTAMENTO

**Data:** 2026-02-13  
**Objetivo:** Reorganizar sistema de análises em duas categorias distintas e bem definidas

---

## 🎯 PROBLEMA IDENTIFICADO

Atualmente, temos **DOIS tipos de análises completamente diferentes** sendo misturados:

### **TIPO 1: ANÁLISE DE ASSUNTOS** (Conversacional/Mensagem)
- Foco: **O que está sendo discutido AGORA**
- Escopo temporal: **Últimas 10-50 mensagens**
- Objetivo: **Gerar sugestões de resposta inteligentes**
- Volátil: Muda a cada nova mensagem
- TTL de cache: 15 minutos

### **TIPO 2: ANÁLISE DE PERFIL/COMPORTAMENTO** (Relacional/Contato)
- Foco: **Quem é o contato, como ele se comporta ao longo do tempo**
- Escopo temporal: **Todo o histórico (50-200 mensagens)**
- Objetivo: **Classificar relacionamento, calcular scores, prever riscos**
- Estável: Muda lentamente ao longo de semanas
- TTL de cache: 24 horas

---

## 📊 ESTADO ATUAL - ONDE CADA ANÁLISE ESTÁ SENDO USADA

### ✅ ANÁLISE DE ASSUNTOS (JÁ BEM SEPARADA)

| Componente | Localização | Função Backend | Entidade | Status |
|------------|-------------|----------------|----------|--------|
| `SugestorRespostasRapidas` | ChatWindow (Sequência 2) | `gerarSugestoesRespostaContato` | ❌ Não persiste | ✅ OK |
| `SugestorRespostaBroadcast` | ChatWindow (Sequência 0) | Lógica inline (frontend) | ❌ Não persiste | ✅ OK |
| `MensagemReativacaoRapida` | ChatWindow (Sequência 1) | ❌ Nenhuma (templates fixos) | ❌ Não persiste | ✅ OK |

**CACHE:**
- ✅ `ContactBehaviorAnalysis.ai_insights.suggestions_cached` (15min TTL)
- ✅ Validação por `suggestions_last_message_id` (invalida em nova msg)

---

### ⚠️ ANÁLISE DE PERFIL/COMPORTAMENTO (PRECISA REORGANIZAÇÃO)

| Componente | Localização | Função Backend | Entidade | Status | Observações |
|------------|-------------|----------------|----------|--------|-------------|
| `PainelAnaliseContatoIA` | ContactInfoPanel (Aba IA) | `analisarComportamentoContato` | `ContactBehaviorAnalysis` | ✅ OK | ✅ Mostra prontuário completo |
| `CentralInteligenciaContato` | Header do ChatWindow | ❌ **MISTO** | ❌ Calcula inline | ⚠️ **PROBLEMA** | Mistura score UI + análise |
| `ContatosRequerendoAtencao` | Header Global | `analisarClientesEmLote` | ✅ `ContactBehaviorAnalysis` | ✅ OK | Lista priorizada |
| `ContatosInteligentes` (Página) | Menu Lateral | `analisarClientesEmLote` | ✅ `ContactBehaviorAnalysis` | ✅ OK | Dashboard completo |
| `MotorInteligenciaV3` | Backend (classe) | Múltiplas | `ClienteScore` + `AprendizadoIA` | ⚠️ **DUPLICADO** | Overlap com ContactBehaviorAnalysis |

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### **P1: `CentralInteligenciaContato` mistura UI + análise**
```javascript
// ❌ PROBLEMA: Calcula score inline SEM usar ContactBehaviorAnalysis
export function calcularScoreContato(contato, analise = null) {
  // Se tem análise, usa
  if (analise?.ai_insights) { ... }
  
  // ❌ FALLBACK: Cálculo manual duplicado (não usa entidade)
  let score = 0;
  const tipo = TIPOS_CONTATO.find(...);
  score += tipo.prioridade * 8;
  ...
}
```
**Impacto:** Score visual diferente do score da análise real

### **P2: Duas entidades fazem a mesma coisa**
- `ContactBehaviorAnalysis` (novo, V3, completo)
- `ClienteScore` (legado, MotorInteligenciaV3)

**Impacto:** Dados duplicados, inconsistências

### **P3: `MotorInteligenciaV3` desatualizado**
- Criado para sistema de **Clientes/Vendas/Orçamentos**
- Não integra com sistema de **Contacts/MessageThreads**
- Entidades diferentes: `Cliente` vs `Contact`

---

## 🎯 ARQUITETURA PROPOSTA - SEPARAÇÃO CLARA

### **CAMADA 1: ANÁLISE DE ASSUNTOS (Conversacional)**

```
┌─────────────────────────────────────────┐
│   FRONTEND: SugestorRespostasRapidas    │
│   Botão: 🧠 (no MessageInput)           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  BACKEND: gerarSugestoesRespostaContato │
│  - Busca últimas 50 msgs                │
│  - Detecta intenção + urgência          │
│  - Gera 3 sugestões (tom formal/amigável)│
│  - Detecta open loops (promessas)       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  CACHE: ContactBehaviorAnalysis         │
│  Campo: ai_insights.suggestions_cached  │
│  TTL: 15 minutos                        │
│  Invalidação: nova mensagem             │
└─────────────────────────────────────────┘
```

**Responsabilidades:**
- ✅ Análise da **conversa atual** (contexto imediato)
- ✅ Sugestões de **resposta específica** (tom adequado)
- ✅ Detecção de **pendências** (cliente aguardando)
- ✅ Classificação de **intenção** (orçamento/dúvida/reclamação)

**NÃO deve:**
- ❌ Calcular perfil do contato
- ❌ Analisar relacionamento ao longo do tempo
- ❌ Prever churn ou risco de negócio
- ❌ Gerar scores de priorização

---

### **CAMADA 2: ANÁLISE DE PERFIL/COMPORTAMENTO (Relacional)**

```
┌─────────────────────────────────────────┐
│   FRONTEND: PainelAnaliseContatoIA      │
│   Localização: ContactInfoPanel > Aba IA│
│   Botão: 🔄 Reanalisar (50 msgs)        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  BACKEND: analisarComportamentoContato  │
│  - Busca 50-200 msgs (histórico)        │
│  - Calcula métricas hard (ratios, gaps) │
│  - IA: Relationship profile, scores     │
│  - Gera prontuário (7 seções)           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  ENTIDADE: ContactBehaviorAnalysis      │
│  Campos principais:                     │
│  - relationship_profile (tipo, flags)   │
│  - scores (health, deal_risk, buy_intent)│
│  - prontuario_ptbr (7 seções)           │
│  - priority_score + priority_label      │
│  - metricas_relacionamento (hard stats) │
│  TTL: 24 horas                          │
└─────────────────────────────────────────┘
```

**Responsabilidades:**
- ✅ **Perfil de relacionamento** (comprador corporativo, lead quente, etc)
- ✅ **Scores estratégicos** (health, deal_risk, buy_intent, engagement)
- ✅ **Detecção de padrões** (price_sensitive, deadline_sensitive)
- ✅ **Playbook estratégico** (quando competir, quando recusar)
- ✅ **Prontuário completo** (7 seções estruturadas)
- ✅ **Priorização** (priority_score, bucket_inactive)

**NÃO deve:**
- ❌ Gerar sugestões de resposta imediata
- ❌ Analisar tom da conversa atual
- ❌ Detectar pendências de curto prazo

---

## 🔧 COMPONENTES QUE PRECISAM REFATORAÇÃO

### **1. `CentralInteligenciaContato.jsx`** ⚠️ CRÍTICO
**Problema:** Calcula score inline + mistura UI com lógica de análise

**PROPOSTA DE FIX:**
```javascript
// ❌ ANTES (cálculo inline)
export function calcularScoreContato(contato, analise = null) {
  if (analise?.ai_insights) {
    return (health * 0.4) + (engagement * 0.3) + ...;
  }
  // Fallback manual (duplicado)
  let score = 0;
  score += tipo.prioridade * 8;
  ...
}

// ✅ DEPOIS (usa entidade como fonte da verdade)
export function calcularScoreContato(contato, analise = null) {
  // PRIORIDADE 1: Usar análise completa (ContactBehaviorAnalysis)
  if (analise?.priority_score !== undefined) {
    return analise.priority_score; // 0-100 já calculado
  }
  
  // PRIORIDADE 2: Usar cache no Contact
  if (contato?.cliente_score !== undefined && contato.cliente_score > 0) {
    return contato.cliente_score;
  }
  
  // PRIORIDADE 3: Score básico UI (apenas visual)
  return calcularScoreVisualBasico(contato);
}

// Nova função separada (apenas UI)
function calcularScoreVisualBasico(contato) {
  let score = 0;
  const tags = contato.tags || [];
  if (tags.includes('vip')) score += 30;
  if (tags.includes('prioridade')) score += 20;
  if (contato.tipo_contato === 'cliente') score += 20;
  return Math.min(100, score);
}
```

**Ação:**
- ✅ Separar `calcularScoreContato` (usa análise) de `calcularScoreVisualBasico` (UI pura)
- ✅ Garantir que **SEMPRE busca ContactBehaviorAnalysis** antes de calcular
- ✅ Usar `priority_score` da entidade como fonte da verdade

---

### **2. `MotorInteligenciaV3.jsx`** ⚠️ DEPRECAR
**Problema:** Sistema legado para `Cliente` (não `Contact`)

**PROPOSTA:**
- ❌ **DEPRECAR** classe completa (ou migrar 100% para ContactBehaviorAnalysis)
- ✅ Consolidar tudo em `analisarComportamentoContato` + `ContactBehaviorAnalysis`
- ✅ Remover entidades duplicadas: `ClienteScore`, `AprendizadoIA`, `TarefaInteligente`

**OU (alternativa):**
- ✅ Renomear para `MotorClientesVendas` (específico para pipeline Clientes/Vendas)
- ✅ Manter `Contact` separado (WhatsApp/Comunicação)
- ✅ **NÃO misturar** as duas arquiteturas

---

### **3. `ContactInfoPanel.jsx` - Aba IA** ✅ JÁ CORRETO
**Status:** Bem estruturado

```javascript
<TabsContent value="ia" className="flex-1 overflow-y-auto p-4 m-0">
  <SegmentacaoInteligente 
    contactId={contact.id}
    mode="bubble"
  />
</TabsContent>
```

**Ação:** NENHUMA (já está correto)

---

## 📐 PLANO DE IMPLEMENTAÇÃO - FASES

### **FASE 1: LIMPEZA E CONSOLIDAÇÃO** (Prioridade CRÍTICA)

#### **1.1 Refatorar `CentralInteligenciaContato`**
```javascript
// Arquivo: components/comunicacao/CentralInteligenciaContato.jsx

// ✅ MUDANÇA 1: Buscar análise comportamental SEMPRE
const { data: analise } = useQuery({
  queryKey: ['analise-contato', contato?.id],
  queryFn: async () => {
    if (!contato?.id) return null;
    const analises = await base44.entities.ContactBehaviorAnalysis.filter(
      { contact_id: contato.id },
      '-analyzed_at',
      1
    );
    return analises[0] || null;
  },
  enabled: !!contato?.id,
  staleTime: 5 * 60 * 1000 // 5min
});

// ✅ MUDANÇA 2: Usar priority_score como fonte da verdade
const score = analise?.priority_score ?? calcularScoreVisualBasico(contato);

// ✅ MUDANÇA 3: Função separada (visual puro)
function calcularScoreVisualBasico(contato) {
  let score = 0;
  const tags = contato.tags || [];
  if (tags.includes('vip')) score += 30;
  if (tags.includes('prioridade')) score += 20;
  if (contato.tipo_contato === 'cliente') score += 20;
  if (contato.tipo_contato === 'lead') score += 15;
  return Math.min(100, score);
}
```

**Impacto:**
- ✅ Score sempre consistente com análise real
- ✅ Não duplica lógica de cálculo
- ✅ Fallback visual quando sem análise (novo contato)

---

#### **1.2 Adicionar Botão de Análise no Header**
```javascript
// Arquivo: components/comunicacao/ChatWindow.jsx
// Localização: Header (ao lado de "Transferir", "Compartilhar")

{contatoCompleto && (
  <button
    onClick={handleAbrirAnalise}
    className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg px-2 py-1.5 shadow-md flex items-center gap-1.5"
    title="Ver análise completa (50 msgs)"
  >
    <Brain className="w-3.5 h-3.5" />
    <span className="text-xs font-medium hidden sm:inline">Análise</span>
  </button>
)}
```

**Comportamento:**
- ✅ Abre `PainelAnaliseContatoIA` (já existe)
- ✅ Mostra prontuário completo (7 seções)
- ✅ Botão reanalisar (força nova análise)

---

#### **1.3 Remover Duplicação no `gerarSugestoesRespostaContato`**
**Problema:** Função atual faz **DUAS análises**:
1. Análise completa (relationship_profile, scores, prontuário) ← **NÃO DEVIA**
2. Sugestões de resposta ← **CORRETO**

**FIX:**
```javascript
// functions/gerarSugestoesRespostaContato.js

// ❌ REMOVER: Análise completa V2 (linhas 242-473)
// Isso é responsabilidade de analisarComportamentoContato

// ✅ MANTER: Apenas análise conversacional
const promptSimplificado = `
Analise a última mensagem do cliente e gere 3 sugestões de resposta.

ÚLTIMA MENSAGEM:
${lastInbound?.text}

${analise ? `
CONTEXTO DO CONTATO (já analisado):
- Relationship Type: ${analise.relationship_profile?.type}
- Deal Risk: ${analise.scores?.deal_risk}%
- Engagement: ${analise.scores?.engagement}%
` : ''}

Retorne JSON com:
{
  "customer_intent": "orcamento|duvida|reclamacao|followup|outro",
  "urgency": "baixa|media|alta",
  "next_best_action": { "action": "...", "ask": "..." },
  "suggestions": [
    { "tone": "formal", "title": "...", "message": "..." },
    ...
  ]
}
`;

// ✅ NÃO persiste análise completa (apenas cache de sugestões)
if (analise) {
  await base44.asServiceRole.entities.ContactBehaviorAnalysis.update(analise.id, {
    ai_insights: {
      ...analise.ai_insights,
      suggestions_cached: suggestions,
      suggestions_generated_at: new Date().toISOString(),
      suggestions_last_message_id: latestInbound?.id
    }
  });
}
```

**Benefícios:**
- ✅ Reduz 50% do custo de LLM (1 análise vs 2)
- ✅ Evita sobrescrever prontuário com dados parciais
- ✅ Foco único: **sugestões de resposta**

---

### **FASE 2: ORGANIZAÇÃO DE UI** (Prioridade ALTA)

#### **2.1 Estrutura de Botões no ChatWindow**

**ESTADO ATUAL:**
```
Header:
  [Avatar] [Nome] [CentralInteligencia] [Categorizar] [Transferir] [Compartilhar] [Lida] [Detalhes]
  
Rodapé (sugestões):
  - NÍVEL 0: SugestorRespostaBroadcast (se broadcast recente)
  - NÍVEL 1: MensagemReativacaoRapida (se inativo 30d+)
  - NÍVEL 2: SugestorRespostasRapidas (se cliente respondeu)
```

**PROPOSTA DE REORGANIZAÇÃO:**

```
Header:
  [Avatar] [Nome] [Score Badge] [🔖 Etiquetar] [🧠 Análise] [Transferir] [Compartilhar] [Lida] [Detalhes]
  
Rodapé (sugestões - MANTÉM):
  - NÍVEL 0: SugestorRespostaBroadcast
  - NÍVEL 1: MensagemReativacaoRapida
  - NÍVEL 2: SugestorRespostasRapidas
```

**Mudanças:**
1. ✅ `CentralInteligenciaContato` vira **badge simples** (score + dropdown etiquetas)
2. ✅ Novo botão **🧠 Análise** → Abre `PainelAnaliseContatoIA`
3. ✅ Sugestões de resposta permanecem **no rodapé** (contexto da conversa)

---

#### **2.2 Novo Componente: `BadgeScoreContato`**
```javascript
// components/comunicacao/BadgeScoreContato.jsx

export default function BadgeScoreContato({ contato, onClick }) {
  const { data: analise } = useQuery({
    queryKey: ['analise-contato', contato?.id],
    queryFn: async () => {
      const res = await base44.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contato.id },
        '-analyzed_at',
        1
      );
      return res[0] || null;
    },
    enabled: !!contato?.id,
    staleTime: 5 * 60 * 1000
  });

  const score = analise?.priority_score ?? 0;
  const label = analise?.priority_label ?? 'BAIXO';
  
  const cor = 
    label === 'CRITICO' ? 'from-red-500 to-red-700' :
    label === 'ALTO' ? 'from-orange-500 to-orange-700' :
    label === 'MEDIO' ? 'from-yellow-500 to-yellow-700' :
    'from-blue-500 to-blue-700';

  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full bg-gradient-to-r ${cor} text-white shadow-md flex items-center gap-1 hover:scale-105 transition-transform`}
      title={`Priority: ${label} (${score}/100) - Clique para detalhes`}
    >
      <span className="text-xs font-bold">{score}%</span>
      {analise && <Brain className="w-3 h-3" />}
    </button>
  );
}
```

**Uso no ChatWindow:**
```javascript
<BadgeScoreContato 
  contato={contatoCompleto} 
  onClick={() => setMostrarPainelAnalise(true)} 
/>
```

---

### **FASE 3: CONSOLIDAÇÃO DE BACKEND** (Prioridade MÉDIA)

#### **3.1 Deprecar `MotorInteligenciaV3`**

**Opção A: REMOVER COMPLETAMENTE**
- ❌ Deletar arquivo `components/inteligencia/MotorInteligenciaV3.jsx`
- ❌ Deletar entidades: `ClienteScore`, `AprendizadoIA`, `TarefaInteligente`
- ✅ Migrar 100% para `ContactBehaviorAnalysis`

**Opção B: RENOMEAR E ESPECIALIZAR**
- ✅ Renomear: `MotorInteligenciaV3` → `MotorClientesVendas`
- ✅ Manter para pipeline de **Clientes** (entidade Cliente)
- ✅ **NÃO usar** para **Contacts** (WhatsApp)
- ✅ Duas arquiteturas paralelas (sem sobreposição)

**DECISÃO RECOMENDADA:** **Opção A** (remover duplicação)

---

#### **3.2 Consolidar Análise em Uma Função**

**FONTE DA VERDADE ÚNICA:**
```
analisarComportamentoContato (50-200 msgs)
  ↓
ContactBehaviorAnalysis (entidade)
  ↓
Todos os componentes UI leem desta entidade
```

**Gatilhos de Análise:**
1. ✅ Manual: Botão "🔄 Reanalisar" no `PainelAnaliseContatoIA`
2. ✅ Automação diária: `executarAnaliseDiariaContatos` (já existe)
3. ✅ Sob demanda: `ContatosRequerendoAtencao` (carrega análises em lote)
4. ❌ **NÃO** em cada visualização de contato (caro demais)

---

### **FASE 4: DOCUMENTAÇÃO E TESTES** (Prioridade BAIXA)

#### **4.1 Criar Matriz de Responsabilidades**

| Pergunta | Análise Responsável | Função | TTL |
|----------|---------------------|--------|-----|
| "O que responder agora?" | **Assuntos** | `gerarSugestoesRespostaContato` | 15min |
| "Qual a intenção do cliente?" | **Assuntos** | `gerarSugestoesRespostaContato` | 15min |
| "Há pendências em aberto?" | **Assuntos** | `gerarSugestoesRespostaContato` | 15min |
| "Quem é este contato?" | **Perfil/Comportamento** | `analisarComportamentoContato` | 24h |
| "Qual o risco de perder o negócio?" | **Perfil/Comportamento** | `analisarComportamentoContato` | 24h |
| "Como ele se comporta?" | **Perfil/Comportamento** | `analisarComportamentoContato` | 24h |
| "Qual a estratégia ideal?" | **Perfil/Comportamento** | `analisarComportamentoContato` | 24h |
| "Ele é sensível a preço?" | **Perfil/Comportamento** | `analisarComportamentoContato` | 24h |

---

#### **4.2 Criar Testes Automáticos**

```javascript
// components/tests/TesteSeparacaoAnalises.jsx

test('Análise de Assuntos não calcula scores de relacionamento', async () => {
  const resultado = await base44.functions.invoke('gerarSugestoesRespostaContato', {
    thread_id: 'test-thread',
    limit: 50
  });
  
  // ✅ Deve retornar sugestões
  expect(resultado.data.suggestions).toHaveLength(3);
  
  // ❌ NÃO deve calcular relationship_profile
  expect(resultado.data.analysis.relationship_profile).toBeUndefined();
  
  // ❌ NÃO deve calcular prontuário
  expect(resultado.data.analysis.prontuario_ptbr).toBeUndefined();
});

test('Análise de Comportamento não gera sugestões de resposta', async () => {
  const resultado = await base44.functions.invoke('analisarComportamentoContato', {
    contact_id: 'test-contact',
    limit: 50
  });
  
  // ✅ Deve retornar scores e prontuário
  expect(resultado.data.resumo.priority_label).toBeDefined();
  
  // ❌ NÃO deve gerar sugestões de resposta imediata
  expect(resultado.data.suggestions).toBeUndefined();
});
```

---

## 🎨 WIREFRAMES - ANTES vs DEPOIS

### **ANTES (Confuso)**
```
┌─────────────────────────────────────────┐
│ [Avatar] [Nome] [CentralInteligencia]   │  ← Mistura score + etiquetas
│  └─ Dropdown: Tipo, Estágio, Etiquetas  │
│                                         │
│ [Mensagens...]                          │
│                                         │
│ Rodapé:                                 │
│  [SugestorRespostas] ← Análise de Assuntos│
└─────────────────────────────────────────┘

Detalhes (lateral):
  Aba "IA": SegmentacaoInteligente
    └─ Análise de Perfil (prontuário)
```

### **DEPOIS (Claro)**
```
┌─────────────────────────────────────────┐
│ [Avatar] [Nome] [75% 🔥] [🔖] [🧠]     │  ← Separação clara
│           ↑           ↑    ↑            │
│      Score Badge  Etiquetar Análise     │
│                                         │
│ [Mensagens...]                          │
│                                         │
│ Rodapé:                                 │
│  [SugestorRespostas] ← Assuntos (curto prazo)│
└─────────────────────────────────────────┘

🧠 Análise (modal flutuante):
  ├─ 📊 Prontuário (7 seções)
  ├─ 🎯 Scores (health, risk, intent)
  ├─ 📋 Playbook estratégico
  └─ 🔄 Botão Reanalisar
```

---

## 📦 ESTRUTURA DE ARQUIVOS FINAL

```
components/comunicacao/
├── analise-assuntos/
│   ├── SugestorRespostasRapidas.jsx     ← Análise conversacional
│   ├── SugestorRespostaBroadcast.jsx    ← Resposta a broadcast
│   └── MensagemReativacaoRapida.jsx     ← Templates reativação
│
├── analise-perfil/
│   ├── PainelAnaliseContatoIA.jsx       ← Prontuário completo (modal)
│   ├── BadgeScoreContato.jsx            ← Score visual (header)
│   └── SegmentacaoInteligente.jsx       ← IA completa (aba lateral)
│
├── ChatWindow.jsx                        ← Orquestra tudo
└── CentralInteligenciaContato.jsx        ← REFATORADO (só etiquetas)

functions/
├── analise-assuntos/
│   └── gerarSugestoesRespostaContato.js  ← SIMPLIFICADO (só sugestões)
│
└── analise-perfil/
    ├── analisarComportamentoContato.js   ← FONTE DA VERDADE
    ├── analisarClientesEmLote.js         ← Processamento em lote
    └── executarAnaliseDiariaContatos.js  ← Automação diária
```

---

## 🚀 CRONOGRAMA DE IMPLEMENTAÇÃO

### **Sprint 1: Refatoração Crítica** (1-2 dias)
- [ ] 1.1 Refatorar `calcularScoreContato` (usar análise como fonte)
- [ ] 1.2 Adicionar botão "🧠 Análise" no header do ChatWindow
- [ ] 1.3 Simplificar `gerarSugestoesRespostaContato` (remover análise completa)
- [ ] 1.4 Criar `BadgeScoreContato` (componente separado)

### **Sprint 2: Consolidação** (1 dia)
- [ ] 2.1 Deprecar `MotorInteligenciaV3` (ou renomear para ClientesVendas)
- [ ] 2.2 Remover entidades duplicadas: `ClienteScore`, `AprendizadoIA`
- [ ] 2.3 Migrar todas as referências para `ContactBehaviorAnalysis`

### **Sprint 3: Testes e Validação** (1 dia)
- [ ] 3.1 Testar análise de assuntos (sugestões)
- [ ] 3.2 Testar análise de perfil (prontuário)
- [ ] 3.3 Validar consistência de scores
- [ ] 3.4 Performance: cache hit rate

---

## 🔍 CHECKLIST DE VALIDAÇÃO

### **Análise de Assuntos**
- [ ] Gera 3 sugestões em 3 tons diferentes
- [ ] Detecta intenção (orçamento/dúvida/reclamação)
- [ ] Identifica urgência (baixa/média/alta)
- [ ] Detecta open loops (promessas não cumpridas)
- [ ] Cache válido por 15min (invalida em nova msg)
- [ ] **NÃO** calcula relationship_profile
- [ ] **NÃO** calcula prontuário
- [ ] **NÃO** calcula scores de risco

### **Análise de Perfil/Comportamento**
- [ ] Gera prontuário completo (7 seções)
- [ ] Calcula 4 scores (health, risk, intent, engagement)
- [ ] Classifica relationship_profile (tipo + flags)
- [ ] Detecta padrões (price_sensitive, deadline_sensitive)
- [ ] Gera playbook estratégico
- [ ] Persiste em `ContactBehaviorAnalysis`
- [ ] Cache válido por 24h
- [ ] **NÃO** gera sugestões de resposta imediata

### **UI/UX**
- [ ] Botão "🧠 Análise" visível no header
- [ ] Painel abre com prontuário completo
- [ ] Score no header **igual** ao score da análise
- [ ] Reanalisar funciona (força nova análise)
- [ ] Sugestões de resposta aparecem no rodapé (contexto)
- [ ] Sem duplicação visual (score consistente)

---

## 💡 OBSERVAÇÕES FINAIS

### **Princípio de Design:**
> "Análise de **ASSUNTOS** responde: **'O que dizer AGORA?'**  
> Análise de **PERFIL** responde: **'Quem é este contato?'**"

### **Fontes da Verdade:**
1. **Sugestões de Resposta:** `gerarSugestoesRespostaContato` (cache 15min)
2. **Perfil/Comportamento:** `analisarComportamentoContato` → `ContactBehaviorAnalysis` (cache 24h)
3. **Score Visual:** SEMPRE usa `ContactBehaviorAnalysis.priority_score`

### **Evitar:**
- ❌ Cálculos inline de score (usar entidade)
- ❌ Análise dupla (assuntos + perfil na mesma chamada)
- ❌ Entidades duplicadas (ClienteScore vs ContactBehaviorAnalysis)
- ❌ Cache inconsistente (15min vs 24h na mesma função)

---

## 📞 PRÓXIMOS PASSOS

**AGUARDANDO APROVAÇÃO DO USUÁRIO:**

1. ✅ Implementar **Sprint 1** (refatoração crítica)?
2. ✅ Deprecar `MotorInteligenciaV3` ou renomear?
3. ✅ Criar novos componentes (`BadgeScoreContato`)?

**Após aprovação, começar por:**
- 🔥 P1: Refatorar `CentralInteligenciaContato.calcularScoreContato`
- 🔥 P2: Adicionar botão "🧠 Análise" no ChatWindow
- 🔥 P3: Simplificar `gerarSugestoesRespostaContato`

---

## 📊 MÉTRICAS DE SUCESSO

**ANTES:**
- ❌ 2 análises LLM por visualização (sugestões + perfil)
- ❌ Score inconsistente (UI ≠ Análise)
- ❌ Entidades duplicadas (ClienteScore + ContactBehaviorAnalysis)

**DEPOIS:**
- ✅ 1 análise LLM por tipo (separadas)
- ✅ Score único (ContactBehaviorAnalysis.priority_score)
- ✅ Entidade única (ContactBehaviorAnalysis)
- ✅ Cache hit rate: 70%+ (sugestões), 90%+ (perfil)
- ✅ Redução de 40% nos custos de LLM

---

**FIM DO DOCUMENTO**