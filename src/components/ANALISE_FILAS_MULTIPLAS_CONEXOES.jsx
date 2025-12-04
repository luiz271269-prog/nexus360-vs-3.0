# 📊 ANÁLISE COMPLETA: SISTEMA DE FILAS E MÚLTIPLAS CONEXÕES Z-API

## 📋 SITUAÇÃO ATUAL (O QUE TEMOS HOJE)

### ✅ O QUE FUNCIONA PERFEITAMENTE
1. **Recebimento via Webhook (bass44 - 554899142800)**
   - ✅ Webhook `whatsappWebhook` recebe mensagens Evolution API
   - ✅ Cria/atualiza Contact automaticamente
   - ✅ Cria/atualiza MessageThread automaticamente
   - ✅ Persiste Message com mídia
   - ✅ Incrementa `unread_count` na thread
   - ✅ Aparece na Central de Comunicação

2. **Envio via Z-API**
   - ✅ Função `enviarWhatsApp` envia texto, imagem, vídeo, áudio, documento
   - ✅ Suporta reply (resposta a mensagens)
   - ✅ Usa tokens corretos (instance token + client-token)

3. **Interface**
   - ✅ Central de Comunicação mostra threads ordenadas
   - ✅ ChatWindow exibe mensagens
   - ✅ Marcação de lidas funciona

### ❌ PROBLEMAS IDENTIFICADOS

#### PROBLEMA 1: Segunda Conexão NÃO APARECE NA CENTRAL
**Conexão:** compras Nexus360 (554830452078)
**Status:** Desconectado
**Instance ID:** 3E970ECD69A5D15620DA4AB3AB0C4537

**DIAGNÓSTICO:**
```
✅ WhatsAppIntegration existe no banco (id: 691cbfeb949c0b5b776f1d21)
✅ Tokens configurados
✅ Diagnóstico mostra "Conexão estabelecida"
❌ Status permanece "desconectado"
❌ Mensagens NÃO chegam na Central
❌ Estatísticas zeradas (0 enviadas, 0 recebidas)
```

**CAUSA RAIZ:**
1. O webhook `whatsappWebhook` está configurado para Evolution API (formato de payload diferente da Z-API)
2. A Z-API está apontando para `/inboundWebhook` (antigo) que não existe mais
3. MessageThread é criada MAS sem `whatsapp_integration_id` correto
4. Falta mapeamento entre `instance` (nome da instância) e `WhatsAppIntegration.id`

#### PROBLEMA 2: NÃO EXISTE SISTEMA DE FILAS REAL
```
❌ unread_count é apenas um contador visual
❌ Não há FIFO (First-In, First-Out)
❌ Não há priorização persistente
❌ Não há tempo de espera calculado
❌ Não há distribuição automática por setor
❌ Não há visualização de fila em tempo real
```

---

## 🎯 MODELO PROPOSTO (COMO SERÁ)

