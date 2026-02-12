# 📊 ANÁLISE COMPLETA - LINHA LÓGICA DE ENVIOS DE MENSAGENS

**Data:** 2026-02-12  
**Status:** Produção Ativa  
**Versão:** v3.0 Unificada

---

## 🎯 RESUMO EXECUTIVO

O sistema possui **3 fluxos de envio** principais:

1. **`enviarCampanhaLote` (modo: broadcast)** - Mensagem única para múltiplos contatos
2. **`enviarCampanhaLote` (modo: promocao)** - Saudação imediata + promoção agendada
3. **`processarFilaPromocoes`** - Processador worker que executa promoções agendadas

---

## 📋 QUADRO COMPARATIVO COMPLETO

| Critério | enviarCampanhaLote (broadcast) | enviarCampanhaLote (promocao) | processarFilaPromocoes |
|----------|-------------------------------|------------------------------|------------------------|
| **Gatilho** | Manual (botão "Envio Massa") | Manual (botão "Auto Promoções") | Automação (5 min) |
| **Entrada** | contact_ids + mensagem | contact_ids | WorkQueueItem.scheduled_for |
| **Fonte de dados** | Contact.filter + MessageThread.filter (canônica) | Contact.filter + MessageThread.filter (canônica) | Contact.get + Thread.get + Promotion.get |
| **Validação telefone** | ✅ P0 (linha 129) | ✅ P0 (linha 129) | ❌ Assume válido |
| **Cria thread se ausente** | ✅ P1 (linha 114-126) | ✅ P1 (linha 114-126) | ❌ Falha se não existir |
| **Bloqueios (isBlocked)** | ✅ (linha 148-152) | ✅ (linha 148-152) | ❌ Não valida |
| **Cooldown 12h** | ❌ Não valida | ✅ (linha 238-253) | ❌ Assume já validado |
| **Dedupe fila** | ❌ N/A | ✅ (linha 219-236) | ❌ Processa tudo |
| **Dedupe saudação 1h** | ❌ N/A | ✅ (linha 255-272) | ❌ N/A |
| **Cancelamento por resposta** | ❌ N/A | ❌ Não valida | ✅ (linha 52-63) |
| **Rotação inteligente (3 últimas)** | ❌ N/A | ✅ pickPromotion (linha 316) | ✅ (linha 76-77) |
| **Persistência Message** | ⚠️ Gateway deve persistir | ✅ Explícita (linha 288-304) | ✅ via sendPromotion |
| **Atualização Thread** | ⚠️ Gateway deve atualizar | ✅ Explícita (linha 307-312) | ⚠️ Via sendPromotion (não atualiza last_message_at) |
| **Log AutomationLog** | ✅ (linha 392-412) | ✅ (linha 392-412) | ❌ Não grava |
| **Anti-rate-limit** | ✅ 500ms (linha 369) | ✅ 800ms (linha 369) | ✅ 600ms (linha 94) |
| **Personalização** | ✅ {{nome}}/{{empresa}} | ✅ Template inteligente | ✅ formatPromotionMessage |
| **Contadores Contact** | ❌ Não atualiza | ⚠️ Parcial (linha 79-82) | ✅ Completo (linha 79-82) |
| **Status possíveis** | enviado, erro, bloqueado | sucesso, parcial, aviso, erro, bloqueado | processado, cancelado, erro |

---

## 🔍 LINHA LÓGICA DETALHADA - FUNÇÃO POR FUNÇÃO

### 1️⃣ **enviarCampanhaLote (modo: broadcast)**

**Arquivo:** `functions/enviarCampanhaLote.js` (linhas 169-198)

#### Fluxo:
```
1. Recebe: { contact_ids, modo: 'broadcast', mensagem, personalizar }
2. Valida mensagem obrigatória
3. Busca em lote: Contact + MessageThread canônica + WhatsAppIntegration
4. Para cada contato:
   a. Valida existência de contato
   b. Cria thread se não existir (P1)
   c. Valida telefone (P0)
   d. Valida bloqueios com isBlocked (P0)
   e. Personaliza mensagem ({{nome}}, {{empresa}})
   f. Envia via enviarWhatsApp (gateway)
   g. Aguarda 500ms (anti-rate-limit)
5. Grava AutomationLog com resumo
6. Retorna { enviados, erros, resultados }
```

#### Logs Gravados:
- **AutomationLog**: 1 registro total da campanha (linha 394-409)
  - acao: `envio_massa_broadcast`
  - detalhes: { modo, total_contatos, enviados, erros, mensagem_enviada, resultados }
  
