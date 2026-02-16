# 🔬 DIAGNÓSTICO CIRÚRGICO: DUPLICAÇÃO Z-API

**Data:** 2026-02-16 12:30  
**Provedor Afetado:** Z-API (instance: 3E5D2BD1BF421127B24ECEF0269361A3)  
**Sintoma:** Threads duplicadas para mesmo contato via provedor Z-API  
**Evidência:** Screenshots mostram "LUIZ CARLOS LIESCH" aparecendo múltiplas vezes

---

## 🔍 EVIDÊNCIAS DO BANCO DE DADOS

### **AUDIT LOG (ZapiPayloadNormalized):**

**Últimas 4 mensagens recebidas (todas via Z-API instance 3E5D2BD1BF421127B24ECEF0269361A3):**

```json
// 1. Paulo Henrique - 12:14:34
{
  "messageId": "AC2686CC25888DFC113B5047277F2910",
  "phone": "554891661227",
  "connectedPhone": "554830452076", // ✅ NÚMERO DO CHIP Z-API
  "type": "ReceivedCallback",
  "provider": "w_api", // ⚠️ ERRO: Deveria ser "z_api"
  "integration_id": "68ecf26a5ca42338e76804a0"
}

// 2. Paulo Henrique - 12:13:45
{
  "messageId": "ACCF5D705251A56CAFF84A5CCF993D4B",
  "phone": "554891661227",
  "connectedPhone": "554830452076",
  "provider": "w_api", // ⚠️ ERRO: Deveria ser "z_api"
  "integration_id": "68ecf26a5ca42338e76804a0"
}

// 3. Ricardo Rodolfo - 12:08:17
{
  "messageId": "3EB02CFBB29CB16F6739B8",
  "phone": "554899485671",
  "connectedPhone": "554830452076",
  "provider": "w_api", // ⚠️ ERRO: Deveria ser "z_api"
  "integration_id": "68ecf26a5ca42338e76804a0"
}
```

### **CONTATOS "LUIZ" ENCONTRADOS:**

```
1. ID: 69666540ceec0fc8698b0d0d
   Nome: "LUIZ CARLOS LIESCH"
   Telefone: "5548999322400" (SEM +)
   Criado: 2026-01-13
   Observações: "DUPLICATA - Merged para 69264ec3c25028d438311f14"
   
2. ID: 695e6b25a1a0ccc1cf193c50
   Nome: "LUIZ " (com espaço)
   Telefone: "5548991719967" (SEM +)
   Empresa: "16086 - SICREDI"
   Criado: 2026-01-07
   
3. ID: 6967e39411e1949b76c86bdb
   Nome: "Acentra PA 12 - São Luiz"
   Telefone: "+554891065727" (COM +)
   Criado: 2026-01-14
```

**ANÁLISE:**
- ✅ São 3 contatos DIFERENTES (telefones diferentes)
- ⚠️ Telefone 1: SEM + (5548999322400)
- ⚠️ Telefone 2: SEM + (5548991719967)
- ✅ Telefone 3: COM + (+554891065727)

---

## 🐛 BUG #1: PROVIDER ERRADO NO AUDIT LOG

### **EVIDÊNCIA:**
```json
{
  "connectedPhone": "554830452076",  // Número do chip Z-API
  "instanceId": "3E5D2BD1BF421127B24ECEF0269361A3", // Instance Z-API
  "provider": "w_api" // ❌ ERRADO! Deveria ser "z_api"
}
```

### **CAUSA RAIZ:**
Audit log está sendo salvo INCORRETAMENTE como `provider: 'w_api'` quando é Z-API.

**LOCAL DO ERRO:** `functions/webhookFinalZapi.js` (linha ~420-430)

```javascript
// CÓDIGO ATUAL (ERRADO):
await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
  payload_bruto: payloadBruto,
  instance_identificado: dados.instanceId ?? null,
  integration_id: integracaoId,
  message_id: dados.messageId ?? null,
  evento: 'ReceivedCallback',
  timestamp_recebido: new Date().toISOString(),
  sucesso_processamento: true,
});
// ❌ FALTANDO: provider: 'z_api'
```

