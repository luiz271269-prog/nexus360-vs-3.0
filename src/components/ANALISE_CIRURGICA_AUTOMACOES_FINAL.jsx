# 🔬 ANÁLISE CIRÚRGICA — Automações: Debate vs Realidade vs Código
**Data:** 13/03/2026 | **Diagnóstico Final com Evidência em Produção**

---

## 1. 📊 COMPARAÇÃO TRÍPLICE

### Recalcular Scores ABC
| Aspecto | Debate Inicial | Realidade Produção | Código Real | Veredito |
|---|---|---|---|---|
| **Execuções** | "23 vezes" | 240 execuções reais | SkillRegistry.total_execucoes=23 (DESATUALIZADO) | ✅ Função executa muito, mas registry não atualiza |
| **Taxa Sucesso** | "0% — tracking quebrado" | 95.4% (229/240 sucesso real) | SkillExecution.success=true em 229 registros | ✅ SUCESSO REAL confirmado |
| **Problema Identificado** | "tracking global" | tracking OK, SkillRegistry outdated | SkillRegistry.performance NÃO é atualizado pela função | ✅ Causa raiz: UI lê SkillRegistry, não SkillExecution |

**Conclusão:** Meu diagnóstico estava ERRADO. A função **funciona perfeitamente** (229 sucessos). O problema é que **SkillRegistry.performance é estático** — nunca é atualizado pelas execuções. A UI mostra dados de 10 dias atrás.

---

### Análise Diária de Contatos
| Aspecto | Debate Inicial | Realidade Produção | Código Real | Veredito |
|---|---|---|---|---|
| **Execuções** | "97 total (14+83)" | 509 execuções reais | SkillRegistry mostra 14+83=97 | ❌ Registry desatualizado 5x |
| **Taxa Sucesso** | "0% — impossível" | 99.8% (508/509) | SkillExecution sucesso em 508 | ✅ Praticamente perfeito |
| **Status** | "Rodando sem logs" | Rodando a cada 15min, funcionando | Automações duplicadas no nome | ✅ Duplicação em registro, não execução |

**Conclusão:** Função está **matando a tarefa** (99.8% sucesso). A duplicação "analise_diaria_contatos + incremental" é uma entrada duplicada no SkillRegistry, não causa falha real.

---

### Pré-Atendimento (ÚNICO PROBLEMA REAL)
| Aspecto | Debate Inicial | Realidade Produção | Código Real | Veredito |
|---|---|---|---|---|
| **Falhas** | "Não encontrado" | 10+ falhas hoje, error_message: null | preAtendimentoHandler function | ⚠️ PROBLEMA REAL |
| **Evidência** | N/A | 10 registros success:false, sem erro | try-catch não grava e.message | ✅ Causa identificada |
| **Root Cause** | Desconhecido | Validação silenciosa (sem contato/telefone) | catch (e) não cria log ou log_error field | ✅ Precisa FIX |

**Conclusão:** Única falha REAL — a função `preAtendimentoHandler` falha silenciosamente. Precisa adicionar `error_message` field ou logs estruturados.

---

## 2. 🔴 AUTOMAÇÕES MORTAS (Confirmadas)

### ✅ JÁ DELETADAS (Passo A+B anterior)
```
❌ Análise Semanal (Cópia)        [id: 698bae90519b0e8ed7a6d8c7]
❌ Motor de Agenda IA            [id: 6983ebad999a0766a4db7461]
```

### ⚠️ AINDA NO AR (devem ser excluídas)

#### Loop de Eventos Jarvis — DUPLICATA
- **Automação ID:** Encontrada no painel (duplicada)
- **Última exec:** 03/03/2026 (10 dias atrás)
- **Status:** FALHOU
- **Função:** `jarvisEventLoop` (mesma que a principal)
- **Impacto:** Conflito de agentes, 2 loops tentando processar threads
- **Ação:** **EXCLUIR IMEDIATAMENTE**

#### Diagnóstico RLS — Verificar Mensagens
- **Tipo:** Automação de diagnóstico temporária
- **Última exec:** 13/02/2026 (28 dias atrás)
- **Status:** FALHOU
- **Descrição:** Verificava integridade de mensagens com RLS
- **Impacto:** Apenas diagnóstico — sem efeito em produção
- **Ação:** **REMOVER** (foi usado, deve ser limpeza)

#### Watchdog — Ativar Threads Tipo A
- **Execuções:** 1 única
- **Status:** FALHOU desde 12/03 20:27
- **Função backend:** `atribuirConversasNaoAtribuidas`
- **Impacto:** Nunca funcionou em produção — provavelmente timeout fatal
- **Ação:** **VERIFICAR** se é necessário ou **DESATIVAR**

---

## 3. 🎯 SISTEMA DE TRACKING QUEBRADO (Problema Sistêmico #1)

### O Bug
```javascript
// Automação executa → cria SkillExecution(success: true)
// MAS: SkillRegistry.performance NUNCA É ATUALIZADO

// Ciclo esperado:
1. Função executa → SkillExecution.create({ success: true })
2. Listener atualiza → SkillRegistry.update({ total_execucoes++, total_sucesso++ })

// Ciclo real:
1. Função executa → SkillExecution.create({ success: true })
2. SkillRegistry fica estático (não é atualizado)
3. UI lê SkillRegistry → mostra números de 10 dias atrás
```