- **Message**: ⚠️ Depende do gateway `enviarWhatsApp` persistir
  - ❌ Não grava Message explicitamente neste modo
  - ✅ Confia que `enviarWhatsApp` já persiste e atualiza thread

#### Gaps Críticos:
- ❌ **Não persiste Message explicitamente** (depende do gateway)
- ❌ **Não atualiza thread.last_message_at** (depende do gateway)
- ❌ **Não valida cooldown** (pode enviar broadcast seguido de promo)
- ❌ **Não atualiza contadores** em Contact

---

### 2️⃣ **enviarCampanhaLote (modo: promocao)**

**Arquivo:** `functions/enviarCampanhaLote.js` (linhas 200-366)

#### Fluxo:
```
1. Recebe: { contact_ids, modo: 'promocao', delay_minutos }
2. Busca promoções ativas (getActivePromotions)
3. Busca em lote: Contact + MessageThread canônica + WhatsAppIntegration
4. Para cada contato:
   a. Valida existência
   b. Cria thread se não existir (P1)
   c. Valida telefone (P0)
   d. Valida bloqueios (P0)
   e. Verifica dedupe fila (WorkQueueItem agendado)
   f. Verifica cooldown 12h (last_any_promo_sent_at)
   g. Verifica dedupe saudação 1h (Message.origem_campanha)
   h. Calcula dias inativo (thread.last_inbound_at)
   i. Gera saudação personalizada (TEMPLATE - sem LLM)
   j. Envia saudação via enviarWhatsApp
   k. ✅ PERSISTE Message (saudação) explicitamente
   l. ✅ ATUALIZA thread.last_message_at explicitamente
   m. Seleciona promoção elegível (filterEligiblePromotions + pickPromotion)
   n. Agenda WorkQueueItem para +delay_minutos
   o. Aguarda 800ms (anti-rate-limit)
5. Grava AutomationLog com resumo
6. Retorna { enviados, erros, resultados }
```

#### Logs Gravados:
- **Message** (saudação): 1 por contato (linha 288-304)
  - sender_id: 'sistema'
  - sender_type: 'user'
  - content: mensagemSaudacao
  - status: 'enviada'
  - metadata: { origem_campanha: 'lote_urgentes', lote_timestamp }

- **MessageThread** (atualização): 1 por contato (linha 307-312)
  - last_message_at: now
  - last_message_content: mensagemSaudacao (100 chars)
  - last_message_sender: 'user'
  - last_outbound_at: now

- **WorkQueueItem** (agendamento): 1 por contato elegível (linha 335-354)
  - tipo: 'enviar_promocao'
  - status: 'agendado'
  - scheduled_for: now + delay_minutos
  - payload: { promotion_id, integration_id, trigger }
  - metadata: { saudacao_enviada_em, saudacao_message_id, dias_inativo }

- **Contact** (atualização parcial): linha 79-82 apenas em processarFilaPromocoes
  - ⚠️ **GAP**: enviarCampanhaLote NÃO atualiza Contact.last_promo_inbound_at
  - ⚠️ **GAP**: enviarCampanhaLote NÃO atualiza Contact.last_promo_ids

- **AutomationLog**: 1 registro total da campanha (linha 394-409)
  - acao: `envio_massa_promocao`
  - detalhes: { modo, total_contatos, enviados, erros, resultados }

#### Gaps Críticos:
- ⚠️ **Não atualiza Contact após saudação** (só atualiza na fila)
- ⚠️ **Não atualiza Contact.last_any_promo_sent_at** após saudação (só na fila)
- ⚠️ **Rotação inteligente acontece mas não persiste** (Contact.last_promo_ids só atualiza na fila)

---

### 3️⃣ **processarFilaPromocoes (Worker)**

**Arquivo:** `functions/processarFilaPromocoes.js`

#### Fluxo:
```
1. Gatilho: Automação (5 min)
2. Busca WorkQueueItem:
   - tipo: 'enviar_promocao'
   - status: 'agendado'
   - scheduled_for <= now
   - Limite: 50 itens
3. Para cada item:
   a. Busca Contact + MessageThread + Promotion (by ID)
   b. ✅ CANCELAMENTO POR RESPOSTA (linha 52):
      - Se thread.last_inbound_at > saudacao_enviada_em
      - Marca status: 'cancelado'
      - metadata.cancelado_motivo: 'cliente_respondeu'
   c. Se não cancelado:
      - Chama sendPromotion (promotionEngine)
      - Atualiza Contact.last_promo_inbound_at (linha 80)
      - Atualiza Contact.last_promo_ids (rotação) (linha 81)
      - Marca WorkQueueItem.status: 'processado'
   d. Aguarda 600ms (anti-rate-limit)
4. Retorna { processados, erros }
```

