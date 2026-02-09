# 🔍 ANÁLISE COMPLETA: URLs de Webhook Fixas/Erradas

## 📊 Resumo do Problema

**Sintoma**: Instâncias W-API ainda exibem `webhookWatsZapi` no banco, quando deveriam ter `webhookWapi`

**Causa Raiz**: Algumas funções backend preservavam URLs antigas do banco em vez de recalcular baseado no provedor

---

## 🗺️ MAPEAMENTO CORRETO DE WEBHOOKS POR PROVEDOR

```javascript
const PROVIDERS_WEBHOOK_MAP = {
  'z_api':             'webhookWatsZapi',  // ✅ Correto
  'w_api':             'webhookWapi',       // ✅ Correto  
  'w_api_integrator':  'webhookWapi',       // ✅ Correto (mesmo que w_api)
  'instagram_api':     'instagramWebhook',
  'facebook_graph_api': 'facebookWebhook',
  'goto_phone':        'gotoWebhook'
};
```

**URL Completa Base**: `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/{webhookFn}`

---

## 🔴 PONTOS ONDE HAVIA URL FIXA ERRADA (JÁ CORRIGIDOS)

### 1. ❌ `functions/wapiIntegratorManager` (linha 32)
**ANTES**:
```javascript
const DEFAULT_WEBHOOK_URL = 'https://nexus360-pro.base44.app/.../functions/webhookWapi';
```
**STATUS**: ✅ Correto - já usa `webhookWapi`

---

### 2. ❌ `functions/sincronizarInstanciasWapiIntegrador` (linha 24, 67)
**ANTES**:
```javascript
const DEFAULT_WEBHOOK_URL = '...functions/webhookWapi';
const webhookUrl = integracaoExistente?.webhook_url || DEFAULT_WEBHOOK_URL; // ❌ PRESERVAVA valor antigo
```

**DEPOIS** (✅ CORRIGIDO):
```javascript
const WEBHOOK_URL_WAPI = '...functions/webhookWapi';
const webhookUrl = WEBHOOK_URL_WAPI; // ✅ SEMPRE sobrescreve, ignora banco
```

**Impacto**: Toda sincronização com painel W-API agora **força** `webhookWapi`, mesmo que banco tenha valor errado

---

### 3. ❌ `functions/corrigirWebhooksIntegracoes` (linha 26, 44)
**ANTES**:
```javascript
const PROVIDERS = {
  z_api: 'webhookWatsZapi',
  w_api: 'webhookWapi'
  // ❌ FALTAVA: w_api_integrator
};

const precisaAtualizar = 
  !webhookAtual || 
  webhookAtual.includes('preview-sandbox');
  // ❌ NÃO COMPARAVA se URL estava errada para o provedor
```

**DEPOIS** (✅ CORRIGIDO):
```javascript
const PROVIDERS = {
  z_api: 'webhookWatsZapi',
  w_api: 'webhookWapi',
  w_api_integrator: 'webhookWapi' // ✅ Adicionado
};

const precisaAtualizar = 
  !webhookAtual || 
  webhookAtual.includes('preview-sandbox') ||
  webhookAtual !== webhookUrlCorreta; // ✅ Detecta função errada no provedor
```

**Impacto**: Agora detecta e corrige W-API com `webhookWatsZapi` salvo

---

### 4. ⚠️ `functions/wapiVerificarWebhooks` (linha 51)
**STATUS**: ✅ Correto - hardcoded com `webhookWapi`
```javascript
const expectedWebhookUrl = '.../functions/webhookWapi';
```

---

