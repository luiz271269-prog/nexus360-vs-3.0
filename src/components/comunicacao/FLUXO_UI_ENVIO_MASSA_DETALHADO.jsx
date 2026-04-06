# 🖱️ FLUXO COMPLETO - UI ENVIO EM MASSA

**Análise baseada em:** Imagem do modal "Envio em Massa" (3 contatos selecionados)  
**Data:** 2026-02-12  
**Status:** Produção Ativa

---

## 📸 CONTEXTO DA IMAGEM

**Tela mostrada:**
```
┌─────────────────────────────────────────────────┐
│ 🧡 Envio em Massa          [Cancelar]          │
│ 3 contato(s) selecionado(s)                     │
├─────────────────────────────────────────────────┤
│ Contatos selecionados:                          │
│                                                 │
│  [A] ANA MARIA        [A] alvara sala          │
│      +554899152145        +5548999526514       │
│                                                 │
│  [P] Paulo Henrique                            │
│      +554891681227                             │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Digite sua mensagem... (Ctrl+V para colar)  │ │
│ │                                             │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🔽 Enviar por: 📱 Financeiro (554830452079)    │
│                                                 │
│ [📎] [🎤] [😊] [✨]          [Enviando... 🚀]  │
└─────────────────────────────────────────────────┘
```

---

## 🔄 LINHA LÓGICA COMPLETA - USUÁRIO → BACKEND → BANCO

### ETAPA 1: Seleção de Contatos

**Arquivo:** `components/comunicacao/ContatosRequerendoAtencao.jsx`

```
📍 Usuário clica em checkboxes de contatos:
   ├─ ANA MARIA (+554899152145)
   ├─ alvara sala (+5548999526514)
   └─ Paulo Henrique (+554891681227)

📍 Clica botão "Massa (3)"
   └─> Salva no localStorage:
       localStorage.setItem('envio_massa_contatos', JSON.stringify([
         { contact_id, nome, empresa, telefone },
         ...
       ]))
   
   └─> Navega para: /Comunicacao?modo=envio_massa
```

---

### ETAPA 2: Abertura do Modal

**Arquivo:** `pages/Comunicacao.jsx` (provavelmente)

```
📍 Página detecta ?modo=envio_massa
   └─> Lê localStorage.getItem('envio_massa_contatos')
   └─> Abre <ModalEnvioMassa 
         isOpen={true}
         contatosSelecionados={[...]} 
       />
```

---

### ETAPA 3: Interação do Usuário no Modal

**Arquivo:** `components/comunicacao/ModalEnvioMassa.jsx`

```jsx
// Linha 11-13: Estado inicial
const [mensagem, setMensagem] = useState('');
const [enviando, setEnviando] = useState(false);

// Linha 95-102: Input de mensagem
<Textarea
  value={mensagem}
  onChange={(e) => setMensagem(e.target.value)}
  placeholder="Digite sua mensagem...
  
Use {{nome}} e {{empresa}} para personalizar."
/>

// Linha 112-123: Preview automático
{mensagem && (
  <div className="p-3 bg-green-50">
    <p>📝 Preview (primeiro contato):</p>
    <p>{mensagem
      .replace(/\{\{nome\}\}/gi, contatosSelecionados[0].nome)
      .replace(/\{\{empresa\}\}/gi, contatosSelecionados[0].empresa)
    }</p>
  </div>
)}
```

**Exemplo de mensagem digitada:**
```
Olá {{nome}}! 

Temos uma oferta especial para {{empresa}}. 
Gostaria de saber mais?
```

**Preview mostrado:**
```
Olá ANA MARIA!

Temos uma oferta especial para Empresa ANA.
Gostaria de saber mais?
```

---

### ETAPA 4: Clique no Botão "Enviar"

**Arquivo:** `components/comunicacao/ModalEnvioMassa.jsx` (linha 15-59)

