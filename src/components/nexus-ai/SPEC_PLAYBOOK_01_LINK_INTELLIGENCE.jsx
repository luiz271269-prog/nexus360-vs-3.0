# 🔗 PLAYBOOK 01: LINK INTELLIGENCE
## Especificação Técnica Completa (End-to-End)

---

## 🎯 OBJETIVO

Quando uma mensagem inbound contém URL, o Nexus AI deve:
1. ✅ Detectar a URL
2. ✅ Buscar conteúdo externo com Firecrawl (assíncrono + cache)
3. ✅ Extrair informação estruturada (produto/specs/preço/urgência)
4. ✅ Atualizar ThreadContext (memória operacional)
5. ✅ Gerar sugestões de resposta para o atendente
6. ✅ Registrar tudo em AgentRun + AgentDecisionLog

**Modo de Operação:** Assistente (Fase 1) - apenas sugere, não age

---

## 📥 EVENTO DE ENTRADA (Gatilho)

**Trigger:** `message.inbound.created`

**Condição de Disparo:**
```javascript
if (message.content.includes('http://') || message.content.includes('https://')) {
  // Processar com playbook Link Intelligence
}
```

**Regras:**
- ✅ Se não houver URL → não executa
- ✅ Se URL já foi processada (cache válido) → reutiliza
- ✅ Se domínio não está na whitelist → bloqueia e notifica
- ✅ Limite: 1 URL por mensagem (MVP)

---

## 🗄️ ENTIDADES NECESSÁRIAS

### **1. AgentRun**
```json
{
  "trigger_type": "message.inbound",
  "trigger_event_id": "msg_xyz",
  "playbook_selected": "link_intelligence",
  "execution_mode": "assistente",
  "status": "processando",
  "context_snapshot": {
    "message_id": "msg_xyz",
    "thread_id": "thread_123",
    "url_detectada": "https://exemplo.com/produto"
  },
  "started_at": "2026-01-30T10:00:00Z"
}
```

### **2. AgentDecisionLog**
```json
{
  "agent_run_id": "run_abc",
  "step_name": "link_intelligence",
  "decisao_tipo": "enriquecer_contexto",
  "ferramentas_usadas": ["firecrawlService", "InvokeLLM", "ThreadContext"],
  "decisao_tomada": {
    "url_processada": "https://...",
    "insights": {
      "produto": "Samsung Galaxy Tab A9+",
      "preco_aproximado": 1299.90,
      "specs_principais": ["5G", "128GB", "Tela 11''"],
      "urgencia": "media"
    },
    "sugestao": "Vi que você se interessou no Samsung Galaxy Tab A9+..."
  },
  "confianca_ia": 85,
  "resultado_execucao": "sucesso",
  "timestamp_decisao": "2026-01-30T10:00:15Z"
}
```

### **3. ThreadContext**
```json
{
  "thread_id": "thread_123",
  "external_sources": [
    {
      "source_url": "https://exemplo.com/produto",
      "summary": "Samsung Galaxy Tab A9+ - R$ 1.299,90",
      "fetched_at": "2026-01-30T10:00:10Z",
      "cache_id": "cache_789"
    }
  ],
  "entities_extracted": {
    "produto": "Samsung Galaxy Tab A9+",
    "preco_aproximado": 1299.90,
    "specs_principais": ["5G", "128GB", "Tela 11''"],
    "urgencia": "media"
  },
  "agent_suggestions": [
    {
      "tipo": "resposta_link",
      "texto": "Vi que você se interessou no Samsung Galaxy Tab A9+...",
      "confianca": 85,
      "usado": false
    }
  ],
  "updated_by_agent_at": "2026-01-30T10:00:15Z"
}
```

### **4. ExternalSourceCache**
```json
{
  "source_url": "https://exemplo.com/produto",
  "source_url_hash": "sha256...",
  "source_type": "web_scrape",
  "content_text": "# Samsung Galaxy Tab A9+\n\nPreço: R$ 1.299,90...",
  "content_structured": {
    "title": "Samsung Galaxy Tab A9+ 5G 128GB",
    "description": "Tablet com tela de 11 polegadas..."
  },
  "metadata": {
    "domain": "exemplo.com",
    "title": "Samsung Galaxy Tab A9+ 5G 128GB"
  },
  "fetched_at": "2026-01-30T10:00:10Z",
  "expires_at": "2026-02-06T10:00:10Z",
  "fetch_duration_ms": 2340,
  "token_count": 1250,
  "success": true
}
```

