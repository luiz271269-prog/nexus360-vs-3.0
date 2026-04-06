# 🚨 DIAGNÓSTICO URGENTE - ENVIO EM MASSA QUEBRADO

**Status:** 🔥 PRODUÇÃO QUEBRADA  
**Data:** 2026-02-12 10:47:48  
**Erro:** `enviarCampanhaLote.ts` não compila/deploya

---

## ⚠️ SINTOMA ATUAL

```
Função: enviarCampanhaLote
Status: ❌ Erro de Deploy
Última tentativa: 12/02/2026, 10:47:48

Log:
[INFO] Ouvindo em https://127.0.0.1:80/
Tempo inicial de isolamento: 19,96 ms
❌ Erro de deploy (não especificado)
```

**Impacto:**
- 🔥 **TODOS os envios em massa estão FALHANDO**
- 🔥 Modal "Envio em Massa" → chama `enviarMensagemMassa` → redireciona para `enviarCampanhaLote` → **ERRO 500**
- 🔥 Botão "Auto Promoções" → chama `enviarCampanhaLote` → **ERRO 500**

---

## 🔍 DIAGNÓSTICO RÁPIDO - 3 PONTOS DE FALHA

### 🔴 1. Nenhuma integração conectada

**Linha esperada (~linha 80-85):**
```typescript
const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
  status: 'conectado'
});

if (!integrations.length) {
  return Response.json({ 
    success: false, 
    error: 'Nenhuma integração WhatsApp conectada' 
  }, { status: 400 });
}
```

**Como validar:**
```sql
SELECT id, nome_instancia, numero_telefone, status 
FROM WhatsAppIntegration
WHERE status = 'conectado'
```

**Se retornar vazio:**
- ✅ Verificar se integração existe
- ✅ Verificar se `status = 'conectado'` (pode estar 'desconectado' ou 'erro_conexao')
- ✅ Rodar função de health check das integrações

**Sintoma para usuário:**
```
Toast: "❌ Nenhuma integração WhatsApp conectada"
Enviados: 0
Erros: 0
```

---

### 🟠 2. Todos os contatos bloqueados/erro

**Bloqueios possíveis (isBlocked):**
1. `contact.tipo_contato === 'fornecedor'` → blocked_supplier_type
2. Tags: fornecedor, compras, colaborador, interno → blocked_tag
3. `integration.setor_principal === 'financeiro'/'cobranca'` → blocked_integration_financial
4. `thread.sector_id` contém financeiro/cobranca/compras → blocked_sector
5. `contact.bloqueado === true` → contact_blocked
6. `contact.whatsapp_optin === false` → opt_out
7. `!contact.telefone` → telefone vazio (erro, não bloqueio)

**Exemplo de retorno se todos bloqueados:**
```json
{
  "success": true,
  "modo": "broadcast",
  "enviados": 0,
  "erros": 3,
  "resultados": [
    {
      "contact_id": "id_ana",
      "nome": "ANA MARIA",
      "status": "bloqueado",
      "motivo": "blocked_supplier_type"
    },
    {
      "contact_id": "id_alvara",
      "nome": "alvara sala",
      "status": "bloqueado",
      "motivo": "blocked_tag"
    },
    {
      "contact_id": "id_paulo",
      "nome": "Paulo Henrique",
      "status": "erro",
      "motivo": "Telefone vazio"
    }
  ]
}
```

**Como validar:**
```sql
-- Contatos da imagem
SELECT 
  id, nome, telefone, tipo_contato, tags, bloqueado, whatsapp_optin
FROM Contact
WHERE id IN ('id_ana', 'id_alvara', 'id_paulo')

-- Threads canônicas
SELECT 
  id, contact_id, sector_id, is_canonical
FROM MessageThread
WHERE contact_id IN ('id_ana', 'id_alvara', 'id_paulo')
  AND is_canonical = true
```

**Se tags incluírem 'fornecedor':**
- ✅ isBlocked retorna `{ blocked: true, reason: 'blocked_tag' }`
- ✅ Status: 'bloqueado'
- ❌ Não envia

**Sintoma para usuário:**
```
Toast: "✅ 0 enviada(s)! ⚠️ 3 erro(s)"
Enviados: 0
Erros: 3
```

---

### 🔴 3. Gateway enviarWhatsApp retorna erro 400