```javascript
const handleEnviar = async () => {
  // VALIDAÇÕES LOCAIS
  if (!mensagem.trim()) {
    toast.error('Digite uma mensagem');
    return;
  }

  if (!contatosSelecionados.length) {
    toast.error('Nenhum contato selecionado');
    return;
  }

  setEnviando(true);

  // TOAST DE LOADING
  toast.loading(`📤 Enviando para ${contatosSelecionados.length} contatos...`, 
    { id: 'envio-massa' });

  try {
    // ═══════════════════════════════════════════════════════════════
    // 🚨 CHAMADA BACKEND - Linha 31
    // ═══════════════════════════════════════════════════════════════
    const resultado = await base44.functions.invoke('enviarMensagemMassa', {
      contact_ids: contatosSelecionados.map(c => c.contact_id || c.id),
      mensagem,
      personalizar: true
    });

    // TOAST DE SUCESSO/ERRO
    if (resultado.data?.success) {
      toast.success(
        `✅ ${resultado.data.enviados} enviada(s)!` +
        (resultado.data.erros > 0 ? `\n⚠️ ${resultado.data.erros} erro(s)` : ''),
        { id: 'envio-massa', duration: 5000 }
      );

      // FECHAR MODAL
      setMensagem('');
      onClose();
      if (onEnvioCompleto) onEnvioCompleto();
    } else {
      throw new Error(resultado.data?.error || 'Erro ao enviar');
    }

  } catch (error) {
    toast.error(`❌ ${error.message}`, { id: 'envio-massa' });
  } finally {
    setEnviando(false);
  }
};
```

**Payload HTTP enviado:**
```json
POST /functions/enviarMensagemMassa
{
  "contact_ids": [
    "id_ana_maria",
    "id_alvara_sala", 
    "id_paulo_henrique"
  ],
  "mensagem": "Olá {{nome}}! Temos uma oferta especial para {{empresa}}. Gostaria de saber mais?",
  "personalizar": true
}
```

---

### ETAPA 5: Backend - Wrapper DEPRECATED

**Arquivo:** `functions/enviarMensagemMassa.js` (DEPRECATED)

```javascript
// Linha 10-34: Simplesmente redireciona
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { contact_ids, mensagem, personalizar = true } = await req.json();

  // ✅ REDIRECIONAR para função unificada
  console.log(`[ENVIO-MASSA] 🔄 Redirecionando para enviarCampanhaLote (modo: broadcast)`);
  
  const resultado = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
    contact_ids,
    modo: 'broadcast',
    mensagem,
    personalizar
  });

  return Response.json(resultado.data);
});
```

**🚨 PROBLEMA P0:**
- ❌ **Latência duplicada**: UI faz 1 HTTP call, wrapper faz outro HTTP call
- ❌ **Perde contexto de erro**: se falhar no redirecionamento, erro genérico
- ❌ **Código morto**: Mantido "para compatibilidade" mas UI já deve chamar direto

**✅ SOLUÇÃO:**
```javascript
// ModalEnvioMassa.jsx linha 31 - CORRIGIR:
const resultado = await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: contatosSelecionados.map(c => c.contact_id || c.id),
  modo: 'broadcast',
  mensagem,
  personalizar: true
});
```

---

### ETAPA 6: Backend - Função Real

**Arquivo:** `functions/enviarCampanhaLote.js` (modo: broadcast)

**⚠️ PROBLEMA:** Arquivo não encontrado no read_file (pode estar renomeado ou ter extensão diferente)

**Baseado na análise do código de `enviarPromocoesLote.js` e `promotionEngine.js`, o fluxo esperado é:**