#### Logs Gravados:
- **Message** (promoção): 1 por item processado (via sendPromotion linha 283-304)
  - sender_id: 'system'
  - sender_type: 'user'
  - content: formatPromotionMessage(promo)
  - status: 'enviada'
  - metadata: { promotion_id, trigger, message_type: 'promotion' }

- **Contact** (atualização completa): 1 por item (linha 79-82)
  - last_promo_inbound_at: now
  - last_promo_ids: [novo_id, ...2_últimos]
  - last_any_promo_sent_at: now (via sendPromotion linha 308-310)

- **WorkQueueItem** (atualização status): 1 por item (linha 85-88 ou 100-106)
  - status: 'processado' | 'cancelado' | 'erro'
  - processed_at: now
  - metadata.cancelado_motivo: 'cliente_respondeu' (se cancelado)
  - metadata.erro: error.message (se erro)

- **AutomationLog**: ❌ NÃO GRAVA

#### Gaps Críticos:
- ❌ **Não grava AutomationLog** (dificulta auditoria)
- ⚠️ **Não atualiza thread.last_message_at** (via sendPromotion)
- ⚠️ **Assume dados válidos** (não revalida bloqueios/telefone)

---

## 🔐 VALIDAÇÕES E FILTROS - MATRIZ DE DECISÃO

### Bloqueios Absolutos (isBlocked)

**Arquivo:** `functions/lib/promotionEngine.js` (linhas 19-63)

| Bloqueio | Condição | Retorna |
|----------|----------|---------|
| 1. Tipo Fornecedor | contact.tipo_contato === 'fornecedor' | `blocked_supplier_type` |
| 2. Tags Proibidas | tags inclui 'fornecedor', 'compras', 'colaborador', 'interno' | `blocked_tag` |
| 3. Canal Financeiro | integration.setor_principal === 'financeiro'/'cobranca' | `blocked_integration_financial` |
| 4. Flag Integração | integration.permite_promocao === false | `blocked_integration_flag` |
| 5. Setor Thread | thread.sector_id inclui 'financeiro'/'cobranca'/'compras'/'fornecedor' | `blocked_sector` |
| 6. Bloqueio Manual | contact.bloqueado === true | `contact_blocked` |
| 7. Opt-out | contact.whatsapp_optin === false | `opt_out` |

**Uso:**
- ✅ enviarCampanhaLote (broadcast): linha 148-152
- ✅ enviarCampanhaLote (promocao): linha 148-152
- ❌ processarFilaPromocoes: **NÃO VALIDA** (assume validado no agendamento)

---

### Filtros de Elegibilidade (filterEligiblePromotions)

**Arquivo:** `functions/lib/promotionEngine.js` (linhas 102-141)

| Filtro | Condição | Bloqueia Se |
|--------|----------|-------------|
| target_contact_types | promo.target_contact_types !== [] | contact.tipo_contato NÃO está na lista |
| target_sectors | promo.target_sectors !== [] | thread.sector_id NÃO está na lista |
| target_tags | promo.target_tags !== [] | Nenhuma tag do contato match |
| limite_envios_por_contato | promo.limite_envios_por_contato > 0 | contact.promocoes_recebidas[promo.id] >= limite |

**Uso:**
- ❌ enviarCampanhaLote (broadcast): **NÃO USA** (não é promoção)
- ✅ enviarCampanhaLote (promocao): linha 315
- ✅ processarFilaPromocoes: **Indireto** (promo já selecionada no agendamento)

---

### Cooldowns e Frequência

**Arquivo:** `functions/lib/promotionEngine.js` (linhas 186-217)

| Tipo | Função | Regra | Usado Em |
|------|---------|-------|----------|
| **Universal 12h** | canSendUniversalPromo | last_any_promo_sent_at + 12h | enviarCampanhaLote (promocao) linha 238-253 |
| **Humano Ativo 8h** | isHumanActive | last_human_message_at + 8h | ❌ Não usado atualmente |

**Gap:**
- `canSendUniversalPromo` **não é chamado** em enviarCampanhaLote - validação manual inline
- `isHumanActive` **não é usado** em nenhum fluxo

---