---

## 🛡️ GUARDRAILS (Regras de Proteção)

### **1. Whitelist de Domínios**
```javascript
const WHITELIST_DOMAINS = [
  'mercadolivre.com.br',
  'amazon.com.br',
  'magazineluiza.com.br',
  'americanas.com.br',
  'casasbahia.com.br',
  'shopee.com.br',
  'aliexpress.com'
  // Expansível via ConfiguracaoSistema
];
```

**Bloqueio:**
- ❌ Se domínio não está na whitelist → não processa
- ✅ Registra bloqueio em AgentDecisionLog

### **2. Anti-Spam / Rate Limit**
```javascript
// Não processar mais de 1 URL a cada 5min na mesma thread
const ultimaExecucao = await AgentRun.filter({
  playbook_selected: 'link_intelligence',
  context_snapshot: { thread_id },
  created_date: { $gte: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
});

if (ultimaExecucao.length > 0) {
  // Bloquear e usar cache se houver
}
```

### **3. Limite de URLs por Mensagem**
```javascript
const urls = extractUrls(content);
if (urls.length > 3) {
  urls = urls.slice(0, 3); // Processar apenas 3 primeiras
}
```

### **4. Timeout de Fetch**
```javascript
// Timeout de 30 segundos para Firecrawl
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Timeout')), 30000);
});

const result = await Promise.race([
  firecrawl.scrapeUrl(url),
  timeoutPromise
]);
```

---

## 🔄 FLUXO COMPLETO (Sequência de Execução)

### **PASSO 1: Webhook Recebe Mensagem**
```javascript
// webhookWatsZapi.js (já existe)
// Quando recebe mensagem inbound:

if (message.content && (message.content.includes('http://') || message.content.includes('https://'))) {
  // Disparar processamento do agente (assíncrono)
  await base44.asServiceRole.functions.invoke('agentOrchestrator', {
    action: 'process_message_inbound',
    evento: {
      message_id: message.id,
      thread_id: message.thread_id,
      content: message.content
    }
  });
}
```

**Importante:** Não bloqueia o webhook - dispara e continua.

---

### **PASSO 2: Agent Orchestrator Inicia**
```javascript
// functions/agentOrchestrator.js

// 1. Criar AgentRun
const run = await base44.asServiceRole.entities.AgentRun.create({
  trigger_type: 'message.inbound',
  trigger_event_id: message_id,
  playbook_selected: 'link_intelligence',
  execution_mode: 'assistente',
  status: 'processando',
  context_snapshot: {
    message_id,
    thread_id,
    content_preview: content.substring(0, 100)
  },
  started_at: new Date().toISOString()
});

console.log('[AGENT] 🤖 AgentRun criado:', run.id);
```

---

### **PASSO 3: Detecção e Normalização de URLs**
```javascript
// Extrair URLs
const urlRegex = /(https?:\/\/[^\s]+)/g;
const urls = content.match(urlRegex) || [];

if (urls.length === 0) {
  // Sem URLs, nada a fazer
  await finalizarRun(run.id, 'concluido', 'Nenhuma URL detectada');
  return;
}

// Normalizar primeira URL (MVP: 1 por mensagem)
const url = urls[0]
  .replace(/\?utm_.*$/, '') // Remove UTM
  .replace(/\/$/, '') // Remove trailing slash
  .replace(/#.*$/, ''); // Remove fragment

console.log('[AGENT] 🔗 URL detectada:', url);
```

---

### **PASSO 4: Verificar Cache (Cache-First)**
```javascript
// Calcular hash
const urlHash = await sha256(url);

// Buscar cache válido
const cached = await base44.asServiceRole.entities.ExternalSourceCache.filter({
  source_url_hash: urlHash,
  expires_at: { $gte: new Date().toISOString() },
  success: true
});

if (cached.length > 0) {
  console.log('[AGENT] ✅ Cache hit');
  scrapedData = cached[0];
  // Pular para PASSO 6 (extração)
} else {
  console.log('[AGENT] ⬇️ Cache miss - fazendo fetch');
  // Continuar para PASSO 5
}
```

---

