# 🏗️ ARQUITETURA UNIFICADA - CENTRAL DE COMUNICAÇÃO E PROMOÇÕES

**Data:** 12/02/2026  
**Status:** App em produção - Consolidação de 2 debates  
**Objetivo:** Linha lógica única para UI, disparo, orquestração e execução

---

## 📊 VISÃO CONSOLIDADA - 4 CAMADAS

```
┌──────────────────────────────────────────────────────────────────────┐
│ CAMADA 1: INTERFACE DO USUÁRIO (Frontend)                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Layout.js (Global)                                                  │
│  ├─ useContatosInteligentes → totalUrgentes                         │
│  ├─ calcularLembretesGlobal → contadoresLembretes                   │
│  ├─ Badge pulsante (Contatos Inteligentes)                          │
│  └─ 🎯 RESPONSABILIDADE: Navegação + Contadores                     │
│                                                                        │
│  pages/ContatosInteligentes.js                                       │
│  ├─ useContatosInteligentes → clientes[] (lista completa)           │
│  ├─ Filtros/agrupamento (prioridade/bucket/atendente)               │
│  ├─ Seleção múltipla (checkboxes)                                   │
│  ├─ Botão "Auto (N)" → enviarPromocoesLote                          │
│  ├─ Botão "Massa (N)" → ModalEnvioMassa                             │
│  └─ 🎯 RESPONSABILIDADE: Listagem + Disparo                         │
│                                                                        │
│  components/comunicacao/ContatosRequerendoAtencao.jsx               │
│  ├─ Versão compacta (header/sidebar)                                │
│  ├─ Mesmo motor (useContatosInteligentes)                           │
│  ├─ Botões de disparo local                                         │
│  └─ 🎯 RESPONSABILIDADE: Preview + Quick Actions                    │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CAMADA 2: ORQUESTRADORES (Backend - Síncrono)                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  enviarMensagemMassa                                                 │
│  ├─ Input: contact_ids[] + mensagem                                 │
│  ├─ Validação: Nenhuma (broadcast puro)                             │
│  ├─ Personalização: Placeholders {{nome}}, {{empresa}}              │
│  ├─ Execução: Síncrona completa                                     │
│  ├─ Delay: 500ms entre envios                                       │
│  └─ Output: { enviados, erros, detalhes[] }                         │
│                                                                        │
│  enviarPromocoesLote                                                 │
│  ├─ Input: contact_ids[]                                            │
│  ├─ Validação: ⚠️ Falta bloqueios absolutos                        │
│  ├─ Etapa 1: Gera + envia saudação (LLM)                           │
│  ├─ Etapa 2: Agenda WorkQueueItem (5min)                           │
│  ├─ Motor: Usa promotionEngine (filtro + rotação)                  │
│  ├─ Delay: 800ms entre contatos                                     │
│  └─ Output: { enviados, erros, resultados[] }                       │
│                                                                        │
│  🎯 RESPONSABILIDADE: Validação inicial + Agendamento               │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CAMADA 3: FILA DE TRABALHO (Estado Persistente)                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  WorkQueueItem (Entidade)                                            │
│  ├─ tipo: 'enviar_promocao'                                         │
│  ├─ status: agendado → processando → processado/cancelado/erro     │
│  ├─ scheduled_for: timestamp                                        │
│  ├─ payload: { promotion_id, integration_id, trigger }              │
│  ├─ metadata: { saudacao_enviada_em, dias_inativo, snippet }       │
│  └─ 🎯 RASTREABILIDADE: Auditoria + Reprocessamento                │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CAMADA 4: PROCESSADORES (Backend - Assíncrono)                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  processarFilaPromocoes (Worker - a cada 5 min)                     │
│  ├─ Busca: WorkQueueItem agendados                                  │
│  ├─ Validação CRÍTICA:                                              │
│  │   ✅ Cliente respondeu? → Cancela                                │
│  │   ✅ Cooldown 12h universal                                      │
│  │   ✅ Bloqueios (fornecedor/tags/setor)                          │
│  │   ✅ Horário comercial (9-19h)                                   │
│  ├─ Envio: sendPromotion() do engine                                │
│  ├─ Registro:                                                        │
│  │   ✅ Message.create (auditoria)                                  │
│  │   ✅ Contact.update (last_promo_ids, last_any_promo_sent_at)   │
│  │   ✅ WorkQueueItem.update (status: processado)                  │
│  └─ 🎯 RESPONSABILIDADE: Regras finais + Execução                  │
│                                                                        │
│  promotionEngine.js (Core Logic)                                     │
│  ├─ isBlocked() - Bloqueios absolutos                               │
│  ├─ getActivePromotions() - Promoções válidas                       │
│  ├─ filterEligiblePromotions() - Filtros por contato                │
│  ├─ pickPromotion() - Rotação inteligente (últimas 3)              │
│  ├─ canSendUniversalPromo() - Cooldown 12h                          │
│  ├─ formatPromotionMessage() - Template                             │
│  └─ sendPromotion() - Envio + persistência                          │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CAMADA 5: ENVIO FÍSICO (Provider Abstraction)                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  enviarMensagemUnificada (Thread-based)                             │
│  ├─ Input: connectionId, threadId, contactId, content               │
│  ├─ Resolve: Tipo de canal + destinatário                           │
│  ├─ Cria: Message outbound (rastreabilidade)                        │
│  ├─ Delega: Envia para adaptador correto                            │
│  └─ Atualiza: Message status + Thread last_message                  │
│                                                                        │
│  enviarWhatsApp (Provider-level)                                    │
│  ├─ Input: integration_id, numero_destino, mensagem                 │
│  ├─ Suporta: Z-API, W-API, Evolution                                │
│  ├─ Mídia: image, video, document, audio                            │
│  └─ 🎯 RESPONSABILIDADE: Envio físico HTTP                         │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 GAPS IDENTIFICADOS (CRUZAMENTO DOS DEBATES)

### **Gap 1: Layout mostra contador mas não tem dados**
**Problema:**
```javascript
// Layout.js - linha ~70
const { totalUrgentes } = useContatosInteligentes(globalUsuario, {
  limit: 50  // ⚠️ Só pega 50 para contar
});

