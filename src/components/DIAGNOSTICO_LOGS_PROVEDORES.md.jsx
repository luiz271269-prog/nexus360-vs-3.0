# 🔍 DIAGNÓSTICO: ANÁLISE COMPARATIVA DE LOGS Z-API vs W-API

## 📊 EVIDÊNCIAS DOS LOGS

### ✅ Z-API: ATIVA E FUNCIONANDO
```
[v10.0.0-PURE-INGESTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v10.0.0-PURE-INGESTION] 📥 Payload recebido (1/2)
[v10.0.0-PURE-INGESTION] Event: ConnectedCallback | Type: undefined
[v10.0.0-PURE-INGESTION] ⏭️ Ignorado: evento_sistema
[v10.0.0-PURE-INGESTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[v10.0.0-PURE-INGESTION] 📥 Payload recebido (1/2)
[v10.0.0-PURE-INGESTION] Event: MessageStatusCallback | Type: undefined
[v10.0.0-PURE-INGESTION] ⏭️ Ignorado: evento_sistema

[v10.0.0-PURE-INGESTION] 📥 Payload recebido (1/2)
[v10.0.0-PURE-INGESTION] Event: ReceivedCallback | Type: CALL_VOICE
[v10.0.0-PURE-INGESTION] ⏭️ Ignorado: evento_sistema

[v10.0.0-PURE-INGESTION] 📥 Payload recebido (1/2)
[v10.0.0-PURE-INGESTION] Event: PresenceChatCallback | Type: undefined
[v10.0.0-PURE-INGESTION] ⏭️ Ignorado: jid_sistema
```

**O QUE ISSO SIGNIFICA:**
- ✅ Endpoint Z-API está **recebendo requisições HTTP POST**
- ✅ Primeiro log (`📥 Payload recebido`) sempre aparece
- ✅ Filtro está funcionando (descarta eventos de sistema corretamente)
- ✅ Função está deployada e executando

---

### ❌ W-API: SILÊNCIO TOTAL
```
(sem logs com prefixo [WAPI] ou [WAPI-WEBHOOK])
```

**O QUE ISSO SIGNIFICA:**
- ❌ Endpoint W-API **NÃO está recebendo requisições**
- ❌ Primeiro log (`[WAPI-WEBHOOK] REQUEST`) nunca executa
- ❌ Função não está sendo chamada OU não está deployada

---

## 🎯 DIAGNÓSTICO POR ELIMINAÇÃO

### Linha 1: A requisição HTTP chega na função?
```javascript
// webhookWapi.js - LINHA 668 (PRIMEIRA LINHA EXECUTÁVEL)
Deno.serve(async (req) => {
  console.log('[WAPI-WEBHOOK] REQUEST | Método:', req.method); // ⬅️ ESSE LOG DEVERIA APARECER
```

**TESTE:**
Se esse log **NÃO aparece**, significa que:
- Função não foi deployada corretamente
- URL do webhook no painel W-API está errada
- Painel W-API não está enviando requisições
- Firewall/proxy bloqueando

**SE ESSE LOG APARECE mas nada depois:**
- Problema está no código (parse JSON, autenticação, etc.)

---

### Linha 2: O body da requisição é válido?
```javascript
// LINHA 687-693
let payload;
try {
  const body = await req.text();
  if (!body) return Response.json({ success: true, ignored: true }, { headers: corsHeaders });
  payload = JSON.parse(body);

  console.log('[WAPI] 📥 Event:', payload.event, '| Type:', payload.type); // ⬅️ DEVERIA APARECER
  console.log('[WAPI] 📥 Payload:', JSON.stringify(payload).substring(0, 1500));
```

**TESTE:**
Se o log da **linha 668** aparece, mas os logs da **linha 691-692** não:
- Body está vazio
- JSON.parse está falhando
- Exception está sendo lançada antes do log

---

### Linha 3: SDK Supabase funciona?
```javascript
// LINHA 678-683
let base44;
try {
  base44 = createClientFromRequest(req.clone());
} catch (e) {
  return Response.json({ success: false, error: 'SDK error' }, { status: 500, headers: corsHeaders });
}
```

**TESTE:**
Se logs aparecem até **linha 692**, mas param depois:
- `createClientFromRequest` está falhando
- Responde com `{ error: 'SDK error' }` e status 500
- W-API recebe 500 e não reprocessa