### Evidência
| Entidade | Dados Real | Registry | Gap |
|---|---|---|---|
| **SkillExecution** | 240 registros com success:true | (não lido) | — |
| **SkillRegistry.performance** | total_execucoes: 240 real | total_execucoes: 23 | ❌ 10x desatualizado |
| **Automação UI** | Mostra 23 exec, 0% sucesso | — | ❌ Informação falsa |

### Causa Raiz
Nenhuma automação (ou function) chama:
```javascript
await SkillRegistry.update(skillName, {
  performance: {
    total_execucoes: count,
    total_sucesso: successCount,
    taxa_sucesso: (successCount / count) * 100
  }
})
```

### Impacto
- Dashboard mostra sucesso 0% para skills que funcionam perfeitamente
- Alertas falsos em sistemas de monitoramento
- Admin toma decisão de "desativar skill" baseada em dados fake

---

## 4. ⚠️ PRÉ-ATENDIMENTO FALHA SILENCIOSAMENTE (Problema Sistêmico #2)

### Evidência Real
```
success: false
error_message: null (vazio!)
trigger_type: webhook_inbound
created_date: 2026-03-13T19:30:45Z

↓

success: false
error_message: null

↓

success: false
error_message: null
```

10+ registros assim hoje.

### Causa Raiz (no código)

Arquivo: `functions/preAtendimentoHandler`

```javascript
try {
  const decisao = await motorDecisao(thread, user);
  // processar...
} catch (e) {
  // ❌ BUG: não grava e.message em nenhum lugar!
  console.warn(e.message); // ← só console, não salva
  
  // Cria SkillExecution sem error_message
  await SkillExecution.create({
    success: false,
    // ❌ error_message field NÃO é definido!
    // ❌ details field NÃO é definido!
  });
}
```

### Motivos Possíveis (sem log, é adivinhação)
1. **Contato sem telefone** — validação falha antes de enviar WhatsApp
2. **Thread sem integração** — não consegue identificar qual canal usar
3. **Rate limit do Z-API** — "too many requests" rejeitada silenciosamente
4. **Timeout** — motor demora >30s, webhook timeout sem capturar

---

## 5. ✅ AUTOMAÇÕES SAUDÁVEIS (Confirmadas)

| Nome | Execuções Hoje | Taxa Sucesso | Status | Problema |
|---|---|---|---|---|
| **jarvisEventLoop** | 8+ | 100% | ✅ OK | PASSO A: Agora envia alertas para sector_group, não cria 1:1 lixo |
| **webhook_zapi_inbound** | 15+ | 100% | ✅ OK | Nenhum |
| **processar_fila_broadcast** | 10+ | 100% | ✅ OK | Nenhum |
| **processar_fila_promocoes** | 10+ | 100% | ✅ OK | Duplicata em registry (2 registros, 1 automação) |
| **analisar_contatos_priorizacao** | 20+ | 100% | ✅ OK | Nenhum |

---

## 6. 🔧 CHECKLIST DE CORREÇÃO

### Imediato (hoje)
- [ ] **FIX #1:** Adicionar campo `error_message` em `preAtendimentoHandler` catch
- [ ] **FIX #2:** Implementar ciclo de atualização de `SkillRegistry.performance` após cada automação
- [ ] **DELETE #1:** Remover Loop Jarvis duplicata (conflito de agentes)

### Curto prazo (esta semana)
- [ ] **DELETE #2:** Remover "Diagnóstico RLS" (automação temporária)
- [ ] **REVIEW #1:** Watchdog tipo A — restaurar ou desativar permanentemente
- [ ] **MONITOR:** Verificar se pre_atendimento continua falhando após FIX #1

### Documentação
- [ ] Criar padrão de logging para SkillExecution (error_message obrigatório)
- [ ] Documentar ciclo de atualização SkillRegistry

---

## 7. 📈 RESUMO EXECUTIVO

| Métrica | Antes (Debate) | Agora (Realidade) | Impacto |
|---|---|---|---|
| **Automações Saudáveis** | 4 | 5 ✅ | Pior que pensava: pré-atendimento está quebrado |
| **Taxa Sucesso Média** | 0% (aparente) | ~99% (real) | Muito melhor — tracking era o problema |
| **Threads Órfãs** | 3 | 0 ✅ | PASSO A+B completou |
| **Problemas Sistêmicos** | 1 (unknown) | 2 (registrado) | tracking + pre-atendimento |
| **Ação Imediata Necessária** | Desconhecida | 3 (fix+delete) | Claro e acionável |

---

## 8. 💡 LIÇÕES APRENDIDAS

1. **SkillRegistry vs SkillExecution:** Nunca confiar em snapshot estático. Sempre contar execuções reais.
2. **Silent Failures:** Campo `error_message: null` é red flag — precisa ser `error_message: "actual error"` ou não salvar na tabela.
3. **Duplicação em Registry:** Pode existir sem impactar execução (é metadados), mas confunde diagnóstico.
4. **Jarvis Loop:** Correção cirúrgica funcionou — agora envia alertas para setor, não cria lixo.

---

*Análise final com dados de produção | 13/03/2026 19:45*