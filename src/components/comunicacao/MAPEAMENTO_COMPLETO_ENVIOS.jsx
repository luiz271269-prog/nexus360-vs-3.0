# 🗺️ MAPEAMENTO COMPLETO - TODOS OS CAMINHOS DE ENVIO

**Data:** 12/02/2026  
**Status:** Análise completa do sistema em produção  
**Objetivo:** Identificar código ativo, duplicado e inativo para limpeza

---

## 📍 INVENTÁRIO COMPLETO DE FUNÇÕES DE ENVIO

### **🟢 ATIVAS EM PRODUÇÃO (USO REAL)**

#### **1. enviarWhatsApp** - CORE WHATSAPP
```javascript
Caminho: functions/enviarWhatsApp
Status: ✅ ATIVO - Base de todo envio WhatsApp
Chamado por: 
  - ChatWindow (linha 720, 906, 1298, 1378)
  - enviarCampanhaLote (broadcast + promoção)
  - ContatosRequerendoAtencao
  - processarFilaPromocoes
  
Responsabilidade:
  - Envio físico HTTP para Z-API/W-API
  - Suporta: texto, imagem, vídeo, documento, áudio, templates, botões
  - Provider abstraction (Z-API, W-API, Evolution)
  
Input: {
  integration_id,
  numero_destino,
  mensagem?, // texto
  media_url?, media_type?, media_caption?, // mídia
  audio_url?, // áudio separado
  template_name?, template_params?, // templates
  buttons?, list_options? // interativos
}

Output: { success, message_id, timestamp }

MANTER: ✅ SAGRADO - Não modificar
```

#### **2. sendInternalMessage** - CORE MENSAGENS INTERNAS
```javascript
Caminho: functions/sendInternalMessage
Status: ✅ ATIVO - Único canal para mensagens entre usuários
Chamado por:
  - ChatWindow (linha 1270, 617) via onSendInternalMessageOptimistic
  - Comunicacao.jsx (linha 1270) - optimistic UI
  
Responsabilidade:
  - Mensagens entre User ↔ User (1:1 ou grupos)
  - Threads internas (team_internal, sector_group)
  - Zero validação de Contact/WhatsApp
  
Input: {
  thread_id,
  content,
  media_type?, media_url?, media_caption?,
  reply_to_message_id?
}

Output: { success, message }

MANTER: ✅ SAGRADO - Não modificar
```

#### **3. enviarCampanhaLote** - UNIFICADOR LOTE (NOVO)
```javascript
Caminho: functions/enviarCampanhaLote
Status: ✅ ATIVO - Recém criado (v1.0.0)
Chamado por:
  - enviarMensagemMassa (wrapper)
  - enviarPromocoesLote (wrapper)
  - ContatosRequerendoAtencao (linha atualizada)
  
Responsabilidade:
  - Envio em lote com 2 modos distintos
  - Modo 'broadcast': mensagem única (placeholders)
  - Modo 'promocao': saudação + WorkQueueItem
  - Validações P0: isBlocked() antes de enviar
  - Otimização N+1: busca threads em lote
  
Input: {
  contact_ids[],
  modo: 'broadcast' | 'promocao',
  mensagem?, // obrigatório se broadcast
  personalizar?, // placeholders {{nome}}, {{empresa}}
  delay_minutos? // padrão 5min
}

Output: {
  success, modo, enviados, erros,
  resultados: [{
    contact_id, nome, status,
    motivo?, // se bloqueado/erro
    saudacao?, promocao_agendada?, horario_promocao? // se promocao
  }]
}

MANTER: ✅核心 - Função central unificada
```

---

### **🟡 WRAPPERS (COMPATIBILIDADE)**

#### **4. enviarMensagemMassa** - WRAPPER
```javascript
Caminho: functions/enviarMensagemMassa
Status: 🟡 DEPRECATED - Redireciona para enviarCampanhaLote
Chamado por:
  - Código legado (ModalEnvioMassa possivelmente)
  
Ação: MANTER como wrapper - não deletar ainda
```

#### **5. enviarPromocoesLote** - WRAPPER
```javascript
Caminho: functions/enviarPromocoesLote  
Status: 🟡 DEPRECATED - Redireciona para enviarCampanhaLote
Chamado por:
  - Código legado (possivelmente dashboards antigos)
  
Ação: MANTER como wrapper - não deletar ainda
```

