# 🆚 COMPARAÇÃO: Envio Automático vs Envio em Massa

**Data:** 2026-02-11  
**Versão:** v1.0

---

## 📋 VISÃO GERAL

Agora existem **2 formas diferentes** de enviar mensagens para contatos urgentes:

| MODO | TIPO | MENSAGEM | DELAY | USO |
|------|------|----------|-------|-----|
| **🤖 Automático** | Promoções pré-cadastradas | Saudação IA + Promoção | 5min | Reativação comercial |
| **✍️ Massa** | Mensagem customizada | Texto livre personalizado | 0min (imediato) | Comunicado específico |

---

## 🤖 MODO AUTOMÁTICO (Promoções)

### Quando usar:
- ✅ Reativar contatos inativos com ofertas
- ✅ Recuperação comercial (leads frios)
- ✅ Campanha de promoções

### Como funciona:

**Botão:** "Auto (91)" - roxo/índigo

**Processo:**
```
1️⃣ IA gera saudação contextualizada (baseada em últimas 5 mensagens)
2️⃣ Envia saudação imediatamente
3️⃣ Aguarda 5 minutos
4️⃣ Se cliente NÃO respondeu → envia promoção ativa
   Se cliente respondeu → cancela promoção ✅
```

**Tempo:** ~73s (saudações) + 5min (espera) = ~6min total

**Mensagem enviada:**
```
ETAPA 1 (imediata):
"Oi FLAVOR! 👋 Vi que estávamos conversando sobre orçamento. 
Como estão as coisas por aí? Posso ajudar em algo? 😊"

ETAPA 2 (+5min, se não responder):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 *Notebook Dell i5 Gamer*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notebook Dell i5, 8GB RAM, SSD 256GB

💰 *De R$ 4.000 por R$ 3.500*

⏰ *Válido até:* 15/02/2026

_Quer aproveitar? Me diga o que você precisa que eu te ajudo!_ ✨
```

**Função Backend:** `enviarPromocoesLote` + `processarFilaPromocoes` (cron)

**Vantagens:**
- ✅ Saudação personalizada (IA)
- ✅ Cancelamento inteligente (se responder)
- ✅ Promoções profissionais (pré-formatadas)
- ✅ Rotação automática (evita repetir)

**Desvantagens:**
- ❌ Depende de promoções cadastradas
- ❌ Demora 5min (delay proposital)
- ❌ Menos controle (mensagem fixa)

---

## ✍️ MODO MASSA (Mensagem Customizada)

### Quando usar:
- ✅ Comunicado urgente específico
- ✅ Mensagem personalizada (não-comercial)
- ✅ Seguimento de situação específica
- ✅ Comunicação institucional

### Como funciona:

**Botão:** "Massa (4)" - azul/ciano (aparece após selecionar contatos)

**Processo:**
```
1️⃣ Usuário seleciona contatos (checkbox)
2️⃣ Clica "Massa (4)"
3️⃣ Modal abre
4️⃣ Digita mensagem personalizada
5️⃣ Clica "Enviar para 4"
6️⃣ Envia imediatamente para todos
```

**Tempo:** ~2s (sem delay, direto)

**Mensagem enviada:**
```
Olá {{nome}}! 

Estamos com uma atualização importante sobre {{assunto}}.

Pode me confirmar se recebeu?

Obrigado!
```

**Personalização automática:**
- `{{nome}}` → Nome do contato
- `{{empresa}}` → Nome da empresa

**Função Backend:** `enviarMensagemUnificada` (chamada direta em loop)

**Vantagens:**
- ✅ Mensagem totalmente customizada
- ✅ Envio imediato (sem delay)
- ✅ Flexibilidade total
- ✅ Não precisa promoções cadastradas

**Desvantagens:**
- ❌ Sem saudação IA (usuário digita tudo)
- ❌ Sem cancelamento inteligente
- ❌ Risco de spam (sem cooldown)

---

## 🔄 SELEÇÃO DE CONTATOS

### Modo Automático:
- **Seleciona:** TODOS os contatos listados (91)
- **Filtro:** Automático (urgência, dias inativos, risco)
- **Controle:** Sistema decide (algoritmo V3)

### Modo Massa:
- **Seleciona:** Usuário marca individualmente (checkbox)
- **Filtro:** Manual (usuário escolhe)
- **Controle:** 100% usuário

---

## 📊 COMPARAÇÃO TÉCNICA

### Arquitetura:

**AUTOMÁTICO:**
```
UI (botão) 
  → enviarPromocoesLote.js
      ├─ Gera 91 saudações IA
      ├─ Envia via enviarMensagemUnificada
      └─ Cria 91 WorkQueueItems (scheduled_for: +5min)
  
[AGUARDAR 5 MIN]

processarFilaPromocoes.js (cron cada 5min)
  ├─ Busca WorkQueueItems prontos
  ├─ Verifica: cliente respondeu?
  │   ├─ SIM → cancela
  │   └─ NÃO → envia promoção (promotionEngine.sendPromotion)
  └─ Atualiza last_promo_ids, cooldowns
```

**MASSA:**
```
UI (botão) 
  → ModalEnvioMassa (React)
      ├─ Usuário digita mensagem
      ├─ Personaliza {{nome}}, {{empresa}}
      └─ Loop direto:
          for (contato of selecionados) {
            enviarMensagemUnificada({ texto, thread_id })
            await delay(500ms) // anti-rate-limit
          }
```

### Performance:

