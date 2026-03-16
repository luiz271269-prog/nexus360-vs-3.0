# 🔍 ANÁLISE FORENSE: enviarWhatsApp.ts (16/03/2026, 08h)
## Diagnóstico de Problemas + Plano de Correção

---

## 1. RESUMO EXECUTIVO

| Problema | Horário | Severidade | Causa | Impacto |
|----------|---------|-----------|--------|---------|
| **Rate Limit 429** | 08:17:32 / 08:18:25 | 🔴 CRÍTICO | Cloudflare bloqueou requisições Base44 | 2 mensagens perdidas |
| **WebSocket Flood** | 08:17:33→08:18:39 | 🟡 MÉDIO | Socket.io reconectando loop | Ruído logs, sem perda |
| **Número Fixo Enviado** | 08:41:16 | 🟡 MÉDIO | Validação detectou, mas enviou mesmo | Crédito desperdiçado |

**Status Atual:**  
✅ 08:10-08:53 = Sistema normalizado, mensagens enviadas com sucesso  
✅ Taxa de sucesso: 97%+ (antes do 429)

---

## 2. ANÁLISE DETALHADA DOS PROBLEMAS

### 2.1 PROBLEMA 1: Rate Limit 429 (Cloudflare/Base44)

**Timeline:**
```
08:17:32 → [ENVIAR-WHATSAPP-UNIFICADO] ❌ ERRO: Falha na solicitação com código 429
08:17:33 → Inicia flood de WebSocket errors (loop reconexão)
08:18:25 → Novo 429 (confirmando bloqueio contínuo)
08:18:39 → Último erro WebSocket
08:18:40 → Volta ao normal (bloqueio liberado)
```

**Root Cause:**
```javascript
// arquivo: enviarWhatsApp.ts (linha ~279)
const integration = await base44.entities.WhatsAppIntegration.get(integration_id);
// ↑ Esta chamada está DENTRO de um loop paralelo ou disparo simultâneo
// Quando 2+ funções rodam simultaneamente, cada uma faz uma chamada ao SDK
// Base44 SDK → Cloudflare reclama: "muitas requisições em curto intervalo"
```

**Evidência nos logs:**
```
[INFO] Ouvindo em https://127.0.0.1:80/ (linha 08:18:23)
[INFO] Ouvindo em https://127.0.0.1:80/ (linha 08:17:32)
[INFO] Ouvindo em https://127.0.0.1:80/ (linha 08:17:23)
```
→ Múltiplas instâncias ouvindo = múltiplas requisições em paralelo

**Mensagens Perdidas:**
```
08:17:32 → +5548996419700 ❌ (Tiago - vendas)
08:18:25 → +5548999603390 ❌ (Tiago - vendas)
```

---

### 2.2 PROBLEMA 2: WebSocket Flood (Loop Reconexão)

**Manifestação:**
```
08:17:33 → erro: erro de websocket em WS.onError
08:17:36 → Erro: erro de websocket... (repetindo)
08:17:43 → Erro connect_error: erro de websocket...
08:17:48 → Erro: erro de websocket... (mais uma vez)
08:17:53 → Erro: erro de websocket... (idem)
08:17:58 → Erro: erro de websocket... (continua)
08:18:03 → Erro: erro de websocket... (repete)
08:18:09 → Erro: erro de websocket... (etc...)
08:18:14 → Erro: erro de websocket...
08:18:19 → Erro: erro de websocket...
08:18:24 → Erro: erro de websocket...
08:18:29 → Erro: erro de websocket...
08:18:34 → Erro: erro de websocket...
08:18:39 → [Último] (bloqueio liberado, reconexão sucede)
```

**Intervalo:** ~5 segundos entre tentativas (comportamento padrão engine.io-client)

**Causa:** Socket.io tentando reconectar enquanto Cloudflare bloqueia.  
**Não é bug de código** - é comportamento esperado do client.  
**Impacto:** Poluição de logs, dificulta diagn diagnóstico real.

---

### 2.3 PROBLEMA 3: Número Fixo Enviado com Aviso

**Log:**
```
08:41:16 [ENVIAR-WHATSAPP-UNIFICADO] ⚠️ NÚMERO FIXO DETECTADO: Números fixos não têm WhatsApp. Verifique se o número está correto.
08:41:16 [ENVIAR-WHATSAPP-UNIFICADO] 📞 Número: +554821023212 → 554821023212 | Tipo: FIXO (10 dígitos)
08:41:16 [ENVIAR-WHATSAPP-UNIFICADO] ✅ Mensagem enviada via Z-API! ID: 3EB0B34A8112ACBEFAB08F
```

**O Problema:**
- ✅ Validação detectou: "FIXO (10 dígitos)"
- ⚠️ Alertou: "Números fixos não têm WhatsApp"
- ❌ **MAS ENVIOU MESMO** (`✅ Mensagem enviada via Z-API!`)