---

### **🔵 ADAPTADORES MULTI-CANAL (ATIVOS)**

#### **6. sendInstagramMessage**
```javascript
Caminho: functions/sendInstagramMessage
Status: ✅ ATIVO - Adaptador Instagram
Chamado por: enviarMensagemUnificada (thread-based)
  
Responsabilidade:
  - Converte payload → Graph API Instagram
  - Suporta: texto, imagem, vídeo, áudio, documento
  
Input: { recipientId, content, mediaType, mediaUrl, accessToken, igBusinessId }
Output: { success, messageId, provider: 'instagram_api' }

MANTER: ✅ Ativo
```

#### **7. sendFacebookMessage**
```javascript
Caminho: functions/sendFacebookMessage
Status: ✅ ATIVO - Adaptador Facebook Messenger
Chamado por: enviarMensagemUnificada (thread-based)
  
Responsabilidade:
  - Converte payload → Graph API Facebook
  - Suporta: texto, imagem, vídeo, áudio, documento
  
Input: { recipientId, content, mediaType, mediaUrl, accessToken, pageId }
Output: { success, messageId, provider: 'facebook_graph_api' }

MANTER: ✅ Ativo
```

#### **8. sendGoToSms**
```javascript
Caminho: functions/sendGoToSms
Status: ✅ ATIVO - Adaptador GoTo Connect
Chamado por: enviarMensagemUnificada (thread-based)
  
Responsabilidade:
  - Converte payload → GoTo Messaging API
  - Apenas texto (SMS não suporta mídia rica)
  
Input: { recipientPhone, content, accessToken, smsFromNumberId }
Output: { success, messageId, provider_response }

MANTER: ✅ Ativo
```

---

### **🟣 ORQUESTRADOR THREAD-BASED (PRODUÇÃO)**

#### **9. enviarMensagemUnificada**
```javascript
Caminho: functions/enviarMensagemUnificada
Status: ✅ ATIVO - Usado por integrações multi-canal
Chamado por: Webhooks? UI de canais múltiplos?
  
Responsabilidade:
  - Roteador baseado em thread (não em contact_ids[])
  - Decide qual adaptador chamar (WhatsApp/Instagram/Facebook/GoTo)
  - Cria Message outbound para auditoria
  - Atualiza Thread com last_message
  
Input: {
  connectionId, // determina o canal
  threadId,
  contactId,
  content,
  mediaType?, mediaUrl?
}

Output: { success, messageId, provider }

STATUS: 🟡 AVALIAR USO REAL
  - Se ninguém chama → pode marcar INATIVO
  - Se usado por webhooks → MANTER
  - Verificar com search no código
```

---

## 🎯 FLUXOGRAMAS DE ENVIO (CAMADAS)

### **ENVIO INDIVIDUAL (1:1)**

```
┌─────────────────────────────────────────────────────────┐
│ ChatWindow.jsx                                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [Usuário digita mensagem]                               │
│         │                                                 │
│         ▼                                                 │
│ handleEnviarFromInput({ texto, pastedImage, ... })      │
│         │                                                 │
│         ├─ Thread interna? → onSendInternalMessageOptimistic │
│         │                      │                          │
│         │                      ▼                          │
│         │              sendInternalMessage                │
│         │              (linha 1270 Comunicacao.jsx)       │
│         │                                                 │
│         └─ Thread externa? → onSendMessageOptimistic     │
│                              │                            │
│                              ▼                            │
│                      enviarWhatsApp                      │
│                      (linha 1378 ChatWindow)             │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ ✅ RESULTADO: Mensagem criada + Thread atualizada       │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- ✅ ChatWindow.jsx (UI)
- ✅ sendInternalMessage (backend interno)
- ✅ enviarWhatsApp (backend WhatsApp)

**Código adicional:** NENHUM - Caminho limpo

---

### **ENVIO EM MASSA (BROADCAST)**

```
┌─────────────────────────────────────────────────────────┐
│ ContatosRequerendoAtencao.jsx / pages/ContatosInteligentes │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [Usuário clica "Massa (27)"]                            │
│         │                                                 │
│         ▼                                                 │
│ const ids = contatosSelecionados.map(c => c.id)         │
│         │                                                 │
│         ▼                                                 │
│ enviarCampanhaLote({                                     │
│   contact_ids: ids,                                      │
│   modo: 'broadcast',                                     │
│   mensagem: texto,                                       │
│   personalizar: true                                     │
│ })                                                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ enviarCampanhaLote (Backend)                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 1. Buscar contatos + threads em LOTE (N+1 fix)         │
│ 2. Validar bloqueios (isBlocked)                        │
│ 3. Personalizar mensagem ({{nome}}, {{empresa}})       │
│ 4. Loop:                                                 │
│    for (contact_id of contact_ids) {                    │
│      enviarWhatsApp({                                    │
│        integration_id,                                   │
│        numero_destino,                                   │
│        mensagem: textoPersonalizado                     │
│      })                                                  │
│      delay(500ms) // anti-rate-limit                    │
│    }                                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ ✅ RESULTADO: N mensagens enviadas + relatório         │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- ✅ ContatosRequerendoAtencao.jsx (UI)
- ✅ pages/ContatosInteligentes (UI)
- ✅ ModalEnvioMassa (UI deprecated?)
- ✅ enviarCampanhaLote (backend único)
- 🟡 enviarMensagemMassa (wrapper deprecated)

