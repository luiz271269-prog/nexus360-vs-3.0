# 🔍 ANÁLISE: Contato SCHULZ - Jair Nunes (+55473610156)

## 1. RESUMO DO CASO

| Campo | Valor |
|-------|-------|
| **Contato** | Jair Nunes |
| **Empresa** | SCHULZ |
| **Telefone** | +55473610156 |
| **Cliente** | Ricardo |
| **Thread Atribuída** | A - Vendas (+55 483045-2076) |
| **Status** | 3 mensagens não lidas |
| **Data Primeira Msg** | 16/03 09:00 |
| **Última Msg** | 16/03 09:01 |

---

## 2. PROBLEMA IDENTIFICADO: Mensagens Faltando

### 2.1 O que vemos na tela:

```
✅ VISÍVEIS (4 mensagens):
├─ Jair: "Tudo bem?" (09:00)
├─ Jair: "Bom dia Tiago" (09:01)
├─ Jair: "Pode atualizar por favor a cotação do drone?" (09:01)
└─ Tiago: [Resposta com proposta de Notebook - IA integrada]

❌ FALTANDO:
├─ Histórico anterior a 16/03 09:00 (nenhuma visível)
├─ Possível conversa anterior sobre "drone" (mencionado mas sem contexto)
└─ "3 mensagens não lidas" = há mais mensagens que não estão renderizadas
```

### 2.2 ROOT CAUSES POSSÍVEIS:

#### A) **Problema de Visibilidade (Base44 ThreadContext)**
```
Possível causa: MessageThread tem visibilidade restrita
└─ Campo: visibility = "internal_only" OU
└─ Campo: shared_permissions não inclui Ricardo OU
└─ Campo: message_ids foi filtrado por automação

Evidência: Status mostra "3 mensagens não lidas"
mas só 4 aparecem na tela = faltam ~3+ mensagens
```

#### B) **Problema de Sincronização (Z-API/WAPI)**
```
Possível causa: Webhook não sincronizou todas as mensagens
└─ Se integração está conectada a +55 483045-2076 (não +55473610156)
└─ Mensagens podem estar em thread diferente (duplicação ou orfandade)

Evidência: Rodapé mostra "Enviar por: A - Vendas (+55 483045-2076)"
Isso é NÚMERO DIFERENTE do contato (+55473610156)
```

#### C) **Problema de Filtro de Tarefas**
```
Possível causa: runPromotionBatchTick ou inboundCore removeu msgs
└─ Se mensagens sobre "drone" foram categorizadas como SPAM/BLOQUEADO
└─ OU se thread foi movida para "merged" status

Evidência: Tarefa criada é sobre "Notebook" mas mensagem original é sobre "drone"
= pode haver conflito de intent/categoria
```

---

## 3. ANÁLISE: Atribuição ao Usuário Ricardo

### 3.1 Fluxo de Roteamento Real

```
ENTRADA: Mensagem WhatsApp de +55473610156
         "Pode atualizar por favor a cotação do drone?"

↓ processInbound (real-time)

DETECÇÃO:
├─ Contact.phone = +55473610156
├─ Contact.nome = "Jair Nunes"
└─ Contact.cliente_id = "Ricardo" (ou LinkedTo Ricardo)

↓ motorDecisaoPreAtendimento (automação 5min)

DECISÃO:
├─ Tipo contato: "cliente" (já tem cliente_id)
├─ Setor: detectado como "vendas" (palavra "cotação", "drone")
├─ Atendente: buscar vendedor_responsavel do cliente Ricardo
│  └─ Cliente.vendedor_responsavel = "Ricardo"? OU
│  └─ Contact.atendente_fidelizado_vendas = "Ricardo"?
└─ Roteamento: ATRIBUIR para Ricardo

↓ atribuirConversasNaoAtribuidas

RESULTADO: MessageThread.assigned_user_id = Ricardo
           MessageThread.setor_principal = "vendas"
```

### 3.2 Onde Ricardo vem?

```
CADEIA POSSÍVEL:
1. Cliente "Ricardo" foi criado com:
   ├─ Cliente.nome = "Ricardo"
   ├─ Cliente.tipo = "pessoa_fisica" OU "empresa"
   └─ Cliente.vendedor_responsavel = "Ricardo" ← DAQUI

2. Quando Jair Nunes contactou:
   ├─ Contact.cliente_id = (ID do cliente Ricardo)
   └─ Contact.vendedor_responsavel = "Ricardo" (herdado)

3. motorDecisao detectou:
   ├─ intent = "cotacao" (palavra "atualizar", "drone")
   └─ Fez match: Contact.vendedor_responsavel = Ricardo
   
4. atribuirConversasNaoAtribuidas:
   └─ Atribuiu para Ricardo automaticamente

CONFIRMAÇÃO NECESSÁRIA:
→ Ir em: Clientes → buscar "Ricardo" → Ver se é vendedor OU cliente
→ Se é VENDEDOR: Ricardo é o rep de vendas atribuído ao cliente
→ Se é CLIENTE: Algo está errado no data model
```

---

## 4. ANÁLISE: Por que só mostra estas 4 mensagens?

### 4.1 Timeline de Sincronização