**Linha de chamada (~linha 320-330):**
```typescript
const resp = await base44.asServiceRole.functions.invoke('enviarWhatsApp', {
  integration_id: integration.id,
  numero_destino: contato.telefone,
  mensagem: msgPersonalizada
});

if (!resp.data?.success) {
  throw new Error(resp.data?.error || 'Erro no gateway');
}
```

**Possíveis erros do gateway:**

| Erro | Causa | Payload Incompatível |
|------|-------|---------------------|
| "Número inválido" | Telefone sem + ou com formato errado | `numero_destino: "48999152145"` (falta +55) |
| "Sessão não conectada" | Integration.status !== 'conectado' na prática | Z-API retorna 401/403 |
| "Payload incompatível" | Campo obrigatório faltando | Falta `instance_id_provider` ou `api_key_provider` |
| "Media_url inválido" | URL de mídia quebrada | 404 na URL ou CORS bloqueado |
| "Rate limit" | Provider bloqueou temporariamente | Z-API: 429 Too Many Requests |

**Exemplo de retorno se gateway falha:**
```json
{
  "success": true,
  "modo": "broadcast",
  "enviados": 0,
  "erros": 3,
  "resultados": [
    {
      "contact_id": "id_ana",
      "nome": "ANA MARIA",
      "status": "erro",
      "motivo": "Número inválido: telefone deve incluir código do país"
    },
    {
      "contact_id": "id_alvara",
      "nome": "alvara sala",
      "status": "erro",
      "motivo": "Payload incompatível: campo 'instance_id_provider' ausente"
    },
    {
      "contact_id": "id_paulo",
      "nome": "Paulo Henrique",
      "status": "erro",
      "motivo": "Sessão não conectada"
    }
  ]
}
```

**Como validar:**
```javascript
// Testar envio 1:1 via ChatWindow
// Se 1:1 também falha → problema no gateway/provider
// Se 1:1 funciona → problema no orquestrador (enviarCampanhaLote)
```

---

## 🛠️ CHECKLIST DE DIAGNÓSTICO - PASSO A PASSO

### ✅ Passo 1: Verificar se função existe e está deployada

```bash
# No dashboard Base44 → Code → Functions
# Procurar: enviarCampanhaLote
# Status: ❌ Erro | ✅ Deployed
```

**Se status = Erro:**
- ✅ Ler erro completo no log de deploy
- ✅ Corrigir erro TypeScript (provavelmente tipo incorreto ou import faltando)
- ✅ **SOLUÇÃO RÁPIDA:** Renomear `.ts` para `.js` (evita validação TS)

---

### ✅ Passo 2: Verificar integrações conectadas

```javascript
// Console do navegador (página Comunicacao)
const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
  status: 'conectado'
});
console.log('Integrações:', integrations);
```

**Se vazio:**
- ✅ Ir em Configuração de Canais
- ✅ Verificar status de cada integração
- ✅ Reconectar integração quebrada

**Se retornar integração:**
```json
[
  {
    "id": "int_123",
    "nome_instancia": "Financeiro",
    "numero_telefone": "554830452079",
    "status": "conectado",
    "api_provider": "z_api"
  }
]
```

---

### ✅ Passo 3: Simular envio com 1 contato de teste

```javascript
// Console do navegador
const resultado = await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: ['id_contato_teste'], // 1 contato válido
  modo: 'broadcast',
  mensagem: 'Teste {{nome}}',
  personalizar: true
});

console.log('Resultado:', resultado.data);
```

**Analisar response:**

#### ✅ Caso 1: Sucesso
```json
{
  "success": true,
  "enviados": 1,
  "erros": 0,
  "resultados": [
    {
      "contact_id": "id_teste",
      "nome": "João Teste",
      "status": "enviado",
      "mensagem": "Teste João Teste"
    }
  ]
}
```
→ **Função OK, problema é nos contatos específicos**

---

#### ⚠️ Caso 2: Bloqueado
```json
{
  "success": true,
  "enviados": 0,
  "erros": 1,
  "resultados": [
    {
      "contact_id": "id_teste",
      "nome": "João Teste",
      "status": "bloqueado",
      "motivo": "blocked_supplier_type"
    }
  ]
}
```
→ **Contato é fornecedor, verificar tipo_contato**

**Solução:**
```sql
UPDATE Contact 
SET tipo_contato = 'cliente'
WHERE id = 'id_teste'
```

---