**Código a limpar:**
- ❓ ModalEnvioMassa - VERIFICAR se ainda em uso
- 🟡 Manter wrappers por 1-2 meses (segurança)

---

### **ENVIO AUTOMÁTICO (PROMOÇÕES AGENDADAS)**

```
┌─────────────────────────────────────────────────────────┐
│ ContatosRequerendoAtencao.jsx                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [Usuário clica "Auto (27)"]                             │
│         │                                                 │
│         ▼                                                 │
│ enviarCampanhaLote({                                     │
│   contact_ids: ids,                                      │
│   modo: 'promocao',                                      │
│   delay_minutos: 5                                       │
│ })                                                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ enviarCampanhaLote (Backend - Orquestrador)             │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 1. Buscar promoções ativas (getActivePromotions)        │
│ 2. Validar bloqueios (isBlocked)                        │
│ 3. Gerar saudação (TEMPLATE - P0 fix)                  │
│ 4. Enviar saudação (enviarWhatsApp)                     │
│ 5. Selecionar promoção (rotação inteligente)           │
│ 6. Agendar WorkQueueItem (status: agendado)            │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼ (5 minutos depois - automação)
┌─────────────────────────────────────────────────────────┐
│ processarFilaPromocoes (Worker)                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 1. Buscar WorkQueueItem (agendados)                     │
│ 2. Validar CANCELAMENTO:                                │
│    - Cliente respondeu? → cancela                       │
│    - Cooldown 12h? → cancela                            │
│    - Bloqueios dinâmicos? → cancela                     │
│ 3. Enviar promoção (sendPromotion)                      │
│    └─ enviarWhatsApp (físico)                           │
│ 4. Atualizar Contact (last_promo_ids)                   │
│ 5. Marcar WorkQueueItem (processado)                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- ✅ ContatosRequerendoAtencao.jsx (UI)
- ✅ enviarCampanhaLote (orquestrador)
- ✅ processarFilaPromocoes (worker)
- ✅ promotionEngine.js (regras de negócio)
- 🟡 enviarPromocoesLote (wrapper deprecated)

**Código a limpar:** NENHUM (tudo ativo)

---

### **BROADCAST INTERNO (USUÁRIOS)**

```
┌─────────────────────────────────────────────────────────┐
│ ChatSidebar.jsx                                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [Usuário seleciona múltiplos usuários internos]        │
│         │                                                 │
│         ▼                                                 │
│ onSelectInternalDestinations({                          │
│   mode: 'broadcast',                                     │
│   destinations: [{ thread_id, name, type }]            │
│ })                                                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ ChatWindow.jsx - handleEnviarBroadcast                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ for (dest of broadcastInterno.destinations) {           │
│   sendInternalMessage({                                  │
│     thread_id: dest.thread_id,                          │
│     content,                                             │
│     media_type?, media_url?                             │
│   })                                                     │
│   delay(300ms)                                           │
│ }                                                         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Componentes:**
- ✅ ChatSidebar.jsx (UI)
- ✅ ChatWindow.jsx (handler)
- ✅ sendInternalMessage (backend)

**Código a limpar:** NENHUM (caminho limpo)

