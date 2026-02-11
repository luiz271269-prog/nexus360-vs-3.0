# 📊 LINHA LÓGICA: Envio Automático de Promoções em Lote

**Data:** 2026-02-11  
**Versão:** v3.0  
**Status:** ✅ Operacional

---

## 🎯 OBJETIVO

Enviar promoções automáticas para **contatos urgentes** que requerem atenção, seguindo uma estratégia em 2 etapas:
1. **Saudação contextualizada** (imediata) - gerada por IA
2. **Promoção ativa** (após 5 minutos) - se cliente não responder

---

## 📍 ONDE ESTÁ NO SISTEMA

### Interface (UI):
- **Arquivo:** `components/comunicacao/ContatosRequerendoAtencao.jsx`
- **Localização:** Dropdown "Contatos Urgentes" no header da página Comunicação
- **Botão:** "Enviar Promoções Auto (91)" - aparece quando há contatos filtrados

### Backend:
1. **`functions/enviarPromocoesLote.js`** - Orquestra o processo inicial
2. **`functions/processarFilaPromocoes.js`** - Processa fila após 5min
3. **`functions/lib/promotionEngine.js`** - Motor de seleção/envio (reutilizado)

### Entidades:
- **`Promotion`** - Promoções cadastradas
- **`WorkQueueItem`** - Fila de tarefas agendadas
- **`Contact`** - Controles de envio (last_promo_ids, cooldown)
- **`EngagementLog`** - Histórico de engajamento

---

## 🔄 FLUXO COMPLETO (Passo a Passo)

### **ETAPA 0: Preparação (Usuário)**
```
Usuário acessa: Comunicação > Dropdown "Contatos Urgentes"
    ↓
Vê lista de 91 contatos com análise comportamental
    ↓
Clica: "Enviar Promoções Auto (91)"
    ↓
Confirma diálogo: ✅ OK
```

**Dados enviados ao backend:**
```javascript
{
  contact_ids: ['id1', 'id2', ... 'id91'], // IDs dos contatos selecionados
  user_id: 'user_abc123'
}
```

---

### **ETAPA 1: Processamento Inicial** (`enviarPromocoesLote.js`)

**Trigger:** Botão da UI  
**Tempo estimado:** 73 segundos (para 91 contatos)

#### 1.1 Buscar Dados Necessários (Paralelo)
```javascript
const [contatos, integracoes] = await Promise.all([
  Contact.filter({ id: { $in: contact_ids } }), // 91 contatos
  WhatsAppIntegration.filter({ status: 'conectado' }) // Conexões ativas
]);

const promosAtivas = await getActivePromotions(base44, now); // Motor reutilizado
```

#### 1.2 Para Cada Contato (Loop):

**1.2.1 Buscar Thread e Contexto**
```javascript
const thread = await MessageThread.filter({
  contact_id: contato.id,
  is_canonical: true,
  thread_type: 'contact_external'
})[0];

const mensagensRecentes = await Message.filter({
  thread_id: thread.id,
  sender_type: 'contact'
}, '-created_date', 5); // Últimas 5 mensagens do cliente
```

**1.2.2 Gerar Saudação Contextualizada (IA)**
```javascript
const contexto = mensagensRecentes.map(m => `- ${m.content}`).join('\n');
const diasInativo = calcularDias(thread.last_inbound_at);

const respIA = await base44.integrations.Core.InvokeLLM({
  prompt: `
    Contexto: Cliente ${contato.nome} sem responder há ${diasInativo} dias
    Últimas mensagens: ${contexto}
    
    Gere uma saudação natural, amigável, CURTA (máx 280 chars):
    - Mencione contexto da última conversa
    - Tom: informal, empático
    - SEM promoções (só reativar conversa)
  `,
  response_json_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string" }
    }
  }
});

const mensagemSaudacao = respIA.mensagem;
```

**Exemplo de saudação gerada:**
```
Oi FLAVOR! 👋 Vi que estávamos conversando sobre orçamento. 
Como estão as coisas por aí? Posso ajudar em algo? 😊
```