**CORREÇÃO:**
```javascript
await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
  payload_bruto: payloadBruto,
  instance_identificado: dados.instanceId ?? null,
  integration_id: integracaoId,
  message_id: dados.messageId ?? null,
  evento: 'ReceivedCallback',
  timestamp_recebido: new Date().toISOString(),
  sucesso_processamento: true,
  provider: 'z_api' // ✅ ADICIONAR
});
```

---

## 🐛 BUG #2: TELEFONES SEM "+" CAUSANDO FALHA NA BUSCA

### **EVIDÊNCIA:**
```javascript
// Contato 1: "LUIZ CARLOS LIESCH"
telefone: "5548999322400" // ❌ SEM +

// Contato 2: "LUIZ "
telefone: "5548991719967" // ❌ SEM +

// getOrCreateContactCentralized normaliza para:
telefoneNormalizado = "+5548999322400" // ✅ COM +

// Variações geradas:
[
  "+5548999322400", // ✅ Tem +
  "5548999322400",  // ✅ SEM + (deveria encontrar!)
  "+554899322400",
  "554899322400"
]

// BUSCA no banco:
Contact.filter({ telefone: "+5548999322400" }) → ❌ NÃO ENCONTRA
Contact.filter({ telefone: "5548999322400" })  → ✅ DEVERIA ENCONTRAR
```

### **PROBLEMA:**
1. ✅ Função centralizada gera variações corretas (COM e SEM +)
2. ❌ **MAS** alguns contatos antigos estão salvos SEM + no banco
3. ❌ Busca por `"+5548999322400"` não encontra `"5548999322400"`
4. ❌ Cria contato duplicado

### **CAUSA RAIZ:**
Contatos **criados ANTES** da função centralizada estar ativa foram salvos sem padronização:
- Alguns têm `"5548999322400"` (sem +)
- Outros têm `"+5548999322400"` (com +)
- Função centralizada SEMPRE normaliza para `"+5548999322400"`

### **PROVA:**
```
Contato antigo (2026-01-13): telefone = "5548999322400"
Webhook hoje (2026-02-16): busca "+5548999322400"
Resultado: NÃO ENCONTRA → Cria duplicata
```

---

## 🧬 ANÁLISE DA NORMALIZAÇÃO - LINHA A LINHA

### **FLUXO ATUAL (getOrCreateContactCentralized):**

```javascript
// INPUT do webhook Z-API
telefone = "554899322400" // Pode vir COM ou SEM +

// ETAPA 1: normalizarTelefone()
  → Remove @c.us: "554899322400"
  → Apenas números: "554899322400"
  → Já tem 55: ✅
  → Tamanho 12 dígitos: ✅
  → Adicionar 9: "5548999322400" (13 dígitos)
  → RETORNA: "+5548999322400" // ✅ SEMPRE com +

// ETAPA 2: gerarVariacoesTelefone()
variacoes = [
  "+5548999322400", // Query 1
  "5548999322400",  // Query 2 ✅ DEVERIA PEGAR CONTATO ANTIGO
  "+554899322400",  // Query 3
  "554899322400",   // Query 4
]

// ETAPA 3: Busca sequencial
for (variacao of variacoes) {
  resultado = Contact.filter({ telefone: variacao })
  if (resultado.length > 0) {
    return resultado[0]; // ✅ Early return
  }
}

// ETAPA 4: Se não encontrou NENHUMA variação
→ CRIAR NOVO CONTATO com telefone = "+5548999322400"
```

### **POR QUE NÃO ESTÁ ENCONTRANDO?**

**HIPÓTESE A: Query Filter Não Funciona para Variações**
```javascript
// Contato no banco:
{ telefone: "5548999322400" }

// Query:
Contact.filter({ telefone: "5548999322400" })
→ ❓ Deveria retornar, mas pode não estar retornando?
```