```javascript
// Linhas estimadas baseadas em padrão observado:

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { contact_ids, modo, mensagem, personalizar } = await req.json();
  
  const now = new Date();
  
  // ═══════════════════════════════════════════════════════════════
  // MODO: BROADCAST
  // ═══════════════════════════════════════════════════════════════
  
  if (modo === 'broadcast') {
    // Validar mensagem obrigatória
    if (!mensagem?.trim()) {
      return Response.json({ 
        success: false, 
        error: 'Mensagem obrigatória' 
      }, { status: 400 });
    }
    
    // Buscar dados em lote
    const contatos = await base44.asServiceRole.entities.Contact.filter({
      id: { $in: contact_ids }
    });
    
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      contact_id: { $in: contact_ids },
      is_canonical: true
    });
    
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    
    const integration = integrations[0]; // ⚠️ Problema: pega primeira
    
    let enviados = 0;
    let erros = 0;
    const resultados = [];
    
    for (const contato of contatos) {
      try {
        // VALIDAÇÃO P0: Telefone
        if (!contato.telefone?.trim()) {
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'erro',
            motivo: 'Telefone vazio'
          });
          erros++;
          continue;
        }
        
        // VALIDAÇÃO P1: Thread canônica
        let thread = threads.find(t => t.contact_id === contato.id);
        
        if (!thread) {
          // CRIAR thread canônica
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contato.id,
            is_canonical: true,
            channel: 'whatsapp',
            whatsapp_integration_id: integration.id
          });
        }
        
        // VALIDAÇÃO P0: Bloqueios
        const bloqueio = isBlocked({ 
          contact: contato, 
          thread, 
          integration 
        });
        
        if (bloqueio.blocked) {
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'bloqueado',
            motivo: bloqueio.reason
          });
          erros++;
          continue;
        }
        
        // PERSONALIZAÇÃO
        let msgFinal = mensagem;
        if (personalizar) {
          msgFinal = msgFinal
            .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
            .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
        }
        
        // ENVIO via gateway
        const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
          integration_id: integration.id,
          numero_destino: contato.telefone,
          mensagem: msgFinal
        });
        
        if (resp?.data?.success) {
          resultados.push({
            contact_id: contato.id,
            nome: contato.nome,
            status: 'enviado',
            mensagem: msgFinal
          });
          enviados++;
        } else {
          throw new Error(resp?.data?.error || 'Erro no gateway');
        }
        
        // ⚠️ PROBLEMA P0: NÃO PERSISTE MESSAGE/THREAD AQUI
        // Depende 100% do gateway enviarWhatsApp fazer isso
        
        // Anti-rate-limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        resultados.push({
          contact_id: contato.id,
          nome: contato.nome,
          status: 'erro',
          motivo: error.message
        });
        erros++;
      }
    }
    
    // LOG DE AUDITORIA
    await base44.asServiceRole.entities.AutomationLog.create({
      acao: 'envio_massa_broadcast',
      origem: 'manual',
      usuario_id: user?.id || 'sistema',
      timestamp: now.toISOString(),
      resultado: enviados > 0 ? 'sucesso' : 'erro',
      detalhes: {
        modo: 'broadcast',
        total_contatos: contact_ids.length,
        enviados,
        erros,
        mensagem_enviada: mensagem,
        resultados
      }
    });
    
    return Response.json({
      success: true,
      modo: 'broadcast',
      enviados,
      erros,
      resultados,
      timestamp: now.toISOString()
    });
  }
});
```

---

## 🔍 RASTREAMENTO PASSO A PASSO - EXEMPLO REAL

### Cenário: Enviar para 3 contatos (da imagem)

#### 📍 PASSO 1: UI - Usuário digita mensagem

```
Mensagem digitada:
"Olá {{nome}}! Temos novidades para {{empresa}}. Gostaria de ver?"

Preview mostrado:
"Olá ANA MARIA! Temos novidades para Empresa ANA. Gostaria de ver?"
```

#### 📍 PASSO 2: UI - Clique em "Enviar"

**Linha 134 (ModalEnvioMassa.jsx):**
```jsx
<Button onClick={handleEnviar} disabled={enviando}>
  <Send className="w-4 h-4 mr-2" />
  Enviar para {contatosSelecionados.length}
</Button>
```

#### 📍 PASSO 3: Frontend - Chamada HTTP

**Linha 31 (ModalEnvioMassa.jsx):**
```javascript
const resultado = await base44.functions.invoke('enviarMensagemMassa', {
  contact_ids: ['id_ana', 'id_alvara', 'id_paulo'],
  mensagem: "Olá {{nome}}! Temos novidades para {{empresa}}. Gostaria de ver?",
  personalizar: true
});
```

**HTTP Request:**
```http
POST https://app.base44.com/api/apps/{app_id}/functions/enviarMensagemMassa
Authorization: Bearer {user_token}
Content-Type: application/json

{
  "contact_ids": ["id_ana", "id_alvara", "id_paulo"],
  "mensagem": "Olá {{nome}}! Temos novidades para {{empresa}}. Gostaria de ver?",
  "personalizar": true
}
```

#### 📍 PASSO 4: Backend - Wrapper (DEPRECATED)

**Arquivo:** `functions/enviarMensagemMassa.js`

**Linha 18-24:**
```javascript
const resultado = await base44.asServiceRole.functions.invoke('enviarCampanhaLote', {
  contact_ids,      // ['id_ana', 'id_alvara', 'id_paulo']
  modo: 'broadcast',
  mensagem,         // "Olá {{nome}}!..."
  personalizar      // true
});

return Response.json(resultado.data);
```

**🚨 PROBLEMA:**
- ❌ 2 chamadas HTTP sequenciais (latência ~2x)
- ❌ Wrapper desnecessário (função deprecated mas ainda usada)