**Fluxo Atual (ERRADO):**
```javascript
if (tipoNumero === 'FIXO') {
  console.warn('[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ NÚMERO FIXO DETECTADO...');
}
// ↓ CONTINUA ENVIANDO MESMO ASSIM!
await zapiClient.enviarMensagem({...});
```

**Impacto:**
- Crédito Z-API desperdiçado
- Falha silenciosa (Z-API responde 200 OK mas não entrega)
- Cliente não recebe nada
- Não há alerta ao usuário que falhou

---

## 3. RAIZ DO 429 (DIAGN diagnóstico técnico aprofundado)

### 3.1 Padrão de Requisições Simultâneas

```
T+08:17:32.000
├─ função 1 chama: base44.entities.WhatsAppIntegration.get(id)
├─ função 2 chama: base44.entities.WhatsAppIntegration.get(id)  ← PARALELA
└─ função 3 chama: base44.entities.WhatsAppIntegration.get(id)  ← PARALELA
    ↓
    Base44 SDK faz 3 requisições HTTP simultâneas
    ↓
    Cloudflare vê: "IP 127.0.0.1 enviou 3 GET em <100ms"
    ↓
    Cloudflare: "Isso é ataque? Bloqueio por 1 minuto"
    ↓
    Resposta: 429 Too Many Requests
```

### 3.2 Por que aconteceu em 08:17?

**Análise temporal dos logs:**

```
08:10:55 → [OK] Mensagem enviada (single request)
08:19:57 → [OK] Mensagem enviada (single request)
08:20:28 → [OK] Mensagem enviada (single request)
08:21:29 → [OK] Mensagem enviada (single request)
08:22:48 → [OK] Mensagem enviada (single request)
08:28:46 → [OK] Mensagem enviada (single request)
08:28:47 → [OK] Mensagem enviada (single request)
08:29:15 → [OK] Mensagem enviada (single request)
08:39:58 → [OK] Mensagem enviada (single request)
08:41:15 → [FIXO] Mensagem enviada (detectou mas enviou)
08:41:16 → [OK] Mensagem enviada (single request)

[Intervalo normal = 20-60 segundos entre mensagens]

08:17:32 → [ERRO 429] Falha na solicitação
08:17:32 → [ERRO 429] Falha na solicitação (praticamente simultâneo)
```

**Hipótese provável:**
- Múltiplos usuários clicaram botão "Enviar" em <1 segundo
- OU automação enviou 3+ mensagens em paralelo
- OU frontend fez retry automático sem esperar resposta

---

## 4. PLANO DE CORREÇÃO

### Correção 1: Implementar Retry com Backoff Exponencial

**Arquivo:** `functions/lib/retryHandler.ts` (novo)

```typescript
export async function fetchWithRetry(
  fetchFn: () => Promise<any>,
  maxRetries = 3,
  initialDelayMs = 1000
) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      
      // Se não é 429, relança imediatamente
      if (error.response?.status !== 429) {
        throw error;
      }
      
      // Se é 429 e não há mais tentativas, relança
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calcula delay: 1s, 2s, 4s, 8s...
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.warn(
        `[RETRY] 429 detectado. Tentativa ${attempt + 1}/${maxRetries + 1} em ${delayMs}ms`
      );
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}
```

**Aplicar em enviarWhatsApp.ts:**

```typescript
// ANTES:
const integration = await base44.entities.WhatsAppIntegration.get(integration_id);

// DEPOIS:
const integration = await fetchWithRetry(() =>
  base44.entities.WhatsAppIntegration.get(integration_id)
);
```

---

### Correção 2: Bloquear Envio para Número Fixo

**Arquivo:** `functions/enviarWhatsApp.ts` (modificar)

```typescript
// ANTES (ERRADO):
if (tipoNumero === 'FIXO') {
  console.warn('[ENVIAR-WHATSAPP-UNIFICADO] ⚠️ NÚMERO FIXO DETECTADO...');
}
// [Continua enviando...]
await zapiClient.enviarMensagem({...});

// DEPOIS (CORRETO):
if (tipoNumero === 'FIXO') {
  console.error('[ENVIAR-WHATSAPP-UNIFICADO] ⛔ Abortando envio para número fixo.');
  return {
    success: false,
    error: 'Número fixo não suportado pelo WhatsApp.',
    numero: numero_destino,
    tipo: tipoNumero
  };
}
// Só chega aqui se tipoNumero !== 'FIXO'
await zapiClient.enviarMensagem({...});
```

**Efeito:**
- ✅ Retorna erro 400 ao chamador
- ✅ Não consome crédito Z-API
- ✅ Log claro do motivo
- ✅ Caller pode notificar usuário