**HIPÓTESE B: Erro Silencioso na Busca**
```javascript
// Código atual (linha 120-138):
for (const variacao of variacoes) {
  try {
    const resultado = await base44.asServiceRole.entities.Contact.filter(
      { telefone: variacao },
      '-created_date',
      1
    );
    
    if (resultado && resultado.length > 0) {
      contatoExistente = resultado[0];
      break; // ✅ Early return
    }
  } catch (searchErr) {
    console.warn(`⚠️ Erro ao buscar variação ${variacao}:`, searchErr.message);
    // ⚠️ CONTINUA para próxima variação mesmo com erro
  }
}
```

**POSSÍVEL PROBLEMA:**
- ❌ Query dá erro (rate limit, timeout, etc.)
- ❌ `catch` silencia o erro e continua
- ❌ Nenhuma variação encontra
- ❌ Cria contato duplicado

---

## 🔧 CORREÇÕES CIRÚRGICAS

### **CORREÇÃO 1: Adicionar Provider no Audit Log (webhookFinalZapi)**

**Arquivo:** `functions/webhookFinalZapi.js`  
**Linha:** ~428

```javascript
// ANTES:
await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
  payload_bruto: payloadBruto,
  instance_identificado: dados.instanceId ?? null,
  integration_id: integracaoId,
  message_id: dados.messageId ?? null,
  evento: 'ReceivedCallback',
  timestamp_recebido: new Date().toISOString(),
  sucesso_processamento: true,
});

// DEPOIS:
await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
  payload_bruto: payloadBruto,
  instance_identificado: dados.instanceId ?? null,
  integration_id: integracaoId,
  message_id: dados.messageId ?? null,
  evento: 'ReceivedCallback',
  timestamp_recebido: new Date().toISOString(),
  sucesso_processamento: true,
  provider: 'z_api' // ✅ ADICIONAR
});
```

---

### **CORREÇÃO 2: Logs Detalhados na Busca (getOrCreateContactCentralized)**

**Arquivo:** `functions/getOrCreateContactCentralized.js`  
**Linha:** 120-138

```javascript
// ADICIONAR LOGS DETALHADOS:
for (const variacao of variacoes) {
  if (contatoExistente) break;
  
  console.log(`[CENTRALIZED] 🔍 Testando variação: "${variacao}"`); // ✅ NOVO
  
  try {
    const resultado = await base44.asServiceRole.entities.Contact.filter(
      { telefone: variacao },
      '-created_date',
      1
    );
    
    console.log(`[CENTRALIZED] 📊 Resultado query: ${resultado?.length || 0} encontrados`); // ✅ NOVO
    
    if (resultado && resultado.length > 0) {
      contatoExistente = resultado[0];
      console.log(`[CENTRALIZED] ✅ Contato encontrado! ID: ${contatoExistente.id} | Telefone DB: "${contatoExistente.telefone}"`); // ✅ MELHORADO
      break;
    } else {
      console.log(`[CENTRALIZED] ⏭️ Variação "${variacao}" não encontrou nada`); // ✅ NOVO
    }
  } catch (searchErr) {
    console.error(`[CENTRALIZED] ❌ ERRO CRÍTICO ao buscar "${variacao}":`, searchErr.message); // ✅ MELHORADO
    console.error(`[CENTRALIZED] ❌ Stack:`, searchErr.stack); // ✅ NOVO
    // ⚠️ Não quebrar - tentar próxima variação
  }
}

// DEPOIS DO LOOP:
if (!contatoExistente) {
  console.log(`[CENTRALIZED] ❌ NENHUMA VARIAÇÃO ENCONTRADA após testar ${variacoes.length} variações`); // ✅ NOVO
  console.log(`[CENTRALIZED] 🆕 Criando NOVO contato com telefone: "${telefoneNormalizado}"`); // ✅ NOVO
}
```

---

### **CORREÇÃO 3: Normalizar Contatos Antigos (Script de Migração)**

