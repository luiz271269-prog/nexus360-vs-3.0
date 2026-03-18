# 🔍 ANÁLISE FORENSE: FLUXO "CONTATOS URGENTES"

## 📋 RESUMO EXECUTIVO
**Status**: ⚠️ **FUNÇÕES PARCIALMENTE DESCONTINUADAS** — Cache desincronizado, automações ativas mas inconsistentes
**Criticalidade**: Alta — Lista de contatos urgentes retorna **0 resultados** quando deveria retornar **100+ contatos**

---

## 1️⃣ FUNÇÃO PRINCIPAL: `analisarClientesEmLote`

### ✅ O que FUNCIONA
| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Busca de contatos** | ✅ Funciona | Filtra por `tipo_contato: ['lead', 'cliente']` corretamente |
| **Enriquecimento com análise** | ✅ Funciona | Mapeia `ContactBehaviorAnalysis` + `MessageThread` em paralelo |
| **Priorização por inatividade** | ✅ Funciona | Calcula `days_inactive` e atribui buckets (30/60/90+) |
| **Fallback sem análise** | ✅ Funciona | Retorna contatos SEM `ContactBehaviorAnalysis` com score baseado em dias |
| **DTO padronizado** | ✅ Funciona | Normaliza nomes (snake_case + camelCase) para UI |
| **Logging** | ✅ Funciona | Logs detalhados em cada etapa |
| **SkillExecution** | ✅ Funciona | Persiste métricas de execução (não-bloqueante) |

### ❌ O que **NÃO FUNCIONA** / **ESTÁ QUEBRADO**
| Aspecto | Problema | Causa | Impacto |
|---------|----------|-------|--------|
| **Cache módulo-level** | Sobrescreve parametros | Hook `useContatosInteligentes` usa cache global sem validar `diasSemMensagem` | **CRÍTICO**: Painel abre com 0 resultados (cache do Layout com 2 dias) |
| **Modo "direto" (contact_ids)** | Nunca é acionado | Component nunca passa `contact_ids` (sempre usa `modo: 'priorizacao'`) | Lógica morta, 39 linhas não testadas |
| **Validação de análises** | Condicional de 24h errada | Linha 393: usa campo `ultima_analise` (não existe) em vez de `analyzed_at` | Modo scheduled pula todas as análises |
| **Query scheduled** | Inverte lógica | Linha 365: `$gte` (mais recentes) em vez de `$lte` (inativos) | Analisa contatos ATIVOS, não inativos |
| **Delay anti-rate-limit** | Insuficiente | 200ms entre invokes (linha 423) mas 12 contatos × 0.2s = 2.4s, função toma ~3s cada → 30s+ timeout | Apenas 2-3 contatos analisados antes de timeout |
| **Tratamento de erro** | Silencioso demais | Modo scheduled não retorna `erros` array como o direto | Admin não sabe o que falhou |

---

## 2️⃣ AUTOMAÇÕES DISPARADAS