---

## 🔧 CHECKLIST DE DIAGNÓSTICO (ORDEM DE PRIORIDADE)

### ✅ PASSO 1: Verificar URL do Webhook no Painel W-API
**O QUE FAZER:**
1. Acessar painel da W-API (https://api.w-api.app ou similar)
2. Ir em **Configurações → Webhooks** da instância
3. Verificar a URL configurada

**URL CORRETA DEVERIA SER:**
```
https://SEU_PROJETO.base44.app/functions/webhookWapi
```

**URLS ERRADAS COMUNS:**
```
❌ https://SEU_PROJETO.base44.app/functions/webhookWapiOLD
❌ https://SEU_PROJETO.base44.app/functions/processInbound
❌ https://OUTRO_PROJETO.base44.app/functions/webhookWapi
❌ http:// (sem HTTPS)
```

**COMO VALIDAR:**
- Copiar a URL do painel W-API
- Colar no navegador (deve retornar JSON com `version` e `status: 'ok'`)
- Se retornar 404 ou erro, URL está errada

---

### ✅ PASSO 2: Testar Endpoint Manualmente (Postman/cURL)
**COMANDO cURL:**
```bash
curl -X POST https://SEU_PROJETO.base44.app/functions/webhookWapi \
  -H "Content-Type: application/json" \
  -d '{"event":"ReceivedCallback","text":{"message":"teste"},"messageId":"TEST123","phone":"5548999999999"}'
```

**RESULTADO ESPERADO:**
```json
{
  "success": true,
  "ignored": true,
  "reason": "sem_telefone"
}
```

**E NO LOG:**
```
[WAPI-WEBHOOK] REQUEST | Método: POST
[WAPI] 📥 Event: ReceivedCallback | Type: undefined
[WAPI] 📥 Payload: {"event":"ReceivedCallback",...}
[WAPI] 🔄 Processando: message
...
```

**SE NÃO APARECER LOG:**
- Função não está deployada
- URL errada
- Projeto errado

---

### ✅ PASSO 3: Verificar Deploy da Função
**ONDE VERIFICAR:**
1. Dashboard Base44 → Code → Functions
2. Procurar por `webhookWapi`
3. Verificar status: **Deployed** ✅ ou **Failed** ❌

**SE STATUS = FAILED:**
- Clicar para ver erro de deploy
- Provavelmente erro de sintaxe ou import

**SE STATUS = DEPLOYED mas sem logs:**
- URL do webhook está errada no painel W-API

---

### ✅ PASSO 4: Comparar Configuração Z-API vs W-API

| Item | Z-API (✅ Funciona) | W-API (❌ Sem logs) |
|------|---------------------|---------------------|
| **Webhook URL no painel** | `https://projeto.base44.app/functions/webhookFinalZapi` | ??? |
| **Status deploy** | ✅ Deployed | ??? |
| **Teste cURL manual** | ✅ Retorna JSON + logs | ??? |
| **Headers necessários** | Content-Type: application/json | ??? |
| **Método HTTP** | POST | ??? |

**AÇÃO:**
Copiar exatamente a configuração da Z-API que funciona, substituindo apenas o nome da função para `webhookWapi`.

---

### ✅ PASSO 5: Validar Instance ID no Painel W-API
**VERIFICAR:**
1. No painel W-API, ver qual `instanceId` está configurado
2. No banco de dados, verificar se existe `WhatsAppIntegration` com:
   - `instance_id_provider` = esse instanceId
   - `api_provider` = 'w_api'
   - `status` = 'conectado' ou 'pendente_qrcode'

**SQL para verificar:**
```sql
SELECT id, nome_instancia, instance_id_provider, api_provider, status, webhook_url
FROM "WhatsAppIntegration"
WHERE api_provider = 'w_api'
ORDER BY created_date DESC
LIMIT 5;
```

**SE NÃO EXISTIR:**
- Criar a integração manualmente via Comunicacao → Configurações → WhatsApp
- Preencher `instance_id_provider` com o ID do painel W-API
- Salvar a URL do webhook correta

---

## 🎬 CENÁRIO MAIS PROVÁVEL

Com base na ausência total de logs da W-API:

### 🔴 HIPÓTESE PRINCIPAL: URL do Webhook Errada/Não Configurada

**EVIDÊNCIA:**
- Z-API mostra logs imediatamente ao receber qualquer evento
- W-API não mostra nem o primeiro `console.log`
- Código da W-API v16 está correto e deployado

**CAUSA RAIZ:**
O painel da W-API não está enviando requisições para a URL correta da função `webhookWapi`.

**SOLUÇÃO:**
1. Acessar painel W-API
2. Ir em **Webhooks da instância**
3. **Atualizar URL para:** `https://SEU_PROJETO.base44.app/functions/webhookWapi`
4. Salvar configuração
5. Enviar mensagem de teste
6. Verificar logs novamente

---

## 🧪 TESTE DEFINITIVO: Payload Manual

**Criar arquivo de teste:**
```javascript
// testWapiWebhook.js
const url = 'https://SEU_PROJETO.base44.app/functions/webhookWapi';

const payloadTeste = {
  event: 'ReceivedCallback',
  instanceId: 'SEU_INSTANCE_ID_AQUI',
  messageId: 'TESTE_' + Date.now(),
  phone: '5548999322400',
  text: { message: 'Mensagem de teste' },
  pushName: 'Teste Manual'
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payloadTeste)
})
.then(r => r.json())
.then(data => console.log('✅ Resposta:', data))
.catch(err => console.error('❌ Erro:', err));
```

**EXECUTAR:**
1. Substituir `SEU_PROJETO` e `SEU_INSTANCE_ID_AQUI`
2. Rodar no console do browser (F12)
3. Verificar logs no dashboard

**RESULTADO ESPERADO:**
```
// No console do browser:
✅ Resposta: { success: true, message_id: 'msg_123', ... }

// Nos logs da função:
[WAPI-WEBHOOK] REQUEST | Método: POST
[WAPI] 📥 Event: ReceivedCallback | Type: undefined
[WAPI] 📥 Payload: {"event":"ReceivedCallback",...}
[WAPI] 🔄 Processando: message
[WAPI] ▶️ Msg de +5548999322400 (none)
[WAPI] 👤 Contato existente: João Silva
[WAPI] ✅ Mensagem salva: msg_123
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Antes de mexer no código:
- [ ] URL do webhook no painel W-API está correta?
- [ ] Teste manual via cURL retorna JSON?
- [ ] Função `webhookWapi` está com status **Deployed**?
- [ ] Instance ID no painel W-API existe no banco `WhatsAppIntegration`?

### Se teste manual funciona mas mensagens reais não:
- [ ] Painel W-API está enviando para URL de produção ou staging?
- [ ] W-API exige autenticação específica no webhook?
- [ ] Firewall da W-API bloqueando algum IP?

### Se teste manual NÃO funciona:
- [ ] Adicionar log de erro detalhado no catch do SDK:
```javascript
try {
  base44 = createClientFromRequest(req.clone());
} catch (e) {
  console.error('[WAPI] ❌ SDK Error:', e.message, e.stack); // ⬅️ ADICIONAR
  return Response.json({ success: false, error: 'SDK error', details: e.message }, { status: 500, headers: corsHeaders });
}
```

---

## 🎯 CONCLUSÃO

### Status atual:
- **Z-API:** ✅ Operacional, recebendo e filtrando eventos
- **W-API:** ❌ **Não está recebendo requisições** (problema de configuração externa, não de código)

### Ação prioritária:
**Antes de qualquer ajuste de código, validar e corrigir a URL do webhook no painel da W-API.**

O código da W-API v16 está logicamente correto e simétrico à Z-API. O problema é **infraestrutura/configuração**, não lógica.

---

## 📞 COMO VALIDAR NO PAINEL W-API

### 1. Acessar configuração de webhooks:
```
Painel W-API → Instâncias → Sua Instância → Webhooks
```

### 2. Verificar campos:
- **Webhook URL:** Deve ser `https://SEU_PROJETO.base44.app/functions/webhookWapi`
- **Events:** Deve incluir `ReceivedCallback`, `MessageStatusCallback`, `ConnectedCallback`
- **Status:** Deve estar ✅ Ativo

### 3. Testar conexão:
- Botão "Testar Webhook" (se disponível)
- Ou enviar mensagem manual para o número da instância
- Verificar se logs aparecem no dashboard Base44

### 4. Comparar com Z-API funcionando:
- Copiar exatamente a mesma estrutura de configuração
- Trocar apenas o endpoint de `webhookFinalZapi` para `webhookWapi`

---

## 🚨 SINAIS DE ALERTA

### Se aparecer isso nos logs:
```
[WAPI] ❌ SDK error
```
→ Problema de autenticação Supabase

### Se aparecer isso:
```
[WAPI] ⏭️ Ignorado: evento_desconhecido
```
→ Payload não está no formato esperado (pode precisar ajustar classificador)

### Se aparecer isso:
```
[WAPI] ⏭️ Unknown: normalization_failed
```
→ Bug na normalização (mas já foi corrigido na v16)

### Se NÃO aparecer NADA:
→ **Webhook não está configurado** ou **função não está deployada**

---

## 📊 LOGS ESPERADOS PARA MENSAGEM REAL

### Fluxo completo de sucesso (W-API):
```
[WAPI-WEBHOOK] REQUEST | Método: POST
[WAPI] 📥 Event: ReceivedCallback | Type: undefined
[WAPI] 📥 Payload: {"event":"ReceivedCallback","text":{"message":"Oi"},...}
[WAPI] 🔄 Processando: message
[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[WAPI] INICIO handleMessage | De: +5548999322400 | Tipo: none
[WAPI] 🔗 Integração: integ_abc123 | Canal: +5548999999999
[WAPI] 👤 Contato existente: João Silva
[WAPI] 💭 Thread existente: thread_xyz789
[WAPI] ✅ Mensagem salva: msg_456def
[WAPI] 💭 Thread atualizada | Não lidas: 1
[WAPI] 🧠 Carregando Inbound Core (Direct Import)...
[WAPI] ✅ Cérebro executado (Direct Import)
[WAPI] ✅ SUCESSO! Msg: msg_456def | Thread: thread_xyz789 | 847ms
```

**TOTAL:** ~13 linhas de log por mensagem processada

**SE Z-API MOSTRA 13 LINHAS E W-API MOSTRA 0:**
→ Problema é configuração do webhook, não código

---

## 🛠️ SCRIPT DE DIAGNÓSTICO AUTOMÁTICO

```javascript
// diagnosticoWebhooks.js - Executar no Console do Browser

async function diagnosticarProvedores() {
  const base44Url = window.location.origin;
  
  console.log('🔍 Iniciando diagnóstico de provedores...\n');
  
  // 1. Testar Z-API
  console.log('1️⃣ Testando Z-API...');
  try {
    const resZ = await fetch(`${base44Url}/functions/webhookFinalZapi`, {
      method: 'GET'
    });
    const dataZ = await resZ.json();
    console.log('✅ Z-API responde:', dataZ);
  } catch (e) {
    console.error('❌ Z-API não responde:', e.message);
  }
  
  // 2. Testar W-API
  console.log('\n2️⃣ Testando W-API...');
  try {
    const resW = await fetch(`${base44Url}/functions/webhookWapi`, {
      method: 'GET'
    });
    const dataW = await resW.json();
    console.log('✅ W-API responde:', dataW);
  } catch (e) {
    console.error('❌ W-API não responde:', e.message);
  }
  
  // 3. Enviar payload de teste
  console.log('\n3️⃣ Enviando payload de teste para W-API...');
  try {
    const resTest = await fetch(`${base44Url}/functions/webhookWapi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'ReceivedCallback',
        instanceId: 'TESTE',
        messageId: 'DIAG_' + Date.now(),
        phone: '5548999999999',
        text: { message: 'Diagnóstico automático' }
      })
    });
    const dataTest = await resTest.json();
    console.log('✅ W-API processa teste:', dataTest);
  } catch (e) {
    console.error('❌ W-API não processa:', e.message);
  }
  
  console.log('\n✅ Diagnóstico concluído. Verificar logs no dashboard.');
}