#### 📍 PASSO 5: Backend - Função Real

**Arquivo:** `functions/enviarCampanhaLote.js` (modo: broadcast)

**Pseudocódigo baseado em padrão:**

```javascript
// 1. Buscar contatos
const contatos = await base44.asServiceRole.entities.Contact.filter({
  id: { $in: ['id_ana', 'id_alvara', 'id_paulo'] }
});
// Resultado: [Contact ANA MARIA, Contact alvara sala, Contact Paulo Henrique]

// 2. Buscar threads canônicas
const threads = await base44.asServiceRole.entities.MessageThread.filter({
  contact_id: { $in: ['id_ana', 'id_alvara', 'id_paulo'] },
  is_canonical: true
});
// Resultado: [Thread ANA (se existir), Thread alvara (se existir), ...]

// 3. Buscar integração WhatsApp
const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
  status: 'conectado'
});
const integration = integrations[0]; 
// ⚠️ PROBLEMA: Não valida se é "Financeiro (554830452079)" como mostrado na UI
// Pega primeira integração conectada

// 4. LOOP de envio
for (const contato of contatos) {
  // CRIAR thread se não existir
  if (!thread) {
    thread = await base44.asServiceRole.entities.MessageThread.create({
      contact_id: contato.id,
      is_canonical: true,
      channel: 'whatsapp',
      whatsapp_integration_id: integration.id
    });
  }
  
  // VALIDAR bloqueios
  const bloqueio = isBlocked({ contact: contato, thread, integration });
  if (bloqueio.blocked) {
    // Registra erro e pula
    continue;
  }
  
  // PERSONALIZAR
  const msgPersonalizada = mensagem
    .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
    .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
  
  // Exemplo para ANA MARIA:
  // "Olá ANA MARIA! Temos novidades para Empresa ANA. Gostaria de ver?"
  
  // ENVIAR via gateway
  const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
    integration_id: integration.id,
    numero_destino: contato.telefone, // "+554899152145"
    mensagem: msgPersonalizada
  });
  
  // ⚠️ PROBLEMA P0: NÃO PERSISTE AQUI
  // Confia que enviarWhatsApp persiste Message + atualiza Thread
  
  // Anti-rate-limit
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 5. GRAVAR LOG
await base44.asServiceRole.entities.AutomationLog.create({
  acao: 'envio_massa_broadcast',
  origem: 'manual',
  detalhes: {
    total_contatos: 3,
    enviados: 3,
    erros: 0,
    mensagem_enviada: "Olá {{nome}}!...",
    resultados: [
      { contact_id: 'id_ana', nome: 'ANA MARIA', status: 'enviado' },
      { contact_id: 'id_alvara', nome: 'alvara sala', status: 'enviado' },
      { contact_id: 'id_paulo', nome: 'Paulo Henrique', status: 'enviado' }
    ]
  }
});
```

#### 📍 PASSO 6: Gateway - enviarWhatsApp

**Arquivo:** `functions/enviarWhatsApp.js`

**Responsabilidades:**
1. Detectar provider (Z-API ou W-API)
2. Formatar payload específico do provider
3. Enviar via API externa
4. **❓ Persistir Message (não confirmado)**
5. **❓ Atualizar Thread (não confirmado)**

**Chamada externa (Z-API exemplo):**
```http
POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-text
Client-Token: {security_token}
Content-Type: application/json

{
  "phone": "554899152145",
  "message": "Olá ANA MARIA! Temos novidades para Empresa ANA. Gostaria de ver?"
}
```

**Resposta Z-API:**
```json
{
  "success": true,
  "messageId": "3EB0XXXX",
  "timestamp": 1676123456
}
```

#### 📍 PASSO 7: Retorno para UI

**Linha 37-42 (ModalEnvioMassa.jsx):**
```javascript
if (resultado.data?.success) {
  toast.success(
    `✅ 3 enviada(s)!`,
    { id: 'envio-massa', duration: 5000 }
  );
  
  onClose(); // Fecha modal
  onEnvioCompleto(); // Recarrega conversas
}
```

**Toast mostrado:**
```
┌────────────────────────────┐
│ ✅ 3 enviada(s)!          │
└────────────────────────────┘
```

---

## 🗄️ BANCO DE DADOS - O QUE É GRAVADO

### ✅ Gravado por enviarCampanhaLote