```
16/03 09:00 - Jair envia: "Tudo bem?"
├─ processInbound roda
├─ message_id = Z-API hash
├─ Sincroniza em Message entity
└─ ✅ Aparece na tela

16/03 09:01 - Jair envia: "Bom dia Tiago"
├─ processInbound roda
├─ detecta mention "@Tiago" (vendedor)
└─ ✅ Aparece na tela

16/03 09:01 - Jair envia: "Pode atualizar cotação drone?"
├─ processInbound roda
├─ analisarIntencao detecta: tipo="cotacao"
├─ criaTarefa agendada
└─ ✅ Aparece na tela

09:01-09:05 - Tiago responde (message de usuario)
├─ sendUnifiedMessage funciona
├─ Aparece na tela
└─ ✅ Renderiza

MENSAGENS FALTANDO:
├─ Histórico anterior a 09:00: NUNCA foi sincronizado?
│  └─ Se conversa é nova: faz sentido (primeira msg)
│  └─ Se conversa existia: webhook pode ter perdido
│
├─ As "3 mensagens não lidas": podem ser
│  └─ Respostas futuras (não sincronizadas ainda) OU
│  └─ Mensagens de erro/sistema OU
│  └─ Draft mensagens não enviadas
```

### 4.2 Checklist de Sincronização

```
❓ PERGUNTAS PARA DIAGNOSTICAR:

1. HISTÓRIA ANTERIOR?
   - Esse contato (+55473610156) contactou ANTES de 16/03 09:00?
   - Se SIM: onde estão aquelas mensagens?
   - Se NÃO: comportamento está correto (mostra apenas de hoje)

2. INTEGRAÇÃO CORRETA?
   - Número do contato: +55473610156
   - Número no rodapé: +55 483045-2076 ← DIFERENTE!
   - Se números diferentes: messages estão em THREAD ERRADA

3. MESSAGE SYNC STATUS?
   - Base44 → MessageThread → filtro contact_id
   - Contar: SELECT COUNT(*) WHERE contact_id = "Jair Nunes"
   - Deve ter ≥ 4 registros (as 4 visíveis)

4. BLOCKLIST/FILTERING?
   - Message entity tem campo "categorias" com SPAM/BLOQUEADO?
   - Se SIM: algumas mensagens são ocultadas por filtro automático
```

---

## 5. HIPÓTESE: Problema é o NÚMERO DA INTEGRAÇÃO

### 5.1 Achado Crítico

```
TELA MOSTRA:
┌─────────────────────────────────────┐
│ Contato: +55473610156              │
│ Jair Nunes - SCHULZ                 │
│                                      │
│ [... mensagens ...]                 │
│                                      │
│ Enviar por: A - Vendas              │
│            (+55 483045-2076) ← 🔴   │
└─────────────────────────────────────┘

PROBLEMA: Os números NÃO BATEM!
- Número do contato: +55473610156
- Número da integração: +55483045-2076

IMPLICAÇÃO:
- Webhook de +55483045-2076 sincronizou msgs para thread ERRADA
- Ou: contato foi mergeado de duas threads diferentes
- Ou: atribuição de integração está manual (não automática)
```

### 5.2 Ação Recomendada

```
NO BASE44 EDITOR:

1. Ir em: MessageThread
   └─ Filtrar por contact_id = "Jair Nunes"
   └─ Verificar: whatsapp_integration_id
      └─ Se = "ID de +55483045-2076" → PROBLEMA CONFIRMADO

2. Ir em: Message
   └─ Filtrar por thread_id = "Jair Nunes"
   └─ Contar registros (deve ter ~6-7, vemos 4)
   └─ Ver se tem messages com status="hidden" ou categorias="spam"

3. Ir em: Contact
   └─ Buscar "Jair Nunes"
   └─ Ver: whatsapp_integration_id, telefone_canonico
   └─ Se múltiplas threads: pode estar duplicado
```

---

## 6. CHECKLIST DE DIAGNÓSTICO

- [ ] **Integração:** Confirmar qual número WhatsApp está respondendo (+55473610156 ou +55483045-2076)
- [ ] **Contact dedup:** Se tem 2 threads para Jair Nunes, confirmar merge
- [ ] **Message count:** Base44 → Message → contar por thread_id (deveria ser ≥6)
- [ ] **History:** Pergunta a Ricardo se tinha conversa anterior com Jair antes de 16/03 09:00
- [ ] **Categorias:** Se alguma message tem categoria="spam" ou visibility="internal_only"
- [ ] **Logs:** Verificar `processInbound` logs para esse contato (16/03 entre 09:00-09:05)
- [ ] **Webhook:** Confirmar qual integração recebeu as mensagens (Z-API ou WAPI)

---

## 7. PRÓXIMOS PASSOS

### 🔴 CRÍTICO (hoje):
1. Confirmar se número da integração (+55483045-2076) é correto ou se é BUG
2. Se diferente, investigar por que webhook sincronizou para numero errado
3. Se correto, é escolha de design (multi-instancia handling) - documentar

### ⚠️ IMPORTANTE:
1. Diagnosticar por que "3 mensagens não lidas" mas só 4 visíveis
2. Verificar se há histórico anterior que foi perdido
3. Confirmar se Ricardo é vendedor ou cliente (data model)

### 📊 ANÁLISE:
1. Se problema for webhook: revisar `processInbound` para sincronização correta
2. Se problema for atribuição: revisar `motorDecisaoPreAtendimento` rules para Ricardo
3. Se problema for visibilidade: revisar filtros de Message rendering