### 📊 Cadeia de Execução

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ GATILHO: analisarClientesEmLote (Modo "priorizacao")    │
│    Chamada: Component "Contatos Urgentes" + refetch()      │
│    Frequência: On-demand (manual)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ AUTOMAÇÃO: "Gerar Tarefas de Análise IA (15min)"        │
│    Function: gerarTarefasDeAnalise                         │
│    Status: ✅ ATIVA (458 execuções, 11 falhas = 2.4% err)  │
│    Frequência: A cada 15 min                               │
│    Dados entrada: ContactBehaviorAnalysis CRITICO/ALTO     │
│    Ação: Cria TarefaInteligente para alimentar Agenda IA   │
│    Métricas: 469 execuções, 458 sucesso, 11 falha          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ AUTOMAÇÃO: "Gerar Tarefas IA de Análises (30min)"       │
│    Function: gerarTarefasIADaMetricas                      │
│    Status: ❌ INATIVA (armazenada, não roda)                │
│    Frequência: A cada 30 min (desativada)                  │
│    Motivo: Substituída por #2                              │
│    Ação: Mesmo que #2 (DUPLICADA)                          │
│    Métricas: 75 execuções, 73 sucesso, 2 falha             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ AUTOMAÇÃO: "Watchdog - Ativar Threads Tipo A (15min)"   │
│    Function: watchdogIdleContacts                          │
│    Status: ✅ ATIVA (368 execuções, 20 falhas = 5.2% err)  │
│    Frequência: A cada 15 min                               │
│    Ação: Detecta threads sem resposta → dispara preAtend. │
│    Métricas: 388 execuções, 368 sucesso, 20 falha          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ AUTOMAÇÃO: "Jarvis Event Loop (5min)"                   │
│    Function: superAgente                                   │
│    Status: ✅ ATIVA (1991 execuções, 40 falhas = 2.0% err) │
│    Frequência: A cada 5 min                                │
│    Ação: Ciclo autônomo — processa eventos, parados, etc   │
│    Métricas: 2031 execuções, 1991 sucesso, 40 falha        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ 6️⃣ AUTOMAÇÃO: "Resumo Executivo Matinal (08:00)"           │
│    Function: gerarResumenExecutivoMatinal                  │
│    Status: ✅ ATIVA (3 execuções, 3 sucesso = 0% err)      │
│    Frequência: Diária (08:00)                              │
│    Ação: Gera resumo com metas, Top 3 clientes, alertas    │
│    Métricas: 3 execuções, 3 sucesso, 0 falha               │
│    Nota: **Usa dados de contatos urgentes!**               │
└─────────────────────────────────────────────────────────────┘
```

### 🔗 Fluxos SECUNDÁRIOS (não diretos)

**Automação #7**: "Etiqueta → Pipeline CRM (MessageThread)" 
- Status: ✅ ATIVA (3333 execuções, 18 falhas = 0.5% err)
- Dispara: Quando `categorias` de MessageThread mudam (cotacao/venda)
- Ação: Move orçamento no pipeline, promove contato

**Automação #8**: "Resgate de Primeiro Contato Travado (15min)"
- Status: ✅ ATIVA (393 execuções, 7 falhas = 1.8% err)
- Dispara: Threads em `WAITING_SECTOR_CHOICE` sem atendente
- Ação: Retoma preAtendimento automaticamente

**Automação #9**: "Reescalonador de Tarefas Inativas (6h)"
- Status: ✅ ATIVA (11 execuções, 1 falha = 9.1% err)
- Dispara: TarefaInteligente pendente há +72h
- Ação: Regenera mensagem, escala prioridade

---

## 3️⃣ PROBLEMAS CRÍTICOS IDENTIFICADOS

### 🔴 PROBLEMA #1: CACHE DESINCRONIZADO
**Severidade**: CRÍTICO  
**Impacto**: **0 contatos mostrados** quando deveria mostrar 100+

```typescript
// Hook useContatosInteligentes (linha 12-17)
const _moduleCache = {
  lastFetchTs: 0,
  inflightPromise: null,
  result: null,
  THROTTLE_MS: 3 * 60 * 1000 // 3min
};