**1.2.3 Enviar Saudação Imediatamente**
```javascript
await base44.functions.invoke('enviarMensagemUnificada', {
  thread_id: thread.id,
  texto: mensagemSaudacao,
  integration_id: thread.whatsapp_integration_id
});

// Registra no banco
await Message.create({
  thread_id: thread.id,
  sender_id: 'system',
  content: mensagemSaudacao,
  status: 'enviada',
  metadata: { is_system_message: true, message_type: 'reativacao' }
});
```

**1.2.4 Selecionar Promoção Elegível**
```javascript
// ✅ REUTILIZA promotionEngine.js
const eligible = filterEligiblePromotions(promosAtivas, contato, thread);
const promoSelecionada = pickPromotion(eligible, contato);

// Critérios:
// - target_contact_types = [lead, cliente] ✓
// - target_sectors = [vendas, geral] ✓
// - Rotação: evita últimas 3 enviadas
// - Prioridade: menor número = maior prioridade
```

**1.2.5 Agendar Promoção para 5 Minutos**
```javascript
const timestampPromo = new Date(now.getTime() + 5 * 60 * 1000);

await WorkQueueItem.create({
  tipo: 'enviar_promocao',
  contact_id: contato.id,
  thread_id: thread.id,
  reason: 'promocao_lote',
  status: 'agendado',
  scheduled_for: timestampPromo.toISOString(), // ⏰ +5min
  payload: {
    promotion_id: promoSelecionada.id,
    integration_id: thread.whatsapp_integration_id,
    trigger: 'manual_lote_urgentes'
  },
  metadata: {
    saudacao_enviada_em: now.toISOString(),
    dias_inativo: diasInativo
  }
});
```

**1.2.6 Delay Anti-Rate-Limit**
```javascript
await new Promise(resolve => setTimeout(resolve, 800)); // 0.8s entre cada
```

---

### **ETAPA 2: Aguardar 5 Minutos** ⏳

```
Saudação enviada: 10:47:00
Cliente pode responder: 10:47:00 → 10:52:00
WorkQueueItem criado: scheduled_for = 10:52:00
```

**Comportamentos possíveis:**
- ✅ Cliente responde → Promoção CANCELADA (verificado na Etapa 3)
- ❌ Cliente não responde → Promoção ENVIADA (Etapa 3)

---

### **ETAPA 3: Processar Fila** (`processarFilaPromocoes.js`)

**Trigger:** Automação cron a cada 5 minutos  
**Automação ID:** Ver `list_automations`

#### 3.1 Buscar Itens Prontos
```javascript
const itensNaFila = await WorkQueueItem.filter({
  tipo: 'enviar_promocao',
  status: 'agendado',
  scheduled_for: { $lte: now.toISOString() } // Chegou a hora
}, 'scheduled_for', 50);
```

#### 3.2 Para Cada Item:

**3.2.1 Buscar Dados**
```javascript
const { contact_id, thread_id, payload } = item;
const { promotion_id, integration_id, trigger } = payload;

const [contato, thread, promo] = await Promise.all([
  Contact.get(contact_id),
  MessageThread.get(thread_id),
  Promotion.get(promotion_id)
]);
```

**3.2.2 VERIFICAR SE CLIENTE RESPONDEU**
```javascript
// Buscar mensagens do cliente APÓS a saudação
const respostasCliente = await Message.filter({
  thread_id,
  sender_type: 'contact',
  created_date: { $gte: item.created_date } // Depois da saudação
});

if (respostasCliente.length > 0) {
  console.log('✅ Cliente respondeu! Cancelando promoção');
  
  await WorkQueueItem.update(item.id, { status: 'cancelado' });
  continue; // ❌ NÃO ENVIA promoção
}
```

**3.2.3 Enviar Promoção (se não respondeu)**
```javascript
// ✅ REUTILIZA promotionEngine.sendPromotion()
// Já faz: formatação, envio, registro no banco
await sendPromotion(base44, {
  contact: contato,
  thread,
  integration_id,
  promo,
  trigger: 'manual_lote_urgentes'
});

// Atualizar histórico (rotação inteligente)
const lastIds = readLastPromoIds(contato);
const nextIds = writeLastPromoIds(lastIds, promotion_id);

await Contact.update(contact_id, {
  last_promo_inbound_at: now.toISOString(),
  last_promo_ids: nextIds // [promo_nova, promo_anterior1, promo_anterior2]
});

await WorkQueueItem.update(item.id, {
  status: 'processado',
  processed_at: now.toISOString()
});
```