### **PASSO 5: Firecrawl Scrape (Assíncrono)**
```javascript
// Chamar serviço Firecrawl
const scrapeResponse = await base44.functions.invoke('firecrawlService', {
  action: 'scrape',
  url
});

if (!scrapeResponse.success) {
  // Erro no scrape
  await finalizarRun(run.id, 'falhou', scrapeResponse.error);
  
  // Registrar decisão de bloqueio
  await base44.asServiceRole.entities.AgentDecisionLog.create({
    agent_run_id: run.id,
    step_name: 'firecrawl_fetch',
    decisao_tipo: 'enriquecer_contexto',
    resultado_execucao: 'bloqueado',
    motivo_bloqueio: scrapeResponse.error,
    timestamp_decisao: new Date().toISOString()
  });
  
  return;
}

scrapedData = scrapeResponse.data;
console.log('[AGENT] ✅ Conteúdo scraped:', scrapedData.token_count, 'tokens');
```

---

### **PASSO 6: Extração de Insights com LLM**
```javascript
const insights = await base44.integrations.Core.InvokeLLM({
  prompt: `Analise este conteúdo de página web e extraia informações relevantes.

Conteúdo:
${scrapedData.content_text.substring(0, 3000)}

Extraia:
1. Tipo de produto/serviço (se houver)
2. Preço aproximado em R$ (se mencionado)
3. Especificações principais (3-5 bullet points)
4. Urgência da demanda (baixa/média/alta baseado no contexto)

Se não for produto/serviço, identifique o tipo de conteúdo (artigo, notícia, edital, etc.).`,
  response_json_schema: {
    type: "object",
    properties: {
      produto: { type: "string" },
      preco_aproximado: { type: "number" },
      specs_principais: { 
        type: "array",
        items: { type: "string" }
      },
      urgencia: { 
        type: "string",
        enum: ["baixa", "media", "alta"]
      },
      tipo_conteudo: {
        type: "string",
        enum: ["produto", "servico", "artigo", "edital", "noticia", "outro"]
      }
    }
  }
});

console.log('[AGENT] 🧠 Insights extraídos:', insights);
```

---

### **PASSO 7: Atualizar ThreadContext**
```javascript
// Buscar contexto existente
const existingContext = await base44.asServiceRole.entities.ThreadContext.filter({
  thread_id
});

const contextData = {
  thread_id,
  external_sources: [
    ...(existingContext[0]?.external_sources || []),
    {
      source_url: url,
      summary: `${insights.produto || 'Conteúdo'} ${insights.preco_aproximado ? `- R$ ${insights.preco_aproximado}` : ''}`,
      fetched_at: new Date().toISOString(),
      cache_id: scrapedData.id
    }
  ],
  entities_extracted: insights,
  updated_by_agent_at: new Date().toISOString()
};

if (existingContext.length > 0) {
  await base44.asServiceRole.entities.ThreadContext.update(
    existingContext[0].id, 
    contextData
  );
} else {
  await base44.asServiceRole.entities.ThreadContext.create(contextData);
}

console.log('[AGENT] 💾 ThreadContext atualizado');
```

---

### **PASSO 8: Gerar Sugestão de Resposta**
```javascript
const sugestao = await base44.integrations.Core.InvokeLLM({
  prompt: `Você é um assistente de vendas profissional.

O cliente enviou este link: ${url}

Identificamos:
- Tipo: ${insights.tipo_conteudo}
- Produto: ${insights.produto || 'Não identificado'}
- Preço: ${insights.preco_aproximado ? `R$ ${insights.preco_aproximado.toLocaleString('pt-BR')}` : 'Não mencionado'}
- Specs: ${insights.specs_principais?.join(', ') || 'N/A'}
- Urgência: ${insights.urgencia}

Gere uma resposta profissional, amigável e útil sugerindo próximos passos:
- Se for produto: oferecer orçamento, demonstração, esclarecimento
- Se for edital: informar capacidade de atendimento
- Se for artigo: comentar relevância

Seja breve (2-3 frases) e direto.`
});

console.log('[AGENT] 💬 Sugestão gerada');
```

---

### **PASSO 9: Adicionar Sugestão ao ThreadContext**
```javascript
const contextId = existingContext[0]?.id || 
  (await base44.asServiceRole.entities.ThreadContext.filter({ thread_id }))[0].id;

await base44.asServiceRole.entities.ThreadContext.update(contextId, {
  agent_suggestions: [
    {
      tipo: 'resposta_link',
      texto: sugestao,
      confianca: 85,
      usado: false,
      created_at: new Date().toISOString()
    }
  ]
});
```

