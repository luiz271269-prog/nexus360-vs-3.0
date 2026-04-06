# 🔍 FLUXO COMPLETO: Como o Diagnóstico Funciona

## 1️⃣ QUANDO O BOTÃO ⚡ É CLICADO

```
Usuário clica em ⚡ (Diagnóstico)
         ↓
Invoca: base44.functions.invoke('diagnosticarContatoDuplicado', { contact_id })
         ↓
Função executa no backend
```

---

## 2️⃣ BUSCA NO BANCO - Sequência Exata

### A. BUSCAR CONTATO PRINCIPAL
```javascript
const contato = await base44.entities.Contact.get(contact_id);
// Exemplo: Adilson Vavassori (ID: ctr_xyz123)
```

**O QUE RETORNA:**
```json
{
  "id": "ctr_xyz123",
  "nome": "Adilson Vavassori",
  "telefone": "+554796744257",
  "empresa": "Pamplona",
  "cargo": "Gerente",
  "tipo_contato": "cliente",
  "cliente_score": 85,
  "is_cliente_fidelizado": true
}
```

---

### B. BUSCAR TODAS AS THREADS DESTE CONTATO
```javascript
const threads = await base44.entities.MessageThread.filter({
  contact_id: "ctr_xyz123"
}, '-last_message_at', 100);
```

**EXEMPLO DE RETORNO:**
```
Thread 1: thr_abc001
├─ canal: whatsapp
├─ total_mensagens: 45
├─ status: aberta
├─ assigned_user: usr_001
└─ last_message_at: 2026-01-28T14:30:00Z

Thread 2: thr_abc002
├─ canal: whatsapp
├─ total_mensagens: 12
├─ status: aberta
├─ assigned_user: usr_002
└─ last_message_at: 2026-01-28T10:15:00Z

Thread 3: thr_abc003
├─ canal: whatsapp
├─ total_mensagens: 8
├─ status: merged
├─ assigned_user: null
└─ last_message_at: 2026-01-27T16:45:00Z

✅ Total: 3 threads encontradas
```

---

### C. BUSCAR TODAS AS MENSAGENS DE CADA THREAD
```javascript
for (const thread of threads) {
  const mensagens = await base44.entities.Message.filter({
    thread_id: thread.id
  }, '-sent_at', 1000);
}
```

**EXEMPLO DE RETORNO (Thread 1: 45 mensagens):**
```
msg_1: 
├─ content: "Olá, preciso de um orçamento"
├─ sender_id: ctr_xyz123
├─ sender_type: contact
├─ sent_at: 2026-01-28T14:30:00Z
└─ status: lida

msg_2:
├─ content: "[Imagem]"
├─ sender_id: usr_001
├─ sender_type: user
├─ media_type: image
├─ sent_at: 2026-01-28T14:31:00Z
└─ status: enviada

msg_3:
├─ content: ""  ← ⚠️ PROBLEMA!
├─ sender_id: +554796744257@broadcast
├─ sender_type: contact
├─ media_type: none
├─ sent_at: 2026-01-27T10:00:00Z
└─ status: recebida

... mais 42 mensagens
```

**✅ Total: 65 mensagens encontradas**

---

### D. BUSCAR CONTATOS DUPLICADOS (MESMO TELEFONE)
```javascript
const contatosDuplicados = await base44.entities.Contact.filter({
  telefone: "+554796744257"
}, 'created_date', 100);
```

**EXEMPLO DE RETORNO:**
```
Duplicata 1: ctr_xyz456
├─ nome: "Adilson V."
├─ empresa: null
├─ cargo: null
├─ tipo_contato: lead
├─ cliente_score: 0
├─ is_cliente_fidelizado: false
└─ created_at: 2026-01-15T09:00:00Z

Duplicata 2: ctr_xyz789
├─ nome: "A. Vavassori"
├─ empresa: "Pamplona Eirelli"
├─ cargo: "Gerenciador"
├─ tipo_contato: novo
├─ cliente_score: 45
├─ is_cliente_fidelizado: false
└─ created_at: 2026-01-20T11:30:00Z

✅ Total: 2 duplicatas encontradas
```

---

## 3️⃣ ANÁLISE DOS DADOS

### Problemas Detectados:
```
1. DUPLICATA_CONTATO (CRÍTICO)
   └─ Encontrada: ctr_xyz456 ("Adilson V.")
   └─ Encontrada: ctr_xyz789 ("A. Vavassori")

2. MENSAGENS_VAZIAS (AVISO)
   └─ msg_3 em thr_abc001 (sem conteúdo, sem mídia)
   └─ msg_7 em thr_abc002 (sem conteúdo, sem mídia)
   └─ Total: 2 mensagens vazias

3. SENDER_ID_INCORRETO (SINCRONIZAÇÃO NECESSÁRIA)
   └─ msg_3 tem sender_id = "+554796744257@broadcast" em vez de "ctr_xyz123"
   └─ msg_10 tem sender_id = "ctr_xyz456" em vez de "ctr_xyz123"
   └─ Total: 3 mensagens com sender_id errado
```