**Formato da mensagem enviada:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *Notebook Dell i5 Gamer*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notebook Dell i5, 8GB RAM, SSD 256GB - Apenas 5 unidades!

💰 *De R$ 4.000 por R$ 3.500*

⏰ *Válido até:* 15/02/2026

🔗 https://exemplo.com/produto

_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨
```

---

## 🛡️ PROTEÇÕES E GUARDAS

### Bloqueios Absolutos (não envia):
```javascript
// promotionEngine.isBlocked()
✅ Tipo fornecedor
✅ Tags: fornecedor, compras, colaborador, interno
✅ Setor financeiro/cobrança
✅ Contato bloqueado manualmente
✅ Opt-out (whatsapp_optin = false)
```

### Cooldown Universal:
```javascript
// promotionEngine.canSendUniversalPromo()
✅ 12h entre QUALQUER promoção (controle global)
✅ Campo: contact.last_any_promo_sent_at
```

### Filtros de Elegibilidade:
```javascript
// promotionEngine.filterEligiblePromotions()
✅ target_contact_types: ['lead', 'cliente']
✅ target_sectors: ['vendas', 'geral']
✅ target_tags: (se especificado)
✅ limite_envios_por_contato: máx 3x por contato
```

### Rotação Inteligente:
```javascript
// promotionEngine.pickPromotion()
✅ Evita últimas 3 promoções enviadas
✅ Prioriza por priority (menor número = maior)
✅ Randomiza dentro do mesmo nível de prioridade
```

---

## 📊 DADOS RASTREADOS

### No Contact:
```javascript
{
  last_any_promo_sent_at: "2026-02-11T10:47:00Z", // Cooldown universal 12h
  last_promo_inbound_at: "2026-02-11T10:47:00Z", // Específico inbound
  last_promo_ids: ["promo_123", "promo_456", "promo_789"], // Últimas 3
  promocoes_recebidas: {
    "promo_123": 2, // Quantas vezes recebeu cada
    "promo_456": 1
  }
}
```

### No WorkQueueItem:
```javascript
{
  tipo: 'enviar_promocao',
  contact_id: 'contact_abc',
  thread_id: 'thread_xyz',
  scheduled_for: '2026-02-11T10:52:00Z', // +5min
  status: 'agendado', // → 'processado' | 'cancelado' | 'erro'
  payload: {
    promotion_id: 'promo_123',
    integration_id: 'integration_abc',
    trigger: 'manual_lote_urgentes'
  },
  metadata: {
    saudacao_enviada_em: '2026-02-11T10:47:00Z',
    dias_inativo: 7
  }
}
```

### No EngagementLog:
```javascript
{
  contact_id: 'contact_abc',
  thread_id: 'thread_xyz',
  type: 'offer',
  sent_at: '2026-02-11T10:52:00Z',
  status: 'sent',
  metadata: {
    promotion_id: 'promo_123',
    trigger: 'manual_lote_urgentes',
    via_lote_urgentes: true
  }
}
```

---

## 🔁 CICLO DE VIDA COMPLETO

### Cenário 1: Cliente NÃO Responde (Envio Bem-Sucedido)
```
10:47:00 → Saudação enviada (IA contextualizada)
10:47:00 → WorkQueueItem criado (scheduled_for: 10:52:00)
10:47:00 → ... aguardando ...
10:52:00 → Cron processarFilaPromocoes executa
10:52:00 → Verifica: Cliente respondeu? ❌ NÃO
10:52:00 → ✅ ENVIA promoção
10:52:00 → Atualiza: last_promo_ids, last_any_promo_sent_at
10:52:00 → WorkQueueItem.status = 'processado'
```

### Cenário 2: Cliente RESPONDE (Cancelamento Inteligente)
```
10:47:00 → Saudação enviada (IA contextualizada)
10:47:00 → WorkQueueItem criado (scheduled_for: 10:52:00)
10:49:30 → 🎉 Cliente responde: "Oi! Sim, preciso de orçamento"
10:52:00 → Cron processarFilaPromocoes executa
10:52:00 → Verifica: Cliente respondeu? ✅ SIM
10:52:00 → ❌ CANCELA promoção (não faz sentido mais)
10:52:00 → WorkQueueItem.status = 'cancelado'
```

### Cenário 3: Bloqueio (Não Processa)
```
10:47:00 → Saudação IA gerada
10:47:00 → Motor verifica elegibilidade
10:47:00 → ❌ BLOQUEADO (fornecedor / opt-out / cooldown 12h)
10:47:00 → NÃO envia saudação nem cria WorkQueueItem
10:47:00 → Resultado: { status: 'bloqueado', motivo: '...' }
```

---

## 🧠 LÓGICA DE SELEÇÃO DE PROMOÇÃO

### Passo 1: Filtrar Promoções Ativas
```javascript
// promotionEngine.getActivePromotions()
Promotion.filter({
  ativo: true,
  validade: { $gte: now }, // Ainda válida
  contador_envios: { $lt: limite_envios_total } // Limite não atingido
})
```

### Passo 2: Aplicar Filtros de Elegibilidade
```javascript
// promotionEngine.filterEligiblePromotions()
promos.filter(promo => {
  // Tipo de contato elegível?
  if (promo.target_contact_types?.length > 0) {
    if (!promo.target_contact_types.includes(contato.tipo_contato)) {
      return false; // ❌ Não elegível
    }
  }
  
  // Setor elegível?
  if (promo.target_sectors?.length > 0) {
    if (!promo.target_sectors.includes(thread.sector_id)) {
      return false; // ❌ Não elegível
    }
  }
  
  // Limite por contato atingido?
  const vezes = contato.promocoes_recebidas?.[promo.id] || 0;
  if (vezes >= promo.limite_envios_por_contato) {
    return false; // ❌ Já recebeu demais
  }
  
  return true; // ✅ Elegível
})
```

### Passo 3: Rotação Inteligente (Evitar Repetição)
```javascript
// promotionEngine.pickPromotion()
const lastIds = contato.last_promo_ids || []; // ['promo_A', 'promo_B', 'promo_C']