### Rotação Inteligente (Anti-Repetição)

**Arquivo:** `functions/lib/promotionEngine.js` (linhas 147-180)

**Algoritmo:**
```javascript
1. Ler Contact.last_promo_ids (array últimas 3 promoções)
2. Filtrar promos que NÃO estão nas últimas 3
3. Se pool vazio, usar todas (permite reenvio após ciclo completo)
4. Randomizar entre promos de mesma prioridade
5. Atualizar: [nova_promo_id, ...2_últimas] (máx 3)
```

**Uso:**
- ✅ enviarCampanhaLote (promocao): `pickPromotion(eligible, contato)` linha 316
- ✅ processarFilaPromocoes: `writeLastPromoIds` linha 76-77

**Gap:**
- ⚠️ enviarCampanhaLote **não persiste** last_promo_ids após seleção (só atualiza na fila)

---

## 📝 PERSISTÊNCIA DE DADOS - ONDE GRAVA O QUÊ

### Entidade: **Message**

| Campo | broadcast | promocao (saudação) | processarFila (promo) |
|-------|-----------|---------------------|----------------------|
| thread_id | ⚠️ Gateway | ✅ thread.id | ✅ thread.id |
| sender_id | ⚠️ Gateway | ✅ 'sistema' | ✅ 'system' |
| sender_type | ⚠️ Gateway | ✅ 'user' | ✅ 'user' |
| recipient_id | ⚠️ Gateway | ✅ contact.id | ✅ contact.id |
| content | ⚠️ Gateway | ✅ mensagemSaudacao | ✅ formatPromotionMessage |
| status | ⚠️ Gateway | ✅ 'enviada' | ✅ 'enviada' |
| sent_at | ⚠️ Gateway | ✅ now | ✅ now |
| metadata.origem_campanha | ⚠️ N/A | ✅ 'lote_urgentes' | ❌ N/A |
| metadata.promotion_id | ⚠️ N/A | ❌ N/A | ✅ promo.id |
| metadata.trigger | ⚠️ N/A | ❌ N/A | ✅ trigger |
| metadata.message_type | ⚠️ N/A | ❌ N/A | ✅ 'promotion' |

---

### Entidade: **MessageThread**

| Campo | broadcast | promocao (saudação) | processarFila |
|-------|-----------|---------------------|---------------|
| last_message_at | ⚠️ Gateway | ✅ now (linha 308) | ⚠️ sendPromotion não atualiza |
| last_message_content | ⚠️ Gateway | ✅ mensagemSaudacao.slice(0,100) | ❌ N/A |
| last_message_sender | ⚠️ Gateway | ✅ 'user' | ❌ N/A |
| last_outbound_at | ⚠️ Gateway | ✅ now (linha 311) | ❌ N/A |

---

### Entidade: **Contact**

| Campo | broadcast | promocao (saudação) | processarFila |
|-------|-----------|---------------------|---------------|
| last_promo_inbound_at | ❌ | ❌ | ✅ now (linha 80) |
| last_promo_ids | ❌ | ❌ | ✅ writeLastPromoIds (linha 81) |
| last_any_promo_sent_at | ❌ | ❌ | ✅ now (via sendPromotion linha 309) |
| promocoes_recebidas | ❌ | ❌ | ❌ Não implementado |

---

### Entidade: **WorkQueueItem**

| Campo | broadcast | promocao | processarFila |
|-------|-----------|----------|---------------|
| **CREATE** | ❌ N/A | ✅ 1 por contato (linha 335-354) | ❌ Só lê |
| tipo | - | ✅ 'enviar_promocao' | - |
| status | - | ✅ 'agendado' | ✅ 'processado'/'cancelado'/'erro' |
| scheduled_for | - | ✅ now + delay_minutos | ✅ Atualizado para processed_at |
| payload | - | ✅ { promotion_id, integration_id, trigger } | ✅ Lido |
| metadata | - | ✅ { saudacao_enviada_em, saudacao_message_id, dias_inativo } | ✅ Atualizado com erro/cancelamento |

---

### Entidade: **AutomationLog**

| Campo | broadcast | promocao | processarFila |
|-------|-----------|----------|---------------|
| **Grava?** | ✅ SIM | ✅ SIM | ❌ **NÃO** |
| acao | `envio_massa_broadcast` | `envio_massa_promocao` | - |
| origem | 'manual' | 'manual' | - |
| usuario_id | user.id \|\| 'sistema' | user.id \|\| 'sistema' | - |
| resultado | 'sucesso' se enviados > 0 | 'sucesso' se enviados > 0 | - |
| detalhes | { modo, total_contatos, enviados, erros, mensagem_enviada, resultados } | { modo, total_contatos, enviados, erros, mensagem_enviada, resultados } | - |