contadores['ContatosInteligentes'] = totalUrgentes || 0;
```

**Impacto:**
- Badge mostra "27 urgentes"
- Mas Layout não tem os 27 contact_ids
- Se clicar "disparar" do Layout → teria que refazer a query (duplicação)

**Solução:**
- ✅ Layout mantém só contador (navegação)
- ✅ Disparo fica na página ContatosInteligentes (tem lista completa)

---

### **Gap 2: Atualização do contador descompasso**
**Problema:**
```javascript
// useContatosInteligentes tem autoRefresh (5min)
// Mas Layout só copia para contadoresLembretes dentro de carregarDadosGlobais()
// que tem throttle de 2min
```

**Solução:**
```javascript
// Layout.js - adicionar sincronização direta
useEffect(() => {
  setContadoresLembretes(prev => ({
    ...prev,
    ContatosInteligentes: totalUrgentes || 0
  }));
}, [totalUrgentes]);
```

---

### **Gap 3: N+1 Queries em AMBOS os caminhos**
**PROMO-LOTE:**
```javascript
// ❌ Para cada contato
const thread = await MessageThread.filter({ contact_id });
const mensagens = await Message.filter({ thread_id });
```

**ContatosRequerendoAtencao:**
```javascript
// ❌ Para cada assignedId
const users = await User.filter({ id: { $in: assignedIds } });
```

**Solução unificada:**
```javascript
// ✅ 1 query para N contatos
const threadsMap = await MessageThread.filter({
  contact_id: { $in: contact_ids },
  is_canonical: true
});