---

## 4️⃣ CONSTRUÇÃO DAS AÇÕES

```javascript
diagnostico.acoes_necessarias = [
  {
    acao: "UNIFICAR_CONTATOS",
    descricao: "Unificar 2 contato(s) duplicado(s)",
    prioridade: "CRÍTICA",
    contatos_afetados: ["ctr_xyz456", "ctr_xyz789"]
  },
  {
    acao: "LIMPAR_MENSAGENS_VAZIAS",
    descricao: "Remover 2 mensagem(s) sem conteúdo",
    prioridade: "MÉDIA"
  },
  {
    acao: "SINCRONIZAR_MENSAGENS",
    descricao: "Sincronizar IDs em 3 mensagem(s)",
    prioridade: "ALTA",
    msg_sender_errado: 3,
    msg_recipient_errado: 0
  }
]
```

---

## 5️⃣ RESUMO FINAL EXIBIDO NA TELA

```
📋 DIAGNÓSTICO - Adilson Vavassori

Threads: 3
Mensagens: 65
Duplicatas: 2
Problemas: 3

⚠️ AÇÕES NECESSÁRIAS:
1. Unificar 2 contato(s) duplicado(s) (CRÍTICA)
2. Remover 2 mensagem(s) sem conteúdo (MÉDIA)
3. Sincronizar IDs em 3 mensagem(s) (ALTA)
```

---

## 6️⃣ PRÓXIMO PASSO: EXECUTAR SINCRONIZAÇÃO

Quando usuário clica em "Unificar Múltiplos":
```
sincronizarMensagensOrfas() executa TODAS as ações:
├─ UNIFICAR_CONTATOS
│  ├─ Merge ctr_xyz456 → ctr_xyz123
│  └─ Merge ctr_xyz789 → ctr_xyz123
├─ SINCRONIZAR_MENSAGENS
│  ├─ msg_3: +554796744257@broadcast → ctr_xyz123
│  ├─ msg_10: ctr_xyz456 → ctr_xyz123
│  └─ msg_15: ctr_xyz789 → ctr_xyz123
└─ LIMPAR_MENSAGENS_VAZIAS
   ├─ Delete msg_3
   └─ Delete msg_7
```

---

## 📊 FLUXO VISUAL COMPLETO

```
┌─────────────────────────────────────┐
│  USUÁRIO CLICA EM ⚡ DIAGNÓSTICO   │
└────────────────┬────────────────────┘
                 ↓
    ┌──────────────────────────┐
    │ BASE44 BUSCA NO BANCO:   │
    ├──────────────────────────┤
    │ 1. Contact (1)           │
    │ 2. MessageThread (3)     │
    │ 3. Message (65)          │
    │ 4. Contact duplicados(2) │
    └──────────────┬───────────┘
                   ↓
         ┌─────────────────────┐
         │  ANÁLISE E BUSCA    │
         │    DE PROBLEMAS     │
         ├─────────────────────┤
         │ • Duplicatas        │
         │ • Msgs vazias       │
         │ • IDs incorretos    │
         │ • Threads mergidas  │
         └──────────┬──────────┘
                    ↓
        ┌──────────────────────────┐
        │  MONTA AÇÕES NECESSÁRIAS │
        ├──────────────────────────┤
        │ 1. UNIFICAR_CONTATOS     │
        │ 2. LIMPAR_MENSAGENS      │
        │ 3. SINCRONIZAR_MENSAGENS │
        └──────────┬───────────────┘
                   ↓
     ┌──────────────────────────────┐
     │  EXIBE RESULTADO NA TELA     │
     │  (Toast com resumo)          │
     └──────────┬───────────────────┘
                ↓
     ┌──────────────────────────────┐
     │  USUÁRIO CLICA "UNIFICAR"    │
     │  sincronizarMensagensOrfas() │
     │  EXECUTA TODAS AS AÇÕES      │
     └──────────────────────────────┘
```

---

## 🎯 RESUMO

| Etapa | O QUE FAZ | DADOS |
|-------|-----------|-------|
| **Busca** | Pega contato + threads + msgs + duplicatas | BD |
| **Análise** | Identifica problemas | Em Memória |
| **Ações** | Monta lista de correções | Em Memória |
| **Exibição** | Mostra ao usuário | Toast |
| **Execução** | Aplica as correções | BD |