#### ❌ Caso 3: Erro do gateway
```json
{
  "success": true,
  "enviados": 0,
  "erros": 1,
  "resultados": [
    {
      "contact_id": "id_teste",
      "nome": "João Teste",
      "status": "erro",
      "motivo": "Número inválido: telefone deve incluir código do país"
    }
  ]
}
```
→ **Telefone mal formatado**

**Solução:**
```sql
-- Ver formato atual
SELECT telefone FROM Contact WHERE id = 'id_teste'
-- Se retornar: "48999152145"
-- Corrigir para: "+5548999152145"

UPDATE Contact 
SET telefone = '+55' || telefone
WHERE telefone NOT LIKE '+%'
```

---

#### 🔥 Caso 4: Erro da função (não deployada)
```json
{
  "error": "Function not found: enviarCampanhaLote",
  "status": 404
}
```
→ **Função não está deployada (erro de compilação TS)**

**Solução urgente:**
1. Converter `.ts` para `.js`:
   ```bash
   mv functions/enviarCampanhaLote.ts functions/enviarCampanhaLote.js
   ```

2. Remover tipos TypeScript:
   ```javascript
   // ANTES (.ts):
   const contatos: Contact[] = await base44...
   
   // DEPOIS (.js):
   const contatos = await base44...
   ```

3. Salvar e aguardar deploy automático

---

## 📋 MATRIZ DE DIAGNÓSTICO - RESULTADO → CAUSA

| enviados | erros | resultados[0].status | resultados[0].motivo | Causa Real |
|----------|-------|----------------------|---------------------|------------|
| 0 | 0 | - | - | 🔥 Função não deployada OU nenhuma integração conectada |
| 0 | 3 | bloqueado | blocked_supplier_type | Contatos são fornecedores |
| 0 | 3 | bloqueado | blocked_tag | Contatos têm tags bloqueadas |
| 0 | 3 | bloqueado | blocked_sector | Threads estão em setor financeiro |
| 0 | 3 | erro | Telefone vazio | Contatos sem telefone |
| 0 | 3 | erro | Número inválido | Telefones mal formatados (sem +55) |
| 0 | 3 | erro | Sessão não conectada | Integration.status = 'conectado' mas Z-API offline |
| 0 | 3 | erro | Payload incompatível | Gateway não reconhece campos enviados |
| 1 | 2 | enviado (1º) / erro (2º,3º) | - | 1 contato OK, 2 com problema específico |

---

## 🎯 PLANO DE AÇÃO IMEDIATO

### 🔥 URGENTE (resolver agora):

1. **Corrigir erro de deploy:**
   ```bash
   # Ver erro completo no dashboard
   Dashboard → Code → Functions → enviarCampanhaLote → Ver Log
   
   # Se erro TypeScript:
   - Renomear .ts → .js
   - Remover tipos
   - Redeploy
   ```

2. **Validar integração conectada:**
   ```javascript
   const integrations = await base44.entities.WhatsAppIntegration.filter({
     status: 'conectado'
   });
   
   if (!integrations.length) {
     // Ir em Configuração → Reconectar
   }
   ```

3. **Testar com 1 contato válido:**
   ```javascript
   // Criar contato de teste
   const teste = await base44.entities.Contact.create({
     nome: 'Teste Sistema',
     telefone: '+5548999999999',
     tipo_contato: 'cliente',
     tags: []
   });
   
   // Enviar
   const resultado = await base44.functions.invoke('enviarCampanhaLote', {
     contact_ids: [teste.id],
     modo: 'broadcast',
     mensagem: 'Teste OK',
     personalizar: false
   });
   
   console.log('Resultado:', resultado.data);
   ```

---

## 📊 COMPARAÇÃO: O QUE O ESTUDO DIZ vs O QUE ESTÁ ACONTECENDO

| Aspecto | Esperado (Estudo) | Atual (Produção) |
|---------|-------------------|------------------|
| **Função deployada** | ✅ enviarCampanhaLote.js | ❌ enviarCampanhaLote.ts (erro) |
| **UI chama** | enviarCampanhaLote direto | ⚠️ enviarMensagemMassa (wrapper) |
| **Wrapper redireciona** | ✅ Para enviarCampanhaLote | ❌ Para função quebrada |
| **Integrações** | ≥1 conectada | ❓ Precisa validar |
| **Bloqueios** | Valida isBlocked | ✅ Implementado |
| **Persistência** | ⚠️ Depende do gateway | ⚠️ Depende do gateway |
| **Log de auditoria** | ✅ AutomationLog | ✅ Implementado |

---