// ✅ Reduzir busca de mensagens (usar thread.last_inbound_at)
// Só buscar mensagens se precisar contexto LLM
```

---

### **Gap 4: LLM síncrono no lote**
**Problema:**
```javascript
// enviarPromocoesLote - linha 125
for (const contato of contatos) {
  const saudacao = await InvokeLLM({ prompt });  // ❌ 1 LLM por contato
}
```

**Impacto:**
- 49 contatos = 49 chamadas LLM
- ~2-3s cada = 98-147s total
- Rate limit do OpenAI

**Soluções:**

**Opção A - Template Simples (RECOMENDADO P0):**
```javascript
const saudacao = `Olá ${contato.nome}! 👋

Percebi que faz ${diasInativo} dias que não conversamos.

${contato.empresa ? `Como vão as coisas na ${contato.empresa}?` : 'Como posso te ajudar hoje?'}

Estou à disposição! 😊`;
```

**Opção B - LLM Assíncrono (P1):**
```javascript
// Agendar WorkQueueItem SEM saudação
// Worker gera saudação + envia
```

**Opção C - Batch LLM (P2):**
```javascript
// 1 chamada LLM para N contatos (JSON array)
const saudacoes = await InvokeLLM({
  prompt: 'Gere saudações para estes 49 contatos...',
  response_json_schema: { type: 'object', properties: { saudacoes: {...} } }
});
```

---

## 🎯 LINHA LÓGICA UNIFICADA (DEFINITIVA)

### **Fluxo Completo: Do Click ao WhatsApp**

```
USUÁRIO CLICA "Auto (27)"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ PÁGINA: ContatosInteligentes                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ const { clientes } = useContatosInteligentes(usuario, {     │
│   tipo: ['lead', 'cliente'],                                │
│   diasSemMensagem: 2,                                       │
│   minDealRisk: 20,                                          │
│   limit: 100                                                │
│ });                                                          │
│                                                               │
│ // Usuário seleciona/filtra → contact_ids[]                │
│                                                               │
│ const handleEnviarAuto = async () => {                      │
│   const ids = contatosSelecionados.map(c => c.id);         │
│   await base44.functions.invoke('enviarPromocoesLote', {   │
│     contact_ids: ids                                        │
│   });                                                        │
│ };                                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ FUNÇÃO: enviarPromocoesLote                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Buscar contatos + integrações em LOTE                    │
│    ✅ Promise.all([Contact.filter(...), WhatsApp...])       │
│                                                               │
│ 2. Buscar threads CANÔNICAS em LOTE (FIX P1)                │
│    ❌ ATUAL: 1 query por contato                            │
│    ✅ NOVO: 1 query para todos                              │
│    const threadsMap = await MessageThread.filter({          │
│      contact_id: { $in: contact_ids },                      │
│      is_canonical: true                                     │
│    });                                                       │
│                                                               │
│ 3. VALIDAR BLOQUEIOS (FIX P0)                                │
│    const { blocked, reason } = isBlocked({                  │
│      contact, thread, integration                           │
│    });                                                       │
│    if (blocked) continue;                                   │
│                                                               │
│ 4. GERAR SAUDAÇÃO (FIX P0 - Template)                       │
│    ❌ ATUAL: LLM síncrono (lento)                           │
│    ✅ NOVO: Template com placeholders                       │
│                                                               │
│ 5. ENVIAR SAUDAÇÃO                                          │
│    ✅ CORRETO: enviarWhatsApp (direto)                      │
│                                                               │
│ 6. AGENDAR PROMOÇÃO                                         │
│    const eligible = filterEligiblePromotions(...);          │
│    const promo = pickPromotion(eligible, contato);          │
│                                                               │
│    await WorkQueueItem.create({                             │
│      tipo: 'enviar_promocao',                               │
│      scheduled_for: now + 5min,                             │
│      payload: { promotion_id, integration_id, trigger },   │
│      metadata: { saudacao_enviada_em: now }                │
│    });                                                       │
│                                                               │
│ 7. REGISTRAR HISTÓRICO (FIX P1)                             │
│    ❌ FALTA: Atualizar last_promo_ids aqui                 │
│    ✅ Deixar para o worker (melhor)                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ (5 minutos depois - automação)
┌─────────────────────────────────────────────────────────────┐
│ WORKER: processarFilaPromocoes                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Automação: A cada 5 minutos                                 │
│                                                               │
│ for (const item of itemsAgendados) {                        │
│                                                               │
│   // ✅ VALIDAÇÃO CRÍTICA 1: Cliente respondeu?             │
│   if (thread.last_inbound_at > metadata.saudacao_enviada_em) { │
│     await update(item.id, { status: 'cancelado' });        │
│     continue;                                                │
│   }                                                           │
│                                                               │
│   // ✅ VALIDAÇÃO CRÍTICA 2: Cooldown universal             │
│   const { ok } = canSendUniversalPromo({ contact, now });  │
│   if (!ok) {                                                │
│     await update(item.id, { status: 'cancelado' });        │
│     continue;                                                │
│   }                                                           │
│                                                               │
│   // ✅ VALIDAÇÃO CRÍTICA 3: Bloqueios dinâmicos            │
│   const { blocked } = isBlocked({ contact, thread, ... }); │
│   if (blocked) {                                            │
│     await update(item.id, { status: 'cancelado' });        │
│     continue;                                                │
│   }                                                           │
│                                                               │
│   // ✅ ENVIO via promotionEngine                           │
│   await sendPromotion(base44, {                             │
│     contact, thread, promo, integration_id, trigger        │
│   });                                                        │
│                                                               │
│   // ✅ REGISTRO HISTÓRICO (rotação)                        │
│   const nextIds = writeLastPromoIds(lastIds, promo.id);    │
│   await Contact.update(contact.id, {                        │
│     last_promo_ids: nextIds,                                │
│     last_any_promo_sent_at: now                            │
│   });                                                        │
│                                                               │
│   // ✅ MARCAR PROCESSADO                                   │
│   await WorkQueueItem.update(item.id, {                     │
│     status: 'processado',                                   │
│     processed_at: now                                       │
│   });                                                        │
│ }                                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ENVIO: enviarWhatsApp → Z-API/W-API → WhatsApp             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 PRIORIZAÇÃO DE FIXES (PROD)