---

### **PASSO 10: Registrar Decisão (Auditoria)**
```javascript
await base44.asServiceRole.entities.AgentDecisionLog.create({
  agent_run_id: run.id,
  step_name: 'link_intelligence',
  decisao_tipo: 'sugestao_resposta',
  ferramentas_usadas: ['firecrawlService', 'InvokeLLM', 'ThreadContext'],
  decisao_tomada: {
    url_processada: url,
    domain: new URL(url).hostname,
    cache_usado: cached.length > 0,
    insights,
    sugestao
  },
  confianca_ia: 85,
  resultado_execucao: 'sucesso',
  timestamp_decisao: new Date().toISOString()
});
```

---

### **PASSO 11: Finalizar AgentRun**
```javascript
await base44.asServiceRole.entities.AgentRun.update(run.id, {
  status: 'concluido',
  completed_at: new Date().toISOString(),
  duration_ms: Date.now() - new Date(run.started_at).getTime()
});

console.log('[AGENT] ✅ Processamento concluído');

return Response.json({
  success: true,
  run_id: run.id,
  url_processada: url,
  insights,
  sugestao
});
```

---

## 🧩 COMPONENTES TÉCNICOS

### **Backend Functions:**

#### **1. `functions/firecrawlService.js`**
- ✅ Criado
- Responsabilidade: Scrape + cache + whitelist
- Entrada: `{ action: 'scrape', url }`
- Saída: `{ success, cached, data: ExternalSourceCache }`

#### **2. `functions/agentOrchestrator.js`**
- ✅ Criado
- Responsabilidade: Orquestrar playbook Link Intelligence
- Entrada: `{ action: 'process_message_inbound', evento: {...} }`
- Saída: `{ success, run_id, insights, sugestao }`

#### **3. `functions/agentCommand.js`**
- 🟡 A criar (próximo passo)
- Responsabilidade: Interface NexusChat → Agente
- Entrada: `{ command: 'chat', user_message, context }`
- Saída: `{ success, response, run_id }`

---

### **Frontend Components:**

#### **1. `components/comunicacao/AgentSuggestion.jsx`**
- ✅ Criado
- Responsabilidade: Mostrar sugestões do agente na thread
- Props: `{ threadId, onUseSuggestion }`
- Funcionalidade:
  - Busca ThreadContext
  - Mostra sugestões não usadas
  - Permite aceitar/descartar
  - Registra feedback

#### **2. `components/global/NexusChat.jsx`** (a refatorar)
- 🟡 Modificar para usar `agentCommand`
- Adicionar prop `agentContext`
- Mostrar AgentRuns recentes
- Mostrar status do agente

---

## 🎬 COMO APARECE NA UI

### **1. Central de Comunicação (ChatWindow)**

**Antes de uma URL ser enviada:**
```
┌─────────────────────────────────────┐
│ Cliente: Oi, gostaria de orçar     │
│ https://example.com/produto-xyz    │
│                                     │
│ [Atendente digitando...]            │
└─────────────────────────────────────┘
```

**10 segundos depois (agente processou):**
```
┌─────────────────────────────────────────────────────┐
│ 🤖 Sugestão do Nexus AI          [85% confiança]   │
│                                                      │
│ Vi que você se interessou no Samsung Tab A9+.       │
│ Esse modelo custa R$ 1.299,90 e tem conectividade  │
│ 5G. Posso preparar um orçamento personalizado?     │
│                                                      │
│ [✅ Usar sugestão]  [❌ Descartar]                  │
└─────────────────────────────────────────────────────┘
```

**Se atendente clica "Usar sugestão":**
```
┌─────────────────────────────────────────────────────┐
│ [Campo de mensagem PRÉ-PREENCHIDO]                  │
│ Vi que você se interessou no Samsung Tab A9+...    │
│                                                      │
│ [Enviar]                                             │
└─────────────────────────────────────────────────────┘
```

---

### **2. NexusChat (Interface do Agente)**