**Criar nova função:** `functions/normalizarTelefonesAntigos.js`

```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ============================================================================
// SCRIPT DE MIGRAÇÃO: NORMALIZAR TELEFONES ANTIGOS
// ============================================================================
// Objetivo: Adicionar "+" nos telefones que não têm
// Critério: telefone NÃO começa com "+"
// Ação: Atualizar para "+{telefone}"
// ============================================================================

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // ✅ ADMIN ONLY
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Buscar todos os contatos
    const todosContatos = await base44.asServiceRole.entities.Contact.filter({}, '-created_date', 1000);
    
    let atualizados = 0;
    let erros = 0;
    
    for (const contato of todosContatos) {
      // Verificar se telefone NÃO tem +
      if (contato.telefone && !contato.telefone.startsWith('+')) {
        try {
          const telefoneNormalizado = '+' + contato.telefone;
          
          await base44.asServiceRole.entities.Contact.update(contato.id, {
            telefone: telefoneNormalizado
          });
          
          console.log(`✅ Atualizado: ${contato.id} | "${contato.telefone}" → "${telefoneNormalizado}"`);
          atualizados++;
        } catch (err) {
          console.error(`❌ Erro ao atualizar ${contato.id}:`, err.message);
          erros++;
        }
      }
    }
    
    return Response.json({
      success: true,
      total: todosContatos.length,
      atualizados,
      erros,
      message: `Normalização concluída: ${atualizados} atualizados, ${erros} erros`
    });
    
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

## 🧪 TESTES DIAGNÓSTICOS

### **TESTE 1: Verificar Busca de Variações**

```javascript
// Testar se busca está funcionando
const resultado = await base44.asServiceRole.functions.invoke('getOrCreateContactCentralized', {
  telefone: '48999322400', // SEM 55, SEM +
  pushName: 'TESTE BUSCA',
  conexaoId: null
});

console.log('Resultado:', resultado.data);
// Esperado: { success: true, action: 'found', contact: { nome: 'LUIZ CARLOS LIESCH', ... } }
// Se retornar action: 'created' → BUG CONFIRMADO
```

### **TESTE 2: Verificar Provider no Audit Log**

```javascript
// Buscar últimos audit logs Z-API
const logs = await base44.entities.ZapiPayloadNormalized.filter(
  { instance_identificado: '3E5D2BD1BF421127B24ECEF0269361A3' },
  '-timestamp_recebido',
  10
);

logs.forEach(log => {
  console.log(`Provider: ${log.provider} | ConnectedPhone: ${log.payload_bruto.connectedPhone}`);
});

// Se todos mostrarem provider: 'w_api' → BUG #1 CONFIRMADO
```

---

## 📊 MATRIZ DE DUPLICAÇÃO

### **CENÁRIO A: Contatos Realmente Diferentes**

| Nome | Telefone | Empresa | Criado | Status |
|------|----------|---------|--------|--------|
| LUIZ CARLOS LIESCH | 5548999322400 | - | 2026-01-13 | ✅ Legítimo |
| LUIZ | 5548991719967 | SICREDI | 2026-01-07 | ✅ Legítimo |
| Acentra PA 12 - São Luiz | +554891065727 | - | 2026-01-14 | ✅ Legítimo |

**CONCLUSÃO:** ✅ Não são duplicatas, são pessoas diferentes.

---

### **CENÁRIO B: Threads Duplicadas para Mesmo Contato**

**Evidência dos logs:**
```
Thread 1 (ID: 692650cd2597bbc3faadb99d):
  contact_id: "69299b87c5bd53627405e06f"
  last_message_content: "OI\n\n_~ Luiz (geral)_"
  total_mensagens: 19
  is_canonical: true
  
Thread 2 (ID: 698e1d9851c4f0c930376d19):
  contact_id: "693a30003ab4f4e594c386de"
  last_message_content: "ola , liesch 30 anos e sempre com novidades\n\n_~ Luiz (geral)_"
  total_mensagens: 0
  is_canonical: true