// Problema:
// 1. Layout monta hook com diasSemMensagem=2 (padrão)
// 2. Retorna resultado com 10-20 contatos → armazena em cache
// 3. ContatosUrgentes monta hook com diasSemMensagem=5 (padrão local)
// 4. Hook vê cache ativo (< 3min) → reutiliza resultado ERRADO
// 5. Painel mostra dados do Layout (2 dias), não 5 dias ✗
```

**Solução aplicada**: Desativar `autoRefresh: false` e forçar `refetch()` ao montar  
**Status da fix**: ✅ Aplicado no commit anterior

---

### 🔴 PROBLEMA #2: MODO "DIRETO" É CÓDIGO MORTO
**Severidade**: ALTO  
**Impacto**: Função tem lógica que nunca é testada (linhas 39-77)

```typescript
// analisarClientesEmLote linha 39
if (contact_ids && Array.isArray(contact_ids) && contact_ids.length > 0) {
  // ← Nunca acionado
  // Component SEMPRE chama com modo='priorizacao'
  // Sem contact_ids na requisição
}
```

**Motivo**: Component nunca passa `contact_ids`  
**Recomendação**: Remover 39 linhas de código morto ou documentar uso futuro

---

### 🔴 PROBLEMA #3: MODO SCHEDULED NÃO FUNCIONA
**Severidade**: ALTO  
**Impacto**: Automação `executarAnaliseDiariaContatos` roda mas **não analisa nada**

```typescript
// analisarClientesEmLote linha 393
const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
  contact_id: contato.id,
  ultima_analise: {                    // ← CAMPO NÃO EXISTE
    $gte: new Date(...).toISOString()
  }
});
// Deveria ser: analyzed_at (campo correto em ContactBehaviorAnalysis)
```

**Consequência**: Query retorna sempre vazio → todas as análises são puladas  
**Status**: ❌ Nunca foi corrigido

---

### 🔴 PROBLEMA #4: QUERY SCHEDULED INVERTIDA
**Severidade**: ALTO  
**Impacto**: Automação analisa contatos ATIVOS quando deveria analisar INATIVOS

```typescript
// executarAnaliseDiariaContatos linha 365
if (priorizar_ativos) {
  query.ultima_interacao = {
    $gte: new Date(...).toISOString()  // ← MAIOR QUE (mais recentes)
    // Deveria ser $lte para INATIVOS
  };
}
```

**Consequência**: Roda análise de contatos que interagiram NOS ÚLTIMOS 90 DIAS  
**Esperado**: Analisar contatos que NÃO interagiram por 90+ dias

---

### 🔴 PROBLEMA #5: TIMEOUT INSUFICIENTE
**Severidade**: MÉDIO-ALTO  
**Impacto**: Apenas **2-3 contatos analisados** em cada execução (limite 12)

```
Tempo disponível: 35 segundos
Delay entre invokes: 200ms × 12 contatos = 2.4 segundos
Tempo por análise (analisarComportamentoContato): ~3-4 segundos
Total estimado: 3-4s × 12 = 36-48 segundos → TIMEOUT

Realidade: Apenas os 2-3 primeiros conseguem terminar antes de 35s
```

**Recomendação**: Aumentar `MAX_CONTATOS_POR_EXECUCAO` para 5 ou reduzir delay para 100ms

---

### 🔴 PROBLEMA #6: VALIDAÇÃO DE ANÁLISE ERRADA
**Severidade**: MÉDIO  
**Impacto**: Falso-negativo no cache de análises (modo scheduled)

```typescript
// analisarClientesEmLote linha 390-405
const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
  contact_id: contato.id,
  ultima_analise: { $gte: ... }  // ← Sintaxe correta seria...
  // Mas o CAMPO não existe!
});