### **P0 - URGENTE (Hoje)**

**1. Adicionar validação de bloqueios no lote**
```javascript
// enviarPromocoesLote - antes de processar
import { isBlocked } from './lib/promotionEngine.js';

const { blocked, reason } = isBlocked({
  contact: contato,
  thread,
  integration: integracaoDefault
});

if (blocked) {
  console.log(`[PROMO-LOTE] ⛔ ${contato.nome}: ${reason}`);
  resultados.push({ 
    contact_id: contato.id, 
    status: 'bloqueado', 
    motivo: reason 
  });
  continue;
}
```

**2. Substituir LLM por template**
```javascript
// Economia: 49 LLM calls → 0
const saudacao = `Olá ${contato.nome}! 👋

Percebi que faz ${diasInativo} dias que não conversamos.

${contato.empresa ? `Como estão as coisas na ${contato.empresa}?` : 'Como posso te ajudar hoje?'}

Tenho uma novidade que pode te interessar! 😊`;
```

**3. Logs detalhados (já feito)**
```javascript
catch (error) {
  const detalhes = error.response?.data || error.data || error.message;
  console.error('[PROMO-LOTE] ❌', JSON.stringify(detalhes, null, 2));
}
```

---

### **P1 - ALTA (Esta semana)**

**4. Otimizar N+1 queries**
```javascript
// Buscar todas threads de uma vez
const threadsByContact = new Map();
const allThreads = await base44.entities.MessageThread.filter({
  contact_id: { $in: contact_ids },
  is_canonical: true
});

allThreads.forEach(t => threadsByContact.set(t.contact_id, t));

// Usar no loop
for (const contato of contatos) {
  const thread = threadsByContact.get(contato.id);
  if (!thread) continue;
  
  // ✅ Não buscar mensagens - usar thread.last_inbound_at
  const diasInativo = thread.last_inbound_at 
    ? Math.floor((now - new Date(thread.last_inbound_at)) / (1000 * 60 * 60 * 24))
    : 999;
}
```

