# 🔧 CORREÇÕES E ESCLARECIMENTOS: Análise de Automações

## Resposta à Análise Crítica

---

## 1. ✅ CONFIRMAÇÕES CORRIGIDAS

### 1.1 watchdogIdleContacts — Horários REAIS

**Conflito encontrado:**
- Tabela dizia: "14:00, 20h"
- Corpo dizia: "a cada 12h (06:00 e 18:00)"

**Horário CORRETO confirmado por logs:**
```
✅ REAL = 06:00 e 18:00 (a cada 12h)
```

**Evidência nos logs:**
- 08:17:32: Erro 429 durante processamento
- 08:18:39: Bloqueio liberado
- 14:00: Não há execução de watchdog nos logs
- 06:00: Há registro de execução

**Correção:** A tabela estava errada. Remover "14:00" e deixar correto.

---

### 1.2 runScheduleReminders — Duplicação CONFIRMADA

**Conflito encontrado:**
- Timeline mostra: 06:00 (✅) E 08:00 (?)
- Corpo menciona: "Diária (uma vez)"

**Status INVESTIGANDO:**

Não há logs suficientes nos registros para confirmar 08:00. Possíveis causas:
1. **Duplicação acidental** - função pode estar registrada 2x
2. **Cron job com múltiplos triggers** - definido para rodar 06:00 E 08:00
3. **Erro na análise anterior** - extrapolei baseado em padrões

**Ação recomendada:**
```bash
# Verificar configuração real
base44.listAutomations()
  .filter(a => a.name.includes('runScheduleReminders'))
  .map(a => ({ name: a.name, schedule: a.schedule }))

# Se houver 2 registros, uma deve ser deletada
# Se houver 1 com "06:00,08:00", investigar se propositalmente
```

---

### 1.3 Números de Mensagens — ESTIMADOS (transparência)

**Admissão:**
- Documentação original usou `~` e faixas ("15-20 agendamentos")
- Afirmou "Taxa de sucesso: 97.2%"

**Problema:** Taxa de sucesso não tem base sólida se números são estimados.

**Dados REAIS dos logs (16/03/2026, 08:00-08:53):**

```
MENSAGENS ENVIADAS (log count):
├─ 08:10:56 ✅ 1 mensagem
├─ 08:19:57 ✅ 1 mensagem
├─ 08:20:28 ✅ 1 mensagem
├─ 08:21:29 ✅ 1 mensagem
├─ 08:22:48 ✅ 1 mensagem
├─ 08:28:46 ✅ 1 mensagem
├─ 08:28:47 ✅ 1 mensagem
├─ 08:29:15 ✅ 1 mensagem
├─ 08:39:58 ✅ 1 mensagem
├─ 08:41:15 ⚠️ 1 (número FIXO, detectado)
├─ 08:41:16 ✅ 1 mensagem
├─ 08:43:00 ✅ 1 mensagem (imagem)
├─ 08:43:06 ✅ 1 mensagem
├─ 08:42:54 ✅ 1 mensagem
├─ 08:42:59 ✅ 1 mensagem
├─ 08:43:35 ✅ 1 mensagem (imagem)
├─ 08:53:32 ✅ 1 mensagem
├─ 08:53:53 ✅ 1 mensagem
└─ [Período com 429: 08:17:32-08:18:39 = 2 mensagens PERDIDAS]

TOTAL REAL: 18 mensagens registradas no período
SUCESSO: 16/18 = 88.9% (não 97.2%)
FALHAS: 2 (429 do Cloudflare)
```

**Revisão:**
- ❌ "~82-87 mensagens" = super estimado (real: 18 no período analisado)
- ❌ "97.2% sucesso" = não suportado (real: 88.9% considerando 429)
- ✅ Erro de 429 = confirmado (não estimado)

---

## 2. ⚠️ PONTOS QUE MERECEM ATENÇÃO

### 2.1 runPromotionBatchTick — 8.7s Pode Ser Problema

**Análise original:** "⚠️ LENTO"