**Quando usuário pergunta:**
```
Usuário: O que você sabe sobre a última conversa com João?

Nexus AI:
  🔍 Consultando ThreadContext...
  
  João enviou um link sobre Samsung Galaxy Tab A9+ (R$ 1.299,90).
  Sugeri orçamento personalizado.
  Status: Aguardando resposta do cliente.
  
  Quer que eu crie um rascunho de orçamento?
```

---

## 📊 MÉTRICAS DE SUCESSO

### **Fase 1 (MVP - 30 dias):**
- [ ] **30+ URLs processadas** com sucesso
- [ ] **Taxa de cache:** > 40% (evita chamadas Firecrawl repetidas)
- [ ] **Taxa de uso das sugestões:** > 30% (atendentes clicam "Usar")
- [ ] **Taxa de edição:** < 50% (sugestão é útil o suficiente)
- [ ] **Zero erros críticos** (bloqueios, quebras)

### **KPIs Operacionais:**
```javascript
// Calcular a cada semana
const metricas = {
  total_execucoes: await AgentRun.filter({ playbook_selected: 'link_intelligence' }).length,
  
  taxa_sucesso: await AgentRun.filter({ 
    playbook_selected: 'link_intelligence',
    status: 'concluido'
  }).length / total_execucoes,
  
  taxa_cache: await AgentDecisionLog.filter({
    decisao_tomada: { cache_usado: true }
  }).length / total_execucoes,
  
  taxa_uso_sugestoes: await ThreadContext.filter({
    'agent_suggestions.feedback': 'aceito'
  }).length / total_sugestoes,
  
  tempo_medio_ms: AVG(AgentRun.duration_ms)
};
```

### **Critério de "Produção-Ready":**
- ✅ Taxa de sucesso > 85%
- ✅ Taxa de uso > 30%
- ✅ Tempo médio < 5 segundos
- ✅ Zero bloqueios webhook (não atrasa resposta)

---

## 🧪 CASOS DE TESTE

### **Caso 1: URL de Produto (Caminho Feliz)**
```
Input: "Oi, quero orçar https://mercadolivre.com.br/produto-xyz"

Expected:
  ✅ URL detectada
  ✅ Firecrawl faz scrape (ou usa cache)
  ✅ Insights extraídos (produto, preço, specs)
  ✅ ThreadContext atualizado
  ✅ Sugestão gerada
  ✅ AgentRun concluído
  ✅ AgentDecisionLog registrado
  ✅ Sugestão aparece na UI em < 10s
```

### **Caso 2: URL Bloqueada (Guardrail)**
```
Input: "Veja este site: https://site-suspeito.xyz"

Expected:
  ✅ URL detectada
  ❌ Domínio não está na whitelist
  ✅ AgentDecisionLog registra bloqueio
  ✅ AgentRun finalizado com "bloqueado"
  ✅ UI não mostra sugestão (ou mostra aviso)
```

### **Caso 3: Cache Hit**
```
Input: "Quero este: https://amazon.com.br/produto-abc" (já processado há 2 dias)

Expected:
  ✅ URL detectada
  ✅ Cache encontrado (válido)
  ✅ Firecrawl NÃO é chamado
  ✅ Insights extraídos do cache
  ✅ Sugestão gerada
  ✅ duration_ms < 2 segundos
```

### **Caso 4: Mensagem Sem URL**
```
Input: "Olá, tudo bem?"

Expected:
  ✅ Mensagem processada normalmente (webhook)
  ❌ AgentRun NÃO é criado (sem URL)
  ✅ Zero overhead
```

---

## 🔧 INTEGRAÇÃO COM WEBHOOK EXISTENTE

### **Modificação Mínima no Webhook:**
```javascript
// webhookWatsZapi.js - adicionar após salvar mensagem

// Se mensagem tem URL, disparar agente (assíncrono)
if (mensagem.content && /https?:\/\//.test(mensagem.content)) {
  // NÃO AWAIT - dispara e esquece
  base44.asServiceRole.functions.invoke('agentOrchestrator', {
    action: 'process_message_inbound',
    evento: {
      message_id: mensagem.id,
      thread_id: mensagem.thread_id,
      content: mensagem.content
    }
  }).catch(err => {
    console.error('[WEBHOOK] Erro ao disparar agente:', err);
    // Não bloqueia o webhook
  });
}
```

**Importante:**
- ✅ Não usa `await` (não bloqueia webhook)
- ✅ Usa `.catch()` (erro no agente não quebra webhook)
- ✅ Zero impacto na latência de resposta