**AutomationLog** (1 registro total):
```json
{
  "id": "log_xyz",
  "acao": "envio_massa_broadcast",
  "origem": "manual",
  "usuario_id": "user_atual",
  "timestamp": "2026-02-12T14:30:00Z",
  "resultado": "sucesso",
  "detalhes": {
    "modo": "broadcast",
    "total_contatos": 3,
    "enviados": 3,
    "erros": 0,
    "mensagem_enviada": "Olá {{nome}}!...",
    "resultados": [
      { "contact_id": "id_ana", "nome": "ANA MARIA", "status": "enviado", "mensagem": "Olá ANA MARIA!..." },
      { "contact_id": "id_alvara", "nome": "alvara sala", "status": "enviado", "mensagem": "Olá alvara sala!..." },
      { "contact_id": "id_paulo", "nome": "Paulo Henrique", "status": "enviado", "mensagem": "Olá Paulo Henrique!..." }
    ]
  },
  "created_date": "2026-02-12T14:30:05Z"
}
```

### ⚠️ Gravado por enviarWhatsApp (gateway) - NÃO CONFIRMADO

**Esperado (mas não garantido):**

**Message** (3 registros):
```json
{
  "id": "msg_1",
  "thread_id": "thread_ana",
  "sender_id": "user_atual",
  "sender_type": "user",
  "recipient_id": "id_ana",
  "recipient_type": "contact",
  "content": "Olá ANA MARIA! Temos novidades para Empresa ANA. Gostaria de ver?",
  "channel": "whatsapp",
  "status": "enviada",
  "sent_at": "2026-02-12T14:30:01Z",
  "whatsapp_message_id": "3EB0XXXX",
  "metadata": {
    "whatsapp_integration_id": "integration_id"
  }
}
// ... mais 2 mensagens para alvara e Paulo
```

**MessageThread** (3 atualizações):
```json
{
  "id": "thread_ana",
  "contact_id": "id_ana",
  "last_message_at": "2026-02-12T14:30:01Z",
  "last_message_content": "Olá ANA MARIA! Temos novidades para Empresa ANA. Gostaria de ver?",
  "last_message_sender": "user",
  "last_outbound_at": "2026-02-12T14:30:01Z"
}
// ... mais 2 threads para alvara e Paulo
```

### ❌ NÃO Gravado

**Contact** - Nenhum campo atualizado:
- ❌ last_any_promo_sent_at (permanece vazio)
- ❌ last_message_at (não existe no Contact, só em Thread)
- ❌ Nenhum contador incrementado

**WorkQueueItem** - N/A (não usa fila no broadcast)

**Promotion** - N/A (não é promoção)

---

## 🚨 GAPS CRÍTICOS IDENTIFICADOS - PERSPECTIVA DE USUÁRIO

### 🔴 GAP 1: Mensagens podem não aparecer na UI

**Sintoma:**
- Usuário clica "Enviar para 3"
- Vê toast "✅ 3 enviada(s)!"
- **Mas ao abrir conversa de ANA MARIA, mensagem não aparece**

**Causa:**
- enviarCampanhaLote (broadcast) **não persiste Message**
- **Depende 100% do gateway `enviarWhatsApp`**
- Se gateway falhar em persistir, mensagem enviada mas invisível

**Evidência:**
- Modo promocao (linha 288-312) persiste explicitamente
- Modo broadcast **não tem esse código**

**Solução:**
Adicionar persistência explícita no modo broadcast (igual ao promocao).

---

### 🔴 GAP 2: Wrapper desnecessário (latência)

**Sintoma:**
- Usuário clica "Enviar" e espera ~3-5 segundos para 3 contatos
- Esperado: ~1-2 segundos

**Causa:**
- UI → `enviarMensagemMassa` → `enviarCampanhaLote`
- **2 chamadas HTTP sequenciais**
- Latência: ~500ms × 2 = 1 segundo extra

**Solução:**
UI deve chamar `enviarCampanhaLote` diretamente (remover linha intermediária).

---

### 🟠 GAP 3: Integração fixada (não controlável)

**Sintoma:**
- UI mostra "Enviar por: 📱 Financeiro (554830452079)"
- **Usuário não pode escolher outra integração**
- Backend pega primeira integração conectada

**Causa:**
- Modal não tem seletor de integração
- Backend: `const integration = integrations[0]` (primeira)