---

## 🚨 GAPS CRÍTICOS IDENTIFICADOS

### 1️⃣ **Persistência Inconsistente no Modo Broadcast**

**Problema:**
- `enviarCampanhaLote` (broadcast) **não persiste Message explicitamente**
- **Depende 100% do gateway `enviarWhatsApp`** para gravar
- Se gateway falhar em persistir, mensagem é enviada mas **invisível na UI**

**Impacto:**
- ❌ Mensagens broadcast podem não aparecer no histórico
- ❌ thread.last_message_at não atualizado (conversa fica no fundo)
- ❌ Sem rastreabilidade de campanha na thread

**Solução:**
Adicionar persistência explícita no modo broadcast (igual ao modo promocao).

---

### 2️⃣ **Contact Não Atualizado no Agendamento**

**Problema:**
- `enviarCampanhaLote` (promocao) agenda promoção mas **não atualiza Contact**
- Campos críticos não persistidos:
  - `last_promo_inbound_at` (zero no momento da saudação)
  - `last_promo_ids` (não persiste escolha)
  - `last_any_promo_sent_at` (não persiste envio de saudação)

**Impacto:**
- ⚠️ Se rodar campanha 2x seguidas rapidamente, **ignora rotação** (last_promo_ids vazio)
- ⚠️ Cooldown 12h só valida no agendamento, mas **não persiste na saudação**
- ⚠️ Se WorkQueueItem falhar, **Contact fica desatualizado**

**Solução:**
Atualizar Contact após envio de saudação (linha 313, após atualizar thread).

---

### 3️⃣ **processarFilaPromocoes Sem Logs de Auditoria**

**Problema:**
- Worker **não grava AutomationLog**
- Sem registro de:
  - Quantas promoções foram processadas/canceladas/erro
  - Quais promoções foram enviadas
  - Performance do worker

**Impacto:**
- ❌ Impossível auditar execução do worker
- ❌ Dificulta debugging de promoções não enviadas
- ❌ Sem métricas de cancelamento por resposta

**Solução:**
Adicionar AutomationLog no final do processamento.

---

### 4️⃣ **Thread Não Atualizada no Worker**

**Problema:**
- `sendPromotion` **não atualiza MessageThread.last_message_at**
- Apenas grava Message, mas thread fica com timestamp antigo

**Impacto:**
- ⚠️ Conversa não sobe para o topo após promoção
- ⚠️ UI mostra "última mensagem" antiga
- ⚠️ Inconsistência: saudação atualiza thread, promoção não

**Solução:**
Adicionar atualização de thread em `sendPromotion` (promotionEngine linha 312).

---

### 5️⃣ **Cancelamento por Resposta Só na Fila**

**Problema:**
- Cancelamento inteligente **só acontece em processarFilaPromocoes**
- Se usar fluxo direto (sem fila), **não cancela** se cliente responder

**Impacto:**
- ✅ Modo promocao: OK (usa fila)
- ❌ Modo broadcast: N/A (não tem conceito de cancelamento)
- ⚠️ Se criar fluxo promocao direto (sem fila), **perde cancelamento**

**Solução:**
Manter arquitetura atual (sempre usar fila para promoções).

---

## 📊 MATRIZ DE DECISÃO - QUAL FUNÇÃO USAR?

| Cenário | Função | Modo | Motivo |
|---------|--------|------|--------|
| Enviar mensagem personalizada para 50 clientes | `enviarCampanhaLote` | `broadcast` | Mensagem única, sem delay |
| Enviar promoção urgente para 30 leads inativos | `enviarCampanhaLote` | `promocao` | Saudação + promo agendada |
| Processar promoções agendadas | `processarFilaPromocoes` | - | Worker automático (5 min) |
| Enviar 1 mensagem única | `enviarMensagemUnificada` | - | Não usar lote para 1 contato |
| Enviar promoção para 1 contato | `runPromotionInboundTick` | - | Gatilho inbound individual |

---

## 🔄 ARQUITETURA UNIFICADA - DIAGRAMA DE FLUXO

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE ENTRADA                        │
│                                                             │
│  [UI: Botão "Envio Massa"]  [UI: Botão "Auto Promoções"]  │
│            ↓                           ↓                    │
│   enviarCampanhaLote          enviarCampanhaLote          │
│     (modo: broadcast)           (modo: promocao)          │
└─────────────────────────────────────────────────────────────┘
                     ↓                           ↓