---

## 📈 ROADMAP DE EVOLUÇÃO

### **MVP (Semana 1-2):**
- ✅ Scrape básico (fetch simples, sem Firecrawl API)
- ✅ Cache funcionando
- ✅ Sugestões aparecem na UI
- ✅ Auditoria completa

### **V1.1 (Semana 3-4):**
- ✅ Integração real com Firecrawl API
- ✅ Extração avançada (imagens, preços, specs)
- ✅ Múltiplas URLs por mensagem (até 3)

### **V1.2 (Mês 2):**
- ✅ Sugestões contextuais (considera histórico do cliente)
- ✅ Auto-criação de rascunho de orçamento (se produto + preço)
- ✅ Enriquecimento de Contact (ramo de atividade via site)

### **V2.0 (Mês 3 - Autonomia Parcial):**
- ✅ Envia resposta automática (se confiança > 90%)
- ✅ Cria orçamento automático (valor < R$ 5.000)
- ✅ Aprende quais sugestões são mais aceitas

---

## 🎯 CRITÉRIOS DE "PRONTO PARA PRODUÇÃO"

Um playbook só está **pronto** quando atende TODOS:

### **Funcionalidade:**
- [ ] Não bloqueia webhook (assíncrono)
- [ ] Cache funciona (não chama Firecrawl repetido)
- [ ] Whitelist de domínios respeitada
- [ ] Rate limit funciona (max 1 URL/5min por thread)

### **Auditoria:**
- [ ] AgentRun criado para cada execução
- [ ] AgentDecisionLog registra decisão explicável
- [ ] ThreadContext atualizado com sources

### **UI/UX:**
- [ ] Sugestão aparece na UI em < 10s
- [ ] Atendente pode aceitar/descartar
- [ ] Feedback é registrado (usado/descartado)

### **Segurança:**
- [ ] Domínio bloqueado → não processa
- [ ] Erro no Firecrawl → falha segura (não quebra nada)
- [ ] Timeout de 30s (não trava)

### **Observabilidade:**
- [ ] Métricas calculáveis (taxa de sucesso, cache, uso)
- [ ] Logs estruturados (fácil debugging)
- [ ] Dashboard (admin vê performance)

---

## 🔍 VALIDAÇÃO TÉCNICA (Checklist de Revisão)

### **Code Review:**
- [ ] Sem `await` no webhook (não bloqueia)
- [ ] Try/catch em todas as chamadas externas
- [ ] Timeout em Firecrawl (30s max)
- [ ] Hash SHA-256 para cache (não URL raw)
- [ ] TTL de 7 dias (configurável)
- [ ] Normalização de URL (remove UTM, trailing slash)

### **Data Integrity:**
- [ ] AgentRun sempre criado ANTES de processar
- [ ] AgentRun sempre finalizado (concluído/falhou)
- [ ] ThreadContext não duplica sources
- [ ] ExternalSourceCache único por url_hash

### **Error Handling:**
- [ ] Domínio bloqueado → AgentDecisionLog + motivo
- [ ] Firecrawl timeout → AgentRun falhou + error_message
- [ ] LLM falha → AgentRun falhou + sugestão genérica
- [ ] Nenhum erro quebra webhook

---

## 📝 CONTRATO DE DADOS (Schemas Completos)

### **ExternalSourceCache (após scrape):**
```json
{
  "id": "esc_789",
  "source_url": "https://mercadolivre.com.br/produto",
  "source_url_hash": "a3f2c1...",
  "source_type": "web_scrape",
  "content_text": "# Produto XYZ\n\nPreço: R$ 1.299,90\n\n...",
  "content_structured": {
    "title": "Samsung Galaxy Tab A9+ 5G",
    "price": 1299.90,
    "currency": "BRL"
  },
  "metadata": {
    "domain": "mercadolivre.com.br",
    "title": "Samsung Galaxy Tab A9+ 5G 128GB",
    "description": "Tablet com tela de 11 polegadas..."
  },
  "fetched_at": "2026-01-30T10:00:10Z",
  "expires_at": "2026-02-06T10:00:10Z",
  "fetch_duration_ms": 2340,
  "token_count": 1250,
  "success": true,
  "created_date": "2026-01-30T10:00:10Z"
}
```