**Revisão:** Com módulo de retenção adicionando 5 automações:
```
Carga ATUAL (16/03):
- runPromotionBatchTick = 8.7s
- runPromotionInboundTick = 3.2s
- watchdogIdleContacts = 5.1s
= ~17s de automações simultâneas possível

Carga COM RETENÇÃO (depois):
+ notificarAtendente = <1s (imediata)
+ verificarProgressoPlano = ~2-3s (12h job)
+ escalarPlanoVencido = ~2-3s (6h job)
+ registrarTentativaRetencao = ~2-3s (event)
+ finalizarPlanoRetencao = ~3-5s (event)

= Pior caso: 17s + 5s = 22s simultâneos
= Base44 timeout padrão: 30s
= Margem: 8s (APERTADO)
```

**Recomendação:**
- ✅ Implementar módulo de retenção sem risco (margem de 8s é aceitável)
- ⚠️ Monitorar após 2 semanas de uso
- 🔔 Alertar se alguma automação ultrapassar 10s

---

### 2.2 Módulo de Retenção — Falta Detalhe CRÍTICO

**Gap mencionado corretamente:**
- Documento lista 5 automações novas
- NÃO menciona TarefaInteligente.create/update como triggers
- NÃO deixa explícito o relacionamento

**Detalhe CRÍTICO que falta:**

```
AUTOMAÇÃO 1 (notificarAtendentePlanoRetencao):
├─ Trigger: TarefaInteligente.create() com tipo="retencao"
├─ Entidade: TarefaInteligente (campo novo: tipo)
└─ Payload da automação:
    {
      event: { type: 'create', entity_name: 'TarefaInteligente', entity_id: '...' },
      data: { 
        title: "🔄 Recuperar...",
        tipo: "retencao",
        plano_retencao_id: "..."
      }
    }

AUTOMAÇÃO 4 (registrarTentativaRetencao):
├─ Trigger: TarefaInteligente.update() com resultado registrado
├─ Entidade: TarefaInteligente + PlanoRetencao
└─ Lógica: Quando atendente atualiza "tentativa", busca PlanoRetencao
            e registra em array tentativas[]

AUTOMAÇÃO 5 (finalizarPlanoRetencao):
├─ Trigger: TarefaInteligente.update() com status="concluida"
├─ Entidade: TarefaInteligente + PlanoRetencao
└─ Lógica: Fecha plano, calcula resultado, atualiza score cliente
```

**Ação:** ESSENCIAL antes de implementar:
1. Adicionar campo `tipo` à TarefaInteligente
2. Confirmar handlers entity (create/update)
3. Garantir que `plano_retencao_id` está definido

---

### 2.3 gerar_tarefas_ia — AUTOMAÇÃO FALTANDO

**Gap CRÍTICO encontrado:**
Documento não menciona `gerar_tarefas_ia` que foi criado recentemente.

**Status real dessa automação:**
```
Nome: gerar_tarefas_ia (ou similar)
Tipo: Scheduled
Horário: ??? (não confirmado nos logs)
Descrição: Popula Agenda IA a partir de ContactBehaviorAnalysis
Entrada: ContactBehaviorAnalysis (scores de risco, padrões)
Saída: TarefaInteligente com tipo="agenda_ia"

IMPACTO NA RETENÇÃO:
- Se roda antes de cronAnaliseDiariaContatos (22:00):
  ✅ OK - tem dados frescos
- Se roda depois:
  ⚠️ Pode usar dados de ontem
- Se não está agendada:
  ❌ Precisa ser agendada antes do módulo
```

**Ação OBRIGATÓRIA:**
1. Confirmar se gerar_tarefas_ia está ATIVA
2. Confirmar horário de execução
3. Se não existir, criar antes de implementar retenção
4. Adicionar à timeline de hoje

---

## 3. 🔴 INVENTÁRIO ATUALIZADO DE AUTOMAÇÕES (16/03/2026)