┌─────────────────────────────────────────────────────────────┐
│               CAMADA DE VALIDAÇÃO COMUM                     │
│                                                             │
│  1. Buscar Contact + MessageThread (canônica) + Integration│
│  2. Criar thread se ausente (P1)                           │
│  3. Validar telefone (P0)                                  │
│  4. Validar bloqueios (isBlocked) (P0)                     │
└─────────────────────────────────────────────────────────────┘
                     ↓                           ↓
┌──────────────────────────┐    ┌────────────────────────────┐
│   MODO BROADCAST         │    │   MODO PROMOCAO            │
│                          │    │                            │
│ 1. Personalizar mensagem │    │ 1. Validar dedupe fila     │
│ 2. Enviar via gateway    │    │ 2. Validar cooldown 12h    │
│ 3. ⚠️ Gateway persiste   │    │ 3. Validar dedupe saudação │
│ 4. Delay 500ms           │    │ 4. Gerar saudação template │
│                          │    │ 5. Enviar saudação         │
│                          │    │ 6. ✅ Persistir Message    │
│                          │    │ 7. ✅ Atualizar Thread     │
│                          │    │ 8. Filtrar promos elegíveis│
│                          │    │ 9. Rotação inteligente     │
│                          │    │ 10. Agendar WorkQueueItem  │
│                          │    │ 11. Delay 800ms            │
└──────────────────────────┘    └────────────────────────────┘
                     ↓                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   CAMADA DE LOG UNIFICADA                   │
│                                                             │
│  AutomationLog: { acao, origem, usuario_id, detalhes }     │
│  - enviados, erros, resultados, timestamp                  │
└─────────────────────────────────────────────────────────────┘
                                                  ↓
                          ┌────────────────────────────────────┐
                          │    WORKER ASSÍNCRONO (5 min)       │
                          │                                    │
                          │  processarFilaPromocoes            │
                          │  1. Buscar items agendados (50)    │
                          │  2. ✅ Cancelar se respondeu       │
                          │  3. Enviar via sendPromotion       │
                          │  4. ✅ Persistir Message           │
                          │  5. ✅ Atualizar Contact (todos)   │
                          │  6. Marcar item processado         │
                          │  7. ❌ Não grava AutomationLog     │
                          └────────────────────────────────────┘