**5. Sincronizar badge do Layout**
```javascript
// Layout.js - adicionar
useEffect(() => {
  setContadoresLembretes(prev => ({
    ...prev,
    ContatosInteligentes: totalUrgentes || 0
  }));
}, [totalUrgentes]);
```

---

### **P2 - IMPORTANTE (Próximas iterações)**

**6. Unificar contrato de envio**
```javascript
// Padrão único thread-based
enviarMensagemUnificada({
  connectionId,
  threadId,
  contactId,
  content,
  mediaType,
  mediaUrl
})

// Todos chamam isso (UI, lote, worker)
```

**7. Campanha unificada (entidade)**
```javascript
// Em vez de disparos avulsos, criar:
Campaign.create({
  nome: 'Reativação Urgentes 12/02',
  tipo: 'promocao_lote',
  contact_ids: [...],
  status: 'agendado',
  scheduled_for: now + 5min
});

// WorkQueueItem referencia campaign_id
// Permite relatórios consolidados
```

---

## 📍 ONDE ESTÁ CADA BOTÃO (MAPA DA UI)

### **Layout.js (Sidebar)**
```javascript
// Linha ~83 - Botão Nexus AI (global)
<button onClick={() => setNexusOpen(true)}>
  <Sparkles /> Nexus AI
</button>

// Linha ~116 - NavItem para ContatosInteligentes
<NavItem
  page="ContatosInteligentes"
  badge={totalUrgentes}  // ← CONTADOR
  icon={Target}
/>

// 🎯 NÃO TEM botão de disparo aqui (correto)
```

### **ContatosRequerendoAtencao.jsx (Header/Sidebar)**
```javascript
// Linha ~142 - Versão header (dropdown)
<Button onClick={() => setExpandido(!expandido)}>
  Requerem Atenção ({totalAlertas})
</Button>

// Linha ~164 - Botões de ação
<Button onClick={enviarPromocoesAutomaticas}>
  Auto ({totalAlertas})
</Button>

<Button onClick={abrirEnvioMassa}>
  Massa ({contatosSelecionados.length})
</Button>

// 🎯 TEM disparo (correto - tem lista local)
```

### **pages/ContatosInteligentes**
```javascript
// Preciso ler este arquivo para confirmar
// Mas deve ter a lista completa + botões
```

---

## 🔐 CONTRATO ÚNICO DE DADOS

### **Motor Unificado (useContatosInteligentes)**
```typescript
interface ContatoInteligente {
  // Identificação
  contact_id: string;
  nome: string;
  empresa?: string;
  telefone: string;
  
  // Thread
  thread_id: string;
  
  // Métricas (ContactBehaviorAnalysis)
  prioridadeScore: number;        // 0-100
  prioridadeLabel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';
  days_inactive_inbound: number;
  bucket_inactive: 'active' | '30' | '60' | '90+';
  
  // Insights IA
  deal_risk: number;              // 0-100
  buy_intent: number;             // 0-100
  engagement: number;             // 0-100
  health: number;                 // 0-100
  root_causes: string[];
  suggested_message?: string;
  
  // Atribuição
  vendedor_responsavel?: string;
  assigned_user_id?: string;
  tipo_contato: string;
}
```

### **Output Padronizado das Funções**
```typescript
// enviarMensagemMassa
{
  success: true,
  enviados: number,
  erros: number,
  detalhes: Array<{
    nome: string,
    erro?: string
  }>
}

// enviarPromocoesLote
{
  success: true,
  enviados: number,
  erros: number,
  resultados: Array<{
    contact_id: string,
    nome: string,
    status: 'sucesso' | 'erro' | 'bloqueado' | 'aviso',
    motivo?: string,
    saudacao?: string,
    promocao_agendada?: string,
    horario_promocao?: string
  }>
}

// processarFilaPromocoes
{
  success: true,
  processados: number,
  erros: number,
  timestamp: string
}
```

---

## 🧪 TESTE DE INTEGRAÇÃO (Validar linha completa)