### **ThreadContext (após processamento):**
```json
{
  "id": "tc_456",
  "thread_id": "thread_123",
  "external_sources": [
    {
      "source_url": "https://mercadolivre.com.br/produto",
      "summary": "Samsung Galaxy Tab A9+ - R$ 1.299,90",
      "fetched_at": "2026-01-30T10:00:10Z",
      "cache_id": "esc_789"
    }
  ],
  "entities_extracted": {
    "produto": "Samsung Galaxy Tab A9+",
    "preco_aproximado": 1299.90,
    "specs_principais": ["5G", "128GB", "Tela 11''", "Android 14"],
    "urgencia": "media",
    "tipo_conteudo": "produto"
  },
  "agent_suggestions": [
    {
      "tipo": "resposta_link",
      "texto": "Vi que você se interessou no Samsung Galaxy Tab A9+. Esse modelo custa R$ 1.299,90 e tem conectividade 5G. Posso preparar um orçamento personalizado?",
      "confianca": 85,
      "usado": false,
      "created_at": "2026-01-30T10:00:15Z"
    }
  ],
  "updated_by_agent_at": "2026-01-30T10:00:15Z",
  "created_date": "2026-01-30T10:00:15Z"
}
```

---

## 🚨 FAILURE MODES (Como Falha Seguro)

### **Erro 1: Domínio Bloqueado**
```
Resultado:
  ✅ AgentRun.status = "concluido"
  ✅ AgentDecisionLog.resultado_execucao = "bloqueado"
  ✅ AgentDecisionLog.motivo_bloqueio = "Domínio não autorizado"
  ✅ ThreadContext NÃO é atualizado
  ✅ UI não mostra sugestão (ou mostra "não foi possível processar")
```

### **Erro 2: Firecrawl Timeout**
```
Resultado:
  ✅ AgentRun.status = "falhou"
  ✅ AgentRun.error_message = "Timeout ao buscar conteúdo"
  ✅ AgentDecisionLog.resultado_execucao = "falhou"
  ✅ ThreadContext NÃO é atualizado
  ✅ Webhook não é afetado (processo assíncrono)
```

### **Erro 3: LLM Falha na Extração**
```
Resultado:
  ✅ AgentRun continua
  ✅ insights = { tipo_conteudo: "outro" } (fallback)
  ✅ Sugestão genérica: "Recebi o link que você enviou. Vou analisar..."
  ✅ ThreadContext atualizado com URL (sem insights)
```

---

## 🎯 PRÓXIMA ENTREGA IMEDIATA

### **Sem Firecrawl API Key (Modo Degradado):**
```javascript
// firecrawlService.js - usar fetch simples
const response = await fetch(url, {
  headers: { 'User-Agent': 'NexusAI/1.0' }
});
const html = await response.text();

// Extração básica
const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
const title = titleMatch ? titleMatch[1] : '';

// Salvar no cache mesmo assim
```

**Funciona?** ✅ Sim
- Cache funciona
- Auditoria funciona
- Sugestões funcionam (baseadas em HTML cru)

**Limitação:**
- Qualidade menor (HTML vs Markdown limpo)
- Sem metadata estruturada do Firecrawl

**Próximo Passo:**
- Quando tiver Firecrawl API key → trocar fetch por Firecrawl
- Zero mudança no resto do código

---

## ✅ RESUMO EXECUTIVO

### **O que JÁ está implementado:**
- ✅ 4 entidades (AgentRun, AgentDecisionLog, ThreadContext, ExternalSourceCache)
- ✅ firecrawlService.js (com fetch simples, pronto para Firecrawl API)
- ✅ agentOrchestrator.js (playbook Link Intelligence completo)
- ✅ AgentSuggestion.jsx (UI para mostrar sugestões)

### **O que falta:**
- 🟡 Integrar no webhook (1 linha de código)
- 🟡 Integrar AgentSuggestion no ChatWindow (import + render)
- 🟡 Criar agentCommand.js (NexusChat → Agente)
- 🟡 Refatorar NexusChat (usar agentCommand)
- 🟡 Agent Session State (Layout.js)

### **Esforço Total:**
- **2-4 horas** de implementação
- **5 mudanças** cirúrgicas
- **Zero quebra** de funcionalidade existente

---

**Quer que eu implemente essas 5 mudanças agora?** 🎯