```

---

## 🛠️ DEPENDÊNCIAS E REUTILIZAÇÃO

### Gateway Unificado: `enviarWhatsApp`

**Arquivo:** `functions/enviarWhatsApp.js`

**Responsabilidades:**
- Detectar provider (Z-API/W-API)
- Validar mídia e tipos suportados
- Enviar mensagem
- **❓ Persistir Message** (não confirmado - precisa validar)
- **❓ Atualizar thread.last_message_at** (não confirmado)

**Usadores:**
- enviarCampanhaLote (broadcast) - linha 181
- enviarCampanhaLote (promocao) - linha 275
- enviarMensagemUnificada (1:1)
- Outros fluxos do sistema

**Gap Crítico:**
- ⚠️ **Não está claro se `enviarWhatsApp` persiste dados automaticamente**
- Se não persistir, modo broadcast **perde mensagens**

---

### Motor de Promoções: `promotionEngine.js`

**Funções Exportadas:**

| Função | Uso | Responsabilidade |
|--------|-----|------------------|
| `isBlocked` | enviarCampanhaLote | Validar bloqueios absolutos |
| `getActivePromotions` | enviarCampanhaLote (promocao) | Buscar promos válidas |
| `filterEligiblePromotions` | enviarCampanhaLote (promocao) | Filtrar por tipo/setor/tags/limites |
| `pickPromotion` | enviarCampanhaLote (promocao) | Rotação inteligente (3 últimas) |
| `sendPromotion` | processarFilaPromocoes | Enviar + persistir Message |
| `readLastPromoIds` | processarFilaPromocoes | Ler histórico de rotação |
| `writeLastPromoIds` | processarFilaPromocoes | Atualizar histórico de rotação |
| `canSendUniversalPromo` | ❌ Não usado | Cooldown 12h (validação manual inline) |
| `isHumanActive` | ❌ Não usado | Detectar atendente ativo |

---

## 📈 CONTADORES E MÉTRICAS

### O Que É Incrementado e Onde

| Contador | Local | Função | Linha |
|----------|-------|--------|-------|
| **Promotion.contador_envios** | ❌ Não implementado | - | - |
| **Contact.promocoes_recebidas[promo_id]** | ❌ Não implementado | - | - |
| **Contact.last_promo_ids** | processarFilaPromocoes | writeLastPromoIds | 81 |
| **Contact.last_promo_inbound_at** | processarFilaPromocoes | manual | 80 |
| **Contact.last_any_promo_sent_at** | processarFilaPromocoes | sendPromotion | 309 |
| **AutomationLog.detalhes.enviados** | enviarCampanhaLote | manual | 403 |
| **WorkQueueItem.status** | processarFilaPromocoes | manual | 85/54/100 |

---

## ⚠️ GAPS ARQUITETURAIS CRÍTICOS

### 🔴 P0: Persistência Duplicada/Faltante

**Broadcast:**
- ❌ Não persiste Message explicitamente
- ❌ Não atualiza thread.last_message_at
- **Risco:** Mensagens enviadas mas invisíveis

**Solução Imediata:**
Adicionar persistência explícita no modo broadcast (copiar linhas 288-312 do modo promocao).

---

### 🟠 P1: Contact Desatualizado no Agendamento

**Promocao:**
- ✅ Persiste saudação (Message + Thread)
- ❌ **Não atualiza Contact** após saudação
- ❌ Rotação inteligente escolhe promo mas **não persiste escolha**

**Impacto:**
- Se executar 2x seguidas, pode escolher mesma promo
- Cooldown validado mas não registrado na saudação

**Solução:**
Atualizar Contact após envio de saudação (adicionar na linha 313):

```javascript
await base44.asServiceRole.entities.Contact.update(contato.id, {
  last_any_promo_sent_at: now.toISOString(),
  last_promo_ids: writeLastPromoIds(readLastPromoIds(contato), promoSelecionada.id)
});
```

---

### 🟡 P2: Worker Sem Auditoria

**processarFilaPromocoes:**
- ❌ Não grava AutomationLog
- ❌ Dificulta debugging ("promoção sumiu")
- ❌ Sem métricas de cancelamento

**Solução:**
Adicionar AutomationLog no final (após linha 110):

```javascript
await base44.asServiceRole.entities.AutomationLog.create({
  acao: 'processar_fila_promocoes',
  origem: 'automatizado',
  prioridade: 'normal',
  usuario_id: 'sistema',
  timestamp: now.toISOString(),
  resultado: processados > 0 ? 'sucesso' : 'nenhum_item',
  detalhes: { processados, erros, items_processados: items.length }
});
```

---

### 🟡 P3: Thread Não Sobe ao Topo na Fila

**processarFilaPromocoes:**
- ✅ Grava Message via sendPromotion
- ❌ **Não atualiza thread.last_message_at**
- Conversa não sobe para o topo após promoção

**Solução:**
Adicionar em `sendPromotion` (após linha 304):

```javascript
await base44.asServiceRole.entities.MessageThread.update(thread.id, {
  last_message_at: now.toISOString(),
  last_message_content: msg.slice(0, 100),
  last_message_sender: 'user',
  last_outbound_at: now.toISOString()
});
```

---

## ✅ RECOMENDAÇÕES PRIORIZADAS

### 🔥 DEVE CORRIGIR HOJE

1. **Persistência broadcast** - Adicionar Message + Thread no modo broadcast
2. **Atualizar Contact após saudação** - Persistir rotação e cooldown
3. **Logs do worker** - AutomationLog em processarFilaPromocoes

### ⚠️ DEVE CORRIGIR ESTA SEMANA

4. **Thread no worker** - Atualizar last_message_at em sendPromotion
5. **Contadores de promoção** - Implementar Promotion.contador_envios
6. **Histórico por contato** - Implementar Contact.promocoes_recebidas[promo_id]

### 💡 MELHORIAS FUTURAS

7. Usar `canSendUniversalPromo` em vez de validação inline
8. Usar `isHumanActive` para evitar interromper atendimento
9. Adicionar retry em caso de falha temporária de API
10. Implementar circuit breaker para rate limits

---

## 📌 CONTRATOS ATUAIS

### `enviarCampanhaLote`

**Input:**
```typescript
{
  contact_ids: string[];
  modo: 'broadcast' | 'promocao';
  mensagem?: string;           // obrigatório se modo=broadcast
  personalizar?: boolean;      // default: true
  delay_minutos?: number;      // default: 5 (apenas modo=promocao)
}
```

**Output:**
```typescript
{
  success: boolean;
  modo: string;
  enviados: number;
  erros: number;
  resultados: Array<{
    contact_id: string;
    nome: string;
    status: 'enviado' | 'sucesso' | 'parcial' | 'aviso' | 'bloqueado' | 'erro';
    motivo?: string;
    mensagem?: string;
    saudacao?: string;
    promocao_agendada?: string | false;
    horario_promocao?: string;
  }>;
  timestamp: string;
}
```

---

### `processarFilaPromocoes`

**Input:**
```typescript
{} // Sem parâmetros (automação)
```

**Output:**
```typescript
{
  success: boolean;
  processados: number;
  erros: number;
  timestamp: string;
}
```

---

### `promotionEngine.sendPromotion`

**Input:**
```typescript
{
  contact: Contact;
  thread: MessageThread;
  integration_id: string;
  promo: Promotion;
  trigger: string; // 'inbound_6h' | 'batch_36h' | 'manual_lote_urgentes'
}
```

**Output:**
```typescript
{
  message_id: string;
  text: string;
}
```

---

## 🧪 CENÁRIOS DE TESTE

### ✅ Caso 1: Broadcast Simples
```javascript
await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: ['id1', 'id2', 'id3'],
  modo: 'broadcast',
  mensagem: 'Olá {{nome}}! Temos novidades para {{empresa}}.'
});