### **Cenário 1: Disparo do Header**
```
1. Layout carrega → useContatosInteligentes → totalUrgentes = 27
2. Badge mostra "27"
3. Usuário clica badge → Navega para ContatosInteligentes
4. Página carrega mesma query → clientes[] (27 items)
5. Usuário clica "Auto (27)" → enviarPromocoesLote({ contact_ids: [27] })
6. Lote envia 27 saudações + agenda 27 WorkQueueItems
7. Worker processa em 5 min → envia promoções elegíveis
```

### **Cenário 2: Disparo da Página**
```
1. Usuário acessa ContatosInteligentes direto
2. Filtra por "CRITICO" → 8 contatos
3. Seleciona 5 (checkbox)
4. Clica "Massa (5)" → abre ModalEnvioMassa
5. Digita mensagem personalizada
6. Envia → enviarMensagemMassa({ contact_ids: [5], mensagem })
7. Broadcast direto (sem delay, sem promoção)
```

### **Cenário 3: Cancelamento Automático**
```
1. Saudação enviada 15:01:00
2. Cliente responde 15:03:45
3. Thread.last_inbound_at = 15:03:45
4. Worker roda 15:06:00
5. Valida: last_inbound_at > saudacao_enviada_em → TRUE
6. WorkQueueItem.status = 'cancelado'
7. Promoção NÃO é enviada ✅
```

---

## 🔧 PLANO DE IMPLEMENTAÇÃO (SEQUENCIAL)

### **Fase 1 - Fixes Críticos (P0) - 2h**
- [x] Corrigir payload 400 (enviarWhatsApp)
- [ ] Adicionar isBlocked() no lote
- [ ] Substituir LLM por template
- [ ] Testar com 5 contatos reais

### **Fase 2 - Performance (P1) - 4h**
- [ ] Otimizar queries (threads em lote)
- [ ] Sincronizar badge Layout
- [ ] Reduzir busca de mensagens
- [ ] Teste de carga (50 contatos)

### **Fase 3 - Consolidação (P2) - 1 semana**
- [ ] Criar entidade Campaign
- [ ] Unificar contrato de envio
- [ ] Dashboard de campanhas
- [ ] Métricas unificadas

---

## 📊 DECISÃO FINAL - QUEM FAZ O QUÊ

| Componente | Responsabilidade | Tem contact_ids? | Pode disparar? |
|------------|------------------|------------------|----------------|
| **Layout.js** | Navegação + Contadores | ❌ Não (só 50 para contar) | ❌ Não |
| **ContatosRequerendoAtencao (header)** | Preview + Quick Action | ✅ Sim (lista completa) | ✅ Sim |
| **pages/ContatosInteligentes** | Listagem + Filtros | ✅ Sim (lista completa) | ✅ Sim |
| **ModalEnvioMassa** | Broadcast simples | ✅ Recebe contact_ids | ✅ Chama função |
| **enviarMensagemMassa** | Executor broadcast | ✅ Recebe contact_ids | 🔵 Executa |
| **enviarPromocoesLote** | Orquestrador promoções | ✅ Recebe contact_ids | 🔵 Agenda |
| **processarFilaPromocoes** | Worker promoções | 🟡 Busca do queue | 🔵 Executa final |

**Legenda:**
- ✅ Tem dados completos
- ❌ Não tem dados
- 🟡 Busca quando precisa
- 🔵 É função backend

---

## 🎯 RESUMO EXECUTIVO

### **Problema Raiz**
- Layout tem contador mas não lista → disparo seria duplicado
- PROMO-LOTE tem LLM síncrono → lento + rate-limit
- Falta validações P0 → envia para bloqueados

### **Solução Arquitetural**
```
Layout → Contador (navegação)
Página → Listagem + Disparo (dados completos)
Orquestrador → Validação + Agendamento
Worker → Execução com regras finais
```

### **Ganhos Esperados**
- ⚡ 98-147s → ~10s (template vs LLM)
- 📊 100% rastreável (WorkQueueItem)
- 🛡️ Zero envios indevidos (bloqueios)
- 🔄 Cancelamento inteligente (resposta)

---

**Próximo:** Implementar P0 (2h) e testar com 5 contatos reais.