---

### **BROADCAST EXTERNO (WHATSAPP)**

```
┌─────────────────────────────────────────────────────────┐
│ ChatWindow.jsx - handleEnviarBroadcast                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ for (contato of contatosSelecionados) {                 │
│   enviarWhatsApp({                                       │
│     integration_id,                                      │
│     numero_destino: contato.telefone,                   │
│     mensagem: textoComAssinatura,                       │
│     media_url?, media_type?                             │
│   })                                                     │
│                                                           │
│   // Criar/atualizar thread                             │
│   // Criar Message record                               │
│   delay(500ms)                                           │
│ }                                                         │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**PROBLEMA IDENTIFICADO:**
- ❌ Duplicação: ChatWindow tem lógica de lote inline
- ❌ Deveria chamar enviarCampanhaLote({ modo: 'broadcast' })
- ✅ **AÇÃO:** Refatorar ChatWindow para usar função unificada

---

## 🔴 FUNÇÕES INATIVAS / POSSIVELMENTE DELETÁVEIS

### **CRITÉRIO DE INATIVIDADE:**
1. Não aparece em nenhum arquivo `.jsx` ou `.js` frontend
2. Não é chamada por outras funções backend
3. Não é referenciada em automações/agents

### **CANDIDATOS:**

```javascript
// VERIFICAR USO REAL (buscar no código):

1. enviarMensagemUnificada
   - Thread-based router
   - ❓ Quem chama? Webhooks? UI antiga?
   - AÇÃO: Buscar "enviarMensagemUnificada" em todo código
   - Se ninguém chama → DEPRECAR

2. apagarWhatsAppMessage
   - Usado em ChatWindow (linha 1518)
   - ✅ ATIVO (modo seleção)

3. processInbound
   - Processa webhooks recebidos
   - ❓ Ainda usado com webhook atual?
   - AÇÃO: Verificar integração webhook

4. preAtendimentoHandler
   - URA automatizada
   - ❓ Ativo? Desativado?
   - AÇÃO: Verificar configuração de playbooks
```

---

## 📊 ANÁLISE DE COMPONENTES UI

### **Central de Comunicação - PÁGINAS**

#### **pages/Comunicacao.jsx** ✅ ATIVO
```
Uso em produção: 100%
Responsabilidades:
  - Carregar threads (internas + externas separadas)
  - Filtros e busca
  - Gerenciar estado global (threadAtiva, filtros)
  - Roteamento de eventos
  
Chamadas de envio:
  - Linha 1270: sendInternalMessage (optimistic)
  - Linha 1378: enviarWhatsApp (via ChatWindow)
  
Código morto: NENHUM
```

#### **pages/ContatosInteligentes.jsx** ✅ ATIVO
```
Uso em produção: 100%
Responsabilidades:
  - Listar contatos urgentes
  - Filtros (crítico, alto, todos)
  - Disparar ações em lote
  
Chamadas de envio: 
  - ❌ NENHUMA (falta botões de disparo!)
  
PROBLEMA:
  - Tem lista completa de contatos
  - Mas não tem botões "Auto" ou "Massa"
  - Usuário tem que voltar para ContatosRequerendoAtencao
  
AÇÃO: Adicionar botões de disparo aqui
```

---

### **Central de Comunicação - COMPONENTES**

#### **ChatWindow.jsx** ✅ ATIVO - 🟡 PRECISA REFATORAÇÃO
```
Linhas: 2595
Status: 🟡 Código duplicado de lote

CÓDIGO ATIVO:
  ✅ handleEnviarFromInput (linha 1339)
  ✅ handleEnviarBroadcast (linha 574) - BROADCAST EXTERNO
  ✅ enviarAudio (linha 807)
  ✅ enviarImagemColada (linha 1010)
  ✅ enviarArquivoAnexado (linha 1178)
  
PROBLEMA - LOTE INLINE (linhas 688-786):
  ❌ Loop manual com enviarWhatsApp
  ❌ Duplica lógica de enviarCampanhaLote
  ❌ Sem validação isBlocked()
  