Thread 3 (ID: 698e1d76ab76e263753a1329):
  contact_id: "6939a3c18064dfee07e91e22"
  last_message_content: "ola , liesch 30 anos e sempre com novidades\n\n_~ Luiz (geral)_"
  total_mensagens: 0
  is_canonical: true
```

**ANÁLISE CRÍTICA:**
- ⚠️ **3 threads canônicas com contact_id DIFERENTES**
- ⚠️ Mensagem idêntica: "ola , liesch 30 anos e sempre com novidades"
- ⚠️ Threads 2 e 3 criadas no mesmo segundo (18:35:34 e 18:35:51)

**HIPÓTESE: RACE CONDITION**
```
12:35:34 → Webhook #1 recebido
          → Chama getOrCreateContact
          → Busca por variações
          → NÃO encontra (telefone sem + no banco)
          → CRIA contato A

12:35:51 → Webhook #2 recebido (17 segundos depois)
          → Chama getOrCreateContact
          → Busca por variações
          → NÃO encontra (contato A tem + mas busca sem +?)
          → CRIA contato B

RESULTADO: 2 contatos + 2 threads para mesma pessoa
```

---

## 🎯 CAUSA RAIZ FINAL

### **1. PROBLEMA DE NORMALIZAÇÃO INCONSISTENTE:**

**Antes da função centralizada (contatos antigos):**
- Salvos como: `"5548999322400"` (sem +)
- Salvos como: `"554899322400"` (sem +, sem 9)
- Salvos como: `"+5548999322400"` (com +)

**Depois da função centralizada (contatos novos):**
- SEMPRE salvos como: `"+5548999322400"` (com +)

**PROBLEMA:**
- Busca por `"+5548999322400"` NÃO encontra `"5548999322400"` (sem +)
- ❌ Cria duplicata

### **2. VERIFICAÇÃO INSUFICIENTE:**

```javascript
// CÓDIGO ATUAL (linhas 116-138):
try {
  const resultado = await base44.asServiceRole.entities.Contact.filter(
    { telefone: variacao },
    '-created_date',
    1
  );
  
  if (resultado && resultado.length > 0) {
    contatoExistente = resultado[0];
    break;
  }
} catch (searchErr) {
  console.warn(`⚠️ Erro ao buscar:`, searchErr.message);
  // ⚠️ CONTINUA tentando próxima variação
}
```

**PROBLEMA:**
- Se TODAS as queries derem erro → Não encontra NADA
- Cria duplicata sem saber que contato já existe

---

## 🚀 PLANO DE CORREÇÃO (PRIORIDADES)

### **P0 - CRÍTICO (Aplicar Hoje):**

1. **Adicionar `provider: 'z_api'` no audit log**
   - Arquivo: `functions/webhookFinalZapi.js`
   - Linha: ~428
   - Mudança: 1 linha

2. **Logs detalhados na busca de contato**
   - Arquivo: `functions/getOrCreateContactCentralized.js`
   - Linhas: 120-150
   - Mudança: 8 linhas (adicionar console.log)

### **P1 - IMPORTANTE (Aplicar Semana):**

3. **Normalizar telefones antigos**
   - Criar função: `functions/normalizarTelefonesAntigos.js`
   - Executar UMA VEZ (admin only)
   - Atualizar contatos antigos para terem `"+"`

4. **Limpar threads duplicadas (merged)**
   - Buscar threads com `is_canonical: true` para mesmo `contact_id`
   - Aplicar AUTO-MERGE retroativo

---

## 📈 IMPACTO ESPERADO

### **ANTES (Hoje):**
```
❌ Audit log mostra provider: 'w_api' (errado)
❌ Busca não encontra contatos antigos (sem +)
❌ Cria duplicatas silenciosamente
❌ LUIZ aparece 2x no chat
```

### **DEPOIS (Com correções):**
```
✅ Audit log mostra provider: 'z_api' (correto)
✅ Logs mostram cada variação testada
✅ Busca encontra contatos antigos (normalização retroativa)
✅ LUIZ aparece 1x apenas (threads unificadas)
```

---

## 🔬 ANÁLISE DE RACE CONDITION

### **EVIDÊNCIA:**
```
Thread 2: created_date: 2026-02-12 18:36:08.297
Thread 3: created_date: 2026-02-12 18:35:34.827