| ASPECTO | AUTOMÁTICO | MASSA |
|---------|------------|-------|
| **Setup** | 0s (promoções cadastradas) | 30s (digitar mensagem) |
| **Execução** | 73s + 5min | 2-4s (direto) |
| **Taxa Sucesso** | ~95% (bloqueios) | ~98% (sem filtros) |
| **Cancelamento** | ✅ Se responder | ❌ Não |
| **Cooldown** | ✅ 12h universal | ❌ Não (cuidado!) |

---

## 🎯 CASOS DE USO

### Use AUTOMÁTICO quando:
```
✅ "Quero recuperar leads frios com promoções"
✅ "Enviar ofertas para base inativa"
✅ "Campanha de Black Friday automática"
✅ "Nutrir leads parados há 1 semana"
```

### Use MASSA quando:
```
✅ "Avisar sobre mudança de horário de atendimento"
✅ "Confirmar agendamento com 20 clientes"
✅ "Comunicar alteração de preço/produto"
✅ "Follow-up pós-evento/feira"
```

---

## ⚠️ CUIDADOS E LIMITES

### Modo Automático:
- 🛡️ Respeita cooldown 12h
- 🛡️ Bloqueia fornecedores/opt-out
- 🛡️ Rotaciona promoções (max 3x mesma)
- 🛡️ Cancela se cliente engajar

### Modo Massa:
- ⚠️ **SEM cooldown** - cuidado com spam!
- ⚠️ Não verifica bloqueios (envia para todos selecionados)
- ⚠️ Sem cancelamento inteligente
- ⚠️ Responsabilidade do usuário (mensagem adequada)

**Recomendação:** Use Massa apenas para comunicados pontuais e importantes.

---

## 🔧 CONFIGURAÇÃO

### Pré-requisitos AUTOMÁTICO:
1. ✅ Ter promoções cadastradas (`/Promocoes`)
2. ✅ Promoções ativas (`ativo: true`)
3. ✅ Automação `processarFilaPromocoes` ativa (cron 5min)
4. ✅ WhatsAppIntegration conectada

### Pré-requisitos MASSA:
1. ✅ WhatsAppIntegration conectada
2. ✅ Selecionar contatos (checkbox)
3. ✅ Digitar mensagem

---

## 📈 MÉTRICAS RASTREADAS

### Automático:
```javascript
// EngagementLog
{
  type: 'offer',
  trigger: 'manual_lote_urgentes',
  metadata: { promotion_id, via_lote_urgentes: true }
}

// Contact
{
  last_any_promo_sent_at, // Cooldown universal
  last_promo_ids: [...],  // Rotação
  promocoes_recebidas: {} // Contador
}
```

### Massa:
```javascript
// Message
{
  metadata: { 
    is_system_message: false,
    message_type: 'broadcast_manual'
  }
}
```

---

## 🎨 UI/UX

### Diferenciação Visual:

**Automático:**
- 🟣 Roxo/Índigo (gradiente)
- ✨ Ícone: Sparkles
- 📝 Label: "Auto (91)"

**Massa:**
- 🔵 Azul/Ciano (gradiente)
- 💬 Ícone: MessageSquare
- 📝 Label: "Massa (4)"

### Estados:

**Automático:**
```
Desabilitado quando:
- enviandoPromos = true
- loading = true
- totalAlertas = 0
```

**Massa:**
```
Desabilitado quando:
- contatosSelecionados.length = 0
```

---

## 🔍 DEBUGGING

### Verificar por que promoção não foi enviada:

```javascript
// 1. Verificar WorkQueueItem
const fila = await WorkQueueItem.filter({
  contact_id: 'abc123',
  tipo: 'enviar_promocao',
  status: 'agendado'
});

// 2. Verificar se cliente respondeu
const respostas = await Message.filter({
  thread_id: 'xyz789',
  sender_type: 'contact',
  created_date: { $gte: '2026-02-11T10:47:00Z' }
});

// 3. Verificar cooldown
const contato = await Contact.get('abc123');
const last = new Date(contato.last_any_promo_sent_at);
const diff = new Date() - last;
const horas = diff / (1000 * 60 * 60);
console.log('Cooldown restante:', 12 - horas, 'horas');
```

### Verificar mensagens em massa:

```javascript
// Buscar mensagens enviadas hoje
const hoje = new Date().toISOString().split('T')[0];
const msgs = await Message.filter({
  sender_id: 'system',
  created_date: { $gte: hoje + 'T00:00:00Z' },
  'metadata.message_type': 'broadcast_manual'
});

console.log('Mensagens em massa hoje:', msgs.length);
```

---

## ✅ RESUMO EXECUTIVO

### 🤖 AUTOMÁTICO (Promoções com IA)
- **Processo:** Saudação IA → 5min → Promoção (se não responder)
- **Seleção:** Todos os contatos listados (algoritmo)
- **Mensagem:** Fixa (promoção cadastrada)
- **Inteligência:** ✅ Alta (IA + cancelamento + rotação)
- **Tempo:** 6min total
- **Use para:** Recuperação comercial

### ✍️ MASSA (Mensagem Customizada)
- **Processo:** Mensagem customizada → Envio direto
- **Seleção:** Checkbox manual (usuário escolhe)
- **Mensagem:** Livre (usuário digita)
- **Inteligência:** ❌ Baixa (sem IA, sem cooldown)
- **Tempo:** 2-4s (imediato)
- **Use para:** Comunicados pontuais

---

**FIM DA COMPARAÇÃO**