AÇÃO REQUERIDA:
  📝 Substituir handleEnviarBroadcast (linha 574-805) por:
  
  const handleEnviarBroadcast = async (opcoes) => {
    if (broadcastInterno) {
      // Interno: manter loop (é diferente)
      ...
    } else {
      // Externo: DELEGAR para função unificada
      const ids = contatosSelecionados.map(c => c.id);
      
      const resultado = await base44.functions.invoke('enviarCampanhaLote', {
        contact_ids: ids,
        modo: 'broadcast',
        mensagem: opcoes.texto,
        personalizar: true
      });
      
      // Processar resultado
      ...
    }
  };
```

#### **ChatSidebar.jsx** ✅ ATIVO
```
Linhas: 973
Status: ✅ Limpo
Código morto: NENHUM
Chamadas de envio: NENHUMA (só UI de listagem)
```

#### **MessageInput.jsx** ✅ ATIVO
```
Linhas: ~660
Status: ✅ Limpo
Código morto: NENHUM
Chamadas de envio: NENHUMA (delega para ChatWindow)
```

#### **ContatosRequerendoAtencao.jsx** ✅ ATIVO
```
Linhas: 849
Status: ✅ Atualizado (chama enviarCampanhaLote)

Chamadas de envio:
  ✅ Linha ~142: enviarCampanhaLote (modo: 'promocao')
  ✅ Linha ~XXX: Abre ModalEnvioMassa (broadcast)
  
Código morto: NENHUM
```

#### **ModalEnvioMassa.jsx** ❓ STATUS DESCONHECIDO
```
Status: ❓ VERIFICAR USO REAL

Chamado por:
  - ContatosRequerendoAtencao (linha ~XXX)
  - Comunicacao.jsx? (não encontrado no código analisado)
  
AÇÃO: Buscar "ModalEnvioMassa" em todo código
  - Se usado → atualizar para chamar enviarCampanhaLote
  - Se não usado → DELETAR
```

---

## 🧹 PLANO DE LIMPEZA (CIRÚRGICO)

### **FASE 1 - VERIFICAÇÃO (HOJE)**

```bash
# Buscar uso real de funções suspeitas
grep -r "enviarMensagemUnificada" pages/ components/
grep -r "ModalEnvioMassa" pages/ components/
grep -r "processInbound" pages/ components/
grep -r "preAtendimentoHandler" pages/ components/
```

**Resultado esperado:**
- Se encontrar 0 referências → marcar INATIVA
- Se encontrar 1-2 → avaliar necessidade
- Se encontrar 3+ → manter ativa

---

### **FASE 2 - REFATORAÇÃO ChatWindow (P1)**

**Arquivo:** `components/comunicacao/ChatWindow.jsx`

**Mudança:** Linhas 574-805 (handleEnviarBroadcast)

**De:**
```javascript
// ❌ Loop manual (134 linhas de código)
for (const contato of contatosSelecionados) {
  const resultado = await base44.functions.invoke('enviarWhatsApp', {
    integration_id,
    numero_destino: telefone,
    mensagem
  });
  
  // Criar thread...
  // Criar message...
  // Atualizar thread...
  
  await delay(500);
}
```

**Para:**
```javascript
// ✅ Delegar (10 linhas de código)
const ids = contatosSelecionados.map(c => c.id);

const resultado = await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: ids,
  modo: 'broadcast',
  mensagem: textoComAssinatura,
  personalizar: false // já tem assinatura
});