diagnosticarProvedores();
```

---

## 🎯 AÇÃO IMEDIATA RECOMENDADA

### Dado que Z-API funciona e W-API não:

1. **Copiar URL exata da função Z-API no dashboard Base44:**
   ```
   https://SEU_PROJETO.base44.app/functions/webhookFinalZapi
   ```

2. **Adaptar para W-API:**
   ```
   https://SEU_PROJETO.base44.app/functions/webhookWapi
   ```

3. **Colar essa URL no painel da W-API em Webhooks**

4. **Salvar e enviar mensagem de teste**

5. **Verificar logs no dashboard Base44 → Functions → webhookWapi → Logs**

---

## 📈 EVOLUÇÃO ESPERADA DOS LOGS

### Fase 1: Configuração correta
```
[WAPI-WEBHOOK] REQUEST | Método: POST
```
✅ Se isso aparecer, URL está correta e função está recebendo requisições

### Fase 2: Parse funcionando
```
[WAPI] 📥 Event: ReceivedCallback | Type: undefined
[WAPI] 📥 Payload: {...}
```
✅ Se isso aparecer, body está válido e JSON.parse funciona

### Fase 3: Classificação e filtro
```
[WAPI] 🔄 Processando: message
```
✅ Se isso aparecer, mensagem passou pelo filtro

### Fase 4: Processamento completo
```
[WAPI] ✅ SUCESSO! Msg: ... | Thread: ... | ...ms
```
✅ Se isso aparecer, mensagem foi salva no banco e cérebro executou

### Fase 5: Exibição no frontend
- Thread aparece na sidebar da Comunicacao
- Badge de não lidas incrementa
- Mensagem aparece ao clicar na thread

---

## 🔬 COMPARAÇÃO: ANATOMIA DE UM LOG BEM-SUCEDIDO

### Z-API (referência que funciona):
```
[v10.0.0-PURE-INGESTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v10.0.0-PURE-INGESTION] 📥 Payload recebido (1/2)
[v10.0.0-PURE-INGESTION] Event: ReceivedCallback | Type: text
[v10.0.0-PURE-INGESTION] 📥 Payload recebido (2/2): {...}
[v10.0.0-PURE-INGESTION] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[v10.0.0-PURE-INGESTION] 🔄 PROCESSAR | messageId: ABC123
[v10.0.0-PURE-INGESTION] 👤 Contato: João Silva (existente)
[v10.0.0-PURE-INGESTION] 💬 Thread: thread_xyz
[v10.0.0-PURE-INGESTION] 💾 Message ID: msg_123
[v10.0.0-PURE-INGESTION] ✅ SUCESSO completo | 456ms
```

### W-API (esperado após configuração):
```
[WAPI-WEBHOOK] REQUEST | Método: POST
[WAPI] 📥 Event: ReceivedCallback | Type: undefined
[WAPI] 📥 Payload: {"event":"ReceivedCallback",...}
[WAPI] 🔄 Processando: message
[WAPI] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[WAPI] INICIO handleMessage | De: +5548999322400 | Tipo: none
[WAPI] 🔗 Integração: integ_abc123 | Canal: +5548999999999
[WAPI] 👤 Contato existente: João Silva
[WAPI] 💭 Thread existente: thread_xyz789
[WAPI] ✅ Mensagem salva: msg_456def
[WAPI] 💭 Thread atualizada | Não lidas: 1
[WAPI] 🧠 Carregando Inbound Core (Direct Import)...
[WAPI] ✅ Cérebro executado (Direct Import)
[WAPI] ✅ SUCESSO! Msg: msg_456def | Thread: thread_xyz789 | 847ms
```

**ESTRUTURA IDÊNTICA:** Ambos mostram ~10-13 linhas de log por mensagem processada.

**SE W-API MOSTRA 0 LINHAS:** Requisição HTTP não chegou na função.

---

## 🎯 RESUMO EXECUTIVO

| Componente | Status | Observação |
|------------|--------|------------|
| **Código W-API v16** | ✅ Correto | Simétrico à Z-API |
| **Código InboundCore** | ✅ Correto | Único para ambos |
| **Deploy da função** | ⚠️ Verificar | Pode estar OK mas não sendo chamada |
| **URL do webhook** | 🔴 **PROVÁVEL CAUSA** | Não configurada ou errada no painel W-API |
| **Integração no banco** | ⚠️ Verificar | Pode não existir ou estar com instance_id errado |

**AÇÃO CRÍTICA:**
Validar e corrigir a URL do webhook no painel da W-API antes de qualquer ajuste de código. O silêncio total de logs indica que o problema está **antes** do código (requisição não chega), não **dentro** do código.

---

**Data da análise:** 2026-01-06  
**Versões analisadas:** Z-API v10.0.0-PURE-INGESTION, W-API v16.0.0-SYMMETRY