// Esperado:
// - 3 mensagens personalizadas enviadas
// - ⚠️ Mensagens podem não aparecer na UI (depende do gateway)
// - ✅ AutomationLog gravado
```

### ✅ Caso 2: Promoção Automática
```javascript
await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: ['id1', 'id2'],
  modo: 'promocao',
  delay_minutos: 5
});

// Esperado:
// - 2 saudações enviadas AGORA
// - 2 Messages gravados (saudação)
// - 2 Threads atualizados (last_message_at)
// - ❌ Contact NÃO atualizado (GAP P1)
// - 2 WorkQueueItems agendados para +5min
// - ✅ AutomationLog gravado
// 
// Após 5-10min (worker):
// - 2 promoções enviadas (se não responderam)
// - 2 Messages gravados (promoção)
// - ⚠️ Threads NÃO atualizados (GAP P3)
// - ✅ Contact atualizado (last_any_promo_sent_at, last_promo_ids)
// - ❌ AutomationLog NÃO gravado (GAP P2)
```

### ⚠️ Caso 3: Resposta Rápida (Cancelamento)
```javascript
// 1. Enviar promocao para 1 contato
await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: ['id_rapido'],
  modo: 'promocao',
  delay_minutos: 5
});

// 2. Cliente responde em 2 minutos
// (atualiza thread.last_inbound_at)

// 3. Worker roda em 5 min
// Esperado:
// - ✅ Detecta resposta (linha 52)
// - ✅ Cancela WorkQueueItem (status: 'cancelado')
// - ✅ metadata.cancelado_motivo: 'cliente_respondeu'
// - ❌ NÃO envia promoção
```

---

## 🎯 CONCLUSÃO

### ✅ Pontos Fortes

1. ✅ **Arquitetura unificada** - 1 função, 2 modos
2. ✅ **Validações robustas** - isBlocked em 7 dimensões
3. ✅ **Rotação inteligente** - Evita repetir últimas 3 promos
4. ✅ **Cancelamento inteligente** - Não envia se cliente respondeu
5. ✅ **Cooldown 12h** - Evita spam
6. ✅ **Templates sem LLM** - Saudações rápidas e baratas
7. ✅ **Logs de auditoria** - AutomationLog nas funções manuais

### 🚨 Gaps Críticos (P0-P1)

1. ❌ **Broadcast não persiste Message/Thread** (depende do gateway)
2. ❌ **Promocao não atualiza Contact** após saudação (rotação não persiste)
3. ❌ **Worker não grava AutomationLog** (sem auditoria)
4. ❌ **Worker não atualiza thread.last_message_at** (conversa não sobe)
5. ❌ **Contadores de promoção não implementados** (Promotion.contador_envios, Contact.promocoes_recebidas)

### 🎯 Próximos Passos

**Corrigir hoje:**
1. Adicionar persistência explícita no modo broadcast
2. Atualizar Contact após envio de saudação (promocao)
3. Adicionar AutomationLog no worker

**Corrigir esta semana:**
4. Atualizar thread em sendPromotion
5. Implementar contadores completos

---

**Fim da Análise**