// Deveria ser:
const analises = await base44.asServiceRole.entities.ContactBehaviorAnalysis.filter({
  contact_id: contato.id,
  analyzed_at: { $gte: corte24h }  // ← Campo correto
});
```

---

## 4️⃣ MATRIZ DE FUNCIONALIDADES

| Feature | Função | Automação | Status | Notas |
|---------|--------|-----------|--------|-------|
| **Buscar contatos inativos** | `analisarClientesEmLote` | - | ✅ | Funciona para modo "priorizacao" |
| **Enriquecer com análise comportamental** | `analisarClientesEmLote` | - | ✅ | Busca e mapeia corretamente |
| **Gerar análises periódicas** | `executarAnaliseDiariaContatos` | - | ❌ | Query quebrada, nunca roda |
| **Converter análises em tarefas** | `gerarTarefasDeAnalise` | ✅ (15min) | ✅ | Funciona, 458 execuções |
| **Agendar tarefas na Agenda IA** | - | ✅ (via TarefaInteligente) | ✅ | Depende de gerarTarefasDeAnalise |
| **Monitorar threads paradas** | `watchdogIdleContacts` | ✅ (15min) | ✅ | Funciona, 368 execuções |
| **Gerar resumo executivo** | `gerarResumenExecutivoMatinal` | ✅ (08:00) | ⚠️ | Depende de contatos urgentes |
| **Listar contatos urgentes (UI)** | `useContatosInteligentes` hook | - | ⚠️ | Cache bug corrigido, mas cache=3min |

---

## 5️⃣ CORREÇÕES NECESSÁRIAS (PRIORIDADE)

### 🔴 P1 - CRÍTICO (Afeta UX, impede uso)

1. **CACHE BUG (APLICADO)**: Fix `useContatosInteligentes` para ignorar cache ao abrir painel ✅ 
2. **CAMPO ERRADO**: Corrigir `ultima_analise` → `analyzed_at` em `analisarClientesEmLote:390-405`
3. **QUERY INVERTIDA**: Corrigir `$gte` → `$lte` em `executarAnaliseDiariaContatos:365`

### 🟠 P2 - ALTO (Impede automações)

4. **CÓDIGO MORTO**: Remover modo "direto" ou documentar (39 linhas)
5. **TIMEOUT**: Aumentar `MAX_CONTATOS_POR_EXECUCAO` de 12 para 5-6 (realista)
6. **VALIDAÇÃO**: Adicionar logs e tratamento quando análise falha

### 🟡 P3 - MÉDIO (Melhorias)

7. **DUPLICAÇÃO**: Decidir: manter `gerarTarefasDeAnalise` ou `gerarTarefasIADaMetricas`?
8. **CACHE TTL**: Documentar THROTTLE_MS de 3min (pode não ser adequado)
9. **ERRO SILENT**: Modo scheduled deveria retornar array de `erros` como modo direto

---

## 6️⃣ AUTOMAÇÕES RELACIONADAS (FUNCIONANDO)

✅ **Automatização #1**: Cada 15min detecta contatos urgentes (CRITICO/ALTO) → cria tarefas IA  
✅ **Automatização #2**: Cada 15min monitora threads paradas → retoma via preAtendimento  
✅ **Automatização #3**: A cada 5min roda ciclo Jarvis → processa eventos, segue up  
✅ **Automatização #4**: 08:00 diariamente gera resumo com Top 3 urgentes

---

## 📈 DADOS DE CONFIABILIDADE

| Automação | Execuções | Sucesso | Falhas | Taxa Erro | Última Exec |
|-----------|-----------|---------|--------|-----------|-------------|
| gerarTarefasDeAnalise | 469 | 458 | 11 | 2.4% | 20:26 (agora) |
| watchdogIdleContacts | 388 | 368 | 20 | 5.2% | 20:27 (agora) |
| superAgente (Jarvis) | 2031 | 1991 | 40 | 2.0% | 20:34 (agora) |
| gerarResumenExecutivoMatinal | 3 | 3 | 0 | 0% | 11:00 hoje |
| reescalonarTarefasInativas | 12 | 11 | 1 | 8.3% | 20:20 (agora) |
| **MÉDIA** | - | - | - | **3.6%** | - |

---

## 🎯 CONCLUSÃO

**Status Overall**: ⚠️ **FUNCIONAL MAS FRÁGIL**

- ✅ **Core funciona**: Busca, enriquecimento, priorização
- ❌ **Automações tem bugs**: Query invertida, campo errado
- ⚠️ **Cache destabiliza UI**: Corrigido no componenté, mas TTL=3min é apertado
- ✅ **Downstream ok**: Tarefas, watchdog, resumos executivo funcionam
- 📉 **Taxa erro: 3.6%** (aceitável mas há picos em 8.3%)

**Próximos passos**:
1. Corrigir campo `ultima_analise` → `analyzed_at` (P1)
2. Corrigir query scheduled `$gte` → `$lte` (P1)
3. Testar modo scheduled após correção
4. Considerar remover código morto (P2)