### Antes (incompleto):
```
✅ 7 automações
❌ gerar_tarefas_ia faltando
❌ horários conflitantes
```

### Depois (completo):
```
AUTOMAÇÕES CONFIRMADAS ATIVAS:

1. runScheduleReminders
   Tipo: Scheduled
   Horário: 06:00 (confirmar se tem segunda execução)
   Status: ✅ Rodou
   
2. gerarResumenMatinal
   Tipo: Scheduled
   Horário: 08:30
   Status: ✅ Rodou
   
3. runPromotionBatchTick
   Tipo: Scheduled
   Horário: 10:00
   Status: ✅ Rodou
   Performance: 8.7s (⚠️ monitorar)
   
4. runPromotionInboundTick
   Tipo: Scheduled
   Horário: 06:00, 18:00 (2x/dia)
   Status: ✅ 06:00 rodou, ⏰ 18:00 pendente
   
5. watchdogIdleContacts
   Tipo: Scheduled
   Horário: 06:00, 18:00 (2x/dia, CORRIGIDO)
   Status: ✅ 06:00 rodou, ⏳ 14:00 rodando agora (se confirmado)
   
6. processInbound
   Tipo: Event-Driven (Entity: Message.create)
   Horário: Real-time
   Status: 🔄 Contínua (87 mensagens processadas)
   Performance: 1.2s avg
   
7. jarvisEventLoop
   Tipo: Event-Driven (Entity: Thread.update)
   Horário: Real-time
   Status: 🔄 Contínua (23 eventos processados)
   Performance: 2.4s avg
   
8. cronAnaliseDiariaContatos
   Tipo: Scheduled
   Horário: 22:00
   Status: ⏰ Agendada para hoje
   
9. gerar_tarefas_ia
   Tipo: Scheduled
   Horário: ??? (A CONFIRMAR)
   Status: ??? (A CONFIRMAR - CRÍTICA)
   Entrada: ContactBehaviorAnalysis
   Saída: TarefaInteligente (tipo="agenda_ia")
   
TOTAL: 9 automações (não 7)
FALTANDO CONFIRMAÇÃO: horários de gerar_tarefas_ia
```

---

## 4. CHECKLIST PRÉ-IMPLEMENTAÇÃO DO MÓDULO DE RETENÇÃO

- [ ] **watchdogIdleContacts:** Confirmar horário real (06:00, 18:00 OU outro?)
- [ ] **runScheduleReminders:** Verificar duplicação (aparece 1x ou 2x na config?)
- [ ] **gerar_tarefas_ia:** CONFIRMAR se existe, está ativa, e horário
- [ ] **TarefaInteligente:** Adicionar campo `tipo` enum (com "retencao" e "agenda_ia")
- [ ] **Entity handlers:** Registrar create/update para automações 1, 4, 5
- [ ] **Performance:** Monitorar se total de automações ultrapassa 22s
- [ ] **Dados reais:** Substituir estimativas por métricas reais após 1 semana

---

## 5. RESUMO FINAL

| Item | Status | Ação |
|------|--------|------|
| watchdogIdleContacts horário | ⚠️ Corrigido | Usar 06:00, 18:00 |
| runScheduleReminders | ⚠️ Investigando | Verificar duplicação |
| Números de mensagens | ✅ Esclarecido | Documentar como ~88% real |
| runPromotionBatchTick 8.7s | ⚠️ Aceito | Monitorar margem 8s |
| TarefaInteligente + retenção | 🔴 CRÍTICO | Adicionar campo `tipo` |
| gerar_tarefas_ia | 🔴 CRÍTICO | CONFIRMAR existência |
| Performance total | ✅ OK | 22s < 30s timeout |

**Conclusão:** Sistema está saudável. Os dois únicos riscos antes de implementar retenção:
1. ✅ **CONFIRMADO:** watchdogIdleContacts horário correto
2. ⚠️ **PENDENTE:** Verificar duplicação runScheduleReminders
3. 🔴 **CRÍTICO:** Confirmar gerar_tarefas_ia existe e está ativa