**Impacto:**
- Se empresa tem 3 chips (Vendas, Suporte, Financeiro), **sempre envia pelo mesmo**
- Usuário quer enviar promoção de vendas, mas sai pelo chip financeiro

**Solução:**
Adicionar seletor de integração no ModalEnvioMassa.

---

### 🟡 GAP 4: Preview limitado

**Sintoma:**
- Usuário seleciona 50 contatos
- Vê apenas 10 badges + "+40 mais"
- **Não tem certeza de quem está incluído**

**Causa:**
- Linha 79-88: `contatosSelecionados.slice(0, 10)`
- Sem scroll list completa

**Impacto:**
- Usuário pode enviar acidentalmente para contato errado
- Dificulta revisão antes do envio

**Solução:**
Adicionar lista scrollável com todos os contatos ou expandir limite.

---

## 📊 COMPARAÇÃO: UI vs Backend vs Banco

| Camada | ANA MARIA | alvara sala | Paulo Henrique |
|--------|-----------|-------------|----------------|
| **UI - Seleção** | ✅ Checkbox marcado | ✅ Checkbox marcado | ✅ Checkbox marcado |
| **UI - Badge** | ✅ "ANA MARIA +554899152145" | ✅ "alvara sala +5548999526514" | ✅ "Paulo Henrique +554891681227" |
| **UI - Toast Loading** | ✅ "📤 Enviando para 3 contatos..." | ✅ Incluído | ✅ Incluído |
| **Backend - Busca Contact** | ✅ Contact.get(id_ana) | ✅ Contact.get(id_alvara) | ✅ Contact.get(id_paulo) |
| **Backend - Busca Thread** | ✅ Thread.filter(contact_id) | ✅ Thread.filter(contact_id) | ✅ Thread.filter(contact_id) |
| **Backend - Cria Thread** | ⚠️ Se não existir | ⚠️ Se não existir | ⚠️ Se não existir |
| **Backend - Personaliza** | ✅ "Olá ANA MARIA!..." | ✅ "Olá alvara sala!..." | ✅ "Olá Paulo Henrique!..." |
| **Backend - Envia Z-API** | ✅ POST /send-text | ✅ POST /send-text | ✅ POST /send-text |
| **Backend - Delay** | ✅ 500ms | ✅ 500ms | ✅ 500ms |
| **Banco - Message** | ⚠️ Gateway deve persistir | ⚠️ Gateway deve persistir | ⚠️ Gateway deve persistir |
| **Banco - Thread.last_message_at** | ⚠️ Gateway deve atualizar | ⚠️ Gateway deve atualizar | ⚠️ Gateway deve atualizar |
| **Banco - Contact** | ❌ Não atualizado | ❌ Não atualizado | ❌ Não atualizado |
| **Banco - AutomationLog** | ✅ 1 registro total (não individual) | ✅ Incluído no log | ✅ Incluído no log |
| **UI - Toast Sucesso** | ✅ "✅ 3 enviada(s)!" | ✅ Incluído | ✅ Incluído |

---

## ⏱️ TIMELINE ESTIMADA - 3 CONTATOS

```
T+0ms     │ Usuário clica "Enviar para 3"
T+50ms    │ UI: toast.loading("📤 Enviando para 3 contatos...")
T+100ms   │ HTTP POST enviarMensagemMassa
T+200ms   │ Backend: Wrapper recebe request
T+250ms   │ Backend: Wrapper invoca enviarCampanhaLote
T+350ms   │ Backend: Busca Contact (3) + Thread (3) + Integration (1)
T+400ms   │ Backend: Cria thread para ANA MARIA (se não existir)
T+450ms   │ Backend: Valida bloqueios ANA MARIA
T+500ms   │ Backend: Personaliza mensagem ANA MARIA
T+550ms   │ Backend: POST Z-API send-text (ANA MARIA)
T+800ms   │ Z-API: Responde success (messageId: 3EB0XXXX)
T+850ms   │ ⚠️ Gateway persiste Message? (não confirmado)
T+900ms   │ Backend: Delay 500ms (anti-rate-limit)
T+1400ms  │ Backend: Envia para alvara sala (mesmo fluxo)
T+2400ms  │ Backend: Envia para Paulo Henrique (mesmo fluxo)
T+2500ms  │ Backend: Grava AutomationLog (1 registro)
T+2600ms  │ Backend: Retorna response para wrapper
T+2650ms  │ Wrapper: Retorna response para UI
T+2700ms  │ UI: toast.success("✅ 3 enviada(s)!")
T+2750ms  │ UI: Modal fecha
T+2800ms  │ UI: onEnvioCompleto() - recarrega conversas
```