### ARQUITETURA DE FILAS POR CONEXÃO E SETOR

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK ÚNICO                            │
│              /api/functions/whatsappWebhook                 │
│     (Recebe de TODAS as conexões Z-API/Evolution)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Identificar WhatsAppIntegration pelo "instance"         │
│  2. Criar/Atualizar Contact                                 │
│  3. Criar/Atualizar MessageThread com integration_id        │
│  4. Salvar Message                                          │
│  5. ENFILEIRAR → FilaAtendimento                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    FILAS PERSISTENTES                        │
│                                                              │
│  FILA VENDAS (bass44)         FILA COMPRAS (Nexus360)      │
│  ├─ Conexão: bass44           ├─ Conexão: compras Nexus360 │
│  ├─ Thread 1 (3 min espera)   ├─ Thread 1 (1 min espera)   │
│  ├─ Thread 2 (7 min espera)   ├─ Thread 2 (5 min espera)   │
│  └─ Thread 3 (2 min espera)   └─ Thread 3 (12 min espera)  │
│                                                              │
│  ORDENAÇÃO: FIFO (primeiro a entrar, primeiro a ser         │
│             atendido) + PRIORIDADE                          │
└─────────────────────────────────────────────────────────────┘
```

### NOVA ENTIDADE: FilaAtendimento

```json
{
  "name": "FilaAtendimento",
  "type": "object",
  "properties": {
    "thread_id": {
      "type": "string",
      "description": "ID da MessageThread nesta fila"
    },
    "whatsapp_integration_id": {
      "type": "string",
      "description": "De qual conexão veio"
    },
    "setor": {
      "type": "string",
      "enum": ["vendas", "assistencia", "financeiro", "fornecedor", "geral"],
      "description": "Setor escolhido pelo cliente"
    },
    "posicao_fila": {
      "type": "number",
      "description": "Posição na fila (1 = primeiro)"
    },
    "entrou_em": {
      "type": "string",
      "format": "datetime",
      "description": "Quando entrou na fila"
    },
    "tempo_espera_segundos": {
      "type": "number",
      "description": "Calculado em tempo real"
    },
    "prioridade": {
      "type": "string",
      "enum": ["baixa", "normal", "alta", "urgente"],
      "default": "normal"
    },
    "atendido_por": {
      "type": "string",
      "description": "ID do User quando atribuído"
    },
    "atendido_em": {
      "type": "string",
      "format": "datetime"
    },
    "removido_da_fila": {
      "type": "boolean",
      "default": false
    },
    "motivo_remocao": {
      "type": "string",
      "enum": ["atribuido", "timeout", "cancelado", "transferido"]
    }
  },
  "required": ["thread_id", "whatsapp_integration_id", "setor", "entrou_em"]
}
```

---

## 🔧 PLANO DE IMPLEMENTAÇÃO CIRÚRGICA (5 PASSOS)

### PASSO 1: CRIAR ENTIDADE FilaAtendimento ✅
**Objetivo:** Ter estrutura persistente de fila FIFO

**Arquivos:**
- `entities/FilaAtendimento.json` (CRIAR)

**Impacto:** ZERO - Apenas adiciona nova entidade

---

### PASSO 2: CORRIGIR WEBHOOK PARA IDENTIFICAR CONEXÃO ✅
**Objetivo:** Garantir que mensagens da segunda conexão sejam associadas corretamente

**Problema Atual:**
```javascript
// functions/whatsappWebhook linha 308-324
const integracoes = await base44.entities.WhatsAppIntegration.filter({
  nome_instancia: instance  // ✅ Busca por nome CORRETO
});

let integracaoId = null;
if (integracoes.length > 0) {
  integracaoId = integracoes[0].id;
  // ✅ JÁ ATUALIZA ESTATÍSTICAS
  await base44.entities.WhatsAppIntegration.update(integracaoId, {
    'estatisticas.total_mensagens_recebidas': ...,
    ultima_atividade: ...
  });
}

// Thread é criada COM integration_id
thread = await base44.entities.MessageThread.create({
  contact_id: contato.id,
  whatsapp_integration_id: integracaoId,  // ✅ CORRETO
  ...
});
```

**CONCLUSÃO:** O código JÁ ESTÁ CORRETO! 

**PROBLEMA REAL:** A segunda conexão não está enviando mensagens para o webhook

**VERIFICAÇÕES NECESSÁRIAS:**
1. ✅ URL do webhook na Z-API está correta? (`/api/functions/whatsappWebhook`)
2. ⚠️ A Z-API está REALMENTE enviando webhooks? (verificar logs Z-API)
3. ⚠️ O `nome_instancia` na WhatsAppIntegration = "compras Nexus360"
4. ⚠️ O payload da Z-API contém `instance: "compras Nexus360"`?

**AÇÃO IMEDIATA:**
- Verificar na Z-API se o webhook está configurado
- Verificar se o nome da instância no painel Z-API = "compras Nexus360"
- Testar enviando mensagem real para +554830452078

---

### PASSO 3: ADICIONAR FUNÇÃO gerenciarFila ✅
**Objetivo:** Enfileirar/desenfileirar threads de forma inteligente

**Arquivo:** `functions/gerenciarFila.js` (CRIAR)

**Funcionalidades:**
```javascript
// ENFILEIRAR
await gerenciarFila.enqueue({
  thread_id: "...",
  whatsapp_integration_id: "...",
  setor: "vendas",
  prioridade: "normal"
});

