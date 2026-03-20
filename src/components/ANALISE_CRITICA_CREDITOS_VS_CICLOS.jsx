# 🔍 ANÁLISE CIRÚRGICA: CRÉDITOS vs CICLOS CORRETOS

**Data:** 2026-03-20  
**Consumo atual:** ~450 créditos/hora = ~9.068/dia (50.000 orçamento)  
**Ritmo:** **80% gasto em 18% das automações** (distribuição absurda)

---

## 📊 MATRIZ DE CRÉDITOS POR AUTOMAÇÃO

### ✅ **ZERO CRÉDITOS** (Apenas DB, sem integração)

| Automação | Ciclo | Custo | Motivo |
|-----------|-------|-------|--------|
| Solicitar Aprovação Disparo | 10min | 🟢 0 | Apenas `.filter()` + `.create()` / `.update()` |
| Ler Aprovações Disparo | 5min | 🟢 0 | Lê threads (DB), detecta "SIM", atualiza status |
| Disparo Sequencial | 1x/dia | 🟢 0 | Processa FilaDisparo (DB) + envia via funcão backend |
| Sincronização Calendários | 15min | 🟢 0* | **VER ABAIXO** |

---

### 💸 **COM CRÉDITOS** (Integração LLM/Providers)

| Automação | Ciclo | Créditos | Custo/Dia | Motivo | **RECOMENDAÇÃO** |
|-----------|-------|----------|-----------|--------|-----------------|
| **Análise Diária Contatos** | 15min | 🔴 ~50/exec | ~288 × 50 = **14.400/dia** | 1x LLM por contato (12 contatos × 12 execuções/dia) | ❌ **DESATIVAR OU 1x/DIA** |
| **Análise Cruzada Clientes** | 1x/dia 06:00 | 🔴 ~100/exec | ~100/dia | 1x LLM para classificação ABC | ✅ **MANTER (LOW)** |
| **Resumo Compras Diário** | 1x/dia 10:00 | 🟠 ~20 | ~20/dia | Agrega dados (DB), zero LLM | ✅ **MANTER** |
| **Gerar Tarefas Análise** | 15min | 🔴 ~0** | ~0/dia | Converte ContactBehaviorAnalysis → tarefas (DB) | ✅ **MANTER** |
| **Processare Fila Promoções** | 5min | 🔴 ~30/exec | ~8.640/dia | 1x por promoção (288 exec × 30 créditos) | ⚠️ **OTIMIZAR: 30min ou batch** |

---

## 🎯 DIAGNÓSTICO

### 🔴 **CULPADO #1: `analisarContatosDaily`**

```
Código: Line 83-103
- Roda a CADA 15 MINUTOS
- Chama InvokeLLM (model: gemini_3_flash) para CADA contato
- 12 contatos × 96 execuções/dia = 1.152 chamadas LLM
- ~50 créditos/chamada = 57.600 créditos APENAS NESTA AUTOMAÇÃO
```

**PROBLEMA:** Distribui contatos ao longo do dia, mas não reduz frequência.

---

### 🔴 **CULPADO #2: `processarFilaPromocoes`**

```
Código: Roda a cada 5 MINUTOS
- 288 execuções/dia
- Cada envio WhatsApp = ~10 créditos (se houver mídia)
- 288 × 30 (overhead + validação) = ~8.640/dia
```

**PROBLEMA:** Polling desnecessário. Deveria ser event-driven (inbound trigger).

---

## ✅ **CICLOS CORRETOS RECOMENDADOS**

### **TIER 1: Zero Créditos (Executar com frequência)**

```
✅ Ler Aprovações Disparo → 5min (PERFEITO)
✅ Solicitar Aprovação Disparo → 10min (PERFEITO)
✅ Gerar Tarefas Análise → 30min (pode aumentar para 1h)
```

**JUSTIFICATIVA:** Apenas leitura/escrita DB, zero integração.

---

### **TIER 2: Créditos Baixos (1x/dia ou menos)**

```
✅ Análise Cruzada Clientes → 1x/dia 06:00 (CORRETO)
✅ Resumo Compras Diário → 1x/dia 10:00 (CORRETO)
✅ Análise Diária Contatos → MUDAR PARA 1x/dia 09:00
```

**MUDANÇA CRÍTICA:**
```javascript
// ANTES (15min):
- 12 contatos × 96 exec/dia = 57.600 créditos ❌

// DEPOIS (1x/dia):
- 100 contatos × 1 exec/dia = ~5.000 créditos ✅
```

---

### **TIER 3: Event-Driven (Sem ciclo fixo)**

```
⚠️ Processare Fila Promoções → MUDAR PARA:
  - Trigger: Quando FilaDisparo.status muda para 'aprovado'
  - Função backend: `processarFilaDisparo`
  - Custo: ~30 créditos por disparo REAL (não polling)
```

---

## 📋 PLANO DE AÇÃO IMEDIATO

### **1️⃣ DESATIVAR/RECONFIGURAR (2 horas de implementação)**

```bash
# Análise Diária Contatos
- MUDAR: 15min → 1x/dia 09:00
- RESULTADO: -52.000 créditos/dia

# Processare Fila Promoções  
- MUDAR: Polling 5min → Event-driven automação entity
- RESULT ADO: -8.000 créditos/dia estimado

ECONOMIA TOTAL: ~60.000 créditos/dia (CORTAR 40% DO CONSUMO)
```

---

### **2️⃣ ENTIDADES COM "ÚLTIMAS 24h" (NÃO PRECISAM RODAR FREQUENTEMENTE)**

Estas já têm filtro automático que impede reprocessamento:

✅ `analisarContatosDaily` — Busca `{ ultima_analise_comportamento < 24h }`  
✅ `gerarTarefasDeAnalise` — Busca `priority_label IN ('CRITICO','ALTO')`  
✅ `analiseCruzadaClientes` — Busca `updated_date >= 24h atrás`

**INSIGHT:** Se você roda 1x/dia, pega **TODOS OS CONTATOS** desse dia. Frequência maior = redundância pura.

---

### **3️⃣ FUNÇÕES COM "SKILLS" = ZERO CRÉDITOS**

```
✅ skillPrimeiroContatoAutonomo
  - Roda a cada 15min
  - Detecta threads travadas (DB filter)
  - Atribui a atendentes disponíveis (DB update)
  - ZERO integração → 0 créditos

✅ preAtendimentoHandler  
  - Responde via WhatsApp (integração autorizada via webhook)
  - Não chamada via automação agendada
  - ZERO custo de scheduling

✅ jarvisEventLoop
  - Monitorar idle threads (DB)
  - Enviar follow-ups (pode ter LLM opcionalmente)
  - CUSTOMIZÁVEL por créditos
```

---

## 🎯 RESUMO EXECUTIVO

| Métrica | Hoje | Depois | Economia |
|---------|------|--------|----------|
| Automações rodando | 20+ | 12-15 | -40% |
| Créditos/dia | ~9.068 | ~3.500-4.000 | -60% |
| Créditos/mês | ~272.000 | ~105.000-120.000 | ECONOMIA: 150-170k |
| Latência (ação → execução) | 5-15min | 30min-1dia | +tolerância (aceitável) |

---

## 📌 PRÓXIMOS PASSOS

1. **Confirmar:** Você quer mudar `analisarContatosDaily` para 1x/dia?
2. **Implementar:** Automação entity-triggered para `processarFilaDisparo`
3. **Desativar:** As 6 duplicatas (assim que confirmar IDs)
4. **Monitorar:** Consumo em tempo real no dashboard

---

**Autor:** Base44 AI | **Timestamp:** 2026-03-20 18:54 BRT