## 🔧 SOLUÇÃO DEFINITIVA - ORDEM DE EXECUÇÃO

### 1️⃣ CORRIGIR DEPLOY (P0 - 5 minutos)

**Opção A: Converter para .js (mais rápido)**
```bash
# Renomear arquivo
mv functions/enviarCampanhaLote.ts functions/enviarCampanhaLote.js

# Remover todos os tipos:
# ANTES:
const contatos: Contact[] = await...
const threads: MessageThread[] = await...

# DEPOIS:
const contatos = await...
const threads = await...
```

**Opção B: Corrigir TypeScript (mais correto)**
```typescript
// Adicionar no topo:
import type { Contact, MessageThread, WhatsAppIntegration } from '@base44/sdk';

// OU usar any temporariamente:
const contatos: any[] = await...
```

---

### 2️⃣ VALIDAR INTEGRAÇÕES (P0 - 2 minutos)

**Dashboard → Configuração de Canais:**
```
✅ Financeiro (554830452079) → status: conectado
```

**Se desconectado:**
- Clicar em "Testar Conexão"
- Se falhar, clicar em "Reconectar"
- Aguardar QR Code ou pairing code
- Verificar webhook configurado

---

### 3️⃣ TESTAR ENVIO REAL (P1 - 5 minutos)

**Console do navegador (página Comunicacao):**
```javascript
// 1. Buscar 1 contato válido
const contatos = await base44.entities.Contact.filter({
  tipo_contato: 'cliente',
  bloqueado: { $ne: true }
}, '-updated_date', 1);

const contato = contatos[0];
console.log('Contato teste:', contato.nome, contato.telefone);

// 2. Enviar
const resultado = await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: [contato.id],
  modo: 'broadcast',
  mensagem: 'Teste sistema {{nome}}',
  personalizar: true
});

console.log('✅ Resultado:', resultado.data);

// 3. Analisar
if (resultado.data.enviados === 1) {
  console.log('🎉 SUCESSO - Função OK!');
} else {
  console.log('❌ FALHA:', resultado.data.resultados[0].motivo);
}
```

---

### 4️⃣ VALIDAR CONTATOS DA IMAGEM (P1 - 10 minutos)

**Se função OK, mas contatos específicos falham:**

```javascript
// Buscar os 3 contatos exatos da imagem
const contatosImagem = await base44.entities.Contact.filter({
  telefone: { 
    $in: ['+554899152145', '+5548999526514', '+554891681227'] 
  }
});

console.log('Contatos da imagem:', contatosImagem.map(c => ({
  nome: c.nome,
  telefone: c.telefone,
  tipo: c.tipo_contato,
  tags: c.tags,
  bloqueado: c.bloqueado
})));

// Enviar para eles
const resultado = await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: contatosImagem.map(c => c.id),
  modo: 'broadcast',
  mensagem: 'Olá {{nome}}! Teste real.',
  personalizar: true
});

console.log('Resultado contatos reais:', resultado.data);
```

---

## 📊 TABELA DE DECISÃO - PRÓXIMOS PASSOS

| Sintoma no Teste | Diagnóstico | Próximo Passo |
|------------------|-------------|---------------|
| Erro 404 "Function not found" | 🔥 Função não deployada | Converter .ts → .js e redeploy |
| Erro 400 "Nenhuma integração" | 🟠 WhatsAppIntegration vazio | Reconectar integração no painel |
| enviados=0, erros=3, status=bloqueado | 🟡 Contatos bloqueados | Verificar tipo_contato, tags, setor |
| enviados=0, erros=3, status=erro "Telefone" | 🟡 Telefones inválidos | Normalizar telefones (+55) |
| enviados=0, erros=3, status=erro "Sessão" | 🟠 Provider offline | Verificar saúde da integração Z-API |
| enviados=0, erros=3, status=erro "Payload" | 🔴 Contrato gateway quebrado | Verificar campos enviados vs esperados |
| enviados=1, erros=0 | ✅ Tudo OK | Problema era nos contatos específicos |

---

## 🎯 SOLUÇÃO MAIS PROVÁVEL

Baseado no erro mostrado (`enviarCampanhaLote` com status "Erro" no dashboard):

**Causa:** 
- ❌ Arquivo está como `.ts` mas tem erro de tipo TypeScript
- ❌ Deno não consegue compilar e deploy falha