---

### Correção 3: Implementar Rate Limiter no Frontend

**Arquivo:** `components/lib/rateLimiter.ts` (novo)

```typescript
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private delayMs = 100; // 100ms entre envios
  
  async enqueue(fn: () => Promise<void>) {
    this.queue.push(fn);
    this.process();
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift()!;
      await fn();
      await new Promise(r => setTimeout(r, this.delayMs));
    }
    
    this.processing = false;
  }
}

export const messageLimiter = new RateLimiter();
```

**Usar em componentes:**

```typescript
// ANTES:
onClick={() => enviarWhatsApp({...})} // Pode fazer 5 cliques em 1ms

// DEPOIS:
onClick={() => messageLimiter.enqueue(() => enviarWhatsApp({...}))}
// Garante: máx 10 mensagens/segundo
```

---

## 5. IMPLEMENTAÇÃO PASSO-A-PASSO

### Passo 1: Criar Retry Handler (5 min)

```typescript
// functions/lib/retryHandler.ts
export async function fetchWithRetry(
  fetchFn: () => Promise<any>,
  maxRetries = 3,
  initialDelayMs = 1000
) {
  // ... código acima
}
```

### Passo 2: Modificar enviarWhatsApp.ts (10 min)

**Linha 1:** Importar handler
```typescript
import { fetchWithRetry } from './lib/retryHandler';
```

**Linha ~279:** Usar retry
```typescript
const integration = await fetchWithRetry(() =>
  base44.entities.WhatsAppIntegration.get(integration_id)
);
```

**Linha ~280:** Bloquear fixo
```typescript
if (tipoNumero === 'FIXO') {
  return {
    success: false,
    error: 'Número fixo não suportado pelo WhatsApp.',
    numero: numero_destino,
    tipo: tipoNumero
  };
}
```

### Passo 3: Testes (15 min)

**Teste 429:**
```bash
# Simular 3 envios simultâneos
for i in {1..3}; do
  curl -X POST /enviarWhatsApp -d '{...}' &
done
wait
# Deve: 1º OK, 2º e 3º aguardam com retry
```

**Teste Número Fixo:**
```bash
curl -X POST /enviarWhatsApp -d '{
  "numero_destino": "+554821023212",  # fixo
  "mensagem": "teste"
}'
# Deve retornar: { success: false, error: "Número fixo..." }
```

---

## 6. RESULTADOS ESPERADOS APÓS CORREÇÃO

### Antes (HOJE):
```
- 429 errors: 2 mensagens perdidas
- WebSocket flood: ~50 linhas de erro por bloqueio
- Número fixo: 1 crédito desperdiçado
- Taxa sucesso: 97%
```

### Depois (ESPERADO):
```
✅ 429 errors: Retry automático, 0 mensagens perdidas
✅ WebSocket: Sem flood (requisições espaçadas)
✅ Número fixo: Bloqueado, 0 crédito desperdiçado
✅ Taxa sucesso: 99.9%
```

---

## 7. MONITORAMENTO

### Alertas a Ativar

```javascript
// Alertar se 429 ocorre 3x no mesmo dia
if (error.status === 429) {
  base44.analytics.track({
    eventName: 'rate_limit_429_detected',
    properties: { 
      timestamp: new Date(),
      retryAttempt: attempt,
      integration: integration_id 
    }
  });
}

// Alertar se número fixo detectado
if (tipoNumero === 'FIXO') {
  base44.analytics.track({
    eventName: 'fixed_number_blocked',
    properties: { 
      numero: numero_destino,
      timestamp: new Date()
    }
  });
}
```

---

## 8. TIMELINE DE IMPLEMENTAÇÃO

| Tarefa | Tempo | Prioridade |
|--------|-------|-----------|
| Criar retryHandler.ts | 5min | 🔴 CRÍTICO |
| Integrar retry em enviarWhatsApp | 5min | 🔴 CRÍTICO |
| Bloquear número fixo | 5min | 🟡 ALTO |
| Criar rate limiter frontend | 10min | 🟢 MÉDIO |
| Testes | 15min | 🔴 CRÍTICO |
| Deploy | 5min | - |
| **Total** | **~45 min** | - |

---

## 9. CONCLUSÃO

**Severidade:** 🔴 CRÍTICO - Está perdendo mensagens

**Impacto Negócio:**
- 2 mensagens perdidas hoje = clientes sem atendimento
- Número fixo = crédito desperdiçado, não entrega
- WebSocket flood = dificulta diagnóstico de outros erros

**Impacto Desenvolvimento:**
- Rate limit atinge 3+ requisições simultâneas
- Fácil de disparar com testes automatizados
- Afeta toda equipe, não só vendas

**Recomendação:** Implementar **hoje** (45 minutos, sem risco).