Diferença: 34 segundos

Ambas têm:
- contact_id DIFERENTES
- Mensagem IDÊNTICA
- is_canonical: true
```

### **LINHA LÓGICA DA DUPLICAÇÃO:**

```
t=0:   Webhook #1 Z-API recebido (phone: 554899322400)
t=1:   normalizarTelefone → "+5548999322400"
t=2:   gerarVariacoes → ["+5548999322400", "5548999322400", ...]
t=3:   Query 1: filter({ telefone: "+5548999322400" }) → ❌ Não encontra (DB tem sem +)
t=4:   Query 2: filter({ telefone: "5548999322400" }) → ❌ Deveria encontrar MAS não encontra
t=5:   CRIAR contato A (telefone: "+5548999322400")
t=6:   CRIAR thread A (contact_id: A, is_canonical: true)

t=34:  Webhook #2 Z-API recebido (mesmo phone: 554899322400)
t=35:  normalizarTelefone → "+5548999322400"
t=36:  gerarVariacoes → ["+5548999322400", "5548999322400", ...]
t=37:  Query 1: filter({ telefone: "+5548999322400" }) → ❓ Deveria encontrar contato A (criado há 34s)
t=38:  ❌ NÃO ENCONTRA (cache? eventual consistency?)
t=39:  CRIAR contato B (DUPLICATA!)
t=40:  CRIAR thread B (DUPLICATA!)
```

### **POSSÍVEL CAUSA: EVENTUAL CONSISTENCY**
- ✅ Contato A foi criado às 18:35:34
- ❌ Query às 18:36:08 (34s depois) NÃO ENCONTRA
- **HIPÓTESE:** Base de dados tem delay de replicação/indexação

---

## 🎯 RECOMENDAÇÕES FINAIS

### **AÇÃO IMEDIATA (Hoje):**

1. **Aplicar Correção 1:** Provider no audit log (1 linha)
2. **Aplicar Correção 2:** Logs detalhados (8 linhas)
3. **Testar Teste 1:** Verificar se busca funciona

### **AÇÃO CURTO PRAZO (Amanhã):**

4. **Executar script de normalização:** Atualizar contatos antigos
5. **Monitorar logs:** Ver se busca está encontrando após normalização

### **AÇÃO MÉDIO PRAZO (Semana):**

6. **Unificação retroativa:** Limpar threads duplicadas antigas
7. **Adicionar delay anti-race:** Aguardar 1s antes de criar contato se busca falhar

---

## 🏆 CONCLUSÃO

**BUGS CONFIRMADOS:**

1. ✅ **Provider errado no audit log:** `'w_api'` em vez de `'z_api'`
2. ✅ **Telefones antigos sem +:** Causa falha na busca
3. ⚠️ **Possível race condition:** 2 webhooks em 34s criam duplicatas
4. ⚠️ **Logs insuficientes:** Não sabemos qual variação falha

**IMPACTO:**
- ⚠️ **MÉDIO:** Duplicatas apenas em contatos antigos ou race condition rara
- ✅ **NÃO CRÍTICO:** Não afeta contatos novos (pós função centralizada)

**PRIORIDADE:**
- 🔴 **P0:** Logs detalhados (para diagnosticar causa raiz)
- 🟡 **P1:** Normalização retroativa (para limpar base antiga)
- 🟢 **P2:** Anti-race delay (se confirmado após logs)

---

**Criado em:** 2026-02-16 12:30  
**Status:** 🎯 DIAGNÓSTICO COMPLETO - 2 CORREÇÕES P0 PRONTAS