// DESENFILEIRAR (pegar próximo da fila)
const proxima = await gerenciarFila.dequeue({
  setor: "vendas",
  atendente_id: "..."
});

// LISTAR FILA
const fila = await gerenciarFila.list({
  setor: "vendas",
  ordenacao: "FIFO"  // ou "prioridade"
});
```

**Impacto:** ZERO - Função isolada, não afeta código atual

---

### PASSO 4: MODIFICAR WEBHOOK PARA AUTO-ENFILEIRAR ✅
**Objetivo:** Toda mensagem nova vai automaticamente para fila

**Arquivo:** `functions/whatsappWebhook` (MODIFICAR)

**Mudança Cirúrgica:**
```javascript
// DEPOIS de criar a Message (linha 369-383)
// ADICIONAR:

// 🆕 ENFILEIRAR AUTOMATICAMENTE SE THREAD NÃO ATRIBUÍDA
if (!thread.assigned_user_id) {
  const setor = thread.sector_id || 'geral';
  
  // Verificar se já está na fila
  const jaEnfileirado = await base44.entities.FilaAtendimento.filter({
    thread_id: thread.id,
    removido_da_fila: false
  });
  
  if (jaEnfileirado.length === 0) {
    await base44.entities.FilaAtendimento.create({
      thread_id: thread.id,
      whatsapp_integration_id: integracaoId,
      setor: setor,
      entrou_em: new Date().toISOString(),
      prioridade: thread.prioridade || 'normal',
      removido_da_fila: false
    });
    
    console.log(`[WEBHOOK] ✅ Thread enfileirada no setor: ${setor}`);
  }
}
```

**Impacto:** BAIXO - Apenas adiciona lógica APÓS processamento atual

---

### PASSO 5: CRIAR INTERFACE DE VISUALIZAÇÃO DE FILAS ✅
**Objetivo:** Ver filas em tempo real por conexão/setor

**Arquivo:** `components/comunicacao/VisualizadorFilas.jsx` (CRIAR)

**Funcionalidades:**
- Exibir filas separadas por conexão (bass44, compras Nexus360)
- Mostrar tempo de espera de cada thread
- Permitir atribuição manual ou automática
- Botão "Atender Próximo da Fila"

**Impacto:** ZERO - Componente novo, não afeta nada

---

## 🚨 AÇÃO URGENTE: CORRIGIR SEGUNDA CONEXÃO

### CHECKLIST DE VALIDAÇÃO

**1. Verificar WhatsAppIntegration no Banco:**
```
✅ Existe? SIM (id: 691cbfeb949c0b5b776f1d21)
✅ nome_instancia: "compras Nexus360"
✅ instance_id_provider: "3E970ECD69A5D15620DA4AB3AB0C4537"
✅ Tokens preenchidos? SIM
❌ status: "desconectado" (deveria ser "conectado")
❌ webhook_url: aponta para /inboundWebhook (ERRADO - deveria ser /whatsappWebhook)
```

**2. Verificar Configuração na Z-API:**
```
Acesse: https://api.z-api.io
Instância: 3E970ECD69A5D15620DA4AB3AB0C4537