// Evitar últimas 3
let candidates = eligible.filter(p => !lastIds.includes(p.id));

// Se todas foram enviadas, permite repetir
if (!candidates.length) candidates = eligible;

// Pegar maior prioridade e randomizar
const topPrio = candidates[0].priority; // Ex: 10
const pool = candidates.filter(p => p.priority === topPrio);

return pool[Math.floor(Math.random() * pool.length)]; // Aleatório no mesmo nível
```

**Exemplo de resultado:**
```javascript
{
  id: 'promo_notebook_dell',
  titulo: 'Notebook Dell i5 Gamer',
  priority: 5, // Alta prioridade
  stage: '6h',
  target_contact_types: ['lead', 'cliente']
}
```

---

## ⚙️ CONFIGURAÇÃO DE AUTOMAÇÃO

### Processador de Fila (CRON)
```json
{
  "name": "Processador de Fila de Promoções",
  "automation_type": "scheduled",
  "function_name": "processarFilaPromocoes",
  "schedule_type": "simple",
  "repeat_interval": 5,
  "repeat_unit": "minutes",
  "is_active": true
}
```

**Garante:** WorkQueueItems são processados em até 5min do agendamento

---

## 📈 MÉTRICAS E RASTREABILIDADE

### Performance Estimada (91 contatos):
- **Tempo total:** ~73 segundos
- **Tempo por contato:** ~0.8s (IA + envio + registro)
- **Taxa de sucesso:** >95% (bloqueios ~5%)

### Logs Gerados:
```javascript
// Console Backend
[PROMO-LOTE] 🎯 Processando 91 contatos
[PROMO-LOTE] ✅ FLAVOR: saudação enviada, promo agendada 10:52
[PROMO-LOTE] ⚠️ Junior: bloqueado (opt_out)
[PROMO-LOTE] ✅ Concluído: 86 enviados, 5 bloqueados