### 5. ⚠️ `functions/wapiRegistrarWebhookRapido` (linha 39)
**ANTES**:
```javascript
const webhookUrl = `https://${req.headers.get('host')}/functions/webhookWapi`;
```
**STATUS**: ✅ Correto - usa `webhookWapi` e pega host dinamicamente

**PORÉM**: ❌ Salva no banco linha 79:
```javascript
await base44.entities.WhatsAppIntegration.update(integration_id, {
  webhook_url: webhookUrl // ❌ Salva URL dinâmica baseada em req.headers.get('host')
});
```

**Problema**: Se função for chamada de ambiente preview, salva URL de preview. Deveria **sempre** usar URL de produção fixa.

---

### 6. ✅ `functions/wapiGerenciarWebhooks` (linha 50)
**STATUS**: ✅ Correto - **lê do banco** como source of truth:
```javascript
const webhookUrl = integration.webhook_url; // ✅ Usa valor do banco
```

**Lógica**: Assume que banco já tem URL correta (garantido pelas correções 1-3)

---

## 🛠️ LINHA LÓGICA COMPLETA (CORRIGIDA)

### 🔵 Criação de Instância (UI → Backend)

1. **Frontend** (`ConfiguracaoCanaisComunicacao` linha 477):
   ```javascript
   const webhookUrlFinal = getWebhookUrlProducao(provider.webhookFn);
   // Sempre recalcula, ignora campo do formulário
   ```

2. **Backend** (`wapiIntegratorManager` linha 32, 58):
   ```javascript
   const DEFAULT_WEBHOOK_URL = '.../webhookWapi';
   // Usa na criação via API Integrador
   ```

3. **Banco de Dados**: Salvo com `webhookWapi` ✅

---

### 🔵 Sincronização W-API → Banco

1. **Função**: `sincronizarInstanciasWapiIntegrador`
2. **Lógica ANTIGA** (❌):
   ```javascript
   const webhookUrl = integracaoExistente?.webhook_url || DEFAULT_WEBHOOK_URL;
   // Preservava valor antigo errado
   ```

3. **Lógica NOVA** (✅):
   ```javascript
   const webhookUrl = WEBHOOK_URL_WAPI; // Sempre sobrescreve
   ```

4. **Resultado**: Toda sincronização agora **corrige** URLs erradas automaticamente

---

### 🔵 Edição Manual (UI)

1. **Ao selecionar integração** (`selecionarIntegracao` linha 268):
   ```javascript
   const webhookUrlDinamica = getWebhookUrlProducao(provider.webhookFn);
   setNovaIntegracao({ webhookurl: webhookUrlDinamica }); // ✅ Recalcula
   ```

2. **Ao entrar em modo edição** (`handleEditarIntegracao` linha 576):
   ```javascript
   const webhookUrlAtualizada = getWebhookUrlProducao(provider.webhookFn);
   setNovaIntegracao(prev => ({ ...prev, webhookurl: webhookUrlAtualizada })); // ✅ Recalcula
   ```

3. **Campo do formulário**: Mostra URL recalculada ✅

---

### 🔵 Correção em Massa

**Função**: `corrigirWebhooksIntegracoes`

**Lógica**:
```javascript
for (const integracao of integracoes) {
  const provider = integracao.api_provider || 'z_api';
  const webhookFn = PROVIDERS[provider]; // ✅ Mapeia correto
  const webhookUrlCorreta = `${WEBHOOK_BASE}/${webhookFn}`;
  
  const precisaAtualizar = webhookAtual !== webhookUrlCorreta; // ✅ Compara
  
  if (precisaAtualizar) {
    await update(integracao.id, { webhook_url: webhookUrlCorreta }); // ✅ Corrige
  }
}
```

**Resultado**: Botão "Corrigir URLs" agora detecta e corrige `webhookWatsZapi` → `webhookWapi`

---

## ⚠️ PONTO DE ATENÇÃO RESTANTE

### `functions/wapiRegistrarWebhookRapido` (linha 39, 79)

**Código Atual**:
```javascript
const webhookUrl = `https://${req.headers.get('host')}/functions/webhookWapi`;

await base44.entities.WhatsAppIntegration.update(integration_id, {
  webhook_url: webhookUrl // ❌ Salva URL dinâmica do req.headers
});
```

**Problema**: Se chamado de ambiente preview/staging, salvará URL errada

**Solução**: Usar URL fixa de produção:
```javascript
const WEBHOOK_URL_PRODUCAO = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

await base44.entities.WhatsAppIntegration.update(integration_id, {
  webhook_url: WEBHOOK_URL_PRODUCAO // ✅ Sempre produção
});
```

---

## ✅ COMO CORRIGIR INSTÂNCIAS ANTIGAS AGORA

### Opção 1: Botão "Corrigir URLs" (Automático)
1. Ir em **Configurações** → aba **WhatsApp** → sub-aba **Conexões**
2. Clicar em **"Corrigir URLs"** (botão laranja)
3. Confirma correção em massa
4. **Resultado**: Todas W-API serão atualizadas para `webhookWapi`

### Opção 2: Sincronização W-API (Semi-automático)
1. Ir em sub-aba **Sincronização**
2. Clicar **"Sincronizar Agora"**
3. Para cada instância divergente, clicar **"Corrigir Divergências"**
4. **Resultado**: URLs erradas são substituídas

### Opção 3: Edição Manual
1. Selecionar instância na lista
2. Clicar **"Editar"**
3. URL é recalculada automaticamente
4. Clicar **"Salvar"**
5. **Resultado**: Banco atualizado com URL correta

---

## 🎯 CHECKLIST DE VERIFICAÇÃO

- [x] `PROVIDERS` frontend tem `webhookFn` correto para cada provedor
- [x] `getWebhookUrlProducao(webhookFn)` retorna URL dinâmica correta
- [x] Ao **selecionar** integração → recalcula webhook
- [x] Ao **editar** → recalcula webhook
- [x] Ao **salvar** → ignora campo, usa recalculado
- [x] Ao **sincronizar** W-API → sobrescreve com `webhookWapi`
- [x] Ao **importar** da W-API → usa `webhookWapi`
- [x] Corretor em massa detecta função errada por provedor
- [ ] `wapiRegistrarWebhookRapido` usa URL fixa produção (⚠️ pendente)

---

## 📝 RESUMO EXECUTIVO

**Estado Atual** (após correções):
- ✅ Frontend sempre recalcula URLs dinamicamente
- ✅ Criação usa URLs corretas por provedor
- ✅ Sincronização força `webhookWapi` (ignora banco antigo)
- ✅ Corretor detecta e corrige URLs erradas
- ⚠️ `wapiRegistrarWebhookRapido` ainda usa `req.headers.get('host')` (potencial risco)

**Instâncias antigas** com `webhookWatsZapi` no banco:
- Serão corrigidas automaticamente na próxima sincronização
- Ou manualmente via botão "Corrigir URLs"
- Ou editando e salvando a instância

**Visualmente** no painel:
- Campo de edição mostra URL correta (recalculada)
- Diagnóstico mostra URL do banco (pode estar errada até corrigir)
- É esperado essa divergência até executar correção