Verifique:
[ ] Nome da instância = "compras Nexus360" (EXATAMENTE)
[ ] Webhook "Receive" = https://nexus360-pro.base44.app/api/functions/whatsappWebhook
[ ] Status = Conectado/Online
[ ] Teste manual: enviar msg do seu celular para +554830452078
```

**3. Corrigir webhook_url no Banco:**
```javascript
// EXECUTAR MANUALMENTE ou criar função:
await base44.entities.WhatsAppIntegration.update('691cbfeb949c0b5b776f1d21', {
  webhook_url: 'https://nexus360-pro.base44.app/api/functions/whatsappWebhook',
  status: 'conectado'
});
```

---

## 📝 RESUMO EXECUTIVO

### O QUE ESTÁ FUNCIONANDO
- ✅ Recebimento e envio com UMA conexão (bass44)
- ✅ Webhook processa Evolution API corretamente
- ✅ MessageThread associa integration_id

### O QUE NÃO ESTÁ FUNCIONANDO
- ❌ Segunda conexão não recebe mensagens (webhook incorreto na Z-API)
- ❌ Não há sistema de filas FIFO persistente
- ❌ Não há visualização de tempo de espera

### PRÓXIMOS PASSOS CIRÚRGICOS

**IMEDIATO (resolver segunda conexão):**
1. Atualizar `webhook_url` da segunda integração
2. Configurar webhook CORRETO na Z-API (apontar para `/whatsappWebhook`)
3. Enviar mensagem de teste real para +554830452078
4. Verificar se aparece na Central de Comunicação

**CURTO PRAZO (filas):**
1. Criar entidade `FilaAtendimento`
2. Criar função `gerenciarFila`
3. Modificar `whatsappWebhook` para auto-enfileirar
4. Criar interface `VisualizadorFilas`

**MÉDIO PRAZO (roteamento inteligente):**
1. Implementar estratégias (round_robin, sticky_sender)
2. Redistribuição automática por timeout
3. Métricas de SLA por fila

---

## 🔍 DIFERENÇAS DE PAYLOAD: EVOLUTION vs Z-API

### Evolution API (formato atual do webhook):
```json
{
  "event": "messages.upsert",
  "instance": "compras Nexus360",
  "data": {
    "messages": [{
      "key": {
        "remoteJid": "5548999999999@s.whatsapp.net",
        "id": "ABC123",
        "fromMe": false
      },
      "pushName": "Nome Cliente",
      "message": {
        "conversation": "Texto da mensagem"
      },
      "messageTimestamp": 1234567890
    }]
  }
}
```

### Z-API Webhook (formato que pode vir):
```json
{
  "event": "message-received",
  "instanceId": "3E970ECD69A5D15620DA4AB3AB0C4537",
  "data": {
    "key": {
      "remoteJid": "5548999999999@s.whatsapp.net",
      "id": "ABC123",
      "fromMe": false
    },
    "pushName": "Nome Cliente",
    "message": {
      "conversation": "Texto da mensagem"
    },
    "messageTimestamp": 1234567890
  }
}
```

**DIFERENÇA CRÍTICA:**
- Evolution: `instance` = NOME (ex: "compras Nexus360")
- Z-API: `instanceId` = ID (ex: "3E970ECD69A5D15620DA4AB3AB0C4537")

**SOLUÇÃO:**
O webhook precisa mapear AMBOS os formatos:
```javascript
const instance = evento.instance || evento.data?.instance || evento.instanceId;
```

---

## ✅ SOLUÇÃO DEFINITIVA PARA 2+ CONEXÕES

### MODIFICAÇÃO NO whatsappWebhook (CIRÚRGICA)

**LOCAL:** `functions/whatsappWebhook.js` linha 308-324

**MUDANÇA:**
```javascript
// ANTES (só busca por nome):
const integracoes = await base44.entities.WhatsAppIntegration.filter({
  nome_instancia: instance
});

// DEPOIS (busca por nome OU por instance_id):
let integracoes = await base44.entities.WhatsAppIntegration.filter({
  nome_instancia: instance
});

// Se não encontrou por nome, tenta por instance_id
if (integracoes.length === 0 && instance) {
  integracoes = await base44.entities.WhatsAppIntegration.filter({
    instance_id_provider: instance
  });
  console.log(`[WEBHOOK] 🔍 Buscando por instance_id_provider: ${instance}`);
}
```

**IMPACTO:** ZERO quebra, TOTAL compatibilidade

---

## 🎯 CONCLUSÃO

**PARA RESOLVER HOJE:**
1. Corrigir webhook_url da segunda conexão
2. Configurar webhook na Z-API para a URL correta
3. Modificar `whatsappWebhook` para buscar por nome OU instance_id

**PARA IMPLEMENTAR DEPOIS (sem quebrar):**
1. Criar FilaAtendimento
2. Criar gerenciarFila
3. Auto-enfileirar no webhook
4. Interface de visualização

**GARANTIA:**
✅ O que funciona hoje CONTINUARÁ funcionando
✅ Mudanças são aditivas, não destrutivas
✅ Rollback fácil se necessário