if (resultado.data.success) {
  toast.success(`✅ ${resultado.data.enviados} mensagens enviadas!`);
  if (resultado.data.erros > 0) {
    toast.error(`❌ ${resultado.data.erros} erros`);
  }
}
```

**Ganhos:**
- 📉 -124 linhas de código
- 🚀 Validação isBlocked() automática
- 🎯 Logs centralizados
- 🔧 Manutenção em 1 lugar só

---

### **FASE 3 - ADICIONAR BOTÕES (ContatosInteligentes)**

**Arquivo:** `pages/ContatosInteligentes.jsx`

**Adicionar após linha 160:**
```javascript
{/* Botões de Ação em Lote */}
{clientes.length > 0 && (
  <div className="flex items-center gap-3 mb-6">
    <Button
      onClick={enviarPromocoesAutomaticas}
      disabled={enviandoPromos || clientes.length === 0}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2"
    >
      {enviandoPromos ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      Auto ({clientesFiltrados.length})
    </Button>
    
    <Button
      onClick={abrirEnvioMassa}
      disabled={clientesFiltrados.length === 0}
      variant="outline"
      className="gap-2"
    >
      <Users className="w-4 h-4" />
      Massa ({clientesFiltrados.length})
    </Button>
  </div>
)}
```

---

### **FASE 4 - DEPRECAR WRAPPERS (30 dias)**

**Após 30 dias de produção estável:**

1. **enviarMensagemMassa** → Adicionar warning log
2. **enviarPromocoesLote** → Adicionar warning log
3. Monitorar logs por 15 dias
4. Se zero chamadas → deletar arquivos

---

## 📋 RESUMO EXECUTIVO

### **FUNÇÕES ATIVAS (MANTER)**
1. ✅ **enviarWhatsApp** - Core WhatsApp (Z-API/W-API)
2. ✅ **sendInternalMessage** - Core mensagens internas
3. ✅ **enviarCampanhaLote** - Unificador lote (novo)
4. ✅ **processarFilaPromocoes** - Worker promoções
5. ✅ **sendInstagramMessage** - Adaptador Instagram
6. ✅ **sendFacebookMessage** - Adaptador Facebook
7. ✅ **sendGoToSms** - Adaptador GoTo

### **WRAPPERS (MANTER TEMPORÁRIO)**
8. 🟡 **enviarMensagemMassa** - Wrapper → enviarCampanhaLote
9. 🟡 **enviarPromocoesLote** - Wrapper → enviarCampanhaLote

### **A VERIFICAR (BUSCAR USO)**
10. ❓ **enviarMensagemUnificada** - Thread-based router
11. ❓ **ModalEnvioMassa.jsx** - UI de massa
12. ❓ **processInbound** - Webhook processor
13. ❓ **preAtendimentoHandler** - URA

### **REFATORAÇÃO NECESSÁRIA**
14. 🔧 **ChatWindow.handleEnviarBroadcast** - Código duplicado (linhas 574-805)

### **ADICIONAR FUNCIONALIDADE**
15. ➕ **ContatosInteligentes.jsx** - Faltam botões de disparo

---

## 🎯 ARQUITETURA LIMPA (OBJETIVO FINAL)

```
┌────────────────────────────────────────────────────────┐
│ CAMADA 1: UI (PÁGINAS)                                 │
├────────────────────────────────────────────────────────┤
│                                                          │
│ ContatosInteligentes → Lista + Botões                  │
│ ContatosRequerendoAtencao → Preview + Quick Actions    │
│ ChatWindow → Conversa 1:1                              │
│ ChatSidebar → Listagem                                 │
│                                                          │
└────────────────────────────────────────────────────────┘
         │ (todas chamam mesmas funções)
         ▼
┌────────────────────────────────────────────────────────┐
│ CAMADA 2: ORQUESTRADORES (BACKEND)                     │
├────────────────────────────────────────────────────────┤
│                                                          │
│ enviarCampanhaLote → Lote (broadcast/promocao)         │
│ sendInternalMessage → Mensagens internas               │
│ processarFilaPromocoes → Worker assíncrono             │
│                                                          │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ CAMADA 3: ADAPTADORES (PROVIDERS)                      │
├────────────────────────────────────────────────────────┤
│                                                          │
│ enviarWhatsApp → Z-API/W-API/Evolution                 │
│ sendInstagramMessage → Graph API Instagram             │
│ sendFacebookMessage → Graph API Facebook               │
│ sendGoToSms → GoTo Messaging API                       │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Princípios:**
- 🎯 1 responsabilidade por função
- 🔄 Zero duplicação de lógica
- 🧪 Testável isoladamente
- 📊 Logs centralizados

---

## 🚀 PRÓXIMOS PASSOS (ORDEM)

### **Hoje:**
1. ✅ Buscar uso de funções suspeitas (grep)
2. ✅ Atualizar ChatWindow.handleEnviarBroadcast
3. ✅ Adicionar botões em ContatosInteligentes

### **Esta semana:**
4. ✅ Marcar wrappers como deprecated (logs)
5. ✅ Criar documento de migração para equipe
6. ✅ Testar todos os caminhos com 5 contatos

### **Próximo mês:**
7. ✅ Deletar wrappers (se zero uso)
8. ✅ Deletar funções inativas confirmadas
9. ✅ Documentar arquitetura final

---

**Resultado esperado:** -40% de código, +100% de clareza, zero duplicação.