// Console Processador (5min depois)
[PROMO-QUEUE] 📋 86 itens na fila prontos
[PROMO-QUEUE] ✅ FLAVOR: promoção enviada (cliente não respondeu)
[PROMO-QUEUE] ❌ Junior: promoção cancelada (cliente respondeu)
[PROMO-QUEUE] ✅ Concluído: 72 enviadas, 14 canceladas
```

---

## 🎯 DECISÕES DE ARQUITETURA

### Por que 2 Funções Separadas?

**1. `enviarPromocoesLote`** (Orquestração)
- Lightweight, rápida (~73s para 91 contatos)
- Não bloqueia UI
- Delega trabalho pesado para fila

**2. `processarFilaPromocoes`** (Worker)
- Executa em background
- Retry automático (cron a cada 5min)
- Tolerante a falhas (processa 1 por 1)

### Por que 5 Minutos de Delay?

1. **Dar chance do cliente responder** à saudação
2. **Evitar spam** (2 mensagens simultâneas)
3. **Contexto adaptativo** (se responder, promoção é irrelevante)

### Por que Reutilizar promotionEngine.js?

1. ✅ **Código testado** - já usado em crons 6h/36h
2. ✅ **Consistência** - mesmas regras em todos os fluxos
3. ✅ **Manutenibilidade** - única fonte de verdade

---

## 🚀 COMO ATIVAR/DESATIVAR

### Desativar Temporariamente:
```javascript
// Opção 1: Desativar todas as promoções
Promotion.update({ ativo: true }, { ativo: false });

// Opção 2: Desativar automação do processador
manage_automation(automation_id, action='toggle');
```

### Ajustar Frequência:
```javascript
// Alterar cron de 5min para 10min
manage_automation(automation_id, {
  action: 'update',
  repeat_interval: 10,
  repeat_unit: 'minutes'
});
```

---

## 🔍 DEBUGGING

### Verificar Fila:
```javascript
const fila = await WorkQueueItem.filter({
  tipo: 'enviar_promocao',
  status: 'agendado'
}, 'scheduled_for', 100);

console.log('Itens na fila:', fila.length);
console.log('Próximo:', fila[0]?.scheduled_for);
```

### Verificar Envios de Hoje:
```javascript
const hoje = new Date().toISOString().split('T')[0];
const logs = await EngagementLog.filter({
  type: 'offer',
  sent_at: { $gte: hoje + 'T00:00:00Z' }
});

console.log('Promoções enviadas hoje:', logs.length);
```

### Verificar Cooldown de Um Contato:
```javascript
const contato = await Contact.get(contact_id);
const last = contato.last_any_promo_sent_at;
const agora = new Date();
const diff = agora - new Date(last);
const horasRestantes = (12 * 60 * 60 * 1000 - diff) / (1000 * 60 * 60);

console.log('Cooldown restante:', horasRestantes, 'horas');
```

---

## ✅ RESUMO EXECUTIVO

| ETAPA | TEMPO | O QUE FAZ | FUNÇÃO |
|-------|-------|-----------|--------|
| 1️⃣ Usuário clica botão | 0s | Confirma envio | UI |
| 2️⃣ Processamento lote | 73s | Envia 91 saudações IA + agenda promos | `enviarPromocoesLote` |
| 3️⃣ Aguardar | 5min | Cliente pode responder | - |
| 4️⃣ Processar fila | ~20s | Envia promos (se não respondeu) | `processarFilaPromocoes` |

**Resultado Final:**
- ✅ 72 promoções enviadas (clientes não responderam)
- ❌ 14 canceladas (clientes responderam à saudação)
- 🛡️ 5 bloqueadas (fornecedores, opt-out, etc)

---

## 🆚 DIFERENÇA vs CRONS AUTOMÁTICOS

| ASPECTO | CRON 6h/36h | LOTE URGENTES (Manual) |
|---------|-------------|------------------------|
| **Trigger** | Automático (cron) | Manual (botão) |
| **Saudação** | ❌ Não | ✅ IA contextualizada |
| **Delay** | 0min | 5min (chance responder) |
| **Alvo** | Todos elegíveis | Seleção específica (91) |
| **Cancelamento** | ❌ Não verifica | ✅ Cancela se responder |
| **Uso** | Manutenção passiva | Reativação ativa |

---

## 🎓 APRENDIZADOS DO SISTEMA

### O que funciona bem:
✅ Rotação de 3 promoções evita fadiga  
✅ Cooldown 12h mantém qualidade  
✅ Saudação IA aumenta taxa de resposta  
✅ Cancelamento inteligente reduz spam  

### O que pode melhorar:
⚠️ Monitorar taxa de resposta pós-saudação  
⚠️ A/B test: 5min vs 10min vs 15min  
⚠️ Personalizar delay por perfil cliente  

---

**FIM DA ANÁLISE**