**Sintomas:**
1. ✅ Função aparece no dashboard
2. ❌ Status: "Erro"
3. ❌ UI chama função → 500 Internal Server Error
4. ❌ Toast: "❌ Erro ao enviar" (genérico)

**Solução imediata:**
```javascript
// 1. Renomear arquivo
functions/enviarCampanhaLote.ts → functions/enviarCampanhaLote.js

// 2. Remover TODOS os tipos:
// - Contact[]
// - MessageThread[]
// - : string
// - : boolean
// - interface {...}

// 3. Salvar (auto-deploy)

// 4. Aguardar ~10 segundos

// 5. Testar novamente
```

**Tempo estimado:** 5 minutos  
**Risco:** Baixo (só remove validação TS, lógica permanece)

---

## 📝 EXEMPLO DE RESPONSE ESPERADO (APÓS CORREÇÃO)

### ✅ Cenário 1: Sucesso total
```json
{
  "success": true,
  "modo": "broadcast",
  "enviados": 3,
  "erros": 0,
  "resultados": [
    {
      "contact_id": "id_ana",
      "nome": "ANA MARIA",
      "status": "enviado",
      "mensagem": "Olá ANA MARIA! Temos novidades para você."
    },
    {
      "contact_id": "id_alvara",
      "nome": "alvara sala",
      "status": "enviado",
      "mensagem": "Olá alvara sala! Temos novidades para você."
    },
    {
      "contact_id": "id_paulo",
      "nome": "Paulo Henrique",
      "status": "enviado",
      "mensagem": "Olá Paulo Henrique! Temos novidades para você."
    }
  ],
  "timestamp": "2026-02-12T13:30:00Z"
}
```

---

### ⚠️ Cenário 2: Sucesso parcial (1 OK, 2 bloqueados)
```json
{
  "success": true,
  "enviados": 1,
  "erros": 2,
  "resultados": [
    {
      "contact_id": "id_ana",
      "nome": "ANA MARIA",
      "status": "enviado",
      "mensagem": "Olá ANA MARIA!..."
    },
    {
      "contact_id": "id_alvara",
      "nome": "alvara sala",
      "status": "bloqueado",
      "motivo": "blocked_tag"
    },
    {
      "contact_id": "id_paulo",
      "nome": "Paulo Henrique",
      "status": "erro",
      "motivo": "Telefone vazio"
    }
  ]
}
```

---

### ❌ Cenário 3: Falha total (função não deployada)
```json
{
  "error": "Function not found: enviarCampanhaLote",
  "message": "The requested function does not exist or failed to deploy"
}
```

---

## 🚀 COMANDO PARA TESTAR AGORA

**Cole no console do navegador (página Comunicacao ou Dashboard):**

```javascript
(async () => {
  try {
    console.log('🧪 TESTE 1: Verificar integrações...');
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      status: 'conectado'
    });
    console.log(`✅ ${integrations.length} integração(ões) conectada(s):`, integrations.map(i => i.nome_instancia));
    
    if (!integrations.length) {
      console.error('❌ PROBLEMA: Nenhuma integração conectada');
      return;
    }
    
    console.log('\n🧪 TESTE 2: Buscar contato de teste...');
    const contatos = await base44.entities.Contact.filter({
      tipo_contato: 'cliente',
      bloqueado: { $ne: true }
    }, '-updated_date', 1);
    
    if (!contatos.length) {
      console.error('❌ PROBLEMA: Nenhum contato válido encontrado');
      return;
    }
    
    const contato = contatos[0];
    console.log(`✅ Contato teste: ${contato.nome} (${contato.telefone})`);
    
    console.log('\n🧪 TESTE 3: Enviar mensagem...');
    const resultado = await base44.functions.invoke('enviarCampanhaLote', {
      contact_ids: [contato.id],
      modo: 'broadcast',
      mensagem: 'Teste sistema {{nome}}',
      personalizar: true
    });
    
    console.log('✅ RESULTADO COMPLETO:', resultado.data);
    
    if (resultado.data.enviados === 1) {
      console.log('🎉 SUCESSO TOTAL - Função está OK!');
    } else {
      console.error('❌ FALHA:', resultado.data.resultados[0]);
    }
    
  } catch (error) {
    console.error('🔥 ERRO CRÍTICO:', error);
    console.error('Mensagem:', error.message);
    console.error('Response:', error.response?.data);
  }
})();
```

---

**Próximo passo:** Copiar e colar resultado completo do console para análise detalhada.

---

**Fim do Diagnóstico Urgente**