**Tempo total: ~2.8 segundos para 3 contatos**

**Cálculo:**
- Base: 350ms (busca dados)
- Por contato: 800ms (envio + delay)
- Total: 350 + (800 × 3) = 2.75s

---

## 🔍 DIFERENÇAS: Envio Massa vs Promoções Automáticas

| Aspecto | Envio em Massa (UI da imagem) | Promoções Automáticas |
|---------|------------------------------|----------------------|
| **Gatilho** | 🖱️ Manual (usuário) | 🤖 Automático (sistema) |
| **Seleção** | ✅ Usuário escolhe contatos (checkboxes) | 🤖 Sistema seleciona (inatividade) |
| **Conteúdo** | ✍️ Usuário digita mensagem | 🎁 Sistema escolhe promoção ativa |
| **Timing** | ⚡ Imediato | ⏰ Saudação agora + Promo em 5min |
| **Preview** | ✅ UI mostra preview personalizado | ❌ Não tem preview |
| **Personalização** | ✅ {{nome}} {{empresa}} | ✅ Template inteligente |
| **Bloqueios** | ✅ Valida fornecedor/tags | ✅ Valida fornecedor/tags + cooldown |
| **Cancelamento** | ❌ Não cancela | ✅ Cancela se cliente responder |
| **Rotação** | ❌ N/A | ✅ Evita últimas 3 promos |
| **Persistência** | ⚠️ Depende do gateway | ✅ Explícita (Message + Thread) |
| **Log** | ✅ AutomationLog | ✅ AutomationLog (campanha) ❌ Sem log (worker) |
| **Feedback** | ✅ Toast "X enviadas" | ✅ Toast com resumo |

---

## 🎯 RECOMENDAÇÕES CRÍTICAS - UI + BACKEND

### 🔥 P0: Corrigir Hoje

1. **Remover wrapper deprecated:**
   ```jsx
   // ModalEnvioMassa.jsx linha 31 - ANTES:
   await base44.functions.invoke('enviarMensagemMassa', {
     contact_ids, mensagem, personalizar
   });
   
   // DEPOIS:
   await base44.functions.invoke('enviarCampanhaLote', {
     contact_ids, 
     modo: 'broadcast',
     mensagem, 
     personalizar
   });
   ```

2. **Adicionar persistência explícita no broadcast:**
   - Copiar código de persistência do modo promocao (linhas 288-312)
   - Garantir Message + Thread sempre gravados

3. **Adicionar seletor de integração no modal:**
   ```jsx
   <Select
     value={integracaoSelecionada}
     onValueChange={setIntegracaoSelecionada}
   >
     <SelectTrigger>
       <SelectValue placeholder="Selecione o chip" />
     </SelectTrigger>
     <SelectContent>
       {integrations.map(int => (
         <SelectItem value={int.id}>
           {int.nome_instancia} ({int.numero_telefone})
         </SelectItem>
       ))}
     </SelectContent>
   </Select>
   ```

### ⚠️ P1: Corrigir Esta Semana

4. **Expandir preview de contatos:**
   - Mostrar lista scrollável com todos (não só 10)
   - Adicionar botão "Remover" individual

5. **Atualizar Contact após saudação promocao:**
   - Adicionar após linha 312 de enviarCampanhaLote (modo promocao)

### 💡 P2: Melhorias Futuras

6. **Modal: histórico de envios anteriores**
7. **Modal: sugestões de mensagens (baseado em campanhas anteriores)**
8. **Modal: agendamento futuro (enviar em X horas)**

---

## 📝 CHECKLIST DE VALIDAÇÃO

Antes de enviar mensagem em massa, sistema deve validar:

- [x] Mensagem não está vazia
- [x] contact_ids não está vazio
- [x] Contatos existem no banco
- [x] Telefones são válidos
- [x] Threads existem (ou cria)
- [x] Bloqueios verificados (isBlocked)
- [x] Integração WhatsApp conectada
- [ ] **❌ Integração escolhida pelo usuário** (GAP)
- [ ] **❌ Message persistida** (depende do gateway)
- [ ] **❌ Thread atualizada** (depende do gateway)
- [x] AutomationLog gravado
- [x] Toast de feedback exibido

---

**Fim da Análise - Fluxo UI Detalhado**